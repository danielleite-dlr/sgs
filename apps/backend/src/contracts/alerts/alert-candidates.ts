import { allocateInstallments, computeContractStatus, daysBetween } from '../domain/contract-math';
import { formatBRL, formatDateBR } from '../domain/contract-template';

export const ALERT_KINDS = [
  'contract_balance_due_soon',
  'contract_balance_overdue',
  'contract_deposit_unpaid',
  'contract_installment_due_soon',
  'contract_installment_overdue',
  'contract_not_accepted',
  'bridal_companion_deposit_pending',
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export interface AlertCandidate {
  kind: AlertKind;
  entityType: 'contract' | 'bridal_group';
  entityId: string;
  state: string;
  /** `${kind}:${entityId}:${state}` */
  dedupeKey: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
}

export interface AlertContractInput {
  id: string;
  code: string;
  status: string;
  brideName: string;
  contractorName: string;
  debutanteName: string | null;
  paymentMode: 'sinal' | 'sinal_parcelado' | 'a_vista';
  installments: { seq: number; dueDate: string; cents: number }[];
  totalCents: number;
  depositCents: number;
  /** Pagamentos assinados (estornos negativos). */
  paymentsCents: number[];
  balanceDueDate: string;
  createdLocalDate: string;
  acceptedLocalDate: string | null;
  linkGeneratedLocalDate: string | null;
  currentVersion: number;
}

export interface AlertCompanionInput {
  groupId: string;
  groupName: string;
  eventDate: string;
  memberId: string;
  clientName: string;
  depositCents: number;
  hasAppointments: boolean;
}

export interface BuildAlertCandidatesInput {
  today: string;
  settings: { depositUnpaidDays: number; notAcceptedDays: number; companionDepositDays: number };
  contracts: AlertContractInput[];
  companions: AlertCompanionInput[];
}

function make(
  kind: AlertKind,
  entityType: AlertCandidate['entityType'],
  entityId: string,
  state: string,
  title: string,
  message: string,
  extra: Record<string, unknown>,
): AlertCandidate {
  const dedupeKey = `${kind}:${entityId}:${state}`;
  return {
    kind,
    entityType,
    entityId,
    state,
    dedupeKey,
    title,
    message,
    payload: { title, message, dedupeKey, state, ...extra },
  };
}

export function buildAlertCandidates(input: BuildAlertCandidatesInput): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  const { today, settings } = input;

  for (const c of input.contracts) {
    if (c.status !== 'active' && c.status !== 'awaiting_acceptance') continue;
    const label = `${c.code} — ${c.brideName}`;
    const extra = { contractId: c.id, code: c.code };

    if (c.status === 'awaiting_acceptance') {
      if (
        c.linkGeneratedLocalDate &&
        daysBetween(c.linkGeneratedLocalDate, today) >= settings.notAcceptedDays
      ) {
        out.push(
          make(
            'contract_not_accepted',
            'contract',
            c.id,
            `v${c.currentVersion}`,
            'Contrato não aceito',
            `${label}: o link de aceite foi gerado em ${formatDateBR(c.linkGeneratedLocalDate)} e a noiva ainda não aceitou.`,
            extra,
          ),
        );
      }
      continue;
    }

    const st = computeContractStatus({
      status: c.status,
      totalCents: c.totalCents,
      depositCents: c.depositCents,
      paymentsCents: c.paymentsCents,
      balanceDueDate: c.balanceDueDate,
      today,
      depositReferenceDate: c.acceptedLocalDate ?? c.createdLocalDate,
      depositUnpaidDays: settings.depositUnpaidDays,
    });

    const aVista = c.paymentMode === 'a_vista';
    const instLabel = c.debutanteName
      ? `${c.code} — ${c.contractorName} (debutante ${c.debutanteName})`
      : `${c.code} — ${c.contractorName}`;
    const n = c.installments.length;
    if (n > 0) {
      const net = c.paymentsCents.reduce((a, b) => a + b, 0);
      for (const i of allocateInstallments(c.installments, net, today)) {
        if (i.pendingCents <= 0) continue;
        const state = `p${i.seq}:${i.dueDate}`;
        const what = aVista ? 'Pagamento à vista' : 'Parcela do sinal';
        const ext = { ...extra, seq: i.seq, dueDate: i.dueDate };
        if (i.overdue) {
          const ref = aVista ? 'o pagamento à vista' : `a parcela ${i.seq}/${n}`;
          out.push(
            make(
              'contract_installment_overdue',
              'contract',
              c.id,
              state,
              aVista ? 'Pagamento à vista vencido' : 'Parcela do sinal vencida',
              `${instLabel}: ${ref} de ${formatBRL(i.pendingCents)} venceu em ${formatDateBR(i.dueDate)}.`,
              ext,
            ),
          );
        } else {
          const d = daysBetween(today, i.dueDate);
          if (d >= 0 && d <= 3) {
            out.push(
              make(
                'contract_installment_due_soon',
                'contract',
                c.id,
                state,
                d === 0 ? `${what} vence hoje` : `${what} vence em ${d} dia(s)`,
                `${instLabel}: ${aVista ? 'pagamento à vista' : `parcela ${i.seq}/${n}`} de ${formatBRL(i.pendingCents)} vence em ${formatDateBR(i.dueDate)}.`,
                ext,
              ),
            );
          }
        }
      }
    }

    if (n === 0 && st.depositOverdue) {
      out.push(
        make(
          'contract_deposit_unpaid',
          'contract',
          c.id,
          'pending',
          'Entrada não paga',
          `${label}: entrada de ${formatBRL(st.depositPendingCents)} ainda não foi paga.`,
          extra,
        ),
      );
    }
    if (aVista) continue;
    if (st.balanceOverdue) {
      out.push(
        make(
          'contract_balance_overdue',
          'contract',
          c.id,
          c.balanceDueDate,
          'Restante vencido',
          `${label}: saldo ${formatBRL(st.balanceCents)} venceu em ${formatDateBR(c.balanceDueDate)}.`,
          extra,
        ),
      );
    } else if (st.balanceDueSoon) {
      const dn = st.daysToBalanceDue;
      out.push(
        make(
          'contract_balance_due_soon',
          'contract',
          c.id,
          c.balanceDueDate,
          dn === 0 ? 'Restante vence hoje' : `Restante vence em ${dn} dia(s)`,
          `${label}: saldo ${formatBRL(st.balanceCents)} até ${formatDateBR(c.balanceDueDate)}.`,
          extra,
        ),
      );
    }
  }

  for (const p of input.companions) {
    if (!p.hasAppointments || p.depositCents > 0) continue;
    const d = daysBetween(today, p.eventDate);
    if (d < 0 || d > settings.companionDepositDays) continue;
    out.push(
      make(
        'bridal_companion_deposit_pending',
        'bridal_group',
        p.groupId,
        `${p.memberId}:${p.eventDate}`,
        'Sinal pendente de acompanhante',
        `${p.clientName} — ${p.groupName}, evento em ${formatDateBR(p.eventDate)}.`,
        { groupId: p.groupId, memberId: p.memberId },
      ),
    );
  }

  return out;
}

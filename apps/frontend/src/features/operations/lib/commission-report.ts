import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';

/** Linha do relatório de comissões que vai para a profissional. */
export interface CommissionReportRow {
  serviceDate: string;
  clientName: string | null;
  itemName: string;
  chargedAmount: string;
  calculatedAmount: string;
  kind: string;
  /** Observação da linha (ex.: teste de noiva incluso). */
  note?: string | null;
}

export interface CommissionReportInput {
  salonName: string | null;
  memberName: string;
  from: string;
  /** Exclusivo (YYYY-MM-DD), como no PeriodFilter. */
  to: string;
  rows: CommissionReportRow[];
  total: string;
}

export const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** YYYY-MM-DD → DD/MM/AAAA sem passar por fuso. */
function ymd(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** Período para exibir: o `to` exclusivo vira o último dia incluído. */
export function periodLabel(from: string, to: string): string {
  const [y, m, d] = to.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return last <= from ? ymd(from) : `${ymd(from)} a ${ymd(last)}`;
}

/** Campos que `reportRows` usa para juntar as linhas. */
export interface CommissionRowLike extends CommissionReportRow {
  id: string;
  reversed: boolean;
  reversesRecordId?: string | null;
  bridalTrialIncluded?: boolean;
  trialDate?: string | null;
  contractId?: string | null;
}

const cents = (v: string) => Math.round(Number(v) * 100);
const fromCents = (c: number) => (c / 100).toFixed(2);

/**
 * Linhas do relatório (261117-mtn), uma por atendimento:
 * - lançamento estornado + estorno, os dois no período, somem (a comanda foi reaberta e fechada de novo);
 * - o teste de noiva incluso no contrato faz parte do dia da noiva: soma na linha do evento do mesmo
 *   contrato ("teste em dd/mm incluso"); sem o evento no período, fica uma linha avisando que o teste
 *   leva metade da comissão e a outra metade sai no dia da noiva (261124-ijh).
 * A soma das comissões não muda.
 */
export function reportRows<T extends CommissionRowLike>(rows: T[]): T[] {
  const ids = new Set(rows.map((r) => r.id));
  const reversedHere = new Set(
    rows
      .filter((r) => r.kind === 'reversal' && r.reversesRecordId && ids.has(r.reversesRecordId))
      .map((r) => r.reversesRecordId as string),
  );
  const live = rows.filter(
    (r) =>
      !reversedHere.has(r.id) &&
      !(r.kind === 'reversal' && r.reversesRecordId && reversedHere.has(r.reversesRecordId)),
  );

  const isTrial = (r: T) => r.kind === 'accrual' && !!r.bridalTrialIncluded && !!r.contractId;
  const events = new Map<string, T>();
  for (const r of live) {
    if (r.kind === 'accrual' && !r.bridalTrialIncluded && r.contractId && !events.has(r.contractId)) {
      events.set(r.contractId, r);
    }
  }
  const merged = new Map<string, T>();
  const out: T[] = [];
  for (const r of live) {
    if (isTrial(r) && events.has(r.contractId as string)) {
      const ev = events.get(r.contractId as string) as T;
      const cur = merged.get(ev.id) ?? ev;
      merged.set(ev.id, {
        ...cur,
        calculatedAmount: fromCents(cents(cur.calculatedAmount) + cents(r.calculatedAmount)),
        chargedAmount: fromCents(cents(cur.chargedAmount) + cents(r.chargedAmount)),
        trialDate: cur.trialDate ?? r.serviceDate,
      });
      continue;
    }
    out.push(
      isTrial(r) ? { ...r, note: 'Teste da noiva (incluso; metade da comissão, o resto no dia da noiva)' } : r,
    );
  }
  return out.map((r) => {
    const m = merged.get(r.id) ?? r;
    if (m.trialDate && !m.bridalTrialIncluded && m.contractId && m.kind === 'accrual') {
      return { ...m, note: `Dia da noiva + teste em ${formatDay(m.trialDate)} (1 atendimento)` };
    }
    return m;
  });
}

export function buildWhatsAppText(r: CommissionReportInput): string {
  const lines: string[] = [];
  lines.push(`*Relatório de comissões${r.salonName ? ` — ${r.salonName}` : ''}*`);
  lines.push(`Profissional: ${r.memberName}`);
  lines.push(`Período: ${periodLabel(r.from, r.to)}`);
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('Nenhum atendimento com comissão no período.');
  } else {
    for (const row of r.rows) {
      const estorno = row.kind === 'reversal' ? ' (estorno)' : '';
      const note = row.note ? ` (${row.note})` : '';
      lines.push(
        `${formatDay(row.serviceDate)} · ${row.clientName ?? 'Cliente não informado'} · ` +
          `${row.itemName}${estorno}${note} · ${brl(row.calculatedAmount)}`,
      );
    }
  }
  lines.push('');
  lines.push(`*Total: ${brl(r.total)}*`);
  return lines.join('\n');
}

/**
 * Link do WhatsApp. Telefone brasileiro sem DDI (10–11 dígitos) ganha o 55;
 * sem telefone abre o WhatsApp para escolher o contato.
 */
export function whatsAppUrl(phone: string | null | undefined, text: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  const q = `text=${encodeURIComponent(text)}`;
  return digits.length >= 12 ? `https://wa.me/${digits}?${q}` : `https://wa.me/?${q}`;
}

import type { TenantPrismaClient } from '../database/types';
import { fromCents, toCents } from '../common/money';
import { computeComandaTotals } from './comanda-math';

const COMANDA_INCLUDE = {
  client: true,
  items: {
    include: {
      professional: {
        include: {
          user: { select: { email: true } },
          role: { select: { name: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  payments: { orderBy: { paidAt: 'asc' } },
  appointments: { select: { id: true } },
} as const;

type ComandaRow = NonNullable<
  Awaited<ReturnType<typeof findRows>>
>[number];

function findRows(tx: TenantPrismaClient, ids: string[]) {
  return tx.comanda.findMany({
    where: { id: { in: ids } },
    include: COMANDA_INCLUDE,
    orderBy: { openedAt: 'desc' },
  });
}

const money = (v: unknown) => fromCents(toCents(v as string | number));

/** Membro enxuto: dados pessoais (telefone, pix, nascimento) não saem da comanda (LGPD). */
function memberView(m: ComandaRow['items'][number]['professional']) {
  return {
    id: m.id,
    displayName: m.displayName,
    email: m.user.email,
    roleName: m.role.name,
    seniorityTier: m.seniorityTier,
    isProfessional: m.isProfessional,
    status: m.status,
    phone: null,
    pixKey: null,
    birthDate: null,
    categories: m.categories.map((c) => ({ id: c.category.id, name: c.category.name })),
    createdAt: m.createdAt,
  };
}

type CommissionRow = Awaited<ReturnType<typeof findCommissionRows>>[number];

function findCommissionRows(tx: TenantPrismaClient, comandaIds: string[]) {
  return tx.commissionRecord.findMany({
    where: { comandaId: { in: comandaIds } },
    include: { member: { select: { displayName: true } } },
    orderBy: [{ calculatedAt: 'asc' }, { createdAt: 'asc' }],
  });
}

/** Registros do ciclo atual (accrual + reversal) no formato do SDL (D-24: noRule não revertido = aviso). */
function serializeCommissions(row: ComandaRow, all: CommissionRow[]) {
  const cycleRows = all.filter((r) => r.comandaId === row.id && r.cycle === row.closeCycle);
  const reversedIds = new Set(
    cycleRows.filter((r) => r.kind === 'reversal').map((r) => r.reversesRecordId),
  );
  return cycleRows.map((r) => {
    const snap = (r.ruleSnapshot ?? {}) as { itemName?: string };
    return {
      id: r.id,
      comandaItemId: r.comandaItemId,
      memberId: r.memberId,
      memberName: r.member.displayName,
      itemName: snap.itemName ?? '',
      kind: r.kind,
      cycle: r.cycle,
      baseAmount: money(r.baseAmount),
      chargedAmount: money(r.chargedAmount),
      calculatedAmount: money(r.calculatedAmount),
      noRule: r.noRule,
      reversed: r.kind === 'accrual' && reversedIds.has(r.id),
    };
  });
}

export type ComandaCommissionView = ReturnType<typeof serializeCommissions>[number];

/** Converte a linha do Prisma no formato do SDL (Decimals em string, totais calculados). */
export function serializeComanda(
  row: ComandaRow,
  creditBalanceCents: number,
  commissionRows: CommissionRow[] = [],
) {
  const commissions = serializeCommissions(row, commissionRows);
  const totals = computeComandaTotals(
    toCents(row.total),
    row.payments.map((p) => ({ method: p.method, cents: toCents(p.amount) })),
  );
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    clientId: row.clientId,
    client: row.client,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    closeCycle: row.closeCycle,
    total: fromCents(totals.totalCents),
    paid: fromCents(totals.paidCents),
    remaining: fromCents(totals.remainingCents),
    change: fromCents(totals.changeCents),
    canClose: totals.canClose,
    closeError: totals.error,
    clientCreditBalance: fromCents(creditBalanceCents),
    items: row.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      serviceId: i.serviceId,
      productId: i.productId,
      packageId: i.packageId,
      appointmentId: i.appointmentId,
      serviceVariantId: i.serviceVariantId,
      professionalId: i.professionalId,
      professional: memberView(i.professional),
      name: i.nameSnapshot,
      quantity: i.quantity,
      listUnitPrice: money(i.listUnitPrice),
      unitPrice: money(i.unitPrice),
      total: money(i.total),
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: money(p.amount),
      paidAt: p.paidAt,
      memberId: p.memberId,
    })),
    appointmentIds: row.appointments.map((a) => a.id),
    commissions,
    hasCommissionWarnings: commissions.some(
      (c) => c.kind === 'accrual' && c.noRule && !c.reversed,
    ),
  };
}

export type ComandaView = ReturnType<typeof serializeComanda>;

/** Saldo de crédito por cliente (soma do ledger), em centavos. */
async function creditBalances(
  tx: TenantPrismaClient,
  clientIds: string[],
): Promise<Map<string, number>> {
  const groups = await tx.clientCreditMovement.groupBy({
    by: ['clientId'],
    where: { clientId: { in: clientIds } },
    _sum: { amount: true },
  });
  return new Map(groups.map((g) => [g.clientId, toCents(g._sum.amount ?? 0)]));
}

/** Várias comandas na ordem pedida (mais recente primeiro quando vem de lista). */
export async function loadComandaViews(
  tx: TenantPrismaClient,
  ids: string[],
): Promise<ComandaView[]> {
  if (ids.length === 0) return [];
  const rows = await findRows(tx, ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const balances = await creditBalances(tx, [...new Set(rows.map((r) => r.clientId))]);
  const commissionRows = await findCommissionRows(
    tx,
    rows.map((r) => r.id),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is ComandaRow => !!r)
    .map((r) => serializeComanda(r, balances.get(r.clientId) ?? 0, commissionRows));
}

export async function loadComandaView(
  tx: TenantPrismaClient,
  comandaId: string,
): Promise<ComandaView | null> {
  return (await loadComandaViews(tx, [comandaId]))[0] ?? null;
}

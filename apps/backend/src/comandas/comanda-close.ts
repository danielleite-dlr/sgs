import type { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit-log';
import { fromCents, toCents } from '../common/money';
import { applyStockDelta, StockError } from '../catalog/products/stock';
import type { TenantPrismaClient } from '../database/types';
import { recordCashMovement, type CashMethod } from '../financial/cash-ledger';
import { CreditError, lockClient, recordCreditMovement } from '../financial/client-credit';
import {
  categoryChain,
  computeCommission,
  resolveCommissionRule,
  type RuleLite,
} from '../financial/commission-resolver';
import { loadCategoryParents } from '../identity/member-categories';
import { CLIENT_CREDIT_METHOD, computeComandaTotals, coveredCents } from './comanda-math';
import { ComandaError, recalcComandaTotal } from './comanda-items';

type LockedComanda = {
  id: string;
  code: string;
  status: string;
  client_id: string;
  close_cycle: number;
  total: Prisma.Decimal;
};

async function lockComanda(tx: TenantPrismaClient, comandaId: string): Promise<LockedComanda> {
  const rows = await tx.$queryRaw<LockedComanda[]>`
    SELECT id, code, status, client_id, close_cycle, total
      FROM comandas WHERE id = ${comandaId}::uuid FOR UPDATE`;
  const c = rows[0];
  if (!c) throw new ComandaError('NOT_FOUND', 'Comanda não encontrada.', 'id');
  return c;
}

const brl = (cents: number) => fromCents(cents).replace('.', ',');

/**
 * Fechamento financeiro atômico (D-12). Roda inteiro na transação do chamador
 * (`runWithTenant` com timeout maior); qualquer erro lançado desfaz tudo.
 * Idempotente: o FOR UPDATE + status 'open' faz o segundo fechamento falhar
 * com COMANDA_NOT_OPEN.
 */
export async function closeComandaTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  comandaId: string,
  now = new Date(),
): Promise<void> {
  const comanda = await lockComanda(tx, comandaId);
  if (comanda.status !== 'open') {
    throw new ComandaError('COMANDA_NOT_OPEN', 'A comanda não está aberta.', 'id');
  }

  const items = await tx.comandaItem.findMany({
    where: { comandaId },
    include: { service: { select: { categoryId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (items.length === 0) {
    throw new ComandaError('EMPTY_COMANDA', 'Adicione ao menos um item.', 'id');
  }
  await recalcComandaTotal(tx, comandaId);
  const [{ total }] = await tx.$queryRaw<{ total: Prisma.Decimal }[]>`
    SELECT total FROM comandas WHERE id = ${comandaId}::uuid`;
  const payments = await tx.comandaPayment.findMany({ where: { comandaId } });
  // D-08: itens cobertos por contrato não são cobrados; estoque e comissão seguem em TODOS os itens.
  const covered = coveredCents(
    items.map((i) => ({ totalCents: toCents(i.total), contractId: i.contractId })),
  );
  const totals = computeComandaTotals(
    toCents(total) - covered,
    payments.map((p) => ({ method: p.method, cents: toCents(p.amount) })),
  );
  if (totals.error === 'INSUFFICIENT_PAYMENT') {
    throw new ComandaError(
      'INSUFFICIENT_PAYMENT',
      `Falta R$ ${brl(totals.remainingCents)} para fechar.`,
      'id',
    );
  }
  if (totals.error === 'INVALID_CHANGE') {
    throw new ComandaError('INVALID_CHANGE', 'O troco só pode sair de pagamento em dinheiro.', 'id');
  }

  const cycle = comanda.close_cycle + 1;

  // Crédito do cliente (ordem de locks: comanda -> cliente)
  if (totals.creditCents > 0) {
    await lockClient(tx, comanda.client_id);
    await recordCreditMovement(tx, {
      orgId,
      clientId: comanda.client_id,
      amountCents: -totals.creditCents,
      kind: 'consumption',
      comandaId,
      cycle,
      createdBy: memberId,
    });
  }

  // Estoque (ordenado por produto: evita deadlock entre fechamentos paralelos)
  const productQty = new Map<string, number>();
  for (const i of items) {
    if (i.kind === 'product' && i.productId) {
      productQty.set(i.productId, (productQty.get(i.productId) ?? 0) + i.quantity);
    }
  }
  for (const productId of [...productQty.keys()].sort()) {
    await applyStockDelta(tx, {
      orgId,
      productId,
      delta: -(productQty.get(productId) as number),
      type: 'sale',
      reason: `Venda ${comanda.code}`,
      performedBy: memberId,
      comandaId,
    });
  }

  // Comissão (snapshot imutável; D-23 preço cheio, D-24 sem regra = 0 + aviso)
  const ruleRows = await tx.commissionRule.findMany({ where: { deletedAt: null } });
  const rules: RuleLite[] = ruleRows.map((r) => ({
    id: r.id,
    scopeType: r.scopeType as RuleLite['scopeType'],
    kind: r.kind as RuleLite['kind'],
    value: r.value.toString(),
    memberId: r.memberId,
    serviceId: r.serviceId,
    categoryId: r.categoryId,
    productId: r.productId,
    deletedAt: r.deletedAt,
  }));
  const parents = await loadCategoryParents(tx);
  const records: Prisma.CommissionRecordCreateManyInput[] = items.map((item) => {
    const match = resolveCommissionRule(rules, {
      kind: item.kind === 'product' ? 'product' : 'service',
      memberId: item.professionalId,
      serviceId: item.serviceId,
      productId: item.productId,
      categoryChain: categoryChain(item.service?.categoryId ?? null, parents),
    });
    const c = computeCommission(match, {
      listUnitCents: toCents(item.listUnitPrice),
      quantity: item.quantity,
      chargedCents: toCents(item.total),
    });
    const rule = match?.rule ?? null;
    return {
      organizationId: orgId,
      comandaId,
      comandaItemId: item.id,
      memberId: item.professionalId,
      kind: 'accrual',
      cycle,
      baseAmount: fromCents(c.baseCents),
      chargedAmount: fromCents(c.chargedCents),
      ruleId: rule?.id ?? null,
      ruleKind: rule?.kind ?? null,
      ruleValue: rule?.value ?? null,
      noRule: c.noRule,
      calculatedAmount: fromCents(c.amountCents),
      ruleSnapshot: {
        ruleId: rule?.id ?? null,
        scopeType: rule?.scopeType ?? null,
        kind: rule?.kind ?? null,
        value: rule?.value ?? null,
        memberId: rule?.memberId ?? null,
        serviceId: rule?.serviceId ?? null,
        categoryId: rule?.categoryId ?? null,
        productId: rule?.productId ?? null,
        matchedCategoryId: match?.matchedCategoryId ?? null,
        baseAmount: fromCents(c.baseCents),
        chargedAmount: fromCents(c.chargedCents),
        listUnitPrice: fromCents(toCents(item.listUnitPrice)),
        quantity: item.quantity,
        itemName: item.nameSnapshot,
        packageId: item.packageId,
        fixedPer: 'unit',
        noRule: c.noRule,
      },
      calculatedAt: now,
    };
  });
  await tx.commissionRecord.createMany({ data: records });

  // Caixa
  for (const p of payments) {
    if (p.method === CLIENT_CREDIT_METHOD) continue;
    await recordCashMovement(tx, {
      orgId,
      kind: 'payment_in',
      method: p.method as CashMethod,
      amountCents: toCents(p.amount),
      comandaId,
      clientId: comanda.client_id,
      cycle,
      memberId,
      occurredAt: now,
    });
  }
  if (totals.changeCents > 0) {
    await recordCashMovement(tx, {
      orgId,
      kind: 'change_out',
      method: 'cash',
      amountCents: -totals.changeCents,
      comandaId,
      clientId: comanda.client_id,
      cycle,
      memberId,
      occurredAt: now,
    });
  }

  await tx.$executeRaw`
    UPDATE comandas
       SET status = 'closed', closed_at = ${now}, closed_by = ${memberId}::uuid,
           close_cycle = ${cycle}, updated_at = now()
     WHERE id = ${comandaId}::uuid`;

  await tx.appointment.updateMany({
    where: { comandaId, status: { in: ['scheduled', 'confirmed', 'in_progress'] } },
    data: { status: 'completed' },
  });
}

/**
 * Reabertura auditada (D-08). Tudo é reversão append-only: estoque (return),
 * comissão (reversal negativo), crédito (reopen_refund) e caixa (reversal).
 */
export async function reopenComandaTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  comandaId: string,
  reason: string,
  now = new Date(),
): Promise<void> {
  const why = (reason ?? '').trim();
  if (why.length < 3) {
    throw new ComandaError('REASON_REQUIRED', 'Informe o motivo da reabertura.', 'reason');
  }
  const comanda = await lockComanda(tx, comandaId);
  if (comanda.status !== 'closed') {
    throw new ComandaError('COMANDA_NOT_CLOSED', 'A comanda não está fechada.', 'id');
  }
  const cycle = comanda.close_cycle;

  // Estoque: devolve o líquido vendido por produto
  const nets = await tx.$queryRaw<{ product_id: string; net: bigint }[]>`
    SELECT product_id, SUM(delta)::bigint AS net
      FROM stock_movements WHERE comanda_id = ${comandaId}::uuid
     GROUP BY product_id ORDER BY product_id`;
  for (const n of nets) {
    const net = Number(n.net);
    if (net < 0) {
      await applyStockDelta(tx, {
        orgId,
        productId: n.product_id,
        delta: -net,
        type: 'return',
        reason: `Reabertura ${comanda.code}: ${why}`,
        performedBy: memberId,
        comandaId,
      });
    }
  }

  // Comissão: um reversal por accrual do ciclo (nunca UPDATE)
  const accruals = await tx.commissionRecord.findMany({
    where: { comandaId, cycle, kind: 'accrual', reversedBy: { none: {} } },
  });
  if (accruals.length > 0) {
    await tx.commissionRecord.createMany({
      data: accruals.map((orig) => ({
        organizationId: orgId,
        comandaId,
        comandaItemId: orig.comandaItemId,
        memberId: orig.memberId,
        kind: 'reversal',
        cycle,
        baseAmount: orig.baseAmount,
        chargedAmount: orig.chargedAmount,
        ruleId: orig.ruleId,
        ruleKind: orig.ruleKind,
        ruleValue: orig.ruleValue,
        noRule: orig.noRule,
        ruleSnapshot: orig.ruleSnapshot as Prisma.InputJsonValue,
        calculatedAmount: fromCents(-toCents(orig.calculatedAmount)),
        reversesRecordId: orig.id,
        calculatedAt: now,
      })),
    });
  }

  // Crédito consumido volta
  const [{ used }] = await tx.$queryRaw<{ used: string }[]>`
    SELECT COALESCE(-SUM(amount), 0)::text AS used
      FROM client_credit_movements
     WHERE comanda_id = ${comandaId}::uuid AND cycle = ${cycle} AND kind = 'consumption'`;
  const refundCents = toCents(used);
  if (refundCents > 0) {
    await lockClient(tx, comanda.client_id);
    await recordCreditMovement(tx, {
      orgId,
      clientId: comanda.client_id,
      amountCents: refundCents,
      kind: 'reopen_refund',
      comandaId,
      cycle,
      reason: why,
      createdBy: memberId,
    });
  }

  // Caixa: estorna entradas e troco do ciclo (deposit_in permanece: é crédito do cliente)
  const cash = await tx.cashMovement.findMany({
    where: { comandaId, cycle, kind: { in: ['payment_in', 'change_out'] } },
    orderBy: { createdAt: 'asc' },
  });
  for (const m of cash) {
    await recordCashMovement(tx, {
      orgId,
      kind: 'reversal',
      method: m.method as CashMethod,
      amountCents: -toCents(m.amount),
      comandaId,
      clientId: comanda.client_id,
      cycle,
      memberId,
      occurredAt: now,
      note: `Estorno ${comanda.code}`,
    });
  }

  await tx.$executeRaw`
    UPDATE comandas
       SET status = 'open', closed_at = NULL, closed_by = NULL, updated_at = now()
     WHERE id = ${comandaId}::uuid`;

  await tx.appointment.updateMany({
    where: { comandaId, status: 'completed' },
    data: { status: 'in_progress' },
  });

  await recordAudit(tx, {
    orgId,
    actorMemberId: memberId,
    action: 'comanda.reopen',
    entityType: 'comanda',
    entityId: comandaId,
    reason: why,
    metadata: { cycle, total: fromCents(toCents(comanda.total)), code: comanda.code },
  });
}

export { StockError, CreditError };

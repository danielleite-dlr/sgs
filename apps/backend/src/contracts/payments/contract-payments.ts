import { Prisma } from '@prisma/client';
import { syncContractCoverageTx } from '../../bridal/bridal-coverage';
import { cancelGroupAppointmentsTx, rebuildTravelBlocksTx } from '../../bridal/bridal-schedule';
import { CASH_METHODS } from '../../comandas/comanda-math';
import { recordAudit } from '../../common/audit-log';
import { fromCents, parseMoneyInput, toCents } from '../../common/money';
import type { TenantPrismaClient } from '../../database/types';
import { recordCashMovement, type CashMethod } from '../../financial/cash-ledger';
import { ContractError } from '../contract-errors';
import { lockContract } from '../contract-lock';
import { computeCancellationSettlement } from '../domain/cancellation-policy';

const MAX_LINES = 5;
const PAYABLE = ['draft', 'awaiting_acceptance', 'active'];

function isCashMethod(m: string | null | undefined): m is CashMethod {
  return !!m && (CASH_METHODS as readonly string[]).includes(m);
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Σ do ledger do contrato (pagamentos − estornos − devoluções), em centavos. */
async function ledgerSumCents(tx: TenantPrismaClient, contractId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ s: Prisma.Decimal | null }[]>`
    SELECT COALESCE(SUM(amount), 0) AS s FROM contract_payments WHERE contract_id = ${contractId}::uuid`;
  return toCents(rows[0]?.s ?? 0);
}

export async function recordContractPaymentsTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  contractId: string,
  lines: { method: string; amount: string }[],
  note?: string | null,
): Promise<void> {
  if (!lines || lines.length === 0) {
    throw new ContractError('PAYMENT_LINES_REQUIRED', 'Informe ao menos um pagamento.', 'lines');
  }
  if (lines.length > MAX_LINES) {
    throw new ContractError(
      'TOO_MANY_LINES',
      `No máximo ${MAX_LINES} formas de pagamento por vez.`,
      'lines',
    );
  }
  const parsed = lines.map((l) => {
    if (!isCashMethod(l.method)) {
      throw new ContractError('INVALID_METHOD', 'Forma de pagamento inválida.', 'method');
    }
    const cents = parseMoneyInput(l.amount);
    if (cents == null || !(cents > 0)) {
      throw new ContractError('INVALID_AMOUNT', 'O valor deve ser maior que zero.', 'amount');
    }
    return { method: l.method, cents };
  });

  const c = await lockContract(tx, contractId);
  if (!PAYABLE.includes(c.status)) {
    throw new ContractError(
      'CONTRACT_NOT_PAYABLE',
      'Este contrato não aceita pagamentos.',
      'contractId',
    );
  }
  const paid = await ledgerSumCents(tx, contractId);
  const incoming = parsed.reduce((s, l) => s + l.cents, 0);
  const totalCents = toCents(c.total_amount);
  if (paid + incoming > totalCents) {
    throw new ContractError(
      'OVERPAYMENT',
      `O valor passa do saldo do contrato (R$ ${brl(totalCents - paid)}).`,
      'amount',
    );
  }
  const now = new Date();
  for (const l of parsed) {
    await tx.contractPayment.create({
      data: {
        organizationId: orgId,
        contractId,
        kind: 'payment',
        method: l.method,
        amount: fromCents(l.cents),
        paidAt: now,
        memberId,
        note: note ?? null,
      },
    });
    await recordCashMovement(tx, {
      orgId,
      kind: 'contract_in',
      method: l.method,
      amountCents: l.cents,
      contractId,
      clientId: c.contractor_client_id ?? c.bride_client_id,
      memberId,
      occurredAt: now,
      note: c.code,
    });
  }
  await recordAudit(tx, {
    orgId,
    actorMemberId: memberId,
    action: 'contract.payment',
    entityType: 'contract',
    entityId: contractId,
    metadata: { lines: parsed.map((l) => ({ method: l.method, amountCents: l.cents })) },
  });
}

/** Estorna um pagamento (linha de reversão no ledger + saída no caixa). Retorna o id do contrato. */
export async function reverseContractPaymentTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  paymentId: string,
  reason: string,
): Promise<string> {
  const why = (reason ?? '').trim();
  if (why.length < 3) {
    throw new ContractError('REASON_REQUIRED', 'Informe o motivo do estorno.', 'reason');
  }
  const pay = await tx.contractPayment.findFirst({ where: { id: paymentId, kind: 'payment' } });
  if (!pay) throw new ContractError('PAYMENT_NOT_FOUND', 'Pagamento não encontrado.', 'paymentId');
  const c = await lockContract(tx, pay.contractId);
  const already = await tx.contractPayment.findFirst({
    where: { reversesPaymentId: paymentId },
    select: { id: true },
  });
  if (already) {
    throw new ContractError('ALREADY_REVERSED', 'Este pagamento já foi estornado.', 'paymentId');
  }
  const cents = toCents(pay.amount);
  try {
    await tx.contractPayment.create({
      data: {
        organizationId: orgId,
        contractId: pay.contractId,
        kind: 'reversal',
        method: pay.method,
        amount: fromCents(-cents),
        memberId,
        reversesPaymentId: paymentId,
        note: why,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ContractError('ALREADY_REVERSED', 'Este pagamento já foi estornado.', 'paymentId');
    }
    throw e;
  }
  await recordCashMovement(tx, {
    orgId,
    kind: 'reversal',
    method: pay.method as CashMethod,
    amountCents: -cents,
    contractId: pay.contractId,
    clientId: c.contractor_client_id ?? c.bride_client_id,
    memberId,
    note: why,
  });
  await recordAudit(tx, {
    orgId,
    actorMemberId: memberId,
    action: 'contract.payment.reverse',
    entityType: 'contract',
    entityId: pay.contractId,
    reason: why,
    metadata: { paymentId, amountCents: cents },
  });
  return pay.contractId;
}

export type CancelParty = 'client' | 'studio';

function assertParty(party: string): asserts party is CancelParty {
  if (party !== 'client' && party !== 'studio') {
    throw new ContractError('INVALID_PARTY', 'Informe quem cancelou o contrato.', 'party');
  }
}

export async function previewCancellationTx(
  tx: TenantPrismaClient,
  contractId: string,
  party: string,
): Promise<{ paidCents: number; retainedCents: number; refundCents: number }> {
  assertParty(party);
  const exists = await tx.contract.findUnique({ where: { id: contractId }, select: { id: true } });
  if (!exists) throw new ContractError('NOT_FOUND', 'Contrato não encontrado.', 'id');
  const paidCents = Math.max(0, await ledgerSumCents(tx, contractId));
  return { paidCents, ...computeCancellationSettlement({ party, paidCents }) };
}

export async function cancelContractTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  a: { contractId: string; party: string; reason: string; refundMethod?: string | null },
): Promise<void> {
  const reason = (a.reason ?? '').trim();
  if (reason.length < 3) {
    throw new ContractError('REASON_REQUIRED', 'Informe o motivo do cancelamento.', 'reason');
  }
  assertParty(a.party);
  const c = await lockContract(tx, a.contractId);
  if (c.status === 'cancelled' || c.status === 'completed') {
    throw new ContractError(
      'CONTRACT_NOT_CANCELLABLE',
      'Este contrato não pode ser cancelado.',
      'contractId',
    );
  }
  const paidCents = Math.max(0, await ledgerSumCents(tx, a.contractId));
  const { retainedCents, refundCents } = computeCancellationSettlement({
    party: a.party,
    paidCents,
  });
  if (refundCents > 0) {
    if (!isCashMethod(a.refundMethod)) {
      throw new ContractError(
        'REFUND_METHOD_REQUIRED',
        'Informe a forma de devolução do valor pago.',
        'refundMethod',
      );
    }
    await tx.contractPayment.create({
      data: {
        organizationId: orgId,
        contractId: a.contractId,
        kind: 'refund',
        method: a.refundMethod,
        amount: fromCents(-refundCents),
        memberId,
        note: reason,
      },
    });
    await recordCashMovement(tx, {
      orgId,
      kind: 'contract_refund',
      method: a.refundMethod,
      amountCents: -refundCents,
      contractId: a.contractId,
      clientId: c.contractor_client_id ?? c.bride_client_id,
      memberId,
      note: reason,
    });
  }
  // Só os agendamentos vinculados ao contrato (D-19); apaga os deslocamentos do grupo.
  await cancelGroupAppointmentsTx(tx, orgId, memberId, {
    groupId: c.bridal_group_id,
    contractId: a.contractId,
    reason,
  });
  await tx.contractAccessToken.updateMany({
    where: { contractId: a.contractId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await tx.contract.update({
    where: { id: a.contractId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: memberId,
      cancelReason: reason,
      cancelledByParty: a.party,
    },
  });
  await syncContractCoverageTx(tx, orgId, c.bridal_group_id);
  await rebuildTravelBlocksTx(tx, orgId, memberId, c.bridal_group_id);
  await recordAudit(tx, {
    orgId,
    actorMemberId: memberId,
    action: 'contract.cancel',
    entityType: 'contract',
    entityId: a.contractId,
    reason,
    metadata: { party: a.party, paidCents, retainedCents, refundCents },
  });
}

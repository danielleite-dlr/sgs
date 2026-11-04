import { fromCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';

export type CashKind = 'deposit_in' | 'payment_in' | 'change_out' | 'reversal' | 'contract_in' | 'contract_refund';
export type CashMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'transfer';

/**
 * Grava um movimento de caixa (ledger append-only). amountCents com sinal:
 * entradas positivas; troco e estornos negativos. amountCents === 0 não grava
 * (CHECK amount <> 0). Sempre na transação do chamador (`tx`).
 */
export async function recordCashMovement(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    kind: CashKind;
    method: CashMethod;
    amountCents: number;
    comandaId?: string | null;
    appointmentId?: string | null;
    clientId?: string | null;
    contractId?: string | null;
    cycle?: number | null;
    memberId?: string | null;
    occurredAt?: Date;
    note?: string | null;
  },
): Promise<void> {
  if (a.amountCents === 0) return;
  await tx.cashMovement.create({
    data: {
      organizationId: a.orgId,
      kind: a.kind,
      method: a.method,
      amount: fromCents(a.amountCents),
      comandaId: a.comandaId ?? null,
      appointmentId: a.appointmentId ?? null,
      clientId: a.clientId ?? null,
      contractId: a.contractId ?? null,
      cycle: a.cycle ?? null,
      memberId: a.memberId ?? null,
      occurredAt: a.occurredAt ?? new Date(),
      note: a.note ?? null,
    },
  });
}

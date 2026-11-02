import type { ClientCreditMovement } from '@prisma/client';
import { fromCents, toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';

export type CreditErrorCode = 'CREDIT_INSUFFICIENT' | 'CLIENT_NOT_FOUND';

export class CreditError extends Error {
  constructor(
    public readonly code: CreditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CreditError';
  }
}

export type CreditKind =
  | 'deposit'
  | 'manual_adjustment'
  | 'consumption'
  | 'reopen_refund';

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/**
 * Trava a linha do cliente (FOR UPDATE) para serializar o uso concorrente do
 * saldo de crédito. Chamar ANTES de recordCreditMovement, na mesma transação.
 * Lança CreditError('CLIENT_NOT_FOUND') se o cliente não existe/foi removido.
 */
export async function lockClient(
  tx: TenantPrismaClient,
  clientId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM clients
     WHERE id = ${clientId}::uuid AND deleted_at IS NULL
       FOR UPDATE`;
  if (rows.length === 0) {
    throw new CreditError('CLIENT_NOT_FOUND', 'Cliente não encontrado.');
  }
}

/** Σ amount dos movimentos de crédito do cliente, em centavos. */
export async function getCreditBalanceCents(
  tx: TenantPrismaClient,
  clientId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ balance: string }[]>`
    SELECT COALESCE(SUM(amount), 0)::text AS balance
      FROM client_credit_movements
     WHERE client_id = ${clientId}::uuid`;
  return toCents(rows[0]?.balance ?? '0');
}

/**
 * Grava um movimento de crédito (positivo = entrada, negativo = saída).
 * Pré-condição: lockClient(tx, clientId) já chamado nesta transação.
 * Se o saldo ficaria negativo, lança CreditError('CREDIT_INSUFFICIENT').
 * Nunca abre transação própria.
 */
export async function recordCreditMovement(
  tx: TenantPrismaClient,
  a: {
    orgId: string;
    clientId: string;
    amountCents: number;
    kind: CreditKind;
    appointmentId?: string | null;
    comandaId?: string | null;
    cycle?: number | null;
    reason?: string | null;
    createdBy: string | null;
  },
): Promise<ClientCreditMovement> {
  if (!Number.isInteger(a.amountCents) || a.amountCents === 0) {
    throw new Error('recordCreditMovement: amountCents deve ser inteiro e diferente de zero');
  }
  const balance = await getCreditBalanceCents(tx, a.clientId);
  if (balance + a.amountCents < 0) {
    throw new CreditError(
      'CREDIT_INSUFFICIENT',
      `Saldo de crédito insuficiente (disponível: R$ ${brl(balance)}).`,
    );
  }
  return tx.clientCreditMovement.create({
    data: {
      organizationId: a.orgId,
      clientId: a.clientId,
      amount: fromCents(a.amountCents),
      kind: a.kind,
      appointmentId: a.appointmentId ?? null,
      comandaId: a.comandaId ?? null,
      cycle: a.cycle ?? null,
      reason: a.reason ?? null,
      createdBy: a.createdBy,
    },
  });
}

import type { Prisma } from '@prisma/client';
import type { TenantPrismaClient } from '../database/types';
import { ContractError } from './contract-errors';

export type LockedContract = {
  id: string;
  code: string;
  status: string;
  bridal_group_id: string;
  bride_client_id: string;
  total_amount: Prisma.Decimal;
  deposit_amount: Prisma.Decimal;
  current_version: number;
  accepted_version: number | null;
  balance_due_date: Date;
};

/** Trava a linha do contrato até o fim da transação (serializa pagamentos/edições/aceite). */
export async function lockContract(
  tx: TenantPrismaClient,
  contractId: string,
): Promise<LockedContract> {
  const rows = await tx.$queryRaw<LockedContract[]>`
    SELECT id, code, status, bridal_group_id, bride_client_id, total_amount, deposit_amount,
           current_version, accepted_version, balance_due_date
      FROM contracts WHERE id = ${contractId}::uuid FOR UPDATE`;
  const c = rows[0];
  if (!c) throw new ContractError('NOT_FOUND', 'Contrato não encontrado.', 'id');
  return c;
}

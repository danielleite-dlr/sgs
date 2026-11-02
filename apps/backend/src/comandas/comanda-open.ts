import type { Comanda } from '@prisma/client';
import type { TenantPrismaClient } from '../database/types';
import { nextComandaCode } from './comanda-code';
import { ComandaError } from './comanda-items';

/**
 * Abre uma comanda (status 'open', total 0) dentro da transação do chamador —
 * reutilizado pelo walk-in e por createVisit (03-06).
 */
export async function openComandaTx(
  tx: TenantPrismaClient,
  a: { orgId: string; clientId: string; openedBy: string; now?: Date },
): Promise<Comanda> {
  const client = await tx.client.findFirst({
    where: { id: a.clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    throw new ComandaError('CLIENT_NOT_FOUND', 'Cliente não encontrado.', 'clientId');
  }
  const code = await nextComandaCode(tx, a.orgId, a.now);
  return tx.comanda.create({
    data: {
      organizationId: a.orgId,
      code,
      clientId: a.clientId,
      status: 'open',
      total: '0.00',
      openedBy: a.openedBy,
    },
  });
}

import type { Comanda } from '@prisma/client';
import type { TenantPrismaClient } from '../database/types';
import { nextComandaCode } from './comanda-code';
import { ComandaError } from './comanda-items';
import { BLOCKING_STATUSES } from '../appointments/appointment-status';

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

/**
 * quick 261124-owd: comanda aberta da cliente que já tem agendamento ativo em algum dos
 * mesmos dias locais (fuso da organização) dos novos horários. Trava a comanda (FOR UPDATE)
 * e serializa visitas paralelas da mesma cliente com advisory lock (antes de comanda e
 * cliente, mesma ordem de comanda-close: sem deadlock). Retorna null se não houver.
 */
export async function findReusableComandaTx(
  tx: TenantPrismaClient,
  a: { clientId: string; startsAt: Date[] },
): Promise<string | null> {
  if (a.startsAt.length === 0) return null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'visit-comanda:' + a.clientId}))`;
  const iso = a.startsAt.map((d) => d.toISOString());
  const rows = await tx.$queryRaw<{ id: string }[]>`
    WITH org AS (
      SELECT COALESCE(timezone, 'America/Sao_Paulo') AS tz FROM organizations LIMIT 1
    )
    SELECT c.id
      FROM comandas c
     WHERE c.client_id = ${a.clientId}::uuid
       AND c.status = 'open'
       AND EXISTS (
         SELECT 1 FROM appointments ap, org
          WHERE ap.comanda_id = c.id
            AND ap.status::text = ANY(${[...BLOCKING_STATUSES]}::text[])
            AND (ap.starts_at AT TIME ZONE org.tz)::date = ANY(
              ARRAY(SELECT (s::timestamptz AT TIME ZONE org.tz)::date
                      FROM unnest(${iso}::text[]) AS s)
            )
       )
     ORDER BY c.opened_at ASC, c.id ASC
     LIMIT 1
       FOR UPDATE OF c`;
  return rows[0]?.id ?? null;
}

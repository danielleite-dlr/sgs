import type { TenantPrismaClient } from '../database/types';
import { coveragePriceMapTx } from './bridal-coverage';
import { localDate, orgTimezone } from './bridal-schedule';

export interface BridalAutoLink {
  groupId: string;
  purpose: 'event';
  coverage: { contractId: string; priceByServiceId: Record<string, string> } | null;
}

/**
 * Agendamento criado pela agenda (sem grupo informado) para pessoa de um grupo ativo, no dia do
 * evento, entra no grupo como evento (quick 261124-mkp): aparece no filtro da noiva, na aba Agenda
 * do grupo e recebe a cobertura do contrato quando a pessoa é coberta. Fora do dia do evento,
 * segue como atendimento social.
 */
export async function findBridalAutoLinkTx(
  tx: TenantPrismaClient,
  clientId: string,
  startsAt: Date,
): Promise<BridalAutoLink | null> {
  const tz = await orgTimezone(tx);
  const day = localDate(startsAt, tz);
  const members = await tx.bridalGroupMember.findMany({
    where: {
      clientId,
      group: { status: 'active', eventDate: new Date(`${day}T00:00:00.000Z`) },
    },
    select: { id: true, groupId: true, coveredByContract: true },
  });
  // Pessoa em dois grupos ativos no mesmo dia: ambíguo, não liga.
  if (members.length !== 1) return null;
  const m = members[0];
  const coverage = m.coveredByContract
    ? await coveragePriceMapTx(tx, m.groupId, m.id, 'event')
    : null;
  return { groupId: m.groupId, purpose: 'event', coverage };
}

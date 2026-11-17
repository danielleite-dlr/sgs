/**
 * Teste de noiva sem cobertura (261117-i6j): quando o contrato do grupo não tem item de teste
 * (ex.: lançado com itens avulsos do evento), o atendimento do teste nasce sem `contractId` e a
 * comanda fica solta. A recepção pode ligá-lo ao contrato vivo do grupo: o item passa a R$ 0,00
 * (teste incluso, pago no evento) e a comissão segue pelo preço de tabela (D-08).
 */
export interface TrialLinkItem {
  kind: string;
  contractId: string | null;
  appointment: {
    purpose: string | null;
    clientId: string;
    bridalGroup: {
      members: { clientId: string; coveredByContract: boolean }[];
      contracts: { id: string; code: string; status: string }[];
    } | null;
  } | null;
}

export function linkableTrialContract(item: TrialLinkItem): { id: string; code: string } | null {
  if (item.kind !== 'service' || item.contractId) return null;
  const a = item.appointment;
  if (!a || a.purpose !== 'trial' || !a.bridalGroup) return null;
  const covered = a.bridalGroup.members.some((m) => m.clientId === a.clientId && m.coveredByContract);
  if (!covered) return null;
  const live = a.bridalGroup.contracts.find((c) => c.status !== 'cancelled');
  return live ? { id: live.id, code: live.code } : null;
}

/** `select` do Prisma para o atendimento do item, com o que `linkableTrialContract` precisa. */
export const TRIAL_LINK_APPOINTMENT_SELECT = {
  purpose: true,
  clientId: true,
  bridalGroup: {
    select: {
      members: { select: { clientId: true, coveredByContract: true } },
      contracts: {
        where: { status: { not: 'cancelled' } },
        select: { id: true, code: true, status: true },
        take: 1,
      },
    },
  },
} as const;

import { recalcComandaTotal } from '../comandas/comanda-items';
import { fromCents, toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';

/**
 * Preços acordados do contrato para uma pessoa/finalidade (D-08).
 * `null` quando a pessoa não é coberta ou o grupo não tem contrato vivo com itens dela.
 */
export async function coveragePriceMapTx(
  tx: TenantPrismaClient,
  groupId: string,
  groupMemberId: string,
  purpose: string,
): Promise<{ contractId: string; priceByServiceId: Record<string, string> } | null> {
  const member = await tx.bridalGroupMember.findFirst({
    where: { id: groupMemberId, groupId },
    select: { coveredByContract: true },
  });
  if (!member?.coveredByContract) return null;
  const contract = await tx.contract.findFirst({
    where: { bridalGroupId: groupId, status: { not: 'cancelled' } },
    select: {
      id: true,
      items: {
        where: { groupMemberId, purpose },
        orderBy: { sortOrder: 'asc' },
        select: { serviceId: true, unitPrice: true },
      },
    },
  });
  if (!contract || contract.items.length === 0) return null;
  const priceByServiceId: Record<string, string> = {};
  for (const it of contract.items) {
    if (!(it.serviceId in priceByServiceId)) {
      priceByServiceId[it.serviceId] = fromCents(toCents(it.unitPrice));
    }
  }
  return { contractId: contract.id, priceByServiceId };
}

/**
 * Sincroniza a cobertura do contrato nas comandas ABERTAS do grupo (D-08, D-25):
 * coberto = membro coberto ∧ contrato vivo ∧ item (membro, serviço, finalidade) no contrato.
 * Comandas fechadas/canceladas não são tocadas.
 */
export async function syncContractCoverageTx(
  tx: TenantPrismaClient,
  _orgId: string,
  groupId: string,
): Promise<void> {
  const contract = await tx.contract.findFirst({
    where: { bridalGroupId: groupId, status: { not: 'cancelled' } },
    select: {
      id: true,
      items: {
        select: { groupMemberId: true, serviceId: true, purpose: true, unitPrice: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  const members = await tx.bridalGroupMember.findMany({
    where: { groupId },
    select: { id: true, clientId: true, coveredByContract: true },
  });
  const memberByClient = new Map(members.map((m) => [m.clientId, m]));

  const appointments = await tx.appointment.findMany({
    where: {
      bridalGroupId: groupId,
      comandaId: { not: null },
      status: { in: ['scheduled', 'confirmed', 'in_progress'] },
      comanda: { status: 'open' },
    },
    select: {
      id: true,
      clientId: true,
      serviceId: true,
      purpose: true,
      comandaId: true,
      contractId: true,
    },
  });

  const touched = new Set<string>();
  for (const appt of appointments) {
    const member = memberByClient.get(appt.clientId);
    const purpose = appt.purpose ?? 'event';
    const contractItem =
      contract && member?.coveredByContract
        ? contract.items.find(
            (i) =>
              i.groupMemberId === member.id &&
              i.serviceId === appt.serviceId &&
              i.purpose === purpose,
          )
        : undefined;
    const contractId = contractItem ? contract!.id : null;

    if (appt.contractId !== contractId) {
      await tx.appointment.update({ where: { id: appt.id }, data: { contractId } });
    }
    const items = await tx.comandaItem.findMany({
      where: { appointmentId: appt.id, comandaId: appt.comandaId!, kind: 'service' },
      select: { id: true, quantity: true, listUnitPrice: true },
    });
    for (const item of items) {
      const unitCents = contractItem
        ? toCents(contractItem.unitPrice)
        : toCents(item.listUnitPrice);
      await tx.comandaItem.update({
        where: { id: item.id },
        data: {
          contractId,
          unitPrice: fromCents(unitCents),
          total: fromCents(unitCents * item.quantity),
        },
      });
    }
    touched.add(appt.comandaId!);
  }
  for (const comandaId of touched) {
    await recalcComandaTotal(tx, comandaId);
  }
}

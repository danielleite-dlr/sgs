import { recalcComandaTotal } from '../comandas/comanda-items';
import { fromCents, toCents, type MoneyLike } from '../common/money';
import type { TenantPrismaClient } from '../database/types';

export interface AgreedItem {
  groupMemberId: string;
  serviceId: string;
  purpose: string;
  unitPrice: MoneyLike;
  settledAtEvent: boolean;
}

/**
 * Preço acordado no contrato (em centavos) para (pessoa, serviço, finalidade), já com a
 * regra do teste incluso no pacote (261108-n2o):
 * - 'trial': 1º item trial do (membro, serviço); teste incluso (settledAtEvent) → 0, porque o
 *   valor é cobrado no evento; teste avulso → o preço dele.
 * - 'event': 1º item event do (membro, serviço) + o 1º item trial incluso do mesmo (membro,
 *   serviço), se houver — a comanda do evento leva as duas metades.
 * - Sem item da finalidade → undefined (não coberto).
 * Com quantidade > 1 do mesmo serviço a pareação é pelo primeiro de cada (mesma regra do
 * `.find` que já decidia a cobertura); caso raro, aceito.
 * `items` deve vir ordenado por sortOrder.
 */
export function agreedUnitCents(
  items: AgreedItem[],
  groupMemberId: string,
  serviceId: string,
  purpose: string,
): number | undefined {
  const same = items.filter((i) => i.groupMemberId === groupMemberId && i.serviceId === serviceId);
  const own = same.find((i) => i.purpose === purpose);
  if (!own) return undefined;
  if (purpose === 'trial') return own.settledAtEvent ? 0 : toCents(own.unitPrice);
  const includedTrial = same.find((i) => i.purpose === 'trial' && i.settledAtEvent);
  return toCents(own.unitPrice) + (includedTrial ? toCents(includedTrial.unitPrice) : 0);
}

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
      // todas as finalidades: o evento soma o teste incluso no pacote
      items: {
        where: { groupMemberId },
        orderBy: { sortOrder: 'asc' },
        select: {
          groupMemberId: true,
          serviceId: true,
          purpose: true,
          unitPrice: true,
          settledAtEvent: true,
        },
      },
    },
  });
  if (!contract) return null;
  const priceByServiceId: Record<string, string> = {};
  for (const it of contract.items) {
    if (it.purpose !== purpose || it.serviceId in priceByServiceId) continue;
    const cents = agreedUnitCents(contract.items, groupMemberId, it.serviceId, purpose);
    if (cents !== undefined) priceByServiceId[it.serviceId] = fromCents(cents);
  }
  if (Object.keys(priceByServiceId).length === 0) return null;
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
        select: {
          groupMemberId: true,
          serviceId: true,
          purpose: true,
          unitPrice: true,
          settledAtEvent: true,
        },
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
      const agreed =
        contractItem && member
          ? agreedUnitCents(contract!.items, member.id, appt.serviceId, purpose)
          : undefined;
      const unitCents = agreed ?? toCents(item.listUnitPrice);
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

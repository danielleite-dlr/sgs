import { adminPrisma } from '../setup';
import { gqlAs, type Phase3World } from './phase3-fixtures';

export const COMANDA_FIELDS = `id code status closedAt closeCycle total paid remaining change canClose closeError clientCreditBalance
  hasCommissionWarnings
  commissions { id comandaItemId memberId memberName itemName kind cycle baseAmount chargedAmount calculatedAmount noRule reversed }
  items { id kind name professionalId listUnitPrice unitPrice total }
  payments { id method amount }`;
export const PAYLOAD = `comanda { ${COMANDA_FIELDS} } errors { code message field }`;
export const OPEN = `mutation($i: OpenWalkInComandaInput!) { openWalkInComanda(input: $i) { ${PAYLOAD} } }`;
export const ADD_ITEM = `mutation($i: AddComandaItemInput!) { addComandaItem(input: $i) { ${PAYLOAD} } }`;
export const REMOVE_ITEM = `mutation($c: UUID!, $i: UUID!) { removeComandaItem(comandaId: $c, itemId: $i) { ${PAYLOAD} } }`;
export const ADD_PAY = `mutation($i: AddComandaPaymentInput!) { addComandaPayment(input: $i) { ${PAYLOAD} } }`;
export const CLOSE = `mutation($id: UUID!) { closeComanda(id: $id) { ${PAYLOAD} } }`;
export const REOPEN = `mutation($i: ReopenComandaInput!) { reopenComanda(input: $i) { ${PAYLOAD} } }`;

export type ComandaView = {
  id: string;
  code: string;
  status: string;
  closedAt: string | null;
  closeCycle: number;
  total: string;
  change: string;
  clientCreditBalance: string;
  hasCommissionWarnings: boolean;
  commissions: {
    id: string;
    comandaItemId: string;
    memberId: string;
    itemName: string;
    kind: string;
    cycle: number;
    baseAmount: string;
    chargedAmount: string;
    calculatedAmount: string;
    noRule: boolean;
    reversed: boolean;
  }[];
  items: { id: string; kind: string; name: string; professionalId: string }[];
  payments: { id: string; method: string; amount: string }[];
};
export type Payload = {
  comanda: ComandaView | null;
  errors: { code: string; message: string; field: string | null }[];
};

export const sum = (xs: { amount: unknown }[]) =>
  xs.reduce((a, x) => a + Math.round(Number(x.amount) * 100), 0) / 100;

/** Datas locais (ontem..depois de amanhã) para as consultas do financeiro. */
export function range() {
  const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return { from: d(-1), to: d(2) };
}

/**
 * Fluxo do critério #2: serviço R$100 (proA, com agendamento in_progress e
 * sinal R$50 em crédito), produto R$35, total R$135, pagamentos crédito 50 +
 * pix 50 + dinheiro 50 (troco R$15). Ainda NÃO fecha a comanda.
 */
export async function buildFlow135(w: Phase3World) {
  const att = gqlAs(w, w.tokens.attendant);
  const opened = (await att(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Payload;
  const comandaId = opened.comanda!.id;
  const add = (extra: Record<string, unknown>) =>
    att(ADD_ITEM, { i: { comandaId, professionalId: w.members.proA, quantity: 1, ...extra } });
  const svc = (await add({ kind: 'service', serviceId: w.serviceId })).data.addComandaItem as Payload;
  const prod = (await add({ kind: 'product', productId: w.productId })).data.addComandaItem as Payload;
  expect(prod.comanda!.total).toBe('135.00');
  const serviceItemId = svc.comanda!.items[0].id;

  const startsAt = new Date(Date.now() + 3600_000);
  const appt = await adminPrisma.appointment.create({
    data: {
      organizationId: w.orgId,
      professionalId: w.members.proA,
      clientId: w.clientId,
      serviceId: w.serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600_000),
      status: 'in_progress',
      comandaId,
      depositAmount: '50.00',
    },
  });
  await adminPrisma.comandaItem.update({ where: { id: serviceItemId }, data: { appointmentId: appt.id } });
  await adminPrisma.clientCreditMovement.create({
    data: {
      organizationId: w.orgId,
      clientId: w.clientId,
      amount: '50.00',
      kind: 'deposit',
      appointmentId: appt.id,
    },
  });
  await adminPrisma.cashMovement.create({
    data: {
      organizationId: w.orgId,
      kind: 'deposit_in',
      method: 'pix',
      amount: '50.00',
      comandaId,
      clientId: w.clientId,
      appointmentId: appt.id,
    },
  });

  for (const [method, amount] of [
    ['client_credit', '50.00'],
    ['pix', '50.00'],
    ['cash', '50.00'],
  ]) {
    const r = (await att(ADD_PAY, { i: { comandaId, method, amount } })).data.addComandaPayment as Payload;
    expect(r.errors).toEqual([]);
  }
  return { comandaId, appointmentId: appt.id, serviceItemId };
}

export async function createServiceRule(w: Phase3World, serviceId: string, pct: string) {
  return adminPrisma.commissionRule.create({
    data: { organizationId: w.orgId, scopeType: 'service', serviceId, kind: 'percentage', value: pct },
  });
}

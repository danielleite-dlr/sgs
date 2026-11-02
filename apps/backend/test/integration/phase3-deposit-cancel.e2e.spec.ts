import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const VISIT = `mutation($i: CreateVisitInput!) {
  createVisit(input: $i) {
    comandaId
    appointments { id depositAmount comandaId }
    errors { code message field }
  }
}`;
const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code } }
}`;
const CANCEL = `mutation($i: CancelAppointmentInput!) {
  cancelAppointment(input: $i) { appointment { id status } errors { code message } }
}`;
const LIST = `query($s: DateTime!, $e: DateTime!) {
  appointments(startsAt: $s, endsAt: $e) { id comandaCode comandaStatus }
}`;
const COMANDA = `query($id: UUID!) { comanda(id: $id) { id status total clientCreditBalance } }`;
const ADD_PAY = `mutation($i: AddComandaPaymentInput!) {
  addComandaPayment(input: $i) { comanda { id } errors { code } }
}`;

describe('Phase 3 - sinal e cancelamento', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3dep');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p3dep-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);
  const slot = (h1: string, h2: string) => ({
    startsAt: `2030-07-10T${h1}:00Z`,
    endsAt: `2030-07-10T${h2}:00Z`,
  });
  const itemA = () => ({ serviceId: w.serviceId, professionalId: w.members.proA, ...slot('10:00', '11:00') });
  const itemB = () => ({ serviceId: w.serviceBId, professionalId: w.members.proB, ...slot('10:00', '10:30') });
  const visit = async (input: Record<string, unknown>) =>
    (await att()(VISIT, { i: { clientId: w.clientId, ...input } })).data.createVisit;
  const credit = async () =>
    (
      await adminPrisma.clientCreditMovement.findMany({ where: { clientId: w.clientId } })
    ).reduce((s, m) => s + Number(m.amount), 0);

  it('sinal de R$ 50 via Pix vira crédito + caixa + deposit_amount', async () => {
    const before = Date.now();
    const r = await visit({ items: [itemA()], deposit: { amount: '50.00', method: 'pix' } });
    expect(r.errors).toEqual([]);
    expect(r.appointments[0].depositAmount).toBe('50.00');
    const mv = await adminPrisma.clientCreditMovement.findMany({ where: { clientId: w.clientId } });
    expect(mv).toHaveLength(1);
    expect(mv[0].kind).toBe('deposit');
    expect(Number(mv[0].amount)).toBe(50);
    expect(mv[0].appointmentId).toBe(r.appointments[0].id);
    const cash = await adminPrisma.cashMovement.findMany({ where: { organizationId: w.orgId } });
    expect(cash).toHaveLength(1);
    expect(cash[0].kind).toBe('deposit_in');
    expect(cash[0].method).toBe('pix');
    expect(Number(cash[0].amount)).toBe(50);
    expect(Math.abs(cash[0].occurredAt.getTime() - before)).toBeLessThan(60_000);
    const c = (await att()(COMANDA, { id: r.comandaId })).data.comanda;
    expect(c.clientCreditBalance).toBe('50.00');
  });

  it('sinal inválido', async () => {
    const m = await visit({ items: [itemA()], deposit: { amount: '50.00', method: 'client_credit' } });
    expect(m.errors[0].code).toBe('INVALID_DEPOSIT_METHOD');
    const z = await visit({ items: [itemA()], deposit: { amount: '0', method: 'pix' } });
    expect(z.errors[0].code).toBe('INVALID_DEPOSIT');
    expect(await adminPrisma.appointment.count({ where: { organizationId: w.orgId } })).toBe(0);
  });

  it('cancelar exige motivo e preserva o crédito do sinal', async () => {
    const r = await visit({ items: [itemA()], deposit: { amount: '50.00', method: 'pix' } });
    const id = r.appointments[0].id;
    const empty = (await adm()(CANCEL, { i: { id, reason: '' } })).data.cancelAppointment;
    expect(empty.errors[0].code).toBe('REASON_REQUIRED');
    const ok = (
      await adm()(CANCEL, { i: { id, reason: 'Cliente viajou', reasonTag: 'cliente_desmarcou' } })
    ).data.cancelAppointment;
    expect(ok.appointment.status).toBe('cancelled');
    expect(await credit()).toBe(50);
    expect(await adminPrisma.cashMovement.count({ where: { organizationId: w.orgId } })).toBe(1);
    const comanda = await adminPrisma.comanda.findUniqueOrThrow({ where: { id: r.comandaId } });
    expect(comanda.status).toBe('cancelled');
  });

  it('cancelar 1 de 2 serviços mantém a comanda aberta com total recalculado', async () => {
    const r = await visit({ items: [itemA(), itemB()] });
    const idB = (await adminPrisma.appointment.findFirstOrThrow({
      where: { comandaId: r.comandaId, serviceId: w.serviceBId },
    })).id;
    const res = (await att()(CANCEL, { i: { id: idB, reason: 'Desistiu do serviço' } })).data.cancelAppointment;
    expect(res.errors).toEqual([]);
    const comanda = await adminPrisma.comanda.findUniqueOrThrow({
      where: { id: r.comandaId },
      include: { items: true },
    });
    expect(comanda.status).toBe('open');
    expect(comanda.items).toHaveLength(1);
    expect(comanda.total.toFixed(2)).toBe('100.00');
  });

  it('comanda com pagamento e único agendamento -> COMANDA_HAS_PAYMENTS', async () => {
    const r = await visit({ items: [itemA()] });
    const pay = (
      await att()(ADD_PAY, { i: { comandaId: r.comandaId, method: 'pix', amount: '30.00' } })
    ).data.addComandaPayment;
    expect(pay.errors).toEqual([]);
    const res = (await att()(CANCEL, { i: { id: r.appointments[0].id, reason: 'Teste pagamento' } }))
      .data.cancelAppointment;
    expect(res.errors[0].code).toBe('COMANDA_HAS_PAYMENTS');
  });

  it('após cancelar, o mesmo horário volta a ficar livre', async () => {
    const r = await visit({ items: [itemA()] });
    await att()(CANCEL, { i: { id: r.appointments[0].id, reason: 'Liberar horário' } });
    const again = (
      await att()(CREATE, {
        i: { professionalId: w.members.proA, clientId: w.clientId, serviceId: w.serviceId, ...slot('10:00', '11:00') },
      })
    ).data.createAppointment;
    expect(again.errors).toEqual([]);
    expect(again.appointment.id).toBeTruthy();
  });

  it('listAppointments traz comandaCode e comandaStatus', async () => {
    await visit({ items: [itemA()] });
    const list = (
      await att()(LIST, { s: '2030-07-10T00:00:00Z', e: '2030-07-11T00:00:00Z' })
    ).data.appointments;
    expect(list).toHaveLength(1);
    expect(list[0].comandaCode).toMatch(/^C-/);
    expect(list[0].comandaStatus).toBe('open');
  });
});

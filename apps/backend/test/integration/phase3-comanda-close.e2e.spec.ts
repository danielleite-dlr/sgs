import { adminPrisma } from './setup';
import { createPhase3World, destroyPhase3World, gqlAs, type Phase3World } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import {
  ADD_ITEM,
  ADD_PAY,
  CLOSE,
  OPEN,
  buildFlow135,
  createServiceRule,
  sum,
  type Payload,
} from './helpers/phase3-comanda-flow';

describe('Phase 3 - fechamento da comanda (D-12)', () => {
  let w: Phase3World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p3close-%'`;

  beforeAll(async () => {
    w = await createPhase3World('p3close');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(filter);
    await adminPrisma.appointment.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.product.update({ where: { id: w.productId }, data: { stockQuantity: 10 } });
    await adminPrisma.stockMovement.deleteMany({ where: { organizationId: w.orgId } });
  });

  const close = (token: string, id: string) => gqlAs(w, token)(CLOSE, { id });

  it('fluxo do critério #2: sinal + produto, crédito/pix/dinheiro, troco, estoque e agendamento', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId, appointmentId } = await buildFlow135(w);
    const r = (await close(w.tokens.attendant, comandaId)).data.closeComanda as Payload;
    expect(r.errors).toEqual([]);
    expect(r.comanda).toMatchObject({
      status: 'closed',
      closeCycle: 1,
      change: '15.00',
      clientCreditBalance: '0.00',
    });
    expect(r.comanda!.closedAt).not.toBeNull();

    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(9);
    const sm = await adminPrisma.stockMovement.findMany({ where: { comandaId } });
    expect(sm).toHaveLength(1);
    expect(sm[0]).toMatchObject({ type: 'sale', delta: -1 });

    const cash = await adminPrisma.cashMovement.findMany({ where: { comandaId, cycle: 1 } });
    const by = (k: string, m: string) => cash.find((c) => c.kind === k && c.method === m);
    expect(String(by('payment_in', 'pix')!.amount)).toBe('50');
    expect(String(by('payment_in', 'cash')!.amount)).toBe('50');
    expect(String(by('change_out', 'cash')!.amount)).toBe('-15');
    expect(cash).toHaveLength(3);
    expect(await adminPrisma.cashMovement.count({ where: { comandaId, kind: 'deposit_in' } })).toBe(1);

    const credit = await adminPrisma.clientCreditMovement.findMany({ where: { clientId: w.clientId } });
    expect(sum(credit)).toBe(0);
    expect(credit.some((c) => c.kind === 'consumption' && c.cycle === 1)).toBe(true);

    const appt = await adminPrisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(appt!.status).toBe('completed');
    expect(await adminPrisma.commissionRecord.count({ where: { comandaId, cycle: 1 } })).toBe(2);
  });

  it('pagamento insuficiente: nada muda', async () => {
    const { comandaId } = await buildFlow135(w);
    const pays = await adminPrisma.comandaPayment.findMany({ where: { comandaId } });
    await adminPrisma.comandaPayment.delete({ where: { id: pays.find((p) => p.method === 'cash')!.id } });
    const r = (await close(w.tokens.attendant, comandaId)).data.closeComanda as Payload;
    expect(r.errors[0].code).toBe('INSUFFICIENT_PAYMENT');
    expect(r.errors[0].message).toContain('35,00');
    const c = await adminPrisma.comanda.findUnique({ where: { id: comandaId } });
    expect(c!.status).toBe('open');
    expect((await adminPrisma.product.findUnique({ where: { id: w.productId } }))!.stockQuantity).toBe(10);
    expect(await adminPrisma.commissionRecord.count({ where: { comandaId } })).toBe(0);
    expect(await adminPrisma.cashMovement.count({ where: { comandaId, cycle: 1 } })).toBe(0);
    expect(await adminPrisma.clientCreditMovement.count({ where: { organizationId: w.orgId, kind: 'consumption' } })).toBe(0);
  });

  it('estoque zerado: STOCK_INSUFFICIENT e rollback completo', async () => {
    const { comandaId } = await buildFlow135(w);
    await adminPrisma.product.update({ where: { id: w.productId }, data: { stockQuantity: 0 } });
    const r = (await close(w.tokens.attendant, comandaId)).data.closeComanda as Payload;
    expect(r.errors[0].code).toBe('STOCK_INSUFFICIENT');
    expect(await adminPrisma.commissionRecord.count({ where: { comandaId } })).toBe(0);
    expect(await adminPrisma.cashMovement.count({ where: { comandaId, cycle: 1 } })).toBe(0);
    expect(await adminPrisma.clientCreditMovement.count({ where: { organizationId: w.orgId, kind: 'consumption' } })).toBe(0);
    expect((await adminPrisma.comanda.findUnique({ where: { id: comandaId } }))!.status).toBe('open');
  });

  it('crédito consumido por outra comanda: CREDIT_INSUFFICIENT e rollback', async () => {
    const { comandaId } = await buildFlow135(w);
    await adminPrisma.clientCreditMovement.create({
      data: { organizationId: w.orgId, clientId: w.clientId, amount: '-50.00', kind: 'consumption' },
    });
    const r = (await close(w.tokens.attendant, comandaId)).data.closeComanda as Payload;
    expect(r.errors[0].code).toBe('CREDIT_INSUFFICIENT');
    expect(await adminPrisma.commissionRecord.count({ where: { comandaId } })).toBe(0);
    expect((await adminPrisma.product.findUnique({ where: { id: w.productId } }))!.stockQuantity).toBe(10);
    expect((await adminPrisma.comanda.findUnique({ where: { id: comandaId } }))!.status).toBe('open');
  });

  it('fechamento duplo em paralelo fecha uma vez só', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId } = await buildFlow135(w);
    const [a, b] = await Promise.all([
      close(w.tokens.attendant, comandaId),
      close(w.tokens.manager, comandaId),
    ]);
    const results = [a.data.closeComanda, b.data.closeComanda] as Payload[];
    expect(results.filter((r) => r.errors.length === 0)).toHaveLength(1);
    expect(results.find((r) => r.errors.length > 0)!.errors[0].code).toBe('COMANDA_NOT_OPEN');
    expect(await adminPrisma.commissionRecord.count({ where: { comandaId } })).toBe(2);
    expect(await adminPrisma.cashMovement.count({ where: { comandaId, cycle: 1 } })).toBe(3);
    expect((await adminPrisma.product.findUnique({ where: { id: w.productId } }))!.stockQuantity).toBe(9);
  });

  it('comanda vazia é recusada', async () => {
    const att = gqlAs(w, w.tokens.attendant);
    const o = (await att(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Payload;
    const r = (await close(w.tokens.attendant, o.comanda!.id)).data.closeComanda as Payload;
    expect(r.errors[0].code).toBe('EMPTY_COMANDA');
  });

  it('ATTENDANT e MANAGER fecham; PROFESSIONAL recebe erro de permissão', async () => {
    const { comandaId } = await buildFlow135(w);
    const denied = await close(w.tokens.proA, comandaId);
    expect(denied.errors?.[0]?.message ?? '').toMatch(/permiss|forbidden|autoriz/i);
    expect((await adminPrisma.comanda.findUnique({ where: { id: comandaId } }))!.status).toBe('open');
    const ok = (await close(w.tokens.attendant, comandaId)).data.closeComanda as Payload;
    expect(ok.errors).toEqual([]);
  });

  it('itens removidos depois do pagamento: troco maior que o dinheiro (INVALID_CHANGE)', async () => {
    const att = gqlAs(w, w.tokens.attendant);
    const o = (await att(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Payload;
    const id = o.comanda!.id;
    await att(ADD_ITEM, { i: { comandaId: id, kind: 'service', serviceId: w.serviceId, professionalId: w.members.proA, quantity: 1 } });
    await att(ADD_ITEM, { i: { comandaId: id, kind: 'service', serviceId: w.serviceBId, professionalId: w.members.proA, quantity: 1 } });
    await att(ADD_PAY, { i: { comandaId: id, method: 'cash', amount: '10.00' } });
    await att(ADD_PAY, { i: { comandaId: id, method: 'pix', amount: '140.00' } });
    // remove o serviço B por SQL: total cai para 100 e o pago (150) excede o dinheiro
    await adminPrisma.comandaItem.deleteMany({ where: { comandaId: id, serviceId: w.serviceBId } });
    const r = (await close(w.tokens.attendant, id)).data.closeComanda as Payload;
    expect(r.errors[0].code).toBe('INVALID_CHANGE');
  });
});

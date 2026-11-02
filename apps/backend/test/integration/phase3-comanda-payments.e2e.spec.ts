import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const FIELDS = `id status total paid remaining change canClose closeError clientCreditBalance payments { id method amount }`;
const PAYLOAD = `comanda { ${FIELDS} } errors { code message field }`;
const OPEN = `mutation($i: OpenWalkInComandaInput!) { openWalkInComanda(input: $i) { ${PAYLOAD} } }`;
const ADD_ITEM = `mutation($i: AddComandaItemInput!) { addComandaItem(input: $i) { ${PAYLOAD} } }`;
const ADD_PAY = `mutation($i: AddComandaPaymentInput!) { addComandaPayment(input: $i) { ${PAYLOAD} } }`;
const REMOVE_PAY = `mutation($c: UUID!, $p: UUID!) { removeComandaPayment(comandaId: $c, paymentId: $p) { ${PAYLOAD} } }`;

type Payload = {
  comanda: {
    id: string;
    paid: string;
    remaining: string;
    change: string;
    canClose: boolean;
    closeError: string | null;
    clientCreditBalance: string;
    payments: { id: string; method: string }[];
  } | null;
  errors: { code: string; message: string }[];
};

describe('Phase 3 - pagamentos da comanda', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3pay');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p3pay-%'`);
  });

  const att = () => gqlAs(w, w.tokens.attendant);

  /** Comanda de R$ 185,00: serviço 100 + serviço B 50 + produto 35. */
  async function comanda185(clientId = w.clientId): Promise<string> {
    const opened = (await att()(OPEN, { i: { clientId } })).data.openWalkInComanda as Payload;
    const id = opened.comanda!.id;
    const add = (extra: Record<string, unknown>) =>
      att()(ADD_ITEM, {
        i: { comandaId: id, professionalId: w.members.proA, quantity: 1, ...extra },
      });
    await add({ kind: 'service', serviceId: w.serviceId });
    await add({ kind: 'service', serviceId: w.serviceBId });
    const last = (await add({ kind: 'product', productId: w.productId })).data
      .addComandaItem as Payload;
    expect(last.comanda).not.toBeNull();
    return id;
  }
  const pay = async (comandaId: string, method: string, amount: string) =>
    (await att()(ADD_PAY, { i: { comandaId, method, amount } })).data
      .addComandaPayment as Payload;

  it('aceita os 6 métodos e recusa voucher, zero, negativo e vírgula', async () => {
    const c = await comanda185();
    await adminPrisma.clientCreditMovement.create({
      data: { organizationId: w.orgId, clientId: w.clientId, amount: '50.00', kind: 'deposit' },
    });
    for (const method of ['cash', 'pix', 'credit_card', 'debit_card', 'transfer']) {
      const r = await pay(c, method, '10.00');
      expect(r.errors).toEqual([]);
    }
    const credit = await pay(c, 'client_credit', '10.00');
    expect(credit.errors).toEqual([]);
    expect(credit.comanda!.payments).toHaveLength(6);

    expect((await pay(c, 'voucher', '10.00')).errors[0].code).toBe('INVALID_METHOD');
    for (const bad of ['0', '-1', '10,00', '', 'abc']) {
      expect((await pay(c, 'pix', bad)).errors[0].code).toBe('INVALID_AMOUNT');
    }
  });

  it('pix + dinheiro acima do total: pago, troco e canClose', async () => {
    const c = await comanda185();
    await pay(c, 'pix', '100.00');
    const r = await pay(c, 'cash', '100.00');
    expect(r.comanda).toMatchObject({
      paid: '200.00',
      remaining: '0.00',
      change: '15.00',
      canClose: true,
      closeError: null,
    });
  });

  it('não-dinheiro acima do total é recusado', async () => {
    const c = await comanda185();
    expect((await pay(c, 'pix', '185.00')).errors).toEqual([]);
    const r = await pay(c, 'pix', '1.00');
    expect(r.errors[0].code).toBe('NON_CASH_EXCEEDS_TOTAL');
    expect(r.comanda).toBeNull();
  });

  it('pagamento parcial deixa falta e bloqueia o fechamento', async () => {
    const c = await comanda185();
    const r = await pay(c, 'pix', '50.00');
    expect(r.comanda).toMatchObject({
      paid: '50.00',
      remaining: '135.00',
      canClose: false,
      closeError: 'INSUFFICIENT_PAYMENT',
    });
  });

  it('crédito do cliente respeita o saldo disponível', async () => {
    const c = await comanda185();
    await adminPrisma.clientCreditMovement.create({
      data: { organizationId: w.orgId, clientId: w.clientId, amount: '50.00', kind: 'deposit' },
    });
    const ok = await pay(c, 'client_credit', '50.00');
    expect(ok.errors).toEqual([]);
    expect(ok.comanda!.clientCreditBalance).toBe('50.00');
    const over = await pay(c, 'client_credit', '1.00');
    expect(over.errors[0].code).toBe('CREDIT_INSUFFICIENT');
    expect(over.errors[0].message).toContain('0,00');
    // nenhum movimento de ledger é gravado antes do fechamento
    const movs = await adminPrisma.clientCreditMovement.count({
      where: { organizationId: w.orgId },
    });
    expect(movs).toBe(1);
    expect(await adminPrisma.cashMovement.count({ where: { organizationId: w.orgId } })).toBe(0);
  });

  it('remover pagamento recalcula o pago', async () => {
    const c = await comanda185();
    const first = await pay(c, 'pix', '50.00');
    const second = await pay(c, 'cash', '30.00');
    expect(second.comanda!.paid).toBe('80.00');
    const removed = (
      await att()(REMOVE_PAY, { c, p: first.comanda!.payments[0].id })
    ).data.removeComandaPayment as Payload;
    expect(removed.comanda).toMatchObject({ paid: '30.00', remaining: '155.00' });
    const missing = (
      await att()(REMOVE_PAY, { c, p: '00000000-0000-4000-8000-000000000000' })
    ).data.removeComandaPayment as Payload;
    expect(missing.errors[0].code).toBe('PAYMENT_NOT_FOUND');
  });

  it('ATTENDANT lança pagamento; PROFESSIONAL recebe erro de permissão', async () => {
    const c = await comanda185();
    expect((await pay(c, 'cash', '10.00')).errors).toEqual([]);
    const denied = await gqlAs(w, w.tokens.proA)(ADD_PAY, {
      i: { comandaId: c, method: 'cash', amount: '10.00' },
    });
    expect(denied.errors?.length).toBeGreaterThan(0);
  });

  it('comanda cancelada não aceita pagamento', async () => {
    const c = await comanda185();
    await adminPrisma.comanda.update({ where: { id: c }, data: { status: 'cancelled' } });
    expect((await pay(c, 'cash', '10.00')).errors[0].code).toBe('COMANDA_NOT_OPEN');
  });
});

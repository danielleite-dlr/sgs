import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import {
  createPhase4World,
  destroyPhase4World,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { createServiceRule, OPEN, ADD_ITEM, ADD_PAY, REOPEN } from './helpers/phase3-comanda-flow';

const FIELDS = `id status closeCycle total covered owed paid remaining change canClose closeError
  items { id kind name contractId contractCode listUnitPrice total }`;
const PAYLOAD = `comanda { ${FIELDS} } errors { code message field }`;
const CLOSE = `mutation($id: UUID!) { closeComanda(id: $id) { ${PAYLOAD} } }`;
const GET = `query($id: UUID!) { comanda(id: $id) { ${FIELDS} } }`;

type Cv = {
  id: string;
  status: string;
  closeCycle: number;
  total: string;
  covered: string;
  owed: string;
  remaining: string;
  canClose: boolean;
  items: { id: string; kind: string; contractId: string | null; contractCode: string | null }[];
};
type Pl = { comanda: Cv | null; errors: { code: string; message: string }[] };

describe('Phase 4 - comanda abatida por contrato (D-08)', () => {
  let w: Phase4World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4cc-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4cc');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(filter);
    await deletePhase3Rows(filter);
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.product.update({ where: { id: w.productId }, data: { stockQuantity: 10 } });
    await adminPrisma.stockMovement.deleteMany({ where: { organizationId: w.orgId } });
  });

  const att = () => gqlAs(w, w.tokens.attendant);

  /** Comanda com serviço R$100 + produto R$35, ambos cobertos pelo contrato. */
  async function coveredComanda() {
    const open = (await att()(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Pl;
    const comandaId = open.comanda!.id;
    const add = (extra: Record<string, unknown>) =>
      att()(ADD_ITEM, { i: { comandaId, professionalId: w.members.proA, quantity: 1, ...extra } });
    await add({ kind: 'service', serviceId: w.serviceId });
    await add({ kind: 'product', productId: w.productId });
    const g = await insertBridalGroupRow(w);
    const { contractId, code } = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
    });
    await adminPrisma.comandaItem.updateMany({ where: { comandaId }, data: { contractId } });
    return { comandaId, contractId, code, add };
  }

  it('fecha sem pagamento: a pagar 0, sem caixa, comissão pelo preço cheio, estoque baixa', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId, code } = await coveredComanda();

    const view = (await att()(GET, { id: comandaId })).data.comanda as Cv;
    expect(view).toMatchObject({ total: '135.00', covered: '135.00', owed: '0.00', canClose: true });
    expect(view.items.every((i) => i.contractCode === code)).toBe(true);

    const r = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(r.errors).toEqual([]);
    expect(r.comanda).toMatchObject({ status: 'closed', closeCycle: 1, owed: '0.00', covered: '135.00' });

    expect(await adminPrisma.cashMovement.count({ where: { comandaId } })).toBe(0);
    const rec = await adminPrisma.commissionRecord.findMany({ where: { comandaId, kind: 'accrual' } });
    expect(rec).toHaveLength(2);
    const svc = rec.find((x) => Number(x.baseAmount) === 100)!;
    expect(String(svc.calculatedAmount)).toBe('40');
    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(9);
  });

  it('extra do dia é cobrado: INSUFFICIENT_PAYMENT sem pagar; fecha pagando só o extra', async () => {
    const { comandaId, add } = await coveredComanda();
    await add({ kind: 'product', productId: w.productId });
    const extra = (await att()(GET, { id: comandaId })).data.comanda;
    expect(extra).toMatchObject({ total: '170.00', covered: '135.00', owed: '35.00' });

    const fail = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(fail.errors[0].code).toBe('INSUFFICIENT_PAYMENT');
    expect(fail.errors[0].message).toContain('Falta R$ 35,00');

    const pay = (await att()(ADD_PAY, { i: { comandaId, method: 'cash', amount: '35.00' } })).data
      .addComandaPayment as Pl;
    expect(pay.errors).toEqual([]);
    expect(pay.comanda!.canClose).toBe(true);

    const ok = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(ok.errors).toEqual([]);
    expect(ok.comanda!.status).toBe('closed');

    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(8);
    const cash = await adminPrisma.cashMovement.findMany({ where: { comandaId } });
    expect(cash).toHaveLength(1);
    expect(cash[0]).toMatchObject({ kind: 'payment_in', method: 'cash' });
    expect(String(cash[0].amount)).toBe('35');
  });

  it('fechar -> reabrir -> fechar: estorna só o extra, comissões revertidas e recriadas', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId, add } = await coveredComanda();
    await add({ kind: 'product', productId: w.productId });
    await att()(ADD_PAY, { i: { comandaId, method: 'cash', amount: '35.00' } });
    expect(((await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl).errors).toEqual([]);

    const re = (
      await gqlAs(w, w.tokens.admin)(REOPEN, { i: { id: comandaId, reason: 'ajuste do contrato' } })
    ).data.reopenComanda as Pl;
    expect(re.errors).toEqual([]);
    expect(re.comanda!.status).toBe('open');

    const again = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(again.errors).toEqual([]);
    expect(again.comanda).toMatchObject({ status: 'closed', closeCycle: 2, owed: '35.00', remaining: '0.00' });

    const cash = await adminPrisma.cashMovement.findMany({ where: { comandaId }, orderBy: { createdAt: 'asc' } });
    const net = cash.reduce((a, c) => a + Math.round(Number(c.amount) * 100), 0);
    expect(net).toBe(3500);
    expect(cash.map((c) => c.kind)).toEqual(['payment_in', 'reversal', 'payment_in']);
    expect(cash.every((c) => Math.abs(Number(c.amount)) === 35)).toBe(true);

    const rec = await adminPrisma.commissionRecord.findMany({ where: { comandaId } });
    expect(rec.filter((x) => x.kind === 'accrual')).toHaveLength(6);
    expect(rec.filter((x) => x.kind === 'reversal')).toHaveLength(3);
    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(8);
  });

  it('comanda sem cobertura segue idêntica à fase 3', async () => {
    const open = (await att()(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Pl;
    const comandaId = open.comanda!.id;
    await att()(ADD_ITEM, {
      i: { comandaId, professionalId: w.members.proA, quantity: 1, kind: 'service', serviceId: w.serviceId },
    });
    const v = (await att()(GET, { id: comandaId })).data.comanda as Cv;
    expect(v).toMatchObject({ total: '100.00', covered: '0.00', owed: '100.00', canClose: false });
    const fail = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(fail.errors[0].code).toBe('INSUFFICIENT_PAYMENT');
  });
});

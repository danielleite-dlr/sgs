import { adminPrisma, appPrisma } from './setup';
import { createPhase3World, destroyPhase3World, gqlAs, type Phase3World } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import {
  ADD_ITEM,
  ADD_PAY,
  CLOSE,
  OPEN,
  PAYLOAD,
  range,
  type Payload,
} from './helpers/phase3-comanda-flow';

const RECORDS = `query($f: String!, $t: String!) {
  commissionRecords(from: $f, to: $t) { id kind itemName noRule calculatedAmount reversed ruleSnapshot }
}`;
const GET = `query($id: UUID!) { comanda(id: $id) { hasCommissionWarnings commissions { memberId itemName calculatedAmount noRule } } }`;

describe('Phase 3 - registros de comissão (D-14, D-23, D-24)', () => {
  let w: Phase3World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p3comm-%'`;

  beforeAll(async () => {
    w = await createPhase3World('p3comm');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(filter);
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.product.update({ where: { id: w.productId }, data: { stockQuantity: 10 } });
    await adminPrisma.stockMovement.deleteMany({ where: { organizationId: w.orgId } });
  });

  const att = () => gqlAs(w, w.tokens.attendant);

  async function open(): Promise<string> {
    return ((await att()(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Payload)
      .comanda!.id;
  }
  const addSvc = (comandaId: string, serviceId: string, professionalId: string) =>
    att()(ADD_ITEM, { i: { comandaId, kind: 'service', serviceId, professionalId, quantity: 1 } });
  /** Paga o total em pix e fecha. */
  async function payAndClose(comandaId: string, total: string): Promise<Payload> {
    await att()(ADD_PAY, { i: { comandaId, method: 'pix', amount: total } });
    return (await att()(CLOSE, { id: comandaId })).data.closeComanda as Payload;
  }
  const rule = (data: Record<string, unknown>) =>
    adminPrisma.commissionRule.create({
      data: { organizationId: w.orgId, ...data } as never,
    });

  it('precedência de regras, hierarquia de categoria e aviso sem regra', async () => {
    const svcRule = await rule({ scopeType: 'service', serviceId: w.serviceId, kind: 'percentage', value: '40' });
    await rule({ scopeType: 'member_service', memberId: w.members.proA, serviceId: w.serviceBId, kind: 'fixed', value: '30' });
    await rule({ scopeType: 'category', categoryId: w.childCategoryId, kind: 'percentage', value: '10' });
    const id = await open();
    await addSvc(id, w.serviceId, w.members.proA); // 100 -> 40%
    await addSvc(id, w.serviceBId, w.members.proA); // fixo 30
    await addSvc(id, w.serviceBId, w.members.proB); // categoria 10% de 50 = 5
    await att()(ADD_ITEM, { i: { comandaId: id, kind: 'product', productId: w.productId, professionalId: w.members.proB, quantity: 1 } });
    const r = await payAndClose(id, '235.00');
    expect(r.errors).toEqual([]);
    expect(r.comanda!.hasCommissionWarnings).toBe(true);
    const vals = r.comanda!.commissions.map((c) => [c.itemName.slice(-9), c.calculatedAmount, c.noRule]);
    expect(r.comanda!.commissions).toHaveLength(4);
    expect(vals.map((v) => v[1]).sort()).toEqual(['0.00', '30.00', '40.00', '5.00']);
    const none = r.comanda!.commissions.find((c) => c.noRule)!;
    expect(none.calculatedAmount).toBe('0.00');
    const rec = await adminPrisma.commissionRecord.findFirst({ where: { ruleId: svcRule.id } });
    expect(rec).toMatchObject({ kind: 'accrual', cycle: 1, noRule: false });
    // leitura posterior do mesmo dado
    const g = (await att()(GET, { id })).data.comanda;
    expect(g.hasCommissionWarnings).toBe(true);
    expect(g.commissions).toHaveLength(4);
  });

  it('pacote: comissão sobre o preço cheio (D-23)', async () => {
    await rule({ scopeType: 'service', serviceId: w.serviceId, kind: 'percentage', value: '40' });
    const id = await open();
    const pkg = (
      await att()(
        `mutation($i: AddComandaPackageInput!) { addComandaPackage(input: $i) { ${PAYLOAD} } }`,
        {
          i: {
            comandaId: id,
            packageId: w.packageId,
            assignments: [
              { serviceId: w.serviceId, professionalId: w.members.proB },
              { serviceId: w.serviceBId, professionalId: w.members.proB },
            ],
          },
        },
      )
    ).data.addComandaPackage as Payload;
    expect(pkg.errors).toEqual([]);
    expect((await payAndClose(id, '135.00')).errors).toEqual([]);
    const row = await adminPrisma.commissionRecord.findFirst({
      where: { comandaId: id, noRule: false },
    });
    expect(String(row!.calculatedAmount)).toBe('40');
    expect(String(row!.baseAmount)).toBe('100');
    const snap = row!.ruleSnapshot as Record<string, unknown>;
    expect(snap.baseAmount).toBe('100.00');
    expect(snap.chargedAmount).toBe('90.00');
    expect(snap.fixedPer).toBe('unit');
  });

  it('editar ou apagar a regra depois não altera os registros', async () => {
    const svcRule = await rule({ scopeType: 'service', serviceId: w.serviceId, kind: 'percentage', value: '40' });
    const ms = await rule({ scopeType: 'member_service', memberId: w.members.proB, serviceId: w.serviceBId, kind: 'fixed', value: '30' });
    const id = await open();
    await addSvc(id, w.serviceId, w.members.proA);
    await addSvc(id, w.serviceBId, w.members.proB);
    await payAndClose(id, '150.00');
    const before = await adminPrisma.commissionRecord.findMany({ where: { comandaId: id }, orderBy: { id: 'asc' } });
    await adminPrisma.commissionRule.update({ where: { id: svcRule.id }, data: { value: '50' } });
    await adminPrisma.commissionRule.update({ where: { id: ms.id }, data: { deletedAt: new Date() } });
    const after = await adminPrisma.commissionRecord.findMany({ where: { comandaId: id }, orderBy: { id: 'asc' } });
    expect(after).toEqual(before);
    expect(before.map((b) => String(b.calculatedAmount)).sort()).toEqual(['30', '40']);
  });

  it('sgs_app não consegue UPDATE nem DELETE em commission_records', async () => {
    await rule({ scopeType: 'default', kind: 'percentage', value: '10' });
    const id = await open();
    await addSvc(id, w.serviceId, w.members.proA);
    await payAndClose(id, '100.00');
    const run = (sql: string) =>
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${w.orgId}'`);
        await tx.$executeRawUnsafe(sql);
      });
    await expect(run('UPDATE commission_records SET calculated_amount = 0')).rejects.toThrow(/permission denied/i);
    await expect(run('DELETE FROM commission_records')).rejects.toThrow(/permission denied/i);
  });

  it('commissionRecords mostra itemName do snapshot', async () => {
    await rule({ scopeType: 'service', serviceId: w.serviceId, kind: 'percentage', value: '40' });
    const id = await open();
    await addSvc(id, w.serviceId, w.members.proA);
    await payAndClose(id, '100.00');
    const { from, to } = range();
    const res = (await gqlAs(w, w.tokens.admin)(RECORDS, { f: from, t: to })).data.commissionRecords;
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ kind: 'accrual', calculatedAmount: '40.00', noRule: false, reversed: false });
    expect(res[0].itemName).toContain('servico-a');
  });
});

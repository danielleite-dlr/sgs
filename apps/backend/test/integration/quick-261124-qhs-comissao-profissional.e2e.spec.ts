import { adminPrisma } from './setup';
import { createPhase3World, destroyPhase3World, gqlAs, type Phase3World } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import { ADD_ITEM, ADD_PAY, CLOSE, OPEN, range, type Payload } from './helpers/phase3-comanda-flow';

const RECORDS = `query($f: String!, $t: String!) {
  commissionRecords(from: $f, to: $t) {
    memberId calculatedAmount chargedAmount baseAmount ruleKind ruleValue ruleSnapshot
  }
}`;

type Rec = {
  memberId: string;
  calculatedAmount: string;
  chargedAmount: string;
  baseAmount: string;
  ruleKind: string | null;
  ruleValue: string | null;
  ruleSnapshot: string;
};

describe('Quick 261124-qhs - profissional vê só a comissão (sem valor cobrado)', () => {
  let w: Phase3World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'qhs-%'`;

  beforeAll(async () => {
    w = await createPhase3World('qhs');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(filter);
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
  });

  async function seed() {
    await adminPrisma.commissionRule.create({
      data: { organizationId: w.orgId, scopeType: 'service', serviceId: w.serviceId, kind: 'percentage', value: '40' } as never,
    });
    const att = gqlAs(w, w.tokens.attendant);
    const id = ((await att(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Payload).comanda!.id;
    await att(ADD_ITEM, { i: { comandaId: id, kind: 'service', serviceId: w.serviceId, professionalId: w.members.proA, quantity: 1 } });
    await att(ADD_PAY, { i: { comandaId: id, method: 'pix', amount: '100.00' } });
    const closed = (await att(CLOSE, { id })).data.closeComanda as Payload;
    expect(closed.errors).toEqual([]);
  }

  it('PROFESSIONAL recebe a comissão e valores cobrados mascarados', async () => {
    await seed();
    const { from, to } = range();
    const res = await gqlAs(w, w.tokens.proA)(RECORDS, { f: from, t: to });
    expect(res.errors).toBeUndefined();
    const rows = res.data.commissionRecords as Rec[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.memberId).toBe(w.members.proA);
      expect(r.chargedAmount).toBe('0.00');
      expect(r.baseAmount).toBe('0.00');
      expect(r.ruleValue).toBeNull();
      expect(r.ruleSnapshot).toBe('{}');
    }
    expect(rows.map((r) => r.calculatedAmount)).toContain('40.00');
  });

  it('ADMIN continua vendo os valores reais', async () => {
    await seed();
    const { from, to } = range();
    const res = await gqlAs(w, w.tokens.admin)(RECORDS, { f: from, t: to });
    expect(res.errors).toBeUndefined();
    const row = (res.data.commissionRecords as Rec[]).find((r) => r.calculatedAmount === '40.00')!;
    expect(row.chargedAmount).toBe('100.00');
    expect(row.baseAmount).toBe('100.00');
    expect(row.ruleValue).not.toBeNull();
    expect(row.ruleSnapshot).not.toBe('{}');
  });
});

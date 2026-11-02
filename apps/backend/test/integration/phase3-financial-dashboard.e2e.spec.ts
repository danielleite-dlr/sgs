import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const SUMMARY = `query($f: String!, $t: String!, $g: String!) {
  financialSummary(from: $f, to: $t, granularity: $g) {
    timezone billedTotal receivedTotal closedComandas averageTicket commissionsTotal
    buckets { bucketStart billed received closedComandas }
    receivedByMethod { method total }
  }
}`;
const RECORDS = `query($f: String!, $t: String!, $m: UUID) {
  commissionRecords(from: $f, to: $t, memberId: $m) { id memberId comandaCode kind itemName noRule calculatedAmount reversed ruleSnapshot }
}`;
const TOTALS = `query($f: String!, $t: String!, $m: UUID) {
  commissionTotals(from: $f, to: $t, memberId: $m) { memberId total records noRuleCount }
}`;

describe('Phase 3 - dashboard financeiro (D-22)', () => {
  let w: Phase3World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p3dash-%'`;

  beforeAll(async () => {
    w = await createPhase3World('p3dash');
    const mkComanda = async (
      code: string,
      status: string,
      total: string,
      closedAt: string | null,
    ) =>
      adminPrisma.comanda.create({
        data: {
          organizationId: w.orgId,
          code,
          clientId: w.clientId,
          status,
          total,
          closedAt: closedAt ? new Date(closedAt) : null,
          closedBy: closedAt ? w.members.admin : null,
          closeCycle: closedAt ? 1 : 0,
        },
      });
    const c1 = await mkComanda('C-2030-001', 'closed', '185.00', '2030-03-10T02:30:00Z');
    const c2 = await mkComanda('C-2030-002', 'closed', '100.00', '2030-03-10T15:00:00Z');
    await mkComanda('C-2030-003', 'open', '999.00', null);

    const item = (comandaId: string, professionalId: string, name: string) =>
      adminPrisma.comandaItem.create({
        data: {
          organizationId: w.orgId,
          comandaId,
          kind: 'service',
          serviceId: w.serviceId,
          professionalId,
          nameSnapshot: name,
          quantity: 1,
          listUnitPrice: '100.00',
          unitPrice: '100.00',
          total: '100.00',
        },
      });
    const i1 = await item(c1.id, w.members.proA, 'Corte A');
    const i2 = await item(c1.id, w.members.proB, 'Corte B');
    const i3 = await item(c2.id, w.members.proB, 'Corte C');

    const cash = (
      kind: string,
      method: string,
      amount: string,
      at: string,
      comandaId: string | null = null,
    ) => ({
      organizationId: w.orgId,
      kind,
      method,
      amount,
      occurredAt: new Date(at),
      comandaId,
      clientId: w.clientId,
    });
    await adminPrisma.cashMovement.createMany({
      data: [
        cash('deposit_in', 'pix', '50.00', '2030-03-05T13:00:00Z'),
        cash('payment_in', 'pix', '100.00', '2030-03-10T02:30:00Z', c1.id),
        cash('payment_in', 'cash', '50.00', '2030-03-10T02:30:00Z', c1.id),
        cash('change_out', 'cash', '-15.00', '2030-03-10T02:30:00Z', c1.id),
        cash('payment_in', 'credit_card', '100.00', '2030-03-10T15:00:00Z', c2.id),
      ],
    });

    const rec = (
      comandaId: string,
      comandaItemId: string,
      memberId: string,
      amount: string,
      at: string,
      name: string,
      noRule = false,
    ) => ({
      organizationId: w.orgId,
      comandaId,
      comandaItemId,
      memberId,
      kind: 'accrual',
      cycle: 1,
      baseAmount: '100.00',
      chargedAmount: '100.00',
      ruleKind: noRule ? null : 'percentage',
      ruleValue: noRule ? null : '40',
      noRule,
      ruleSnapshot: { itemName: name },
      calculatedAmount: amount,
      calculatedAt: new Date(at),
    });
    await adminPrisma.commissionRecord.createMany({
      data: [
        rec(c1.id, i1.id, w.members.proA, '40.00', '2030-03-10T02:30:00Z', 'Corte A'),
        rec(c1.id, i2.id, w.members.proB, '0.00', '2030-03-10T02:30:00Z', 'Corte B', true),
        rec(c2.id, i3.id, w.members.proB, '30.00', '2030-03-10T15:00:00Z', 'Corte C'),
      ],
    });
  });
  afterAll(async () => {
    await deletePhase3Rows(filter);
    await destroyPhase3World(w);
  });

  const q = (token: string) => gqlAs(w, token);
  const vars = (g: string) => ({ f: '2030-03-01', t: '2030-04-01', g });

  it('Faturado por data de fechamento local e Recebido por data do movimento', async () => {
    const r = await q(w.tokens.admin)(SUMMARY, vars('day'));
    expect(r.errors).toBeUndefined();
    const s = r.data.financialSummary;
    expect(s.timezone).toBe('America/Sao_Paulo');
    expect(s.buckets).toHaveLength(31);
    const by = (d: string) => s.buckets.find((b: { bucketStart: string }) => b.bucketStart === d);
    expect(by('2030-03-09').billed).toBe('185.00');
    expect(by('2030-03-10').billed).toBe('100.00');
    expect(by('2030-03-05').received).toBe('50.00');
    expect(by('2030-03-09').received).toBe('135.00');
    expect(by('2030-03-01').billed).toBe('0.00');
    expect(s.billedTotal).toBe('285.00');
    expect(s.receivedTotal).toBe('285.00');
    expect(s.closedComandas).toBe(2);
    expect(s.averageTicket).toBe('142.50');
    expect(s.commissionsTotal).toBe('70.00');
  });

  it('breakdown por método sobre Recebido (troco abate, sem client_credit)', async () => {
    const s = (await q(w.tokens.admin)(SUMMARY, vars('day'))).data.financialSummary;
    expect(s.receivedByMethod).toEqual([
      { method: 'pix', total: '150.00' },
      { method: 'credit_card', total: '100.00' },
      { method: 'cash', total: '35.00' },
    ]);
  });

  it('semana (segunda) e mês', async () => {
    const wk = (await q(w.tokens.admin)(SUMMARY, vars('week'))).data.financialSummary;
    const first = wk.buckets[0];
    expect(first.bucketStart).toBe('2030-02-25');
    const sinal = wk.buckets.find((b: { bucketStart: string }) => b.bucketStart === '2030-03-04');
    // semana 04-10/03 inclui o sinal (05/03) + pagamentos de 09 e 10/03: 50 + 135 + 100
    expect(sinal.received).toBe('285.00');
    expect(sinal.billed).toBe('285.00');
    const mo = (await q(w.tokens.admin)(SUMMARY, vars('month'))).data.financialSummary;
    expect(mo.buckets).toHaveLength(1);
    expect(mo.buckets[0].bucketStart).toBe('2030-03-01');
    expect(mo.buckets[0].billed).toBe('285.00');
  });

  it('outra organização não vê nada', async () => {
    const s = (await q(w.tokens.otherAdmin)(SUMMARY, vars('month'))).data.financialSummary;
    expect(s.billedTotal).toBe('0.00');
    expect(s.receivedTotal).toBe('0.00');
    expect(s.receivedByMethod).toEqual([]);
    expect(s.commissionsTotal).toBe('0.00');
  });

  it('RBAC: ATTENDANT e PROFESSIONAL negados; MANAGER ok', async () => {
    for (const t of [w.tokens.attendant, w.tokens.proA]) {
      const r = await q(t)(SUMMARY, vars('day'));
      expect(r.errors?.length).toBeGreaterThan(0);
      expect(r.data).toBeNull();
    }
    const ok = await q(w.tokens.manager)(SUMMARY, vars('day'));
    expect(ok.errors).toBeUndefined();
    expect(ok.data.financialSummary.billedTotal).toBe('285.00');
  });

  it('comissões: PROFESSIONAL sempre vê só as próprias; noRuleCount para o gerente', async () => {
    const mine = await q(w.tokens.proB)(RECORDS, {
      f: '2030-03-01',
      t: '2030-04-01',
      m: w.members.proA,
    });
    const recs = mine.data.commissionRecords;
    expect(recs).toHaveLength(2);
    expect(recs.every((r: { memberId: string }) => r.memberId === w.members.proB)).toBe(true);
    expect(recs.map((r: { itemName: string }) => r.itemName).sort()).toEqual(['Corte B', 'Corte C']);
    expect(recs[0].ruleSnapshot).toContain('itemName');

    const tot = await q(w.tokens.proB)(TOTALS, { f: '2030-03-01', t: '2030-04-01', m: w.members.proA });
    expect(tot.data.commissionTotals).toEqual([
      { memberId: w.members.proB, total: '30.00', records: 2, noRuleCount: 1 },
    ]);

    const all = await q(w.tokens.manager)(TOTALS, { f: '2030-03-01', t: '2030-04-01' });
    expect(all.data.commissionTotals).toHaveLength(2);
    const att = await q(w.tokens.attendant)(RECORDS, { f: '2030-03-01', t: '2030-04-01' });
    expect(att.errors?.length).toBeGreaterThan(0);
  });

  it('cashMovements lista o caixa do período com código da comanda', async () => {
    const r = await q(w.tokens.admin)(
      `query { cashMovements(from: "2030-03-01", to: "2030-04-01") { kind method amount comandaCode clientName } }`,
    );
    expect(r.errors).toBeUndefined();
    expect(r.data.cashMovements).toHaveLength(5);
    expect(r.data.cashMovements).toContainEqual({
      kind: 'change_out',
      method: 'cash',
      amount: '-15.00',
      comandaCode: 'C-2030-001',
      clientName: 'p3dash-cliente',
    });
  });

  it('datas inválidas, intervalo grande e granularidade inválida -> erro', async () => {
    const bad = await q(w.tokens.admin)(SUMMARY, { f: '10/03/2030', t: '2030-04-01', g: 'day' });
    expect(bad.errors?.length).toBeGreaterThan(0);
    const big = await q(w.tokens.admin)(SUMMARY, { f: '2028-01-01', t: '2030-04-01', g: 'day' });
    expect(big.errors?.length).toBeGreaterThan(0);
    const inv = await q(w.tokens.admin)(SUMMARY, { f: '2030-04-01', t: '2030-03-01', g: 'day' });
    expect(inv.errors?.length).toBeGreaterThan(0);
    const g = await q(w.tokens.admin)(SUMMARY, { f: '2030-03-01', t: '2030-04-01', g: 'year' });
    expect(g.errors?.length).toBeGreaterThan(0);
  });

  it('adjustClientCredit via GraphQL: só ADMIN/MANAGER (credit.adjust)', async () => {
    const M = `mutation($i: AdjustClientCreditInput!) { adjustClientCredit(input: $i) { balance errors { code } } }`;
    const i = { clientId: w.clientId, amount: '12.50', reason: 'Cortesia' };
    const denied = await q(w.tokens.attendant)(M, { i });
    expect(denied.errors?.length).toBeGreaterThan(0);
    const ok = await q(w.tokens.manager)(M, { i });
    expect(ok.data.adjustClientCredit).toEqual({ balance: '12.50', errors: [] });
    const bal = await q(w.tokens.attendant)(
      `query { clientCreditBalances { clientName balance } }`,
    );
    expect(bal.data.clientCreditBalances).toEqual([
      { clientName: 'p3dash-cliente', balance: '12.50' },
    ]);
  });
});

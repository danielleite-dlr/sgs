import { adminPrisma } from './setup';
import { createPhase3World, destroyPhase3World, gqlAs, type Phase3World } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import {
  CLOSE,
  REMOVE_ITEM,
  REOPEN,
  buildFlow135,
  createServiceRule,
  range,
  sum,
  type Payload,
} from './helpers/phase3-comanda-flow';

const SUMMARY = `query($f: String!, $t: String!) {
  financialSummary(from: $f, to: $t, granularity: "day") { billedTotal receivedTotal closedComandas }
}`;
const RECORDS = `query($f: String!, $t: String!) {
  commissionRecords(from: $f, to: $t) { id kind cycle calculatedAmount reversed }
}`;

describe('Phase 3 - reabertura da comanda (D-08)', () => {
  let w: Phase3World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p3reop-%'`;

  beforeAll(async () => {
    w = await createPhase3World('p3reop');
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

  const reopen = (token: string, id: string, reason: string) =>
    gqlAs(w, token)(REOPEN, { i: { id, reason } });

  async function closedFlow() {
    await createServiceRule(w, w.serviceId, '40');
    const flow = await buildFlow135(w);
    const r = (await gqlAs(w, w.tokens.attendant)(CLOSE, { id: flow.comandaId })).data
      .closeComanda as Payload;
    expect(r.errors).toEqual([]);
    return flow;
  }

  it('permissão, motivo obrigatório e estado', async () => {
    const { comandaId } = await closedFlow();
    const denied = await reopen(w.tokens.attendant, comandaId, 'Erro de fechamento');
    expect(denied.errors?.[0]?.message ?? '').toMatch(/permiss|forbidden|autoriz/i);
    const noReason = (await reopen(w.tokens.manager, comandaId, '')).data.reopenComanda as Payload;
    expect(noReason.errors[0].code).toBe('REASON_REQUIRED');
    expect((await adminPrisma.comanda.findUnique({ where: { id: comandaId } }))!.status).toBe('closed');

    const ok = (await reopen(w.tokens.manager, comandaId, 'Erro de fechamento')).data
      .reopenComanda as Payload;
    expect(ok.errors).toEqual([]);
    const notClosed = (await reopen(w.tokens.manager, comandaId, 'Outra vez'))
      .data.reopenComanda as Payload;
    expect(notClosed.errors[0].code).toBe('COMANDA_NOT_CLOSED');
  });

  it('reverte estoque, comissão, crédito e caixa; audita', async () => {
    const { comandaId, appointmentId } = await closedFlow();
    const r = (await reopen(w.tokens.manager, comandaId, 'Erro de fechamento')).data
      .reopenComanda as Payload;
    expect(r.errors).toEqual([]);
    expect(r.comanda).toMatchObject({
      status: 'open',
      closedAt: null,
      closeCycle: 1,
      clientCreditBalance: '50.00',
    });

    expect((await adminPrisma.product.findUnique({ where: { id: w.productId } }))!.stockQuantity).toBe(10);
    const sm = await adminPrisma.stockMovement.findMany({ where: { comandaId } });
    expect(sm.map((m) => m.type).sort()).toEqual(['return', 'sale']);

    const recs = await adminPrisma.commissionRecord.findMany({ where: { comandaId, cycle: 1 } });
    const accruals = recs.filter((x) => x.kind === 'accrual');
    const reversals = recs.filter((x) => x.kind === 'reversal');
    expect(accruals).toHaveLength(2);
    expect(reversals).toHaveLength(2);
    for (const a of accruals) {
      const rev = reversals.find((x) => x.reversesRecordId === a.id)!;
      expect(Number(rev.calculatedAmount) + Number(a.calculatedAmount)).toBe(0);
    }
    expect(sum(recs.map((x) => ({ amount: x.calculatedAmount })))).toBe(0);

    const credit = await adminPrisma.clientCreditMovement.findMany({ where: { comandaId } });
    expect(credit.find((c) => c.kind === 'reopen_refund')).toBeTruthy();
    expect(Number(credit.find((c) => c.kind === 'reopen_refund')!.amount)).toBe(50);

    const cash = await adminPrisma.cashMovement.findMany({ where: { comandaId, cycle: 1 } });
    expect(sum(cash)).toBe(0);

    expect((await adminPrisma.appointment.findUnique({ where: { id: appointmentId } }))!.status).toBe('in_progress');
    const audit = await adminPrisma.auditLog.findMany({ where: { entityId: comandaId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'comanda.reopen', reason: 'Erro de fechamento' });
  });

  it('financeiro: reaberta sai do faturado; recebido mantém só o sinal', async () => {
    const { comandaId } = await closedFlow();
    const { from, to } = range();
    const q = () => gqlAs(w, w.tokens.admin)(SUMMARY, { f: from, t: to });
    const closed = (await q()).data.financialSummary;
    expect(closed.billedTotal).toBe('135.00');
    expect(closed.receivedTotal).toBe('135.00'); // sinal 50 + pix 50 + dinheiro 50 - troco 15
    await reopen(w.tokens.manager, comandaId, 'Erro de fechamento');
    const open = (await q()).data.financialSummary;
    expect(open.billedTotal).toBe('0.00');
    expect(open.closedComandas).toBe(0);
    expect(open.receivedTotal).toBe('50.00');
  });

  it('refechar gera ciclo 2 sem mexer no estoque do ciclo 1 revertido', async () => {
    const { comandaId } = await closedFlow();
    await reopen(w.tokens.manager, comandaId, 'Cliente desistiu do produto');
    const items = (await gqlAs(w, w.tokens.attendant)(
      `query($id: UUID!) { comanda(id: $id) { items { id kind } } }`,
      { id: comandaId },
    )).data.comanda.items as { id: string; kind: string }[];
    const prod = items.find((i) => i.kind === 'product')!;
    const rem = (await gqlAs(w, w.tokens.attendant)(REMOVE_ITEM, { c: comandaId, i: prod.id })).data
      .removeComandaItem as Payload;
    expect(rem.errors).toEqual([]);
    // total 100: crédito 50 + pix 50 + dinheiro 50 -> troco 50 (cabe no dinheiro)
    const r = (await gqlAs(w, w.tokens.attendant)(CLOSE, { id: comandaId })).data.closeComanda as Payload;
    expect(r.errors).toEqual([]);
    expect(r.comanda).toMatchObject({ status: 'closed', closeCycle: 2 });
    expect((await adminPrisma.product.findUnique({ where: { id: w.productId } }))!.stockQuantity).toBe(10);
    const cycle2 = await adminPrisma.commissionRecord.findMany({ where: { comandaId, cycle: 2 } });
    expect(cycle2).toHaveLength(1);
    expect(cycle2[0].kind).toBe('accrual');
    const { from, to } = range();
    const list = (await gqlAs(w, w.tokens.admin)(RECORDS, { f: from, t: to })).data.commissionRecords as {
      kind: string;
      cycle: number;
      reversed: boolean;
    }[];
    const c1 = list.filter((x) => x.cycle === 1 && x.kind === 'accrual');
    expect(c1).toHaveLength(2);
    expect(c1.every((x) => x.reversed)).toBe(true);
    expect(list.filter((x) => x.cycle === 2 && x.kind === 'accrual').every((x) => !x.reversed)).toBe(true);
  });

  it('reabertura dupla em paralelo: um sucesso, outro COMANDA_NOT_CLOSED', async () => {
    const { comandaId } = await closedFlow();
    const [a, b] = await Promise.all([
      reopen(w.tokens.manager, comandaId, 'Erro de fechamento'),
      reopen(w.tokens.admin, comandaId, 'Erro de fechamento'),
    ]);
    const results = [a.data.reopenComanda, b.data.reopenComanda] as Payload[];
    expect(results.filter((r) => r.errors.length === 0)).toHaveLength(1);
    expect(results.find((r) => r.errors.length > 0)!.errors[0].code).toBe('COMANDA_NOT_CLOSED');
    expect(await adminPrisma.commissionRecord.count({ where: { comandaId, kind: 'reversal' } })).toBe(2);
    expect(await adminPrisma.auditLog.count({ where: { entityId: comandaId } })).toBe(1);
  });
});

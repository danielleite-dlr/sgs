import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const FIELDS = `id status paid balance depositPaid depositPending settled
  payments { id kind method amount reversed reversesPaymentId note }`;
const PAY = `mutation($input: RecordContractPaymentInput!) {
  recordContractPayment(input: $input) { contract { ${FIELDS} } errors { code message field } }
}`;
const REVERSE = `mutation($input: ReverseContractPaymentInput!) {
  reverseContractPayment(input: $input) { contract { ${FIELDS} } errors { code message field } }
}`;
const SUMMARY = `query($f: String!, $t: String!) {
  financialSummary(from: $f, to: $t, granularity: "day") {
    contractBilledTotal receivedTotal receivedByMethod { method total }
  }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

describe('Fase 4 - pagamentos do contrato (CONT-01)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4cpay-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4cpay');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  const adm = () => gqlAs(w, w.tokens.admin);
  const mgr = () => gqlAs(w, w.tokens.manager);
  const att = () => gqlAs(w, w.tokens.attendant);

  async function newContract(total = '8000.00', deposit = '2400.00') {
    const g = await insertBridalGroupRow(w, { eventDate: localDay(60) });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: total,
      depositAmount: deposit,
      status: 'active',
    });
    return { ...c, brideClientId: g.brideClientId };
  }

  const pay = (contractId: string, lines: { method: string; amount: string }[], who = adm()) =>
    who(PAY, { input: { contractId, lines } });

  it('entrada de 2.400 no pix quita a entrada e gera um contract_in com contract_id', async () => {
    const c = await newContract();
    const r = await pay(c.contractId, [{ method: 'pix', amount: '2400.00' }]);
    expect(r.errors).toBeUndefined();
    const p = r.data.recordContractPayment;
    expect(p.errors).toEqual([]);
    expect(p.contract).toMatchObject({ paid: '2400.00', depositPending: '0.00', settled: false });
    const mov = await adminPrisma.cashMovement.findMany({ where: { contractId: c.contractId } });
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ kind: 'contract_in', method: 'pix', clientId: c.brideClientId });
    expect(mov[0].amount.toString()).toBe('2400');
  });

  it('restante parcial em dinheiro e depois em duas linhas quita o contrato; excesso é rejeitado', async () => {
    const c = await newContract();
    await pay(c.contractId, [{ method: 'pix', amount: '2400.00' }]);
    const r2 = await pay(c.contractId, [{ method: 'cash', amount: '3000.00' }]);
    expect(r2.data.recordContractPayment.contract.paid).toBe('5400.00');
    const r3 = await pay(c.contractId, [
      { method: 'credit_card', amount: '1600.00' },
      { method: 'debit_card', amount: '1000.00' },
    ]);
    expect(r3.data.recordContractPayment.contract).toMatchObject({ paid: '8000.00', settled: true });
    const over = await pay(c.contractId, [{ method: 'pix', amount: '0.01' }]);
    expect(over.data.recordContractPayment.errors[0].code).toBe('OVERPAYMENT');
    expect(await adminPrisma.cashMovement.count({ where: { contractId: c.contractId } })).toBe(4);
  });

  it('valida linhas, método e valor', async () => {
    const c = await newContract();
    const code = async (lines: { method: string; amount: string }[]) =>
      (await pay(c.contractId, lines)).data.recordContractPayment.errors[0].code;
    expect(await code([])).toBe('PAYMENT_LINES_REQUIRED');
    expect(await code(Array.from({ length: 6 }, () => ({ method: 'pix', amount: '1.00' })))).toBe(
      'TOO_MANY_LINES',
    );
    expect(await code([{ method: 'voucher', amount: '1.00' }])).toBe('INVALID_METHOD');
    expect(await code([{ method: 'pix', amount: '0' }])).toBe('INVALID_AMOUNT');
    expect(await code([{ method: 'pix', amount: 'abc' }])).toBe('INVALID_AMOUNT');
    expect(await adminPrisma.contractPayment.count({ where: { contractId: c.contractId } })).toBe(0);
  });

  it('financialSummary do dia soma contractBilledTotal e receivedByMethod por método', async () => {
    const c = await newContract();
    await pay(c.contractId, [
      { method: 'pix', amount: '2400.00' },
      { method: 'cash', amount: '600.00' },
    ]);
    const r = await adm()(SUMMARY, { f: localDay(0), t: localDay(1) });
    expect(r.errors).toBeUndefined();
    const s = r.data.financialSummary;
    expect(s.contractBilledTotal).toBe('3000.00');
    const by = Object.fromEntries(
      s.receivedByMethod.map((m: { method: string; total: string }) => [m.method, m.total]),
    );
    expect(by).toMatchObject({ pix: '2400.00', cash: '600.00' });
  });

  it('estorno por manager cria reversal no ledger e no caixa; segundo estorno é recusado', async () => {
    const c = await newContract();
    await pay(c.contractId, [{ method: 'pix', amount: '2400.00' }]);
    const r = await pay(c.contractId, [{ method: 'cash', amount: '3000.00' }]);
    const cashPay = r.data.recordContractPayment.contract.payments.find(
      (p: { method: string }) => p.method === 'cash',
    );

    const short = await mgr()(REVERSE, { input: { paymentId: cashPay.id, reason: 'x' } });
    expect(short.data.reverseContractPayment.errors[0].code).toBe('REASON_REQUIRED');

    const rev = await mgr()(REVERSE, { input: { paymentId: cashPay.id, reason: 'Lançado em duplicidade' } });
    expect(rev.data.reverseContractPayment.errors).toEqual([]);
    const view = rev.data.reverseContractPayment.contract;
    expect(view.paid).toBe('2400.00');
    expect(view.payments.find((p: { id: string }) => p.id === cashPay.id).reversed).toBe(true);
    const reversal = view.payments.find((p: { kind: string }) => p.kind === 'reversal');
    expect(reversal).toMatchObject({ amount: '-3000.00', reversesPaymentId: cashPay.id });

    const mov = await adminPrisma.cashMovement.findFirstOrThrow({
      where: { contractId: c.contractId, kind: 'reversal' },
    });
    expect(mov.amount.toString()).toBe('-3000');
    expect(mov.method).toBe('cash');

    const again = await mgr()(REVERSE, { input: { paymentId: cashPay.id, reason: 'Outra vez' } });
    expect(again.data.reverseContractPayment.errors[0].code).toBe('ALREADY_REVERSED');
    const notFound = await mgr()(REVERSE, {
      input: { paymentId: reversal.id, reason: 'Estornar o estorno' },
    });
    expect(notFound.data.reverseContractPayment.errors[0].code).toBe('PAYMENT_NOT_FOUND');
  });

  it('atendente registra pagamento mas não estorna', async () => {
    const c = await newContract();
    const r = await pay(c.contractId, [{ method: 'pix', amount: '500.00' }], att());
    expect(r.data.recordContractPayment.errors).toEqual([]);
    const id = r.data.recordContractPayment.contract.payments[0].id;
    const rev = await att()(REVERSE, { input: { paymentId: id, reason: 'Tentativa' } });
    expect(rev.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
    expect(await adminPrisma.contractPayment.count({ where: { kind: 'reversal' } })).toBe(0);
  });

  it('sgs_app não consegue UPDATE nem DELETE no ledger (permission denied)', async () => {
    const c = await newContract();
    await pay(c.contractId, [{ method: 'pix', amount: '100.00' }]);
    for (const sql of ['UPDATE contract_payments SET amount = 1', 'DELETE FROM contract_payments']) {
      await expect(
        appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization = '${w.orgId}'`);
          await tx.$executeRawUnsafe(sql);
        }),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it('outra organização não paga o contrato (NOT_FOUND)', async () => {
    const c = await newContract();
    const r = await pay(c.contractId, [{ method: 'pix', amount: '10.00' }], gqlAs(w, w.tokens.otherAdmin));
    expect(r.data.recordContractPayment.errors[0].code).toBe('NOT_FOUND');
    expect(await adminPrisma.contractPayment.count({ where: { contractId: c.contractId } })).toBe(0);
  });

  it('contrato cancelado não aceita pagamento', async () => {
    const g = await insertBridalGroupRow(w, { eventDate: localDay(60) });
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '300.00',
      status: 'cancelled',
    });
    const r = await pay(c.contractId, [{ method: 'pix', amount: '10.00' }]);
    expect(r.data.recordContractPayment.errors[0].code).toBe('CONTRACT_NOT_PAYABLE');
  });
});

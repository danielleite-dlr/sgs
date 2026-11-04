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

const SUMMARY = `query($f: String!, $t: String!, $g: String!) {
  financialSummary(from: $f, to: $t, granularity: $g) {
    billedTotal contractBilledTotal receivedTotal closedComandas averageTicket
    buckets { bucketStart billed billedContracts received closedComandas }
  }
}`;
const CASH = `query($f: String!, $t: String!) {
  cashMovements(from: $f, to: $t) { kind amount contractId contractCode comandaCode }
}`;

describe('Phase 4 - dashboard com contrato (D-14, D-25)', () => {
  let w: Phase4World;
  let code: string;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4dash-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4dash');
    const g = await insertBridalGroupRow(w);
    const c = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
    });
    code = c.code;
    const pay = (amount: string, at: string) => ({
      organizationId: w.orgId,
      contractId: c.contractId,
      kind: 'payment',
      method: 'pix',
      amount,
      paidAt: new Date(at),
    });
    const cash = (kind: string, amount: string, at: string) => ({
      organizationId: w.orgId,
      kind,
      method: 'pix',
      amount,
      occurredAt: new Date(at),
      contractId: c.contractId,
      clientId: g.brideClientId,
    });
    // D = 2030-03-10
    await adminPrisma.contractPayment.createMany({
      data: [
        pay('2400.00', '2030-02-18T15:00:00Z'),
        pay('3000.00', '2030-02-28T15:00:00Z'),
        pay('2600.00', '2030-03-10T15:00:00Z'),
        { ...pay('-1000.00', '2030-03-11T15:00:00Z'), kind: 'refund' },
      ],
    });
    await adminPrisma.cashMovement.createMany({
      data: [
        cash('contract_in', '2400.00', '2030-02-18T15:00:00Z'),
        cash('contract_in', '3000.00', '2030-02-28T15:00:00Z'),
        cash('contract_in', '2600.00', '2030-03-10T15:00:00Z'),
        cash('contract_refund', '-1000.00', '2030-03-11T15:00:00Z'),
      ],
    });

    const mk = async (codeC: string, total: string, extraPaid: string | null) => {
      const cm = await adminPrisma.comanda.create({
        data: {
          organizationId: w.orgId,
          code: codeC,
          clientId: w.clientId,
          status: 'closed',
          total,
          closedAt: new Date('2030-03-10T15:00:00Z'),
          closedBy: w.members.admin,
          closeCycle: 1,
        },
      });
      const item = (amount: string, contractId: string | null) =>
        adminPrisma.comandaItem.create({
          data: {
            organizationId: w.orgId,
            comandaId: cm.id,
            kind: 'service',
            serviceId: w.serviceId,
            professionalId: w.members.proA,
            nameSnapshot: 'Item',
            quantity: 1,
            listUnitPrice: amount,
            unitPrice: amount,
            total: amount,
            contractId,
          },
        });
      await item('300.00', c.contractId);
      if (extraPaid) {
        await item(extraPaid, null);
        await adminPrisma.cashMovement.create({
          data: {
            organizationId: w.orgId,
            kind: 'payment_in',
            method: 'cash',
            amount: extraPaid,
            occurredAt: new Date('2030-03-10T15:00:00Z'),
            comandaId: cm.id,
            clientId: w.clientId,
            cycle: 1,
          },
        });
      }
    };
    await mk('C-2030-901', '300.00', null);
    await mk('C-2030-902', '350.00', '50.00');
  });
  afterAll(async () => {
    await deletePhase4Rows(filter);
    await deletePhase3Rows(filter);
    await destroyPhase4World(w);
  });

  const q = gqlAsAdmin;
  function gqlAsAdmin(query: string, variables: Record<string, unknown>) {
    return gqlAs(w, w.tokens.admin)(query, variables);
  }

  it('dia D: contrato por paid_at + só a parte não coberta; ticket só com a pagar > 0', async () => {
    const r = await q(SUMMARY, { f: '2030-03-10', t: '2030-03-11', g: 'day' });
    expect(r.errors).toBeUndefined();
    const s = r.data.financialSummary;
    expect(s.billedTotal).toBe('2650.00');
    expect(s.contractBilledTotal).toBe('2600.00');
    expect(s.receivedTotal).toBe('2650.00');
    expect(s.closedComandas).toBe(1);
    expect(s.averageTicket).toBe('50.00');
    expect(s.buckets[0]).toMatchObject({ billed: '2650.00', billedContracts: '2600.00' });
  });

  it('mês inteiro soma os pagamentos do contrato sem duplicar', async () => {
    const s = (await q(SUMMARY, { f: '2030-02-01', t: '2030-03-10', g: 'month' })).data.financialSummary;
    expect(s.contractBilledTotal).toBe('5400.00');
    const m = (await q(SUMMARY, { f: '2030-03-01', t: '2030-04-01', g: 'month' })).data.financialSummary;
    // março: 2600 (D) - 1000 (reembolso) = 1600 de contrato
    expect(m.contractBilledTotal).toBe('1600.00');
    const all = (await q(SUMMARY, { f: '2030-02-01', t: '2030-04-01', g: 'month' })).data.financialSummary;
    expect(all.contractBilledTotal).toBe('7000.00');
  });

  it('pagamentos brutos de 8000 aparecem em fevereiro+março antes do reembolso', async () => {
    const s = (await q(SUMMARY, { f: '2030-02-01', t: '2030-03-11', g: 'month' })).data.financialSummary;
    expect(s.contractBilledTotal).toBe('8000.00');
  });

  it('reembolso reduz o faturado na data do reembolso', async () => {
    const s = (await q(SUMMARY, { f: '2030-03-11', t: '2030-03-12', g: 'day' })).data.financialSummary;
    expect(s.billedTotal).toBe('-1000.00');
    expect(s.receivedTotal).toBe('-1000.00');
    expect(s.closedComandas).toBe(0);
    expect(s.averageTicket).toBe('0.00');
  });

  it('cashMovements expõe o código do contrato nas linhas de contrato', async () => {
    const r = await q(CASH, { f: '2030-02-01', t: '2030-04-01' });
    expect(r.errors).toBeUndefined();
    const rows = r.data.cashMovements as { kind: string; contractCode: string | null }[];
    const contractRows = rows.filter((x) => x.kind.startsWith('contract_'));
    expect(contractRows).toHaveLength(4);
    expect(contractRows.every((x) => x.contractCode === code)).toBe(true);
    expect(rows.filter((x) => x.kind === 'payment_in').every((x) => x.contractCode === null)).toBe(true);
  });
});

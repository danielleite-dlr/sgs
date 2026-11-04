import {
  buildAlertCandidates,
  type AlertCompanionInput,
  type AlertContractInput,
} from './alert-candidates';

const settings = { depositUnpaidDays: 3, notAcceptedDays: 3, companionDepositDays: 15 };
const TODAY = '2030-06-10';

function contract(over: Partial<AlertContractInput> = {}): AlertContractInput {
  return {
    id: 'c1',
    code: 'CT-2030-001',
    status: 'active',
    brideName: 'Ana',
    totalCents: 800000,
    depositCents: 240000,
    paymentsCents: [640000],
    balanceDueDate: '2030-06-13',
    createdLocalDate: '2030-05-01',
    acceptedLocalDate: '2030-05-02',
    linkGeneratedLocalDate: '2030-05-01',
    currentVersion: 2,
    ...over,
  };
}

const run = (contracts: AlertContractInput[]) =>
  buildAlertCandidates({ today: TODAY, settings, contracts, companions: [] });

describe('buildAlertCandidates', () => {
  it('prazo em 3 dias gera due_soon com state = data do prazo', () => {
    const r = run([contract()]);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('contract_balance_due_soon');
    expect(r[0].state).toBe('2030-06-13');
    expect(r[0].dedupeKey).toBe('contract_balance_due_soon:c1:2030-06-13');
    expect(r[0].payload.contractId).toBe('c1');
  });

  it('prazo ontem gera overdue e não due_soon', () => {
    const r = run([contract({ balanceDueDate: '2030-06-09' })]);
    expect(r.map((c) => c.kind)).toEqual(['contract_balance_overdue']);
  });

  it('prazo distante e quitado não geram nada', () => {
    expect(run([contract({ balanceDueDate: '2030-06-20' })])).toHaveLength(0);
    expect(run([contract({ paymentsCents: [800000] })])).toHaveLength(0);
  });

  it('entrada não paga respeita o limiar', () => {
    const base = { paymentsCents: [], balanceDueDate: '2030-07-30' };
    const r3 = run([contract({ ...base, acceptedLocalDate: '2030-06-07' })]);
    expect(r3.map((c) => c.kind)).toEqual(['contract_deposit_unpaid']);
    expect(run([contract({ ...base, acceptedLocalDate: '2030-06-08' })])).toHaveLength(0);
  });

  it('contrato não aceito após N dias, state = versão', () => {
    const c = contract({
      status: 'awaiting_acceptance',
      acceptedLocalDate: null,
      linkGeneratedLocalDate: '2030-06-07',
      paymentsCents: [],
    });
    const r = run([c]);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('contract_not_accepted');
    expect(r[0].state).toBe('v2');
    expect(run([{ ...c, linkGeneratedLocalDate: '2030-06-08' }])).toHaveLength(0);
  });

  it('sinal de acompanhante avulsa perto do evento', () => {
    const comp = (
      eventDate: string,
      depositCents = 0,
      hasAppointments = true,
    ): AlertCompanionInput => ({
      groupId: 'g1',
      groupName: 'Grupo',
      eventDate,
      memberId: 'm1',
      clientName: 'Mãe',
      depositCents,
      hasAppointments,
    });
    const f = (c: AlertCompanionInput) =>
      buildAlertCandidates({ today: TODAY, settings, contracts: [], companions: [c] });
    const r = f(comp('2030-06-20'));
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('bridal_companion_deposit_pending');
    expect(r[0].payload.groupId).toBe('g1');
    expect(f(comp('2030-06-30'))).toHaveLength(0);
    expect(f(comp('2030-06-20', 5000))).toHaveLength(0);
    expect(f(comp('2030-06-20', 0, false))).toHaveLength(0);
  });

  it('cancelado e rascunho não geram alertas de contrato', () => {
    expect(run([contract({ status: 'cancelled', balanceDueDate: '2030-06-01' })])).toHaveLength(0);
    expect(run([contract({ status: 'draft', balanceDueDate: '2030-06-01' })])).toHaveLength(0);
  });
});

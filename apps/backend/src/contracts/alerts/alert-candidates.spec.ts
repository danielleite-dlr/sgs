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
    contractorName: 'Ana',
    debutanteName: null,
    paymentMode: 'sinal',
    installments: [],
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

describe('alertas de parcela do sinal', () => {
  const inst2 = [
    { seq: 1, dueDate: '2030-06-12', cents: 20000 },
    { seq: 2, dueDate: '2030-06-30', cents: 20000 },
  ];
  const base = { installments: inst2, paymentsCents: [] as number[], balanceDueDate: '2030-09-01' };
  const kinds = (r: { kind: string }[]) => r.map((c) => c.kind);

  it('parcela vencendo em 2 dias', () => {
    const r = run([contract(base)]);
    expect(kinds(r)).toEqual(['contract_installment_due_soon']);
    expect(r[0].state).toBe('p1:2030-06-12');
    expect(r[0].title).toBe('Parcela do sinal vence em 2 dia(s)');
  });

  it('parcela vencendo hoje', () => {
    const r = run([contract({ ...base, installments: [{ seq: 1, dueDate: TODAY, cents: 20000 }] })]);
    expect(r[0].title).toBe('Parcela do sinal vence hoje');
  });

  it('parcela vencida parcialmente paga', () => {
    const r = run([
      contract({
        ...base,
        installments: [{ seq: 1, dueDate: '2030-06-09', cents: 20000 }, inst2[1]],
        paymentsCents: [10000],
      }),
    ]);
    expect(kinds(r)).toEqual(['contract_installment_overdue']);
    expect(r[0].title).toBe('Parcela do sinal vencida');
    expect(r[0].message).toContain('R$');
    expect(r[0].message).toContain('100,00');
    expect(r[0].message).toContain('parcela 1/2');
    expect(r[0].dedupeKey).toBe('contract_installment_overdue:c1:p1:2030-06-09');
  });

  it('parcela quitada não alerta; tudo pago não alerta', () => {
    expect(kinds(run([contract({ ...base, paymentsCents: [20000] })]))).toEqual([]);
    expect(run([contract({ ...base, paymentsCents: [40000] })])).toHaveLength(0);
  });

  it('estorno volta a alertar', () => {
    const r = run([contract({ ...base, paymentsCents: [20000, -20000] })]);
    expect(kinds(r)).toEqual(['contract_installment_due_soon']);
  });

  it('à vista vencido não gera alertas do restante', () => {
    const r = run([
      contract({
        paymentMode: 'a_vista',
        installments: [{ seq: 1, dueDate: '2030-06-09', cents: 80000 }],
        paymentsCents: [],
        balanceDueDate: '2030-06-01',
      }),
    ]);
    expect(kinds(r)).toEqual(['contract_installment_overdue']);
    expect(r[0].title).toBe('Pagamento à vista vencido');
  });

  it('à vista vencendo', () => {
    const r = run([
      contract({
        paymentMode: 'a_vista',
        installments: [{ seq: 1, dueDate: '2030-06-12', cents: 80000 }],
        paymentsCents: [],
      }),
    ]);
    expect(r[0].title).toBe('Pagamento à vista vence em 2 dia(s)');
  });

  it('sem parcelas mantém entrada não paga legada', () => {
    const r = run([
      contract({ paymentsCents: [], balanceDueDate: '2030-07-30', acceptedLocalDate: '2030-06-07' }),
    ]);
    expect(kinds(r)).toEqual(['contract_deposit_unpaid']);
  });

  it('aguardando aceite não gera alerta de parcela', () => {
    const r = run([
      contract({
        ...base,
        status: 'awaiting_acceptance',
        installments: [{ seq: 1, dueDate: '2030-06-09', cents: 20000 }],
        linkGeneratedLocalDate: '2030-06-09',
      }),
    ]);
    expect(kinds(r)).toEqual([]);
  });

  it('rótulo da debutante nomeia a contratante e a debutante', () => {
    const r = run([
      contract({ ...base, contractorName: 'Mãe', debutanteName: 'Filha' }),
      contract({ ...base, id: 'c2', code: 'CT-2', contractorName: 'Noiva' }),
    ]);
    expect(r[0].message.startsWith('CT-2030-001 — Mãe (debutante Filha)')).toBe(true);
    expect(r[1].message.startsWith('CT-2 — Noiva')).toBe(true);
  });
});

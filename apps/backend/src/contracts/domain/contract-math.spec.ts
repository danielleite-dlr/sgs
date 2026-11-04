import {
  balanceDueDate,
  computeContractStatus,
  computeContractTotals,
  computeDepositCents,
  daysBetween,
} from './contract-math';

describe('computeDepositCents', () => {
  it.each([
    ['percent', '30', 800000, 240000],
    ['fixed', '3000.00', 200000, 200000],
    ['fixed', '500.00', 200000, 50000],
    [null, null, 800000, 0],
    ['percent', '33.33', 10000, 3333],
    ['percent', null, 10000, 0],
    ['fixed', null, 10000, 0],
  ] as const)('%s %s sobre %d = %d', (kind, value, total, expected) => {
    expect(computeDepositCents(kind, value, total)).toBe(expected);
  });
});

describe('computeContractTotals', () => {
  it('soma itens, desconta e mantém entrada', () => {
    expect(
      computeContractTotals({ itemsCents: [500000, 300000], discountCents: 50000, depositCents: 200000 }),
    ).toEqual({ itemsTotalCents: 800000, totalCents: 750000, depositCents: 200000 });
  });
  it('desconto maior que itens', () => {
    expect(() => computeContractTotals({ itemsCents: [100], discountCents: 101, depositCents: 0 })).toThrow(
      new RangeError('DISCOUNT_GT_ITEMS'),
    );
  });
  it('entrada maior que total', () => {
    expect(() => computeContractTotals({ itemsCents: [100], discountCents: 0, depositCents: 101 })).toThrow(
      new RangeError('DEPOSIT_GT_TOTAL'),
    );
  });
  it.each([
    [[-1], 0, 0],
    [[100], -1, 0],
    [[100], 0, -1],
  ])('negativos %j %d %d', (itemsCents, discountCents, depositCents) => {
    expect(() => computeContractTotals({ itemsCents, discountCents, depositCents })).toThrow(
      new RangeError('NEGATIVE'),
    );
  });
});

describe('balanceDueDate / daysBetween', () => {
  it.each([
    ['2026-12-20', 10, '2026-12-10'],
    ['2027-03-05', 10, '2027-02-23'],
    ['2026-12-20', 0, '2026-12-20'],
    ['2027-01-05', 10, '2026-12-26'],
  ])('%s - %d = %s', (d, n, expected) => {
    expect(balanceDueDate(d, n)).toBe(expected);
  });
  it.each([
    ['2026-12-10', '2026-12-20', 10],
    ['2026-12-20', '2026-12-10', -10],
    ['2026-12-20', '2026-12-20', 0],
    ['2026-02-27', '2026-03-02', 3],
  ])('daysBetween %s %s = %d', (a, b, n) => {
    expect(daysBetween(a, b)).toBe(n);
  });
});

describe('computeContractStatus', () => {
  const base = {
    status: 'active',
    totalCents: 800000,
    depositCents: 240000,
    balanceDueDate: '2026-12-10',
    today: '2026-12-07',
    depositReferenceDate: '2026-11-01',
    depositUnpaidDays: 7,
  };

  it('parcial a 3 dias do prazo: vence em breve', () => {
    const r = computeContractStatus({ ...base, paymentsCents: [240000, 200000, 200000] });
    expect(r).toMatchObject({
      paidCents: 640000,
      balanceCents: 160000,
      depositPaidCents: 240000,
      depositPendingCents: 0,
      settled: false,
      daysToBalanceDue: 3,
      balanceDueSoon: true,
      balanceOverdue: false,
      depositOverdue: false,
    });
  });
  it('quitado zera alertas', () => {
    const r = computeContractStatus({ ...base, paymentsCents: [240000, 200000, 200000, 160000] });
    expect(r.settled).toBe(true);
    expect(r.balanceCents).toBe(0);
    expect(r.balanceDueSoon).toBe(false);
    expect(r.balanceOverdue).toBe(false);
  });
  it('um dia após o prazo com saldo: vencido', () => {
    const r = computeContractStatus({ ...base, today: '2026-12-11', paymentsCents: [240000] });
    expect(r.balanceOverdue).toBe(true);
    expect(r.balanceDueSoon).toBe(false);
    expect(r.daysToBalanceDue).toBe(-1);
  });
  it('longe do prazo: sem alerta', () => {
    const r = computeContractStatus({ ...base, today: '2026-12-01', paymentsCents: [240000] });
    expect(r.balanceDueSoon).toBe(false);
    expect(r.balanceOverdue).toBe(false);
  });
  it('estorno da entrada: paid 0 e entrada pendente', () => {
    const r = computeContractStatus({ ...base, paymentsCents: [240000, -240000] });
    expect(r.paidCents).toBe(0);
    expect(r.depositPendingCents).toBe(240000);
  });
  it('paid nunca negativo', () => {
    expect(computeContractStatus({ ...base, paymentsCents: [-100] }).paidCents).toBe(0);
  });
  it('entrada atrasada após N dias da referência', () => {
    const r = computeContractStatus({ ...base, today: '2026-11-08', paymentsCents: [] });
    expect(r.depositOverdue).toBe(true);
    const r2 = computeContractStatus({ ...base, today: '2026-11-07', paymentsCents: [] });
    expect(r2.depositOverdue).toBe(false);
  });
  it.each(['cancelled', 'draft'])('status %s não alerta', (status) => {
    const r = computeContractStatus({ ...base, status, today: '2026-12-20', paymentsCents: [] });
    expect(r.balanceDueSoon).toBe(false);
    expect(r.balanceOverdue).toBe(false);
    expect(r.depositOverdue).toBe(false);
  });
});

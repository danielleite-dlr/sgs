import { computeComandaTotals, coveredCents, PAYMENT_METHODS } from './comanda-math';

describe('computeComandaTotals', () => {
  it('pix + dinheiro acima do total gera troco', () => {
    expect(
      computeComandaTotals(20000, [
        { method: 'pix', cents: 10000 },
        { method: 'cash', cents: 12000 },
      ]),
    ).toEqual({
      totalCents: 20000,
      paidCents: 22000,
      remainingCents: 0,
      changeCents: 2000,
      cashCents: 12000,
      nonCreditCents: 22000,
      creditCents: 0,
      canClose: true,
      error: null,
    });
  });

  it('pagamento insuficiente', () => {
    const t = computeComandaTotals(20000, [{ method: 'pix', cents: 15000 }]);
    expect(t.remainingCents).toBe(5000);
    expect(t.canClose).toBe(false);
    expect(t.error).toBe('INSUFFICIENT_PAYMENT');
  });

  it('troco sem dinheiro é inválido', () => {
    const t = computeComandaTotals(10000, [{ method: 'pix', cents: 13000 }]);
    expect(t.changeCents).toBe(3000);
    expect(t.canClose).toBe(false);
    expect(t.error).toBe('INVALID_CHANGE');
  });

  it('crédito do cliente conta como pago e separa nonCredit', () => {
    const t = computeComandaTotals(10000, [
      { method: 'client_credit', cents: 5000 },
      { method: 'cash', cents: 5000 },
    ]);
    expect(t.creditCents).toBe(5000);
    expect(t.nonCreditCents).toBe(5000);
    expect(t.canClose).toBe(true);
  });

  it('comanda zerada fecha sem pagamento', () => {
    const t = computeComandaTotals(0, []);
    expect(t.canClose).toBe(true);
    expect(t.error).toBeNull();
  });

  it('troco coberto pelo dinheiro, mesmo com outros métodos', () => {
    const t = computeComandaTotals(10000, [
      { method: 'pix', cents: 9000 },
      { method: 'cash', cents: 2000 },
    ]);
    expect(t.changeCents).toBe(1000);
    expect(t.canClose).toBe(true);
  });

  it('não aceita voucher entre os métodos', () => {
    expect(PAYMENT_METHODS).toHaveLength(6);
    expect((PAYMENT_METHODS as readonly string[]).includes('voucher')).toBe(false);
  });
});

describe('cobertura por contrato (D-08)', () => {
  it('coveredCents soma só itens com contrato', () => {
    expect(
      coveredCents([
        { totalCents: 10000, contractId: 'c1' },
        { totalCents: 5000, contractId: null },
      ]),
    ).toBe(10000);
  });
  it('comanda 100% coberta fecha sem pagamento', () => {
    const t = computeComandaTotals(0, []);
    expect(t.canClose).toBe(true);
    expect(t.error).toBeNull();
  });
  it('extra não pago continua insuficiente', () => {
    const t = computeComandaTotals(5000, []);
    expect(t.error).toBe('INSUFFICIENT_PAYMENT');
    expect(t.remainingCents).toBe(5000);
  });
});

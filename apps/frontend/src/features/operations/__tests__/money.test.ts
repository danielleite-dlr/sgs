import { describe, expect, it } from 'vitest';
import { centsToDecimal, computePaymentSummary, decimalToCents, sumDecimals } from '../lib/money';

describe('money', () => {
  it('decimalToCents', () => {
    expect(decimalToCents('80.00')).toBe(8000);
    expect(decimalToCents('0.10')).toBe(10);
    expect(decimalToCents('-5.5')).toBe(-550);
    expect(decimalToCents('80')).toBe(8000);
  });
  it('decimalToCents inválido lança', () => {
    expect(() => decimalToCents('abc')).toThrow('valor inválido');
  });
  it('centsToDecimal', () => {
    expect(centsToDecimal(8050)).toBe('80.50');
    expect(centsToDecimal(-500)).toBe('-5.00');
    expect(centsToDecimal(5)).toBe('0.05');
  });
  it('sumDecimals sem erro de float', () => {
    expect(sumDecimals(['10.10', '0.20'])).toBe('10.30');
    expect(sumDecimals([])).toBe('0.00');
  });
  it('troco coberto por dinheiro', () => {
    expect(
      computePaymentSummary('200.00', [
        { method: 'pix', amount: '100.00' },
        { method: 'cash', amount: '120.00' },
      ]),
    ).toEqual({
      total: '200.00',
      paid: '220.00',
      remaining: '0.00',
      change: '20.00',
      canClose: true,
      error: null,
    });
  });
  it('falta pagar', () => {
    const s = computePaymentSummary('200.00', [{ method: 'pix', amount: '150.00' }]);
    expect(s.remaining).toBe('50.00');
    expect(s.change).toBe('0.00');
    expect(s.canClose).toBe(false);
    expect(s.error).toBeNull();
  });
  it('troco sem dinheiro é inválido', () => {
    const s = computePaymentSummary('100.00', [{ method: 'pix', amount: '130.00' }]);
    expect(s.change).toBe('30.00');
    expect(s.canClose).toBe(false);
    expect(s.error).toBe('INVALID_CHANGE');
  });
  it('troco igual ao dinheiro é válido', () => {
    const s = computePaymentSummary('100.00', [
      { method: 'cash', amount: '20.00' },
      { method: 'pix', amount: '100.00' },
    ]);
    expect(s.change).toBe('20.00');
    expect(s.canClose).toBe(true);
  });
  it('sem pagamentos', () => {
    const s = computePaymentSummary('50.00', []);
    expect(s.remaining).toBe('50.00');
    expect(s.canClose).toBe(false);
  });
});

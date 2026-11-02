import { Prisma } from '@prisma/client';
import { fromCents, parseMoneyInput, splitProportional, toCents } from './money';

describe('money', () => {
  describe('toCents', () => {
    it('converte strings, numeros e Decimal para centavos', () => {
      expect(toCents('80.00')).toBe(8000);
      expect(toCents('80')).toBe(8000);
      expect(toCents('80.5')).toBe(8050);
      expect(toCents(new Prisma.Decimal('12.34'))).toBe(1234);
      expect(toCents('-5.00')).toBe(-500);
      expect(toCents(80.5)).toBe(8050);
    });
    it('arredonda half-up', () => {
      expect(toCents('0.005')).toBe(1);
    });
  });

  describe('fromCents', () => {
    it('formata centavos com duas casas', () => {
      expect(fromCents(8050)).toBe('80.50');
      expect(fromCents(0)).toBe('0.00');
      expect(fromCents(-500)).toBe('-5.00');
      expect(fromCents(5)).toBe('0.05');
    });
  });

  describe('parseMoneyInput', () => {
    it('aceita apenas o formato do backend', () => {
      expect(parseMoneyInput('50.00')).toBe(5000);
      expect(parseMoneyInput('0')).toBe(0);
      expect(parseMoneyInput('50.5')).toBe(5050);
    });
    it('rejeita entradas invalidas com null', () => {
      expect(parseMoneyInput('50,00')).toBeNull();
      expect(parseMoneyInput('abc')).toBeNull();
      expect(parseMoneyInput('-1.00')).toBeNull();
      expect(parseMoneyInput('1.234')).toBeNull();
      expect(parseMoneyInput('')).toBeNull();
    });
  });

  describe('splitProportional', () => {
    it('rateia proporcionalmente com soma exata', () => {
      expect(splitProportional([8000, 2000], 9000)).toEqual([7200, 1800]);
    });
    it('resto vai no ultimo elemento', () => {
      const r = splitProportional([3333, 3333, 3334], 10000);
      expect(r.reduce((a, b) => a + b, 0)).toBe(10000);
      expect(r).toEqual([3333, 3333, 3334]);
      const r2 = splitProportional([1, 1, 1], 100);
      expect(r2).toEqual([33, 33, 34]);
    });
    it('pesos zerados: tudo no ultimo', () => {
      expect(splitProportional([0, 0], 1000)).toEqual([0, 1000]);
    });
    it('lista vazia retorna vazio', () => {
      expect(splitProportional([], 100)).toEqual([]);
    });
  });
});

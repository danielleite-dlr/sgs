import { describe, it, expect } from '@jest/globals';
import { validateCpf, normalizeCpf } from '../cpf.util';

describe('validateCpf', () => {
  it.each([
    ['111.111.111-11', false], // all same digit
    ['12345678900', false], // bad checksum
    ['', false],
    ['abc', false],
    ['000.000.000-00', false],
    ['529.982.247-25', true], // valid known CPF
    ['52998224725', true], // unformatted same number
  ])('validates %s as %s', (cpf, expected) => {
    expect(validateCpf(cpf)).toBe(expected);
  });

  it('returns false for null', () => {
    expect(validateCpf(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(validateCpf(undefined)).toBe(false);
  });

  it('returns false for string with too few digits', () => {
    expect(validateCpf('123456789')).toBe(false);
  });
});

describe('normalizeCpf', () => {
  it('strips formatting', () => {
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
  });

  it('returns digits-only string unchanged', () => {
    expect(normalizeCpf('52998224725')).toBe('52998224725');
  });
});

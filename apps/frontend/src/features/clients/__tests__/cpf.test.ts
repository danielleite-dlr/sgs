import { describe, it, expect } from 'vitest';
import { validateCpf, formatCpf, unformatCpf } from '../utils/cpf';

describe('validateCpf', () => {
  it('validates correctly known valid CPF', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
    expect(validateCpf('52998224725')).toBe(true);
  });

  it('rejects all-same-digit CPFs', () => {
    expect(validateCpf('111.111.111-11')).toBe(false);
    expect(validateCpf('000.000.000-00')).toBe(false);
    expect(validateCpf('99999999999')).toBe(false);
  });

  it('rejects empty/null/undefined input', () => {
    expect(validateCpf('')).toBe(false);
    expect(validateCpf(null)).toBe(false);
    expect(validateCpf(undefined)).toBe(false);
  });

  it('rejects CPFs with wrong checksum', () => {
    expect(validateCpf('12345678900')).toBe(false);
    expect(validateCpf('123.456.789-00')).toBe(false);
  });

  it('rejects CPFs with wrong length', () => {
    expect(validateCpf('1234')).toBe(false);
    expect(validateCpf('123456789012')).toBe(false);
  });
});

describe('formatCpf', () => {
  it('formats progressively', () => {
    expect(formatCpf('')).toBe('');
    expect(formatCpf('1')).toBe('1');
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('123456')).toBe('123.456');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('123456789')).toBe('123.456.789');
    expect(formatCpf('1234567890')).toBe('123.456.789-0');
    expect(formatCpf('12345678901')).toBe('123.456.789-01');
  });

  it('formats already-formatted CPF idempotently', () => {
    expect(formatCpf('529.982.247-25')).toBe('529.982.247-25');
  });

  it('handles extra digits by truncating to 11', () => {
    // Only first 11 digits are taken
    expect(formatCpf('123456789012345')).toBe('123.456.789-01');
  });
});

describe('unformatCpf', () => {
  it('strips formatting characters', () => {
    expect(unformatCpf('123.456.789-01')).toBe('12345678901');
    expect(unformatCpf('529.982.247-25')).toBe('52998224725');
  });

  it('returns digits-only input unchanged', () => {
    expect(unformatCpf('12345678901')).toBe('12345678901');
  });

  it('handles empty string', () => {
    expect(unformatCpf('')).toBe('');
  });
});

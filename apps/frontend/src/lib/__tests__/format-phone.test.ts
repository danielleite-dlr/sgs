import { describe, it, expect } from 'vitest';
import { formatPhoneBr } from '../format-phone';

describe('formatPhoneBr', () => {
  it('formata celular em E.164 com +55', () => {
    expect(formatPhoneBr('+5511988887777')).toBe('(11) 98888-7777');
  });

  it('formata celular só com DDD', () => {
    expect(formatPhoneBr('11988887777')).toBe('(11) 98888-7777');
  });

  it('formata fixo com 10 dígitos', () => {
    expect(formatPhoneBr('1188887777')).toBe('(11) 8888-7777');
  });

  it('aceita espaços e traços no texto de origem', () => {
    expect(formatPhoneBr('+55 11 98888-7777')).toBe('(11) 98888-7777');
  });

  it('fixo com 55 na frente (12 dígitos)', () => {
    expect(formatPhoneBr('551188887777')).toBe('(11) 8888-7777');
  });

  it('devolve como veio quando não reconhece', () => {
    expect(formatPhoneBr('sem telefone')).toBe('sem telefone');
    expect(formatPhoneBr('12345')).toBe('12345');
    expect(formatPhoneBr('+1 415 555 0100 22')).toBe('+1 415 555 0100 22');
  });

  it('vazio e nulo viram texto vazio', () => {
    expect(formatPhoneBr('')).toBe('');
    expect(formatPhoneBr(null)).toBe('');
    expect(formatPhoneBr(undefined)).toBe('');
  });
});

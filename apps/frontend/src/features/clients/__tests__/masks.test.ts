import { describe, it, expect } from 'vitest';
import { maskRg, maskCep } from '../utils/masks';

describe('maskRg', () => {
  it('formata RG completo', () => {
    expect(maskRg('488300356')).toBe('48.830.035-6');
  });
  it('aceita X como dígito verificador', () => {
    expect(maskRg('12345678x')).toBe('12.345.678-X');
  });
  it('formata progressivamente', () => {
    expect(maskRg('4883')).toBe('48.83');
    expect(maskRg('48')).toBe('48');
    expect(maskRg('48830035')).toBe('48.830.035');
  });
  it('limita a 9 caracteres e ignora lixo', () => {
    expect(maskRg('48.830.035-6999')).toBe('48.830.035-6');
    expect(maskRg('abc')).toBe('');
  });
});

describe('maskCep', () => {
  it('formata CEP completo', () => {
    expect(maskCep('06083290')).toBe('06083-290');
  });
  it('parcial e limite', () => {
    expect(maskCep('0608')).toBe('0608');
    expect(maskCep('06083-290999')).toBe('06083-290');
  });
});

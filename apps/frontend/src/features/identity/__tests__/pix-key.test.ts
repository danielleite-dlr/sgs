import { describe, it, expect } from 'vitest';
import {
  detectPixKeyType,
  maskPixKey,
  pixKeyError,
  toPixKeyPayload,
} from '../pix-key';

describe('detectPixKeyType', () => {
  it.each([
    ['12345678909', 'cpf'],
    ['11222333000181', 'cnpj'],
    ['ana@pix.com', 'email'],
    ['+5511987654321', 'phone'],
    ['123e4567-e89b-12d3-a456-426614174000', 'evp'],
    ['', null],
    [null, null],
    ['abc', null],
  ])('%j -> %j', (stored, expected) => {
    expect(detectPixKeyType(stored)).toBe(expected);
  });
});

describe('maskPixKey', () => {
  it.each([
    ['cpf', '123', '123'],
    ['cpf', '1234567', '123.456.7'],
    ['cpf', '12345678909', '123.456.789-09'],
    ['cpf', '1234567890999', '123.456.789-09'],
    ['cnpj', '11222', '11.222'],
    ['cnpj', '112223330001', '11.222.333/0001'],
    ['cnpj', '11222333000181', '11.222.333/0001-81'],
    ['phone', '11987654321', '(11) 98765-4321'],
    ['phone', '+5511987654321', '(11) 98765-4321'],
    ['email', 'Ana@Pix.com', 'Ana@Pix.com'],
  ] as const)('%s %j -> %j', (type, raw, expected) => {
    expect(maskPixKey(type, raw)).toBe(expected);
  });
});

describe('pixKeyError', () => {
  it('exige o tipo e a chave', () => {
    expect(pixKeyError(null, '123')).toBe('Selecione o tipo de chave Pix.');
    expect(pixKeyError('cpf', ' ')).toBe('Campo obrigatório.');
  });

  it('valida CPF e CNPJ pelos dígitos verificadores', () => {
    expect(pixKeyError('cpf', '123.456.789-09')).toBeNull();
    expect(pixKeyError('cpf', '123.456.789-00')).toBe('CPF inválido.');
    expect(pixKeyError('cpf', '111.111.111-11')).toBe('CPF inválido.');
    expect(pixKeyError('cnpj', '11.222.333/0001-81')).toBeNull();
    expect(pixKeyError('cnpj', '11.222.333/0001-80')).toBe('CNPJ inválido.');
  });

  it('valida e-mail, celular e chave aleatória', () => {
    expect(pixKeyError('email', 'ana@pix.com')).toBeNull();
    expect(pixKeyError('email', 'ana@')).toBe('E-mail inválido.');
    expect(pixKeyError('phone', '(11) 98765-4321')).toBeNull();
    expect(pixKeyError('phone', '(11) 8765-432')).toBe('Telefone inválido.');
    expect(pixKeyError('evp', '123e4567-e89b-12d3-a456-426614174000')).toBeNull();
    expect(pixKeyError('evp', '123')).toMatch(/Chave aleatória inválida/);
  });
});

describe('toPixKeyPayload', () => {
  it('envia o formato canônico que o backend deduz sem ambiguidade', () => {
    expect(toPixKeyPayload('cpf', '123.456.789-09')).toBe('12345678909');
    expect(toPixKeyPayload('cnpj', '11.222.333/0001-81')).toBe('11222333000181');
    expect(toPixKeyPayload('phone', '(11) 98765-4321')).toBe('+5511987654321');
    expect(toPixKeyPayload('email', ' Ana@Pix.com ')).toBe('ana@pix.com');
    expect(
      toPixKeyPayload('evp', '123E4567-E89B-12D3-A456-426614174000'),
    ).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('o tipo deduzido do valor salvo é o mesmo que foi escolhido', () => {
    for (const [type, raw] of [
      ['cpf', '123.456.789-09'],
      ['cnpj', '11.222.333/0001-81'],
      ['phone', '(11) 98765-4321'],
      ['email', 'ana@pix.com'],
      ['evp', '123e4567-e89b-12d3-a456-426614174000'],
    ] as const) {
      expect(detectPixKeyType(toPixKeyPayload(type, raw))).toBe(type);
    }
  });
});

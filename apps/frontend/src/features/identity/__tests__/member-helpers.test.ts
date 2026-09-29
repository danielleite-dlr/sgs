import { describe, it, expect } from 'vitest';
import {
  PASSWORD_ALPHABET,
  generateTemporaryPassword,
} from '../temporary-password';
import { isValidPixKey, maskBrPhone, normalizeBrPhone } from '../member-validation';

describe('generateTemporaryPassword', () => {
  it('gera 14 caracteres só do alfabeto sem ambíguos', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toHaveLength(14);
    for (const ch of pwd) expect(PASSWORD_ALPHABET).toContain(ch);
    expect(pwd).not.toMatch(/[Il0O1]/);
  });

  it('respeita o tamanho e gera valores diferentes', () => {
    expect(generateTemporaryPassword(20)).toHaveLength(20);
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});

describe('normalizeBrPhone', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['+55 11 98765-4321', '+5511987654321'],
    ['1133334444', '+551133334444'],
    ['5511987654321', '+5511987654321'],
  ])('normaliza %s', (raw, expected) => {
    expect(normalizeBrPhone(raw)).toBe(expected);
  });

  it.each(['123', '(00) 98765-4321', '11 88765-432', ''])('rejeita %s', (raw) => {
    expect(normalizeBrPhone(raw)).toBeNull();
  });
});

describe('isValidPixKey', () => {
  it.each([
    '123.456.789-09',
    '12.345.678/0001-95',
    'Foo@Bar.com',
    '+55 11 98765-4321',
    '123e4567-e89b-42d3-a456-426614174000',
  ])('aceita %s', (raw) => {
    expect(isValidPixKey(raw)).toBe(true);
  });

  it.each(['abc', '', '   ', '+55 123', '1234567'])('rejeita %s', (raw) => {
    expect(isValidPixKey(raw)).toBe(false);
  });
});

describe('maskBrPhone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['119876', '(11) 9876'],
    ['1198765', '(11) 9876-5'],
    ['1134567890', '(11) 3456-7890'],
    ['11987654321', '(11) 98765-4321'],
    ['119876543219999', '(11) 98765-4321'],
    ['(11) 98765-4321', '(11) 98765-4321'],
    ['+5511987654321', '(11) 98765-4321'],
    ['+551134567890', '(11) 3456-7890'],
    ['5511987654', '(55) 1198-7654'],
  ])('mascara %j como %j', (raw, expected) => {
    expect(maskBrPhone(raw)).toBe(expected);
  });

  it('o valor mascarado continua normalizavel para E.164', () => {
    expect(normalizeBrPhone(maskBrPhone('11987654321'))).toBe('+5511987654321');
  });
});

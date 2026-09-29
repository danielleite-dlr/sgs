import { normalizeBrPhone, normalizePixKey } from './member-contact';

describe('normalizeBrPhone', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['+55 11 98765-4321', '+5511987654321'],
    ['1133334444', '+551133334444'],
    ['5511987654321', '+5511987654321'],
  ])('normaliza %s', (raw, expected) => {
    expect(normalizeBrPhone(raw)).toBe(expected);
  });

  it.each(['123', '(00) 98765-4321', '11 88765-432', '', 'abc'])(
    'rejeita %s',
    (raw) => {
      expect(normalizeBrPhone(raw)).toBeNull();
    },
  );
});

describe('normalizePixKey', () => {
  it('CPF com máscara', () => {
    expect(normalizePixKey('123.456.789-09')).toEqual({
      type: 'cpf',
      value: '12345678909',
    });
  });

  it('CNPJ com máscara', () => {
    expect(normalizePixKey('12.345.678/0001-95')).toEqual({
      type: 'cnpj',
      value: '12345678000195',
    });
  });

  it('e-mail em minúsculo', () => {
    expect(normalizePixKey('Foo@Bar.com')).toEqual({
      type: 'email',
      value: 'foo@bar.com',
    });
  });

  it('telefone com +', () => {
    expect(normalizePixKey('+55 11 98765-4321')).toEqual({
      type: 'phone',
      value: '+5511987654321',
    });
  });

  it('chave aleatória (EVP) em minúsculo', () => {
    expect(
      normalizePixKey('123E4567-E89B-42D3-A456-426614174000'),
    ).toEqual({ type: 'evp', value: '123e4567-e89b-42d3-a456-426614174000' });
  });

  it.each(['abc', '', '   ', '+55 123', '1234567'])('rejeita %s', (raw) => {
    expect(normalizePixKey(raw)).toBeNull();
  });
});

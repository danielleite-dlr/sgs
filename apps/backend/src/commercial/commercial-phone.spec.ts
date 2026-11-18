import { phoneDigits, phoneKey, samePhone } from './commercial-phone';

describe('phoneDigits', () => {
  it('remove a máscara', () => {
    expect(phoneDigits('(11) 99999-0000')).toBe('11999990000');
  });
  it('remove o +55 com espaços', () => {
    expect(phoneDigits('+55 11 99999-0000')).toBe('11999990000');
  });
  it('remove o 55 de número só com dígitos', () => {
    expect(phoneDigits('5511999990000')).toBe('11999990000');
  });
  it('aceita número fixo de 10 dígitos', () => {
    expect(phoneDigits('(11) 3333-4444')).toBe('1133334444');
  });
  it('vazio vira null', () => {
    expect(phoneDigits('')).toBeNull();
    expect(phoneDigits(null)).toBeNull();
  });
  it('sem dígitos vira null', () => {
    expect(phoneDigits('abc')).toBeNull();
  });
  it('menos de 10 dígitos vira null', () => {
    expect(phoneDigits('123')).toBeNull();
  });
});

describe('phoneKey', () => {
  it('DDD + últimos 8 dígitos, com 9º dígito', () => {
    expect(phoneKey('11999990000')).toBe('1199990000');
  });
  it('mesma chave sem o 9º dígito', () => {
    expect(phoneKey('1199990000')).toBe('1199990000');
  });
  it('inválido vira null', () => {
    expect(phoneKey('12')).toBeNull();
  });
});

describe('samePhone', () => {
  it('com e sem 9º dígito são o mesmo número', () => {
    expect(samePhone('(11) 99999-0000', '11 9999-0000')).toBe(true);
  });
  it('DDD diferente não é o mesmo número', () => {
    expect(samePhone('(11) 99999-0000', '(21) 99999-0000')).toBe(false);
  });
  it('null nunca é igual', () => {
    expect(samePhone(null, '11999990000')).toBe(false);
    expect(samePhone(null, null)).toBe(false);
  });
  it('+55 e máscara equivalem', () => {
    expect(samePhone('+55 (11) 99999-0000', '11999990000')).toBe(true);
  });
});

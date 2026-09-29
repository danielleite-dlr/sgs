import { PASSWORD_ALPHABET, generatePassword } from './temporary-password';

describe('generatePassword', () => {
  it('gera 14 caracteres por padrão, só do alfabeto sem ambíguos', () => {
    const pwd = generatePassword();
    expect(pwd).toHaveLength(14);
    for (const ch of pwd) {
      expect(PASSWORD_ALPHABET).toContain(ch);
    }
    expect(pwd).not.toMatch(/[Il0O1]/);
  });

  it('respeita o tamanho pedido', () => {
    expect(generatePassword(20)).toHaveLength(20);
  });

  it('gera valores diferentes', () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

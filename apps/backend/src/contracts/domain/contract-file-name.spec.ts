import { contractFileName } from './contract-file-name';

describe('contractFileName', () => {
  it('noiva com pacote', () => {
    expect(contractFileName('noiva', 'Maria José da Silva', '2026-12-20', 'PACOTE GLAM')).toBe(
      'NOIVA_MARIA_JOSE_DA_SILVA_20-12-2026_PACOTE_GLAM.pdf',
    );
  });
  it('debutante sem pacote', () => {
    expect(contractFileName('debutante', 'Ana Luíza', '2027-03-05', null)).toBe(
      'DEBUTANTE_ANA_LUIZA_05-03-2027_SEM_PACOTE.pdf',
    );
  });
  it('remove caracteres inválidos e colapsa underscores', () => {
    expect(contractFileName('noiva', "  Maria  -- D'Ávila!! ", '2026-12-20', 'Spa dos 15')).toBe(
      'NOIVA_MARIA_DAVILA_20-12-2026_SPA_DOS_15.pdf',
    );
  });
  it('nome vazio vira SEM_NOME', () => {
    expect(contractFileName('noiva', '   ', '2026-12-20', 'X')).toBe('NOIVA_SEM_NOME_20-12-2026_X.pdf');
    expect(contractFileName('noiva', '!!!', '2026-12-20', '')).toBe('NOIVA_SEM_NOME_20-12-2026_SEM_PACOTE.pdf');
  });
});

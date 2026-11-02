import { formatComandaCode } from './comanda-code';
import { prorateUnits } from './comanda-items';

describe('prorateUnits', () => {
  it('rateia proporcional ao preço cheio', () => {
    expect(prorateUnits([10000, 5000], 13500)).toEqual([9000, 4500]);
  });

  it('soma exata com o resto no último', () => {
    const parts = prorateUnits([10000, 10000, 10000], 10000);
    expect(parts).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('um único item recebe o preço do pacote', () => {
    expect(prorateUnits([8000], 6500)).toEqual([6500]);
  });

  it('pacote mais caro que a soma também fecha exato', () => {
    const parts = prorateUnits([3333, 3333, 3334], 12001);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(12001);
  });
});

describe('formatComandaCode', () => {
  it('completa com zeros até 3 dígitos', () => {
    expect(formatComandaCode(2026, 7)).toBe('C-2026-007');
  });

  it('não corta números maiores', () => {
    expect(formatComandaCode(2026, 1234)).toBe('C-2026-1234');
  });
});

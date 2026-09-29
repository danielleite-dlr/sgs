import { memberServesCategory } from './member-categories';

// Cabelo > Penteados > Noiva ; Maquiagem
const parents = new Map<string, string | null>([
  ['cabelo', null],
  ['penteados', 'cabelo'],
  ['noiva', 'penteados'],
  ['maquiagem', null],
]);

describe('memberServesCategory', () => {
  it('sem vínculos atende tudo', () => {
    expect(memberServesCategory([], 'penteados', parents)).toBe(true);
  });

  it('categoria descendente da vinculada é atendida', () => {
    expect(memberServesCategory(['cabelo'], 'noiva', parents)).toBe(true);
  });

  it('a própria categoria vinculada é atendida', () => {
    expect(memberServesCategory(['cabelo'], 'cabelo', parents)).toBe(true);
  });

  it('categoria de outra árvore não é atendida', () => {
    expect(memberServesCategory(['maquiagem'], 'penteados', parents)).toBe(false);
  });

  it('ancestral da vinculada não conta', () => {
    expect(memberServesCategory(['penteados'], 'cabelo', parents)).toBe(false);
  });

  it('ciclo acidental em parentId não entra em loop', () => {
    const cyclic = new Map<string, string | null>([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    expect(memberServesCategory(['maquiagem'], 'a', cyclic)).toBe(false);
  });

  it('categoria desconhecida não é atendida por quem tem vínculos', () => {
    expect(memberServesCategory(['cabelo'], 'ghost', parents)).toBe(false);
  });
});

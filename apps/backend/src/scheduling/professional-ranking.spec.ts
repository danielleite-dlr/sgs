import {
  compareCandidates,
  orderForPicker,
  pickBest,
  rankProfessionals,
  rotationRanks,
  type RankCandidate,
} from './professional-ranking';

function c(id: string, over: Partial<RankCandidate> = {}): RankCandidate {
  return {
    id,
    isFixed: false,
    servesBridal: false,
    dayMinutes: 0,
    lastAssignedAt: null,
    free: true,
    ...over,
  };
}

const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);
const normal = { bridal: false };
const bridal = { bridal: true };

describe('rankProfessionals', () => {
  it('fixa vem antes de não fixa mesmo com mais minutos (D-18)', () => {
    const list = [
      c('a', { isFixed: false, dayMinutes: 0 }),
      c('b', { isFixed: true, dayMinutes: 600 }),
    ];
    expect(ids(rankProfessionals(list, normal))).toEqual(['b', 'a']);
  });

  it('com o mesmo tipo, menos minutos no dia vence (D-10)', () => {
    const list = [
      c('b', { isFixed: true, dayMinutes: 120 }),
      c('a', { isFixed: true, dayMinutes: 60 }),
    ];
    expect(ids(rankProfessionals(list, normal))).toEqual(['a', 'b']);
  });

  it('empate de minutos vai para quem recebeu há mais tempo (D-11)', () => {
    const list = [
      c('a', { isFixed: true, dayMinutes: 60, lastAssignedAt: 2000 }),
      c('b', { isFixed: true, dayMinutes: 60, lastAssignedAt: 1000 }),
    ];
    expect(ids(rankProfessionals(list, normal))).toEqual(['b', 'a']);
  });

  it('quem nunca recebeu vai primeiro', () => {
    const list = [
      c('b', { isFixed: true, dayMinutes: 60, lastAssignedAt: 1000 }),
      c('a', { isFixed: true, dayMinutes: 60, lastAssignedAt: null }),
    ];
    expect(ids(rankProfessionals(list, normal))).toEqual(['a', 'b']);
  });

  it('empate total desempata pelo id', () => {
    expect(ids(rankProfessionals([c('b'), c('a')], normal))).toEqual(['a', 'b']);
  });

  it('candidata ocupada some da saída; só ocupadas dá [] e pickBest null', () => {
    const list = [c('x', { free: false, isFixed: true }), c('y')];
    expect(ids(rankProfessionals(list, normal))).toEqual(['y']);
    const busy = [c('x', { free: false }), c('z', { free: false })];
    expect(rankProfessionals(busy, normal)).toEqual([]);
    expect(pickBest(busy, normal)).toBeNull();
  });

  it('bridal: só quem atende noiva/debutante aparece (D-02)', () => {
    const list = [
      c('a', { servesBridal: false, isFixed: true }),
      c('b', { servesBridal: true }),
    ];
    expect(ids(rankProfessionals(list, bridal))).toEqual(['b']);
  });

  it('bridal sem ninguém que atenda noiva devolve [] sem fallback (D-04)', () => {
    const list = [c('a', { isFixed: true }), c('b')];
    expect(rankProfessionals(list, bridal)).toEqual([]);
    expect(pickBest(list, bridal)).toBeNull();
  });

  it('sem bridal, servesBridal não importa para a ordem', () => {
    const list = [c('a', { servesBridal: true }), c('b', { servesBridal: false })];
    expect(ids(rankProfessionals(list, normal))).toEqual(['a', 'b']);
    const inv = [c('a', { servesBridal: false }), c('b', { servesBridal: true })];
    expect(ids(rankProfessionals(inv, normal))).toEqual(['a', 'b']);
  });

  it('pickBest devolve a primeira do ranking', () => {
    const list = [c('a'), c('b', { isFixed: true })];
    expect(pickBest(list, normal)?.id).toBe('b');
  });

  it('é determinístico para qualquer ordem de entrada e não muta a entrada', () => {
    const base = [
      c('f1', { isFixed: true, dayMinutes: 60, lastAssignedAt: 10 }),
      c('f2', { isFixed: true, dayMinutes: 60, lastAssignedAt: null }),
      c('f3', { isFixed: true, dayMinutes: 30, lastAssignedAt: 5 }),
      c('n1', { dayMinutes: 0 }),
      c('n2', { dayMinutes: 0, lastAssignedAt: 3 }),
      c('n3', { dayMinutes: 90, free: false }),
    ];
    const snapshot = base.map((x) => ({ ...x }));
    const expected = ids(rankProfessionals(base, normal));
    expect(expected).toEqual(['f3', 'f2', 'f1', 'n1', 'n2']);
    expect(base).toEqual(snapshot);

    const perms = [
      [...base].reverse(),
      [base[2], base[0], base[4], base[1], base[5], base[3]],
      [base[4], base[3], base[5], base[2], base[1], base[0]],
      [base[1], base[5], base[0], base[3], base[2], base[4]],
    ];
    for (const p of perms) {
      expect(ids(rankProfessionals(p, normal))).toEqual(expected);
    }
    expect(ids(rankProfessionals(base, normal))).toEqual(expected);
  });

  it('preserva o tipo da candidata com campos extras', () => {
    const list = [{ ...c('a'), slotEnd: 'x' }];
    const out = rankProfessionals(list, normal);
    expect(out[0].slotEnd).toBe('x');
  });
});

describe('compareCandidates', () => {
  it('nunca retorna NaN com lastAssignedAt null dos dois lados', () => {
    const r = compareCandidates(c('a'), c('b'));
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(-1);
    expect(compareCandidates(c('a'), c('a'))).toBe(0);
  });
});

describe('orderForPicker', () => {
  it('fixas primeiro e depois por nome', () => {
    const list = [
      { id: '1', isFixed: false, displayName: 'Ana' },
      { id: '2', isFixed: true, displayName: 'Zélia' },
      { id: '3', isFixed: true, displayName: 'Bia' },
    ];
    expect(ids(orderForPicker(list))).toEqual(['3', '2', '1']);
  });

  it('ordena acentos em pt-BR e desempata por id', () => {
    const list = [
      { id: '1', isFixed: false, displayName: 'Fabi' },
      { id: '2', isFixed: false, displayName: 'Élida' },
      { id: '4', isFixed: false, displayName: 'Gil' },
      { id: '3', isFixed: false, displayName: 'Gil' },
    ];
    expect(ids(orderForPicker(list))).toEqual(['2', '1', '3', '4']);
  });
});

describe('rotationRanks', () => {
  it('null primeiro, depois menor valor', () => {
    const r = rotationRanks([
      { id: 'a', lastAssignedAt: 5 },
      { id: 'b', lastAssignedAt: null },
      { id: 'c', lastAssignedAt: 1 },
    ]);
    expect(Object.fromEntries(r)).toEqual({ b: 0, c: 1, a: 2 });
  });

  it('desempata por id', () => {
    const r = rotationRanks([
      { id: 'b', lastAssignedAt: null },
      { id: 'a', lastAssignedAt: null },
    ]);
    expect(Object.fromEntries(r)).toEqual({ a: 0, b: 1 });
  });
});

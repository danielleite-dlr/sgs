import { ComandaError } from './comanda-items';
import { localDate, resolveCloseInstant } from './comanda-close-date';

const TZ = 'America/Sao_Paulo';
// 24/11/2026 14:03 em São Paulo (UTC-3)
const NOW = new Date('2026-11-24T17:03:00.000Z');

describe('resolveCloseInstant (261124-k9b)', () => {
  it('sem data fecha agora', () => {
    expect(resolveCloseInstant(undefined, TZ, NOW)).toEqual({ at: NOW, backdated: false });
    expect(resolveCloseInstant(null, TZ, NOW)).toEqual({ at: NOW, backdated: false });
  });

  it('data de hoje fecha agora', () => {
    expect(resolveCloseInstant('2026-11-24', TZ, NOW)).toEqual({ at: NOW, backdated: false });
  });

  it('data passada vira 12:00 locais daquele dia', () => {
    const r = resolveCloseInstant('2026-11-20', TZ, NOW);
    expect(r.backdated).toBe(true);
    expect(r.at.toISOString()).toBe('2026-11-20T15:00:00.000Z');
    expect(localDate(r.at, TZ)).toBe('2026-11-20');
  });

  it('respeita o fuso da org', () => {
    const r = resolveCloseInstant('2026-11-20', 'America/Manaus', NOW);
    expect(r.at.toISOString()).toBe('2026-11-20T16:00:00.000Z');
  });

  it('hoje é o dia local, não o UTC', () => {
    // 25/11 01:00 UTC = 24/11 22:00 em São Paulo
    const late = new Date('2026-11-25T01:00:00.000Z');
    expect(resolveCloseInstant('2026-11-24', TZ, late)).toEqual({ at: late, backdated: false });
    expect(() => resolveCloseInstant('2026-11-25', TZ, late)).toThrow(ComandaError);
  });

  it('recusa data futura', () => {
    expect(() => resolveCloseInstant('2026-11-25', TZ, NOW)).toThrow(
      'A data do fechamento não pode ser futura.',
    );
  });

  it.each(['20/11/2026', '2026-02-30', '2026-13-01', 'abc'])('recusa data inválida %s', (v) => {
    try {
      resolveCloseInstant(v, TZ, NOW);
      throw new Error('não lançou');
    } catch (e) {
      expect(e).toBeInstanceOf(ComandaError);
      expect((e as ComandaError).code).toBe('INVALID_CLOSE_DATE');
    }
  });
});

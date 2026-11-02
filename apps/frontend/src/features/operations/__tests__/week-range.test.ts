import { describe, expect, it } from 'vitest';
import { weekRange } from '../lib/week-range';

describe('weekRange', () => {
  it('quarta -> semana começa na segunda', () => {
    const w = weekRange(new Date(2026, 10, 4));
    expect(w.days).toHaveLength(7);
    expect(w.days[0]).toEqual(new Date(2026, 10, 2));
    expect(w.days[6]).toEqual(new Date(2026, 10, 8));
    expect(w.startsAt).toBe(new Date(2026, 10, 2).toISOString());
    expect(w.endsAt).toBe(new Date(2026, 10, 9).toISOString());
  });
  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(weekRange(new Date(2026, 10, 8)).days[0]).toEqual(new Date(2026, 10, 2));
  });
  it('segunda é o primeiro dia', () => {
    expect(weekRange(new Date(2026, 10, 2, 15, 30)).days[0]).toEqual(new Date(2026, 10, 2));
  });
});

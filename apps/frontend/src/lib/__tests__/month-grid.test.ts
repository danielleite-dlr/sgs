import { describe, expect, it } from 'vitest';
import {
  WEEKDAY_INITIALS,
  dayLabel,
  monthGrid,
  monthTitle,
  shiftMonth,
  toIsoLocal,
} from '../month-grid';

describe('month-grid', () => {
  it('novembro/2026 começa no domingo e tem 42 células', () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ iso: '2026-11-01', day: 1, inMonth: true });
    expect(g[41].inMonth).toBe(false);
  });

  it('fevereiro/2026 e bissexto 2028', () => {
    expect(monthGrid(2026, 1)[0].iso).toBe('2026-02-01');
    const c = monthGrid(2028, 1).find((x) => x.iso === '2028-02-29');
    expect(c?.inMonth).toBe(true);
  });

  it('outubro/2026 começa numa quinta: preenche com setembro', () => {
    const g = monthGrid(2026, 9);
    expect(g[0]).toMatchObject({ iso: '2026-09-27', inMonth: false });
    expect(g[4].iso).toBe('2026-10-01');
  });

  it('toIsoLocal não desliza por UTC', () => {
    expect(toIsoLocal(new Date(2026, 10, 27, 23, 30))).toBe('2026-11-27');
  });

  it('shiftMonth vira o ano', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('títulos em pt-BR', () => {
    expect(monthTitle(2026, 10)).toBe('Novembro de 2026');
    expect(dayLabel('2026-11-27')).toBe('27 de novembro de 2026');
    expect([...WEEKDAY_INITIALS]).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
  });
});

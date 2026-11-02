import { describe, expect, it } from 'vitest';
import {
  GRID_END_HOUR,
  GRID_SLOTS,
  GRID_START_HOUR,
  minutesFromGridStart,
  shiftStartBySlots,
  slotsFromDelta,
} from '../lib/schedule-grid';

describe('schedule-grid', () => {
  it('faixa fixa 07h-22h', () => {
    expect(GRID_START_HOUR).toBe(7);
    expect(GRID_END_HOUR).toBe(22);
    expect(GRID_SLOTS).toHaveLength(30);
    expect(GRID_SLOTS[0].label).toBe('07:00');
    expect(GRID_SLOTS[29].label).toBe('21:30');
  });
  it('minutesFromGridStart', () => {
    expect(minutesFromGridStart(new Date(2026, 10, 4, 9, 30))).toBe(150);
  });
  it('shiftStartBySlots', () => {
    const base = new Date(2026, 10, 4, 10, 0);
    expect(shiftStartBySlots(base, 3)).toEqual(new Date(2026, 10, 4, 11, 30));
    expect(shiftStartBySlots(base, -2)).toEqual(new Date(2026, 10, 4, 9, 0));
  });
  it('slotsFromDelta', () => {
    expect(slotsFromDelta(95, 48)).toBe(2);
    expect(slotsFromDelta(-20, 48)).toBe(0);
    expect(Object.is(slotsFromDelta(-20, 48), 0)).toBe(true);
  });
});

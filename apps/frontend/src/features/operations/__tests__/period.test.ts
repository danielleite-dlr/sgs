import { describe, expect, it } from 'vitest';
import { addDays, customPeriod, resolvePeriod, todayInTimeZone } from '../lib/period';

const TZ = 'America/Sao_Paulo';
const NOW = new Date('2026-11-04T02:30:00Z'); // 03/11 23:30 local

describe('period', () => {
  it('todayInTimeZone usa o fuso da org', () => {
    expect(todayInTimeZone(TZ, NOW)).toBe('2026-11-03');
  });
  it('hoje', () => {
    expect(resolvePeriod('today', TZ, NOW)).toEqual({ from: '2026-11-03', to: '2026-11-04' });
  });
  it('ontem', () => {
    expect(resolvePeriod('yesterday', TZ, NOW)).toEqual({ from: '2026-11-02', to: '2026-11-03' });
  });
  it('esta semana (segunda a segunda)', () => {
    expect(resolvePeriod('thisWeek', TZ, NOW)).toEqual({ from: '2026-11-02', to: '2026-11-09' });
  });
  it('esta semana num domingo', () => {
    expect(resolvePeriod('thisWeek', TZ, new Date('2026-11-08T15:00:00Z'))).toEqual({
      from: '2026-11-02',
      to: '2026-11-09',
    });
  });
  it('mês atual', () => {
    expect(resolvePeriod('thisMonth', TZ, NOW)).toEqual({ from: '2026-11-01', to: '2026-12-01' });
  });
  it('mês anterior', () => {
    expect(resolvePeriod('lastMonth', TZ, NOW)).toEqual({ from: '2026-10-01', to: '2026-11-01' });
  });
  it('mês anterior em janeiro', () => {
    expect(resolvePeriod('lastMonth', TZ, new Date('2027-01-10T12:00:00Z'))).toEqual({
      from: '2026-12-01',
      to: '2027-01-01',
    });
  });
  it('período customizado', () => {
    expect(customPeriod('2026-11-10', '2026-11-12')).toEqual({ from: '2026-11-10', to: '2026-11-13' });
    expect(customPeriod('2026-11-12', '2026-11-10')).toEqual({ from: '2026-11-10', to: '2026-11-13' });
  });
  it('addDays atravessa mês/ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

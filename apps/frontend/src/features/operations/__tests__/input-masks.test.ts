import { describe, expect, it } from 'vitest';
import { brDateToIso, isoToBrDate, maskDateBR, maskTime } from '../lib/input-masks';

describe('input-masks', () => {
  it('maskTime', () => {
    expect(maskTime('0930')).toBe('09:30');
    expect(maskTime('12')).toBe('12');
    expect(maskTime('12a3')).toBe('12:3');
  });
  it('maskDateBR', () => {
    expect(maskDateBR('04112026')).toBe('04/11/2026');
    expect(maskDateBR('0411')).toBe('04/11');
  });
  it('brDateToIso', () => {
    expect(brDateToIso('04/11/2026')).toBe('2026-11-04');
    expect(brDateToIso('31/02/2026')).toBeNull();
    expect(brDateToIso('04/11')).toBeNull();
  });
  it('isoToBrDate', () => {
    expect(isoToBrDate('2026-11-04')).toBe('04/11/2026');
  });
});

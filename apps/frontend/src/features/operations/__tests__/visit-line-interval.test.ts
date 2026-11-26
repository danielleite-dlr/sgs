import { describe, expect, it } from 'vitest';
import { lineInterval } from '../lib/visit-form';

describe('lineInterval', () => {
  it('converte data BR + hora + duração em ISO', () => {
    const start = new Date(2026, 10, 26, 9, 30);
    expect(lineInterval('26/11/2026', '09:30', 60)).toEqual({
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
    });
  });

  it('retorna null para entradas inválidas', () => {
    expect(lineInterval('', '09:30', 60)).toBeNull();
    expect(lineInterval('26/11/2026', '25:00', 60)).toBeNull();
    expect(lineInterval('26/11/2026', '09:30', 0)).toBeNull();
    expect(lineInterval('26/11/2026', '09:30', NaN)).toBeNull();
  });
});

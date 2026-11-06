import { describe, expect, it } from 'vitest';
import { formatLongDate } from '../format-date-long';

describe('formatLongDate', () => {
  it('escreve a data por extenso com a primeira letra maiúscula', () => {
    expect(formatLongDate(new Date(2026, 10, 12, 12, 0))).toBe(
      'Quinta-feira, 12 de novembro de 2026',
    );
  });

  it('usa o fuso de São Paulo', () => {
    // 02:00 UTC do dia 13 ainda é dia 12 em São Paulo (UTC-3).
    expect(formatLongDate(new Date(Date.UTC(2026, 10, 13, 2, 0)))).toBe(
      'Quinta-feira, 12 de novembro de 2026',
    );
  });
});

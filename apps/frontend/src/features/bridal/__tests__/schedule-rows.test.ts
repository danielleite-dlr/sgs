import { describe, expect, it } from 'vitest';
import type { AiScheduleSuggestion } from '../api/ai-schedule.api';
import {
  findRowConflicts,
  rowsToScheduleItems,
  suggestionToRows,
  type ScheduleRow,
} from '../lib/schedule-rows';

const suggestion: AiScheduleSuggestion = {
  id: 's1',
  source: 'heuristic',
  model: null,
  cached: false,
  fallbackReason: 'NO_API_KEY',
  unscheduled: [],
  warnings: [],
  dayStart: '2026-12-05T10:00:00.000Z',
  dayEnd: '2026-12-05T22:00:00.000Z',
  readyBy: '2026-12-05T17:00:00.000Z',
  items: [
    {
      personRef: 'p1',
      groupMemberId: 'm1',
      personLabel: 'Noiva',
      role: 'bride',
      serviceId: 'sv1',
      serviceName: 'Maquiagem',
      professionalId: 'pr1',
      professionalName: 'Ana',
      startsAt: '2026-12-05T11:00:00.000Z', // 08:00 em São Paulo
      endsAt: '2026-12-05T12:30:00.000Z',
    },
  ],
};

function row(p: Partial<ScheduleRow>): ScheduleRow {
  return {
    key: 'k',
    groupMemberId: 'm1',
    personLabel: 'X',
    role: 'bride',
    serviceId: 's',
    serviceName: 'S',
    professionalId: 'pr1',
    date: '2026-12-05',
    start: '08:00',
    end: '09:00',
    ...p,
  };
}

describe('schedule-rows', () => {
  it('converte sugestão em linhas no fuso de São Paulo', () => {
    const [r] = suggestionToRows(suggestion);
    expect(r).toMatchObject({
      date: '2026-12-05',
      start: '08:00',
      end: '09:30',
      professionalId: 'pr1',
    });
  });

  it('volta para itens ISO sem perder ids', () => {
    const items = rowsToScheduleItems(suggestionToRows(suggestion));
    expect(items).toEqual([
      {
        groupMemberId: 'm1',
        serviceId: 'sv1',
        professionalId: 'pr1',
        startsAt: '2026-12-05T11:00:00.000Z',
        endsAt: '2026-12-05T12:30:00.000Z',
      },
    ]);
  });

  it('aponta sobreposição do mesmo profissional e da mesma pessoa', () => {
    const rows = [
      row({ groupMemberId: 'a', professionalId: 'p1', start: '08:00', end: '09:00' }),
      row({ groupMemberId: 'b', professionalId: 'p1', start: '08:30', end: '09:30' }),
      row({ groupMemberId: 'a', professionalId: 'p2', start: '08:45', end: '09:15' }),
      row({ groupMemberId: 'c', professionalId: 'p3', start: '08:00', end: '09:00' }),
    ];
    const c = findRowConflicts(rows);
    expect(c.get(0)).toEqual([1, 2]);
    expect(c.get(1)).toEqual([0]);
    expect(c.has(3)).toBe(false);
  });

  it('horários encostados não conflitam', () => {
    const c = findRowConflicts([row({ end: '09:00' }), row({ start: '09:00', end: '10:00' })]);
    expect(c.size).toBe(0);
  });
});

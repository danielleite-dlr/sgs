import { describe, it, expect } from 'vitest';
import {
  agendaHrefFromComanda,
  comandaHrefFromAgenda,
  parseAgendaDate,
  parseAgendaView,
  toAgendaDateParam,
} from '../lib/agenda-link';

describe('agenda-link', () => {
  it('formata a data local com zeros a esquerda', () => {
    expect(toAgendaDateParam(new Date(2026, 10, 4, 23, 30))).toBe('2026-11-04');
    expect(toAgendaDateParam(new Date(2026, 0, 9, 0, 5))).toBe('2026-01-09');
  });

  it('parseia data valida como Date local', () => {
    const d = parseAgendaDate('2026-11-04')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 4]);
    expect(d.getHours()).toBe(0);
  });

  it.each([null, '', '2026-13-01', '2026-02-30', '04/11/2026', '2026-11-4', 'abc'])(
    'rejeita data invalida %s',
    (value) => {
      expect(parseAgendaDate(value)).toBeNull();
    },
  );

  it('parseia a visao', () => {
    expect(parseAgendaView('day')).toBe('day');
    expect(parseAgendaView('week')).toBe('week');
    expect(parseAgendaView(null)).toBeNull();
    expect(parseAgendaView('month')).toBeNull();
    expect(parseAgendaView('')).toBeNull();
  });

  it('monta o href da comanda', () => {
    expect(comandaHrefFromAgenda('cm1', new Date(2026, 10, 4), 'week')).toBe(
      '/comanda/cm1?agenda=2026-11-04&visao=week',
    );
  });

  it('monta o href da agenda a partir da comanda', () => {
    expect(agendaHrefFromComanda(new URLSearchParams('agenda=2026-11-04&visao=week'))).toBe(
      '/agenda?data=2026-11-04&visao=week',
    );
    expect(agendaHrefFromComanda(new URLSearchParams(''))).toBe('/agenda');
    expect(agendaHrefFromComanda(new URLSearchParams('agenda=2026-02-30&visao=week'))).toBe(
      '/agenda',
    );
    expect(agendaHrefFromComanda(new URLSearchParams('agenda=2026-11-04&visao=x'))).toBe(
      '/agenda?data=2026-11-04&visao=day',
    );
    expect(agendaHrefFromComanda(new URLSearchParams('agenda=2026-11-04'))).toBe(
      '/agenda?data=2026-11-04&visao=day',
    );
  });
});

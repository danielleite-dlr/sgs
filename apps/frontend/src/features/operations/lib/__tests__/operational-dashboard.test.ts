import { describe, expect, it } from 'vitest';
import type { AppointmentData } from '../../api/appointments.api';
import type { ComandasQueryResult } from '../../api/comandas.api';
import type { DashboardContract } from '../../api/dashboard.api';
import {
  contractsKpi,
  daysUntil,
  eventLabel,
  openComandaRows,
  paidPercent,
  pendingAppointments,
  summarizeAppointments,
  todayAppointmentsWindow,
  upcomingContracts,
} from '../operational-dashboard';

const appt = (id: string, status: string, startsAt: string, endsAt: string): AppointmentData =>
  ({
    id,
    status,
    startsAt,
    endsAt,
    client: { id: 'c', fullName: 'MARIA DA SILVA' },
    professional: { id: 'p', displayName: 'Ana Beatriz Lima' },
    service: { id: 's', name: 'Corte' },
  }) as AppointmentData;

const contract = (over: Partial<DashboardContract>): DashboardContract => ({
  id: 'k1',
  code: 'C-1',
  status: 'active',
  groupId: 'g',
  eventDate: '2026-11-28',
  eventKind: 'casamento',
  brideName: 'FERNANDA DINIZ',
  totalAmount: '1000.00',
  paid: '800.00',
  settled: false,
  ...over,
});

describe('todayAppointmentsWindow', () => {
  it('cobre o dia de São Paulo, com offset -03:00', () => {
    const w = todayAppointmentsWindow(new Date('2026-11-12T12:00:00-03:00'));
    expect(w).toEqual({
      startsAt: '2026-11-12T00:00:00-03:00',
      endsAt: '2026-11-13T00:00:00-03:00',
    });
  });
  it('23:30 em SP continua no dia 12', () => {
    const w = todayAppointmentsWindow(new Date('2026-11-12T23:30:00-03:00'));
    expect(w.startsAt).toBe('2026-11-12T00:00:00-03:00');
  });
});

describe('summarizeAppointments', () => {
  it('ignora cancelados e faltas', () => {
    const l = [
      appt('1', 'completed', '2026-11-12T13:00:00Z', '2026-11-12T14:00:00Z'),
      appt('2', 'in_progress', '2026-11-12T13:00:00Z', '2026-11-12T14:00:00Z'),
      appt('3', 'scheduled', '2026-11-12T13:00:00Z', '2026-11-12T14:00:00Z'),
      appt('4', 'confirmed', '2026-11-12T13:00:00Z', '2026-11-12T14:00:00Z'),
      appt('5', 'cancelled', '2026-11-12T13:00:00Z', '2026-11-12T14:00:00Z'),
      appt('6', 'no_show', '2026-11-12T13:00:00Z', '2026-11-12T14:00:00Z'),
    ];
    expect(summarizeAppointments(l)).toEqual({ total: 4, completed: 1, inProgress: 1, pending: 2 });
  });
  it('lista vazia zera tudo', () => {
    expect(summarizeAppointments([])).toEqual({ total: 0, completed: 0, inProgress: 0, pending: 0 });
  });
});

describe('pendingAppointments', () => {
  it('filtra, ordena e formata', () => {
    const rows = pendingAppointments([
      appt('b', 'scheduled', '2026-11-12T17:00:00Z', '2026-11-12T17:45:00Z'),
      appt('a', 'confirmed', '2026-11-12T13:30:00Z', '2026-11-12T14:30:00Z'),
      appt('c', 'completed', '2026-11-12T12:00:00Z', '2026-11-12T13:00:00Z'),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({
      time: '10:30',
      durationMinutes: 60,
      clientName: 'Maria da Silva',
      serviceName: 'Corte',
      professionalName: 'Ana B.',
      status: 'confirmed',
      statusLabel: 'Confirmado',
      spineColor: '#109868',
    });
    expect(rows[1].durationMinutes).toBe(45);
  });
});

describe('openComandaRows', () => {
  it('só abertas, mais recentes primeiro', () => {
    const mk = (id: string, status: string, openedAt: string) => ({
      id,
      code: `C-${id}`,
      status,
      openedAt,
      total: '50.00',
      client: { id: 'c', fullName: 'ANA SOUZA', phone: null },
      items: [
        { name: 'Corte', professional: { id: 'p1', displayName: 'Ana Beatriz Lima' } },
        { name: 'Escova', professional: { id: 'p1', displayName: 'Ana Beatriz Lima' } },
        { name: 'Gel', professional: null },
      ],
    });
    const data = [
      mk('1', 'open', '2026-11-10T10:00:00Z'),
      mk('2', 'closed', '2026-11-12T10:00:00Z'),
      mk('3', 'open', '2026-11-12T09:00:00Z'),
    ] as unknown as ComandasQueryResult['comandas'];
    const rows = openComandaRows(data);
    expect(rows.map((r) => r.id)).toEqual(['3', '1']);
    expect(rows[0]).toMatchObject({
      code: 'C-3',
      clientName: 'Ana Souza',
      professionals: ['Ana B.'],
      itemsLabel: 'Corte + Escova + Gel',
      total: '50.00',
      href: '/comanda/3',
    });
  });
});

describe('contratos', () => {
  const hoje = '2026-11-12'; // quinta; semana 09/11 a 15/11
  it('contractsKpi conta mês e semana só de ativos/aguardando', () => {
    const l = [
      contract({ id: '1', eventDate: '2026-11-14' }),
      contract({ id: '2', eventDate: '2026-11-28', status: 'awaiting_acceptance' }),
      contract({ id: '3', eventDate: '2026-11-15', status: 'cancelled' }),
      contract({ id: '4', eventDate: '2026-12-02' }),
      contract({ id: '5', eventDate: '2026-11-16' }),
    ];
    expect(contractsKpi(l, hoje)).toEqual({ month: 3, week: 1 });
  });
  it('upcomingContracts ordena por data, descarta passados e limita', () => {
    const l = [
      contract({ id: 'a', eventDate: '2026-12-05' }),
      contract({ id: 'b', eventDate: '2026-11-10' }),
      contract({ id: 'c', eventDate: '2026-11-28' }),
      contract({ id: 'd', eventDate: '2026-11-12', eventKind: 'debutante' }),
    ];
    const r = upcomingContracts(l, hoje, 2);
    expect(r.map((c) => c.id)).toEqual(['d', 'c']);
    expect(r[0]).toMatchObject({ daysToEvent: 0, href: '/contratos/d', label: 'Festa hoje' });
    expect(r[1]).toMatchObject({ daysToEvent: 16, label: 'Casamento em 16 dias', brideName: 'Fernanda Diniz', percent: 80 });
  });
  it('daysUntil e rótulos', () => {
    expect(daysUntil('2026-11-12', '2026-11-28')).toBe(16);
    expect(daysUntil('2026-11-12', '2026-11-12')).toBe(0);
    expect(eventLabel(1, 'casamento')).toBe('Casamento amanhã');
    expect(eventLabel(0, 'casamento')).toBe('Casamento hoje');
  });
});

describe('paidPercent', () => {
  it('arredonda para baixo e limita a 100', () => {
    expect(paidPercent('799.99', '1000.00', false)).toBe(79);
    expect(paidPercent('1200.00', '1000.00', false)).toBe(100);
  });
  it('total zero', () => {
    expect(paidPercent('0.00', '0.00', true)).toBe(100);
    expect(paidPercent('0.00', '0.00', false)).toBe(0);
  });
});

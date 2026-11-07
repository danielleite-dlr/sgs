import { toDisplayName } from '@/lib/format-name';
import type { AppointmentData } from '../api/appointments.api';
import type { ComandasQueryResult } from '../api/comandas.api';
import type { DashboardContract } from '../api/dashboard.api';
import { statusSpineColor } from './appointment-status-style';
import { decimalToCents } from './money';
import { APPOINTMENT_STATUS_LABELS } from './operations-labels';
import { ORG_TIMEZONE_DEFAULT, addDays, resolvePeriod, todayInTimeZone } from './period';
import { shortProfessionalName } from './professional-label';

// Derivação pura dos blocos do Início (quick 261107-in8). Sem fuso de horário de verão
// no Brasil: o offset de São Paulo é fixo em -03:00.
const SP_OFFSET = '-03:00';
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: ORG_TIMEZONE_DEFAULT,
  hour: '2-digit',
  minute: '2-digit',
});

export function todayAppointmentsWindow(now: Date = new Date()): {
  startsAt: string;
  endsAt: string;
} {
  const today = todayInTimeZone(ORG_TIMEZONE_DEFAULT, now);
  return {
    startsAt: `${today}T00:00:00${SP_OFFSET}`,
    endsAt: `${addDays(today, 1)}T00:00:00${SP_OFFSET}`,
  };
}

export interface AppointmentsSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export function summarizeAppointments(list: AppointmentData[]): AppointmentsSummary {
  const s: AppointmentsSummary = { total: 0, completed: 0, inProgress: 0, pending: 0 };
  for (const a of list) {
    if (a.status === 'cancelled' || a.status === 'no_show') continue;
    s.total += 1;
    if (a.status === 'completed') s.completed += 1;
    else if (a.status === 'in_progress') s.inProgress += 1;
    else if (a.status === 'scheduled' || a.status === 'confirmed') s.pending += 1;
  }
  return s;
}

export interface PendingAppointmentRow {
  id: string;
  time: string;
  durationMinutes: number;
  clientName: string;
  serviceName: string;
  professionalName: string;
  status: string;
  statusLabel: string;
  spineColor: string;
}

const PENDING_STATUSES = ['scheduled', 'confirmed', 'in_progress'];

export function pendingAppointments(list: AppointmentData[]): PendingAppointmentRow[] {
  return list
    .filter((a) => PENDING_STATUSES.includes(a.status))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((a) => ({
      id: a.id,
      time: TIME_FORMAT.format(new Date(a.startsAt)),
      durationMinutes: Math.round(
        (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000,
      ),
      clientName: toDisplayName(a.client.fullName),
      serviceName: a.service.name,
      professionalName: shortProfessionalName(a.professional.displayName),
      status: a.status,
      statusLabel: APPOINTMENT_STATUS_LABELS[a.status] ?? a.status,
      spineColor: statusSpineColor(a.status),
    }));
}

export interface OpenComandaRow {
  id: string;
  code: string;
  clientName: string;
  professionals: string[];
  itemsLabel: string;
  total: string;
  href: string;
}

export function openComandaRows(comandas: ComandasQueryResult['comandas']): OpenComandaRow[] {
  return comandas
    .filter((c) => c.status === 'open')
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
    .map((c) => {
      const pros: string[] = [];
      for (const it of c.items) {
        const name = it.professional ? shortProfessionalName(it.professional.displayName) : null;
        if (name && !pros.includes(name)) pros.push(name);
      }
      return {
        id: c.id,
        code: c.code,
        clientName: toDisplayName(c.client.fullName),
        professionals: pros,
        itemsLabel: c.items.map((it) => it.name).join(' + '),
        total: c.total,
        href: `/comanda/${c.id}`,
      };
    });
}

const LIVE_CONTRACT_STATUSES = ['active', 'awaiting_acceptance'];

export function daysUntil(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function contractsKpi(
  contracts: DashboardContract[],
  today: string,
): { month: number; week: number } {
  const live = contracts.filter((c) => LIVE_CONTRACT_STATUSES.includes(c.status));
  const monthPrefix = today.slice(0, 7);
  const week = resolvePeriod('thisWeek', ORG_TIMEZONE_DEFAULT, new Date(`${today}T12:00:00${SP_OFFSET}`));
  return {
    month: live.filter((c) => c.eventDate.startsWith(monthPrefix)).length,
    week: live.filter((c) => c.eventDate >= week.from && c.eventDate < week.to).length,
  };
}

export function paidPercent(paid: string, total: string, settled: boolean): number {
  const t = decimalToCents(total);
  const p = decimalToCents(paid);
  if (t <= 0) return settled && p >= 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.floor((p * 100) / t)));
}

export function eventLabel(days: number, eventKind: string): string {
  const noun = eventKind === 'debutante' ? 'Festa' : 'Casamento';
  if (days <= 0) return `${noun} hoje`;
  if (days === 1) return `${noun} amanhã`;
  return `${noun} em ${days} dias`;
}

export interface UpcomingContractRow {
  id: string;
  brideName: string;
  eventDate: string;
  daysToEvent: number;
  label: string;
  percent: number;
  href: string;
}

export function upcomingContracts(
  contracts: DashboardContract[],
  today: string,
  limit = 4,
): UpcomingContractRow[] {
  return contracts
    .filter((c) => LIVE_CONTRACT_STATUSES.includes(c.status) && c.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, limit)
    .map((c) => {
      const daysToEvent = daysUntil(today, c.eventDate);
      return {
        id: c.id,
        brideName: toDisplayName(c.brideName),
        eventDate: c.eventDate,
        daysToEvent,
        label: eventLabel(daysToEvent, c.eventKind),
        percent: paidPercent(c.paid, c.totalAmount, c.settled),
        href: `/contratos/${c.id}`,
      };
    });
}

import { PushKind, PushMessage } from './push.types';
import { PushTarget } from './resolve-push-targets';

export interface PushBridalGroupView {
  id: string;
  name: string;
  eventKind: string;
  eventDate: Date;
  brideName: string | null;
}

export interface PushAppointmentView {
  id: string;
  professionalId: string;
  professionalName: string;
  clientName: string;
  serviceName: string;
  startsAt: Date;
  bridalGroup: PushBridalGroupView | null;
}

/** Cópia de packages/shared/src/push.ts (o backend não depende de @sgs/shared por causa do Docker). */
export function buildAgendaRoute(dateYmd: string, appointmentId?: string | null): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) throw new Error('data inválida');
  const params = new URLSearchParams();
  params.set('data', dateYmd);
  params.set('visao', 'day');
  if (appointmentId) params.set('agendamento', appointmentId);
  return `/agenda?${params.toString()}`;
}

export function localDateYmd(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatDayMonth(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

export function formatTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

function firstName(n: string): string {
  return n.trim().split(/\s+/)[0] ?? '';
}

export function eventPhrase(g: PushBridalGroupView): string {
  if (!g.brideName || !g.brideName.trim()) return `no evento ${g.name}`;
  const first = firstName(g.brideName);
  return g.eventKind === 'debutante' ? `nos 15 anos da ${first}` : `no casamento da ${first}`;
}

function eventDayMonth(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function professionalSuffix(target: PushTarget, list: PushAppointmentView[]): string {
  if (target.scope !== 'all') return '';
  const names = new Map<string, string>();
  for (const a of list) names.set(a.professionalId, a.professionalName);
  if (names.size === 1) return ` (com ${[...names.values()][0]})`;
  if (names.size > 1) return ` (${names.size} profissionais)`;
  return '';
}

export function buildPushMessage(
  kind: PushKind,
  target: PushTarget,
  appointments: PushAppointmentView[],
  timezone: string,
): PushMessage {
  const sorted = [...appointments].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const first = sorted[0];
  const group = first?.bridalGroup ?? null;
  const isBridal = kind === 'bridal.scheduled' || kind === 'bridal.cancelled';
  const cancelled = kind === 'appointment.cancelled' || kind === 'bridal.cancelled';
  const isBatch = isBridal && group !== null && sorted.every((a) => a.bridalGroup?.id === group.id);

  const data: Record<string, string> = {
    kind,
    route: buildAgendaRoute(localDateYmd(first.startsAt, timezone), first.id),
    appointmentId: first.id,
    ...(group && isBatch ? { groupId: group.id } : {}),
  };
  const suffix = professionalSuffix(target, sorted);
  const n = sorted.length;

  if (isBatch && group) {
    const noun = n === 1 ? 'atendimento' : 'atendimentos';
    const state = cancelled ? (n === 1 ? ' cancelado' : ' cancelados') : '';
    const body = `${n} ${noun}${state} ${eventPhrase(group)}, ${eventDayMonth(group.eventDate)}${suffix}`;
    const label = group.eventKind === 'debutante' ? 'debutante' : 'noiva';
    const title = cancelled
      ? n === 1
        ? 'Agendamento cancelado'
        : 'Agendamentos cancelados'
      : `Novo agendamento de ${label}`;
    return { title, body, data };
  }

  const day = formatDayMonth(first.startsAt, timezone);
  const time = formatTime(first.startsAt, timezone);
  const body =
    n === 1
      ? `${first.clientName} · ${first.serviceName}, ${day} às ${time}${suffix}`
      : `${first.clientName} · ${n} serviços, ${day} a partir de ${time}${suffix}`;
  return { title: cancelled ? 'Agendamento cancelado' : 'Novo agendamento', body, data };
}

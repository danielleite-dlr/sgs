export const PUSH_KINDS = ['appointment.created', 'appointment.cancelled', 'bridal.scheduled', 'bridal.cancelled', 'commercial.reminder'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** Campos do `data` do FCM — todos string (exigência do FCM v1). */
export interface PushData {
  kind: PushKind;
  route: string;
  appointmentId?: string;
  groupId?: string;
  reminderId?: string;
}

export const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;

export const PUSH_ROUTE_RE = /^\/(agenda|comercial\/lembretes)(\?[A-Za-z0-9=&._~%-]*)?$/;

export function buildReminderRoute(reminderId: string): string {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(reminderId)) throw new Error('id de lembrete inválido');
  return `/comercial/lembretes?lembrete=${reminderId}`;
}

export function buildAgendaRoute(dateYmd: string, appointmentId?: string | null): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) throw new Error('data inválida');
  const params = new URLSearchParams();
  params.set('data', dateYmd);
  params.set('visao', 'day');
  if (appointmentId) params.set('agendamento', appointmentId);
  return `/agenda?${params.toString()}`;
}

export function isAllowedPushRoute(route: unknown): route is string {
  return (
    typeof route === 'string' &&
    route.length <= 300 &&
    !route.includes('..') &&
    !route.startsWith('//') &&
    PUSH_ROUTE_RE.test(route)
  );
}

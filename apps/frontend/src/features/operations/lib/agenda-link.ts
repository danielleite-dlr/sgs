// Datas sao LOCAIS de proposito (o navegador do salao esta em America/Sao_Paulo),
// para bater com os dias que a agenda exibe. Nunca usar toISOString aqui.
export type AgendaView = 'day' | 'week';

export function toAgendaDateParam(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseAgendaDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function parseAgendaView(value: string | null): AgendaView | null {
  return value === 'day' || value === 'week' ? value : null;
}

export function comandaHrefFromAgenda(comandaId: string, date: Date, view: AgendaView): string {
  const params = new URLSearchParams();
  params.set('agenda', toAgendaDateParam(date));
  params.set('visao', view);
  return `/comanda/${comandaId}?${params.toString()}`;
}

export function agendaHrefFromComanda(params: URLSearchParams): string {
  const date = parseAgendaDate(params.get('agenda'));
  if (!date) return '/agenda';
  const view = parseAgendaView(params.get('visao')) ?? 'day';
  return `/agenda?data=${toAgendaDateParam(date)}&visao=${view}`;
}

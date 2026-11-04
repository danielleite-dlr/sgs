import type { AiScheduleSuggestion } from '../api/ai-schedule.api';
import type { BridalDepositInput, BridalScheduleItemInput } from '../api/bridal.api';

export const SALON_TZ = 'America/Sao_Paulo';

export interface ScheduleRow {
  key: string;
  groupMemberId: string;
  personLabel: string;
  role: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  /** Nome exibido quando a lista de habilitados ainda não carregou. */
  professionalName?: string;
  /** Duração planejada (linhas montadas à mão começam sem horário). */
  durationMinutes?: number;
  /** 'YYYY-MM-DD' no fuso do salão */
  date: string;
  /** 'HH:MM' */
  start: string;
  /** 'HH:MM' */
  end: string;
}

function parts(d: Date, tz: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** Converte um instante ISO para data/hora locais do fuso. */
export function toZoned(iso: string, tz: string = SALON_TZ): { date: string; time: string } {
  const p = parts(new Date(iso), tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Interpreta 'YYYY-MM-DD' + 'HH:MM' como horário local do fuso e devolve o instante UTC. */
export function fromZoned(date: string, time: string, tz: string = SALON_TZ): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  let guess = asUtc;
  for (let i = 0; i < 2; i += 1) {
    const p = parts(new Date(guess), tz);
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, 0);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

export function suggestionToRows(s: AiScheduleSuggestion, tz: string = SALON_TZ): ScheduleRow[] {
  return s.items.map((it, i) => {
    const a = toZoned(it.startsAt, tz);
    const b = toZoned(it.endsAt, tz);
    return {
      key: `${it.groupMemberId}-${it.serviceId}-${i}`,
      groupMemberId: it.groupMemberId,
      personLabel: it.personLabel,
      role: it.role,
      serviceId: it.serviceId,
      serviceName: it.serviceName,
      professionalId: it.professionalId,
      professionalName: it.professionalName,
      date: a.date,
      start: a.time,
      end: b.time,
    };
  });
}

export function rowsToScheduleItems(
  rows: ScheduleRow[],
  tz: string = SALON_TZ,
): BridalScheduleItemInput[] {
  return rows.map((r) => ({
    groupMemberId: r.groupMemberId,
    serviceId: r.serviceId,
    professionalId: r.professionalId,
    startsAt: fromZoned(r.date, r.start, tz).toISOString(),
    endsAt: fromZoned(r.date, r.end, tz).toISOString(),
  }));
}

function minutes(r: ScheduleRow, which: 'start' | 'end'): number {
  const [h, m] = r[which].split(':').map(Number);
  return h * 60 + m;
}

/** Soma minutos a um 'HH:MM' (limitado a 23:59). */
export function addMinutes(time: string, delta: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + delta));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Sobreposições do mesmo profissional ou da mesma pessoa.
 * Devolve, por índice da linha, os índices das linhas com que conflita.
 */
export function findRowConflicts(rows: ScheduleRow[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const add = (i: number, j: number) => out.set(i, [...(out.get(i) ?? []), j]);
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.date !== b.date) continue;
      const sameProf = a.professionalId !== '' && a.professionalId === b.professionalId;
      const samePerson = a.groupMemberId === b.groupMemberId;
      if (!sameProf && !samePerson) continue;
      if (minutes(a, 'start') < minutes(b, 'end') && minutes(b, 'start') < minutes(a, 'end')) {
        add(i, j);
        add(j, i);
      }
    }
  }
  return out;
}

export interface DepositDraft {
  groupMemberId: string;
  amount: string;
  method: string;
}

/** Linhas completas: profissional e horários preenchidos. */
export function isRowComplete(r: ScheduleRow): boolean {
  return r.professionalId !== '' && /^\d{2}:\d{2}$/.test(r.start) && /^\d{2}:\d{2}$/.test(r.end);
}

/** Sinais preenchidos viram input; valores inválidos são ignorados. */
export function depositsToInput(deposits: DepositDraft[]): BridalDepositInput[] {
  const out: BridalDepositInput[] = [];
  for (const d of deposits) {
    const normalized = d.amount.trim().replace(',', '.');
    if (normalized && Number(normalized) > 0) {
      out.push({ groupMemberId: d.groupMemberId, amount: Number(normalized).toFixed(2), method: d.method });
    }
  }
  return out;
}

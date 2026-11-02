export const ORG_TIMEZONE_DEFAULT = 'America/Sao_Paulo';

export type PeriodPreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'thisWeek', label: 'Esta semana' },
  { value: 'thisMonth', label: 'Mês atual' },
  { value: 'lastMonth', label: 'Mês anterior' },
];

export const DEFAULT_PRESET: PeriodPreset = 'thisMonth';

/** YYYY-MM-DD; `to` é exclusivo. */
export interface DateRange {
  from: string;
  to: string;
}

export function todayInTimeZone(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseIso(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIso(d);
}

function firstOfMonth(isoDate: string, monthOffset: number): string {
  const d = parseIso(isoDate);
  return formatIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthOffset, 1)));
}

export function resolvePeriod(
  preset: PeriodPreset,
  tz: string = ORG_TIMEZONE_DEFAULT,
  now: Date = new Date(),
): DateRange {
  const today = todayInTimeZone(tz, now);
  switch (preset) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case 'thisWeek': {
      const dow = parseIso(today).getUTCDay(); // 0 = domingo
      const monday = addDays(today, -((dow + 6) % 7));
      return { from: monday, to: addDays(monday, 7) };
    }
    case 'thisMonth':
      return { from: firstOfMonth(today, 0), to: firstOfMonth(today, 1) };
    case 'lastMonth':
      return { from: firstOfMonth(today, -1), to: firstOfMonth(today, 0) };
  }
}

export function customPeriod(fromInclusive: string, toInclusive: string): DateRange {
  const [a, b] = fromInclusive <= toInclusive ? [fromInclusive, toInclusive] : [toInclusive, fromInclusive];
  return { from: a, to: addDays(b, 1) };
}

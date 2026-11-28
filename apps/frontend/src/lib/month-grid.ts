/** Grade de mês pura (domingo primeiro, datas locais, sem desvio de UTC). */
export interface MonthCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

export const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
export const WEEKDAY_NAMES = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** month 0-11; sempre 42 células (6 semanas). */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - first.getDay() + i);
    cells.push({ iso: toIsoLocal(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthTitle(year: number, month: number): string {
  const name = MONTH_NAMES[month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
}

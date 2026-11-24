/** Data local (YYYY-MM-DD) no fuso do navegador. */
export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Padrão do fechamento: dia do atendimento; sem atendimento (ou atendimento futuro), hoje. */
export function defaultCloseDate(serviceAt: string | null, now: Date = new Date()): string {
  const today = localDateKey(now);
  if (!serviceAt) return today;
  const day = localDateKey(new Date(serviceAt));
  return day > today ? today : day;
}

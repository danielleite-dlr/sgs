import { ComandaError } from './comanda-items';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Data local (YYYY-MM-DD) de um instante no fuso da org. */
export function localDate(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Instante do fechamento (261124-k9b). Sem data, ou com a data de hoje, é agora.
 * Data passada vira 12:00 locais daquele dia: caixa, comissão e pagamentos entram
 * no dia do atendimento, não no dia em que alguém lançou. Data futura é recusada.
 */
export function resolveCloseInstant(
  closedOn: string | null | undefined,
  tz: string,
  now: Date = new Date(),
): { at: Date; backdated: boolean } {
  if (!closedOn) return { at: now, backdated: false };
  const [y, m, d] = closedOn.split('-').map(Number);
  const valid =
    DATE_RE.test(closedOn) &&
    new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === closedOn;
  if (!valid) {
    throw new ComandaError('INVALID_CLOSE_DATE', 'Data do fechamento inválida.', 'closedOn');
  }
  const today = localDate(now, tz);
  if (closedOn > today) {
    throw new ComandaError(
      'INVALID_CLOSE_DATE',
      'A data do fechamento não pode ser futura.',
      'closedOn',
    );
  }
  if (closedOn === today) return { at: now, backdated: false };
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
  return { at: new Date(noonUtc.getTime() - tzOffsetMs(noonUtc, tz)), backdated: true };
}

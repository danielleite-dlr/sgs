/**
 * Helpers de texto rico do contrato. Cópias fiéis de
 * apps/backend/src/contracts/domain/contract-texts.ts (sem import cross-app).
 */

export interface TextRun {
  text: string;
  bold: boolean;
}

/** `**negrito**` vira runs; marcadores soltos permanecem como texto literal. */
export function parseBold(s: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const part of s.split(/(\*\*[^*]+\*\*)/g)) {
    if (part === '') continue;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      runs.push({ text: part.slice(2, -2), bold: true });
    } else {
      runs.push({ text: part, bold: false });
    }
  }
  return runs;
}

/** Parágrafos separados por uma ou mais linhas em branco; `\n` simples fica dentro do parágrafo. */
export function splitParagraphs(s: string): string[] {
  return s
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

const MONTHS_PT = [
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

/** `2026-11-04` -> `04 de novembro de 2026` (sem Intl). */
export function formatDateLongBR(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new RangeError('INVALID_DATE');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new RangeError('INVALID_DATE');
  }
  return `${m[3]} de ${MONTHS_PT[mo - 1]} de ${m[1]}`;
}

/** `2026-11-04` -> `04/11/2026` (sem fuso). */
export function formatDateBR(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate;
}

/** Centavos -> `R$ 1.234,56` (separadores fixos, independentes de ICU). */
export function formatBRLCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}R$ ${int},${frac}`;
}

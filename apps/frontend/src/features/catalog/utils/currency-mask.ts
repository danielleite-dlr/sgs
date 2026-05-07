/**
 * Currency mask helpers for BRL price inputs.
 *
 * UX: user types digits naturally; mask formats as "X.XXX,XX" while typing.
 * On submit, convert back to "XXXX.XX" format that the backend expects.
 */

/**
 * Format a string of digits as BRL (without "R$" prefix).
 * Last 2 digits = cents. Examples:
 *   "" -> ""
 *   "5" -> "0,05"
 *   "50" -> "0,50"
 *   "500" -> "5,00"
 *   "5000" -> "50,00"
 *   "250000" -> "2.500,00"
 */
export function maskCurrency(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  // Add thousand separators
  const reaisFormatted = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reaisFormatted},${cents}`;
}

/**
 * Convert masked BRL string to backend decimal format ("50.00").
 * Accepts both "1.500,00" (BR) and "1500.00" (US-like) inputs.
 */
export function unmaskCurrency(input: string): string {
  if (!input) return '';
  // Remove R$, spaces, thousand separators (.), keep comma as decimal
  const normalized = input
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = Number(normalized);
  if (Number.isNaN(num)) return input;
  return num.toFixed(2);
}

/**
 * Convert backend "50.00" string to masked display "50,00".
 */
export function formatCurrencyDisplay(value: string): string {
  if (!value) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

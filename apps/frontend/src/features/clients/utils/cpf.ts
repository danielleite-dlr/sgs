/**
 * CPF utility functions — mirrors backend cpf.util.ts algorithm exactly.
 * Accepts both formatted ("123.456.789-09") and unformatted ("12345678909") input.
 */

/**
 * Strips all non-digit characters and truncates to 11 digits.
 */
export function unformatCpf(input: string): string {
  return (input ?? '').replace(/\D/g, '').slice(0, 11);
}

/**
 * Formats CPF progressively as user types.
 * Returns "XXX.XXX.XXX-XX" for a complete CPF.
 * Returns partial formatting for fewer digits.
 */
export function formatCpf(input: string): string {
  const d = unformatCpf(input);
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Validates a Brazilian CPF using the official checksum algorithm.
 * Mirrors backend validateCpf() exactly — same test vectors, same result.
 *
 * Returns false for:
 * - null / undefined / empty
 * - Wrong length (not 11 digits)
 * - All-same-digit sequences (e.g., "111.111.111-11")
 * - Incorrect verifier digits
 */
export function validateCpf(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = unformatCpf(input);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // all same digit

  const calcVerifier = (slice: string, weightStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (weightStart - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  if (calcVerifier(digits.slice(0, 9), 10) !== Number(digits[9])) return false;
  if (calcVerifier(digits.slice(0, 10), 11) !== Number(digits[10])) return false;
  return true;
}

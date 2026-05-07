/**
 * Validates a Brazilian CPF using the official checksum algorithm.
 * Accepts formatted "123.456.789-09" or unformatted "12345678909" input.
 * Returns false for empty input, wrong length, all-same-digit (e.g., "11111111111"),
 * or mismatched verifier digits.
 */
export function validateCpf(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = input.replace(/\D/g, '');
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

  const v1 = calcVerifier(digits.slice(0, 9), 10);
  if (v1 !== Number(digits[9])) return false;
  const v2 = calcVerifier(digits.slice(0, 10), 11);
  if (v2 !== Number(digits[10])) return false;
  return true;
}

/**
 * Normalizes CPF to digits-only form for storage and comparison.
 * Input: formatted ("123.456.789-09") or unformatted ("12345678909").
 * Output: always 11 digits (or less if input has fewer digits).
 */
export function normalizeCpf(input: string): string {
  return input.replace(/\D/g, '');
}

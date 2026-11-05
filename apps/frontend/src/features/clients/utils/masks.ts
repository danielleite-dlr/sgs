/**
 * Máscara progressiva de RG: `00.000.000-0` (dígito verificador pode ser X).
 * Mantém só dígitos e um `X` final, máximo de 9 caracteres.
 */
export function maskRg(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^0-9X]/g, '');
  let clean = '';
  for (const ch of chars) {
    // X só é aceito como último (9º) caractere
    if (ch === 'X' && clean.length !== 8) continue;
    clean += ch;
    if (clean.length === 9) break;
  }
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  }
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}-${clean.slice(8)}`;
}

/** Máscara progressiva de CEP: `00000-000`. */
export function maskCep(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

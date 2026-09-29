/** Sem I, l, O, 0 e 1: a senha é ditada por WhatsApp, ambiguidade custa suporte. */
export const PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Gera uma senha provisória legível no navegador (crypto.getRandomValues) com
 * rejection sampling para não enviesar o alfabeto.
 */
export function generateTemporaryPassword(length = 14): string {
  const alphabetSize = PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % alphabetSize);
  let out = '';
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      out += PASSWORD_ALPHABET[b % alphabetSize];
      if (out.length === length) break;
    }
  }
  return out;
}

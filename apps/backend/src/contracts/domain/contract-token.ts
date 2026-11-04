import { createHash, randomBytes } from 'node:crypto';

export const ACCESS_TOKEN_TTL_DAYS = 30;

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Token de acesso do link público: 256 bits, base64url (43 chars); só o hash é persistido. */
export function newAccessToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

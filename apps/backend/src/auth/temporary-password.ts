import { randomInt } from 'node:crypto';

/** Sem I, l, O, 0 e 1: a senha é ditada por WhatsApp, ambiguidade custa suporte. */
export const PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Política de senha existente (auth.service changePassword: mínimo 8). */
export const TEMP_PASSWORD_MIN = 8;
export const TEMP_PASSWORD_MAX = 128;

export function generatePassword(length = 14): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

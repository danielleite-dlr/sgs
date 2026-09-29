/**
 * Normalização leve de telefone BR e chave Pix. Validação só de formato e
 * tamanho — sem dígito verificador de CPF/CNPJ.
 */

/** Telefone BR -> E.164 (`+55DDNNNNNNNNN`) ou null quando inválido. */
export function normalizeBrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  if (digits.length === 11) {
    // Celular: 9 inicial após o DDD.
    if (digits[2] !== '9') return null;
  } else if (!/[2-5]/.test(digits[2])) {
    // Fixo: inicia em 2-5.
    return null;
  }
  return `+55${digits}`;
}

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePixKey(
  raw: string,
): { type: PixKeyType; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (EMAIL_RE.test(trimmed)) {
    return { type: 'email', value: trimmed.toLowerCase() };
  }
  if (UUID_RE.test(trimmed)) {
    return { type: 'evp', value: trimmed.toLowerCase() };
  }
  if (trimmed.startsWith('+')) {
    const phone = normalizeBrPhone(trimmed);
    return phone ? { type: 'phone', value: phone } : null;
  }
  if (/^[\d.\-/\s]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 11) return { type: 'cpf', value: digits };
    if (digits.length === 14) return { type: 'cnpj', value: digits };
  }
  return null;
}

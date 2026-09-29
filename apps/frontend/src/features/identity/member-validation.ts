/**
 * Espelho leve das regras do backend (apps/backend/src/identity/member-contact.ts).
 * O backend é a fonte da verdade; aqui só evitamos ida e volta desnecessária.
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
    if (digits[2] !== '9') return null;
  } else if (!/[2-5]/.test(digits[2])) {
    return null;
  }
  return `+55${digits}`;
}

/**
 * Máscara progressiva de telefone BR para exibição e digitação:
 * `(11) 98765-4321` (celular) ou `(11) 3456-7890` (fixo). Aceita também o
 * valor já salvo em E.164 (`+5511987654321`).
 */
export function maskBrPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+55')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = digits.length === 11 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chave Pix: CPF, CNPJ, e-mail, telefone (+55...) ou chave aleatória (EVP). */
export function isValidPixKey(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (EMAIL_RE.test(trimmed) || UUID_RE.test(trimmed)) return true;
  if (trimmed.startsWith('+')) return normalizeBrPhone(trimmed) !== null;
  if (/^[\d.\-/\s]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 14;
  }
  return false;
}

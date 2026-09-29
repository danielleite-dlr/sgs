import { maskBrPhone, normalizeBrPhone } from './member-validation';

/**
 * Tipos de chave Pix. O backend guarda só a chave, já normalizada, e o tipo é
 * deduzido dela sem ambiguidade: telefone sempre em E.164 (`+55…`), CPF com 11
 * dígitos, CNPJ com 14, e-mail com `@` e aleatória no formato UUID.
 */
export const PIX_KEY_TYPES = ['cpf', 'cnpj', 'email', 'phone', 'evp'] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const digitsOf = (raw: string) => raw.replace(/\D/g, '');

/** Deduz o tipo de uma chave já salva. Null quando não reconhece. */
export function detectPixKeyType(stored: string | null | undefined): PixKeyType | null {
  const v = stored?.trim() ?? '';
  if (!v) return null;
  if (EMAIL_RE.test(v)) return 'email';
  if (UUID_RE.test(v)) return 'evp';
  if (v.startsWith('+')) return 'phone';
  if (/^[\d.\-/\s]+$/.test(v)) {
    const d = digitsOf(v);
    if (d.length === 11) return 'cpf';
    if (d.length === 14) return 'cnpj';
  }
  return null;
}

function maskCpf(raw: string): string {
  const d = digitsOf(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskCnpj(raw: string): string {
  const d = digitsOf(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara progressiva conforme o tipo escolhido. */
export function maskPixKey(type: PixKeyType | null, raw: string): string {
  switch (type) {
    case 'cpf':
      return maskCpf(raw);
    case 'cnpj':
      return maskCnpj(raw);
    case 'phone':
      return maskBrPhone(raw);
    default:
      return raw;
  }
}

function isValidCpf(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

function isValidCnpj(d: string): boolean {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const check = (len: number) => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

/** Mensagem de erro para a chave no tipo escolhido, ou null se válida. */
export function pixKeyError(type: PixKeyType | null, raw: string): string | null {
  const v = raw.trim();
  if (!type) return 'Selecione o tipo de chave Pix.';
  if (!v) return 'Campo obrigatório.';
  switch (type) {
    case 'cpf':
      return isValidCpf(digitsOf(v)) ? null : 'CPF inválido.';
    case 'cnpj':
      return isValidCnpj(digitsOf(v)) ? null : 'CNPJ inválido.';
    case 'email':
      return EMAIL_RE.test(v) ? null : 'E-mail inválido.';
    case 'phone':
      return normalizeBrPhone(v) ? null : 'Telefone inválido.';
    case 'evp':
      return UUID_RE.test(v)
        ? null
        : 'Chave aleatória inválida (formato 00000000-0000-0000-0000-000000000000).';
  }
}

/** Valor enviado ao backend: o formato canônico de cada tipo. */
export function toPixKeyPayload(type: PixKeyType, raw: string): string {
  const v = raw.trim();
  switch (type) {
    case 'cpf':
    case 'cnpj':
      return digitsOf(v);
    case 'phone':
      return normalizeBrPhone(v) ?? v;
    case 'email':
    case 'evp':
      return v.toLowerCase();
  }
}

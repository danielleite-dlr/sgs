export interface VapidDetails {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const PUBLIC_RE = /^[A-Za-z0-9_-]{87}$/;
const PRIVATE_RE = /^[A-Za-z0-9_-]{43}$/;

function subjectValido(subject: string): boolean {
  const s = subject.trim();
  if (/localhost|127\.0\.0\.1/i.test(s)) return false;
  if (s.startsWith('https://')) return s.length > 'https://'.length;
  if (s.startsWith('mailto:')) {
    const resto = s.slice('mailto:'.length);
    return resto.length > 0 && resto.includes('@');
  }
  return false;
}

/** Lê as chaves VAPID do env. Nunca lança; qualquer problema => null (canal desligado). */
export function parseVapidDetails(raw: {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
}): VapidDetails | null {
  try {
    const publicKey = raw?.publicKey?.trim();
    const privateKey = raw?.privateKey?.trim();
    const subject = raw?.subject?.trim();
    if (!publicKey || !privateKey || !subject) return null;
    if (!PUBLIC_RE.test(publicKey) || !PRIVATE_RE.test(privateKey)) return null;
    if (!subjectValido(subject)) return null;
    return { publicKey, privateKey, subject };
  } catch {
    return null;
  }
}

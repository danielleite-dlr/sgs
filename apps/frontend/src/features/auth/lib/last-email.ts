// Fica fora do 'sgs-auth' de propósito: o logout só zera o store, então o último
// e-mail sobrevive e a tela de login já vem preenchida.
const KEY = 'sgs-last-email';

export function getLastEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastEmail(email: string): void {
  const value = email.trim();
  if (!value) return;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // armazenamento indisponível: lembrar o e-mail é só conveniência
  }
}

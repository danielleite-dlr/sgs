/**
 * Normalização de telefone para detectar duplicidade (D-02).
 *
 * Regra única: só dígitos; se começa com 55 e tem 12 ou 13 dígitos, tira o 55;
 * aceita 10 ou 11 dígitos. A chave é DDD + últimos 8 dígitos (ignora o 9º dígito).
 *
 * A busca SQL nos serviços usa a mesma regra: regexp_replace(phone, '\D', '', 'g'),
 * DDD = 2 primeiros dígitos depois de tirar o 55, + últimos 8 dígitos.
 */

export function phoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return d;
}

export function phoneKey(raw: string | null | undefined): string | null {
  const d = phoneDigits(raw);
  if (!d) return null;
  return d.slice(0, 2) + d.slice(-8);
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = phoneKey(a);
  const kb = phoneKey(b);
  return ka !== null && kb !== null && ka === kb;
}

/**
 * Telefone brasileiro para exibição: "+5511988887777" -> "(11) 98888-7777",
 * "1188887777" -> "(11) 8888-7777". Qualquer outro formato volta como veio.
 */
export function formatPhoneBr(raw: string | null | undefined): string {
  if (!raw) return '';
  let d = raw.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

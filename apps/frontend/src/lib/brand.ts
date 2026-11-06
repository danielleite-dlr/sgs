import { toDisplayName } from './format-name';

/** Nome do estúdio no menu e no topo; sem organização, "SGS". */
export function brandName(org: string | null | undefined): string {
  const nome = (org ?? '').trim();
  return nome || 'SGS';
}

/**
 * Sigla do quadrado da marca. "Studio JS" -> "JS" (última palavra já é sigla de 2–3 letras);
 * "Ateliê Maria Clara" -> "AM"; vazio -> "SG".
 */
export function brandInitials(org: string | null | undefined): string {
  const palavras = (org ?? '').trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return 'SG';
  const ultima = palavras[palavras.length - 1];
  if (/^\p{Lu}{2,3}$/u.test(ultima)) return ultima;
  return palavras
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toLocaleUpperCase('pt-BR');
}

/** Iniciais do avatar da usuária: primeira letra da primeira e da última palavra do nome. */
export function personInitials(name: string | null | undefined): string {
  const palavras = toDisplayName(name).split(' ').filter(Boolean);
  if (palavras.length === 0) return '';
  const primeira = palavras[0].charAt(0);
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1].charAt(0) : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}

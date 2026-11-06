const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * Nome para exibição em caixa normal: "MARIA DA SILVA" -> "Maria da Silva".
 * Partículas (da, de, do, das, dos, e) ficam minúsculas fora da primeira posição.
 */
export function toDisplayName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const lower = word.toLocaleLowerCase('pt-BR');
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
    })
    .join(' ');
}

/** Minúsculas e sem acento: "maquiagem" encontra "Maquiágem", "penteado" encontra "PENTEADO". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Todas as palavras digitadas precisam aparecer no rótulo, em qualquer ordem. */
export function matchesSearch(label: string, search: string): boolean {
  const words = normalizeSearch(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch(label);
  return words.every((w) => haystack.includes(w));
}

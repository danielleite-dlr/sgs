/**
 * Ordem das listas de escolha de profissional.
 * 11 D-09: seletores com fixas primeiro; a grade da Agenda NÃO usa isto (D-20).
 */
export function sortFixedFirst<T extends { id: string; isFixed?: boolean | null }>(
  list: readonly T[],
  nameOf: (p: T) => string,
): T[] {
  return [...list].sort((a, b) => {
    const fixedDiff = Number(!!b.isFixed) - Number(!!a.isFixed);
    if (fixedDiff !== 0) return fixedDiff;
    const byName = nameOf(a).localeCompare(nameOf(b), 'pt-BR', { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

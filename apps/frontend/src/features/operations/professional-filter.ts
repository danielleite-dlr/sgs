/**
 * Filtro do seletor de profissional do modal de agendamento.
 * `allowedIds` vem de `professionalsForService` (null = nenhum serviço
 * escolhido ainda / resultado ainda não carregado: não filtra).
 */
export function filterProfessionalsForService<T extends { id: string }>(
  list: T[],
  allowedIds: readonly string[] | null,
): T[] {
  if (allowedIds === null) return list;
  const allowed = new Set(allowedIds);
  return list.filter((item) => allowed.has(item.id));
}

/** True quando o profissional selecionado não atende o serviço escolhido. */
export function shouldClearProfessional(
  selectedId: string,
  allowedIds: readonly string[] | null,
): boolean {
  if (!selectedId || allowedIds === null) return false;
  return !allowedIds.includes(selectedId);
}

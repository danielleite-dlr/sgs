/**
 * Ranking de profissionais (fase 11): decide quem recebe o atendimento.
 *
 * Ordem aplicada, nesta sequência:
 *  1. Filtro: só candidatas livres no horário (`free`); quando o serviço é da
 *     noiva/debutante (`bridal: true`), só quem atende noiva (D-02). Sem
 *     ninguém elegível a lista fica vazia, sem fallback para "todas" (D-04).
 *  2. Prioridade estrita da fixa: toda fixa vem antes de toda não fixa, mesmo
 *     com mais minutos no dia (D-18).
 *  3. Menos minutos agendados no dia (D-10).
 *  4. Revezamento: quem recebeu há mais tempo; "nunca recebeu" vem primeiro (D-11).
 *  5. Último desempate: id (ordem estável).
 *
 * O módulo é puro e determinístico: sem `Date.now`, sem `Math.random` e sem
 * Prisma. Quem consome (cronograma, sugestão de agenda, agendamento comum)
 * só monta as candidatas e chama estas funções; ordenar por conta própria
 * nos consumidores é bug.
 */

export interface RankCandidate {
  id: string;
  isFixed: boolean;
  servesBridal: boolean;
  /** minutos já agendados no dia (status que ocupam agenda) + atribuídos na rodada atual */
  dayMinutes: number;
  /** quanto MENOR, há mais tempo recebeu; null = nunca recebeu (vai primeiro). Pode ser epoch ms ou posição de rodízio. */
  lastAssignedAt: number | null;
  /** livre no horário do slot */
  free: boolean;
}

export interface RankOptions {
  bridal: boolean;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareLastAssigned(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a - b;
}

/** Comparador total: fixa, minutos no dia, revezamento, id. Nunca retorna NaN. */
export function compareCandidates(a: RankCandidate, b: RankCandidate): number {
  const fixed = Number(b.isFixed) - Number(a.isFixed);
  if (fixed !== 0) return fixed;
  const minutes = a.dayMinutes - b.dayMinutes;
  if (minutes !== 0) return minutes;
  const rotation = compareLastAssigned(a.lastAssignedAt, b.lastAssignedAt);
  if (rotation !== 0) return rotation;
  return compareIds(a.id, b.id);
}

/** Filtra (livre e, se noiva, atende noiva) e ordena. Não altera a entrada. */
export function rankProfessionals<T extends RankCandidate>(
  c: readonly T[],
  o: RankOptions,
): T[] {
  return c
    .filter((x) => x.free && (!o.bridal || x.servesBridal))
    .sort(compareCandidates);
}

/** A melhor candidata, ou null quando ninguém é elegível. */
export function pickBest<T extends RankCandidate>(
  c: readonly T[],
  o: RankOptions,
): T | null {
  return rankProfessionals(c, o)[0] ?? null;
}

/** Ordem das listas de escolha (D-09): fixas primeiro, depois nome em pt-BR, depois id. Não exige livre. */
export function orderForPicker<
  T extends { id: string; isFixed: boolean; displayName: string },
>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const fixed = Number(b.isFixed) - Number(a.isFixed);
    if (fixed !== 0) return fixed;
    const name = a.displayName.localeCompare(b.displayName, "pt-BR", {
      sensitivity: "base",
    });
    if (name !== 0) return name;
    return compareIds(a.id, b.id);
  });
}

/** Posição 0..n-1 por lastAssignedAt (null primeiro, depois menor), desempate por id. */
export function rotationRanks(
  c: readonly { id: string; lastAssignedAt: number | null }[],
): Map<string, number> {
  const sorted = [...c].sort(
    (a, b) =>
      compareLastAssigned(a.lastAssignedAt, b.lastAssignedAt) ||
      compareIds(a.id, b.id),
  );
  return new Map(sorted.map((x, i) => [x.id, i]));
}

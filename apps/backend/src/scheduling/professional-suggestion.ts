import type { TenantPrismaClient } from '../database/types';
import { localDate, orgTimezone } from '../bridal/bridal-schedule';
import { compareCandidates, type RankCandidate } from './professional-ranking';
import { loadBusyInIntervalTx, loadRankingDataTx } from './professional-ranking-data';

/** Fase 11 D-08/D-09: sugestão de profissional para serviço + horário. */
export interface ProfessionalSuggestionRow {
  professionalId: string;
  displayName: string;
  isFixed: boolean;
  free: boolean;
  dayMinutes: number;
  /** true só para a primeira livre (a escolhida pelo ranking) */
  suggested: boolean;
}

interface SuggestionInput {
  id: string;
  displayName: string;
  isFixed: boolean;
  servesBridal: boolean;
}

/**
 * Ordena as profissionais (já filtradas por serviço e, se noiva, por atendimento de noiva):
 * livres antes de ocupadas e, em cada bloco, o ranking (fixa, minutos no dia, revezamento, id).
 * Só consulta; nada é gravado.
 */
export async function suggestProfessionalsTx(
  tx: TenantPrismaClient,
  rows: SuggestionInput[],
  a: { startsAt: Date; endsAt: Date; bridal: boolean; ignoreAppointmentIds?: string[] },
): Promise<ProfessionalSuggestionRow[]> {
  if (a.endsAt <= a.startsAt || rows.length === 0) return [];

  // Dia local do salão que contém o início do horário.
  const tz = await orgTimezone(tx);
  const day = localDate(a.startsAt, tz);
  const win = await tx.$queryRaw<{ s: Date; e: Date }[]>`
    SELECT (${day}::date)::timestamp AT TIME ZONE o.timezone AS s,
           ((${day}::date + 1))::timestamp AT TIME ZONE o.timezone AS e
    FROM organizations o LIMIT 1`;
  const dayStart = win[0].s;
  const dayEnd = win[0].e;

  const professionalIds = rows.map((r) => r.id);
  const [busy, data] = await Promise.all([
    loadBusyInIntervalTx(tx, {
      professionalIds,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      ignoreAppointmentIds: a.ignoreAppointmentIds,
    }),
    loadRankingDataTx(tx, {
      professionalIds,
      dayStart,
      dayEnd,
      excludeAppointmentIds: a.ignoreAppointmentIds,
    }),
  ]);

  const items = rows.map((r) => {
    const candidate: RankCandidate = {
      id: r.id,
      isFixed: r.isFixed,
      servesBridal: r.servesBridal,
      dayMinutes: data.dayMinutes.get(r.id) ?? 0,
      lastAssignedAt: data.lastAssignedAt.get(r.id) ?? null,
      free: !busy.has(r.id),
    };
    return { row: r, candidate };
  });
  items.sort(
    (x, y) =>
      Number(y.candidate.free) - Number(x.candidate.free) ||
      compareCandidates(x.candidate, y.candidate),
  );

  const firstFree = items.findIndex((i) => i.candidate.free);
  return items.map((i, idx) => ({
    professionalId: i.row.id,
    displayName: i.row.displayName,
    isFixed: i.row.isFixed,
    free: i.candidate.free,
    dayMinutes: i.candidate.dayMinutes,
    suggested: idx === firstFree,
  }));
}

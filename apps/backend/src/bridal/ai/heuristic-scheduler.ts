import { compareCandidates } from '../../scheduling/professional-ranking';
import type { Proposal, ProposalItem, ScheduleContext } from './ai-schedule.schema';

const MIN_MS = 60_000;
const STEP_MS = 5 * MIN_MS;
const MAX_PERSONS = 12;
const MAX_SERVICES_PER_PERSON = 10;

interface Interval {
  start: number;
  end: number;
}

const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

export type UnscheduledReason = 'NO_ELIGIBLE_PROFESSIONAL' | 'NO_FREE_PROFESSIONAL_BEFORE_LIMIT';

/**
 * Fallback determinístico (sem rede) da sugestão de agenda do evento (AI-01).
 * Varre para trás a partir do limite da pessoa (noiva: `readyBy`; acompanhante:
 * `companionReadyBy`) e cada pessoa encadeia seus serviços de trás para frente.
 * Fase 11: a profissional vem do ranking (fixa antes de não fixa mesmo mais cedo, D-18;
 * depois menos minutos somando a rodada, D-10; depois revezamento, D-11) e, dentro dela,
 * o horário é o mais perto do limite (D-15). O que não cabe vai para `unscheduled` com
 * motivo, sem exceção (D-16). `earlyByPriority` marca quando a prioridade antecipou o horário.
 */
export function buildHeuristicProposal(ctx: ScheduleContext): {
  proposal: Proposal;
  unscheduled: {
    personRef: string;
    serviceId: string;
    reason: UnscheduledReason;
  }[];
  earlyByPriority: {
    personRef: string;
    serviceId: string;
    minutesBeforeLimit: number;
  }[];
} {
  if (
    ctx.persons.length > MAX_PERSONS ||
    ctx.persons.some((p) => p.services.length > MAX_SERVICES_PER_PERSON)
  ) {
    throw new RangeError('CONTEXT_TOO_LARGE');
  }

  const dayStart = Date.parse(ctx.dayStart);
  const dayEnd = Date.parse(ctx.dayEnd);
  const readyBy = Date.parse(ctx.readyBy);
  const companionReadyBy = Date.parse(ctx.companionReadyBy);
  const meta = new Map(ctx.professionals.map((p) => [p.id, p]));
  const knownPros = new Set(meta.keys());
  const roundMinutes = new Map<string, number>();
  const roundRotation = new Map<string, number>();
  let seq = ctx.professionals.length;

  const busyByPro = new Map<string, Interval[]>();
  for (const b of ctx.busy) {
    const list = busyByPro.get(b.professionalId) ?? [];
    list.push({ start: Date.parse(b.startsAt), end: Date.parse(b.endsAt) });
    busyByPro.set(b.professionalId, list);
  }
  const assignedByPro = new Map<string, Interval[]>();
  const assignedByPerson = new Map<string, Interval[]>();
  const cursorByPerson = new Map<string, number>();

  const padBefore = ctx.travelBeforeMinutes * MIN_MS;
  const padAfter = ctx.travelAfterMinutes * MIN_MS;

  // Ordem das tarefas: noiva (serviços em ordem inversa) e depois acompanhantes.
  const ordered = [
    ...ctx.persons.filter((p) => p.role === 'bride'),
    ...ctx.persons.filter((p) => p.role !== 'bride'),
  ];
  const tasks = ordered.flatMap((p) =>
    [...p.services].reverse().map((svc) => ({ personRef: p.ref, svc })),
  );

  const items: ProposalItem[] = [];
  const unscheduled: {
    personRef: string;
    serviceId: string;
    reason: UnscheduledReason;
  }[] = [];
  const earlyByPriority: {
    personRef: string;
    serviceId: string;
    minutesBeforeLimit: number;
  }[] = [];

  for (const { personRef, svc } of tasks) {
    const durMs = svc.durationMinutes * MIN_MS;
    const role = ctx.persons.find((p) => p.ref === personRef)?.role;
    const limit = role === 'bride' ? readyBy : companionReadyBy;
    const latestEnd = Math.min(cursorByPerson.get(personRef) ?? limit, limit);
    const pros = [...svc.eligibleProfessionalIds].filter((id) => knownPros.has(id)).sort();

    const feasible: { proId: string; start: number; end: number }[] = [];
    for (const proId of pros) {
      const busy = busyByPro.get(proId) ?? [];
      const assigned = assignedByPro.get(proId) ?? [];
      const person = assignedByPerson.get(personRef) ?? [];
      // maior `end` na grade de 5 min a partir de dayStart, ≤ latestEnd
      let end = dayStart + Math.floor((latestEnd - dayStart) / STEP_MS) * STEP_MS;
      for (; end - durMs >= dayStart; end -= STEP_MS) {
        if (end > dayEnd) continue;
        const slot = { start: end - durMs, end };
        const padded = {
          start: slot.start - padBefore,
          end: slot.end + padAfter,
        };
        if (
          busy.some((b) => overlaps(padded, b)) ||
          assigned.some((a) => overlaps(slot, a)) ||
          person.some((a) => overlaps(slot, a))
        ) {
          continue;
        }
        feasible.push({ proId, start: slot.start, end: slot.end });
        break;
      }
    }

    if (feasible.length === 0) {
      unscheduled.push({
        personRef,
        serviceId: svc.serviceId,
        reason:
          pros.length === 0 ? 'NO_ELIGIBLE_PROFESSIONAL' : 'NO_FREE_PROFESSIONAL_BEFORE_LIMIT',
      });
      continue;
    }
    const rankOf = (proId: string) => {
      const m = meta.get(proId)!;
      return {
        id: proId,
        isFixed: m.isFixed,
        servesBridal: true,
        free: true,
        dayMinutes: m.dayMinutes + (roundMinutes.get(proId) ?? 0),
        lastAssignedAt: roundRotation.get(proId) ?? m.rotationRank,
      };
    };
    feasible.sort((a, b) => compareCandidates(rankOf(a.proId), rankOf(b.proId)) || b.end - a.end);
    const best = feasible[0];
    const bestEnd = Math.max(...feasible.map((f) => f.end));
    if (bestEnd > best.end) {
      earlyByPriority.push({
        personRef,
        serviceId: svc.serviceId,
        minutesBeforeLimit: Math.round((limit - best.end) / MIN_MS),
      });
    }
    roundMinutes.set(best.proId, (roundMinutes.get(best.proId) ?? 0) + svc.durationMinutes);
    roundRotation.set(best.proId, seq++);
    const slot = { start: best.start, end: best.end };
    assignedByPro.set(best.proId, [...(assignedByPro.get(best.proId) ?? []), slot]);
    assignedByPerson.set(personRef, [...(assignedByPerson.get(personRef) ?? []), slot]);
    cursorByPerson.set(personRef, best.start);
    items.push({
      personRef,
      serviceId: svc.serviceId,
      professionalId: best.proId,
      startsAt: new Date(best.start).toISOString(),
      endsAt: new Date(best.end).toISOString(),
    });
  }

  items.sort((a, b) =>
    a.startsAt !== b.startsAt
      ? a.startsAt < b.startsAt
        ? -1
        : 1
      : a.professionalId < b.professionalId
        ? -1
        : a.professionalId > b.professionalId
          ? 1
          : 0,
  );
  return { proposal: { items }, unscheduled, earlyByPriority };
}

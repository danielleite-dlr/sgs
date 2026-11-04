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

/**
 * Fallback determinístico (sem rede) da sugestão de agenda do evento (AI-01).
 * Varre para trás a partir de "pronta até": a noiva termina o mais perto possível de
 * `readyBy` e cada pessoa encadeia seus serviços de trás para frente.
 */
export function buildHeuristicProposal(ctx: ScheduleContext): {
  proposal: Proposal;
  unscheduled: { personRef: string; serviceId: string }[];
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
  const knownPros = new Set(ctx.professionals.map((p) => p.id));

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
  const unscheduled: { personRef: string; serviceId: string }[] = [];

  for (const { personRef, svc } of tasks) {
    const durMs = svc.durationMinutes * MIN_MS;
    const latestEnd = Math.min(cursorByPerson.get(personRef) ?? readyBy, readyBy);
    const pros = [...svc.eligibleProfessionalIds].filter((id) => knownPros.has(id)).sort();

    let best: { proId: string; start: number; end: number } | null = null;
    for (const proId of pros) {
      const busy = busyByPro.get(proId) ?? [];
      const assigned = assignedByPro.get(proId) ?? [];
      const person = assignedByPerson.get(personRef) ?? [];
      // maior `end` na grade de 5 min a partir de dayStart, ≤ latestEnd
      let end = dayStart + Math.floor((latestEnd - dayStart) / STEP_MS) * STEP_MS;
      for (; end - durMs >= dayStart; end -= STEP_MS) {
        if (best && end <= best.end) break; // não melhora o melhor já achado
        if (end > dayEnd) continue;
        const slot = { start: end - durMs, end };
        const padded = { start: slot.start - padBefore, end: slot.end + padAfter };
        if (
          busy.some((b) => overlaps(padded, b)) ||
          assigned.some((a) => overlaps(slot, a)) ||
          person.some((a) => overlaps(slot, a))
        ) {
          continue;
        }
        best = { proId, start: slot.start, end: slot.end };
        break;
      }
    }

    if (!best) {
      unscheduled.push({ personRef, serviceId: svc.serviceId });
      continue;
    }
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
  return { proposal: { items }, unscheduled };
}

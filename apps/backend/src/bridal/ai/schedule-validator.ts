import type { Proposal, ProposalItem, ScheduleContext } from './ai-schedule.schema';

export type ViolationCode =
  | 'UNKNOWN_PERSON'
  | 'UNKNOWN_SERVICE'
  | 'MISSING_SERVICE'
  | 'DUPLICATE_SERVICE'
  | 'UNKNOWN_PROFESSIONAL'
  | 'PROFESSIONAL_NOT_ELIGIBLE'
  | 'INVALID_TIME'
  | 'WRONG_DURATION'
  | 'OUTSIDE_DAY_WINDOW'
  | 'AFTER_READY_BY'
  | 'PROFESSIONAL_OVERLAP'
  | 'BUSY_CONFLICT'
  | 'PERSON_OVERLAP'
  | 'TRAVEL_CONFLICT';

export interface Violation {
  code: ViolationCode;
  personRef?: string;
  serviceId?: string;
  professionalId?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
  warnings: { code: 'BRIDE_NOT_LAST'; message: string }[];
}

const MIN_MS = 60_000;

/** Interseção de intervalos semiabertos [a0,a1) e [b0,b1). */
const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

interface Timed {
  item: ProposalItem;
  start: number;
  end: number;
}

/**
 * Valida estrutura, habilitação, duração, janela e conflitos de uma proposta de agenda
 * do evento. Função pura: sem rede nem banco. Reusada pela heurística e pelo `confirm`.
 */
export function validateProposal(p: Proposal, ctx: ScheduleContext): ValidationResult {
  const violations: Violation[] = [];
  const add = (code: ViolationCode, it: Partial<ProposalItem>, message: string) =>
    violations.push({
      code,
      personRef: it.personRef,
      serviceId: it.serviceId,
      professionalId: it.professionalId,
      message,
    });

  const dayStart = Date.parse(ctx.dayStart);
  const dayEnd = Date.parse(ctx.dayEnd);
  const readyBy = Date.parse(ctx.readyBy);
  const professionalIds = new Set(ctx.professionals.map((x) => x.id));

  // --- Estrutura: cada (pessoa, serviço) do ctx aparece exatamente uma vez ---
  const counts = new Map<string, number>();
  for (const it of p.items) {
    const person = ctx.persons.find((x) => x.ref === it.personRef);
    if (!person) {
      add('UNKNOWN_PERSON', it, `Pessoa ${it.personRef} não existe no evento.`);
      continue;
    }
    if (!person.services.some((s) => s.serviceId === it.serviceId)) {
      add('UNKNOWN_SERVICE', it, `Serviço ${it.serviceId} não pertence a ${it.personRef}.`);
      continue;
    }
    const key = `${it.personRef}|${it.serviceId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const person of ctx.persons) {
    for (const svc of person.services) {
      const n = counts.get(`${person.ref}|${svc.serviceId}`) ?? 0;
      if (n === 0) {
        add(
          'MISSING_SERVICE',
          { personRef: person.ref, serviceId: svc.serviceId },
          `${person.ref} está sem o serviço ${svc.label}.`,
        );
      } else if (n > 1) {
        add(
          'DUPLICATE_SERVICE',
          { personRef: person.ref, serviceId: svc.serviceId },
          `${person.ref} tem o serviço ${svc.label} repetido.`,
        );
      }
    }
  }

  // --- Por item: profissional, tempo, duração, janela ---
  const timed: Timed[] = [];
  for (const it of p.items) {
    const person = ctx.persons.find((x) => x.ref === it.personRef);
    const svc = person?.services.find((s) => s.serviceId === it.serviceId);
    if (!person || !svc) continue; // já reportado acima

    if (!professionalIds.has(it.professionalId)) {
      add('UNKNOWN_PROFESSIONAL', it, `Profissional ${it.professionalId} não existe.`);
    } else if (!svc.eligibleProfessionalIds.includes(it.professionalId)) {
      add(
        'PROFESSIONAL_NOT_ELIGIBLE',
        it,
        `Profissional ${it.professionalId} não está habilitado para ${svc.label}.`,
      );
    }

    const start = Date.parse(it.startsAt);
    const end = Date.parse(it.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      add('INVALID_TIME', it, `Horário inválido para ${it.personRef} / ${svc.label}.`);
      continue;
    }
    if ((end - start) / MIN_MS !== svc.durationMinutes) {
      add(
        'WRONG_DURATION',
        it,
        `${svc.label} deveria durar ${svc.durationMinutes} min, veio ${(end - start) / MIN_MS}.`,
      );
    }
    if (start < dayStart || end > dayEnd) {
      add('OUTSIDE_DAY_WINDOW', it, `${it.personRef} / ${svc.label} fica fora da janela do dia.`);
    }
    if (end > readyBy) {
      add(
        'AFTER_READY_BY',
        it,
        `${it.personRef} / ${svc.label} termina depois do horário "pronta até".`,
      );
    }
    timed.push({ item: it, start, end });
  }

  // --- Sobreposição por profissional, ocupação e pessoa ---
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;
      if (a.item.professionalId === b.item.professionalId) {
        add(
          'PROFESSIONAL_OVERLAP',
          b.item,
          `Profissional ${b.item.professionalId} está em dois atendimentos ao mesmo tempo.`,
        );
      }
      if (a.item.personRef === b.item.personRef) {
        add('PERSON_OVERLAP', b.item, `${b.item.personRef} está em dois serviços ao mesmo tempo.`);
      }
    }
  }

  const busyByPro = new Map<string, { start: number; end: number }[]>();
  for (const b of ctx.busy) {
    const list = busyByPro.get(b.professionalId) ?? [];
    list.push({ start: Date.parse(b.startsAt), end: Date.parse(b.endsAt) });
    busyByPro.set(b.professionalId, list);
  }
  for (const t of timed) {
    const hit = (busyByPro.get(t.item.professionalId) ?? []).some((b) =>
      overlaps(t.start, t.end, b.start, b.end),
    );
    if (hit) {
      add(
        'BUSY_CONFLICT',
        t.item,
        `Profissional ${t.item.professionalId} já está ocupado nesse horário.`,
      );
    }
  }

  // --- Deslocamento: janela antes do primeiro e depois do último atendimento ---
  if (ctx.travelBeforeMinutes > 0 || ctx.travelAfterMinutes > 0) {
    const byPro = new Map<string, Timed[]>();
    for (const t of timed) {
      const list = byPro.get(t.item.professionalId) ?? [];
      list.push(t);
      byPro.set(t.item.professionalId, list);
    }
    for (const [proId, list] of byPro) {
      const busy = busyByPro.get(proId) ?? [];
      const first = list.reduce((m, t) => (t.start < m.start ? t : m));
      const last = list.reduce((m, t) => (t.end > m.end ? t : m));
      if (ctx.travelBeforeMinutes > 0) {
        const from = first.start - ctx.travelBeforeMinutes * MIN_MS;
        if (busy.some((b) => overlaps(from, first.start, b.start, b.end))) {
          add(
            'TRAVEL_CONFLICT',
            first.item,
            `Deslocamento de ida de ${proId} conflita com ocupação.`,
          );
        }
      }
      if (ctx.travelAfterMinutes > 0) {
        const to = last.end + ctx.travelAfterMinutes * MIN_MS;
        if (busy.some((b) => overlaps(last.end, to, b.start, b.end))) {
          add(
            'TRAVEL_CONFLICT',
            last.item,
            `Deslocamento de volta de ${proId} conflita com ocupação.`,
          );
        }
      }
    }
  }

  // --- Aviso: noiva deveria terminar por último ---
  const warnings: ValidationResult['warnings'] = [];
  const roleOf = new Map(ctx.persons.map((x) => [x.ref, x.role]));
  let brideEnd = -Infinity;
  let companionEnd = -Infinity;
  for (const t of timed) {
    const role = roleOf.get(t.item.personRef);
    if (role === 'bride') brideEnd = Math.max(brideEnd, t.end);
    else if (role === 'companion') companionEnd = Math.max(companionEnd, t.end);
  }
  if (brideEnd > -Infinity && brideEnd < companionEnd) {
    warnings.push({
      code: 'BRIDE_NOT_LAST',
      message: 'A noiva não é a última a terminar; alguma acompanhante termina depois.',
    });
  }

  return { ok: violations.length === 0, violations, warnings };
}

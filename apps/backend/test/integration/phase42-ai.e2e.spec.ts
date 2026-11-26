import { adminPrisma } from './setup';
import { buildHeuristicProposal } from '../../src/bridal/ai/heuristic-scheduler';
import type { ScheduleContext } from '../../src/bridal/ai/ai-schedule.schema';
import { FakeAnthropic } from './helpers/fake-anthropic';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertConfirmedTimelineRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { markFixed, markServesBridal } from './helpers/phase11-fixtures';

const SUGGEST = `mutation($groupId: UUID!) {
  suggestBridalSchedule(groupId: $groupId) {
    suggestion {
      id source fallbackReason readyBy companionReadyBy cached warnings
      items { groupMemberId role serviceId professionalId professionalIsFixed startsAt endsAt }
      unscheduled { groupMemberId serviceId reason }
    }
    errors { code message field }
  }
}`;
const CONFIRM = `mutation($input: ConfirmBridalScheduleInput!) {
  confirmBridalSchedule(input: $input) {
    appointmentIds
    errors { code message field }
  }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
/** Horário local de São Paulo (UTC-3) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}
function heuristicFromPrompt(args: unknown) {
  const content = (args as { messages: { content: string }[] }).messages[0].content;
  const ctx = JSON.parse(content.split('\n')[0]) as ScheduleContext;
  const { proposal } = buildHeuristicProposal(ctx);
  return { ...proposal, rationale: 'fake' };
}

type Err = { code: string; message: string; field: string | null };
type Item = {
  groupMemberId: string;
  role: string;
  serviceId: string;
  professionalId: string;
  professionalIsFixed: boolean;
  startsAt: string;
  endsAt: string;
};
type Suggestion = {
  id: string;
  source: string;
  fallbackReason: string | null;
  cached: boolean;
  warnings: string[];
  companionReadyBy: string;
  items: Item[];
  unscheduled: { groupMemberId: string; serviceId: string; reason: string | null }[];
};

describe('Fase 4.2 - sugestão de agenda por IA com cronograma confirmado', () => {
  const fake = new FakeAnthropic();
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p42ai-%'`;
  const eventDay = localDay(75);

  beforeAll(async () => {
    w = await createPhase4World('p42ai', { anthropicClient: fake });
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  beforeEach(async () => {
    fake.calls = [];
    fake.next = [];
    await markFixed([w.members.proA, w.members.proB], false);
    await markServesBridal([w.members.proA, w.members.proB], true);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM cash_movements WHERE organization_id IN (${orgFilter})`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM client_credit_movements WHERE organization_id IN (${orgFilter})`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (${orgFilter})`,
    );
  });

  /** Noiva (make + penteado) e 2 acompanhantes; pronta até 17:00; registro 15:30. */
  async function newGroup(withTimeline: boolean) {
    const g = await insertBridalGroupRow(w, {
      companions: 2,
      eventDate: eventDay,
      readyBy: at(eventDay, 17),
    });
    const plan = (groupMemberId: string, serviceId: string, sortOrder: number) =>
      adminPrisma.bridalMemberService.create({
        data: { organizationId: w.orgId, groupMemberId, serviceId, purpose: 'event', sortOrder },
      });
    await plan(g.brideMemberId, w.serviceId, 0);
    await plan(g.brideMemberId, w.serviceBId, 1);
    for (const m of g.companionMemberIds) await plan(m, w.serviceBId, 0);
    if (!withTimeline) return g;

    const mk = (
      professionalId: string,
      serviceId: string,
      s: [number, number],
      e: [number, number],
    ) =>
      adminPrisma.appointment.create({
        data: {
          organizationId: w.orgId,
          professionalId,
          clientId: w.clientId,
          serviceId,
          bridalGroupId: g.groupId,
          purpose: 'event',
          startsAt: new Date(at(eventDay, s[0], s[1])),
          endsAt: new Date(at(eventDay, e[0], e[1])),
          status: 'scheduled',
        },
      });
    const make = await mk(w.members.proA, w.serviceId, [12, 30], [14, 0]);
    const hair = await mk(w.members.proB, w.serviceBId, [14, 0], [15, 30]);
    await insertConfirmedTimelineRow(w, {
      groupId: g.groupId,
      departureTime: '15:00',
      departureAt: at(eventDay, 15),
      registryStartsAt: at(eventDay, 15, 30),
      make: {
        professionalId: w.members.proA,
        serviceId: w.serviceId,
        startsAt: make.startsAt.toISOString(),
        endsAt: make.endsAt.toISOString(),
        appointmentId: make.id,
      },
      hair: {
        professionalId: w.members.proB,
        serviceId: w.serviceBId,
        startsAt: hair.startsAt.toISOString(),
        endsAt: hair.endsAt.toISOString(),
        appointmentId: hair.id,
      },
    });
    return g;
  }

  const suggest = async (groupId: string) => {
    const res = await gqlAs(w, w.tokens.admin)(SUGGEST, { groupId });
    return res.data.suggestBridalSchedule as { suggestion: Suggestion | null; errors: Err[] };
  };
  const confirm = async (input: Record<string, unknown>) =>
    (await gqlAs(w, w.tokens.admin)(CONFIRM, { input })).data.confirmBridalSchedule as {
      appointmentIds: string[];
      errors: Err[];
    };
  const toInput = (items: Item[]) =>
    items.map(({ groupMemberId, serviceId, professionalId, startsAt, endsAt }) => ({
      groupMemberId,
      serviceId,
      professionalId,
      startsAt,
      endsAt,
    }));

  it('com cronograma confirmado: sugere só as acompanhantes, até o registro e fora da janela da noiva', async () => {
    const g = await newGroup(true);
    const r = await suggest(g.groupId);
    expect(r.errors).toEqual([]);
    const s = r.suggestion!;
    expect(s.items.length).toBe(2);
    expect(s.items.some((i) => i.groupMemberId === g.brideMemberId)).toBe(false);
    const registry = Date.parse(at(eventDay, 15, 30));
    for (const i of s.items) {
      expect(Date.parse(i.endsAt)).toBeLessThanOrEqual(registry);
      const a = Date.parse(i.startsAt);
      const b = Date.parse(i.endsAt);
      const clash = (pro: string, from: string, to: string) =>
        i.professionalId === pro && a < Date.parse(to) && b > Date.parse(from);
      expect(clash(w.members.proA, at(eventDay, 12, 30), at(eventDay, 14))).toBe(false);
      expect(clash(w.members.proB, at(eventDay, 14), at(eventDay, 15, 30))).toBe(false);
    }
  });

  it('Claude (fake) propondo acompanhante 15:00-16:00 é rejeitado (AFTER_READY_BY) e cai na heurística', async () => {
    const g = await newGroup(true);
    const late = (args: unknown) => {
      const p = heuristicFromPrompt(args);
      return {
        ...p,
        items: p.items.map((i, idx) =>
          idx === 0 ? { ...i, startsAt: at(eventDay, 15), endsAt: at(eventDay, 16) } : i,
        ),
      };
    };
    fake.respondWith(late).respondWith(late);
    const r = await suggest(g.groupId);
    expect(r.errors).toEqual([]);
    expect(r.suggestion).toMatchObject({ source: 'heuristic', fallbackReason: 'INVALID_OUTPUT' });
    for (const i of r.suggestion!.items) {
      expect(Date.parse(i.endsAt)).toBeLessThanOrEqual(Date.parse(at(eventDay, 15, 30)));
    }
  });

  it('confirmar cria só as acompanhantes; item estourando o registro é barrado', async () => {
    const g = await newGroup(true);
    const s = (await suggest(g.groupId)).suggestion!;
    const late = toInput(s.items);
    late[0] = { ...late[0], startsAt: at(eventDay, 15), endsAt: at(eventDay, 16) };
    // A revalidação da IA (readyBy limitado ao registro) barra antes da guarda geral
    // (TIMELINE_AFTER_REGISTRY, coberta em phase42-guard): defesa em profundidade.
    const rLate = await confirm({ groupId: g.groupId, items: late });
    expect(rLate.appointmentIds).toEqual([]);
    expect(rLate.errors.length).toBeGreaterThan(0);
    expect(rLate.errors.every((e) => e.code === 'INVALID_PROPOSAL')).toBe(true);

    // O override de ADMIN não contorna a revalidação da IA: continua INVALID_PROPOSAL.
    const rOver = await confirm({
      groupId: g.groupId,
      items: late,
      timelineOverride: { reason: 'cliente pediu encaixe tardio' },
    });
    expect(rOver.appointmentIds).toEqual([]);
    expect(rOver.errors.every((e) => e.code === 'INVALID_PROPOSAL')).toBe(true);

    const rOk = await confirm({ groupId: g.groupId, items: toInput(s.items) });
    expect(rOk.errors).toEqual([]);
    expect(rOk.appointmentIds).toHaveLength(2);
  });

  it('outro agendamento de acompanhante no grupo: ALREADY_SCHEDULED continua valendo', async () => {
    const g = await newGroup(true);
    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceBId,
        bridalGroupId: g.groupId,
        purpose: 'event',
        startsAt: new Date(at(eventDay, 9)),
        endsAt: new Date(at(eventDay, 10)),
        status: 'scheduled',
      },
    });
    const r = await suggest(g.groupId);
    expect(r.suggestion).toBeNull();
    expect(r.errors[0].code).toBe('ALREADY_SCHEDULED');
  });

  it('sem cronograma: sugestão igual à de antes (inclui a noiva)', async () => {
    const g = await newGroup(false);
    fake.respondWith(heuristicFromPrompt);
    const r = await suggest(g.groupId);
    expect(r.errors).toEqual([]);
    expect(r.suggestion!.source).toBe('claude');
    expect(r.suggestion!.items).toHaveLength(4);
    expect(r.suggestion!.items.some((i) => i.groupMemberId === g.brideMemberId)).toBe(true);
  });

  describe('Fase 11 - prioridade de fixas', () => {
    it('nenhuma fixa e propostas sem prioridade: Claude aceita e vem professionalIsFixed=false', async () => {
      const g = await newGroup(false);
      fake.respondWith(heuristicFromPrompt);
      const r = await suggest(g.groupId);
      expect(r.suggestion!.source).toBe('claude');
      expect(r.suggestion!.items.every((i) => i.professionalIsFixed === false)).toBe(true);
      expect(Date.parse(r.suggestion!.companionReadyBy)).toBeGreaterThan(0);
    });

    it('sem cliente útil (heurística): a fixa recebe os serviços e o selo é true', async () => {
      await markFixed([w.members.proA]);
      const g = await newGroup(false);
      const r = await suggest(g.groupId); // fake sem resposta -> API_ERROR -> heurística
      expect(r.suggestion!.source).toBe('heuristic');
      const first = [...r.suggestion!.items].sort(
        (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
      )[0];
      expect(first.professionalId).toBe(w.members.proA);
      for (const i of r.suggestion!.items) {
        expect(i.professionalIsFixed).toBe(i.professionalId === w.members.proA);
      }
    });

    it('Claude usando não fixa com fixa livre nas 2 tentativas: heurística e PRIORITY_NOT_FOLLOWED no retry', async () => {
      await markFixed([w.members.proA]);
      const g = await newGroup(false);
      const bad = (args: unknown) => {
        const content = (args as { messages: { content: string }[] }).messages[0].content;
        const ctx = JSON.parse(content.split('\n')[0]) as ScheduleContext;
        // todas as pessoas/serviços sequenciais na não fixa (proB), um depois do outro
        const nonFixed = ctx.professionals.find((x) => !x.isFixed)!;
        let t = Date.parse(ctx.dayStart);
        const items = ctx.persons.flatMap((pe) =>
          pe.services.map((sv) => {
            const startsAt = new Date(t).toISOString();
            t += sv.durationMinutes * 60_000;
            return {
              personRef: pe.ref,
              serviceId: sv.serviceId,
              professionalId: nonFixed.id,
              startsAt,
              endsAt: new Date(t).toISOString(),
            };
          }),
        );
        return { items, rationale: 'x' };
      };
      fake.respondWith(bad).respondWith(bad);
      const r = await suggest(g.groupId);
      expect(r.errors).toEqual([]);
      expect(r.suggestion).toMatchObject({ source: 'heuristic', fallbackReason: 'INVALID_OUTPUT' });
      expect(fake.calls).toHaveLength(2);
      expect(fake.contentOf(1)).toContain('PRIORITY_NOT_FOLLOWED');
    });

    it('hash muda depois de markFixed: segunda sugestão não vem do cache', async () => {
      const g = await newGroup(false);
      fake.respondWith(heuristicFromPrompt).respondWith(heuristicFromPrompt);
      const a = (await suggest(g.groupId)).suggestion!;
      await markFixed([w.members.proA]);
      const b = (await suggest(g.groupId)).suggestion!;
      expect(a.cached).toBe(false);
      expect(b.cached).toBe(false);
      expect(fake.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('noiva sem profissional que atende noiva: unscheduled NO_ELIGIBLE_PROFESSIONAL + aviso', async () => {
      await markServesBridal([w.members.proA, w.members.proB], false);
      const g = await newGroup(false);
      const r = await suggest(g.groupId);
      const s = r.suggestion!;
      const bride = s.unscheduled.filter((u) => u.groupMemberId === g.brideMemberId);
      expect(bride.length).toBeGreaterThan(0);
      expect(bride.every((u) => u.reason === 'NO_ELIGIBLE_PROFESSIONAL')).toBe(true);
      expect(s.warnings.some((x) => x.includes('Atende noiva/debutante'))).toBe(true);
    });

    it('acompanhante com limite cedo demais: NO_FREE_PROFESSIONAL_BEFORE_LIMIT', async () => {
      const g = await newGroup(false);
      await adminPrisma.bridalGroup.update({
        where: { id: g.groupId },
        data: { companionsReadyBy: new Date(at(eventDay, 0, 30)) },
      });
      const r = await suggest(g.groupId);
      const s = r.suggestion!;
      const comp = s.unscheduled.filter((u) => g.companionMemberIds.includes(u.groupMemberId));
      expect(comp.length).toBeGreaterThan(0);
      expect(comp.every((u) => u.reason === 'NO_FREE_PROFESSIONAL_BEFORE_LIMIT')).toBe(true);
    });

    it('grupo debutante: sem profissional que atende debutante também cai em NO_ELIGIBLE_PROFESSIONAL', async () => {
      await markServesBridal([w.members.proA, w.members.proB], false);
      const g = await insertBridalGroupRow(w, {
        companions: 1,
        eventDate: eventDay,
        readyBy: at(eventDay, 17),
        eventKind: 'debutante',
      });
      await adminPrisma.bridalMemberService.create({
        data: {
          organizationId: w.orgId,
          groupMemberId: g.brideMemberId,
          serviceId: w.serviceId,
          purpose: 'event',
          sortOrder: 0,
        },
      });
      const r = await suggest(g.groupId);
      expect(r.suggestion!.unscheduled[0].reason).toBe('NO_ELIGIBLE_PROFESSIONAL');
    });

    it('confirm aceita a troca manual de fixa por não fixa (sem regra de prioridade)', async () => {
      const g = await newGroup(false);
      await markFixed([w.members.proA]);
      const s = (await suggest(g.groupId)).suggestion!;
      expect(s.items.some((i) => i.professionalId === w.members.proA)).toBe(true);
      // Reescreve tudo em sequência na não fixa (proB): válido, mas fora da prioridade.
      const sorted = [...s.items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      let t = Date.parse(at(eventDay, 9));
      const items = sorted.map((i) => {
        const dur = Date.parse(i.endsAt) - Date.parse(i.startsAt);
        const out = {
          groupMemberId: i.groupMemberId,
          serviceId: i.serviceId,
          professionalId: w.members.proB,
          startsAt: new Date(t).toISOString(),
          endsAt: new Date(t + dur).toISOString(),
        };
        t += dur;
        return out;
      });
      const r = await confirm({ groupId: g.groupId, items });
      expect(r.errors.filter((e) => e.code === 'INVALID_PROPOSAL')).toEqual([]);
    });
  });
});

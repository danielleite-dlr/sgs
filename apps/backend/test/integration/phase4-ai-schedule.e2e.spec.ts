import { adminPrisma } from './setup';
import { buildHeuristicProposal } from '../../src/bridal/ai/heuristic-scheduler';
import type { ScheduleContext } from '../../src/bridal/ai/ai-schedule.schema';
import { FakeAnthropic } from './helpers/fake-anthropic';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const SUGGEST = `mutation($groupId: UUID!) {
  suggestBridalSchedule(groupId: $groupId) {
    suggestion {
      id source model cached fallbackReason warnings dayStart dayEnd readyBy
      items { personRef groupMemberId personLabel role serviceId serviceName professionalId professionalName startsAt endsAt }
      unscheduled { groupMemberId serviceId }
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

/** Proposta válida calculada pela heurística a partir do contexto enviado ao "modelo". */
function heuristicFromPrompt(args: unknown) {
  const content = (args as { messages: { content: string }[] }).messages[0].content;
  const ctx = JSON.parse(content.split('\n')[0]) as ScheduleContext;
  const { proposal } = buildHeuristicProposal(ctx);
  return { ...proposal, rationale: 'fake' };
}

function overlappingFromPrompt(args: unknown) {
  const p = heuristicFromPrompt(args);
  const first = p.items[0];
  return {
    ...p,
    items: p.items.map((i) => ({
      ...i,
      professionalId: first.professionalId,
      startsAt: first.startsAt,
      endsAt: first.endsAt,
    })),
  };
}

type Err = { code: string; message: string; field: string | null };
type Item = {
  personRef: string;
  groupMemberId: string;
  personLabel: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
};
type Suggestion = {
  id: string;
  source: string;
  model: string | null;
  cached: boolean;
  fallbackReason: string | null;
  items: Item[];
};

describe('Fase 4 - sugestão de agenda por IA', () => {
  const fake = new FakeAnthropic();
  let w: Phase4World;
  let wNoKey: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4ai-%' OR legal_name LIKE 'p4ainokey-%'`;
  const eventDay = localDay(70);

  beforeAll(async () => {
    w = await createPhase4World('p4ai', { anthropicClient: fake });
    wNoKey = await createPhase4World('p4ainokey', { anthropicClient: null });
  });
  afterAll(async () => {
    await destroyPhase4World(wNoKey);
    await destroyPhase4World(w);
  });
  beforeEach(() => {
    fake.calls = [];
    fake.next = [];
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

  /** Noiva com 2 serviços e 4 acompanhantes com 1 serviço; pronta até 15:00 local. */
  async function newGroup(world: Phase4World) {
    const g = await insertBridalGroupRow(world, {
      companions: 4,
      eventDate: eventDay,
      readyBy: at(eventDay, 15),
    });
    const plan = (groupMemberId: string, serviceId: string, sortOrder: number) =>
      adminPrisma.bridalMemberService.create({
        data: { organizationId: world.orgId, groupMemberId, serviceId, purpose: 'event', sortOrder },
      });
    await plan(g.brideMemberId, world.serviceId, 0);
    await plan(g.brideMemberId, world.serviceBId, 1);
    for (const m of g.companionMemberIds) await plan(m, world.serviceBId, 0);
    return g;
  }

  const suggest = async (world: Phase4World, token: string, groupId: string) => {
    const res = await gqlAs(world, token)(SUGGEST, { groupId });
    return res.data.suggestBridalSchedule as {
      suggestion: Suggestion | null;
      errors: Err[];
    };
  };
  const clientNames = async (world: Phase4World) =>
    (
      await adminPrisma.client.findMany({
        where: { organizationId: world.orgId },
        select: { fullName: true },
      })
    ).map((c) => c.fullName);

  it('sem chave: heurística NO_API_KEY com as 5 pessoas e a noiva terminando até a hora pronta', async () => {
    const g = await newGroup(wNoKey);
    const r = await suggest(wNoKey, wNoKey.tokens.admin, g.groupId);
    expect(r.errors).toEqual([]);
    const s = r.suggestion!;
    expect(s.source).toBe('heuristic');
    expect(s.fallbackReason).toBe('NO_API_KEY');
    expect(s.items).toHaveLength(6);
    expect(new Set(s.items.map((i) => i.groupMemberId)).size).toBe(5);
    const brideEnd = Math.max(
      ...s.items.filter((i) => i.groupMemberId === g.brideMemberId).map((i) => Date.parse(i.endsAt)),
    );
    expect(brideEnd).toBeLessThanOrEqual(Date.parse(at(eventDay, 15)));
  });

  it('Claude (fake) válido: source claude, tokens gravados e nenhum nome de cliente no prompt', async () => {
    const g = await newGroup(w);
    fake.respondWith(heuristicFromPrompt);
    const r = await suggest(w, w.tokens.admin, g.groupId);
    expect(r.errors).toEqual([]);
    expect(r.suggestion).toMatchObject({ source: 'claude', cached: false, fallbackReason: null });
    expect(r.suggestion!.model).toBeTruthy();
    expect(r.suggestion!.items).toHaveLength(6);
    expect(r.suggestion!.items.some((i) => i.personLabel.startsWith('p4ai-'))).toBe(true);

    const row = await adminPrisma.aiScheduleSuggestion.findFirstOrThrow({
      where: { groupId: g.groupId },
    });
    expect(row).toMatchObject({ source: 'claude', inputTokens: 1200, outputTokens: 800 });

    const sent = fake.contentOf(0);
    for (const name of await clientNames(w)) expect(sent).not.toContain(name);
    expect(sent).not.toMatch(/p4ai-(noiva|acomp)/);
  });

  it('segunda chamada igual vem do cache; mudar a ocupação gera nova chamada', async () => {
    const g = await newGroup(w);
    fake.respondWith(heuristicFromPrompt).respondWith(heuristicFromPrompt);
    const a = await suggest(w, w.tokens.admin, g.groupId);
    expect(a.suggestion!.cached).toBe(false);
    expect(fake.calls).toHaveLength(1);

    const b = await suggest(w, w.tokens.admin, g.groupId);
    expect(b.suggestion).toMatchObject({ cached: true, source: 'claude', id: a.suggestion!.id });
    expect(fake.calls).toHaveLength(1);

    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(at(eventDay, 7)),
        endsAt: new Date(at(eventDay, 8)),
        status: 'scheduled',
      },
    });
    const c = await suggest(w, w.tokens.admin, g.groupId);
    expect(c.suggestion!.cached).toBe(false);
    expect(c.suggestion!.source).toBe('claude');
    expect(fake.calls).toHaveLength(2);
  });

  it('proposta com sobreposição duas vezes: heurística INVALID_OUTPUT após 2 chamadas', async () => {
    const g = await newGroup(w);
    fake.respondWith(overlappingFromPrompt).respondWith(overlappingFromPrompt);
    const r = await suggest(w, w.tokens.admin, g.groupId);
    expect(r.suggestion).toMatchObject({ source: 'heuristic', fallbackReason: 'INVALID_OUTPUT' });
    expect(fake.calls).toHaveLength(2);
    expect(fake.contentOf(1)).toContain('Violações da tentativa anterior');
  });

  it('erro da API: heurística API_ERROR', async () => {
    const g = await newGroup(w);
    fake.failWith(new Error('upstream 529'));
    const r = await suggest(w, w.tokens.admin, g.groupId);
    expect(r.suggestion).toMatchObject({ source: 'heuristic', fallbackReason: 'API_ERROR' });
  });

  it('limite diário atingido: heurística LIMIT_REACHED sem chamar a API', async () => {
    const g = await newGroup(w);
    await adminPrisma.aiScheduleSuggestion.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        organizationId: w.orgId,
        groupId: g.groupId,
        inputHash: String(i).padStart(64, '0'),
        source: 'claude',
        model: 'x',
        proposal: {},
      })),
    });
    const r = await suggest(w, w.tokens.admin, g.groupId);
    expect(r.suggestion).toMatchObject({ source: 'heuristic', fallbackReason: 'LIMIT_REACHED' });
    expect(fake.calls).toHaveLength(0);
  });

  it('sugerir não cria nada na agenda', async () => {
    const g = await newGroup(w);
    fake.respondWith(heuristicFromPrompt);
    const r = await suggest(w, w.tokens.admin, g.groupId);
    expect(r.errors).toEqual([]);
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);
  });

  it('confirmar cria agendamentos e comandas; proposta editada com sobreposição vira INVALID_PROPOSAL', async () => {
    const g = await newGroup(w);
    fake.respondWith(heuristicFromPrompt);
    const s = (await suggest(w, w.tokens.admin, g.groupId)).suggestion!;
    const toInput = (items: Item[]) =>
      items.map(({ groupMemberId, serviceId, professionalId, startsAt, endsAt }) => ({
        groupMemberId,
        serviceId,
        professionalId,
        startsAt,
        endsAt,
      }));

    const bad = toInput(s.items);
    bad[1] = { ...bad[1], professionalId: bad[0].professionalId, startsAt: bad[0].startsAt, endsAt: bad[0].endsAt };
    const rBad = (
      await gqlAs(w, w.tokens.admin)(CONFIRM, { input: { groupId: g.groupId, items: bad } })
    ).data.confirmBridalSchedule as { appointmentIds: string[]; errors: Err[] };
    expect(rBad.errors.length).toBeGreaterThan(0);
    expect(rBad.errors.every((e) => e.code === 'INVALID_PROPOSAL')).toBe(true);
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);

    const rOk = (
      await gqlAs(w, w.tokens.admin)(CONFIRM, {
        input: { groupId: g.groupId, items: toInput(s.items) },
      })
    ).data.confirmBridalSchedule as { appointmentIds: string[]; errors: Err[] };
    expect(rOk.errors).toEqual([]);
    expect(rOk.appointmentIds).toHaveLength(6);
    const rows = await adminPrisma.appointment.findMany({ where: { bridalGroupId: g.groupId } });
    expect(rows).toHaveLength(6);
    expect(rows.every((a) => a.purpose === 'event' && a.comandaId)).toBe(true);
    expect(new Set(rows.map((a) => a.comandaId)).size).toBe(5);

    // Já agendado: nova sugestão é recusada.
    const again = await suggest(w, w.tokens.admin, g.groupId);
    expect(again.suggestion).toBeNull();
    expect(again.errors[0].code).toBe('ALREADY_SCHEDULED');
  });

  it('RBAC e isolamento: atendente não sugere; outra organização não enxerga o grupo', async () => {
    const g = await newGroup(w);
    const denied = await gqlAs(w, w.tokens.attendant)(SUGGEST, { groupId: g.groupId });
    expect(denied.errors?.length ?? 0).toBeGreaterThan(0);
    expect(denied.data?.suggestBridalSchedule ?? null).toBeNull();

    const other = await suggest(w, w.tokens.otherAdmin, g.groupId);
    expect(other.suggestion).toBeNull();
    expect(other.errors[0].code).toBe('NOT_FOUND');
    expect(fake.calls).toHaveLength(0);
  });
});

import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase4-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';

const GROUP_FIELDS = `id assistantRequired assistantPending assistantMemberId assistantName assistantDailyRate`;
const SET = `mutation($g: UUID!, $m: UUID) {
  setBridalGroupAssistant(groupId: $g, memberId: $m) {
    group { ${GROUP_FIELDS} } warning errors { code message field }
  }
}`;
const CANDIDATES = `query($g: UUID!) {
  bridalAssistantCandidates(groupId: $g) { memberId displayName available reason current }
}`;
const GROUP = `query($id: UUID!) { bridalGroup(id: $id) { ${GROUP_FIELDS} } }`;
const CREATE_BLOCK = `mutation($i: CreateTimeBlockInput!) {
  createTimeBlock(input: $i) { timeBlock { id } errors { code message field } }
}`;
const DELETE_BLOCK = `mutation($id: UUID!) {
  deleteTimeBlock(id: $id) { timeBlock { id } errors { code message field } }
}`;
const CREATE_APPT = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message field } }
}`;
const CANCEL_APPT = `mutation($i: CancelAppointmentInput!) {
  cancelAppointment(input: $i) { appointment { id } errors { code message field } }
}`;

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo (fuso padrão das orgs de teste). */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(day: string, hh: number): string {
  return `${day}T${String(hh + 3).padStart(2, '0')}:00:00.000Z`;
}

type UserErr = { code: string; message: string; field: string | null };

describe('09.1 — vínculo da assistente da noiva', () => {
  let w: Phase91World;
  const D = localDay(30);
  const D2 = localDay(31);

  beforeAll(async () => {
    w = await createPhase91World('p91a');
  });
  afterAll(async () => {
    await destroyPhase91World(w);
  });
  afterEach(async () => {
    // cada teste parte de agenda limpa e da diária padrão
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
        WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM time_blocks WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM contract_settings WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);
  const bind = async (groupId: string, memberId: string | null, as = att()) => {
    const r = await as(SET, { g: groupId, m: memberId });
    return r.data.setBridalGroupAssistant as {
      group: Record<string, unknown> | null;
      warning: string | null;
      errors: UserErr[];
    };
  };
  const candidates = async (groupId: string, as = att()) =>
    (await as(CANDIDATES, { g: groupId })).data.bridalAssistantCandidates as {
      memberId: string;
      displayName: string;
      available: boolean;
      reason: string | null;
      current: boolean;
    }[];
  const escortBlocks = (groupId: string) =>
    adminPrisma.$queryRawUnsafe<
      {
        professional_id: string;
        all_day: boolean;
        note: string;
        starts_at: Date;
        ends_at: Date;
      }[]
    >(
      `SELECT professional_id, all_day, note, starts_at, ends_at FROM time_blocks
        WHERE bridal_group_id = '${groupId}'::uuid AND kind = 'acompanhamento'`,
    );
  const clientName = async (groupId: string) =>
    (
      await adminPrisma.bridalGroupMember.findFirstOrThrow({
        where: { groupId, role: 'bride' },
        include: { client: { select: { fullName: true } } },
      })
    ).client.fullName;
  const create = (eventDate: string, extra: Record<string, unknown> = {}) =>
    insertStudioBrideGroup(w, { eventDate, ...extra });

  it('grupo elegível exige assistente e fica pendente', async () => {
    const g = await create(D);
    const r = await att()(GROUP, { id: g.groupId });
    expect(r.data.bridalGroup).toMatchObject({
      assistantRequired: true,
      assistantPending: true,
      assistantMemberId: null,
    });
  });

  it('candidatas listam só profissionais marcadas e livres', async () => {
    const g = await create(D);
    const list = await candidates(g.groupId);
    const ids = list.map((c) => c.memberId);
    expect(ids).toEqual(expect.arrayContaining([w.assistants.a, w.assistants.b]));
    expect(ids).not.toContain(w.nonAssistantProId);
    for (const c of list.filter((x) => [w.assistants.a, w.assistants.b].includes(x.memberId))) {
      expect(c.available).toBe(true);
      expect(c.reason).toBeNull();
    }
  });

  it('vincula como ATTENDANT: bloqueio all-day no fuso da org, diária só para ADMIN', async () => {
    const g = await create(D);
    const r = await bind(g.groupId, w.assistants.a);
    expect(r.errors).toEqual([]);
    expect(r.warning).toBeNull();
    expect(r.group).toMatchObject({
      assistantMemberId: w.assistants.a,
      assistantName: 'p91a Assistente A',
      assistantPending: false,
      assistantDailyRate: null,
    });
    const asAdmin = await adm()(GROUP, { id: g.groupId });
    expect(asAdmin.data.bridalGroup.assistantDailyRate).toBe('220.00');

    const blocks = await escortBlocks(g.groupId);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].professional_id).toBe(w.assistants.a);
    expect(blocks[0].all_day).toBe(true);
    expect(blocks[0].note).toBe(`Acompanhando noiva ${await clientName(g.groupId)}`);
    const exp = await adminPrisma.$queryRawUnsafe<{ s: Date; e: Date }[]>(
      `SELECT ('${D}'::date)::timestamp AT TIME ZONE 'America/Sao_Paulo' AS s,
              (('${D}'::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS e`,
    );
    expect(blocks[0].starts_at.toISOString()).toBe(exp[0].s.toISOString());
    expect(blocks[0].ends_at.toISOString()).toBe(exp[0].e.toISOString());
    expect(blocks[0].ends_at.getTime() - blocks[0].starts_at.getTime()).toBe(86_400_000);
  });

  it('agenda recusa agendamento, bloqueio manual e remoção do bloqueio da assistente', async () => {
    const g = await create(D);
    expect((await bind(g.groupId, w.assistants.a)).errors).toEqual([]);

    const appt = await adm()(CREATE_APPT, {
      i: {
        professionalId: w.assistants.a,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: at(D, 10),
        endsAt: at(D, 11),
      },
    });
    expect(appt.data.createAppointment.errors[0].code).toBe('TIME_BLOCKED');

    const folga = await adm()(CREATE_BLOCK, {
      i: { kind: 'folga', professionalId: w.assistants.a, startsAt: at(D, 12), endsAt: at(D, 13) },
    });
    expect(folga.data.createTimeBlock.errors[0].code).toBe('PROFESSIONAL_ESCORTING_BRIDE');

    const manual = await adm()(CREATE_BLOCK, {
      i: {
        kind: 'acompanhamento',
        professionalId: w.assistants.a,
        startsAt: at(D, 12),
        endsAt: at(D, 13),
      },
    });
    expect(manual.data.createTimeBlock.errors).toHaveLength(1);
    expect(manual.data.createTimeBlock.errors[0].code).toBe('SYSTEM_BLOCK');

    const block = await adminPrisma.timeBlock.findFirstOrThrow({
      where: { bridalGroupId: g.groupId, kind: 'acompanhamento' },
    });
    const del = await adm()(DELETE_BLOCK, { id: block.id });
    expect(del.data.deleteTimeBlock.errors[0].code).toBe('SYSTEM_BLOCK');

    // feriado (org-wide) continua permitido
    const feriado = await adm()(CREATE_BLOCK, {
      i: { kind: 'feriado', startsAt: at(D, 0), endsAt: at(D2, 0) },
    });
    expect(feriado.data.createTimeBlock.errors).toEqual([]);
    await adm()(DELETE_BLOCK, { id: feriado.data.createTimeBlock.timeBlock.id });
  });

  it('assistente que já acompanha outra noiva no dia fica indisponível e não vincula', async () => {
    const g1 = await create(D);
    const g2 = await create(D);
    expect((await bind(g1.groupId, w.assistants.a)).errors).toEqual([]);
    const c = (await candidates(g2.groupId)).find((x) => x.memberId === w.assistants.a)!;
    expect(c.available).toBe(false);
    expect(c.reason).toBe('Já acompanha outra noiva neste dia');
    const r = await bind(g2.groupId, w.assistants.a);
    expect(r.errors[0].code).toBe('ASSISTANT_BUSY');
    expect(r.group).toBeNull();
  });

  it('assistente com atendimento no dia fica indisponível; liberada ao cancelar', async () => {
    const g = await create(D);
    const made = await adm()(CREATE_APPT, {
      i: {
        professionalId: w.assistants.b,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: at(D, 14),
        endsAt: at(D, 15),
      },
    });
    expect(made.data.createAppointment.errors).toEqual([]);
    const id = made.data.createAppointment.appointment.id;
    const c = (await candidates(g.groupId)).find((x) => x.memberId === w.assistants.b)!;
    expect(c).toMatchObject({ available: false, reason: 'Tem atendimento neste dia' });
    expect((await bind(g.groupId, w.assistants.b)).errors[0].code).toBe('ASSISTANT_BUSY');

    const cancel = await adm()(CANCEL_APPT, { i: { id, reason: 'teste' } });
    expect(cancel.data.cancelAppointment.errors).toEqual([]);
    expect((await bind(g.groupId, w.assistants.b)).errors).toEqual([]);
  });

  it('troca de assistente remove o bloqueio da anterior (D-13)', async () => {
    const g = await create(D2);
    expect((await bind(g.groupId, w.assistants.a)).errors).toEqual([]);
    const r = await bind(g.groupId, w.assistants.b);
    expect(r.errors).toEqual([]);
    expect(r.group).toMatchObject({ assistantMemberId: w.assistants.b });
    const blocks = await escortBlocks(g.groupId);
    expect(blocks.map((b) => b.professional_id)).toEqual([w.assistants.b]);
    const forA = await adminPrisma.timeBlock.count({
      where: { professionalId: w.assistants.a, kind: 'acompanhamento' },
    });
    expect(forA).toBe(0);
  });

  it('a diária fica congelada no vínculo (D-08)', async () => {
    const g1 = await create(D);
    expect((await bind(g1.groupId, w.assistants.a)).errors).toEqual([]);
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO contract_settings (organization_id, bridal_assistant_daily_rate)
       VALUES ('${w.orgId}'::uuid, 250.00)
       ON CONFLICT (organization_id) DO UPDATE SET bridal_assistant_daily_rate = 250.00`,
    );
    const g4 = await create(D2);
    expect((await bind(g4.groupId, w.assistants.b)).errors).toEqual([]);
    const rate = async (id: string) =>
      (await adm()(GROUP, { id })).data.bridalGroup.assistantDailyRate;
    expect(await rate(g4.groupId)).toBe('250.00');
    expect(await rate(g1.groupId)).toBe('220.00');
  });

  it('recusa grupo externo, debutante e pacote sem a flag', async () => {
    const ext = await create(D, { locationKind: 'external' });
    expect((await bind(ext.groupId, w.assistants.a)).errors[0].code).toBe('ASSISTANT_NOT_ALLOWED');
    const deb = await create(D, { eventKind: 'debutante' });
    expect((await bind(deb.groupId, w.assistants.a)).errors[0].code).toBe('ASSISTANT_NOT_ALLOWED');
    const noFlag = await create(D, { packageId: w.packageId });
    expect((await bind(noFlag.groupId, w.assistants.a)).errors[0].code).toBe(
      'ASSISTANT_NOT_ALLOWED',
    );
    const view = (await att()(GROUP, { id: noFlag.groupId })).data.bridalGroup;
    expect(view).toMatchObject({ assistantRequired: false, assistantPending: false });
  });

  it('só profissionais com a função Assistente da Noiva podem ser vinculadas', async () => {
    const g = await create(D);
    const r = await bind(g.groupId, w.nonAssistantProId);
    expect(r.errors[0].code).toBe('NOT_A_BRIDAL_ASSISTANT');
  });

  it('PROFESSIONAL não vincula nem lista candidatas', async () => {
    const g = await create(D);
    const set = await gqlAs(w, w.tokens.proA)(SET, { g: g.groupId, m: w.assistants.a });
    expect(JSON.stringify(set.errors)).toMatch(/FORBIDDEN/);
    const list = await gqlAs(w, w.tokens.proA)(CANDIDATES, { g: g.groupId });
    expect(JSON.stringify(list.errors)).toMatch(/FORBIDDEN/);
  });

  it('ADMIN e MANAGER também vinculam', async () => {
    const g = await create(D);
    expect((await bind(g.groupId, w.assistants.a, gqlAs(w, w.tokens.manager))).errors).toEqual([]);
    expect((await bind(g.groupId, w.assistants.b, adm())).errors).toEqual([]);
  });

  it('remoção manual limpa colunas e bloqueio e volta a ficar pendente', async () => {
    const g = await create(D);
    expect((await bind(g.groupId, w.assistants.a)).errors).toEqual([]);
    const r = await bind(g.groupId, null);
    expect(r.errors).toEqual([]);
    expect(r.group).toMatchObject({
      assistantMemberId: null,
      assistantName: null,
      assistantPending: true,
    });
    expect(await escortBlocks(g.groupId)).toHaveLength(0);
    const row = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: g.groupId } });
    expect(row.assistantDailyRate).toBeNull();
    expect(row.assistantLinkedAt).toBeNull();
  });

  it('evento já passado não fica pendente', async () => {
    const g = await create(localDay(-1));
    const view = (await att()(GROUP, { id: g.groupId })).data.bridalGroup;
    expect(view).toMatchObject({ assistantRequired: true, assistantPending: false });
  });

  it('outra organização não enxerga nem altera o grupo', async () => {
    const g = await create(D);
    const other = gqlAs(w, w.tokens.otherAdmin);
    expect(await candidates(g.groupId, other)).toEqual([]);
    const r = await bind(g.groupId, w.assistants.a, other);
    expect(r.errors[0].code).toBe('NOT_FOUND');
  });
});

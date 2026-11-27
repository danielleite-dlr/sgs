import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

/** Prefixo dos membros criados aqui; o mundo usa 'zz1119w'. */
const TAG = 'zz1119';

const CREATE_MEMBER = `mutation($i: CreateMemberInput!) { createMember(input: $i) {
  member { id roleName isProfessional } errors { code message field } } }`;
const PROS = `query($s: UUID!, $br: Boolean) { professionalsForService(serviceId: $s, bridal: $br) { id } }`;
const SUGGEST = `query($s: UUID!, $a: DateTime!, $b: DateTime!) {
  suggestProfessionals(serviceId: $s, startsAt: $a, endsAt: $b) { professionalId free suggested }
}`;
const MEMBERS = `query { members { id isProfessional } }`;
const CREATE_APPT = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message field } } }`;
const MOVE = `mutation($i: MoveAppointmentInput!) {
  moveAppointment(input: $i) { appointment { id } errors { code message field } } }`;
const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) { appointmentIds errors { code message field } } }`;
const AI = `mutation($groupId: UUID!) {
  suggestBridalSchedule(groupId: $groupId) {
    suggestion { source items { professionalId } }
    errors { code message field } } }`;
const BLOCK = `mutation($i: CreateTimeBlockInput!) {
  createTimeBlock(input: $i) { timeBlock { id } errors { code message field } } }`;
const SET_ASSISTANT = `mutation($g: UUID!, $m: UUID) {
  setBridalGroupAssistant(groupId: $g, memberId: $m) {
    group { id assistantMemberId } errors { code message field } } }`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
/** Horário local de São Paulo (UTC-3) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

type Err = { code: string; message: string; field: string | null };

describe('11 G-01 — assistente fora do agendamento', () => {
  let w: Phase4World;
  let assistantId: string;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'zz1119w-%'`;
  const day = localDay(40);
  const eventDay = localDay(70);

  const adm = () => gqlAs(w, w.tokens.admin);

  const cleanupMembers = async () => {
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
        WHERE assistant_member_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM time_blocks WHERE professional_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE professional_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_categories WHERE member_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE '${TAG} %'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE full_name LIKE '${TAG} %'`);
  };

  beforeAll(async () => {
    await cleanupMembers();
    w = await createPhase4World('zz1119w', { anthropicClient: null });
    const res = await adm()(CREATE_MEMBER, {
      i: {
        displayName: `${TAG} Assistente`,
        phone: '(11) 98765-4321',
        pixKey: '123.456.789-09',
        roleName: 'ASSISTANT',
      },
    });
    expect(res.data.createMember.errors).toEqual([]);
    assistantId = res.data.createMember.member.id;
  });
  afterAll(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await cleanupMembers();
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM time_blocks WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
        WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  it('professionalsForService (comum e noiva) não traz a assistente', async () => {
    for (const br of [null, true]) {
      const res = await adm()(PROS, { s: w.serviceId, br });
      expect(res.errors).toBeUndefined();
      const ids = (res.data.professionalsForService as { id: string }[]).map((p) => p.id);
      expect(ids).not.toContain(assistantId);
      expect(ids).toContain(w.members.proA);
      expect(ids).toContain(w.members.proB);
    }
  });

  it('suggestProfessionals: com as demais ocupadas, a assistente não aparece e ninguém é sugerida', async () => {
    const vars = { s: w.serviceId, a: at(day, 10), b: at(day, 11) };
    const first = (await adm()(SUGGEST, vars)).data.suggestProfessionals as {
      professionalId: string;
    }[];
    for (const r of first) {
      await adminPrisma.appointment.create({
        data: {
          organizationId: w.orgId,
          professionalId: r.professionalId,
          clientId: w.clientId,
          serviceId: w.serviceId,
          startsAt: new Date(vars.a),
          endsAt: new Date(vars.b),
        },
      });
    }
    const rows = (await adm()(SUGGEST, vars)).data.suggestProfessionals as {
      professionalId: string;
      free: boolean;
      suggested: boolean;
    }[];
    expect(rows.map((r) => r.professionalId)).not.toContain(assistantId);
    expect(rows.some((r) => r.suggested)).toBe(false);
  });

  it('createAppointment comum com a assistente: PROFESSIONAL_IS_ASSISTANT', async () => {
    const res = await adm()(CREATE_APPT, {
      i: {
        professionalId: assistantId,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: at(day, 14),
        endsAt: at(day, 15),
      },
    });
    const errs = res.data.createAppointment.errors as Err[];
    expect(errs[0].code).toBe('PROFESSIONAL_IS_ASSISTANT');
    expect(errs[0].message).toContain('não faz atendimento');
    expect(res.data.createAppointment.appointment).toBeNull();
  });

  it('moveAppointment para a coluna da assistente: PROFESSIONAL_IS_ASSISTANT', async () => {
    const a = await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(at(day, 9)),
        endsAt: new Date(at(day, 10)),
      },
    });
    const res = await adm()(MOVE, {
      i: { id: a.id, professionalId: assistantId, startsAt: at(day, 9) },
    });
    expect((res.data.moveAppointment.errors as Err[])[0].code).toBe('PROFESSIONAL_IS_ASSISTANT');
    const after = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.professionalId).toBe(w.members.proA);
  });

  it('agenda do evento com acompanhante na assistente: PROFESSIONAL_IS_ASSISTANT e nada gravado', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const res = await adm()(SCHEDULE, {
      input: {
        groupId: g.groupId,
        items: [
          {
            groupMemberId: g.companionMemberIds[0],
            serviceId: w.serviceId,
            professionalId: assistantId,
            startsAt: at(eventDay, 9),
            endsAt: at(eventDay, 10),
          },
        ],
      },
    });
    const r = res.data.scheduleBridalEvent as { errors: Err[] };
    expect(r.errors[0].code).toBe('PROFESSIONAL_IS_ASSISTANT');
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);
  });

  it('sugestão do grupo (heurística, sem chave): nenhuma linha usa a assistente', async () => {
    const g = await insertBridalGroupRow(w, {
      companions: 2,
      eventDate: eventDay,
      readyBy: at(eventDay, 15),
    });
    for (const m of [g.brideMemberId, ...g.companionMemberIds]) {
      await adminPrisma.bridalMemberService.create({
        data: {
          organizationId: w.orgId,
          groupMemberId: m,
          serviceId: w.serviceBId,
          purpose: 'event',
          sortOrder: 0,
        },
      });
    }
    const res = await adm()(AI, { groupId: g.groupId });
    const r = res.data.suggestBridalSchedule as {
      suggestion: { source: string; items: { professionalId: string }[] } | null;
      errors: Err[];
    };
    expect(r.errors).toEqual([]);
    expect(r.suggestion!.source).toBe('heuristic');
    expect(r.suggestion!.items.length).toBeGreaterThan(0);
    expect(r.suggestion!.items.map((i) => i.professionalId)).not.toContain(assistantId);
  });

  it('a assistente segue na grade da agenda, aceita bloqueio e vínculo com bloqueio all-day', async () => {
    const list = (await adm()(MEMBERS)).data.members as { id: string; isProfessional: boolean }[];
    expect(list.find((m) => m.id === assistantId)).toMatchObject({ isProfessional: true });

    const blk = await adm()(BLOCK, {
      i: {
        kind: 'folga',
        professionalId: assistantId,
        startsAt: at(day, 12),
        endsAt: at(day, 13),
      },
    });
    expect(blk.data.createTimeBlock.errors).toEqual([]);
    expect(blk.data.createTimeBlock.timeBlock.id).toBeTruthy();

    await adminPrisma.$executeRawUnsafe(
      `UPDATE packages SET includes_bridal_assistant = true WHERE id = '${w.bridalPackageId}'::uuid`,
    );
    const g = await insertBridalGroupRow(w, { companions: 0, eventDate: eventDay });
    await adminPrisma.bridalGroup.update({
      where: { id: g.groupId },
      data: { packageId: w.bridalPackageId },
    });
    const bound = await adm()(SET_ASSISTANT, { g: g.groupId, m: assistantId });
    expect(bound.data.setBridalGroupAssistant.errors).toEqual([]);
    expect(bound.data.setBridalGroupAssistant.group.assistantMemberId).toBe(assistantId);
    const allDay = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM time_blocks WHERE professional_id = '${assistantId}'::uuid AND all_day = true`,
    );
    expect(Number(allDay[0].n)).toBeGreaterThanOrEqual(1);
  });
});

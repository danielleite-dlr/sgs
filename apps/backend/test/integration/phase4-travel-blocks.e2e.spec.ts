import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) { appointmentIds errors { code message field } }
}`;
const CANCEL = `mutation($input: CancelBridalGroupInput!) {
  cancelBridalGroup(input: $input) { group { id status } errors { code message field } }
}`;
const UPDATE_GROUP = `mutation($id: UUID!, $input: BridalGroupFieldsInput!) {
  updateBridalGroup(id: $id, input: $input) { group { id locationKind travelMinutesBefore } errors { code message field } }
}`;
const CREATE_BLOCK = `mutation($i: CreateTimeBlockInput!) {
  createTimeBlock(input: $i) { timeBlock { id } errors { code message field } }
}`;
const CREATE_APPT = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message field } }
}`;

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo (fuso padrão das orgs de teste). */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe('Fase 4 - bloqueios de deslocamento do evento externo', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4travel-%'`;
  const eventDay = localDay(60);

  beforeAll(async () => {
    w = await createPhase4World('p4travel');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);

  const newGroup = () =>
    insertBridalGroupRow(w, {
      companions: 1,
      eventDate: eventDay,
      locationKind: 'external',
      travelBefore: 30,
      travelAfter: 45,
    });
  type Group = Awaited<ReturnType<typeof newGroup>>;

  /** proA: noiva 09:00-10:00 + 10:00-10:30; proB: acompanhante 09:30-10:00. */
  const items = (g: Group) => [
    {
      groupMemberId: g.brideMemberId,
      serviceId: w.serviceId,
      professionalId: w.members.proA,
      startsAt: at(eventDay, 9),
      endsAt: at(eventDay, 10),
    },
    {
      groupMemberId: g.brideMemberId,
      serviceId: w.serviceBId,
      professionalId: w.members.proA,
      startsAt: at(eventDay, 10),
      endsAt: at(eventDay, 10, 30),
    },
    {
      groupMemberId: g.companionMemberIds[0],
      serviceId: w.serviceBId,
      professionalId: w.members.proB,
      startsAt: at(eventDay, 9, 30),
      endsAt: at(eventDay, 10),
    },
  ];
  const schedule = async (g: Group) =>
    (await att()(SCHEDULE, { input: { groupId: g.groupId, items: items(g) } })).data
      .scheduleBridalEvent as { appointmentIds: string[]; errors: { code: string }[] };

  const blocks = (groupId: string) =>
    adminPrisma.timeBlock.findMany({
      where: { bridalGroupId: groupId },
      orderBy: [{ professionalId: 'asc' }, { startsAt: 'asc' }],
    });

  it('cria 2 bloqueios deslocamento por profissional com as janelas exatas', async () => {
    const g = await newGroup();
    const r = await schedule(g);
    expect(r.errors).toEqual([]);
    const rows = await blocks(g.groupId);
    expect(rows).toHaveLength(4);
    expect(rows.every((b) => b.kind === 'deslocamento' && b.bridalGroupId === g.groupId)).toBe(true);
    const win = (prof: string) =>
      rows
        .filter((b) => b.professionalId === prof)
        .map((b) => [b.startsAt.toISOString(), b.endsAt.toISOString()]);
    // proA: antes 08:30-09:00, depois 10:30-11:15
    expect(win(w.members.proA)).toEqual([
      [at(eventDay, 8, 30), at(eventDay, 9)],
      [at(eventDay, 10, 30), at(eventDay, 11, 15)],
    ]);
    // proB: antes 09:00-09:30, depois 10:00-10:45
    expect(win(w.members.proB)).toEqual([
      [at(eventDay, 9), at(eventDay, 9, 30)],
      [at(eventDay, 10), at(eventDay, 10, 45)],
    ]);
    expect(rows[0].note).toContain('Deslocamento');
  });

  it('agendamento de outra cliente na janela de deslocamento impede o evento e nada é gravado', async () => {
    const g = await newGroup();
    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceBId,
        startsAt: new Date(at(eventDay, 8, 30)),
        endsAt: new Date(at(eventDay, 8, 50)),
      },
    });
    const r = await schedule(g);
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);
    expect(await blocks(g.groupId)).toHaveLength(0);
  });

  it('bloqueio deslocamento manual é recusado (SYSTEM_BLOCK)', async () => {
    const r = await adm()(CREATE_BLOCK, {
      i: {
        kind: 'deslocamento',
        professionalId: w.members.proA,
        startsAt: at(eventDay, 12),
        endsAt: at(eventDay, 13),
      },
    });
    expect(r.data.createTimeBlock.errors[0].code).toBe('SYSTEM_BLOCK');
  });

  it('novo agendamento no horário do deslocamento recebe TIME_BLOCKED; deletar o bloqueio à mão é recusado', async () => {
    const g = await newGroup();
    expect((await schedule(g)).errors).toEqual([]);
    const r = await att()(CREATE_APPT, {
      i: {
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceBId,
        startsAt: at(eventDay, 8, 30),
        endsAt: at(eventDay, 8, 50),
      },
    });
    expect(r.data.createAppointment.errors[0].code).toBe('TIME_BLOCKED');

    const [block] = await blocks(g.groupId);
    const del = await adm()(
      `mutation($id: UUID!) { deleteTimeBlock(id: $id) { errors { code } } }`,
      { id: block.id },
    );
    expect(del.data.deleteTimeBlock.errors[0].code).toBe('SYSTEM_BLOCK');
  });

  it('mudar o grupo para estúdio remove os bloqueios', async () => {
    const g = await newGroup();
    expect((await schedule(g)).errors).toEqual([]);
    expect(await blocks(g.groupId)).toHaveLength(4);
    const row = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: g.groupId } });
    const r = await adm()(UPDATE_GROUP, {
      id: g.groupId,
      input: {
        name: row.name,
        eventDate: row.eventDate.toISOString().slice(0, 10),
        locationKind: 'studio',
      },
    });
    expect(r.data.updateBridalGroup.errors).toEqual([]);
    expect(await blocks(g.groupId)).toHaveLength(0);
  });

  it('aumentar o deslocamento recalcula as janelas', async () => {
    const g = await newGroup();
    expect((await schedule(g)).errors).toEqual([]);
    const row = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: g.groupId } });
    const r = await adm()(UPDATE_GROUP, {
      id: g.groupId,
      input: {
        name: row.name,
        eventDate: row.eventDate.toISOString().slice(0, 10),
        locationKind: 'external',
        locationAddress: 'Rua do Evento, 100',
        travelMinutesBefore: 60,
        travelMinutesAfter: 45,
      },
    });
    expect(r.data.updateBridalGroup.errors).toEqual([]);
    const proA = (await blocks(g.groupId)).filter((b) => b.professionalId === w.members.proA);
    expect(proA[0].startsAt.toISOString()).toBe(at(eventDay, 8));
  });

  it('cancelar o grupo remove os bloqueios', async () => {
    const g = await newGroup();
    expect((await schedule(g)).errors).toEqual([]);
    const r = await adm()(CANCEL, { input: { id: g.groupId, reason: 'Evento cancelado' } });
    expect(r.data.cancelBridalGroup.errors).toEqual([]);
    expect(await blocks(g.groupId)).toHaveLength(0);
    expect(
      await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId, status: 'cancelled' } }),
    ).toBe(3);
  });
});

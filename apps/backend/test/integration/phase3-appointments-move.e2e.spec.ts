import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';

const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id startsAt endsAt professionalId depositAmount } errors { code message field } }
}`;
const MOVE = `mutation($i: MoveAppointmentInput!) {
  moveAppointment(input: $i) { appointment { id startsAt endsAt professionalId } errors { code message field } }
}`;

describe('Phase 3 - criar e mover agendamentos', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3move');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM time_blocks WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const seed = (
    startsAt: string,
    endsAt: string,
    opts: { pro?: string; status?: string } = {},
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: opts.pro ?? w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status: opts.status ?? 'scheduled',
      },
    });
  const create = async (startsAt: string, endsAt: string, pro = w.members.proA) =>
    (
      await att()(CREATE, {
        i: { professionalId: pro, clientId: w.clientId, serviceId: w.serviceId, startsAt, endsAt },
      })
    ).data.createAppointment;
  const move = async (id: string, professionalId: string, startsAt: string) =>
    (await att()(MOVE, { i: { id, professionalId, startsAt } })).data.moveAppointment;

  it('create devolve depositAmount com 2 casas', async () => {
    const r = await create('2030-04-01T10:00:00Z', '2030-04-01T11:00:00Z');
    expect(r.errors).toEqual([]);
    expect(r.appointment.depositAmount).toBe('0.00');
  });

  it('create sobre appointment in_progress -> SLOT_TAKEN', async () => {
    await seed('2030-04-02T10:00:00Z', '2030-04-02T11:00:00Z', { status: 'in_progress' });
    const r = await create('2030-04-02T10:30:00Z', '2030-04-02T11:30:00Z');
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
  });

  it('create sobre time_block do profissional -> TIME_BLOCKED', async () => {
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        kind: 'intervalo',
        startsAt: new Date('2030-04-03T12:00:00Z'),
        endsAt: new Date('2030-04-03T13:00:00Z'),
      },
    });
    const r = await create('2030-04-03T12:30:00Z', '2030-04-03T13:30:00Z');
    expect(r.errors[0].code).toBe('TIME_BLOCKED');
    expect(r.errors[0].message).toContain('intervalo');
    const other = await create('2030-04-03T12:30:00Z', '2030-04-03T13:30:00Z', w.members.proB);
    expect(other.errors).toEqual([]);
  });

  it('move para horário livre na mesma raia preserva a duração', async () => {
    const a = await seed('2030-04-04T10:00:00Z', '2030-04-04T11:30:00Z');
    const r = await move(a.id, w.members.proA, '2030-04-04T14:00:00Z');
    expect(r.errors).toEqual([]);
    expect(new Date(r.appointment.startsAt).toISOString()).toBe('2030-04-04T14:00:00.000Z');
    expect(new Date(r.appointment.endsAt).toISOString()).toBe('2030-04-04T15:30:00.000Z');
  });

  it('move para outro profissional troca a raia', async () => {
    const a = await seed('2030-04-05T10:00:00Z', '2030-04-05T11:00:00Z');
    const r = await move(a.id, w.members.proB, '2030-04-05T10:00:00Z');
    expect(r.errors).toEqual([]);
    expect(r.appointment.professionalId).toBe(w.members.proB);
  });

  it('move que sobrepõe a si mesmo é permitido (deslocar 15 min)', async () => {
    const a = await seed('2030-04-06T10:00:00Z', '2030-04-06T11:00:00Z');
    const r = await move(a.id, w.members.proA, '2030-04-06T10:15:00Z');
    expect(r.errors).toEqual([]);
  });

  it('move sobre agendamento existente -> SLOT_TAKEN e original inalterado', async () => {
    const a = await seed('2030-04-07T10:00:00Z', '2030-04-07T11:00:00Z');
    await seed('2030-04-07T14:00:00Z', '2030-04-07T15:00:00Z');
    const r = await move(a.id, w.members.proA, '2030-04-07T14:30:00Z');
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
    const after = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.startsAt.toISOString()).toBe('2030-04-07T10:00:00.000Z');
  });

  it('move sobre bloqueio -> TIME_BLOCKED', async () => {
    const a = await seed('2030-04-08T10:00:00Z', '2030-04-08T11:00:00Z');
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: null,
        kind: 'feriado',
        startsAt: new Date('2030-04-09T00:00:00Z'),
        endsAt: new Date('2030-04-10T00:00:00Z'),
        allDay: true,
      },
    });
    const r = await move(a.id, w.members.proA, '2030-04-09T10:00:00Z');
    expect(r.errors[0].code).toBe('TIME_BLOCKED');
  });

  it('move de cancelled/completed -> INVALID_STATUS', async () => {
    const c = await seed('2030-04-10T10:00:00Z', '2030-04-10T11:00:00Z', { status: 'cancelled' });
    const d = await seed('2030-04-11T10:00:00Z', '2030-04-11T11:00:00Z', { status: 'completed' });
    expect((await move(c.id, w.members.proA, '2030-04-12T10:00:00Z')).errors[0].code).toBe('INVALID_STATUS');
    expect((await move(d.id, w.members.proA, '2030-04-12T10:00:00Z')).errors[0].code).toBe('INVALID_STATUS');
  });

  it('move para profissional que não atende a categoria', async () => {
    const other = await adminPrisma.category.create({
      data: { organizationId: w.orgId, name: 'p3move-Unhas' },
    });
    await adminPrisma.memberCategory.create({
      data: { organizationId: w.orgId, memberId: w.members.proB, categoryId: other.id },
    });
    try {
      const a = await seed('2030-04-13T10:00:00Z', '2030-04-13T11:00:00Z');
      const r = await move(a.id, w.members.proB, '2030-04-13T10:00:00Z');
      expect(r.errors[0].code).toBe('PROFESSIONAL_DOES_NOT_SERVE_CATEGORY');
    } finally {
      await adminPrisma.memberCategory.deleteMany({ where: { memberId: w.members.proB } });
      await adminPrisma.category.delete({ where: { id: other.id } });
    }
  });

  it('move para profissional inativo -> PROFESSIONAL_NOT_FOUND', async () => {
    const a = await seed('2030-04-14T10:00:00Z', '2030-04-14T11:00:00Z');
    await adminPrisma.member.update({ where: { id: w.members.proB }, data: { status: 'inactive' } });
    try {
      const r = await move(a.id, w.members.proB, '2030-04-14T10:00:00Z');
      expect(r.errors[0].code).toBe('PROFESSIONAL_NOT_FOUND');
    } finally {
      await adminPrisma.member.update({ where: { id: w.members.proB }, data: { status: 'active' } });
    }
  });

  it('move de id inexistente -> NOT_FOUND', async () => {
    const r = await move('00000000-0000-4000-8000-000000000000', w.members.proA, '2030-04-15T10:00:00Z');
    expect(r.errors[0].code).toBe('NOT_FOUND');
  });
});

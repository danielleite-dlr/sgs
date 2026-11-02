import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';

const CREATE_BLOCK = `mutation($i: CreateTimeBlockInput!) {
  createTimeBlock(input: $i) { timeBlock { id kind professionalId allDay } errors { code message field } }
}`;
const DELETE_BLOCK = `mutation($id: UUID!) {
  deleteTimeBlock(id: $id) { timeBlock { id } errors { code } }
}`;
const LIST = `query($s: DateTime!, $e: DateTime!, $p: UUID) {
  timeBlocks(startsAt: $s, endsAt: $e, professionalId: $p) { id kind professionalId }
}`;
const CREATE_APPT = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message } }
}`;

describe('Phase 3 - bloqueios de agenda', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3blk');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    for (const t of ['time_blocks', 'appointments']) {
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM ${t} WHERE organization_id = '${w.orgId}'::uuid`,
      );
    }
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const block = async (i: Record<string, unknown>) =>
    (await att()(CREATE_BLOCK, { i })).data.createTimeBlock;
  const appt = async (pro: string, startsAt: string, endsAt: string) =>
    (
      await att()(CREATE_APPT, {
        i: { professionalId: pro, clientId: w.clientId, serviceId: w.serviceId, startsAt, endsAt },
      })
    ).data.createAppointment;
  const seed = (pro: string, startsAt: string, endsAt: string) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: pro,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      },
    });

  it('intervalo do profissional impede agendar nele', async () => {
    const b = await block({
      kind: 'intervalo',
      professionalId: w.members.proA,
      startsAt: '2030-06-01T12:00:00Z',
      endsAt: '2030-06-01T13:00:00Z',
    });
    expect(b.errors).toEqual([]);
    expect(b.timeBlock.kind).toBe('intervalo');
    const r = await appt(w.members.proA, '2030-06-01T12:30:00Z', '2030-06-01T13:30:00Z');
    expect(r.errors[0].code).toBe('TIME_BLOCKED');
  });

  it('os 4 tipos podem ser criados', async () => {
    for (const [kind, pro] of [
      ['folga', w.members.proA],
      ['intervalo', w.members.proA],
      ['indisponibilidade', w.members.proB],
      ['feriado', null],
    ] as const) {
      const r = await block({
        kind,
        professionalId: pro,
        startsAt: '2030-06-02T08:00:00Z',
        endsAt: '2030-06-02T09:00:00Z',
      });
      expect(r.errors).toEqual([]);
    }
  });

  it('feriado org-wide impede agendar qualquer profissional', async () => {
    const b = await block({
      kind: 'feriado',
      startsAt: '2030-06-03T00:00:00Z',
      endsAt: '2030-06-04T00:00:00Z',
      allDay: true,
    });
    expect(b.errors).toEqual([]);
    expect(b.timeBlock.professionalId).toBeNull();
    for (const pro of [w.members.proA, w.members.proB]) {
      const r = await appt(pro, '2030-06-03T10:00:00Z', '2030-06-03T11:00:00Z');
      expect(r.errors[0].code).toBe('TIME_BLOCKED');
    }
  });

  it('escopo e tipo inválidos', async () => {
    const t = { startsAt: '2030-06-05T10:00:00Z', endsAt: '2030-06-05T11:00:00Z' };
    expect((await block({ kind: 'feriado', professionalId: w.members.proA, ...t })).errors[0].code).toBe('INVALID_SCOPE');
    expect((await block({ kind: 'folga', professionalId: null, ...t })).errors[0].code).toBe('INVALID_SCOPE');
    expect((await block({ kind: 'ferias', professionalId: w.members.proA, ...t })).errors[0].code).toBe('INVALID_KIND');
    expect(
      (await block({ kind: 'folga', professionalId: w.members.proA, startsAt: t.endsAt, endsAt: t.startsAt })).errors[0].code,
    ).toBe('INVALID_INTERVAL');
  });

  it('bloqueio sobre agendamento ativo é recusado', async () => {
    await seed(w.members.proA, '2030-06-06T10:00:00Z', '2030-06-06T11:00:00Z');
    const r = await block({
      kind: 'indisponibilidade',
      professionalId: w.members.proA,
      startsAt: '2030-06-06T10:30:00Z',
      endsAt: '2030-06-06T12:00:00Z',
    });
    expect(r.errors[0].code).toBe('BLOCK_OVERLAPS_APPOINTMENT');
    expect(r.errors[0].message).toContain('1 agendamento');
  });

  it('feriado num dia com agendamento de outro profissional é recusado', async () => {
    await seed(w.members.proB, '2030-06-07T10:00:00Z', '2030-06-07T11:00:00Z');
    const r = await block({
      kind: 'feriado',
      startsAt: '2030-06-07T00:00:00Z',
      endsAt: '2030-06-08T00:00:00Z',
      allDay: true,
    });
    expect(r.errors[0].code).toBe('BLOCK_OVERLAPS_APPOINTMENT');
  });

  it('listagem: bloqueios do profissional + feriados; PROFESSIONAL tem filtro forçado', async () => {
    const t = { startsAt: '2030-06-09T08:00:00Z', endsAt: '2030-06-09T09:00:00Z' };
    await block({ kind: 'folga', professionalId: w.members.proA, ...t });
    await block({ kind: 'folga', professionalId: w.members.proB, ...t });
    await block({ kind: 'feriado', ...t });
    const range = { s: '2030-06-09T00:00:00Z', e: '2030-06-10T00:00:00Z' };

    const asA = await att()(LIST, { ...range, p: w.members.proA });
    const idsA = (asA.data.timeBlocks as { professionalId: string | null }[]).map((b) => b.professionalId);
    expect(idsA.sort()).toEqual([null, w.members.proA].sort());

    const asProB = await gqlAs(w, w.tokens.proB)(LIST, { ...range, p: w.members.proA });
    const idsB = (asProB.data.timeBlocks as { professionalId: string | null }[]).map((b) => b.professionalId);
    expect(idsB.sort()).toEqual([null, w.members.proB].sort());
  });

  it('deleteTimeBlock remove; id de outra org -> NOT_FOUND', async () => {
    const b = await block({
      kind: 'folga',
      professionalId: w.members.proA,
      startsAt: '2030-06-10T08:00:00Z',
      endsAt: '2030-06-10T18:00:00Z',
    });
    const other = await gqlAs(w, w.tokens.otherAdmin)(DELETE_BLOCK, { id: b.timeBlock.id });
    expect(other.data.deleteTimeBlock.errors[0].code).toBe('NOT_FOUND');
    const ok = await att()(DELETE_BLOCK, { id: b.timeBlock.id });
    expect(ok.data.deleteTimeBlock.errors).toEqual([]);
    expect(await adminPrisma.timeBlock.count({ where: { id: b.timeBlock.id } })).toBe(0);
  });

  it('PROFESSIONAL não cria nem remove bloqueios', async () => {
    const r = await gqlAs(w, w.tokens.proA)(CREATE_BLOCK, {
      i: { kind: 'folga', professionalId: w.members.proA, startsAt: '2030-06-11T08:00:00Z', endsAt: '2030-06-11T09:00:00Z' },
    });
    expect(JSON.stringify(r.errors)).toMatch(/FORBIDDEN/);
  });

  it('createTimeBlock e createAppointment concorrentes: exatamente um vence', async () => {
    const [b, a] = await Promise.all([
      block({
        kind: 'intervalo',
        professionalId: w.members.proA,
        startsAt: '2030-06-12T15:00:00Z',
        endsAt: '2030-06-12T16:00:00Z',
      }),
      appt(w.members.proA, '2030-06-12T15:30:00Z', '2030-06-12T16:30:00Z'),
    ]);
    const blockOk = b.errors.length === 0;
    const apptOk = a.errors.length === 0;
    expect(blockOk !== apptOk).toBe(true);
  });
});

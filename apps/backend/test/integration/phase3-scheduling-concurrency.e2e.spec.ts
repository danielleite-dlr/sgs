import { Prisma } from '@prisma/client';
import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { professionalLockKey } from '../../src/database/advisory-lock';
import { isExclusionViolation } from '../../src/database/advisory-lock';
import { SLOT_TAKEN_MESSAGE, mapSchedulingError } from '../../src/appointments/scheduling-guard';

const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message field } }
}`;

describe('Phase 3 - concorrência da agenda', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3conc');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const input = (startsAt: string, endsAt: string, professionalId = w.members.proA) => ({
    professionalId,
    clientId: w.clientId,
    serviceId: w.serviceId,
    startsAt,
    endsAt,
  });
  const create = (i: ReturnType<typeof input>) =>
    gqlAs(w, w.tokens.attendant)(CREATE, { i }).then((r) => r.data.createAppointment);

  it('lock_timeout: quem espera mais que o timeout recebe SLOT_TAKEN sem travar (formato do erro 55P03)', async () => {
    // Spike do formato do erro: reproduz o SQL do guard numa transação com lock_timeout curto.
    const holder = adminPrisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${professionalLockKey(w.orgId, w.members.proA)}, 0))`;
        await tx.$executeRawUnsafe(`SELECT pg_sleep(4)`);
      },
      { timeout: 10000 },
    );
    await new Promise((r) => setTimeout(r, 200));

    let observed: unknown;
    try {
      await adminPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '300ms'`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${professionalLockKey(w.orgId, w.members.proA)}, 0))`;
      });
    } catch (e) {
      observed = e;
    }
    expect(observed).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const err = observed as Prisma.PrismaClientKnownRequestError;
    expect(err.code).toBe('P2010');
    expect((err.meta as { code?: string }).code).toBe('55P03');

    const started = Date.now();
    const result = await create(input('2030-03-01T10:00:00Z', '2030-03-01T11:00:00Z'));
    const elapsed = Date.now() - started;
    await holder;
    expect(result.appointment).toBeNull();
    expect(result.errors[0]).toMatchObject({ code: 'SLOT_TAKEN', message: SLOT_TAKEN_MESSAGE });
    expect(elapsed).toBeLessThan(4500);
  });

  it('dois creates sobrepostos com início diferente: exatamente um vence', async () => {
    const results = await Promise.all([
      create(input('2030-03-02T10:00:00Z', '2030-03-02T11:00:00Z')),
      create(input('2030-03-02T10:30:00Z', '2030-03-02T11:30:00Z')),
    ]);
    expect(results.filter((r) => r.appointment !== null)).toHaveLength(1);
    const lost = results.find((r) => r.appointment === null);
    expect(lost.errors[0]).toMatchObject({ code: 'SLOT_TAKEN', message: SLOT_TAKEN_MESSAGE });
  });

  it('10 creates paralelos sobrepostos: 1 sucesso, 9 SLOT_TAKEN, 1 linha', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        create(
          input(
            `2030-03-03T10:${String(i * 5).padStart(2, '0')}:00Z`,
            `2030-03-03T12:00:00Z`,
          ),
        ),
      ),
    );
    expect(results.filter((r) => r.appointment !== null)).toHaveLength(1);
    expect(results.filter((r) => r.errors[0]?.code === 'SLOT_TAKEN')).toHaveLength(9);
    const rows = await adminPrisma.appointment.count({ where: { organizationId: w.orgId } });
    expect(rows).toBe(1);
  });

  it('rede de segurança: insert direto sobreposto viola a exclusion constraint (formato do erro 23P01)', async () => {
    const row = (s: string, e: string) => ({
      organizationId: w.orgId,
      professionalId: w.members.proA,
      clientId: w.clientId,
      serviceId: w.serviceId,
      startsAt: new Date(s),
      endsAt: new Date(e),
    });
    await adminPrisma.appointment.create({
      data: row('2030-03-05T10:00:00Z', '2030-03-05T11:00:00Z'),
    });
    let observed: unknown;
    try {
      await adminPrisma.appointment.create({
        data: row('2030-03-05T10:30:00Z', '2030-03-05T11:30:00Z'),
      });
    } catch (e) {
      observed = e;
    }
    expect(observed).toBeInstanceOf(Prisma.PrismaClientUnknownRequestError);
    expect(isExclusionViolation(observed)).toBe(true);
    expect(mapSchedulingError(observed)?.code).toBe('SLOT_TAKEN');
  });

  it('profissionais diferentes no mesmo horário não se bloqueiam', async () => {
    const results = await Promise.all([
      create(input('2030-03-04T10:00:00Z', '2030-03-04T11:00:00Z', w.members.proA)),
      create(input('2030-03-04T10:00:00Z', '2030-03-04T11:00:00Z', w.members.proB)),
    ]);
    expect(results.every((r) => r.appointment !== null)).toBe(true);
  });
});

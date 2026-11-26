import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import {
  loadBusyInIntervalTx,
  loadRankingDataTx,
} from '../../src/scheduling/professional-ranking-data';

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo. */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
/** Horário local de São Paulo (UTC-3, sem horário de verão) como Date. */
function at(day: string, hh: number, mm = 0): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + ((hh + 3) * 60 + mm) * 60_000);
}

describe('11 - dados do ranking (minutos do dia, revezamento, ocupadas)', () => {
  let w: Phase4World;
  let tenant: TenantContextService;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p11rank-%'`;
  const day = localDay(40);
  const nextDay = localDay(41);
  const dayStart = at(day, 0);
  const dayEnd = at(nextDay, 0);

  async function clean() {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM time_blocks WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await deletePhase4Rows(orgFilter);
  }

  beforeAll(async () => {
    w = await createPhase4World('p11rank');
    tenant = w.app.get(TenantContextService);
  });
  afterAll(async () => {
    await clean();
    await destroyPhase4World(w);
  });
  afterEach(clean);

  const appt = (
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    extra: Record<string, unknown> = {},
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt,
        endsAt,
        ...extra,
      },
    });

  const load = (orgId: string, extra: Record<string, unknown> = {}) =>
    tenant.runWithTenant(orgId, (tx) =>
      loadRankingDataTx(tx, {
        professionalIds: [w.members.proA, w.members.proB],
        dayStart,
        dayEnd,
        ...extra,
      }),
    );

  const busy = (orgId: string, startsAt: Date, endsAt: Date, extra: Record<string, unknown> = {}) =>
    tenant.runWithTenant(orgId, (tx) =>
      loadBusyInIntervalTx(tx, {
        professionalIds: [w.members.proA, w.members.proB],
        startsAt,
        endsAt,
        ...extra,
      }),
    );

  it('soma os minutos dos agendamentos do dia (60 + 30 = 90)', async () => {
    await appt(w.members.proA, at(day, 9), at(day, 10));
    await appt(w.members.proA, at(day, 11), at(day, 11, 30));
    const r = await load(w.orgId);
    expect(r.dayMinutes.get(w.members.proA)).toBe(90);
    expect(r.dayMinutes.get(w.members.proB)).toBe(0);
  });

  it('agendamento cancelado não conta', async () => {
    await appt(w.members.proA, at(day, 9), at(day, 10), { status: 'cancelled' });
    const r = await load(w.orgId);
    expect(r.dayMinutes.get(w.members.proA)).toBe(0);
  });

  it('agendamento de outro dia não conta', async () => {
    await appt(w.members.proA, at(nextDay, 9), at(nextDay, 10));
    const r = await load(w.orgId);
    expect(r.dayMinutes.get(w.members.proA)).toBe(0);
  });

  it('agendamento que atravessa o início do dia conta só a parte de dentro', async () => {
    await appt(w.members.proA, at(localDay(39), 23, 30), at(day, 0, 45));
    const r = await load(w.orgId);
    expect(r.dayMinutes.get(w.members.proA)).toBe(45);
  });

  it('excludeAppointmentIds tira o agendamento da soma', async () => {
    const a = await appt(w.members.proA, at(day, 9), at(day, 10));
    await appt(w.members.proA, at(day, 11), at(day, 11, 30));
    const r = await load(w.orgId, { excludeAppointmentIds: [a.id] });
    expect(r.dayMinutes.get(w.members.proA)).toBe(30);
  });

  it('lastAssignedAt é o created_at mais recente; sem agendamento é null', async () => {
    const older = new Date(Date.now() - 10 * 86_400_000);
    const newer = new Date(Date.now() - 2 * 86_400_000);
    await appt(w.members.proA, at(day, 9), at(day, 10), { createdAt: older });
    await appt(w.members.proA, at(day, 11), at(day, 12), { createdAt: newer });
    const r = await load(w.orgId);
    expect(r.lastAssignedAt.get(w.members.proA)).toBe(newer.getTime());
    expect(r.lastAssignedAt.get(w.members.proB)).toBeNull();
  });

  it('revezamento ignora agendamentos com mais de 90 dias', async () => {
    const old = at(localDay(-100), 9);
    await appt(w.members.proB, old, new Date(old.getTime() + 3_600_000));
    const r = await load(w.orgId);
    expect(r.lastAssignedAt.get(w.members.proB)).toBeNull();
  });

  it('ids vazios devolvem mapas e conjunto vazios', async () => {
    const r = await tenant.runWithTenant(w.orgId, (tx) =>
      loadRankingDataTx(tx, { professionalIds: [], dayStart, dayEnd }),
    );
    expect(r.dayMinutes.size).toBe(0);
    const b = await tenant.runWithTenant(w.orgId, (tx) =>
      loadBusyInIntervalTx(tx, { professionalIds: [], startsAt: dayStart, endsAt: dayEnd }),
    );
    expect(b.size).toBe(0);
  });

  it('ocupada por agendamento no intervalo; ignoreAppointmentIds libera', async () => {
    const a = await appt(w.members.proA, at(day, 9), at(day, 10));
    const b = await busy(w.orgId, at(day, 9, 30), at(day, 10, 30));
    expect([...b]).toEqual([w.members.proA]);
    const free = await busy(w.orgId, at(day, 10), at(day, 11));
    expect(free.size).toBe(0);
    const ign = await busy(w.orgId, at(day, 9, 30), at(day, 10, 30), {
      ignoreAppointmentIds: [a.id],
    });
    expect(ign.size).toBe(0);
  });

  it('ocupada por bloqueio próprio e por bloqueio do salão', async () => {
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proB,
        kind: 'folga',
        startsAt: at(day, 14),
        endsAt: at(day, 15),
      },
    });
    const own = await busy(w.orgId, at(day, 14), at(day, 15));
    expect([...own]).toEqual([w.members.proB]);

    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: null,
        kind: 'feriado',
        startsAt: at(day, 16),
        endsAt: at(day, 17),
      },
    });
    const all = await busy(w.orgId, at(day, 16), at(day, 17));
    expect(all.has(w.members.proA)).toBe(true);
    expect(all.has(w.members.proB)).toBe(true);
  });

  it('ignoreGroupId ignora o bloqueio do próprio grupo mas não o de outro', async () => {
    const g1 = await insertBridalGroupRow(w, { eventDate: day });
    const g2 = await insertBridalGroupRow(w, { eventDate: day });
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        kind: 'deslocamento',
        startsAt: at(day, 8),
        endsAt: at(day, 9),
        bridalGroupId: g1.groupId,
      },
    });
    const ignoring = await busy(w.orgId, at(day, 8), at(day, 9), { ignoreGroupId: g1.groupId });
    expect(ignoring.size).toBe(0);
    const other = await busy(w.orgId, at(day, 8), at(day, 9), { ignoreGroupId: g2.groupId });
    expect(other.has(w.members.proA)).toBe(true);
  });

  it('outra organização não enxerga nada (RLS)', async () => {
    await appt(w.members.proA, at(day, 9), at(day, 10));
    const r = await load(w.otherOrgId);
    expect(r.dayMinutes.get(w.members.proA)).toBe(0);
    expect(r.lastAssignedAt.get(w.members.proA)).toBeNull();
    const b = await busy(w.otherOrgId, at(day, 9), at(day, 10));
    expect(b.size).toBe(0);
  });
});

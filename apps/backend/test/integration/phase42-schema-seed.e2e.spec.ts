import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  ELEGANCE_STEPS,
  EXPERIENCE_STEPS,
  GLAM_STEPS,
  gqlAs,
  insertBridalGroupRow,
  insertConfirmedTimelineRow,
  insertPackageTimelineRows,
  type Phase4World,
} from './helpers/phase4-fixtures';

const SEED_MIGRATION = join(
  __dirname,
  '../../prisma/migrations/20261114010000_seed_studio_js_timeline/migration.sql',
);
const STUDIO_JS_ORG = '01a0b681-8b9b-790b-921d-4518350e534b';

const DELETE_GROUP = `mutation($id: UUID!) {
  deleteBridalGroupPermanently(id: $id) { deletedId errors { code message } }
}`;

const count = async (sql: string): Promise<number> => {
  const rows = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${sql}`);
  return Number(rows[0].n);
};

describe('Fase 04.2 — schema, RLS, permissão e seed do cronograma', () => {
  let w: Phase4World;
  const T0 = '2030-06-15T12:00:00.000Z';
  const T1 = '2030-06-15T13:30:00.000Z';

  beforeAll(async () => {
    w = await createPhase4World('p42seed');
  });

  afterAll(async () => {
    await destroyPhase4World(w);
  });

  const newPackage = (name: string) =>
    adminPrisma.package.create({
      data: { organizationId: w.orgId, name: `${w.prefix}-${name}`, price: '100.00' },
    });

  it('(a) RLS habilitada e forçada; outro tenant não enxerga as linhas', async () => {
    const rows = await adminPrisma.$queryRawUnsafe<{ relname: string; e: boolean; f: boolean }[]>(
      `SELECT relname, relrowsecurity AS e, relforcerowsecurity AS f
         FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'r'`,
      ['package_timeline_steps', 'bridal_timelines'],
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect({ t: r.relname, e: r.e, f: r.f }).toEqual({ t: r.relname, e: true, f: true });

    const pkg = await newPackage('rls');
    await insertPackageTimelineRows(w, pkg.id, GLAM_STEPS, { makeServiceId: null, hairServiceId: null });
    const g = await insertBridalGroupRow(w);
    await insertConfirmedTimelineRow(w, {
      groupId: g.groupId,
      departureTime: '17:00',
      departureAt: T1,
      registryStartsAt: T0,
    });

    const countAs = (orgId: string, table: string) =>
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_organization', ${orgId}, true)`;
        const r = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
        );
        return Number(r[0].n);
      });
    expect(await countAs(w.otherOrgId, 'package_timeline_steps')).toBe(0);
    expect(await countAs(w.otherOrgId, 'bridal_timelines')).toBe(0);
    expect(await countAs(w.orgId, 'package_timeline_steps')).toBe(GLAM_STEPS.length);
    expect(await countAs(w.orgId, 'bridal_timelines')).toBe(1);
  });

  it('(b) CHECKs e únicos parciais rejeitam dados inválidos', async () => {
    const pkg = await newPackage('checks');
    const base = (extra: string, cols = '') =>
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes${cols ? ', ' + cols : ''})
       VALUES ('${w.orgId}', '${pkg.id}', 'x', ${extra})`;
    const fails = (sql: string) => expect(adminPrisma.$executeRawUnsafe(sql)).rejects.toThrow();

    await fails(base('1441'));
    await fails(
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes, kind, duration_minutes)
       VALUES ('${w.orgId}', '${pkg.id}', 'x', 10, 'nail', 90)`,
    );
    await fails(
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes, is_extra, starts_registry)
       VALUES ('${w.orgId}', '${pkg.id}', 'x', 10, true, true)`,
    );
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes, starts_registry)
       VALUES ('${w.orgId}', '${pkg.id}', 'fotos', 90, true)`,
    );
    await fails(
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes, starts_registry)
       VALUES ('${w.orgId}', '${pkg.id}', 'outra', 80, true)`,
    );
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes, kind, duration_minutes)
       VALUES ('${w.orgId}', '${pkg.id}', 'make', 270, 'make', 90)`,
    );
    await fails(
      `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes, kind, duration_minutes)
       VALUES ('${w.orgId}', '${pkg.id}', 'make2', 260, 'make', 90)`,
    );

    const g = await insertBridalGroupRow(w);
    await expect(
      insertConfirmedTimelineRow(w, {
        groupId: g.groupId,
        departureTime: '25:00',
        departureAt: T1,
        registryStartsAt: T0,
      }),
    ).rejects.toThrow();
    await insertConfirmedTimelineRow(w, {
      groupId: g.groupId,
      departureTime: '17:00',
      departureAt: T1,
      registryStartsAt: T0,
    });
    await expect(
      insertConfirmedTimelineRow(w, {
        groupId: g.groupId,
        departureTime: '18:00',
        departureAt: T1,
        registryStartsAt: T0,
      }),
    ).rejects.toThrow();
  });

  it('(c) bridal.scheduleOverride só para ADMIN e MANAGER', async () => {
    const rows = await adminPrisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT r.name FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
        WHERE rp.permission = 'bridal.scheduleOverride' AND r.is_system = true ORDER BY r.name`,
    );
    expect(rows.map((r) => r.name)).toEqual(['ADMIN', 'MANAGER']);
  });

  describe('(d) seed real do Studio JS', () => {
    let glamId: string;
    let experienceId: string;
    let eleganceId: string;
    let makeSvc: string;
    let preWeddingSvc: string;

    const runSeed = async () => {
      const sql = readFileSync(SEED_MIGRATION, 'utf8');
      const block = sql.split('-- BEGIN SEED 04.2')[1]!.split('-- END SEED 04.2')[0]!;
      const swapped = block.split(STUDIO_JS_ORG).join(w.orgId);
      const commands = swapped
        .split(';\n')
        .map((c) => c.trim())
        .filter(Boolean);
      expect(commands).toHaveLength(3);
      for (const c of commands) await adminPrisma.$executeRawUnsafe(c);
    };

    const stepsOf = (packageId: string) =>
      adminPrisma.packageTimelineStep.findMany({
        where: { packageId },
        orderBy: { displayOrder: 'asc' },
      });

    beforeAll(async () => {
      const mk = async (name: string) =>
        (
          await adminPrisma.service.create({
            data: {
              organizationId: w.orgId,
              categoryId: w.childCategoryId,
              name,
              basePrice: '100.00',
              defaultDurationMinutes: 60,
            },
          })
        ).id;
      makeSvc = await mk('Maquiagem noiva');
      const hairSvc = await mk('Penteado noiva');
      preWeddingSvc = await mk('Maquiagem pré-wedding');
      const mkPkg = async (name: string, services: string[]) =>
        (
          await adminPrisma.package.create({
            data: {
              organizationId: w.orgId,
              name,
              price: '1000.00',
              services: {
                create: services.map((serviceId, i) => ({ serviceId, quantity: 1, displayOrder: i })),
              },
            },
          })
        ).id;
      experienceId = await mkPkg('Experience', [makeSvc, hairSvc]);
      // pré-wedding vem ANTES: o seed deve escolher pelo nome do serviço, não pela ordem
      glamId = await mkPkg('Glam', [preWeddingSvc, makeSvc, hairSvc]);
      eleganceId = await mkPkg('Elegance', [makeSvc, hairSvc]);
      await runSeed();
    });

    it('grava 23 linhas com os offsets da referência', async () => {
      expect(await count(`package_timeline_steps WHERE organization_id = '${w.orgId}' AND package_id IN ('${glamId}','${experienceId}','${eleganceId}')`)).toBe(23);

      const glam = await stepsOf(glamId);
      expect(glam.filter((s) => !s.isExtra).map((s) => s.offsetMinutes)).toEqual([450, 390, 330, 270, 180, 90, 0]);
      expect(glam.filter((s) => s.isExtra).map((s) => [s.name, s.offsetMinutes])).toEqual([['Chegada fotógrafos', 110]]);
      expect(glam.filter((s) => s.startsRegistry).map((s) => s.name)).toEqual(['fotos']);
      const make = glam.find((s) => s.kind === 'make')!;
      expect(make.serviceId).toBe(makeSvc);
      expect(make.serviceId).not.toBe(preWeddingSvc);
      expect(make.durationMinutes).toBe(90);
      expect(glam.find((s) => s.kind === 'hair')!.durationMinutes).toBe(90);

      // as fixtures dos próximos planos espelham exatamente o seed
      const shape = (s: { name: string; offsetMinutes: number; isExtra: boolean; kind: string | null; startsRegistry: boolean; durationMinutes: number | null }) =>
        ({ name: s.name, offsetMinutes: s.offsetMinutes, isExtra: s.isExtra, kind: s.kind, startsRegistry: s.startsRegistry, durationMinutes: s.durationMinutes });
      expect(glam.map(shape)).toEqual(GLAM_STEPS);
      expect((await stepsOf(experienceId)).map(shape)).toEqual(EXPERIENCE_STEPS);
      expect((await stepsOf(eleganceId)).map(shape)).toEqual(ELEGANCE_STEPS);

      const exp = await stepsOf(experienceId);
      expect(exp).toHaveLength(8);
      expect(exp.find((s) => s.startsRegistry)).toMatchObject({ name: 'making of', offsetMinutes: 60 });
      expect(exp.find((s) => s.isExtra)!.offsetMinutes).toBe(80);

      const ele = await stepsOf(eleganceId);
      expect(ele).toHaveLength(7);
      expect(ele.find((s) => s.name === 'lavar cabelo')!.offsetMinutes).toBe(300);
      expect(ele.find((s) => s.isExtra)!.offsetMinutes).toBe(110);
    });

    it('reexecutar não duplica e não sobrescreve regra editada', async () => {
      await adminPrisma.$executeRawUnsafe(
        `UPDATE package_timeline_steps SET offset_minutes = 275 WHERE package_id = '${glamId}' AND name = 'make'`,
      );
      await runSeed();
      expect(await count(`package_timeline_steps WHERE package_id IN ('${glamId}','${experienceId}','${eleganceId}')`)).toBe(23);
      const make = (await stepsOf(glamId)).find((s) => s.name === 'make')!;
      expect(make.offsetMinutes).toBe(275);
    });
  });

  it('(e) exclusão definitiva: grupo leva o cronograma; agendamento apagado zera a FK', async () => {
    const start = new Date('2030-07-01T12:00:00.000Z');
    const appt = await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: start,
        endsAt: new Date(start.getTime() + 3_600_000),
        status: 'confirmed',
      } as never,
    });

    // agendamento ligado: DELETE zera make_appointment_id (SET NULL)
    const g1 = await insertBridalGroupRow(w);
    const { timelineId: t1 } = await insertConfirmedTimelineRow(w, {
      groupId: g1.groupId,
      departureTime: '17:00',
      departureAt: T1,
      registryStartsAt: T0,
      make: {
        professionalId: w.members.proA,
        serviceId: w.serviceId,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
        appointmentId: appt.id,
      },
    });
    await adminPrisma.appointment.delete({ where: { id: appt.id } });
    const after = await adminPrisma.bridalTimeline.findUniqueOrThrow({ where: { id: t1 } });
    expect(after.makeAppointmentId).toBeNull();
    expect(after.makeProfessionalId).toBe(w.members.proA);

    // excluir o grupo definitivamente leva o cronograma (CASCADE)
    const out = (await gqlAs(w, w.tokens.admin)(DELETE_GROUP, { id: g1.groupId })).data
      .deleteBridalGroupPermanently;
    expect(out.errors).toEqual([]);
    expect(await count(`bridal_timelines WHERE id = '${t1}'`)).toBe(0);
  });
});

import { randomUUID } from "node:crypto";
import { adminPrisma, appPrisma } from "./setup";
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  GLAM_STEPS,
  insertBridalGroupRow,
  insertConfirmedTimelineRow,
  insertPackageTimelineRows,
  type Phase4World,
} from "./helpers/phase4-fixtures";
import {
  ROLE_PERMISSIONS,
  PERMISSIONS,
} from "../../src/authz/permissions.catalog";

const PHASE42_TABLES = ["package_timeline_steps", "bridal_timelines"] as const;

const SET_TIMELINE = `mutation($input: SetPackageTimelineInput!) {
  setPackageTimeline(input: $input) { steps { id } errors { code message } }
}`;
const PACKAGE_TIMELINE = `query($id: UUID!) { packageTimeline(packageId: $id) { id } }`;
const PREVIEW = `query($input: BridalTimelineInput!) {
  bridalTimelinePreview(input: $input) { preview { groupId } errors { code message } }
}`;
const TIMELINE = `query($id: UUID!) { bridalTimeline(groupId: $id) { id version } }`;
const CONFIRM = `mutation($input: BridalTimelineInput!) {
  confirmBridalTimeline(input: $input) { timeline { id } errors { code message } }
}`;
const CREATE_APPT = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message field } }
}`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ""} ${e.message}`);
}

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(d);
}
/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe("Fase 04.2 - RLS e RBAC do cronograma", () => {
  let w: Phase4World;
  let groupId: string;
  let companionClientId: string;
  const eventDay = localDay(80);

  beforeAll(async () => {
    w = await createPhase4World("p42rls");
    await insertPackageTimelineRows(w, w.bridalPackageId, GLAM_STEPS, {
      makeServiceId: w.serviceId,
      hairServiceId: w.serviceBId,
    });
    const g = await insertBridalGroupRow(w, {
      companions: 1,
      eventDate: eventDay,
    });
    groupId = g.groupId;
    companionClientId = g.companionClientIds[0];
    await insertConfirmedTimelineRow(w, {
      groupId,
      packageId: w.bridalPackageId,
      departureTime: "17:00",
      departureAt: at(eventDay, 17),
      registryStartsAt: at(eventDay, 15, 30),
      make: {
        professionalId: w.members.proA,
        serviceId: w.serviceId,
        startsAt: at(eventDay, 12, 30),
        endsAt: at(eventDay, 14),
      },
      hair: {
        professionalId: w.members.proB,
        serviceId: w.serviceBId,
        startsAt: at(eventDay, 14),
        endsAt: at(eventDay, 15, 30),
      },
    });
  }, 90_000);

  afterAll(async () => {
    await adminPrisma.appointment.deleteMany({
      where: { organizationId: w.orgId },
    });
    await destroyPhase4World(w);
  });

  describe("RLS: org B não enxerga nada da org A", () => {
    it.each(PHASE42_TABLES.map((t) => [t]))(
      "%s: org A tem linhas, org B enxerga 0",
      async (table) => {
        const rowsA = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
        );
        expect([table, Number(rowsA[0].n) > 0]).toEqual([table, true]);

        const asB = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
          );
          return tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
          );
        });
        expect([table, Number(asB[0].n)]).toEqual([table, 0]);

        const asA = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.current_organization', '${w.orgId}', true)`,
          );
          return tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id <> '${w.orgId}'`,
          );
        });
        expect([table, Number(asA[0].n)]).toEqual([table, 0]);
      },
    );

    it("INSERT com organization_id da org A na sessão da org B viola a policy (WITH CHECK)", async () => {
      const inserts: Record<string, string> = {
        package_timeline_steps: `INSERT INTO package_timeline_steps (organization_id, package_id, name, offset_minutes) VALUES ('${w.orgId}', '${w.bridalPackageId}', 'hack', 10)`,
        bridal_timelines: `INSERT INTO bridal_timelines (organization_id, group_id, package_name, departure_time, departure_at, registry_starts_at, registry_label, bride_label, text) VALUES ('${w.orgId}', '${groupId}', 'hack', '17:00', now(), now(), 'fotos', 'HACK', 'x')`,
      };
      for (const [table, sql] of Object.entries(inserts)) {
        await expect([
          table,
          await appPrisma
            .$transaction(async (tx) => {
              await tx.$executeRawUnsafe(
                `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
              );
              await tx.$executeRawUnsafe(sql);
            })
            .then(() => "inseriu")
            .catch((e: Error) =>
              /row-level security|violates/i.test(e.message)
                ? "bloqueado"
                : e.message,
            ),
        ]).toEqual([table, "bloqueado"]);
      }
    });
  });

  describe("GraphQL cross-tenant", () => {
    it("admin B não enxerga cronograma nem regras do pacote da org A", async () => {
      const b = gqlAs(w, w.tokens.otherAdmin);
      expect(
        (await b(TIMELINE, { id: groupId })).data.bridalTimeline,
      ).toBeNull();
      expect(
        (await b(PACKAGE_TIMELINE, { id: w.bridalPackageId })).data
          .packageTimeline,
      ).toEqual([]);
      const prev = await b(PREVIEW, {
        input: {
          groupId,
          packageId: w.bridalPackageId,
          departureTime: "17:00",
        },
      });
      expect(prev.data.bridalTimelinePreview.preview).toBeNull();
      expect(prev.data.bridalTimelinePreview.errors[0].code).toBe("NOT_FOUND");
      const conf = await b(CONFIRM, {
        input: {
          groupId,
          packageId: w.bridalPackageId,
          departureTime: "17:00",
        },
      });
      expect(conf.data.confirmBridalTimeline.timeline).toBeNull();
      expect(conf.data.confirmBridalTimeline.errors[0].code).toBe("NOT_FOUND");
      const set = await b(SET_TIMELINE, {
        input: { packageId: w.bridalPackageId, steps: [] },
      });
      expect(set.data.setPackageTimeline.errors[0].code).toBe("NOT_FOUND");
      // e as regras da org A seguem intactas
      expect(
        await adminPrisma.packageTimelineStep.count({
          where: { packageId: w.bridalPackageId },
        }),
      ).toBe(GLAM_STEPS.length);
    });
  });

  describe("Matriz de permissões por papel", () => {
    type Role = "admin" | "manager" | "attendant" | "proA";
    const ROLES: Role[] = ["admin", "manager", "attendant", "proA"];
    const missing = () => randomUUID();
    const tlInput = () => ({
      groupId: missing(),
      packageId: missing(),
      departureTime: "17:00",
    });

    const ops: [
      string,
      Role[],
      (g: ReturnType<typeof gqlAs>) => ReturnType<ReturnType<typeof gqlAs>>,
    ][] = [
      [
        "setPackageTimeline",
        ["admin", "manager"],
        (g) => g(SET_TIMELINE, { input: { packageId: missing(), steps: [] } }),
      ],
      [
        "packageTimeline",
        // leitura exige package.read, que os 4 papéis do sistema possuem (catálogo de serviços/pacotes)
        ["admin", "manager", "attendant", "proA"],
        (g) => g(PACKAGE_TIMELINE, { id: w.bridalPackageId }),
      ],
      [
        "bridalTimelinePreview",
        ["admin", "manager", "attendant"],
        (g) => g(PREVIEW, { input: tlInput() }),
      ],
      [
        "bridalTimeline",
        ["admin", "manager", "attendant"],
        (g) => g(TIMELINE, { id: groupId }),
      ],
      [
        "confirmBridalTimeline",
        ["admin", "manager", "attendant"],
        (g) => g(CONFIRM, { input: tlInput() }),
      ],
    ];

    const rows = ops.flatMap(([op, allowedRoles, run]) =>
      ROLES.map(
        (role) => [role, op, allowedRoles.includes(role), run] as const,
      ),
    );

    it("cobre as 5 operações x 4 papéis", () => {
      expect(ops.length).toBe(5);
      expect(rows.length).toBe(20);
    });

    it.each(rows.map((r) => [r[0], r[1], r[2], r[3]] as const))(
      "%s / %s -> permitido=%s",
      async (role, _op, allowed, run) => {
        const res = await run(gqlAs(w, w.tokens[role]));
        if (allowed) {
          expect(isForbidden(res)).toBe(false);
          expect(res.errors).toBeUndefined();
        } else {
          expect(isForbidden(res)).toBe(true);
        }
      },
    );
  });

  describe("Override do cronograma (bridal.scheduleOverride)", () => {
    const create = async (token: string, override?: { reason: string }) =>
      (
        await gqlAs(w, token)(CREATE_APPT, {
          i: {
            professionalId: w.members.proA,
            clientId: companionClientId,
            serviceId: w.serviceId,
            startsAt: at(eventDay, 15),
            endsAt: at(eventDay, 16),
            timelineOverride: override,
          },
        })
      ).data.createAppointment as {
        appointment: { id: string } | null;
        errors: { code: string }[];
      };

    afterEach(async () => {
      await adminPrisma.appointment.deleteMany({
        where: { organizationId: w.orgId, clientId: companionClientId },
      });
    });

    it("sem override a guarda bloqueia (TIMELINE_AFTER_REGISTRY)", async () => {
      const r = await create(w.tokens.admin);
      expect(r.appointment).toBeNull();
      expect(r.errors[0].code).toBe("TIMELINE_AFTER_REGISTRY");
    });

    it.each([["admin"], ["manager"]] as const)(
      "%s força com motivo e fica no audit_log",
      async (role) => {
        const r = await create(w.tokens[role], { reason: "pedido da noiva" });
        expect(r.errors).toEqual([]);
        const id = r.appointment!.id;
        const audit = await adminPrisma.auditLog.findMany({
          where: { entityId: id, action: "bridal.timeline.override" },
        });
        expect(audit).toHaveLength(1);
        expect(audit[0].actorMemberId).toBe(w.members[role]);
      },
    );

    it("atendente recebe OVERRIDE_FORBIDDEN e nada é criado", async () => {
      const r = await create(w.tokens.attendant, { reason: "pedido da noiva" });
      expect(r.appointment).toBeNull();
      expect(r.errors[0].code).toBe("OVERRIDE_FORBIDDEN");
      expect(
        await adminPrisma.appointment.count({
          where: { organizationId: w.orgId, clientId: companionClientId },
        }),
      ).toBe(0);
    });
  });

  it("role_permissions (banco) e ROLE_PERMISSIONS (catálogo) concordam em bridal.scheduleOverride", async () => {
    const perm = PERMISSIONS.BRIDAL_SCHEDULE_OVERRIDE;
    const db = await adminPrisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT r.name FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
        WHERE rp.permission = '${perm}' AND r.is_system = true ORDER BY r.name`,
    );
    const catalog = (
      Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]
    )
      .filter((role) => ROLE_PERMISSIONS[role].includes(perm))
      .sort();
    expect(db.map((r) => r.name)).toEqual(catalog);
    expect(catalog).toEqual(["ADMIN", "MANAGER"]);
  });
});

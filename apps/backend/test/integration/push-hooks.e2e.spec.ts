import { adminPrisma } from "./setup";
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from "./helpers/phase4-fixtures";
import { deletePhase4Rows } from "./helpers/phase4-cleanup";
import { TenantContextService } from "../../src/database/tenant-context.service";
import { PushEventsService } from "../../src/push/push-events.service";
import { PushService } from "../../src/push/push.service";
import type {
  PushJob,
  PushMessage,
  PushProvider,
} from "../../src/push/push.types";

const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code } }
}`;
const CANCEL = `mutation($i: CancelAppointmentInput!) {
  cancelAppointment(input: $i) { appointment { id status } errors { code } }
}`;
const MOVE = `mutation($i: MoveAppointmentInput!) {
  moveAppointment(input: $i) { appointment { id } errors { code } }
}`;
const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) { appointmentIds errors { code message field } }
}`;
const CANCEL_GROUP = `mutation($input: CancelBridalGroupInput!) {
  cancelBridalGroup(input: $input) { group { id status } errors { code message field } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(d);
}
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe("Fase 7 - ganchos de push nas mutations reais", () => {
  let w: Phase4World;
  let enqueue: jest.SpyInstance;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p7hooks-%'`;
  const eventDay = localDay(70);

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);
  const jobs = () => enqueue.mock.calls.map((c) => c[0] as PushJob);

  const create = async (startsAt: string, endsAt: string) =>
    (
      await att()(CREATE, {
        i: {
          professionalId: w.members.proA,
          clientId: w.clientId,
          serviceId: w.serviceId,
          startsAt,
          endsAt,
        },
      })
    ).data.createAppointment as {
      appointment: { id: string } | null;
      errors: { code: string }[];
    };

  beforeAll(async () => {
    w = await createPhase4World("p7hooks");
    enqueue = jest
      .spyOn(w.app.get(PushEventsService), "enqueue")
      .mockImplementation(() => undefined);
  });
  afterAll(async () => {
    enqueue.mockRestore();
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM device_tokens WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await destroyPhase4World(w);
  });
  beforeEach(() => enqueue.mockClear());
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM cash_movements WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  it("createAppointment enfileira appointment.created com o autor e o id", async () => {
    const r = await create("2030-06-03T13:00:00Z", "2030-06-03T14:00:00Z");
    expect(r.errors).toEqual([]);
    expect(jobs()).toEqual([
      {
        kind: "appointment.created",
        orgId: w.orgId,
        actorMemberId: w.members.attendant,
        appointmentIds: [r.appointment!.id],
      },
    ]);
  });

  it("horário ocupado (SLOT_TAKEN) não enfileira nada", async () => {
    await create("2030-06-04T13:00:00Z", "2030-06-04T14:00:00Z");
    enqueue.mockClear();
    const r = await create("2030-06-04T13:30:00Z", "2030-06-04T14:30:00Z");
    expect(r.errors[0].code).toBe("SLOT_TAKEN");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("cancelAppointment avisa; no_show não avisa", async () => {
    const a = await create("2030-06-05T13:00:00Z", "2030-06-05T14:00:00Z");
    const b = await create("2030-06-05T15:00:00Z", "2030-06-05T16:00:00Z");
    enqueue.mockClear();

    const c1 = (
      await att()(CANCEL, {
        i: { id: a.appointment!.id, reason: "Cliente avisou" },
      })
    ).data.cancelAppointment;
    expect(c1.errors).toEqual([]);
    expect(jobs()).toEqual([
      {
        kind: "appointment.cancelled",
        orgId: w.orgId,
        actorMemberId: w.members.attendant,
        appointmentIds: [a.appointment!.id],
      },
    ]);

    enqueue.mockClear();
    const c2 = (
      await adm()(CANCEL, {
        i: {
          id: b.appointment!.id,
          reason: "Não compareceu",
          reasonTag: "no_show",
        },
      })
    ).data.cancelAppointment;
    expect(c2.appointment.status).toBe("no_show");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("moveAppointment não avisa (D-11)", async () => {
    const a = await create("2030-06-06T13:00:00Z", "2030-06-06T14:00:00Z");
    enqueue.mockClear();
    const r = await adm()(MOVE, {
      i: {
        id: a.appointment!.id,
        professionalId: w.members.proA,
        startsAt: "2030-06-06T16:00:00Z",
      },
    });
    expect(r.data.moveAppointment.errors).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  describe("evento de noivas", () => {
    const newGroup = () =>
      insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    type Group = Awaited<ReturnType<typeof newGroup>>;
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
        startsAt: at(eventDay, 9),
        endsAt: at(eventDay, 9, 30),
      },
    ];

    it("scheduleBridalEvent enfileira UM bridal.scheduled com os 3 ids", async () => {
      const g = await newGroup();
      const r = (
        await att()(SCHEDULE, {
          input: { groupId: g.groupId, items: items(g) },
        })
      ).data.scheduleBridalEvent as {
        appointmentIds: string[];
        errors: unknown[];
      };
      expect(r.errors).toEqual([]);
      expect(r.appointmentIds).toHaveLength(3);
      expect(enqueue).toHaveBeenCalledTimes(1);
      const job = jobs()[0] as Extract<PushJob, { appointmentIds: string[] }>;
      expect(job.kind).toBe("bridal.scheduled");
      expect(job.actorMemberId).toBe(w.members.attendant);
      expect([...job.appointmentIds].sort()).toEqual(
        [...r.appointmentIds].sort(),
      );
    });

    it("cancelBridalGroup enfileira UM bridal.cancelled e o dispatch acha os atendimentos", async () => {
      const g = await newGroup();
      const s = (
        await att()(SCHEDULE, {
          input: { groupId: g.groupId, items: items(g) },
        })
      ).data.scheduleBridalEvent;
      expect(s.errors).toEqual([]);
      enqueue.mockClear();

      const r = await adm()(CANCEL_GROUP, {
        input: { id: g.groupId, reason: "Desistência da noiva" },
      });
      expect(r.data.cancelBridalGroup.errors).toEqual([]);
      expect(enqueue).toHaveBeenCalledTimes(1);
      const job = jobs()[0] as Extract<PushJob, { kind: "bridal.cancelled" }>;
      expect(job).toMatchObject({
        kind: "bridal.cancelled",
        orgId: w.orgId,
        actorMemberId: w.members.admin,
        groupId: g.groupId,
      });
      expect(typeof job.since).toBe("string");

      const sent: { token: string; message: PushMessage }[] = [];
      const fake: PushProvider = {
        enabled: true,
        send: jest.fn(async (token: string, message: PushMessage) => {
          sent.push({ token, message });
          return { status: "sent" as const };
        }),
      };
      for (const [memberId, token] of [
        [w.members.proA, "tok-p7h-proa"],
        [w.members.proB, "tok-p7h-prob"],
      ] as const) {
        await adminPrisma.deviceToken.create({
          data: {
            organizationId: w.orgId,
            memberId,
            platform: "android",
            token,
          },
        });
      }
      const service = new PushService(w.app.get(TenantContextService), fake);
      const d = await service.dispatch(job);
      expect(d.failed).toBe(0);
      expect(sent.map((x) => x.token).sort()).toEqual([
        "tok-p7h-proa",
        "tok-p7h-prob",
      ]);
    });
  });
});

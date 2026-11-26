import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertConfirmedTimelineRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { findCompanionIssuesTx } from '../../src/bridal/timeline/timeline-guard';
import type { TenantPrismaClient } from '../../src/database/types';

const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code message field } }
}`;
const CREATE_VISIT = `mutation($i: CreateVisitInput!) {
  createVisit(input: $i) { appointments { id } errors { code message field } }
}`;
const MOVE = `mutation($i: MoveAppointmentInput!) {
  moveAppointment(input: $i) { appointment { id startsAt endsAt } errors { code message field } }
}`;
const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) { appointmentIds errors { code message field } }
}`;
const CONFIRM = `mutation($input: ConfirmBridalScheduleInput!) {
  confirmBridalSchedule(input: $input) { appointmentIds errors { code message field } }
}`;

type Err = { code: string; message: string; field: string | null };

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo. */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe('Fase 04.2 - guarda das acompanhantes no cronograma confirmado', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p42grd-%'`;
  const eventDay = localDay(70);
  const otherDay = localDay(71);

  beforeAll(async () => {
    w = await createPhase4World('p42grd');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM cash_movements WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM client_credit_movements WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const mgr = () => gqlAs(w, w.tokens.manager);
  const adm = () => gqlAs(w, w.tokens.admin);

  /** Grupo + cronograma Glam 17h: registro 15:30, make proA [12:30,14h), penteado proB [14h,15:30). */
  async function groupWithTimeline() {
    const g = await insertBridalGroupRow(w, { companions: 2, eventDate: eventDay });
    const t = await insertConfirmedTimelineRow(w, {
      groupId: g.groupId,
      departureTime: '17:00',
      departureAt: at(eventDay, 17),
      registryStartsAt: at(eventDay, 15, 30),
      registryLabel: 'fotos',
      brideLabel: 'VITORIA',
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
    return { ...g, timelineId: t.timelineId };
  }

  const create = async (
    gql: ReturnType<typeof att>,
    clientId: string,
    serviceId: string,
    pro: string,
    startsAt: string,
    endsAt: string,
    timelineOverride?: { reason: string },
  ) =>
    (
      await gql(CREATE, {
        i: { professionalId: pro, clientId, serviceId, startsAt, endsAt, timelineOverride },
      })
    ).data.createAppointment as { appointment: { id: string } | null; errors: Err[] };

  const insertAppt = (
    clientId: string,
    pro: string,
    startsAt: string,
    endsAt: string,
    extra: Record<string, unknown> = {},
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: pro,
        clientId,
        serviceId: w.serviceId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        ...extra,
      },
    });

  const overrideAudit = (appointmentId: string) =>
    adminPrisma.auditLog.findMany({
      where: { entityId: appointmentId, action: 'bridal.timeline.override' },
    });

  it('1. createAppointment sem grupo: respeita o registro e aceita terminar às 15:30', async () => {
    const g = await groupWithTimeline();
    const c = g.companionClientIds[0];
    const ok = await create(att(), c, w.serviceBId, w.members.proA, at(eventDay, 15), at(eventDay, 15, 30));
    expect(ok.errors).toEqual([]);
    expect(ok.appointment?.id).toBeTruthy();

    const bad = await create(att(), c, w.serviceId, w.members.proB, at(eventDay, 15), at(eventDay, 16));
    expect(bad.appointment).toBeNull();
    expect(bad.errors[0].code).toBe('TIMELINE_AFTER_REGISTRY');
    expect(bad.errors[0].message).toContain('15:30');
  });

  it('2. createVisit da acompanhante com a profissional do make dentro da janela da noiva', async () => {
    const g = await groupWithTimeline();
    const r = (
      await att()(CREATE_VISIT, {
        i: {
          clientId: g.companionClientIds[0],
          items: [
            {
              serviceId: w.serviceBId,
              professionalId: w.members.proA,
              startsAt: at(eventDay, 13),
              endsAt: at(eventDay, 13, 30),
            },
          ],
        },
      })
    ).data.createVisit as { appointments: unknown[]; errors: Err[] };
    expect(r.appointments).toEqual([]);
    expect(r.errors[0].code).toBe('TIMELINE_PROFESSIONAL_WITH_BRIDE');
    expect(r.errors[0].message).toContain('VITORIA');
    expect(r.errors[0].message).toContain('(make)');
  });

  it('3. com o agendamento real da noiva, vale SLOT_TAKEN e o override não o dispensa', async () => {
    const g = await groupWithTimeline();
    await insertAppt(g.brideClientId, w.members.proA, at(eventDay, 12, 30), at(eventDay, 14));
    const c = g.companionClientIds[0];
    const r = await create(att(), c, w.serviceBId, w.members.proA, at(eventDay, 13), at(eventDay, 13, 30));
    expect(r.errors[0].code).toBe('SLOT_TAKEN');
    const forced = await create(adm(), c, w.serviceBId, w.members.proA, at(eventDay, 13), at(eventDay, 13, 30), {
      reason: 'pedido da noiva',
    });
    expect(forced.errors[0].code).toBe('SLOT_TAKEN');
  });

  it('4. scheduleBridalEvent: bloqueia, e Gerente força com motivo (audit_log)', async () => {
    const g = await groupWithTimeline();
    const items = [
      {
        groupMemberId: g.companionMemberIds[0],
        serviceId: w.serviceId,
        professionalId: w.members.proA,
        startsAt: at(eventDay, 15),
        endsAt: at(eventDay, 16),
      },
    ];
    const blocked = (await att()(SCHEDULE, { input: { groupId: g.groupId, items } })).data
      .scheduleBridalEvent as { appointmentIds: string[]; errors: Err[] };
    expect(blocked.errors[0].code).toBe('TIMELINE_AFTER_REGISTRY');
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);

    const forced = (
      await mgr()(SCHEDULE, {
        input: { groupId: g.groupId, items, timelineOverride: { reason: 'pedido da noiva' } },
      })
    ).data.scheduleBridalEvent as { appointmentIds: string[]; errors: Err[] };
    expect(forced.errors).toEqual([]);
    expect(forced.appointmentIds).toHaveLength(1);
    const audit = await overrideAudit(forced.appointmentIds[0]);
    expect(audit).toHaveLength(1);
    expect(audit[0].actorMemberId).toBe(w.members.manager);
    expect(audit[0].reason).toBe('pedido da noiva');
    expect((audit[0].metadata as { rule: string }).rule).toBe('TIMELINE_AFTER_REGISTRY');
  });

  it('5. Atendente recebe OVERRIDE_FORBIDDEN; motivo curto vira OVERRIDE_REASON_REQUIRED', async () => {
    const g = await groupWithTimeline();
    const items = [
      {
        groupMemberId: g.companionMemberIds[0],
        serviceId: w.serviceId,
        professionalId: w.members.proA,
        startsAt: at(eventDay, 15),
        endsAt: at(eventDay, 16),
      },
    ];
    const forbidden = (
      await att()(SCHEDULE, { input: { groupId: g.groupId, items, timelineOverride: { reason: 'pedido da noiva' } } })
    ).data.scheduleBridalEvent as { errors: Err[] };
    expect(forbidden.errors[0].code).toBe('OVERRIDE_FORBIDDEN');

    const short = (
      await mgr()(SCHEDULE, { input: { groupId: g.groupId, items, timelineOverride: { reason: 'ok' } } })
    ).data.scheduleBridalEvent as { errors: Err[] };
    expect(short.errors[0].code).toBe('OVERRIDE_REASON_REQUIRED');
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);
  });

  it('6. moveAppointment bloqueia e Administrador força com auditoria', async () => {
    const g = await groupWithTimeline();
    const c = g.companionClientIds[0];
    const appt = await insertAppt(c, w.members.proA, at(eventDay, 14), at(eventDay, 15));
    const move = (gql: ReturnType<typeof att>, override?: { reason: string }) =>
      gql(MOVE, {
        i: { id: appt.id, professionalId: w.members.proA, startsAt: at(eventDay, 15), timelineOverride: override },
      }).then((r) => r.data.moveAppointment as { appointment: { id: string } | null; errors: Err[] });

    const blocked = await move(att());
    expect(blocked.errors[0].code).toBe('TIMELINE_AFTER_REGISTRY');

    const forced = await move(adm(), { reason: 'noiva autorizou' });
    expect(forced.errors).toEqual([]);
    expect(forced.appointment?.id).toBe(appt.id);
    const audit = await overrideAudit(appt.id);
    expect(audit).toHaveLength(1);
    expect(audit[0].actorMemberId).toBe(w.members.admin);
  });

  // Desde o 04.2-07, a revalidação da IA limita o "pronta até" ao início do registro e
  // barra o item antes da guarda geral: o código vira INVALID_PROPOSAL (AFTER_READY_BY),
  // mas o efeito é o mesmo — nada é agendado. TIMELINE_AFTER_REGISTRY segue coberto nos casos 1-6.
  it('7. confirmBridalSchedule barra acompanhante depois do registro', async () => {
    const g = await groupWithTimeline();
    const plan = (groupMemberId: string, serviceId: string, sortOrder: number) =>
      adminPrisma.bridalMemberService.create({
        data: { organizationId: w.orgId, groupMemberId, serviceId, purpose: 'event', sortOrder },
      });
    await plan(g.brideMemberId, w.serviceId, 0);
    await plan(g.companionMemberIds[0], w.serviceBId, 0);
    const r = (
      await adm()(CONFIRM, {
        input: {
          groupId: g.groupId,
          items: [
            {
              groupMemberId: g.brideMemberId,
              serviceId: w.serviceId,
              professionalId: w.members.proB,
              startsAt: at(eventDay, 9),
              endsAt: at(eventDay, 10),
            },
            {
              groupMemberId: g.companionMemberIds[0],
              serviceId: w.serviceBId,
              professionalId: w.members.proA,
              startsAt: at(eventDay, 15, 15),
              endsAt: at(eventDay, 15, 45),
            },
          ],
        },
      })
    ).data.confirmBridalSchedule as { appointmentIds: string[]; errors: Err[] };
    expect(r.appointmentIds).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.every((e) => e.code === 'INVALID_PROPOSAL')).toBe(true);
    expect(await adminPrisma.appointment.count({ where: { bridalGroupId: g.groupId } })).toBe(0);
  });

  it('8. não afeta noiva, teste, outro dia, grupo sem cronograma nem grupo cancelado', async () => {
    const g = await groupWithTimeline();
    const bride = (
      await att()(SCHEDULE, {
        input: {
          groupId: g.groupId,
          items: [
            {
              groupMemberId: g.brideMemberId,
              serviceId: w.serviceId,
              professionalId: w.members.proA,
              startsAt: at(eventDay, 15),
              endsAt: at(eventDay, 16),
            },
          ],
        },
      })
    ).data.scheduleBridalEvent as { appointmentIds: string[]; errors: Err[] };
    expect(bride.errors).toEqual([]);

    const trial = (
      await att()(SCHEDULE, {
        input: {
          groupId: g.groupId,
          items: [
            {
              groupMemberId: g.companionMemberIds[1],
              serviceId: w.serviceId,
              professionalId: w.members.proB,
              startsAt: at(localDay(50), 15),
              endsAt: at(localDay(50), 16),
              purpose: 'trial',
            },
          ],
        },
      })
    ).data.scheduleBridalEvent as { errors: Err[] };
    expect(trial.errors).toEqual([]);

    const c = g.companionClientIds[0];
    const otherDayRes = await create(att(), c, w.serviceId, w.members.proA, at(otherDay, 15), at(otherDay, 16));
    expect(otherDayRes.errors).toEqual([]);

    const noTimeline = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const r3 = await create(
      att(),
      noTimeline.companionClientIds[0],
      w.serviceId,
      w.members.proB,
      at(eventDay, 16),
      at(eventDay, 17),
    );
    expect(r3.errors).toEqual([]);

    const cancelled = await groupWithTimeline();
    await adminPrisma.bridalGroup.update({ where: { id: cancelled.groupId }, data: { status: 'cancelled' } });
    const r4 = await create(
      att(),
      cancelled.companionClientIds[0],
      w.serviceId,
      w.members.proB,
      at(eventDay, 17),
      at(eventDay, 18),
    );
    expect(r4.errors).toEqual([]);
  });

  it('9. agendamento da noiva ligado ao cronograma não é movido, nem com override', async () => {
    const g = await groupWithTimeline();
    const appt = await insertAppt(g.brideClientId, w.members.proA, at(eventDay, 12, 30), at(eventDay, 14));
    await adminPrisma.bridalTimeline.update({
      where: { id: g.timelineId },
      data: { makeAppointmentId: appt.id },
    });
    const r = (
      await adm()(MOVE, {
        i: {
          id: appt.id,
          professionalId: w.members.proA,
          startsAt: at(eventDay, 9),
          timelineOverride: { reason: 'tentativa de forcar' },
        },
      })
    ).data.moveAppointment as { appointment: unknown; errors: Err[] };
    expect(r.errors[0].code).toBe('TIMELINE_LINKED_APPOINTMENT');
    const after = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(after.startsAt.toISOString()).toBe(at(eventDay, 12, 30));
  });

  it('10. findCompanionIssuesTx lista as acompanhantes fora do cronograma sem mover nada', async () => {
    const g = await groupWithTimeline();
    const bad = await insertAppt(g.companionClientIds[0], w.members.proA, at(eventDay, 15), at(eventDay, 16));
    await insertAppt(g.companionClientIds[1], w.members.proA, at(eventDay, 14), at(eventDay, 15));

    const issues = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization', ${w.orgId}, true)`;
      return findCompanionIssuesTx(tx as unknown as TenantPrismaClient, g.groupId);
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].appointmentId).toBe(bad.id);
    expect(issues[0].rule).toBe('TIMELINE_AFTER_REGISTRY');

    const after = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: bad.id } });
    expect(after.startsAt.toISOString()).toBe(at(eventDay, 15));
  });

  describe('11 D-13/D-14: make-off e acompanhantes prontas até', () => {
    const UPDATE_GROUP = `mutation($id: UUID!, $i: BridalGroupFieldsInput!) {
      updateBridalGroup(id: $id, input: $i) { errors { code message field } }
    }`;

    it('11. companionsReadyBy 30 min antes do make-off recusa com a saída das acompanhantes', async () => {
      const g = await groupWithTimeline();
      await adminPrisma.bridalGroup.update({
        where: { id: g.groupId },
        data: { companionsReadyBy: new Date(at(eventDay, 15)) },
      });
      const c = g.companionClientIds[0];
      const ok = await create(att(), c, w.serviceBId, w.members.proA, at(eventDay, 14, 30), at(eventDay, 15));
      expect(ok.errors).toEqual([]);
      const bad = await create(att(), g.companionClientIds[1], w.serviceBId, w.members.proB, at(eventDay, 14, 45), at(eventDay, 15, 15));
      expect(bad.appointment).toBeNull();
      expect(bad.errors[0].code).toBe('TIMELINE_AFTER_REGISTRY');
      expect(bad.errors[0].message).toContain('saída das acompanhantes');
      expect(bad.errors[0].message).toContain('15h');
    });

    it('12. sem companionsReadyBy o limite é o make-off', async () => {
      const g = await groupWithTimeline();
      const bad = await create(att(), g.companionClientIds[0], w.serviceBId, w.members.proA, at(eventDay, 15), at(eventDay, 16));
      expect(bad.errors[0].code).toBe('TIMELINE_AFTER_REGISTRY');
      expect(bad.errors[0].message).toContain('make-off');
      expect(bad.errors[0].message).toContain('15:30');
    });

    it('13. companionIssues muda ao atualizar companionsReadyBy no grupo', async () => {
      const g = await groupWithTimeline();
      await insertAppt(g.companionClientIds[0], w.members.proA, at(eventDay, 14, 30), at(eventDay, 15, 15));
      const issues = () =>
        appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_organization', ${w.orgId}, true)`;
          return findCompanionIssuesTx(tx as unknown as TenantPrismaClient, g.groupId);
        });
      expect(await issues()).toHaveLength(0);
      const grp = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: g.groupId } });
      const r = (
        await adm()(UPDATE_GROUP, {
          id: g.groupId,
          i: {
            name: grp.name,
            eventDate: eventDay,
            locationKind: 'studio',
            companionsReadyBy: at(eventDay, 15),
          },
        })
      ).data.updateBridalGroup as { errors: Err[] };
      expect(r.errors).toEqual([]);
      const after = await issues();
      expect(after).toHaveLength(1);
      expect(after[0].rule).toBe('TIMELINE_AFTER_REGISTRY');
      expect(after[0].message).toContain('saída das acompanhantes');
    });

    it('14. debutante segue a mesma regra', async () => {
      const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay, eventKind: 'debutante' });
      await insertConfirmedTimelineRow(w, {
        groupId: g.groupId,
        departureTime: '17:00',
        departureAt: at(eventDay, 17),
        registryStartsAt: at(eventDay, 15, 30),
        registryLabel: 'fotos',
        brideLabel: 'DEBUTANTE',
        make: {
          professionalId: w.members.proA,
          serviceId: w.serviceId,
          startsAt: at(eventDay, 12, 30),
          endsAt: at(eventDay, 14),
        },
      });
      await adminPrisma.bridalGroup.update({
        where: { id: g.groupId },
        data: { companionsReadyBy: new Date(at(eventDay, 15)) },
      });
      const bad = await create(att(), g.companionClientIds[0], w.serviceBId, w.members.proB, at(eventDay, 14, 30), at(eventDay, 15, 15));
      expect(bad.errors[0].code).toBe('TIMELINE_AFTER_REGISTRY');
      expect(bad.errors[0].message).toContain('saída das acompanhantes');
    });

    it('15. sem cronograma confirmado nada é recusado, mesmo com companionsReadyBy', async () => {
      const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
      await adminPrisma.bridalGroup.update({
        where: { id: g.groupId },
        data: { companionsReadyBy: new Date(at(eventDay, 9)) },
      });
      const r = await create(att(), g.companionClientIds[0], w.serviceBId, w.members.proB, at(eventDay, 14), at(eventDay, 15));
      expect(r.errors).toEqual([]);
    });
  });
});

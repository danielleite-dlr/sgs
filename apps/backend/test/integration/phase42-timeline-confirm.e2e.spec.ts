import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  GLAM_STEPS,
  insertBridalGroupRow,
  insertPackageTimelineRows,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const CONFIRM = `mutation($input: BridalTimelineInput!) {
  confirmBridalTimeline(input: $input) {
    timeline {
      id version text registryLabel confirmedByName
      companionIssues { appointmentId rule message }
    }
    conflicts { stepName professionalName startsAt endsAt blockedBy }
    errors { code message field }
  }
}`;
const MOVE = `mutation($i: MoveAppointmentInput!) {
  moveAppointment(input: $i) { appointment { id } errors { code message field } }
}`;
const CANCEL = `mutation($input: CancelBridalGroupInput!) {
  cancelBridalGroup(input: $input) { group { id status } errors { code message field } }
}`;

const year = new Date().getFullYear() + 1;
const eventDay = `${year}-11-08`;

/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${eventDay}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

type Err = { code: string; message: string; field: string | null };
interface ConfirmPayload {
  timeline: {
    id: string;
    version: number;
    text: string;
    companionIssues: { appointmentId: string; rule: string; message: string }[];
  } | null;
  conflicts: { stepName: string; professionalName: string; blockedBy: string }[];
  errors: Err[];
}

describe('Fase 04.2 - ok do studio (confirmBridalTimeline)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p42cnf-%'`;
  let groupId: string;
  let brideClientId: string;
  let companionClientId: string;

  const att = () => gqlAs(w, w.tokens.attendant);
  const adm = () => gqlAs(w, w.tokens.admin);
  const input = (extra: Record<string, unknown> = {}) => ({
    groupId,
    packageId: w.bridalPackageId,
    departureTime: '17:00',
    makeProfessionalId: w.members.proA,
    hairProfessionalId: w.members.proB,
    ...extra,
  });
  const confirm = async (extra: Record<string, unknown> = {}, gql = att()) => {
    const res = await gql(CONFIRM, { input: input(extra) });
    return res.data.confirmBridalTimeline as ConfirmPayload;
  };
  const brideAppts = (clientId = brideClientId) =>
    adminPrisma.appointment.findMany({
      where: { organizationId: w.orgId, clientId, status: { not: 'cancelled' } },
      orderBy: { startsAt: 'asc' },
    });
  const counts = async () => ({
    appts: await adminPrisma.appointment.count({ where: { organizationId: w.orgId } }),
    timelines: await adminPrisma.bridalTimeline.count({ where: { organizationId: w.orgId } }),
  });
  const audits = (action: string) =>
    adminPrisma.auditLog.findMany({ where: { organizationId: w.orgId, action } });

  const appt = (
    clientId: string,
    pro: string,
    s: string,
    e: string,
    extra: Record<string, unknown> = {},
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: pro,
        clientId,
        serviceId: w.serviceId,
        startsAt: new Date(s),
        endsAt: new Date(e),
        ...extra,
      } as never,
    });

  beforeAll(async () => {
    w = await createPhase4World('p42cnf');
    await adminPrisma.package.update({
      where: { id: w.bridalPackageId },
      data: { name: 'Glam' },
    });
    await insertPackageTimelineRows(w, w.bridalPackageId, GLAM_STEPS, {
      makeServiceId: w.serviceId,
      hairServiceId: w.serviceBId,
    });
  });
  afterAll(async () => {
    await destroyPhase4World(w);
    await deletePhase4Rows(orgFilter);
  });

  beforeEach(async () => {
    const g = await insertBridalGroupRow(w, { companions: 2, eventDate: eventDay });
    groupId = g.groupId;
    brideClientId = g.brideClientId;
    companionClientId = g.companionClientIds[0];
  });
  afterEach(async () => {
    await adminPrisma.appointment.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.timeBlock.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.bridalTimeline.deleteMany({ where: { organizationId: w.orgId } });
  });

  it('1. confirma: cria make e penteado de 90 min com comanda, grava cronograma e readyBy', async () => {
    const r = await confirm();
    expect(r.errors).toEqual([]);
    expect(r.timeline?.version).toBe(1);

    const list = await brideAppts();
    expect(list).toHaveLength(2);
    const [make, hair] = list;
    expect(make.professionalId).toBe(w.members.proA);
    expect(make.startsAt.toISOString()).toBe(at(12, 30));
    expect(make.endsAt.toISOString()).toBe(at(14));
    expect(hair.professionalId).toBe(w.members.proB);
    expect(hair.startsAt.toISOString()).toBe(at(14));
    expect(hair.endsAt.toISOString()).toBe(at(15, 30));
    for (const a of list) {
      expect(a.purpose).toBe('event');
      expect(a.bridalGroupId).toBe(groupId);
      expect(a.comandaId).not.toBeNull();
    }

    const t = await adminPrisma.bridalTimeline.findFirstOrThrow({ where: { groupId } });
    expect(t.version).toBe(1);
    expect(t.text).toContain('Chegada fotógrafos: 15:10');
    expect(t.makeAppointmentId).toBe(make.id);
    expect(t.hairAppointmentId).toBe(hair.id);
    const g = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: groupId } });
    expect(g.readyBy?.toISOString()).toBe(at(17));
    expect(await audits('bridal.timeline.confirm')).toHaveLength(1);
  });

  it('2. sem profissional de penteado devolve TIMELINE_INCOMPLETE e não grava', async () => {
    const before = await counts();
    const r = await confirm({ hairProfessionalId: null });
    expect(r.timeline).toBeNull();
    expect(r.errors[0].code).toBe('TIMELINE_INCOMPLETE');
    expect(r.errors[0].message).toContain('Escolha a profissional de penteado.');
    expect(await counts()).toEqual(before);
  });

  it('3. conflito na agenda devolve quem ocupa e não grava nada', async () => {
    const other = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Ocupada' },
    });
    await appt(other.id, w.members.proA, at(13), at(13, 30));
    const before = await counts();
    const r = await confirm();
    expect(r.timeline).toBeNull();
    expect(r.errors[0].code).toBe('TIMELINE_CONFLICT');
    expect(r.conflicts[0].blockedBy).toContain('Cliente Ocupada');
    expect(await counts()).toEqual(before);
  });

  it('4. reconfirmar com outra saída move os mesmos agendamentos e sobe a versão', async () => {
    await confirm();
    const first = await brideAppts();
    const r = await confirm({ departureTime: '17:30' });
    expect(r.errors).toEqual([]);
    expect(r.timeline?.version).toBe(2);
    const list = await brideAppts();
    expect(list.map((a) => a.id)).toEqual(first.map((a) => a.id));
    expect(list[0].startsAt.toISOString()).toBe(at(13));
    expect(list[0].endsAt.toISOString()).toBe(at(14, 30));
    expect(list[1].startsAt.toISOString()).toBe(at(14, 30));
    expect(list[1].endsAt.toISOString()).toBe(at(16));
    expect(await audits('bridal.timeline.reconfirm')).toHaveLength(1);
  });

  it('5. reconfirmar com a mesma profissional nas duas etapas não conflita com o próprio make', async () => {
    await confirm();
    const r = await confirm({ hairProfessionalId: w.members.proA });
    expect(r.errors).toEqual([]);
    const list = await brideAppts();
    expect(list).toHaveLength(2);
    expect(list.every((a) => a.professionalId === w.members.proA)).toBe(true);
    expect(r.timeline?.version).toBe(2);
  });

  it('6. adota o agendamento existente da noiva em vez de duplicar; dois são ambíguos', async () => {
    const existing = await appt(brideClientId, w.members.proA, at(10), at(11), {
      bridalGroupId: groupId,
      purpose: 'event',
    });
    const r = await confirm();
    expect(r.errors).toEqual([]);
    const list = await brideAppts();
    expect(list).toHaveLength(2);
    const adopted = list.find((a) => a.id === existing.id)!;
    expect(adopted.startsAt.toISOString()).toBe(at(12, 30));
    expect(adopted.endsAt.toISOString()).toBe(at(14));
    const t = await adminPrisma.bridalTimeline.findFirstOrThrow({ where: { groupId } });
    expect(t.makeAppointmentId).toBe(existing.id);
    expect(t.hairAppointmentId).not.toBe(existing.id);

    // dois agendamentos do mesmo serviço, sem cronograma ainda: ambíguo
    await adminPrisma.bridalTimeline.deleteMany({ where: { groupId } });
    await adminPrisma.appointment.deleteMany({ where: { organizationId: w.orgId } });
    await appt(brideClientId, w.members.proA, at(10), at(11), {
      bridalGroupId: groupId,
      purpose: 'event',
    });
    await appt(brideClientId, w.members.proB, at(15), at(16), {
      bridalGroupId: groupId,
      purpose: 'event',
    });
    const before = await counts();
    const amb = await confirm();
    expect(amb.errors[0].code).toBe('TIMELINE_AMBIGUOUS_APPOINTMENTS');
    expect(await counts()).toEqual(before);
  });

  it('6b. adota agendamento da noiva sem grupo que cruza a janela do make', async () => {
    const orphan = await appt(brideClientId, w.members.proA, at(12), at(13));
    const r = await confirm();
    expect(r.errors).toEqual([]);
    const list = await brideAppts();
    expect(list).toHaveLength(2);
    const adopted = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: orphan.id } });
    expect(adopted.bridalGroupId).toBe(groupId);
    expect(adopted.purpose).toBe('event');
    expect(adopted.startsAt.toISOString()).toBe(at(12, 30));
    expect(adopted.endsAt.toISOString()).toBe(at(14));
  });

  it('6c. reconfirmar em grupo externo não esbarra nos deslocamentos do próprio grupo', async () => {
    const g = await insertBridalGroupRow(w, {
      companions: 1,
      eventDate: eventDay,
      locationKind: 'external',
      travelBefore: 60,
      travelAfter: 60,
    });
    groupId = g.groupId;
    brideClientId = g.brideClientId;
    await appt(g.companionClientIds[0], w.members.proA, at(9), at(10), {
      bridalGroupId: groupId,
      purpose: 'event',
    });

    const first = await confirm();
    expect(first.errors).toEqual([]);
    const blocksOf = () =>
      adminPrisma.timeBlock.findMany({
        where: { bridalGroupId: groupId, kind: 'deslocamento' },
        orderBy: { startsAt: 'asc' },
      });
    const b1 = await blocksOf();
    expect(b1.length).toBeGreaterThan(0);

    const second = await confirm({ departureTime: '16:30' });
    expect(second.errors).toEqual([]);
    expect(second.timeline?.version).toBe(2);
    const b2 = await blocksOf();
    expect(b2.length).toBe(b1.length);
    // make agora 12:00-13:30 com proA: deslocamento depois do último agendamento da proA
    const proABlocks = b2.filter((b) => b.professionalId === w.members.proA);
    expect(proABlocks.some((b) => b.startsAt.toISOString() === at(13, 30))).toBe(true);
    expect(proABlocks.some((b) => b.endsAt.toISOString() === at(9))).toBe(true);
  });

  it('7. acompanhante que deixou de caber é sinalizada sem ser movida', async () => {
    const c = await appt(companionClientId, w.members.proA, at(14), at(15), {
      bridalGroupId: groupId,
      purpose: 'event',
    });
    const first = await confirm();
    expect(first.errors).toEqual([]);

    const r = await confirm({ departureTime: '16:00' });
    expect(r.errors).toEqual([]);
    const issue = r.timeline?.companionIssues.find((i) => i.appointmentId === c.id);
    expect(issue?.rule).toBe('TIMELINE_AFTER_REGISTRY');
    const after = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.startsAt.toISOString()).toBe(at(14));
    expect(after.endsAt.toISOString()).toBe(at(15));
  });

  it('8. arrastar o make confirmado é bloqueado', async () => {
    await confirm();
    const make = (await brideAppts())[0];
    const res = await att()(MOVE, {
      i: { id: make.id, professionalId: w.members.proA, startsAt: at(9) },
    });
    expect(res.data.moveAppointment.errors[0].code).toBe('TIMELINE_LINKED_APPOINTMENT');
  });

  it('9. profissional não confirma; pacote sem regra devolve TIMELINE_RULES_MISSING', async () => {
    const denied = await gqlAs(w, w.tokens.proA)(CONFIRM, { input: input() });
    expect(denied.errors).toBeDefined();
    expect(await adminPrisma.bridalTimeline.count({ where: { groupId } })).toBe(0);

    const empty = await adminPrisma.package.create({
      data: {
        organizationId: w.orgId,
        name: 'p42cnf-vazio',
        price: '100.00',
        depositKind: 'percent',
        depositValue: '30.00',
      },
    });
    const r = await confirm({ packageId: empty.id });
    expect(r.errors[0].code).toBe('TIMELINE_RULES_MISSING');
  });

  it('10. cancelar o grupo cancela make e penteado da noiva', async () => {
    await confirm();
    const done = await adm()(CANCEL, { input: { id: groupId, reason: 'Desistência da noiva' } });
    expect(done.data.cancelBridalGroup.errors).toEqual([]);
    const rows = await adminPrisma.appointment.findMany({
      where: { organizationId: w.orgId, clientId: brideClientId },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((a) => a.status === 'cancelled')).toBe(true);
  });
});

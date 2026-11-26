import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { markServesBridal } from './helpers/phase11-fixtures';

const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
  scheduleBridalEvent(input: $input) {
    appointmentIds
    errors { code message field }
  }
}`;
const CONFIRM = `mutation($input: ConfirmBridalScheduleInput!) {
  confirmBridalSchedule(input: $input) { appointmentIds errors { code message field } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
/** Horário local de São Paulo (UTC-3) como instante ISO. */
function at(day: string, hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

type Err = { code: string; message: string; field: string | null };

describe('Fase 11 - filtro "atende noiva/debutante" no servidor (D-19)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p11filter-%'`;
  const eventDay = localDay(80);
  const trialDay = localDay(60);

  beforeAll(async () => {
    w = await createPhase4World('p11filter', { bridalPros: false });
    await markServesBridal([w.members.proB]);
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

  const admin = () => gqlAs(w, w.tokens.admin);
  const count = (groupId: string) =>
    adminPrisma.appointment.count({ where: { bridalGroupId: groupId } });

  const item = (
    groupMemberId: string,
    professionalId: string,
    over: Record<string, unknown> = {},
  ) => ({
    groupMemberId,
    serviceId: w.serviceId,
    professionalId,
    startsAt: at(eventDay, 9),
    endsAt: at(eventDay, 10),
    ...over,
  });

  const schedule = async (input: Record<string, unknown>) =>
    (await admin()(SCHEDULE, { input })).data.scheduleBridalEvent as {
      appointmentIds: string[] | null;
      errors: Err[];
    };

  it('noiva com profissional sem marcação: PROFESSIONAL_NOT_BRIDAL e nada gravado', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const r = await schedule({ groupId: g.groupId, items: [item(g.brideMemberId, w.members.proA)] });
    expect(r.errors[0].code).toBe('PROFESSIONAL_NOT_BRIDAL');
    const proA = await adminPrisma.member.findUniqueOrThrow({ where: { id: w.members.proA } });
    expect(r.errors[0].message).toContain(proA.displayName);
    expect(await count(g.groupId)).toBe(0);
  });

  it('noiva com profissional marcada: agenda', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const r = await schedule({ groupId: g.groupId, items: [item(g.brideMemberId, w.members.proB)] });
    expect(r.errors).toEqual([]);
    expect(await count(g.groupId)).toBe(1);
  });

  it('acompanhante com profissional sem marcação: agenda (D-02)', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const r = await schedule({
      groupId: g.groupId,
      items: [item(g.companionMemberIds[0], w.members.proA)],
    });
    expect(r.errors).toEqual([]);
    expect(await count(g.groupId)).toBe(1);
  });

  it('prova (trial) da noiva: recusa sem marcação e aceita com marcação', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    const trial = (pro: string) =>
      item(g.brideMemberId, pro, {
        purpose: 'trial',
        startsAt: at(trialDay, 9),
        endsAt: at(trialDay, 10),
      });
    const bad = await schedule({ groupId: g.groupId, items: [trial(w.members.proA)] });
    expect(bad.errors[0].code).toBe('PROFESSIONAL_NOT_BRIDAL');
    expect(await count(g.groupId)).toBe(0);
    const ok = await schedule({ groupId: g.groupId, items: [trial(w.members.proB)] });
    expect(ok.errors).toEqual([]);
    expect(await count(g.groupId)).toBe(1);
  });

  it('debutante (role bride) com profissional sem marcação: PROFESSIONAL_NOT_BRIDAL', async () => {
    const g = await insertBridalGroupRow(w, {
      companions: 0,
      eventDate: eventDay,
      eventKind: 'debutante',
    });
    const r = await schedule({ groupId: g.groupId, items: [item(g.brideMemberId, w.members.proA)] });
    expect(r.errors[0].code).toBe('PROFESSIONAL_NOT_BRIDAL');
    expect(await count(g.groupId)).toBe(0);
  });

  it('confirmação da sugestão por IA com a noiva em profissional sem marcação: recusada', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    await adminPrisma.bridalMemberService.create({
      data: {
        organizationId: w.orgId,
        groupMemberId: g.brideMemberId,
        serviceId: w.serviceId,
        purpose: 'event',
        sortOrder: 0,
      },
    });
    const r = (
      await admin()(CONFIRM, {
        input: { groupId: g.groupId, items: [item(g.brideMemberId, w.members.proA)] },
      })
    ).data.confirmBridalSchedule as { appointmentIds: string[] | null; errors: Err[] };
    expect(['PROFESSIONAL_NOT_BRIDAL', 'INVALID_PROPOSAL']).toContain(r.errors[0].code);
    expect(await count(g.groupId)).toBe(0);
  });
});

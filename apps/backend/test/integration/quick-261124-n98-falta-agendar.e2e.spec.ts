import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

// quick 261124-n98: serviço do evento planejado na pessoa sem agendamento ativo no grupo aparece
// em unscheduledServiceIds; o grupo conta os pendentes só depois que a agenda do evento existe.

const GET = `query($id: UUID!) {
  bridalGroup(id: $id) {
    unscheduledServiceCount
    members { id unscheduledServiceIds }
  }
}`;

describe('quick 261124-n98 - falta agendar no grupo da noiva', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'q24n98-%'`;

  beforeAll(async () => {
    w = await createPhase4World('q24n98');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await deletePhase4Rows(orgFilter);
  });

  const plan = (memberId: string, serviceId: string, purpose = 'event') =>
    adminPrisma.bridalMemberService.create({
      data: { organizationId: w.orgId, groupMemberId: memberId, serviceId, purpose },
    });

  const book = (
    groupId: string,
    clientId: string,
    serviceId: string,
    hh: number,
    status = 'scheduled',
    purpose: string | null = 'event',
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId,
        serviceId,
        bridalGroupId: groupId,
        purpose,
        status,
        startsAt: new Date(`2030-06-15T${String(hh).padStart(2, '0')}:00:00.000Z`),
        endsAt: new Date(`2030-06-15T${String(hh).padStart(2, '0')}:59:00.000Z`),
      },
    });

  const load = async (groupId: string) => {
    const r = await gqlAs(w, w.tokens.manager)(GET, { id: groupId });
    return r.data.bridalGroup as {
      unscheduledServiceCount: number;
      members: { id: string; unscheduledServiceIds: string[] }[];
    };
  };

  it('acompanhante com make e penteado, só penteado agendado: falta a make', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1 });
    const comp = g.companionMemberIds[0];
    await plan(comp, w.serviceId);
    await plan(comp, w.serviceBId);
    await book(g.groupId, g.companionClientIds[0], w.serviceBId, 13);

    const v = await load(g.groupId);
    expect(v.members.find((m) => m.id === comp)?.unscheduledServiceIds).toEqual([w.serviceId]);
    expect(v.unscheduledServiceCount).toBe(1);
  });

  it('agendamento cancelado não conta; teste não cobre o evento', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1 });
    await plan(g.brideMemberId, w.serviceId);
    await plan(g.brideMemberId, w.serviceId, 'trial');
    await book(g.groupId, g.brideClientId, w.serviceId, 10, 'cancelled');
    await book(g.groupId, g.brideClientId, w.serviceId, 11, 'completed', 'trial');
    await plan(g.companionMemberIds[0], w.serviceBId);
    await book(g.groupId, g.companionClientIds[0], w.serviceBId, 12);

    const v = await load(g.groupId);
    expect(v.members.find((m) => m.id === g.brideMemberId)?.unscheduledServiceIds).toEqual([
      w.serviceId,
    ]);
    expect(v.unscheduledServiceCount).toBe(1);
  });

  it('agenda do evento ainda não montada: pessoa mostra o que falta, grupo conta 0', async () => {
    const g = await insertBridalGroupRow(w, { companions: 0 });
    await plan(g.brideMemberId, w.serviceId);

    const v = await load(g.groupId);
    expect(v.members[0].unscheduledServiceIds).toEqual([w.serviceId]);
    expect(v.unscheduledServiceCount).toBe(0);
  });
});

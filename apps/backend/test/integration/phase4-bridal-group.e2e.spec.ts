import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const PAYLOAD = `
  group {
    id name eventDate readyBy locationKind locationAddress travelMinutesBefore travelMinutesAfter
    status contractId contractCode contractStatus appointmentCount
    members {
      id clientId clientName clientPhone role relationLabel coveredByContract hasClosedComanda
      services { id serviceId serviceName durationMinutes purpose }
    }
  }
  errors { code message field }`;
const CREATE = `mutation($i: CreateBridalGroupInput!) { createBridalGroup(input: $i) { ${PAYLOAD} } }`;
const UPDATE = `mutation($id: UUID!, $i: BridalGroupFieldsInput!) { updateBridalGroup(id: $id, input: $i) { ${PAYLOAD} } }`;
const ADD = `mutation($g: UUID!, $p: BridalPersonInput!) { addBridalGroupMember(groupId: $g, person: $p) { ${PAYLOAD} } }`;
const REMOVE = `mutation($m: UUID!) { removeBridalGroupMember(memberId: $m) { ${PAYLOAD} } }`;
const COVER = `mutation($m: UUID!, $c: Boolean!) { setBridalMemberCoverage(memberId: $m, covered: $c) { ${PAYLOAD} } }`;
const LIST = `query($f: String, $t: String, $s: String) { bridalGroups(from: $f, to: $t, status: $s) { id name eventDate contractCode } }`;
const GET = `query($id: UUID!) { bridalGroup(id: $id) { id name } }`;

describe('Phase 4 - grupos de noivas (CLI-03)', () => {
  let w: Phase4World;
  const orgFilter = () => `SELECT id FROM organizations WHERE legal_name LIKE 'p4bg-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4bg');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await deletePhase3Rows(orgFilter());
    await deletePhase4Rows(orgFilter());
  });

  const admin = () => gqlAs(w, w.tokens.admin);
  const fields = (extra: Record<string, unknown> = {}) => ({
    name: 'Casamento Teste',
    eventDate: '2030-06-15',
    ...extra,
  });
  const companion = (i: number, extra: Record<string, unknown> = {}) => ({
    newClient: { fullName: `p4bg-madrinha-${i}`, phone: i <= 2 ? `1199999000${i}` : undefined },
    relationLabel: 'madrinha',
    services: [{ serviceId: w.serviceBId }],
    ...extra,
  });
  const createFull = async () => {
    const r = await admin()(CREATE, {
      i: {
        group: fields(),
        bride: {
          clientId: w.clientId,
          services: [
            { serviceId: w.serviceId },
            { serviceId: w.serviceBId, purpose: 'trial' },
          ],
        },
        companions: [1, 2, 3, 4].map((i) => companion(i)),
      },
    });
    if (!r.data) throw new Error(JSON.stringify(r.errors));
    return r.data.createBridalGroup;
  };

  it('cria grupo com noiva + 4 acompanhantes (cliente existente e mínima)', async () => {
    const p = await createFull();
    expect(p.errors).toEqual([]);
    const g = p.group;
    expect(g.eventDate).toBe('2030-06-15');
    expect(g.members).toHaveLength(5);
    expect(g.members[0].role).toBe('bride');
    expect(g.members[0].clientId).toBe(w.clientId);
    expect(g.members[0].coveredByContract).toBe(true);
    expect(g.members[0].services.map((s: { purpose: string }) => s.purpose).sort()).toEqual([
      'event',
      'trial',
    ]);
    const comps = g.members.slice(1);
    expect(comps.every((m: { coveredByContract: boolean }) => m.coveredByContract === false)).toBe(
      true,
    );
    expect(comps.filter((m: { clientPhone: string | null }) => m.clientPhone).length).toBe(2);
    const minimal = await adminPrisma.client.findMany({
      where: { organizationId: w.orgId, fullName: { startsWith: 'p4bg-madrinha-' } },
    });
    expect(minimal).toHaveLength(4);
    expect(minimal.every((c) => !c.cpf && !c.email)).toBe(true);
  });

  it('impede cliente repetida e segunda noiva', async () => {
    const dup = await admin()(CREATE, {
      i: {
        group: fields(),
        bride: { clientId: w.clientId },
        companions: [{ clientId: w.clientId }],
      },
    });
    expect(dup.data.createBridalGroup.errors[0].code).toBe('MEMBER_ALREADY_IN_GROUP');
    expect(
      await adminPrisma.bridalGroup.count({ where: { organizationId: w.orgId } }),
    ).toBe(0);

    const ok = (await createFull()).group;
    const again = await admin()(ADD, { g: ok.id, p: { clientId: w.clientId } });
    expect(again.data.addBridalGroupMember.errors[0].code).toBe('MEMBER_ALREADY_IN_GROUP');

    const other = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'p4bg-outra' },
    });
    await expect(
      adminPrisma.bridalGroupMember.create({
        data: { organizationId: w.orgId, groupId: ok.id, clientId: other.id, role: 'bride' },
      }),
    ).rejects.toThrow(/Unique constraint failed on the fields: \(`group_id`\)/);
  });

  it('valida local externo, deslocamento e "pronta até"', async () => {
    const run = async (extra: Record<string, unknown>) =>
      (
        await admin()(CREATE, {
          i: { group: fields(extra), bride: { clientId: w.clientId } },
        })
      ).data.createBridalGroup.errors[0]?.code;
    expect(await run({ locationKind: 'external' })).toBe('ADDRESS_REQUIRED');
    expect(
      await run({ locationKind: 'external', locationAddress: 'Rua X', travelMinutesBefore: 300 }),
    ).toBe('INVALID_TRAVEL');
    expect(await run({ readyBy: '2030-06-20T12:00:00Z' })).toBe('READY_BY_OUTSIDE_EVENT_DAY');
    expect(await run({ eventDate: '2030-13-45' })).toBe('INVALID_EVENT_DATE');
    expect(await run({ readyBy: '2030-06-15T15:00:00Z' })).toBeUndefined();
  });

  it('troca cobertura e trava com comanda fechada (D-25)', async () => {
    const g = (await createFull()).group;
    const m = g.members[1];
    const on = await admin()(COVER, { m: m.id, c: true });
    expect(on.data.setBridalMemberCoverage.errors).toEqual([]);

    const comanda = await adminPrisma.comanda.create({
      data: {
        organizationId: w.orgId,
        code: `P4BG-${Date.now() % 100000}`,
        clientId: m.clientId,
        status: 'closed',
        closedAt: new Date(),
      },
    });
    await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: m.clientId,
        serviceId: w.serviceId,
        startsAt: new Date('2030-06-15T10:00:00Z'),
        endsAt: new Date('2030-06-15T11:00:00Z'),
        status: 'completed',
        comandaId: comanda.id,
        bridalGroupId: g.id,
      },
    });
    const off = await admin()(COVER, { m: m.id, c: false });
    expect(off.data.setBridalMemberCoverage.errors[0].code).toBe('COVERAGE_LOCKED');
    const view = await admin()(GET.replace('{ id name }', '{ members { id hasClosedComanda } }'), {
      id: g.id,
    });
    const flags = view.data.bridalGroup.members.filter(
      (x: { hasClosedComanda: boolean }) => x.hasClosedComanda,
    );
    expect(flags).toHaveLength(1);
  });

  it('bloqueia desmarcar cobertura/remover membro em contrato vivo e remover a noiva', async () => {
    const seed = await insertBridalGroupRow(w, { companions: 1, covered: [true] });
    const { contractId } = await insertContractRow(w, {
      groupId: seed.groupId,
      brideClientId: seed.brideClientId,
      totalAmount: '100.00',
      depositAmount: '30.00',
      items: [
        {
          groupMemberId: seed.companionMemberIds[0],
          serviceId: w.serviceId,
          unitPrice: '100.00',
        },
      ],
    });
    expect(contractId).toBeTruthy();
    const off = await admin()(COVER, { m: seed.companionMemberIds[0], c: false });
    expect(off.data.setBridalMemberCoverage.errors[0].code).toBe('MEMBER_IN_CONTRACT');
    const rm = await admin()(REMOVE, { m: seed.companionMemberIds[0] });
    expect(rm.data.removeBridalGroupMember.errors[0].code).toBe('MEMBER_IN_CONTRACT');
    const rmBride = await admin()(REMOVE, { m: seed.brideMemberId });
    expect(rmBride.data.removeBridalGroupMember.errors[0].code).toBe('CANNOT_REMOVE_BRIDE');
  });

  it('RBAC e RLS', async () => {
    const seed = await insertBridalGroupRow(w, { companions: 0 });
    const denied = await gqlAs(w, w.tokens.proA)(LIST, {});
    expect(denied.errors?.length).toBeGreaterThan(0);

    const att = await gqlAs(w, w.tokens.attendant)(CREATE, {
      i: { group: fields(), bride: { clientId: w.clientId } },
    });
    expect(att.data.createBridalGroup.errors).toEqual([]);

    const other = gqlAs(w, w.tokens.otherAdmin);
    const got = await other(GET, { id: seed.groupId });
    expect(got.data.bridalGroup).toBeNull();
    const upd = await other(UPDATE, { id: seed.groupId, i: fields({ name: 'Invadido' }) });
    expect(upd.data.updateBridalGroup.errors[0].code).toBe('NOT_FOUND');
    const list = await other(LIST, {});
    expect(list.data.bridalGroups).toEqual([]);
    const row = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: seed.groupId } });
    expect(row.name).not.toBe('Invadido');
  });

  it('filtra por data do evento e mostra o código do contrato vivo', async () => {
    const a = await insertBridalGroupRow(w, { eventDate: '2030-06-15' });
    await insertBridalGroupRow(w, { eventDate: '2030-09-20' });
    const { code } = await insertContractRow(w, {
      groupId: a.groupId,
      brideClientId: a.brideClientId,
      totalAmount: '100.00',
      depositAmount: '30.00',
    });
    const r = await admin()(LIST, { f: '2030-06-01', t: '2030-06-30' });
    expect(r.data.bridalGroups).toHaveLength(1);
    expect(r.data.bridalGroups[0].id).toBe(a.groupId);
    expect(r.data.bridalGroups[0].contractCode).toBe(code);
    const all = await admin()(LIST, { s: 'active' });
    expect(all.data.bridalGroups).toHaveLength(2);
    expect(all.data.bridalGroups[0].eventDate).toBe('2030-06-15');
  });

  it('limita 15 pessoas e atualiza o grupo', async () => {
    const tooMany = await admin()(CREATE, {
      i: {
        group: fields(),
        bride: { clientId: w.clientId },
        companions: Array.from({ length: 15 }, (_, i) => companion(i + 10)),
      },
    });
    expect(tooMany.data.createBridalGroup.errors[0].code).toBe('TOO_MANY_PEOPLE');
    const g = (await createFull()).group;
    const upd = await admin()(UPDATE, {
      id: g.id,
      i: fields({ name: 'Novo nome', locationKind: 'external', locationAddress: 'Sítio Boa Vista', travelMinutesBefore: 60 }),
    });
    expect(upd.data.updateBridalGroup.errors).toEqual([]);
    expect(upd.data.updateBridalGroup.group.locationKind).toBe('external');
    expect(upd.data.updateBridalGroup.group.travelMinutesBefore).toBe(60);
  });
});

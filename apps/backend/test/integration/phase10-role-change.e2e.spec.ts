import { adminPrisma } from './setup';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';

const UPDATE = `mutation($i: UpdateMemberInput!) {
  updateMember(input: $i) { member { id } errors { code } }
}`;
const CREATE = `mutation($i: CreateMemberInput!) {
  createMember(input: $i) { errors { code } }
}`;
const DEACTIVATE = `mutation($id: UUID!) { deactivateMember(id: $id) { errors { code } } }`;
const REACTIVATE = `mutation($id: UUID!) { reactivateMember(id: $id) { errors { code } } }`;
const ALL = `query { allMembers { id } }`;

describe('10 — troca de papel e equipe', () => {
  let w: Phase10World;
  let attendantRoleId: string;

  beforeAll(async () => {
    w = await createPhase10World('p10role');
    attendantRoleId = (
      await adminPrisma.role.findFirstOrThrow({
        where: { isSystem: true, name: 'ATTENDANT' },
      })
    ).id;
  });
  afterAll(async () => {
    await destroyPhase10World(w);
  });

  afterEach(async () => {
    await clearOverrides(w);
    await adminPrisma.auditLog.deleteMany({
      where: { organizationId: w.orgId, action: { startsWith: 'member.access.' } },
    });
    await adminPrisma.member.update({
      where: { id: w.attendantB.memberId },
      data: { roleId: attendantRoleId, status: 'active', isProfessional: false },
    });
  });

  const rows = (memberId: string) =>
    adminPrisma.memberAccessOverride.findMany({ where: { memberId } });
  const resets = () =>
    adminPrisma.auditLog.findMany({
      where: {
        organizationId: w.orgId,
        action: 'member.access.reset',
        entityId: w.attendantB.memberId,
      },
    });

  it('trocar o papel apaga os ajustes e audita role_change', async () => {
    const id = w.attendantB.memberId;
    await setOverrideRow(w, id, 'fin-controle', true);
    await setOverrideRow(w, id, 'agenda', false);

    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id, roleName: 'PROFESSIONAL' },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data.updateMember.errors).toEqual([]);
    expect(await rows(id)).toHaveLength(0);

    const a = await resets();
    expect(a).toHaveLength(1);
    expect(a[0].actorMemberId).toBe(w.members.admin);
    const meta = a[0].metadata as {
      reason: string;
      fromRole: string;
      toRole: string;
      removed: unknown[];
    };
    expect(meta).toMatchObject({
      reason: 'role_change',
      fromRole: 'ATTENDANT',
      toRole: 'PROFESSIONAL',
    });
    expect(meta.removed).toHaveLength(2);
  });

  it('updateMember sem trocar papel mantém os ajustes e não audita', async () => {
    const id = w.attendantB.memberId;
    await setOverrideRow(w, id, 'fin-controle', true);
    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id, phone: '11999990000' },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data.updateMember.errors).toEqual([]);
    expect(await rows(id)).toHaveLength(1);
    expect(await resets()).toHaveLength(0);
  });

  it('troca de papel sem ajustes não audita reset', async () => {
    const id = w.attendantB.memberId;
    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id, roleName: 'PROFESSIONAL' },
    });
    expect(res.data.updateMember.errors).toEqual([]);
    expect(await resets()).toHaveLength(0);
  });

  it('desativar e reativar mantém os ajustes', async () => {
    const id = w.attendantB.memberId;
    await setOverrideRow(w, id, 'fin-controle', true);
    const asAdmin = gqlAs(w, w.tokens.admin);
    const off = await asAdmin(DEACTIVATE, { id });
    expect(off.errors).toBeUndefined();
    const on = await asAdmin(REACTIVATE, { id });
    expect(on.errors).toBeUndefined();
    expect(await rows(id)).toHaveLength(1);
  });

  it('Gerente sem profissionais-todos não edita/cadastra, mas ainda lista a equipe', async () => {
    await setOverrideRow(w, w.members.manager, 'profissionais-todos', false);
    const asManager = gqlAs(w, w.tokens.manager);
    const code = (r: { errors?: { extensions?: Record<string, unknown> }[] }) =>
      r.errors?.[0]?.extensions?.code;

    const upd = await asManager(UPDATE, {
      i: { id: w.attendantB.memberId, phone: '11999990000' },
    });
    expect(code(upd)).toBe('ACCESS_DENIED');
    const crt = await asManager(CREATE, {
      i: {
        displayName: 'Fulana',
        email: 'fulana-p10role@t.com',
        phone: '11999990000',
        pixKey: '11999990000',
        roleName: 'ATTENDANT',
        temporaryPassword: 'senha-provisoria-123',
      },
    });
    expect(code(crt)).toBe('ACCESS_DENIED');

    const list = await asManager(ALL);
    expect(list.errors).toBeUndefined();
    expect(list.data.allMembers.length).toBeGreaterThan(0);
  });
});

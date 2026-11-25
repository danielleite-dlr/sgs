import { adminPrisma } from './setup';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';

const SET = `mutation($i: SetMemberAccessInput!) {
  setMemberAccess(input: $i) {
    errors { code message }
    access { memberId editable adjustedCount items { id enabled source adjustable } }
  }
}`;
const RESET = `mutation($m: UUID!) {
  resetMemberAccess(memberId: $m) { errors { code } access { adjustedCount } }
}`;
const ACCESS = `query($m: UUID!) {
  memberAccess(memberId: $m) {
    memberId roleName editable lockReason adjustedCount
    items { id enabled adjustable lockReason }
  }
}`;
const OVERVIEW = `query { memberAccessOverview { memberId adjustedCount } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];

describe('10 — administração de acessos', () => {
  let w: Phase10World;

  beforeAll(async () => {
    w = await createPhase10World('p10adm');
  });
  afterAll(async () => {
    await destroyPhase10World(w);
  });

  async function restoreRoles() {
    const roles = await adminPrisma.role.findMany({
      where: { isSystem: true, name: { in: ['ATTENDANT'] } },
    });
    await adminPrisma.member.update({
      where: { id: w.attendantB.memberId },
      data: { roleId: roles[0].id },
    });
  }

  afterEach(async () => {
    await clearOverrides(w);
    await adminPrisma.auditLog.deleteMany({
      where: { organizationId: w.orgId, action: { startsWith: 'member.access.' } },
    });
    await restoreRoles();
  });

  const audits = (action: string, entityId: string) =>
    adminPrisma.auditLog.findMany({
      where: { organizationId: w.orgId, action, entityId },
    });
  const rows = (memberId: string) =>
    adminPrisma.memberAccessOverride.findMany({ where: { memberId } });

  it('Admin liga fin-controle para a atendente, grava a linha e audita', async () => {
    const asAdmin = gqlAs(w, w.tokens.admin);
    const res = await asAdmin(SET, {
      i: {
        memberId: w.members.attendant,
        changes: [{ itemId: 'fin-controle', enabled: true }],
      },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data.setMemberAccess.errors).toEqual([]);
    expect(res.data.setMemberAccess.access.adjustedCount).toBe(1);
    const r = await rows(w.members.attendant);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ itemId: 'fin-controle', enabled: true });

    const a = await audits('member.access.update', w.members.attendant);
    expect(a).toHaveLength(1);
    expect(a[0].actorMemberId).toBe(w.members.admin);
    expect(a[0].metadata).toMatchObject({
      actorRole: 'ADMIN',
      targetRole: 'ATTENDANT',
      changes: [{ itemId: 'fin-controle', from: false, to: true }],
    });
  });

  it('religar para o padrão apaga a linha e audita', async () => {
    const asAdmin = gqlAs(w, w.tokens.admin);
    await asAdmin(SET, {
      i: { memberId: w.members.attendant, changes: [{ itemId: 'agenda', enabled: false }] },
    });
    expect(await rows(w.members.attendant)).toHaveLength(1);
    const res = await asAdmin(SET, {
      i: { memberId: w.members.attendant, changes: [{ itemId: 'agenda', enabled: true }] },
    });
    expect(res.data.setMemberAccess.errors).toEqual([]);
    expect(await rows(w.members.attendant)).toHaveLength(0);
    const a = await audits('member.access.update', w.members.attendant);
    expect(a).toHaveLength(2);
    const changes = a.flatMap(
      (x) => (x.metadata as { changes: unknown[] }).changes,
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        { itemId: 'agenda', from: false, to: true },
        { itemId: 'agenda', from: true, to: false },
      ]),
    );
  });

  it('mudança sem efeito não grava nem audita', async () => {
    const asAdmin = gqlAs(w, w.tokens.admin);
    const res = await asAdmin(SET, {
      i: { memberId: w.members.attendant, changes: [{ itemId: 'agenda', enabled: true }] },
    });
    expect(res.data.setMemberAccess.errors).toEqual([]);
    expect(await rows(w.members.attendant)).toHaveLength(0);
    expect(await audits('member.access.update', w.members.attendant)).toHaveLength(0);
  });

  it('lote com item desconhecido é recusado por inteiro', async () => {
    const asAdmin = gqlAs(w, w.tokens.admin);
    const res = await asAdmin(SET, {
      i: {
        memberId: w.members.attendant,
        changes: [
          { itemId: 'fin-controle', enabled: true },
          { itemId: 'nao-existe', enabled: true },
        ],
      },
    });
    expect(res.data.setMemberAccess.errors[0].code).toBe('ACCESS_ITEM_UNKNOWN');
    expect(await rows(w.members.attendant)).toHaveLength(0);
  });

  it('Admin no Admin, Gerente em Gerente e em si mesmo são recusados', async () => {
    const asAdmin = gqlAs(w, w.tokens.admin);
    const adm = await asAdmin(SET, {
      i: { memberId: w.members.admin, changes: [{ itemId: 'agenda', enabled: false }] },
    });
    expect(adm.data.setMemberAccess.errors[0].code).toBe('ACCESS_TARGET_ADMIN');
    expect(await rows(w.members.admin)).toHaveLength(0);

    const mgrRole = await adminPrisma.role.findFirstOrThrow({
      where: { isSystem: true, name: 'MANAGER' },
    });
    await adminPrisma.member.update({
      where: { id: w.attendantB.memberId },
      data: { roleId: mgrRole.id },
    });
    const asManager = gqlAs(w, w.tokens.manager);
    const other = await asManager(SET, {
      i: { memberId: w.attendantB.memberId, changes: [{ itemId: 'agenda', enabled: false }] },
    });
    expect(other.data.setMemberAccess.errors[0].code).toBe('ACCESS_TARGET_FORBIDDEN');
    const self = await asManager(SET, {
      i: { memberId: w.members.manager, changes: [{ itemId: 'agenda', enabled: false }] },
    });
    expect(self.data.setMemberAccess.errors[0].code).toBe('ACCESS_TARGET_SELF');
    const toAdmin = await asManager(SET, {
      i: { memberId: w.members.admin, changes: [{ itemId: 'agenda', enabled: false }] },
    });
    expect(toAdmin.data.setMemberAccess.errors[0].code).toBe('ACCESS_TARGET_ADMIN');
  });

  it('Gerente sem fin-controle não concede, mas desliga agenda da atendente', async () => {
    await setOverrideRow(w, w.members.manager, 'fin-controle', false);
    const asManager = gqlAs(w, w.tokens.manager);
    const grant = await asManager(SET, {
      i: { memberId: w.members.attendant, changes: [{ itemId: 'fin-controle', enabled: true }] },
    });
    expect(grant.data.setMemberAccess.errors[0].code).toBe('ACCESS_GRANT_EXCEEDS_ACTOR');
    expect(await rows(w.members.attendant)).toHaveLength(0);

    const off = await asManager(SET, {
      i: { memberId: w.members.attendant, changes: [{ itemId: 'agenda', enabled: false }] },
    });
    expect(off.data.setMemberAccess.errors).toEqual([]);
    expect(await rows(w.members.attendant)).toHaveLength(1);
  });

  it('Perfis de acesso não liga para Profissional', async () => {
    const asAdmin = gqlAs(w, w.tokens.admin);
    const res = await asAdmin(SET, {
      i: {
        memberId: w.members.proA,
        changes: [{ itemId: 'profissionais-perfis', enabled: true }],
      },
    });
    expect(res.data.setMemberAccess.errors[0].code).toBe('ACCESS_ITEM_NOT_GRANTABLE');
    expect(await rows(w.members.proA)).toHaveLength(0);
  });

  it('Atendente e Profissional não leem nem gravam acessos', async () => {
    const asAtt = gqlAs(w, w.tokens.attendant);
    const asPro = gqlAs(w, w.tokens.proA);
    const code = (r: { errors?: GqlErrors }) => r.errors?.[0]?.extensions?.code;
    expect(code(await asAtt(ACCESS, { m: w.members.proA }))).toBe('ACCESS_DENIED');
    expect(code(await asAtt(OVERVIEW))).toBe('ACCESS_DENIED');
    expect(
      code(
        await asAtt(SET, {
          i: { memberId: w.members.proA, changes: [{ itemId: 'agenda', enabled: false }] },
        }),
      ),
    ).toBe('ACCESS_DENIED');
    expect(code(await asPro(RESET, { m: w.members.attendant }))).toBe('ACCESS_DENIED');
  });

  it('resetMemberAccess apaga todas as linhas e audita com o que foi removido', async () => {
    await setOverrideRow(w, w.members.attendant, 'fin-controle', true);
    await setOverrideRow(w, w.members.attendant, 'agenda', false);
    const res = await gqlAs(w, w.tokens.admin)(RESET, { m: w.members.attendant });
    expect(res.data.resetMemberAccess.errors).toEqual([]);
    expect(await rows(w.members.attendant)).toHaveLength(0);
    const a = await audits('member.access.reset', w.members.attendant);
    expect(a).toHaveLength(1);
    const meta = a[0].metadata as { reason: string; removed: { itemId: string; enabled: boolean }[] };
    expect(meta.reason).toBe('manual');
    expect(meta.removed).toHaveLength(2);
    expect(meta.removed).toEqual(
      expect.arrayContaining([
        { itemId: 'fin-controle', enabled: true },
        { itemId: 'agenda', enabled: false },
      ]),
    );
  });

  it('memberAccess: Gerente vê Profissional editável, Admin travado', async () => {
    const asManager = gqlAs(w, w.tokens.manager);
    const pro = await asManager(ACCESS, { m: w.members.proA });
    expect(pro.errors).toBeUndefined();
    const v = pro.data.memberAccess;
    expect(v.editable).toBe(true);
    expect(v.items).toHaveLength(23);
    const perfis = v.items.find((i: { id: string }) => i.id === 'profissionais-perfis');
    expect(perfis.adjustable).toBe(false);

    const adm = await asManager(ACCESS, { m: w.members.admin });
    expect(adm.data.memberAccess.editable).toBe(false);
    expect(adm.data.memberAccess.lockReason).toBe(
      'O Administrador sempre tem todos os acessos.',
    );
  });

  it('memberAccessOverview lista membros ativos com a contagem de ajustes', async () => {
    await setOverrideRow(w, w.members.attendant, 'fin-controle', true);
    await setOverrideRow(w, w.members.attendant, 'agenda', false);
    const res = await gqlAs(w, w.tokens.admin)(OVERVIEW);
    expect(res.errors).toBeUndefined();
    const list = res.data.memberAccessOverview as { memberId: string; adjustedCount: number }[];
    expect(list.find((x) => x.memberId === w.members.attendant)?.adjustedCount).toBe(2);
    expect(list.find((x) => x.memberId === w.members.admin)?.adjustedCount).toBe(0);
  });
});

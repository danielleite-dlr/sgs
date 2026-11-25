import { adminPrisma, appPrisma } from './setup';
import {
  createPhase10World,
  destroyPhase10World,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';

describe('10 — RLS de member_access_overrides', () => {
  let w: Phase10World;
  let seq = 0;
  const stamp = Date.now();

  beforeAll(async () => {
    w = await createPhase10World('p10rls');
  });
  afterAll(async () => {
    await destroyPhase10World(w);
  });

  async function mkMember(tag: string, orgId = w.orgId): Promise<string> {
    const user = await adminPrisma.user.create({
      data: {
        email: `p10rls-${tag}-${stamp}-${++seq}@t.com`,
        fullName: `p10rls ${tag}`,
        passwordHash: 'x',
        emailVerifiedAt: new Date(),
      },
    });
    const role = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    const member = await adminPrisma.member.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        roleId: role.id,
        displayName: `p10rls-${tag}`,
        isProfessional: true,
      },
    });
    return member.id;
  }

  const countOverrides = async (memberId: string): Promise<number> => {
    const rows = await adminPrisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT count(*) AS c FROM member_access_overrides WHERE member_id = '${memberId}'::uuid`,
    );
    return Number(rows[0].c);
  };

  it('a tabela tem RLS habilitada e forçada', async () => {
    const rows = await adminPrisma.$queryRawUnsafe<{ rls: boolean; frc: boolean }[]>(
      `SELECT relrowsecurity AS rls, relforcerowsecurity AS frc FROM pg_class
       WHERE relname = 'member_access_overrides'`,
    );
    expect(rows[0]).toEqual({ rls: true, frc: true });
  });

  it('isola por salão: org A vê, org B não vê e não grava na A', async () => {
    const memberId = await mkMember('iso');
    await setOverrideRow(w, memberId, 'agenda', false);

    const seenIn = (orgId: string) =>
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_organization', '${orgId}', true)`);
        const rows = await tx.$queryRawUnsafe<{ c: bigint }[]>(
          `SELECT count(*) AS c FROM member_access_overrides WHERE member_id = '${memberId}'::uuid`,
        );
        return Number(rows[0].c);
      });
    expect(await seenIn(w.orgId)).toBe(1);
    expect(await seenIn(w.otherOrgId)).toBe(0);

    // WITH CHECK: na org B não dá para gravar linha da org A
    await expect(
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO member_access_overrides (member_id, organization_id, item_id, enabled)
           VALUES ('${memberId}'::uuid, '${w.orgId}'::uuid, 'financeiro', true)`,
        );
      }),
    ).rejects.toThrow();

    // sgs_app grava e apaga dentro do próprio salão
    await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_organization', '${w.orgId}', true)`);
      await tx.$executeRawUnsafe(
        `INSERT INTO member_access_overrides (member_id, organization_id, item_id, enabled)
         VALUES ('${memberId}'::uuid, '${w.orgId}'::uuid, 'financeiro', true)`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM member_access_overrides WHERE member_id = '${memberId}'::uuid AND item_id = 'financeiro'`,
      );
    });
    expect(await countOverrides(memberId)).toBe(1);
  });

  it('sem tenant setado, sgs_app lê 0 linhas', async () => {
    const memberId = await mkMember('notenant');
    await setOverrideRow(w, memberId, 'agenda', true);
    const rows = await appPrisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT count(*) AS c FROM member_access_overrides`,
    );
    expect(Number(rows[0].c)).toBe(0);
  });

  it('DELETE do membro apaga os ajustes; quem ajustou excluído vira updated_by NULL', async () => {
    const target = await mkMember('alvo');
    const author = await mkMember('autor');
    await setOverrideRow(w, target, 'agenda', false);
    await adminPrisma.$executeRawUnsafe(
      `UPDATE member_access_overrides SET updated_by = '${author}'::uuid WHERE member_id = '${target}'::uuid`,
    );

    await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE id = '${author}'::uuid`);
    const after = await adminPrisma.$queryRawUnsafe<{ updated_by: string | null }[]>(
      `SELECT updated_by FROM member_access_overrides WHERE member_id = '${target}'::uuid`,
    );
    expect(after).toHaveLength(1);
    expect(after[0].updated_by).toBeNull();

    await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE id = '${target}'::uuid`);
    expect(await countOverrides(target)).toBe(0);
  });

  it('purge_member apaga o membro e os ajustes dele', async () => {
    const memberId = await mkMember('purge');
    await setOverrideRow(w, memberId, 'agenda', false);
    await setOverrideRow(w, memberId, 'financeiro', true);
    expect(await countOverrides(memberId)).toBe(2);

    await adminPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_organization', '${w.orgId}', true)`);
      await tx.$executeRawUnsafe(`SELECT purge_member('${memberId}'::uuid)`);
    });
    expect(await countOverrides(memberId)).toBe(0);
    const m = await adminPrisma.member.findUnique({ where: { id: memberId } });
    expect(m).toBeNull();
  });
});

import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { TenantContextService } from '../../src/database/tenant-context.service';

const REG =
  'mutation($input: RegisterDeviceTokenInput!) { registerDeviceToken(input: $input) }';
const UNREG =
  'mutation($token: String!) { unregisterDeviceToken(token: $token) }';

describe('Fase 7 - device tokens (RLS, upsert, unregister, RBAC)', () => {
  let w: Phase3World;

  const reg = (token: string, tok: string, platform = 'android') =>
    gqlAs(w, token)(REG, { input: { token: tok, platform } });

  beforeAll(async () => {
    w = await createPhase3World('p7devtok');
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      "DELETE FROM device_tokens WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'p7devtok-%')",
    );
    await destroyPhase3World(w);
  });

  it('RBAC: admin, gerente, atendente e profissional registram o próprio token', async () => {
    const papeis = ['admin', 'manager', 'attendant', 'proA'] as const;
    for (const papel of papeis) {
      const r = await reg(w.tokens[papel], `tok-p7-${papel}`);
      expect(r.errors).toBeUndefined();
      expect(r.data.registerDeviceToken).toBe(true);
    }
    const n = await adminPrisma.deviceToken.count({
      where: { organizationId: w.orgId },
    });
    expect(n).toBe(4);
  });

  it('aparelho compartilhado: o mesmo token passa para a nova usuária', async () => {
    expect((await reg(w.tokens.proA, 'tok-p7-shared')).errors).toBeUndefined();
    expect((await reg(w.tokens.proB, 'tok-p7-shared')).errors).toBeUndefined();
    const rows = await adminPrisma.deviceToken.findMany({
      where: { token: 'tok-p7-shared', organizationId: w.orgId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].memberId).toBe(w.members.proB);
  });

  it('registrar de novo atualiza lastSeenAt e não duplica', async () => {
    await reg(w.tokens.attendant, 'tok-p7-reseen');
    const a = await adminPrisma.deviceToken.findFirstOrThrow({
      where: { token: 'tok-p7-reseen' },
    });
    await new Promise((r) => setTimeout(r, 25));
    await reg(w.tokens.attendant, 'tok-p7-reseen');
    const rows = await adminPrisma.deviceToken.findMany({
      where: { token: 'tok-p7-reseen' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastSeenAt.getTime()).toBeGreaterThan(
      a.lastSeenAt.getTime(),
    );
  });

  it('RLS: o mesmo token em outro salão fica isolado', async () => {
    const r = await reg(w.tokens.otherAdmin, 'tok-p7-shared');
    expect(r.errors).toBeUndefined();
    const total = await adminPrisma.deviceToken.findMany({
      where: { token: 'tok-p7-shared' },
    });
    expect(total).toHaveLength(2);
    const visiveis = await w.app
      .get(TenantContextService)
      .runWithTenant(w.orgId, (tx) =>
        tx.deviceToken.findMany({ where: { token: 'tok-p7-shared' } }),
      );
    expect(visiveis).toHaveLength(1);
    expect(visiveis[0].organizationId).toBe(w.orgId);
  });

  it('unregister apaga só o token da própria usuária', async () => {
    const outra = await gqlAs(w, w.tokens.proA)(UNREG, {
      token: 'tok-p7-shared',
    });
    expect(outra.data.unregisterDeviceToken).toBe(true);
    expect(
      await adminPrisma.deviceToken.count({
        where: { token: 'tok-p7-shared', organizationId: w.orgId },
      }),
    ).toBe(1);

    const propria = await gqlAs(w, w.tokens.proB)(UNREG, {
      token: 'tok-p7-shared',
    });
    expect(propria.data.unregisterDeviceToken).toBe(true);
    expect(
      await adminPrisma.deviceToken.count({
        where: { token: 'tok-p7-shared', organizationId: w.orgId },
      }),
    ).toBe(0);
    expect(
      await adminPrisma.deviceToken.count({
        where: { token: 'tok-p7-shared', organizationId: w.otherOrgId },
      }),
    ).toBe(1);
  });

  it('validação: plataforma inválida devolve erro em pt-BR e não grava', async () => {
    const r = await reg(w.tokens.admin, 'tok-p7-web', 'web');
    expect(r.errors?.[0].message).toContain('Plataforma inválida.');
    expect(
      await adminPrisma.deviceToken.count({ where: { token: 'tok-p7-web' } }),
    ).toBe(0);
  });

  it('sem token de acesso válido a mutation é negada', async () => {
    const r = await gqlAs(w, 'invalido')(REG, {
      input: { token: 'tok-p7-anon', platform: 'android' },
    });
    expect(r.errors?.length).toBeGreaterThan(0);
    expect(
      await adminPrisma.deviceToken.count({ where: { token: 'tok-p7-anon' } }),
    ).toBe(0);
  });
});

import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { openComandaTx } from '../../src/comandas/comanda-open';
import { nextComandaCode } from '../../src/comandas/comanda-code';

describe('Phase 3 - código de comanda', () => {
  let w: Phase3World;
  let tenant: TenantContextService;
  const year = new Date().getFullYear();

  beforeAll(async () => {
    w = await createPhase3World('p3code');
    tenant = w.app.get(TenantContextService);
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(
      `SELECT id FROM organizations WHERE legal_name LIKE 'p3code-%'`,
    );
  });

  const open = (orgId: string, clientId: string, openedBy: string) =>
    tenant.runWithTenant(orgId, (tx) =>
      openComandaTx(tx, { orgId, clientId, openedBy }),
    );

  it('20 aberturas em paralelo geram C-ano-001..020 contíguos', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        open(w.orgId, w.clientId, w.members.attendant),
      ),
    );
    const codes = results.map((c) => c.code).sort();
    const expected = Array.from(
      { length: 20 },
      (_, i) => `C-${year}-${String(i + 1).padStart(3, '0')}`,
    );
    expect(codes).toEqual(expected);
  });

  it('o ano vem do fuso da organização', async () => {
    const code = await tenant.runWithTenant(w.orgId, (tx) =>
      nextComandaCode(tx, w.orgId, new Date('2027-01-01T02:30:00Z')),
    );
    // 02:30Z de 01/01/2027 ainda é 31/12/2026 em America/Sao_Paulo
    expect(code).toBe('C-2026-001');
  });

  it('rollback devolve o número (sem buraco)', async () => {
    await expect(
      tenant.runWithTenant(w.orgId, async (tx) => {
        await nextComandaCode(tx, w.orgId);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const c = await open(w.orgId, w.clientId, w.members.attendant);
    expect(c.code).toBe(`C-${year}-001`);
  });

  it('cada organização tem a própria sequência', async () => {
    await open(w.orgId, w.clientId, w.members.attendant);
    await open(w.orgId, w.clientId, w.members.attendant);
    const otherClient = await adminPrisma.client.create({
      data: {
        organizationId: w.otherOrgId,
        fullName: 'p3code-outro',
        phone: '+5511988880009',
      },
    });
    const b = await open(w.otherOrgId, otherClient.id, w.members.admin);
    expect(b.code).toBe(`C-${year}-001`);
  });

  it('cliente inexistente é recusado', async () => {
    await expect(
      open(w.orgId, '00000000-0000-4000-8000-000000000000', w.members.attendant),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' });
  });
});

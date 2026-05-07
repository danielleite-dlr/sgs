import { adminPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { ClientsService } from '../../src/clients/clients.service';

/**
 * Integration tests for ClientsService — CRUD, CPF validation, duplicate lookup,
 * soft-delete, restore, history stub, and RLS tenant isolation.
 *
 * Running: pnpm test:int -- --testPathPattern clients
 */
describe('ClientsService — CRUD', () => {
  let orgAId: string;
  let orgBId: string;
  let service: ClientsService;

  beforeAll(async () => {
    // Clean up leftovers
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE full_name LIKE 'cli-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cli-test-%'`,
    );

    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'cli-test-A',
        tradeName: 'CliA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}`.slice(0, 14).padEnd(14, '5'),
        email: 'cli-a@test.com',
        subdomain: `cli-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'cli-test-B',
        tradeName: 'CliB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now() + 3}`.slice(0, 14).padEnd(14, '6'),
        email: 'cli-b@test.com',
        subdomain: `cli-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    const prismaService = new PrismaService();
    const tenantCtx = new TenantContextService(prismaService);
    service = new ClientsService(tenantCtx);
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE full_name LIKE 'cli-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cli-test-%'`,
    );
  });

  // -----------------------------------------------------------------------
  // Test 1: createClient with fullName + phone → success
  // -----------------------------------------------------------------------
  it('1. createClient with fullName + phone succeeds', async () => {
    const result = await service.create(orgAId, {
      fullName: 'cli-test-Ana',
      phone: '(11) 99999-0000',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.client).not.toBeNull();
    expect(result.client!.fullName).toBe('cli-test-Ana');
    expect(result.client!.phone).toBe('(11) 99999-0000');
  });

  // -----------------------------------------------------------------------
  // Test 2: createClient without phone and email → CONTACT_REQUIRED
  // -----------------------------------------------------------------------
  it('2. createClient without phone and email returns CONTACT_REQUIRED', async () => {
    const result = await service.create(orgAId, {
      fullName: 'cli-test-Beto',
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('CONTACT_REQUIRED');
    expect(result.client).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 3: createClient with invalid CPF → CPF_INVALID
  // -----------------------------------------------------------------------
  it('3. createClient with invalid CPF returns CPF_INVALID', async () => {
    const result = await service.create(orgAId, {
      fullName: 'cli-test-Carlos',
      phone: '(11) 88888-0001',
      cpf: '111.111.111-11', // bogus all-same-digit
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('CPF_INVALID');
    expect(result.client).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 4: createClient with valid CPF → success, stored normalized
  // -----------------------------------------------------------------------
  it('4. createClient with valid CPF stores normalized digits', async () => {
    const result = await service.create(orgAId, {
      fullName: 'cli-test-Daniela',
      phone: '(11) 77777-0002',
      cpf: '529.982.247-25',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.client).not.toBeNull();
    // Stored without formatting
    expect(result.client!.cpf).toBe('52998224725');
  });

  // -----------------------------------------------------------------------
  // Test 5: clientsByField(cpf) → returns matching client
  // -----------------------------------------------------------------------
  it('5. clientsByField by CPF returns the matching client', async () => {
    const results = await service.byField(orgAId, { cpf: '52998224725' });
    expect(results.length).toBeGreaterThan(0);
    const found = results.find((c) => c.cpf === '52998224725');
    expect(found).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Test 6: clientsByField with excludeId → filters out that client
  // -----------------------------------------------------------------------
  it('6. clientsByField with excludeId excludes that client', async () => {
    const matches = await service.byField(orgAId, { cpf: '52998224725' });
    expect(matches.length).toBeGreaterThan(0);
    const targetId = matches[0].id;

    const results = await service.byField(orgAId, {
      cpf: '52998224725',
      excludeId: targetId,
    });
    const found = results.find((c) => c.id === targetId);
    expect(found).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Test 7: listClients search is case-insensitive
  // -----------------------------------------------------------------------
  it('7. listClients search matches case-insensitively', async () => {
    await service.create(orgAId, {
      fullName: 'cli-test-Elegância',
      email: 'elegancia@test.com',
    });
    const result = await service.list(orgAId, { search: 'elegÂncia' });
    const found = result.rows.find((c) => c.fullName.includes('Elegância'));
    expect(found).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Test 8: softDeleteClient removes client from list
  // -----------------------------------------------------------------------
  it('8. softDeleteClient excludes client from subsequent list', async () => {
    const created = await service.create(orgAId, {
      fullName: 'cli-test-Fernanda',
      phone: '(11) 66666-0003',
    });
    expect(created.errors).toHaveLength(0);
    const clientId = created.client!.id;

    const deleted = await service.softDelete(orgAId, clientId);
    expect(deleted.errors).toHaveLength(0);
    expect(deleted.client!.deletedAt).not.toBeNull();

    const list = await service.list(orgAId);
    const found = list.rows.find((c) => c.id === clientId);
    expect(found).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Test 9: restoreClient makes client visible again
  // -----------------------------------------------------------------------
  it('9. restoreClient makes client reappear in list', async () => {
    const created = await service.create(orgAId, {
      fullName: 'cli-test-Gabriela',
      phone: '(11) 55555-0004',
    });
    expect(created.errors).toHaveLength(0);
    const clientId = created.client!.id;

    await service.softDelete(orgAId, clientId);
    const restored = await service.restore(orgAId, clientId);
    expect(restored.errors).toHaveLength(0);
    expect(restored.client!.deletedAt).toBeNull();

    const list = await service.list(orgAId);
    const found = list.rows.find((c) => c.id === clientId);
    expect(found).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Test 10: clientHistory returns empty array (Phase 2 stub)
  // -----------------------------------------------------------------------
  it('10. clientHistory returns empty array (Phase 2 stub)', async () => {
    const created = await service.create(orgAId, {
      fullName: 'cli-test-Helena',
      email: 'helena@test.com',
    });
    expect(created.errors).toHaveLength(0);
    const clientId = created.client!.id;

    const history = await service.history(orgAId, clientId);
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Test 11: ATTENDANT role has CLIENT_WRITE (verified via permissions catalog)
  // -----------------------------------------------------------------------
  it('11. ATTENDANT has CLIENT_WRITE permission in catalog', async () => {
    // This verifies the permissions catalog definition without needing an HTTP layer
    const { PERMISSIONS, ROLE_PERMISSIONS } = await import(
      '../../src/authz/permissions.catalog'
    );
    expect(ROLE_PERMISSIONS.ATTENDANT).toContain(PERMISSIONS.CLIENT_WRITE);
  });

  // -----------------------------------------------------------------------
  // Test 12: PROFESSIONAL does not have CLIENT_WRITE (read-only per D-02)
  // -----------------------------------------------------------------------
  it('12. PROFESSIONAL does not have CLIENT_WRITE permission', async () => {
    const { PERMISSIONS, ROLE_PERMISSIONS } = await import(
      '../../src/authz/permissions.catalog'
    );
    expect(ROLE_PERMISSIONS.PROFESSIONAL).not.toContain(
      PERMISSIONS.CLIENT_WRITE,
    );
    expect(ROLE_PERMISSIONS.PROFESSIONAL).toContain(PERMISSIONS.CLIENT_READ);
  });

  // -----------------------------------------------------------------------
  // Test 13: RLS — org B cannot see org A clients
  // -----------------------------------------------------------------------
  it('13. RLS: org B cannot see org A clients', async () => {
    // Create a client in org A
    await service.create(orgAId, {
      fullName: 'cli-test-Isolamento',
      phone: '(11) 44444-0005',
    });

    // List clients from org B — should not include org A clients
    const resultB = await service.list(orgBId);
    const orgAClients = resultB.rows.filter((c) =>
      c.fullName.startsWith('cli-test-'),
    );
    expect(orgAClients).toHaveLength(0);
  });
});

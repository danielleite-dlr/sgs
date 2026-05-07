import { adminPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CommissionsService } from '../../src/catalog/commissions/commissions.service';

/**
 * Integration tests for CommissionsService — CRUD with scope validation + conflict detection.
 * Proves P2002 conflict handling, soft-delete scope reuse, and tenant isolation.
 *
 * Running: pnpm test:integration -- --testPathPattern commission-rules
 */
describe('CommissionsService — CRUD', () => {
  let orgAId: string;
  let orgBId: string;
  let service: CommissionsService;

  beforeAll(async () => {
    // Clean up leftovers
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commission_rules WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'cr-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cr-test-%'`,
    );

    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'cr-test-A',
        tradeName: 'CRA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}`.slice(0, 14).padEnd(14, '3'),
        email: 'cr-a@test.com',
        subdomain: `cr-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'cr-test-B',
        tradeName: 'CRB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now() + 2}`.slice(0, 14).padEnd(14, '4'),
        email: 'cr-b@test.com',
        subdomain: `cr-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    const prismaService = new PrismaService();
    const tenantCtx = new TenantContextService(prismaService);
    service = new CommissionsService(tenantCtx);
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commission_rules WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'cr-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cr-test-%'`,
    );
  });

  it('1. ADMIN creates default org rule (scopeType=default, kind=percentage, value=10)', async () => {
    const result = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'percentage',
      value: '10',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.rule).toBeDefined();
    expect(result.rule?.scopeType).toBe('default');
    expect(result.rule?.kind).toBe('percentage');
  });

  it('2. Creating second default rule returns COMMISSION_SCOPE_CONFLICT', async () => {
    const result = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'fixed',
      value: '50',
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('COMMISSION_SCOPE_CONFLICT');
    expect(result.rule).toBeNull();
  });

  it('3. After softDelete, creating a new default rule succeeds', async () => {
    // First find and delete the existing default rule
    const rules = await service.list(orgAId);
    const defaultRule = rules.find((r) => r.scopeType === 'default');
    expect(defaultRule).toBeDefined();

    const deleteResult = await service.softDelete(orgAId, defaultRule!.id);
    expect(deleteResult.errors).toHaveLength(0);

    // Now create a new default rule — should succeed because old one is soft-deleted
    const result = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'fixed',
      value: '25',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.rule).toBeDefined();
  });

  it('4. member_service rule without serviceId returns SCOPE_INVALID', async () => {
    const result = await service.create(orgAId, {
      scopeType: 'member_service',
      kind: 'percentage',
      value: '15',
      memberId: '00000000-0000-0000-0000-000000000001', // fake UUID
      // serviceId intentionally missing
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('SCOPE_INVALID');
  });

  it('5. kind=percentage value=150 returns VALUE_OUT_OF_RANGE', async () => {
    const result = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'percentage',
      value: '150',
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('VALUE_OUT_OF_RANGE');
  });

  it('6. Rule referencing non-existent serviceId returns REFERENCE_NOT_FOUND', async () => {
    const result = await service.create(orgAId, {
      scopeType: 'service',
      kind: 'percentage',
      value: '10',
      serviceId: '00000000-0000-0000-0000-000000000999', // non-existent
    });
    // Either NOT_FOUND (FK violation via P2003) or Prisma throws — both acceptable
    expect(result.errors.length).toBeGreaterThan(0);
    expect(['REFERENCE_NOT_FOUND', 'SCOPE_INVALID']).toContain(
      result.errors[0].code,
    );
  });

  it('7. updateCommissionRule changes kind/value successfully', async () => {
    const rules = await service.list(orgAId);
    const existing = rules.find((r) => r.deletedAt === null);
    expect(existing).toBeDefined();

    const result = await service.update(orgAId, {
      id: existing!.id,
      kind: 'percentage',
      value: '20',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.rule?.kind).toBe('percentage');
  });

  it('8. RLS: org B cannot read org A commission rules', async () => {
    const rulesA = await service.list(orgAId);
    const rulesB = await service.list(orgBId);
    const aIds = new Set(rulesA.map((r) => r.id));
    rulesB.forEach((r) => expect(aIds.has(r.id)).toBe(false));
  });

  it('9. listCommissionRules returns only non-deleted rules', async () => {
    const all = await service.list(orgAId);
    all.forEach((r) => expect(r.deletedAt).toBeNull());
  });
});

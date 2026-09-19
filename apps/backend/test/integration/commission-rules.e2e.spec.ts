import { adminPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CommissionsService } from '../../src/catalog/commissions/commissions.service';

/**
 * Integration tests for Commission rules: scope validation, professional-only
 * member_service rules, conflict handling, and tenant isolation.
 */
describe('CommissionsService — CRUD', () => {
  let orgAId: string;
  let orgBId: string;
  let professionalAId: string;
  let nonProfessionalAId: string;
  let serviceAId: string;
  let serviceBId: string;
  let service: CommissionsService;

  const cleanup = async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commission_rules WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'cr-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'cr-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'cr-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'cr-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cr-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'cr-test-%'`,
    );
  };

  beforeAll(async () => {
    await cleanup();

    const now = Date.now();
    const [orgA, orgB] = await Promise.all([
      adminPrisma.organization.create({
        data: {
          legalName: 'cr-test-A',
          tradeName: 'CRA',
          documentType: 'CNPJ',
          documentNumber: `${now}`.slice(0, 14).padEnd(14, '3'),
          email: 'cr-a@test.com',
          subdomain: `cr-a-${now}`,
          segment: 'salon',
        },
      }),
      adminPrisma.organization.create({
        data: {
          legalName: 'cr-test-B',
          tradeName: 'CRB',
          documentType: 'CNPJ',
          documentNumber: `${now + 2}`.slice(0, 14).padEnd(14, '4'),
          email: 'cr-b@test.com',
          subdomain: `cr-b-${now}`,
          segment: 'salon',
        },
      }),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;

    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    const createMember = async (
      organizationId: string,
      suffix: string,
      isProfessional: boolean,
    ) => {
      const user = await adminPrisma.user.create({
        data: {
          email: `cr-test-${suffix}-${now}@test.com`,
          passwordHash: 'placeholder',
          fullName: `CR Test ${suffix}`,
        },
      });
      return adminPrisma.member.create({
        data: {
          organizationId,
          userId: user.id,
          roleId: adminRole.id,
          displayName: `cr-test-${suffix}`,
          isProfessional,
        },
      });
    };
    professionalAId = (await createMember(orgAId, 'professional-a', true)).id;
    nonProfessionalAId = (await createMember(orgAId, 'admin-a', false)).id;

    const [categoryA, categoryB] = await Promise.all([
      adminPrisma.category.create({
        data: { organizationId: orgAId, name: 'cr-test-category-a' },
      }),
      adminPrisma.category.create({
        data: { organizationId: orgBId, name: 'cr-test-category-b' },
      }),
    ]);
    serviceAId = (
      await adminPrisma.service.create({
        data: {
          organizationId: orgAId,
          categoryId: categoryA.id,
          name: 'cr-test-service-a',
          basePrice: '100.00',
          defaultDurationMinutes: 60,
        },
      })
    ).id;
    serviceBId = (
      await adminPrisma.service.create({
        data: {
          organizationId: orgBId,
          categoryId: categoryB.id,
          name: 'cr-test-service-b',
          basePrice: '100.00',
          defaultDurationMinutes: 60,
        },
      })
    ).id;

    service = new CommissionsService(
      new TenantContextService(new PrismaService()),
    );
  });

  afterAll(cleanup);

  it('creates a default organization rule and detects a conflicting duplicate', async () => {
    const first = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'percentage',
      value: '10',
    });
    expect(first.errors).toHaveLength(0);
    expect(first.rule?.scopeType).toBe('default');

    const duplicate = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'fixed',
      value: '50',
    });
    expect(duplicate.errors[0].code).toBe('COMMISSION_SCOPE_CONFLICT');
  });

  it('allows scope reuse after soft delete', async () => {
    const rule = (await service.list(orgAId)).find(
      (item) => item.scopeType === 'default',
    );
    expect(rule).toBeDefined();
    expect((await service.softDelete(orgAId, rule!.id)).errors).toHaveLength(0);

    const replacement = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'fixed',
      value: '25',
    });
    expect(replacement.errors).toHaveLength(0);
  });

  it('rejects malformed member_service scope and an out-of-range percentage', async () => {
    const missingService = await service.create(orgAId, {
      scopeType: 'member_service',
      kind: 'percentage',
      value: '15',
      memberId: professionalAId,
    });
    expect(missingService.errors[0].code).toBe('SCOPE_INVALID');

    const outOfRange = await service.create(orgAId, {
      scopeType: 'default',
      kind: 'percentage',
      value: '150',
    });
    expect(outOfRange.errors[0].code).toBe('VALUE_OUT_OF_RANGE');
  });

  it('creates a specific commission for an active professional and same-tenant service', async () => {
    const result = await service.create(orgAId, {
      scopeType: 'member_service',
      kind: 'percentage',
      value: '15',
      memberId: professionalAId,
      serviceId: serviceAId,
    });
    expect(result.errors).toHaveLength(0);
    expect(result.rule?.memberId).toBe(professionalAId);
    expect(result.rule?.serviceId).toBe(serviceAId);
  });

  it('rejects a non-professional, cross-tenant, and absent service reference', async () => {
    const nonProfessional = await service.create(orgAId, {
      scopeType: 'member_service',
      kind: 'percentage',
      value: '15',
      memberId: nonProfessionalAId,
      serviceId: serviceAId,
    });
    expect(nonProfessional.errors[0].code).toBe('PROFESSIONAL_NOT_FOUND');

    const crossTenant = await service.create(orgAId, {
      scopeType: 'member_service',
      kind: 'percentage',
      value: '15',
      memberId: professionalAId,
      serviceId: serviceBId,
    });
    expect(crossTenant.errors[0].code).toBe('SERVICE_NOT_FOUND');

    const missing = await service.create(orgAId, {
      scopeType: 'service',
      kind: 'percentage',
      value: '10',
      serviceId: '00000000-0000-0000-0000-000000000999',
    });
    expect(missing.errors[0].code).toBe('SERVICE_NOT_FOUND');
  });

  it('updates a rule and keeps rules isolated by RLS', async () => {
    const rule = (await service.list(orgAId)).find(
      (item) => item.scopeType === 'member_service',
    );
    expect(rule).toBeDefined();
    const updated = await service.update(orgAId, {
      id: rule!.id,
      kind: 'percentage',
      value: '20',
    });
    expect(updated.errors).toHaveLength(0);
    expect(updated.rule?.value.toString()).toBe('20');

    const rulesA = await service.list(orgAId);
    const rulesB = await service.list(orgBId);
    const aIds = new Set(rulesA.map((item) => item.id));
    rulesB.forEach((item) => expect(aIds.has(item.id)).toBe(false));
  });
});

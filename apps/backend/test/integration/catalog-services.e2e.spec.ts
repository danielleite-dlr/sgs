import { adminPrisma, appPrisma } from './setup';

/**
 * Catalog Services Integration Tests
 *
 * Tests: Services CRUD with pricing variants, category validation,
 * atomic variant replacement, RLS isolation, soft-delete, and permission gating.
 * Uses ServicesService directly against the live database.
 */

describe('Catalog — Services', () => {
  let orgAId: string;
  let orgBId: string;
  let orgACategoryId: string;

  let ServicesService: typeof import('../../src/catalog/services/services.service').ServicesService;
  let TenantContextService: typeof import('../../src/database/tenant-context.service').TenantContextService;
  let PrismaService: typeof import('../../src/database/prisma.service').PrismaService;

  beforeAll(async () => {
    const ssModule = await import('../../src/catalog/services/services.service');
    ServicesService = ssModule.ServicesService;

    const tcsModule = await import('../../src/database/tenant-context.service');
    TenantContextService = tcsModule.TenantContextService;

    const psModule = await import('../../src/database/prisma.service');
    PrismaService = psModule.PrismaService;

    // Clean up leftovers from previous test runs
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM service_pricing_variants WHERE service_id IN (SELECT id FROM services WHERE name LIKE 'svc-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM package_services WHERE service_id IN (SELECT id FROM services WHERE name LIKE 'svc-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE name LIKE 'svc-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE name LIKE 'svc-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'svc-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'svc-test-%'`,
    );

    // Create test organizations
    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'svc-test-A',
        tradeName: 'SvcTestA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}3`.slice(0, 14),
        email: 'a@svc-test.com',
        subdomain: `svc-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'svc-test-B',
        tradeName: 'SvcTestB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}4`.slice(0, 14),
        email: 'b@svc-test.com',
        subdomain: `svc-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    // Create a category for org A services
    const cat = await adminPrisma.category.create({
      data: {
        organizationId: orgAId,
        name: 'svc-test-Category',
        displayOrder: 0,
      },
    });
    orgACategoryId = cat.id;
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM service_pricing_variants WHERE service_id IN (SELECT id FROM services WHERE name LIKE 'svc-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM package_services WHERE service_id IN (SELECT id FROM services WHERE name LIKE 'svc-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE name LIKE 'svc-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE name LIKE 'svc-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'svc-test-%'`,
    );
  });

  function buildService() {
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    return new ServicesService(tenantCtx);
  }

  // -----------------------------------------------------------------------
  // Test 1: Create service with 2 pricing variants (junior + senior)
  // -----------------------------------------------------------------------
  it('1. create service with junior + senior pricing variants persists both', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, {
      name: 'svc-test-Corte',
      categoryId: orgACategoryId,
      basePrice: '50.00',
      defaultDurationMinutes: 30,
      pricingVariants: [
        { name: 'Júnior', durationMinutes: 30, seniorityTier: 'junior', price: '40.00' },
        { name: 'Sênior', durationMinutes: 45, seniorityTier: 'senior', price: '65.00' },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.service).not.toBeNull();
    expect(result.service!.name).toBe('svc-test-Corte');
    expect(result.service!.pricingVariants).toHaveLength(2);

    const tiers = (result.service!.pricingVariants as Array<{ seniorityTier: string }>)
      .map((v) => v.seniorityTier)
      .sort();
    expect(tiers).toEqual(['junior', 'senior']);
  });

  // -----------------------------------------------------------------------
  // Test 2: Update service replacing variant set (old deleted, new inserted)
  // -----------------------------------------------------------------------
  it('2. updateService atomically replaces variant set (2→1)', async () => {
    const svc = buildService();
    // Create service with 2 variants
    const created = await svc.create(orgAId, {
      name: 'svc-test-Escova',
      categoryId: orgACategoryId,
      basePrice: '80.00',
      defaultDurationMinutes: 60,
      pricingVariants: [
        { name: 'Curto', durationMinutes: 30, price: '60.00' },
        { name: 'Longo', durationMinutes: 90, price: '100.00' },
      ],
    });
    expect(created.errors).toHaveLength(0);
    expect(created.service!.pricingVariants).toHaveLength(2);

    // Update replacing variants with single one
    const updated = await svc.update(orgAId, {
      id: created.service!.id,
      pricingVariants: [{ name: 'Padrão', durationMinutes: 60, price: '80.00' }],
    });

    expect(updated.errors).toHaveLength(0);
    expect(updated.service!.pricingVariants).toHaveLength(1);
    expect((updated.service!.pricingVariants as Array<{ name: string }>)[0].name).toBe('Padrão');
  });

  // -----------------------------------------------------------------------
  // Test 3: RLS — org B cannot read org A's services
  // -----------------------------------------------------------------------
  it('3. org B sees 0 services from org A (RLS isolation)', async () => {
    const svc = buildService();
    // Ensure org A has at least one service
    await svc.create(orgAId, {
      name: 'svc-test-RLS-Visible',
      categoryId: orgACategoryId,
      basePrice: '30.00',
      defaultDurationMinutes: 20,
    });

    // Query as org B — should return empty list
    const orgBServices = await svc.list(orgBId);
    const leaked = orgBServices.filter((s) => s.name.startsWith('svc-test-'));
    expect(leaked).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Test 4: Create service with non-existent category → CATEGORY_NOT_FOUND
  // -----------------------------------------------------------------------
  it('4. create service with non-existent category returns CATEGORY_NOT_FOUND', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, {
      name: 'svc-test-Bad-Cat',
      categoryId: '00000000-0000-4000-8000-000000000000',
      basePrice: '50.00',
      defaultDurationMinutes: 30,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('CATEGORY_NOT_FOUND');
    expect(result.service).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 5: Soft-delete service used in a package → SERVICE_IN_PACKAGE
  // -----------------------------------------------------------------------
  it('5. softDelete service used in active package fails with SERVICE_IN_PACKAGE', async () => {
    const svc = buildService();

    // Create the service
    const created = await svc.create(orgAId, {
      name: 'svc-test-InPackage',
      categoryId: orgACategoryId,
      basePrice: '60.00',
      defaultDurationMinutes: 30,
    });
    expect(created.errors).toHaveLength(0);
    const serviceId = created.service!.id;

    // Create a package referencing this service (use adminPrisma to bypass RLS)
    const pkg = await adminPrisma.package.create({
      data: {
        organizationId: orgAId,
        name: 'svc-test-TestPkg',
        price: '55.00',
      },
    });
    await adminPrisma.packageService.create({
      data: {
        packageId: pkg.id,
        serviceId,
        quantity: 1,
        displayOrder: 0,
      },
    });

    // Attempt to soft-delete the service — should be blocked
    const result = await svc.softDelete(orgAId, serviceId);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('SERVICE_IN_PACKAGE');

    // Clean up
    await adminPrisma.packageService.delete({
      where: { packageId_serviceId: { packageId: pkg.id, serviceId } },
    });
    await adminPrisma.package.delete({ where: { id: pkg.id } });
  });

  // -----------------------------------------------------------------------
  // Test 6: Soft-delete leaf service (no package refs) succeeds
  // -----------------------------------------------------------------------
  it('6. softDelete leaf service succeeds', async () => {
    const svc = buildService();
    const created = await svc.create(orgAId, {
      name: 'svc-test-LeafDel',
      categoryId: orgACategoryId,
      basePrice: '25.00',
      defaultDurationMinutes: 15,
    });
    expect(created.errors).toHaveLength(0);

    const result = await svc.softDelete(orgAId, created.service!.id);
    expect(result.errors).toHaveLength(0);
    expect(result.service!.deletedAt).not.toBeNull();

    // Should not appear in list after soft-delete
    const list = await svc.list(orgAId);
    const found = list.find((s) => s.id === created.service!.id);
    expect(found).toBeUndefined();
  });
});

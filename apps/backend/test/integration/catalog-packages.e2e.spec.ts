import { adminPrisma, appPrisma } from './setup';

/**
 * Catalog Packages Integration Tests
 *
 * Tests: Packages CRUD with junction sync, individualSum computation,
 * price-vs-sum transparency, empty package validation, RLS isolation, soft-delete.
 * Uses PackagesService directly against the live database.
 */

describe('Catalog — Packages', () => {
  let orgAId: string;
  let orgBId: string;
  let svc1Id: string;
  let svc2Id: string;
  let svc3Id: string;

  let PackagesService: typeof import('../../src/catalog/packages/packages.service').PackagesService;
  let TenantContextService: typeof import('../../src/database/tenant-context.service').TenantContextService;
  let PrismaService: typeof import('../../src/database/prisma.service').PrismaService;

  beforeAll(async () => {
    const psModule = await import('../../src/catalog/packages/packages.service');
    PackagesService = psModule.PackagesService;

    const tcsModule = await import('../../src/database/tenant-context.service');
    TenantContextService = tcsModule.TenantContextService;

    const dbModule = await import('../../src/database/prisma.service');
    PrismaService = dbModule.PrismaService;

    // Clean up leftovers from previous runs
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM package_services WHERE package_id IN (SELECT id FROM packages WHERE name LIKE 'pkg-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM packages WHERE name LIKE 'pkg-test-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM service_pricing_variants WHERE service_id IN (SELECT id FROM services WHERE name LIKE 'pkg-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM services WHERE name LIKE 'pkg-test-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM categories WHERE name LIKE 'pkg-test-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'pkg-test-%'`,
    );

    // Create test organizations
    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'pkg-test-A',
        tradeName: 'PkgTestA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}5`.slice(0, 14),
        email: 'a@pkg-test.com',
        subdomain: `pkg-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'pkg-test-B',
        tradeName: 'PkgTestB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}6`.slice(0, 14),
        email: 'b@pkg-test.com',
        subdomain: `pkg-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    // Create test category + 3 services for org A
    const cat = await adminPrisma.category.create({
      data: {
        organizationId: orgAId,
        name: 'pkg-test-Cat',
        displayOrder: 0,
      },
    });

    const s1 = await adminPrisma.service.create({
      data: {
        organizationId: orgAId,
        categoryId: cat.id,
        name: 'pkg-test-Svc1',
        basePrice: '50.00',
        defaultDurationMinutes: 30,
        displayOrder: 0,
      },
    });
    svc1Id = s1.id;

    const s2 = await adminPrisma.service.create({
      data: {
        organizationId: orgAId,
        categoryId: cat.id,
        name: 'pkg-test-Svc2',
        basePrice: '80.00',
        defaultDurationMinutes: 60,
        displayOrder: 1,
      },
    });
    svc2Id = s2.id;

    const s3 = await adminPrisma.service.create({
      data: {
        organizationId: orgAId,
        categoryId: cat.id,
        name: 'pkg-test-Svc3',
        basePrice: '60.00',
        defaultDurationMinutes: 45,
        displayOrder: 2,
      },
    });
    svc3Id = s3.id;
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM package_services WHERE package_id IN (SELECT id FROM packages WHERE name LIKE 'pkg-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM packages WHERE name LIKE 'pkg-test-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM service_pricing_variants WHERE service_id IN (SELECT id FROM services WHERE name LIKE 'pkg-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM services WHERE name LIKE 'pkg-test-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM categories WHERE name LIKE 'pkg-test-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'pkg-test-%'`,
    );
  });

  function buildService() {
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    return new PackagesService(tenantCtx);
  }

  // -----------------------------------------------------------------------
  // Test 1: Create package with 3 services (mix of quantities 1, 1, 2)
  // -----------------------------------------------------------------------
  it('1. create package with 3 services and mixed quantities persists all junction rows', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, {
      name: 'pkg-test-Trio',
      price: '180.00',
      services: [
        { serviceId: svc1Id, quantity: 1 },
        { serviceId: svc2Id, quantity: 1 },
        { serviceId: svc3Id, quantity: 2 },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.package).not.toBeNull();
    expect(result.package!.name).toBe('pkg-test-Trio');
    expect(result.package!.services).toHaveLength(3);
  });

  // -----------------------------------------------------------------------
  // Test 2: individualSum equals base prices × quantities
  // (50×1 + 80×1 + 60×2 = 50 + 80 + 120 = 250.00)
  // -----------------------------------------------------------------------
  it('2. individualSum is computed correctly from service prices and quantities', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, {
      name: 'pkg-test-Sum',
      price: '200.00',
      services: [
        { serviceId: svc1Id, quantity: 1 }, // 50.00
        { serviceId: svc2Id, quantity: 1 }, // 80.00
        { serviceId: svc3Id, quantity: 2 }, // 60.00 × 2 = 120.00
      ],
    });

    expect(result.errors).toHaveLength(0);
    // 50 + 80 + 120 = 250
    expect(result.package!.individualSum).toBe('250.00');
  });

  // -----------------------------------------------------------------------
  // Test 3: Package.price can differ from individualSum (D-09)
  // -----------------------------------------------------------------------
  it('3. package price can differ from individualSum (discounted package)', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, {
      name: 'pkg-test-Discount',
      price: '199.90',  // Discounted vs individualSum
      services: [
        { serviceId: svc1Id, quantity: 1 }, // 50.00
        { serviceId: svc2Id, quantity: 1 }, // 80.00
        { serviceId: svc3Id, quantity: 2 }, // 120.00
        // individualSum = 250.00 but price = 199.90
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.package!.price.toString()).toBe('199.9');  // DB stores as DECIMAL
    expect(result.package!.individualSum).toBe('250.00');
    // Package price (199.90) != individualSum (250.00) — this is the D-09 feature
    expect(result.package!.price.toString()).not.toBe(result.package!.individualSum);
  });

  // -----------------------------------------------------------------------
  // Test 4: Update package replacing service list (3→2)
  // -----------------------------------------------------------------------
  it('4. updatePackage replaces service list atomically (3→2 junction rows)', async () => {
    const svc = buildService();

    // Create with 3 services
    const created = await svc.create(orgAId, {
      name: 'pkg-test-Replace',
      price: '100.00',
      services: [
        { serviceId: svc1Id, quantity: 1 },
        { serviceId: svc2Id, quantity: 1 },
        { serviceId: svc3Id, quantity: 1 },
      ],
    });
    expect(created.errors).toHaveLength(0);
    expect(created.package!.services).toHaveLength(3);

    // Update to 2 services
    const updated = await svc.update(orgAId, {
      id: created.package!.id,
      services: [
        { serviceId: svc1Id, quantity: 1 },
        { serviceId: svc2Id, quantity: 1 },
      ],
    });

    expect(updated.errors).toHaveLength(0);
    expect(updated.package!.services).toHaveLength(2);

    // Verify DB has exactly 2 rows for this package
    const dbRows = await adminPrisma.packageService.findMany({
      where: { packageId: created.package!.id },
    });
    expect(dbRows).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Test 5: Create package with empty services list → PACKAGE_EMPTY
  // -----------------------------------------------------------------------
  it('5. create package with empty services fails with PACKAGE_EMPTY', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, {
      name: 'pkg-test-Empty',
      price: '0.00',
      services: [],
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PACKAGE_EMPTY');
    expect(result.package).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 6: Create package referencing soft-deleted service → SERVICE_NOT_FOUND
  // -----------------------------------------------------------------------
  it('6. create package referencing soft-deleted service returns SERVICE_NOT_FOUND', async () => {
    const svc = buildService();

    // Create a service and then soft-delete it via adminPrisma
    const deletedSvc = await adminPrisma.service.create({
      data: {
        organizationId: orgAId,
        categoryId: (
          await adminPrisma.category.findFirstOrThrow({
            where: { name: 'pkg-test-Cat' },
          })
        ).id,
        name: 'pkg-test-Deleted-Svc',
        basePrice: '10.00',
        defaultDurationMinutes: 10,
        displayOrder: 99,
        deletedAt: new Date(),
      },
    });

    const result = await svc.create(orgAId, {
      name: 'pkg-test-WithDeleted',
      price: '100.00',
      services: [{ serviceId: deletedSvc.id, quantity: 1 }],
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('SERVICE_NOT_FOUND');
    expect(result.package).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 7: RLS — org B cannot read org A's packages
  // -----------------------------------------------------------------------
  it('7. org B sees 0 packages from org A (RLS isolation)', async () => {
    const svc = buildService();

    // Ensure org A has at least one package
    await svc.create(orgAId, {
      name: 'pkg-test-RLS',
      price: '50.00',
      services: [{ serviceId: svc1Id, quantity: 1 }],
    });

    // Query as org B — should return empty
    const orgBPkgs = await svc.list(orgBId);
    const leaked = orgBPkgs.filter((p) => p.name.startsWith('pkg-test-'));
    expect(leaked).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Test 8: softDelete sets deletedAt and removes from listings
  // -----------------------------------------------------------------------
  it('8. softDelete package succeeds and removes it from listings', async () => {
    const svc = buildService();
    const created = await svc.create(orgAId, {
      name: 'pkg-test-Del',
      price: '50.00',
      services: [{ serviceId: svc1Id, quantity: 1 }],
    });
    expect(created.errors).toHaveLength(0);

    const result = await svc.softDelete(orgAId, created.package!.id);
    expect(result.errors).toHaveLength(0);
    expect(result.package!.deletedAt).not.toBeNull();

    // Should not appear in list after soft-delete
    const list = await svc.list(orgAId);
    const found = list.find((p) => p.id === created.package!.id);
    expect(found).toBeUndefined();
  });
});

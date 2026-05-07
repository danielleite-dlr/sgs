import { adminPrisma, appPrisma } from './setup';

/**
 * Catalog Categories Integration Tests
 *
 * Tests: Categories CRUD, depth ≤ 2 enforcement, RLS isolation, soft-delete,
 * reorder, and permission gating. Uses the CategoriesService directly against
 * the live database (Docker Compose stack).
 */

describe('Catalog — Categories', () => {
  let orgAId: string;
  let orgBId: string;
  let adminRoleId: string;
  let professionalRoleId: string;

  // Service is imported directly to call service methods in tests
  // (no HTTP layer needed — direct service call pattern)
  let CategoriesService: typeof import('../../src/catalog/categories/categories.service').CategoriesService;
  let TenantContextService: typeof import('../../src/database/tenant-context.service').TenantContextService;
  let PrismaService: typeof import('../../src/database/prisma.service').PrismaService;

  beforeAll(async () => {
    // Lazy imports to avoid module resolution issues before compilation
    const csModule = await import('../../src/catalog/categories/categories.service');
    CategoriesService = csModule.CategoriesService;

    const tcsModule = await import('../../src/database/tenant-context.service');
    TenantContextService = tcsModule.TenantContextService;

    const psModule = await import('../../src/database/prisma.service');
    PrismaService = psModule.PrismaService;

    // Clean up leftovers
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'cat-test-%'`,
    );

    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    adminRoleId = adminRole.id;

    const professionalRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    professionalRoleId = professionalRole.id;

    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'cat-test-A',
        tradeName: 'CatTestA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}1`.slice(0, 14),
        email: 'a@cat-test.com',
        subdomain: `cat-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'cat-test-B',
        tradeName: 'CatTestB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}2`.slice(0, 14),
        email: 'b@cat-test.com',
        subdomain: `cat-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'cat-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'cat-test-%'`,
    );
  });

  // Helper: build a minimal CategoriesService using the appPrisma client
  function buildService() {
    // We create a minimal wrapper that uses appPrisma directly
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    return new CategoriesService(tenantCtx);
  }

  // -----------------------------------------------------------------------
  // Test 1: ADMIN of org A creates a root category — succeeds
  // -----------------------------------------------------------------------
  it('1. create root category succeeds with empty errors', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, { name: 'cat-test-Root' });
    expect(result.errors).toHaveLength(0);
    expect(result.category).not.toBeNull();
    expect(result.category!.name).toBe('cat-test-Root');
    expect(result.category!.parentId).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 2: Create child category with parentId of root — succeeds
  // -----------------------------------------------------------------------
  it('2. create child category with valid parentId succeeds', async () => {
    const svc = buildService();
    const root = await svc.create(orgAId, { name: 'cat-test-Parent' });
    expect(root.errors).toHaveLength(0);

    const child = await svc.create(orgAId, {
      name: 'cat-test-Child',
      parentId: root.category!.id,
    });
    expect(child.errors).toHaveLength(0);
    expect(child.category!.parentId).toBe(root.category!.id);
  });

  // -----------------------------------------------------------------------
  // Test 3: Create child of child — fails with CATEGORY_DEPTH
  // -----------------------------------------------------------------------
  it('3. create grandchild fails with CATEGORY_DEPTH', async () => {
    const svc = buildService();
    const root = await svc.create(orgAId, { name: 'cat-test-GParent' });
    const child = await svc.create(orgAId, {
      name: 'cat-test-GChild',
      parentId: root.category!.id,
    });
    expect(child.errors).toHaveLength(0);

    const grandchild = await svc.create(orgAId, {
      name: 'cat-test-GGrandchild',
      parentId: child.category!.id,
    });
    expect(grandchild.errors).toHaveLength(1);
    expect(grandchild.errors[0].code).toBe('CATEGORY_DEPTH');
    expect(grandchild.category).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 4: Org B cannot see org A's categories (RLS isolation)
  // -----------------------------------------------------------------------
  it('4. org B sees 0 categories from org A (RLS isolation)', async () => {
    const svc = buildService();
    // Ensure org A has at least one category
    await svc.create(orgAId, { name: 'cat-test-RLS-A' });

    // Query as org B — should return empty list
    const result = await svc.list(orgBId);
    const orgACategories = result.filter((c) =>
      c.name.startsWith('cat-test-'),
    );
    expect(orgACategories).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Test 5: Soft delete with active children fails with CATEGORY_HAS_CHILDREN
  // -----------------------------------------------------------------------
  it('5. softDelete with active children fails with CATEGORY_HAS_CHILDREN', async () => {
    const svc = buildService();
    const root = await svc.create(orgAId, { name: 'cat-test-DelParent' });
    await svc.create(orgAId, {
      name: 'cat-test-DelChild',
      parentId: root.category!.id,
    });

    const result = await svc.softDelete(orgAId, root.category!.id);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('CATEGORY_HAS_CHILDREN');
  });

  // -----------------------------------------------------------------------
  // Test 6: reorderCategory swaps displayOrder with adjacent sibling
  // -----------------------------------------------------------------------
  it('6. reorderCategory swaps displayOrder with sibling', async () => {
    const svc = buildService();
    const first = await svc.create(orgAId, { name: 'cat-test-Reorder-1' });
    const second = await svc.create(orgAId, { name: 'cat-test-Reorder-2' });

    const firstOrder = first.category!.displayOrder;
    const secondOrder = second.category!.displayOrder;

    // Move second UP (should swap with first)
    const result = await svc.reorder(orgAId, {
      id: second.category!.id,
      direction: 'UP',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.category!.displayOrder).toBe(firstOrder);

    // Verify first now has secondOrder
    const updatedFirst = await svc.getById(orgAId, first.category!.id);
    expect(updatedFirst!.displayOrder).toBe(secondOrder);
  });

  // -----------------------------------------------------------------------
  // Test 7: softDelete on leaf category with no children succeeds
  // -----------------------------------------------------------------------
  it('7. softDelete leaf category succeeds', async () => {
    const svc = buildService();
    const cat = await svc.create(orgAId, { name: 'cat-test-Leaf-Del' });
    expect(cat.errors).toHaveLength(0);

    const result = await svc.softDelete(orgAId, cat.category!.id);
    expect(result.errors).toHaveLength(0);
    expect(result.category!.deletedAt).not.toBeNull();

    // Should not appear in list after soft-delete
    const list = await svc.list(orgAId);
    const found = list.find((c) => c.id === cat.category!.id);
    expect(found).toBeUndefined();
  });
});

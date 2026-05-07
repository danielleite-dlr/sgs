import { adminPrisma, appPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { ProductsService } from '../../src/catalog/products/products.service';

/**
 * Catalog Products Integration Tests
 *
 * Tests: Products CRUD with SKU uniqueness, adjustStock with pessimistic lock,
 * stock_movements audit trail, low-stock notification (idempotent), stock recovery,
 * STOCK_NEGATIVE guard, and RLS isolation.
 *
 * Running: pnpm test:integration -- --testPathPattern catalog-products
 */

describe('Catalog — Products', () => {
  let orgAId: string;
  let orgBId: string;
  let memberAId: string;
  let adminRoleId: string;

  beforeAll(async () => {
    // Find system roles
    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    adminRoleId = adminRole.id;

    // Clean up leftovers
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM stock_movements WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'prod-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM notifications WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'prod-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM products WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'prod-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'prod-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'prod-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'prod-test-%'`,
    );

    // Create orgs
    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'prod-test-A',
        tradeName: 'ProdA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}`.slice(0, 14).padEnd(14, '5'),
        email: 'prod-a@test.com',
        subdomain: `prod-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'prod-test-B',
        tradeName: 'ProdB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now() + 1}`.slice(0, 14).padEnd(14, '6'),
        email: 'prod-b@test.com',
        subdomain: `prod-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    // Create user + member in org A
    const userA = await adminPrisma.user.create({
      data: {
        email: `prod-test-a-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Product Test Admin',
      },
    });

    const memberA = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userA.id,
        roleId: adminRoleId,
        displayName: 'prod-test-A-admin',
      },
    });
    memberAId = memberA.id;

    // service not wired globally — each test uses buildService() for isolation
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM stock_movements WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'prod-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM notifications WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'prod-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM products WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'prod-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'prod-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'prod-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'prod-test-%'`,
    );
  });

  // Helper: build service bound to appPrisma (RLS-enforced client)
  function buildService(): ProductsService {
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    return new ProductsService(tenantCtx);
  }

  // -----------------------------------------------------------------------
  // Test 1: Create product with initial stock — creates stock_movement (initial)
  // -----------------------------------------------------------------------
  it('1. createProduct with stockQuantity=10 creates product + initial stock_movement', async () => {
    const svc = buildService();
    const result = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Shampoo',
      sku: 'SHAMP-001',
      costPrice: '10.00',
      salePrice: '25.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'ml',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.product).not.toBeNull();
    expect(result.product!.stockQuantity).toBe(10);
    expect(result.product!.sku).toBe('SHAMP-001');

    // Verify stock_movements row was created with type='initial'
    const movements = await adminPrisma.stockMovement.findMany({
      where: { productId: result.product!.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('initial');
    expect(movements[0].delta).toBe(10);
    expect(movements[0].reason).toBe('Estoque inicial');
  });

  // -----------------------------------------------------------------------
  // Test 2: Create product with same SKU in same org → SKU_TAKEN
  // -----------------------------------------------------------------------
  it('2. create product with duplicate SKU returns SKU_TAKEN error', async () => {
    const svc = buildService();

    // First product created successfully
    await svc.create(orgAId, memberAId, {
      name: 'prod-test-Conditioner',
      sku: 'COND-DUP-001',
      costPrice: '8.00',
      salePrice: '20.00',
      stockQuantity: 5,
      minStockLevel: 2,
      unit: 'ml',
    });

    // Second product with same SKU should fail
    const result = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Conditioner-2',
      sku: 'COND-DUP-001',
      costPrice: '9.00',
      salePrice: '22.00',
      stockQuantity: 3,
      minStockLevel: 1,
      unit: 'ml',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('SKU_TAKEN');
    expect(result.errors[0].field).toBe('sku');
    expect(result.product).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 3: adjustStock(delta=-6) → stock drops to 4 (below min=5) → notification
  // -----------------------------------------------------------------------
  it('3. adjustStock(delta=-6) creates stock_movement and stock_low notification', async () => {
    const svc = buildService();

    // Create product with stock=10, min=5
    const created = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Wax',
      sku: 'WAX-001',
      costPrice: '15.00',
      salePrice: '35.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'g',
    });
    expect(created.errors).toHaveLength(0);
    const productId = created.product!.id;

    // adjustStock by -6 (from 10 to 4 — crosses below min=5)
    const result = await svc.adjustStock(orgAId, memberAId, {
      productId,
      delta: -6,
      reason: 'Ajuste manual de teste',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.product!.stockQuantity).toBe(4);

    // Verify TWO stock_movements: initial + manual_adjustment
    const movements = await adminPrisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements).toHaveLength(2);
    expect(movements[0].type).toBe('initial');
    expect(movements[1].type).toBe('manual_adjustment');
    expect(movements[1].delta).toBe(-6);

    // Verify ONE stock_low notification was created
    const notifications = await adminPrisma.notification.findMany({
      where: { organizationId: orgAId, kind: 'stock_low', readAt: null },
    });
    const stockLowForProduct = notifications.filter(
      (n) => (n.payload as any).productId === productId,
    );
    expect(stockLowForProduct).toHaveLength(1);
    expect((stockLowForProduct[0].payload as any).productName).toBe('prod-test-Wax');
    expect((stockLowForProduct[0].payload as any).currentStock).toBe(4);
    expect((stockLowForProduct[0].payload as any).minStockLevel).toBe(5);
  });

  // -----------------------------------------------------------------------
  // Test 4: Second adjustStock on already-low product → NO new notification (idempotent)
  // -----------------------------------------------------------------------
  it('4. adjustStock on already-low product does not create duplicate stock_low notification', async () => {
    const svc = buildService();

    // Create product with stock=10, min=5
    const created = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Mask',
      sku: 'MASK-001',
      costPrice: '12.00',
      salePrice: '30.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'g',
    });
    const productId = created.product!.id;

    // First adjustment: 10 → 4 (creates notification)
    await svc.adjustStock(orgAId, memberAId, {
      productId,
      delta: -6,
      reason: 'Primeiro ajuste',
    });

    // Second adjustment: 4 → 2 (already below min — should NOT create another notification)
    const result = await svc.adjustStock(orgAId, memberAId, {
      productId,
      delta: -2,
      reason: 'Segundo ajuste',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.product!.stockQuantity).toBe(2);

    // Still only ONE unread stock_low notification for this product
    const notifications = await adminPrisma.notification.findMany({
      where: { organizationId: orgAId, kind: 'stock_low', readAt: null },
    });
    const forProduct = notifications.filter(
      (n) => (n.payload as any).productId === productId,
    );
    expect(forProduct).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Test 5: Stock recovery → notification marked read
  // -----------------------------------------------------------------------
  it('5. adjustStock that brings stock above min marks stock_low notification as read', async () => {
    const svc = buildService();

    // Create product with stock=3, min=5 (starts below min already would not fire notification unless crossed)
    // Create with 10, adjust to 3 to fire notification, then recover
    const created = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Oil',
      sku: 'OIL-001',
      costPrice: '20.00',
      salePrice: '50.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'ml',
    });
    const productId = created.product!.id;

    // Bring stock below min (10 → 3)
    await svc.adjustStock(orgAId, memberAId, {
      productId,
      delta: -7,
      reason: 'Baixar estoque',
    });

    // Verify notification exists and is unread
    const beforeRecovery = await adminPrisma.notification.findMany({
      where: {
        organizationId: orgAId,
        kind: 'stock_low',
        readAt: null,
      },
    });
    const unreadBefore = beforeRecovery.filter(
      (n) => (n.payload as any).productId === productId,
    );
    expect(unreadBefore).toHaveLength(1);

    // Recovery: bring stock back above min (3 + 10 = 13 > 5)
    await svc.adjustStock(orgAId, memberAId, {
      productId,
      delta: 10,
      reason: 'Reabastecimento',
    });

    // Verify notification now has read_at set
    const afterRecovery = await adminPrisma.notification.findMany({
      where: {
        organizationId: orgAId,
        kind: 'stock_low',
      },
    });
    const forProduct = afterRecovery.filter(
      (n) => (n.payload as any).productId === productId,
    );
    expect(forProduct).toHaveLength(1);
    expect(forProduct[0].readAt).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 6: adjustStock that would make stock negative → STOCK_NEGATIVE error
  // -----------------------------------------------------------------------
  it('6. adjustStock resulting in negative stock returns STOCK_NEGATIVE error', async () => {
    const svc = buildService();

    const created = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Gel',
      sku: 'GEL-001',
      costPrice: '5.00',
      salePrice: '15.00',
      stockQuantity: 3,
      minStockLevel: 1,
      unit: 'g',
    });
    const productId = created.product!.id;

    // Try to remove 10 when only 3 in stock
    const result = await svc.adjustStock(orgAId, memberAId, {
      productId,
      delta: -10,
      reason: 'Should fail',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('STOCK_NEGATIVE');
    expect(result.errors[0].field).toBe('delta');
    expect(result.product).toBeNull();

    // Stock must remain unchanged
    const unchanged = await svc.byId(orgAId, productId);
    expect(unchanged!.stockQuantity).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Test 7: RLS — org B cannot see org A's products
  // -----------------------------------------------------------------------
  it('7. RLS: org B sees 0 products belonging to org A', async () => {
    const svc = buildService();

    // Create a product in org A
    await svc.create(orgAId, memberAId, {
      name: 'prod-test-Secret',
      sku: 'SECRET-001',
      costPrice: '1.00',
      salePrice: '2.00',
      stockQuantity: 1,
      minStockLevel: 0,
      unit: 'un',
    });

    // Query as org B — should see nothing
    const orgBProducts = await svc.list(orgBId);
    const orgAProductsInB = orgBProducts.filter(
      (p) => p.sku === 'SECRET-001',
    );
    expect(orgAProductsInB).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Test 8: updateProduct does NOT change stock_quantity (D-14)
  // -----------------------------------------------------------------------
  it('8. updateProduct does not allow changing stockQuantity', async () => {
    const svc = buildService();

    const created = await svc.create(orgAId, memberAId, {
      name: 'prod-test-Cream',
      sku: 'CREAM-001',
      costPrice: '18.00',
      salePrice: '45.00',
      stockQuantity: 20,
      minStockLevel: 5,
      unit: 'g',
    });
    const productId = created.product!.id;

    // Update name only — stock must remain 20
    const updated = await svc.update(orgAId, {
      id: productId,
      name: 'prod-test-Cream-Updated',
    });

    expect(updated.errors).toHaveLength(0);
    expect(updated.product!.name).toBe('prod-test-Cream-Updated');
    expect(updated.product!.stockQuantity).toBe(20);
  });

  // -----------------------------------------------------------------------
  // Test 9: softDelete excludes product from list
  // -----------------------------------------------------------------------
  it('9. softDeleteProduct excludes product from subsequent list queries', async () => {
    const svc = buildService();

    const created = await svc.create(orgAId, memberAId, {
      name: 'prod-test-ToDelete',
      sku: 'DEL-001',
      costPrice: '5.00',
      salePrice: '12.00',
      stockQuantity: 5,
      minStockLevel: 1,
      unit: 'un',
    });
    const productId = created.product!.id;

    // Soft delete
    const deleted = await svc.softDelete(orgAId, productId);
    expect(deleted.errors).toHaveLength(0);
    expect(deleted.product!.deletedAt).not.toBeNull();

    // Should not appear in list
    const list = await svc.list(orgAId);
    const found = list.find((p) => p.id === productId);
    expect(found).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Test 10: lowStockOnly filter
  // -----------------------------------------------------------------------
  it('10. list(lowStockOnly=true) returns only products with stockQuantity <= minStockLevel', async () => {
    const svc = buildService();

    // Create two products: one below min, one above
    const lowStock = await svc.create(orgAId, memberAId, {
      name: 'prod-test-LowStock',
      sku: 'LOW-001',
      costPrice: '3.00',
      salePrice: '8.00',
      stockQuantity: 2,
      minStockLevel: 5,
      unit: 'un',
    });
    const okStock = await svc.create(orgAId, memberAId, {
      name: 'prod-test-OkStock',
      sku: 'OK-001',
      costPrice: '3.00',
      salePrice: '8.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'un',
    });

    const filtered = await svc.list(orgAId, true);
    const ids = filtered.map((p) => p.id);
    expect(ids).toContain(lowStock.product!.id);
    expect(ids).not.toContain(okStock.product!.id);
  });
});

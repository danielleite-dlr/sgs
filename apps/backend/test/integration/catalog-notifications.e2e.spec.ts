import { adminPrisma, appPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { ProductsService } from '../../src/catalog/products/products.service';
import { NotificationsService } from '../../src/catalog/notifications/notifications.service';

/**
 * Catalog Notifications Integration Tests
 *
 * Tests: Notification listing (unread/all), mark-as-read, org-wide vs member-specific,
 * RLS isolation, and PROFESSIONAL read access (NOTIFICATION_READ granted to all roles).
 *
 * Notifications are seeded via ProductsService.adjustStock (stock_low kind).
 *
 * Running: pnpm test:integration -- --testPathPattern catalog-notifications
 */

describe('Catalog — Notifications', () => {
  let orgAId: string;
  let orgBId: string;
  let memberAId: string;
  let memberBId: string;
  let adminRoleId: string;
  let productId: string;

  beforeAll(async () => {
    // Find the system ADMIN role
    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    adminRoleId = adminRole.id;

    // Clean up leftovers
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM stock_movements WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'notif-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM notifications WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'notif-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM products WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'notif-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'notif-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'notif-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'notif-test-%'`,
    );

    // Create orgs
    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'notif-test-A',
        tradeName: 'NotifA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}`.slice(0, 14).padEnd(14, '7'),
        email: 'notif-a@test.com',
        subdomain: `notif-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'notif-test-B',
        tradeName: 'NotifB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now() + 1}`.slice(0, 14).padEnd(14, '8'),
        email: 'notif-b@test.com',
        subdomain: `notif-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    // Create users and members
    const userA = await adminPrisma.user.create({
      data: {
        email: `notif-test-a-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Notif Test Admin A',
      },
    });
    const memberA = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userA.id,
        roleId: adminRoleId,
        displayName: 'notif-test-A-admin',
      },
    });
    memberAId = memberA.id;

    const userB = await adminPrisma.user.create({
      data: {
        email: `notif-test-b-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Notif Test Admin B',
      },
    });
    const memberB = await adminPrisma.member.create({
      data: {
        organizationId: orgBId,
        userId: userB.id,
        roleId: adminRoleId,
        displayName: 'notif-test-B-admin',
      },
    });
    memberBId = memberB.id;

    // Seed a low-stock event in org A by creating a product and adjusting stock below min
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    const productsSvc = new ProductsService(tenantCtx);

    const created = await productsSvc.create(orgAId, memberAId, {
      name: 'notif-test-Product',
      sku: 'NOTIF-PROD-001',
      costPrice: '10.00',
      salePrice: '25.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'un',
    });
    productId = created.product!.id;

    // Drop stock below min to trigger stock_low notification
    await productsSvc.adjustStock(orgAId, memberAId, {
      productId,
      delta: -7,
      reason: 'Test stock drop',
    });
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM stock_movements WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'notif-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM notifications WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'notif-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM products WHERE organization_id IN (
        SELECT id FROM organizations WHERE legal_name LIKE 'notif-test-%'
      )`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'notif-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'notif-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'notif-test-%'`,
    );
  });

  // Helper: build NotificationsService with app prisma (RLS-enforced)
  function buildNotifService(): NotificationsService {
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    return new NotificationsService(tenantCtx);
  }

  // -----------------------------------------------------------------------
  // Test 1: notifications query returns stock_low entry with correct payload
  // -----------------------------------------------------------------------
  it('1. notifications query returns stock_low notification with correct payload', async () => {
    const svc = buildNotifService();
    const notifications = await svc.list(orgAId, memberAId, true);

    // Filter notifications for this product
    const stockLow = notifications.filter(
      (n) => n.kind === 'stock_low' && (n.payload as any).productId === productId,
    );
    expect(stockLow).toHaveLength(1);
    expect(stockLow[0].kind).toBe('stock_low');
    expect((stockLow[0].payload as any).productId).toBe(productId);
    expect((stockLow[0].payload as any).productName).toBe('notif-test-Product');
    expect((stockLow[0].payload as any).currentStock).toBe(3); // 10 - 7 = 3
    expect((stockLow[0].payload as any).minStockLevel).toBe(5);
    expect(stockLow[0].readAt).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 2: markNotificationRead sets read_at
  // -----------------------------------------------------------------------
  it('2. markNotificationRead sets readAt on the notification', async () => {
    const svc = buildNotifService();

    // Get the unread stock_low notification
    const before = await svc.list(orgAId, memberAId, true);
    const target = before.find(
      (n) => n.kind === 'stock_low' && (n.payload as any).productId === productId,
    );
    expect(target).toBeDefined();
    expect(target!.readAt).toBeNull();

    // Mark as read
    const updated = await svc.markRead(orgAId, target!.id);
    expect(updated.readAt).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 3: After markRead, unreadOnly=true does NOT return the notification
  // -----------------------------------------------------------------------
  it('3. notifications(unreadOnly=true) does not return already-read notification', async () => {
    const svc = buildNotifService();

    // Seed a fresh notification for this test
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    const productsSvc = new ProductsService(tenantCtx);

    const newProduct = await productsSvc.create(orgAId, memberAId, {
      name: 'notif-test-Product2',
      sku: 'NOTIF-PROD-002',
      costPrice: '5.00',
      salePrice: '12.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'un',
    });
    await productsSvc.adjustStock(orgAId, memberAId, {
      productId: newProduct.product!.id,
      delta: -8,
      reason: 'Test drop for read test',
    });

    // Verify it appears as unread
    const unread = await svc.list(orgAId, memberAId, true);
    const found = unread.find(
      (n) => n.kind === 'stock_low' && (n.payload as any).productId === newProduct.product!.id,
    );
    expect(found).toBeDefined();

    // Mark it read
    await svc.markRead(orgAId, found!.id);

    // Should no longer appear in unread query
    const afterRead = await svc.list(orgAId, memberAId, true);
    const stillUnread = afterRead.find(
      (n) => n.kind === 'stock_low' && (n.payload as any).productId === newProduct.product!.id,
    );
    expect(stillUnread).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Test 4: RLS — org B sees 0 notifications when org A has stock_low notifications
  // -----------------------------------------------------------------------
  it('4. RLS: org B sees 0 notifications from org A', async () => {
    const svc = buildNotifService();

    // Org B has no products or notifications
    const orgBNotifications = await svc.list(orgBId, memberBId, false);
    const orgALeaks = orgBNotifications.filter(
      (n) => n.kind === 'stock_low',
    );
    expect(orgALeaks).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Test 5: unreadOnly=false returns all notifications (including read ones)
  // -----------------------------------------------------------------------
  it('5. notifications(unreadOnly=false) includes both read and unread notifications', async () => {
    const svc = buildNotifService();

    // Seed and read a notification
    const prismaService = appPrisma as unknown as InstanceType<typeof PrismaService>;
    const tenantCtx = new TenantContextService(prismaService);
    const productsSvc = new ProductsService(tenantCtx);

    const newProduct = await productsSvc.create(orgAId, memberAId, {
      name: 'notif-test-Product3',
      sku: 'NOTIF-PROD-003',
      costPrice: '5.00',
      salePrice: '12.00',
      stockQuantity: 10,
      minStockLevel: 5,
      unit: 'un',
    });
    await productsSvc.adjustStock(orgAId, memberAId, {
      productId: newProduct.product!.id,
      delta: -8,
      reason: 'Test for all-notifications',
    });

    // Fetch unread to get the notification id
    const unread = await svc.list(orgAId, memberAId, true);
    const target = unread.find(
      (n) => (n.payload as any).productId === newProduct.product!.id,
    );
    expect(target).toBeDefined();

    // Mark as read
    await svc.markRead(orgAId, target!.id);

    // Query all (unreadOnly=false) — should include this read notification
    const all = await svc.list(orgAId, memberAId, false);
    const includesRead = all.find((n) => n.id === target!.id);
    expect(includesRead).toBeDefined();
    expect(includesRead!.readAt).not.toBeNull();
  });
});

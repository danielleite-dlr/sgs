import { adminPrisma, appPrisma } from './setup';

/**
 * RLS Isolation Suite — Phase 1 Success Criteria #4 and #5
 *
 * Proves that the sgs_app role (runtime) cannot read, write, update, or delete
 * rows belonging to a different organization, and that PgBouncer transaction-mode
 * does not leak SET LOCAL between transactions.
 *
 * Tests run against a live PostgreSQL + PgBouncer stack via Docker Compose.
 * See jest-integration.config.ts for timeout settings.
 */
describe('RLS isolation between two organizations', () => {
  let orgAId: string;
  let orgBId: string;
  let userId: string;
  let memberAId: string;
  let memberBId: string;
  let adminRoleId: string;

  beforeAll(async () => {
    // Clean up any leftovers from previous test runs
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'rls-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'rls-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'rls-test-%'`,
    );

    // Get the system ADMIN role (seeded by migration, organization_id = NULL)
    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    adminRoleId = adminRole.id;

    // Create two isolated organizations via privileged (BYPASSRLS) connection
    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'rls-test-A',
        tradeName: 'A',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}1111`.slice(0, 14),
        email: 'a@rls-test.com',
        subdomain: `rls-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'rls-test-B',
        tradeName: 'B',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}2222`.slice(0, 14),
        email: 'b@rls-test.com',
        subdomain: `rls-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    // Create one shared user (member in both orgs)
    const user = await adminPrisma.user.create({
      data: {
        email: `rls-test-${Date.now()}@test.com`,
        passwordHash: 'placeholder-hash',
        fullName: 'RLS Test User',
      },
    });
    userId = user.id;

    // Create member in org A
    const memberA = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId,
        roleId: adminRoleId,
        displayName: 'rls-test-A-member',
      },
    });
    memberAId = memberA.id;

    // Create member in org B
    const memberB = await adminPrisma.member.create({
      data: {
        organizationId: orgBId,
        userId,
        roleId: adminRoleId,
        displayName: 'rls-test-B-member',
      },
    });
    memberBId = memberB.id;
  });

  afterAll(async () => {
    // Cleanup — order matters due to FK constraints
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'rls-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'rls-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'rls-test-%'`,
    );
  });

  it('SELECT under tenant=A returns only A members', async () => {
    const rows = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${orgAId}'`,
      );
      return tx.member.findMany({
        where: { displayName: { startsWith: 'rls-test-' } },
      });
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(memberAId);
  });

  it('SELECT under tenant=B returns only B members', async () => {
    const rows = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${orgBId}'`,
      );
      return tx.member.findMany({
        where: { displayName: { startsWith: 'rls-test-' } },
      });
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(memberBId);
  });

  it('INSERT cross-tenant under tenant=A is blocked by WITH CHECK', async () => {
    await expect(
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_organization = '${orgAId}'`,
        );
        // Attempt to insert a member with organization_id=orgB — should violate WITH CHECK
        return tx.member.create({
          data: {
            organizationId: orgBId,
            userId,
            roleId: adminRoleId,
            displayName: 'rls-test-leak',
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('UPDATE cross-tenant under tenant=A affects 0 rows', async () => {
    const result = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${orgAId}'`,
      );
      return tx.member.updateMany({
        where: { id: memberBId },
        data: { displayName: 'rls-test-pwn' },
      });
    });
    expect(result.count).toBe(0);
  });

  it('DELETE cross-tenant under tenant=A affects 0 rows', async () => {
    const result = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${orgAId}'`,
      );
      return tx.member.deleteMany({ where: { id: memberBId } });
    });
    expect(result.count).toBe(0);
  });

  it('SELECT with NO tenant set returns 0 rows from organizations (fail-closed)', async () => {
    await expect(
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`RESET app.current_organization`);
        return tx.organization.findMany();
      }),
    ).resolves.toEqual([]);
  });

  it('PgBouncer transaction-mode does not leak SET LOCAL across requests', async () => {
    // Transaction 1: set tenant A context
    await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${orgAId}'`,
      );
      // Tx commits here — SET LOCAL is automatically reset
    });

    // Transaction 2: query without setting tenant — should see 0 rows because
    // SET LOCAL from Tx 1 was reset at commit (not leaked via PgBouncer pool reuse)
    const leaked = await appPrisma.$transaction(async (tx) => {
      return tx.organization.findMany();
    });
    expect(leaked).toEqual([]);
  });
});

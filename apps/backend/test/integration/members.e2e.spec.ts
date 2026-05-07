import { adminPrisma, appPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { MembersService } from '../../src/identity/members.service';

/**
 * Integration tests for MembersService — members query for commission picker.
 * Proves tenant isolation, soft-delete exclusion, and all-roles access.
 *
 * Running: pnpm test:integration -- --testPathPattern members
 */
describe('MembersService — listActive', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let memberAId: string;
  let memberBId: string;
  let deletedMemberId: string;
  let adminRoleId: string;
  let service: MembersService;

  beforeAll(async () => {
    // Find the system ADMIN role
    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    adminRoleId = adminRole.id;

    // Clean up previous test leftovers
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'mem-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'mem-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'mem-test-%'`,
    );

    // Create two orgs
    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'mem-test-A',
        tradeName: 'MemA',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}`.slice(0, 14).padEnd(14, '1'),
        email: 'mem-a@test.com',
        subdomain: `mem-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'mem-test-B',
        tradeName: 'MemB',
        documentType: 'CNPJ',
        documentNumber: `${Date.now() + 1}`.slice(0, 14).padEnd(14, '2'),
        email: 'mem-b@test.com',
        subdomain: `mem-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    // Create users
    const userA = await adminPrisma.user.create({
      data: {
        email: `mem-test-a-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Member Test A',
      },
    });
    userAId = userA.id;

    const userB = await adminPrisma.user.create({
      data: {
        email: `mem-test-b-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Member Test B',
      },
    });
    userBId = userB.id;

    // Create members
    const memberA = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userAId,
        roleId: adminRoleId,
        displayName: 'mem-test-A-active',
      },
    });
    memberAId = memberA.id;

    const memberB = await adminPrisma.member.create({
      data: {
        organizationId: orgBId,
        userId: userBId,
        roleId: adminRoleId,
        displayName: 'mem-test-B-active',
      },
    });
    memberBId = memberB.id;

    // Create a soft-deleted member in org A (different user needed for uq constraint)
    const userDeleted = await adminPrisma.user.create({
      data: {
        email: `mem-test-deleted-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Deleted Member',
      },
    });
    const deletedMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userDeleted.id,
        roleId: adminRoleId,
        displayName: 'mem-test-A-deleted',
        deletedAt: new Date(),
      },
    });
    deletedMemberId = deletedMember.id;

    // Wire up service
    const prismaService = new PrismaService();
    const tenantCtx = new TenantContextService(prismaService);
    service = new MembersService(tenantCtx);
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'mem-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'mem-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'mem-test-%'`,
    );
  });

  it('1. listActive returns active members of org A', async () => {
    const result = await service.listActive(orgAId);
    const ids = result.map((m) => m.id);
    expect(ids).toContain(memberAId);
  });

  it('2. listActive returns members with expected shape', async () => {
    const result = await service.listActive(orgAId);
    const member = result.find((m) => m.id === memberAId);
    expect(member).toBeDefined();
    expect(member).toHaveProperty('id');
    expect(member).toHaveProperty('displayName');
    expect(member).toHaveProperty('email');
    expect(member).toHaveProperty('roleName');
    expect(member).toHaveProperty('createdAt');
  });

  it('3. listActive excludes soft-deleted members', async () => {
    const result = await service.listActive(orgAId);
    const ids = result.map((m) => m.id);
    expect(ids).not.toContain(deletedMemberId);
  });

  it('4. RLS: org B listActive does not return org A members', async () => {
    const result = await service.listActive(orgBId);
    const ids = result.map((m) => m.id);
    expect(ids).not.toContain(memberAId);
    expect(ids).toContain(memberBId);
  });

  it('5. listActive returns members ordered by displayName ascending', async () => {
    const result = await service.listActive(orgAId);
    const names = result.map((m) => m.displayName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

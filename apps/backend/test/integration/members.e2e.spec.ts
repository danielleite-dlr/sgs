import { adminPrisma } from './setup';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PrismaService } from '../../src/database/prisma.service';
import { MembersService } from '../../src/identity/members.service';
import { PasswordService } from '../../src/auth/password.service';

/**
 * Integration tests for MembersService — members/allMembers queries and the
 * update/deactivate/reactivate lifecycle mutations backing them.
 * Proves tenant isolation, status filtering, the future-appointment guard on
 * deactivation, and that commission rules only inform (never block).
 *
 * Running: pnpm test:integration -- --testPathPattern members.e2e.spec
 */
describe('MembersService — listActive', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let memberAId: string;
  let memberBId: string;
  let deletedMemberId: string;
  let inactiveMemberId: string;
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

    // Create an inactive (status='inactive') member in org A — proves listActive
    // filters by status now, not just deletedAt.
    const userInactive = await adminPrisma.user.create({
      data: {
        email: `mem-test-inactive-${Date.now()}@test.com`,
        passwordHash: 'placeholder',
        fullName: 'Inactive Member',
      },
    });
    const inactiveMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userInactive.id,
        roleId: adminRoleId,
        displayName: 'mem-test-A-inactive',
        status: 'inactive',
      },
    });
    inactiveMemberId = inactiveMember.id;

    // Wire up service
    const prismaService = new PrismaService();
    const tenantCtx = new TenantContextService(prismaService);
    service = new MembersService(tenantCtx, prismaService, new PasswordService());
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
    expect(member).toHaveProperty('status', 'active');
  });

  it('3. listActive excludes soft-deleted members', async () => {
    const result = await service.listActive(orgAId);
    const ids = result.map((m) => m.id);
    expect(ids).not.toContain(deletedMemberId);
  });

  it('3b. listActive excludes members with status inactive', async () => {
    const result = await service.listActive(orgAId);
    const ids = result.map((m) => m.id);
    expect(ids).not.toContain(inactiveMemberId);
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

describe('MembersService — listAll, update, deactivate, reactivate', () => {
  let orgAId: string;
  let orgBId: string;
  let adminRoleId: string;
  let attendantRoleId: string;
  let service: MembersService;

  let memberBId: string; // org B, used for cross-org NOT_FOUND checks

  let updateTargetId: string;
  let deactivateSuccessId: string;
  let deactivateBlockedId: string;
  let pastApptMemberId: string;
  let cancelledApptMemberId: string;
  let commissionRuleMemberId: string;
  let reactivateTargetId: string;

  let categoryId: string;
  let serviceRowId: string;
  let clientId: string;

  const now = Date.now();

  beforeAll(async () => {
    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    adminRoleId = adminRole.id;
    const attendantRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ATTENDANT', isSystem: true },
    });
    attendantRoleId = attendantRole.id;

    // Cleanup
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commission_rules WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'memlife-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'memlife-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'memlife-test-%'`,
    );

    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'memlife-test-A',
        tradeName: 'MemLifeA',
        documentType: 'CNPJ',
        documentNumber: `${now}`.slice(0, 14).padEnd(14, '3'),
        email: 'memlife-a@test.com',
        subdomain: `memlife-a-${now}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'memlife-test-B',
        tradeName: 'MemLifeB',
        documentType: 'CNPJ',
        documentNumber: `${now + 1}`.slice(0, 14).padEnd(14, '4'),
        email: 'memlife-b@test.com',
        subdomain: `memlife-b-${now}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    const mkUser = (tag: string) =>
      adminPrisma.user.create({
        data: {
          email: `memlife-test-${tag}-${now}@test.com`,
          passwordHash: 'placeholder',
          fullName: `Memlife ${tag}`,
        },
      });

    const [
      userB,
      userUpdateTarget,
      userDeactivateSuccess,
      userDeactivateBlocked,
      userPastAppt,
      userCancelledAppt,
      userCommissionRule,
      userReactivateTarget,
    ] = await Promise.all([
      mkUser('b'),
      mkUser('update-target'),
      mkUser('deactivate-success'),
      mkUser('deactivate-blocked'),
      mkUser('past-appt'),
      mkUser('cancelled-appt'),
      mkUser('commission-rule'),
      mkUser('reactivate-target'),
    ]);

    const memberB = await adminPrisma.member.create({
      data: {
        organizationId: orgBId,
        userId: userB.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-B-member',
      },
    });
    memberBId = memberB.id;

    const updateTarget = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userUpdateTarget.id,
        roleId: attendantRoleId,
        displayName: 'memlife-test-update-target',
        isProfessional: false,
        seniorityTier: 'junior',
      },
    });
    updateTargetId = updateTarget.id;

    const deactivateSuccess = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userDeactivateSuccess.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-deactivate-success',
        isProfessional: true,
      },
    });
    deactivateSuccessId = deactivateSuccess.id;

    const deactivateBlocked = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userDeactivateBlocked.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-deactivate-blocked',
        isProfessional: true,
      },
    });
    deactivateBlockedId = deactivateBlocked.id;

    const pastApptMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userPastAppt.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-past-appt',
        isProfessional: true,
      },
    });
    pastApptMemberId = pastApptMember.id;

    const cancelledApptMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userCancelledAppt.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-cancelled-appt',
        isProfessional: true,
      },
    });
    cancelledApptMemberId = cancelledApptMember.id;

    const commissionRuleMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userCommissionRule.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-commission-rule',
        isProfessional: true,
      },
    });
    commissionRuleMemberId = commissionRuleMember.id;

    const reactivateTarget = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: userReactivateTarget.id,
        roleId: adminRoleId,
        displayName: 'memlife-test-reactivate-target',
        status: 'inactive',
      },
    });
    reactivateTargetId = reactivateTarget.id;

    // Catalog fixtures for appointments/commission rule
    const category = await adminPrisma.category.create({
      data: { organizationId: orgAId, name: 'memlife-test-category' },
    });
    categoryId = category.id;

    const serviceRow = await adminPrisma.service.create({
      data: {
        organizationId: orgAId,
        categoryId,
        name: 'memlife-test-service',
        basePrice: '50.00',
        defaultDurationMinutes: 30,
      },
    });
    serviceRowId = serviceRow.id;

    const client = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        fullName: 'memlife-test-client',
        phone: '+5511999990000',
      },
    });
    clientId = client.id;

    // Future appointments for the "blocked" member (2, to test ordering/count)
    await adminPrisma.appointment.create({
      data: {
        organizationId: orgAId,
        professionalId: deactivateBlockedId,
        clientId,
        serviceId: serviceRowId,
        startsAt: new Date(now + 10 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now + 10 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'scheduled',
      },
    });
    await adminPrisma.appointment.create({
      data: {
        organizationId: orgAId,
        professionalId: deactivateBlockedId,
        clientId,
        serviceId: serviceRowId,
        startsAt: new Date(now + 5 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now + 5 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'scheduled',
      },
    });

    // Past appointment — must NOT block
    await adminPrisma.appointment.create({
      data: {
        organizationId: orgAId,
        professionalId: pastApptMemberId,
        clientId,
        serviceId: serviceRowId,
        startsAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now - 10 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'completed',
      },
    });

    // Future but cancelled appointment — must NOT block
    await adminPrisma.appointment.create({
      data: {
        organizationId: orgAId,
        professionalId: cancelledApptMemberId,
        clientId,
        serviceId: serviceRowId,
        startsAt: new Date(now + 10 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now + 10 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'cancelled',
      },
    });

    // Active commission rule for commissionRuleMember — must NOT block deactivation
    await adminPrisma.commissionRule.create({
      data: {
        organizationId: orgAId,
        scopeType: 'member_service',
        memberId: commissionRuleMemberId,
        serviceId: serviceRowId,
        kind: 'percentage',
        value: '10',
      },
    });

    const prismaService = new PrismaService();
    const tenantCtx = new TenantContextService(prismaService);
    service = new MembersService(tenantCtx, prismaService, new PasswordService());
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM commission_rules WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlife-test-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'memlife-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'memlife-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'memlife-test-%'`,
    );
  });

  describe('listAll', () => {
    it('returns active and inactive members of the org, each with its status', async () => {
      const result = await service.listAll(orgAId);
      const byId = new Map(result.map((m) => [m.id, m]));
      expect(byId.get(deactivateSuccessId)?.status).toBe('active');
      expect(byId.get(reactivateTargetId)?.status).toBe('inactive');
    });

    it('orders by displayName ascending', async () => {
      const result = await service.listAll(orgAId);
      const names = result.map((m) => m.displayName);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('RLS: org B does not see org A members', async () => {
      const result = await service.listAll(orgBId);
      const ids = result.map((m) => m.id);
      expect(ids).not.toContain(deactivateSuccessId);
      expect(ids).toContain(memberBId);
    });
  });

  describe('update', () => {
    it('updates roleName, isProfessional and seniorityTier', async () => {
      const result = await service.update(orgAId, {
        id: updateTargetId,
        roleName: 'PROFESSIONAL',
        isProfessional: true,
        seniorityTier: 'senior',
      });
      expect(result.errors).toEqual([]);
      expect(result.member).not.toBeNull();
      expect(result.member!.roleName).toBe('PROFESSIONAL');
      expect(result.member!.isProfessional).toBe(true);
      expect(result.member!.seniorityTier).toBe('senior');
    });

    it('does not overwrite fields absent from the input', async () => {
      const before = await adminPrisma.member.findUniqueOrThrow({
        where: { id: updateTargetId },
      });
      const result = await service.update(orgAId, {
        id: updateTargetId,
        seniorityTier: 'pleno',
      });
      expect(result.errors).toEqual([]);
      expect(result.member!.seniorityTier).toBe('pleno');
      expect(result.member!.isProfessional).toBe(before.isProfessional);
      expect(result.member!.roleName).toBe('PROFESSIONAL');
    });

    it('clears seniorityTier when explicitly set to null', async () => {
      const result = await service.update(orgAId, {
        id: updateTargetId,
        seniorityTier: null,
      });
      expect(result.errors).toEqual([]);
      expect(result.member!.seniorityTier).toBeNull();
    });

    it('returns MEMBER_NOT_FOUND for a nonexistent id', async () => {
      const result = await service.update(orgAId, {
        id: '00000000-0000-0000-0000-000000000099',
        isProfessional: true,
      });
      expect(result.member).toBeNull();
      expect(result.errors).toEqual([
        expect.objectContaining({ code: 'MEMBER_NOT_FOUND' }),
      ]);
    });

    it('returns MEMBER_NOT_FOUND for a member of another org', async () => {
      const result = await service.update(orgAId, {
        id: memberBId,
        isProfessional: true,
      });
      expect(result.member).toBeNull();
      expect(result.errors).toEqual([
        expect.objectContaining({ code: 'MEMBER_NOT_FOUND' }),
      ]);
    });

    it('returns ROLE_NOT_FOUND for an unknown roleName', async () => {
      const result = await service.update(orgAId, {
        id: updateTargetId,
        roleName: 'NOT_A_REAL_ROLE',
      });
      expect(result.member).toBeNull();
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: 'ROLE_NOT_FOUND',
          field: 'roleName',
        }),
      ]);
    });
  });

  describe('deactivate', () => {
    it('deactivates a member without future appointments, never writing deletedAt', async () => {
      const result = await service.deactivate(orgAId, deactivateSuccessId);
      expect(result.errors).toEqual([]);
      expect(result.member).not.toBeNull();
      expect(result.member!.status).toBe('inactive');

      const row = await adminPrisma.member.findUniqueOrThrow({
        where: { id: deactivateSuccessId },
      });
      expect(row.status).toBe('inactive');
      expect(row.deletedAt).toBeNull();
    });

    it('refuses deactivation when the member has future appointments, listing them', async () => {
      const result = await service.deactivate(orgAId, deactivateBlockedId);
      expect(result.member).toBeNull();
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: 'MEMBER_HAS_FUTURE_APPOINTMENTS',
        }),
      ]);
      expect(result.futureAppointmentCount).toBe(2);
      expect(result.blockingAppointments.length).toBeGreaterThan(0);
      expect(result.blockingAppointments[0]).toEqual(
        expect.objectContaining({
          clientName: 'memlife-test-client',
          serviceName: 'memlife-test-service',
        }),
      );
      // Ordered ascending by startsAt — the sooner appointment comes first
      const starts = result.blockingAppointments.map((b) =>
        new Date(b.startsAt).getTime(),
      );
      expect(starts).toEqual([...starts].sort((a, b) => a - b));

      const row = await adminPrisma.member.findUniqueOrThrow({
        where: { id: deactivateBlockedId },
      });
      expect(row.status).toBe('active');
    });

    it('a past appointment does not block deactivation', async () => {
      const result = await service.deactivate(orgAId, pastApptMemberId);
      expect(result.errors).toEqual([]);
      expect(result.member!.status).toBe('inactive');
    });

    it('a future but cancelled appointment does not block deactivation', async () => {
      const result = await service.deactivate(orgAId, cancelledApptMemberId);
      expect(result.errors).toEqual([]);
      expect(result.member!.status).toBe('inactive');
    });

    it('an active commission rule does not block — it only informs', async () => {
      const result = await service.deactivate(orgAId, commissionRuleMemberId);
      expect(result.errors).toEqual([]);
      expect(result.member!.status).toBe('inactive');
      expect(result.activeCommissionRuleCount).toBeGreaterThan(0);
    });

    it('returns MEMBER_NOT_FOUND for a member of another org', async () => {
      const result = await service.deactivate(orgAId, memberBId);
      expect(result.member).toBeNull();
      expect(result.errors).toEqual([
        expect.objectContaining({ code: 'MEMBER_NOT_FOUND' }),
      ]);
    });
  });

  describe('reactivate', () => {
    it('reactivates an inactive member', async () => {
      const result = await service.reactivate(orgAId, reactivateTargetId);
      expect(result.errors).toEqual([]);
      expect(result.member!.status).toBe('active');

      const row = await adminPrisma.member.findUniqueOrThrow({
        where: { id: reactivateTargetId },
      });
      expect(row.status).toBe('active');
    });

    it('is idempotent on an already-active member', async () => {
      const result = await service.reactivate(orgAId, reactivateTargetId);
      expect(result.errors).toEqual([]);
      expect(result.member!.status).toBe('active');
    });

    it('returns MEMBER_NOT_FOUND for a member of another org', async () => {
      const result = await service.reactivate(orgAId, memberBId);
      expect(result.member).toBeNull();
      expect(result.errors).toEqual([
        expect.objectContaining({ code: 'MEMBER_NOT_FOUND' }),
      ]);
    });
  });
});

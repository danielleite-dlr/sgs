import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { adminPrisma } from './setup';

/**
 * Member lifecycle e2e tests — RBAC + RLS + business guards for
 * updateMember / deactivateMember / reactivateMember / allMembers, plus the
 * invite-with-configuration extension (EQUIPE-01..04).
 *
 * NOTE: filename uses a literal dot before "spec.ts" — jest-integration.config.ts
 * testRegex is '.*\.spec\.ts$', which requires it. Files with a hyphen
 * (rbac.e2e-spec.ts, invitation.e2e-spec.ts, auth.e2e-spec.ts,
 * full-auth-flow.e2e-spec.ts) are never discovered; do not cite them as
 * non-regression proof. The 2-field invite non-regression case lives here.
 *
 * Running: pnpm test:integration -- --testPathPattern members-lifecycle.e2e.spec
 */
describe('Member lifecycle (EQUIPE-01..04)', () => {
  let app: INestApplication;

  let orgAId: string;
  let orgBId: string;

  let adminAToken: string;
  let proAToken: string;
  let adminBToken: string;

  let targetMemberId: string; // org A, used for update/deactivate/reactivate happy-path
  let memberBId: string; // org B, used for cross-tenant checks
  let futureApptMemberId: string; // org A, has a future appointment

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Cleanup stale test data
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'memlc-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'memlc-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'memlc-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'memlc-%'`,
    );

    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    const proRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });

    const orgA = await adminPrisma.organization.create({
      data: {
        legalName: 'memlc-test-org-A',
        tradeName: 'memlc-A',
        documentType: 'CNPJ',
        documentNumber: `${Date.now()}`.slice(0, 14).padEnd(14, '5'),
        email: 'memlc-a@t.com',
        subdomain: `memlc-a-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgAId = orgA.id;

    const orgB = await adminPrisma.organization.create({
      data: {
        legalName: 'memlc-test-org-B',
        tradeName: 'memlc-B',
        documentType: 'CNPJ',
        documentNumber: `${Date.now() + 1}`.slice(0, 14).padEnd(14, '6'),
        email: 'memlc-b@t.com',
        subdomain: `memlc-b-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgBId = orgB.id;

    const argon2 = await import('argon2');
    const pwHash = await argon2.hash('password1234', {
      type: argon2.argon2id,
    });

    const mkUser = (tag: string) =>
      adminPrisma.user.create({
        data: {
          email: `memlc-test-${tag}-${Date.now()}@t.com`,
          fullName: `memlc ${tag}`,
          passwordHash: pwHash,
          emailVerifiedAt: new Date(),
        },
      });

    const [adminAUser, proAUser, adminBUser, targetUser, futureApptUser, orgBMemberUser] =
      await Promise.all([
        mkUser('admin-a'),
        mkUser('pro-a'),
        mkUser('admin-b'),
        mkUser('target'),
        mkUser('future-appt'),
        mkUser('member-b'),
      ]);

    await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: adminAUser.id,
        roleId: adminRole.id,
        displayName: 'memlc-admin-a',
        status: 'active',
      },
    });
    await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: proAUser.id,
        roleId: proRole.id,
        displayName: 'memlc-pro-a',
        status: 'active',
      },
    });
    await adminPrisma.member.create({
      data: {
        organizationId: orgBId,
        userId: adminBUser.id,
        roleId: adminRole.id,
        displayName: 'memlc-admin-b',
        status: 'active',
      },
    });
    const targetMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: targetUser.id,
        roleId: proRole.id,
        displayName: 'memlc-target',
        status: 'active',
      },
    });
    targetMemberId = targetMember.id;

    const futureApptMember = await adminPrisma.member.create({
      data: {
        organizationId: orgAId,
        userId: futureApptUser.id,
        roleId: adminRole.id,
        displayName: 'memlc-future-appt',
        status: 'active',
        isProfessional: true,
      },
    });
    futureApptMemberId = futureApptMember.id;

    const orgBMember = await adminPrisma.member.create({
      data: {
        organizationId: orgBId,
        userId: orgBMemberUser.id,
        roleId: adminRole.id,
        displayName: 'memlc-member-b',
        status: 'active',
      },
    });
    memberBId = orgBMember.id;

    // Catalog fixtures (org A) for the seeded future appointment
    const category = await adminPrisma.category.create({
      data: { organizationId: orgAId, name: 'memlc-category' },
    });
    const service = await adminPrisma.service.create({
      data: {
        organizationId: orgAId,
        categoryId: category.id,
        name: 'memlc-service',
        basePrice: '50.00',
        defaultDurationMinutes: 30,
      },
    });
    const client = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        fullName: 'memlc-client',
        phone: '+5511988880000',
      },
    });
    await adminPrisma.appointment.create({
      data: {
        organizationId: orgAId,
        professionalId: futureApptMemberId,
        clientId: client.id,
        serviceId: service.id,
        startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'scheduled',
      },
    });

    // Log in
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({
          query: `mutation($i: LoginInput!) { login(input: $i) { accessToken errors { code } } }`,
          variables: { i: { email, password: 'password1234' } },
        });
      return res.body.data.login.accessToken as string;
    };

    adminAToken = await login(adminAUser.email);
    proAToken = await login(proAUser.email);
    adminBToken = await login(adminBUser.email);
  });

  afterAll(async () => {
    await app.close();
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'memlc-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'memlc-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'memlc-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'memlc-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'memlc-%'`,
    );
  });

  function gql(
    token: string,
    orgId: string,
    query: string,
    variables?: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ query, variables });
  }

  function forbiddenCode(res: { body: { errors?: Array<{ extensions?: { code?: string }; message?: string }> } }): string {
    return (
      res.body.errors?.[0]?.extensions?.code ??
      res.body.errors?.[0]?.message ??
      ''
    );
  }

  describe('Authorization', () => {
    it('ADMIN calls updateMember → succeeds', async () => {
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($i: UpdateMemberInput!) {
          updateMember(input: $i) {
            member { id isProfessional seniorityTier }
            errors { code }
          }
        }`,
        { i: { id: targetMemberId, isProfessional: true, seniorityTier: 'senior' } },
      );
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.updateMember.errors).toEqual([]);
      expect(res.body.data.updateMember.member.isProfessional).toBe(true);
      expect(res.body.data.updateMember.member.seniorityTier).toBe('senior');
    });

    it('PROFESSIONAL calls updateMember → FORBIDDEN', async () => {
      const res = await gql(
        proAToken,
        orgAId,
        `mutation($i: UpdateMemberInput!) {
          updateMember(input: $i) { member { id } errors { code } }
        }`,
        { i: { id: targetMemberId, isProfessional: true } },
      );
      expect(forbiddenCode(res)).toMatch(/FORBIDDEN/);
    });

    it('ADMIN calls deactivateMember → succeeds', async () => {
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($id: UUID!) {
          deactivateMember(id: $id) { member { id status } errors { code } }
        }`,
        { id: targetMemberId },
      );
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.deactivateMember.errors).toEqual([]);
      expect(res.body.data.deactivateMember.member.status).toBe('inactive');
    });

    it('PROFESSIONAL calls deactivateMember → FORBIDDEN', async () => {
      const res = await gql(
        proAToken,
        orgAId,
        `mutation($id: UUID!) {
          deactivateMember(id: $id) { errors { code } }
        }`,
        { id: targetMemberId },
      );
      expect(forbiddenCode(res)).toMatch(/FORBIDDEN/);
    });

    it('PROFESSIONAL calls reactivateMember → FORBIDDEN', async () => {
      const res = await gql(
        proAToken,
        orgAId,
        `mutation($id: UUID!) {
          reactivateMember(id: $id) { errors { code } }
        }`,
        { id: targetMemberId },
      );
      expect(forbiddenCode(res)).toMatch(/FORBIDDEN/);
    });

    it('PROFESSIONAL calls allMembers → succeeds (has member.read)', async () => {
      const res = await gql(
        proAToken,
        orgAId,
        `query { allMembers { id status } }`,
      );
      expect(res.body.errors).toBeUndefined();
      expect(Array.isArray(res.body.data.allMembers)).toBe(true);
    });

    it('ADMIN reactivates the target member back to active (cleanup for later assertions)', async () => {
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($id: UUID!) {
          reactivateMember(id: $id) { member { id status } errors { code } }
        }`,
        { id: targetMemberId },
      );
      expect(res.body.data.reactivateMember.errors).toEqual([]);
      expect(res.body.data.reactivateMember.member.status).toBe('active');
    });
  });

  describe('Isolamento por tenant', () => {
    it('ADMIN de org A com X-Organization-Id de org B → TENANT_MISMATCH|FORBIDDEN', async () => {
      const res = await gql(
        adminAToken,
        orgBId,
        `mutation($i: UpdateMemberInput!) {
          updateMember(input: $i) { errors { code } }
        }`,
        { i: { id: targetMemberId, isProfessional: true } },
      );
      expect(forbiddenCode(res)).toMatch(/TENANT_MISMATCH|FORBIDDEN/);
    });

    it('updateMember com id de membro de outra org → MEMBER_NOT_FOUND, membro de org B intocado', async () => {
      const before = await adminPrisma.member.findUniqueOrThrow({
        where: { id: memberBId },
      });
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($i: UpdateMemberInput!) {
          updateMember(input: $i) { member { id } errors { code } }
        }`,
        { i: { id: memberBId, isProfessional: true, seniorityTier: 'senior' } },
      );
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.updateMember.member).toBeNull();
      expect(res.body.data.updateMember.errors).toEqual([
        expect.objectContaining({ code: 'MEMBER_NOT_FOUND' }),
      ]);

      const after = await adminPrisma.member.findUniqueOrThrow({
        where: { id: memberBId },
      });
      expect(after.isProfessional).toBe(before.isProfessional);
      expect(after.seniorityTier).toBe(before.seniorityTier);
    });

    it('allMembers de org A não contém nenhum id de org B', async () => {
      const res = await gql(adminAToken, orgAId, `query { allMembers { id } }`);
      const ids: string[] = res.body.data.allMembers.map(
        (m: { id: string }) => m.id,
      );
      expect(ids).not.toContain(memberBId);
    });

    it('allMembers de org B (via ADMIN B) não contém nenhum id de org A', async () => {
      const res = await gql(adminBToken, orgBId, `query { allMembers { id } }`);
      const ids: string[] = res.body.data.allMembers.map(
        (m: { id: string }) => m.id,
      );
      expect(ids).not.toContain(targetMemberId);
      expect(ids).toContain(memberBId);
    });
  });

  describe('Ciclo de vida ponta a ponta', () => {
    it('updateMember + members/allMembers/deactivate/reactivate round-trip', async () => {
      // 1) updateMember marca isProfessional + seniorityTier
      const upd = await gql(
        adminAToken,
        orgAId,
        `mutation($i: UpdateMemberInput!) {
          updateMember(input: $i) { member { id isProfessional seniorityTier } errors { code } }
        }`,
        { i: { id: targetMemberId, isProfessional: true, seniorityTier: 'senior' } },
      );
      expect(upd.body.data.updateMember.errors).toEqual([]);

      // 2) aparece em `members` com os valores configurados
      const membersRes = await gql(
        adminAToken,
        orgAId,
        `query { members { id isProfessional seniorityTier status } }`,
      );
      const inMembers = membersRes.body.data.members.find(
        (m: { id: string }) => m.id === targetMemberId,
      );
      expect(inMembers).toBeDefined();
      expect(inMembers.isProfessional).toBe(true);
      expect(inMembers.seniorityTier).toBe('senior');

      // 3) deactivateMember → some de `members`, continua em `allMembers` inactive
      const deact = await gql(
        adminAToken,
        orgAId,
        `mutation($id: UUID!) {
          deactivateMember(id: $id) { member { id status } errors { code } }
        }`,
        { id: targetMemberId },
      );
      expect(deact.body.data.deactivateMember.errors).toEqual([]);

      const membersAfterDeactivate = await gql(
        adminAToken,
        orgAId,
        `query { members { id } }`,
      );
      expect(
        membersAfterDeactivate.body.data.members.map((m: { id: string }) => m.id),
      ).not.toContain(targetMemberId);

      const allMembersAfterDeactivate = await gql(
        adminAToken,
        orgAId,
        `query { allMembers { id status } }`,
      );
      const inAllMembers = allMembersAfterDeactivate.body.data.allMembers.find(
        (m: { id: string }) => m.id === targetMemberId,
      );
      expect(inAllMembers).toBeDefined();
      expect(inAllMembers.status).toBe('inactive');

      // 4) reactivateMember → devolve a `members`
      const react = await gql(
        adminAToken,
        orgAId,
        `mutation($id: UUID!) {
          reactivateMember(id: $id) { member { id status } errors { code } }
        }`,
        { id: targetMemberId },
      );
      expect(react.body.data.reactivateMember.errors).toEqual([]);

      const membersAfterReactivate = await gql(
        adminAToken,
        orgAId,
        `query { members { id } }`,
      );
      expect(
        membersAfterReactivate.body.data.members.map((m: { id: string }) => m.id),
      ).toContain(targetMemberId);
    });

    it('deactivateMember com agendamento futuro devolve MEMBER_HAS_FUTURE_APPOINTMENTS', async () => {
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($id: UUID!) {
          deactivateMember(id: $id) {
            member { id }
            futureAppointmentCount
            blockingAppointments { id clientName serviceName startsAt }
            errors { code }
          }
        }`,
        { id: futureApptMemberId },
      );
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.deactivateMember.member).toBeNull();
      expect(res.body.data.deactivateMember.errors).toEqual([
        expect.objectContaining({ code: 'MEMBER_HAS_FUTURE_APPOINTMENTS' }),
      ]);
      expect(
        res.body.data.deactivateMember.futureAppointmentCount,
      ).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.deactivateMember.blockingAppointments.length,
      ).toBeGreaterThan(0);
    });
  });

  describe('Convite', () => {
    it('inviteMember só com { email, roleName } continua funcionando (não regride rbac.e2e-spec.ts)', async () => {
      const email = `memlc-invitee-${Date.now()}@t.com`;
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($i: InviteMemberInput!) {
          inviteMember(input: $i) { invitationId errors { code } }
        }`,
        { i: { email, roleName: 'ATTENDANT' } },
      );
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.inviteMember.errors).toEqual([]);
      expect(res.body.data.inviteMember.invitationId).toBeTruthy();

      const row = await adminPrisma.memberInvitation.findUniqueOrThrow({
        where: { id: res.body.data.inviteMember.invitationId },
      });
      expect(row.isProfessional).toBe(false);
      expect(row.seniorityTier).toBeNull();
    });

    it('inviteMember com isProfessional + seniorityTier persiste os dois e pendingInvitations os devolve', async () => {
      const email = `memlc-invitee-pro-${Date.now()}@t.com`;
      const res = await gql(
        adminAToken,
        orgAId,
        `mutation($i: InviteMemberInput!) {
          inviteMember(input: $i) { invitationId errors { code } }
        }`,
        {
          i: {
            email,
            roleName: 'PROFESSIONAL',
            isProfessional: true,
            seniorityTier: 'pleno',
          },
        },
      );
      expect(res.body.data.inviteMember.errors).toEqual([]);
      const invitationId = res.body.data.inviteMember.invitationId;

      const row = await adminPrisma.memberInvitation.findUniqueOrThrow({
        where: { id: invitationId },
      });
      expect(row.isProfessional).toBe(true);
      expect(row.seniorityTier).toBe('pleno');

      const pending = await gql(
        adminAToken,
        orgAId,
        `query { pendingInvitations { id email isProfessional seniorityTier } }`,
      );
      const found = pending.body.data.pendingInvitations.find(
        (p: { id: string }) => p.id === invitationId,
      );
      expect(found).toBeDefined();
      expect(found.isProfessional).toBe(true);
      expect(found.seniorityTier).toBe('pleno');
    });

    it('aceitar um convite configurado propaga isProfessional/seniorityTier ao Member criado', async () => {
      const plaintext = `memlc-accept-token-${Date.now()}`;
      const tokenHash = createHash('sha256').update(plaintext).digest('hex');
      const proRole = await adminPrisma.role.findFirstOrThrow({
        where: { name: 'PROFESSIONAL', isSystem: true },
      });
      const adminMember = await adminPrisma.member.findFirstOrThrow({
        where: { organizationId: orgAId, displayName: 'memlc-admin-a' },
      });
      const email = `memlc-accept-${Date.now()}@t.com`;
      await adminPrisma.memberInvitation.create({
        data: {
          organizationId: orgAId,
          email,
          roleId: proRole.id,
          tokenHash,
          invitedById: adminMember.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isProfessional: true,
          seniorityTier: 'junior',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({
          query: `mutation($i: AcceptInvitationInput!) {
            acceptInvitation(input: $i) { accessToken errors { code } }
          }`,
          variables: {
            i: {
              token: plaintext,
              fullName: 'memlc-accept-newbie',
              password: 'newbie12345',
            },
          },
        });

      expect(res.body.data.acceptInvitation.errors).toEqual([]);
      expect(res.body.data.acceptInvitation.accessToken).toBeTruthy();

      const created = await adminPrisma.member.findFirstOrThrow({
        where: { organizationId: orgAId, displayName: 'memlc-accept-newbie' },
      });
      expect(created.isProfessional).toBe(true);
      expect(created.seniorityTier).toBe('junior');
    });
  });
});

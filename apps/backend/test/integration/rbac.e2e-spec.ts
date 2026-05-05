import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { adminPrisma } from './setup';

/**
 * RBAC enforcement tests — validates AUTH-03 / Phase 1 Success Criterion #3.
 *
 * Proves that:
 *  - ADMIN can call inviteMember (has member.invite permission)
 *  - PROFESSIONAL cannot call inviteMember (FORBIDDEN — missing member.invite)
 *  - X-Organization-Id mismatch → TENANT_MISMATCH error
 */
describe('RBAC enforcement (AUTH-03, Phase 1 Success Criterion #3)', () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let proAccessToken: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    // Cleanup stale test data
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'rbac-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'rbac-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'rbac-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'rbac-test-%'`,
    );

    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });
    const proRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });

    const org = await adminPrisma.organization.create({
      data: {
        legalName: 'rbac-test-org',
        tradeName: 'rbac-test',
        documentType: 'CNPJ',
        documentNumber: `rbac-${Date.now()}`,
        email: 'rbac@t.com',
        subdomain: `rbac-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgId = org.id;

    const argon2 = await import('argon2');
    const pwHash = await argon2.hash('password1234', { type: argon2.argon2id });

    const adminUser = await adminPrisma.user.create({
      data: {
        email: `rbac-test-admin-${Date.now()}@t.com`,
        fullName: 'rbac admin',
        passwordHash: pwHash,
        emailVerifiedAt: new Date(),
      },
    });
    const proUser = await adminPrisma.user.create({
      data: {
        email: `rbac-test-pro-${Date.now()}@t.com`,
        fullName: 'rbac pro',
        passwordHash: pwHash,
        emailVerifiedAt: new Date(),
      },
    });

    await adminPrisma.member.create({
      data: {
        organizationId: orgId,
        userId: adminUser.id,
        roleId: adminRole.id,
        displayName: 'rbac-test-admin',
        status: 'active',
      },
    });
    await adminPrisma.member.create({
      data: {
        organizationId: orgId,
        userId: proUser.id,
        roleId: proRole.id,
        displayName: 'rbac-test-pro',
        status: 'active',
      },
    });

    // Log in both users
    const adminLogin = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: LoginInput!) { login(input: $i) { accessToken errors { code } } }`,
        variables: { i: { email: adminUser.email, password: 'password1234' } },
      });
    adminAccessToken = adminLogin.body.data.login.accessToken;

    const proLogin = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: LoginInput!) { login(input: $i) { accessToken errors { code } } }`,
        variables: { i: { email: proUser.email, password: 'password1234' } },
      });
    proAccessToken = proLogin.body.data.login.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'rbac-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'rbac-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'rbac-test-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'rbac-test-%'`,
    );
  });

  it('ADMIN can call inviteMember (has member.invite permission)', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        query: `mutation($i: InviteMemberInput!) {
          inviteMember(input: $i) { invitationId errors { code } }
        }`,
        variables: {
          i: { email: `rbac-invitee-${Date.now()}@t.com`, roleName: 'ATTENDANT' },
        },
      });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.inviteMember.errors).toEqual([]);
    expect(res.body.data.inviteMember.invitationId).toBeTruthy();
  });

  it('PROFESSIONAL cannot call inviteMember — Phase 1 Success Criterion #3', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${proAccessToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        query: `mutation($i: InviteMemberInput!) {
          inviteMember(input: $i) { invitationId errors { code } }
        }`,
        variables: {
          i: { email: `rbac-blocked-${Date.now()}@t.com`, roleName: 'ATTENDANT' },
        },
      });
    // Expect a GraphQL error (ForbiddenException) in errors array
    const errorMsg =
      res.body.errors?.[0]?.extensions?.code ??
      res.body.errors?.[0]?.message ??
      '';
    expect(errorMsg).toMatch(/FORBIDDEN/);
  });

  it('X-Organization-Id mismatch → TENANT_MISMATCH error', async () => {
    const fakeOrgId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .set('X-Organization-Id', fakeOrgId)
      .send({
        query: `mutation($i: InviteMemberInput!) {
          inviteMember(input: $i) { invitationId errors { code } }
        }`,
        variables: {
          i: { email: `rbac-mismatch-${Date.now()}@t.com`, roleName: 'ATTENDANT' },
        },
      });
    const errorMsg =
      res.body.errors?.[0]?.extensions?.code ??
      res.body.errors?.[0]?.message ??
      '';
    expect(errorMsg).toMatch(/TENANT_MISMATCH|FORBIDDEN/);
  });
});

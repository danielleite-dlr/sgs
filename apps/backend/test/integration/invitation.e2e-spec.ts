import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { adminPrisma } from './setup';

/**
 * Member invitation flow e2e tests — validates D-15.
 *
 * Uses adminPrisma (BYPASSRLS) to create test data directly.
 * Tests the acceptInvitation mutation through the full GraphQL stack.
 */
describe('Member invitation flow (D-15)', () => {
  let app: INestApplication;
  let orgId: string;
  let adminMemberId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    // Cleanup
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'inv-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'inv-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'inv-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'inv-%'`,
    );

    const adminRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });

    const org = await adminPrisma.organization.create({
      data: {
        legalName: 'inv-org',
        tradeName: 'inv salon',
        documentType: 'CNPJ',
        documentNumber: `inv-${Date.now()}`,
        email: 'inv@org.com',
        subdomain: `inv-${Date.now()}`,
        segment: 'salon',
      },
    });
    orgId = org.id;

    const argon2 = await import('argon2');
    const adminUser = await adminPrisma.user.create({
      data: {
        email: `inv-admin-${Date.now()}@t.com`,
        fullName: 'inv admin user',
        passwordHash: await argon2.hash('password1234', {
          type: argon2.argon2id,
        }),
        emailVerifiedAt: new Date(),
      },
    });
    const member = await adminPrisma.member.create({
      data: {
        organizationId: orgId,
        userId: adminUser.id,
        roleId: adminRole.id,
        displayName: 'inv-admin-member',
        status: 'active',
      },
    });
    adminMemberId = member.id;
  });

  afterAll(async () => {
    await app.close();
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'inv-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'inv-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'inv-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'inv-%'`,
    );
  });

  it('accept invitation creates user + member + returns valid session', async () => {
    const plaintext = `invtoken-known-${Date.now()}`;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const proRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    const email = `inv-newbie-${Date.now()}@t.com`;
    await adminPrisma.memberInvitation.create({
      data: {
        organizationId: orgId,
        email,
        roleId: proRole.id,
        tokenHash,
        invitedById: adminMemberId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: AcceptInvitationInput!) {
          acceptInvitation(input: $i) {
            accessToken
            refreshToken
            session { memberships { roleName organizationName } }
            errors { code message }
          }
        }`,
        variables: {
          i: { token: plaintext, fullName: 'inv newbie user', password: 'newbie12345' },
        },
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.acceptInvitation.errors).toEqual([]);
    expect(res.body.data.acceptInvitation.accessToken).toBeTruthy();
    expect(res.body.data.acceptInvitation.refreshToken).toBeTruthy();
    expect(
      res.body.data.acceptInvitation.session.memberships[0].roleName,
    ).toBe('PROFESSIONAL');
  });

  it('accept with expired token returns INVITATION_EXPIRED', async () => {
    const plaintext = `invtoken-expired-${Date.now()}`;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const proRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    await adminPrisma.memberInvitation.create({
      data: {
        organizationId: orgId,
        email: `inv-expired-${Date.now()}@t.com`,
        roleId: proRole.id,
        tokenHash,
        invitedById: adminMemberId,
        expiresAt: new Date(Date.now() - 60_000), // expired 1 minute ago
      },
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: AcceptInvitationInput!) {
          acceptInvitation(input: $i) { errors { code } }
        }`,
        variables: {
          i: { token: plaintext, fullName: 'expired user', password: 'expired12345' },
        },
      });

    expect(res.body.data.acceptInvitation.errors[0].code).toBe(
      'INVITATION_EXPIRED',
    );
  });

  it('accept with invalid token returns TOKEN_INVALID', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: AcceptInvitationInput!) {
          acceptInvitation(input: $i) { errors { code } }
        }`,
        variables: {
          i: { token: 'not-a-real-token-xyz', fullName: 'invalid user', password: 'invalid12345' },
        },
      });

    expect(res.body.data.acceptInvitation.errors[0].code).toBe('TOKEN_INVALID');
  });

  it('accept already-used token returns INVITATION_USED', async () => {
    const plaintext = `invtoken-used-${Date.now()}`;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const proRole = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    // Create an already-accepted invitation
    await adminPrisma.memberInvitation.create({
      data: {
        organizationId: orgId,
        email: `inv-used-${Date.now()}@t.com`,
        roleId: proRole.id,
        tokenHash,
        invitedById: adminMemberId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(), // already consumed
      },
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: AcceptInvitationInput!) {
          acceptInvitation(input: $i) { errors { code } }
        }`,
        variables: {
          i: { token: plaintext, fullName: 'used user', password: 'used12345' },
        },
      });

    expect(res.body.data.acceptInvitation.errors[0].code).toBe(
      'INVITATION_USED',
    );
  });
});

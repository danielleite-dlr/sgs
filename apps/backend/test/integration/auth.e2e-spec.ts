import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { adminPrisma } from './setup';

const post = (
  app: INestApplication,
  query: string,
  variables?: Record<string, unknown>,
) =>
  request(app.getHttpServer())
    .post('/graphql')
    .send({ query, variables })
    .set('Content-Type', 'application/json');

describe('Auth flow (AUTH-01, AUTH-02)', () => {
  let app: INestApplication;
  const email = `e2e-${Date.now()}@test.com`;
  let refreshToken: string;
  let accessToken: string;

  beforeAll(async () => {
    // Clean up any leftover e2e data
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'e2e-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'e2e-%' OR legal_name = 'E2E Salon'`,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    // Clean up test data
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'e2e-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'e2e-%' OR legal_name = 'E2E Salon'`,
    );
  }, 60000);

  it('signup creates user + org + member, no tokens issued (email unverified)', async () => {
    const res = await post(
      app,
      `
      mutation($i: SignupInput!) {
        signup(input: $i) {
          accessToken
          refreshToken
          errors { code message }
          session { userId email memberships { roleName organizationName } }
        }
      }`,
      {
        i: {
          fullName: 'E2E User',
          email,
          password: 'password1234',
          salonName: 'E2E Salon',
        },
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.signup.errors).toEqual([]);
    expect(res.body.data.signup.accessToken).toBeNull();
    expect(res.body.data.signup.refreshToken).toBeNull();
  });

  it('login fails with ACCOUNT_UNVERIFIED before email verification', async () => {
    const res = await post(
      app,
      `
      mutation($i: LoginInput!) {
        login(input: $i) {
          accessToken
          errors { code }
        }
      }`,
      { i: { email, password: 'password1234' } },
    );
    expect(res.status).toBe(200);
    expect(res.body.data.login.accessToken).toBeNull();
    expect(res.body.data.login.errors[0].code).toBe('ACCOUNT_UNVERIFIED');
  });

  it('direct DB verification simulates verifyEmail consuming the token', async () => {
    // The plaintext token is not stored (only SHA-256 hash is).
    // For the e2e test we bypass via adminPrisma (BYPASSRLS) to set emailVerifiedAt directly.
    // The verifyEmail endpoint logic is unit-tested in EmailVerificationService specs (task 2).
    const updated = await adminPrisma.user.update({
      where: { email },
      data: { emailVerifiedAt: new Date() },
    });
    expect(updated.emailVerifiedAt).toBeTruthy();
  });

  it('login succeeds after verification, returns access + refresh tokens with ADMIN membership', async () => {
    const res = await post(
      app,
      `
      mutation($i: LoginInput!) {
        login(input: $i) {
          accessToken
          refreshToken
          session {
            userId
            memberships { roleName organizationName }
          }
          errors { code }
        }
      }`,
      { i: { email, password: 'password1234' } },
    );
    expect(res.status).toBe(200);
    expect(res.body.data.login.errors).toEqual([]);
    expect(res.body.data.login.accessToken).toBeTruthy();
    expect(res.body.data.login.refreshToken).toBeTruthy();
    expect(res.body.data.login.session.memberships[0].roleName).toBe('ADMIN');
    accessToken = res.body.data.login.accessToken as string;
    refreshToken = res.body.data.login.refreshToken as string;
  });

  it('refreshSession rotates the refresh token; reusing old token triggers family revocation', async () => {
    const res = await post(
      app,
      `
      mutation($i: RefreshInput!) {
        refreshSession(input: $i) {
          accessToken
          refreshToken
          errors { code }
        }
      }`,
      { i: { refreshToken } },
    );
    expect(res.status).toBe(200);
    expect(res.body.data.refreshSession.errors).toEqual([]);
    expect(res.body.data.refreshSession.refreshToken).toBeTruthy();
    expect(res.body.data.refreshSession.refreshToken).not.toBe(refreshToken);

    const oldRefreshToken = refreshToken;
    refreshToken = res.body.data.refreshSession.refreshToken as string;

    // Reusing the old (now-revoked) token should trigger family revocation
    const res2 = await post(
      app,
      `
      mutation($i: RefreshInput!) {
        refreshSession(input: $i) {
          errors { code }
        }
      }`,
      { i: { refreshToken: oldRefreshToken } },
    );
    expect(res2.status).toBe(200);
    expect(res2.body.data.refreshSession.errors[0].code).toBe('TOKEN_REUSE_DETECTED');
  }, 30000);

  it('logout revokes the active refresh token', async () => {
    const res = await post(
      app,
      `
      mutation($i: RefreshInput!) {
        logout(input: $i) { success }
      }`,
      { i: { refreshToken } },
    );
    expect(res.status).toBe(200);
    expect(res.body.data.logout.success).toBe(true);
  });
});

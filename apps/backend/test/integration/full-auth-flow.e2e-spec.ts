import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { adminPrisma } from './setup';
import { TestEmailAdapter } from '../../src/email/test-email.adapter';
import { EMAIL_ADAPTER } from '../../src/email/email.module';

/**
 * Full auth flow e2e test — Phase 1 Success Criteria #2 + #3 enforced in CI.
 *
 * Exercises the complete auth surface in a single sequential test:
 *   signup → verifyEmail (via TestEmailAdapter token capture)
 *         → login → refreshSession (rotates) → reuse old refresh (TOKEN_REUSE_DETECTED)
 *         → inviteMember as ADMIN (via TestEmailAdapter) → acceptInvitation
 *         → logout
 *         → PROFESSIONAL cannot inviteMember (FORBIDDEN)
 */
describe('Full auth flow (Phase 1 SC #2 + #3 enforced in CI)', () => {
  let app: INestApplication;
  let mailer: TestEmailAdapter;

  const adminEmail = `full-${Date.now()}@test.com`;
  let refreshToken: string;
  let accessToken: string;
  let orgId: string;
  let inviteeEmail: string;

  beforeAll(async () => {
    // Clean up any leftover test data
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'full-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'full-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'full-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'full-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'full-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'full-%'`,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_ADAPTER)
      .useClass(TestEmailAdapter)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Retrieve the singleton TestEmailAdapter from the DI container
    mailer = app.get<TestEmailAdapter>(EMAIL_ADAPTER);
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_invitations WHERE email LIKE 'full-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'full-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'full-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'full-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'full-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'full-%'`,
    );
  }, 60000);

  const post = (
    query: string,
    variables?: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set({ 'Content-Type': 'application/json', ...headers })
      .send({ query, variables });

  it('completes the full auth lifecycle in one sequence', async () => {
    // ── 1. Signup ────────────────────────────────────────────────────────────
    const signupRes = await post(
      `mutation($i: SignupInput!) {
        signup(input: $i) {
          accessToken refreshToken errors { code }
        }
      }`,
      {
        i: {
          fullName: 'Full Test',
          email: adminEmail,
          password: 'password1234',
          salonName: 'full-org',
        },
      },
    );
    expect(signupRes.status).toBe(200);
    expect(signupRes.body.errors).toBeUndefined();
    expect(signupRes.body.data.signup.errors).toEqual([]);
    // No tokens before email verification (Phase 1 D-11)
    expect(signupRes.body.data.signup.accessToken).toBeNull();
    expect(signupRes.body.data.signup.refreshToken).toBeNull();

    // ── 2. Capture verification token from TestEmailAdapter ───────────────
    const verifyEmails = mailer.findByRecipient(adminEmail);
    expect(verifyEmails.length).toBeGreaterThan(0);
    const verifyEmail = verifyEmails.find((e) =>
      e.subject.includes('Verifique'),
    );
    expect(verifyEmail).toBeDefined();
    const verifyToken = mailer.extractToken(verifyEmail!);
    expect(verifyToken).toBeTruthy();

    // ── 3. Verify email ───────────────────────────────────────────────────
    const verifyRes = await post(
      `mutation($i: VerifyEmailInput!) {
        verifyEmail(input: $i) {
          success errors { code }
        }
      }`,
      { i: { token: verifyToken } },
    );
    expect(verifyRes.body.data.verifyEmail.success).toBe(true);
    expect(verifyRes.body.data.verifyEmail.errors).toEqual([]);

    // ── 4. Login ──────────────────────────────────────────────────────────
    const loginRes = await post(
      `mutation($i: LoginInput!) {
        login(input: $i) {
          accessToken
          refreshToken
          session { userId memberships { roleName organizationId } }
          errors { code }
        }
      }`,
      { i: { email: adminEmail, password: 'password1234' } },
    );
    expect(loginRes.body.data.login.errors).toEqual([]);
    expect(loginRes.body.data.login.accessToken).toBeTruthy();
    expect(loginRes.body.data.login.refreshToken).toBeTruthy();
    expect(loginRes.body.data.login.session.memberships[0].roleName).toBe(
      'ADMIN',
    );
    accessToken = loginRes.body.data.login.accessToken as string;
    refreshToken = loginRes.body.data.login.refreshToken as string;
    orgId = loginRes.body.data.login.session.memberships[0].organizationId as string;

    // ── 5. Refresh rotates token ──────────────────────────────────────────
    const refreshRes = await post(
      `mutation($i: RefreshInput!) {
        refreshSession(input: $i) {
          accessToken refreshToken errors { code }
        }
      }`,
      { i: { refreshToken } },
    );
    expect(refreshRes.body.data.refreshSession.errors).toEqual([]);
    expect(refreshRes.body.data.refreshSession.refreshToken).toBeTruthy();
    expect(refreshRes.body.data.refreshSession.refreshToken).not.toBe(
      refreshToken,
    );
    const oldRefresh = refreshToken;
    refreshToken = refreshRes.body.data.refreshSession.refreshToken as string;

    // ── 6. Reuse old refresh → family revoked ─────────────────────────────
    const reuseRes = await post(
      `mutation($i: RefreshInput!) {
        refreshSession(input: $i) { errors { code } }
      }`,
      { i: { refreshToken: oldRefresh } },
    );
    expect(reuseRes.body.data.refreshSession.errors[0].code).toBe(
      'TOKEN_REUSE_DETECTED',
    );

    // Re-login to get a fresh refresh token (family was revoked by reuse detection)
    const reloginRes = await post(
      `mutation($i: LoginInput!) {
        login(input: $i) {
          accessToken refreshToken errors { code }
        }
      }`,
      { i: { email: adminEmail, password: 'password1234' } },
    );
    expect(reloginRes.body.data.login.errors).toEqual([]);
    accessToken = reloginRes.body.data.login.accessToken as string;
    refreshToken = reloginRes.body.data.login.refreshToken as string;

    // ── 7. Invite a member ────────────────────────────────────────────────
    mailer.reset();
    inviteeEmail = `full-invitee-${Date.now()}@test.com`;
    const inviteRes = await post(
      `mutation($i: InviteMemberInput!) {
        inviteMember(input: $i) {
          invitationId errors { code message }
        }
      }`,
      { i: { email: inviteeEmail, roleName: 'PROFESSIONAL' } },
      {
        Authorization: `Bearer ${accessToken}`,
        'X-Organization-Id': orgId,
      },
    );
    expect(inviteRes.body.errors).toBeUndefined();
    expect(inviteRes.body.data.inviteMember.errors).toEqual([]);
    expect(inviteRes.body.data.inviteMember.invitationId).toBeTruthy();

    // ── 8. Capture invitation token from TestEmailAdapter ─────────────────
    const inviteMail = mailer.findByRecipient(inviteeEmail)[0];
    expect(inviteMail).toBeDefined();
    const inviteToken = mailer.extractToken(inviteMail);
    expect(inviteToken).toBeTruthy();

    // ── 9. Accept invitation ──────────────────────────────────────────────
    const acceptRes = await post(
      `mutation($i: AcceptInvitationInput!) {
        acceptInvitation(input: $i) {
          accessToken refreshToken
          session { memberships { roleName } }
          errors { code message }
        }
      }`,
      {
        i: {
          token: inviteToken,
          fullName: 'Full Invitee',
          password: 'inviteepass12',
        },
      },
    );
    expect(acceptRes.body.data.acceptInvitation.errors).toEqual([]);
    expect(acceptRes.body.data.acceptInvitation.accessToken).toBeTruthy();
    expect(
      acceptRes.body.data.acceptInvitation.session.memberships[0].roleName,
    ).toBe('PROFESSIONAL');

    // ── 10. Logout ─────────────────────────────────────────────────────────
    const logoutRes = await post(
      `mutation($i: RefreshInput!) { logout(input: $i) { success } }`,
      { i: { refreshToken } },
    );
    expect(logoutRes.body.data.logout.success).toBe(true);
  }, 90000);

  it('PROFESSIONAL invitee cannot inviteMember — Phase 1 SC #3', async () => {
    // Log in as the PROFESSIONAL invitee created in the previous test
    const loginRes = await post(
      `mutation($i: LoginInput!) {
        login(input: $i) {
          accessToken session { memberships { organizationId roleName } }
          errors { code }
        }
      }`,
      { i: { email: inviteeEmail, password: 'inviteepass12' } },
    );
    expect(loginRes.body.data.login.errors).toEqual([]);
    const proAccess = loginRes.body.data.login.accessToken as string;
    const proOrgId = loginRes.body.data.login.session.memberships[0]
      .organizationId as string;

    // PROFESSIONAL should be denied inviteMember (needs member.invite permission)
    const denyRes = await post(
      `mutation($i: InviteMemberInput!) {
        inviteMember(input: $i) { invitationId errors { code } }
      }`,
      { i: { email: 'should-not-work@x.com', roleName: 'ATTENDANT' } },
      {
        Authorization: `Bearer ${proAccess}`,
        'X-Organization-Id': proOrgId,
      },
    );
    // PermissionGuard throws ForbiddenException → surfaced in GraphQL errors
    const errorMsg =
      denyRes.body.errors?.[0]?.extensions?.code ??
      denyRes.body.errors?.[0]?.message ??
      '';
    expect(errorMsg).toMatch(/FORBIDDEN/);
  }, 30000);
});

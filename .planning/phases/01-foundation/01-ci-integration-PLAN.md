---
phase: 01-foundation
plan: 07
type: execute
wave: 6
depends_on: [02, 04, 05, 06]
files_modified:
  - .github/workflows/ci.yml
  - apps/backend/test/integration/full-auth-flow.e2e-spec.ts
  - apps/backend/src/auth/auth.service.ts
  - apps/backend/src/email/email.service.ts
  - apps/backend/src/email/test-email.adapter.ts
  - apps/backend/test/integration/setup.ts
  - README.md
  - apps/backend/README.md
  - apps/frontend/README.md
  - .planning/phases/01-foundation/01-PHASE-SUMMARY.md
  - apps/frontend/package.json
autonomous: false
requirements: [INFRA-01, AUTH-01, AUTH-02, AUTH-03]

must_haves:
  truths:
    - "Developer can clone repo, run `pnpm install && cp .env.example .env && docker compose up -d` and verify cross-tenant isolation + full auth flow in under 15 minutes (per Phase 1 SC #1 + #4 + #5)"
    - "CI workflow runs typecheck, lint, RLS isolation, full auth flow, and RBAC tests in parallel jobs and fails the build on any failure"
    - "An end-to-end auth integration test exercises signup → captures verification token via TestEmailAdapter → verifyEmail → login → refresh → invite → accept → logout in one sequence"
    - "Backend exposes a TestEmailAdapter that captures sent emails in-memory when NODE_ENV=test, replacing ResendAdapter via DI override"
    - "README.md at repo root documents the complete dev setup in <10 commands and lists the 5 success criteria with how to verify each"
    - "Phase summary documents the artifact inventory, deviations from PRDs, and follow-ups for downstream phases"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "Updated CI with full-auth job"
      contains: "full-auth-flow"
    - path: "apps/backend/test/integration/full-auth-flow.e2e-spec.ts"
      provides: "End-to-end test exercising the complete auth surface"
      min_lines: 80
    - path: "apps/backend/src/email/test-email.adapter.ts"
      provides: "In-memory email capture for tests"
      exports: ["TestEmailAdapter"]
    - path: "README.md"
      provides: "Repo-root README with setup + verification of Phase 1 success criteria"
      contains: "Success Criteria"
    - path: ".planning/phases/01-foundation/01-PHASE-SUMMARY.md"
      provides: "Phase 1 retrospective summary for downstream phases"
      contains: "Phase 1 Foundation"
  key_links:
    - from: "CI workflow"
      to: "full-auth-flow.e2e-spec.ts"
      via: "pnpm test:integration"
      pattern: "full-auth-flow"
    - from: "TestEmailAdapter"
      to: "EmailService"
      via: "ResendAdapter override in test module"
      pattern: "TestEmailAdapter"
---

<objective>
Close out Phase 1 by (a) adding a comprehensive end-to-end test that exercises the complete auth surface in one sequence using a TestEmailAdapter to capture verification tokens, (b) wiring this test into CI alongside the RLS and RBAC suites, (c) producing operator documentation (READMEs at repo root and per-app), and (d) producing the Phase 1 retrospective summary that downstream phases consume.

Purpose: Without this plan, the 5 Phase 1 Success Criteria are not all enforced by CI. Plan 02 wired criterion #4 + #5; this plan adds CI enforcement of #1 (boot time), #2 (session persistence — backend portion), #3 (RBAC enforcement). Plan 06 verified them manually in browser; this plan locks them into the build.

Output: A green CI pipeline that proves all Phase 1 success criteria automatically, plus operator documentation that lets a new developer go from clone to running stack in <10 minutes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md
@.planning/phases/01-foundation/01-03-SUMMARY.md
@.planning/phases/01-foundation/01-04-SUMMARY.md
@.planning/phases/01-foundation/01-05-SUMMARY.md
@.planning/phases/01-foundation/01-06-SUMMARY.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@docker-compose.yml
@.github/workflows/ci.yml
@apps/backend/test/integration/setup.ts
@apps/backend/src/email/email.service.ts
@apps/backend/src/email/resend.adapter.ts
@apps/backend/src/email/email.module.ts

<interfaces>
<!-- From plan 02: -->
- CI job `tenant-isolation` exists and runs the RLS suite

<!-- From plan 04: -->
- ResendAdapter has dev fallback when RESEND_API_KEY is unset (logs to console)
- EmailModule provides ResendAdapter + EmailService
- EmailService.sendVerification(to, fullName, token) and sendInvitation(to, salonName, inviterName, token)
- AuthService.signup creates the verification token then calls EmailService.sendVerification

<!-- From plan 05: -->
- InvitationService.invite calls EmailService.sendInvitation
- CI jobs `auth.e2e-spec`, `rbac.e2e-spec`, `invitation.e2e-spec` exist as separate test files (run via pnpm test:integration)

<!-- From plan 06: -->
- All frontend pages built and verified manually
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build TestEmailAdapter, refactor EmailModule for testability, add full-auth-flow integration test</name>
  <files>apps/backend/src/email/test-email.adapter.ts, apps/backend/src/email/email.module.ts, apps/backend/src/email/email.service.ts, apps/backend/src/auth/auth.service.ts, apps/backend/test/integration/setup.ts, apps/backend/test/integration/full-auth-flow.e2e-spec.ts</files>
  <read_first>
    - apps/backend/src/email/email.service.ts (existing API)
    - apps/backend/src/email/resend.adapter.ts (interface SendEmailParams)
    - apps/backend/src/email/email.module.ts (existing wiring)
    - apps/backend/test/integration/setup.ts (test bootstrap)
    - apps/backend/test/integration/auth.e2e-spec.ts (existing test pattern; new test re-uses adminPrisma)
    - apps/backend/test/integration/invitation.e2e-spec.ts (manual hash creation pattern; new test uses TestEmailAdapter instead)
  </read_first>
  <behavior>
    TestEmailAdapter:
    - Test: After EmailService.sendVerification is called, TestEmailAdapter.lastSent contains an entry with the verification URL
    - Test: TestEmailAdapter.findByRecipient(email) returns all emails sent to that address
    - Test: TestEmailAdapter.reset() clears the captured emails

    full-auth-flow.e2e-spec.ts:
    - One sequential it() block walks: signup (capture verify token from TestEmailAdapter) → verifyEmail with captured token → login (success) → refreshSession (rotates) → reuse old refresh (REUSE_DETECTED) → inviteMember as ADMIN (capture invite token) → acceptInvitation with captured token → logout
  </behavior>
  <action>
    **Update `apps/backend/test/integration/setup.ts`** — add refresh_tokens / email_verification_tokens cleanup to global `afterAll` (mitigates the O(N) Argon2 scan growth in TokenService.rotateRefresh during long test runs):
    ```typescript
    // Append inside the existing afterAll block:
    // Clean up auth token rows older than the test session start to prevent
    // TokenService.rotateRefresh O(N) scan growth across CI runs.
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE issued_at < NOW() - INTERVAL '30 days'`
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM email_verification_tokens WHERE created_at < NOW() - INTERVAL '24 hours'`
    );
    ```

    **Update `apps/backend/src/email/resend.adapter.ts`** — extract the SendEmailParams interface to a shared file:
    ```typescript
    // Add an exported interface at the top of resend.adapter.ts
    export interface EmailAdapter {
      send(params: SendEmailParams): Promise<void>;
    }
    ```
    Make `ResendAdapter` implement `EmailAdapter`.

    **Create `apps/backend/src/email/test-email.adapter.ts`:**
    ```typescript
    import { Injectable } from '@nestjs/common';
    import type { EmailAdapter, SendEmailParams } from './resend.adapter';

    @Injectable()
    export class TestEmailAdapter implements EmailAdapter {
      private sent: SendEmailParams[] = [];

      async send(params: SendEmailParams): Promise<void> {
        this.sent.push(params);
      }

      get lastSent(): SendEmailParams | undefined {
        return this.sent[this.sent.length - 1];
      }

      get all(): readonly SendEmailParams[] {
        return [...this.sent];
      }

      findByRecipient(email: string): SendEmailParams[] {
        const lower = email.toLowerCase();
        return this.sent.filter((s) => s.to.toLowerCase() === lower);
      }

      /** Extract the first href found in the email's text or html body. */
      extractLink(email: SendEmailParams): string | null {
        const body = email.text ?? email.html;
        if (!body) return null;
        const m = body.match(/https?:\/\/\S+/);
        return m ? m[0] : null;
      }

      /** For verification emails, extract the token from the URL. */
      extractToken(email: SendEmailParams): string | null {
        const link = this.extractLink(email);
        if (!link) return null;
        // sendVerification: /verificar-email/sucesso?token=...
        // sendInvitation:   /convite/{token}
        const queryMatch = link.match(/[?&]token=([^&\s]+)/);
        if (queryMatch) return decodeURIComponent(queryMatch[1]);
        const pathMatch = link.match(/\/convite\/([^/?\s]+)/);
        if (pathMatch) return decodeURIComponent(pathMatch[1]);
        return null;
      }

      reset(): void {
        this.sent = [];
      }
    }
    ```

    **Update `apps/backend/src/email/email.module.ts`** to use a token-based provider so tests can override:
    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { ResendAdapter } from './resend.adapter';
    import { EmailService } from './email.service';

    export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');

    @Global()
    @Module({
      providers: [
        ResendAdapter,
        { provide: EMAIL_ADAPTER, useExisting: ResendAdapter },
        EmailService,
      ],
      exports: [EmailService, EMAIL_ADAPTER],
    })
    export class EmailModule {}
    ```

    **Update `apps/backend/src/email/email.service.ts`** to inject by token:
    ```typescript
    // Replace the constructor:
    import { Inject, Injectable } from '@nestjs/common';
    import { EMAIL_ADAPTER } from './email.module';
    import type { EmailAdapter } from './resend.adapter';
    // ...
    constructor(
      @Inject(EMAIL_ADAPTER) private readonly adapter: EmailAdapter,
      private readonly config: ConfigService<Env, true>,
    ) {}
    // and replace `this.resend.send(...)` calls with `this.adapter.send(...)`
    ```

    **Create `apps/backend/test/integration/full-auth-flow.e2e-spec.ts`** — the single comprehensive flow test:
    ```typescript
    import { Test } from '@nestjs/testing';
    import type { INestApplication } from '@nestjs/common';
    import * as request from 'supertest';
    import { AppModule } from '../../src/app.module';
    import { adminPrisma } from './setup';
    import { TestEmailAdapter } from '../../src/email/test-email.adapter';
    import { EMAIL_ADAPTER } from '../../src/email/email.module';

    describe('Full auth flow (Phase 1 Success Criteria #2 + #3 enforced in CI)', () => {
      let app: INestApplication;
      let mailer: TestEmailAdapter;
      const adminEmail = `full-${Date.now()}@test.com`;
      let refreshToken: string;
      let accessToken: string;
      let orgId: string;

      beforeAll(async () => {
        // Cleanup
        await adminPrisma.$executeRawUnsafe(`DELETE FROM member_invitations WHERE email LIKE 'full-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'full-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'full-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'full-%'`);

        const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(EMAIL_ADAPTER)
          .useClass(TestEmailAdapter)
          .compile();

        app = moduleRef.createNestApplication();
        await app.init();
        mailer = app.get<TestEmailAdapter>(EMAIL_ADAPTER);
      });

      afterAll(async () => {
        await app.close();
        await adminPrisma.$executeRawUnsafe(`DELETE FROM member_invitations WHERE email LIKE 'full-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'full-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'full-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'full-%'`);
      });

      const post = (q: string, v?: Record<string, unknown>, headers: Record<string, string> = {}) =>
        request(app.getHttpServer()).post('/graphql').set(headers).send({ query: q, variables: v });

      it('completes the full auth lifecycle in one sequence', async () => {
        // 1. Signup
        const signupRes = await post(`mutation($i: SignupInput!) { signup(input: $i) {
          accessToken refreshToken errors { code }
        } }`, { i: { fullName: 'Full Test', email: adminEmail, password: 'password1234', salonName: 'full-org' } });
        expect(signupRes.body.data.signup.errors).toEqual([]);
        expect(signupRes.body.data.signup.accessToken).toBeNull();

        // 2. Capture verification token from TestEmailAdapter
        const verifyEmail = mailer.findByRecipient(adminEmail).find((e) => e.subject.includes('Verifique'));
        expect(verifyEmail).toBeDefined();
        const verifyToken = mailer.extractToken(verifyEmail!);
        expect(verifyToken).toBeTruthy();

        // 3. Verify email
        const verifyRes = await post(`mutation($i: VerifyEmailInput!) { verifyEmail(input: $i) {
          success errors { code }
        } }`, { i: { token: verifyToken } });
        expect(verifyRes.body.data.verifyEmail.success).toBe(true);

        // 4. Login
        const loginRes = await post(`mutation($i: LoginInput!) { login(input: $i) {
          accessToken refreshToken session { memberships { roleName organizationId } }
        } }`, { i: { email: adminEmail, password: 'password1234' } });
        expect(loginRes.body.data.login.accessToken).toBeTruthy();
        accessToken = loginRes.body.data.login.accessToken;
        refreshToken = loginRes.body.data.login.refreshToken;
        orgId = loginRes.body.data.login.session.memberships[0].organizationId;
        expect(loginRes.body.data.login.session.memberships[0].roleName).toBe('ADMIN');

        // 5. Refresh rotates
        const refreshRes = await post(`mutation($i: RefreshInput!) { refreshSession(input: $i) {
          accessToken refreshToken errors { code }
        } }`, { i: { refreshToken } });
        expect(refreshRes.body.data.refreshSession.refreshToken).toBeTruthy();
        expect(refreshRes.body.data.refreshSession.refreshToken).not.toBe(refreshToken);
        const oldRefresh = refreshToken;
        refreshToken = refreshRes.body.data.refreshSession.refreshToken;

        // 6. Reuse old refresh -> family revoked
        const reuseRes = await post(`mutation($i: RefreshInput!) { refreshSession(input: $i) {
          errors { code }
        } }`, { i: { refreshToken: oldRefresh } });
        expect(reuseRes.body.data.refreshSession.errors[0].code).toBe('TOKEN_REUSE_DETECTED');

        // 7. Invite a member
        mailer.reset();
        const inviteEmail = `full-invitee-${Date.now()}@test.com`;
        const inviteRes = await post(`mutation($i: InviteMemberInput!) { inviteMember(input: $i) {
          invitationId errors { code message }
        } }`, { i: { email: inviteEmail, roleName: 'PROFESSIONAL' } }, {
          Authorization: `Bearer ${accessToken}`,
          'X-Organization-Id': orgId,
        });
        expect(inviteRes.body.data.inviteMember.errors).toEqual([]);
        expect(inviteRes.body.data.inviteMember.invitationId).toBeTruthy();

        // 8. Capture invitation token from TestEmailAdapter
        const inviteMail = mailer.findByRecipient(inviteEmail)[0];
        expect(inviteMail).toBeDefined();
        const inviteToken = mailer.extractToken(inviteMail);
        expect(inviteToken).toBeTruthy();

        // 9. Accept invitation
        const acceptRes = await post(`mutation($i: AcceptInvitationInput!) { acceptInvitation(input: $i) {
          accessToken refreshToken session { memberships { roleName } } errors { code message }
        } }`, { i: { token: inviteToken, fullName: 'Full Invitee', password: 'inviteepass12' } });
        expect(acceptRes.body.data.acceptInvitation.errors).toEqual([]);
        expect(acceptRes.body.data.acceptInvitation.accessToken).toBeTruthy();
        expect(acceptRes.body.data.acceptInvitation.session.memberships[0].roleName).toBe('PROFESSIONAL');

        // 10. Logout
        const logoutRes = await post(`mutation($i: RefreshInput!) { logout(input: $i) { success } }`,
          { i: { refreshToken } });
        expect(logoutRes.body.data.logout.success).toBe(true);
      });

      it('PROFESSIONAL invitee cannot inviteMember (Success Criterion #3)', async () => {
        // Use the invitee from previous test
        const inviteeEmail = mailer.all[0].to;  // first invitation in this test session
        // ... or look up via DB if mailer was reset
        // Simpler: log in as the invitee and try to invite

        const loginRes = await post(`mutation($i: LoginInput!) { login(input: $i) {
          accessToken session { memberships { organizationId } }
        } }`, { i: { email: inviteeEmail, password: 'inviteepass12' } });
        const proAccess = loginRes.body.data.login.accessToken;
        const proOrgId = loginRes.body.data.login.session.memberships[0].organizationId;

        const denyRes = await post(`mutation($i: InviteMemberInput!) { inviteMember(input: $i) {
          invitationId errors { code }
        } }`, { i: { email: 'should-not-work@x.com', roleName: 'ATTENDANT' } }, {
          Authorization: `Bearer ${proAccess}`,
          'X-Organization-Id': proOrgId,
        });

        // PermissionGuard throws ForbiddenException → GraphQL surfaces as errors
        expect(denyRes.body.errors?.[0]?.extensions?.code ?? denyRes.body.errors?.[0]?.message ?? '').toMatch(/FORBIDDEN/);
      });
    });
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm typecheck && pnpm test:integration -- full-auth-flow</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/email/test-email.adapter.ts` exports `TestEmailAdapter` AND has methods `lastSent`, `findByRecipient`, `extractToken`, `reset`
    - File `apps/backend/src/email/email.module.ts` exports `EMAIL_ADAPTER` token AND uses it as a provider
    - File `apps/backend/src/email/email.service.ts` injects via `@Inject(EMAIL_ADAPTER)` (no longer directly imports `ResendAdapter`)
    - File `apps/backend/test/integration/full-auth-flow.e2e-spec.ts` uses `.overrideProvider(EMAIL_ADAPTER).useClass(TestEmailAdapter)`
    - File `apps/backend/test/integration/setup.ts` afterAll deletes refresh_tokens older than 30 days AND email_verification_tokens older than 24 hours (mitigates TokenService.rotateRefresh O(N) scan growth across CI runs)
    - File `apps/backend/test/integration/full-auth-flow.e2e-spec.ts` exercises ALL of: signup, verifyEmail, login, refreshSession, refresh-reuse-detection, inviteMember, acceptInvitation, logout, professional-cannot-invite
    - Command `pnpm test:integration -- full-auth-flow` exits 0
  </acceptance_criteria>
  <done>
    TestEmailAdapter captures emails in tests. Full auth flow runs in one test suite covering all 6 mutations + RBAC denial. Adapter pattern is now testable end-to-end.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update CI workflow + write operator README + write Phase 1 retrospective summary</name>
  <files>.github/workflows/ci.yml, README.md, apps/backend/README.md, apps/frontend/README.md, .planning/phases/01-foundation/01-PHASE-SUMMARY.md</files>
  <read_first>
    - .github/workflows/ci.yml (existing — extend; do not rewrite from scratch)
    - .planning/phases/01-foundation/01-CONTEXT.md (deferred items + decisions)
    - .planning/phases/01-foundation/01-01-SUMMARY.md through 01-06-SUMMARY.md (artifact inventory)
    - .planning/REQUIREMENTS.md (status updates)
    - .planning/ROADMAP.md (Phase 1 entry)
    - apps/backend/test/integration/full-auth-flow.e2e-spec.ts (created in task 1 — referenced from CI)
  </read_first>
  <action>
    **Update `.github/workflows/ci.yml`** — extend the `tenant-isolation` job to also run rbac/auth/full-auth specs (single integration job runs the full suite for speed; PostgreSQL setup is the slow part):

    Replace the `Run RLS isolation suite` step with a `Run all integration suites` step:
    ```yaml
          - name: Run all integration suites
            working-directory: apps/backend
            run: pnpm test:integration
            env:
              NODE_ENV: test
              DIRECT_URL: postgresql://sgs_migrator:change_me_migrator@localhost:5432/sgs
              DATABASE_URL: postgresql://sgs_app:change_me_app@localhost:6432/sgs?pgbouncer=true&connection_limit=10
              JWT_ACCESS_SECRET: ci_access_secret_at_least_32_chars_long_xxxxx
              JWT_REFRESH_SECRET: ci_refresh_secret_at_least_32_chars_long_xxxxx
              APP_URL: http://localhost:5173
              RESEND_FROM_EMAIL: ci@test.local
    ```

    Rename the job from `tenant-isolation` to `integration` (since it now covers more). Keep the PgBouncer mode check step as-is (still asserting Success Criterion #5).

    Also add a `boot-time` job that asserts Success Criterion #1 (under 5 min from `docker compose up`):
    ```yaml
      boot-time:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: cp .env.example .env
          - name: Time docker compose up
            run: |
              start=$(date +%s)
              docker compose up -d --build
              # Wait for all services healthy, max 300s
              for i in $(seq 1 60); do
                states=$(docker compose ps --format json | jq -r '[.[].Health] | unique | join(",")')
                if [ "$states" = "healthy" ]; then
                  end=$(date +%s)
                  echo "Boot time: $((end - start))s"
                  if [ $((end - start)) -gt 300 ]; then
                    echo "FAIL: boot exceeded 5 minutes (Phase 1 SC #1)"
                    docker compose ps
                    exit 1
                  fi
                  exit 0
                fi
                sleep 5
              done
              echo "FAIL: services did not become healthy"
              docker compose ps
              exit 1
          - name: Tear down
            if: always()
            run: docker compose down -v

      frontend-codegen:
        # D-08: graphql-codegen is the chosen codegen pipeline; this job verifies it runs end-to-end.
        runs-on: ubuntu-latest
        needs: integration   # backend must be reachable to introspect schema
        steps:
          - uses: actions/checkout@v4
          - uses: pnpm/action-setup@v4
            with: { version: 9 }
          - uses: actions/setup-node@v4
            with: { node-version: 22, cache: pnpm }
          - run: cp .env.example .env
          - run: docker compose up -d postgres pgbouncer valkey backend
          - name: Wait for backend health
            run: |
              for i in $(seq 1 60); do
                if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then exit 0; fi
                sleep 5
              done
              docker compose logs backend
              exit 1
          - run: pnpm install --frozen-lockfile
          - name: Generate GraphQL types
            working-directory: apps/frontend
            run: pnpm codegen
            env:
              VITE_API_URL: http://localhost:3000
          - name: Assert generated types exist
            run: test -f apps/frontend/src/types/graphql.ts
          - name: Tear down
            if: always()
            run: docker compose down -v
    ```

    Also add a top-level `codegen` script to `apps/frontend/package.json` (if not already present): `"codegen": "graphql-codegen --config codegen.ts"`. The job above runs this script after spinning up the backend so the schema introspection succeeds.

    **Create/Update `README.md` at repo root:**
    ```markdown
    # SGS — Plataforma de Gestão para Salões

    Sistema SaaS multi-tenant de gestão para salões de beleza, barbearias, clínicas estéticas e estúdios de noivas.

    **Stack:** Node.js 22 + NestJS 10 + GraphQL + Prisma 6 + PostgreSQL 16 + Valkey 8 (Redis-compatible) | React 19 + Vite 6 + Tailwind 3 + shadcn/ui

    ## Quick start (local dev)

    Prerequisites: Docker Desktop, pnpm 9, Node 22.

    ```bash
    pnpm install
    cp .env.example .env
    docker compose up -d --build           # ~3-5 min on first run
    # Apply migrations (one-time)
    docker compose exec backend pnpm prisma migrate deploy
    ```

    Open:
    - Frontend: http://localhost:5173
    - Backend GraphQL: http://localhost:3000/graphql
    - Backend health: http://localhost:3000/health

    Sign up at /signup → check `docker compose logs backend | grep email-fallback` for the verification link → verify → log in.

    ## Architecture

    | Layer | Tech |
    |-------|------|
    | Multi-tenancy | PostgreSQL Row-Level Security with `FORCE ROW LEVEL SECURITY` on every tenant-scoped table |
    | DB pooling | PgBouncer in transaction mode (mandatory for `SET LOCAL app.current_organization` correctness) |
    | DB roles | `sgs_migrator` (BYPASSRLS, migrations only) and `sgs_app` (no BYPASSRLS, application runtime) |
    | Auth | JWT access (15min, HS256) + opaque refresh tokens (30d, Argon2id-hashed, family rotation) |
    | RBAC | 4 roles (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL); permissions defined in code |

    ## Phase 1 Success Criteria — how to verify

    | # | Criterion | How to verify |
    |---|-----------|---------------|
    | 1 | docker compose boots in <5min | CI job `boot-time` enforces; locally: `time docker compose up -d` |
    | 2 | User can sign up + log in + session persists across refresh | Manual: signup → verify → login → hard-refresh browser → still logged in |
    | 3 | PROFESSIONAL gets error on admin-only routes | Automated: CI runs `apps/backend/test/integration/rbac.e2e-spec.ts` |
    | 4 | sgs_app cannot read other-org data | Automated: CI runs `apps/backend/test/integration/rls-isolation.spec.ts` |
    | 5 | PgBouncer in transaction-mode + SET LOCAL no leak | Automated: CI step `Confirm PgBouncer is in transaction mode` + RLS test 7 |

    ## Repo layout

    ```
    apps/
      backend/   NestJS GraphQL API
      frontend/  React 19 + Vite SPA
    docker/      postgres init, pgbouncer config, valkey config
    .planning/   Phase plans, requirements, roadmap (read-only for executors; managed by /gsd commands)
    PRD_*.md     Product requirements (backend, database, frontend) and SDD
    ```

    ## Common commands

    | Task | Command |
    |------|---------|
    | Boot stack | `docker compose up -d` |
    | Stop stack | `docker compose down` |
    | Reset DB (DROP all data) | `docker compose down -v && docker compose up -d` |
    | Apply migrations | `docker compose exec backend pnpm prisma migrate deploy` |
    | Open Prisma Studio | `docker compose exec backend pnpm prisma studio` |
    | Backend logs | `docker compose logs -f backend` |
    | Frontend logs | `docker compose logs -f frontend` |
    | Run integration tests | `cd apps/backend && pnpm test:integration` |
    | Typecheck everything | `pnpm -r typecheck` |
    ```

    **Create `apps/backend/README.md`** — backend-specific dev notes:
    ```markdown
    # @sgs/backend

    NestJS GraphQL API.

    ## Local development

    ```bash
    pnpm dev          # nest start --watch
    pnpm test         # unit tests
    pnpm test:integration  # integration tests (requires postgres + pgbouncer + valkey running via docker compose)
    pnpm prisma:generate
    pnpm prisma:migrate:dev
    ```

    ## Module layout

    See PRD_Backend_Plataforma_Saloes.md §2.2 for bounded context list. Phase 1 modules:

    - `database/` — PrismaService + TenantContextService (the heart of multi-tenant)
    - `auth/` — Signup, login, refresh, JWT, password hashing
    - `authz/` — Permissions catalog, RequirePermission guard, TenantContextInterceptor
    - `email/` — Resend adapter + EmailService (test override via EMAIL_ADAPTER token)
    - `identity/` — Member invitation flow
    - `graphql/` — SDL files + custom scalars

    ## Multi-tenant rules

    1. **Always** use `TenantContextService.runWithTenant(orgId, async (tx) => {...})` for tenant-scoped queries — never bare PrismaService for tenant tables.
    2. **Never** issue raw SQL with `SET app.current_organization` — always `SET LOCAL` inside `$transaction`.
    3. **Never** reuse the `sgs_migrator` role at runtime — only Prisma migrations should hit `DIRECT_URL`.
    4. **Always** add new tenant-scoped tables with `FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy in the migration.
    5. The CI job `integration` enforces these via the RLS isolation suite.

    ## Auth quick reference

    | Mutation | Public? | Permission |
    |----------|---------|-----------|
    | signup | yes | — |
    | verifyEmail | yes | — |
    | resendVerification | yes | — |
    | login | yes | — |
    | refreshSession | yes | — |
    | logout | yes | — |
    | inviteMember | no | member.invite |
    | acceptInvitation | yes | — |
    | revokeInvitation | no | member.invite |

    Add `@Public()` to skip JwtAuthGuard. Add `@RequirePermission(...)` for permission gates.
    ```

    **Create `apps/frontend/README.md`** — frontend-specific dev notes (short):
    ```markdown
    # @sgs/frontend

    React 19 + Vite 6 + Tailwind 3 + shadcn/ui SPA.

    ## Local development

    ```bash
    pnpm dev      # vite dev server :5173
    pnpm build    # production build
    pnpm typecheck
    pnpm lint
    ```

    Set `VITE_API_URL` in `.env` (defaults to http://localhost:3000).

    ## Layout

    - `src/components/ui/` — shadcn primitives (Button, Input, Card, Alert, Form, ...)
    - `src/features/auth/` — Login, Signup, Verify, Invitation pages + components + hooks
    - `src/infrastructure/apollo/` — Apollo Client + auth-link + error-link
    - `src/infrastructure/stores/auth.store.ts` — Zustand auth store (persisted to localStorage)
    - `src/infrastructure/i18n/locales/pt-BR.json` — All copy

    ## Design tokens

    Defined in `tailwind.config.ts` and `src/styles/globals.css`. Source of truth: `.planning/phases/01-foundation/01-UI-SPEC.md`.

    Exactly 4 typography sizes (label/body/heading/display), 7 spacing tokens (xs..3xl), tightly constrained color palette. Do not introduce new sizes/colors without updating UI-SPEC.
    ```

    **Create `.planning/phases/01-foundation/01-PHASE-SUMMARY.md`** — phase retrospective:
    ```markdown
    # Phase 1 Foundation — Summary

    **Completed:** {date will be filled at execution time}
    **Plans executed:** 7 (01-monorepo-docker → 07-ci-integration)
    **Requirements satisfied:** INFRA-01, INFRA-02, INFRA-03, AUTH-01, AUTH-02, AUTH-03

    ## What downstream phases can rely on

    ### Backend interfaces (importable / DI tokens)
    - `PrismaService` — Prisma client singleton (DATABASE_URL, sgs_app, transaction-mode pool)
    - `TenantContextService.runWithTenant(orgId, fn)` — REQUIRED wrapper for tenant-scoped queries
    - `TenantContextService.runWithoutTenant(fn)` — Cross-tenant ops (login lookup, etc.)
    - `AuthService` — signup, login, verifyEmail, resendVerification, refresh, logout, getSession, issueSession (public for invitation flow)
    - `TokenService` — issueAccessToken, verifyAccessToken, issueRefreshToken, rotateRefresh, revokeRefresh
    - `PasswordService` — Argon2id hash + verify
    - `EmailService` — sendVerification, sendInvitation
    - `EMAIL_ADAPTER` token — overridable in tests via TestEmailAdapter
    - `@RequirePermission(...permissions)` decorator + `PermissionGuard` (registered globally)
    - `@RequireRole(...roleNames)` decorator
    - `@CurrentUser()` parameter decorator (yields `JwtAccessPayload`)
    - `@CurrentTenant()` parameter decorator (yields `TenantContext` resolved from JWT + X-Organization-Id header)
    - `@Public()` decorator (opts handler out of JwtAuthGuard)
    - `PERMISSIONS` constant (apps/backend/src/authz/permissions.catalog.ts) — extend in future phases

    ### Database schema (Prisma)
    - Organization, User, Member, Role, RolePermission, RefreshToken, EmailVerificationToken, MemberInvitation, OutboxEvent
    - Standard column conventions: `id` UUIDv7 via `gen_uuid_v7()`, `created_at`/`updated_at` TIMESTAMPTZ with auto-update trigger, `deleted_at` soft-delete TIMESTAMPTZ NULL on member-like entities
    - Money fields will use `NUMERIC(12,2)` per PRD §3.3 (none in Phase 1, precedent set)

    ### Frontend interfaces
    - shadcn primitives at `@/components/ui/*`
    - `useAuthStore` (Zustand, persisted to `sgs-auth` in localStorage); selectors: `selectIsAuthenticated`
    - `apolloClient` at `@/infrastructure/apollo/client` (with auth-link, error-link)
    - `<ProtectedRoute>` wrapper for authenticated routes
    - `<AuthShell>`, `<AuthCard>` layout primitives
    - `useAuth()` hook (`applyAuthPayload`, `logout`)
    - i18n at `@/infrastructure/i18n` with pt-BR locale

    ## Deviations from PRDs (documented choices)

    | PRD reference | Deviation | Rationale |
    |---------------|-----------|-----------|
    | PRD_Backend §1.4 (Node 20) | Used Node 22 LTS | CONTEXT.md D-01: Node 20 enters Maintenance Apr 2026; greenfield should start on current LTS |
    | PRD_Backend (Prisma 5) | Used Prisma 6 | CONTEXT.md D-02 |
    | PRD_Frontend (React 18) | Used React 19 | CONTEXT.md D-03 |
    | PRD_Backend (Redis 7) | Used Valkey 8 | CONTEXT.md D-04: licensing concern with Redis 7.4+ RSALv2/SSPL |
    | PRD_DB §4.1.1 (organizations.plan_id NOT NULL) | Omitted plan_id from organizations | Billing/subscription context deferred to a later phase per ARCHITECTURE.md gap; will add in billing phase |
    | PRD_DB §8.1 (RLS policy on member_invitations) | Relaxed SELECT to `USING (true)` | Token hash IS the secret; allows lookup without tenant context. INSERT/UPDATE/DELETE remain tenant-scoped. Documented in plan-05 SUMMARY |

    ## Known follow-ups (NOT blockers for Phase 2)

    1. **Refresh token lookup_hash column.** Current `TokenService.rotateRefresh` does O(N) Argon2 verify scan; add a sha256 fingerprint column for O(1) lookup. Becomes important at >10k active sessions.
    2. **Apollo error-link auto-refresh.** Phase 1 ships error-link that clears session on 401; production needs auto-rotation by calling refreshSession before clearing. Defer to v2 hardening.
    3. **Audit log entries for invite/accept/revoke.** Audit module is in Phase 5 per ROADMAP.
    4. **Outbox worker.** Schema is in Phase 1 (table + RLS + index); the BullMQ poller worker is in Phase 5 (or earlier when first event-driven feature lands).
    5. **GraphQL persisted queries.** Backend supports introspection in dev; production lockdown is QA work in Phase 5.
    6. **Password recovery flow.** UI link at /recuperar-senha currently routes to NotFound. Per CONTEXT.md `<deferred>` Claude was given discretion; chose to defer to a focused later plan (cheap to add ~1-2 day plan).
    7. **OpenTelemetry distributed tracing.** CLAUDE.md / PRD §10.3 mandate `@opentelemetry/node`. Phase 1 ships pino structured logging; OpenTelemetry instrumentation deferred to Phase 5 QA-04 observability plan (Sentry + Grafana Tempo backend wiring belongs together, not piecemeal in Phase 1).

    ## CI surface

    Workflow: `.github/workflows/ci.yml`. Jobs:
    - `typecheck` — `pnpm -r typecheck`
    - `lint` — `pnpm -r lint --if-present`
    - `boot-time` — Asserts Phase 1 SC #1 (full stack <5 min to healthy)
    - `integration` — Runs ALL integration specs: rls-isolation, auth.e2e, rbac.e2e, invitation.e2e, full-auth-flow

    ## Files of interest for the next phase planner

    Phase 2 (Core Domain — catalog + clients) needs these as first reads:
    - `apps/backend/prisma/schema.prisma` — model conventions
    - `apps/backend/src/database/tenant-context.service.ts` — required usage pattern
    - `apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql` — RLS pattern to copy for new tables
    - `apps/backend/src/authz/permissions.catalog.ts` — extend with catalog/client permissions
    - This summary
    ```
  </action>
  <verify>
    <automated>cd d:/SGS && grep -q "boot-time:" .github/workflows/ci.yml && grep -q "full-auth-flow" .github/workflows/ci.yml && test -f README.md && grep -q "Phase 1 Success Criteria" README.md && test -f .planning/phases/01-foundation/01-PHASE-SUMMARY.md && grep -q "INFRA-01, INFRA-02, INFRA-03, AUTH-01, AUTH-02, AUTH-03" .planning/phases/01-foundation/01-PHASE-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.github/workflows/ci.yml` declares jobs `typecheck`, `lint`, `boot-time`, `integration`, `frontend-codegen`
    - File `.github/workflows/ci.yml` `frontend-codegen` job runs `pnpm codegen` AND asserts `apps/frontend/src/types/graphql.ts` exists (D-08 graphql-codegen pipeline verified end-to-end)
    - File `.github/workflows/ci.yml` integration job runs `pnpm test:integration` (no test name filter — runs ALL specs)
    - File `.github/workflows/ci.yml` boot-time job has a 300-second timeout assertion that fails on `[ $((end - start)) -gt 300 ]`
    - File `README.md` at repo root contains literal strings: `Phase 1 Success Criteria`, `docker compose up -d`, `Quick start`
    - File `apps/backend/README.md` documents the @RequirePermission decorator and the public/private mutation table
    - File `apps/frontend/README.md` references `01-UI-SPEC.md` as the source of truth for design tokens
    - File `.planning/phases/01-foundation/01-PHASE-SUMMARY.md` lists all 6 requirement IDs satisfied AND documents the 6 deviations + 6 follow-ups
  </acceptance_criteria>
  <done>
    CI enforces all 5 Phase 1 success criteria via 4 jobs. Operator README lets a new dev go from clone to running stack in <10 commands. Phase 1 summary captures interfaces, deviations, and follow-ups for downstream planners to read.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify CI green and Phase 1 success criteria all enforced</name>
  <what-built>
    - `.github/workflows/ci.yml` with 4 jobs: typecheck, lint, boot-time, integration
    - `apps/backend/test/integration/full-auth-flow.e2e-spec.ts` — single sequential test exercising every auth mutation + RBAC denial
    - `TestEmailAdapter` enabling deterministic email-token capture in tests
    - Operator README at repo root + per-app READMEs
    - Phase 1 retrospective summary at `.planning/phases/01-foundation/01-PHASE-SUMMARY.md`
  </what-built>
  <how-to-verify>
    1. Push a commit to a branch and observe the GitHub Actions run for this branch (or trigger manually if GitHub remote not yet connected). Confirm:
       - `typecheck` passes
       - `lint` passes (or skipped via `--if-present`)
       - `boot-time` passes (full stack healthy in <300s)
       - `integration` passes (RLS + auth + rbac + invitation + full-auth-flow all green)

    2. If GitHub remote is not configured yet, run the integration suite locally:
       ```bash
       docker compose up -d postgres pgbouncer valkey
       cd apps/backend
       pnpm install
       pnpm prisma migrate deploy
       pnpm test:integration
       ```
       Confirm output ends with `Tests: X passed, X total`.

    3. Verify README quick-start by following it on a fresh clone (or simulate by `git stash` everything not committed and `git clean -fd`, then follow README from step 1):
       ```bash
       pnpm install
       cp .env.example .env
       docker compose up -d --build
       docker compose exec backend pnpm prisma migrate deploy
       open http://localhost:5173
       ```
       Confirm landing page renders within 5 minutes of starting.

    4. Open `.planning/phases/01-foundation/01-PHASE-SUMMARY.md` and confirm:
       - All 6 requirement IDs listed as satisfied
       - "What downstream phases can rely on" lists all the DI-injectable services + decorators
       - "Deviations" table includes the 6 documented deviations
       - "Known follow-ups" lists the 6 deferred items

    5. Manually re-run the Phase 1 success criteria checklist:
       - SC #1: `time docker compose up -d` < 5min ✓
       - SC #2: signup → verify → login → hard-refresh → still on /dashboard ✓
       - SC #3: PROFESSIONAL gets FORBIDDEN on inviteMember ✓
       - SC #4: cross-tenant query returns 0 rows (CI integration job confirms)
       - SC #5: pgbouncer.ini contains `pool_mode = transaction` (CI step confirms)
  </how-to-verify>
  <resume-signal>
    Type "approved" to mark Phase 1 complete and ready for Phase 2 planning. Otherwise describe:
    - Which CI job fails and the error message
    - Which README step fails and what was missing
    - Which success criterion did not hold and how
  </resume-signal>
</task>

</tasks>

<verification>
- CI: 4 jobs, all green
- Integration: RLS + auth + RBAC + invitation + full-auth-flow specs all passing
- README quick-start works on fresh clone
- Phase summary captures all interfaces + deviations + follow-ups
</verification>

<success_criteria>
- All 5 Phase 1 success criteria enforced by CI (1 boot-time, 2 partially via integration tests, 3 by rbac.e2e, 4 by rls-isolation, 5 by pgbouncer mode check)
- Phase 1 retrospective summary published for downstream phase planners
- Repository operator documentation lets new devs onboard in <10 commands
</success_criteria>

<output>
After completion, update `.planning/STATE.md` to mark Phase 1 status as `completed` (the GSD orchestrator handles this; this plan does NOT directly edit STATE.md).
Create the final summary `.planning/phases/01-foundation/01-07-SUMMARY.md` documenting:
- Final CI run URL/commit hash (if remote configured)
- Boot time recorded for the boot-time job
- Total integration test count and pass/fail breakdown
- Any flake observations (intermittent test failures requiring retry)
- Recommendation for Phase 2 planning kickoff
</output>

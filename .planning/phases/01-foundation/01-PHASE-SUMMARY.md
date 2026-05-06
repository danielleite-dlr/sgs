# Phase 1 Foundation — Summary

**Completed:** 2026-05-06
**Plans executed:** 7 (01-monorepo-docker → 07-ci-integration)
**Requirements satisfied:** INFRA-01, INFRA-02, INFRA-03, AUTH-01, AUTH-02, AUTH-03

## What downstream phases can rely on

### Backend interfaces (importable / DI tokens)

| Export | Location | Purpose |
|--------|----------|---------|
| `PrismaService` | `src/database/prisma.service` | Prisma client singleton (DATABASE_URL, sgs_app, transaction-mode pool) |
| `TenantContextService.runWithTenant(orgId, fn)` | `src/database/tenant-context.service` | REQUIRED wrapper for tenant-scoped queries |
| `TenantContextService.runWithoutTenant(fn)` | `src/database/tenant-context.service` | Cross-tenant ops (login lookup, etc.) |
| `AuthService` | `src/auth/auth.service` | signup, login, verifyEmail, resendVerification, refresh, logout, getSession, issueSession |
| `TokenService` | `src/auth/token.service` | issueAccessToken, verifyAccessToken, issueRefreshToken, rotateRefresh, revokeRefresh |
| `PasswordService` | `src/auth/password.service` | Argon2id hash + verify |
| `EmailService` | `src/email/email.service` | sendVerification, sendInvitation |
| `EMAIL_ADAPTER` | `src/email/email.module` | DI token — override in tests with TestEmailAdapter |
| `TestEmailAdapter` | `src/email/test-email.adapter` | In-memory email capture; findByRecipient, extractToken, reset |
| `@RequirePermission(...permissions)` | `src/authz/require-permission.decorator` | Decorator + PermissionGuard (registered globally) |
| `@RequireRole(...roleNames)` | `src/authz/require-role.decorator` | Role-based guard decorator |
| `@CurrentUser()` | `src/auth/decorators/current-user.decorator` | Parameter decorator → `JwtAccessPayload` |
| `@CurrentTenant()` | `src/authz/decorators/current-tenant.decorator` | Parameter decorator → `TenantContext` |
| `@Public()` | `src/auth/decorators/public.decorator` | Opts handler out of JwtAuthGuard |
| `PERMISSIONS` | `src/authz/permissions.catalog` | Extend with new permissions in future phases |

### Database schema (Prisma)

Models: `Organization`, `User`, `Member`, `Role`, `RolePermission`, `RefreshToken`, `EmailVerificationToken`, `MemberInvitation`, `OutboxEvent`

Conventions:
- `id` — UUIDv7 via `gen_uuid_v7()` default
- `created_at` / `updated_at` — TIMESTAMPTZ with auto-update trigger
- `deleted_at` — soft-delete TIMESTAMPTZ NULL on member-like entities
- Money fields — `NUMERIC(12,2)` per PRD §3.3 (none in Phase 1; precedent set)
- Every tenant-scoped table has `FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy

### Frontend interfaces

| Interface | Location | Notes |
|-----------|----------|-------|
| shadcn primitives | `src/components/ui/*` | Button, Input, Card, Alert, Form, Label, ... |
| `useAuthStore` | `src/infrastructure/stores/auth.store.ts` | Zustand; persisted to `sgs-auth` in localStorage |
| `selectIsAuthenticated` | auth store | Selector: returns true when accessToken is non-null |
| `apolloClient` | `src/infrastructure/apollo/client.ts` | With authLink (injects Authorization header) + errorLink |
| `<ProtectedRoute>` | `src/components/ProtectedRoute.tsx` | Redirects to /login when not authenticated |
| `<AuthShell>`, `<AuthCard>` | `src/features/auth/components/` | Layout primitives for auth pages |
| `useAuth()` | `src/features/auth/hooks/useAuth.ts` | `applyAuthPayload`, `logout` |
| `useResendCooldown()` | `src/features/auth/hooks/useResendCooldown.ts` | 60s countdown timer |
| i18n | `src/infrastructure/i18n/` | i18next with pt-BR locale; all copy in `locales/pt-BR.json` |

### CI surface

Workflow: `.github/workflows/ci.yml`. Jobs:

| Job | What it checks |
|-----|----------------|
| `typecheck` | `pnpm -r typecheck` — backend + frontend TypeScript |
| `lint` | `pnpm -r lint --if-present` — ESLint |
| `integration` | Boots postgres + pgbouncer + valkey; runs ALL backend integration specs (rls-isolation, auth.e2e, rbac.e2e, invitation.e2e, full-auth-flow) |
| `boot-time` | Full `docker compose up -d --build`; asserts Phase 1 SC #1 (healthy in <300s) |
| `frontend-codegen` | Runs `pnpm codegen` against live backend; asserts `src/gql/graphql.ts` exists (D-08) |

## Deviations from PRDs (documented choices)

| PRD reference | Deviation | Rationale |
|---------------|-----------|-----------|
| PRD_Backend §1.4 (Node 20) | Used Node 22 LTS | CONTEXT.md D-01: Node 20 enters Maintenance Apr 2026; greenfield should start on current LTS |
| PRD_Backend (Prisma 5) | Used Prisma 6 | CONTEXT.md D-02: native JSON ops, improved TypeScript inference, updated migrations engine |
| PRD_Frontend (React 18) | Used React 19 | CONTEXT.md D-03: Actions API, `use()` hook, improved form integration |
| PRD_Backend (Redis 7) | Used Valkey 8 | CONTEXT.md D-04: licensing concern with Redis 7.4+ RSALv2/SSPL; Valkey is binary-compatible, MIT license |
| PRD_DB §4.1.1 (organizations.plan_id NOT NULL) | Omitted plan_id from organizations | Billing/subscription context deferred to billing phase; will add as migration then |
| PRD_DB §8.1 (RLS policy on member_invitations) | Relaxed SELECT to `USING (true)` | Token hash IS the secret; allows lookup without tenant context. INSERT/UPDATE/DELETE remain tenant-scoped |

## Known follow-ups (NOT blockers for Phase 2)

1. **Refresh token lookup_hash column.** Current `TokenService.rotateRefresh` does O(N) Argon2 verify scan across all active refresh tokens for a user. Add a `sha256_fingerprint` column for O(1) lookup by token fingerprint. Becomes important at >10k active sessions.

2. **Apollo error-link auto-refresh.** Phase 1 ships an error-link that clears session on UNAUTHENTICATED. Production UX needs auto-rotation (silently calls refreshSession before clearing). Defer to a dedicated hardening plan.

3. **Audit log entries for invite/accept/revoke.** `OutboxEvent` table exists but the audit module is in Phase 5 per ROADMAP.

4. **Outbox worker.** Schema is in Phase 1 (table + RLS + index); the BullMQ poller worker belongs with the first event-driven feature (Phase 3 or Phase 5).

5. **GraphQL persisted queries.** Backend supports introspection in dev; production lockdown is a QA-phase task.

6. **Password recovery flow.** `/recuperar-senha` route renders NotFoundPage. A focused plan (~1-2 days) will add this flow in Phase 2 or a dedicated patch plan.

7. **OpenTelemetry distributed tracing.** CLAUDE.md / PRD §10.3 mandate `@opentelemetry/node`. Phase 1 ships pino structured logging. OpenTelemetry + Sentry + Grafana Tempo wiring belongs together in Phase 5 QA-04 observability plan.

## Dev environment known issues (not blocking Phase 2)

1. **Bind mounts on D: drive serve empty directories in Docker Desktop.** Workaround: bind mounts disabled in docker-compose.yml. Fix: enable D: in Docker Desktop File Sharing settings, or move repo to C: drive / WSL2.

2. **PgBouncer scram-sha-256 incompatible with PG16 in transaction pool mode without auth_query.** Workaround: `AUTH_TYPE=trust` on PgBouncer; backend connects direct to postgres. Fix: configure `auth_query` via a `pgbouncer.get_auth` SECURITY DEFINER function.

3. **sgs_app role temporarily granted BYPASSRLS for dev.** Signup creates org without tenant context. Fix: SECURITY DEFINER function for org-creation to avoid needing BYPASSRLS at runtime.

4. **RESEND_API_KEY not set.** Email delivery falls back to console logging. Fix for production: set `RESEND_API_KEY` in `.env.production`.

5. **Postgres init scripts didn't run on first boot (bind mount issue).** Roles were created manually. Fix: bind mount issue above; or roles can be created via a Dockerfile `RUN` step.

## Files of interest for the next phase planner

Phase 2 (Core Domain — catalog + clients) needs these as first reads:

- `apps/backend/prisma/schema.prisma` — model conventions (UUIDv7, timestamps, RLS, soft-delete)
- `apps/backend/src/database/tenant-context.service.ts` — required usage pattern for all tenant-scoped data access
- `apps/backend/prisma/migrations/20260502000000_init_identity_and_rls/migration.sql` — RLS policy pattern to copy for new tables
- `apps/backend/src/authz/permissions.catalog.ts` — extend with catalog/client permissions
- This summary (Phase 1 interface inventory)
- `.planning/phases/01-foundation/01-CONTEXT.md` — deferred items list

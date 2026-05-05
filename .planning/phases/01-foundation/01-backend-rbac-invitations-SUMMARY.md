---
phase: 01-foundation
plan: 05
subsystem: authz
tags: [rbac, permissions, invitation, graphql, nestjs, rls, jwt]

# Dependency graph
requires:
  - phase: 01-foundation/04-backend-auth-core
    provides: AuthService (issueSession refactored to public), TokenService, PasswordService, JwtAuthGuard (global APP_GUARD), JwtAccessPayload (memberships[]), @Public() decorator, @CurrentUser() decorator, EmailService.sendInvitation
  - phase: 01-foundation/02-database-rls
    provides: PrismaService, TenantContextService, Role/RolePermission/Member/MemberInvitation models, seeded system roles, RLS policies
provides:
  - AuthzModule (global): TenantContextInterceptor (APP_INTERCEPTOR) + PermissionGuard (APP_GUARD)
  - permissions.catalog.ts: PERMISSIONS constant + ROLE_PERMISSIONS map (canonical source of truth)
  - @RequirePermission(...permissions) decorator
  - @RequireRole(...roleNames) decorator
  - @CurrentTenant() param decorator (TenantContext: organizationId, memberId, roleName)
  - InvitationService: invite() + accept() flows
  - InvitationResolver: inviteMember, acceptInvitation, revokeInvitation, pendingInvitations mutations/queries
  - identity.graphql SDL
  - seed migration 20260502010000: 4 system roles × permission rows + relaxed SELECT on member_invitations
  - rbac.e2e-spec.ts (Phase 1 Success Criterion #3 proven)
  - invitation.e2e-spec.ts (D-15 full acceptance + error state coverage)
affects: [01-frontend-auth-pages, 01-ci-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - APP_INTERCEPTOR (TenantContextInterceptor) runs before APP_GUARD (PermissionGuard) — order matters for ctx.tenant population
    - Permission check defers to DB (role_permissions table) not JWT payload — permissions are authoritative in DB, not embedded in token
    - Relaxed SELECT policy on member_invitations: USING(true) with WHERE token_hash = ? application enforcement
    - crypto bare import ('crypto' not 'node:crypto') — project ESLint convention (inherited from plan 04)

key-files:
  created:
    - apps/backend/src/authz/permissions.catalog.ts (PERMISSIONS const, ROLE_PERMISSIONS map)
    - apps/backend/src/authz/decorators/require-permission.decorator.ts (@RequirePermission)
    - apps/backend/src/authz/decorators/require-role.decorator.ts (@RequireRole)
    - apps/backend/src/authz/decorators/current-tenant.decorator.ts (@CurrentTenant, TenantContext interface)
    - apps/backend/src/authz/tenant-context.middleware.ts (TenantContextInterceptor)
    - apps/backend/src/authz/guards/permission.guard.ts (PermissionGuard)
    - apps/backend/src/authz/authz.module.ts (AuthzModule — @Global, wires interceptor + guard)
    - apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql (seed + RLS policy split)
    - apps/backend/src/identity/invitation.service.ts (InvitationService)
    - apps/backend/src/identity/invitation.resolver.ts (InvitationResolver)
    - apps/backend/src/identity/identity.module.ts (IdentityModule)
    - apps/backend/src/identity/dto/invite-member.input.ts
    - apps/backend/src/identity/dto/accept-invitation.input.ts
    - apps/backend/src/graphql/schema/identity.graphql
    - apps/backend/test/integration/rbac.e2e-spec.ts
    - apps/backend/test/integration/invitation.e2e-spec.ts
  modified:
    - apps/backend/src/auth/auth.service.ts (issueSession: private → public)
    - apps/backend/src/app.module.ts (added AuthzModule + IdentityModule imports)

key-decisions:
  - "Permission check queries role_permissions table via Prisma (not JWT payload) — permissions are authoritative in DB, JWT only carries roleName"
  - "TenantContextInterceptor defaults to first membership when X-Organization-Id header absent — Phase 1 single-org users are the common case"
  - "Relaxed SELECT USING(true) on member_invitations: token_hash is the secret; application always queries by hash equality, never enumerates; INSERT/UPDATE/DELETE remain tenant-scoped via tenant_isolation_modify"
  - "InvitationService.accept uses raw $queryRaw to find invitation by token hash cross-tenant — invitee does not know the org ID, only the token"
  - "AuthService.issueSession refactored from private to public — required for InvitationService.accept to issue a session without duplicating token-issuing logic"
  - "IdentityModule imports AuthModule to get AuthService + PasswordService — clean module dependency, no circular reference"

requirements-completed: [AUTH-03]

# Metrics
duration: 68min
completed: 2026-05-05
---

# Phase 01 Plan 05: Backend RBAC + Invitations Summary

**RBAC permission catalog (7 permissions, 4 system roles), TenantContextInterceptor + PermissionGuard guards, and member invitation flow (invite-by-email → accept-and-login) with e2e tests proving Phase 1 Success Criterion #3**

## Performance

- **Duration:** ~68 min
- **Started:** 2026-05-05T17:32:55Z
- **Completed:** 2026-05-05T18:40:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 15 created, 2 modified

## Accomplishments

- Full RBAC technical layer: permissions catalog defines 7 strings for Phase 1 (organization.read/update, member.read/invite/remove/editRole, role.read); mapped to 4 system roles (ADMIN: 7, MANAGER: 4, ATTENDANT: 2, PROFESSIONAL: 2)
- TenantContextInterceptor resolves active org from JWT + X-Organization-Id header, throws TENANT_MISMATCH if header org is not in JWT memberships
- PermissionGuard reads required permissions from resolver metadata (via @RequirePermission decorator), queries role_permissions table, throws ForbiddenException with missing permission list
- Member invitation flow: invite() creates SHA-256 hashed token stored in DB, sends plaintext to invitee via email (token never returned in API response); accept() does a cross-tenant token lookup using raw query (RLS SELECT relaxed to USING(true) in seed migration), then creates User + Member + consumes token atomically in a tenant-scoped transaction, then issues a full auth session
- Phase 1 Success Criterion #3 proven by automated e2e test: PROFESSIONAL role → FORBIDDEN on inviteMember mutation

## Permission Catalog

| Permission | ADMIN | MANAGER | ATTENDANT | PROFESSIONAL |
|------------|:-----:|:-------:|:---------:|:------------:|
| organization.read | X | X | X | X |
| organization.update | X | | | |
| member.read | X | X | X | X |
| member.invite | X | X | | |
| member.remove | X | | | |
| member.editRole | X | | | |
| role.read | X | X | | |

## Decorator API

```typescript
// Require specific permissions (resolver-level):
@RequirePermission(PERMISSIONS.MEMBER_INVITE)
// Require specific role (escape hatch — prefer permissions):
@RequireRole('ADMIN')
// Access active tenant in resolver:
@CurrentTenant() tenant: TenantContext
// tenant.organizationId, tenant.memberId, tenant.roleName
```

## TENANT_MISMATCH Semantics

TenantContextInterceptor runs as APP_INTERCEPTOR (before guards). If `X-Organization-Id` header is provided but the org ID is NOT in the JWT's `memberships[].organizationId` array, it throws immediately with message `TENANT_MISMATCH: requested organization not in user memberships` and `extensions.code = 'FORBIDDEN'`. If the header is absent, it defaults to `memberships[0]` (Phase 1 single-org assumption).

## Relaxed SELECT on member_invitations

**Why:** acceptInvitation is a @Public() mutation — the invitee does not know the organization ID, only the token. A standard RLS query (`USING organization_id = current_org`) cannot work without setting the tenant context first, which requires knowing the org. The token IS the secret (SHA-256 of a 48-byte random value = 384 bits of entropy).

**What changed:** The initial migration's `tenant_isolation` policy (strict USING) was dropped and replaced with two policies:
- `tenant_isolation_select`: `USING (true)` — SELECT is unrestricted; application enforces `WHERE token_hash = $hash` (exact equality, never enumeration)
- `tenant_isolation_modify`: `FOR ALL USING (...current_org...)` — INSERT/UPDATE/DELETE remain fully tenant-scoped

**Security argument:** The token hash is computationally infeasible to brute-force. The application never executes `SELECT * FROM member_invitations` without a `WHERE token_hash = ?` clause. Once an invitation is accepted, `accepted_at` is set — a second accept attempt returns INVITATION_USED before any state mutation occurs.

## AuthService.issueSession — Private to Public

- **Before:** `private async issueSession(...)`
- **After:** `async issueSession(...)` (no access modifier = public in TypeScript classes)
- **Callers:** AuthService.login (internal), InvitationService.accept (cross-module via DI)
- **Contract unchanged:** still returns `AuthPayloadDto` with accessToken, refreshToken, session, errors

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Permissions catalog, AuthzModule, seed migration | `396e093` |
| 2 | InvitationService + Resolver, e2e tests | `de2011b` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added TENANT_MISMATCH test to rbac.e2e-spec.ts**
- **Found during:** Task 2 (writing rbac.e2e-spec.ts)
- **Issue:** Plan behavior spec listed 3 TenantContextMiddleware tests but the rbac.e2e-spec template only had 2 tests. The TENANT_MISMATCH e2e case was in the spec but missing from the template.
- **Fix:** Added a third test case verifying that X-Organization-Id set to a fake org returns TENANT_MISMATCH/FORBIDDEN error.
- **Files modified:** apps/backend/test/integration/rbac.e2e-spec.ts
- **Committed in:** de2011b

**2. [Rule 2 - Missing functionality] Added TOKEN_INVALID and INVITATION_USED test cases to invitation.e2e-spec.ts**
- **Found during:** Task 2 (writing invitation.e2e-spec.ts)
- **Issue:** Plan template had 2 tests; the behavior spec listed 4 error states for accept(). Added the missing TOKEN_INVALID (garbage token) and INVITATION_USED (already-accepted token) tests.
- **Fix:** Added 2 additional test cases.
- **Files modified:** apps/backend/test/integration/invitation.e2e-spec.ts
- **Committed in:** de2011b

**3. [Rule 1 - Bug] Used nullif() form for RLS policy USING clause in migration**
- **Found during:** Task 1 (writing seed migration)
- **Issue:** Plan template used `current_setting(...)::uuid` directly in tenant_isolation_modify; the init migration uses `nullif(current_setting(...), '')::uuid` to handle PgBouncer empty-string edge case on RESET.
- **Fix:** Applied the same nullif() pattern to `tenant_isolation_modify` policy for consistency with the codebase convention.
- **Files modified:** apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql
- **Committed in:** 396e093

**4. [Rule 1 - Bug] Removed ConfigService from InvitationService constructor**
- **Found during:** Task 2 (writing invitation.service.ts)
- **Issue:** Plan template had `private readonly config: ConfigService<Env, true>` in InvitationService but `config` was never used in the service body — EmailService handles URL construction internally.
- **Fix:** Removed ConfigService dependency to avoid unnecessary coupling and DI injection overhead.
- **Files modified:** apps/backend/src/identity/invitation.service.ts
- **Committed in:** de2011b

## Known Stubs

None — all code wired with real data sources.

## Known Follow-ups

1. **Audit log for invite/accept/revoke** — deferred to Phase 5 audit module (no `audit_events` table in Phase 1 schema)
2. **UI for role management** — deferred per D-13 (Phase 1 is technical layer only; role assignment UI comes in a later phase)
3. **Permission caching** — PermissionGuard currently queries `role_permissions` table per request. In Phase 2+, add a short-TTL in-memory cache (e.g., 60s) per role name to reduce DB load for high-traffic resolvers.
4. **InviteMember rate limiting** — no rate limit on inviteMember in Phase 1; add in Phase 3 when abuse protection is added across the board.

## Self-Check: PASSED

- FOUND: apps/backend/src/authz/permissions.catalog.ts
- FOUND: apps/backend/src/authz/decorators/require-permission.decorator.ts
- FOUND: apps/backend/src/authz/decorators/require-role.decorator.ts
- FOUND: apps/backend/src/authz/decorators/current-tenant.decorator.ts
- FOUND: apps/backend/src/authz/tenant-context.middleware.ts
- FOUND: apps/backend/src/authz/guards/permission.guard.ts
- FOUND: apps/backend/src/authz/authz.module.ts
- FOUND: apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql
- FOUND: apps/backend/src/identity/invitation.service.ts
- FOUND: apps/backend/src/identity/invitation.resolver.ts
- FOUND: apps/backend/src/identity/identity.module.ts
- FOUND: apps/backend/src/graphql/schema/identity.graphql
- FOUND: apps/backend/test/integration/rbac.e2e-spec.ts
- FOUND: apps/backend/test/integration/invitation.e2e-spec.ts
- FOUND commit: 396e093 (Task 1)
- FOUND commit: de2011b (Task 2)

---
*Phase: 01-foundation*
*Completed: 2026-05-05*

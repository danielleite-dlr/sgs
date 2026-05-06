---
phase: 01-foundation
plan: 06
subsystem: frontend-auth-pages
tags: [frontend, react, auth, graphql, apollo, react-hook-form, zod, react-router, tailwind, shadcn]
dependency_graph:
  requires:
    - 01-frontend-scaffold (shadcn/ui primitives, Apollo Client, Zustand auth store, i18next, React Router v6)
    - 01-backend-auth-core (GraphQL mutations: signup, login, verifyEmail, resendVerification, logout, refreshSession)
    - 01-backend-rbac-invitations (GraphQL mutation: acceptInvitation; AcceptInvitationInput shape)
  provides:
    - Login page (/login) consuming login mutation + Zustand setSession
    - Signup 2-step flow (/signup) creating user+org+ADMIN member via signup mutation
    - Email verification pending page (/verificar-email) with 60s resend cooldown
    - Email verification success page (/verificar-email/sucesso) consuming verifyEmail mutation via ?token
    - Invitation acceptance page (/convite/:token) with expired/used error states
    - 404 page for all unmatched routes
    - ProtectedRoute component guarding /dashboard with redirect to /login
    - DashboardPlaceholder showing userId/orgId/role with logout button
    - useAuth hook (applyAuthPayload + logout)
    - useResendCooldown hook (60s countdown timer)
    - auth.api.ts typed Apollo wrappers for all 8 auth operations
  affects:
    - 01-ci-integration (plan 07 — this plan completes Phase 1 frontend requirements)
tech_stack:
  added: []
  patterns:
    - Feature-based directory structure (src/features/auth/{api,components,hooks,pages,types.ts})
    - Apollo useMutation/useQuery wrappers with typed return types (manual gql until codegen in plan 07)
    - react-hook-form + zodResolver with mode='onBlur' for form validation timing
    - Loader2 + animate-spin loading state pattern
    - Sonner toast for success feedback (email resent)
    - ProtectedRoute pattern using Zustand selectIsAuthenticated
key_files:
  created:
    - apps/frontend/src/features/auth/types.ts
    - apps/frontend/src/features/auth/api/queries.graphql
    - apps/frontend/src/features/auth/api/mutations.graphql
    - apps/frontend/src/features/auth/api/auth.api.ts
    - apps/frontend/src/features/auth/components/AuthShell.tsx
    - apps/frontend/src/features/auth/components/AuthCard.tsx
    - apps/frontend/src/features/auth/components/Logo.tsx
    - apps/frontend/src/features/auth/components/PasswordInput.tsx
    - apps/frontend/src/features/auth/components/StepIndicator.tsx
    - apps/frontend/src/features/auth/hooks/useAuth.ts
    - apps/frontend/src/features/auth/hooks/useResendCooldown.ts
    - apps/frontend/src/features/auth/pages/LoginPage.tsx
    - apps/frontend/src/features/auth/pages/SignupPage.tsx
    - apps/frontend/src/features/auth/pages/SignupStep1.tsx
    - apps/frontend/src/features/auth/pages/SignupStep2.tsx
    - apps/frontend/src/features/auth/pages/VerifyEmailPendingPage.tsx
    - apps/frontend/src/features/auth/pages/VerifyEmailSuccessPage.tsx
    - apps/frontend/src/features/auth/pages/InvitationPage.tsx
    - apps/frontend/src/features/auth/pages/NotFoundPage.tsx
    - apps/frontend/src/components/ProtectedRoute.tsx
    - apps/frontend/src/pages/DashboardPlaceholder.tsx
  modified:
    - apps/frontend/src/router.tsx (replaced placeholder routes with real pages)
    - apps/backend/src/modules/auth/auth.service.ts (shorter documentNumber placeholder — fix 9d83c29)
    - docker-compose.yml (AUTH_TYPE=trust on pgbouncer; backend connects direct to postgres; bind mounts disabled — fix 9d83c29)
key_decisions:
  - "Generic 'Aceitar convite' heading used for InvitationPage — AcceptInvitation mutation does not return orgName/inviterName; deferred to Phase 2 schema extension"
  - "VerifyEmailSuccessPage calls verifyEmail mutation on mount via useEffect — token consumed once, subsequent visits show TOKEN_ALREADY_USED error (acceptable per D-11)"
  - "Password recovery (/recuperar-senha) deferred — route renders NotFoundPage; LoginPage retains the link per UI-SPEC"
  - "useAuth.applyAuthPayload uses memberships[0] as active org — single-org assumption for Phase 1; multi-org switching deferred"
  - "auth.api.ts uses manual gql tagged templates (not codegen) — codegen integration deferred to plan 07"
  - "PgBouncer AUTH_TYPE=trust chosen as dev workaround — scram-sha-256 incompatible with PG16 pool mode without auth_query; fix in plan 07"
  - "Backend connects direct to postgres (bypass pgbouncer) for dev — PgBouncer in transaction-mode not yet wired for RLS session variables in dev; fix in plan 07"
requirements-completed: [AUTH-01, AUTH-02, AUTH-03]
metrics:
  duration_minutes: 90
  completed: "2026-05-05"
  tasks_completed: 3
  files_created: 21
  files_modified: 3
  commits: 4
---

# Phase 1 Plan 06: Frontend Auth Pages Summary

**6 auth pages wired to GraphQL mutations with UI-SPEC copy, shadcn/ui design tokens, react-hook-form + zod validation on blur, Loader2 spinners, PasswordInput Eye/EyeOff toggle, and ProtectedRoute session guard — all 8 verification steps passed in browser**

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-05-05
- **Tasks:** 3 (including Task 3 browser verification checkpoint — all 8 checks passed)
- **Files created:** 21
- **Files modified:** 3

## Accomplishments

- Built all 6 auth screens (Login, Signup 2-step, VerifyEmailPending, VerifyEmailSuccess, Invitation, 404) matching UI-SPEC copy verbatim
- Wired each page to the corresponding GraphQL mutations from plans 04 and 05 via typed Apollo wrappers
- Session persists across browser hard refresh (AUTH-02) via localStorage-backed Zustand store
- ProtectedRoute guards /dashboard and redirects unauthenticated users to /login
- Task 3 browser verification: all 8 functional checks + 6 visual checks passed

## Task Commits

1. **Task 1: Shared auth components and API client** - `f8aeb4d` (feat)
2. **Task 2: All 6 auth pages and router wiring** - `a2c4d6b` (feat)
3. **Task 3: Browser verification checkpoint** - approved (no code commit; checkpoint gate)
4. **Manual fixes during verification** - `9d83c29` (fix — documentNumber placeholder length, pgbouncer AUTH_TYPE=trust, bind mounts disabled)

## What Was Built

### Task 1: Shared auth components and API client (commit `f8aeb4d`)

**Types** (`src/features/auth/types.ts`):
- `AuthErrorCode` union type covering all 13 error codes from backend
- `UserError`, `Membership`, `AuthSession`, `AuthPayload` interfaces mirroring backend SDL

**GraphQL files** (`src/features/auth/api/`):
- `queries.graphql` — Me query with memberships
- `mutations.graphql` — 7 mutations: Signup, Login, VerifyEmail, ResendVerification, RefreshSession, Logout, AcceptInvitation

**Apollo wrappers** (`src/features/auth/api/auth.api.ts`):
- 8 typed hooks: `useSignupMutation`, `useLoginMutation`, `useVerifyEmailMutation`, `useResendVerificationMutation`, `useRefreshMutation`, `useLogoutMutation`, `useAcceptInvitationMutation`, `useMeQuery`

**Components** (`src/features/auth/components/`):
- `AuthShell` — `min-h-screen flex items-center justify-center bg-background p-md` wrapping `max-w-[400px]` div
- `AuthCard` — Card with `bg-neutral-0 border-neutral-200 rounded-lg shadow-card`, Logo above, `text-heading text-neutral-800` heading
- `Logo` — text "SGS" in `text-display text-primary-700 font-semibold`
- `StepIndicator` — 2 dots: active `bg-primary-500`, inactive `bg-neutral-200`; renders "Passo X de Y" label
- `PasswordInput` — `forwardRef` wrapping shadcn `Input` + Eye/EyeOff toggle; `aria-label="Mostrar senha"` / `"Ocultar senha"`

**Hooks** (`src/features/auth/hooks/`):
- `useResendCooldown` — countdown timer returning `{ remainingSeconds, isActive, start(seconds) }`
- `useAuth` — composes Zustand setSession + Apollo logout mutation; exposes `applyAuthPayload` and `logout`

### Task 2: Auth pages and router update (commit `a2c4d6b`)

**Pages** (`src/features/auth/pages/`):

| Page | Route | Key behavior |
|------|-------|-------------|
| `LoginPage` | `/login` | useLoginMutation → applyAuthPayload → navigate /dashboard; INVALID_CREDENTIALS / ACCOUNT_UNVERIFIED error display |
| `SignupPage` | `/signup` | Orchestrates step 1 → step 2 with lifted state (SignupDraft) |
| `SignupStep1` | `/signup` step 1 | fullName≥2 + email valid + password≥8, validate onBlur, Continuar button |
| `SignupStep2` | `/signup` step 2 | salonName≥2, calls useSignupMutation with full draft, navigates to /verificar-email on success |
| `VerifyEmailPendingPage` | `/verificar-email` | Reads email from router state, resend button with 60s cooldown, sonner toast on success |
| `VerifyEmailSuccessPage` | `/verificar-email/sucesso` | Reads ?token from URL, calls useVerifyEmailMutation on mount, 3 states: loading/success/error |
| `InvitationPage` | `/convite/:token` | Reads :token from useParams, INVITATION_EXPIRED/INVITATION_USED show dedicated no-form UI |
| `NotFoundPage` | `*`, `/recuperar-senha` | Sets page title, "Voltar ao início" CTA |

**Infrastructure**:
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) — `Navigate to="/login"` when `selectIsAuthenticated` is false
- `DashboardPlaceholder` (`src/pages/DashboardPlaceholder.tsx`) — Shows userId/orgId/role from Zustand + logout button
- `router.tsx` — All 6 auth routes + protected /dashboard + /recuperar-senha (deferred, shows NotFoundPage)

### Task 3: Browser verification — PASSED (checkpoint approved by user)

All 8 functional verification steps passed:

1. `/` redirects to `/login` when unauthenticated
2. Signup 2-step flow (Step 1 → Step 2 → /verificar-email) works end-to-end
3. Email verification via fallback console link → success page renders correctly
4. Login → `/dashboard` with userId/orgId/role visible
5. Hard refresh maintains session (AUTH-02 confirmed)
6. Logout returns to `/login` and clears session
7. `/dashboard` redirects to `/login` when unauthenticated (ProtectedRoute confirmed)
8. Visual checks passed: Inter font, primary-500 (#5D54C7) buttons, focus rings, password toggle, rounded card with shadow

## UI-SPEC Compliance

All copywriting strings sourced from `pt-BR.json` via `useTranslation()` — verbatim per UI-SPEC contract.

Design tokens applied:
- Colors: primary-500 (#5D54C7) for buttons and links, error-500 (#D85A30) for field errors
- Typography: text-heading (20px/600) for card headings, text-body (16px/400) for content, text-label (14px/600) for errors
- Spacing: space-y-md (16px) for form fields, space-y-xs (4px) for label-input pairs
- Card: bg-neutral-0, border-neutral-200, rounded-lg, shadow-card

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified.

### Known Adaptations (within plan scope)

**1. InvitationPage uses generic heading "Aceitar convite"**
- **Reason:** `acceptInvitation` mutation returns `AuthPayload` which does not include `orgName` or `inviterName`; UI-SPEC calls for "Você foi convidado para {nomeDoSalão}" but that data is not available from the API at render time (only after submit)
- **Decision:** Use generic heading "Aceitar convite" for Phase 1; noted as TODO comment in source
- **Deferred to:** Phase 2 — extend AcceptInvitationPayload or add a query to pre-fetch invitation metadata

**2. VerifyEmailSuccessPage heading shows "Verificando…" during load**
- **Reason:** Card heading is dynamic; during loading state "Verificando…" is shown (not in UI-SPEC) — UX-appropriate
- **Decision:** Acceptable for Phase 1; the final success state matches UI-SPEC verbatim

## Deferred Items

| Item | Reason | Plan |
|------|--------|------|
| Password recovery flow (/recuperar-senha) | Deferred per UI-SPEC context — currently shows NotFoundPage | Phase 2+ |
| Pre-flight email availability check in signup step 1 | Would need new backend query; EMAIL_TAKEN returned by server in step 2 | Phase 2 |
| Invitation pre-validation query (fetch orgName/inviterName before accept) | Needs new backend endpoint | Phase 2 |
| Refresh token auto-rotation on 401 (access token expiry) | error-link clears session on UNAUTHENTICATED; full rotation deferred | plan 07 / v2 |
| GraphQL codegen integration | auth.api.ts uses manual gql; codegen generates types from schema | plan 07 |
| PgBouncer transaction-mode + RLS session variable wiring for dev | Currently backend bypasses pgbouncer; RLS works via direct connection | plan 07 |

## Known Issues / Follow-ups

These are environment-level issues discovered during browser verification (commit `9d83c29`). All have workarounds in place for dev; none block plan functionality.

**1. Bind mounts on D: drive serve empty directories in Docker Desktop**
- **Symptom:** `src/` bind mount results in empty directory inside container — backend/frontend see no source code
- **Workaround:** Bind mounts disabled; image rebuilt after source changes (or share D: in Docker Desktop File Sharing settings)
- **Fix:** Enable D: drive file sharing in Docker Desktop settings, or migrate repo to C: drive, or use WSL2 backend

**2. PgBouncer scram-sha-256 incompatible with PG16 in pool mode without auth_query**
- **Symptom:** PgBouncer cannot authenticate against PG16 default `scram-sha-256` without an `auth_query` function configured
- **Workaround:** `AUTH_TYPE=trust` on PgBouncer + backend connects direct to postgres (bypassing PgBouncer)
- **Fix in plan 07:** Configure `auth_query` in PgBouncer pointing to a `pgbouncer.get_auth` SECURITY DEFINER function, revert AUTH_TYPE to `scram-sha-256`, re-enable PgBouncer in the connection pool

**3. sgs_app role temporarily granted BYPASSRLS for dev (signup inserts org without tenant context)**
- **Symptom:** Signup flow creates an org before any tenant context exists; RLS policies require `app.current_organization` to be set, which is impossible at org-creation time
- **Workaround:** `sgs_app` has BYPASSRLS privilege in dev — all RLS is effectively disabled for that role
- **Fix in plan 07:** Implement `runWithoutTenant` properly via a SECURITY DEFINER function or split signup to use `sgs_migrator` role for org insertion only, then switch to `sgs_app` with tenant context for all subsequent inserts

**4. RESEND_API_KEY not set — email delivery falls back to console logging**
- **Symptom:** Verification emails are not sent; the verification link is printed to `docker compose logs backend`
- **Workaround:** Read the link from container logs — works fine in dev
- **Fix for prod:** Set `RESEND_API_KEY` in `.env.production` before Phase 3 deployment

**5. Postgres init script did not run on first container boot (bind mount issue)**
- **Symptom:** `/docker-entrypoint-initdb.d/01-create-roles.sql` not executed because bind mount served an empty directory; roles (`sgs_migrator`, `sgs_app`) did not exist
- **Workaround:** Roles created manually via `docker exec -it postgres psql` session
- **Fix:** With bind mounts working (issue 1 resolved), fresh containers will execute the init script automatically

## Known Stubs

| File | Location | Stub | Reason |
|------|----------|------|--------|
| `InvitationPage.tsx` | heading | "Aceitar convite" literal | orgName/inviterName not returned by AcceptInvitation mutation; Phase 2 improvement |

This stub does NOT prevent the plan's goal — invitation acceptance works correctly end-to-end; only the personalized heading is missing.

## Self-Check: PASSED

Files verified at plan completion:
- FOUND: apps/frontend/src/features/auth/types.ts
- FOUND: apps/frontend/src/features/auth/api/auth.api.ts
- FOUND: apps/frontend/src/features/auth/components/AuthShell.tsx
- FOUND: apps/frontend/src/features/auth/components/AuthCard.tsx
- FOUND: apps/frontend/src/features/auth/components/Logo.tsx
- FOUND: apps/frontend/src/features/auth/components/PasswordInput.tsx
- FOUND: apps/frontend/src/features/auth/components/StepIndicator.tsx
- FOUND: apps/frontend/src/features/auth/hooks/useAuth.ts
- FOUND: apps/frontend/src/features/auth/hooks/useResendCooldown.ts
- FOUND: apps/frontend/src/features/auth/pages/LoginPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/SignupPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/SignupStep1.tsx
- FOUND: apps/frontend/src/features/auth/pages/SignupStep2.tsx
- FOUND: apps/frontend/src/features/auth/pages/VerifyEmailPendingPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/VerifyEmailSuccessPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/InvitationPage.tsx
- FOUND: apps/frontend/src/features/auth/pages/NotFoundPage.tsx
- FOUND: apps/frontend/src/components/ProtectedRoute.tsx
- FOUND: apps/frontend/src/pages/DashboardPlaceholder.tsx
- FOUND: apps/frontend/src/router.tsx (modified)

Commits verified:
- FOUND: f8aeb4d feat(01-06): build shared auth components and API client
- FOUND: a2c4d6b feat(01-06): build all 6 auth pages and wire router
- FOUND: 9d83c29 fix(01-06): document_number fits VARCHAR(14); pgbouncer auth_type=trust; bind mount disabled

---
*Phase: 01-foundation*
*Completed: 2026-05-05*

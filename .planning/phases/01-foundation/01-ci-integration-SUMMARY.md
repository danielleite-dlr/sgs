---
phase: 01-foundation
plan: 07
subsystem: ci-integration
tags: [ci, testing, email, nestjs, github-actions, readme, documentation]
dependency_graph:
  requires:
    - 01-backend-auth-core (AuthService, EmailService, email verification flow)
    - 01-database-rls (rls-isolation.spec.ts integration suite)
    - 01-backend-rbac-invitations (rbac.e2e-spec.ts, invitation.e2e-spec.ts)
    - 01-frontend-auth-pages (all Phase 1 frontend complete)
  provides:
    - TestEmailAdapter (in-memory email capture via EMAIL_ADAPTER DI token)
    - full-auth-flow.e2e-spec.ts (comprehensive 10-step auth lifecycle test)
    - Updated CI with integration, boot-time, frontend-codegen jobs
    - Operator README at repo root + per-app READMEs
    - Phase 1 retrospective summary (01-PHASE-SUMMARY.md)
  affects:
    - All downstream phases (CI enforces Phase 1 success criteria automatically)
tech_stack:
  added: []
  patterns:
    - EMAIL_ADAPTER Symbol DI token for swappable email adapters (production vs test)
    - TestEmailAdapter in-memory capture with extractToken for URL-based token parsing
    - NestJS .overrideProvider(TOKEN).useClass(Impl) pattern for integration test DI overrides
    - afterAll token cleanup to prevent O(N) Argon2 scan growth across CI runs
key_files:
  created:
    - apps/backend/src/email/test-email.adapter.ts
    - apps/backend/test/integration/full-auth-flow.e2e-spec.ts
    - README.md
    - apps/backend/README.md
    - apps/frontend/README.md
    - .planning/phases/01-foundation/01-PHASE-SUMMARY.md
  modified:
    - apps/backend/src/email/email.module.ts (EMAIL_ADAPTER token, useExisting: ResendAdapter)
    - apps/backend/src/email/email.service.ts (@Inject(EMAIL_ADAPTER) instead of ResendAdapter)
    - apps/backend/src/email/resend.adapter.ts (added EmailAdapter interface, ResendAdapter implements it)
    - apps/backend/test/integration/setup.ts (afterAll refresh_token + email_verification_token cleanup)
    - .github/workflows/ci.yml (renamed integration job, added boot-time + frontend-codegen jobs)
key_decisions:
  - "EMAIL_ADAPTER Symbol token (not string) for type-safe DI override in NestJS test modules"
  - "full-auth-flow sequential test relogins after TOKEN_REUSE_DETECTED family revocation — the family revoke makes the new token from step 5 also invalid"
  - "frontend-codegen CI job asserts apps/frontend/src/gql/graphql.ts (codegen.ts output dir is src/gql/, not src/types/)"
  - "boot-time CI job uses running+healthy heuristic (not all-healthy) to handle pgbouncer missing healthcheck"
  - "Phase 1 PHASE-SUMMARY documents 7 follow-ups, 6 deviations, 5 dev env issues for downstream planners"
metrics:
  duration_minutes: 45
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_at_checkpoint: 1
  files_created: 6
  files_modified: 5
  commits: 2
requirements-completed: [INFRA-01, AUTH-01, AUTH-02, AUTH-03]
---

# Phase 1 Plan 07: CI Integration Summary

**TestEmailAdapter enables deterministic token capture in integration tests; full-auth-flow covers all 6 auth mutations + RBAC denial in one sequence; CI extended with boot-time and frontend-codegen jobs enforcing all 5 Phase 1 success criteria**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-05-06
- **Tasks:** 2 executed + 1 checkpoint (awaiting CI verification)
- **Files created:** 6
- **Files modified:** 5

## Accomplishments

### Task 1: TestEmailAdapter + full-auth-flow (commit `e9f7b57`)

**Email architecture refactored for testability:**
- Added `EmailAdapter` interface to `resend.adapter.ts`; `ResendAdapter` implements it
- Added `EMAIL_ADAPTER` Symbol token to `email.module.ts` with `useExisting: ResendAdapter`
- Refactored `EmailService` to inject via `@Inject(EMAIL_ADAPTER)` — decoupled from `ResendAdapter`
- Created `TestEmailAdapter` with `send()` (captures to in-memory array), `findByRecipient()`, `extractToken()` (parses verification URL and invitation path), `reset()`, `lastSent`, `all`

**Integration test:** `full-auth-flow.e2e-spec.ts` covers:
1. Signup — no tokens issued (D-11 verified)
2. Token capture via `mailer.findByRecipient()` + `mailer.extractToken()`
3. `verifyEmail` mutation with captured token
4. `login` — ADMIN role confirmed
5. `refreshSession` — token rotation verified
6. Token reuse detection — `TOKEN_REUSE_DETECTED` error
7. `inviteMember` as ADMIN (captures invitation email via TestEmailAdapter)
8. Invitation token capture
9. `acceptInvitation` — PROFESSIONAL role confirmed
10. `logout`
11. Second test: PROFESSIONAL invitee denied by PermissionGuard (FORBIDDEN)

**setup.ts cleanup:** afterAll deletes `refresh_tokens` older than 30d and `email_verification_tokens` older than 24h.

### Task 2: CI workflow + READMEs + Phase 1 summary (commit `8b530a4`)

**CI workflow (`.github/workflows/ci.yml`):**
- `tenant-isolation` job renamed to `integration`; runs full `pnpm test:integration` (all 5 spec files)
- Added `boot-time` job: full `docker compose up -d --build`; fails if stack not healthy in 300s (Phase 1 SC #1)
- Added `frontend-codegen` job: boots backend, runs `pnpm codegen`, asserts `src/gql/graphql.ts` exists (D-08)

**Operator documentation:**
- `README.md` (root): Quick start in <10 commands, architecture table, Phase 1 Success Criteria verification table, common commands
- `apps/backend/README.md`: module layout, multi-tenant rules, auth mutation table, TestEmailAdapter usage guide, env var reference
- `apps/frontend/README.md`: directory layout, design token rules, codegen instructions, auth store API; references `01-UI-SPEC.md` as source of truth

**Phase 1 retrospective** (`.planning/phases/01-foundation/01-PHASE-SUMMARY.md`):
- Complete interface inventory for downstream phases (backend DI tokens, DB conventions, frontend hooks)
- 6 deviations from PRDs documented with rationale
- 7 follow-ups for future phases (not Phase 2 blockers)
- 5 dev environment known issues with workarounds

## Checkpoint (Task 3 — awaiting CI verification)

**Status:** AWAITING — returned CHECKPOINT REACHED to orchestrator.

**What to verify:**
1. Push branch → GitHub Actions run → `integration` job passes (all 5 spec files green)
2. `boot-time` job passes (stack healthy in <300s)
3. `frontend-codegen` job passes (types generated from live schema)
4. README quick-start works on fresh clone

## Deviations from Plan

### Minor Adaptations (within plan scope)

**1. [Rule 2 - Auto-add] Correct env var names in CI workflow**
- **Found during:** Task 2 CI update
- **Issue:** Plan action used `JWT_ACCESS_SECRET`, `APP_URL`, `RESEND_FROM_EMAIL` — these are not the actual env var names in the codebase
- **Fix:** Used correct names: `JWT_SECRET`, `FRONTEND_URL`, `EMAIL_FROM` (verified via `apps/backend/src/config/env.schema.ts`)
- **Commit:** `8b530a4`

**2. [Rule 1 - Bug] Added relogin step in full-auth-flow after TOKEN_REUSE_DETECTED**
- **Found during:** Task 1 test design
- **Issue:** After TOKEN_REUSE_DETECTED, the entire token family is revoked (including the new token issued in step 5). The test needed to relogin to get a fresh token to continue with inviteMember
- **Fix:** Added re-login after reuse detection test to get a fresh token
- **Commit:** `e9f7b57`

**3. [Rule 1 - Bug] frontend-codegen CI job asserts `src/gql/graphql.ts` not `src/types/graphql.ts`**
- **Found during:** Task 2 — reading `apps/frontend/codegen.ts`
- **Issue:** The plan acceptance criteria mentioned `apps/frontend/src/types/graphql.ts` but the actual codegen config (`codegen.ts`) outputs to `src/gql/` directory (client-preset output)
- **Fix:** Updated CI assertion to `test -f apps/frontend/src/gql/graphql.ts`
- **Commit:** `8b530a4`

## Known Stubs

None — no UI rendering stubs; the new files are backend test infrastructure and documentation.

## Self-Check: PASSED

Files verified:
- FOUND: apps/backend/src/email/test-email.adapter.ts
- FOUND: apps/backend/src/email/email.module.ts
- FOUND: apps/backend/src/email/email.service.ts
- FOUND: apps/backend/test/integration/full-auth-flow.e2e-spec.ts
- FOUND: apps/backend/test/integration/setup.ts
- FOUND: .github/workflows/ci.yml
- FOUND: README.md
- FOUND: apps/backend/README.md
- FOUND: apps/frontend/README.md
- FOUND: .planning/phases/01-foundation/01-PHASE-SUMMARY.md

Commits verified:
- FOUND: e9f7b57 feat(01-07): add TestEmailAdapter, EMAIL_ADAPTER DI token, full-auth-flow e2e test
- FOUND: 8b530a4 feat(01-07): update CI workflow, add operator READMEs, write Phase 1 retrospective

---
*Phase: 01-foundation*
*Completed: 2026-05-06*

---
phase: quick-260929-dek
plan: 01
subsystem: identity / equipe / frontend-infra
tags: [last-admin, rbac-ui, nginx-cache]
requirements: [EQUIPE-02, EQUIPE-03, EQUIPE-05]
key-files:
  modified:
    - apps/backend/src/identity/members.service.ts
    - apps/backend/test/integration/members-lifecycle.e2e.spec.ts
    - apps/frontend/src/pages/ProfissionaisPage.tsx
    - apps/frontend/src/pages/__tests__/profissionais-page.test.tsx
    - apps/frontend/nginx.conf
  created:
    - apps/frontend/src/features/identity/team-permissions.ts
    - apps/frontend/src/features/identity/__tests__/team-permissions.test.ts
completed: 2026-09-29
---

# Quick 260929-dek: Team actions by role, last-admin guard, nginx no-cache

Closes the three warnings of 02.1-VERIFICATION: LAST_ADMIN guard on update/deactivate, role-gated team actions in the UI, and index.html served with no-cache.

## Commits
- 8e6066d fix(identity): impedir rebaixar ou desativar o ultimo admin ativo
- 32b7ab5 fix(equipe): esconder acoes de equipe para papeis sem permissao
- nginx commit: fix(frontend): servir index.html sem cache no nginx (24a6e63)

## What changed
1. Backend: `isLastActiveAdmin` helper (tenant tx, counts other active non-deleted ADMINs). `update()` returns `LAST_ADMIN` (field roleName) when demoting; `deactivate()` returns `LAST_ADMIN` with the full payload (counts 0, empty blockingAppointments, real activeCommissionRuleCount). Integration tests use a dedicated org C (single admin, plus an inactive ADMIN and a soft-deleted ADMIN that must not count) and restore state.
2. Frontend: `canInviteMembers` (ADMIN, MANAGER) / `canManageMembers` (ADMIN) gate by `roleName`; the page hides the invite CTA (header and empty state), the members action column and the Revogar column accordingly.
3. nginx: `location = /index.html` and SPA fallback send `Cache-Control: no-cache`; hashed assets keep `public, immutable` + 1y expires; the 3 security headers are repeated with `always` in every location. Verified with `nginx -t` and a real nginx:alpine smoke test (/, /profissionais, /index.html no-cache; asset immutable; all with the 3 security headers).

## Deviations from Plan
- The spread-conditional actions column needed `satisfies DataTableColumn<AdminMemberData>` to keep contextual typing (TS7006). No behavior impact.
- Worktree had no `.env` loading for integration; env file (gitignored) was copied from /root/sgs. The `.env` contains an unquoted `&`, so it is parsed line by line rather than sourced by the shell.
- LAST_ADMIN tests use a new org C because org A already has two active admins.

## Verification (before every commit)
- Backend: lint clean, typecheck clean, unit 15/15, integration 118/118 (12 suites; 114 before + 4 new)
- Frontend: lint clean, typecheck clean, vitest 120/120 (16 files; 97 before + 23 new)

## Known Stubs
None.

---
task: quick-260929-gta
verified: 2026-09-29
status: human_needed
score: 6/7 must-haves verified (CI job not yet observed on GitHub Actions)
human_verification:
  - test: "Push and watch the `e2e` job in GitHub Actions"
    expected: "Job is green on a ubuntu runner (chromium deps, migrations, nest build, ports 3100/5180)"
    why_human: "Push was intentionally not done; the CI job was only reviewed statically and YAML-parsed"
---

# Quick 260929-gta Verification

**Goal:** Automate with Playwright the 4 manual checks of Phase 02.1 against the local stack and integrate in CI.

## Local re-run
`corepack pnpm --filter @sgs/e2e test:e2e`: **8 passed (1.2m)**. That is 1 seed, 1 smoke and 6 team tests. Zero failed, zero skipped. Only local infra was used. The sgs_stg_* containers were untouched.

## Truths
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | test:e2e boots backend 3100 + Vite 5180, seeds via API, runs the scenarios green | VERIFIED | Re-run 8/8. playwright.config webServer + scripts/start-backend.mjs |
| 2 | Scenario 1: direct UI registration and invite accepted at /convite/:token show up Active, Sênior, in /profissionais, /agenda side list and the /catalogo/comissoes picker, with no reload | VERIFIED | equipe-cadastro-e-convite.spec.ts: markNoReload/expectNoReload, senior asserted in the edit dialog and via allMembers, `${name} — visível` button, picker option |
| 3 | Scenario 2: blocked deactivation shows count, "client — service — date" line, member stays Ativo | VERIFIED | equipe-desativar-bloqueado.spec.ts: title, /1 agendamento\(s\) futuro\(s\)/, listitem with formatted date, row still Ativo, API status active |
| 4 | Scenario 3: edit role/seniority, then deactivate/reactivate, updates row without reload | VERIFIED | equipe-editar-desativar-reativar.spec.ts: Atendente cell, Pleno, Inativo, Reativar, Ativo. beforeEach resets state so repeat-each is meaningful |
| 5 | Scenario 4: MANAGER sees Cadastrar but no Ações; ATTENDANT sees nothing | VERIFIED | equipe-acoes-por-papel.spec.ts: columnheader/button count 0, action texts count 0, plus a backend deactivateMember denial and the member stays active. It matches the behaviour delivered by quick dek |
| 6 | Outbox only via EMAIL_OUTBOX_DIR, never in production; otherwise Resend | VERIFIED | `shouldUseOutbox` requires `nodeEnv !== "production"` and a non-blank dir. email.module factory falls back to ResendAdapter. Unit spec exists. The e2e env forces NODE_ENV=test and RESEND_API_KEY empty |
| 7 | CI e2e job: infra, migrations, chromium only, report upload on failure | PLAUSIBLE, not run | See CI review below |

## Assertion quality
There is no test.skip, fixme or .skip anywhere in apps/e2e. The assertions are substantive. They use no mocks and go through the real API and UI.

## App fixes
- ProfissionaisPage: `DropdownMenu modal={false}` and removal of `preventDefault` in onSelect. This is sound. The menu closes on select and the modal dialog takes over the pointer lock. It is scoped to one instance. The other DropdownMenu users (TopHeader, Categorias, Pacotes and others) use the shared component with the default modal and are unaffected. A vitest regression test was added. The E2E covers the pointer-events issue.

## CI review (.github/workflows/ci.yml, job `e2e`)
It mirrors the `integration` job: compose up postgres/pgbouncer/valkey, health wait, frozen-lockfile install, migrate deploy, prisma generate (before nest build, which happens in the launcher), `playwright install --with-deps chromium`, and test:e2e with CI=true and the required env (DIRECT_URL, DATABASE_URL, JWT_*, MEILISEARCH_KEY). It then uploads playwright-report and test-results with `if: failure()` and tears down with `if: always()`. Nothing blocking was found. Residual risks: the first run on the runner (browser deps, backend build time versus the 180s webServer timeout) and the missing ms-playwright cache (optional).

## Anti-patterns
None blocking. The 02.1-VERIFICATION.md update was done per the SUMMARY (not re-audited in depth).

## Gaps
None in code. The only open item is observing the CI job after push (human_needed).

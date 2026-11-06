---
phase: 5
slug: uso-no-dia-a-dia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Fonte: seção "Validation Architecture" de `05-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (backend unit + integração), Vitest 2 + Testing Library (frontend), Playwright (E2E e auditoria) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vitest.config.ts`, `apps/e2e/playwright.config.ts` (+ `playwright.audit.config.ts` no Wave 0) |
| **Quick run command** | `pnpm --filter @sgs/backend test -- forecast` / `pnpm --filter @sgs/frontend test -- <arquivo>` + `pnpm -r typecheck` |
| **Full suite command** | `pnpm -r --if-present lint && pnpm --filter @sgs/backend test && pnpm --filter @sgs/backend test:integration && pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | ~600 seconds (suite completa); quick < 60s |

---

## Sampling Rate

- **After every task commit:** quick run command do arquivo tocado + `pnpm -r typecheck`
- **After every plan wave:** lint + suites backend (unit e integração) + frontend
- **Before `/gsd:verify-work`:** full suite verde + CI verde (`gh run watch`) + verificação no staging após `scripts/deploy-staging.sh`
- **Max feedback latency:** 60 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | UX-DAY | config/typecheck | `corepack pnpm --filter @sgs/e2e typecheck` + `git check-ignore .env.audit` | ❌ W0 | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | UX-DAY | Playwright (auditoria) + arquivo | `playwright test -c playwright.audit.config.ts` + grep do cabeçalho em 05-AUDITORIA.md + commits `(05-01)` sem `apps/frontend`/`apps/backend` desde `.05-01-start-sha` | ❌ W0 | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | FIN-03 | schema | `prisma validate` + `pnpm --filter @sgs/backend typecheck` | ❌ W0 | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | FIN-03 | unit (TDD) | `pnpm --filter @sgs/backend test -- forecast` | ❌ W0 | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | FIN-03 | typecheck/lint | `pnpm --filter @sgs/backend typecheck && lint` | — | ⬜ pending |
| 05-03-T2 | 05-03 | 2 | FIN-03 | integração | `pnpm --filter @sgs/backend test:integration -- phase5-fixed-expenses phase5-rls-rbac` | ❌ W0 | ⬜ pending |
| 05-04-T1 | 05-04 | 3 | FIN-03 | typecheck/unit | `pnpm --filter @sgs/backend test -- forecast financial` | — | ⬜ pending |
| 05-04-T2 | 05-04 | 3 | FIN-03 | integração | `pnpm --filter @sgs/backend test:integration -- phase5` | ❌ W0 | ⬜ pending |
| 05-05-T1 | 05-05 | 1 | FIN-03 | vitest | `pnpm --filter @sgs/frontend test -- operations-permissions forecast-api` | ❌ W0 | ⬜ pending |
| 05-05-T2 | 05-05 | 1 | FIN-03 | vitest | `pnpm --filter @sgs/frontend test -- fixed-expenses-page features` | ❌ W0 | ⬜ pending |
| 05-06-T1 | 05-06 | 2 | FIN-03 | vitest | `pnpm --filter @sgs/frontend test -- forecast-card` | ❌ W0 | ⬜ pending |
| 05-06-T2 | 05-06 | 2 | FIN-03 | vitest | `pnpm --filter @sgs/frontend test -- previsao-page features` | ❌ W0 | ⬜ pending |
| 05-06b-T1 | 05-06b | 3 | FIN-03 (D-11) | vitest | `pnpm --filter @sgs/frontend test` | ✅ (ajuste) + ❌ W0 home-route | ⬜ pending |
| 05-06b-T2 | 05-06b | 3 | FIN-03 (D-11) | E2E | `corepack pnpm --filter @sgs/e2e test:e2e` | ✅ (ajuste smoke) | ⬜ pending |
| 05-07-T1 | 05-07 | 4 | FIN-03 | E2E | `corepack pnpm --filter @sgs/e2e test:e2e financeiro-previsao` | ❌ W0 | ⬜ pending |
| 05-07-T2 | 05-07 | 4 | FIN-03 | gate + CI + staging | suíte completa + `gh run list ... = success` + `previsao-staging.audit.ts` | — | ⬜ pending |
| 05-08-T1 | 05-08 | 2 | UX-DAY | manual (aprovação) | `grep '^status: aprovada' 05-AUDITORIA.md` | — | ⬜ pending |
| 05-08-T2/T3 | 05-08 | 2 | UX-DAY | estrutura de planos | `gsd-tools verify plan-structure` em cada lote + IDs aprovados cobertos | — | ⬜ pending |
| 05-09…19 | lotes | ≥5 | UX-DAY | vitest/Playwright por item | definido em cada lote (gerado pelo 05-08) | por item | ⬜ pending |
| 05-20-T1 | 05-20 | último | UX-DAY / FIN-03 | Playwright (staging) + grep | `playwright test -c playwright.audit.config.ts audit/previsao-staging.audit.ts` + `grep 'sem média histórica' REQUIREMENTS.md` | — | ⬜ pending |
| 05-20-T2 | 05-20 | último | UX-DAY/FIN-03 | manual (aceite) | `grep '^## Aceite final' 05-AUDITORIA.md` | — | ⬜ pending |
| 05-20-T3 | 05-20 | último | UX-DAY (D-12) | SQL staging | `members.status = 'inactive'` para auditoria.ux@sgs.invalid | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/financial/forecast.spec.ts` — funções puras (despesas fixas, buckets semanais, atraso, comissão fallback)
- [ ] `apps/backend/test/integration/phase5-forecast.e2e.spec.ts`, `phase5-rls-rbac.e2e.spec.ts`, `helpers/phase5-cleanup.ts`
- [ ] `apps/frontend/src/features/operations/__tests__/forecast-card.test.tsx`, `fixed-expenses-page.test.tsx`
- [ ] `apps/e2e/tests/financeiro-previsao.spec.ts` e `apps/e2e/playwright.audit.config.ts`
- [ ] Atualizar testes que assumem home `/agenda` (D-11)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aprovação da lista de auditoria | UX-DAY | Decisão da usuária (D-01) | Usuária marca "Aprovado?" em `05-AUDITORIA.md` |
| Itens aprovados corrigidos no staging | UX-DAY | Depende do deploy e dos dados reais | Rodar o roteiro de auditoria contra o staging após deploy e anexar resultado |
| Cartão de previsão com dados reais da Studio JS | FIN-03 | Dados reais só no staging | Entrar como ADMIN no staging, conferir totais do cartão contra o detalhe |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

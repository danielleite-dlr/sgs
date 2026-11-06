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
| (preenchido pelo planner/executor a partir dos PLAN.md) | | | FIN-03 / UX-DAY | | | | ⬜ pending |

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

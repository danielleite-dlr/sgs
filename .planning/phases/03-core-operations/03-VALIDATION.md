---
phase: 3
slug: core-operations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: seção "Validation Architecture" de `03-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (backend unit + integration), Vitest 2 (frontend), Playwright 1.55 (E2E) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vitest.config.ts`, `apps/e2e/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @sgs/backend test -- <arquivo>` / `pnpm --filter @sgs/frontend test -- <arquivo>` + `pnpm -r typecheck` |
| **Full suite command** | `pnpm -r --if-present lint && pnpm -r typecheck && pnpm --filter @sgs/backend test && pnpm --filter @sgs/backend test:integration && pnpm --filter @sgs/frontend test && pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | ~300 seconds (suíte completa) |

**Atenção:** suítes de integração novas devem se chamar `phase3-*.e2e.spec.ts` (com ponto); `*.e2e-spec.ts` não é descoberto. Não usar `pnpm --filter @sgs/backend test:e2e` (config inexistente).

---

## Sampling Rate

- **After every task commit:** unit do módulo tocado + `pnpm -r typecheck`
- **After every plan wave:** `pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-` + `pnpm --filter @sgs/frontend test` + lint
- **Before `/gsd:verify-work`:** suíte completa (integration + E2E) verde, incluindo o job `e2e` do CI
- **Max feedback latency:** 60 seconds (quick run)

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SCHED-01 | Concorrência com intervalos sobrepostos de início diferente: 1 sucesso, 1 `SLOT_TAKEN`; 55P03 mapeado | integration | `pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-scheduling-concurrency.e2e.spec` | ❌ W0 | ⬜ pending |
| SCHED-01 | Constraint recriada protege `in_progress`/`completed` | integration | `… --testPathPattern phase3-schema-smoke.e2e.spec` | ❌ W0 | ⬜ pending |
| SCHED-01 | Vista semana consulta intervalo certo | unit | `pnpm --filter @sgs/frontend test -- week-range` | ❌ | ⬜ pending |
| SCHED-02 | move valida conflito/bloqueio/duração, troca de raia, recusa `cancelled` | integration | `… --testPathPattern phase3-appointments-move.e2e.spec` | ❌ | ⬜ pending |
| SCHED-02 | Revert otimista com `errors[]` não escreve no cache | unit | `pnpm --filter @sgs/frontend test -- move-appointment` | ❌ | ⬜ pending |
| SCHED-02 | Arrastar persiste; sobre ocupado volta com toast | E2E | `pnpm --filter @sgs/e2e test:e2e -- tests/agenda-dnd.spec.ts` | ❌ | ⬜ pending |
| SCHED-03 | 4 tipos de bloqueio; feriado org-wide; bloqueio sobre agendamento recusado | integration | `… --testPathPattern phase3-time-blocks.e2e.spec` | ❌ | ⬜ pending |
| SCHED-04 | Sinal R$50 → crédito + cash; cancelar exige motivo e mantém crédito | integration | `… --testPathPattern phase3-deposit-cancel.e2e.spec` | ❌ | ⬜ pending |
| POS-01 | Visita → N appointments + 1 comanda + itens; walk-in; pacote rateado | integration + unit | `… --testPathPattern phase3-comanda-open.e2e.spec` ; `pnpm --filter @sgs/backend test -- money` | ❌ | ⬜ pending |
| POS-01 | Código `C-AAAA-NNN` concorrente sem buraco/duplicata | integration | `… --testPathPattern phase3-comanda-code.e2e.spec` | ❌ | ⬜ pending |
| POS-02 | 5 métodos + crédito; inválido rejeitado; crédito > saldo recusado | integration | `… --testPathPattern phase3-comanda-payments.e2e.spec` | ❌ | ⬜ pending |
| POS-03 | Pagamento dividido, falta/troco, fecha só com `pago >= total`, close duplo concorrente | integration | `… --testPathPattern phase3-comanda-close.e2e.spec` | ❌ | ⬜ pending |
| FIN-02 | Precedência de regras de comissão, arredondamento, fixed | unit | `pnpm --filter @sgs/backend test -- commission-resolver` | ❌ | ⬜ pending |
| FIN-02 | Snapshot imutável; REVOKE UPDATE/DELETE | integration | `… --testPathPattern phase3-commission-records.e2e.spec` | ❌ | ⬜ pending |
| FIN-02 | Reabrir reverte estoque/comissão/crédito/caixa, exige permissão + motivo, audit_log | integration | `… --testPathPattern phase3-comanda-reopen.e2e.spec` | ❌ | ⬜ pending |
| FIN-01 | Totais dia/semana/mês, breakdown por método, fuso America/Sao_Paulo, só ADMIN/MANAGER | integration | `… --testPathPattern phase3-financial-dashboard.e2e.spec` | ❌ | ⬜ pending |
| FIN-01 | Presets de período | unit | `pnpm --filter @sgs/frontend test -- period` | ❌ | ⬜ pending |
| FIN-01 | Dashboard com dado real | E2E | `… test:e2e -- tests/financeiro-dashboard.spec.ts` | ❌ | ⬜ pending |
| Transversal | RLS/RBAC nas tabelas novas | integration | `… --testPathPattern phase3-rls-rbac.e2e.spec` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts` (modelo `phase2-schema-smoke.spec.ts`)
- [ ] `apps/backend/test/integration/helpers/phase3-fixtures.ts`
- [ ] Ajuste dos cleanups existentes (`members-lifecycle`, `professional-categories`, seed E2E) ou FKs com `ON DELETE CASCADE`/`SET NULL`
- [ ] `apps/frontend/src/features/operations/lib/{money,period}.ts` + testes
- [ ] Dependências `@dnd-kit/core` + `@dnd-kit/modifiers` e override `react-is ^19` para Recharts
- [ ] Spike para travar o formato do erro Prisma em 55P03/23P01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arrastar via teclado (KeyboardSensor) e leitura por leitor de tela | SCHED-02 | Acessibilidade assistiva não é coberta pelo Playwright | Na agenda, focar um card, Espaço para pegar, setas para mover, Espaço para soltar; conferir anúncio |
| Contraste das 4 cores de bloqueio | SCHED-03 | Avaliação visual WCAG | Conferir contraste ≥ 4.5:1 do texto sobre cada cor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

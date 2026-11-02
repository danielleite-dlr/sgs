---
phase: 3
slug: core-operations
status: complete
nyquist_compliant: true
wave_0_complete: true
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
| SCHED-01 | Concorrência com intervalos sobrepostos de início diferente: 1 sucesso, 1 `SLOT_TAKEN`; 55P03 mapeado | integration | `pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-scheduling-concurrency.e2e.spec` | ✅ | ✅ green |
| SCHED-01 | Constraint recriada protege `in_progress`/`completed` | integration | `… --testPathPattern phase3-schema-smoke.e2e.spec` | ✅ | ✅ green |
| SCHED-01 | Vista semana consulta intervalo certo | unit | `pnpm --filter @sgs/frontend test -- week-range` | ✅ | ✅ green |
| SCHED-02 | move valida conflito/bloqueio/duração, troca de raia, recusa `cancelled` | integration | `… --testPathPattern phase3-appointments-move.e2e.spec` | ✅ | ✅ green |
| SCHED-02 | Revert otimista com `errors[]` não escreve no cache | unit | `pnpm --filter @sgs/frontend test -- move-appointment` | ✅ | ✅ green |
| SCHED-02 | Arrastar persiste; sobre ocupado volta com toast | E2E | `pnpm --filter @sgs/e2e test:e2e tests/agenda-dnd.spec.ts` ; `tests/agenda-concorrencia.spec.ts` ; `tests/fluxo-agendamento-comanda-pagamento.spec.ts` | ✅ | ✅ green |
| SCHED-03 | 4 tipos de bloqueio; feriado org-wide; bloqueio sobre agendamento recusado | integration | `… --testPathPattern phase3-time-blocks.e2e.spec` | ✅ | ✅ green |
| SCHED-04 | Sinal R$50 → crédito + cash; cancelar exige motivo e mantém crédito | integration | `… --testPathPattern phase3-deposit-cancel.e2e.spec` ; `phase3-client-credit.e2e.spec` | ✅ | ✅ green |
| POS-01 | Visita → N appointments + 1 comanda + itens; walk-in; pacote rateado | integration + unit | `… --testPathPattern phase3-visit.e2e.spec` ; `phase3-comanda-open.e2e.spec` ; `phase3-appointments-lifecycle.e2e.spec` ; `pnpm --filter @sgs/backend test -- money` | ✅ | ✅ green |
| POS-01 | Código `C-AAAA-NNN` concorrente sem buraco/duplicata | integration | `… --testPathPattern phase3-comanda-code.e2e.spec` | ✅ | ✅ green |
| POS-02 | 5 métodos + crédito; inválido rejeitado; crédito > saldo recusado | integration | `… --testPathPattern phase3-comanda-payments.e2e.spec` | ✅ | ✅ green |
| POS-03 | Pagamento dividido, falta/troco, fecha só com `pago >= total`, close duplo concorrente | integration | `… --testPathPattern phase3-comanda-close.e2e.spec` | ✅ | ✅ green |
| FIN-02 | Precedência de regras de comissão, arredondamento, fixed | unit | `pnpm --filter @sgs/backend test -- commission-resolver` | ✅ | ✅ green |
| FIN-02 | Snapshot imutável; REVOKE UPDATE/DELETE | integration | `… --testPathPattern phase3-commission-records.e2e.spec` | ✅ | ✅ green |
| FIN-02 | Reabrir reverte estoque/comissão/crédito/caixa, exige permissão + motivo, audit_log | integration | `… --testPathPattern phase3-comanda-reopen.e2e.spec` | ✅ | ✅ green |
| FIN-01 | Totais dia/semana/mês, breakdown por método, fuso America/Sao_Paulo, só ADMIN/MANAGER | integration | `… --testPathPattern phase3-financial-dashboard.e2e.spec` | ✅ | ✅ green |
| FIN-01 | Presets de período | unit | `pnpm --filter @sgs/frontend test -- period` | ✅ | ✅ green |
| FIN-01 | Dashboard com dado real | E2E | `pnpm --filter @sgs/e2e test:e2e tests/financeiro-dashboard.spec.ts` | ✅ | ✅ green |
| Transversal | RLS nas 9 tabelas novas, cross-tenant nos resolvers e matriz de permissões (19 linhas papel × operação) | integration | `… --testPathPattern phase3-rls-rbac.e2e.spec` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts` (modelo `phase2-schema-smoke.spec.ts`)
- [x] `apps/backend/test/integration/helpers/phase3-fixtures.ts`
- [x] Ajuste dos cleanups existentes (`members-lifecycle`, `professional-categories`, seed E2E) ou FKs com `ON DELETE CASCADE`/`SET NULL`
- [x] `apps/frontend/src/features/operations/lib/{money,period}.ts` + testes
- [x] Dependências `@dnd-kit/core` + `@dnd-kit/modifiers` e override `react-is ^19` para Recharts
- [x] Spike para travar o formato do erro Prisma em 55P03/23P01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arrastar via teclado (KeyboardSensor) e leitura por leitor de tela | SCHED-02 | Acessibilidade assistiva não é coberta pelo Playwright | Na agenda, focar um card, Espaço para pegar, setas para mover, Espaço para soltar; conferir anúncio |
| Contraste das 4 cores de bloqueio | SCHED-03 | Avaliação visual WCAG | Conferir contraste ≥ 4.5:1 do texto sobre cada cor |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** gate automático verde em 2026-11-02; aguardando verificação humana (Task 3 do 03-12)

---

## Desvios aceitos

Decisões que reduzem ou alteram o escopo original e que o verificador deve tratar como aceitas:

- **POS-02 sem Pix QR e sem voucher** (D-09/D-10): o Pix é registrado manualmente como forma de pagamento (sem QR dinâmico; o gateway entra na Fase 5) e voucher/vale fica para a v2. Os 5 métodos (dinheiro, Pix, crédito, débito, transferência) + crédito do cliente estão cobertos.
- **D-01**: o lock de concorrência é por profissional (advisory lock) em vez de hash do slot; o resultado (um sucesso, o outro `SLOT_TAKEN`) é o mesmo.
- **D-14**: a reabertura reverte comissão e caixa por registro novo (`kind='reversal'`), nunca por UPDATE/DELETE nos ledgers.
- **Cancelamento**: todo cancelamento exige motivo, inclusive para ADMIN.
- **D-25**: sem expediente por profissional; faixa fixa 07h–22h na grade (as faixas azuis 09h–19h são só visuais).
- **Crédito**: o ajuste manual de crédito não gera movimento de caixa.
- **Pacote vendido** entra inteiro na comanda (1 item por unidade) e a comissão incide sobre o preço cheio (D-23).
- **Comissão `fixed`** é por unidade.
- **Gate de UI por papel** (descoberto no 03-12): `permissions` do auth store nunca é populado; as telas de operação usam `operations-permissions.ts`, que espelha `ROLE_PERMISSIONS` do backend por `roleName`. O backend segue sendo a barreira real.

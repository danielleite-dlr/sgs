---
phase: 12
slug: ajustar-cadastro-de-agendamento
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-27
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1 (jsdom, Testing Library, MockedProvider); Playwright em `apps/e2e` |
| **Config file** | `apps/frontend/vitest.config.ts` |
| **Quick run command** | `cd /root/sgs/apps/frontend && npx vitest run src/features/operations/__tests__ src/components/ui/__tests__` |
| **Full suite command** | `cd /root/sgs/apps/frontend && npx vitest run && npx tsc --noEmit -p . && npx eslint src` |
| **Estimated runtime** | ~40 s (quick), ~4 min (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green + print Playwright temporário (celular 390 px e computador) do modal e do calendário
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Decisão | Comportamento | Test Type | Automated Command | File Exists | Status |
|---------|---------------|-----------|-------------------|-------------|--------|
| D-06/D-07/D-12 | pacote "Make & Penteado" na linha 10:00 → 10:00 e 10:00+duração; hora vazia usa fallback; editar não cascateia | unit + componente | quick | ❌ W0 `visit-form-package.test.tsx` | ⬜ pending |
| D-02 | pacote no meio mantém avulsos acima/abaixo (`expandPackageAt`) | unit | quick | ❌ W0 (casos em `visit-form.test.ts`) | ⬜ pending |
| D-03 | "Pacote" desabilitado nas outras linhas | componente | quick | ❌ W0 | ⬜ pending |
| D-04/D-10 | "Remover pacote" tira só linhas do pacote, limpa `packageId`; sem lixeira nas linhas do pacote; payload correto | componente | quick | ❌ W0 | ⬜ pending |
| D-05 | trocar data/cliente invalida pacote e preserva avulsos | componente | quick | ❌ W0 | ⬜ pending |
| D-11 | prefill: sem opção Pacote; serviços em sequência | componente | quick | ✅ `visit-form-prefill.test.tsx` (atualizar) | ⬜ pending |
| D-01 | `#visit-package` some; seletor Serviço/Pacote ≥ 44 px | componente | quick | ✅ `novo-agendamento-gestor-beauty.test.tsx` (atualizar) | ⬜ pending |
| D-08/D-09 | digitar dd/mm/aaaa; ícone abre calendário; clicar no dia preenche; domingo primeiro; pt-BR | componente + unit (`monthGrid`) | quick | ❌ W0 `components/ui/__tests__/date-field.test.tsx` | ⬜ pending |
| Regressão | fluxos E2E com o modal (testids `visit-line-N-*`, `visit-deposit-*`) | e2e | `corepack pnpm --filter @sgs/e2e test:e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/frontend/src/features/operations/__tests__/visit-form-package.test.tsx` — D-02..D-07, D-10, D-12
- [ ] `apps/frontend/src/components/ui/__tests__/date-field.test.tsx` — D-08/D-09
- [ ] casos `expandPackageAt`/`removePackageLines` em `visit-form.test.ts`
- [ ] conferir `ResizeObserver`/`scrollIntoView` em `src/test-setup.ts` (Popover Radix em jsdom)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual do calendário e do seletor no celular | D-08, D-01 | estética/encaixe | Staging, celular: Agenda → Novo → ícone da data; escolher pacote Make & Penteado |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

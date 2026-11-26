---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 06
subsystem: frontend
tags: [profissionais, marcacoes, i18n, ordenacao]
requires: ["11-02"]
provides:
  - "UI das marcações Fixa e Atende noiva/debutante (criar, editar, selos)"
  - "sortFixedFirst (helper único dos seletores)"
  - "ProfessionalsForServiceQuery com $bridal e isFixed"
  - "ScheduleProfessional.isFixed"
affects: [11-09, 11-10, 11-12, 11-13]
tech-stack:
  added: []
  patterns: ["checkbox no padrão isBridalAssistant (09.1)"]
key-files:
  created:
    - apps/frontend/src/features/operations/professional-order.ts
    - apps/frontend/src/features/operations/__tests__/professional-order.test.ts
  modified:
    - apps/frontend/src/features/catalog/api/members.api.ts
    - apps/frontend/src/features/identity/components/CreateMemberDialog.tsx
    - apps/frontend/src/features/identity/components/MemberEditDialog.tsx
    - apps/frontend/src/pages/ProfissionaisPage.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - apps/frontend/src/features/operations/api/appointments.api.ts
    - apps/frontend/src/features/operations/components/calendar/types.ts
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
key-decisions:
  - "A ordem das colunas da grade da Agenda não muda (D-20): SchedulePage só repassa isFixed"
requirements-completed: [PRIO-02, PRIO-04, PRIO-16]
duration: 35min
completed: 2026-11-26
---

# Phase 11 Plan 06: marcações no frontend e sortFixedFirst Summary

Diálogos de criar/editar profissional com "Fixa (equipe do studio)" e "Atende noiva/debutante", selos com texto na tela Profissionais, helper `sortFixedFirst` e `isFixed`/`$bridal` nas queries que alimentam os seletores.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | API, diálogos, selos, i18n e testes | 7296098 |
| 2 | sortFixedFirst, isFixed e $bridal | b45af29 |

## Verificação

- vitest de operations, identity, bridal e pages: 87 arquivos, 670 testes verdes (inclui testes novos dos diálogos, da página e do helper).
- `tsc --noEmit` do frontend sem erros.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] codegen não executado**
- `pnpm codegen` precisa de um backend GraphQL no ar (schema por URL), indisponível no worktree. `src/gql` não é afetado por estas queries manuais; o typecheck cobre os tipos.

**2. [Rule 3 - Mocks] Mocks antigos atualizados**
- `perfis-acesso-page.test.tsx` e `timeline-tab.test.tsx` receberam os campos novos nos mocks (isFixed/servesBridal), pois os tipos passaram a exigi-los.

Ambiente: worktree sem node_modules, usei symlinks (não versionados).

## Known Stubs

Nenhum. `sortFixedFirst` ainda não é consumido nos seletores; isso fica para os planos 11-09/10/12/13, conforme o plano.

## Self-Check: PASSED

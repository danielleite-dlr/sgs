---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 10
subsystem: frontend
tags: [profissionais, ordenacao, seletores, PRIO-16]
requires: ["11-06"]
provides:
  - "Bloqueio de agenda, regra de comissão e item de comanda com fixas primeiro (D-09)"
affects: [operations, catalog]
tech-stack:
  added: []
  patterns: ["sortFixedFirst aplicado nos seletores; grade da Agenda intacta (D-20)"]
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/add-item-dialog-order.test.tsx
  modified:
    - apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx
    - apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx
    - apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx
    - apps/frontend/src/features/operations/__tests__/time-block-dialog.test.tsx
    - apps/frontend/src/features/catalog/__tests__/commission-rule-form.test.tsx
key-decisions:
  - "useProfessionalsFor ordena de forma defensiva, cobrindo também o seletor de profissional por serviço de pacote"
requirements-completed: [PRIO-16]
metrics:
  tasks: 1
  files: 6
  completed: 2026-11-26
---

# Phase 11 Plan 10: Fixas primeiro nos demais seletores Summary

Três seletores de profissional (bloqueio de agenda, regra de comissão, item de comanda) passam a listar fixas primeiro e depois por nome via `sortFixedFirst`.

## O que foi feito
- `TimeBlockDialog`: opções ordenadas com `useMemo`.
- `CommissionRuleForm`: membros profissionais ordenados, tipados com `MemberData`.
- `AddItemDialog`: `useProfessionalsFor` ordena defensivamente (serviço e pacote).
- Testes: ordem em cada seletor (novo `add-item-dialog-order.test.tsx`); mocks atualizados com `isFixed`.
- D-20: nenhum uso de `sortFixedFirst` em SchedulePage, DayGrid ou WeekGrid.

## Verificação
vitest de operations e catalog (68 arquivos, 435 testes) e typecheck verdes.

## Deviations from Plan
None - plano executado como escrito. (Lint do pacote rodado só nos arquivos tocados, sem erros.)

## Commits
- 324abfb: feat(11-10): fixas primeiro nos seletores de profissional

## Self-Check: PASSED

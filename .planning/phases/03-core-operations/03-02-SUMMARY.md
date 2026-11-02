---
phase: 03-core-operations
plan: 02
subsystem: frontend
tags: [dnd-kit, recharts, react-is, money, period, schedule-grid, masks]
requires: []
provides:
  - "@dnd-kit/core 6.3.1 e @dnd-kit/modifiers 9.0.0 no frontend"
  - "pnpm override react-is ^19 (Recharts renderiza sob React 19)"
  - "features/operations/lib: money, period, week-range, schedule-grid, operations-labels, input-masks"
affects: [03-08, 03-09, 03-10, 03-11]
tech-stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/modifiers@9.0.0"]
  patterns: ["dinheiro em centavos inteiros, strings decimais na borda", "datas YYYY-MM-DD com aritmetica em UTC"]
key-files:
  created:
    - apps/frontend/src/features/operations/lib/money.ts
    - apps/frontend/src/features/operations/lib/period.ts
    - apps/frontend/src/features/operations/lib/week-range.ts
    - apps/frontend/src/features/operations/lib/schedule-grid.ts
    - apps/frontend/src/features/operations/lib/operations-labels.ts
    - apps/frontend/src/features/operations/lib/input-masks.ts
    - apps/frontend/src/features/operations/__tests__/ (6 arquivos)
  modified:
    - package.json
    - pnpm-lock.yaml
    - apps/frontend/package.json
key-decisions:
  - "react-is forcado para ^19 na raiz via pnpm.overrides"
  - "Faixa da agenda constante 07h-22h (D-25)"
requirements-completed: []  # plano de fundacao; requisitos fecham nos planos de tela
duration: ~20min
completed: 2026-11-02
---

# Phase 3 Plan 02: Fundacao do frontend Summary

Dependencias (dnd-kit, override de react-is) e seis modulos puros testados (dinheiro/troco, periodos, semana, grade 07h-22h, rotulos, mascaras BR) para as telas da fase 3.

## Tasks

1. dnd-kit + override react-is + smoke Recharts - `a14c5af`
2. lib/money.ts e lib/period.ts - `4ab7d31`
3. week-range, schedule-grid, operations-labels, input-masks - `d1a5a6b`

## Testes

- Frontend vitest: 238 (27 arquivos; +31 novos)
- Backend unit: 63; integracao: 154 (inalterados, verdes)
- lint, typecheck e `pnpm install --frozen-lockfile` verdes

## Deviations from Plan

None - plano executado como escrito. (Casos extras de teste alem do minimo.)

## Notas para os proximos planos

- `SchedulePage.tsx` NAO foi alterado: ainda tem copias locais de `maskTime`/`maskDateBR` e `TIME_SLOTS` 08-20; 03-08 troca por `GRID_SLOTS`, 03-10 pelo import de `input-masks`.
- `computePaymentSummary` lanca `Error('valor inválido')` via `decimalToCents` se alguma string nao for decimal valido (ate 2 casas); valide/desmascare (`unmaskCurrency`) antes.
- `resolvePeriod` devolve `to` exclusivo; `customPeriod` recebe datas inclusivas. Semana comeca na segunda.
- `weekRange` usa fuso local do navegador (startsAt/endsAt em ISO UTC); `slotsFromDelta` normaliza -0.
- Recharts: nos testes jsdom use `BarChart` com width/height fixos e `isAnimationActive={false}` (sem ResponsiveContainer).
- Metodo `client_credit` fica em `CLIENT_CREDIT_METHOD`/`ALL_PAYMENT_METHODS`, fora de `PAYMENT_METHODS` (que tem os 5 manuais).

## Self-Check: PASSED

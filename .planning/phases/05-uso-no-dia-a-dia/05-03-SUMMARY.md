---
phase: 05-uso-no-dia-a-dia
plan: 03
subsystem: backend-financial
tags: [fixed-expenses, graphql, rbac, rls]
requires: [05-02]
provides:
  - query fixedExpenses e mutations create/update/deleteFixedExpense
  - suites de integracao phase5-fixed-expenses e phase5-rls-rbac
affects: [05-04, 05-05, 05-06]
key-files:
  created:
    - apps/backend/src/financial/fixed-expense.service.ts
    - apps/backend/src/financial/fixed-expense.resolver.ts
    - apps/backend/src/graphql/schema/fixed-expenses.graphql
    - apps/backend/test/integration/helpers/phase5-cleanup.ts
    - apps/backend/test/integration/phase5-fixed-expenses.e2e.spec.ts
    - apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts
  modified:
    - apps/backend/src/financial/financial.module.ts
key-decisions:
  - "Erros de validacao e NOT_FOUND voltam como dado (errors: [UserError!]!) em PT-BR"
  - "Update/delete de id de outra org retorna NOT_FOUND (RLS torna a linha invisivel)"
requirements-completed: []
duration: ~20min
completed: 2026-11-06
---

# Phase 5 Plan 03: Backend despesas fixas Summary

API GraphQL de despesas fixas (listar, criar, editar, ativar/desativar, excluir) com `financial.read` para ler e `financial.expenseWrite` para gravar, isolada por org via RLS e coberta por testes de integracao.

## Tasks
1. Service + resolver + SDL + modulo: commit f6abfbe
2. Suites de integracao e limpeza: commit b1b55c1

## Verificacao
typecheck e lint do backend passam; `test:integration -- phase5-fixed-expenses phase5-rls-rbac`: 6 passed, 1 todo (cashForecast, plano 05-04). Ruido de Redis NOAUTH no log e do ambiente (BullMQ) e nao afeta os testes.

## Deviations from Plan
None - plan executed exactly as written.

FIN-03 nao marcado como completo (fase em andamento, conforme instrucao do orquestrador).

## Known Stubs
None.

## Self-Check: PASSED
Arquivos criados e commits f6abfbe, b1b55c1 verificados.

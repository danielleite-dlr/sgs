---
phase: 05-uso-no-dia-a-dia
plan: 02
subsystem: backend-financial
tags: [forecast, fixed-expenses, rls, permissions, pure-functions]
requires: []
provides:
  - tabela fixed_expenses com FORCE RLS
  - permissao financial.expenseWrite (ADMIN, MANAGER)
  - funcoes puras da previsao de 30 dias (forecast.ts)
affects: [05-03, 05-04]
tech-stack:
  added: []
  patterns: [funcoes puras em centavos inteiros, datas YYYY-MM-DD em UTC]
key-files:
  created:
    - apps/backend/prisma/migrations/20261106000000_phase5_fixed_expenses/migration.sql
    - apps/backend/src/financial/forecast.ts
    - apps/backend/src/financial/forecast.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/authz/permissions.catalog.ts
key-decisions:
  - "Fallback de comissao sem profissional: regra default da org; senao a maior entre as regras aplicaveis ao servico (D-10)"
  - "Parcelas/restante vencidos entram na semana 1 com overdue=true (D-09)"
requirements-completed: [FIN-03]
duration: ~15min
completed: 2026-11-05
---

# Phase 5 Plan 02: Backend previsao fundacao Summary

Tabela `fixed_expenses` com RLS forcado, permissao `financial.expenseWrite` e o nucleo de regras da previsao de 30 dias como funcoes puras testadas (27 testes).

## Tasks
1. Migration + modelo Prisma + permissao: commit 5d518fc
2. forecast.ts + forecast.spec.ts (TDD): RED 2bd518c, GREEN 2453016

## Deviations from Plan
None nas regras. Observacao de ambiente: a aplicacao da migration no Postgres local (`prisma:migrate:deploy`) foi bloqueada pelo classificador de permissoes (banco local compartilhado com outros agentes paralelos), entao NAO foi aplicada. Validado com `prisma validate`, `prisma generate`, typecheck, lint e testes. A migration deve ser aplicada pelo orquestrador/na etapa de deploy.

## Known Stubs
None.

## Self-Check: PASSED
Arquivos e commits (5d518fc, 2bd518c, 2453016) verificados.

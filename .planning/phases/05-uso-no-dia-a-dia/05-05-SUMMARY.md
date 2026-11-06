---
phase: 05-uso-no-dia-a-dia
plan: 05
subsystem: frontend
tags: [react, apollo, despesas-fixas, previsao]
requires: [05-02 (contrato GraphQL e permissão financial.expenseWrite)]
provides: [forecast.api.ts, DespesasFixasPage, rota /financeiro/despesas-fixas]
affects: [05-06 (previsão de 30 dias reutiliza forecast.api.ts)]
tech-stack:
  added: []
  patterns: [gql inline com tipos manuais, gate por roleName espelhando o backend]
key-files:
  created:
    - apps/frontend/src/features/operations/api/forecast.api.ts
    - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx
    - apps/frontend/src/features/operations/__tests__/forecast-api.test.ts
    - apps/frontend/src/features/operations/__tests__/fixed-expenses-page.test.tsx
  modified:
    - apps/frontend/src/features/operations/operations-permissions.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/menu-config.ts
decisions:
  - "PageHeader não tem prop de descrição; a descrição é um parágrafo logo abaixo dele"
  - "Rota nova cai no prefixo /financeiro (flag ligada); features.ts intocado"
metrics:
  tasks: 2
  files: 7
  completed: 2026-11-05
---

# Phase 5 Plan 05: Frontend de despesas fixas Summary

Tela CRUD de despesas fixas (máscara BRL, dia 1–31, confirmação de exclusão) em `/financeiro/despesas-fixas`, mais a camada de API da fase (gql e tipos de `cashForecast`/despesas fixas, `forecastWindow` no fuso da org, `weekLabel`).

## Deviations from Plan

[Rule 3 - Blocking] `PageHeader` aceita `cta` (não `actions`) e não tem `description`; usei `cta` e um parágrafo para a descrição. Sem outros desvios.

## Verification

- vitest do frontend inteiro: 57 arquivos, 401 testes passando (incluindo 6 da página e 3 de forecast-api)
- tsc e eslint sem erros; `features.ts` sem alterações

## Known Stubs

Nenhum.

## Self-Check: PASSED

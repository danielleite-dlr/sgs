---
phase: 05-uso-no-dia-a-dia
plan: 06
subsystem: frontend
tags: [react, apollo, recharts, previsao, painel]
requires: [05-05 (forecast.api.ts)]
provides: [ForecastCard, PrevisaoPage, DashboardPage real, rota /financeiro/previsao]
affects: [05-06b (home por papel passa a apontar para o DashboardPage)]
key-files:
  created:
    - apps/frontend/src/features/operations/components/ForecastCard.tsx
    - apps/frontend/src/features/operations/pages/PrevisaoPage.tsx
    - apps/frontend/src/features/operations/__tests__/forecast-card.test.tsx
    - apps/frontend/src/features/operations/__tests__/previsao-page.test.tsx
  modified:
    - apps/frontend/src/pages/DashboardPage.tsx
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/menu-config.ts
decisions:
  - "ForecastCard usa skip quando sem permissão financial.read, para não disparar a query"
  - "Saldo negativo exibido com prefixo − e valor absoluto formatado"
metrics:
  tasks: 2
  files: 7
  completed: 2026-11-06
---

# Phase 5 Plan 06: Painel com previsão de 30 dias Summary

Cartão "Previsão dos próximos 30 dias" (entradas, saídas, saldo, aviso de atraso, gráfico de barras por semana com tabela sr-only) no painel, e tela `/financeiro/previsao` com lista por semana, origem de cada valor e marcações de comissão estimada/sem regra.

## Commits

- 1bfb087: ForecastCard + DashboardPage
- 69de2e7: PrevisaoPage, rota e item de menu

## Deviations from Plan

None - plan executed as written. A query do cartão e da página usa `variableMatcher` nos testes (a janela depende do relógio). A rota `/dashboard` continua sem mostrar o painel até o 05-06b.

## Verification

- vitest do frontend inteiro: 59 arquivos, 410 testes passando (7 do cartão, 2 da página)
- tsc e eslint sem erros
- Backend `cashForecast` ainda não existe (05-04); testes usam mock do contrato.

## Known Stubs

Nenhum.

## Self-Check: PASSED

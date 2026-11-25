---
phase: 10-permiss-es-por-usu-rio
plan: 11
subsystem: frontend-menu-painel
tags: [permissoes, menu, painel, myAccess]
requires: [10-09]
provides:
  - "filterMenuByAccess, menuForAccess (menu-config)"
  - "useMenu e BottomNav pelo acesso efetivo"
  - "cartões do painel inicial por item de myAccess"
affects: [10-12]
key-files:
  created:
    - apps/frontend/src/components/layout/__tests__/access-fixture.ts
    - apps/frontend/src/components/layout/__tests__/bottom-nav-acesso.test.tsx
    - apps/frontend/src/features/operations/__tests__/painel-por-acesso.test.tsx
  modified:
    - apps/frontend/src/components/layout/menu-config.ts
    - apps/frontend/src/components/layout/use-menu.ts
    - apps/frontend/src/components/layout/BottomNav.tsx
    - apps/frontend/src/components/layout/__tests__/menu-por-papel.test.ts
    - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
    - apps/frontend/src/pages/DashboardPage.tsx
    - apps/frontend/src/features/operations/components/ForecastCard.tsx
    - apps/frontend/src/features/operations/components/dashboard/DayKpiStrip.tsx
    - apps/frontend/src/features/operations/components/dashboard/OpenComandasCard.tsx
    - apps/frontend/src/features/operations/components/dashboard/UpcomingContractsCard.tsx
    - apps/frontend/src/features/operations/components/dashboard/UpcomingAppointmentsCard.tsx
    - apps/frontend/src/features/operations/components/dashboard/use-today-appointments.ts
decisions:
  - "Folha do menu aparece se o id dela está ligado em myAccess (ids do menu = ids do catálogo); home sempre; grupo vazio some"
  - "Sem myAccess carregado, useMenu cai em menuForRole (filtro antigo), sem piscar vazio"
  - "Valores em dinheiro nos cartões seguem fin-controle; o KPI Atendimentos segue agenda"
metrics:
  tasks: 2
  completed: 2026-11-25
---

# Phase 10 Plan 11: Menu e painel pelo acesso Summary

Menu (barra lateral, gaveta, busca global), barra inferior e cartões do painel inicial agora leem os itens ligados em `myAccess`; o que está desligado some e não consulta a API.

## Tarefas

1. Menu e barra inferior (commit 3421497): `filterMenuByAccess`/`menuForAccess`, `useMenu`, `BottomNav` com 4 `useHasAccess`; `roles` removidos do Comercial.
2. Cartões do painel (commit dae3858): gates por item (`fin-previsao`, `fin-controle`, `fin-comandas`, `contratos`, `agenda`), `skip` nas queries e `return null`; `DashboardPage` sem coluna vazia.

## Deviations from Plan

**1. [Rule 2] KPI "Atendimentos hoje" também segue `agenda`**
- `useTodayAppointments(skip)` aceita skip; com agenda desligada a coluna some e a consulta não é feita (o plano só citava o cartão de próximos atendimentos).

**2. [Rule 3] Testes por papel reescritos**
- Em `menu-por-papel.test.ts`, os casos que dependiam de `roles` fixos do Comercial foram migrados para a matriz por item; `casco-gestor-beauty.test.tsx` passou a informar `access` da profissional. `sidebar-nav` e `menu-dom` seguem verdes sem mudança (caem no fallback por papel quando não há `access`).

## Known Stubs

Nenhum.

## Verificação

- `typecheck` e `lint` do frontend verdes; vitest de `components/layout` (45) e do painel (6) verdes.
- Nenhuma operação GraphQL alterada (sem validação de SDL).

## Self-Check: PASSED

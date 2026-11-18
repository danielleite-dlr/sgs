---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 03
subsystem: frontend
tags: [menu, permissoes, guard, rotas, feature-flag]
requires: []
provides:
  - flag FEATURES.comercial (false até o 09-15)
  - commercial-permissions.ts (espelho das permissões e ponto único da D-21)
  - menu filtrado por papel (filterMenuByRole, menuForRole, useMenu)
  - CommercialRoute e rotas /comercial/* e /contato/:orgId/:token
  - pontos de montagem LeadImportDialog, StagesSettingsTab, FormSettingsTab
affects: [09-11, 09-12, 09-13, 09-14, 09-15]
tech-stack:
  added: []
  patterns: [menu com roles por item, guard de rota por papel]
key-files:
  created:
    - apps/frontend/src/features/commercial/commercial-permissions.ts
    - apps/frontend/src/features/commercial/components/CommercialRoute.tsx
    - apps/frontend/src/components/layout/use-menu.ts
    - apps/frontend/src/features/commercial/pages/CommercialSettingsPage.tsx
  modified:
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/components/layout/menu-config.ts
    - apps/frontend/src/components/layout/SidebarNav.tsx
    - apps/frontend/src/components/layout/AppDrawer.tsx
    - apps/frontend/src/components/layout/GlobalSearchSheet.tsx
    - apps/frontend/src/router.tsx
key-decisions:
  - "Menu filtrado por papel via useMenu() na sidebar, gaveta e busca global"
  - "Rota pública /contato só é registrada com a flag comercial ligada"
requirements-completed: [COM-10]
duration: 15min
completed: 2026-11-18
---

# Phase 9 Plan 03: Frontend base, menu e guard Summary

Esqueleto do Comercial no frontend, desligado por flag: menu por papel (sidebar, gaveta e busca), espelho das permissões com a D-21 num ponto só, guard `CommercialRoute`, rotas e pontos de montagem com assinatura final para os planos 09-11 a 09-14.

## Tarefas

1. Flag `comercial` e espelho de permissões (8472475)
2. Menu por papel: `roles` em `MenuItem`, `filterMenuByRole`, `useMenu` (a56a2d1)
3. `CommercialRoute`, 7 rotas, rota pública atrás da flag, páginas provisórias (36405b0)

## Verificação

vitest (layout, config, commercial), typecheck e lint do frontend verdes.

## Deviations from Plan

- As cores das etapas em `commercial-fixtures.ts` são valores plausíveis: o 09-01 roda em paralelo e as cores finais não estavam disponíveis. Os testes das telas não dependem delas.
- O `verify` do plano usa `cd /root/sgs`; rodei no worktree.

## Known Stubs

Intencionais, substituídos pelos planos seguintes: páginas "Em construção" (09-11 a 09-13), `LeadImportDialog` e `FormSettingsTab` (09-14), `StagesSettingsTab` (09-12), `PublicLeadFormPage` (09-14).

## Self-Check: PASSED

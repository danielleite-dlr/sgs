---
phase: 05-uso-no-dia-a-dia
plan: 06b
subsystem: frontend
tags: [react, router, home, papeis]
requires: [05-06 (DashboardPage)]
provides: [homePathForRole, HomeRoute, flag dashboard ligada]
key-files:
  created:
    - apps/frontend/src/pages/HomeRoute.tsx
    - apps/frontend/src/pages/__tests__/home-route.test.tsx
  modified:
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx
    - apps/e2e/tests/smoke.spec.ts
decisions:
  - "Rota /dashboard decide pelo papel: ADMIN/MANAGER veem o painel, demais vão para /agenda; HOME_PATH segue /dashboard para login, convite e logo"
metrics:
  tasks: 2
  completed: 2026-11-06
---

# Phase 5 Plan 06b: Home por papel Summary

ADMIN e MANAGER caem no painel com a previsão ao entrar; PROFESSIONAL e ATTENDANT continuam na Agenda (D-11), via `homePathForRole` e `HomeRoute` na rota `/dashboard`.

## Commits

- a35e65a: homePathForRole, HomeRoute, flag dashboard, vitest
- 38dbf32: smoke E2E da home por papel

## Deviations from Plan

**1. [Rule 1 - Bug] sidebar-nav.test.tsx assumia "Início" oculto**
- **Found during:** Task 1 (suíte vitest inteira)
- **Fix:** o teste agora espera "Início" visível no menu (flag ligada).
- **Commit:** a35e65a

## Verification

- vitest do frontend: 65 arquivos; a única falha (sidebar-nav) foi corrigida e reexecutada com sucesso; typecheck e lint limpos.
- E2E: typecheck do pacote passa. A suíte Playwright NÃO foi executada: Postgres/Valkey locais são compartilhados com o 05-04 (testes de integração do backend) e o globalSetup/seed do E2E mexe no banco. Fica para a execução completa no 05-07.
- Verificado por busca: a outra spec que checa `/agenda` (equipe-cadastro-e-convite) navega pelo menu antes, sem depender da home.

## Known Stubs

Nenhum. `DashboardPlaceholder.tsx` permanece no repositório sem uso na rota.

## Self-Check: PASSED

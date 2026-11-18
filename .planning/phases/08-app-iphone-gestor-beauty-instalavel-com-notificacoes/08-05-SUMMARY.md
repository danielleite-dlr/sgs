---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 05
subsystem: frontend-webpush
tags: [web-push, ios, pwa, service-worker, react]
requires: [08-02, 08-03]
provides:
  - Cliente Web Push (detecção iOS/standalone, registro do SW, inscrição, sync, desinscrição)
  - WebPushBridge (toque na notificação -> rota da agenda)
  - Rota pendente no ProtectedRoute
  - Logout desinscrevendo o Web Push
affects: [08-06, 08-07]
tech-stack:
  added: []
  patterns: [funções puras com navigator/window injetáveis, ponte invisível espelhando NativeAppBridge]
key-files:
  created:
    - apps/frontend/src/infrastructure/webpush/platform-ios.ts
    - apps/frontend/src/infrastructure/webpush/push-config.api.ts
    - apps/frontend/src/infrastructure/webpush/web-push-client.ts
    - apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx
    - apps/frontend/src/infrastructure/webpush/__tests__/platform-ios.test.ts
    - apps/frontend/src/infrastructure/webpush/__tests__/web-push-client.test.ts
    - apps/frontend/src/infrastructure/webpush/__tests__/webpush-bridge.test.tsx
    - apps/frontend/src/components/__tests__/protected-route-pending.test.tsx
  modified:
    - apps/frontend/src/infrastructure/native/device-token.api.ts
    - apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts
    - apps/frontend/src/components/ProtectedRoute.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/src/features/auth/hooks/useAuth.ts
    - apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx
key-decisions:
  - "enableWebPush chama Notification.requestPermission como primeira operação assíncrona (gesto do iOS preservado)"
  - "Estado e sync usam getRegistration(), nunca ready, para não travar sem SW"
  - "isNativeApp() curto-circuita todo o Web Push (D-07)"
requirements-completed: [D-04, D-05, D-06, D-07]
metrics:
  tasks: 3
  completed: 2026-11-18
---

# Phase 8 Plan 05: Cliente Web Push e ponte no frontend Summary

Camada cliente do Web Push do app instalado no iPhone, sem UI: detecção de plataforma, registro do SW, inscrição com `userVisibleOnly` registrada como `platform ios / provider webpush`, ponte que leva o toque da notificação à agenda (com rota pendente se a sessão venceu) e logout que desinscreve.

## Commits
- fc18915: cliente Web Push do app instalado
- e03db13: toque na notificação do iPhone abre a agenda
- 140fc20: logout desinscreve o Web Push

## Verificação
- vitest do frontend inteiro: 955 de 956 verdes na primeira rodada. A única falha (`notifications-bell`, "abre a lista e marca como lida") é flake por carga da máquina (load ~50); passou isolada junto de `useAuth-logout` (10 testes).
- Testes novos: platform-ios (5), web-push-client (12), webpush-bridge (8), protected-route-pending (3), device-token-api (+1), useAuth-logout (+2).
- `tsc --noEmit` e `eslint --max-warnings 0` do frontend: limpos.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Cleanup do teste da ponte**
- O auto-cleanup do RTL rodava depois de eu remover `navigator.serviceWorker`, quebrando o cleanup do efeito. `webpush-bridge.test.tsx` chama `cleanup()` no próprio `afterEach` antes de remover o mock.
- Também troquei `typeof import(...)` (proibido pelo lint) por `Record<string, unknown>`.

Fora isso, plano executado como escrito.

## Known Stubs
Nenhum. `fetchWebPushPublicKey` e `enableWebPush` ainda não têm chamador visível; a UI vem no 08-06.

## Self-Check: PASSED
Arquivos criados e commits fc18915, e03db13, 140fc20 conferidos.

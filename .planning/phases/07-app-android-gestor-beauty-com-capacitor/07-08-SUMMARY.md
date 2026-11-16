---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 08
subsystem: frontend
tags: [capacitor, push, android, auth]
requires: [07-05]
provides:
  - NativeAppBridge montado no App (splash, barra de status, botão voltar, listeners de push, registro do token por sessão)
  - Logout remove o token do aparelho antes de encerrar a sessão
  - Login abre a rota pendente do toque na notificação
affects: [07-10, 07-11]
key-files:
  created:
    - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx
    - apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx
    - apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx
    - apps/frontend/src/features/auth/__tests__/login-pending-route.test.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/features/auth/hooks/useAuth.ts
    - apps/frontend/src/features/auth/pages/LoginPage.tsx
decisions:
  - Listeners de push entram na montagem (antes do login) para captar o toque que abriu o app a frio.
  - Registro de push uma vez por par memberId:organizationId; impersonating ou sem organização não registra.
  - Rota pendente só é consumida no destino final (senha temporária e admin de plataforma não a consomem).
metrics:
  tasks: 2
  completed: 2026-11-16
---

# Phase 7 Plan 08: Ponte nativa no frontend Summary

A ponte nativa (`NativeAppBridge`) liga splash, barra de status, botão voltar e push ao app Android, e login/logout passaram a cuidar do token do aparelho e da rota pendente, sem efeito no navegador.

## Tarefas

| Tarefa | Commit |
| ------ | ------ |
| 1. NativeAppBridge montado no App | 9b00156 |
| 2. Logout remove token e login abre rota pendente | 66b9589 |

## Desvios do plano

Nenhum. Os testes de logout e login mockam `auth.api` (como o teste existente do login) em vez de usar MockedProvider.

## Verificação

- vitest dos três arquivos novos: 17 testes verdes.
- `tsc --noEmit` e `eslint` do frontend: limpos.
- Suíte completa do frontend: 117 arquivos, 852 testes verdes.
- `vite build` do frontend: verde. E2E não executado neste plano (fica para o gate da wave).

## Self-Check: PASSED

## Known Stubs

Nenhum.

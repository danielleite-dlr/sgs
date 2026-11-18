---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 06
subsystem: frontend-ui
tags: [web-push, ios, pwa, react, login]
requires: [08-05]
provides:
  - Botão "Instalar no iPhone" com passo a passo na tela de login
  - Faixa "Ativar notificações" no app instalado
affects: [08-07]
key-files:
  created:
    - apps/frontend/src/infrastructure/webpush/InstallIphoneDialog.tsx
    - apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx
    - apps/frontend/src/features/auth/pages/__tests__/login-instalar-iphone.test.tsx
    - apps/frontend/src/infrastructure/webpush/__tests__/enable-notifications.test.tsx
  modified:
    - apps/frontend/src/features/auth/pages/LoginPage.tsx
    - apps/frontend/src/components/layout/AppShell.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
key-decisions:
  - "No iPhone fora do app instalado o botão de instalar substitui o link do APK"
  - "Faixa só renderiza com chave pública do servidor; sem chave (canal desligado) fica oculta"
requirements-completed: [D-01, D-05, D-07]
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 8 Plan 06: UI de instalar e ativar notificações Summary

Login com "Instalar no iPhone" (diálogo de 5 passos, aviso e "Copiar endereço" fora do Safari) e faixa "Ativar notificações" no topo do `<main>` do AppShell, com estados ativadas, bloqueadas, iOS antigo e adiamento de 7 dias. Android (Capacitor) e web comum não mudam (D-07).

## Commits
- 1ae9a06: botão Instalar no iPhone no login
- cfe9ea4: faixa Ativar notificações no app do iPhone

## Verificação
- vitest do frontend inteiro: 135 arquivos, 973 testes verdes. Novos: login-instalar-iphone (6), enable-notifications (11).
- `tsc --noEmit` e `eslint --max-warnings 0`: limpos. `login-baixar-apk` e `casco-gestor-beauty` seguem verdes sem alteração.

## Deviations from Plan
Nenhuma de comportamento. Detalhe: a faixa só aparece depois de obter a chave pública (chave nula = oculta), conforme o plano.

## Known Stubs
Nenhum.

## Self-Check: PASSED

---
phase: 10-permiss-es-por-usu-rio
plan: 09
subsystem: frontend-access
tags: [permissoes, frontend, apollo, zustand, myAccess]
requires: [10-03]
provides:
  - "features/access: useAccess, useAccessFresh, useHasAccess, useItemPermission, hasAccessIn, itemPermissionIn"
  - "useMyAccessSync (montado no AppShell)"
  - "ACCESS_CHANGED_EVENT / notifyAccessChanged"
  - "auth.store: access (persistido), accessFresh (nunca persistido), setAccess, markAccessStale"
affects: [10-10, 10-11, 10-12, 10-13, 10-14, 10-15, 10-16]
key-files:
  created:
    - apps/frontend/src/features/access/access.api.ts
    - apps/frontend/src/features/access/access-hooks.ts
    - apps/frontend/src/features/access/access-events.ts
    - apps/frontend/src/features/access/use-my-access.ts
    - apps/frontend/src/features/access/__tests__/access-hooks.test.ts
    - apps/frontend/src/features/access/__tests__/use-my-access.test.tsx
  modified:
    - apps/frontend/src/infrastructure/stores/auth.store.ts
    - apps/frontend/src/infrastructure/apollo/error-link.ts
    - apps/frontend/src/infrastructure/apollo/__tests__/error-link.test.ts
    - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx
    - apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx
    - apps/frontend/src/components/layout/AppShell.tsx
    - apps/frontend/src/features/operations/operations-permissions.ts
    - apps/frontend/src/features/bridal/bridal-permissions.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
decisions:
  - "ACCESS_DENIED não limpa a sessão: relê myAccess e avisa com toast (trava de 30 s)"
  - "access é persistido para o menu abrir rápido; accessFresh só vale quando veio da rede nesta sessão"
  - "useMyAccessSync usa errorPolicy 'ignore' para não derrubar a UI quando a leitura falha"
metrics:
  completed: 2026-11-25
  tasks: 2
---

# Phase 10 Plan 09: Núcleo do frontend de acessos Summary

O frontend lê `myAccess` ao montar o casco, a cada 60 s, na troca de rota (trava de 10 s), ao voltar do segundo plano (web e Capacitor) e após `ACCESS_DENIED`. O resultado vai para o store, e `useHasPermission` e `useBridalPermission` passam a usar as permissões efetivas.

## Tarefas

1. API, store e hooks de acesso (commit 9d93e26).
2. Atualização ao vivo, error-link sem logout e bridge nativa (commit 39edd38).

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Teste da bridge nativa ajustado**
- **Found during:** Task 2, vitest completo
- **Issue:** o mock de `App.addListener` em `native-app-bridge.test.tsx` guardava todo callback em `backCb`; o novo `appStateChange` o sobrescrevia, e `removeBack` agora é chamado 2 vezes.
- **Fix:** só `backButton` alimenta `backCb`; espera-se 2 remoções ao desmontar.
- **Files modified:** apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx
- **Commit:** 39edd38

**2. [Rule 2] `errorPolicy: 'ignore'` na consulta myAccess**
- Evita que erro da leitura quebre o casco; o error-link já trata os códigos.

## Verificação

- vitest do frontend inteiro: 1121 passando; as 2 falhas da bridge foram corrigidas e os 7 arquivos de native/access passam depois do ajuste (a suíte inteira não foi rerodada depois).
- `typecheck` e `lint` do frontend verdes (executados antes do ajuste do teste da bridge, que só mudou o teste).
- Não foi preciso validar GraphQL contra o SDL além do contrato do 10-03 (query copiada do plano).

## Known Stubs

Nenhum.

## Self-Check: PASSED

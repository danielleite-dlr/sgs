---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 05
subsystem: frontend
tags: [capacitor, push, deep-link, apollo, vitest]
requires: [07-01]
provides:
  - "infrastructure/native: isNativeApp, push-route, native-push, device-token.api"
  - "SchedulePage abre o atendimento de ?agendamento="
affects: [07-08, 07-10]
key-files:
  created:
    - apps/frontend/src/infrastructure/native/platform.ts
    - apps/frontend/src/infrastructure/native/push-route.ts
    - apps/frontend/src/infrastructure/native/native-push.ts
    - apps/frontend/src/infrastructure/native/device-token.api.ts
    - apps/frontend/src/infrastructure/native/__tests__/push-route.test.ts
    - apps/frontend/src/infrastructure/native/__tests__/use-native-push.test.ts
    - apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts
    - apps/frontend/src/features/operations/__tests__/schedule-deep-link.test.tsx
  modified:
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
requirements-completed: [C-03, C-04]
completed: 2026-11-16
---

# Phase 7 Plan 05: Biblioteca nativa do frontend e deep link da agenda

Camada `infrastructure/native` isolada e testada (plugins Capacitor só via `import()` dinâmico atrás de `isNativeApp()`), allowlist `/agenda` para a rota do toque, registro/remoção do token do aparelho por GraphQL, e `SchedulePage` abrindo o atendimento de `?agendamento=`.

## Commits
- 0766fa0: biblioteca nativa (Task 1)
- f915855: deep link da agenda (Task 2)

## Decisões
- O efeito do deep link só age quando a data selecionada já é a da URL e a query não está carregando, evitando tratar dados do dia anterior como "id inexistente" quando a URL muda com a página montada.
- O parâmetro `agendamento` é removido (replace) depois de tratado, inclusive se o id não existir.

## Desvios do plano
Nenhum de comportamento. No teste da agenda foi preciso incluir `__typename` e os campos de noiva/categoria nos mocks (senão o MockedProvider descarta o resultado).

## Verificação
- vitest `src/infrastructure/native`: 22 testes verdes; `schedule-deep-link`: 3 verdes
- `typecheck` e `lint` do frontend verdes
- Suíte completa do frontend: 114 arquivos, 835 testes verdes; `build` verde

## Stubs conhecidos
Nenhum. A ligação com App/login/logout é o 07-08.

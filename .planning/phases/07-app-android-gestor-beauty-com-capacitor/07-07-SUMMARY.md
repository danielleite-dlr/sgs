---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 07
subsystem: backend-push
tags: [push, fcm, bullmq, nestjs, rls]
requires: [07-02, 07-03]
provides:
  - PushEventsService.enqueue(job) (fire-and-forget, global)
  - PushService.dispatch(job)
  - PushProcessor (BullMQ) e PushModule global com provider FCM
affects: [07-09]
key-files:
  created:
    - apps/backend/src/push/push-events.service.ts
    - apps/backend/src/push/push-events.service.spec.ts
    - apps/backend/src/push/push.service.ts
    - apps/backend/src/push/push.processor.ts
    - apps/backend/src/push/push.processor.spec.ts
    - apps/backend/test/integration/push-dispatch.e2e.spec.ts
  modified:
    - apps/backend/src/push/push.module.ts
    - apps/backend/test/integration/setup.ts
decisions:
  - Worker do push desligável por PUSH_NOTIFICATIONS_WORKER=false (lido na carga do módulo); suítes de integração definem false.
  - Dedup de token por job; concorrência 10 por fatias; só lança para retry quando todos os envios falham de forma re-tentável.
requirements-completed: [C-03]
---

# Phase 7 Plan 07: Processor de push no backend Summary

Fila BullMQ de push ponta a ponta no backend: `enqueue` à prova de falha, `dispatch` com RLS (destinatários D-12/D-13, um aviso por destinatário, limpeza de tokens inválidos, retry só quando tudo falha) e `PushModule` global com provider FCM e worker condicional.

## Tarefas

| Tarefa | Commit | Resultado |
| --- | --- | --- |
| 1. PushEventsService, PushService, PushProcessor (TDD, 13 testes unitários) | b85cea1 | OK |
| 2. PushModule global, setup de integração, e2e do dispatch | 7717499 | OK |

## Verificação

- `tsc --noEmit` e `eslint --max-warnings 0` limpos no backend.
- Unitários: 45 suítes / 497 testes verdes.
- Integração `push-dispatch` + `device-tokens`: 9 testes verdes (Postgres real com RLS, provider falso).
- Integração completa: 66 suítes / 710 testes verdes (incluindo phase4-alerts-boot).

## Deviations from Plan

- [Rule 3 - Bloqueio] O worktree não tinha `.env` nem Prisma Client gerado; foi rodado `prisma generate` e as variáveis foram carregadas do `.env` do checkout principal só no processo de teste (nada versionado).

Nenhuma outra divergência.

## Known Stubs

Nenhum. Os ganchos que chamam `enqueue` nas mutations ficam para o 07-09.

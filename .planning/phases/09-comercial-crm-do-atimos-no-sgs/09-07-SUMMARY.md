---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 07
subsystem: push
tags: [push, fcm, webpush, comercial, lembretes]
requires: [09-01]
provides:
  - "PushJob commercial.reminder (alvos, mensagem, envio FCM + Web Push)"
  - "allowlist de rota do toque com /comercial/lembretes nas 4 cópias"
affects: [09-08]
key-files:
  modified:
    - apps/backend/src/push/push.types.ts
    - apps/backend/src/push/push.service.ts
    - apps/backend/src/push/push-messages.ts
    - packages/shared/src/push.ts
    - apps/frontend/public/sw.js
    - apps/frontend/src/infrastructure/native/push-route.ts
  created:
    - apps/backend/src/push/push-commercial.spec.ts
    - apps/backend/test/integration/phase9-push-reminder.e2e.spec.ts
decisions:
  - "Constante renomeada para PUSH_ROUTE_RE (AGENDA_ROUTE_RE mantido no shared e no push-route.ts por compatibilidade); teste de paridade passou a comparar PUSH_ROUTE_RE"
  - "Destinatários elegíveis: ADMIN, MANAGER e ATTENDANT ativos; responsável PROFESSIONAL ou inativo é descartado"
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 9 Plan 07: Push de lembrete e rotas Summary

Push `commercial.reminder` no `PushService` (responsável do negócio, ou quem criou, mais ADMIN/MANAGER ativos, sem duplicar) e allowlist ampliada para o toque abrir `/comercial/lembretes` no Android e no iPhone.

## O que foi feito

- **Task 1** (`1dec498`): `PUSH_ROUTE_RE = /^\/(agenda|comercial\/lembretes)(\?...)?$/` em `packages/shared`, `push-route.ts` e `sw.js`; `buildReminderRoute`; kind `commercial.reminder`; `PushData` com `appointmentId` opcional e `reminderId`. Testes novos nos três arquivos (rotas vizinhas, `..`, `//` continuam rejeitadas).
- **Task 2**: tipo no `PushJob`, `buildCommercialReminderMessage`/`buildReminderRoute` no backend, `dispatchCommercialReminder` e `sendItems` privado extraído do dispatch (comportamento idêntico, incluindo retry). `skipped: 'no-reminder'` para concluído/inexistente.

## Verificação

- Backend `src/push`: 12 suítes, 120 testes verdes; `tsc` limpo.
- Integração: phase9-push-reminder, push-dispatch, push-hooks verdes (14 testes).
- shared, vitest do SW/native e `typecheck` do frontend verdes.

## Deviations from Plan

- O commit TDD separado `test(09-07)` não foi feito: specs e implementação foram commitados juntos no `feat(09-07)` da task 2. Sem impacto funcional.
- Lembrete excluído: a tabela não tem `deleted_at`; exclusão é DELETE, então `findFirst` já devolve null.

## Known Stubs

Nenhum. O tick que dispara os jobs fica no 09-08.

## Self-Check: PASSED

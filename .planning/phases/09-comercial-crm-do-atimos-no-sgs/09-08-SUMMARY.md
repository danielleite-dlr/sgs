---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 08
subsystem: backend/commercial
tags: [lembretes, bullmq, scheduler, push, graphql]
requires: [09-04, 09-07]
provides:
  - CommercialRemindersService (CRUD, list, counts, claimDueRemindersForOrg, tick)
  - commercial-reminders.graphql (commercialReminders, commercialReminder, commercialReminderCounts, create/update/complete/delete)
  - Fila commercial-reminders com tick por minuto
  - Flag COMMERCIAL_REMINDERS_SCHEDULER
affects: [09-13, 09-15, 09-16]
key-files:
  created:
    - apps/backend/src/graphql/schema/commercial-reminders.graphql
    - apps/backend/src/commercial/commercial-reminders.service.ts
    - apps/backend/src/commercial/commercial-reminders.resolver.ts
    - apps/backend/src/commercial/commercial-reminders.scheduler.ts
    - apps/backend/src/commercial/commercial-reminders.processor.ts
    - apps/backend/test/integration/phase9-reminders.e2e.spec.ts
  modified:
    - apps/backend/src/commercial/commercial-reminders.module.ts
    - apps/backend/src/config/env.schema.ts
    - apps/backend/src/config/app-config.service.ts
    - apps/backend/test/integration/setup.ts
    - docker-compose.staging.yml
decisions:
  - "Fim do dia da org calculado em SQL (date_trunc no fuso + 1 dia AT TIME ZONE), usado por 'today' e 'upcoming'; 'today' exige dueAt >= agora (vencidos de hoje ficam em 'overdue')."
  - "Excluir: só criador ou ADMIN/MANAGER (FORBIDDEN_ROLE); editar/concluir: qualquer papel que enxergue o lembrete."
  - "Reagendar (dueAt diferente) zera notified_at; reabrir não mexe em notified_at."
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 9 Plan 08: Lembretes e agendador Summary

Lembretes do Comercial no backend: CRUD com visibilidade por papel, listas por situação (atrasados, hoje no fuso da org, próximos, concluídos), contagens para o Painel e um tick BullMQ por minuto que reivindica de forma atômica (`FOR UPDATE SKIP LOCKED`, até 200 por org) os vencidos e enfileira `commercial.reminder` no push do 09-07.

## Tarefas

1. **SDL e CRUD** (`4bdf132`): tipo `CommercialReminder` com campos planos de negócio (sem depender do 09-05), erros TITLE_REQUIRED, TITLE_TOO_LONG, DUE_INVALID, NOT_FOUND, FORBIDDEN_ROLE; com `dealId` preenche `lead_id` do negócio.
2. **Tick e flag** (`19a315a` flag/config, `4bdf132` scheduler/processor/serviço): `COMMERCIAL_REMINDERS_SCHEDULER` (padrão true; setup de integração 'false'; staging true), scheduler `commercial-reminders-tick` (`* * * * *`), módulo com workers condicionais.

## Verificação

`phase9-reminders` 7/7 verde; typecheck e lint do backend limpos.

## Deviations from Plan

- Commits de teste e implementação juntos (não separados em RED/GREEN).
- Não há spec unitária de env no repositório (`src/config` sem testes); flag coberta pela integração/typecheck.
- Plano manda `test(09-08)` + `feat(09-08)` por task; foram 2 commits `feat` agrupados por área.

## Known Stubs

Nenhum.

## Self-Check: PASSED

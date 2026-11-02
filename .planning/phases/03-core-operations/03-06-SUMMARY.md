---
phase: 03-core-operations
plan: 06
subsystem: backend-agenda
tags: [appointments, comanda, deposit, graphql]
requires: [03-03, 03-04, 03-05]
provides:
  - createVisitTx (appointments + comanda + itens + sinal atômicos)
  - mutação createVisit, Appointment.comandaCode/comandaStatus
affects: [03-07, 03-10, 03-11]
key-files:
  created:
    - apps/backend/src/appointments/visits.ts
    - apps/backend/test/integration/phase3-visit.e2e.spec.ts
    - apps/backend/test/integration/phase3-deposit-cancel.e2e.spec.ts
  modified:
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/appointments/appointments.resolver.ts
    - apps/backend/src/appointments/scheduling-guard.ts
    - apps/backend/src/graphql/schema/appointments.graphql
key-decisions:
  - "createAppointment delega a createVisitTx com 1 item: toda criação de agendamento abre comanda (D-05)"
  - "Sinal = crédito do cliente (deposit) + cash deposit_in (occurredAt = agora) + appointments.deposit_amount no 1º agendamento"
  - "Em pacote, unidades extras do mesmo serviço ficam com appointmentId null"
requirements-completed: []
duration: ~35min
completed: 2026-11-02
---

# Phase 3 Plan 06: Visita (agenda + comanda + sinal) Summary

`createVisit` e `createAppointment` gravam, numa única transação com locks por profissional, os agendamentos, a comanda aberta com os itens de serviço (variante e pacote rateado) e o sinal opcional (crédito + caixa); qualquer erro desfaz tudo.

## Tarefas e commits
1. `dd3758a` - createVisitTx, service/resolver/SDL/mapSchedulingError e suíte `phase3-visit` (9 casos).
2. `6d6880f` - suíte `phase3-deposit-cancel` (7 casos).

## Deviations from Plan
- **[Rule 3] Commits divididos de outra forma:** resolver e SDL (tarefa 2) foram para o commit 1, porque o resolver e a suíte da tarefa 1 não sobem sem o schema; o commit 2 traz só a suíte de sinal/cancelamento.
- Nada mais: o código do cancelamento (03-03) já cobria os casos da tarefa 2 sem alteração.
- Requisitos (SCHED-04, POS-01, SCHED-01) seguem Pending: falta UI.

## Notas para os próximos planos
- `createVisitTx(tx, orgId, memberId, input)` roda dentro de `runWithTenant(..., SCHEDULE_TX_OPTIONS)`; erros `SchedulingError`/`ComandaError`/`CreditError` são traduzidos por `mapSchedulingError` (agora reconhece os três).
- `AppointmentsService.create(orgId, memberId, input)` mudou de assinatura (ganhou `memberId`).
- `createVisit` devolve `VisitPayload { appointments, comandaId, errors }`; códigos novos: ITEMS_REQUIRED, TOO_MANY_ITEMS (máx. 10), INVALID_DEPOSIT, INVALID_DEPOSIT_METHOD (sinal só aceita cash/pix/credit_card/debit_card/transfer), SERVICE_NOT_IN_PACKAGE, além dos já existentes (MISSING_ASSIGNMENT, PACKAGE_NOT_FOUND, VARIANT_NOT_FOUND...).
- O sinal fica no 1º appointment (`deposit_amount`, e `appointmentId` dos movimentos). Cancelar esse agendamento não mexe no crédito.
- `appointments` (query e payloads) incluem `comanda {code,status}`; `serializeAppointment` expõe `comandaCode`/`comandaStatus`.
- Unidades extras de um mesmo serviço em pacote (quantity > 1) ficam com `appointmentId = null`; o fechamento (03-07) aplica a base de comissão em `list_unit_price` (D-23).
- Dependência circular benigna: `visits.ts` importa `parseAppointmentInterval` do service, e o service importa `createVisitTx` (uso só em tempo de execução).

## Testes
Gate completo verde: backend unit 90, integração 248 (27 suítes), frontend vitest 238; lint e typecheck limpos.

## Self-Check: PASSED

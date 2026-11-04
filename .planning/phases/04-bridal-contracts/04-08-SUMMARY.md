---
phase: 04-bridal-contracts
plan: 08
subsystem: bridal-schedule
tags: [noivas, agenda, deslocamento, cobertura-contrato, sinal]
requires: [04-05, 04-06, 04-07]
provides:
  - createBridalScheduleTx / rebuildTravelBlocksTx / cancelGroupAppointmentsTx / BRIDAL_SCHEDULE_TX_OPTIONS (bridal-schedule.ts)
  - syncContractCoverageTx / coveragePriceMapTx (bridal-coverage.ts)
  - cancelAppointmentTx / releaseComandaTx extraídos (appointment-cancel.ts)
  - mutations scheduleBridalEvent e cancelBridalGroup; BridalGroup.appointments; TimeBlock.bridalGroupId
affects: [04-11, 04-12, 04-13]
key-files:
  created:
    - apps/backend/src/appointments/appointment-cancel.ts
    - apps/backend/src/bridal/bridal-schedule.ts
    - apps/backend/src/bridal/bridal-coverage.ts
    - apps/backend/test/integration/phase4-bridal-schedule.e2e.spec.ts
    - apps/backend/test/integration/phase4-travel-blocks.e2e.spec.ts
  modified:
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/appointments/visits.ts
    - apps/backend/src/appointments/time-blocks.service.ts
    - apps/backend/src/appointments/scheduling-guard.ts
    - apps/backend/src/graphql/schema/appointments.graphql
    - apps/backend/src/graphql/schema/bridal.graphql
    - apps/backend/src/bridal/bridal.service.ts
    - apps/backend/src/bridal/bridal.resolver.ts
    - apps/backend/src/bridal/bridal-serialize.ts
    - apps/backend/src/contracts/contracts.service.ts
key-decisions:
  - "Uma visita (comanda) por pessoa e finalidade: evento e teste da mesma pessoa geram comandas distintas"
  - "Locks de todos os profissionais adquiridos 1x (ordenados) antes de qualquer leitura; createVisitTx reentra no mesmo lock"
  - "Bloqueio 'deslocamento' é do sistema: criar/excluir à mão devolve SYSTEM_BLOCK"
  - "Item coberto mantém listUnitPrice do catálogo (comissão sobre preço cheio) e unitPrice/total do contrato"
requirements-completed: []
completed: 2026-11-04
---

# Phase 4 Plan 08: Agenda do evento de noivas Summary

Evento de noivas vira agenda real: `scheduleBridalEvent` cria um agendamento por pessoa x serviço x profissional x horário e uma comanda por pessoa, com cobertura do contrato, sinal de acompanhante avulsa, bloqueios de deslocamento e cancelamento do grupo, tudo atômico e com o lock anti-conflito da fase 3.

## O que foi feito

- **Task 1** (`5e4ab93`): `cancelAppointmentTx`/`releaseComandaTx` extraídos de `AppointmentsService.cancel` (comportamento idêntico; suítes phase3 verdes sem alterar expectativas). `createVisitTx` aceita `bridal` (grupo, finalidade, cobertura com `priceByServiceId`) e recusa pacote com `PACKAGE_NOT_ALLOWED`. Kind `deslocamento` com `SYSTEM_BLOCK` e `TimeBlock.bridalGroupId` no SDL.
- **Task 2** (`37b7eff`): `bridal-schedule.ts`, `bridal-coverage.ts`, `BridalService.schedule/cancelGroup`, mutations e `BridalGroup.appointments`. `ContractsService.create/update` chamam `syncContractCoverageTx` no fim da transação; `updateBridalGroup` e `setBridalMemberCoverage` também sincronizam, e `updateBridalGroup` reconstrói os deslocamentos quando local/minutos mudam.
- **Task 3** (`ea85713`): suítes `phase4-bridal-schedule` (9 casos) e `phase4-travel-blocks` (7 casos), incluindo corrida com `Promise.all` entre dois grupos no mesmo profissional.

Gate final: lint, typecheck, 191 unitários e 208 testes de integração (phase3 + phase4, 27 suítes) verdes.

## Deviations from Plan

### Auto-fixed / ajustes

**1. [Rule 1 - Bug no plano] "7 itens" do critério 1** - noiva 2 serviços + 4 acompanhantes x 1 dá 6; a suíte inclui um segundo serviço da primeira acompanhante para chegar a 7 agendamentos e 5 comandas.

**2. [Rule 2] `cancelGroupAppointmentsTx` cancela `scheduled|confirmed|in_progress`** (`CANCELLABLE_STATUSES`) em vez de só `scheduled|confirmed`, para não deixar agendamento em andamento vivo em grupo cancelado.

**3. [Rule 2] Exclusão manual de bloqueio `deslocamento`** também devolve `SYSTEM_BLOCK` (o plano citava criar/mover; o check de banco `chk_time_blocks_travel` já impedia criar, mas excluir era possível).

**4. Assinatura de `BridalService.update`** ganhou `memberId` (necessário para `createdBy` dos bloqueios recriados); resolver ajustado.

## Pontos para planos seguintes

- **04-11 (cancelar contrato)**: chamar `cancelGroupAppointmentsTx(tx, orgId, memberId, { groupId, contractId, reason })` e depois `syncContractCoverageTx`. Atenção: com `contractId` informado, os bloqueios de deslocamento do grupo inteiro são apagados (conforme o plano) mesmo que sobrem agendamentos de acompanhantes avulsas; se isso importar, trocar por `rebuildTravelBlocksTx`.
- **04-12 (IA)**: confirmar proposta via `createBridalScheduleTx` dentro de `runWithTenant(..., BRIDAL_SCHEDULE_TX_OPTIONS)` e chamar `syncContractCoverageTx` ao final (como `BridalService.schedule` faz).
- **Pendência herdada do 04-06 (não tratada aqui)**: mudar `eventDate` via `updateBridalGroup` não recalcula o prazo do saldo do contrato nem move os agendamentos do evento já marcados (também não há bloqueio). Este plano não altera a data do evento.
- `BridalGroup.appointments` carrega até 1000 agendamentos por consulta (inclusive na listagem); se a listagem ficar pesada na UI (04-13), restringir a `bridalGroup(id)`.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos criados e commits `5e4ab93`, `37b7eff`, `ea85713` verificados.

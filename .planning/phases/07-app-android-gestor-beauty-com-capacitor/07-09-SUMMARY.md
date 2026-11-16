---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 09
subsystem: backend
tags: [push, bullmq, agenda, noivas, contratos]
requires: [07-07]
provides:
  - Ganchos pós-commit que enfileiram os jobs de push (appointment.created/cancelled, bridal.scheduled/cancelled)
affects: [07-10]
tech-stack:
  added: []
  patterns: ["enqueue fora da transação, só quando errors está vazio", "helper notify com try/catch (cinto de segurança)"]
key-files:
  created:
    - apps/backend/src/appointments/appointments.service.push.spec.ts
    - apps/backend/src/bridal/bridal.service.push.spec.ts
    - apps/backend/test/integration/push-hooks.e2e.spec.ts
  modified:
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/bridal/bridal.service.ts
    - apps/backend/src/bridal/timeline/timeline.service.ts
    - apps/backend/src/contracts/payments/contract-payments.service.ts
requirements-completed: [C-03]
duration: ~40min
completed: 2026-11-16
---

# Fase 7 Plano 09: ganchos de push no backend

Os serviços de agenda, noivas, cronograma e contrato agora enfileiram o job de push certo depois do commit e só em sucesso, sem alterar nenhuma transação.

## O que foi feito

- **AppointmentsService**: `createVisit` (cobre `create`/encaixe) enfileira `appointment.created`; `cancel` enfileira `appointment.cancelled`, exceto `reasonTag` `no_show`. `move`, `updateStatus` e `list` intocados (D-11).
- **BridalService**: `schedule` enfileira um `bridal.scheduled` com todos os ids; `cancelGroup` enfileira um `bridal.cancelled` com `since` capturado antes da transação e `groupId`.
- **ContractPaymentsService.cancel**: um `bridal.cancelled` com `contractId` e `since`.
- **BridalTimelineService.confirm (04.2)**: `confirmTimelineTx` ganhou o parâmetro opcional `createdOut: string[]` e preenche com os ids criados por `createBridalScheduleTx`; o gancho dispara `bridal.scheduled` só com os criados. Reconfirmar (mover/adotar) não avisa.
- Serviços de agenda e noivas usam um helper privado `notify` com try/catch; contrato e cronograma usam try/catch inline.

## Commits

- bdfda87: ganchos em AppointmentsService e BridalService + specs unitários
- 2295288: contrato, cronograma e integração

## Verificação

- Unit backend: 47 suítes, 509 testes verdes.
- `tsc --noEmit` e eslint sem erros.
- Integração `push-hooks`: 6/6 verdes (create, SLOT_TAKEN, cancel/no_show, move, schedule com 3 ids em 1 job, cancelGroup + dispatch com provider falso achando os atendimentos).
- Integração completa: 67 suítes, 716 testes verdes (inclui phase4 e 04.2).

## Desvios

- Os 3 ids de `appointmentIds` do job são checados pela spec de integração; o gancho de `ContractPaymentsService.cancel` e o de `confirmTimelineTx` não têm teste de integração próprio (coberto só por tipagem e pelas suítes existentes phase4-contract-cancel e phase42-* continuarem verdes).
- Os arquivos tocados já estavam fora do prettier do backend (mistura de aspas); não reformatei para não gerar diff grande. Estilo de cada arquivo mantido.
- Nenhuma mudança de assinatura causada pela 04.2 além do parâmetro opcional acima.

## Known Stubs

Nenhum.

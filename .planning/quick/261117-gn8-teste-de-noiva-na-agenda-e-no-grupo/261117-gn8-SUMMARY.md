---
phase: quick-261117-gn8
plan: 01
subsystem: agenda / noivas
tags: [graphql, agenda, bridal, teste-de-noiva]
requires: []
provides:
  - Appointment.purpose no GraphQL
  - selo "Teste" na agenda (dia, semana, detalhe)
  - BridalTrialCard no grupo (status + Agendar teste)
  - guard TRIAL_ALREADY_SCHEDULED
affects: [agenda, grupo da noiva]
key-files:
  created:
    - apps/frontend/src/features/bridal/components/BridalTrialCard.tsx
    - apps/frontend/src/features/bridal/lib/trial-rows.ts
    - apps/frontend/src/features/bridal/__tests__/bridal-trial-card.test.tsx
    - apps/frontend/src/features/operations/__tests__/agenda-teste-noiva.test.tsx
  modified:
    - apps/backend/src/graphql/schema/appointments.graphql
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/bridal/bridal-schedule.ts
    - apps/frontend/src/features/operations/components/calendar/*
    - apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx
decisions:
  - "D-01: profissional do teste vem do atendimento ativo do evento (mesma pessoa e serviço); sem evento fica em branco e não bloqueia"
metrics:
  completed: 2026-11-17
---

# Quick 261117-gn8: teste de noiva na agenda e no grupo

A agenda agora mostra o selo "Teste" nos atendimentos `purpose = 'trial'`, o grupo da noiva ganhou o card "Teste" com a ação "Agendar teste", e o backend recusa teste duplicado.

## O que foi feito

- **Backend:** `Appointment.purpose` no SDL e em `serializeAppointment`. `createBridalScheduleTx` lança `TRIAL_ALREADY_SCHEDULED` quando já existe teste ativo da mesma pessoa e serviço. O caminho do evento não foi tocado. A integração prova que agendar só o teste mantém ids, horários, status, comanda e bloqueios de deslocamento do evento.
- **Agenda:** selo "Teste" no card do dia (com `shrink-0`, inclusive em card curto), na semana e linha "Finalidade: Teste do evento" no detalhe.
- **Grupo:** `BridalTrialCard` mostra Agendado/Pendente por pessoa e serviço. "Agendar teste" monta só os pendentes, a data começa vazia e precisa ser anterior ao evento, e envia `scheduleBridalEvent` com `purpose: 'trial'`, sem sinal. A profissional vem pré-preenchida do evento ativo (D-01).
- `AiSuggestionPanel` ignora o teste ao decidir se o evento já tem agenda, então os botões do evento continuam visíveis.
- Mensagens novas em `ERROR_MESSAGES` (TRIAL_NOT_BEFORE_EVENT, TRIAL_ALREADY_SCHEDULED).

## Commits

- b0d5a9a feat(quick-261117-gn8): expor Appointment.purpose e recusar teste duplicado
- a90b37b feat(quick-261117-gn8): selo Teste na agenda e card Teste no grupo da noiva

## Gate (antes dos commits)

- Backend: lint ok, tsc ok, jest unit 47 suites / 510 testes, integração 67 suites / 717 testes.
- Frontend: lint ok (0 warnings), tsc ok, vitest 122 arquivos / 877 testes.
- E2E Playwright (noivas-contrato, cronograma-noiva, agenda-dnd, agenda-cor-profissional): 15/15.

## Deploy e CI

- Backup: /root/sgs-backups/stg-pre-teste-noiva-20261117.sql.gz (sem migration, feito mesmo assim).
- `./scripts/deploy-staging.sh` concluído; backend e frontend no ar.
- CI run 44114609237 (commit a90b37b): success.

## Conferência no staging (somente leitura, org Studio JS)

- Atendimento da Ewelly de 17/11 (Maquiagem noiva, Jessica Seixas, 14:00 UTC) tem `purpose = 'trial'`; os de 20/11 são `event`. O Penteado noiva trial dela segue pendente.
- Profissional "A definir" está ativa, é profissional e tem as categorias Maquiagem e Penteados, então aparece em `professionalsForService` dos serviços de teste (conferido por banco, não pela API).

## Deviations from Plan

- Funções puras `trialEntriesFor`/`trialRowsFor` ficaram em `lib/trial-rows.ts` em vez de no componente, por causa do warning `react-refresh/only-export-components` (lint com 0 warnings).
- `prettier --write` foi aplicado no backend e revertido: reformatava arquivos inteiros (diff de 400+ linhas). As edições foram refeitas à mão no estilo do arquivo.
- Dois commits (backend e frontend) em vez de um; o gate do backend rodou completo antes do primeiro e o do frontend antes do segundo.
- Teste de integração: `at(eventDay, 23)` inválido no helper (hora+3 > 24); usado 20.
- Teste existente `agenda-gestor-beauty` ajustado: fixture ganhou `isTrial: false` e o nome do cliente só é envolvido por wrapper quando há selo (o teste exige o nome como filho direto do card).

## Known Stubs

Nenhum.

## Self-Check: PASSED

---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 19
subsystem: scheduling
tags: [assistant-role, scheduling, suggestion, G-01]
requires: ["11-18"]
provides:
  - "Assistente fora de professionalsForService/suggestProfessionals, da sugestão do grupo (IA e heurística) e da pré-sugestão do cronograma"
  - "Gravação recusa ASSISTANT com PROFESSIONAL_IS_ASSISTANT (createVisitTx, moveAppointmentTx, loadProfessional do cronograma)"
affects: [11-21, 11-22, 11-24]
tech-stack:
  added: []
  patterns: ["NOT_ASSISTANT_ROLE_WHERE nos seletores; isAssistantRole nas gravações"]
key-files:
  created:
    - apps/backend/test/integration/phase11-assistant-scheduling.e2e.spec.ts
  modified:
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/appointments/visits.ts
    - apps/backend/src/appointments/appointment-move.ts
    - apps/backend/src/bridal/ai/ai-schedule-context.ts
    - apps/backend/src/bridal/timeline/timeline.service.ts
key-decisions:
  - "Coluna na agenda (members/allMembers), TimeBlock e vínculo de noiva ficam inalterados"
requirements-completed: [PRIO-06, PRIO-08, PRIO-10, PRIO-11]
duration: ~35min
completed: 2026-11-26
---

# Phase 11 Plan 19: Assistente fora do agendamento Summary

Quem tem papel Assistente deixa de ser sugerida ou escolhível em qualquer atendimento de serviço, e o servidor recusa com `PROFESSIONAL_IS_ASSISTANT` se alguém tentar; ela segue com coluna na agenda, bloqueios e vínculo de noiva.

## Tasks
1. Filtros e recusas nos pontos de escolha e gravação - a3a0f40
2. Integração (7 casos) - fae1c5c

## Verificação
- Unit src/scheduling, bridal, appointments, identity: 196 verdes; tsc e eslint limpos.
- Integração: phase11-assistant-scheduling (7) mais phase11-suggest-professionals, phase11-bridal-filter, phase11-assistant-role, phase91-bridal-assistant, phase4-ai-schedule, phase42-*: 13 suítes, 163 testes verdes.

## Deviations from Plan
- Teste do vínculo (caso 7) precisou de pacote com `includes_bridal_assistant` no grupo (senão ASSISTANT_NOT_ALLOWED); ajustado no spec.
- Jest de integração com `--forceExit`; dados de teste com prefixo `zz1119`.
- Imports novos seguem o estilo de aspas de cada arquivo (sem prettier em arquivo inteiro).

## Known Stubs
Nenhum.

## Self-Check: PASSED

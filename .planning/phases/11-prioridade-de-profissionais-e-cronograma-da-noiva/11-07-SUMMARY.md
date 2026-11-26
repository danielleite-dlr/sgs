---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 07
subsystem: backend
tags: [sugestao-agenda, heuristica, ranking, validador]
requires: ["11-01", "11-02", "11-03"]
provides:
  - "ScheduleContext com companionReadyBy e isFixed/dayMinutes/rotationRank por profissional"
  - "buildHeuristicProposal com ranking, reason por item não agendado e earlyByPriority"
  - "validateProposal com limite por papel (AFTER_READY_BY) e checkPriority (PRIORITY_NOT_FOLLOWED)"
affects: [11-11]
key-files:
  modified:
    - apps/backend/src/bridal/ai/ai-schedule.schema.ts
    - apps/backend/src/bridal/ai/ai-schedule-context.ts
    - apps/backend/src/bridal/ai/heuristic-scheduler.ts
    - apps/backend/src/bridal/ai/schedule-validator.ts
    - apps/backend/src/bridal/ai/heuristic-scheduler.spec.ts
    - apps/backend/src/bridal/ai/schedule-validator.spec.ts
    - apps/backend/src/bridal/ai/ai-schedule.prompt.spec.ts
    - apps/backend/src/bridal/ai/ai-schedule.service.spec.ts
key-decisions:
  - "checkPriority fica fora de validateProposal (confirm aceita edição manual)"
  - "Poda entre profissionais removida da heurística: todas as viáveis são calculadas e o ranking escolhe"
  - "Rotação na heurística usa rotationRank do contexto e, dentro da rodada, a ordem de atribuição (seq)"
requirements-completed: [PRIO-06, PRIO-09, PRIO-14, PRIO-15]
duration: 25min
completed: 2026-11-26
---

# Phase 11 Plan 07: Sugestão de agenda com prioridade e limite por papel Summary

Heurística determinística da sugestão do grupo agora escolhe a profissional pelo ranking (fixa antes de não fixa, minutos do dia somados à rodada, revezamento), respeita `companionReadyBy` para acompanhantes e lista o que não coube com motivo.

## Tarefas

1. Contexto/esquema (f9ea218): `companionReadyBy`, atributos de ranking por profissional (ordenadas por `compareCandidates` antes dos rótulos `prof_N`), elegíveis por pessoa sem a assistente do grupo e, para a noiva, só quem atende noiva; `loadRankingDataTx` ignora os agendamentos do próprio grupo.
2. Heurística e validador (ab82ea1): `reason` (`NO_ELIGIBLE_PROFESSIONAL` / `NO_FREE_PROFESSIONAL_BEFORE_LIMIT`), `earlyByPriority`, `checkPriority`, limite por papel no validador. 7 novos specs da heurística e 6 do validador.

## Verificação

- Unit `src/bridal/ai` e `src/scheduling`: 65 testes verdes; `tsc --noEmit` limpo.

## Deviations from Plan

None no código do plano. Testes antigos da heurística não precisaram de ajuste além de `reason` nos `unscheduled` e dos campos novos nas fixtures.

## Deferred Issues

Integração `phase4-ai-schedule` e `phase42-ai` (3 testes) falham: o fake da Claude monta a proposta rodando `buildHeuristicProposal` sobre o JSON do prompt, e `buildPromptInput` (ai-schedule.prompt.ts, escopo do 11-11) ainda não envia `companionReadyBy` nem isFixed/dayMinutes/rotationRank, então o contexto lido no fake fica incompleto e a proposta cai na heurística/retry. Resolve-se no 11-11 ao incluir esses campos no prompt e no hash.

## Known Stubs

None.

## Self-Check: PASSED

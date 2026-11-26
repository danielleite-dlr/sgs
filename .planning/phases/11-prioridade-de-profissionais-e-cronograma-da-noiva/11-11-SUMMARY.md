---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 11
subsystem: backend
tags: [sugestao-agenda, ia, prioridade, graphql]
requires: ["11-05", "11-07"]
provides:
  - "Prompt e hash com isFixed, dayMinutes, rotationRank e companionReadyBy"
  - "checkPriority no decide() da sugestão por IA (nunca no confirm)"
  - "View/SDL com professionalIsFixed, reason do não coube e companionReadyBy"
  - "Avisos de antecipação e de ausência de profissional para noiva/debutante"
affects: [11-12]
key-files:
  modified:
    - apps/backend/src/bridal/ai/ai-schedule.prompt.ts
    - apps/backend/src/bridal/ai/ai-schedule.prompt.spec.ts
    - apps/backend/src/bridal/ai/ai-schedule.service.ts
    - apps/backend/src/bridal/ai/ai-schedule.service.spec.ts
    - apps/backend/src/graphql/schema/ai-schedule.graphql
    - apps/backend/test/integration/phase42-ai.e2e.spec.ts
key-decisions:
  - "checkPriority roda só em decide(); confirm() não aplica, mantendo a troca manual por não fixa"
  - "Avisos de antecipação e de falta de profissional são acrescentados em suggest() e gravados em warnings (voltam também no cache)"
requirements-completed: [PRIO-07, PRIO-14, PRIO-15]
duration: 30min
completed: 2026-11-26
---

# Phase 11 Plan 11: Sugestão por IA com prioridade de fixas Summary

A sugestão de agenda do grupo (Claude ou heurística) agora recebe e respeita a prioridade de fixas: o prompt e o hash do cache de 24h incluem os atributos de ranking e o limite das acompanhantes, uma proposta da Claude que usa não fixa havendo fixa livre vira `PRIORITY_NOT_FOLLOWED` (retry e depois heurística), e a API expõe selo de não fixa, motivo do "não coube" e aviso de antecipação.

## Tarefas

1. Prompt e hash (94c3b65): `SYSTEM_PROMPT` com limite por papel e regras de prioridade; `buildPromptInput` envia `companionReadyBy` e `isFixed/dayMinutes/rotationRank`; `canonicalHash` inclui esses campos e os ordena por id. 2 specs novos.
2. Serviço, SDL e integração (d26d4d5): `checkPriority` dentro de `decide()`; `Unscheduled.reason` opcional (compatível com cache antigo); `professionalIsFixed`, `reason`, `companionReadyBy` na view e no SDL; avisos "X atendida N min antes do make-off" e o aviso D-04 de ausência de profissional que atende noiva/debutante; 3 specs unitários e 8 casos de integração novos (fixa primeiro, retry com PRIORITY_NOT_FOLLOWED, hash após markFixed, NO_ELIGIBLE_PROFESSIONAL, NO_FREE_PROFESSIONAL_BEFORE_LIMIT, debutante, confirm com troca manual).

## Verificação

- Unit `src/bridal/ai`: 53 verdes; `tsc --noEmit` limpo.
- Integração `phase4-ai-schedule`, `phase42-ai`, `phase11-bridal-filter`, `phase42-timeline-*`: 60 verdes.
- Specs da IA (carry-over do 11-07): antes 3 falhando; depois 0 falhando (`phase4-ai-schedule` + `phase42-ai`: 14 verdes antes de adicionar os novos casos; 22 com eles). A causa era a esperada: o fake da Claude roda `buildHeuristicProposal` sobre o JSON do prompt, que não trazia os campos novos.
- Suíte de integração completa não rodada (estoura o heap, conforme instrução); rodadas só as specs relevantes.

## Deviations from Plan

None - plano executado como escrito. Em `ai-schedule.service.ts` o prettier reformatou algumas linhas próximas às editadas.

## Known Stubs

None.

## Self-Check: PASSED

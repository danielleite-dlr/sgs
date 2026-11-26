---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 04
subsystem: bridal
tags: [make-off, acompanhantes, guarda, graphql, cronograma]
requires: ["11-02"]
provides:
  - "BridalGroup.companionsReadyBy na API (type e input) com validação do dia do evento"
  - "Guarda das acompanhantes com limite efetivo = mais cedo entre make-off e companionsReadyBy"
affects: [11-08]
tech-stack:
  added: []
  patterns: ["limite efetivo calculado na função pura evaluateCompanionRules"]
key-files:
  created: []
  modified:
    - apps/backend/src/bridal/timeline/timeline-guard.ts
    - apps/backend/src/bridal/timeline/timeline-guard.spec.ts
    - apps/backend/src/bridal/bridal.service.ts
    - apps/backend/src/bridal/bridal-serialize.ts
    - apps/backend/src/graphql/schema/bridal.graphql
    - apps/backend/test/integration/phase42-companion-guard.e2e.spec.ts
    - apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts
key-decisions:
  - "Código da regra continua TIMELINE_AFTER_REGISTRY; só as mensagens ganham make-off e saída das acompanhantes"
  - "Mudar o dia do evento sem informar companionsReadyBy zera o campo (evita valor em outro dia)"
requirements-completed: [PRIO-12, PRIO-13, PRIO-15]
duration: 35min
completed: 2026-11-26
---

# Phase 11 Plan 04: Acompanhantes prontas até e make-off Summary

Campo "acompanhantes prontas até" do grupo na API e guarda do agendamento manual usando o limite efetivo min(make-off, prontas até), com mensagens claras.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | Limite efetivo no guarda (TDD unitário, 27 testes em src/bridal/timeline) | be4c6c5 |
| 2 | companionsReadyBy no SDL, serviço, serialização e integração | 933c41b |

## Comportamento

- `companionsReadyBy`: omitido no update mantém, `null` limpa; fora do dia local do evento devolve `COMPANIONS_READY_BY_OUTSIDE_EVENT_DAY` (campo `companionsReadyBy`).
- Se o dia do evento muda no update e o campo não é enviado, ele é zerado (decisão do plano).
- Guarda: sem cronograma confirmado não atua; com ele, termina depois do limite recusa com `TIMELINE_AFTER_REGISTRY`. Mensagem cita "make-off" ou "saída das acompanhantes". `companionIssues` usa o valor ao vivo. Debutante segue a mesma regra.
- `confirmBridalTimeline` fica no 11-08, como previsto.

## Testes

- Unit `src/bridal/timeline`: 27 verdes.
- Integração `phase42-companion-guard` (15) e `phase4-bridal-group` (19) verdes; `tsc --noEmit` e eslint limpos.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Ambiente do worktree:** links simbólicos para `node_modules` (não versionados). O `timeline-guard.ts` usa aspas simples (o plano dizia aspas duplas só para service/serialize); mantive o estilo de cada arquivo.

**2. [Rule 1 - Teste]** No teste 11 usei proB para a segunda acompanhante, pois proA já estava ocupada (SLOT_TAKEN).

Fora isso, plano executado como escrito.

## Known Stubs

Nenhum.

## Self-Check: PASSED

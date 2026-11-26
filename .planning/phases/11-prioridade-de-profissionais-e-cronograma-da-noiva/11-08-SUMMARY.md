---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 08
subsystem: bridal-timeline
tags: [cronograma, ranking, sugestao, noiva, debutante, graphql]
requires: ["11-01", "11-02", "11-03", "11-04"]
provides:
  - "bridalTimelinePreview sugere make e penteado pelo ranking (suggested, isFixed nos brideSlots)"
  - "avisos NO_BRIDAL_PROFESSIONAL e NO_FREE_PROFESSIONAL"
  - "companionsReadyTime no input e companionsReadyBy nas visões (preview e timeline)"
affects: [11-11, 11-12]
key-files:
  created:
    - apps/backend/test/integration/phase11-bridal-empty.e2e.spec.ts
  modified:
    - apps/backend/src/bridal/timeline/timeline.service.ts
    - apps/backend/src/bridal/timeline/timeline-domain.ts
    - apps/backend/src/bridal/timeline/timeline-domain.spec.ts
    - apps/backend/src/graphql/schema/bridal-timeline.graphql
    - apps/backend/test/integration/phase42-timeline-preview.e2e.spec.ts
    - apps/backend/test/integration/phase42-timeline-confirm.e2e.spec.ts
key-decisions:
  - "Sugestão só na simulação (autoSuggest); a confirmação continua exigindo ids explícitos"
  - "Minutos da escolhida no make somam ao dia dela antes de escolher o penteado"
  - "companionsReadyTime inválido gera INVALID_COMPANIONS_READY_TIME já no cálculo (vale para preview e confirmação)"
requirements-completed: [PRIO-08, PRIO-09, PRIO-13, PRIO-15]
duration: 45min
completed: 2026-11-26
---

# Phase 11 Plan 08: cronograma da noiva com sugestão de profissionais Summary

A simulação do cronograma sugere make e penteado pelo ranking da fase 11 (fixa, menos minutos, revezamento, só quem atende noiva/debutante e está livre), avisa quando a lista é vazia e grava "Acompanhantes prontas até" na confirmação.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | Pré-sugestão, filtro da noiva e avisos no buildTimelineTx; SDL e domínio | 5115e44 |
| 2 | Gravação de companionsReadyTime e integrações | 54fbce6 |

## Testes

- Unit `src/bridal/timeline`: 29 verdes. `tsc --noEmit` e eslint limpos.
- Integração: `phase42-timeline-preview` (17), `phase42-timeline-confirm` (15), `phase11-bridal-empty` (2), `phase42-companion-guard`, `phase42-rls-rbac` (30): verdes.
- A suíte de integração completa NÃO foi rodada (execução paralela e estouro de heap); só os specs relevantes.

## Deviations from Plan

**1. [Rule 1 - Bug no teste] Assistente do grupo exige as 3 colunas**
- `chk_bg_assistant_snapshot` exige `assistantDailyRate` e `assistantLinkedAt` junto de `assistantMemberId`; o teste 3f preenche as três.

**2. [Rule 1 - Teste] Auditoria filtrada por grupo**
- O helper `audits()` do spec de confirmação passou a filtrar por `entityId: groupId`, pois o novo teste 2d gera auditorias a mais na mesma org.

**3. [Escopo] Mensagens "noiva/debutante"**
- Apenas as mensagens de tela do serviço (grupo sem noiva, adoção ambígua) variam por `eventKind`; o texto do WhatsApp e o título não mudam (D-21).

Nenhum spec antigo precisou de ajuste de fixture além do preview reescrito (testes 3 e novos 3b-3g).

## Known Stubs

Nenhum.

## Self-Check: PASSED

---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 17
subsystem: frontend-bridal
tags: [bridal, tabs, timeline, G-02]
requires: []
provides:
  - abas Pessoas | Cronograma do dia | Agenda do evento (controladas)
  - aviso "Confirme primeiro o cronograma do dia" na aba da agenda
affects: [apps/frontend bridal group page, e2e noivas]
key-files:
  modified:
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
    - apps/e2e/tests/noivas-contrato.spec.ts
decisions:
  - "Aviso não trava BridalTrialCard nem AiSuggestionPanel; some quando bridalTimeline.confirmedAt existe (cache compartilhado com a BridalTimelineTab)"
metrics:
  tasks: 2
  files: 3
completed: 2026-11-26
---

# Phase 11 Plan 17: Cronograma antes da agenda (G-02) Summary

Abas do grupo da noiva controladas na ordem Pessoas, Cronograma do dia, Agenda do evento, com aviso (e botão "Ir para o cronograma do dia") na agenda quando não há cronograma confirmado, sem bloquear teste da noiva nem sugestão de agenda.

## Commits
- 58f525f feat(11-17): página + 4 testes vitest
- e3dfab6 test(11-17): E2E da ordem das abas e do aviso

## Deviations from Plan
- [Rule 1] Os testes "não trava" e "confirmado" definem roleName MANAGER, pois o botão "Sugerir agenda IA" depende de permissão; usam `data-testid="ai-suggest"`.
- E2E não foi executado (proibido neste worktree; roda no gate 11-24). Vitest do módulo bridal (23 arquivos), tsc e eslint passaram.

## Known Stubs
None.

## Self-Check: PASSED

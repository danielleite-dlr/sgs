---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 13
subsystem: frontend-bridal
tags: [bridal, frontend, ai-schedule, vitest]
requires: ["11-06", "11-11"]
provides:
  - professionalKey(serviceId, role) para listas de profissionais por papel
  - painel da sugestão com selo "Não fixa", "Não coube" com motivo e limite das acompanhantes
affects: [BridalScheduleEditor, AiSuggestionPanel, BridalTrialCard]
tech-stack:
  added: []
  patterns: ["chave de lista '<serviceId>|bride' para noiva/debutante"]
key-files:
  created:
    - apps/frontend/src/features/bridal/__tests__/schedule-editor-bridal.test.tsx
  modified:
    - apps/frontend/src/features/bridal/lib/schedule-rows.ts
    - apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx
    - apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx
    - apps/frontend/src/features/bridal/components/BridalTrialCard.tsx
    - apps/frontend/src/features/bridal/api/ai-schedule.api.ts
    - apps/frontend/src/features/bridal/__tests__/ai-suggestion-panel.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-trial-card.test.tsx
decisions:
  - "Selo 'Não fixa' renderizado em lista própria (ai-not-fixed-list) acima do editor, pois os nomes ficam em selects; o select também sufixa '(não fixa)'."
metrics:
  tasks: 2
  completed: 2026-11-26
---

# Phase 11 Plan 13: Frontend da sugestão do grupo e filtro da noiva Summary

Editor manual, teste (prova) e painel de sugestão por IA passam a oferecer à noiva/debutante só quem atende noiva (consulta com `bridal: true`, chave `serviceId|bride`), com aviso e link para /profissionais quando não há ninguém, selo "Não fixa", seção "Não coube" com motivo em português e horário limite das acompanhantes.

## Commits
- 12c2250: editor e teste da noiva filtram por papel (professionalKey, aviso, "(não fixa)")
- 81bf0dc: painel com selo, "Não coube", companionReadyBy; API com professionalIsFixed/reason/companionReadyBy

## Deviations from Plan
- O comando `codegen` do verify não foi executado (exige backend rodando); queries escritas à mão, `tsc`, eslint e vitest (23 arquivos, 175 testes) verdes.
- Mocks de `schedule-rows.test.ts` e `ai-suggestion-override.test.tsx` também atualizados (tipos novos), fora da lista de arquivos do plano.

## Known Stubs
Nenhum.

## Self-Check: PASSED

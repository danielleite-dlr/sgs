---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 22
subsystem: frontend-operations
tags: [assistant-role, agenda, comissao, G-01, vitest]
requires: ["11-19", "11-21"]
provides:
  - "Novo agendamento e regra de comissão sem a Assistente"
  - "Card de assistente por tipo de evento (noiva/debutante)"
affects: []
key-files:
  modified:
    - apps/frontend/src/features/operations/components/calendar/types.ts
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx
    - apps/frontend/src/features/bridal/components/BridalAssistantCard.tsx
    - apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx
    - apps/frontend/src/features/catalog/__tests__/commission-rule-form.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-assistant.test.tsx
key-decisions:
  - "Grade da Agenda não é filtrada (coluna da Assistente mantida, D-20); só o VisitFormDialog usa serviceProfessionals"
  - "Clique na coluna da Assistente não pré-seleciona profissional (seedProfId)"
requirements-completed: [PRIO-11, PRIO-16, PRIO-15]
duration: ~35min
completed: 2026-11-26
---

# Phase 11 Plan 22: Assistente fora dos seletores de atendimento Summary

ScheduleProfessional.isAssistant (via isAssistantRole) filtra a Assistente do Novo agendamento e da regra de comissão sem tirar a coluna dela da grade; o card do grupo diz "debutante" quando eventKind é debutante.

## Tasks
1. Novo agendamento e comissão sem a Assistente — 9b427c5
2. Card da assistente para debutante — 19fc087

## Verification
vitest operations+catalog (448 testes) e bridal (180), typecheck e lint do frontend: verdes.

## Deviations from Plan
Nenhuma no código. Incidente de processo: uma primeira rodada de edições caiu por engano no checkout compartilhado /root/sgs; foi revertida manualmente (arquivos voltaram ao conteúdo original) e refeita no worktree.

## Self-Check: PASSED

---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 13
subsystem: frontend
tags: [lembretes, painel, relatorios, exportacao, recharts, vitest]
requires: [09-03, 09-08, 09-09, 09-11]
provides:
  - APIs gql de lembretes e de painel/relatórios
  - downloadBase64File
  - ReminderFormDialog, RemindersPage, CommercialDashboardPage, ReportsPage
affects: [09-15]
key-files:
  created:
    - apps/frontend/src/features/commercial/api/reminders.api.ts
    - apps/frontend/src/features/commercial/api/reports.api.ts
    - apps/frontend/src/features/commercial/lib/download-file.ts
    - apps/frontend/src/features/commercial/components/ReminderFormDialog.tsx
    - apps/frontend/src/features/commercial/__tests__/reminders-page.test.tsx
    - apps/frontend/src/features/commercial/__tests__/dashboard-page.test.tsx
    - apps/frontend/src/features/commercial/__tests__/reports-page.test.tsx
  modified:
    - apps/frontend/src/features/commercial/pages/RemindersPage.tsx
    - apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx
    - apps/frontend/src/features/commercial/pages/ReportsPage.tsx
key-decisions:
  - "Lembrete aberto por ?lembrete=ID aparece fixado no topo (data-highlight) e o segmento inicial é o dele"
  - "Erros de relatório BAD_USER_INPUT são traduzidos pelo extensions.reason (PERIOD_INVALID etc.)"
requirements-completed: [COM-11, COM-12]
duration: 30min
completed: 2026-11-18
---

# Phase 9 Plan 13: Lembretes, Painel e Relatórios Summary

Tela de Lembretes por situação (destino do push), Painel comercial com funil em recharts e Relatórios com filtros e exportação Excel/PDF baixada do backend em base64.

## Tarefas

1. Lembretes: lista, diálogo, destaque pelo push (61da5f5)
2. Painel e Relatórios com exportação (8413b8e)

## Verificação

vitest `src/features/commercial` (44 testes), typecheck e lint do frontend verdes.

## Deviations from Plan

- Adicionada `CommercialLeadNameQuery` (leve) para mostrar "Filtrando por {nome}" sem puxar a ficha completa.
- Lembrete de `?lembrete=ID` é renderizado fixado no topo e removido da lista para não duplicar.
- `formatRate` fica em `reports.api.ts` (evita export de não-componente em arquivo de página).
- Testes usam dados próprios (fixtures do 09-03 desatualizadas); só `setRole` é reaproveitado.

## Known Stubs

Nenhum.

## Self-Check: PASSED

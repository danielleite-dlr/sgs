---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 11
subsystem: frontend
tags: [leads, negocios, interacoes, apollo, vitest]
requires: [09-03, 09-04, 09-05]
provides:
  - APIs gql de leads, negócios e interações (reusadas pelo kanban 09-12)
  - fragmento CommercialDealFields
  - rótulos e formatação do Comercial (commercial-labels.ts)
  - LeadsPage, LeadDetailPage, LeadFormDialog, DealFormDialog, InteractionFormDialog, DuplicateWarning
affects: [09-12, 09-13]
key-files:
  created:
    - apps/frontend/src/features/commercial/api/leads.api.ts
    - apps/frontend/src/features/commercial/api/deals.api.ts
    - apps/frontend/src/features/commercial/lib/commercial-labels.ts
    - apps/frontend/src/features/commercial/components/LeadFormDialog.tsx
    - apps/frontend/src/features/commercial/components/DuplicateWarning.tsx
    - apps/frontend/src/features/commercial/components/DealFormDialog.tsx
    - apps/frontend/src/features/commercial/components/InteractionFormDialog.tsx
  modified:
    - apps/frontend/src/features/commercial/pages/LeadsPage.tsx
    - apps/frontend/src/features/commercial/pages/LeadDetailPage.tsx
key-decisions:
  - "Dinheiro tratado como texto/centavos inteiros (toCents/centsToDecimal), sem float"
  - "Selects nativos nos formulários, como no Bridal, para facilitar testes"
  - "Marcar ganho/perdido na ficha leva a /comercial/pipeline?negocio=ID&acao=ganhar|perder (diálogos no 09-12)"
requirements-completed: [COM-01, COM-04, COM-07]
duration: 25min
completed: 2026-11-18
---

# Phase 9 Plan 11: Frontend de Leads Summary

Lista de leads, cadastro com aviso de cliente existente (debounce 400 ms), ficha com negócios e histórico de interações, diálogos de negócio e de interação com "Próximo contato em", tudo com gates por papel (D-13, D-21).

## Tarefas

1. APIs, rótulos e cadastro de lead com aviso de duplicado (bfe5829)
2. Lista de leads, ficha, negócio e interação (commit da tarefa 2, ver git log)

## Verificação

vitest `src/features/commercial` (23 testes), typecheck e lint do frontend verdes.

## Deviations from Plan

- O plano sugere `useLazyQuery`; mantido, com `fetchPolicy: 'network-only'` para a checagem de duplicados sempre refletir o servidor.
- A ficha inclui também o seletor de responsável por negócio (só ADMIN/MANAGER, `assignCommercialDeal`), coerente com D-13.
- As fixtures do 09-03 (`LEAD_ANA`, `STAGES`) têm formato antigo e não batem com o SDL; os testes definem dados próprios e só usam `setRole`.
- `LeadImportDialog` foi mockado no teste da lista (corpo é do 09-14).

## Known Stubs

Nenhum neste plano. `LeadImportDialog` continua ponto de montagem do 09-14; as ações Ganhar/Perder dependem dos diálogos do 09-12 (a ficha só navega para o pipeline).

## Self-Check: PASSED

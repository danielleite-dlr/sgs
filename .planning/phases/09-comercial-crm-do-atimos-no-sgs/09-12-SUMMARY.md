---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 12
subsystem: frontend
tags: [pipeline, kanban, dnd-kit, ganho, perdido, etapas, apollo, vitest]
requires: [09-03, 09-05, 09-06, 09-11]
provides:
  - PipelinePage com kanban (PipelineBoard, StageColumn, DealCard)
  - WinDealDialog e LoseDealDialog
  - StagesSettingsTab (aba Etapas)
  - win.api.ts e stages.api.ts
affects: [09-15, 09-17]
key-files:
  created:
    - apps/frontend/src/features/commercial/api/win.api.ts
    - apps/frontend/src/features/commercial/api/stages.api.ts
    - apps/frontend/src/features/commercial/components/PipelineBoard.tsx
    - apps/frontend/src/features/commercial/components/StageColumn.tsx
    - apps/frontend/src/features/commercial/components/DealCard.tsx
    - apps/frontend/src/features/commercial/components/WinDealDialog.tsx
    - apps/frontend/src/features/commercial/components/LoseDealDialog.tsx
    - apps/frontend/src/features/commercial/__tests__/pipeline-board.test.tsx
    - apps/frontend/src/features/commercial/__tests__/win-deal-dialog.test.tsx
    - apps/frontend/src/features/commercial/__tests__/lose-deal-dialog.test.tsx
    - apps/frontend/src/features/commercial/__tests__/stages-settings.test.tsx
  modified:
    - apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx
    - apps/frontend/src/features/commercial/pages/PipelinePage.tsx
    - apps/frontend/src/features/commercial/__tests__/commercial-route.test.tsx
key-decisions:
  - "Rollback do arrastar pela camada otimista do Apollo: se a API devolve errors, a camada é descartada e o card volta; toast com a mensagem"
  - "Menu 'Mover para…' em todo card (também no computador), para teclado e WCAG 2.1 AA"
  - "Cliente do ganho vem de CommercialLeadQuery (client.id) + ClientByIdQuery; sem cliente ligada usa nome e telefone do lead"
requirements-completed: [COM-05, COM-06, COM-08, COM-09]
duration: 45min
completed: 2026-11-18
---

# Phase 9 Plan 12: Pipeline, ganho e perdido (frontend) Summary

Kanban do Pipeline com arrastar otimista (@dnd-kit/core, sem sortable) e menu "Mover para…" em cada card, diálogos de ganho (dados da cliente, debutante, sinal, abre /contratos/ID) e de perda (motivo da lista fixa), e aba de configuração das etapas.

## Tarefas

1. Kanban: `1ac458e`
2. Diálogos de ganho e perda, `?negocio=ID&acao=ganhar|perder`: `f3c06d7`
3. Aba Etapas: `074a82e`

## Verificação

vitest `src/features/commercial` (12 arquivos, 57 testes), typecheck e lint do frontend verdes.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] commercial-route.test.tsx**
- **Issue:** o teste da `CommercialSettingsPage` renderizava sem Apollo; a aba Etapas agora usa `useQuery`.
- **Fix:** envolvido em `MockedProvider mocks={[]}` (arquivo fora da lista do plano).
- **Commit:** 074a82e

**2. Rollback sem `cache.modify`** — o plano sugeria reverter com `cache.modify`; a camada otimista do Apollo já é descartada quando a resposta chega, então o card volta sozinho (testado).

**3. Sinal sugerido do pacote** — `CommercialDeal.package` não expõe o valor do sinal, então o valor do sinal começa vazio (plano dizia "quando conhecido").

**4. Testes** — o `onDragEnd` é capturado mockando `DndContext` do @dnd-kit/core; `prettier` ignorou os arquivos novos (nenhum padrão casou), então a formatação é manual.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits (1ac458e, f3c06d7, 074a82e) conferidos.

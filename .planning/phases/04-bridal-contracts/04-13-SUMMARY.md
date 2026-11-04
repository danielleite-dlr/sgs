---
phase: 04-bridal-contracts
plan: 13
subsystem: frontend-bridal
tags: [frontend, noivas, grupos, ia, agenda, react, apollo]
requires: [04-04, 04-05, 04-08, 04-12]
provides:
  - Telas /noivas (lista + criação) e /noivas/:id (pessoas, cobertura, serviços, agenda do evento, cancelamento)
  - Painel "Sugerir agenda IA" editável com confirmação explícita
  - Kind de bloqueio 'deslocamento' com rótulo próprio na agenda
affects: [04-14, 04-15]
tech-stack:
  added: []
  patterns: [documentos gql + tipos manuais, conversão de fuso via Intl (sem date-fns), formulários com useState + validação pura]
key-files:
  created:
    - apps/frontend/src/features/bridal/api/bridal.api.ts
    - apps/frontend/src/features/bridal/api/ai-schedule.api.ts
    - apps/frontend/src/features/bridal/lib/bridal-labels.ts
    - apps/frontend/src/features/bridal/lib/schedule-rows.ts
    - apps/frontend/src/features/bridal/lib/person-draft.ts
    - apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx
    - apps/frontend/src/features/bridal/components/BridalPersonFields.tsx
    - apps/frontend/src/features/bridal/components/BridalMembersCard.tsx
    - apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx
    - apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx
    - apps/frontend/src/features/bridal/components/CancelBridalGroupDialog.tsx
    - apps/frontend/src/features/bridal/__tests__/ (schedule-rows, bridal-groups-page, bridal-group-detail, ai-suggestion-panel, bridal-fixtures)
  modified:
    - apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
    - apps/frontend/src/features/operations/lib/operations-labels.ts
    - apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx
    - apps/frontend/src/features/operations/api/appointments.api.ts
key-decisions:
  - "Listagem usa fragment sem appointments (até 1000 itens); só o detalhe pede appointments"
  - "Agenda manual usa scheduleBridalEvent; confirmação da sugestão usa confirmBridalSchedule"
  - "Fuso do salão fixo America/Sao_Paulo, convertido com Intl (date-fns-tz não existe no frontend)"
  - "'Criar contrato' só aparece com contract.write; 'Cancelar grupo' com contract.cancel"
requirements-completed: []
duration: ~35min
completed: 2026-11-04
---

# Phase 4 Plan 13: Telas de grupos de noivas e sugestão de agenda IA

Lista, criação e detalhe de grupos de noivas (noiva + até 14 acompanhantes, cliente existente ou nova, serviços por pessoa, cobertura por contrato), editor da agenda do evento e painel "Sugerir agenda IA" que só grava ao confirmar.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | APIs, rótulos, lib `schedule-rows` (+ kind 'deslocamento') | f33ef17 |
| 2 e 3 | Páginas, componentes, editor de agenda, painel IA e testes | 5e7bcb4 |

## Desvios do plano

1. **[Rule 3] Sem `date-fns-tz` no frontend** — o plano mandava usar; não está nas dependências. Conversão de fuso feita com `Intl.DateTimeFormat` (`toZoned`/`fromZoned` em `schedule-rows.ts`), conforme nota do 04-04.
2. **Sem codegen** — frontend usa `gql` com tipos manuais, então o passo `codegen` do gate não se aplica.
3. **Formulário sem react-hook-form/zod** — usei `useState` + validação pura (`person-draft.ts`/`buildGroupFields`) por simplicidade; comportamento e mensagens equivalentes.
4. **Tarefas 2 e 3 em um commit** — a página de detalhe importa o painel/editor da tarefa 3; separar quebraria o build do primeiro commit.
5. `MANUAL_TIME_BLOCK_KINDS` exportado em `operations-labels.ts` para o `TimeBlockDialog` não oferecer 'deslocamento'.
6. Não há Switch/Checkbox shadcn; usei `<input type="checkbox" role="switch">` nativo.
7. Helpers extras: `lib/person-draft.ts` e `__tests__/bridal-fixtures.ts`.

## Verificação

`vitest run` 50 arquivos / 329 testes verdes; `typecheck` e `lint` limpos. Flags `noivas`/`contratos` e `router.tsx` intocados.

## Known Stubs

Nenhum.

## Self-Check: PASSED

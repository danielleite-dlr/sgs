---
phase: 03-core-operations
plan: 08
subsystem: frontend-agenda
tags: [dnd-kit, apollo, optimistic-response, schedule-grid, week-view, a11y]
requires: [03-02, 03-03, 03-06]
provides:
  - "useMoveAppointment: moveAppointment com optimisticResponse e revert por errors[]/rede"
  - "components/calendar: DayGrid, AppointmentCard, TimeBlockOverlay, WeekGrid, types, appointment-statuses"
  - "Contrato de seletores data-testid para o E2E 03-12"
  - "Toggle Dia/Semana na SchedulePage; faixa fixa 07h-22h"
affects: [03-10, 03-11, 03-12]
tech-stack:
  added: []
  patterns:
    - "AppointmentFields fragment compartilhado por query/create/move"
    - "Revert otimista sem escrever no cache: payload com appointment null deixa a camada otimista cair"
key-files:
  created:
    - apps/frontend/src/features/operations/hooks/useMoveAppointment.ts
    - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx
    - apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx
    - apps/frontend/src/features/operations/components/calendar/TimeBlockOverlay.tsx
    - apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx
    - apps/frontend/src/features/operations/components/calendar/types.ts
    - apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts
    - apps/frontend/src/features/operations/__tests__/move-appointment.test.tsx
    - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx
    - apps/frontend/src/features/operations/__tests__/week-grid.test.tsx
  modified:
    - apps/frontend/src/features/operations/api/appointments.api.ts
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  deleted:
    - apps/frontend/src/features/operations/mocks/schedule.mock.ts
key-decisions:
  - "Fragment AppointmentFields inclui comandaCode/comandaStatus (campos escalares do 03-06) além dos do plano"
  - "Sem restrictToFirstScrollableAncestor: restringiria o arrasto à área visível e atrapalharia o autoscroll; a faixa 07h-22h é validada no onDragEnd"
  - "Teclado: coordinateGetter customizado (setas = 1 slot na vertical, 1 raia na horizontal)"
requirements-completed: [SCHED-01, SCHED-02]
duration: ~45min
completed: 2026-11-02
---

# Phase 3 Plan 08: Grade da agenda (frontend) Summary

Agenda real com raias por profissional, arrastar-e-soltar otimista com revert e toast (mouse, toque e teclado), vista Semana por toggle, faixa fixa 07h-22h e bloqueios coloridos por tipo; mock da agenda removido.

## Tarefas e commits

1. API (move, time blocks, campos novos) + `useMoveAppointment` - `237346f`
2. DayGrid/AppointmentCard/TimeBlockOverlay, SchedulePage usando-os, mock removido - `9d440ac`
3. WeekGrid + toggle Dia/Semana - `2983b2b`

## Testes

- Frontend vitest: 251 (30 arquivos; +13 em relação aos 238: move 3, day-grid 6, week-grid 4)
- Backend unit: 107; integração: 266 (30 suítes); backend não foi alterado
- lint e typecheck verdes; Playwright E2E existente: 8 passando (smoke entra na agenda sem regressão)

## Deviations from Plan

- **[Rule 3] Gate por tarefa:** o gate completo (com integração) rodou verde na tarefa 1 e novamente no final; na tarefa 2 foram rodados lint, typecheck e vitest do frontend (nenhum arquivo de backend mudou entre os dois).
- **[Rule 3] `blockGridRange` em `types.ts`** (e não no `TimeBlockOverlay.tsx`) por causa da regra `react-refresh/only-export-components`.
- **[Rule 3] `@testing-library/user-event` não existe no projeto:** o teste do WeekGrid usa `fireEvent`.
- Sem teste de arrastar de ponta a ponta no jsdom (dnd-kit depende de layout real); a lógica de mover está coberta no hook e o fluxo real fica para o E2E do 03-12.
- Verificação manual com backend local (arrastar, recarregar, arrastar sobre outro card) NAO foi feita neste executor (sem navegador); o E2E 03-12 deve cobrir.

## Requisitos

SCHED-01 e SCHED-02 marcados como concluídos: o backend (locks, move, conflito) já existia, e a UI agora entrega raias dia/semana e criação (modal existente) + mover por DnD com revert. SCHED-03 permanece Pending: só a leitura dos bloqueios está pronta; criar/remover bloqueio é do 03-10.

## Known Stubs

None (blocos `onOpenAppointment`/`onOpenTimeBlock` ainda sem consumidor na página: o 03-10 liga o detalhe do agendamento e a remoção de bloqueio).

## Notas para os próximos planos

- **Seletores (não renomear):** `appointment-card-{id}` (+ `data-starts`, `data-ends`, `data-professional-id`), `lane-{professionalId}`, `slot-{professionalId}-{HH:mm}`, `time-block-{id}` (+ `data-kind`), `view-day`, `view-week`. Extras: `time-row`, `week-grid`, `week-day-YYYY-MM-DD`, `week-card-{id}`.
- Bloqueio de feriado (professionalId null) aparece em todas as raias, então `time-block-{id}` repete: use `getAllByTestId`/`.first()` no E2E.
- Card arrastável: `aria-label` termina em ". Pressione espaço para mover". No teclado: Espaço levanta, setas movem (1 slot por seta vertical, 1 raia por seta horizontal), Espaço solta, Esc cancela.
- `DayGrid` recebe `onOpenAppointment(id)` e `onOpenTimeBlock(block)`; a SchedulePage ainda NÃO passa nenhum dos dois. 03-10 liga o diálogo de detalhes/status/cancelar e a remoção de bloqueio (com `onOpenTimeBlock` o overlay vira `<button>`).
- Cancelados e no_show são filtrados da grade (`HIDDEN_STATUSES`); a legenda de filtros da lateral continua listando-os (sem efeito visual).
- `AppointmentData` agora tem `comandaId/comandaCode/comandaStatus/depositAmount/cancel*`; usem o fragment `APPOINTMENT_FIELDS` em novas queries para manter o cache coerente.
- Em modo semana, a query de agendamentos e de bloqueios usa `weekRange` (segunda a segunda); setas andam 7 dias; clicar no cabeçalho do dia volta para a vista Dia.
- As faixas azuis "fora do expediente" (09h-19h) são só visuais (constantes em DayGrid).
- Slots cobertos por bloqueio visível ficam `disabled` (inclusive feriado); com "mostrar folga" desligado, folga não bloqueia o clique visualmente, o backend continua barrando (TIME_BLOCKED).

## Self-Check: PASSED

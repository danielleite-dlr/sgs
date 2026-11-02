---
phase: 03-core-operations
plan: 08
type: execute
wave: 3
depends_on: ["03-02", "03-03"]
files_modified:
  - apps/frontend/src/features/operations/api/appointments.api.ts
  - apps/frontend/src/features/operations/hooks/useMoveAppointment.ts
  - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx
  - apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx
  - apps/frontend/src/features/operations/components/calendar/TimeBlockOverlay.tsx
  - apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/mocks/schedule.mock.ts
  - apps/frontend/src/features/operations/__tests__/move-appointment.test.tsx
  - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx
  - apps/frontend/src/features/operations/__tests__/week-grid.test.tsx
autonomous: true
requirements: [SCHED-01, SCHED-02, SCHED-03]

must_haves:
  truths:
    - "A agenda mostra raias por profissional no dia (padrão) e uma vista Semana (segunda a domingo) via toggle (D-18)"
    - "A faixa visível vai de 07h a 22h, fixa (D-25)"
    - "Atendente arrasta um card para outro horário ou outra raia; o card muda na hora e, se o servidor recusar, volta e aparece o toast 'Não foi possível mover: <motivo>' (D-04)"
    - "Arrastar também funciona por teclado (KeyboardSensor) e cada card tem aria-label com cliente, serviço e horário"
    - "Bloqueios (folga, intervalo, feriado, indisponibilidade) aparecem na raia com cor e rótulo próprios; feriado aparece em todas as raias"
    - "PROFESSIONAL vê só a própria raia e não consegue arrastar"
  artifacts:
    - path: "apps/frontend/src/features/operations/hooks/useMoveAppointment.ts"
      provides: "mutação moveAppointment com optimisticResponse e revert por errors[]"
      exports: ["useMoveAppointment"]
    - path: "apps/frontend/src/features/operations/components/calendar/DayGrid.tsx"
      provides: "grade do dia com DndContext, raias droppable, cards draggable, overlays de bloqueio"
    - path: "apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx"
      provides: "vista semana com 7 colunas"
    - path: "apps/frontend/src/features/operations/api/appointments.api.ts"
      provides: "MoveAppointmentMutation, TimeBlocksQuery, campos novos de Appointment"
      contains: "moveAppointment"
  key_links:
    - from: "DayGrid onDragEnd"
      to: "useMoveAppointment"
      via: "slotsFromDelta + shiftStartBySlots (lib/schedule-grid)"
      pattern: "slotsFromDelta\\("
    - from: "SchedulePage"
      to: "TimeBlocksQuery"
      via: "useQuery com o mesmo intervalo da agenda"
      pattern: "TimeBlocksQuery"
---

<objective>
Ligar a grade da agenda ao backend novo: extrair a grade do dia para componentes, adicionar drag-and-drop com dnd-kit e revert otimista (D-04), vista Semana (D-18), faixa fixa 07h–22h (D-25) e exibição dos bloqueios por tipo (D-02). Os diálogos (criar visita com sinal, bloqueio, cancelar, status) ficam no 03-10.

Purpose: SCHED-01/02 e o critério #1 do ROADMAP (arrastar sem double-booking).
Output: hook de mover, 4 componentes de calendário, SchedulePage enxuta usando-os, mock da agenda removido, 3 testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@.planning/phases/03-core-operations/03-02-SUMMARY.md
@.planning/phases/03-core-operations/03-03-SUMMARY.md
@.planning/phases/02-core-domain/02-UI-SPEC.md
@apps/frontend/src/features/operations/pages/SchedulePage.tsx
@apps/frontend/src/features/operations/api/appointments.api.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.
Design system: manter `#570080`/tokens atuais, `Button` do shadcn, sem cores Trinks. A agenda NÃO tem feature flag (rota `/agenda` já é real).

<interfaces>
Backend (03-03):
```graphql
moveAppointment(input: { id: UUID!, professionalId: UUID!, startsAt: DateTime! }): AppointmentPayload!  # endsAt preservando duração
timeBlocks(startsAt: DateTime!, endsAt: DateTime!, professionalId: UUID): [TimeBlock!]!
type TimeBlock { id kind professionalId startsAt endsAt allDay note createdAt }
type Appointment { ...existentes, comandaId, serviceVariantId, depositAmount: String!, cancelReason, cancelReasonTag, cancelledAt }
# erros como dado: AppointmentPayload { appointment: Appointment, errors: [UserError!]! }; códigos SLOT_TAKEN, TIME_BLOCKED, INVALID_STATUS, PROFESSIONAL_DOES_NOT_SERVE_CATEGORY
```
Frontend (03-02): `GRID_START_HOUR=7`, `GRID_END_HOUR=22`, `SLOT_MINUTES=30`, `GRID_SLOTS`, `minutesFromGridStart(d)`, `shiftStartBySlots(start, slots)`, `slotsFromDelta(deltaY, slotHeight)` (lib/schedule-grid.ts); `weekRange(date)` (lib/week-range.ts); `TIME_BLOCK_KINDS[{value,label,className}]`, `APPOINTMENT_STATUS_LABELS` (lib/operations-labels.ts).
Existentes: `canWriteAppointments(roleName)`, `seesOnlyOwnAppointments(roleName)` (schedule-permissions.ts); `toast` de `sonner`; `SchedulePage` usa `ROW_HEIGHTS`, `COL_WIDTHS`, `getAppointmentStyle`, `appointmentToSchedule`, `dayRange`.
dnd-kit 6.3.1: `DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, TouchSensor, KeyboardSensor, type DragEndEvent, type Modifier` de `@dnd-kit/core`; `restrictToFirstScrollableAncestor` de `@dnd-kit/modifiers`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: API (move + time blocks + campos novos) e hook useMoveAppointment com revert otimista</name>
  <files>apps/frontend/src/features/operations/api/appointments.api.ts, apps/frontend/src/features/operations/hooks/useMoveAppointment.ts, apps/frontend/src/features/operations/__tests__/move-appointment.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/api/appointments.api.ts
    - apps/frontend/src/features/operations/__tests__/schedule-permissions.test.tsx (padrão de teste com providers)
    - .planning/phases/03-core-operations/03-RESEARCH.md "Pattern 6" e "Pitfall 6"
  </read_first>
  <behavior>
    - com MockedProvider (cache InMemoryCache) contendo um Appointment {id:'a1', professionalId:'p1', startsAt 10:00, endsAt 11:00}: move({id:'a1', professionalId:'p2', startsAt:'…12:00'}) com resposta {appointment: {...p2, 12:00–13:00}, errors: []} → cache.readFragment('Appointment:a1').professionalId === 'p2'; toast.error não chamado
    - resposta {appointment: null, errors:[{code:'SLOT_TAKEN', message:'Horário já reservado por outra pessoa — escolha outro slot'}]} → após resolver, o cache volta a professionalId 'p1' / 10:00; toast.error chamado com 'Não foi possível mover: Horário já reservado por outra pessoa — escolha outro slot'
    - erro de rede → toast.error com 'Não foi possível mover: ' + mensagem e cache original
  </behavior>
  <action>
**appointments.api.ts**: criar `APPOINTMENT_FIELDS` (fragment `fragment AppointmentFields on Appointment { id professionalId clientId serviceId serviceVariantId comandaId depositAmount startsAt endsAt status notes cancelReason cancelReasonTag cancelledAt client { id fullName } professional { id displayName } service { id name defaultDurationMinutes category { id name } } }`) e usá-lo em `AppointmentsQuery` e `CreateAppointmentMutation` (sem mudar nomes exportados). Acrescentar:
```ts
export const MoveAppointmentMutation = gql`mutation MoveAppointment($input: MoveAppointmentInput!) { moveAppointment(input: $input) { appointment { ...AppointmentFields } errors { code message field } } } ${APPOINTMENT_FIELDS}`;
export const TimeBlocksQuery = gql`query TimeBlocks($startsAt: DateTime!, $endsAt: DateTime!, $professionalId: UUID) { timeBlocks(startsAt: $startsAt, endsAt: $endsAt, professionalId: $professionalId) { id kind professionalId startsAt endsAt allDay note } }`;
export interface TimeBlockData { id: string; kind: 'folga'|'intervalo'|'feriado'|'indisponibilidade'; professionalId: string | null; startsAt: string; endsAt: string; allDay: boolean; note: string | null }
export interface TimeBlocksQueryResult { timeBlocks: TimeBlockData[] }
export interface MoveAppointmentResult { moveAppointment: { appointment: AppointmentData | null; errors: AppointmentUserError[] } }
```
e estender `AppointmentData` com `serviceVariantId: string | null; comandaId: string | null; depositAmount: string; cancelReason: string | null; cancelReasonTag: string | null; cancelledAt: string | null; service.defaultDurationMinutes?: number`. (Verificar se `Service.defaultDurationMinutes` existe no SDL de catalog.graphql; se não existir, omitir esse campo do fragment.)

**hooks/useMoveAppointment.ts**:
```ts
export function useMoveAppointment(): (appointment: AppointmentData, target: { professionalId: string; professionalName: string; startsAt: Date }) => Promise<boolean>;
```
Calcula `endsAt = startsAt + (endsAt − startsAt original)`; chama a mutação com `optimisticResponse: { moveAppointment: { __typename: 'AppointmentPayload', appointment: { ...appointment, __typename: 'Appointment', professionalId, professional: { __typename: 'Member', id: professionalId, displayName: professionalName }, startsAt: iso, endsAt: iso }, errors: [] } }`. Ao resolver: se `errors.length > 0` → `toast.error(\`Não foi possível mover: ${errors[0].message}\`)` e retorna false (NÃO escrever no cache — a camada otimista cai sozinha porque `appointment` é null, Pitfall 6); erro de rede → mesmo toast com a mensagem do erro; sucesso → `toast.success('Agendamento movido.')`, true.
Teste do `<behavior>` com `MockedProvider` de `@apollo/client/testing`, `vi.mock('sonner')`, `renderHook`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- move-appointment && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - appointments.api.ts contém `MoveAppointmentMutation`, `TimeBlocksQuery`, `depositAmount`, `comandaId`
    - useMoveAppointment.ts contém `optimisticResponse` e `'Não foi possível mover: '` (template) e não contém `cache.writeQuery`
    - move-appointment.test.tsx passa (≥ 3 casos)
  </acceptance_criteria>
  <done>Mover agendamento é otimista e reverte sozinho quando o backend recusa, com toast claro.</done>
</task>

<task type="auto">
  <name>Task 2: DayGrid + AppointmentCard (dnd-kit, teclado, a11y) + TimeBlockOverlay, e SchedulePage usando-os com faixa 07h–22h</name>
  <files>apps/frontend/src/features/operations/components/calendar/DayGrid.tsx, apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx, apps/frontend/src/features/operations/components/calendar/TimeBlockOverlay.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/mocks/schedule.mock.ts, apps/frontend/src/features/operations/__tests__/day-grid.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (linhas 170–215 helpers; 1131–1290 estado e faixas de expediente; 1440–1660 grade)
    - apps/frontend/src/features/operations/lib/schedule-grid.ts e lib/operations-labels.ts (03-02)
    - apps/frontend/src/features/operations/hooks/useMoveAppointment.ts (Task 1)
  </read_first>
  <action>
**TimeBlockOverlay.tsx** — `export function TimeBlockOverlay({ block, slotHeight, onClick? }: { block: TimeBlockData; slotHeight: number; onClick?: (b: TimeBlockData) => void })`: posição `top = (minutesFromGridStart(start)/SLOT_MINUTES)*slotHeight`, `height = (duração/SLOT_MINUTES)*slotHeight`, recortado a [GRID_START_HOUR, GRID_END_HOUR); classes `absolute left-0 right-0 z-[5] border-l-4 px-xs text-[11px] font-semibold` + `TIME_BLOCK_KINDS[kind].className`; conteúdo: rótulo do kind + nota (truncate); `role="note"`, `aria-label={\`${label} das ${HH:mm} às ${HH:mm}\`}`; se `onClick`, vira `<button>` (o 03-10 usa para remover).

**AppointmentCard.tsx** — `export function AppointmentCard({ appointment, style, draggable, onOpen }: { appointment: ScheduleAppointment; style: CSSProperties; draggable: boolean; onOpen?: (id: string) => void })`: `useDraggable({ id: appointment.id, disabled: !draggable, data: { professionalId } })`; aplica `transform` (`translate3d`) ao `style`; `aria-label={\`${clientName}, ${service}, ${HH:mm} a ${HH:mm}${draggable ? '. Pressione espaço para mover' : ''}\`}`; mantém o conteúdo visual atual (cliente + serviço, cores por `getAppointmentStyle`) e o Tooltip; `onClick` (sem drag) chama `onOpen?.(id)`; status `cancelled`/`no_show` não aparecem (filtrados antes).

**DayGrid.tsx** — mover para cá a grade atual de `SchedulePage` (cabeçalho de profissionais + coluna de horas + raias + slots clicáveis + cards + now-line), com props:
```ts
interface DayGridProps {
  date: Date; professionals: ScheduleProfessional[]; appointments: AppointmentData[]; timeBlocks: TimeBlockData[];
  slotHeight: number; colWidth: string; canSchedule: boolean; canDrag: boolean; showFolga: boolean;
  onSlotClick: (hour: number, minute: number, professionalId: string) => void;
  onOpenAppointment?: (id: string) => void; onOpenTimeBlock?: (b: TimeBlockData) => void;
}
```
- Slots via `GRID_SLOTS` (07:00–21:30); `getAppointmentStyle` passa a usar `minutesFromGridStart` (não mais `startHour - 8`); now-line idem.
- Faixas "fora do expediente" continuam só visuais com constantes locais `VISUAL_WORK_START_HOUR = 9` e `VISUAL_WORK_END_HOUR = 19` relativas a `GRID_START_HOUR` (D-25: não bloqueiam nada).
- Overlays: para cada raia, `timeBlocks.filter(b => b.professionalId === pro.id || b.professionalId === null).filter(b => showFolga || b.kind !== 'folga')` → `TimeBlockOverlay`. Slot coberto por bloqueio fica com o botão `disabled`.
- DnD: `<DndContext sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor))} modifiers={[snapY]} onDragEnd={handleDragEnd}>` envolvendo as raias; `snapY: Modifier = ({ transform }) => ({ ...transform, y: Math.round(transform.y / slotHeight) * slotHeight })`; cada raia é `useDroppable({ id: pro.id })` (componente interno `ProfessionalLane`). `handleDragEnd({ active, over, delta })`: `slots = slotsFromDelta(delta.y, slotHeight)`, `professionalId = String(over?.id ?? appt.professionalId)`; se `slots === 0 && professionalId === appt.professionalId` retorna; `startsAt = shiftStartBySlots(new Date(appt.startsAt), slots)`; se o novo início ficar antes de 07:00 ou o fim depois de 22:00, `toast.error('Não foi possível mover: fora da faixa da agenda')` e retorna; senão `move(appt, { professionalId, professionalName, startsAt })`. Só cria `DndContext` ativo quando `canDrag` (ATTENDANT/MANAGER/ADMIN via `canWriteAppointments`).

**SchedulePage.tsx**: remover o import de `../mocks/schedule.mock` e o JSX da grade (agora `<DayGrid .../>`); adicionar `useQuery<TimeBlocksQueryResult>(TimeBlocksQuery, { variables: { startsAt: range.from, endsAt: range.to, professionalId: ownOnly ? memberId : null } })`; passar `appointments` já filtrados (status ≠ cancelled/no_show + filtros atuais de status/busca), `canDrag={canSchedule}`, `showFolga`. Remover `WORK_START_HOUR/WORK_END_HOUR` da página (foram para o DayGrid). Apagar `mocks/schedule.mock.ts` (único consumidor era `TIME_SLOTS`; conferir com `grep -rn "schedule.mock" apps/frontend/src` = vazio).

**Contrato de seletores (usado pelos E2E do 03-12 — não renomear):**
- Card: `data-testid="appointment-card-${id}"`, `data-starts="HH:mm"`, `data-ends="HH:mm"`, `data-professional-id="${professionalId}"`; `aria-label` exatamente `\`${clientName}, ${service}, ${HH:mm} a ${HH:mm}\`` (+ `". Pressione espaço para mover"` quando arrastável).
- Raia: `data-testid="lane-${professionalId}"`.
- Slot clicável: `data-testid="slot-${professionalId}-${HH:mm}"` (ex. `slot-<uuid>-10:00`).
- Bloqueio: `data-testid="time-block-${id}"` e `data-kind="${kind}"`.
- Toggle de vista (Task 3): `data-testid="view-day"` e `data-testid="view-week"`.

**day-grid.test.tsx**: renderiza `DayGrid` com 2 profissionais, 1 appointment 10:00–11:00 do p1, 1 bloco `intervalo` 12:00–13:00 do p1 e 1 `feriado` (professionalId null) 20:00–21:00 → espera `getByLabelText(/Intervalo das 12:00 às 13:00/)`, 2 overlays de Feriado (um por raia), o card com `aria-label` contendo "10:00 a 11:00", 30 linhas de horário (primeiro "7h"); com `showFolga=false` um bloco folga não aparece; `canDrag=false` → card sem "Pressione espaço".
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- day-grid move-appointment && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - DayGrid.tsx contém `DndContext`, `KeyboardSensor`, `useDroppable`, `slotsFromDelta(`, `GRID_SLOTS`
    - AppointmentCard.tsx contém `useDraggable` e `aria-label`
    - `test -f apps/frontend/src/features/operations/mocks/schedule.mock.ts` falha (arquivo removido) e `grep -rn "schedule.mock" apps/frontend/src` vazio
    - SchedulePage.tsx contém `<DayGrid` e `TimeBlocksQuery` e não contém `TIME_SLOTS`
    - day-grid.test.tsx passa (≥ 5 asserções) e consulta por `getByTestId('appointment-card-<id>')` com `data-starts="10:00"` e `data-ends="11:00"`, `getByTestId('slot-p1-10:00')` e `getByTestId('lane-p1')`
    - AppointmentCard.tsx contém `data-testid={\`appointment-card-${` e `data-starts`; DayGrid.tsx contém `` `slot-${`` e `` `lane-${`` e `` `time-block-${`` 
  </acceptance_criteria>
  <done>Grade do dia componentizada, com drag-and-drop acessível, bloqueios coloridos e faixa 07h–22h.</done>
</task>

<task type="auto">
  <name>Task 3: WeekGrid + toggle Dia/Semana na SchedulePage</name>
  <files>apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/__tests__/week-grid.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (top bar: navegador de data, `shiftDay`)
    - apps/frontend/src/features/operations/lib/week-range.ts
    - .planning/phases/03-core-operations/03-CONTEXT.md D-18
  </read_first>
  <action>
**WeekGrid.tsx** — `export function WeekGrid({ days, appointments, timeBlocks, onOpenDay, onOpenAppointment }: { days: Date[]; appointments: AppointmentData[]; timeBlocks: TimeBlockData[]; onOpenDay: (d: Date) => void; onOpenAppointment?: (id: string) => void })` (discrição D-18: colunas com cards mínimos, sem DnD, sem detalhe de profissional): `grid grid-cols-1 md:grid-cols-7`; cabeçalho de cada coluna = botão com `"seg 02/11"` (`toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })`) que chama `onOpenDay(dia)`; selo "Feriado" (classe de `TIME_BLOCK_KINDS` feriado) se houver bloco feriado no dia; lista dos appointments do dia ordenados por `startsAt`, cada card `HH:mm · cliente · serviço` com cor por status (mesmas cores `APPT_STATUSES` da página, passadas como helper exportado ou duplicadas num `statusColor()` local); dia sem agendamento mostra "Sem agendamentos" em `text-neutral-500`.

**SchedulePage.tsx**: estado `view: 'day' | 'week'` (padrão `'day'`, D-18); toggle no top bar com 2 botões (`variant` default/outline) "Dia" e "Semana" com `aria-pressed`; na semana, `range = weekRange(selectedDate)` (`startsAt/endsAt`) para `AppointmentsQuery` e `TimeBlocksQuery`, e as setas de navegação andam 7 dias; `onOpenDay` → `setSelectedDate(dia); setView('day')`. Rótulo do navegador: dia (`"qua, 04 de nov"`) ou intervalo (`"02/11 – 08/11"`). PROFESSIONAL continua com `professionalId` forçado.

**week-grid.test.tsx**: `weekRange(new Date(2026,10,4)).days` → 7 cabeçalhos, o primeiro contém "seg"; appointment de quarta aparece só na 4ª coluna; clicar no cabeçalho de sexta chama `onOpenDay` com a data de sexta; feriado no domingo mostra selo "Feriado".
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - WeekGrid.tsx existe e contém `md:grid-cols-7` e `Sem agendamentos`
    - SchedulePage.tsx contém `weekRange(`, `aria-pressed`, `'week'`, `data-testid="view-day"` e `data-testid="view-week"`
    - week-grid.test.tsx passa (≥ 4 asserções); suíte vitest completa do frontend verde
  </acceptance_criteria>
  <done>Vista Semana disponível pelo toggle, com navegação semanal e atalho para o dia.</done>
</task>

</tasks>

<verification>
Gate completo verde. Verificação manual (registrar no SUMMARY): com backend local, arrastar card para horário livre persiste após reload; arrastar sobre outro card volta com toast.
</verification>

<success_criteria>
- SCHED-01 (raias dia/semana) e SCHED-02 (mover via DnD com revert) entregues na UI
- Bloqueios visíveis por tipo (SCHED-03 leitura)
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-08-SUMMARY.md`
</output>

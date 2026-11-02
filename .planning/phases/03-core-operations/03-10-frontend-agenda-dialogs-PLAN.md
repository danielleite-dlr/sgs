---
phase: 03-core-operations
plan: 10
type: execute
wave: 4
depends_on: ["03-06", "03-08"]
files_modified:
  - apps/frontend/src/features/operations/api/appointments.api.ts
  - apps/frontend/src/features/operations/lib/visit-form.ts
  - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
  - apps/frontend/src/features/operations/components/calendar/AppointmentDetailsDialog.tsx
  - apps/frontend/src/features/operations/components/calendar/CancelAppointmentDialog.tsx
  - apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/__tests__/visit-form.test.ts
  - apps/frontend/src/features/operations/__tests__/cancel-appointment-dialog.test.tsx
  - apps/frontend/src/features/operations/__tests__/time-block-dialog.test.tsx
autonomous: true
requirements: [SCHED-02, SCHED-03, SCHED-04, POS-01]

must_haves:
  truths:
    - "Atendente cria um agendamento com 1 ou mais serviços (cada um com profissional e horário), opcionalmente de um pacote, e informa sinal recebido (R$, com máscara) + forma de pagamento; a comanda nasce junto e o código aparece no toast (D-03, D-05)"
    - "Ao clicar num card, o atendente vê os detalhes, confirma, inicia atendimento, abre a comanda e cancela com motivo obrigatório + tag (D-15)"
    - "Atendente cria bloqueio de folga/intervalo/indisponibilidade para um profissional ou feriado para o salão e remove um bloqueio pela agenda (D-02)"
    - "Conflito ou bloqueio na criação mostra 'Horário já reservado por outra pessoa — escolha outro slot' / motivo do bloqueio, sem fechar o modal (D-01)"
    - "Todas as entradas de valor, data e hora usam máscara BR"
  artifacts:
    - path: "apps/frontend/src/features/operations/lib/visit-form.ts"
      provides: "buildCreateVisitInput, expandPackageLines, suggestVariant (puros)"
      exports: ["buildCreateVisitInput", "suggestVariant"]
    - path: "apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx"
      provides: "modal Cadastrar Agendamento com múltiplos serviços, pacote e sinal"
    - path: "apps/frontend/src/features/operations/components/calendar/CancelAppointmentDialog.tsx"
      provides: "cancelamento com motivo obrigatório"
    - path: "apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx"
      provides: "criação de bloqueio dos 4 tipos"
  key_links:
    - from: "VisitFormDialog submit"
      to: "createVisit"
      via: "buildCreateVisitInput"
      pattern: "CreateVisitMutation"
    - from: "AppointmentDetailsDialog"
      to: "/comanda/:comandaId"
      via: "link condicionado a isPathEnabled('/comanda')"
      pattern: "isPathEnabled\\('/comanda'\\)"
---

<objective>
Completar a agenda na UI com os fluxos de escrita que faltam: modal de agendamento multi-serviço com pacote e sinal (via `createVisit`), detalhes do agendamento com mudança de status/cancelamento com motivo/atalho para a comanda, e criação/remoção de bloqueios.

Purpose: SCHED-03/04 na UI e a primeira metade do critério #2 (criar agendamento com sinal de R$ 50 que abre a comanda).
Output: 4 componentes de diálogo, helper puro do formulário, SchedulePage usando-os, 3 testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-06-SUMMARY.md
@.planning/phases/03-core-operations/03-08-SUMMARY.md
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

**Arquivos que este plano NÃO toca** (plano paralelo 03-11): `ComandaPage.tsx`, `ComandaListPage.tsx`, `api/comandas.api.ts`, `features.ts`, `router.tsx`, `menu-config.ts`, `pt-BR.json`.

<interfaces>
Backend (03-03, 03-06):
```graphql
createVisit(input: { clientId: UUID!, items: [{ serviceId: UUID!, serviceVariantId: UUID, professionalId: UUID!, startsAt: DateTime!, endsAt: DateTime! }!]!, packageId: UUID, deposit: { amount: String!, method: String! }, notes: String }): VisitPayload!
type VisitPayload { appointments: [Appointment!]! comandaId: UUID errors: [UserError!]! }
updateAppointmentStatus(input: { id, status: "confirmed" | "in_progress" }): AppointmentPayload!
cancelAppointment(input: { id, reason: String!, reasonTag: "cliente_desmarcou" | "profissional_doente" | "no_show" }): AppointmentPayload!
createTimeBlock(input: { kind, professionalId (null p/ feriado), startsAt, endsAt, allDay, note }): TimeBlockPayload!
deleteTimeBlock(id: UUID!): TimeBlockPayload!
type Appointment { ... comandaId comandaCode comandaStatus depositAmount cancelReason ... }
# códigos: SLOT_TAKEN, TIME_BLOCKED, BLOCK_OVERLAPS_APPOINTMENT, INVALID_SCOPE, REASON_REQUIRED, COMANDA_HAS_PAYMENTS, COMANDA_CLOSED, INVALID_DEPOSIT, INVALID_DEPOSIT_METHOD, SERVICE_NOT_IN_PACKAGE, MISSING_ASSIGNMENT, INVALID_STATUS_TRANSITION
```
Frontend: `PAYMENT_METHODS`, `TIME_BLOCK_KINDS`, `CANCEL_REASON_TAGS`, `APPOINTMENT_STATUS_LABELS` (lib/operations-labels.ts); `maskTime`, `maskDateBR`, `brDateToIso` (lib/input-masks.ts); `maskCurrency`, `unmaskCurrency` (currency-mask.ts); `DayGrid` props `onOpenAppointment(id)`, `onOpenTimeBlock(block)` (03-08); `filterProfessionalsForService`, `ProfessionalsForServiceQuery`; `ServicesQuery` (catalog/api/servicos.api.ts — conferir se traz `pricingVariants { id name price seniorityTier durationMinutes }`; se não trouxer, criar query local `ServicesWithVariantsQuery` em appointments.api.ts); `PackagesQuery` (catalog/api — conferir nome real em `features/catalog/api/`); `isPathEnabled` (config/features.ts); `useAuthStore`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib/visit-form.ts (puro) + mutações na API</name>
  <files>apps/frontend/src/features/operations/lib/visit-form.ts, apps/frontend/src/features/operations/api/appointments.api.ts, apps/frontend/src/features/operations/__tests__/visit-form.test.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/api/appointments.api.ts (após 03-08: APPOINTMENT_FIELDS)
    - apps/frontend/src/features/catalog/api/servicos.api.ts e a API de pacotes em apps/frontend/src/features/catalog/api/
    - apps/frontend/src/features/operations/lib/input-masks.ts
  </read_first>
  <behavior>
    - buildCreateVisitInput({ clientId:'c1', date:'04/11/2026', lines:[{serviceId:'s1', variantId:null, professionalId:'p1', time:'10:00', durationMinutes:60}], packageId:null, depositAmount:'50,00', depositMethod:'pix' }) → { ok:true, input:{ clientId:'c1', items:[{ serviceId:'s1', serviceVariantId:null, professionalId:'p1', startsAt: ISO de 04/11/2026 10:00 local, endsAt: ISO 11:00 local }], packageId:null, deposit:{ amount:'50.00', method:'pix' } } }
    - depositAmount '' → deposit null; depositAmount '0,00' → deposit null
    - data inválida '31/02/2026' → { ok:false, error:'Data inválida.' }; hora '25:00' → 'Hora inválida.'; linha sem profissional → 'Escolha o profissional de cada serviço.'; nenhuma linha → 'Inclua ao menos um serviço.'
    - expandPackageLines(pacote { services:[{serviceId:'s1', quantity:1, defaultDurationMinutes:60}, {serviceId:'s2', quantity:2, defaultDurationMinutes:30}] }, '10:00') → 2 linhas (1 por serviço distinto), s2 começa 11:00 (sequencial)
    - suggestVariant(variants [{id:'v1', seniorityTier:'senior'}, {id:'v2', seniorityTier:null}], 'senior') === 'v1'; tier sem variante correspondente → null
  </behavior>
  <action>
**lib/visit-form.ts**:
```ts
export interface VisitLine { serviceId: string; variantId: string | null; professionalId: string; time: string; durationMinutes: number }
export interface VisitFormValues { clientId: string; date: string /* dd/mm/aaaa */; lines: VisitLine[]; packageId: string | null; depositAmount: string /* máscara BR */; depositMethod: string; notes?: string }
export type BuildResult = { ok: true; input: CreateVisitInputVars } | { ok: false; error: string };
export function buildCreateVisitInput(v: VisitFormValues): BuildResult;
export function expandPackageLines(pkg: { services: { serviceId: string; quantity: number; defaultDurationMinutes: number }[] }, startTime: string, professionalId?: string): VisitLine[]; // 1 linha por serviço distinto, horários em sequência
export function suggestVariant(variants: { id: string; seniorityTier: string | null }[], tier: string | null): string | null; // Fase 2 D-07: sugere pela senioridade do profissional
```
Datas montadas em horário local do navegador (mesma convenção do `dayRange` atual); `deposit.amount = unmaskCurrency(depositAmount)`; `depositMethod ∈ PAYMENT_METHODS` (sem crédito).
**appointments.api.ts**: `CreateVisitMutation` (`createVisit(input: $input) { appointments { ...AppointmentFields comandaCode comandaStatus } comandaId errors { code message field } }`), `UpdateAppointmentStatusMutation`, `CancelAppointmentMutation`, `CreateTimeBlockMutation`, `DeleteTimeBlockMutation`, + `comandaCode comandaStatus` no `APPOINTMENT_FIELDS`, + interfaces de resultado.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- visit-form && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - visit-form.ts exporta `buildCreateVisitInput`, `expandPackageLines`, `suggestVariant`
    - appointments.api.ts contém `CreateVisitMutation`, `CancelAppointmentMutation`, `CreateTimeBlockMutation`, `DeleteTimeBlockMutation`, `UpdateAppointmentStatusMutation`, `comandaCode`
    - visit-form.test.ts passa (≥ 8 casos)
  </acceptance_criteria>
  <done>Montagem do input da visita isolada e testada; mutações disponíveis.</done>
</task>

<task type="auto">
  <name>Task 2: VisitFormDialog (multi-serviço, pacote, sinal) substituindo o AppointmentModal</name>
  <files>apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (AppointmentModal ~linhas 800–1130: busca de cliente, serviço, data/hora/duração, filtro de profissional por serviço, maskTime/maskDateBR locais)
    - apps/frontend/src/features/operations/lib/visit-form.ts (Task 1)
  </read_first>
  <action>
Extrair o `AppointmentModal` de `SchedulePage.tsx` para `components/calendar/VisitFormDialog.tsx` (mesmo visual: `Dialog`, labels `text-xs font-semibold text-neutral-700`, mesma busca de cliente) e evoluí-lo:
- Props: `{ open; onOpenChange; initialTime?: { hour; minute; profId? }; date: Date; professionals: ScheduleProfessional[]; onCreated: (r: { comandaId: string | null; comandaCode: string | null }) => void }`.
- Campos: cliente (busca atual); data (`maskDateBR`, pré-preenchida com a data da agenda em dd/mm/aaaa); select opcional "Pacote" (lista de pacotes; ao escolher, `expandPackageLines` substitui as linhas); lista de **linhas de serviço**, cada uma com serviço, variante (select com `pricingVariants`; `suggestVariant` pela `seniorityTier` do profissional escolhido; opção "Preço padrão"), profissional (filtrado por `ProfessionalsForServiceQuery` como hoje), hora (`maskTime`), duração (min, numérico; padrão = variante.durationMinutes ?? service.defaultDurationMinutes); botões "+ Adicionar serviço" e remover linha (mínimo 1; com pacote, linhas fixas por serviço do pacote e sem "+").
- Bloco "Sinal recebido (opcional)": valor com `maskCurrency` (`inputMode="numeric"`, prefixo "R$") + select de forma (`PAYMENT_METHODS`, padrão "pix"); texto de ajuda "O sinal fica como crédito do cliente e é usado no fechamento da comanda."
- Observações (`Textarea`).
- Salvar: `buildCreateVisitInput`; `!ok` → mensagem inline em `text-error-600` (não fechar); `CreateVisitMutation`; `errors.length > 0` → mensagem inline com `errors[0].message` (SLOT_TAKEN mostra exatamente "Horário já reservado por outra pessoa — escolha outro slot") e o modal continua aberto; sucesso → `toast.success(\`Agendamento criado. Comanda ${code} aberta.\`)`, `onCreated`, fecha. Botão "Salvar" com estado de loading (`disabled` + "Salvando…").
- `SchedulePage.tsx`: remover o `AppointmentModal` antigo e as funções locais `maskTime`/`maskDateBR` (importar de `lib/input-masks.ts`), usar `<VisitFormDialog>`; `onCreated` → `refetch` de appointments e timeBlocks. `CreateAppointmentMutation` continua exportada (usada pelo seed E2E/compat), mas a UI passa a usar `createVisit`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - VisitFormDialog.tsx contém `CreateVisitMutation`, `maskCurrency`, `Sinal recebido`, `Adicionar serviço`, `suggestVariant(`
    - SchedulePage.tsx contém `<VisitFormDialog` e não contém `function AppointmentModal` nem `function maskTime`
    - vitest/typecheck/lint verdes
  </acceptance_criteria>
  <done>Modal de agendamento cria visita multi-serviço/pacote com sinal e abre a comanda.</done>
</task>

<task type="auto">
  <name>Task 3: AppointmentDetailsDialog + CancelAppointmentDialog + TimeBlockDialog ligados à agenda</name>
  <files>apps/frontend/src/features/operations/components/calendar/AppointmentDetailsDialog.tsx, apps/frontend/src/features/operations/components/calendar/CancelAppointmentDialog.tsx, apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/__tests__/cancel-appointment-dialog.test.tsx, apps/frontend/src/features/operations/__tests__/time-block-dialog.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (top bar e FilterPanel, onde entram os botões)
    - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx (onOpenAppointment, onOpenTimeBlock)
    - apps/frontend/src/components/ui/alert-dialog.tsx, radio-group.tsx, textarea.tsx
  </read_first>
  <action>
**CancelAppointmentDialog.tsx** — `{ appointment; open; onOpenChange; onCancelled }`: `RadioGroup` com `CANCEL_REASON_TAGS` (opcional) + `Textarea` "Motivo" obrigatório (`aria-required`, contador; botão "Cancelar agendamento" `variant="destructive"` desabilitado até `reason.trim().length >= 3` — vale para todos os papéis, D-15/adendo); escolher a tag "No-show" preenche o motivo com "Cliente não compareceu" se vazio; se `depositAmount !== "0.00"` mostra aviso "O sinal de R$ X continua como crédito do cliente."; `CancelAppointmentMutation`; erros (`COMANDA_HAS_PAYMENTS`, `COMANDA_CLOSED`) → `toast.error(message)`.

**AppointmentDetailsDialog.tsx** — `{ appointment: AppointmentData | null; open; onOpenChange; canWrite: boolean; onChanged }`: cliente, serviço, profissional, data/hora, status (`APPOINTMENT_STATUS_LABELS`), sinal (`formatCurrencyDisplay(depositAmount)` se > 0), comanda (`comandaCode` + status); ações (só `canWrite`): "Confirmar" (status scheduled → confirmed), "Iniciar atendimento" (scheduled|confirmed → in_progress) via `UpdateAppointmentStatusMutation`; "Abrir comanda" → `<Link to={\`/comanda/${comandaId}\`}>` renderizado só se `comandaId && isPathEnabled('/comanda')`; "Cancelar" abre `CancelAppointmentDialog`.

**TimeBlockDialog.tsx** — `{ open; onOpenChange; professionals; defaultDate: Date; defaultProfessionalId?; onCreated }`: `RadioGroup` dos 4 `TIME_BLOCK_KINDS` com amostra de cor; select de profissional (oculto e enviado `null` quando `feriado` — D-02 org-wide); data `maskDateBR`; checkbox "Dia inteiro" (padrão marcado para folga/feriado; quando marcado envia 00:00 → 00:00 do dia seguinte locais e `allDay: true`); início/fim `maskTime` (fim > início, senão erro inline "O fim deve ser depois do início."); nota opcional; `CreateTimeBlockMutation`; erros do payload inline (ex.: `BLOCK_OVERLAPS_APPOINTMENT`).

**SchedulePage.tsx**: botão "Bloquear horário" (ícone `Ban`/`Lock` de lucide) no top bar e no FilterPanel, só com `canSchedule`; `DayGrid onOpenAppointment` → `AppointmentDetailsDialog`; `WeekGrid onOpenAppointment` idem; `onOpenTimeBlock` → `AlertDialog` "Remover bloqueio de <tipo> das HH:mm às HH:mm?" → `DeleteTimeBlockMutation` (só `canSchedule`; PROFESSIONAL só vê). Após qualquer mutação: refetch de appointments + timeBlocks.

**Comportamento com a flag `comanda` desligada (o 03-11 liga na mesma wave):** `router.tsx` filtra `PROTECTED_ROUTES` por `isPathEnabled(r.path)` e rota não registrada cai no 404; o `menu-config` poda itens desligados. Por isso, quando `isPathEnabled('/comanda')` é `false`, o botão "Abrir comanda" NÃO é renderizado (o código da comanda continua visível como texto em `data-testid="appointment-comanda-code"`). Nenhum teste deste plano depende de a rota estar habilitada: os testes de `AppointmentDetailsDialog` (se escritos) fazem `vi.mock('@/config/features', ...)` para os dois casos ou testam só a ausência/presença conforme o mock.

**Contrato de seletores (usado pelos E2E do 03-12 — não renomear):**
- VisitFormDialog: `visit-form` (raiz), `visit-client-search`, `visit-client-option-${clientId}`, `visit-date`, `visit-package`, `visit-line-${i}-service`, `visit-line-${i}-variant`, `visit-line-${i}-professional`, `visit-line-${i}-time`, `visit-line-${i}-duration`, `visit-add-line`, `visit-deposit-amount`, `visit-deposit-method`, `visit-submit`, `visit-error` (mensagem inline de erro; recebe o texto de `errors[0].message`).
- AppointmentDetailsDialog: `appointment-details`, `appointment-comanda-code`, `appointment-confirm`, `appointment-start`, `appointment-open-comanda` (link; só existe com a flag ligada), `appointment-cancel`.
- CancelAppointmentDialog: `cancel-reason` (textarea), `cancel-reason-tag-${value}` (radio, valores de `CANCEL_REASON_TAGS`), `cancel-submit`.
- TimeBlockDialog: botão de abertura `block-open` ("Bloquear horário"), `block-kind-${value}`, `block-professional`, `block-date`, `block-all-day`, `block-start`, `block-end`, `block-submit`, `block-error`.

**Testes**: `cancel-appointment-dialog.test.tsx` (botão desabilitado com "ab", habilitado com "Cliente viajou"; tag no-show preenche o motivo; envia `reasonTag: 'no_show'`); `time-block-dialog.test.tsx` (selecionar "Feriado" esconde o select de profissional e envia `professionalId: null`; fim antes do início mostra o erro).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - CancelAppointmentDialog.tsx contém `CANCEL_REASON_TAGS` e `reason.trim().length >= 3` (ou constante equivalente `MIN_REASON = 3`)
    - AppointmentDetailsDialog.tsx contém `isPathEnabled('/comanda')` e `UpdateAppointmentStatusMutation`
    - TimeBlockDialog.tsx contém `TIME_BLOCK_KINDS` e `professionalId: null` (ou lógica `kind === 'feriado' ? null`)
    - SchedulePage.tsx contém `Bloquear horário`, `<AppointmentDetailsDialog`, `<TimeBlockDialog`, `DeleteTimeBlockMutation`
    - os 2 testes novos passam; suíte vitest completa verde
    - `grep -c 'data-testid="visit-' VisitFormDialog.tsx` ≥ 6 (ou via template para as linhas `visit-line-${i}-…`), e os arquivos contêm `visit-deposit-amount`, `visit-submit`, `visit-error`, `cancel-reason`, `cancel-submit`, `appointment-open-comanda`, `appointment-comanda-code`, `block-open`, `block-submit`
    - Nenhum teste do plano depende de `FEATURES.comanda === true`: com `vi.mock` da flag desligada, `queryByTestId('appointment-open-comanda')` é `null` e `appointment-comanda-code` aparece
  </acceptance_criteria>
  <done>Agenda completa na UI: detalhes, status, cancelamento com motivo, bloqueios dos 4 tipos e atalho para a comanda.</done>
</task>

</tasks>

<verification>
Gate completo verde.
</verification>

<success_criteria>
- SCHED-03/04 operáveis pela UI; criação de agendamento abre comanda com código visível
- Nenhuma entrada sem máscara BR
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-10-SUMMARY.md`
</output>

---
phase: 04-bridal-contracts
plan: 08
type: execute
wave: 3
depends_on: ["04-05", "04-06"]
files_modified:
  - apps/backend/src/appointments/appointment-cancel.ts
  - apps/backend/src/appointments/appointments.service.ts
  - apps/backend/src/appointments/visits.ts
  - apps/backend/src/appointments/time-blocks.service.ts
  - apps/backend/src/appointments/scheduling-guard.ts
  - apps/backend/src/graphql/schema/appointments.graphql
  - apps/backend/src/bridal/bridal-schedule.ts
  - apps/backend/src/bridal/bridal-coverage.ts
  - apps/backend/src/bridal/bridal.service.ts
  - apps/backend/src/bridal/bridal.resolver.ts
  - apps/backend/src/graphql/schema/bridal.graphql
  - apps/backend/src/contracts/contracts.service.ts
  - apps/backend/test/integration/phase4-bridal-schedule.e2e.spec.ts
  - apps/backend/test/integration/phase4-travel-blocks.e2e.spec.ts
autonomous: true
requirements: [CLI-03, CONT-01]

must_haves:
  truths:
    - "Agendar o evento cria um agendamento real por pessoa × serviço × profissional × horário e uma comanda por pessoa (D-03, D-07)"
    - "Itens de pessoa incluída no contrato entram na comanda com contract_id e o preço acordado; extras ficam fora da cobertura (D-08)"
    - "Acompanhante avulsa pode deixar sinal no agendamento do evento (crédito + caixa, D-07)"
    - "Conflito com outro agendamento ou bloqueio devolve SLOT_TAKEN/TIME_BLOCKED e nada é gravado; dois grupos concorrentes no mesmo profissional: só um vence"
    - "Evento externo cria bloqueios 'deslocamento' antes/depois por profissional; bloqueio que colide com agendamento impede o evento (D-04)"
    - "Teste de maquiagem antes do evento vira agendamento com purpose 'trial' (D-05)"
    - "Criar/editar contrato depois do agendamento sincroniza a cobertura das comandas abertas; comandas fechadas não mudam (D-25)"
    - "Cancelar o grupo cancela os agendamentos com motivo e remove os bloqueios de deslocamento"
  artifacts:
    - path: "apps/backend/src/bridal/bridal-schedule.ts"
      exports: ["createBridalScheduleTx", "rebuildTravelBlocksTx", "cancelGroupAppointmentsTx", "BRIDAL_SCHEDULE_TX_OPTIONS"]
    - path: "apps/backend/src/bridal/bridal-coverage.ts"
      exports: ["syncContractCoverageTx"]
    - path: "apps/backend/src/appointments/appointment-cancel.ts"
      exports: ["cancelAppointmentTx"]
  key_links:
    - from: "bridal-schedule.ts"
      to: "acquireScheduleLocks + createVisitTx"
      via: "locks de todos os profissionais 1x (ordenados) e uma visita por pessoa/finalidade na mesma transação"
      pattern: "acquireScheduleLocks"
    - from: "contracts.service.ts create/update"
      to: "syncContractCoverageTx"
      via: "chamada no fim da transação"
      pattern: "syncContractCoverageTx"
---

<objective>
Agenda do evento de noivas (D-03, D-04, D-05, D-07, D-08): transformar pessoa × serviço × profissional × horário em agendamentos reais usando o lock anti-conflito e `createVisitTx` da fase 3, com cobertura do contrato nas comandas, sinal de acompanhante avulsa, bloqueios de deslocamento, teste antes do evento, sincronização de cobertura e cancelamento do grupo.

Purpose: CLI-03 completo e entrada para a IA (04-12 confirma propostas via `createBridalScheduleTx`) e para o cancelamento do contrato (04-11 usa `cancelGroupAppointmentsTx`).
Output: `bridal-schedule.ts`, `bridal-coverage.ts`, `appointment-cancel.ts`, extensões de `visits.ts`/time blocks, mutations `scheduleBridalEvent`/`cancelBridalGroup`, 2 suítes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-05-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-06-SUMMARY.md
@apps/backend/src/appointments/visits.ts
@apps/backend/src/appointments/scheduling-guard.ts
@apps/backend/src/appointments/appointments.service.ts
@apps/backend/src/appointments/time-blocks.service.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase3 phase4`.

<interfaces>
```typescript
// visits.ts (atual)
export const MAX_VISIT_ITEMS = 10;
export interface VisitItemInput { serviceId; serviceVariantId?; professionalId; startsAt: Date|string; endsAt: Date|string }
export interface CreateVisitInput { clientId; items: VisitItemInput[]; packageId?; deposit?: { amount: string; method: string } | null; notes? }
export async function createVisitTx(tx, orgId, memberId, input): Promise<{ appointmentIds: string[]; comandaId: string }>;
// scheduling-guard.ts
export const SCHEDULE_TX_OPTIONS = { timeout: 10000, maxWait: 5000 };
export async function acquireScheduleLocks(tx, orgId, professionalIds: string[]): Promise<void>; // advisory xact, reentrante
export async function assertSlotFree(tx, { professionalId, startsAt, endsAt, ignoreAppointmentId? }): Promise<void>; // TIME_BLOCKED | SLOT_TAKEN
export function mapSchedulingError(e): { code; message; field } | null;
// appointments.service.ts: cancel(orgId, memberId, { id, reason, reasonTag }) — corpo em runWithTenant com FOR UPDATE,
//   CANCELLABLE_STATUSES, private releaseComanda(tx, appointmentId, comandaId, reason) (COMANDA_CLOSED se fechada).
// comanda-items.ts: recalcComandaTotal(tx, comandaId)
// bridal (04-05): BridalService, BridalError, mapBridalError, serializeBridalGroup, BRIDAL_GROUP_INCLUDE
// contracts (04-06): ContractsService.create/update rodam em runWithTenant(orgId, tx => ...)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extrair cancelAppointmentTx, estender createVisitTx e o kind 'deslocamento'</name>
  <files>apps/backend/src/appointments/appointment-cancel.ts, apps/backend/src/appointments/appointments.service.ts, apps/backend/src/appointments/visits.ts, apps/backend/src/appointments/time-blocks.service.ts, apps/backend/src/appointments/scheduling-guard.ts, apps/backend/src/graphql/schema/appointments.graphql</files>
  <read_first>
    - apps/backend/src/appointments/appointments.service.ts (cancel + releaseComanda completos)
    - apps/backend/src/appointments/visits.ts (inteiro)
    - apps/backend/src/appointments/time-blocks.service.ts
    - apps/backend/test/integration/phase3-deposit-cancel.e2e.spec.ts (regressão a manter)
  </read_first>
  <action>
1. `appointment-cancel.ts`: mover o corpo transacional de `AppointmentsService.cancel` (FOR UPDATE, checagem de `CANCELLABLE_STATUSES`, `releaseComanda`, update de status/motivo) para `export async function cancelAppointmentTx(tx, a: { appointmentId: string; memberId: string; reason: string; reasonTag?: string | null }): Promise<void>` (mais `releaseComandaTx` exportado internamente). `AppointmentsService.cancel` mantém validação de motivo/tag e passa a chamar `cancelAppointmentTx` dentro do seu `runWithTenant`, depois recarrega com `APPOINTMENT_INCLUDE`. Comportamento idêntico (as suítes phase3 provam).
2. `visits.ts`: `CreateVisitInput` ganha `bridal?: { groupId: string; purpose: 'event' | 'trial'; coverage?: { contractId: string; priceByServiceId: Record<string, string> } | null } | null`. Ao criar `appointment`: `bridalGroupId`, `purpose`, e `contractId` quando `coverage` e o serviço está em `priceByServiceId`. Depois de `buildServiceItem`, para itens cobertos: `contractId = coverage.contractId`, `unitPrice = priceByServiceId[serviceId]`, `total = unitPrice × quantity`, `listUnitPrice` inalterado (comissão por preço cheio — D-08/03 D-23). `bridal` com `packageId` → `SchedulingError('PACKAGE_NOT_ALLOWED')`.
3. `time-blocks.service.ts`: exportar `SYSTEM_TIME_BLOCK_KINDS = ['deslocamento'] as const`; `TIME_BLOCK_KINDS` (manuais) fica com os 4 atuais; criar/mover/excluir manualmente bloco `deslocamento` → erro `SYSTEM_BLOCK` ("Bloqueio de deslocamento é gerado pelo grupo de noivas."); a listagem continua devolvendo todos (inclui `bridalGroupId` no retorno se o SDL de TimeBlock tiver o campo — adicionar `bridalGroupId: UUID` em `appointments.graphql` `type TimeBlock`). `scheduling-guard.ts`: `KIND_LABELS.deslocamento = 'deslocamento'`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test:integration -- phase3-appointments phase3-deposit-cancel phase3-time-blocks phase3-visit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function cancelAppointmentTx" apps/backend/src/appointments/appointment-cancel.ts` encontra; `grep -n "cancelAppointmentTx" apps/backend/src/appointments/appointments.service.ts` encontra
    - `grep -n "priceByServiceId" apps/backend/src/appointments/visits.ts` encontra
    - `grep -n "SYSTEM_BLOCK" apps/backend/src/appointments/time-blocks.service.ts` encontra
    - Suítes phase3 listadas verdes sem alterar expectativas
  </acceptance_criteria>
  <done>Peças da fase 3 reutilizáveis pelo fluxo do evento sem mudar comportamento existente.</done>
</task>

<task type="auto">
  <name>Task 2: createBridalScheduleTx, deslocamento, sincronização de cobertura, cancelamento do grupo e mutations</name>
  <files>apps/backend/src/bridal/bridal-schedule.ts, apps/backend/src/bridal/bridal-coverage.ts, apps/backend/src/bridal/bridal.service.ts, apps/backend/src/bridal/bridal.resolver.ts, apps/backend/src/graphql/schema/bridal.graphql, apps/backend/src/contracts/contracts.service.ts</files>
  <read_first>
    - apps/backend/src/bridal/bridal.service.ts e bridal.resolver.ts (04-05)
    - apps/backend/src/contracts/contracts.service.ts (04-06: create/update)
    - apps/backend/src/appointments/visits.ts (Task 1)
    - .planning/phases/04-bridal-contracts/04-RESEARCH.md ("Pattern 2")
  </read_first>
  <action>
1. `bridal-coverage.ts`: `syncContractCoverageTx(tx, orgId, groupId): Promise<void>` — contrato vivo do grupo (`status <> 'cancelled'`) com itens; para cada agendamento do grupo com comanda `open`: coberto ⇔ membro `covered_by_contract` ∧ contrato vivo ∧ existe `contract_items` (group_member_id, service_id, purpose = appointment.purpose). Coberto → `appointments.contract_id = contrato`, itens de comanda desse agendamento `contract_id = contrato`, `unit_price = contract_item.unit_price`, `total = unit_price × quantity`; não coberto → `contract_id NULL` e `unit_price = list_unit_price`. `recalcComandaTotal` em cada comanda tocada. Comandas `closed`/`cancelled` não são tocadas (D-25). Exportar também `coveragePriceMapTx(tx, groupId, groupMemberId, purpose)` → `{ contractId, priceByServiceId } | null`.
2. `bridal-schedule.ts`:
   - `BRIDAL_SCHEDULE_TX_OPTIONS = { timeout: 30000, maxWait: 5000 }` (transação maior que a da fase 3 — Pitfall 6).
   - `createBridalScheduleTx(tx, orgId, memberId, input: { groupId; items: { groupMemberId; serviceId; professionalId; startsAt; endsAt; purpose?: 'event'|'trial' }[]; deposits?: { groupMemberId; amount; method }[] }): Promise<{ appointmentIds: string[] }>`: grupo `active` (`GROUP_NOT_ACTIVE`); `acquireScheduleLocks(tx, orgId, todosProfessionalIds)` UMA vez antes de tudo; membro pertence ao grupo (`MEMBER_NOT_IN_GROUP`); `purpose` default 'event'; evento: data local de `startsAt` (fuso da org) = `event_date` (`EVENT_DATE_MISMATCH`); trial: data local < `event_date` (`TRIAL_NOT_BEFORE_EVENT`); máximo 150 itens (`TOO_MANY_ITEMS`); sinal só para membro NÃO coberto (`DEPOSIT_ONLY_FOR_UNCOVERED`) e só em itens 'event'. Agrupar itens por (groupMemberId, purpose) e, para cada grupo, `createVisitTx(tx, orgId, memberId, { clientId, items, deposit, bridal: { groupId, purpose, coverage: coveragePriceMapTx(...) quando membro coberto } })`. Ao final `rebuildTravelBlocksTx(tx, orgId, memberId, groupId)`.
   - `rebuildTravelBlocksTx`: se `location_kind = 'external'` e (`travel_minutes_before` + `after`) > 0: `DELETE FROM time_blocks WHERE bridal_group_id = $g`; para cada profissional com agendamentos 'event' ativos do grupo: bloco `[primeiroInício − before, primeiroInício)` e `[últimoFim, últimoFim + after)` (pular minutos 0); antes de criar cada bloco `assertSlotFree(tx, { professionalId, startsAt, endsAt })` (colisão → `TIME_BLOCKED`/`SLOT_TAKEN`, desfaz tudo); `kind 'deslocamento'`, `bridal_group_id`, `note` = `Deslocamento — ${group.name}`. Se o grupo é estúdio, apenas apagar blocos existentes.
   - `cancelGroupAppointmentsTx(tx, orgId, memberId, { groupId; contractId?: string | null; reason }): Promise<number>`: para cada agendamento do grupo (filtrado por `contract_id` se informado) em `scheduled|confirmed` → `cancelAppointmentTx` (comanda fechada → `COMANDA_CLOSED` propaga); depois `DELETE FROM time_blocks WHERE bridal_group_id = $g`. Retorna quantos cancelou.
3. `BridalService`: `schedule(orgId, memberId, input)` em `runWithTenant(orgId, fn, BRIDAL_SCHEDULE_TX_OPTIONS)` + `syncContractCoverageTx` + erro via `mapBridalError` (que já delega a `mapSchedulingError`); `cancelGroup(orgId, memberId, { id, reason })`: motivo ≥ 3 (`REASON_REQUIRED`), contrato vivo → `CANCEL_CONTRACT_FIRST`, `cancelGroupAppointmentsTx`, `status 'cancelled'`, `cancelled_at`, `cancel_reason`, `recordAudit('bridal.cancel')`. `update()` e `setCoverage()` chamam `syncContractCoverageTx` + `rebuildTravelBlocksTx` (update, quando local/deslocamento mudou) dentro da transação.
4. `bridal.graphql`:
```graphql
input BridalScheduleItemInput { groupMemberId: UUID!  serviceId: UUID!  professionalId: UUID!  startsAt: DateTime!  endsAt: DateTime!  purpose: String }
input BridalDepositInput { groupMemberId: UUID!  amount: String!  method: String! }
input ScheduleBridalEventInput { groupId: UUID!  items: [BridalScheduleItemInput!]!  deposits: [BridalDepositInput!] }
type BridalSchedulePayload { group: BridalGroup  appointmentIds: [UUID!]!  errors: [UserError!]! }
input CancelBridalGroupInput { id: UUID!  reason: String! }
type BridalAppointment { id: UUID!  groupMemberId: UUID  clientName: String!  serviceName: String!  professionalId: UUID!  professionalName: String!  startsAt: DateTime!  endsAt: DateTime!  status: String!  purpose: String  covered: Boolean!  comandaId: UUID  comandaStatus: String }
extend type BridalGroup { appointments: [BridalAppointment!]! }   # se o Apollo schema-first não aceitar extend type de objeto do mesmo arquivo, adicionar o campo direto no type BridalGroup
extend type Mutation {
  scheduleBridalEvent(input: ScheduleBridalEventInput!): BridalSchedulePayload!
  cancelBridalGroup(input: CancelBridalGroupInput!): BridalGroupPayload!
}
```
   Resolver: `scheduleBridalEvent` com `BRIDAL_WRITE` + `APPOINTMENT_WRITE` (usar o decorator que aceite as duas; se só aceitar uma, `BRIDAL_WRITE` e checar `APPOINTMENT_WRITE` no service via PermissionService); `cancelBridalGroup` com `CONTRACT_CANCEL` (somente ADMIN/MANAGER — mesmo padrão D-19). `serializeBridalGroup` passa a preencher `appointments` (status, comanda, `covered = contract_id IS NOT NULL`).
5. `contracts.service.ts` (04-06): no fim das transações de `create` e `update`, chamar `syncContractCoverageTx(tx, orgId, groupId)`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test:integration -- phase4-bridal-group phase4-contracts-core</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "acquireScheduleLocks" apps/backend/src/bridal/bridal-schedule.ts` encontra
    - `grep -n "export async function syncContractCoverageTx" apps/backend/src/bridal/bridal-coverage.ts` encontra
    - `grep -n "syncContractCoverageTx" apps/backend/src/contracts/contracts.service.ts` encontra ≥ 2
    - `grep -n "scheduleBridalEvent(input: ScheduleBridalEventInput!): BridalSchedulePayload!" apps/backend/src/graphql/schema/bridal.graphql` encontra
    - `grep -n "DEPOSIT_ONLY_FOR_UNCOVERED\|EVENT_DATE_MISMATCH\|CANCEL_CONTRACT_FIRST" apps/backend/src/bridal/*.ts` encontra os 3
  </acceptance_criteria>
  <done>Evento agendável de ponta a ponta com cobertura, sinal, deslocamento e cancelamento.</done>
</task>

<task type="auto">
  <name>Task 3: Suítes phase4-bridal-schedule e phase4-travel-blocks</name>
  <files>apps/backend/test/integration/phase4-bridal-schedule.e2e.spec.ts, apps/backend/test/integration/phase4-travel-blocks.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/phase3-scheduling-concurrency.e2e.spec.ts (padrão de corrida com Promise.all)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
    - apps/backend/test/integration/phase3-time-blocks.e2e.spec.ts
  </read_first>
  <action>
**phase4-bridal-schedule** (grupo via mutation `createBridalGroup` do 04-05 com noiva coberta + 4 acompanhantes; `proA`/`proB` atendem a categoria):
1. `scheduleBridalEvent` com 7 itens (noiva 2 serviços, 4 acompanhantes 1 cada, horários sem conflito no dia do evento) → 7 agendamentos com `bridal_group_id`, 5 comandas (uma por pessoa), `purpose 'event'` (critério 1).
2. Sem contrato: itens sem `contract_id`. Criar contrato (`createContract` com itens da noiva a preço acordado diferente do catálogo) → `syncContractCoverageTx` marca as comandas abertas da noiva com `contract_id`, `unit_price` acordado, `list_unit_price` de catálogo; comanda da noiva `owed "0.00"`.
3. Sinal de acompanhante avulsa R$ 50 pix → `client_credit_movements` deposit + `cash_movements deposit_in`; sinal para a noiva (coberta) → `DEPOSIT_ONLY_FOR_UNCOVERED`.
4. Conflito: agendamento existente de `proA` no mesmo horário → `SLOT_TAKEN` e nenhum agendamento do grupo criado (contar antes/depois).
5. Concorrência: dois grupos, `Promise.all` de dois `scheduleBridalEvent` que disputam `proA` no mesmo intervalo → exatamente um sem erros e o outro com `SLOT_TAKEN`.
6. Teste (trial) 15 dias antes → agendamento `purpose 'trial'`; trial no dia do evento → `TRIAL_NOT_BEFORE_EVENT`; item 'event' em outro dia → `EVENT_DATE_MISMATCH`.
7. D-25: fechar a comanda da noiva; `updateContract` mudando preço → comanda fechada intacta.
8. `cancelBridalGroup` com contrato vivo → `CANCEL_CONTRACT_FIRST`; grupo sem contrato → agendamentos `cancelled` com o motivo e grupo `cancelled`; ATTENDANT → permissão negada.
**phase4-travel-blocks:** grupo `external`, travel 30/45: (1) agendar → para cada profissional 2 `time_blocks` `deslocamento` com `bridal_group_id` e janelas exatas; (2) agendamento de outra cliente de `proA` nos 30 min anteriores → agendar o evento falha com `SLOT_TAKEN` e nada é gravado; (3) criar `time_block` manual `deslocamento` pela mutation da fase 3 → `SYSTEM_BLOCK`; (4) novo agendamento no horário do deslocamento → `TIME_BLOCKED`; (5) `updateBridalGroup` para `studio` remove os blocos; (6) cancelar grupo remove blocos.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-bridal-schedule phase4-travel-blocks</automated>
  </verify>
  <acceptance_criteria>
    - As 2 suítes verdes; `grep -n "Promise.all" apps/backend/test/integration/phase4-bridal-schedule.e2e.spec.ts` encontra
    - `grep -n "deslocamento" apps/backend/test/integration/phase4-travel-blocks.e2e.spec.ts` encontra
    - `corepack pnpm --filter @sgs/backend test:integration -- phase3` continua verde
  </acceptance_criteria>
  <done>D-03, D-04, D-05, D-07, D-08 e D-25 provados por integração.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase3 phase4` verde.</verification>

<success_criteria>Grupo de noivas vira agenda real sem conflitos, com cobertura correta do contrato e deslocamento bloqueando o profissional.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-08-SUMMARY.md`
</output>

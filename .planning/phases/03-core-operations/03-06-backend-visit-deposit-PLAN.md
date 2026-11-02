---
phase: 03-core-operations
plan: 06
type: execute
wave: 3
depends_on: ["03-03", "03-04", "03-05"]
files_modified:
  - apps/backend/src/appointments/visits.ts
  - apps/backend/src/appointments/scheduling-guard.ts
  - apps/backend/src/appointments/appointments.service.ts
  - apps/backend/src/appointments/appointments.resolver.ts
  - apps/backend/src/graphql/schema/appointments.graphql
  - apps/backend/test/integration/phase3-visit.e2e.spec.ts
  - apps/backend/test/integration/phase3-deposit-cancel.e2e.spec.ts
autonomous: true
requirements: [SCHED-04, POS-01, SCHED-01]

must_haves:
  truths:
    - "Criar um agendamento (1 serviço ou vários, de um ou mais profissionais, opcionalmente de um pacote) cria na mesma transação N appointments + 1 comanda aberta com os serviços como itens (D-05)"
    - "createAppointment (mutação existente) também abre a comanda"
    - "Sinal informado na criação (ex. R$ 50 via Pix) vira crédito do cliente (+50, kind deposit), entrada de caixa deposit_in no dia do recebimento e deposit_amount no appointment (D-03, D-22)"
    - "Se qualquer serviço da visita conflitar ou estiver bloqueado, nada é gravado (nem appointment, nem comanda, nem sinal)"
    - "Cancelar agendamento com sinal exige motivo e o crédito do cliente permanece disponível (D-15)"
  artifacts:
    - path: "apps/backend/src/appointments/visits.ts"
      provides: "createVisitTx(tx, …) — appointments + comanda + itens + sinal numa transação"
      exports: ["createVisitTx"]
    - path: "apps/backend/src/graphql/schema/appointments.graphql"
      provides: "createVisit, CreateVisitInput, VisitPayload, Appointment.comandaCode/comandaStatus"
      contains: "createVisit"
  key_links:
    - from: "visits.createVisitTx"
      to: "comandas/comanda-open.openComandaTx"
      via: "mesma tx"
      pattern: "openComandaTx\\(tx"
    - from: "visits.createVisitTx"
      to: "financial/client-credit.recordCreditMovement + financial/cash-ledger.recordCashMovement"
      via: "sinal"
      pattern: "kind: 'deposit'"
    - from: "visits.createVisitTx"
      to: "scheduling-guard.acquireScheduleLocks/assertSlotFree"
      via: "locks ordenados de todas as raias"
      pattern: "acquireScheduleLocks\\("
---

<objective>
Fechar o acoplamento agenda ↔ comanda ↔ sinal: `createVisit` (vários serviços/raias, pacote opcional, sinal opcional) e `createAppointment` passam a abrir a comanda na mesma transação (D-05); o sinal entra como crédito do cliente + entrada de caixa (D-03/D-22); cancelamento com sinal preserva o crédito (D-15).

Purpose: critério de sucesso #2 do ROADMAP (agendamento + sinal R$50 + comanda) no backend e SCHED-04.
Output: `appointments/visits.ts`, mutação `createVisit`, campos `comandaCode/comandaStatus` no Appointment, 2 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-03-SUMMARY.md
@.planning/phases/03-core-operations/03-04-SUMMARY.md
@.planning/phases/03-core-operations/03-05-SUMMARY.md
@apps/backend/src/appointments/appointments.service.ts
@apps/backend/src/appointments/scheduling-guard.ts
@apps/backend/src/comandas/comanda-open.ts
@apps/backend/src/comandas/comanda-items.ts
@apps/backend/src/financial/client-credit.ts
@apps/backend/src/financial/cash-ledger.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.

**Arquivos que este plano NÃO toca** (plano paralelo 03-07): `src/comandas/**`, `comandas.graphql`, `src/financial/**`, `src/catalog/**`.

<interfaces>
De 03-03 (`appointments/scheduling-guard.ts`, `appointment-status.ts`):
```ts
acquireScheduleLocks(tx, orgId, professionalIds: string[]): Promise<void>
assertSlotFree(tx, { professionalId, startsAt, endsAt, ignoreAppointmentId? }): Promise<void>
class SchedulingError(code, message, field); mapSchedulingError(e) → {code,message,field} | null
SCHEDULE_TX_OPTIONS = { timeout: 10000, maxWait: 5000 }
parseAppointmentInterval(startsAt, endsAt) (appointments.service.ts)
```
De 03-04 (`comandas/*`):
```ts
openComandaTx(tx, { orgId, clientId, openedBy, now? }): Promise<Comanda>
buildServiceItem(tx, { orgId, comandaId, serviceId, serviceVariantId?, professionalId, quantity, appointmentId?, createdBy }): Promise<Prisma.ComandaItemUncheckedCreateInput>
expandPackageItems(tx, { orgId, comandaId, packageId, assignments: { serviceId, professionalId, serviceVariantId?, appointmentId? }[], createdBy }): Promise<Prisma.ComandaItemUncheckedCreateInput[]>
recalcComandaTotal(tx, comandaId); class ComandaError(code, message, field)
CASH_METHODS = ['cash','pix','credit_card','debit_card','transfer'] (comanda-math.ts)
```
De 03-05 (`financial/*`):
```ts
lockClient(tx, clientId); recordCreditMovement(tx, { orgId, clientId, amountCents, kind, appointmentId?, comandaId?, cycle?, reason?, createdBy }); class CreditError
recordCashMovement(tx, { orgId, kind, method, amountCents, comandaId?, appointmentId?, clientId?, cycle?, memberId?, occurredAt?, note? })
```
De 03-01: `parseMoneyInput`, `fromCents`, `toCents` (`common/money.ts`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: createVisitTx (N appointments + comanda + itens + sinal) e createAppointment delegando</name>
  <files>apps/backend/src/appointments/visits.ts, apps/backend/src/appointments/scheduling-guard.ts, apps/backend/src/appointments/appointments.service.ts, apps/backend/test/integration/phase3-visit.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/appointments/appointments.service.ts (create atual após 03-03)
    - apps/backend/src/appointments/scheduling-guard.ts
    - apps/backend/src/comandas/comanda-open.ts e comanda-items.ts
    - apps/backend/src/financial/client-credit.ts e cash-ledger.ts
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
  </read_first>
  <behavior>
    - createVisit {clientId, items:[{serviceId, professionalId: proA, 10:00–11:00}, {serviceBId, professionalId: proB, 10:00–10:30}]} → 2 appointments com o mesmo comandaId; comanda open, código C-…, 2 itens kind service com appointmentId de cada um, total "150.00"
    - item com serviceVariantId (variante "120.00") → item listUnitPrice/unitPrice "120.00" e appointment.serviceVariantId preenchido
    - createVisit com packageId (pacote "135.00") e itens cobrindo os 2 serviços → itens rateados "90.00"/"45.00" com listUnitPrice "100.00"/"50.00" e appointmentId ligados; total "135.00"
    - createVisit com packageId e item de serviço fora do pacote → SERVICE_NOT_IN_PACKAGE; pacote sem cobrir todos os serviços → MISSING_ASSIGNMENT
    - createVisit em que o 2º item conflita com appointment existente do proB → errors[0].code SLOT_TAKEN e contagem de appointments/comandas/client_credit_movements/cash_movements inalterada
    - dois itens da mesma visita para o mesmo profissional sobrepostos → SLOT_TAKEN
    - createAppointment (mutação antiga, 1 serviço) → appointment com comandaId não nulo e comanda com 1 item
    - items vazio → ITEMS_REQUIRED; mais de 10 itens → TOO_MANY_ITEMS
  </behavior>
  <action>
**appointments/visits.ts**:
```ts
export interface VisitItemInput { serviceId: string; serviceVariantId?: string | null; professionalId: string; startsAt: Date | string; endsAt: Date | string }
export interface CreateVisitInput { clientId: string; items: VisitItemInput[]; packageId?: string | null; deposit?: { amount: string; method: string } | null; notes?: string | null }
export async function createVisitTx(tx: TenantPrismaClient, orgId: string, memberId: string, input: CreateVisitInput): Promise<{ appointmentIds: string[]; comandaId: string }>;
```
Ordem dentro da transação (chamador abre `runWithTenant(orgId, fn, SCHEDULE_TX_OPTIONS)`):
1. Validar `items.length` (0 → `SchedulingError('ITEMS_REQUIRED','Inclua ao menos um serviço.','items')`; > 10 → `TOO_MANY_ITEMS`); intervalos via `parseAppointmentInterval` (`INVALID_INTERVAL`); `deposit` (se vier): `parseMoneyInput(amount) > 0` (`INVALID_DEPOSIT`) e `method ∈ CASH_METHODS` (`INVALID_DEPOSIT_METHOD` — sinal não pode ser pago com crédito).
2. `acquireScheduleLocks(tx, orgId, items.map(i => i.professionalId))` (ordenados internamente).
3. Cliente ativo (`CLIENT_NOT_FOUND`).
4. Para cada item, em ordem: profissional ativo+isProfessional (`PROFESSIONAL_NOT_FOUND`), serviço não deletado (`SERVICE_NOT_FOUND`), `professionalServesCategory` (`PROFESSIONAL_DOES_NOT_SERVE_CATEGORY`), variante pertence ao serviço (`VARIANT_NOT_FOUND`), `assertSlotFree(...)` e então `tx.appointment.create` (status 'scheduled', `serviceVariantId`, `notes`). Criar um por vez para que o item seguinte enxergue o anterior na checagem.
5. `comanda = await openComandaTx(tx, { orgId, clientId, openedBy: memberId })`; `tx.appointment.updateMany({ where: { id: { in: ids } }, data: { comandaId: comanda.id } })`.
6. Itens: sem pacote → `buildServiceItem(tx, { ..., quantity: 1, appointmentId })` por appointment; com pacote → carregar `package_services` do `packageId` (pacote não deletado, `PACKAGE_NOT_FOUND`); todo `item.serviceId` precisa estar no pacote (`SERVICE_NOT_IN_PACKAGE`); montar `assignments` = 1 por serviço distinto (professionalId/serviceVariantId do primeiro item daquele serviço, `appointmentId` desse item) e chamar `expandPackageItems` (lança `MISSING_ASSIGNMENT` se faltar serviço); unidades extras de um mesmo serviço (quantity > 1 no pacote) ficam com `appointmentId: null` — regra D-23 de comissão sobre preço cheio é aplicada no fechamento (03-07). `tx.comandaItem.createMany`, `recalcComandaTotal`.
7. Sinal (D-03): `lockClient(tx, clientId)`; `recordCreditMovement(tx, { orgId, clientId, amountCents, kind: 'deposit', appointmentId: ids[0], comandaId: comanda.id, createdBy: memberId })`; `recordCashMovement(tx, { orgId, kind: 'deposit_in', method, amountCents, appointmentId: ids[0], comandaId: comanda.id, clientId, memberId })`; `tx.appointment.update({ where: { id: ids[0] }, data: { depositAmount: fromCents(amountCents) } })`.
`ComandaError` e `CreditError` lançados dentro são mapeados para `{ code, message, field }` pelo mesmo `.catch` de `mapSchedulingError` (estender `mapSchedulingError` para reconhecer `ComandaError` e `CreditError` por `instanceof` — editar `scheduling-guard.ts` é permitido aqui pois o 03-03 já terminou; adicionar o arquivo ao commit).

**appointments.service.ts**:
- `createVisit(orgId, memberId, input)`: `runWithTenant(orgId, async (tx) => { const r = await createVisitTx(tx, orgId, memberId, input); return { appointments: await tx.appointment.findMany({ where: { id: { in: r.appointmentIds } }, include: { professional: true, client: true, service: true, comanda: { select: { code: true, status: true } } }, orderBy: { startsAt: 'asc' } }), comandaId: r.comandaId, errors: [] }; }, SCHEDULE_TX_OPTIONS).catch(mapToVisitPayload)`.
- `create(orgId, memberId, input)` (createAppointment): passa a chamar `createVisitTx` com `items: [input]` e devolve `{ appointment: appointments[0], errors }` — assinatura do resolver ganha `tenant.memberId`. Os códigos de erro existentes continuam iguais.
- `list`: incluir `comanda: { select: { code: true, status: true } }` e `serializeAppointment` passa a expor `comandaCode`/`comandaStatus`.

**phase3-visit.e2e.spec.ts** (prefixo `p3visit`, via GraphQL): casos do `<behavior>`; para o caso de rollback, contar linhas via adminPrisma antes/depois.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-visit|phase3-appointments|phase3-scheduling|professional-categories|members"</automated>
  </verify>
  <acceptance_criteria>
    - visits.ts exporta `createVisitTx` e contém `openComandaTx(tx`, `acquireScheduleLocks(`, `kind: 'deposit'`, `kind: 'deposit_in'`, `SERVICE_NOT_IN_PACKAGE`
    - appointments.service.ts `create` chama `createVisitTx`
    - phase3-visit.e2e.spec.ts passa (≥ 8 casos); suítes phase3-appointments*, phase3-scheduling-concurrency, professional-categories e members* continuam verdes
  </acceptance_criteria>
  <done>Toda criação de agendamento abre comanda atomicamente; visitas multi-serviço e com pacote funcionam; conflito em qualquer item desfaz tudo.</done>
</task>

<task type="auto">
  <name>Task 2: SDL createVisit + campos de comanda/sinal no Appointment + suíte sinal/cancelamento</name>
  <files>apps/backend/src/graphql/schema/appointments.graphql, apps/backend/src/appointments/appointments.resolver.ts, apps/backend/test/integration/phase3-deposit-cancel.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/graphql/schema/appointments.graphql (após 03-03)
    - apps/backend/src/appointments/appointments.resolver.ts
    - apps/backend/src/appointments/appointments.service.ts (cancel do 03-03)
  </read_first>
  <action>
**appointments.graphql** — acrescentar:
```graphql
extend type Mutation {
  createVisit(input: CreateVisitInput!): VisitPayload!
}
input VisitItemInput { serviceId: UUID! serviceVariantId: UUID professionalId: UUID! startsAt: DateTime! endsAt: DateTime! }
input DepositInput { amount: String! method: String! }
input CreateVisitInput { clientId: UUID! items: [VisitItemInput!]! packageId: UUID deposit: DepositInput notes: String }
type VisitPayload { appointments: [Appointment!]! comandaId: UUID errors: [UserError!]! }
```
e no `type Appointment`: `comandaCode: String`, `comandaStatus: String`. (Não referenciar o tipo `Comanda` de `comandas.graphql` aqui — o frontend busca a comanda pelo `comandaId`.)

**appointments.resolver.ts**: `@Mutation('createVisit') @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)` → `appointments.createVisit(tenant.organizationId, tenant.memberId, input)`; `createAppointment` passa `tenant.memberId`.

**phase3-deposit-cancel.e2e.spec.ts** (prefixo `p3dep`):
1. `createVisit` com `deposit { amount: "50.00", method: "pix" }` → appointment `depositAmount "50.00"`; `clientCreditBalances`/movimentos do cliente: +50 kind deposit com appointmentId; `cash_movements` 1 linha `deposit_in pix 50.00` com `occurred_at` ≈ agora; comanda `clientCreditBalance "50.00"`.
2. `deposit.method "client_credit"` → `INVALID_DEPOSIT_METHOD`; `amount "0"` → `INVALID_DEPOSIT`.
3. `cancelAppointment` sem `reason` (string vazia) com token ADMIN → `REASON_REQUIRED`; com `reason: "Cliente viajou", reasonTag: "cliente_desmarcou"` → `cancelled`; saldo de crédito continua "50.00"; nenhum cash_movement novo; comanda da visita `cancelled` (sem outros appointments e sem pagamentos).
4. Visita com 2 serviços, cancelar 1 → comanda continua `open` com 1 item e total recalculado.
5. Comanda com pagamento lançado (addComandaPayment pix) e 1 único appointment → cancelar → `COMANDA_HAS_PAYMENTS`.
6. Após cancelar, um novo `createAppointment` no mesmo horário/profissional tem sucesso (slot liberado).
7. `listAppointments` traz `comandaCode` começando com "C-" e `comandaStatus`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-deposit-cancel|phase3-visit" && corepack pnpm --filter @sgs/backend lint && corepack pnpm -r typecheck</automated>
  </verify>
  <acceptance_criteria>
    - appointments.graphql contém `createVisit(input: CreateVisitInput!): VisitPayload!`, `input DepositInput { amount: String! method: String! }`, `comandaCode: String`
    - appointments.resolver.ts contém `@Mutation('createVisit')` (ou `@Mutation("createVisit")`)
    - phase3-deposit-cancel.e2e.spec.ts passa (≥ 7 casos)
  </acceptance_criteria>
  <done>SCHED-04 completo no backend: sinal rastreado como crédito + caixa; cancelamento com motivo preserva crédito e libera horário.</done>
</task>

</tasks>

<verification>
Gate completo verde; `test:integration -- --testPathPattern phase3-` verde.
</verification>

<success_criteria>
- Agendamento → comanda automática (D-05) para createAppointment e createVisit
- Sinal R$ 50 rastreado (crédito + caixa + deposit_amount) e preservado no cancelamento
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-06-SUMMARY.md`
</output>

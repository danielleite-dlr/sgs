---
phase: 03-core-operations
plan: 03
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - apps/backend/src/database/tenant-context.service.ts
  - apps/backend/src/database/advisory-lock.ts
  - apps/backend/src/database/advisory-lock.spec.ts
  - apps/backend/src/appointments/appointment-status.ts
  - apps/backend/src/appointments/appointment-status.spec.ts
  - apps/backend/src/appointments/scheduling-guard.ts
  - apps/backend/src/appointments/appointments.service.ts
  - apps/backend/src/appointments/appointments.resolver.ts
  - apps/backend/src/appointments/time-blocks.service.ts
  - apps/backend/src/appointments/appointments.module.ts
  - apps/backend/src/graphql/schema/appointments.graphql
  - apps/backend/test/integration/phase3-scheduling-concurrency.e2e.spec.ts
  - apps/backend/test/integration/phase3-appointments-move.e2e.spec.ts
  - apps/backend/test/integration/phase3-appointments-lifecycle.e2e.spec.ts
  - apps/backend/test/integration/phase3-time-blocks.e2e.spec.ts
autonomous: true
requirements: [SCHED-01, SCHED-02, SCHED-03]

must_haves:
  truths:
    - "Duas criações simultâneas para o mesmo profissional com intervalos sobrepostos de início diferente: exatamente uma tem sucesso e a outra recebe SLOT_TAKEN com a mensagem 'Horário já reservado por outra pessoa — escolha outro slot'"
    - "Se outra transação segura o lock do profissional por mais que o lock_timeout, a mutação devolve SLOT_TAKEN (55P03 mapeado) em vez de travar ou 'Transaction already closed'"
    - "Mover um agendamento para horário livre (mesma ou outra raia) persiste com a mesma duração; sobre ocupado/bloqueado é recusado"
    - "Os 4 tipos de bloqueio podem ser criados; feriado (org-wide) impede agendar qualquer profissional; criar bloqueio sobre agendamento ativo é recusado"
    - "Todo cancelamento exige motivo (inclusive ADMIN); no_show é um cancelamento com tag 'no_show'"
    - "PROFESSIONAL só vê os próprios bloqueios + feriados e não consegue mover/cancelar"
  artifacts:
    - path: "apps/backend/src/database/advisory-lock.ts"
      provides: "setLockTimeout, lockOrgShared, lockOrgExclusive, lockProfessional, isPgError, isLockTimeout, isExclusionViolation"
      exports: ["setLockTimeout", "lockOrgShared", "lockOrgExclusive", "lockProfessional", "isPgError"]
    - path: "apps/backend/src/appointments/scheduling-guard.ts"
      provides: "acquireScheduleLocks, findScheduleConflict, SchedulingError, mapSchedulingError, SCHEDULE_TX_OPTIONS"
      exports: ["acquireScheduleLocks", "findScheduleConflict", "SchedulingError", "mapSchedulingError"]
    - path: "apps/backend/src/appointments/appointment-status.ts"
      provides: "BLOCKING_STATUSES, MOVABLE_STATUSES, canTransition"
      exports: ["BLOCKING_STATUSES", "canTransition"]
    - path: "apps/backend/src/appointments/time-blocks.service.ts"
      provides: "TimeBlocksService.list/create/delete"
    - path: "apps/backend/src/graphql/schema/appointments.graphql"
      provides: "moveAppointment, updateAppointmentStatus, cancelAppointment, timeBlocks, createTimeBlock, deleteTimeBlock"
      contains: "moveAppointment"
  key_links:
    - from: "appointments.service.ts create/move"
      to: "scheduling-guard.acquireScheduleLocks"
      via: "chamada antes de qualquer leitura de conflito"
      pattern: "acquireScheduleLocks\\("
    - from: "time-blocks.service.ts create (feriado)"
      to: "lockOrgExclusive"
      via: "lock exclusivo da org"
      pattern: "lockOrgExclusive\\("
    - from: "scheduling-guard.findScheduleConflict"
      to: "time_blocks + appointments BLOCKING_STATUSES"
      via: "consulta de sobreposição"
      pattern: "BLOCKING_STATUSES"
---

<objective>
Entregar a agenda concorrente no backend: lock por profissional (D-01 ajustado), checagem de conflito contra agendamentos ativos e bloqueios, mover (drag-and-drop, D-04), mudar status, cancelar com motivo (D-15) e CRUD de bloqueios dos 4 tipos (D-02), com a constraint recriada como rede de segurança.

Purpose: SCHED-01/02/03 e o critério de sucesso #5 (erro claro para o segundo tentante). A criação de comanda junto com o agendamento (D-05) e o sinal (D-03) ficam no 03-06, que reaproveita o guard deste plano.
Output: helper de advisory lock, guard de agenda, regras de status, TimeBlocksService, 5 mutações + 1 query novas, 4 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@.planning/phases/03-core-operations/03-01-SUMMARY.md
@apps/backend/src/appointments/appointments.service.ts
@apps/backend/src/appointments/appointments.resolver.ts
@apps/backend/src/graphql/schema/appointments.graphql
@apps/backend/src/database/tenant-context.service.ts
@apps/backend/src/identity/member-categories.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.

**Arquivos que este plano NÃO toca** (são de planos paralelos): `src/comandas/**`, `src/financial/**`, `comandas.graphql`, `financial.graphql`, `app.module.ts`, `schema.prisma`, `permissions.catalog.ts`.

<interfaces>
Existentes:
```ts
// database/tenant-context.service.ts
runWithTenant<T>(organizationId: string, fn: (tx: TenantPrismaClient) => Promise<T>): Promise<T>
// identity/member-categories.ts
professionalServesCategory(tx, memberId: string, serviceCategoryId: string): Promise<boolean>
// appointments.resolver.ts
scopeProfessionalFilter(tenant: Pick<TenantContext,'roleName'|'memberId'>, requested?: string): string | undefined
// common/money.ts (03-01)
toCents(v), fromCents(cents)
// TenantContext = { organizationId, memberId, roleName }
```
SDL existente: `type Appointment { id professionalId clientId serviceId startsAt endsAt status notes professional client service createdAt updatedAt }`, `type AppointmentPayload { appointment: Appointment errors: [UserError!]! }`, `type UserError { code message field }`.
Colunas novas de appointments (03-01): `comanda_id, service_variant_id, deposit_amount, cancel_reason, cancel_reason_tag, cancelled_at, cancelled_by`; tabela `time_blocks(kind, professional_id NULL=org-wide, starts_at, ends_at, all_day, note, created_by)`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: advisory-lock.ts, appointment-status.ts, scheduling-guard.ts e opções de transação no runWithTenant</name>
  <files>apps/backend/src/database/tenant-context.service.ts, apps/backend/src/database/advisory-lock.ts, apps/backend/src/database/advisory-lock.spec.ts, apps/backend/src/appointments/appointment-status.ts, apps/backend/src/appointments/appointment-status.spec.ts, apps/backend/src/appointments/scheduling-guard.ts</files>
  <read_first>
    - apps/backend/src/database/tenant-context.service.ts
    - apps/backend/src/database/types.ts
    - apps/backend/src/appointments/appointments.service.ts (checagem de conflito atual com status ["scheduled","confirmed"] e tratamento P2004/23P01)
    - .planning/phases/03-core-operations/03-RESEARCH.md seções "Pattern 1" e "Code Examples / advisory-lock.ts"
  </read_first>
  <behavior>
    - isPgError(new Prisma.PrismaClientKnownRequestError('x', {code:'P2010', clientVersion:'6', meta:{code:'55P03'}}), '55P03') === true
    - isPgError(erro com message contendo '23P01', '23P01') === true; isPgError(new Error('55P03'), '55P03') === false (só PrismaClientKnownRequestError)
    - canTransition('scheduled','confirmed') true; ('scheduled','in_progress') true; ('confirmed','in_progress') true; ('in_progress','confirmed') false; ('completed','in_progress') false; ('cancelled','confirmed') false
    - BLOCKING_STATUSES deep-equals ['scheduled','confirmed','in_progress','completed']; MOVABLE_STATUSES = ['scheduled','confirmed','in_progress']; CANCELLABLE_STATUSES = ['scheduled','confirmed','in_progress']
    - mapSchedulingError(erro P2010 meta.code '55P03') → { code:'SLOT_TAKEN', message:'Horário já reservado por outra pessoa — escolha outro slot', field:'startsAt' }
    - mapSchedulingError(new SchedulingError('TIME_BLOCKED','x','startsAt')) → { code:'TIME_BLOCKED', message:'x', field:'startsAt' }; mapSchedulingError(new Error('boom')) → null
  </behavior>
  <action>
**tenant-context.service.ts** — adicionar 3º parâmetro opcional sem quebrar chamadas existentes:
```ts
async runWithTenant<T>(organizationId: string, fn: (tx: TenantPrismaClient) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T>
// ...this.prisma.$transaction(async (tx) => {...}, options)
```

**database/advisory-lock.ts** (só locks de TRANSAÇÃO; `pg_advisory_lock` de sessão é proibido com PgBouncer transaction mode):
```ts
import { Prisma } from '@prisma/client';
import type { TenantPrismaClient } from './types';
const NS = 'sgs:sched';
export const LOCK_TIMEOUT_MS = 3000;
export async function setLockTimeout(tx: TenantPrismaClient, ms = LOCK_TIMEOUT_MS) {
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${Math.trunc(ms)}ms'`); // ms é número interno, nunca input
}
export async function lockOrgShared(tx, orgId: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`${NS}:org:${orgId}`}, 0))`; }
export async function lockOrgExclusive(tx, orgId: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${NS}:org:${orgId}`}, 0))`; }
export async function lockProfessional(tx, orgId: string, professionalId: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${NS}:pro:${orgId}:${professionalId}`}, 0))`; }
export function isPgError(e: unknown, sqlstate: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const metaCode = (e.meta as { code?: string } | undefined)?.code;
  return metaCode === sqlstate || e.message.includes(sqlstate);
}
export const isLockTimeout = (e: unknown) => isPgError(e, '55P03');
export const isExclusionViolation = (e: unknown) => isPgError(e, '23P01') || (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2004');
```
A chave de lock do profissional é exportada também como função `professionalLockKey(orgId, professionalId) => \`sgs:sched:pro:${orgId}:${professionalId}\`` para o teste de lock_timeout reproduzir a mesma chave.

**appointments/appointment-status.ts**:
```ts
export const BLOCKING_STATUSES = ['scheduled','confirmed','in_progress','completed'] as const; // = predicado da exclusion constraint
export const MOVABLE_STATUSES = ['scheduled','confirmed','in_progress'] as const;
export const CANCELLABLE_STATUSES = ['scheduled','confirmed','in_progress'] as const;
export const SETTABLE_STATUSES = ['confirmed','in_progress'] as const; // via updateAppointmentStatus
const TRANSITIONS: Record<string, string[]> = { scheduled: ['confirmed','in_progress'], confirmed: ['in_progress'] };
export function canTransition(from: string, to: string): boolean;
```
(`completed` só é setado pelo fechamento da comanda — 03-07; `in_progress` volta de `completed` só na reabertura.)

**appointments/scheduling-guard.ts**:
```ts
export const SLOT_TAKEN_MESSAGE = 'Horário já reservado por outra pessoa — escolha outro slot';
export const SCHEDULE_TX_OPTIONS = { timeout: 10000, maxWait: 5000 }; // timeout da transação > LOCK_TIMEOUT_MS (Pitfall 2)
export class SchedulingError extends Error { constructor(public readonly code: string, message: string, public readonly field: string | null = null) { super(message); } }
/** setLockTimeout + lockOrgShared(org) + lockProfessional para cada id distinto, em ordem lexicográfica (sem deadlock ao mover entre raias). */
export async function acquireScheduleLocks(tx: TenantPrismaClient, orgId: string, professionalIds: string[]): Promise<void>;
/** Lança SchedulingError('TIME_BLOCKED', `Profissional indisponível neste horário (${label do kind}).`, 'startsAt') se houver time_block com (professional_id = p OR professional_id IS NULL) AND starts_at < end AND ends_at > start;
 *  lança SchedulingError('SLOT_TAKEN', SLOT_TAKEN_MESSAGE, 'startsAt') se houver appointment do profissional com status IN BLOCKING_STATUSES sobrepondo, excluindo ignoreAppointmentId. */
export async function assertSlotFree(tx: TenantPrismaClient, args: { professionalId: string; startsAt: Date; endsAt: Date; ignoreAppointmentId?: string }): Promise<void>;
/** 55P03 ou 23P01/P2004 → SLOT_TAKEN; SchedulingError → seu code/message/field; outro → null (relançar). */
export function mapSchedulingError(e: unknown): { code: string; message: string; field: string | null } | null;
```
Rótulos dos kinds na mensagem: folga → "folga", intervalo → "intervalo", feriado → "feriado", indisponibilidade → "indisponibilidade". Padrão de uso (obrigatório nos serviços): lançar `SchedulingError` dentro do `runWithTenant` (garante ROLLBACK) e traduzir para payload fora, em `.catch((e) => { const m = mapSchedulingError(e); if (m) return { appointment: null, errors: [m] }; throw e; })`.
Escrever os specs do `<behavior>` primeiro.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- advisory-lock appointment-status && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - advisory-lock.ts contém `pg_advisory_xact_lock_shared(hashtextextended(` e `pg_advisory_xact_lock(hashtextextended(` e não contém `pg_advisory_lock(`
    - scheduling-guard.ts contém `'Horário já reservado por outra pessoa — escolha outro slot'` e `timeout: 10000`
    - appointment-status.ts contém `['scheduled','confirmed','in_progress','completed']` (ou com espaços após vírgulas)
    - tenant-context.service.ts contém `options?: { timeout?: number; maxWait?: number }`
    - specs passam (≥ 9 casos)
  </acceptance_criteria>
  <done>Primitivas de concorrência e regras de status prontas, testadas e reutilizáveis pelo 03-06/03-07.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: create com lock, moveAppointment, updateAppointmentStatus, cancelAppointment (SDL + resolver + testes)</name>
  <files>apps/backend/src/appointments/appointments.service.ts, apps/backend/src/appointments/appointments.resolver.ts, apps/backend/src/graphql/schema/appointments.graphql, apps/backend/test/integration/phase3-scheduling-concurrency.e2e.spec.ts, apps/backend/test/integration/phase3-appointments-move.e2e.spec.ts, apps/backend/test/integration/phase3-appointments-lifecycle.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/appointments/appointments.service.ts
    - apps/backend/src/appointments/appointments.resolver.ts
    - apps/backend/src/graphql/schema/appointments.graphql
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (createPhase3World, gqlAs)
    - apps/backend/src/authz/decorators/require-permission.decorator.ts
  </read_first>
  <behavior>
    - concorrência: Promise.all de 2 createAppointment (proA, 10:00–11:00 e 10:30–11:30) → 1 com appointment != null, 1 com errors[0].code === 'SLOT_TAKEN'
    - concorrência: 10 createAppointment paralelos com intervalos todos sobrepostos → exatamente 1 sucesso, 9 SLOT_TAKEN, 1 linha no banco
    - lock_timeout: adminPrisma.$transaction segura `pg_advisory_xact_lock(hashtextextended(professionalLockKey(org, proA), 0))` + `pg_sleep(4)`; um createAppointment iniciado 200 ms depois retorna SLOT_TAKEN em < 4,5 s
    - create sobre appointment in_progress → SLOT_TAKEN; create sobre time_block do profissional → TIME_BLOCKED
    - move para horário livre na mesma raia → startsAt/endsAt novos, duração preservada; move para proB → professionalId = proB
    - move sobre appointment existente → SLOT_TAKEN e appointment original inalterado (rollback)
    - move de appointment cancelled/completed → INVALID_STATUS; move para profissional que não atende a categoria → PROFESSIONAL_DOES_NOT_SERVE_CATEGORY
    - move para profissional inativo → PROFESSIONAL_NOT_FOUND
    - updateAppointmentStatus scheduled→confirmed ok; in_progress→confirmed → INVALID_STATUS_TRANSITION
    - cancelAppointment com reason "" ou "  " → REASON_REQUIRED (inclusive com token ADMIN); com reason e reasonTag 'cliente_desmarcou' → status 'cancelled', cancelReason, cancelledAt, cancelledBy = member; com reasonTag 'no_show' → status 'no_show'; o horário fica livre (create no mesmo intervalo passa)
    - PROFESSIONAL chamando moveAppointment/cancelAppointment → erro FORBIDDEN (permission guard)
  </behavior>
  <action>
**appointments.graphql** — acrescentar:
```graphql
extend type Mutation {
  moveAppointment(input: MoveAppointmentInput!): AppointmentPayload!
  updateAppointmentStatus(input: UpdateAppointmentStatusInput!): AppointmentPayload!
  cancelAppointment(input: CancelAppointmentInput!): AppointmentPayload!
}
input MoveAppointmentInput { id: UUID! professionalId: UUID! startsAt: DateTime! }
input UpdateAppointmentStatusInput { id: UUID! status: String! }
input CancelAppointmentInput { id: UUID! reason: String! reasonTag: String }
```
e no `type Appointment` os campos `comandaId: UUID`, `serviceVariantId: UUID`, `depositAmount: String!`, `cancelReason: String`, `cancelReasonTag: String`, `cancelledAt: DateTime`. `depositAmount` sai sempre com 2 casas: mapear no service com `fromCents(toCents(row.depositAmount))` (Pitfall 8) via um `serializeAppointment(row)` usado por list/create/move/status/cancel.

**appointments.service.ts**:
- `create` (mantém assinatura e validações atuais): trocar a checagem de conflito por `await acquireScheduleLocks(tx, orgId, [input.professionalId]); await assertSlotFree(tx, {...});` logo no início da transação (antes das leituras), passar `SCHEDULE_TX_OPTIONS` ao `runWithTenant`, lançar `SchedulingError` para os erros de validação existentes (códigos atuais preservados: INVALID_INTERVAL, PROFESSIONAL_NOT_FOUND, CLIENT_NOT_FOUND, SERVICE_NOT_FOUND, PROFESSIONAL_DOES_NOT_SERVE_CATEGORY) e mapear com `mapSchedulingError` fora. O código `PROFESSIONAL_UNAVAILABLE` deixa de existir (vira `SLOT_TAKEN`). Não criar comanda aqui (03-06).
- `move(orgId, memberId, input: { id; professionalId; startsAt })`: dentro de `runWithTenant(..., SCHEDULE_TX_OPTIONS)`: ler appointment (sem lock) para saber o profissional atual → `acquireScheduleLocks(tx, orgId, [atual, novo])` → reler `SELECT ... FROM appointments WHERE id = $1 FOR UPDATE` → status ∉ MOVABLE_STATUSES ⇒ `SchedulingError('INVALID_STATUS','Este agendamento não pode ser movido.','id')`; NOT_FOUND se não existir; se professionalId mudou: validar profissional ativo/isProfessional (PROFESSIONAL_NOT_FOUND) e `professionalServesCategory` (PROFESSIONAL_DOES_NOT_SERVE_CATEGORY); `endsAt = startsAt + (endsAt_antigo - startsAt_antigo)`; `assertSlotFree(..., ignoreAppointmentId: id)`; `update`; se `comandaId` não nulo e o profissional mudou: `tx.comandaItem.updateMany({ where: { appointmentId: id, comanda: { status: 'open' } }, data: { professionalId: novo } })` (D-13: comissão segue quem atende).
- `updateStatus(orgId, input: { id; status })`: `status ∉ SETTABLE_STATUSES` ou `!canTransition(atual, novo)` ⇒ `INVALID_STATUS_TRANSITION` ("Mudança de status não permitida."); update.
- `cancel(orgId, memberId, input: { id; reason; reasonTag? })`: `reason.trim().length < 3` ⇒ `REASON_REQUIRED` ("Informe o motivo do cancelamento.", field 'reason') — vale para todos os papéis (adendo: D-15/D-20). `reasonTag` (se vier) ∈ `['cliente_desmarcou','profissional_doente','no_show']` senão `INVALID_REASON_TAG`. Status atual ∉ CANCELLABLE_STATUSES ⇒ `INVALID_STATUS`. Novo status = `reasonTag === 'no_show' ? 'no_show' : 'cancelled'`; gravar `cancelReason`, `cancelReasonTag`, `cancelledAt: new Date()`, `cancelledBy: memberId`. Se `comandaId`: `SELECT status FROM comandas WHERE id=$1 FOR UPDATE`; se `closed` ⇒ `COMANDA_CLOSED` ("Reabra a comanda antes de cancelar este agendamento."); se `open`: contar outros appointments da comanda com status ∈ BLOCKING_STATUSES e pagamentos (`comanda_payments`); se não restar nenhum outro appointment ativo E houver pagamentos ⇒ `COMANDA_HAS_PAYMENTS` ("Remova os pagamentos da comanda antes de cancelar."); senão apagar `comanda_items WHERE appointment_id = id AND comanda_id = comandaId`, recalcular `UPDATE comandas SET total = COALESCE((SELECT SUM(total) FROM comanda_items WHERE comanda_id = $1), 0) WHERE id = $1` (SQL inline; o 03-04 tem o helper equivalente) e, se não restar item nem outro appointment ativo, `UPDATE comandas SET status='cancelled', cancelled_at=now(), cancel_reason=$reason`. Sinal (deposit) NÃO é tocado: ele já é crédito do cliente desde o recebimento (D-03), então o saldo permanece (D-15).
- `list`: incluir os campos novos (já vêm do Prisma) via `serializeAppointment`.

**appointments.resolver.ts** — 3 mutations com `@RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)` passando `tenant.organizationId` e `tenant.memberId`.

**Testes** (todos com `createPhase3World('<prefixo>')`/`destroyPhase3World`; datas futuras fixas, ex. `2030-03-0X`):
- `phase3-scheduling-concurrency.e2e.spec.ts` (prefixo `p3conc`): os 3 primeiros casos do `<behavior>`. **Primeiro caso a escrever**: o de lock_timeout — registrar no SUMMARY o formato real do erro do Prisma observado (code/meta) para 55P03 (Open Question #2).
- `phase3-appointments-move.e2e.spec.ts` (prefixo `p3move`): casos de create sobre in_progress/time_block (inserir via adminPrisma) e de move.
- `phase3-appointments-lifecycle.e2e.spec.ts` (prefixo `p3life`): status, cancel, RBAC do PROFESSIONAL.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-scheduling-concurrency|phase3-appointments-move|phase3-appointments-lifecycle|professional-categories"</automated>
  </verify>
  <acceptance_criteria>
    - appointments.graphql contém `moveAppointment(input: MoveAppointmentInput!): AppointmentPayload!` e `cancelAppointment(input: CancelAppointmentInput!)` e `depositAmount: String!`
    - `grep -c "acquireScheduleLocks(" apps/backend/src/appointments/appointments.service.ts` ≥ 2
    - `grep -n "PROFESSIONAL_UNAVAILABLE" apps/backend/src` não retorna nada
    - appointments.service.ts contém `REASON_REQUIRED` e `COMANDA_HAS_PAYMENTS`
    - as 3 suítes novas passam; `professional-categories.e2e.spec.ts` continua verde
  </acceptance_criteria>
  <done>Criar e mover agendamento são serializados por profissional; conflito/bloqueio/lock timeout viram SLOT_TAKEN/TIME_BLOCKED; cancelamento sempre com motivo.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: TimeBlocksService (4 tipos, feriado org-wide) + query/mutations + suíte de bloqueios</name>
  <files>apps/backend/src/appointments/time-blocks.service.ts, apps/backend/src/appointments/appointments.resolver.ts, apps/backend/src/appointments/appointments.module.ts, apps/backend/src/graphql/schema/appointments.graphql, apps/backend/test/integration/phase3-time-blocks.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/appointments/scheduling-guard.ts (Task 1)
    - apps/backend/src/appointments/appointments.module.ts
    - apps/backend/src/graphql/schema/appointments.graphql
  </read_first>
  <behavior>
    - createTimeBlock {kind:'intervalo', professionalId: proA, 12:00–13:00} ok; createAppointment proA 12:30–13:30 → TIME_BLOCKED
    - createTimeBlock {kind:'feriado', professionalId: null, dia inteiro} ok; createAppointment para proA e para proB nesse dia → TIME_BLOCKED
    - createTimeBlock {kind:'feriado', professionalId: proA} → INVALID_SCOPE; {kind:'folga', professionalId: null} → INVALID_SCOPE; kind 'ferias' → INVALID_KIND
    - createTimeBlock sobre appointment scheduled do proA → BLOCK_OVERLAPS_APPOINTMENT com mensagem contendo "1 agendamento"
    - createTimeBlock feriado num dia com appointment do proB → BLOCK_OVERLAPS_APPOINTMENT
    - timeBlocks(startsAt, endsAt, professionalId: proA) devolve os blocos do proA + feriados; com token PROFESSIONAL proB, pedir proA devolve blocos do proB + feriados (filtro forçado)
    - deleteTimeBlock remove; id de outra org → NOT_FOUND
    - Promise.all de createTimeBlock(intervalo proA 15:00–16:00) e createAppointment(proA 15:30–16:30) → exatamente um tem sucesso
  </behavior>
  <action>
**appointments.graphql** — acrescentar:
```graphql
extend type Query {
  timeBlocks(startsAt: DateTime!, endsAt: DateTime!, professionalId: UUID): [TimeBlock!]!
}
extend type Mutation {
  createTimeBlock(input: CreateTimeBlockInput!): TimeBlockPayload!
  deleteTimeBlock(id: UUID!): TimeBlockPayload!
}
type TimeBlock { id: UUID! kind: String! professionalId: UUID startsAt: DateTime! endsAt: DateTime! allDay: Boolean! note: String createdAt: DateTime! }
input CreateTimeBlockInput { kind: String! professionalId: UUID startsAt: DateTime! endsAt: DateTime! allDay: Boolean note: String }
type TimeBlockPayload { timeBlock: TimeBlock errors: [UserError!]! }
```

**time-blocks.service.ts** (`@Injectable() TimeBlocksService`, injeta `TenantContextService`):
- `list(orgId, { startsAt, endsAt, professionalId? })`: `where: { startsAt: { lt: end }, endsAt: { gt: start }, ...(professionalId ? { OR: [{ professionalId }, { professionalId: null }] } : {}) }`, ordem `startsAt asc`.
- `create(orgId, memberId, input)`: validar `kind ∈ ['folga','intervalo','feriado','indisponibilidade']` (INVALID_KIND); escopo `kind === 'feriado' ⇔ professionalId == null` (INVALID_SCOPE, "Feriado vale para todo o salão; os demais bloqueios exigem um profissional."); intervalo válido (`parseAppointmentInterval`, INVALID_INTERVAL); profissional ativo e `isProfessional` (PROFESSIONAL_NOT_FOUND). Dentro de `runWithTenant(..., SCHEDULE_TX_OPTIONS)`: feriado → `setLockTimeout(tx)` + `lockOrgExclusive(tx, orgId)`; demais → `acquireScheduleLocks(tx, orgId, [professionalId])`. Contar appointments com status ∈ BLOCKING_STATUSES sobrepondo (feriado: de qualquer profissional; demais: do profissional) → se > 0 `SchedulingError('BLOCK_OVERLAPS_APPOINTMENT', \`Existe(m) ${n} agendamento(s) neste intervalo. Mova ou cancele antes de bloquear.\`, 'startsAt')`. Inserir com `createdBy: memberId`, `allDay: input.allDay ?? false`. Erros via `mapSchedulingError` fora da transação (55P03 também vira SLOT_TAKEN aqui).
- `delete(orgId, id)`: `findFirst` → NOT_FOUND ("Bloqueio não encontrado."); `delete`.

**resolver**: `@Query('timeBlocks') @RequirePermission(APPOINTMENT_READ)` com `professionalId: scopeProfessionalFilter(tenant, professionalId)`; mutations com `APPOINTMENT_WRITE`. Registrar `TimeBlocksService` em `appointments.module.ts` providers/exports (pode ficar no `AppointmentsResolver` existente ou num `TimeBlocksResolver` novo no mesmo módulo).

**Teste** `phase3-time-blocks.e2e.spec.ts` (prefixo `p3blk`) com os casos do `<behavior>` via GraphQL (`gqlAs`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-time-blocks|phase3-appointments" && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - appointments.graphql contém `timeBlocks(startsAt: DateTime!, endsAt: DateTime!, professionalId: UUID): [TimeBlock!]!` e `createTimeBlock(input: CreateTimeBlockInput!): TimeBlockPayload!`
    - time-blocks.service.ts contém `lockOrgExclusive(` e `BLOCK_OVERLAPS_APPOINTMENT` e `INVALID_SCOPE`
    - appointments.module.ts registra `TimeBlocksService`
    - phase3-time-blocks.e2e.spec.ts passa (≥ 8 casos)
  </acceptance_criteria>
  <done>Bloqueios dos 4 tipos funcionam, com feriado org-wide sob lock exclusivo e sem corrida contra agendamentos.</done>
</task>

</tasks>

<verification>
Gate completo verde; `corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-` verde.
</verification>

<success_criteria>
- Critério #5 do ROADMAP provado por teste de concorrência (intervalos sobrepostos com início diferente)
- SCHED-02 (move) e SCHED-03 (bloqueios) disponíveis via GraphQL para o frontend (03-08/03-10)
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-03-SUMMARY.md` (incluir o formato observado do erro Prisma para 55P03 e 23P01)
</output>

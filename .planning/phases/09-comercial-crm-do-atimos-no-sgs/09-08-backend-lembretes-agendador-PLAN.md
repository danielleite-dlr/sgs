---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 08
type: execute
wave: 3
depends_on: ["09-04", "09-07"]
files_modified:
  - apps/backend/src/graphql/schema/commercial-reminders.graphql
  - apps/backend/src/commercial/commercial-reminders.service.ts
  - apps/backend/src/commercial/commercial-reminders.resolver.ts
  - apps/backend/src/commercial/commercial-reminders.scheduler.ts
  - apps/backend/src/commercial/commercial-reminders.processor.ts
  - apps/backend/src/commercial/commercial-reminders.module.ts
  - apps/backend/src/config/env.schema.ts
  - apps/backend/src/config/app-config.service.ts
  - apps/backend/test/integration/setup.ts
  - docker-compose.staging.yml
  - apps/backend/test/integration/phase9-reminders.e2e.spec.ts
autonomous: true
requirements: [COM-11, COM-10]

must_haves:
  truths:
    - "Lembretes podem ser criados (com ou sem lead/negócio), editados, concluídos, reabertos e excluídos; listados por vencidos, de hoje (fuso da org), próximos e concluídos (D-16)"
    - "Um tick BullMQ por minuto reivindica de forma atômica os lembretes vencidos não concluídos e não notificados e enfileira um push commercial.reminder por lembrete; duas execuções seguidas geram um aviso só"
    - "Reagendar um lembrete já notificado zera notified_at (avisa de novo na nova hora); concluído nunca notifica"
    - "ATTENDANT vê e mexe só nos lembretes que criou ou dos negócios dela; PROFESSIONAL recebe FORBIDDEN (D-12)"
    - "COMMERCIAL_REMINDERS_SCHEDULER=false desliga scheduler e processor (padrão nas suítes de integração); no staging fica true"
  artifacts:
    - path: "apps/backend/src/commercial/commercial-reminders.service.ts"
      provides: "CRUD, list, claimDueRemindersForOrg, tick"
      exports: ["CommercialRemindersService"]
    - path: "apps/backend/src/commercial/commercial-reminders.scheduler.ts"
      provides: "upsertJobScheduler commercial-reminders-tick"
      contains: "* * * * *"
  key_links:
    - from: "apps/backend/src/commercial/commercial-reminders.service.ts"
      to: "PushEventsService.enqueue"
      via: "{ kind: 'commercial.reminder', orgId, reminderId }"
      pattern: "kind: 'commercial.reminder'"
    - from: "apps/backend/src/commercial/commercial-reminders.service.ts"
      to: "commercial_reminders"
      via: "UPDATE ... FOR UPDATE SKIP LOCKED RETURNING"
      pattern: "SKIP LOCKED"
---

<objective>
Lembretes do Comercial: SDL, CRUD com visibilidade, listas por situação, e o tick por minuto que reivindica os vencidos e enfileira o push do 09-07. Flag de ambiente `COMMERCIAL_REMINDERS_SCHEDULER`.

Purpose: COM-11 no backend.
Output: SDL, serviço, resolver, scheduler, processor, módulo, flag e `phase9-reminders`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-07-SUMMARY.md

**Ambiente de execução:** igual ao 09-01.

**SDL sem depender do 09-05:** o tipo `CommercialReminder` NÃO referencia `CommercialDeal` (que vem do 09-05, em paralelo); usa campos planos (`dealId`, `dealKind`, `dealEventDate`, `dealStageName`) e `lead: CommercialLeadRef` (do 09-04).

<interfaces>
Modelo de job agendado (`apps/backend/src/contracts/alerts/`): `ContractAlertsScheduler.onModuleInit` → `if (!this.config.contractAlertsSchedulerEnabled) return; await this.queue.upsertJobScheduler('contract-alerts-tick', { pattern: '0 * * * *' }, { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 100 } })`; `@Processor(QUEUE) class P extends WorkerHost { process() { return this.alerts.tick(new Date()); } }`; módulo com `const workerProviders = process.env.CONTRACT_ALERTS_SCHEDULER !== 'false' ? [Scheduler, Processor] : []` e `BullModule.registerQueue({ name })`; `tick` usa `this.tenant.runWithoutTenant(tx => tx.$queryRaw\`SELECT organization_id, timezone FROM job_list_active_orgs()\`)` e `runForOrg` com try/catch por org.
`env.schema.ts`: `CONTRACT_ALERTS_SCHEDULER: z.enum(['true','false']).default('true').transform((v) => v === 'true').describe(...)`; `app-config.service.ts`: `get contractAlertsSchedulerEnabled(): boolean`.
`test/integration/setup.ts`: `process.env.CONTRACT_ALERTS_SCHEDULER ??= 'false';`.
`docker-compose.staging.yml` (backend): `CONTRACT_ALERTS_SCHEDULER: ${CONTRACT_ALERTS_SCHEDULER:-true}` e `PUSH_NOTIFICATIONS_WORKER: ${PUSH_NOTIFICATIONS_WORKER:-true}`.
`PushModule` é `@Global()` e exporta `PushEventsService` (`enqueue(job)` fire-and-forget).
Do 09-02: `visibilityWhere(viewer).reminder`, `.deal`, `.lead`. Do 09-04: `CommercialError`, `CommercialCoreModule`, `CommercialOkPayload`, `CommercialLeadRef`, `CommercialMember`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SDL e CRUD de lembretes</name>
  <files>apps/backend/src/graphql/schema/commercial-reminders.graphql, apps/backend/src/commercial/commercial-reminders.service.ts, apps/backend/src/commercial/commercial-reminders.resolver.ts, apps/backend/src/commercial/commercial-reminders.module.ts, apps/backend/test/integration/phase9-reminders.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/commercial/commercial-reminders.module.ts (shell do 09-04)
    - apps/backend/src/commercial/commercial-leads.service.ts (padrão do 09-04)
    - apps/backend/src/contracts/contracts.service.ts (`orgToday`/`localDate` para "hoje" no fuso da org)
  </read_first>
  <behavior>
    - createCommercialReminder com título vazio → TITLE_REQUIRED; título > 160 → TITLE_TOO_LONG; dueAt inválido → DUE_INVALID; dealId de negócio invisível → NOT_FOUND; com dealId sem leadId preenche lead_id do negócio
    - commercialReminders(filter { status: 'overdue' }) = não concluídos com dueAt < agora; 'today' = não concluídos com dueAt no dia de hoje no fuso da org (America/Sao_Paulo) e >= agora; 'upcoming' = depois de hoje; 'done' = concluídos (desc); padrão 'pending' = todos não concluídos por dueAt asc
    - commercialReminderCounts → { overdue, today } (para o Painel)
    - updateCommercialReminder mudando dueAt de lembrete com notified_at → notified_at volta a null
    - completeCommercialReminder(id, true) grava completed_at; (id, false) limpa
    - ATTENDANT A: não vê lembrete criado por B nem do negócio de B; vê lembrete do próprio negócio criado pelo gerente; update/delete do de B → NOT_FOUND; delete do lembrete criado pelo gerente no negócio dela → FORBIDDEN_ROLE (só criador ou ADMIN/MANAGER excluem)
    - PROFESSIONAL → FORBIDDEN
  </behavior>
  <action>
1. `commercial-reminders.graphql`:
```graphql
type CommercialReminder {
  id: UUID!
  title: String!
  description: String
  dueAt: DateTime!
  completedAt: DateTime
  notifiedAt: DateTime
  overdue: Boolean!
  lead: CommercialLeadRef
  dealId: UUID
  dealKind: String
  dealEventDate: String
  dealStageName: String
  createdBy: CommercialMember
}

input CommercialReminderFilter { status: String leadId: UUID dealId: UUID limit: Int offset: Int }

type CommercialReminderPage { items: [CommercialReminder!]! total: Int! }
type CommercialReminderCounts { overdue: Int! today: Int! }

input CreateCommercialReminderInput {
  title: String!
  description: String
  dueAt: DateTime!
  leadId: UUID
  dealId: UUID
}

input UpdateCommercialReminderInput { id: UUID! title: String description: String dueAt: DateTime }

type CommercialReminderPayload { reminder: CommercialReminder errors: [UserError!]! }

extend type Query {
  commercialReminders(filter: CommercialReminderFilter): CommercialReminderPage!
  commercialReminder(id: UUID!): CommercialReminder
  commercialReminderCounts: CommercialReminderCounts!
}

extend type Mutation {
  createCommercialReminder(input: CreateCommercialReminderInput!): CommercialReminderPayload!
  updateCommercialReminder(input: UpdateCommercialReminderInput!): CommercialReminderPayload!
  completeCommercialReminder(id: UUID!, completed: Boolean!): CommercialReminderPayload!
  deleteCommercialReminder(id: UUID!): CommercialOkPayload!
}
```
2. Serviço com `visibilityWhere(viewer).reminder` em todo `where`; regras do `<behavior>`. Resolver: leituras `COMMERCIAL_READ`, mutações `COMMERCIAL_WRITE` (a regra "só criador ou gerente exclui" fica no serviço).
3. Módulo: imports `DatabaseModule`, `AuthzModule`, `BullModule.registerQueue({ name: COMMERCIAL_REMINDERS_QUEUE })`; providers service + resolver (+ workers no Task 2).
4. Spec com os casos acima. Commits `test(09-08): lembretes` e `feat(09-08): lembretes do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-reminders && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "commercialReminderCounts" apps/backend/src/graphql/schema/commercial-reminders.graphql` encontra
    - `grep -n "CommercialDeal\b" apps/backend/src/graphql/schema/commercial-reminders.graphql` vazio
    - `grep -c "visibilityWhere(" apps/backend/src/commercial/commercial-reminders.service.ts` ≥ 2
    - `grep -n "notifiedAt: null" apps/backend/src/commercial/commercial-reminders.service.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Lembretes com visibilidade e listas por situação.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tick por minuto, flag de ambiente e push</name>
  <files>apps/backend/src/commercial/commercial-reminders.service.ts, apps/backend/src/commercial/commercial-reminders.scheduler.ts, apps/backend/src/commercial/commercial-reminders.processor.ts, apps/backend/src/commercial/commercial-reminders.module.ts, apps/backend/src/config/env.schema.ts, apps/backend/src/config/app-config.service.ts, apps/backend/test/integration/setup.ts, docker-compose.staging.yml, apps/backend/test/integration/phase9-reminders.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/alerts/contract-alerts.scheduler.ts, contract-alerts.processor.ts, contract-alerts.module.ts, contract-alerts.service.ts (tick)
    - apps/backend/src/config/env.schema.ts e app-config.service.ts
    - apps/backend/test/integration/setup.ts
    - docker-compose.staging.yml (bloco environment do backend)
  </read_first>
  <behavior>
    - claimDueRemindersForOrg(orgId, now) devolve os vencidos (due_at <= now, não concluídos, não notificados) e grava notified_at; segunda chamada imediata devolve []
    - lembrete concluído ou futuro não é reivindicado
    - tick(now) chama enqueue({ kind: 'commercial.reminder', orgId, reminderId }) uma vez por lembrete reivindicado (PushEventsService substituído por espião no teste); falha numa org não impede as outras
    - no máximo 200 por org por tick
    - COMMERCIAL_REMINDERS_SCHEDULER ausente → true; 'false' → false (env.schema)
  </behavior>
  <action>
1. `claimDueRemindersForOrg(orgId, now)` em `runWithTenant`:
```sql
UPDATE commercial_reminders SET notified_at = ${now}
WHERE id IN (
  SELECT id FROM commercial_reminders
  WHERE completed_at IS NULL AND notified_at IS NULL AND due_at <= ${now}
  ORDER BY due_at LIMIT 200 FOR UPDATE SKIP LOCKED
)
RETURNING id
```
   `tick(now)`: orgs por `job_list_active_orgs()` (igual aos alertas), por org `claim` + `this.pushEvents.enqueue({ kind: 'commercial.reminder', orgId, reminderId: r.id })`, try/catch com log por org; devolve `{ orgs, notified }`.
2. `commercial-reminders.scheduler.ts`: `export const COMMERCIAL_REMINDERS_QUEUE = 'commercial-reminders';` + scheduler `upsertJobScheduler('commercial-reminders-tick', { pattern: '* * * * *' }, { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 100 } })` se `config.commercialRemindersSchedulerEnabled`; log 'Scheduler commercial-reminders-tick registrado (* * * * *)'. Processor `@Processor(COMMERCIAL_REMINDERS_QUEUE)` → `tick(new Date())`. Módulo com `workerProviders` condicionados a `process.env.COMMERCIAL_REMINDERS_SCHEDULER !== 'false'`.
3. `env.schema.ts`: `COMMERCIAL_REMINDERS_SCHEDULER` igual a `CONTRACT_ALERTS_SCHEDULER` (`describe('Liga o agendador BullMQ dos lembretes do Comercial (fase 9)')`); `app-config.service.ts`: `get commercialRemindersSchedulerEnabled(): boolean`. `setup.ts`: `process.env.COMMERCIAL_REMINDERS_SCHEDULER ??= 'false';` com comentário. `docker-compose.staging.yml`: `COMMERCIAL_REMINDERS_SCHEDULER: ${COMMERCIAL_REMINDERS_SCHEDULER:-true}` ao lado de `CONTRACT_ALERTS_SCHEDULER`.
4. Casos do `<behavior>` no `phase9-reminders` (chamando o serviço direto, como os alertas fazem com `runForOrg`) e um unit pequeno para o env se já existir spec de env (senão, cobrir pela integração).
Commit `feat(09-08): tick de lembretes com push`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-reminders && corepack pnpm --filter @sgs/backend test -- src/config && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "SKIP LOCKED" apps/backend/src/commercial/commercial-reminders.service.ts` encontra
    - `grep -n "kind: 'commercial.reminder'" apps/backend/src/commercial/commercial-reminders.service.ts` encontra
    - `grep -n "COMMERCIAL_REMINDERS_SCHEDULER ??= 'false'" apps/backend/test/integration/setup.ts` encontra
    - `grep -n "COMMERCIAL_REMINDERS_SCHEDULER" docker-compose.staging.yml apps/backend/src/config/env.schema.ts` encontra nos dois
    - `grep -n "'\* \* \* \* \*'" apps/backend/src/commercial/commercial-reminders.scheduler.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Lembrete vencido vira push uma única vez.</done>
</task>

</tasks>

<verification>
`phase9-reminders` verde, typecheck e lint; nenhuma suíte de integração sobe o worker.
</verification>

<success_criteria>
COM-11 completo no backend: lista, contagens e push na hora (granularidade de 1 minuto).
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-08-SUMMARY.md`
</output>

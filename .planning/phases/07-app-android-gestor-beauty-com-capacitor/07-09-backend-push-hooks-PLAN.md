---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 09
type: execute
wave: 4
depends_on: ["07-07"]
files_modified:
  - apps/backend/src/appointments/appointments.service.ts
  - apps/backend/src/appointments/appointments.service.push.spec.ts
  - apps/backend/src/bridal/bridal.service.ts
  - apps/backend/src/bridal/bridal.service.push.spec.ts
  - apps/backend/src/bridal/timeline/timeline.service.ts
  - apps/backend/src/contracts/payments/contract-payments.service.ts
  - apps/backend/test/integration/push-hooks.e2e.spec.ts
autonomous: true
requirements: [C-03]

must_haves:
  truths:
    - "Criar agendamento ou visita (createAppointment, createVisit, encaixe) enfileira 'appointment.created' depois do commit (D-11)"
    - "Cancelar um agendamento enfileira 'appointment.cancelled' depois do commit; marcar falta (no_show) não avisa"
    - "Agendar o evento de noivas (scheduleBridalEvent) e confirmar o cronograma que cria os atendimentos da noiva (confirmBridalTimeline, 04.2) enfileiram 'bridal.scheduled' com os ids criados — um resumo por profissional (D-15)"
    - "Cancelar o grupo de noivas ou o contrato (que cancela os atendimentos vinculados) enfileira UM 'bridal.cancelled', nunca um por atendimento (decisão do orquestrador nº 2)"
    - "Operação que falhou (errors não vazio, exceção, rollback) não enfileira nada"
    - "Falha da fila/Redis nunca derruba a mutation de agenda"
    - "Mover/remarcar não avisa nesta fase (D-11)"
  artifacts:
    - path: "apps/backend/src/appointments/appointments.service.ts"
      provides: "ganchos pós-commit em createVisit e cancel"
      contains: "this.push.enqueue("
    - path: "apps/backend/src/bridal/bridal.service.ts"
      provides: "ganchos pós-commit em schedule e cancelGroup"
      contains: "bridal.cancelled"
    - path: "apps/backend/test/integration/push-hooks.e2e.spec.ts"
      provides: "Mutations reais enfileiram (ou não) o job certo"
  key_links:
    - from: "AppointmentsService.createVisit"
      to: "PushEventsService.enqueue({ kind: 'appointment.created' })"
      via: "após runWithTenant resolver sem erros"
      pattern: "appointment\\.created"
    - from: "ContractPaymentsService.cancel"
      to: "PushEventsService.enqueue({ kind: 'bridal.cancelled', contractId })"
      via: "após o commit do cancelamento"
      pattern: "contractId: input\\.contractId"
---

<objective>
Disparar os avisos nos pontos certos, sempre DEPOIS do commit e só em caso de sucesso: criação de agendamento/visita, cancelamento individual, agenda do evento de noivas, confirmação do cronograma da noiva (04.2), cancelamento do grupo e cancelamento do contrato.

Purpose: C-03 — fecha o fluxo backend do push sem tocar nas transações de agenda (locks e rollback intactos).
Output: ganchos em 4 serviços, specs unitários e integração com mutations reais.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-07-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. Manter o estilo de cada arquivo (appointments/bridal usam aspas duplas; contracts usa simples) — rodar o prettier do backend só nos arquivos tocados.

**Colisão com a 04.2 (MUITO IMPORTANTE):** `appointments.service.ts`, `bridal.service.ts` e `bridal/timeline/timeline.service.ts` foram alterados pela 04.2 (move com `timelineOverride`, `confirmBridalTimeline`). Ler a versão ATUAL de cada um antes de editar; mexer SÓ no ponto de retorno dos métodos listados (sem reescrever corpo de transação, sem renomear nada); se a assinatura de algum método mudou na 04.2, adaptar o gancho a ela e registrar no SUMMARY.

<interfaces>
Do 07-07:
```ts
// apps/backend/src/push/push-events.service.ts — PushModule é @Global, basta injetar
@Injectable() export class PushEventsService { enqueue(job: PushJob): void } // nunca lança
// PushJob (apps/backend/src/push/push.types.ts)
| { kind: 'appointment.created' | 'appointment.cancelled' | 'bridal.scheduled'; orgId; actorMemberId; appointmentIds: string[] }
| { kind: 'bridal.cancelled'; orgId; actorMemberId; since: string; groupId?: string | null; contractId?: string | null }
```
Pontos de gancho atuais (conferir na leitura):
```ts
// AppointmentsService (constructor(private readonly tenant: TenantContextService))
createVisit(orgId, memberId, input): Promise<VisitPayload>  // runWithTenant(...).catch(...) → { appointments, comandaId, errors }
cancel(orgId, memberId, { id, reason, reasonTag }): Promise<AppointmentPayload> // runWithTenant(...).catch(fail)
// create() chama createVisit → coberto pelo gancho do createVisit (não duplicar)
// BridalService (constructor(private readonly tenant: TenantContextService))
schedule(orgId, memberId, input: BridalScheduleInput) → { group, appointmentIds, errors }
cancelGroup(orgId, memberId, { id, reason }) → BridalGroupPayload { group, errors }
// ContractPaymentsService.cancel(orgId, memberId, input: CancelContractInput) → ContractPayload { contract, errors }  (input.contractId)
// BridalTimelineService.confirm(...) (04.2-06) → cria make/penteado da noiva via createBridalScheduleTx; reconfirmar MOVE (não avisa)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ganchos em AppointmentsService (createVisit, cancel) e BridalService (schedule, cancelGroup)</name>
  <files>apps/backend/src/appointments/appointments.service.ts, apps/backend/src/appointments/appointments.service.push.spec.ts, apps/backend/src/bridal/bridal.service.ts, apps/backend/src/bridal/bridal.service.push.spec.ts</files>
  <read_first>
    - apps/backend/src/appointments/appointments.service.ts (versão atual, pós-04.2: createVisit, cancel, create)
    - apps/backend/src/bridal/bridal.service.ts (versão atual: schedule ~linha 819, cancelGroup ~linha 851)
    - apps/backend/src/appointments/appointments.service.spec.ts (specs existentes que não podem quebrar)
    - apps/backend/src/push/push-events.service.ts e push.types.ts (07-07/07-03)
  </read_first>
  <behavior>
    - createVisit com runWithTenant resolvendo { appointments: [{id:'a1'},{id:'a2'}], errors: [] } → push.enqueue({ kind: 'appointment.created', orgId, actorMemberId: memberId, appointmentIds: ['a1','a2'] }) uma vez, DEPOIS de runWithTenant resolver
    - createVisit que termina com errors (SchedulingError mapeado) → enqueue não chamado
    - createVisit cuja transação lança erro não mapeado → erro propaga e enqueue não chamado
    - create() (createAppointment) → exatamente um enqueue (via createVisit)
    - cancel sucesso (reasonTag null) → enqueue({ kind: 'appointment.cancelled', orgId, actorMemberId: memberId, appointmentIds: [id] }); reasonTag 'no_show' → não enfileira; reason curto (REASON_REQUIRED) → não enfileira; erro mapeado → não enfileira
    - push.enqueue que lança → a mutation devolve o payload normalmente (defesa extra: try/catch em volta)
    - BridalService.schedule sucesso com appointmentIds ['b1','b2','b3'] → enqueue({ kind: 'bridal.scheduled', orgId, actorMemberId, appointmentIds: ['b1','b2','b3'] }); erro → nada
    - BridalService.cancelGroup sucesso → enqueue({ kind: 'bridal.cancelled', orgId, actorMemberId, since: <ISO capturado ANTES do runWithTenant>, groupId: input.id }); falha (CANCEL_CONTRACT_FIRST, REASON_REQUIRED) → nada
  </behavior>
  <action>
1. `AppointmentsService`: construtor `constructor(private readonly tenant: TenantContextService, private readonly push: PushEventsService) {}` (import de `../push/push-events.service`). Helper privado no fim da classe:
```ts
  /** Push sai depois do commit e nunca derruba a agenda (fase 7). */
  private notify(job: PushJob): void {
    try {
      this.push.enqueue(job);
    } catch {
      // PushEventsService já não lança; isto é só cinto de segurança.
    }
  }
```
   - `createVisit`: guardar o resultado `const result = await this.tenant.runWithTenant(...).catch(...)` (corpo da transação intacto); `if (result.errors.length === 0 && result.appointments.length > 0) this.notify({ kind: "appointment.created", orgId, actorMemberId: memberId, appointmentIds: result.appointments.map((a) => String(a.id)) });` e `return result;`.
   - `cancel`: idem com `const result = await ...catch(fail)`; `if (result.errors.length === 0 && result.appointment && tag !== "no_show") this.notify({ kind: "appointment.cancelled", orgId, actorMemberId: memberId, appointmentIds: [input.id] });`.
   - NÃO tocar em `move`, `updateStatus`, `list` (remarcação fica para depois, D-11).
2. `BridalService`: mesmo construtor com `PushEventsService` e o mesmo helper `notify`.
   - `schedule`: dentro do `try`, guardar `const result = await this.tenant.runWithTenant(...)`; se `result.errors.length === 0 && result.appointmentIds.length > 0` → `notify({ kind: "bridal.scheduled", orgId, actorMemberId: memberId, appointmentIds: result.appointmentIds })`; retornar `result`.
   - `cancelGroup`: `const since = new Date().toISOString();` ANTES do `runWithTenant`; após sucesso (`result.errors.length === 0`) → `notify({ kind: "bridal.cancelled", orgId, actorMemberId: memberId, since, groupId: input.id })`.
   - NÃO alterar `cancelGroupAppointmentsTx` (usado também pelo cancelamento de contrato).
3. Specs novos (não editar os specs antigos além de compilar): `appointments.service.push.spec.ts` com `jest.mock('./visits')` e `jest.mock('./appointment-cancel')`, `tenant = { runWithTenant: jest.fn((_o, fn) => fn(tx)) }`, `tx.appointment.findMany/findFirst` mockados, `push = { enqueue: jest.fn() }`; `bridal.service.push.spec.ts` com `jest.mock('./bridal-schedule')` e mocks mínimos de `viewOf`/coverage conforme necessário (se o mock ficar grande demais, cobrir schedule/cancelGroup pela integração da Task 2 e deixar aqui só os casos de "não enfileira em erro"). Afirmar ordem: `push.enqueue.mock.invocationCallOrder[0] > tenant.runWithTenant.mock.invocationCallOrder[0]`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- appointments.service bridal.service && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "appointment.created" apps/backend/src/appointments/appointments.service.ts` encontra 1 linha
    - `grep -n "appointment.cancelled" apps/backend/src/appointments/appointments.service.ts` encontra 1 linha
    - `grep -n "no_show" apps/backend/src/appointments/appointments.service.ts` mostra a exceção do gancho
    - `grep -n "bridal.scheduled" apps/backend/src/bridal/bridal.service.ts` e `grep -n "bridal.cancelled" apps/backend/src/bridal/bridal.service.ts` encontram 1 linha cada
    - `grep -n "enqueue\|notify(" apps/backend/src/appointments/appointments.service.ts | grep -v "private notify"` não mostra chamada dentro de `async (tx) =>` (conferir por leitura: todas depois do `await this.tenant.runWithTenant`)
    - `git diff apps/backend/src/bridal/bridal-schedule.ts` vazio
    - `corepack pnpm --filter @sgs/backend test` sai 0
  </acceptance_criteria>
  <done>Agendamentos e cancelamentos individuais e do evento de noivas disparam o push depois do commit.</done>
</task>

<task type="auto">
  <name>Task 2: Ganchos em ContractPaymentsService.cancel e na confirmação do cronograma (04.2) + integração com mutations reais</name>
  <files>apps/backend/src/contracts/payments/contract-payments.service.ts, apps/backend/src/bridal/timeline/timeline.service.ts, apps/backend/test/integration/push-hooks.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/payments/contract-payments.service.ts (cancel ~linha 82; cancelContractTx chama cancelGroupAppointmentsTx com contractId)
    - apps/backend/src/bridal/timeline/timeline.service.ts (versão ATUAL da 04.2: método confirm, onde createBridalScheduleTx devolve os ids criados e onde a reconfirmação move)
    - .planning/phases/04.2-cronograma-da-noiva-e-das-acompanhantes-modelo-studio-js/04.2-06-SUMMARY.md (como ficou o confirm)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (createPhase4World, insertBridalGroupRow, insertContractRow, makeContractReady)
    - apps/backend/test/integration/phase4-bridal-schedule.e2e.spec.ts (como chamar scheduleBridalEvent/cancelBridalGroup)
    - apps/backend/test/integration/phase3-appointments-lifecycle.e2e.spec.ts (createAppointment/cancelAppointment)
  </read_first>
  <action>
1. `ContractPaymentsService`: injetar `PushEventsService` (mesmo helper `notify`); em `cancel`, `const since = new Date().toISOString();` antes do `runWithTenant`; após sucesso (`result.errors.length === 0`) → `notify({ kind: 'bridal.cancelled', orgId, actorMemberId: memberId, since, contractId: input.contractId })`. (O dispatch acha os atendimentos por `contractId` + `cancelledBy` + `cancelledAt >= since`; contrato sem atendimentos → o worker não envia nada.)
2. `BridalTimelineService.confirm` (04.2): injetar `PushEventsService`; capturar numa variável do escopo do método os ids devolvidos por `createBridalScheduleTx` (SÓ os criados; os movidos/adotados não avisam, remarcação é D-11 futuro); após o commit e sem erros/conflitos no payload, se houver ids criados → `notify({ kind: 'bridal.scheduled', orgId, actorMemberId: memberId, appointmentIds: createdIds })`. Se o método da 04.2 não expuser os ids de forma simples, registrar no SUMMARY e criar a variável `let createdIds: string[] = []` atribuída logo após a chamada a `createBridalScheduleTx` dentro da transação (sem mudar mais nada).
3. `push-hooks.e2e.spec.ts` (Postgres real; fila real ou espiada): obter `PushEventsService` do app (`w.app.get(PushEventsService)`) e `jest.spyOn(svc, 'enqueue')`. Casos:
   a. `createAppointment` (atendente, profissional proA) → 1 chamada com `kind: 'appointment.created'`, `actorMemberId: w.members.attendant`, `appointmentIds: [id]`.
   b. `createAppointment` em horário ocupado (SLOT_TAKEN) → nenhuma chamada nova.
   c. `cancelAppointment` com motivo → `appointment.cancelled` com o id; `cancelAppointment` com `reasonTag: 'no_show'` em outro atendimento → nenhuma chamada.
   d. `scheduleBridalEvent` com 3 itens → 1 chamada `bridal.scheduled` com 3 ids (não 3 chamadas).
   e. `cancelBridalGroup` (contrato já cancelado, conforme o fixture da 04) → 1 chamada `bridal.cancelled` com `groupId`; e `PushService.dispatch` com provider falso (como no 07-07) sobre esse job encontra exatamente os atendimentos cancelados do grupo.
   f. `moveAppointment` → nenhuma chamada.
   Cleanup como nos testes da fase 4 + `DELETE FROM device_tokens` da org.
4. Gate completo da wave (último commit da wave 4): `corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/e2e test:e2e`.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm test:integration -- push-hooks && corepack pnpm test:integration && corepack pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "contractId: input.contractId" apps/backend/src/contracts/payments/contract-payments.service.ts` encontra o gancho
    - `grep -n "bridal.scheduled" apps/backend/src/bridal/timeline/timeline.service.ts` encontra o gancho
    - `grep -c "it(" apps/backend/test/integration/push-hooks.e2e.spec.ts` ≥ 6
    - `corepack pnpm --filter @sgs/backend test:integration -- push-hooks` sai 0
    - suítes da 04.2 (`phase42-*`) e da fase 4 continuam verdes em `corepack pnpm --filter @sgs/backend test:integration`
    - gate completo da wave verde (exceção documentada só `phase4-alerts-boot` local)
  </acceptance_criteria>
  <done>Todos os pontos de criação/cancelamento da fase disparam o job certo, uma vez, só em sucesso; nada da 04.2 regrediu.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/backend test` e `test:integration` verdes
- `grep -rn "push.enqueue\|this.notify(" apps/backend/src --include=*.ts | grep -v spec` lista só os 7 ganchos (createVisit, cancel, schedule, cancelGroup, contract cancel, timeline confirm + helper)
</verification>

<success_criteria>
Novo agendamento e cancelamento (inclusive em lote de noivas e cancelamentos em massa) geram o job de push certo depois do commit (C-03, D-11, D-13, D-15).
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-09-SUMMARY.md`
</output>

---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 07
type: execute
wave: 3
depends_on: ["07-02", "07-03"]
files_modified:
  - apps/backend/src/push/push-events.service.ts
  - apps/backend/src/push/push-events.service.spec.ts
  - apps/backend/src/push/push.service.ts
  - apps/backend/src/push/push.processor.ts
  - apps/backend/src/push/push.processor.spec.ts
  - apps/backend/src/push/push.module.ts
  - apps/backend/test/integration/setup.ts
  - apps/backend/test/integration/push-dispatch.e2e.spec.ts
autonomous: true
requirements: [C-03]

must_haves:
  truths:
    - "Enfileirar um aviso nunca falha nem atrasa a mutation de agenda: PushEventsService.enqueue não lança e não espera o Redis"
    - "O worker carrega os atendimentos no salão certo (RLS), resolve destinatários (D-12/D-13), monta um aviso por destinatário (D-15) e envia para cada token do membro"
    - "Token devolvido como inválido pelo FCM (UNREGISTERED/SENDER_ID_MISMATCH) é apagado de device_tokens"
    - "Se TODOS os envios falharem de forma re-tentável, o job lança para o BullMQ tentar de novo (attempts 3, backoff exponencial); falha parcial não reenvia para quem já recebeu"
    - "Sem credencial FCM o worker não lê o banco nem envia nada (no-op)"
    - "Cancelamento em massa (grupo/contrato) é encontrado por cancelledBy + cancelledAt >= since, sem mudar as transações existentes"
    - "Nenhuma linha é criada em notifications (o sino fica para depois, D-11)"
  artifacts:
    - path: "apps/backend/src/push/push-events.service.ts"
      provides: "PushEventsService.enqueue(job)"
      exports: ["PushEventsService"]
    - path: "apps/backend/src/push/push.service.ts"
      provides: "PushService.dispatch(job)"
      exports: ["PushService"]
    - path: "apps/backend/src/push/push.processor.ts"
      provides: "@Processor(PUSH_QUEUE) PushProcessor"
      contains: "@Processor(PUSH_QUEUE)"
    - path: "apps/backend/src/push/push.module.ts"
      provides: "PushModule global com fila, provider FCM, processor condicional"
      contains: "@Global()"
  key_links:
    - from: "apps/backend/src/push/push.service.ts"
      to: "resolvePushTargets + buildPushMessage (07-03)"
      via: "chamada direta"
      pattern: "resolvePushTargets\\("
    - from: "apps/backend/src/push/push.service.ts"
      to: "tx.deviceToken.deleteMany"
      via: "limpeza de tokens inválidos"
      pattern: "deviceToken\\.deleteMany"
    - from: "apps/backend/src/push/push.module.ts"
      to: "BullModule.registerQueue({ name: PUSH_QUEUE })"
      via: "imports"
      pattern: "registerQueue\\(\\{ name: PUSH_QUEUE \\}\\)"
---

<objective>
Ligar as peças do push no NestJS: `PushEventsService` (enfileira fora da transação, à prova de falha), `PushService.dispatch` (carrega dados, resolve destinatários, monta textos, envia, limpa tokens inválidos), `PushProcessor` (BullMQ) e o `PushModule` global com o provider FCM.

Purpose: C-03 — o envio acontece depois do commit, pela fila existente, sem segurar locks da agenda (RESEARCH Anti-Patterns).
Output: serviços, processor, módulo, specs e um teste de integração do dispatch com provider falso.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-02-SUMMARY.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-03-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. Prettier do backend nos arquivos novos.

<interfaces>
Do 07-03 (`apps/backend/src/push/push.types.ts`, `resolve-push-targets.ts`, `push-messages.ts`, `fcm-push.provider.ts`):
```ts
export const PUSH_QUEUE = 'push-notifications'; export const PUSH_PROVIDER = 'PUSH_PROVIDER';
export type PushJob = { kind: 'appointment.created' | 'appointment.cancelled' | 'bridal.scheduled'; orgId; actorMemberId; appointmentIds: string[] }
                    | { kind: 'bridal.cancelled'; orgId; actorMemberId; since: string; groupId?: string | null; contractId?: string | null };
export interface PushProvider { readonly enabled: boolean; send(token: string, m: PushMessage): Promise<PushSendResult> }
export function resolvePushTargets(a: { appointments: { id; professionalId }[]; managerMemberIds: string[]; activeMemberIds: ReadonlySet<string>; actorMemberId: string | null }): PushTarget[];
export function buildPushMessage(kind, target, appointments: PushAppointmentView[], timezone): PushMessage;
export function createPushProvider(creds: FcmServiceAccount | null): PushProvider;
// AppConfigService: get fcmServiceAccount(): FcmServiceAccount | null; get pushWorkerEnabled(): boolean
```
Do 07-02: `PushModule` com `DeviceTokensService`/`DeviceTokensResolver`; `tx.deviceToken`.
Padrões: `apps/backend/src/contracts/alerts/contract-alerts.module.ts` (workerProviders por `process.env.X !== 'false'`), `contract-alerts.processor.ts` (`@Processor(Q) extends WorkerHost`), `contract-alerts.scheduler.ts` (`@InjectQueue(Q) private readonly queue: Queue`), `queue.module.ts` (defaultJobOptions attempts 3 + backoff exponencial).

Contrato que este plano CRIA (07-09 consome):
```ts
// apps/backend/src/push/push-events.service.ts
@Injectable() export class PushEventsService {
  /** Fire-and-forget: nunca lança, nunca espera o Redis. Chamar só DEPOIS do commit e só se a operação deu certo. */
  enqueue(job: PushJob): void;
}
// PushModule é @Global() e exporta PushEventsService (os módulos de agenda/noivas/contratos não precisam importar nada).
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PushEventsService, PushService.dispatch e PushProcessor</name>
  <files>apps/backend/src/push/push-events.service.ts, apps/backend/src/push/push-events.service.spec.ts, apps/backend/src/push/push.service.ts, apps/backend/src/push/push.processor.ts, apps/backend/src/push/push.processor.spec.ts</files>
  <read_first>
    - apps/backend/src/push/push.types.ts, resolve-push-targets.ts, push-messages.ts, fcm-push.provider.ts (07-03)
    - apps/backend/src/push/device-tokens.service.ts e push.module.ts (07-02)
    - apps/backend/src/contracts/alerts/contract-alerts.service.ts (runWithTenant, organization.timezone, filtro de gestoras)
    - apps/backend/src/contracts/alerts/contract-alerts.processor.ts e contract-alerts.scheduler.ts (WorkerHost, InjectQueue)
    - apps/backend/prisma/schema.prisma (Appointment: professional, client, service, bridalGroup, cancelledAt, cancelledBy, contractId; BridalGroup.members → client.fullName, role)
  </read_first>
  <behavior>
    - PushEventsService.enqueue chama queue.add(job.kind, job, { removeOnComplete: true, removeOnFail: 100 }) sem await; se queue.add rejeitar → logger.warn e não lança; se queue.add lançar de forma síncrona → logger.warn e não lança
    - enqueue com appointmentIds vazio (kinds com lista) → não chama queue.add
    - dispatch com provider.enabled=false → devolve { sent: 0, invalid: 0, failed: 0, skipped: 'disabled' } e NÃO chama tenant.runWithTenant
    - dispatch 'appointment.created' (tenant/tx mockados: 1 atendimento da proA, gestoras [adm], ator = atendente, tokens proA:[t1], adm:[t2,t3]) → provider.send chamado 3 vezes; t1 com body sem '(com ' e t2/t3 com '(com Ana)'
    - mesmo token repetido para dois membros → enviado uma vez só
    - send devolvendo invalid_token para t2 → tx.deviceToken.deleteMany({ where: { id: { in: [<id de t2>] } } })
    - todos os sends 'failed' retryable → dispatch lança Error('FCM indisponível: nova tentativa'); 1 sent + 1 retryable → não lança
    - 'bridal.cancelled' com groupId → findMany com where { status: 'cancelled', cancelledBy: actor, cancelledAt: { gte: new Date(since) }, bridalGroupId: groupId }; sem groupId e sem contractId → não consulta e devolve skipped 'no-scope'
    - nenhuma chamada a tx.notification.* em nenhum caso
    - PushProcessor.process(job) chama push.dispatch(job.data)
  </behavior>
  <action>
1. `push-events.service.ts`: `constructor(@InjectQueue(PUSH_QUEUE) private readonly queue: Queue)`; `enqueue(job)`: se `'appointmentIds' in job && job.appointmentIds.length === 0` → return; `try { void this.queue.add(job.kind, job, { removeOnComplete: true, removeOnFail: 100 }).catch((e) => this.logger.warn(\`Push não enfileirado (${job.kind}): ${(e as Error).message}\`)); } catch (e) { this.logger.warn(...) }`.
2. `push.service.ts` (`@Injectable() PushService`, `constructor(private readonly tenant: TenantContextService, @Inject(PUSH_PROVIDER) private readonly provider: PushProvider)`), `dispatch(job: PushJob): Promise<{ sent: number; invalid: number; failed: number; skipped?: string }>`:
   a. `if (!this.provider.enabled) return { sent: 0, invalid: 0, failed: 0, skipped: 'disabled' }`.
   b. Montar o `where` dos atendimentos: kinds com lista → `{ id: { in: job.appointmentIds } }`; `bridal.cancelled` → `{ status: 'cancelled', cancelledBy: job.actorMemberId, cancelledAt: { gte: new Date(job.since) }, ...(job.groupId ? { bridalGroupId: job.groupId } : {}), ...(job.contractId ? { contractId: job.contractId } : {}) }` (sem groupId e sem contractId → `skipped: 'no-scope'`).
   c. Um `this.tenant.runWithTenant(job.orgId, async (tx) => { ... })` que lê: `organization.findUnique({ where: { id: job.orgId }, select: { timezone: true } })` (fallback `'America/Sao_Paulo'`); `appointment.findMany({ where, orderBy: { startsAt: 'asc' }, select: { id, professionalId, startsAt, professional: { select: { displayName } }, client: { select: { fullName } }, service: { select: { name } }, bridalGroup: { select: { id, name, eventKind, eventDate, members: { where: { role: 'bride' }, select: { client: { select: { fullName: true } } } } } } } })`; gestoras `member.findMany({ where: { status: 'active', deletedAt: null, role: { name: { in: ['ADMIN', 'MANAGER'] } } }, select: { id: true } })`; profissionais ativas `member.findMany({ where: { id: { in: profIds }, status: 'active', deletedAt: null }, select: { id: true } })`; e depois dos targets, `deviceToken.findMany({ where: { memberId: { in: targetIds }, provider: 'fcm' }, select: { id, memberId, token } })`. Sem atendimentos → `skipped: 'no-appointments'`.
   d. Mapear para `PushAppointmentView` (`brideName = bridalGroup.members[0]?.client.fullName ?? null`); `targets = resolvePushTargets(...)`; para cada target, `message = buildPushMessage(job.kind, target, views.filter(v => target.appointmentIds.includes(v.id)), timezone)`.
   e. Enviar com concorrência máxima 10 (laço com `Promise.all` em fatias de 10), um envio por token, dedup de `token` (Set global ao job). Contar `sent`, `invalid` (guardar ids), `failed` (+ `retryable`). Logs só com `…${token.slice(-6)}`.
   f. Se houver inválidos: `runWithTenant(job.orgId, (tx) => tx.deviceToken.deleteMany({ where: { id: { in: invalidIds } } }))`.
   g. Se `attempted > 0 && sent === 0 && invalid === 0 && todosRetryable` → `throw new Error('FCM indisponível: nova tentativa')`. Falha de credencial (`retryable: false` com 'credencial') → `logger.error` uma vez por job.
3. `push.processor.ts`: `@Processor(PUSH_QUEUE) export class PushProcessor extends WorkerHost { constructor(private readonly push: PushService) { super(); } process(job: Job<PushJob>) { return this.push.dispatch(job.data); } }`.
4. Specs (escrever primeiro): `push-events.service.spec.ts` (queue mock `{ add: jest.fn() }`) e `push.processor.spec.ts` cobrindo o `<behavior>` de `PushService` e `PushProcessor` com `tenant.runWithTenant = jest.fn((_o, fn) => fn(tx))` e `tx` com `organization`, `appointment`, `member`, `deviceToken` mockados (e um `notification` mock para afirmar que NÃO é chamado).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- push.processor push-events && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "resolvePushTargets(" apps/backend/src/push/push.service.ts` e `grep -n "buildPushMessage(" apps/backend/src/push/push.service.ts` encontram as chamadas
    - `grep -n "deviceToken.deleteMany" apps/backend/src/push/push.service.ts` encontra a limpeza
    - `grep -n "FCM indisponível: nova tentativa" apps/backend/src/push/push.service.ts` encontra a linha
    - `grep -n "await this.queue.add" apps/backend/src/push/push-events.service.ts` NÃO encontra nada (fire-and-forget)
    - `grep -n "notification\." apps/backend/src/push/push.service.ts` não encontra nada
    - `grep -n "@Processor(PUSH_QUEUE)" apps/backend/src/push/push.processor.ts` encontra a linha
    - `corepack pnpm --filter @sgs/backend test -- push.processor push-events` sai 0
  </acceptance_criteria>
  <done>Fila e envio implementados e testados com mocks, incluindo limpeza de token e regra de retry.</done>
</task>

<task type="auto">
  <name>Task 2: PushModule global (fila, provider, processor condicional) e integração do dispatch com provider falso</name>
  <files>apps/backend/src/push/push.module.ts, apps/backend/test/integration/setup.ts, apps/backend/test/integration/push-dispatch.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/push/push.module.ts (07-02)
    - apps/backend/src/contracts/alerts/contract-alerts.module.ts (workerProviders condicionais)
    - apps/backend/test/integration/setup.ts (`CONTRACT_ALERTS_SCHEDULER ??= 'false'`)
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (createPhase3World, gqlAs; como sobrescrever provider no app de teste, se houver opção; senão usar `w.app.get(PushService)` com provider trocado via `Test.createTestingModule(...).overrideProvider`)
    - apps/backend/test/integration/phase4-contract-alerts.e2e.spec.ts (padrão de teste que pega serviço do app)
  </read_first>
  <action>
1. `push.module.ts` final:
```ts
const workerProviders: Provider[] =
  process.env.PUSH_NOTIFICATIONS_WORKER !== 'false' ? [PushProcessor] : [];

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: PUSH_QUEUE }), DatabaseModule, AuthzModule],
  providers: [
    DeviceTokensService,
    DeviceTokensResolver,
    PushEventsService,
    PushService,
    {
      provide: PUSH_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const provider = createPushProvider(config.fcmServiceAccount);
        new Logger('PushModule').log(provider.enabled ? 'Push FCM habilitado' : 'Push desabilitado (sem FCM_SERVICE_ACCOUNT_JSON)');
        return provider;
      },
    },
    ...workerProviders,
  ],
  exports: [DeviceTokensService, PushEventsService, PushService],
})
export class PushModule {}
```
   (Comentário no topo: worker lido de `process.env` na carga do módulo, igual aos alertas de contrato; suítes de integração definem 'false'.)
2. `test/integration/setup.ts`: logo após a linha do `CONTRACT_ALERTS_SCHEDULER`, `process.env.PUSH_NOTIFICATIONS_WORKER ??= 'false';` com comentário.
3. `push-dispatch.e2e.spec.ts` (Postgres real, RLS real): `w = await createPhase3World('p7push')`; obter `PushService` do app e trocar o provider por um falso `{ enabled: true, send: jest.fn(async (token) => token === 'tok-p7-dead' ? { status: 'invalid_token', reason: 'UNREGISTERED' } : { status: 'sent' }) }` (via `overrideProvider(PUSH_PROVIDER)` se o helper aceitar; senão instanciar `new PushService(w.app.get(TenantContextService), fake)`). Inserir tokens com `adminPrisma.deviceToken.create` para proA ('tok-p7-proa'), manager ('tok-p7-ger'), admin ('tok-p7-dead'). Criar um atendimento real da proA pela mutation `createAppointment` usando `gqlAs(w, w.tokens.attendant)` (ver formato em `phase3-appointments-lifecycle.e2e.spec.ts`). Chamar `dispatch({ kind: 'appointment.created', orgId: w.orgId, actorMemberId: w.members.attendant, appointmentIds: [id] })` e afirmar: `send` chamado para os 3 tokens; mensagem da proA sem '(com '; `tok-p7-dead` apagado de `device_tokens`; nenhuma linha nova em `notifications` da org. Segundo caso: `actorMemberId: w.members.manager` → manager não recebe. Cleanup: apagar `device_tokens` da org antes de `destroyPhase3World`.
4. Rodar a integração inteira (o módulo novo sobe em todas as suítes que usam o AppModule).
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm test:integration -- push-dispatch device-tokens && corepack pnpm test && corepack pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "@Global()" apps/backend/src/push/push.module.ts` encontra a linha
    - `grep -n "registerQueue({ name: PUSH_QUEUE })" apps/backend/src/push/push.module.ts` encontra a linha
    - `grep -n "PUSH_NOTIFICATIONS_WORKER" apps/backend/src/push/push.module.ts apps/backend/test/integration/setup.ts` encontra 2 linhas
    - `grep -n "Push desabilitado (sem FCM_SERVICE_ACCOUNT_JSON)" apps/backend/src/push/push.module.ts` encontra a linha
    - `corepack pnpm --filter @sgs/backend test:integration -- push-dispatch` sai 0
    - `corepack pnpm --filter @sgs/backend test:integration` sai 0 (exceção documentada só `phase4-alerts-boot` por Redis NOAUTH local)
  </acceptance_criteria>
  <done>PushModule global no ar, worker desligável por env, dispatch provado contra banco real com RLS.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/backend test` e `test:integration` verdes
- Backend sobe localmente sem `FCM_SERVICE_ACCOUNT_JSON` (log "Push desabilitado")
</verification>

<success_criteria>
O envio do push existe ponta a ponta no backend (fila → destinatários → FCM → limpeza), pronto para os ganchos do 07-09 (C-03).
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-07-SUMMARY.md`
</output>

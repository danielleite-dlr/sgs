---
phase: 04-bridal-contracts
plan: 10
type: execute
wave: 3
depends_on: ["04-01", "04-02", "04-06"]
files_modified:
  - apps/backend/src/contracts/alerts/alert-candidates.ts
  - apps/backend/src/contracts/alerts/alert-candidates.spec.ts
  - apps/backend/src/contracts/alerts/contract-alerts.service.ts
  - apps/backend/src/contracts/alerts/contract-alerts.scheduler.ts
  - apps/backend/src/contracts/alerts/contract-alerts.processor.ts
  - apps/backend/src/contracts/alerts/contract-alerts.resolver.ts
  - apps/backend/src/contracts/alerts/contract-alerts.module.ts
  - apps/backend/src/graphql/schema/contract-alerts.graphql
  - apps/backend/src/email/email.service.ts
  - apps/backend/test/integration/phase4-contract-alerts.e2e.spec.ts
  - apps/backend/test/integration/phase4-alerts-boot.e2e.spec.ts
autonomous: true
requirements: [CONT-02]

must_haves:
  truths:
    - "Sem ação manual, um job diário (no fuso da org, a partir das 8h) gera alertas de restante vencendo em ≤3 dias, restante vencido, entrada não paga após N dias, contrato não aceito após N dias e sinal de acompanhante avulsa pendente perto do evento (D-20)"
    - "Cada alerta vira notificação no sino só para ADMIN/MANAGER ativos, sem repetir o mesmo alerta (contrato + tipo + estado) em dias seguintes (D-21)"
    - "Quando a pendência some (ex.: quitado), a notificação aberta é marcada como lida automaticamente"
    - "Um e-mail de resumo diário por org lista as pendências abertas para cada ADMIN/MANAGER com e-mail"
    - "O job roda no máximo uma vez por data local por org e recupera execuções perdidas"
    - "ADMIN/MANAGER podem disparar a checagem na hora (runContractAlertsNow) para a própria org"
  artifacts:
    - path: "apps/backend/src/contracts/alerts/alert-candidates.ts"
      exports: ["buildAlertCandidates", "AlertCandidate", "ALERT_KINDS"]
    - path: "apps/backend/src/contracts/alerts/contract-alerts.service.ts"
      exports: ["ContractAlertsService"]
    - path: "apps/backend/src/contracts/alerts/contract-alerts.scheduler.ts"
      contains: "upsertJobScheduler"
  key_links:
    - from: "ContractAlertsService.tick"
      to: "job_list_active_orgs()"
      via: "$queryRaw sem tenant (Pitfall 1)"
      pattern: "job_list_active_orgs"
    - from: "ContractAlertsService.runForOrg"
      to: "contract_alert_runs"
      via: "INSERT ... ON CONFLICT DO NOTHING na mesma transação das notificações"
      pattern: "contract_alert_runs"
    - from: "ContractAlertsService.runForOrg"
      to: "EmailService.sendContractDigest"
      via: "após commit"
      pattern: "sendContractDigest"
---

<objective>
Alertas automáticos de contrato (CONT-02; D-20, D-21; critério de sucesso 4): primeiro job BullMQ do projeto (scheduler horário idempotente), lógica por org com "hoje" local, candidatos calculados por função pura, notificações deduplicadas por destinatário ADMIN/MANAGER e e-mail diário de resumo.

Purpose: o proprietário é avisado de entrada/restante vencendo ou vencido sem verificar manualmente.
Output: módulo de alertas preenchido, SDL `contract-alerts.graphql`, `EmailService.sendContractDigest`, testes unit + 2 suítes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-06-SUMMARY.md
@apps/backend/src/queue/queue.module.ts
@apps/backend/src/email/email.service.ts
@apps/backend/src/catalog/products/stock.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4`. Valkey local em `localhost:6379`. NÃO usar `@nestjs/schedule`. NÃO subir bullmq/@nestjs/bullmq.

<interfaces>
- bullmq 5.76.5: `queue.upsertJobScheduler(id, { pattern: '0 * * * *' }, { name: 'tick', opts: { removeOnComplete: true } })`; `@nestjs/bullmq` 10.2.3: `BullModule.registerQueue({ name })`, `@InjectQueue(name)`, `@Processor(name) class X extends WorkerHost { async process(job) {} }`.
- `AppConfigService.contractAlertsSchedulerEnabled()` (04-01; `false` nas suítes via setup.ts).
- `job_list_active_orgs()` → `(organization_id uuid, timezone varchar)`.
- Do 04-02: `computeContractStatus(...)`, `formatBRL`, `formatDateBR`, `daysBetween`. Do 04-06: `ContractSettingsService.getEffective(tx, orgId)` (alertDepositUnpaidDays 3, alertNotAcceptedDays 3, alertCompanionDepositDays 15).
- Notification: `{ organizationId, memberId?, kind VARCHAR(40), payload JSONB, readAt }`; dedupe por `payload: { path: ['dedupeKey'], equals: key }` (padrão de stock.ts). O sino (04-04) espera `payload.title`, `payload.message`, `payload.contractId` ou `payload.groupId`.
- EmailService: `this.adapter.send({ to, subject, html, text })`; `FRONTEND_URL` via `this.config.get`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Candidatos de alerta (função pura) + e-mail de resumo</name>
  <files>apps/backend/src/contracts/alerts/alert-candidates.ts, apps/backend/src/contracts/alerts/alert-candidates.spec.ts, apps/backend/src/email/email.service.ts</files>
  <read_first>
    - apps/backend/src/contracts/domain/contract-math.ts (04-02)
    - apps/backend/src/email/email.service.ts
    - apps/backend/src/email/file-outbox.adapter.ts (formato do outbox)
  </read_first>
  <behavior>
    - Contrato ativo, saldo > 0, prazo daqui a 3 dias → 1 candidato `contract_balance_due_soon`, state = data do prazo
    - Mesmo contrato, prazo ontem → `contract_balance_overdue` (e NÃO due_soon)
    - Entrada pendente com aceite há 3 dias e limiar 3 → `contract_deposit_unpaid`; com 2 dias → nenhum
    - `awaiting_acceptance` com link gerado há 3 dias e limiar 3 → `contract_not_accepted`, state = `v<currentVersion>`
    - Acompanhante não coberta com agendamento do grupo sem sinal e evento em 10 dias (limiar 15) → `bridal_companion_deposit_pending`; evento em 20 dias → nenhum; com sinal > 0 → nenhum
    - Contrato `cancelled` ou `draft` → nenhum candidato de contrato
  </behavior>
  <action>
1. `alert-candidates.ts`: `ALERT_KINDS = ['contract_balance_due_soon','contract_balance_overdue','contract_deposit_unpaid','contract_not_accepted','bridal_companion_deposit_pending'] as const`; `interface AlertCandidate { kind; entityType: 'contract' | 'bridal_group'; entityId; state: string; dedupeKey: string /* `${kind}:${entityId}:${state}` */; title: string; message: string; payload: Record<string, unknown> }`; `buildAlertCandidates(input: { today: string; settings: { depositUnpaidDays; notAcceptedDays; companionDepositDays }; contracts: { id; code; status; brideName; totalCents; depositCents; paymentsCents: number[]; balanceDueDate; createdLocalDate; acceptedLocalDate: string | null; linkGeneratedLocalDate: string | null; currentVersion }[]; companions: { groupId; groupName; eventDate; memberId; clientName; depositCents: number; hasAppointments: boolean }[] }): AlertCandidate[]`. Títulos/mensagens PT-BR com valores: ex. `Restante vence em ${n} dia(s)` / `${code} — ${brideName}: saldo ${formatBRL(balance)} até ${formatDateBR(prazo)}`; `Restante vencido`; `Entrada não paga`; `Contrato não aceito`; `Sinal pendente de acompanhante` (`${clientName} — ${groupName}, evento em ${formatDateBR}`). `payload` = `{ title, message, dedupeKey, contractId?, code?, groupId?, memberId?, state }`. Status 'cancelled'/'draft'/'completed' sem candidatos de contrato; `contract_not_accepted` só para `awaiting_acceptance`.
2. `EmailService.sendContractDigest(to: string, orgName: string, items: { title: string; message: string; href: string }[]): Promise<void>` — assunto `Pendências de contratos — ${orgName}`; html com lista `<ul>` (escapar `&<>"'` com função local `escapeHtml`) e link absoluto `${FRONTEND_URL}${href}`; texto equivalente.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- alert-candidates</automated>
  </verify>
  <acceptance_criteria>
    - Spec verde cobrindo os 6 comportamentos
    - `grep -n "sendContractDigest" apps/backend/src/email/email.service.ts` encontra; `grep -n "escapeHtml" apps/backend/src/email/email.service.ts` encontra
  </acceptance_criteria>
  <done>Regras dos 4 tipos de alerta de D-20 testadas sem banco; e-mail de resumo disponível.</done>
</task>

<task type="auto">
  <name>Task 2: ContractAlertsService (runForOrg/tick), scheduler BullMQ, processor e mutation</name>
  <files>apps/backend/src/contracts/alerts/contract-alerts.service.ts, apps/backend/src/contracts/alerts/contract-alerts.scheduler.ts, apps/backend/src/contracts/alerts/contract-alerts.processor.ts, apps/backend/src/contracts/alerts/contract-alerts.resolver.ts, apps/backend/src/contracts/alerts/contract-alerts.module.ts, apps/backend/src/graphql/schema/contract-alerts.graphql</files>
  <read_first>
    - apps/backend/src/queue/queue.module.ts
    - apps/backend/src/database/tenant-context.service.ts (runWithTenant/runWithoutTenant)
    - apps/backend/src/catalog/products/stock.ts (dedupe de notificação)
    - apps/backend/src/contracts/contract-settings.service.ts (04-06)
  </read_first>
  <action>
1. `ContractAlertsService` (injeta TenantContextService, ContractSettingsService, EmailService, Logger):
   - `runForOrg(orgId: string, now: Date, opts: { force?: boolean } = {}): Promise<{ ran: boolean; candidates: number; created: number; resolved: number; emailed: number }>` — numa `runWithTenant(orgId)`: `today = (now AT TIME ZONE tz)::date`; se `!force`: `INSERT INTO contract_alert_runs (organization_id, run_date) VALUES ($org, $today) ON CONFLICT DO NOTHING RETURNING run_date` → sem linha = `{ ran: false }`. Carrega contratos `status IN ('awaiting_acceptance','active')` com pagamentos e datas locais (`(accepted_at AT TIME ZONE tz)::date` etc.) e acompanhantes (`bridal_group_members covered_by_contract = false` de grupos `active` com `event_date >= today`, soma de `appointments.deposit_amount` dos agendamentos do grupo dessa cliente com status bloqueante, `hasAppointments`); `buildAlertCandidates`. Destinatários: `members` ativos (`status 'active'`, `deleted_at IS NULL`) cujo `roles.name IN ('ADMIN','MANAGER')` (Pitfall 10). Para cada candidato × destinatário: criar `notification { memberId, kind, payload }` se não existe NENHUMA notificação (lida ou não) desse membro com o mesmo `payload.dedupeKey` (D-21: não repetir). Auto-resolução: notificações não lidas com `kind IN ALERT_KINDS` cujo `dedupeKey` não está entre os candidatos atuais → `readAt = now`. Depois do commit: para cada destinatário com e-mail (`users.email` via `members.user_id`), se há ≥ 1 candidato, `sendContractDigest` (href `/contratos/<id>` ou `/noivas/<groupId>`); falha de e-mail só loga (não desfaz).
   - `tick(now = new Date())`: `this.tenant.runWithoutTenant(tx => tx.$queryRaw\`SELECT organization_id, timezone FROM job_list_active_orgs()\`)`; para cada org cuja hora local (`Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })`) ≥ 8 → `runForOrg(org, now)` em try/catch por org (loga e segue).
2. `ContractAlertsScheduler implements OnModuleInit`: se `config.contractAlertsSchedulerEnabled()`, `await queue.upsertJobScheduler('contract-alerts-tick', { pattern: '0 * * * *' }, { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 100 } })` (idempotente). `ContractAlertsProcessor` (`@Processor('contract-alerts')`, `extends WorkerHost`): `process()` → `alerts.tick(new Date())`. Com o scheduler desligado o processor também não deve ser registrado: montar `providers` do módulo condicionalmente via `ContractAlertsModule.register()` lendo `process.env.CONTRACT_ALERTS_SCHEDULER !== 'false'` OU registrar sempre o processor (o worker conecta no Valkey, que existe no CI) — escolher a primeira opção e registrar no SUMMARY.
3. `contract-alerts.graphql`: `type ContractAlertsRun { ran: Boolean!  candidates: Int!  created: Int!  resolved: Int!  emailed: Int! }` + `extend type Mutation { runContractAlertsNow: ContractAlertsRun! }`. Resolver: `@RequirePermission(PERMISSIONS.CONTRACT_CANCEL)` (ADMIN/MANAGER) → `runForOrg(tenant.organizationId, new Date(), { force: true })` (só a própria org).
4. `ContractAlertsModule`: `imports: [BullModule.registerQueue({ name: 'contract-alerts' }), ContractsModule, EmailModule]` (conferir exports de EmailModule), providers service/resolver (+ scheduler/processor quando habilitado), `exports: [ContractAlertsService]`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "job_list_active_orgs" apps/backend/src/contracts/alerts/contract-alerts.service.ts` encontra
    - `grep -n "ON CONFLICT DO NOTHING" apps/backend/src/contracts/alerts/contract-alerts.service.ts` encontra
    - `grep -n "'ADMIN', *'MANAGER'\|\"ADMIN\", *\"MANAGER\"\|ADMIN.*MANAGER" apps/backend/src/contracts/alerts/contract-alerts.service.ts` encontra
    - `grep -n "upsertJobScheduler('contract-alerts-tick'" apps/backend/src/contracts/alerts/contract-alerts.scheduler.ts` encontra
    - `grep -rn "@nestjs/schedule" apps/backend/src` não encontra
  </acceptance_criteria>
  <done>Job horário idempotente executa a checagem diária por org no fuso local.</done>
</task>

<task type="auto">
  <name>Task 3: Suítes phase4-contract-alerts e phase4-alerts-boot</name>
  <files>apps/backend/test/integration/phase4-contract-alerts.e2e.spec.ts, apps/backend/test/integration/phase4-alerts-boot.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (insertBridalGroupRow, insertContractRow)
    - apps/backend/src/email/file-outbox.adapter.ts e apps/backend/src/email/test-email.adapter.ts
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (como o TestEmailAdapter é injetado)
  </read_first>
  <action>
**phase4-contract-alerts** (obter `ContractAlertsService` via `w.app.get(ContractAlertsService)`; `now` injetado; org em `America/Sao_Paulo`):
1. Contrato ativo R$ 8.000, pago 6.400, prazo = hoje local + 3 → `runForOrg(org, now)` cria `contract_balance_due_soon` para admin e manager (2 linhas com `member_id`), nenhuma para attendant/proA (critério 4); `notifications` de attendant via GraphQL não inclui o alerta.
2. Segunda chamada no mesmo dia → `ran false`, nada novo; `runForOrg(..., now + 1 dia)` → `ran true`, sem duplicar due_soon (dedupe); mover o prazo para ontem → novo `contract_balance_overdue` (estado novo) e a due_soon aberta marcada como lida (auto-resolução).
3. Registrar pagamento do saldo via adminPrisma (`contract_payments` 1600) → próximo dia: overdue resolvida, nenhum candidato.
4. Entrada não paga: contrato aceito há 3 dias sem pagamento → `contract_deposit_unpaid`; `awaiting_acceptance` com `link_generated_at` há 3 dias → `contract_not_accepted`.
5. Acompanhante avulsa com agendamento do grupo (`appointments.bridal_group_id`, `deposit_amount 0`) e evento em 10 dias → `bridal_companion_deposit_pending` com `payload.groupId`.
6. Fuso (Pitfall 9): `now = 2026-12-10T02:30:00Z` (= 09/12 23:30 em São Paulo) usa a data local 09/12 para o prazo e para `contract_alert_runs.run_date`.
7. E-mail: com `TestEmailAdapter`, um resumo por destinatário com assunto `Pendências de contratos — ...` e os títulos dos alertas; sem candidatos → nenhum e-mail.
8. `tick(now)` com 2 orgs (uma com hora local < 8) roda só a org elegível; `runContractAlertsNow` como manager → `ran true` só na própria org; como attendant → permissão negada.
**phase4-alerts-boot:** com `process.env.CONTRACT_ALERTS_SCHEDULER = 'true'` antes de compilar o AppModule, o app sobe, `queue.getJobSchedulers()` contém `contract-alerts-tick` com pattern `0 * * * *`; `app.close()` limpa; remover o scheduler no `afterAll` (`queue.removeJobScheduler('contract-alerts-tick')`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-contract-alerts phase4-alerts-boot</automated>
  </verify>
  <acceptance_criteria>
    - As 2 suítes verdes; `grep -n "2026-12-10T02:30:00Z" apps/backend/test/integration/phase4-contract-alerts.e2e.spec.ts` encontra
    - `grep -n "contract-alerts-tick" apps/backend/test/integration/phase4-alerts-boot.e2e.spec.ts` encontra
  </acceptance_criteria>
  <done>CONT-02 e critério 4 provados: alertas automáticos, deduplicados, por papel, com e-mail e fuso correto.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase4` verde; boot do backend com scheduler ligado não falha.</verification>

<success_criteria>Sistema alerta automaticamente sobre entrada/restante vencendo em 3 dias ou vencido, sem verificação manual.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-10-SUMMARY.md`
</output>

---
phase: 03-core-operations
plan: 05
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - apps/backend/src/common/audit-log.ts
  - apps/backend/src/financial/client-credit.ts
  - apps/backend/src/financial/cash-ledger.ts
  - apps/backend/src/financial/client-credit.service.ts
  - apps/backend/src/financial/financial.service.ts
  - apps/backend/src/financial/financial.resolver.ts
  - apps/backend/src/financial/financial.module.ts
  - apps/backend/src/graphql/schema/financial.graphql
  - apps/backend/test/integration/phase3-client-credit.e2e.spec.ts
  - apps/backend/test/integration/phase3-financial-dashboard.e2e.spec.ts
autonomous: true
requirements: [FIN-01, FIN-02, SCHED-04, POS-02]

must_haves:
  truths:
    - "Proprietário vê no período Faturado (comandas fechadas pela data de fechamento) e Recebido (cash_movements pela data do movimento) — D-22"
    - "O breakdown por método de pagamento é sobre Recebido; o sinal conta no dia em que foi recebido; troco e estornos abatem"
    - "Buckets por dia, semana (segunda) ou mês no fuso da org, sem buracos; comanda fechada às 23:30 local cai no dia local certo"
    - "Só ADMIN e MANAGER acessam o dashboard; PROFESSIONAL vê apenas as próprias comissões (filtro forçado no backend)"
    - "Saldo de crédito do cliente = soma dos movimentos e nunca fica negativo; ajuste manual exige permissão credit.adjust e motivo, e gera audit_log"
  artifacts:
    - path: "apps/backend/src/financial/client-credit.ts"
      provides: "lockClient, getCreditBalanceCents, recordCreditMovement, CreditError"
      exports: ["lockClient", "getCreditBalanceCents", "recordCreditMovement"]
    - path: "apps/backend/src/financial/cash-ledger.ts"
      provides: "recordCashMovement"
      exports: ["recordCashMovement"]
    - path: "apps/backend/src/common/audit-log.ts"
      provides: "recordAudit"
      exports: ["recordAudit"]
    - path: "apps/backend/src/financial/financial.service.ts"
      provides: "summary (SQL direto, D-17), cashMovements, commissionRecords, commissionTotals"
    - path: "apps/backend/src/graphql/schema/financial.graphql"
      provides: "financialSummary, cashMovements, commissionRecords, commissionTotals, clientCreditBalances, clientCreditMovements, adjustClientCredit"
      contains: "financialSummary"
  key_links:
    - from: "financial.service.summary"
      to: "organizations.timezone"
      via: "AT TIME ZONE no SQL"
      pattern: "AT TIME ZONE"
    - from: "financial.resolver commissionRecords"
      to: "tenant.memberId"
      via: "filtro forçado para PROFESSIONAL"
      pattern: "PROFESSIONAL"
    - from: "client-credit.recordCreditMovement"
      to: "lockClient (FOR UPDATE em clients)"
      via: "pré-condição documentada e testada"
      pattern: "FOR UPDATE"
---

<objective>
Entregar o lado financeiro de leitura e o ledger de crédito: helpers transacionais de crédito de cliente, caixa e auditoria (consumidos pelo 03-06 e 03-07), dashboard com Faturado + Recebido por método (D-22) em SQL direto (D-17) no fuso da org, listas de movimentos de caixa e de comissões (escopo PROFESSIONAL), saldos de crédito e ajuste manual (D-11).

Purpose: FIN-01 e a parte de leitura do FIN-02; a fonte da verdade do sinal (SCHED-04) e do crédito como meio de pagamento (POS-02).
Output: `src/financial/*`, `src/common/audit-log.ts`, `financial.graphql`, 2 suítes de integração. Os testes inserem comandas/movimentos/comissões direto via `adminPrisma` (não dependem do fechamento do 03-07).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@.planning/phases/03-core-operations/03-01-SUMMARY.md
@apps/backend/src/appointments/appointments.resolver.ts
@apps/backend/src/catalog/products/products.service.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.

**Arquivos que este plano NÃO toca** (planos paralelos): `src/appointments/**`, `src/comandas/**`, `appointments.graphql`, `comandas.graphql`, `src/database/**`, `app.module.ts`, `schema.prisma`, `permissions.catalog.ts`.

<interfaces>
De 03-01: `toCents, fromCents, parseMoneyInput` (`common/money.ts`); PERMISSIONS `FINANCIAL_READ 'financial.read'`, `COMMISSION_RECORD_READ 'commissionRecord.read'`, `CREDIT_READ 'credit.read'`, `CREDIT_ADJUST 'credit.adjust'`; modelos `ClientCreditMovement(clientId, amount, kind ∈ deposit|manual_adjustment|consumption|reopen_refund, appointmentId, comandaId, cycle, reason, createdBy)`, `CashMovement(kind ∈ deposit_in|payment_in|change_out|reversal, method ∈ cash|pix|credit_card|debit_card|transfer, amount ±, comandaId, appointmentId, clientId, cycle, occurredAt, memberId, note)`, `CommissionRecord(comandaId, comandaItemId, memberId, kind accrual|reversal, cycle, baseAmount, chargedAmount, ruleId, ruleKind, ruleValue, noRule, ruleSnapshot, calculatedAmount, reversesRecordId, calculatedAt)`, `AuditLog(actorMemberId, action, entityType, entityId, reason, metadata)`, `Comanda(code, status, total, closedAt, ...)`, `Organization.timezone` (default America/Sao_Paulo).
Ledgers são append-only para `sgs_app` (REVOKE UPDATE/DELETE) — nunca escrever UPDATE neles.
`scopeProfessionalFilter(tenant, requested)` em `appointments.resolver.ts` (importar dali).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Helpers transacionais de crédito, caixa e auditoria + ClientCreditService (saldos, extrato, ajuste)</name>
  <files>apps/backend/src/common/audit-log.ts, apps/backend/src/financial/client-credit.ts, apps/backend/src/financial/cash-ledger.ts, apps/backend/src/financial/client-credit.service.ts, apps/backend/src/financial/financial.module.ts, apps/backend/test/integration/phase3-client-credit.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/catalog/products/products.service.ts (adjustStock: padrão `$queryRaw ... FOR UPDATE`)
    - apps/backend/src/financial/financial.module.ts (vazio, de 03-01)
    - apps/backend/prisma/schema.prisma (ClientCreditMovement, CashMovement, AuditLog)
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
  </read_first>
  <action>
**common/audit-log.ts**:
```ts
export async function recordAudit(tx: TenantPrismaClient, a: { orgId: string; actorMemberId: string | null; action: string; entityType: string; entityId: string; reason?: string | null; metadata?: Record<string, unknown> }): Promise<void>; // tx.auditLog.create
```

**financial/client-credit.ts** (todas recebem `tx` — nunca abrem transação própria; anti-pattern "transação aninhada"):
```ts
export class CreditError extends Error { constructor(public readonly code: 'CREDIT_INSUFFICIENT' | 'CLIENT_NOT_FOUND', message: string) { super(message); } }
/** SELECT id FROM clients WHERE id = $1 AND deleted_at IS NULL FOR UPDATE — serializa uso concorrente do saldo (Pitfall 3). Lança CreditError('CLIENT_NOT_FOUND') se não achar. */
export async function lockClient(tx: TenantPrismaClient, clientId: string): Promise<void>;
/** Σ amount dos movimentos do cliente, em centavos. */
export async function getCreditBalanceCents(tx: TenantPrismaClient, clientId: string): Promise<number>;
/** Pré-condição: lockClient(tx, clientId) já chamado nesta transação. Se balance + amountCents < 0 → CreditError('CREDIT_INSUFFICIENT', `Saldo de crédito insuficiente (disponível: R$ ${formatado}).`). amountCents ≠ 0. */
export async function recordCreditMovement(tx: TenantPrismaClient, a: { orgId: string; clientId: string; amountCents: number; kind: 'deposit' | 'manual_adjustment' | 'consumption' | 'reopen_refund'; appointmentId?: string | null; comandaId?: string | null; cycle?: number | null; reason?: string | null; createdBy: string | null }): Promise<ClientCreditMovement>;
```
Formatação "R$ 50,00": `(cents/100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })` só para mensagem.

**financial/cash-ledger.ts**:
```ts
export async function recordCashMovement(tx: TenantPrismaClient, a: { orgId: string; kind: 'deposit_in' | 'payment_in' | 'change_out' | 'reversal'; method: 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'transfer'; amountCents: number; comandaId?: string | null; appointmentId?: string | null; clientId?: string | null; cycle?: number | null; memberId?: string | null; occurredAt?: Date; note?: string | null }): Promise<void>;
```
`amountCents === 0` → não grava (CHECK amount <> 0).

**financial/client-credit.service.ts** (`@Injectable() ClientCreditService`):
- `balances(orgId)`: `$queryRaw` `SELECT c.id AS client_id, c.full_name, SUM(m.amount)::text AS balance FROM client_credit_movements m JOIN clients c ON c.id = m.client_id GROUP BY c.id, c.full_name HAVING SUM(m.amount) > 0 ORDER BY c.full_name` → `{ clientId, clientName, balance: fromCents(toCents(balance)) }`.
- `movements(orgId, clientId)`: `findMany` ordem `createdAt desc` → amount com 2 casas.
- `balance(orgId, clientId)`: string.
- `adjust(orgId, memberId, { clientId, amount, reason })`: `amount` casa `^-?\d+(\.\d{1,2})?$` e ≠ 0 (`INVALID_AMOUNT`); `reason.trim().length >= 3` (`REASON_REQUIRED`); `runWithTenant`: `lockClient` → `recordCreditMovement(kind 'manual_adjustment', reason)` → `recordAudit(action 'credit.adjust', entityType 'client', entityId clientId, reason, metadata { amount })`. `CreditError('CREDIT_INSUFFICIENT')` vira `{ code: 'CREDIT_NEGATIVE', message: 'O ajuste deixaria o saldo do cliente negativo.' }`. Ajuste manual não gera `cash_movements` (devolução em dinheiro fica fora do caixa nesta fase; registrar no SUMMARY).

Registrar `ClientCreditService` em `financial.module.ts` (providers + exports). Resolver vem na Task 2 (mesmo arquivo `financial.resolver.ts`).

**phase3-client-credit.e2e.spec.ts** (prefixo `p3cred`; chama o service via `world.app.get(ClientCreditService)` e os helpers dentro de `TenantContextService.runWithTenant`):
1. recordCreditMovement +5000 (deposit) → balance 5000; -3000 (consumption) → 2000; -3000 → CreditError CREDIT_INSUFFICIENT e nada gravado.
2. Concorrência: saldo 5000; duas transações paralelas, cada uma `lockClient` + consumo -4000 → exatamente uma passa (saldo final 1000).
3. adjust "+20.00" com reason → movimento manual_adjustment + linha em audit_log com action 'credit.adjust'; adjust sem reason → REASON_REQUIRED; adjust "-999.00" → CREDIT_NEGATIVE.
4. balances lista só clientes com saldo > 0.
5. `appPrisma` (sgs_app) com `SET LOCAL app.current_organization`: `UPDATE client_credit_movements SET amount = 1` → erro de permissão (`permission denied`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-client-credit && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - client-credit.ts contém `FOR UPDATE` e `CREDIT_INSUFFICIENT` e exporta `lockClient`, `getCreditBalanceCents`, `recordCreditMovement`
    - cash-ledger.ts exporta `recordCashMovement`; audit-log.ts exporta `recordAudit`
    - `grep -rn "\$transaction\|runWithTenant" apps/backend/src/financial/client-credit.ts apps/backend/src/financial/cash-ledger.ts apps/backend/src/common/audit-log.ts` não retorna nada
    - financial.module.ts registra `ClientCreditService`
    - phase3-client-credit.e2e.spec.ts passa (≥ 5 casos, incluindo o de concorrência)
  </acceptance_criteria>
  <done>Ledger de crédito/caixa/auditoria pronto para ser usado dentro de outras transações; saldos e ajuste manual funcionando.</done>
</task>

<task type="auto">
  <name>Task 2: financial.graphql + FinancialService (dashboard D-22, caixa, comissões) + resolver com RBAC</name>
  <files>apps/backend/src/graphql/schema/financial.graphql, apps/backend/src/financial/financial.service.ts, apps/backend/src/financial/financial.resolver.ts, apps/backend/src/financial/financial.module.ts, apps/backend/test/integration/phase3-financial-dashboard.e2e.spec.ts</files>
  <read_first>
    - .planning/phases/03-core-operations/03-RESEARCH.md seções "Pattern 7" e "Dashboard: receita por bucket e por método"
    - .planning/phases/03-core-operations/03-CONTEXT.md D-16, D-17, D-22, D-24
    - apps/backend/src/appointments/appointments.resolver.ts (scopeProfessionalFilter, decorators)
    - apps/backend/src/financial/client-credit.service.ts (Task 1)
  </read_first>
  <action>
**financial.graphql**:
```graphql
extend type Query {
  "from/to = datas locais YYYY-MM-DD (to exclusivo); granularity = day | week | month"
  financialSummary(from: String!, to: String!, granularity: String!): FinancialSummary!
  cashMovements(from: String!, to: String!): [CashMovementEntry!]!
  commissionRecords(from: String!, to: String!, memberId: UUID): [CommissionRecordEntry!]!
  commissionTotals(from: String!, to: String!, memberId: UUID): [CommissionMemberTotal!]!
  clientCreditBalances: [ClientCreditBalance!]!
  clientCreditMovements(clientId: UUID!): [ClientCreditMovementEntry!]!
}
extend type Mutation {
  adjustClientCredit(input: AdjustClientCreditInput!): ClientCreditPayload!
}
type FinancialSummary {
  from: String! to: String! timezone: String! granularity: String!
  billedTotal: String! receivedTotal: String! closedComandas: Int! averageTicket: String! commissionsTotal: String!
  buckets: [FinancialBucket!]!
  receivedByMethod: [MethodTotal!]!
}
type FinancialBucket { bucketStart: String! billed: String! received: String! closedComandas: Int! }
type MethodTotal { method: String! total: String! }
type CashMovementEntry { id: UUID! kind: String! method: String! amount: String! occurredAt: DateTime! comandaId: UUID comandaCode: String appointmentId: UUID clientName: String note: String }
type CommissionRecordEntry {
  id: UUID! comandaId: UUID! comandaCode: String! comandaItemId: UUID! memberId: UUID! memberName: String!
  kind: String! cycle: Int! itemName: String! baseAmount: String! chargedAmount: String!
  ruleKind: String ruleValue: String noRule: Boolean! calculatedAmount: String! reversed: Boolean!
  ruleSnapshot: String! calculatedAt: DateTime!
}
type CommissionMemberTotal { memberId: UUID! memberName: String! total: String! records: Int! noRuleCount: Int! }
type ClientCreditBalance { clientId: UUID! clientName: String! balance: String! }
type ClientCreditMovementEntry { id: UUID! kind: String! amount: String! reason: String appointmentId: UUID comandaId: UUID createdAt: DateTime! }
input AdjustClientCreditInput { clientId: UUID! amount: String! reason: String! }
type ClientCreditPayload { balance: String errors: [UserError!]! }
```

**financial.service.ts** (`@Injectable() FinancialService`, todas as queries em `runWithTenant` com `$queryRaw` tagged template — RLS aplica; numerics saem `::text` e passam por `fromCents(toCents(x))`):
- Validação: `from`/`to` casam `^\d{4}-\d{2}-\d{2}$`, `from < to`, intervalo ≤ 400 dias; `granularity ∈ ['day','week','month']` (senão `BadRequestException` com mensagem pt-BR — leitura, não payload).
- `tz` = `organizations.timezone` lido via `tx.organization.findUnique({ where: { id: orgId } })`.
- **Faturado por bucket** (D-22 competência):
```sql
WITH series AS (
  SELECT gs::date AS bucket FROM generate_series(date_trunc(${unit}, ${from}::date)::date, (${to}::date - 1), ('1 ' || ${unit})::interval) gs
), billed AS (
  SELECT date_trunc(${unit}, closed_at AT TIME ZONE ${tz})::date AS bucket, SUM(total) AS v, COUNT(*) AS n
  FROM comandas WHERE status = 'closed'
    AND closed_at >= (${from}::date)::timestamp AT TIME ZONE ${tz} AND closed_at < (${to}::date)::timestamp AT TIME ZONE ${tz}
  GROUP BY 1
), received AS (
  SELECT date_trunc(${unit}, occurred_at AT TIME ZONE ${tz})::date AS bucket, SUM(amount) AS v
  FROM cash_movements
  WHERE occurred_at >= (${from}::date)::timestamp AT TIME ZONE ${tz} AND occurred_at < (${to}::date)::timestamp AT TIME ZONE ${tz}
  GROUP BY 1
)
SELECT s.bucket::text AS bucket, COALESCE(b.v,0)::text AS billed, COALESCE(r.v,0)::text AS received, COALESCE(b.n,0)::int AS n
FROM series s LEFT JOIN billed b USING (bucket) LEFT JOIN received r USING (bucket) ORDER BY s.bucket
```
(`unit` vem do whitelist `day|week|month`; `date_trunc('week')` = segunda.)
- **Recebido por método** (D-22 caixa): `SELECT method, SUM(amount)::text AS total FROM cash_movements WHERE occurred_at` no intervalo `GROUP BY method HAVING SUM(amount) <> 0 ORDER BY SUM(amount) DESC`. `client_credit` nunca aparece (não gera cash movement; o dinheiro entrou no sinal — evita dupla contagem).
- KPIs: `billedTotal = Σ billed`, `receivedTotal = Σ received`, `closedComandas = Σ n`, `averageTicket = n ? round(billedCents / n) : 0`, `commissionsTotal = SUM(commission_records.calculated_amount)` com `calculated_at` no intervalo (reversões negativas já abatem).
- `cashMovements(orgId, from, to)`: movimentos do intervalo com `LEFT JOIN comandas` (code) e `LEFT JOIN clients` (full_name), ordem `occurred_at DESC`, limite 500.
- `commissionRecords(orgId, { from, to, memberId? })`: `calculated_at` no intervalo, `JOIN comandas` (code), `JOIN members` (display_name), `reversed = EXISTS (SELECT 1 FROM commission_records r WHERE r.reverses_record_id = cr.id)`, `itemName = rule_snapshot->>'itemName'`, `ruleSnapshot = rule_snapshot::text`, ordem `calculated_at DESC`. Exibir sempre o snapshot (Pitfall 9: nunca join em commission_rules).
- `commissionTotals`: agrupado por membro: `SUM(calculated_amount)`, `COUNT(*) FILTER (WHERE kind='accrual')`, `COUNT(*) FILTER (WHERE no_rule AND kind='accrual' AND NOT EXISTS reversal)` → `noRuleCount` (D-24: aviso para o gerente).

**financial.resolver.ts**:
- `financialSummary`, `cashMovements` → `@RequirePermission(PERMISSIONS.FINANCIAL_READ)`.
- `commissionRecords`, `commissionTotals` → `@RequirePermission(PERMISSIONS.COMMISSION_RECORD_READ)` com `memberId: scopeProfessionalFilter(tenant, memberId)` (D-20: PROFESSIONAL sempre = ele mesmo).
- `clientCreditBalances`, `clientCreditMovements` → `CREDIT_READ`; `adjustClientCredit` → `CREDIT_ADJUST` (retorna `{ balance, errors }`).
Registrar `FinancialService` e `FinancialResolver` em `financial.module.ts`.

**phase3-financial-dashboard.e2e.spec.ts** (prefixo `p3dash`): via adminPrisma, na org A (timezone America/Sao_Paulo), inserir:
- comanda C1 `closed`, total "185.00", `closed_at = '2030-03-10T02:30:00Z'` (= 09/03 23:30 local); comanda C2 `closed` total "100.00" `closed_at = '2030-03-10T15:00:00Z'`; comanda C3 `open` total "999.00".
- cash_movements: `deposit_in pix 50.00` em `2030-03-05T13:00Z`; `payment_in pix 100.00` e `payment_in cash 50.00` e `change_out cash -15.00` em `2030-03-10T02:30Z`; `payment_in credit_card 100.00` em `2030-03-10T15:00Z`.
- commission_records: accrual 40.00 (proA, C1), accrual 0.00 `no_rule` (proB, C1), accrual 30.00 (proB, C2) com `calculated_at` iguais aos fechamentos.
Casos:
1. `financialSummary(from:"2030-03-01", to:"2030-04-01", granularity:"day")` → 31 buckets; bucket "2030-03-09" billed "185.00"; bucket "2030-03-10" billed "100.00"; bucket "2030-03-05" received "50.00"; `billedTotal "285.00"`, `receivedTotal "285.00"` (50+100+50−15+100), `closedComandas 2`, `averageTicket "142.50"`, `commissionsTotal "70.00"`.
2. `receivedByMethod` = pix "150.00", credit_card "100.00", cash "35.00"; sem `client_credit`.
3. granularity "week" → bucket "2030-03-04" (segunda) contém o sinal; "month" → 1 bucket "2030-03-01".
4. Org B não vê nada da org A (totais "0.00").
5. ATTENDANT e PROFESSIONAL em `financialSummary` → erro de permissão; MANAGER ok.
6. `commissionRecords` com token PROFESSIONAL proB pedindo `memberId: proA` → só registros do proB; `commissionTotals` do proB → `noRuleCount 1`.
7. `from` inválido ("10/03/2030") → erro.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-financial-dashboard|phase3-client-credit" && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - financial.graphql contém `financialSummary(from: String!, to: String!, granularity: String!): FinancialSummary!`, `billedTotal: String!`, `receivedTotal: String!`, `receivedByMethod: [MethodTotal!]!`, `noRuleCount: Int!`
    - financial.service.ts contém `AT TIME ZONE`, `generate_series`, `status = 'closed'` e `FROM cash_movements` e não contém `$queryRawUnsafe`
    - financial.resolver.ts contém `PERMISSIONS.FINANCIAL_READ`, `PERMISSIONS.COMMISSION_RECORD_READ`, `PERMISSIONS.CREDIT_ADJUST` e `scopeProfessionalFilter`
    - phase3-financial-dashboard.e2e.spec.ts passa (≥ 7 casos)
  </acceptance_criteria>
  <done>Dashboard FIN-01 com Faturado e Recebido por método em dia/semana/mês, listas de caixa e comissões com escopo, crédito de cliente consultável e ajustável.</done>
</task>

</tasks>

<verification>
Gate completo verde; `test:integration -- --testPathPattern "phase3-financial|phase3-client-credit"` verde.
</verification>

<success_criteria>
- Critério #4 do ROADMAP coberto no backend (dia/semana/mês + breakdown por método)
- Helpers `lockClient`/`recordCreditMovement`/`recordCashMovement`/`recordAudit` prontos para 03-06 e 03-07
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-05-SUMMARY.md`
</output>

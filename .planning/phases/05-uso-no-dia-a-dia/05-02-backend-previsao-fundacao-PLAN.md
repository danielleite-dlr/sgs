---
phase: 05-uso-no-dia-a-dia
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/migrations/20261106000000_phase5_fixed_expenses/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/authz/permissions.catalog.ts
  - apps/backend/src/financial/forecast.ts
  - apps/backend/src/financial/forecast.spec.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "Existe a tabela fixed_expenses (nome, valor, dia de vencimento, ativo) com FORCE RLS por organização (D-06)"
    - "ADMIN e MANAGER têm a permissão financial.expenseWrite no catálogo TS e no banco"
    - "Despesa com vencimento dia 31 cai no último dia de meses curtos e só entra se estiver dentro da janela"
    - "Parcelas e restante vencidos e não pagos entram na semana 1 com a marca em atraso (D-09)"
    - "Comissão sem profissional definido usa a regra padrão da org; sem ela, a maior comissão entre as regras aplicáveis ao serviço (D-10)"
    - "A janela de 30 dias vira 5 semanas a partir do primeiro dia (4 de 7 dias + 1 de 2 dias), com totais em centavos inteiros"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261106000000_phase5_fixed_expenses/migration.sql"
      provides: "Tabela fixed_expenses + RLS + grant + seed de permissão"
      contains: "FORCE ROW LEVEL SECURITY"
    - path: "apps/backend/src/financial/forecast.ts"
      provides: "Funções puras da previsão"
      exports: ["FORECAST_APPOINTMENT_STATUSES", "FORECAST_HORIZON_DAYS", "expandFixedExpenses", "contractReceivables", "appointmentInflowCents", "fallbackCommission", "buildWeeklyBuckets", "summarizeForecast"]
    - path: "apps/backend/src/financial/forecast.spec.ts"
      provides: "Testes unitários das funções puras"
  key_links:
    - from: "apps/backend/src/financial/forecast.ts"
      to: "apps/backend/src/contracts/domain/contract-math.ts"
      via: "allocateInstallments"
      pattern: "allocateInstallments"
    - from: "apps/backend/src/financial/forecast.ts"
      to: "apps/backend/src/financial/commission-resolver.ts"
      via: "computeCommission no fallback"
      pattern: "computeCommission"
---

<objective>
Fundação do backend da previsão de 30 dias (FIN-03; D-04, D-05, D-06, D-09, D-10, D-13): migration `fixed_expenses` com RLS, modelo Prisma, permissão `financial.expenseWrite`, e o núcleo de regras como funções puras testadas (despesas fixas, recebíveis de contrato com atraso, valor do agendamento, comissão de fallback, buckets semanais, totais).

Purpose: as regras de dinheiro ficam isoladas e testáveis antes de qualquer SQL ou tela.
Output: migration, `schema.prisma`, catálogo de permissões, `forecast.ts` + `forecast.spec.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-RESEARCH.md

<interfaces>
From apps/backend/src/contracts/domain/contract-math.ts:
```typescript
export interface InstallmentInput { seq: number; dueDate: string; cents: number; }
export interface InstallmentStatus extends InstallmentInput { paidCents: number; pendingCents: number; state: 'paid'|'partial'|'open'; overdue: boolean; }
export function allocateInstallments(installments: InstallmentInput[], netPaidCents: number, today: string): InstallmentStatus[];
```
From apps/backend/src/financial/commission-resolver.ts:
```typescript
export type RuleLite = { id: string; scopeType: 'member_service'|'service'|'category'|'product'|'default'; kind: 'fixed'|'percentage'; value: string; memberId?: string|null; serviceId?: string|null; categoryId?: string|null; productId?: string|null; deletedAt?: Date|null };
export function resolveCommissionRule(rules: RuleLite[], item: { kind: 'service'|'product'; memberId: string; serviceId?: string|null; productId?: string|null; categoryChain: string[] }): { rule: RuleLite; matchedCategoryId: string|null } | null;
export function computeCommission(match: { rule: RuleLite } | null, a: { listUnitCents: number; quantity: number; chargedCents: number }): { baseCents: number; chargedCents: number; amountCents: number; noRule: boolean };
```
From apps/backend/src/common/money.ts: `toCents(v)`, `fromCents(cents): string` ("80.50").
Status de agendamento (CHECK da migration 20261101000000): scheduled, confirmed, in_progress, completed, cancelled, no_show.
Última migration existente: `20261105010000_seed_studio_js_contract`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration fixed_expenses + modelo Prisma + permissão financial.expenseWrite</name>
  <files>apps/backend/prisma/migrations/20261106000000_phase5_fixed_expenses/migration.sql, apps/backend/prisma/schema.prisma, apps/backend/src/authz/permissions.catalog.ts</files>
  <read_first>
    - apps/backend/prisma/migrations/20261105000000_contract_layout_studio_js/migration.sql (bloco RLS das linhas ~112-123 e bloco DO $$ de grant ao sgs_app)
    - apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql (bloco "S. Seed de permissoes da Fase 4", linhas ~455-487)
    - apps/backend/prisma/migrations/20260929120000_member_contact_and_categories/migration.sql (GRANT SELECT, INSERT, UPDATE, DELETE ... TO sgs_app dentro de DO $$)
    - apps/backend/prisma/schema.prisma (model Organization e model ContractDepositInstallment como modelo de estilo)
    - apps/backend/src/authz/permissions.catalog.ts
  </read_first>
  <action>
1. Criar `apps/backend/prisma/migrations/20261106000000_phase5_fixed_expenses/migration.sql`:
```sql
-- Fase 5 (FIN-03, D-06): despesas fixas mensais, só para alimentar a previsão de 30 dias.
CREATE TABLE fixed_expenses (
  id              UUID NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID NOT NULL,
  name            VARCHAR(120) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  due_day         SMALLINT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_fixed_expenses PRIMARY KEY (id),
  CONSTRAINT fk_fe_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT chk_fe_amount CHECK (amount > 0),
  CONSTRAINT chk_fe_due_day CHECK (due_day BETWEEN 1 AND 31),
  CONSTRAINT chk_fe_name CHECK (length(btrim(name)) >= 2)
);
CREATE INDEX ix_fe_org ON fixed_expenses(organization_id);

ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fixed_expenses
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON fixed_expenses TO sgs_app;
  END IF;
END $$;

DO $$
DECLARE
  v_admin uuid;
  v_manager uuid;
BEGIN
  SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1;
  SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;
  INSERT INTO role_permissions (role_id, permission) VALUES
    (v_admin, 'financial.expenseWrite'),
    (v_manager, 'financial.expenseWrite')
  ON CONFLICT DO NOTHING;
END $$;
```
2. `schema.prisma`: acrescentar (perto dos modelos financeiros) e a relação inversa `fixedExpenses FixedExpense[]` em `model Organization`:
```prisma
model FixedExpense {
  id             String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  name           String   @db.VarChar(120)
  amount         Decimal  @db.Decimal(12, 2)
  dueDay         Int      @map("due_day") @db.SmallInt
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId], name: "ix_fe_org")
  @@map("fixed_expenses")
}
```
3. `permissions.catalog.ts`: em `PERMISSIONS`, logo após `COMMISSION_RECORD_READ`, adicionar `// ===== Phase 5: previsão financeira =====` e `FINANCIAL_EXPENSE_WRITE: 'financial.expenseWrite',`. Adicionar `PERMISSIONS.FINANCIAL_EXPENSE_WRITE` nas listas `ADMIN` e `MANAGER` (logo após `PERMISSIONS.FINANCIAL_READ`). NÃO adicionar em ATTENDANT nem PROFESSIONAL.
4. Rodar `pnpm --filter @sgs/backend exec prisma validate && pnpm --filter @sgs/backend prisma:generate` e aplicar no banco local (`pnpm --filter @sgs/backend prisma:migrate:deploy`, carregando o `.env` linha a linha porque `DATABASE_URL` tem `&` sem aspas).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/backend exec prisma validate && pnpm --filter @sgs/backend typecheck && grep -q "FINANCIAL_EXPENSE_WRITE: 'financial.expenseWrite'" apps/backend/src/authz/permissions.catalog.ts</automated>
  </verify>
  <acceptance_criteria>
    - Migration contém `CREATE TABLE fixed_expenses`, `FORCE ROW LEVEL SECURITY`, `CREATE POLICY tenant_isolation ON fixed_expenses`, `GRANT SELECT, INSERT, UPDATE, DELETE ON fixed_expenses TO sgs_app` e `(v_admin, 'financial.expenseWrite')`
    - `schema.prisma` contém `model FixedExpense` com `@@map("fixed_expenses")` e `fixedExpenses FixedExpense[]` em `model Organization`
    - `grep -c "PERMISSIONS.FINANCIAL_EXPENSE_WRITE" apps/backend/src/authz/permissions.catalog.ts` = 2 (ADMIN e MANAGER)
    - `prisma validate` e `pnpm --filter @sgs/backend typecheck` passam; migration aplicada no Postgres local sem erro
  </acceptance_criteria>
  <done>Tabela e permissão existem no banco local e no catálogo; Prisma Client gerado com `FixedExpense`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Funções puras da previsão (forecast.ts) com testes</name>
  <files>apps/backend/src/financial/forecast.ts, apps/backend/src/financial/forecast.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/domain/contract-math.ts
    - apps/backend/src/financial/commission-resolver.ts
    - apps/backend/src/financial/commission-resolver.spec.ts (estilo de teste)
    - apps/backend/src/common/money.ts
  </read_first>
  <behavior>
    - expandFixedExpenses: dueDay 31, janela 2027-02-10..2027-03-12 → itens em 2027-02-28 e (se dentro) nenhum em março antes de 31; dueDay 5, janela 2027-01-20..2027-02-19 → 2027-02-05; inativa (active=false) nunca entra; janela cruzando ano (2026-12-20..2027-01-19, dueDay 1) → 2027-01-01
    - contractReceivables: 2 parcelas de 500 (vencem from-10 e from+5), pagamento líquido 500 → só a 2ª entra (date = from+5, overdue=false); pagamento 0 → 1ª entra com date = from e overdue=true (D-09) e 2ª em from+5; parcela que vence em/depois de `to` não entra; restante = total − max(net, deposit) entra em balanceDueDate se dentro da janela; restante com balanceDueDate < from entra em from com overdue=true; estorno (net menor) reabre parcela
    - appointmentInflowCents: comanda com itens (count 2, total 12000) e sinal 3000 → 9000; comanda com itens cujo total é 0 (count 1, total 0) → 0 (não cai para a variante); comanda sem itens (count 0, total 0 — a SQL devolve '0.00') → usa variante (12000), senão base (10000); sem comanda (count 0) → variante/base; sinal maior que o valor → 0
    - fallbackCommission: com regra default 5% e lista 10000 → 500 e ruleId da default; sem default, com regra service 20% (lista 5000 → 1000) e member_service fixa 15.00 → 1500 (maior); só categoria da cadeia → usa ela; nenhuma regra → amountCents 0 e noRule true; regras com deletedAt ignoradas
    - buildWeeklyBuckets: from 2027-03-01, to 2027-03-31 → 5 buckets [03-01..03-08), [03-08..03-15), [03-15..03-22), [03-22..03-29), [03-29..03-31); item em 03-30 cai no 5º; overdueInflow do 1º soma os itens overdue
    - summarizeForecast: inflow = soma dos `in`, outflow = soma dos `out`, balance = inflow − outflow (pode ser negativo), overdueInflow = soma dos `in` com overdue
  </behavior>
  <action>
Criar `apps/backend/src/financial/forecast.ts` (sem dependência de Nest/Prisma além de tipos; tudo em centavos inteiros):
```typescript
import { allocateInstallments, type InstallmentInput } from '../contracts/domain/contract-math';
import { computeCommission, type RuleLite } from './commission-resolver';

/** D-13: "confirmado" para a previsão. Trocar aqui muda a previsão inteira. */
export const FORECAST_APPOINTMENT_STATUSES = ['scheduled', 'confirmed'] as const;
export const FORECAST_HORIZON_DAYS = 30;

export type ForecastKind = 'appointment' | 'contract_installment' | 'contract_balance' | 'commission' | 'fixed_expense';
export interface ForecastItemCents {
  date: string;            // YYYY-MM-DD local da org
  kind: ForecastKind;
  direction: 'in' | 'out';
  cents: number;           // sempre >= 0
  label: string;
  refId: string | null;
  overdue: boolean;        // D-09
  noRule: boolean;         // comissão sem regra (R$ 0,00)
  withoutProfessional: boolean; // D-10
}
export interface ForecastBucketCents { start: string; end: string; inflowCents: number; outflowCents: number; balanceCents: number; overdueInflowCents: number; }

export function addDaysIso(date: string, days: number): string  // aritmética em UTC sobre "YYYY-MM-DD"
export function expandFixedExpenses(expenses: { id: string; name: string; cents: number; dueDay: number; active: boolean }[], from: string, to: string): ForecastItemCents[]
export function contractReceivables(c: { contractId: string; code: string; installments: InstallmentInput[]; netPaidCents: number; depositCents: number; totalCents: number; balanceDueDate: string }, from: string, to: string): ForecastItemCents[]
export function appointmentInflowCents(a: { comandaItemCount: number; comandaItemsCents: number; variantCents: number | null; baseCents: number; depositCents: number }): number
export function fallbackCommission(rules: RuleLite[], item: { serviceId: string; categoryChain: string[] }, amounts: { listUnitCents: number; quantity: number; chargedCents: number }): { amountCents: number; noRule: boolean; ruleId: string | null }
export function buildWeeklyBuckets(items: ForecastItemCents[], from: string, to: string): ForecastBucketCents[]
export function summarizeForecast(items: ForecastItemCents[]): { inflowCents: number; outflowCents: number; balanceCents: number; overdueInflowCents: number }
```
Regras exatas:
- `expandFixedExpenses`: ignora `active=false`; percorre cada mês de `from` até o mês de `to`; data = `min(dueDay, últimoDiaDoMês)`; inclui se `from <= data < to`; item `{ kind:'fixed_expense', direction:'out', label: name, refId: id, overdue:false, noRule:false, withoutProfessional:false }`; ordenado por data.
- `contractReceivables` (D-04, D-09): `allocateInstallments(installments, netPaidCents, from)`; para cada parcela com `pendingCents > 0` e `dueDate < to`: se `dueDate < from` → `date = from, overdue = true`; senão `date = dueDate, overdue = false`; `kind 'contract_installment'`, `direction 'in'`, `label = \`Contrato ${code} — parcela ${seq} do sinal\``. Restante: `balanceCents = max(0, totalCents − max(netPaidCents, depositCents))`; se `> 0` e `balanceDueDate < to`: mesma regra de atraso; `kind 'contract_balance'`, `label = \`Contrato ${code} — restante\``. `refId = contractId`.
- `appointmentInflowCents`: os dois campos da comanda chegam já como número (centavos inteiros e contagem); quem chama converte a string da SQL com `toCents` ANTES (nunca decidir pela string: `'0.00'` é truthy). Regra: `price = comandaItemCount > 0 ? comandaItemsCents : (variantCents ?? baseCents)`. Ou seja, comanda com itens vale o total dos itens, mesmo que seja 0; comanda sem itens (ou sem comanda) usa o preço da variante, senão o preço base. Retorna `max(0, price − depositCents)` (o sinal já está no caixa; Pitfall 1).
- `fallbackCommission` (D-10, para atendimento sem profissional definido): (1) regra `scopeType 'default'` não apagada → `computeCommission({rule}, amounts)`; (2) senão, candidatas não apagadas = `member_service` com `serviceId === item.serviceId` (qualquer profissional) + `service` com `serviceId === item.serviceId` + `category` com `categoryId` em `item.categoryChain`; calcular `computeCommission` de cada e pegar a de MAIOR `amountCents` (empate: a primeira na ordem member_service, service, category); (3) nenhuma → `{ amountCents: 0, noRule: true, ruleId: null }`. Escrever esse comentário-regra no topo da função.
- `buildWeeklyBuckets`: `start_k = from + 7k`, `end_k = min(start_k + 7, to)`, enquanto `start_k < to`; soma itens com `start <= date < end`.
- `summarizeForecast`: somas em centavos.

`forecast.spec.ts`: um `describe` por função cobrindo cada caso do `<behavior>` (RED primeiro, depois GREEN).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/backend test -- forecast && pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `forecast.ts` exporta `FORECAST_APPOINTMENT_STATUSES = ['scheduled', 'confirmed'] as const`, `FORECAST_HORIZON_DAYS = 30`, `expandFixedExpenses`, `contractReceivables`, `appointmentInflowCents`, `fallbackCommission`, `buildWeeklyBuckets`, `summarizeForecast`, `addDaysIso`
    - `forecast.ts` contém `allocateInstallments(` e `computeCommission(`
    - `forecast.spec.ts` tem um caso de `appointmentInflowCents` com `comandaItemCount: 0` que espera o preço da variante, e um com `comandaItemCount: 1, comandaItemsCents: 0` que espera `0`
    - `forecast.spec.ts` tem testes com `2027-02-28` (dia 31 em fevereiro), `overdue: true`/`overdue).toBe(true)` (D-09), um caso de fallback que espera `1500` e um que espera `noRule` true
    - `pnpm --filter @sgs/backend test -- forecast` passa; lint com `--max-warnings 0` passa
  </acceptance_criteria>
  <done>Regras de dinheiro da previsão implementadas e cobertas por testes unitários.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/backend test -- forecast` verde
- `pnpm --filter @sgs/backend typecheck` e `lint` verdes
- Migration aplicada localmente
</verification>

<success_criteria>
Base do critério de sucesso 3 e 4: regras de soma (agenda, parcelas, comissões, despesas fixas) e a tabela de despesas fixas existem e estão testadas.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-02-SUMMARY.md`
</output>

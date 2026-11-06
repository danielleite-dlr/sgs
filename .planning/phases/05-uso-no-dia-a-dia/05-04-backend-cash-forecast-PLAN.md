---
phase: 05-uso-no-dia-a-dia
plan: 04
type: execute
wave: 3
depends_on: ["05-02", "05-03"]
files_modified:
  - apps/backend/src/financial/financial.service.ts
  - apps/backend/src/financial/forecast.service.ts
  - apps/backend/src/financial/forecast.resolver.ts
  - apps/backend/src/financial/financial.module.ts
  - apps/backend/src/graphql/schema/forecast.graphql
  - apps/backend/test/integration/phase5-forecast.e2e.spec.ts
  - apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "cashForecast(from, to) soma como entrada os agendamentos scheduled/confirmed sem contrato (valor da comanda aberta, senão variante, senão preço base, menos o sinal) no dia local do início (D-04, D-13)"
    - "cashForecast soma como entrada as parcelas do sinal e o restante pendentes de contratos active; vencidos antes de from entram em from marcados em atraso (D-04, D-09)"
    - "cashForecast soma como saída a comissão estimada de todos os agendamentos scheduled/confirmed da janela, inclusive os ligados a contrato, e dos itens de contrato com evento na janela que ainda não têm agendamento (regra de fallback, marcados sem profissional definido) (D-05, D-10)"
    - "cashForecast soma como saída as despesas fixas ativas que vencem na janela (D-05, D-06)"
    - "Agendamentos cancelled, no_show, completed e in_progress não entram; agendamento com contrato não gera entrada (sem contar duas vezes)"
    - "Datas no fuso da org: agendamento às 22:30 do último dia entra; 00:30 do dia to não entra"
    - "Só ADMIN/MANAGER (financial.read) consultam a previsão; outra org não aparece"
  artifacts:
    - path: "apps/backend/src/graphql/schema/forecast.graphql"
      contains: "cashForecast(from: String!, to: String!): CashForecast!"
    - path: "apps/backend/src/financial/forecast.service.ts"
      exports: ["ForecastService"]
    - path: "apps/backend/test/integration/phase5-forecast.e2e.spec.ts"
      provides: "Integração ponta a ponta da previsão"
  key_links:
    - from: "apps/backend/src/financial/forecast.service.ts"
      to: "apps/backend/src/financial/forecast.ts"
      via: "contractReceivables, appointmentInflowCents, fallbackCommission, expandFixedExpenses, buildWeeklyBuckets, summarizeForecast"
      pattern: "buildWeeklyBuckets"
    - from: "apps/backend/src/financial/forecast.service.ts"
      to: "resolveCommissionRule"
      via: "comissão de agendamento com profissional"
      pattern: "resolveCommissionRule"
    - from: "apps/backend/src/financial/forecast.resolver.ts"
      to: "PERMISSIONS.FINANCIAL_READ"
      via: "@RequirePermission"
      pattern: "FINANCIAL_READ"
---

<objective>
Query `cashForecast(from, to)` (FIN-03; D-04, D-05, D-07, D-09, D-10, D-13; critérios de sucesso 2 e 3): coleta os dados da org dentro do tenant, aplica as funções puras de 05-02 e devolve totais, buckets semanais e a lista de itens com origem.

Purpose: um número confiável de quanto entra e sai nos próximos 30 dias, com a origem de cada valor.
Output: `forecast.service.ts`, `forecast.resolver.ts`, SDL `forecast.graphql`, `validateRange` exportada, suíte `phase5-forecast` + casos de RBAC.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-RESEARCH.md
@.planning/phases/05-uso-no-dia-a-dia/05-02-SUMMARY.md
@.planning/phases/05-uso-no-dia-a-dia/05-03-SUMMARY.md

<interfaces>
SDL novo `apps/backend/src/graphql/schema/forecast.graphql` (contrato único; o frontend 05-05/05-06 usa exatamente isto):
```graphql
extend type Query {
  "Previsão de caixa. from/to = YYYY-MM-DD no fuso da org (to exclusivo). Pendências vencidas antes de from entram em from com overdue = true. Requer financial.read"
  cashForecast(from: String!, to: String!): CashForecast!
}

type CashForecast {
  from: String!
  to: String!
  timezone: String!
  inflowTotal: String!
  outflowTotal: String!
  "Pode ser negativo: \"-250.00\""
  balance: String!
  "Parte das entradas que está em atraso (D-09)"
  overdueInflowTotal: String!
  "Agendamentos/itens sem regra de comissão (contados como R$ 0,00)"
  noRuleCount: Int!
  "Itens de contrato sem profissional definido com comissão estimada (D-10)"
  withoutProfessionalCount: Int!
  "Semanas de 7 dias a partir de from; a última pode ser menor"
  buckets: [ForecastBucket!]!
  "Ordenados por data, depois entradas antes de saídas, depois label"
  items: [ForecastItem!]!
}

type ForecastBucket {
  start: String!
  "Exclusivo"
  end: String!
  inflow: String!
  outflow: String!
  balance: String!
  overdueInflow: String!
}

type ForecastItem {
  date: String!
  "appointment | contract_installment | contract_balance | commission | fixed_expense"
  kind: String!
  "in | out"
  direction: String!
  amount: String!
  label: String!
  refId: UUID
  overdue: Boolean!
  noRule: Boolean!
  withoutProfessional: Boolean!
}
```
Funções puras (05-02, `apps/backend/src/financial/forecast.ts`): `FORECAST_APPOINTMENT_STATUSES`, `contractReceivables`, `appointmentInflowCents`, `fallbackCommission`, `expandFixedExpenses`, `buildWeeklyBuckets`, `summarizeForecast`, tipo `ForecastItemCents`.
Comissão: `resolveCommissionRule`, `computeCommission`, `categoryChain`, `RuleLite` (`commission-resolver.ts`); `loadCategoryParents(tx)` em `apps/backend/src/identity/member-categories.ts`; carga de regras igual a `apps/backend/src/comandas/comanda-close.ts` linhas ~123-135.
Tabelas: appointments(professional_id NOT NULL, service_id, service_variant_id, client_id, contract_id, status, starts_at, deposit_amount, purpose), comanda_items(appointment_id, comanda_id, total), comandas(status 'open'|'closed'|'cancelled'), services(base_price, category_id, name), service_pricing_variants(price), members(display_name), clients(full_name), contracts(status, code, total_amount, deposit_amount, balance_due_date, bridal_group_id), contract_deposit_installments(contract_id, seq, amount, due_date), contract_payments(contract_id, amount — estornos negativos), contract_items(contract_id, group_member_id, service_id, quantity, purpose 'event'|'trial'), bridal_group_members(client_id), bridal_groups(event_date), fixed_expenses.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ForecastService + resolver + SDL (coleta no tenant, regras puras)</name>
  <files>apps/backend/src/financial/financial.service.ts, apps/backend/src/financial/forecast.service.ts, apps/backend/src/financial/forecast.resolver.ts, apps/backend/src/financial/financial.module.ts, apps/backend/src/graphql/schema/forecast.graphql</files>
  <read_first>
    - apps/backend/src/financial/financial.service.ts (validateRange, timezone(), padrão AT TIME ZONE no summary)
    - apps/backend/src/financial/forecast.ts (05-02)
    - apps/backend/src/financial/commission-resolver.ts
    - apps/backend/src/comandas/comanda-close.ts (carga de regras e loadCategoryParents)
    - apps/backend/src/identity/member-categories.ts
    - apps/backend/src/contracts/alerts/alert-candidates.ts e o service de alertas (como carregam parcelas/pagamentos)
    - apps/backend/src/financial/financial.module.ts
  </read_first>
  <action>
1. `financial.service.ts`: trocar `function validateRange` por `export function validateRange` e extrair `export async function orgTimezone(tx, orgId)` do método privado `timezone` (passo 3a). Nenhuma outra mudança.
2. `forecast.graphql`: copiar o SDL de `<interfaces>` literalmente.
3. `forecast.service.ts` — `@Injectable() export class ForecastService { constructor(private readonly tenant: TenantContextService) {} async forecast(orgId: string, from: string, to: string) }`. Passos dentro de UMA `runWithTenant(orgId, async tx => …)`:
   a. `validateRange(from, to)` antes da transação. Fuso: usar o helper que já existe, `FinancialService.timezone(tx, orgId): Promise<string>`. Hoje ele é um método `private async timezone(tx: Parameters<Parameters<TenantContextService['runWithTenant']>[1]>[0], orgId: string)` (linha ~31 de `financial.service.ts`), que lê `organizations.timezone`: coluna NOT NULL com default `America/Sao_Paulo`; o `??` interno só cobre org inexistente. Para reutilizar sem duplicar, extrair o corpo para `export async function orgTimezone(tx, orgId): Promise<string>` no mesmo arquivo, fazer o método privado delegar para ela (as 4 chamadas `this.timezone(tx, orgId)` continuam iguais) e chamar `const tz = await orgTimezone(tx, orgId)` no ForecastService. NÃO acrescentar outro fallback `?? 'America/Sao_Paulo'` no ForecastService.
   b. **Agendamentos da janela** (todas as origens; `$queryRaw` com `Prisma.join(FORECAST_APPOINTMENT_STATUSES)`):
```sql
SELECT a.id, a.professional_id, a.service_id, a.contract_id, a.deposit_amount::text AS deposit,
       (a.starts_at AT TIME ZONE ${tz})::date::text AS day,
       s.name AS service_name, s.base_price::text AS base_price, s.category_id,
       v.price::text AS variant_price, m.display_name AS professional_name,
       (SELECT COUNT(*)::int FROM comanda_items ci JOIN comandas co ON co.id = ci.comanda_id
         WHERE ci.appointment_id = a.id AND co.status = 'open') AS comanda_item_count,
       (SELECT COALESCE(SUM(ci.total), 0)::text FROM comanda_items ci JOIN comandas co ON co.id = ci.comanda_id
         WHERE ci.appointment_id = a.id AND co.status = 'open') AS comanda_total
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  LEFT JOIN service_pricing_variants v ON v.id = a.service_variant_id
  JOIN members m ON m.id = a.professional_id
 WHERE a.status IN (${Prisma.join([...FORECAST_APPOINTMENT_STATUSES])})
   AND a.starts_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
   AND a.starts_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
```
      - Entrada (só `contract_id IS NULL`): `cents = appointmentInflowCents({ comandaItemCount: comanda_item_count, comandaItemsCents: toCents(comanda_total), variantCents: variant_price == null ? null : toCents(variant_price), baseCents: toCents(base_price), depositCents: toCents(deposit) })` (converter para número ANTES; a regra de fallback é pela contagem de itens, não pela string `'0.00'`); se `> 0` item `{ kind:'appointment', direction:'in', date: day, label: \`${service_name} · ${professional_name}\`, refId: a.id }` (sem nome de cliente no label).
      - Saída (TODOS, inclusive com `contract_id` — D-10): `listUnitCents = variantCents ?? baseCents`; `match = resolveCommissionRule(rules, { kind:'service', memberId: professional_id, serviceId, categoryChain: categoryChain(category_id, parents) })`; `c = computeCommission(match, { listUnitCents, quantity: 1, chargedCents: listUnitCents })`; item `{ kind:'commission', direction:'out', date: day, cents: c.amountCents, noRule: c.noRule, label: \`Comissão — ${professional_name} · ${service_name}\`, refId: a.id }` (incluir mesmo com 0 quando `noRule`, para o detalhe mostrar).
   c. **Contratos active**: `tx.contract.findMany({ where: { status: 'active' }, include: { installments: true } })` + `SELECT contract_id, COALESCE(SUM(amount),0)::text AS net FROM contract_payments GROUP BY contract_id`; para cada um `contractReceivables({ contractId, code, installments: installments.map(i => ({ seq: i.seq, dueDate: i.dueDate.toISOString().slice(0,10), cents: toCents(i.amount) })), netPaidCents, depositCents, totalCents, balanceDueDate: balanceDueDate.toISOString().slice(0,10) }, from, to)` (as colunas são `@db.Date`, então `toISOString().slice(0,10)` é a data correta).
   d. **Itens de contrato sem agendamento (sem profissional definido, D-10)**:
```sql
SELECT ci.id, ci.contract_id, ci.service_id, ci.quantity, s.base_price::text AS base_price, s.category_id,
       s.name AS service_name, c.code, g.event_date::text AS event_date,
       (SELECT COUNT(*) FROM appointments a
         WHERE a.contract_id = ci.contract_id AND a.service_id = ci.service_id
           AND a.client_id = bgm.client_id AND COALESCE(a.purpose, 'event') = 'event'
           AND a.status NOT IN ('cancelled', 'no_show'))::int AS scheduled
  FROM contract_items ci
  JOIN contracts c ON c.id = ci.contract_id
  JOIN bridal_groups g ON g.id = c.bridal_group_id
  JOIN bridal_group_members bgm ON bgm.id = ci.group_member_id
  JOIN services s ON s.id = ci.service_id
 WHERE c.status = 'active' AND ci.purpose = 'event'
   AND g.event_date >= ${from}::date AND g.event_date < ${to}::date
```
      `qty = max(0, quantity − scheduled)`; se `qty > 0`: `f = fallbackCommission(rules, { serviceId, categoryChain }, { listUnitCents: baseCents, quantity: qty, chargedCents: baseCents * qty })`; item `{ kind:'commission', direction:'out', date: event_date, cents: f.amountCents, noRule: f.noRule, withoutProfessional: true, label: \`Comissão estimada — sem profissional definido · ${service_name} (contrato ${code})\`, refId: contract_id }`. Itens `purpose='trial'` sem agendamento ficam de fora (não têm data) — comentar isso no código.
   e. **Despesas fixas**: `tx.fixedExpense.findMany({ where: { active: true } })` → `expandFixedExpenses(…, from, to)`.
   f. Ordenar itens (data asc, `in` antes de `out`, label asc), `buckets = buildWeeklyBuckets(items, from, to)`, `totals = summarizeForecast(items)`, `noRuleCount = items.filter(i => i.kind === 'commission' && i.noRule).length`, `withoutProfessionalCount = items.filter(i => i.withoutProfessional).length`. Converter centavos com `fromCents` (para `balance` negativo: `'-' + fromCents(-x)` se `fromCents` não tratar sinal — testar).
4. `forecast.resolver.ts`: `@Query('cashForecast') @RequirePermission(PERMISSIONS.FINANCIAL_READ)` com `@Args('from') from: string, @Args('to') to: string`.
5. `financial.module.ts`: adicionar `ForecastService` e `ForecastResolver` em `providers`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/backend lint && pnpm --filter @sgs/backend test -- forecast financial</automated>
  </verify>
  <acceptance_criteria>
    - `financial.service.ts` contém `export function validateRange` e `export async function orgTimezone`
    - `forecast.service.ts` contém `orgTimezone(tx, orgId)` e NÃO contém `'America/Sao_Paulo'`
    - `forecast.graphql` contém `cashForecast(from: String!, to: String!): CashForecast!`, `overdueInflowTotal: String!`, `withoutProfessional: Boolean!`
    - `forecast.service.ts` contém `FORECAST_APPOINTMENT_STATUSES`, `AT TIME ZONE`, `co.status = 'open'`, `contract_id IS NULL` ou checagem equivalente `contract_id == null` para a entrada, `fallbackCommission(`, `resolveCommissionRule(`, `contractReceivables(`, `expandFixedExpenses(`, `buildWeeklyBuckets(` e o texto `sem profissional definido`
    - `forecast.resolver.ts` contém `@RequirePermission(PERMISSIONS.FINANCIAL_READ)` e `@Query('cashForecast')`
    - typecheck, lint e testes unitários do backend passam
  </acceptance_criteria>
  <done>Query cashForecast responde com totais, semanas e itens com origem, seguindo D-04/D-05/D-09/D-10/D-13.</done>
</task>

<task type="auto">
  <name>Task 2: Suíte phase5-forecast + RBAC/RLS do cashForecast</name>
  <files>apps/backend/test/integration/phase5-forecast.e2e.spec.ts, apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (createPhase4World, insertBridalGroupRow, insertContractRow com installments/items/status/balanceDueDate)
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (Phase3World: serviceId base 100.00, serviceBId base 50.00, variantId 120.00, proA, proB, clientId, categoryId/childCategoryId)
    - apps/backend/test/integration/helpers/phase5-cleanup.ts (05-03)
    - apps/backend/test/integration/phase3-financial-dashboard.e2e.spec.ts (como inserir agendamentos/comandas via adminPrisma com horários fixos)
    - apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts (05-03)
  </read_first>
  <action>
`phase5-forecast.e2e.spec.ts` — world `createPhase4World`, org em `America/Sao_Paulo`, janela fixa `from = '2027-03-01'`, `to = '2027-03-31'` (30 dias, 5 semanas). Inserir tudo via `adminPrisma` com horários distintos por profissional (exclusion constraint). Limpeza: `deletePhase5Rows` → `destroyPhase4World` (remover antes os appointments/comandas criados, se `destroyPhase4World` não cobrir). Casos (cada um com valores esperados exatos em string):
1. Agendamento `scheduled` proA serviço base (100.00), 2027-03-02 10:00 -03:00, sem comanda, sinal 30.00 → item `appointment` `amount '70.00'` em `2027-03-02`.
2. Agendamento `confirmed` com variante (120.00) → `'120.00'`; com comanda `open` cujo item do agendamento tem `total '90.00'` → `'90.00'` (comanda vence a variante); com comanda `open` sem nenhum item desse agendamento → `'120.00'` (volta para a variante).
3. `cancelled`, `no_show`, `completed`, `in_progress` na janela → nenhum item `appointment` nem `commission` para eles.
4. Fuso: agendamento 2027-03-30 22:30 -03:00 → entra em `2027-03-30` (5º bucket); 2027-03-31 00:30 -03:00 → não entra; 2027-03-01 00:10 -03:00 → entra no 1º bucket.
5. Comissão: regra `service` 10% para `serviceId` → agendamento com variante 120.00 gera `commission '12.00'`; sem regra para `serviceBId` (e sem default) → item `commission` `'0.00'` com `noRule: true` e `noRuleCount >= 1`.
6. Contrato `active` com 2 parcelas de 500.00 (vencem 2027-02-20 e 2027-03-05), pagamento de 0, total 2000.00, depósito 1000.00, `balanceDueDate '2027-03-20'` → itens: parcela 1 em `2027-03-01` `overdue: true` (D-09), parcela 2 em `2027-03-05`, restante `'1000.00'` em `2027-03-20`; `overdueInflowTotal '500.00'` e `buckets[0].overdueInflow '500.00'`. Com pagamento de 600.00 → parcela 1 some, parcela 2 `'400.00'`. Contrato `draft` e `cancelled` → nenhum item.
7. Agendamento ligado ao contrato (`contract_id` setado, proA, serviço base) → NENHUM item `appointment` dele, mas existe item `commission` (D-10).
8. Item de contrato `event` sem agendamento, grupo com `event_date '2027-03-15'`, serviço `serviceBId` (50.00): (a) sem regra default e com regra `service` 20% para serviceB e `member_service` fixa 15.00 (proB/serviceB) → `commission '15.00'`, `withoutProfessional: true`, label contém `sem profissional definido`; (b) depois de inserir regra `default` 5% → `'2.50'`; (c) quando existe agendamento não cancelado do mesmo serviço/cliente/contrato → o item `withoutProfessional` some.
9. Despesas fixas: ativa dia 10 `'1500.00'` → saída em `2027-03-10`; inativa → não entra; dia 31 → não entra (31/03 = `to`, exclusivo).
10. Totais: `inflowTotal`, `outflowTotal`, `balance = inflow − outflow` conferidos somando `items` no teste; `buckets.length === 5`, `buckets[4].start === '2027-03-29'`, `buckets[4].end === '2027-03-31'`.
11. `from`/`to` inválidos (`'2027-3-1'`) → erro com mensagem `Datas devem estar no formato AAAA-MM-DD.`

`phase5-rls-rbac.e2e.spec.ts`: substituir o `it.todo('preenchido no plano 05-04')` por casos reais: ATTENDANT e `proA` negados em `cashForecast`; ADMIN e MANAGER permitidos; `otherAdmin` consultando a mesma janela não vê nenhum item com `refId` da org principal (criar uma despesa fixa na org principal antes).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/backend test:integration -- phase5</automated>
  </verify>
  <acceptance_criteria>
    - `phase5-forecast.e2e.spec.ts` contém `'2027-03-01'`, `'2027-03-31'`, `overdue`, `withoutProfessional`, `'15.00'`, `'2.50'`, `'70.00'`, `noRule` e `Datas devem estar no formato AAAA-MM-DD.`
    - `phase5-rls-rbac.e2e.spec.ts` não contém mais `it.todo(` e contém `cashForecast`
    - `pnpm --filter @sgs/backend test:integration -- phase5` passa (todas as suítes phase5)
  </acceptance_criteria>
  <done>Regras da previsão comprovadas contra Postgres real com RLS, fuso e RBAC.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/backend lint && pnpm --filter @sgs/backend test`
- `pnpm --filter @sgs/backend test:integration` (suíte inteira, para garantir que nada da fase 3/4 quebrou)
</verification>

<success_criteria>
Critério de sucesso 3: a previsão soma agendamentos confirmados e parcelas de contratos a vencer, e desconta comissões estimadas e despesas fixas cadastradas.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-04-SUMMARY.md`
</output>

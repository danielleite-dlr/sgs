---
phase: 05-uso-no-dia-a-dia
plan: 03
type: execute
wave: 2
depends_on: ["05-02"]
files_modified:
  - apps/backend/src/financial/fixed-expense.service.ts
  - apps/backend/src/financial/fixed-expense.resolver.ts
  - apps/backend/src/financial/financial.module.ts
  - apps/backend/src/graphql/schema/fixed-expenses.graphql
  - apps/backend/test/integration/helpers/phase5-cleanup.ts
  - apps/backend/test/integration/phase5-fixed-expenses.e2e.spec.ts
  - apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "ADMIN e MANAGER cadastram, editam, ativam/desativam e excluem despesas fixas (nome, valor, dia 1–31) (D-06)"
    - "ATTENDANT e PROFESSIONAL não leem nem gravam despesas fixas"
    - "Uma organização não vê nem altera despesas fixas de outra (RLS)"
    - "Erros de validação voltam como dado em PT-BR (errors: [UserError!]!), sem exceção"
  artifacts:
    - path: "apps/backend/src/graphql/schema/fixed-expenses.graphql"
      provides: "SDL de despesas fixas"
      contains: "createFixedExpense"
    - path: "apps/backend/src/financial/fixed-expense.service.ts"
      exports: ["FixedExpenseService"]
    - path: "apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts"
      provides: "RLS + RBAC da fase 5"
  key_links:
    - from: "apps/backend/src/financial/fixed-expense.resolver.ts"
      to: "PERMISSIONS.FINANCIAL_EXPENSE_WRITE"
      via: "@RequirePermission nas mutations"
      pattern: "FINANCIAL_EXPENSE_WRITE"
    - from: "apps/backend/src/financial/fixed-expense.service.ts"
      to: "TenantContextService.runWithTenant"
      via: "toda leitura/escrita dentro do tenant"
      pattern: "runWithTenant"
---

<objective>
API GraphQL de despesas fixas (FIN-03; D-06; critério de sucesso 4): query `fixedExpenses` e mutations create/update/delete, com RBAC (`financial.read` para ler, `financial.expenseWrite` para gravar) e RLS, cobertas por testes de integração.

Purpose: a dona cadastra as despesas que entram nas saídas da previsão.
Output: service + resolver + SDL `fixed-expenses.graphql`, suítes `phase5-fixed-expenses` e `phase5-rls-rbac`, helper de limpeza.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-02-SUMMARY.md

<interfaces>
Contrato GraphQL (fonte única; o frontend 05-05 usa exatamente isto). Arquivo novo `apps/backend/src/graphql/schema/fixed-expenses.graphql` (o GraphQLModule carrega `**/*.graphql` via typePaths):
```graphql
extend type Query {
  "Despesas fixas mensais da org (ativas e inativas), ordenadas por nome. Requer financial.read"
  fixedExpenses: [FixedExpense!]!
}

extend type Mutation {
  "Requer financial.expenseWrite (ADMIN/MANAGER)"
  createFixedExpense(input: FixedExpenseInput!): FixedExpensePayload!
  updateFixedExpense(id: UUID!, input: FixedExpenseInput!): FixedExpensePayload!
  "Exclusão definitiva (não há histórico de pagamento). Devolve a despesa excluída."
  deleteFixedExpense(id: UUID!): FixedExpensePayload!
}

type FixedExpense {
  id: UUID!
  name: String!
  "Valor em reais, string com 2 casas: \"1500.00\""
  amount: String!
  "Dia do vencimento no mês (1–31). Mês sem esse dia: vence no último dia."
  dueDay: Int!
  active: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input FixedExpenseInput {
  name: String!
  amount: String!
  dueDay: Int!
  "Omitido = true"
  active: Boolean
}

type FixedExpensePayload {
  fixedExpense: FixedExpense
  errors: [UserError!]!
}
```
`UserError { code: String! message: String! field: String }` já existe em `auth.graphql`.
Permissões: `PERMISSIONS.FINANCIAL_READ` ('financial.read') e `PERMISSIONS.FINANCIAL_EXPENSE_WRITE` ('financial.expenseWrite', criada em 05-02).
Dinheiro: `parseMoneyInput(s): number | null` (centavos; regex `^\d+(\.\d{1,2})?$`) e `fromCents` em `apps/backend/src/common/money.ts`.
Testes: `createPhase4World`/`destroyPhase4World` e `gqlAs(w, token)` em `test/integration/helpers/phase4-fixtures.ts` (tokens: admin, manager, attendant, proA, proB, otherAdmin; `w.orgId`, `w.otherOrgId`); `adminPrisma` de `test/integration/setup`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: FixedExpenseService + resolver + SDL + registro no FinancialModule</name>
  <files>apps/backend/src/financial/fixed-expense.service.ts, apps/backend/src/financial/fixed-expense.resolver.ts, apps/backend/src/financial/financial.module.ts, apps/backend/src/graphql/schema/fixed-expenses.graphql</files>
  <read_first>
    - apps/backend/src/financial/financial.resolver.ts (decorators @RequirePermission, @CurrentTenant, TenantContext)
    - apps/backend/src/financial/client-credit.service.ts (padrão de payload com errors como dado)
    - apps/backend/src/financial/financial.module.ts
    - apps/backend/src/common/money.ts
    - apps/backend/src/database/tenant-context.service.ts
    - apps/backend/src/graphql/schema/financial.graphql (estilo de SDL)
  </read_first>
  <action>
1. Criar `fixed-expenses.graphql` com o SDL de `<interfaces>` copiado literalmente.
2. `fixed-expense.service.ts` — `@Injectable() export class FixedExpenseService { constructor(private readonly tenant: TenantContextService) {} }` com:
   - `list(orgId)`: `runWithTenant(orgId, tx => tx.fixedExpense.findMany({ orderBy: [{ name: 'asc' }] }))` mapeado para DTO `{ id, name, amount: fromCents(toCents(amount)), dueDay, active, createdAt, updatedAt }`.
   - `create(orgId, input)`, `update(orgId, id, input)`, `remove(orgId, id)` devolvendo `{ fixedExpense, errors }`.
   - Validação (antes da transação), mensagens exatas:
     - `name.trim()` com 2..120 caracteres, senão `{ code: 'INVALID_NAME', message: 'Informe o nome da despesa (2 a 120 caracteres).', field: 'name' }`
     - `parseMoneyInput(amount)` não nulo e `> 0`, senão `{ code: 'INVALID_AMOUNT', message: 'Informe um valor maior que zero.', field: 'amount' }`
     - `Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31`, senão `{ code: 'INVALID_DUE_DAY', message: 'O dia do vencimento deve ser entre 1 e 31.', field: 'dueDay' }`
     - update/delete de id inexistente (ou de outra org — invisível pelo RLS): `{ code: 'NOT_FOUND', message: 'Despesa fixa não encontrada.', field: null }`
   - Gravar `organizationId: orgId`, `name` aparado, `amount: fromCents(cents)`, `active: input.active ?? true`.
3. `fixed-expense.resolver.ts`: `@Query('fixedExpenses') @RequirePermission(PERMISSIONS.FINANCIAL_READ)`; `@Mutation('createFixedExpense' | 'updateFixedExpense' | 'deleteFixedExpense') @RequirePermission(PERMISSIONS.FINANCIAL_EXPENSE_WRITE)`; todos usam `@CurrentTenant() tenant` → `tenant.organizationId`.
4. `financial.module.ts`: adicionar `FixedExpenseService` e `FixedExpenseResolver` em `providers` (não exportar o resolver).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/backend lint && grep -q "FINANCIAL_EXPENSE_WRITE" apps/backend/src/financial/fixed-expense.resolver.ts</automated>
  </verify>
  <acceptance_criteria>
    - `fixed-expenses.graphql` contém `fixedExpenses: [FixedExpense!]!`, `createFixedExpense(input: FixedExpenseInput!): FixedExpensePayload!`, `deleteFixedExpense(id: UUID!): FixedExpensePayload!`
    - `fixed-expense.service.ts` contém as strings `Informe o nome da despesa (2 a 120 caracteres).`, `Informe um valor maior que zero.`, `O dia do vencimento deve ser entre 1 e 31.`, `Despesa fixa não encontrada.` e `runWithTenant`
    - `grep -c "FINANCIAL_EXPENSE_WRITE" apps/backend/src/financial/fixed-expense.resolver.ts` = 3
    - `financial.module.ts` contém `FixedExpenseService` e `FixedExpenseResolver`
    - typecheck e lint do backend passam
  </acceptance_criteria>
  <done>Query e mutations de despesas fixas expostas com gate de permissão e RLS.</done>
</task>

<task type="auto">
  <name>Task 2: Suítes de integração phase5-fixed-expenses e phase5-rls-rbac + limpeza</name>
  <files>apps/backend/test/integration/helpers/phase5-cleanup.ts, apps/backend/test/integration/phase5-fixed-expenses.e2e.spec.ts, apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts (modelo da suíte RLS/RBAC)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (createPhase4World, destroyPhase4World)
    - apps/backend/test/integration/helpers/phase4-cleanup.ts (padrão de limpeza com adminPrisma)
    - apps/backend/src/graphql/schema/fixed-expenses.graphql
  </read_first>
  <action>
1. `helpers/phase5-cleanup.ts`: `export async function deletePhase5Rows(orgFilterSql: string): Promise<void>` executando com `adminPrisma.$executeRawUnsafe` `DELETE FROM fixed_expenses WHERE organization_id IN (${orgFilterSql})`. Comentário: deve rodar ANTES de `destroyPhase4World` (FK para organizations).
2. `phase5-fixed-expenses.e2e.spec.ts` (world via `createPhase4World`; `afterAll`: `deletePhase5Rows(\`SELECT id FROM organizations WHERE id IN ('${w.orgId}','${w.otherOrgId}')\`)` e depois `destroyPhase4World(w)`), como ADMIN:
   - cria `{ name: 'Aluguel', amount: '1500.00', dueDay: 10 }` → `errors: []`, `amount: '1500.00'`, `active: true`
   - `fixedExpenses` lista a criada
   - update para `{ name: 'Aluguel do estúdio', amount: '1600.50', dueDay: 31, active: false }` → valores refletidos
   - validações: `name: 'A'` → code `INVALID_NAME`; `amount: '0'` → `INVALID_AMOUNT`; `amount: '12,50'` → `INVALID_AMOUNT`; `dueDay: 0` e `32` → `INVALID_DUE_DAY`
   - delete → devolve a despesa; segunda chamada → `NOT_FOUND`
   - MANAGER também cria com sucesso
3. `phase5-rls-rbac.e2e.spec.ts` (mesmo setup/limpeza): `describe('fixedExpenses')`:
   - ATTENDANT e PROFESSIONAL (`proA`): `fixedExpenses` e `createFixedExpense` retornam erro GraphQL de permissão (mesma asserção usada em `phase4-rls-rbac.e2e.spec.ts` para negação)
   - `otherAdmin` não vê a despesa da org principal em `fixedExpenses` e recebe `NOT_FOUND` ao tentar `updateFixedExpense`/`deleteFixedExpense` com o id dela
   - inserção direta via role `sgs_app` com `organization_id` de outra org sob `app.current_organization` da org principal falha por RLS (copiar o padrão de checagem de RLS da suíte da fase 4, se existir; senão asserção via `gqlAs` basta)
   - Deixar um `describe('cashForecast')` vazio com `it.todo('preenchido no plano 05-04')`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/backend test:integration -- phase5-fixed-expenses phase5-rls-rbac</automated>
  </verify>
  <acceptance_criteria>
    - `phase5-cleanup.ts` exporta `deletePhase5Rows` e contém `DELETE FROM fixed_expenses`
    - `phase5-fixed-expenses.e2e.spec.ts` contém `INVALID_NAME`, `INVALID_AMOUNT`, `INVALID_DUE_DAY`, `NOT_FOUND` e `'1600.50'`
    - `phase5-rls-rbac.e2e.spec.ts` contém `otherAdmin`, `attendant`, `proA` e `it.todo('preenchido no plano 05-04')`
    - `pnpm --filter @sgs/backend test:integration -- phase5-fixed-expenses phase5-rls-rbac` passa
  </acceptance_criteria>
  <done>CRUD, validação, RBAC e RLS de despesas fixas comprovados por integração contra Postgres real.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/backend lint`
- `pnpm --filter @sgs/backend test:integration -- phase5`
</verification>

<success_criteria>
Critério de sucesso 4 (lado da API): a dona consegue cadastrar despesas fixas mensais (nome, valor, dia de vencimento) com permissão e isolamento por org.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-03-SUMMARY.md`
</output>

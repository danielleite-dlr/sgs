---
phase: 05-uso-no-dia-a-dia
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/frontend/src/features/operations/api/forecast.api.ts
  - apps/frontend/src/features/operations/operations-permissions.ts
  - apps/frontend/src/features/operations/__tests__/operations-permissions.test.ts
  - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx
  - apps/frontend/src/features/operations/__tests__/fixed-expenses-page.test.tsx
  - apps/frontend/src/router.tsx
  - apps/frontend/src/components/layout/menu-config.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "A dona abre Financeiro → Despesas fixas (/financeiro/despesas-fixas) e vê a lista com nome, valor, dia do vencimento e situação"
    - "ADMIN/MANAGER cadastram, editam, ativam/desativam e excluem (com confirmação) uma despesa fixa; valor com máscara BRL e dia 1–31 validados"
    - "ATTENDANT e PROFESSIONAL veem aviso de falta de permissão e nenhum botão de gravação"
    - "A rota nova não liga a flag financeiroRelatorios (os 9 mocks continuam desligados)"
    - "Todo texto da tela está em PT-BR com acentos"
  artifacts:
    - path: "apps/frontend/src/features/operations/api/forecast.api.ts"
      provides: "Documentos gql e tipos de previsão e despesas fixas"
      exports: ["CashForecastQuery", "FixedExpensesQuery", "CreateFixedExpenseMutation", "UpdateFixedExpenseMutation", "DeleteFixedExpenseMutation", "forecastWindow", "FORECAST_KIND_LABELS"]
    - path: "apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx"
      exports: ["DespesasFixasPage"]
  key_links:
    - from: "apps/frontend/src/router.tsx"
      to: "DespesasFixasPage"
      via: "rota /financeiro/despesas-fixas"
      pattern: "/financeiro/despesas-fixas"
    - from: "apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx"
      to: "financial.expenseWrite"
      via: "useHasPermission"
      pattern: "financial\\.expenseWrite"
---

<objective>
Tela de despesas fixas (FIN-03; D-06; critério de sucesso 4) e a camada de API do frontend para a fase (documentos gql + tipos manuais de `cashForecast` e despesas fixas), já que o projeto não usa codegen (Pitfall 5).

Purpose: a dona cadastra o que sai todo mês, e isso alimenta a previsão.
Output: `forecast.api.ts`, `DespesasFixasPage.tsx` na rota `/financeiro/despesas-fixas`, item de menu, permissões espelhadas, testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-RESEARCH.md

<interfaces>
Contrato GraphQL do backend (planos 05-03 e 05-04 — copiar literalmente):
```graphql
fixedExpenses: [FixedExpense!]!
createFixedExpense(input: FixedExpenseInput!): FixedExpensePayload!
updateFixedExpense(id: UUID!, input: FixedExpenseInput!): FixedExpensePayload!
deleteFixedExpense(id: UUID!): FixedExpensePayload!
type FixedExpense { id: UUID! name: String! amount: String! dueDay: Int! active: Boolean! createdAt: DateTime! updatedAt: DateTime! }
input FixedExpenseInput { name: String! amount: String! dueDay: Int! active: Boolean }
type FixedExpensePayload { fixedExpense: FixedExpense errors: [UserError!]! }   # UserError { code message field }

cashForecast(from: String!, to: String!): CashForecast!
type CashForecast { from to timezone inflowTotal outflowTotal balance overdueInflowTotal: String!  noRuleCount withoutProfessionalCount: Int!  buckets: [ForecastBucket!]!  items: [ForecastItem!]! }
type ForecastBucket { start end inflow outflow balance overdueInflow: String! }
type ForecastItem { date kind direction amount label: String!  refId: UUID  overdue noRule withoutProfessional: Boolean! }
```
Frontend existente:
- `apps/frontend/src/features/operations/lib/period.ts`: `ORG_TIMEZONE_DEFAULT = 'America/Sao_Paulo'`, `todayInTimeZone(tz, now?)`, `addDays(isoDate, days)`.
- `apps/frontend/src/features/catalog/utils/currency-mask.ts`: `maskCurrency`, `unmaskCurrency`, `formatCurrencyDisplay`.
- `apps/frontend/src/features/operations/operations-permissions.ts`: `ROLE_OPERATION_PERMISSIONS`, `useHasPermission(permission)`.
- Componentes shadcn em `@/components/ui`: alert, alert-dialog, badge, button, card, dialog, form, input, label, radio-group, skeleton, sonner, table.
- `apps/frontend/src/config/features.ts`: `/financeiro/despesas-fixas` NÃO casa o prefixo `/financeiro/despesas` (o `matches` exige `prefix` exato ou `prefix + '/'`), cai em `/financeiro` (flag `financeiro: true`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: forecast.api.ts (gql + tipos + helpers) e permissão financial.expenseWrite no frontend</name>
  <files>apps/frontend/src/features/operations/api/forecast.api.ts, apps/frontend/src/features/operations/operations-permissions.ts, apps/frontend/src/features/operations/__tests__/operations-permissions.test.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/api/financial.api.ts (estilo de gql inline e tipos manuais)
    - apps/frontend/src/features/operations/lib/period.ts
    - apps/frontend/src/features/operations/operations-permissions.ts
    - apps/frontend/src/features/operations/__tests__/operations-permissions.test.ts
  </read_first>
  <action>
1. Criar `forecast.api.ts` com:
   - `export type ForecastKind = 'appointment' | 'contract_installment' | 'contract_balance' | 'commission' | 'fixed_expense';`
   - `export interface ForecastItem { date: string; kind: ForecastKind; direction: 'in' | 'out'; amount: string; label: string; refId: string | null; overdue: boolean; noRule: boolean; withoutProfessional: boolean; }`
   - `export interface ForecastBucket { start: string; end: string; inflow: string; outflow: string; balance: string; overdueInflow: string; }`
   - `export interface CashForecast { from: string; to: string; timezone: string; inflowTotal: string; outflowTotal: string; balance: string; overdueInflowTotal: string; noRuleCount: number; withoutProfessionalCount: number; buckets: ForecastBucket[]; items: ForecastItem[]; }` e `export interface CashForecastResult { cashForecast: CashForecast }`
   - `export interface FixedExpense { id: string; name: string; amount: string; dueDay: number; active: boolean; createdAt: string; updatedAt: string; }`, `export interface FixedExpenseInput { name: string; amount: string; dueDay: number; active?: boolean }`, `export interface UserError { code: string; message: string; field: string | null }`, `export interface FixedExpensePayload { fixedExpense: FixedExpense | null; errors: UserError[] }`
   - `CashForecastQuery` (`query CashForecast($from: String!, $to: String!)` pedindo TODOS os campos acima), `FixedExpensesQuery` (`query FixedExpenses`), `CreateFixedExpenseMutation`, `UpdateFixedExpenseMutation`, `DeleteFixedExpenseMutation` (todas pedindo `fixedExpense { id name amount dueDay active createdAt updatedAt } errors { code message field }`).
   - `export const FORECAST_KIND_LABELS: Record<ForecastKind, string> = { appointment: 'Agendamento', contract_installment: 'Parcela de contrato', contract_balance: 'Restante de contrato', commission: 'Comissão', fixed_expense: 'Despesa fixa' };`
   - `export function forecastWindow(tz: string = ORG_TIMEZONE_DEFAULT, now: Date = new Date()): { from: string; to: string }` → `from = todayInTimeZone(tz, now)`, `to = addDays(from, 30)` (nunca `toISOString().slice(0,10)`, que adianta o dia depois das 21h).
   - `export function weekLabel(start: string, endExclusive: string): string` → `"dd/MM – dd/MM"` com o último dia = `addDays(endExclusive, -1)` (travessão com espaços).
2. `operations-permissions.ts`: adicionar `'financial.expenseWrite'` nas listas `ADMIN` e `MANAGER` de `ROLE_OPERATION_PERMISSIONS` (espelha o catálogo do backend de 05-02).
3. `operations-permissions.test.ts`: casos `roleHasPermission('ADMIN','financial.expenseWrite') === true`, `MANAGER` true, `ATTENDANT` false, `PROFESSIONAL` false. Adicionar teste de `forecastWindow('America/Sao_Paulo', new Date('2026-11-06T01:30:00Z'))` → `{ from: '2026-11-05', to: '2026-12-05' }` e `weekLabel('2026-11-05','2026-11-12')` → `'05/11 – 11/11'` (pode ser num arquivo novo `__tests__/forecast-api.test.ts` se preferir; manter os dois casos).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- operations-permissions forecast-api && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `forecast.api.ts` contém `query CashForecast($from: String!, $to: String!)`, `withoutProfessional`, `overdueInflowTotal`, `mutation CreateFixedExpense`, `mutation DeleteFixedExpense`, `'Parcela de contrato'` e `export function forecastWindow`
    - `forecast.api.ts` NÃO contém `toISOString().slice(0, 10)` nem `toISOString().slice(0,10)`
    - `grep -c "'financial.expenseWrite'" apps/frontend/src/features/operations/operations-permissions.ts` = 2
    - Testes de permissão e de `forecastWindow`/`weekLabel` passam; typecheck do frontend passa
  </acceptance_criteria>
  <done>Contrato GraphQL da fase disponível no frontend com tipos e helpers de janela no fuso da org.</done>
</task>

<task type="auto">
  <name>Task 2: DespesasFixasPage + rota /financeiro/despesas-fixas + item de menu + vitest</name>
  <files>apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx, apps/frontend/src/features/operations/__tests__/fixed-expenses-page.test.tsx, apps/frontend/src/router.tsx, apps/frontend/src/components/layout/menu-config.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx (PageHeader, gate de permissão, Alert, Skeleton)
    - apps/frontend/src/features/operations/pages/CreditoClientePage.tsx (tela com diálogo e mutation)
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx e credito-cliente-page.test.tsx (MockedProvider e store)
    - apps/frontend/src/features/catalog/utils/currency-mask.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/menu-config.ts (grupo 'financeiro', linhas ~186-265)
    - apps/frontend/src/config/__tests__/features.test.ts (teste "nenhum item do menu leva a destino desligado")
  </read_first>
  <action>
1. `DespesasFixasPage.tsx` (`export function DespesasFixasPage()`), textos EXATOS:
   - `PageHeader` título `Despesas fixas`, descrição `Contas que se repetem todo mês. Elas entram nas saídas da previsão de 30 dias.`
   - Sem `financial.read`: reutilizar o mesmo componente/mensagem de falta de permissão que `FinanceiroPage.tsx` usa (copiar o texto de lá) e não consultar.
   - Carregando: `Skeleton`. Erro: `Alert` com `Não foi possível carregar as despesas fixas.` e botão `Tentar novamente` (`refetch`).
   - Vazio: `Nenhuma despesa fixa cadastrada.` + botão `Cadastrar despesa fixa` (só com `financial.expenseWrite`).
   - Tabela: colunas `Nome`, `Valor` (`formatCurrencyDisplay(amount)`), `Vence todo dia` (`dia {dueDay}`), `Situação` (`Badge` `Ativa`/`Inativa`), `Ações` (só com escrita): `Editar`, `Desativar`/`Ativar` (update com `active` invertido), `Excluir`.
   - Botão de topo `Nova despesa fixa` (só com escrita).
   - Diálogo (criar/editar), título `Nova despesa fixa` ou `Editar despesa fixa`: campos `Nome` (input, 2–120), `Valor` (input com `maskCurrency`, enviado com `unmaskCurrency` → string "1500.00"), `Dia do vencimento` (input `type="number"` min 1 max 31, ajuda `Se o mês não tiver esse dia, a despesa vence no último dia do mês.`), `Situação` (`radio-group` com `Ativa`/`Inativa`). Validação no cliente com as mesmas mensagens do backend: `Informe o nome da despesa (2 a 120 caracteres).`, `Informe um valor maior que zero.`, `O dia do vencimento deve ser entre 1 e 31.`. `errors` do payload exibidos no campo (`field`) ou no topo do diálogo. Botões `Cancelar` e `Salvar`. Sucesso: toast `Despesa fixa salva.` e `refetchQueries: ['FixedExpenses', 'CashForecast']`.
   - Excluir: `AlertDialog` título `Excluir despesa fixa?`, texto `Ela deixa de entrar na previsão. Essa ação não pode ser desfeita.`, botões `Cancelar` / `Excluir`; sucesso: toast `Despesa fixa excluída.`.
   - Rótulos com `<Label htmlFor>` e foco visível (WCAG 2.1 AA).
2. `router.tsx`: importar `DespesasFixasPage` e adicionar `{ path: '/financeiro/despesas-fixas', element: <DespesasFixasPage /> }` em `PROTECTED_ROUTES`, logo após `/financeiro/comissoes`. NÃO alterar `features.ts`.
3. `menu-config.ts`: no grupo `financeiro`, logo após `fin-controle`, adicionar `{ id: 'fin-despesas-fixas', label: 'Despesas fixas', to: '/financeiro/despesas-fixas', searchTerms: ['despesas fixas', 'contas do mês', 'aluguel', 'previsão'] }`.
4. `fixed-expenses-page.test.tsx` (MockedProvider + store com `roleName`): (a) ADMIN com lista de 2 despesas → mostra `Aluguel` e `R$ 1.500,00` e `dia 10`; (b) lista vazia → `Nenhuma despesa fixa cadastrada.`; (c) criar: preencher Nome `Internet`, Valor `9990` (máscara → `R$ 99,90`), Dia `5`, `Salvar` → mutation chamada com `{ name: 'Internet', amount: '99.90', dueDay: 5, active: true }`; (d) dia `32` → mensagem `O dia do vencimento deve ser entre 1 e 31.` e mutation não chamada; (e) excluir pede confirmação `Excluir despesa fixa?`; (f) ATTENDANT → sem botão `Nova despesa fixa`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- fixed-expenses-page features && pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `router.tsx` contém `path: '/financeiro/despesas-fixas'` e `<DespesasFixasPage />`
    - `menu-config.ts` contém `id: 'fin-despesas-fixas'` e `label: 'Despesas fixas'`
    - `apps/frontend/src/config/features.ts` sem alteração (`git diff --quiet apps/frontend/src/config/features.ts`) e `financeiroRelatorios: false` continua lá
    - `DespesasFixasPage.tsx` contém `Contas que se repetem todo mês. Elas entram nas saídas da previsão de 30 dias.`, `Excluir despesa fixa?`, `Se o mês não tiver esse dia, a despesa vence no último dia do mês.` e `financial.expenseWrite`
    - `grep -nE "\b(nao|voce|situacao|descricao)\b" apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx` não retorna nada
    - vitest (`fixed-expenses-page`, `features`), typecheck e lint do frontend passam
  </acceptance_criteria>
  <done>Tela de despesas fixas acessível pelo menu Financeiro, com CRUD completo para ADMIN/MANAGER.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/frontend test` (suíte inteira) e `pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend lint`
</verification>

<success_criteria>
Critério de sucesso 4: a dona consegue cadastrar despesas fixas mensais (nome, valor, dia de vencimento) pela interface.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-05-SUMMARY.md`
</output>

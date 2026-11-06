# Phase 5: Uso no dia a dia - Research

**Researched:** 2026-11-05
**Domain:** previsão financeira (SQL/NestJS/GraphQL schema-first + Recharts) e auditoria de usabilidade (Playwright em staging)
**Confidence:** HIGH (tudo verificado no código do repositório; nenhuma biblioteca nova é necessária)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** O Claude faz a auditoria; a usuária aprova antes de corrigir. O primeiro plano da fase é uma auditoria das telas principais no staging (navegador real, org Studio JS, desktop e celular). Ela produz uma lista priorizada de problemas: severidade, tela, passo a passo e correção proposta. A lista vai para a usuária. **Nenhuma correção é feita antes da aprovação.** Os itens aprovados viram os planos de correção seguintes, em lotes.
- **D-02:** Prioridade das telas, na ordem que a usuária deu: Agenda → Comanda e caixa → Noivas e contratos → Clientes e financeiro → Painel (dashboard).
- **D-03:** Critério da auditoria: o uso diário real. Medir cliques e passos nas tarefas frequentes (marcar e remarcar horário, fechar comanda e receber, criar contrato e registrar parcela, achar cliente). Procurar textos confusos, erros sem explicação, estados vazios, carregamento, celular/tablet, acentuação e consistência em PT-BR. Funcionalidade nova **não** entra na lista; se surgir alguma, vai para "Deferred".
- **D-04:** Entradas previstas = valor dos agendamentos confirmados nos próximos 30 dias + parcelas de contratos de noivas/debutantes que vencem no período (parcelas do sinal e restante ainda em aberto). Não entra média histórica.
- **D-05:** Saídas previstas = comissão estimada dos agendamentos confirmados no período, calculada pela regra de comissão de cada profissional (`commission-resolver.ts` já existe), + despesas fixas mensais cadastradas que vencem no período. Não haverá controle de "comissão paga".
- **D-06:** Despesas fixas: cadastro novo e simples. Campos: nome, valor e dia de vencimento no mês, mais ativo/inativo. Serve só para alimentar a previsão; não é contas a pagar completo. Fica no Financeiro ou nas Configurações; o planner decide. Permissão de financeiro (ADMIN/MANAGER), com RLS por org como o resto.
- **D-07:** Cartão no painel inicial com total de entradas, total de saídas e saldo previsto dos próximos 30 dias, mais gráfico por semana. Clicar abre o detalhe no Financeiro, com lista por dia/semana e a origem de cada valor (agendamento, parcela de contrato, comissão, despesa).
- **D-08:** O painel inicial hoje é placeholder (`DashboardPlaceholder` em `/dashboard`). O cartão da previsão vira o primeiro conteúdo real. A auditoria avalia o que mais o painel precisa e propõe; nada além da previsão entra no painel sem aprovação.

### Claude's Discretion
- O que conta como agendamento "confirmado" (status existentes em `appointments.status`). Excluir cancelados e faltas; documentar no plano.
- Como valorar o agendamento (preço do serviço/variante; descontar sinal já pago; não contar agendamento ligado a contrato quando a parcela do contrato já entra).
- Fuso: datas no fuso da org, como no `financialSummary`.
- Formato do gráfico (barras por semana; seguir a skill dataviz) e permissões de quem vê o cartão (sugestão: ADMIN/MANAGER).
- Formato e local da lista de auditoria (arquivo em `.planning/phases/05-uso-no-dia-a-dia/` + resumo para a usuária).

### Deferred Ideas (OUT OF SCOPE)
- WhatsApp/comunicação (999.1), Pix com QR (999.2), produção/monitoramento (999.3), fechamento da cobertura de testes (999.4), sugestão de agenda com Claude real (999.5).
- Média histórica na previsão; controle de pagamento de comissão ("marcar como paga"); contas a pagar completo (baixa, fornecedor, anexos).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | Research Support |
|----|-----------|------------------|
| FIN-03 | Previsão de 30 dias (agenda confirmada + parcelas de contratos − comissões − despesas fixas) | Seção "Modelo de dados da previsão": fontes, regras de valoração, `allocateInstallments`, `resolveCommissionRule`/`computeCommission`, nova tabela `fixed_expenses`, query `cashForecast` |
| UX-DAY | Auditoria das telas principais, lista aprovada, correções aplicadas | Seção "Auditoria de usabilidade": método Playwright, formato da lista, checkpoint de aprovação, lotes de correção |
</phase_requirements>

## Summary

Não há nenhuma biblioteca nova a adicionar. Tudo que a previsão precisa já existe no repositório: `allocateInstallments` (quita parcelas do sinal na ordem de vencimento com o pagamento líquido), `computeContractStatus` (saldo do contrato), `resolveCommissionRule` + `computeCommission` (comissão pelo preço cheio), `toCents/fromCents` (dinheiro em centavos inteiros no cálculo, `Decimal(12,2)` e string "80.50" na API), `TenantContextService.runWithTenant` (RLS) e o padrão de datas locais "YYYY-MM-DD" com `to` exclusivo do `financialSummary`. No frontend, Recharts 2.15 já é usado em `FinanceiroPage.tsx`, e o gráfico por semana é um `BarChart` agrupado igual ao que já existe.

Ponto de atenção maior: o painel `/dashboard` está **desligado por flag** (`FEATURES.dashboard = false` em `apps/frontend/src/config/features.ts`), e `HOME_PATH` hoje é `/agenda`. Ligar a flag muda a home de login e redirecionamentos (testes E2E e unitários que assumem `/agenda` podem quebrar). Do mesmo modo, as rotas `/financeiro/despesas` e `/financeiro/fluxo` são **mocks** (`FinancialSubPages.tsx`) governados por `financeiroRelatorios: false`; a página real de despesas fixas deve usar rota nova e NÃO ligar essa flag (ligaria 9 telas mockadas).

Os pontos de semântica que o planner precisa travar: (1) agendamento "confirmado" = `status IN ('scheduled','confirmed')` com `starts_at` futuro (decisão recomendada abaixo, ver Open Questions); (2) valor do agendamento = soma dos itens da comanda aberta ligada (já tem desconto) ou, sem comanda, preço da variante/serviço, menos `deposit_amount` já pago; (3) agendamento com `contract_id` não entra (a parcela do contrato já entra); (4) comissão estimada sobre o preço CHEIO da lista, como em `computeCommission`.

**Primary recommendation:** Uma query GraphQL `cashForecast(from, to)` no módulo `financial` (service próprio `forecast.service.ts` com função pura de agregação + coleta SQL/Prisma), tabela `fixed_expenses` com RLS por migration nova, permissão nova `financial.expenseWrite` (ADMIN/MANAGER), cartão no `/dashboard` (flag ligada) e detalhe em `/financeiro/previsao`; auditoria como Plano 05-01 não autônomo com Playwright contra o staging (desktop + celular) gerando `05-AUDITORIA.md`.

## Project Constraints (from CLAUDE.md)

- Stack fixa: NestJS 10, GraphQL schema-first (SDL), Prisma 5, PostgreSQL 16 com RLS (inegociável), React 18 + Vite 5 + Apollo Client 3 + Tailwind 3 + shadcn/ui.
- Compliance: LGPD, WCAG 2.1 AA (contraste, foco, rótulos nos gráficos/cartões), OWASP.
- Testes: bloqueio de PR em falha; E2E para fluxos críticos.
- GSD: alterações de arquivos só via fluxo GSD (`/gsd:execute-phase` etc.).
- Memória do usuário: toda comunicação em PT-BR; gate completo antes de commit (lint + tsc + jest unit + integração com Postgres local + vitest), depois push + `scripts/deploy-staging.sh` e acompanhar CI (`gh run watch`); branch do repo é `master`; backup do banco do staging antes de deploy com migration (`/root/sgs-backups/`); acentuação correta em todo texto de UI.
- Nenhuma skill de projeto em `.claude/skills` ou `.agents/skills` do repositório (só `~/.claude/skills/synced`, não relacionada).

## Standard Stack

Sem dependências novas. Versões já no repositório (verificadas em `package.json`/código):

### Core
| Biblioteca | Versão | Uso nesta fase | Observação |
|-----------|--------|----------------|------------|
| NestJS + @nestjs/graphql (schema-first) | 10.x | `forecast.service.ts`, resolver, SDL em `financial.graphql` | SDL em `apps/backend/src/graphql/schema/*.graphql` |
| Prisma | 5.x | Modelo `FixedExpense`, queries tipadas; `$queryRaw` para agregação com fuso | Migrations SQL manuais (padrão do repo) |
| PostgreSQL 16 + RLS | 16 | `fixed_expenses` com FORCE RLS | Policy `tenant_isolation` por `app.current_organization` |
| Recharts | ^2.15.3 | `BarChart` por semana (entradas x saídas) | Já usado em `FinanceiroPage.tsx` |
| Apollo Client 3 | 3.x | `gql` inline em `*.api.ts` | **Não há codegen em uso** (ver Pitfall 5) |
| Playwright | ^1.55 | Auditoria no staging e E2E | `apps/e2e` |
| Vitest + Testing Library | 2.1 / 16 | Testes do cartão e da página | `apps/frontend/src/features/operations/__tests__` |
| Jest (unit + integração, `--runInBand`) | | Testes do domínio e `phase5-*.e2e.spec.ts` | |

### Alternatives Considered
| Em vez de | Poderia usar | Por que não |
|-----------|--------------|-------------|
| `cashForecast` novo | Estender `financialSummary` | `financialSummary` é retrospectivo (comandas fechadas, caixa); misturar quebra o contrato e os testes da fase 3/4 |
| Despesa fixa como linha por mês | Gerar ocorrências materializadas | Contexto D-06 pede só nome/valor/dia/ativo; ocorrência é derivada na consulta |
| Biblioteca de recorrência (rrule) | Função pura de 15 linhas | Recorrência é mensal por dia fixo; ver Don't Hand-Roll |

**Instalação:** nenhuma.

## Architecture Patterns

### Estrutura recomendada
```
apps/backend/
  prisma/migrations/2026110X000000_phase5_fixed_expenses/migration.sql   # tabela + RLS + grants + permissão
  prisma/schema.prisma                                                    # model FixedExpense
  src/financial/forecast.ts            # funções PURAS: expansão de despesas, bucket semanal, totais (jest unit)
  src/financial/forecast.service.ts    # coleta (tenant tx) + chama funções puras
  src/financial/fixed-expense.service.ts + resolver (CRUD)
  src/graphql/schema/financial.graphql # cashForecast, fixedExpenses, mutations
  test/integration/phase5-forecast.e2e.spec.ts / phase5-rls-rbac.e2e.spec.ts
apps/frontend/src/
  features/operations/api/forecast.api.ts
  features/operations/components/ForecastCard.tsx          # cartão do painel
  features/operations/pages/PrevisaoPage.tsx               # /financeiro/previsao (detalhe)
  features/operations/pages/DespesasFixasPage.tsx          # /financeiro/despesas-fixas
  pages/DashboardPage.tsx (substitui DashboardPlaceholder em /dashboard)
```

### Modelo de dados da previsão (regras a travar no plano)

**Janela:** `from` = hoje no fuso da org (calcular no servidor com `organizations.timezone`, default `America/Sao_Paulo`), `to = from + 30 dias` (exclusivo). A query recebe `from`/`to` strings "YYYY-MM-DD" como o `financialSummary` (reaproveitar `validateRange`, hoje não exportada em `financial.service.ts`; exportar ou mover para helper). Buckets semanais: semanas começando em `from` (7 dias cada, última pode ser parcial de 2 dias: 30 = 4×7+2) — mais legível para a dona que `date_trunc('week')` (segunda-feira), que cortaria a primeira semana. Decisão recomendada: semana 1..5 a partir de hoje, rotuladas "dd/MM – dd/MM".

**Entradas:**
1. *Agendamentos:* `appointments` com `starts_at` na janela (convertida com `AT TIME ZONE tz`, mesmo padrão do `financialSummary`), `status IN ('scheduled','confirmed')`, `contract_id IS NULL`. Excluir `cancelled`, `no_show` e `completed` (já viraram comanda/caixa) e `in_progress` só se o início for hoje e a comanda ainda estiver aberta (opcional; documentar). Status reais em `appointment-status.ts`: `scheduled`, `confirmed`, `in_progress`, `completed` (bloqueiam agenda) + `cancelled`/`no_show` (confirmar no CHECK da migration da fase 3 antes de escrever o filtro).
   - Valor: se `comanda_id` tem comanda `open`, usar soma de `comanda_items.total` dos itens do agendamento (já reflete preço da variante/desconto/pacote); senão `service_pricing_variants.price` (se `service_variant_id`) ou `services.base_price`. Descontar `appointments.deposit_amount` (sinal já recebido via `cash_movements.kind='deposit_in'`, vira crédito consumido no fechamento — ver `visits.ts` e `comanda-close.ts`), piso em 0.
   - Data da entrada = dia de `starts_at` no fuso da org.
2. *Contratos:* contratos `status IN ('active')` (não `draft`, `awaiting_acceptance`, `cancelled`; `completed` não tem pendência). Para cada um: `net = SUM(contract_payments.amount)` (estornos são linhas negativas), `allocateInstallments(installments, net, today)` → cada parcela com `pendingCents > 0` entra em `dueDate` (se dentro da janela). Restante: `balancePending = max(0, total − max(net, deposit))`, entra em `balance_due_date` se na janela e `> 0`. Reusar o mesmo padrão do `alert-candidates.ts` (linhas ~131-134) para carregar installments/pagamentos.
   - Atrasadas (vencimento < hoje e pendentes): ver Open Question 1 (recomendação: entram na semana 1 marcadas "em atraso").
   - Contrato `a_vista` tem 1 parcela com o total; não somar o restante duas vezes (restante = 0 nesse caso porque `deposit = total`).

**Saídas:**
3. *Comissão estimada:* para cada agendamento incluído na entrada (inclusive os com `contract_id`? **Não**: comissão de itens de contrato é calculada no fechamento da comanda contra o contrato; ver Open Question 2), carregar `commission_rules` (não apagadas) e categorias (para `categoryChain`) uma vez, e para cada agendamento chamar `resolveCommissionRule(rules, {kind:'service', memberId: professionalId, serviceId, categoryChain})` + `computeCommission(match, {listUnitCents: preço de lista (variante ou base_price), quantity: 1, chargedCents})`. Comissão é sobre o preço CHEIO (D-23 da fase 3), então não descontar o sinal. Sem regra → 0 e marcar `noRule` (exibir contagem "sem regra de comissão" no detalhe, igual `noRuleCount` de `commissionTotals`). Data da saída = dia do agendamento (aproximação; pagamento real ocorre no ciclo da profissional).
4. *Despesas fixas:* para cada `fixed_expenses` ativa, para cada mês tocado pela janela, data = `min(dia, último dia do mês)`; incluir se `from <= data < to`. Função pura `expandFixedExpenses(expenses, from, to)` com testes de fevereiro/29-31.

**Saldo** = entradas − saídas, em centavos inteiros; API devolve strings "80.50" (padrão `money()`).

### Contrato GraphQL sugerido (SDL, `financial.graphql`)
```graphql
extend type Query {
  "from/to = YYYY-MM-DD no fuso da org (to exclusivo). Requer financial.read"
  cashForecast(from: String!, to: String!): CashForecast!
  fixedExpenses: [FixedExpense!]!
}
extend type Mutation {
  createFixedExpense(input: FixedExpenseInput!): FixedExpensePayload!
  updateFixedExpense(id: UUID!, input: FixedExpenseInput!): FixedExpensePayload!
  deleteFixedExpense(id: UUID!): FixedExpensePayload!   # ou toggle ativo
}
type CashForecast {
  from: String! to: String! timezone: String!
  inflowTotal: String! outflowTotal: String! balance: String!
  buckets: [ForecastBucket!]!      # semanas
  items: [ForecastItem!]!          # origem de cada valor, para o detalhe
}
type ForecastItem { date: String!  kind: String!  # appointment | contract_installment | contract_balance | commission | fixed_expense
  direction: String!  # in | out
  amount: String!  label: String!  refId: UUID  overdue: Boolean!  noRule: Boolean! }
type FixedExpense { id: UUID! name: String! amount: String! dueDay: Int! active: Boolean! }
input FixedExpenseInput { name: String! amount: String! dueDay: Int! active: Boolean }
type FixedExpensePayload { fixedExpense: FixedExpense  errors: [UserError!]! }
```
Convenções confirmadas: erros de negócio como dado (`errors: [UserError!]!` com `code/message/field`, ver `ClientCreditPayload`), valores monetários `String`, `UUID` e `DateTime` como scalars (`scalars.graphql`), validação de entrada de dinheiro com `parseMoneyInput` (`^\d+(\.\d{1,2})?$`).

### Migration `fixed_expenses` (padrão do repo)
```sql
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
  CONSTRAINT chk_fe_due_day CHECK (due_day BETWEEN 1 AND 31)
);
CREATE INDEX ix_fe_org ON fixed_expenses(organization_id);
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fixed_expenses
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
-- GRANT ao sgs_app: copiar o bloco DO $$ ... IF EXISTS (pg_roles 'sgs_app') da migration 20261105000000
-- Seed de permissão: copiar o bloco DO $$ da fase 4 (INSERT INTO role_permissions) para ADMIN e MANAGER
```
Padrão verificado em `20261105000000_contract_layout_studio_js/migration.sql` (linhas 41-58 e 112-123). Última migration existente: `20261105010000_seed_studio_js_contract`; a nova deve ter timestamp posterior (ex.: `20261106000000_phase5_fixed_expenses`). Atualizar também `model FixedExpense` em `schema.prisma` (`@@map("fixed_expenses")`).

### RBAC (CASL/catálogo de permissões)
- `FINANCIAL_READ = 'financial.read'` já existe e está nas listas ADMIN (linha ~118) e MANAGER (~159) de `permissions.catalog.ts`; use-o em `cashForecast` via `@RequirePermission(PERMISSIONS.FINANCIAL_READ)` (mesmo padrão de `financialSummary`).
- Para escrita de despesas fixas, adicionar `FINANCIAL_EXPENSE_WRITE: 'financial.expenseWrite'` ao catálogo (ADMIN e MANAGER) **e** a um INSERT em `role_permissions` na migration (o catálogo TS é a fonte tipada; o banco é materializado por migration seed — as duas pontas precisam mudar). Espelhar no frontend em `features/operations/operations-permissions.ts` (`ROLE_OPERATION_PERMISSIONS`, gate por `roleName` além de `permissions`).
- ATTENDANT e PROFESSIONAL não devem ver o cartão nem a rota; o cartão no `/dashboard` deve ser omitido sem `financial.read` (o painel continua acessível aos demais).

### Frontend
- **Painel:** `router.tsx` linha 99 troca `DashboardPlaceholder` por `DashboardPage` (arquivo `pages/DashboardPage.tsx` já existe, com 8 linhas — verificar o conteúdo antes). Ligar `FEATURES.dashboard = true` muda `HOME_PATH` para `/dashboard` e a poda de rotas: revisar `menu-config.ts`, testes que esperam redirecionamento para `/agenda`, e o E2E `smoke.spec.ts`. Alternativa de menor risco: ligar a flag só se a decisão do plano for tornar o painel a home; senão manter a home em `/agenda` e acessar o painel por menu (decisão do planner; ver Open Question 3).
- **Detalhe:** nova rota `/financeiro/previsao` (coberta pela flag `financeiro: true` via prefixo `/financeiro`, porque não casa com os prefixos mockados de `GATED_PATHS`). **Não** usar `/financeiro/despesas` (mock gated por `financeiroRelatorios`). Para o cadastro usar `/financeiro/despesas-fixas`: o `matches()` exige `prefix` exato ou `prefix + '/'`, então `/financeiro/despesas-fixas` NÃO cai no prefixo `/financeiro/despesas` — cai em `/financeiro` (liberado). Adicionar item no `menu-config.ts` (grupo Financeiro, linha ~186+).
- **Dinheiro:** `formatCurrencyDisplay` (`features/catalog/utils/currency-mask.ts`), `maskCurrency/unmaskCurrency` para o campo de valor; strings "80.50" da API.
- **Gráfico:** `BarChart` agrupado (entradas, saídas) por semana, `ResponsiveContainer`, `Tooltip` com valores BRL, cores com contraste AA e legenda textual (não depender só de cor); reaproveitar o estilo de `FinanceiroPage.tsx`. Em jsdom Recharts precisa do mock de `ResponsiveContainer` — ver `features/operations/__tests__/recharts-smoke.test.tsx`.
- **Estados:** carregando (`Skeleton`), vazio ("Nenhum valor previsto nos próximos 30 dias"), erro (`Alert`) — são justamente os pontos que a auditoria cobra.
- **Componentes shadcn disponíveis** (`components/ui`): alert, alert-dialog, badge, breadcrumb, button, card, collapsible, command, data-table, dialog, dropdown-menu, form, input, label, popover, radio-group, select, separator, sheet, skeleton, sonner, table, tabs, textarea, tooltip. Sem `switch`/`checkbox`: para "ativo/inativo" usar `radio-group` ou botão de ação (não adicionar dependência sem necessidade).
- **Fuso no cliente:** a janela é calculada no servidor? A query recebe `from`/`to`; o cliente deve derivar "hoje" no fuso da org (`America/Sao_Paulo`) com `date-fns-tz`/`Intl`, nunca `new Date().toISOString().slice(0,10)` (UTC adianta o dia após 21h). Ver `lib/period-value.ts` (`defaultPeriod`) para o helper existente e reutilizar.

### Anti-Patterns to Avoid
- Somar floats/Decimal em JS: calcular em centavos inteiros (`toCents`) e só formatar no fim (`fromCents`).
- Usar `date_trunc('week')` para os buckets (corta a primeira semana e confunde); usar `from + n*7`.
- Contar duas vezes: agendamento com `contract_id` (parcela já entra) e sinal pago (já está no caixa).
- Criar a política RLS sem `FORCE` ou esquecer o `GRANT` ao `sgs_app` (tabela "invisível" ou aberta demais).
- Ligar `financeiroRelatorios` para liberar a página de despesas (libera 9 mocks).
- Mutações destrutivas sem confirmação (`alert-dialog` existe) em despesas fixas.

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Quitar parcelas do sinal | Nova lógica de pagamento por parcela | `allocateInstallments` (`contracts/domain/contract-math.ts`) | Já usada nos alertas; derivação consistente com a tela do contrato |
| Saldo do contrato | Recalcular `total − pago` | `computeContractStatus` | Trata estorno (linhas negativas), cancelado, rascunho |
| Regra de comissão | Reimplementar precedência | `resolveCommissionRule` + `computeCommission` + `categoryChain` | Precedência member_service > service > category > default, half-up |
| Dinheiro | Aritmética com float | `toCents/fromCents/parseMoneyInput` (`common/money.ts`) | Half-up e formato |
| Fuso/limites de dia | `new Date()` + offsets | `AT TIME ZONE ${tz}` no SQL como em `financialSummary` | Horário de verão/ UTC |
| Tenant isolation | `WHERE organization_id =` manual | `TenantContextService.runWithTenant` + RLS | Garantia no banco |
| Gráfico | SVG manual | Recharts | Já no projeto |

## Runtime State Inventory

Fase não é rename/refactor. Seção omitida. Observação: a migration é aditiva (nova tabela); o deploy do staging aplica a migration (`scripts/deploy-staging.sh`), e exige backup prévio em `/root/sgs-backups/` por regra do usuário.

## Common Pitfalls

### Pitfall 1: Contar duas vezes o sinal ou o contrato
**O que dá errado:** previsão superestimada. **Causa:** `deposit_amount` do agendamento já entrou no caixa (`deposit_in`); agendamentos de noivas têm `contract_id` e a parcela do contrato já entra. **Como evitar:** `valor = max(0, preço − deposit_amount)`; filtrar `contract_id IS NULL`. **Sinal:** saldo previsto muito acima do real na semana de um evento de noiva.

### Pitfall 2: Semântica de "confirmado"
**O que dá errado:** agenda cheia de `scheduled` (não confirmados) some da previsão; ou entram `cancelled`. **Como evitar:** decidir e documentar (recomendação: `scheduled` e `confirmed`, pois no Studio JS a confirmação é raramente marcada). Ver Open Question 4.

### Pitfall 3: Fuso e bordas da janela
**O que dá errado:** agendamento das 23h cai no dia seguinte (UTC) ou o último dia da janela é perdido. **Como evitar:** `starts_at AT TIME ZONE tz` e `to` exclusivo; teste de integração com agendamento 22:30 local e na fronteira do 30º dia.

### Pitfall 4: Despesa no dia 29-31
**O que dá errado:** fevereiro pula a despesa. **Como evitar:** `min(dueDay, últimoDiaDoMês)`; teste unitário com 31 em fevereiro/abril e janela que cruza dois meses.

### Pitfall 5: Codegen do frontend não é usado
`codegen.ts` aponta para um servidor rodando e `src/gql/` não existe no repo; as queries são `gql` inline em `features/*/api/*.api.ts` com tipos escritos à mão (ex.: `FinancialSummaryResult`). Não planejar etapa de codegen; escrever os tipos manualmente em `forecast.api.ts`. O contrato é validado pelo teste de integração e pelo build.

### Pitfall 6: Ligar o painel quebra a home
`FEATURES.dashboard` muda `HOME_PATH` (login/redirecionos). Rodar vitest e o E2E inteiros após a mudança.

### Pitfall 7: RLS em testes de integração
Fixtures de teste inserem com `adminPrisma` (role migrator) e consultam via `gqlAs`; limpar dados no `afterAll` (`deletePhase3Rows`/`deletePhase4Rows` — criar `deletePhase5Rows` ou estender para remover `fixed_expenses` antes das organizations por causa da FK).

### Pitfall 8: Permissão no catálogo sem migration
Adicionar `financial.expenseWrite` só no TS deixa o banco sem a permissão (e vice-versa). Alterar as duas pontas e cobrir com teste RBAC.

### Pitfall 9: Auditoria no staging expõe dados pessoais
Screenshots de staging têm nomes de clientes reais. Não versionar imagens (`.gitignore` na pasta de evidências, ex. `05-audit-evidence/`) e a lista em Markdown deve usar descrição genérica ("cliente com nome longo") sem nome/telefone/CPF (CONTEXT: "sem expor dados pessoais em arquivos versionados").

## Auditoria de usabilidade (UX-DAY)

**Estrutura de planos recomendada:**
1. **05-01 (não autônomo, checkpoint humano):** auditoria no staging → `05-AUDITORIA.md` (lista priorizada) + resumo para a usuária; para na aprovação. Nenhuma correção.
2. **05-02..05-0N (backend/frontend FIN-03):** podem rodar em paralelo à auditoria (são independentes), mas as correções de UX só começam após a aprovação.
3. **Planos de correção em lotes** (gerados após a aprovação, por tela na ordem D-02: Agenda, Comanda/caixa, Noivas/contratos, Clientes/financeiro, Painel). Como os itens só existem depois da auditoria, o plan-phase deve prever planos placeholder ("Lote 1..N, itens definidos em 05-AUDITORIA.md aprovado") ou o ciclo `/gsd:plan-phase` ser reexecutado após a aprovação.

**Método (verificado no repo):**
- Playwright já está em `apps/e2e` (`@playwright/test ^1.55`, projeto `chromium` Desktop Chrome, `locale: 'pt-BR'`, `timezoneId: 'America/Sao_Paulo'`, `workers: 1`). Config atual sobe backend (3100) e frontend (5180) locais com seed; a auditoria no staging precisa de um config separado (ex.: `playwright.audit.config.ts`) com `baseURL: https://sgs.jessicaseixasmakeup.com.br`, sem `webServer`/`setup`, projetos `desktop` (1366x768) e `mobile` (`devices['Pixel 7']` ou iPhone, 390x844).
- **Credenciais/org:** a conta do usuário é platform admin (cai em `/admin`); para ver telas do salão é preciso entrar na org "Studio JS" pelo painel de clientes (nota de memória). Só "Studio JS" está `active`; as outras estão suspensas. A auditoria precisa de credencial de um membro ADMIN/MANAGER do Studio JS ou do fluxo de impersonação do admin: **perguntar à usuária/obter via variável de ambiente** (`AUDIT_EMAIL`, `AUDIT_PASSWORD`; nunca gravar no repo). Ver Open Question 5.
- **Somente leitura no staging:** a auditoria não deve criar/alterar dados reais da usuária. Para tarefas que exigem escrita (marcar horário, fechar comanda, registrar parcela), usar (a) navegação até o ponto antes do envio, medindo cliques/passos, ou (b) rodar o mesmo roteiro no ambiente local semeado (`apps/e2e`, org de teste) onde escrever é seguro. Registrar na lista qual evidência veio de onde.
- **Roteiro por tarefa (D-03):** marcar horário; remarcar (drag-and-drop e menu); confirmar/cancelar; abrir comanda de agendamento, adicionar item, receber (dinheiro/Pix/cartão), fechar; criar noiva/grupo, contrato, registrar pagamento/parcela; buscar cliente e abrir ficha; abrir Financeiro (período, resumo, caixa). Para cada uma: nº de cliques, tempo até conclusão, erros sem explicação, estado vazio/carregando, textos sem acento ou em inglês, overflow no celular (usar `page.evaluate(() => document.documentElement.scrollWidth > innerWidth)` para detectar rolagem horizontal), alvos de toque < 44px, contraste.
- **Verificação automática de apoio:** `@axe-core/playwright` seria o padrão para a regra WCAG 2.1 AA; **não está** nas dependências (verificado em `apps/e2e/package.json`). É uma devDependency de baixo risco, mas depende de aprovação; alternativa sem dependência: checklist manual + varredura de strings em PT-BR via grep no frontend (acentos faltantes tipo "nao", "voce", "Configuracoes"). Sugestão: usar o grep e propor o axe como opcional.
- **Formato da lista** (arquivo `.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md`): tabela `ID | Severidade (Bloqueia/Atrapalha/Polimento) | Tela | Passo a passo | Esperado x Observado | Correção proposta | Esforço (P/M/G) | Aprovado? (sim/não/depois)`; agrupada na ordem de D-02; seção "Ideias de funcionalidade nova (Deferred)" separada. Resumo em PT-BR de uma página para a usuária, ordenado por impacto no dia a dia, com a coluna "Aprovado?" que ela preenche (a aprovação fica registrada no arquivo e em STATE.md).
- **Evidências:** screenshots em `.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/` ignoradas pelo git (Pitfall 9).
- **Critério de saída da correção:** cada item aprovado vira tarefa com teste (vitest para texto/estado; Playwright para fluxo) e reverificação no staging pós-deploy; a lista é atualizada com "Corrigido em <commit>".

## Code Examples

### Expansão de despesas fixas (função pura, para jest)
```typescript
// apps/backend/src/financial/forecast.ts
// Fonte: padrão do repo (datas "YYYY-MM-DD" locais, to exclusivo; centavos inteiros)
export function expandFixedExpenses(
  expenses: { id: string; name: string; cents: number; dueDay: number }[],
  from: string, // inclusivo
  to: string,   // exclusivo
): { id: string; name: string; date: string; cents: number }[] {
  const out: { id: string; name: string; date: string; cents: number }[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (const e of expenses) {
      const day = Math.min(e.dueDay, last);
      const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (date >= from && date < to) out.push({ id: e.id, name: e.name, date, cents: e.cents });
    }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
```

### Parcelas pendentes de contrato dentro da janela
```typescript
// Fonte: contracts/alerts/alert-candidates.ts (uso de allocateInstallments)
const net = payments.reduce((a, b) => a + b, 0);                // estornos negativos incluídos
for (const i of allocateInstallments(installments, net, today)) {
  if (i.pendingCents > 0 && i.dueDate >= from && i.dueDate < to) {
    items.push({ kind: 'contract_installment', date: i.dueDate, cents: i.pendingCents, overdue: false });
  }
}
const balancePending = Math.max(0, totalCents - Math.max(net, depositCents));
if (balancePending > 0 && balanceDueDate >= from && balanceDueDate < to) {
  items.push({ kind: 'contract_balance', date: balanceDueDate, cents: balancePending, overdue: false });
}
```

### Comissão estimada de um agendamento
```typescript
// Fonte: financial/commission-resolver.ts
const match = resolveCommissionRule(rules, {
  kind: 'service', memberId: appt.professionalId, serviceId: appt.serviceId,
  categoryChain: categoryChain(service.categoryId, parentsByCategory),
});
const c = computeCommission(match, { listUnitCents: listCents, quantity: 1, chargedCents: valueCents });
// c.amountCents (R$ 0 e noRule=true se não houver regra)
```

### Query do agendamento com fuso (esboço)
```sql
SELECT a.id, a.professional_id, a.service_id, a.service_variant_id, a.deposit_amount, a.comanda_id,
       (a.starts_at AT TIME ZONE ${tz})::date AS local_day
  FROM appointments a
 WHERE a.status IN ('scheduled','confirmed')
   AND a.contract_id IS NULL
   AND a.starts_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
   AND a.starts_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
```
(RLS já filtra por organização dentro de `runWithTenant`.)

## State of the Art

| Antes | Agora | Impacto |
|-------|-------|---------|
| Painel placeholder com cartões de "descoberta" mockados | Painel com cartão real de previsão | Ligar flag `dashboard`, mudar home |
| `financialSummary` só retrospectivo | `cashForecast` prospectivo | Sem mudar o contrato existente |

Sem mudanças de ecossistema relevantes: stack travada pelo CLAUDE.md (Recharts 2.x, Apollo 3, React 18). Não migrar versões nesta fase.

## Open Questions

1. **Parcelas/restante em atraso entram na previsão?**
   - Sabemos: D-04 diz "que vencem no período"; os alertas já tratam atrasos separadamente.
   - Incerto: a usuária quer ver dinheiro atrasado ainda a receber.
   - Recomendação: incluir pendentes vencidas na semana 1 com flag `overdue` e rótulo "em atraso" (e destacar no detalhe), por ser a pergunta real "quanto vai entrar". Levar como pergunta rápida no checkpoint do plano; é fácil de inverter (filtro).
2. **Comissão de agendamentos ligados a contrato (noivas)?**
   - Sabemos: a entrada deles vem da parcela do contrato; comissão real é computada no fechamento da comanda.
   - Incerto: se a comissão dessas profissionais deve ser estimada.
   - Recomendação: estimar a comissão também dos agendamentos de contrato (a saída existe de fato), usando o preço de lista do serviço, mesmo sem entrada por agendamento. Se o contrato tiver itens com `unit_price` próprio, preferir o `list_unit_price` do item. Registrar a decisão no plano e testar. (Alternativa conservadora: não estimar, subestimando saídas; menos desejável.)
3. **Painel vira a home (`HOME_PATH`)?**
   - Recomendação: sim, ligar `FEATURES.dashboard` (o roadmap diz "a dona abre o painel inicial"), com um plano dedicado a ajustar testes/redirecionamentos e rodar E2E completo.
4. **Status "confirmado":** recomendação `scheduled` + `confirmed` (excluir `cancelled`, `no_show`, `completed`, `in_progress` do dia). Validar com a usuária no mesmo checkpoint; deixar o conjunto numa constante exportada (`FORECAST_APPOINTMENT_STATUSES`) para trocar fácil.
5. **Credencial de teste do Studio JS para a auditoria:** o que a usuária prefere (usuário dedicado de leitura ADMIN/MANAGER vs. acesso via painel admin)? Bloqueia o plano 05-01 se não houver; fallback: auditar no ambiente local semeado e pedir validação no staging.
6. **Valor do agendamento sem comanda:** confirmar que agendamento futuro tem `comanda_id` (visits.ts cria comanda ao agendar com `recalcComandaTotal`); se a maioria tem, a fonte principal é o item da comanda. Verificar com dados reais do staging (consulta somente leitura, `SET LOCAL app.current_organization`) antes de fixar a prioridade das fontes.

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|-----------------|-----------|--------|----------|
| Node / pnpm (corepack) | build, testes | Sim (repo exige Node >= 22, pnpm 9.15) | engines do `package.json` | — |
| PostgreSQL local (sgs_dev 5433/5434) + PgBouncer | testes de integração | Conforme memória do usuário (não reexecutado nesta pesquisa) | PG 16 | `docker compose up -d postgres pgbouncer valkey` |
| Playwright + Chromium | E2E e auditoria | Dependência do `apps/e2e`; Chromium via `playwright install` (CI já instala) | ^1.55 | — |
| Staging (https://sgs.jessicaseixasmakeup.com.br), Postgres do staging | auditoria e deploy | Conforme memória (VPS 85.209.93.171, containers `sgs_stg_*`) | — | Auditar localmente com seed |
| Credenciais Studio JS | auditoria | NÃO CONFIRMADO | — | Open Question 5 |
| `ANTHROPIC_API_KEY` | não necessária nesta fase | — | — | — |

**Bloqueio sem fallback:** nenhum técnico; apenas a credencial/acesso à org Studio JS (Open Question 5).
Observação: não rodei probes de ferramentas (`command -v`), então tratar a disponibilidade local como a documentada em memória/CI, a confirmar no início da execução (Wave 0).

## Validation Architecture

### Test Framework
| Propriedade | Valor |
|-------------|-------|
| Backend unit | Jest (`apps/backend`, `jest.config.ts`) — `pnpm --filter @sgs/backend test` |
| Backend integração | Jest `--runInBand` contra Postgres real (`jest-integration.config.ts`, `test/integration/*.e2e.spec.ts`) — `pnpm --filter @sgs/backend test:integration` |
| Frontend | Vitest 2 + Testing Library (`apps/frontend`, `vitest.config.ts`) — `pnpm --filter @sgs/frontend test` |
| E2E | Playwright (`apps/e2e`) — `corepack pnpm --filter @sgs/e2e test:e2e` (sem `--` antes das flags) |
| Estáticos | `pnpm -r typecheck`, `pnpm -r --if-present lint` (backend lint usa `--max-warnings 0`) |
| CI | `.github/workflows/ci.yml`: typecheck, lint, integração (com migrations via `prisma migrate deploy`), E2E |

### Phase Requirements → Test Map
| Req | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|-----|---------------|------|----------------------|-----------------|
| FIN-03 | `expandFixedExpenses` (dia 31 em fev., janela cruzando meses, inativas fora) | unit | `pnpm --filter @sgs/backend test -- forecast` | Wave 0 (`src/financial/forecast.spec.ts`) |
| FIN-03 | agregação em buckets semanais e saldo em centavos; semana parcial final | unit | idem | Wave 0 |
| FIN-03 | agendamentos `scheduled/confirmed` somam; `cancelled/no_show/completed` e `contract_id` não; sinal descontado; fronteiras de fuso (22:30 local, 30º dia) | integração | `pnpm --filter @sgs/backend test:integration -- phase5-forecast` | Wave 0 (`test/integration/phase5-forecast.e2e.spec.ts`) |
| FIN-03 | parcelas pendentes de contrato `active` entram na data; pagas/parciais (parcial entra só o pendente), estorno reabre; restante em `balance_due_date`; contrato `draft/cancelled` fora | integração | idem | Wave 0 (reusar `createPhase4World`, `insertContractRow`) |
| FIN-03 | comissão estimada = `computeCommission` por profissional/serviço, sem regra => 0 com flag | integração | idem | Wave 0 |
| FIN-03 | despesas fixas ativas entram nas saídas; inativas não | integração | idem | Wave 0 |
| FIN-03 | RLS: org B não vê/edita despesas da org A; RBAC: ATTENDANT/PROFESSIONAL negados em `cashForecast` e CRUD; ADMIN/MANAGER permitidos | integração | `pnpm --filter @sgs/backend test:integration -- phase5-rls-rbac` | Wave 0 (modelo: `phase4-rls-rbac.e2e.spec.ts`) |
| FIN-03 | cartão do painel mostra entradas/saídas/saldo, gráfico semanal e link ao detalhe; esconde sem `financial.read`; estados carregando/vazio/erro | vitest | `pnpm --filter @sgs/frontend test -- forecast` | Wave 0 (`features/operations/__tests__/forecast-card.test.tsx`, modelo `financeiro-page.test.tsx`) |
| FIN-03 | tela de despesas fixas: criar/editar/desativar com máscara BRL, validação de dia 1-31, acentuação | vitest | idem | Wave 0 |
| FIN-03 | fluxo ponta a ponta: cadastrar despesa fixa -> ver no painel -> clicar -> detalhe lista a origem | E2E | `corepack pnpm --filter @sgs/e2e test:e2e financeiro-previsao` | Wave 0 (`apps/e2e/tests/financeiro-previsao.spec.ts`, helpers `support/phase3.ts`/`phase4.ts`) |
| UX-DAY | existe `05-AUDITORIA.md` com campos obrigatórios e coluna de aprovação preenchida pela usuária | checagem de arquivo | `test -s .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md && grep -c "Aprovado" .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md` | Wave 0 (gerado pelo plano 05-01) |
| UX-DAY | roteiro de auditoria reexecutável (screenshots desktop+mobile, detecção de overflow horizontal) | Playwright (config de auditoria) | `corepack pnpm --filter @sgs/e2e exec playwright test -c playwright.audit.config.ts` | Wave 0 |
| UX-DAY | cada item aprovado tem teste de regressão (vitest ou Playwright) e fica marcado "Corrigido" | vitest/E2E + checagem | `pnpm --filter @sgs/frontend test` e `grep -c "Corrigido" 05-AUDITORIA.md` | por item |
| UX-DAY | itens aprovados verificados no staging após deploy | manual (justificativa: depende de staging/usuária) | rodar o roteiro de auditoria contra o staging e anexar resultado | — |
| Geral | acentuação PT-BR nas novas telas | grep | `grep -rnE "\b(nao\|voce\|despesa fixa)\b" apps/frontend/src/features/operations` (lista de termos sem acento a refinar) | Wave 0 |

### Sampling Rate
- **Por commit de tarefa:** `pnpm --filter @sgs/backend test -- forecast` ou `pnpm --filter @sgs/frontend test -- <arquivo>` + `pnpm -r typecheck`.
- **Por merge de onda:** `pnpm -r --if-present lint`, `pnpm --filter @sgs/backend test`, `pnpm --filter @sgs/backend test:integration`, `pnpm --filter @sgs/frontend test`.
- **Gate da fase (antes de `/gsd:verify-work`):** tudo acima + `corepack pnpm --filter @sgs/e2e test:e2e` + CI verde (`gh run watch`) + verificação no staging após `scripts/deploy-staging.sh`.

### Wave 0 Gaps
- [ ] `apps/backend/src/financial/forecast.spec.ts` (funções puras)
- [ ] `apps/backend/test/integration/phase5-forecast.e2e.spec.ts`, `phase5-rls-rbac.e2e.spec.ts` e `helpers/phase5-cleanup.ts` (remover `fixed_expenses` antes das orgs)
- [ ] `apps/frontend/src/features/operations/__tests__/forecast-card.test.tsx`, `fixed-expenses-page.test.tsx` (mock de `ResponsiveContainer` como em `recharts-smoke.test.tsx`)
- [ ] `apps/e2e/tests/financeiro-previsao.spec.ts` e `apps/e2e/playwright.audit.config.ts`
- [ ] Atualizar testes existentes que assumem home `/agenda` caso `FEATURES.dashboard` seja ligada
- Nenhum framework novo a instalar (axe-core opcional, dependente de aprovação).

## Sources

### Primary (HIGH confidence — leitura direta do repositório em 2026-11-05)
- `apps/backend/src/financial/{financial.service.ts, financial.resolver.ts, commission-resolver.ts}` e `src/graphql/schema/financial.graphql`
- `apps/backend/src/contracts/domain/contract-math.ts` (`allocateInstallments`, `computeContractStatus`), `contracts/alerts/alert-candidates.ts`
- `apps/backend/src/appointments/{appointment-status.ts, visits.ts}`; `src/common/money.ts`; `src/database/tenant-context.service.ts`; `src/authz/permissions.catalog.ts`
- `apps/backend/prisma/schema.prisma` (Appointment, Contract, ContractDepositInstallment, ContractPayment, CommissionRule, Service, ServicePricingVariant) e migrations `20261103000000_phase4_bridal_contracts`, `20261105000000_contract_layout_studio_js`
- `apps/frontend/src/{router.tsx, config/features.ts, features/operations/**, components/ui/*}`, `apps/frontend/codegen.ts`, `apps/e2e/{playwright.config.ts, support/*, tests/*}`, `.github/workflows/ci.yml`
- `.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- Memória do usuário: `sgs-staging-org.md`, `sgs-workflow-feedback.md`

### Secondary / Tertiary
- Nenhuma fonte externa consultada (domínio 100% interno; sem biblioteca nova). Não verifiquei versões no registro npm porque nada será instalado.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma adição; tudo lido no repo.
- Architecture: HIGH para backend/RLS/permissões/frontend; MEDIUM para a fonte do valor do agendamento (depende de os agendamentos futuros terem comanda; Open Question 6) e para o impacto de ligar a flag do painel (testes não executados).
- Pitfalls: HIGH (derivados do código); a lista de status `cancelled/no_show` precisa conferência no CHECK da migration da fase 3.
- Auditoria: MEDIUM — método sólido, mas credencial do Studio JS e eventual axe-core pendentes.

**Research date:** 2026-11-05
**Valid until:** 2026-12-05 (código do repositório muda rápido; revalidar se novas migrations/fases entrarem antes do planejamento)

---
phase: 03-core-operations
plan: 09
type: execute
wave: 3
depends_on: ["03-02", "03-05"]
files_modified:
  - apps/frontend/src/features/operations/api/financial.api.ts
  - apps/frontend/src/features/operations/components/PeriodFilter.tsx
  - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
  - apps/frontend/src/features/operations/pages/ComissoesCalculadasPage.tsx
  - apps/frontend/src/features/operations/pages/CreditoClientePage.tsx
  - apps/frontend/src/features/operations/pages/FinancialSubPages.tsx
  - apps/frontend/src/features/operations/mocks/financeiro.mock.ts
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/router.tsx
  - apps/frontend/src/components/layout/menu-config.ts
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/features/operations/__tests__/period-filter.test.tsx
  - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
  - apps/frontend/src/features/operations/__tests__/comissoes-page.test.tsx
  - apps/frontend/src/features/operations/__tests__/credito-cliente-page.test.tsx
autonomous: true
requirements: [FIN-01, FIN-02, POS-02]

must_haves:
  truths:
    - "Proprietário abre /financeiro e vê Faturado, Recebido, comandas fechadas, ticket médio e comissões do período, um gráfico por dia/semana/mês e o Recebido por método de pagamento (D-22)"
    - "O período padrão é Mês atual, com atalhos Hoje/Ontem/Esta semana/Mês anterior e Personalizado com datas dd/mm/aaaa (D-16)"
    - "/financeiro/comissoes mostra os totais e registros de comissão do período; PROFESSIONAL vê só os dele; itens sem regra aparecem com aviso e link para as regras (D-24)"
    - "/financeiro/credito-cliente lista clientes com saldo e permite incluir crédito (positivo ou negativo) com motivo, para quem tem credit.adjust"
    - "As flags financeiro, financeiroComissoes e a nova financeiroCreditoCliente ficam true no mesmo commit em que cada tela lê dado real; financeiroRelatorios continua false"
  artifacts:
    - path: "apps/frontend/src/features/operations/api/financial.api.ts"
      provides: "FinancialSummaryQuery, CashMovementsQuery, CommissionRecordsQuery, CommissionTotalsQuery, ClientCreditBalancesQuery, ClientCreditMovementsQuery, AdjustClientCreditMutation"
      contains: "financialSummary"
    - path: "apps/frontend/src/features/operations/components/PeriodFilter.tsx"
      provides: "chips de preset + Personalizado"
      exports: ["PeriodFilter"]
    - path: "apps/frontend/src/features/operations/pages/FinanceiroPage.tsx"
      provides: "dashboard real com Recharts"
    - path: "apps/frontend/src/features/operations/pages/CreditoClientePage.tsx"
      provides: "crédito de cliente real"
  key_links:
    - from: "FinanceiroPage"
      to: "financialSummary"
      via: "useQuery com resolvePeriod(preset)"
      pattern: "FinancialSummaryQuery"
    - from: "config/features.ts"
      to: "/financeiro/credito-cliente"
      via: "GATED_PATHS → financeiroCreditoCliente"
      pattern: "financeiroCreditoCliente"
---

<objective>
Trocar as telas financeiras mockadas por dados reais: dashboard `/financeiro` (FIN-01, D-16/D-22), comissões calculadas `/financeiro/comissoes` (FIN-02 leitura, D-20/D-24) e crédito de cliente `/financeiro/credito-cliente` (D-11), ligando as flags no mesmo commit e removendo o mock.

Purpose: critério de sucesso #4 do ROADMAP na UI.
Output: API manual (gql), filtro de período, 3 páginas reais, flags/rotas/menu ajustados, `financeiro.mock.ts` removido, 4 testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-02-SUMMARY.md
@.planning/phases/03-core-operations/03-05-SUMMARY.md
@.planning/phases/02-core-domain/02-UI-SPEC.md
@.planning/ROADMAP-MOCKS.md
@apps/frontend/src/config/features.ts
@apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
@apps/frontend/src/features/operations/pages/ComissoesCalculadasPage.tsx
@apps/frontend/src/features/operations/pages/FinancialSubPages.tsx
@apps/frontend/src/features/operations/components/FinancialReportLayout.tsx

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.
Regra do repo: uma flag em `features.ts` só vira `true` no MESMO commit em que a tela passa a ler dado real (e o mock/faixa "Mockup — Phase 3" sai no mesmo commit). Design system: `PageHeader` + breadcrumbs, `#570080`, `Button` do shadcn; entradas de valor com `maskCurrency`/`unmaskCurrency`; datas com `maskDateBR`/`brDateToIso`.

**Arquivos que este plano NÃO toca** (plano paralelo 03-08): `SchedulePage.tsx`, `api/appointments.api.ts`, `components/calendar/**`.

<interfaces>
Backend (03-05):
```graphql
financialSummary(from: String!, to: String!, granularity: String!): FinancialSummary!   # day|week|month; to exclusivo
type FinancialSummary { from to timezone granularity billedTotal receivedTotal closedComandas: Int! averageTicket commissionsTotal buckets: [FinancialBucket!]! receivedByMethod: [MethodTotal!]! }
type FinancialBucket { bucketStart billed received closedComandas: Int! }
type MethodTotal { method total }
cashMovements(from, to): [CashMovementEntry!]!  # { id kind method amount occurredAt comandaId comandaCode appointmentId clientName note }
commissionRecords(from, to, memberId): [CommissionRecordEntry!]!  # { id comandaId comandaCode comandaItemId memberId memberName kind cycle itemName baseAmount chargedAmount ruleKind ruleValue noRule calculatedAmount reversed ruleSnapshot calculatedAt }
commissionTotals(from, to, memberId): [CommissionMemberTotal!]!  # { memberId memberName total records noRuleCount }
clientCreditBalances: [ClientCreditBalance!]!  # { clientId clientName balance }
clientCreditMovements(clientId): [ClientCreditMovementEntry!]!  # { id kind amount reason appointmentId comandaId createdAt }
adjustClientCredit(input: { clientId, amount (pode ser "-10.00"), reason }): ClientCreditPayload!  # { balance errors[] } ; códigos INVALID_AMOUNT, REASON_REQUIRED, CREDIT_NEGATIVE
```
Permissões no auth store (`useAuthStore((s) => s.permissions)`): `financial.read`, `commissionRecord.read`, `credit.read`, `credit.adjust`.
Frontend (03-02): `PERIOD_PRESETS`, `DEFAULT_PRESET`, `resolvePeriod(preset, tz?)`, `customPeriod(from, to)`, `ORG_TIMEZONE_DEFAULT` (lib/period.ts); `maskDateBR`, `brDateToIso`, `isoToBrDate` (lib/input-masks.ts); `paymentMethodLabel(v)` (lib/operations-labels.ts); `formatCurrencyDisplay`, `maskCurrency`, `unmaskCurrency` (features/catalog/utils/currency-mask.ts). Recharts 2.15 com react-is 19 (smoke test em 03-02).
Existentes: `ClientsListQuery` (features/clients/api/clients.api.ts), `MembersQuery` (features/catalog/api/members.api.ts), `FinancialReportLayout`, `ReportEmptyState`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: financial.api.ts + PeriodFilter + FinanceiroPage real (flag financeiro)</name>
  <files>apps/frontend/src/features/operations/api/financial.api.ts, apps/frontend/src/features/operations/components/PeriodFilter.tsx, apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/config/features.ts, apps/frontend/src/features/operations/__tests__/period-filter.test.tsx, apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/features/operations/api/appointments.api.ts (padrão gql manual + interfaces à mão)
    - apps/frontend/src/features/operations/lib/period.ts, lib/input-masks.ts, lib/operations-labels.ts
  </read_first>
  <action>
**financial.api.ts**: queries/mutation do `<interfaces>` com interfaces TS à mão (`FinancialSummaryResult`, `CashMovementsResult`, `CommissionRecordsResult`, `CommissionTotalsResult`, `ClientCreditBalancesResult`, `ClientCreditMovementsResult`, `AdjustClientCreditResult`). Sem codegen (padrão do repo).

**PeriodFilter.tsx**:
```ts
export interface PeriodValue { preset: PeriodPreset | 'custom'; from: string; to: string } // to exclusivo
export function PeriodFilter({ value, onChange, timeZone = ORG_TIMEZONE_DEFAULT }: { value: PeriodValue; onChange: (v: PeriodValue) => void; timeZone?: string }): JSX.Element;
export function defaultPeriod(tz?: string): PeriodValue; // resolvePeriod(DEFAULT_PRESET)
```
Chips (`Button size="sm"`, `variant` default quando ativo / outline) para os 5 `PERIOD_PRESETS` + "Personalizado"; "Personalizado" mostra 2 `Input` com `maskDateBR` (placeholder `dd/mm/aaaa`, `inputMode="numeric"`) e botão "Aplicar" que chama `onChange({ preset:'custom', ...customPeriod(brDateToIso(a), brDateToIso(b)) })` — desabilitado se alguma data for inválida. Grupo com `role="group" aria-label="Período"`, chips com `aria-pressed`.

**FinanceiroPage.tsx** — reescrever mantendo `PageHeader` (título "Financeiro", breadcrumbs `[{label:'Financeiro'},{label:'Visão geral'}]`):
- Sem `financial.read` em `useAuthStore(s => s.permissions)` → card "Você não tem acesso ao financeiro." (sem query).
- `PeriodFilter` (padrão Mês atual) + toggle de agrupamento "Dia/Semana/Mês" (`granularity`, padrão `day`; se o intervalo tiver > 62 dias e estiver em `day`, trocar para `week` automaticamente).
- `useQuery(FinancialSummaryQuery, { variables: { from, to, granularity } })`; `Skeleton` no loading; erro → `Alert` "Não foi possível carregar o financeiro."
- 5 cards KPI: "Faturado" (`billedTotal`, legenda "comandas fechadas no período"), "Recebido" (`receivedTotal`, legenda "entradas de caixa no período, incluindo sinais"), "Comandas fechadas", "Ticket médio", "Comissões". Valores com `formatCurrencyDisplay` (prefixar "R$ " se a função não prefixar — conferir no arquivo).
- Gráfico Recharts: `<ResponsiveContainer width="100%" height={280}><BarChart data={buckets}>` com `XAxis dataKey="bucketStart"` formatado `dd/mm` (dia/semana) ou `mm/aaaa` (mês), `YAxis`, `Tooltip` em BRL, `Legend`, duas `Bar` (`billed` "Faturado" cor primária `#570080`; `received` "Recebido" `#1D9E75`), `isAnimationActive={false}`; dados convertidos para número só para o gráfico (`Number(v)`).
- Tabela "Recebido por forma de pagamento": linhas `paymentMethodLabel(method)` + valor + % do total recebido; vazio → "Nenhum recebimento no período."
- Lista "Lançamentos" (`CashMovementsQuery`, mesmo período): data/hora, tipo (`deposit_in` "Sinal", `payment_in` "Pagamento", `change_out` "Troco", `reversal` "Estorno"), forma, cliente, comanda (código), valor (negativos em `text-error-600`).
- Remover os botões "Lançar receita"/"Lançar despesa" e os R$ 0,00 fixos (despesas não estão nesta fase).
- **Contrato de seletores (03-12):** chips `period-preset-${value}` (`today`, `yesterday`, `thisWeek`, `thisMonth`, `lastMonth`) e `period-preset-custom`; `granularity-day|week|month`; KPIs `kpi-billed`, `kpi-received`, `kpi-closed-comandas`, `kpi-average-ticket`, `kpi-commissions` (texto = valor formatado); tabela `received-by-method` com linhas `received-method-${method}`; gráfico dentro de `financial-chart`.
- `features.ts`: `financeiro: true` e atualizar o comentário ("Dashboard financeiro — financialSummary real").

**Testes**: `period-filter.test.tsx` (clicar "Hoje" chama onChange com preset 'today'; "Personalizado" com "31/02/2026" deixa "Aplicar" desabilitado; datas válidas emitem `to` = dia seguinte). `financeiro-page.test.tsx` com `MockedProvider` + auth store com `financial.read`: renderiza "Faturado" "R$ 285,00" e "Recebido" "R$ 285,00" a partir de um mock de `financialSummary`, a tabela com "Pix"; sem a permissão mostra "Você não tem acesso ao financeiro." e não dispara query.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- period-filter financeiro-page && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - financial.api.ts contém `financialSummary(from: $from, to: $to, granularity: $granularity)` e `adjustClientCredit`
    - FinanceiroPage.tsx contém `FinancialSummaryQuery`, `BarChart`, `Faturado`, `Recebido`, `receivedByMethod` e não contém `Lançar despesa` nem `R$ 0,00`
    - features.ts contém `financeiro: true`
    - FinanceiroPage.tsx contém `kpi-billed`, `kpi-received`, `received-by-method`, `received-method-`, `financial-chart`; PeriodFilter.tsx contém `` `period-preset-${`` 
    - os 2 testes passam
  </acceptance_criteria>
  <done>/financeiro mostra Faturado × Recebido por período e método com dado real; flag ligada no mesmo commit.</done>
</task>

<task type="auto">
  <name>Task 2: ComissoesCalculadasPage real (flag financeiroComissoes, aviso D-24) + remoção do mock + item de menu</name>
  <files>apps/frontend/src/features/operations/pages/ComissoesCalculadasPage.tsx, apps/frontend/src/features/operations/mocks/financeiro.mock.ts, apps/frontend/src/config/features.ts, apps/frontend/src/components/layout/menu-config.ts, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json, apps/frontend/src/features/operations/__tests__/comissoes-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/ComissoesCalculadasPage.tsx (layout validado, chaves i18n operations.commissions.*)
    - apps/frontend/src/features/operations/mocks/financeiro.mock.ts
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (bloco "commissions" ~linha 389)
    - apps/frontend/src/components/layout/menu-config.ts (grupo financeiro)
  </read_first>
  <action>
**ComissoesCalculadasPage.tsx** — manter o layout/visual atual e as chaves i18n existentes (estender `operations.commissions.*` em `pt-BR.json` só com o que faltar: `noRuleWarning`, `noRuleBadge`, `reversed`, `base`, `charged`, `empty`); remover a faixa "Mockup — Phase 3 (em breve)" e o import de `../mocks/financeiro.mock`:
- `PeriodFilter` (padrão Mês atual) + select de profissional (`MembersQuery` filtrado `isProfessional`) com opção "Todos" — escondido para PROFESSIONAL (`roleName === 'PROFESSIONAL'`; o backend força o filtro de qualquer forma).
- `CommissionTotalsQuery` → cards/linhas por profissional (nome, total, nº de itens); `noRuleCount > 0` → `Badge` "Sem regra: N".
- Ao selecionar um profissional (ou para PROFESSIONAL, direto) → `CommissionRecordsQuery` em tabela: data (`calculatedAt`), comanda (`comandaCode`, link `/comanda/${comandaId}` só se `isPathEnabled('/comanda')`), item (`itemName`), base (`baseAmount` — "preço cheio"), cobrado (`chargedAmount`), regra (`ruleKind === 'percentage' ? \`${ruleValue}%\` : \`R$ ${ruleValue}\`` ou "—"), comissão (`calculatedAmount`); `kind === 'reversal'` em itálico com rótulo "Estorno"; `reversed` → `Badge` "Estornada"; `noRule` → `Badge variant` de alerta "Sem regra".
- Banner D-24 quando algum `noRuleCount > 0` e o usuário tem `commission.write` ou é MANAGER/ADMIN: `Alert` "Há itens sem regra de comissão no período. Eles foram registrados com R$ 0,00." + link "Revisar regras de comissão" → `/catalogo/comissoes`.
- Valores via `formatCurrencyDisplay`; totais sempre do backend (não somar no cliente).
Apagar `mocks/financeiro.mock.ts` (conferir `grep -rn "financeiro.mock" apps/frontend/src` vazio). `features.ts`: `financeiroComissoes: true` com comentário atualizado. `menu-config.ts`: no grupo `financeiro`, adicionar após `fin-pagamento-prof` o item `{ id: 'fin-comissoes', label: 'Comissões calculadas', to: '/financeiro/comissoes', icon: BadgeDollarSign, searchTerms: ['comissão', 'comissões calculadas', 'profissional'] }`.

**comissoes-page.test.tsx**: MockedProvider com totais (proA 40.00, proB 5.00 com `noRuleCount 1`) → mostra "Sem regra: 1" e o banner com link para `/catalogo/comissoes`; como PROFESSIONAL, o select de profissional não aparece.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- comissoes-page && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - ComissoesCalculadasPage.tsx contém `CommissionTotalsQuery`, `CommissionRecordsQuery`, `/catalogo/comissoes` e não contém `Mockup` nem `financeiro.mock`
    - `test -f apps/frontend/src/features/operations/mocks/financeiro.mock.ts` falha
    - features.ts contém `financeiroComissoes: true` e `financeiroRelatorios: false`
    - menu-config.ts contém `to: '/financeiro/comissoes'`
    - comissoes-page.test.tsx passa
  </acceptance_criteria>
  <done>Comissões reais por profissional, com aviso de itens sem regra e escopo do PROFESSIONAL.</done>
</task>

<task type="auto">
  <name>Task 3: CreditoClientePage real com flag própria + ajuste manual</name>
  <files>apps/frontend/src/features/operations/pages/CreditoClientePage.tsx, apps/frontend/src/features/operations/pages/FinancialSubPages.tsx, apps/frontend/src/config/features.ts, apps/frontend/src/router.tsx, apps/frontend/src/features/operations/__tests__/credito-cliente-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinancialSubPages.tsx (CreditoClientePage atual, linhas ~524–595)
    - apps/frontend/src/router.tsx (imports de FinancialSubPages e rota /financeiro/credito-cliente)
    - apps/frontend/src/config/features.ts (GATED_PATHS: '/financeiro/credito-cliente' → 'financeiroRelatorios')
    - apps/frontend/src/features/clients/api/clients.api.ts (ClientsListQuery)
  </read_first>
  <action>
- Mover `CreditoClientePage` de `FinancialSubPages.tsx` para `pages/CreditoClientePage.tsx` (remover a versão antiga do arquivo de sub-páginas) e ajustar o import em `router.tsx`.
- Nova página, mantendo `FinancialReportLayout title="Crédito de cliente"` e o visual da tabela atual (`thead bg-primary-700`):
  - Sem `credit.read` → "Você não tem acesso ao crédito de clientes."
  - `ClientCreditBalancesQuery` → linhas: cliente, saldo (`formatCurrencyDisplay`), botão "Histórico" que abre `Sheet` com `ClientCreditMovementsQuery` (data, tipo: deposit "Sinal", consumption "Uso em comanda", reopen_refund "Estorno de comanda", manual_adjustment "Ajuste manual"; valor; motivo; comanda).
  - Vazio → "Não existem clientes com saldo de crédito" (texto atual).
  - Botão "Incluir Crédito" (só com `credit.adjust`) → `Dialog`: cliente (busca em `ClientsListQuery`), tipo `RadioGroup` "Adicionar"/"Remover", valor com `maskCurrency` (envia `unmaskCurrency`, negativo quando "Remover"), motivo `Textarea` obrigatório (≥ 3 caracteres; botão desabilitado antes disso); `AdjustClientCreditMutation`; erros do payload (`CREDIT_NEGATIVE`, `REASON_REQUIRED`, `INVALID_AMOUNT`) em `toast.error(message)`; sucesso → `toast.success('Crédito atualizado.')` + `refetchQueries` das balances.
  - Remover o filtro decorativo de datas/radios que não consulta nada.
- `features.ts`: adicionar `financeiroCreditoCliente: true` (comentário "Crédito de cliente — client_credit_movements real") e trocar a entrada `['/financeiro/credito-cliente', 'financeiroRelatorios']` por `['/financeiro/credito-cliente', 'financeiroCreditoCliente']`. `financeiroRelatorios` continua `false` (as outras 9 sub-páginas seguem mock).
- **credito-cliente-page.test.tsx**: lista 1 cliente com saldo "R$ 50,00"; usuário sem `credit.adjust` não vê "Incluir Crédito"; no diálogo, motivo "ab" mantém o botão "Salvar" desabilitado; "Remover" + "10,00" envia `amount: "-10.00"`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - CreditoClientePage.tsx contém `ClientCreditBalancesQuery`, `AdjustClientCreditMutation`, `Incluir Crédito`
    - `grep -n "export function CreditoClientePage" apps/frontend/src/features/operations/pages/FinancialSubPages.tsx` vazio
    - features.ts contém `financeiroCreditoCliente: true` e `['/financeiro/credito-cliente', 'financeiroCreditoCliente']`
    - router.tsx importa `CreditoClientePage` de `@/features/operations/pages/CreditoClientePage`
    - credito-cliente-page.test.tsx passa; suíte vitest completa verde
  </acceptance_criteria>
  <done>Crédito de cliente real e ajustável, com flag própria; demais sub-páginas financeiras continuam desligadas.</done>
</task>

</tasks>

<verification>
Gate completo verde. `grep -rn "financeiro.mock" apps/frontend/src` vazio.
</verification>

<success_criteria>
- FIN-01 visível na UI (Faturado/Recebido, dia/semana/mês, por método)
- FIN-02 consultável (comissões por profissional com snapshot e aviso D-24)
- Flags ligadas apenas junto com dado real
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-09-SUMMARY.md`
</output>

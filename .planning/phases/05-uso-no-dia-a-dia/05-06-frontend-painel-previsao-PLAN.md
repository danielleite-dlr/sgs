---
phase: 05-uso-no-dia-a-dia
plan: 06
type: execute
wave: 2
depends_on: ["05-05"]
files_modified:
  - apps/frontend/src/features/operations/components/ForecastCard.tsx
  - apps/frontend/src/features/operations/__tests__/forecast-card.test.tsx
  - apps/frontend/src/features/operations/pages/PrevisaoPage.tsx
  - apps/frontend/src/features/operations/__tests__/previsao-page.test.tsx
  - apps/frontend/src/pages/DashboardPage.tsx
  - apps/frontend/src/pages/HomeRoute.tsx
  - apps/frontend/src/pages/__tests__/home-route.test.tsx
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/config/__tests__/features.test.ts
  - apps/frontend/src/router.tsx
  - apps/frontend/src/components/layout/menu-config.ts
  - apps/e2e/tests/smoke.spec.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "ADMIN e MANAGER, ao entrar, caem no painel inicial (/dashboard); PROFESSIONAL e ATTENDANT continuam caindo na Agenda (D-11)"
    - "O painel mostra o cartão 'Previsão dos próximos 30 dias' com Entradas previstas, Saídas previstas e Saldo previsto, e um gráfico de barras por semana (D-07, D-08)"
    - "O cartão avisa quanto das entradas está em atraso (D-09) e trata carregando, vazio e erro"
    - "Clicar no cartão abre /financeiro/previsao com a lista por semana e a origem de cada valor (agendamento, parcela/restante de contrato, comissão, despesa fixa) (D-07)"
    - "Comissões sem profissional definido aparecem marcadas 'estimada — sem profissional definido' e sem regra aparecem como 'sem regra de comissão' (D-10)"
    - "Testes vitest e E2E que assumiam home /agenda foram ajustados e passam"
  artifacts:
    - path: "apps/frontend/src/features/operations/components/ForecastCard.tsx"
      exports: ["ForecastCard"]
    - path: "apps/frontend/src/features/operations/pages/PrevisaoPage.tsx"
      exports: ["PrevisaoPage"]
    - path: "apps/frontend/src/pages/HomeRoute.tsx"
      exports: ["HomeRoute"]
    - path: "apps/frontend/src/config/features.ts"
      contains: "homePathForRole"
  key_links:
    - from: "apps/frontend/src/features/operations/components/ForecastCard.tsx"
      to: "CashForecastQuery"
      via: "useQuery com forecastWindow()"
      pattern: "CashForecastQuery"
    - from: "apps/frontend/src/features/operations/components/ForecastCard.tsx"
      to: "/financeiro/previsao"
      via: "Link"
      pattern: "/financeiro/previsao"
    - from: "apps/frontend/src/router.tsx"
      to: "HomeRoute"
      via: "rota /dashboard"
      pattern: "<HomeRoute />"
---

<objective>
Painel inicial real com o cartão da previsão de 30 dias, a tela de detalhe `/financeiro/previsao`, e a troca da home por papel (FIN-03; D-07, D-08, D-09, D-10, D-11; critério de sucesso 2).

Purpose: a dona abre o sistema e vê de cara quanto deve entrar e sair no mês.
Output: `ForecastCard`, `PrevisaoPage`, `DashboardPage` real, `HomeRoute`, flag `dashboard` ligada com home por papel, testes ajustados.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-RESEARCH.md
@.planning/phases/05-uso-no-dia-a-dia/05-05-SUMMARY.md

<interfaces>
De 05-05 (`apps/frontend/src/features/operations/api/forecast.api.ts`): `CashForecastQuery`, tipos `CashForecast`, `CashForecastResult`, `ForecastItem`, `ForecastBucket`, `ForecastKind`, `FORECAST_KIND_LABELS`, `forecastWindow(tz?, now?)`, `weekLabel(start, endExclusive)`.
`apps/frontend/src/config/features.ts` hoje: `dashboard: false`; `export const HOME_PATH: string = FEATURES.dashboard ? '/dashboard' : '/agenda';` usado em `router.tsx` (rotas `/` e fallback `/dashboard`) e `TopHeader.tsx` (logo). `BottomNav.tsx` mostra "Início" quando `FEATURES.dashboard`.
`router.tsx`: `{ path: '/dashboard', element: <DashboardPlaceholder /> }` em `PROTECTED_ROUTES`; bloco `if (!FEATURES.dashboard) { enabledRoutes.push({ path: '/dashboard', element: <Navigate to={HOME_PATH} replace /> }) }`; rota `/` → `<Navigate to={HOME_PATH} replace />`. Login, troca de senha e aceite de convite navegam para `/dashboard`.
Auth store: `useAuthStore((s) => s.roleName)` em `@/infrastructure/stores/auth.store` (persistido).
Recharts em `FinanceiroPage.tsx`: `<Bar dataKey="received" name="Recebido" fill="#1D9E75" isAnimationActive={false} />`; mock de `ResponsiveContainer` em `features/operations/__tests__/recharts-smoke.test.tsx`.
`apps/frontend/src/pages/DashboardPage.tsx` hoje é um placeholder de 8 linhas ("Painel — Em construção").
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ForecastCard (painel) + DashboardPage</name>
  <files>apps/frontend/src/features/operations/components/ForecastCard.tsx, apps/frontend/src/features/operations/__tests__/forecast-card.test.tsx, apps/frontend/src/pages/DashboardPage.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx (BarChart, Tooltip BRL, cores, Skeleton, Alert)
    - apps/frontend/src/features/operations/__tests__/recharts-smoke.test.tsx (mock de ResponsiveContainer)
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx (MockedProvider)
    - apps/frontend/src/features/operations/api/forecast.api.ts
    - apps/frontend/src/pages/DashboardPage.tsx
    - apps/frontend/src/components/ui/card.tsx
  </read_first>
  <action>
1. `ForecastCard.tsx` (`export function ForecastCard()`): `const canRead = useHasPermission('financial.read')`; sem permissão retorna `null`. `useQuery<CashForecastResult>(CashForecastQuery, { variables: forecastWindow(), fetchPolicy: 'cache-and-network' })`. Usa `Card`. Textos EXATOS:
   - Título `Previsão dos próximos 30 dias`; subtítulo com o período `dd/MM a dd/MM` (de `from` até `to − 1`).
   - Três valores com rótulo visível: `Entradas previstas` (verde `#1D9E75`), `Saídas previstas` (vermelho `#B42318`), `Saldo previsto` (cor neutra; se negativo, texto `#B42318` e prefixo `−`). Valores via `formatCurrencyDisplay`.
   - Se `overdueInflowTotal !== '0.00'`: `Badge` `Inclui {valor} em atraso`.
   - Gráfico: `ResponsiveContainer` altura 180 + `BarChart` com `data = buckets.map(b => ({ label: weekLabel(b.start, b.end), inflow: Number(b.inflow), outflow: Number(b.outflow) }))`, `<Bar dataKey="inflow" name="Entradas" fill="#1D9E75" isAnimationActive={false} />`, `<Bar dataKey="outflow" name="Saídas" fill="#B42318" isAnimationActive={false} />`, `Legend`, `Tooltip` formatando BRL, `XAxis dataKey="label"`. Envolver o gráfico em `<figure aria-label="Entradas e saídas previstas por semana">` e incluir uma tabela `sr-only` com as mesmas semanas (não depender só de cor — WCAG).
   - Link: o bloco de totais é um `<Link to="/financeiro/previsao" aria-label="Ver detalhe da previsão de 30 dias">` e há um link visível `Ver detalhe` para a mesma rota.
   - Carregando (sem dados): `Skeleton`s. Erro: `Alert` `Não foi possível carregar a previsão.` + botão `Tentar novamente` (`refetch`). Vazio (`items.length === 0`): `Nenhum valor previsto nos próximos 30 dias.` e link `Cadastrar despesas fixas` → `/financeiro/despesas-fixas`.
2. `DashboardPage.tsx`: substituir o placeholder por `export default function DashboardPage()` com `PageHeader` título `Início` e `<ForecastCard />` numa grade responsiva (`grid gap-4 lg:grid-cols-2`). Nada além do cartão (D-08: o resto só com aprovação da auditoria).
3. `forecast-card.test.tsx` (mock de `ResponsiveContainer` igual ao recharts-smoke): (a) dados com `inflowTotal '1500.00'`, `outflowTotal '400.00'`, `balance '1100.00'` → mostra `R$ 1.500,00`, `R$ 400,00`, `R$ 1.100,00` e os rótulos; (b) `overdueInflowTotal '500.00'` → `Inclui R$ 500,00 em atraso`; (c) items vazios → `Nenhum valor previsto nos próximos 30 dias.`; (d) erro → `Não foi possível carregar a previsão.`; (e) link `Ver detalhe` com `href` `/financeiro/previsao`; (f) `roleName 'PROFESSIONAL'` → cartão não renderiza; (g) a query é chamada com `from` = hoje em America/Sao_Paulo (usar `vi.setSystemTime(new Date('2026-11-06T01:30:00Z'))` → `from: '2026-11-05'`, `to: '2026-12-05'`).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- forecast-card && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `ForecastCard.tsx` contém `Previsão dos próximos 30 dias`, `Entradas previstas`, `Saídas previstas`, `Saldo previsto`, `em atraso`, `Nenhum valor previsto nos próximos 30 dias.`, `to="/financeiro/previsao"`, `fill="#1D9E75"`, `fill="#B42318"` e `forecastWindow()`
    - `DashboardPage.tsx` contém `<ForecastCard />` e não contém `Em construção`
    - `forecast-card.test.tsx` passa com os 7 casos
  </acceptance_criteria>
  <done>Cartão de previsão pronto e testado; painel deixa de ser placeholder.</done>
</task>

<task type="auto">
  <name>Task 2: PrevisaoPage (/financeiro/previsao) + item de menu</name>
  <files>apps/frontend/src/features/operations/pages/PrevisaoPage.tsx, apps/frontend/src/features/operations/__tests__/previsao-page.test.tsx, apps/frontend/src/router.tsx, apps/frontend/src/components/layout/menu-config.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx (05-05)
    - apps/frontend/src/features/operations/api/forecast.api.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/menu-config.ts
  </read_first>
  <action>
1. `PrevisaoPage.tsx` (`export function PrevisaoPage()`): gate `financial.read` com a mesma mensagem de falta de permissão de `FinanceiroPage.tsx`. `useQuery(CashForecastQuery, { variables: forecastWindow() })`. Textos EXATOS:
   - `PageHeader` título `Previsão financeira — próximos 30 dias`, descrição `Agendamentos confirmados e parcelas de contratos a receber, menos comissões estimadas e despesas fixas.`
   - Linha de totais: `Entradas previstas`, `Saídas previstas`, `Saldo previsto` (mesmas cores do cartão) e, se houver, `Inclui {valor} em atraso`.
   - Uma seção por bucket: título `Semana {n} · {weekLabel(start, end)}`, subtotal `Entradas {inflow} · Saídas {outflow} · Saldo {balance}`, e `Table` com colunas `Data` (`dd/MM`), `Origem` (`Badge` com `FORECAST_KIND_LABELS[kind]`), `Descrição` (`label`), `Valor` (entrada com `+`, saída com `−`, BRL). Na descrição, badges extras: `em atraso` (overdue), `estimada — sem profissional definido` (withoutProfessional), `sem regra de comissão` (noRule). Semana sem itens: `Nada previsto nesta semana.`
   - Rodapé: se `noRuleCount > 0`: `{n} comissão(ões) sem regra cadastrada foram contadas como R$ 0,00. Cadastre as regras em Catálogo → Comissões.`; link `Cadastrar despesas fixas` → `/financeiro/despesas-fixas`; nota `As comissões são estimadas pela regra de cada profissional; atendimentos de contrato ainda sem profissional usam a regra padrão do salão ou, sem ela, a maior regra do serviço.`
   - Carregando/erro como no cartão (`Não foi possível carregar a previsão.` + `Tentar novamente`).
2. `router.tsx`: `{ path: '/financeiro/previsao', element: <PrevisaoPage /> }` logo após `/financeiro/despesas-fixas`.
3. `menu-config.ts`: no grupo `financeiro`, logo após `fin-controle` e antes de `fin-despesas-fixas`, `{ id: 'fin-previsao', label: 'Previsão de 30 dias', to: '/financeiro/previsao', searchTerms: ['previsão', 'fluxo de caixa', 'próximos 30 dias', 'saldo previsto'] }`.
4. `previsao-page.test.tsx`: dados com 2 semanas e itens de todos os 5 tipos → aparecem `Agendamento`, `Parcela de contrato`, `Restante de contrato`, `Comissão`, `Despesa fixa`; item overdue mostra `em atraso`; item withoutProfessional mostra `estimada — sem profissional definido`; `noRuleCount 2` mostra o aviso; semana vazia mostra `Nada previsto nesta semana.`; ATTENDANT vê a mensagem de falta de permissão.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- previsao-page features && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `router.tsx` contém `path: '/financeiro/previsao'` e `<PrevisaoPage />`
    - `menu-config.ts` contém `id: 'fin-previsao'` e `label: 'Previsão de 30 dias'`
    - `PrevisaoPage.tsx` contém `Previsão financeira — próximos 30 dias`, `estimada — sem profissional definido`, `sem regra de comissão`, `em atraso`, `Nada previsto nesta semana.` e `FORECAST_KIND_LABELS`
    - `previsao-page.test.tsx` e `features.test.ts` passam
  </acceptance_criteria>
  <done>Detalhe da previsão por semana com a origem de cada valor, acessível pelo cartão e pelo menu.</done>
</task>

<task type="auto">
  <name>Task 3: Painel vira home de ADMIN/MANAGER; PROFESSIONAL/ATTENDANT na Agenda (D-11) + testes ajustados</name>
  <files>apps/frontend/src/config/features.ts, apps/frontend/src/config/__tests__/features.test.ts, apps/frontend/src/pages/HomeRoute.tsx, apps/frontend/src/pages/__tests__/home-route.test.tsx, apps/frontend/src/router.tsx, apps/e2e/tests/smoke.spec.ts</files>
  <read_first>
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/layout/BottomNav.tsx e TopHeader.tsx (efeito da flag)
    - apps/frontend/src/features/auth/pages/LoginPage.tsx, ChangePasswordPage.tsx, InvitationPage.tsx (navegam para /dashboard)
    - apps/e2e/tests/smoke.spec.ts e apps/e2e/tests/equipe-acoes-por-papel.spec.ts
    - apps/e2e/support/seed-state.ts (owner = ADMIN; attendant; proEditable)
  </read_first>
  <action>
1. `features.ts`: `dashboard: true` com comentário `/** Painel inicial com a previsão de 30 dias (05-06). Home de ADMIN/MANAGER (D-11). */`. Manter `HOME_PATH` (passa a valer `/dashboard`). Acrescentar:
```typescript
/** D-11: quem cai no painel ao entrar. Os demais papéis vão para a Agenda. */
export const DASHBOARD_HOME_ROLES: readonly string[] = ['ADMIN', 'MANAGER'];

export function homePathForRole(roleName: string | null | undefined): string {
  if (!FEATURES.dashboard) return '/agenda';
  return roleName != null && DASHBOARD_HOME_ROLES.includes(roleName) ? '/dashboard' : '/agenda';
}
```
2. `pages/HomeRoute.tsx`: `export function HomeRoute()` — `const roleName = useAuthStore((s) => s.roleName)`; se `homePathForRole(roleName) === '/dashboard'` renderiza `<DashboardPage />`, senão `<Navigate to="/agenda" replace />`.
3. `router.tsx`: trocar `{ path: '/dashboard', element: <DashboardPlaceholder /> }` por `{ path: '/dashboard', element: <HomeRoute /> }` e remover o import de `DashboardPlaceholder` (o arquivo fica no repositório, sem uso). Manter o bloco `if (!FEATURES.dashboard)` como está (fica inativo). A rota `/` continua `<Navigate to={HOME_PATH} replace />` (= `/dashboard`, que decide por papel). Assim login/troca de senha/convite (que vão para `/dashboard`) e o logo do header seguem funcionando sem mudança.
4. `features.test.ts`: retirar `'/dashboard'` da lista de "bloqueia os mockups" e incluí-lo em "libera o que está pronto" junto com `'/financeiro/previsao'` e `'/financeiro/despesas-fixas'`; trocar o teste `manda a home para a agenda enquanto o dashboard é mockup` por `painel é a home de ADMIN/MANAGER; demais papéis vão para a agenda (D-11)` verificando `FEATURES.dashboard === true`, `HOME_PATH === '/dashboard'`, `homePathForRole('ADMIN') === '/dashboard'`, `homePathForRole('MANAGER') === '/dashboard'`, `homePathForRole('PROFESSIONAL') === '/agenda'`, `homePathForRole('ATTENDANT') === '/agenda'`, `homePathForRole(null) === '/agenda'`. Acrescentar `expect(isPathEnabled('/financeiro/despesas')).toBe(false)` (mock continua desligado).
5. `pages/__tests__/home-route.test.tsx`: `MemoryRouter initialEntries={['/dashboard']}` com rotas `/dashboard` → `<HomeRoute />` e `/agenda` → `<div>AGENDA</div>`; ADMIN renderiza o título `Início` (mockar `ForecastCard` com `vi.mock`); PROFESSIONAL e ATTENDANT renderizam `AGENDA`.
6. `apps/e2e/tests/smoke.spec.ts`: renomear para `owner entra pela UI e cai no painel, sem trocar senha`, esperar `await expect(page).toHaveURL(/\/dashboard/)` e `await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()`; acrescentar um segundo teste `atendente entra e cai na agenda (D-11)` com `seed.attendant` esperando `/\/agenda/`. Rodar a suíte vitest inteira e a E2E inteira; ajustar qualquer outro teste que dependa de a home ser `/agenda` (procurar com `grep -rn "toHaveURL(/\\\\/agenda" apps/e2e/tests` e `grep -rn "Em construção\|DashboardPlaceholder" apps/frontend/src --include=*.test.tsx`).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test && pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/e2e test:e2e smoke equipe</automated>
  </verify>
  <acceptance_criteria>
    - `features.ts` contém `dashboard: true`, `export function homePathForRole` e `DASHBOARD_HOME_ROLES: readonly string[] = ['ADMIN', 'MANAGER']`; `financeiroRelatorios: false` intacto
    - `router.tsx` contém `element: <HomeRoute />` e não contém `<DashboardPlaceholder />`
    - `features.test.ts` contém `homePathForRole('PROFESSIONAL')` e não contém `expect(HOME_PATH).toBe('/agenda')`
    - `smoke.spec.ts` contém `toHaveURL(/\/dashboard/)` e `seed.attendant`
    - `pnpm --filter @sgs/frontend test` inteiro passa; `corepack pnpm --filter @sgs/e2e test:e2e smoke equipe` passa
  </acceptance_criteria>
  <done>ADMIN/MANAGER entram no painel com a previsão; PROFESSIONAL/ATTENDANT entram na Agenda; nenhum teste depende da home antiga.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/frontend test && pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend lint`
- `corepack pnpm --filter @sgs/e2e test:e2e` (suíte inteira)
</verification>

<success_criteria>
Critério de sucesso 2: a dona abre o painel inicial e vê entradas, saídas e saldo dos próximos 30 dias, com gráfico por semana, e clica para o detalhe no Financeiro.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-06-SUMMARY.md`
</output>

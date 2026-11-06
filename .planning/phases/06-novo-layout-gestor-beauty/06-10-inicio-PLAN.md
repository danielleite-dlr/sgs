---
phase: 06-novo-layout-gestor-beauty
plan: 10
type: execute
wave: 10
depends_on: ["06-09"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-celular.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-celular.png
  - apps/frontend/src/components/layout/PageHeader.tsx
  - apps/frontend/src/pages/DashboardPage.tsx
  - apps/frontend/src/features/operations/components/ForecastCard.tsx
  - apps/frontend/src/features/operations/__tests__/inicio-gestor-beauty.test.tsx
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "O Início tem cabeçalho com rótulo 'PAINEL DO DIA', h1 'Início' em serifa e a data por extenso abaixo (D-07)"
    - "A previsão de 30 dias ocupa a largura toda: Saldo previsto é o número de destaque em serifa (28 px no celular, 36 px no computador), Entradas e Saídas ao lado em números tabulares verde/vermelho, sem cartões gigantes (06-UI-SPEC §2 display, §6)"
    - "O gráfico semanal usa as cores do tema (entrada #1B7A43, saída #BA1A1A, grade #E2DFE5) e o tooltip sem sombra (D-09, D-12)"
    - "Não aparecem meta de faturamento, atendimentos do dia, comandas em aberto, contratos críticos, ocupação de bancadas, ações rápidas, comparação com a semana anterior, 'Exportar DRE', relógio, unidade ou 'Sincronizado' (D-02; resumo do dia é o UX-20 do backlog 999.6)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/inicio-gestor-beauty.test.tsx"
      provides: "Regressão visual do Início"
    - path: "apps/frontend/src/components/layout/PageHeader.tsx"
      provides: "props opcionais eyebrow e description"
      contains: "description"
  key_links:
    - from: "apps/frontend/src/pages/DashboardPage.tsx"
      to: "apps/frontend/src/lib/format-date-long.ts"
      via: "description={formatLongDate(new Date())}"
      pattern: "formatLongDate"
    - from: "apps/frontend/src/features/operations/components/ForecastCard.tsx"
      to: "apps/frontend/src/features/operations/lib/chart-theme.ts"
      via: "Bar fill, grade e tooltip do tema"
      pattern: "CHART_COLORS"
---

<objective>
Lote de tela 8 (D-03): Início (painel), seguindo as telas Stitch "Dashboard operacional" computador (`6a49551034c84556a83fb1e0ede496b1`, já em `design/`) e celular (`02f87860a3144a2ab1bcfef64de96b8e`), com D-21. O Início do SGS hoje só tem a previsão de caixa de 30 dias (`ForecastCard`); este lote dá a ela a cara do painel do design. Só visual (D-01): `cashForecast` e a regra de quem vê o painel (D-11 da fase 5) não mudam.

Omitir (D-02, e UX-20/backlog 999.6 para o resumo do dia): "Atendimentos do Dia", "Faturamento Previsto"/% da meta/meta estipulada, "Noivas no Mês", "Ticket Médio Diário" com "vs semana ant.", "Próximos Atendimentos Imediatos" com bancada e ações "Iniciar"/"Check-in", "Comandas em Aberto para Conferência" com "Fechar", "Contratos Críticos de Noivas"/status de prova/cerimonial, "Exportar DRE Diário", "Filtrar período", "Sincronizado", relógio "11:15 BRT", "Atelier JS Matriz". Nenhum placeholder vazio.

Purpose: a primeira tela da dona com a cara nova.
Output: Início redesenhado, deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-09-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; aspas simples.
- `forecast-card.test.tsx` procura textos exatos ("Entradas previstas", "Saídas previstas", "Saldo previsto", "Previsão de caixa", "Custo profissional", "R$ 100,00", link "Cadastrar despesas fixas", botão "Tentar novamente"); E2E `financeiro-previsao.spec.ts` usa `forecast-card` e `forecast-cost-groups` dentro dele; `smoke.spec.ts` espera o heading "Início". Não mudar textos nem testids; não colocar `uppercase` em textos que os testes leem (o rótulo em maiúsculas é por classe CSS, o texto no DOM continua igual).
- `PageHeader` é compartilhado: as props novas são opcionais e não mudam nada para quem não as passa (`menu-dom.test.tsx` e `casco-gestor-beauty.test.tsx` continuam verdes).
</armadilhas>

<interfaces>
`DashboardPage.tsx`: `<div className="p-md"><PageHeader title="Início" /><div className="grid gap-4 lg:grid-cols-2"><ForecastCard /></div></div>`.
`ForecastCard.tsx` (175 linhas): `GREEN`/`RED` locais (`#1B7A43`/`#BA1A1A` desde o 06-01), `Card data-testid="forecast-card"` com `CardTitle` "Previsão de caixa" e período `ddMm`; totais em `grid sm:grid-cols-3` com `style={{ color }}`; `forecast-cost-groups` (`dl` dentro da coluna de saídas); saldo `text-xl font-semibold text-neutral-900`; gráfico `BarChart` (inflow/outflow) com tabela `sr-only`; link "Ver previsão completa" para `/financeiro/previsao`; estados `forecast-loading`, erro com "Tentar novamente", aviso de despesas fixas com link "Cadastrar despesas fixas".
`chart-theme.ts` (06-06): `CHART_COLORS`, `CHART_GRID_STROKE`, `CHART_TICK`, `CHART_TOOLTIP_STYLE`. `format-date-long.ts` (06-02): `formatLongDate`.
`PageHeader` (06-02): `title`, `breadcrumbs`, `cta`; h1 `font-serif text-headline-lg`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referência do celular, PageHeader com rótulo/descrição e Início com a previsão no padrão do painel</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/dashboard-celular.html, .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-celular.png, apps/frontend/src/components/layout/PageHeader.tsx, apps/frontend/src/pages/DashboardPage.tsx, apps/frontend/src/features/operations/components/ForecastCard.tsx, apps/frontend/src/features/operations/__tests__/inicio-gestor-beauty.test.tsx</files>
  <read_first>
    - .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-desktop.png e dashboard-desktop.html (cabeçalho "Painel de Controle Diário" + h1 `display-lg` + data; faixa de números)
    - apps/frontend/src/pages/DashboardPage.tsx, apps/frontend/src/components/layout/PageHeader.tsx
    - apps/frontend/src/features/operations/components/ForecastCard.tsx
    - apps/frontend/src/features/operations/__tests__/forecast-card.test.tsx, apps/frontend/src/pages/__tests__/home-route.test.tsx
    - apps/e2e/tests/financeiro-previsao.spec.ts e smoke.spec.ts
  </read_first>
  <behavior>
    - `inicio-gestor-beauty.test.tsx`:
      - `PageHeader` com `eyebrow="Painel do dia"` e `description="Quinta-feira, 12 de novembro de 2026"` renderiza o rótulo com `text-overline uppercase text-neutral-500` antes do h1 e a descrição em `p` `text-body text-neutral-500 tabular-nums` depois; sem as props, o HTML é o mesmo de antes (sem `p` extra).
      - `DashboardPage` (com `vi.setSystemTime(new Date(2026, 10, 12, 12))` e `MockedProvider`) mostra "Painel do dia", o h1 "Início" e "Quinta-feira, 12 de novembro de 2026"; a raiz não tem `p-md`; o contêiner do `ForecastCard` não tem `lg:grid-cols-2`.
      - `ForecastCard`: `forecast-card` tem `max-w-none` e nenhuma `shadow`; "Saldo previsto" tem valor `data-testid="forecast-balance"` com `font-serif text-display lg:text-display-lg tabular-nums`; Entradas/Saídas têm `tabular-nums whitespace-nowrap` com `text-success-500`/`text-error-500` e nenhum `style` com `color`; saldo negativo usa `text-error-500`.
      - Nenhum texto "Meta", "Exportar", "Sincronizado", "Check-in" ou "Iniciar" na página.
    - `forecast-card.test.tsx` e `home-route.test.tsx` continuam passando.
  </behavior>
  <action>
1. Baixar com o MCP do Stitch (`mcp__stitch__download_file`): `projects/5888991241990799272/screens/02f87860a3144a2ab1bcfef64de96b8e/fileEntries/html` → `design/dashboard-celular.html` e `…/fileEntries/screenshot` → `design/dashboard-celular.png`. Abrir `dashboard-desktop.png` e `dashboard-celular.png`.
2. Escrever `inicio-gestor-beauty.test.tsx` (falha antes).
3. `PageHeader.tsx`: props opcionais `eyebrow?: string` e `description?: ReactNode`. `eyebrow` → `<p className="mb-xs text-overline uppercase text-neutral-500">{eyebrow}</p>` logo antes do bloco título/ações (depois da trilha); `description` → `<p className="mt-xs text-body text-neutral-500 tabular-nums">{description}</p>` logo abaixo do h1 (dentro da coluna do título, que vira `<div className="min-w-0">`). Sem as props, nada muda.
4. `DashboardPage.tsx`: `<div className="flex flex-col gap-md"><PageHeader eyebrow="Painel do dia" title="Início" description={formatLongDate(new Date())} /><ForecastCard /></div>` (tira o `p-md` duplicado e a grade de 2 colunas com um item só).
5. `ForecastCard.tsx`:
   - `Card data-testid="forecast-card" className="max-w-none"`; `CardHeader` com `CardTitle` "Previsão de caixa" (`font-serif text-headline-md`) e o período em `text-data tabular-nums text-neutral-500`.
   - Remover `GREEN`/`RED` e `style={{ color }}`.
   - Faixa de números: `<div className="grid grid-cols-1 divide-y divide-neutral-200 rounded-md border border-neutral-200 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">` com três blocos `p-sm`, na ordem atual do DOM (Entradas, Saídas, Saldo), com o Saldo destacado pelo tamanho: rótulos `text-overline uppercase text-neutral-500`; Entradas `text-[20px] leading-7 font-semibold tabular-nums whitespace-nowrap text-success-500`; Saídas idem com `text-error-500` e, abaixo, `forecast-cost-groups` (`dt` `text-[12px] text-neutral-500`, `dd` `text-[12px] font-medium tabular-nums text-error-500`); Saldo `data-testid="forecast-balance"` `font-serif text-display lg:text-display-lg tabular-nums whitespace-nowrap text-neutral-800` (negativo `text-error-500`).
   - Gráfico: `CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false}`, eixos `tick={CHART_TICK} axisLine={false} tickLine={false}`, `Tooltip contentStyle={CHART_TOOLTIP_STYLE}`, `Bar` inflow `fill={CHART_COLORS.inflow}` e outflow `fill={CHART_COLORS.outflow}`, `radius={[3, 3, 0, 0]}`; tabela `sr-only` fica.
   - Links "Ver previsão completa" e "Cadastrar despesas fixas": `text-label font-semibold text-primary-500 underline-offset-4 hover:underline` com `min-h-[44px] inline-flex items-center`.
   - Erro: `Alert variant="destructive"` com "Tentar novamente" `variant="outline"` (tamanho padrão).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations src/pages src/components/layout && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `design/dashboard-celular.html` e `.png` existem
    - `grep -nE "GREEN|RED|style=\{\{ color" apps/frontend/src/features/operations/components/ForecastCard.tsx` não encontra nada
    - `grep -n "forecast-balance" apps/frontend/src/features/operations/components/ForecastCard.tsx` encontra o saldo
    - `grep -n "formatLongDate" apps/frontend/src/pages/DashboardPage.tsx` encontra o uso
    - `inicio-gestor-beauty.test.tsx`, `forecast-card.test.tsx`, `home-route.test.tsx`, `menu-dom.test.tsx` e `casco-gestor-beauty.test.tsx` passam
  </acceptance_criteria>
  <done>Início com cabeçalho do painel e previsão de 30 dias no padrão Gestor Beauty, sem blocos que o SGS não tem.</done>
</task>

<task type="auto">
  <name>Task 2: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-10-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/audit/telas.audit.ts (slug `16-painel`)
  </read_first>
  <action>
1. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir. Falha antiga em arquivo não tocado: `deferred-items.md`.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-10 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "16-painel"`. Abrir `desktop/16-painel.png` e `mobile/16-painel.png` ao lado de `design/dashboard-desktop.png` e `design/dashboard-celular.png`; registrar `## Comparação com o Stitch` (bloco | como ficou | omitido por D-02/UX-20?) e corrigir divergência dentro do escopo.
3. Commit (arquivos um a um): `feat(06-10): início no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
5. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-10)` em `origin/master`
    - E2E `smoke.spec.ts` e `financeiro-previsao.spec.ts` verdes
    - `06-10-SUMMARY.md` tem `## Comparação com o Stitch` listando os blocos omitidos; deploy sem erro; CI verde
  </acceptance_criteria>
  <done>Início no staging com CI verde.</done>
</task>

</tasks>

<verification>
- Testes do Início e da previsão verdes; gate, comparação, deploy e CI verdes
</verification>

<success_criteria>
Último lote de tela entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-10-SUMMARY.md`
</output>

---
phase: 06-novo-layout-gestor-beauty
plan: 06
type: execute
wave: 6
depends_on: ["06-05"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-computador.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-computador.png
  - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-celular.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-celular.png
  - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
  - apps/frontend/src/features/operations/components/PeriodFilter.tsx
  - apps/frontend/src/features/operations/lib/chart-theme.ts
  - apps/frontend/src/features/operations/__tests__/financeiro-gestor-beauty.test.tsx
  - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "Os números do topo (Faturado, Recebido, Comandas fechadas, Ticket médio e o quinto cartão) ficam numa faixa densa com rótulo em maiúsculas pequenas, valor tabular e a frase de apoio de UX-18, sem cartões gigantes (06-UI-SPEC §6)"
    - "Período e agrupamento Dia/Semana/Mês ficam juntos; o agrupamento selecionado é roxo com texto branco e os botões têm 44 px (UX-19, D-06, D-10)"
    - "O gráfico usa roxo #570080 para Faturado e verde #1B7A43 para Recebido, grade #E2DFE5 e tooltip sem sombra (D-12)"
    - "Lançamentos mostram tipos em português (UX-17), entradas em verde e saídas em vermelho, valores tabulares à direita sem quebra; no celular viram cartões"
    - "Não há 'Exportar DRE', meta de faturamento nem comparação com a semana anterior (D-02)"
  artifacts:
    - path: "apps/frontend/src/features/operations/lib/chart-theme.ts"
      provides: "Cores e estilos compartilhados dos gráficos Recharts"
      exports: ["CHART_COLORS", "CHART_GRID_STROKE", "CHART_TICK", "CHART_TOOLTIP_STYLE"]
    - path: "apps/frontend/src/features/operations/__tests__/financeiro-gestor-beauty.test.tsx"
      provides: "Regressão visual do Financeiro"
  key_links:
    - from: "apps/frontend/src/features/operations/pages/FinanceiroPage.tsx"
      to: "apps/frontend/src/features/operations/lib/chart-theme.ts"
      via: "Bar fill e CartesianGrid stroke vindos do tema"
      pattern: "CHART_COLORS"
---

<objective>
Lote de tela 4 (D-03): Entradas e saídas (Financeiro, visão geral) seguindo as telas Stitch "Entradas e saídas" computador (`635a7a9431b54dec984a81feaaef574d`) e celular (`a45672503a584a4aa089e9cb6ff53a5a`), com D-12 e D-21. Só visual (D-01): `financialSummary`, `cashMovements`, períodos e permissões não mudam.

Omitir (D-02): "Exportar DRE", meta de faturamento e % da meta, comparação "vs semana anterior", seletor de unidade, "Sincronizado", qualquer categoria/centro de custo que o SGS não tem.

Purpose: a usuária lê o caixa do período com a cara nova, sem perder UX-17/18/19.
Output: Financeiro redesenhado, tema de gráfico compartilhado (reusado no 06-07 e no 06-10), deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-05-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; aspas simples.
- Regressões da fase 5 nesta tela: `financeiro-page.test.tsx` exige `card-hint-<id>` com `text-xs text-neutral-600` (UX-18), `financeiro-filtros` com `flex-col gap-sm md:flex-row` e sem `justify-between` (UX-19), "Entrada de contrato" na coluna Tipo e fallback "Outro lançamento" (UX-17). E2E `financeiro-dashboard.spec.ts:129` lê `kpi-billed` com `innerText` e espera `R$` — não pôr `uppercase` no valor.
- `chart-theme.ts` é `.ts` (constantes), nunca exportadas de `.tsx`.
- `granularity-*`, `kpi-*`, `card-hint-*`, `financial-chart`, `received-by-method`, `received-method-*`, `cash-movements` ficam.
</armadilhas>

<interfaces>
`FinanceiroPage.tsx` (310 linhas): componente `Kpi({ id, label, hint, hintId, value, extra })` (~linhas 50-82) com `article rounded-md border border-neutral-200 bg-white p-md`, rótulo `text-xs text-neutral-500`, valor `text-xl font-semibold text-neutral-800`; `financeiro-filtros` (~132) com `PeriodFilter` e grupo "Agrupar por" (`Button size="sm" variant default/outline`); grade de KPIs `grid grid-cols-2 lg:grid-cols-5 gap-md` (~164); `financial-chart` com `BarChart` (Bar "Recebido" `fill="#1B7A43"` desde o 06-01); tabelas cruas `<table className="w-full text-sm">` `received-by-method` (~234) e `cash-movements` (~270) com saída em `text-error-600`.
`PeriodFilter.tsx` (108 linhas): presets e datas personalizadas (testes em `period-filter.test.tsx`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referências do Stitch, tema de gráfico e Financeiro (faixa de números, filtros, gráfico, tabelas e cartões no celular)</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-computador.html, .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-computador.png, .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-celular.html, .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-celular.png, apps/frontend/src/features/operations/lib/chart-theme.ts, apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/features/operations/components/PeriodFilter.tsx, apps/frontend/src/features/operations/__tests__/financeiro-gestor-beauty.test.tsx, apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx (inteiro)
    - apps/frontend/src/features/operations/components/PeriodFilter.tsx
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx, period-filter.test.tsx, recharts-smoke.test.tsx
    - apps/e2e/tests/financeiro-dashboard.spec.ts
    - .planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md §4 (Tabela, Abas/filtro segmentado) e §6
  </read_first>
  <behavior>
    - `financeiro-gestor-beauty.test.tsx`:
      - A faixa de números `data-testid="financeiro-kpis"` tem `grid-cols-2 lg:grid-cols-5`; cada `Kpi` tem rótulo `text-overline uppercase text-neutral-500` e valor (`kpi-*`) `tabular-nums whitespace-nowrap text-[20px] leading-7 font-semibold`, sem `text-xl`; nenhum `article` tem `p-md` (densidade `p-sm`).
      - `granularity-day|week|month` têm `min-h-[44px]`; o selecionado tem `bg-primary text-white` e `aria-pressed="true"`.
      - Nas linhas de `cash-movements`, entrada tem valor `text-success-500` e saída `text-error-600`; valores `tabular-nums whitespace-nowrap text-right`; cabeçalho `bg-neutral-100 text-overline uppercase text-neutral-500`.
      - `data-testid="cash-movements-cards"` existe com `md:hidden` (um cartão por lançamento: data, tipo em português, valor com sinal) e a tabela `cash-movements` fica num contêiner `hidden md:block`.
      - O texto "Exportar" não aparece.
    - `financeiro-page.test.tsx`, `period-filter.test.tsx` e `recharts-smoke.test.tsx` continuam passando. Como os lançamentos passam a aparecer duas vezes no DOM (cartões do celular + tabela), a asserção `getByText('Outro lançamento')` (linha ~152, UX-17) passa a ser feita dentro da tabela: `within(screen.getByTestId('cash-movements')).getByText('Outro lançamento')` — mesma verificação, só com escopo; o mesmo vale para qualquer `getByText` de valor/tipo de lançamento que ficar duplicado.
  </behavior>
  <action>
1. Baixar com o MCP do Stitch (`mcp__stitch__download_file`) e salvar em `design/`: `projects/5888991241990799272/screens/635a7a9431b54dec984a81feaaef574d/fileEntries/html` → `entradas-saidas-computador.html`, `…/635a7a9431b54dec984a81feaaef574d/fileEntries/screenshot` → `entradas-saidas-computador.png`, `…/a45672503a584a4aa089e9cb6ff53a5a/fileEntries/html` → `entradas-saidas-celular.html`, `…/a45672503a584a4aa089e9cb6ff53a5a/fileEntries/screenshot` → `entradas-saidas-celular.png`. Abrir os PNGs; listar no SUMMARY os blocos omitidos por D-02.
2. Escrever `financeiro-gestor-beauty.test.tsx` (falha antes).
3. Criar `features/operations/lib/chart-theme.ts`: `export const CHART_COLORS = { billed: '#570080', received: '#1B7A43', inflow: '#1B7A43', outflow: '#BA1A1A' } as const; export const CHART_GRID_STROKE = '#E2DFE5'; export const CHART_TICK = { fill: '#6B6670', fontSize: 12 } as const; export const CHART_TOOLTIP_STYLE = { border: '1px solid #E2DFE5', borderRadius: 6, boxShadow: 'none', fontSize: 13 } as const;`.
4. `FinanceiroPage.tsx`:
   - `Kpi`: `article` `rounded-md border border-neutral-200 bg-white p-sm`; rótulo `<p className="text-overline uppercase text-neutral-500">`; valor `<p className="text-[20px] leading-7 font-semibold tabular-nums whitespace-nowrap text-neutral-800" data-testid={id}>`; `extra` `text-[12px] font-semibold text-primary-700`; `hint` mantém `text-xs text-neutral-600 mt-xs` (UX-18).
   - Grade de KPIs com `data-testid="financeiro-kpis"` e `gap-sm` (era `gap-md`).
   - Agrupar por (UX-19): botões no tamanho padrão (tirar `size="sm"`, ficam 44 px), `variant` `default`/`outline` como hoje dentro de `role="group"`.
   - Gráfico: `CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false}`, `XAxis`/`YAxis` `tick={CHART_TICK}` `axisLine={false}` `tickLine={false}`, `Tooltip contentStyle={CHART_TOOLTIP_STYLE}`, `Bar` Faturado `fill={CHART_COLORS.billed}` e Recebido `fill={CHART_COLORS.received}`, `radius={[3, 3, 0, 0]}`; contêiner do gráfico `rounded-md border border-neutral-200 bg-white p-sm` com título `h2` `font-serif text-headline-sm`.
   - Tabelas `received-by-method` e `cash-movements`: `thead` `bg-neutral-100`, `th` `px-sm py-xs text-left text-overline uppercase text-neutral-500` (valor `text-right`), linhas `border-t border-neutral-200`, células `px-sm py-sm text-body`, valores `text-right tabular-nums whitespace-nowrap` com entrada `text-success-500` e saída `text-error-600`; contêiner `overflow-x-auto rounded-md border border-neutral-200 bg-white`. Títulos de seção `h2` `font-serif text-headline-sm`.
   - Celular: antes da tabela de lançamentos, `<ul data-testid="cash-movements-cards" className="flex flex-col gap-sm md:hidden">` com um `li` por lançamento (`rounded-md border border-neutral-200 bg-white p-sm`): linha 1 tipo (`KIND_LABELS[mv.kind] ?? 'Outro lançamento'`) em `text-body font-medium` + valor com sinal à direita (`tabular-nums whitespace-nowrap`, cor de entrada/saída); linha 2 data/método em `text-[12px] text-neutral-500 tabular-nums`. Tabela dentro de `<div className="hidden md:block …">`.
5. `PeriodFilter.tsx`: presets como filtro segmentado (botões padrão de 44 px, selecionado `variant="default"` com texto branco, demais `outline`); campos de data com o `Input` padrão e rótulos `FIELD_LABEL_CLASS`. Manter testids e comportamento (`period-filter.test.tsx`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - Os 4 arquivos `design/entradas-saidas-*` existem
    - `grep -n "CHART_COLORS" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` encontra o uso e `grep -n "#1B7A43\|#570080" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` não encontra hex solto
    - `grep -n "size=\"sm\"" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` não encontra nada
    - `grep -n "cash-movements-cards" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` encontra a lista
    - `financeiro-gestor-beauty.test.tsx`, `financeiro-page.test.tsx`, `period-filter.test.tsx` e `recharts-smoke.test.tsx` passam
  </acceptance_criteria>
  <done>Financeiro denso, tabular e com cores semânticas novas (D-12), sem regressão de UX-17/18/19.</done>
</task>

<task type="auto">
  <name>Task 2: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-06-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/audit/telas.audit.ts (slug `07-financeiro`)
  </read_first>
  <action>
0. Antes do gate, procurar nos E2E textos de lançamento que agora aparecem duas vezes no DOM (cartões `cash-movements-cards` do celular + tabela `cash-movements`; os dois ficam no DOM, um escondido por CSS): `grep -rnE "Outro lançamento|Entrada de contrato|Recebimento|Despesa|Estorno|Sangria|Suprimento|cash-movements|getByRole\('(row|cell)'" apps/e2e/tests apps/e2e/audit apps/e2e/support` e, para cada `getByText`/`getByRole('cell'|'row')`/`toContainText` sobre um texto de lançamento fora de um `getByTestId('cash-movements')` ou `getByTestId('cash-movements-cards')`, escopar com `page.getByTestId('cash-movements')` no projeto de computador e `page.getByTestId('cash-movements-cards')` no de celular (ou `.filter({ visible: true })`), sem mudar o que é verificado. Também conferir os rótulos de tipo usados de verdade em `KIND_LABELS` (FinanceiroPage) e acrescentar ao grep os que faltarem. No planejamento (06/11) o grep não achou nenhum E2E que leia texto de lançamento (`financeiro-dashboard.spec.ts` só lê `kpi-*` e `received-method-*`); se continuar assim, registrar no SUMMARY "nenhum E2E precisou de escopo".
1. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir (só seletor de estilo; `data-testid`/ARIA ficam). Falha antiga em arquivo não tocado: `deferred-items.md`.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-06 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "07-financeiro"`. Abrir `desktop/07-financeiro.png` e `mobile/07-financeiro.png` ao lado de `design/entradas-saidas-computador.png` e `design/entradas-saidas-celular.png`; registrar `## Comparação com o Stitch` (bloco | como ficou | omitido por D-02?) e corrigir divergência dentro do escopo.
3. Commit (arquivos um a um, inclusive os de `design/`): `feat(06-06): entradas e saídas no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
5. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-06)` em `origin/master`
    - E2E `financeiro-dashboard.spec.ts` verde
    - `06-06-SUMMARY.md` tem `## Comparação com o Stitch`; deploy sem erro; CI verde
  </acceptance_criteria>
  <done>Entradas e saídas no staging com CI verde.</done>
</task>

</tasks>

<verification>
- UX-17, UX-18 e UX-19 seguem verdes; gate, comparação, deploy e CI verdes
</verification>

<success_criteria>
Lote Entradas e saídas entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-06-SUMMARY.md`
</output>

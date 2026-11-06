---
phase: 06-novo-layout-gestor-beauty
plan: 07
type: execute
wave: 7
depends_on: ["06-06"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-computador.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-computador.png
  - .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-celular.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-celular.png
  - apps/frontend/src/features/operations/pages/PrevisaoPage.tsx
  - apps/frontend/src/features/operations/__tests__/previsao-gestor-beauty.test.tsx
  - apps/e2e/audit/telas.audit.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "Entradas previstas, Saídas previstas e Saldo previsto ficam num único painel branco dividido por linhas finas, com rótulo em maiúsculas pequenas e valores tabulares em verde, vermelho e tinta (vermelho se o saldo for negativo) (D-12)"
    - "Os períodos (presets e personalizado) são um filtro segmentado de 44 px com o selecionado em roxo e texto branco (D-06, D-10)"
    - "Saídas por grupo de custo e as tabelas por semana usam cabeçalho cinza claro em maiúsculas pequenas, origem como selo com ponto e valores tabulares à direita"
    - "A página não tem padding duplicado (o AppShell já dá a margem)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/previsao-gestor-beauty.test.tsx"
      provides: "Regressão visual da previsão"
    - path: "apps/e2e/audit/telas.audit.ts"
      provides: "Screenshot 17-financeiro-previsao para a comparação"
      contains: "17-financeiro-previsao"
  key_links:
    - from: "apps/frontend/src/features/operations/pages/PrevisaoPage.tsx"
      to: "apps/frontend/src/features/operations/lib/chart-theme.ts"
      via: "cores de entrada/saída vindas do tema (sem GREEN/RED locais)"
      pattern: "CHART_COLORS|text-success-500"
---

<objective>
Lote de tela 5 (D-03): Previsão de caixa seguindo as telas Stitch computador (`ae25b7da5de744d9833ca6f96e18073e`) e celular (`06cb522750a54dad8ae969770aa03f6f`), com D-12 e D-21. Só visual (D-01): `cashForecast`, períodos, cálculo e permissões não mudam; textos de apoio da fase 5 ficam.

Omitir (D-02): meta de faturamento, "Exportar DRE", comparação com período anterior, cenários/simulações, seletor de unidade, qualquer bloco do design sem dado em `cashForecast`.

Purpose: previsão de 30 dias legível no padrão novo.
Output: Previsão redesenhada, slug de screenshot novo no roteiro de auditoria, deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-06-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; aspas simples.
- `previsao-page.test.tsx` procura textos exatos ("Custo profissional", "R$ 12,34", "estimada — sem profissional definido", "Nada previsto nesta semana.", "Você não tem acesso ao financeiro.") — não mudar textos, só classes/estrutura.
- E2E `financeiro-previsao.spec.ts` navega por "Início" e confere valores: manter `forecast-*` testids.
- Constantes novas só em `lib/*.ts`.
</armadilhas>

<interfaces>
`PrevisaoPage.tsx` (328 linhas): `GREEN = '#1B7A43'`, `RED = '#BA1A1A'` (desde o 06-01) usados em `style={{ color }}`; `ForecastPeriodFilter` (~linhas 40-125) com `role="group" aria-label="Período"`, `forecast-preset-<value>`, `forecast-preset-custom`, datas `forecast-custom-from|to` com `Input className="h-9 w-[130px] text-sm"` e rótulos `text-xs font-semibold text-neutral-600`, `forecast-custom-apply`; página com wrapper `<div className="p-md">` (~144), texto explicativo `-mt-sm mb-md text-sm text-neutral-600`, `forecast-range`, totais em `grid sm:grid-cols-3` (~188), `forecast-cost-groups` (`dl`), semanas com `forecast-week-groups-N` e `Table` (Data, Origem, Grupo, Descrição, Valor).
`chart-theme.ts` (06-06): `CHART_COLORS.inflow '#1B7A43'`, `CHART_COLORS.outflow '#BA1A1A'`.
`apps/e2e/audit/telas.audit.ts`: helpers `go(page, path)` e `shoot(page, project, slug, startedAt)`; último teste `16-painel`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referências do Stitch, slug de auditoria e Previsão de caixa no layout novo</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-computador.html, .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-computador.png, .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-celular.html, .planning/phases/06-novo-layout-gestor-beauty/design/previsao-caixa-celular.png, apps/frontend/src/features/operations/pages/PrevisaoPage.tsx, apps/frontend/src/features/operations/__tests__/previsao-gestor-beauty.test.tsx, apps/e2e/audit/telas.audit.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/PrevisaoPage.tsx (inteiro)
    - apps/frontend/src/features/operations/__tests__/previsao-page.test.tsx
    - apps/frontend/src/features/operations/lib/chart-theme.ts
    - apps/e2e/tests/financeiro-previsao.spec.ts
    - apps/e2e/audit/telas.audit.ts (teste `16-painel` como modelo)
  </read_first>
  <behavior>
    - `previsao-gestor-beauty.test.tsx`:
      - `data-testid="forecast-totals"` é um painel `rounded-md border border-neutral-200 bg-white` com 3 blocos separados por `divide-y sm:divide-y-0 sm:divide-x divide-neutral-200`; rótulos `text-overline uppercase text-neutral-500`; valores `text-[22px] leading-8 font-semibold tabular-nums whitespace-nowrap` com Entradas `text-success-500`, Saídas `text-error-500`, Saldo `text-neutral-800` (ou `text-error-500` quando negativo); nenhum `style` com `color`.
      - `forecast-preset-*` têm `min-h-[44px]`; o selecionado tem `bg-primary text-white`.
      - O elemento raiz da página não tem a classe `p-md`.
      - Nas tabelas semanais, a coluna Origem mostra um `Badge` (classe `before:rounded-full`) e o valor tem `tabular-nums text-right whitespace-nowrap`.
    - `previsao-page.test.tsx` continua passando sem alteração.
  </behavior>
  <action>
1. Baixar com o MCP do Stitch (`mcp__stitch__download_file`) e salvar em `design/`: `projects/5888991241990799272/screens/ae25b7da5de744d9833ca6f96e18073e/fileEntries/html` → `previsao-caixa-computador.html`, `…/ae25b7da5de744d9833ca6f96e18073e/fileEntries/screenshot` → `previsao-caixa-computador.png`, `…/06cb522750a54dad8ae969770aa03f6f/fileEntries/html` → `previsao-caixa-celular.html`, `…/06cb522750a54dad8ae969770aa03f6f/fileEntries/screenshot` → `previsao-caixa-celular.png`. Abrir os PNGs; listar os blocos omitidos (D-02) para o SUMMARY.
2. `apps/e2e/audit/telas.audit.ts`: depois de `16-painel`, acrescentar `test('17-financeiro-previsao', async ({ page }, info) => { const t = Date.now(); await go(page, '/financeiro/previsao'); await shoot(page, info.project.name, '17-financeiro-previsao', t); });`.
3. Escrever `previsao-gestor-beauty.test.tsx` (falha antes).
4. `PrevisaoPage.tsx`:
   - Tirar o wrapper `p-md` (usar `<div className="flex flex-col gap-md">`); texto explicativo `text-body text-neutral-500` sem `-mt-sm`.
   - Remover `GREEN`/`RED` e todo `style={{ color }}`: usar classes `text-success-500` (entrada) e `text-error-500` (saída/negativo).
   - Totais: `<div data-testid="forecast-totals" className="grid grid-cols-1 rounded-md border border-neutral-200 bg-white divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">`, cada bloco `p-sm` com rótulo `text-overline uppercase text-neutral-500` e valor conforme o behavior.
   - `ForecastPeriodFilter`: presets e "Personalizado" com `Button` no tamanho padrão (44 px), `variant` `default` quando selecionado, `outline` nos demais; datas com `Input` padrão (tirar `h-9 text-sm`, manter `w-[150px]`), rótulos `FIELD_LABEL_CLASS`; `forecast-custom-apply` `variant="outline"`.
   - `forecast-range`: `text-data tabular-nums text-neutral-500`.
   - `forecast-cost-groups`: título `h2` `font-serif text-headline-sm`; `dt` `text-overline uppercase text-neutral-500`; `dd` `text-[17px] leading-6 font-semibold tabular-nums whitespace-nowrap text-error-500`.
   - Semanas: título de cada semana `h2`/`h3` `font-serif text-headline-sm`; `forecast-week-groups-N` `text-[12px] text-neutral-500`; Origem como `Badge` (`variant="success"` para entrada, `"error"` para saída) com o rótulo atual; Valor `text-right tabular-nums whitespace-nowrap` com a cor de entrada/saída; Data `tabular-nums`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Os 4 arquivos `design/previsao-caixa-*` existem
    - `grep -nE "GREEN|RED|style=\{\{ color" apps/frontend/src/features/operations/pages/PrevisaoPage.tsx` não encontra nada
    - `grep -n "forecast-totals" apps/frontend/src/features/operations/pages/PrevisaoPage.tsx` encontra o painel
    - `grep -n "17-financeiro-previsao" apps/e2e/audit/telas.audit.ts` encontra o teste
    - `previsao-gestor-beauty.test.tsx` e `previsao-page.test.tsx` passam
  </acceptance_criteria>
  <done>Previsão de caixa no padrão Gestor Beauty, com slug de screenshot próprio.</done>
</task>

<task type="auto">
  <name>Task 2: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-07-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
  </read_first>
  <action>
1. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir. Falha antiga em arquivo não tocado: `deferred-items.md`.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-07 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "17-financeiro-previsao"`. Abrir `desktop/17-financeiro-previsao.png` e `mobile/17-financeiro-previsao.png` ao lado de `design/previsao-caixa-computador.png` e `design/previsao-caixa-celular.png`; registrar `## Comparação com o Stitch` (bloco | como ficou | omitido por D-02?) e corrigir divergência dentro do escopo.
3. Commit (arquivos um a um, inclusive os de `design/` e o `telas.audit.ts`): `feat(06-07): previsão de caixa no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
5. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-07)` em `origin/master`
    - E2E `financeiro-previsao.spec.ts` verde
    - `06-07-SUMMARY.md` tem `## Comparação com o Stitch`; deploy sem erro; CI verde
  </acceptance_criteria>
  <done>Previsão de caixa no staging com CI verde.</done>
</task>

</tasks>

<verification>
- Testes da previsão (novos e da fase 5) verdes; gate, comparação, deploy e CI verdes
</verification>

<success_criteria>
Lote Previsão de caixa entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-07-SUMMARY.md`
</output>

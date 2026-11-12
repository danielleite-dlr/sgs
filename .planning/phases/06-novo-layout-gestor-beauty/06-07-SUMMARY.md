---
phase: 06-novo-layout-gestor-beauty
plan: 07
subsystem: frontend-ui
tags: [financeiro, previsao-de-caixa, gestor-beauty, d-26, d-27]
requires: [06-06, 06-12]
provides:
  - Previsão de caixa no layout Gestor Beauty (painel único de totais, filtro segmentado, grupos de custo e tabelas semanais densas)
  - Variante `outflow` do Badge (ponto laranja #D85A30) para origem de saída
  - Slug de auditoria `17-financeiro-previsao` em `apps/e2e/audit/telas.audit.ts`
affects: [06-08, 06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "Valor de entrada em text-success-700 e de saída/negativo em text-outflow-700, inclusive nos totais de 22 px (contraste-valores.test.ts proíbe text-success/outflow-500/600)"
    - "Selo de origem: Badge success para entrada e outflow para saída; error fica só para erro"
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/previsao-gestor-beauty.test.tsx
  modified:
    - apps/frontend/src/features/operations/pages/PrevisaoPage.tsx
    - apps/frontend/src/components/ui/badge-variants.ts
    - apps/e2e/audit/telas.audit.ts
decisions:
  - "Cores de D-26/D-27 em vez das do plano: entrada success-700, saída e saldo negativo outflow-700 (nunca error-*); os tons 700 já existiam no tailwind.config.ts, nenhum token novo"
  - "Totais de 22 px também em 700: o teste contraste-valores (Opção B da usuária) proíbe text-success/outflow-500/600 em qualquer texto"
  - "Badge novo `outflow` (ponto laranja) para origem de saída; entrada usa `success` (ponto verde)"
  - "Selecionado do filtro em SEGMENT_SELECTED_CLASS (bg-primary-800) e blocos rounded-lg shadow-sm, como no 06-06"
metrics:
  duration: 70min
  completed: 2026-11-11
  tasks: 2
  files: 4
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 07: Previsão de caixa no layout Gestor Beauty: resumo

A Previsão de caixa ganhou o padrão da tela do Stitch com a paleta de D-26 e o contraste de D-27.
Entradas, Saídas e Saldo previstos ficam num único painel branco dividido por linhas finas, com
rótulo em maiúsculas pequenas e valor tabular de 22 px (verde, laranja e tinta; laranja se o saldo
for negativo). Os períodos viraram filtro segmentado de 44 px com o selecionado em roxo `#521873`.
As saídas por grupo de custo e as tabelas por semana usam rótulos pequenos, origem como selo com
ponto e valor tabular à direita. A página perdeu o padding duplicado. Consulta, cálculo, períodos e
permissões não mudaram.

## O que foi feito

**Task 1: slug de auditoria, teste e página**
- `previsao-gestor-beauty.test.tsx` (7 casos, escrito antes e falhando): painel `forecast-totals`,
  cores por classe sem `style` com cor, saldo negativo em `text-outflow-700` e positivo em
  `text-neutral-800`, presets com `min-h-[44px]` e selecionado `bg-primary-800 text-white`, raiz sem
  `p-md`, `dt`/`dd` dos grupos de custo, selo com ponto e valor tabular nas tabelas semanais.
- `PrevisaoPage.tsx`:
  - saíram `GREEN`, `RED`, `GREEN_TEXT`, `RED_TEXT` e todo `style={{ color }}`; agora
    `INFLOW_TEXT = 'text-success-700'` e `OUTFLOW_TEXT = 'text-outflow-700'`;
  - raiz `flex flex-col gap-md`; texto explicativo `text-body text-neutral-500`;
  - `ForecastPeriodFilter`: botões no tamanho padrão (44 px), selecionado com
    `SEGMENT_SELECTED_CLASS`, datas com `Input` padrão `w-[150px] tabular-nums`, rótulos
    `FIELD_LABEL_CLASS`, "Aplicar" `outline`;
  - `forecast-range` em `text-data tabular-nums text-neutral-500`;
  - `forecast-totals` com `divide-y sm:divide-y-0 sm:divide-x divide-neutral-200`;
  - grupos de custo: título `font-serif text-headline-sm`, `dt` em `text-overline uppercase`,
    `dd` `text-[17px] leading-6 font-semibold tabular-nums whitespace-nowrap text-outflow-700`;
  - semanas: título `font-serif text-headline-sm`, resumo `tabular-nums`, `forecast-week-groups-N`
    em 12 px, Data `tabular-nums`, Origem com `Badge` `success`/`outflow`, Descrição com
    `min-w-[220px]` (no celular a tabela rola de lado em vez de espremer o texto), Valor
    `text-right tabular-nums whitespace-nowrap` na cor de entrada/saída.
- `badge-variants.ts`: variante `outflow` (`before:bg-outflow-500`).
- `telas.audit.ts`: teste `17-financeiro-previsao` depois de `16-painel`.
- `previsao-page.test.tsx` e o E2E `financeiro-previsao.spec.ts` passaram sem alteração (textos e
  `forecast-*` mantidos; `dt`/`dd` irmãos preservados para o XPath do E2E).

**Task 2: gate, comparação, commit, deploy e CI.** Ver abaixo.

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 34 suítes, 382 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 56/56 suítes, 609/609 testes verdes (sem as falhas `NOAUTH` dos lotes anteriores) |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 100 arquivos, 726 testes verdes |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 44 passaram, 0 falhas (6,4 min) |

Depois da largura mínima da Descrição (ajuste da comparação), rodei de novo os testes da previsão
(12 verdes), typecheck, lint e `financeiro-previsao.spec.ts` (2 passaram).

## Commit, deploy e CI

Commit `35f6475` em `origin/master`. `./scripts/deploy-staging.sh` terminou sem erro (backend e
frontend reiniciados, sem migration). CI run `43139617868` verde na primeira tentativa (lint,
typecheck, frontend-unit, integration, e2e, boot-time, frontend-codegen).

## Comparação com o Stitch

Screenshots locais em `06-audit-evidence/06-07/desktop/17-financeiro-previsao.png` e
`mobile/17-financeiro-previsao.png` (ignorados pelo git; `AUDIT_TARGET=local`, 3 passaram),
comparados com `design/previsao-computador.jpg`/`.html` (a tela de celular não pôde ser baixada,
ver desvios).

| Bloco do Stitch | Como ficou | Omitido por D-02? |
|-----------------|-----------|-------------------|
| Filtro "7 dias / 15 dias / 30 dias / Personalizado", selecionado roxo | Igual, 44 px, `#521873` com texto branco; fica abaixo do título (e não à direita) porque o personalizado abre as datas embaixo | não |
| Faixa Entradas · Saídas · Saldo previstos | Painel branco com 3 blocos divididos por linha; valores maiores (22 px) que no Stitch, em verde 700, laranja 700 e tinta | não |
| Saídas por grupo de custo (3 colunas) | Igual, rótulo em maiúsculas e valor laranja 700 | não |
| "Total: R$ …" no cabeçalho dos grupos | — (o total já está em Saídas previstas) | sim |
| Barras de proporção e "% do desembolso" | — (não há esse dado em `cashForecast`; seria cálculo novo) | sim |
| Cabeçalho da semana com resumo (Entradas, custos, Saldo) | Título em serifa + linha de resumo + linha de grupos em 12 px | não |
| Selo "Semana corrente" | — | sim |
| Tabela Data/Origem/Grupo/Descrição/Valor, cabeçalho 11 px sobre `#F9FAFB` | Igual (componente `Table` do 06-12) | não |
| Origem como texto simples | Selo com ponto verde (entrada) ou laranja (saída), pedido pelo plano | não |
| Valor `+R$` verde e `−R$` laranja à direita | Igual, tons 700, tabular, sem quebra | não |
| Selo "EM ATRASO" e "estimada — sem profissional definido" | Igual (`destructive` e `secondary`) | não |
| Semana sem itens "Sem movimentações programadas" | Mantido o texto da fase 5 "Nada previsto nesta semana." | não (texto do SGS) |
| Status "Sistema operacional", seletor de unidade, busca ⌘K | — | sim |

## Desvios do plano

1. **[Correção do orquestrador D-26/D-27] Cores.**
   - O plano pedia `text-success-500` para entrada e `text-error-500` para saída/saldo negativo e
     `dd` dos grupos. Ficou `text-success-700` e `text-outflow-700`; `error-*` não aparece na página.
   - A correção permitia o tom 500 nos totais de 22 px, mas `contraste-valores.test.ts` (Opção B da
     usuária) proíbe `text-success/outflow-500/600` em qualquer texto, então os totais também usam
     700, como a faixa do 06-06. Os tons 700 (`#0B7A53`, `#B5481F`) já existiam como tokens; nenhum
     token novo e nenhuma mudança no teste de tokens.
   - O `key_link` do plano (`CHART_COLORS|text-success-500`) não se aplica: a página não tem
     gráfico. Ela importa `SEGMENT_SELECTED_CLASS` de `chart-theme.ts`.
2. **Selos de origem.** O plano pedia `variant="error"` para saída (ponto vermelho `#C53030`). Criei
   a variante `outflow` (ponto `#D85A30`) em `badge-variants.ts`; entrada usa `success`.
3. **Decisões do 06-12/06-06 sobre o plano:** selecionado em `bg-primary-800` (não `bg-primary`);
   blocos `rounded-lg … shadow-sm` (não `rounded-md`); cabeçalho de tabela do componente `Table`.
4. **Referências do Stitch não baixadas.** O MCP do Stitch não estava disponível nesta execução,
   então os 4 arquivos `design/previsao-caixa-*` não foram criados. Usei `design/previsao-computador.html`
   e `.jpg` (a mesma tela "Previsão de Caixa - Desktop", baixada no 06-12) e o 06-UI-SPEC. A tela de
   celular (`06cb522750a54dad8ae969770aa03f6f`) não foi comparada.
5. **[Regra 1] Descrição espremida no celular.** Na comparação, a coluna Descrição quebrava palavra
   por palavra; ganhou `min-w-[220px]` e a tabela rola de lado.
6. Texto explicativo com `-mt-md` para encostar no título (o `PageHeader` tem `pb-lg` e a raiz
   `gap-md`); o plano pedia sem margem negativa.

## Known Stubs

Nenhum.

## Self-Check: PASSED

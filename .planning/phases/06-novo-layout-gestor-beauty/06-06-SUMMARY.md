---
phase: 06-novo-layout-gestor-beauty
plan: 06
subsystem: frontend-ui
tags: [financeiro, entradas-e-saidas, gestor-beauty, recharts, d-26, d-27]
requires: [06-05, 06-12]
provides:
  - Tema compartilhado dos gráficos Recharts (`features/operations/lib/chart-theme.ts`) para 06-07 e 06-10
  - Classe do filtro segmentado selecionado `SEGMENT_SELECTED_CLASS` (bg-primary-800 com texto branco)
  - Financeiro (visão geral) no layout Gestor Beauty, com faixa de números densa, filtros segmentados, gráfico com o tema novo, tabelas densas e cartões no celular
  - Faixa Saldo · Entradas · Saídas calculada a partir de `cashMovements`, sem query nova
affects: [06-07, 06-10]
tech-stack:
  added: []
  patterns:
    - "Bloco = rounded-lg border border-neutral-200 bg-white shadow-sm; cabeçalho de tabela bg-neutral-50 + text-overline uppercase text-neutral-500"
    - "Valor pequeno com sinal: '+ R$' em text-success-700 e '- R$' em text-outflow-700 (D-27)"
    - "Lista em cartões no celular (md:hidden) + tabela no computador (hidden md:block); nos testes, escopo com within()"
key-files:
  created:
    - apps/frontend/src/features/operations/lib/chart-theme.ts
    - apps/frontend/src/features/operations/__tests__/financeiro-gestor-beauty.test.tsx
    - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-computador.html
    - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-celular.html
    - .planning/phases/06-novo-layout-gestor-beauty/design/entradas-saidas-celular.png
  modified:
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/operations/components/PeriodFilter.tsx
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
    - .planning/ROADMAP.md
decisions:
  - "Cores de D-26/D-27 em vez dos hex do plano: Faturado #521873, Recebido/entrada #109868, saída #D85A30, grade #E5E7EB, ticks #6B7280, tooltip com raio 8 e sem sombra"
  - "Valores pequenos (tabela, cartões, faixa de saldo) em success-700/outflow-700; saída laranja, nunca text-error-600"
  - "Filtro segmentado selecionado (presets do período e Agrupar por) em bg-primary-800 text-white, mantendo aria-pressed"
  - "Faixa Saldo/Entradas/Saídas fica no cabeçalho de Lançamentos, rotulada 'Saldo do período' (o período é escolhido pela usuária e não é sempre o mês) e só aparece quando há lançamentos"
  - "Selo de tipo: Badge accent (roxo claro) para lançamentos de contrato e secondary (neutro) para os demais; rótulo vem de cashKindLabel() (UX-17)"
  - "Títulos h2 sem a classe font-serif (text-headline-sm font-semibold text-neutral-800); a regra global de globals.css (D-26) continua aplicando Source Serif 4 a h1/h2"
metrics:
  duration: 75min
  completed: 2026-11-06
  tasks: 2
  files: 9
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 06: Entradas e saídas no layout Gestor Beauty: resumo

O Financeiro (visão geral) ganhou a aparência da tela "Entradas e saídas" do Stitch, já com a paleta
da Previsão de caixa (D-26) e o contraste de valores de D-27. O topo virou uma faixa densa de cinco
números, com rótulo em maiúsculas pequenas e valor tabular de 20 px. Período e Agrupar por são
filtros segmentados, com o selecionado em roxo `#521873` e texto branco. O gráfico usa o tema
compartilhado novo. Os lançamentos ganharam a faixa "Saldo do período · Entradas · Saídas", uma
tabela densa com selo de tipo e valor com sinal à direita, e cartões no celular. Queries,
períodos e permissões não mudaram.

## O que foi feito

**Task 1: referências, tema, Financeiro e PeriodFilter**
- `design/`: `entradas-saidas-computador.html`, `entradas-saidas-celular.html` e `entradas-saidas-celular.png`, baixados antes deste plano. O screenshot do computador veio em branco do Stitch, por isso **ficaram 3 arquivos, e não 4**. O HTML do computador serviu de referência.
- `lib/chart-theme.ts` (`.ts`, só constantes): `CHART_COLORS`, `CHART_GRID_STROKE`, `CHART_TICK`, `CHART_TOOLTIP_STYLE` e `SEGMENT_SELECTED_CLASS`. O 06-12 não tinha criado tema de gráfico. A Previsão e o ForecastCard ainda têm `GREEN`/`RED` locais, e o 06-07 pode passar a usar este tema.
- `FinanceiroPage.tsx`:
  - `Kpi`: bloco `rounded-lg … shadow-sm p-sm`, rótulo `text-overline uppercase text-neutral-500` e valor `text-headline-md font-semibold tabular-nums whitespace-nowrap`, sem `uppercase` (o E2E lê `R$`). A dica UX-18 continua com `text-xs text-neutral-600`.
  - Grade `financeiro-kpis` com `gap-sm`.
  - Agrupar por sem `size="sm"`, com 44 px e o selecionado em `SEGMENT_SELECTED_CLASS`. `granularity-*` e `aria-pressed` foram mantidos.
  - Gráfico com o título "Faturado e recebido", grade só horizontal, eixos sem linha, tooltip sem sombra e barras com cantos de 3 px.
  - "Recebido por forma de pagamento" passou a ser uma tabela com cabeçalho (Forma, Valor, Parte). `received-method-*` foi mantido.
  - Lançamentos:
    - a faixa `cash-movements-totals` soma os valores de `cashMovements` em centavos;
    - no celular, `cash-movements-cards` (`md:hidden`) mostra em cada cartão a data dd/mm, o selo de tipo, a forma, o nome da cliente, a origem e o valor com sinal;
    - no computador, a tabela `cash-movements` fica num bloco `hidden md:block`, com linhas de 40 px, selo de tipo e valor `text-right tabular-nums whitespace-nowrap` com a cor de D-27.
- `PeriodFilter.tsx`:
  - presets e "Personalizado" com 44 px e o selecionado em `bg-primary-800 text-white`;
  - campos De/Até com o `Input` padrão (44 px) e rótulo `FIELD_LABEL_CLASS`;
  - "Aplicar" no tamanho padrão.
- Testes:
  - `financeiro-gestor-beauty.test.tsx`, novo, com 9 casos;
  - `financeiro-page.test.tsx`: os casos UX-16 e UX-17 passaram a fazer a verificação dentro de `within(getByTestId('cash-movements'))`, porque o texto agora aparece duas vezes no DOM. A verificação em si não mudou.

**Task 2: gate, comparação, commit, deploy e CI.** Ver as seções abaixo. Nenhum E2E precisou de escopo: o grep não encontrou nenhum spec que leia texto de lançamento, e `financeiro-dashboard.spec.ts` só lê `kpi-*`, `received-method-*` e `granularity-*`.

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 32 suítes, 367 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 55/56 suítes, 599/601 testes. A única falha é `phase4-alerts-boot` (2 testes): timeout de 30 s no `beforeAll` com o Redis local respondendo `NOAUTH` (634 linhas no log). É a mesma falha local do 06-12, só de backend e não tocada aqui. Aceita |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 92 arquivos, 645 testes verdes |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 38 passaram, 0 falhas (5,7 min) |

## Commit, deploy e CI

Commit `2d2fc0b` em `origin/master`. `./scripts/deploy-staging.sh` terminou sem erro, com backend e frontend reiniciados e sem migration. O CI run `42329659513` ficou verde (lint, typecheck, frontend-unit, integration, e2e, boot-time, frontend-codegen) na primeira tentativa.

## Comparação com o Stitch

Os screenshots locais estão em `06-audit-evidence/06-06/desktop/07-financeiro.png` e `mobile/07-financeiro.png` (`AUDIT_TARGET=local`, 3 passaram). Foram comparados com `design/entradas-saidas-computador.html` e `design/entradas-saidas-celular.png`. A org da auditoria não tem lançamentos no mês, então a tabela e os cartões aparecem no estado vazio. Eles estão cobertos pelos testes unitários.

| Bloco do Stitch | Como ficou | Omitido por D-02? |
|-----------------|-----------|-------------------|
| Faixa "Saldo do mês · Entradas · Saídas" | "Saldo do período · Entradas (verde 700) · Saídas (laranja 700)" no cabeçalho de Lançamentos, somando `cashMovements` | não |
| Filtro segmentado de período (selecionado roxo) | Presets do SGS (Hoje, Ontem, Esta semana, Mês atual, Mês anterior, Personalizado), selecionado `#521873` com texto branco | não |
| Agrupar por (não existe no Stitch) | Dia/Semana/Mês segmentado ao lado do período (UX-19) | não (do SGS) |
| Tabela densa, cabeçalho em maiúsculas pequenas, linhas de 40 px | Igual, com cabeçalho `#F9FAFB` | não |
| Selo de tipo (Comanda/Contrato/Despesa/Comissão) | Tipos reais do SGS via `cashKindLabel` (Pagamento, Sinal, Troco, Estorno, Entrada de contrato…); contrato em roxo claro e os demais em cinza | não |
| Valor "+ R$"/"- R$" à direita | Igual, tabular, sem quebra; verde 700 e laranja 700 (D-27) | não |
| Cartões no celular (data, selo, forma, nome, referência, valor) | Igual; sem o status "Efetivado/Conciliado" (o SGS não tem) | parcial |
| Números do topo (não existem no Stitch) | Faixa densa de 5 números do SGS (UX-18) | não (do SGS) |
| "Exportar diário" | — | sim |
| "Lançar" (lançamento manual) | — | sim |
| Chips "Todos / Apenas entradas / Apenas saídas" | — | sim |
| Busca e filtro "Forma" | — | sim |
| Painel "Estado do Sistema / Diretriz operacional" | — | sim |
| "Previsão D+7 / Cartões a compensar / Auditoria fiscal" | — | sim |
| Selo "Fechamento provisório" | — | sim |
| "Conciliação em dia / Atualizado às" e paginação "Exibindo 12 de 38" | — | sim |

Os itens omitidos entraram no backlog 999.7 do ROADMAP.

## Desvios do plano

1. **[Override D-26/D-27] Cores e tamanhos.** Usei o que o orquestrador pediu no lugar dos hex do plano:
   - o plano pedia Faturado `#570080`, Recebido `#1B7A43`, grade `#E2DFE5` e tooltip com raio 6. Ficou `#521873`, `#109868`, `#E5E7EB` e raio 8;
   - para entrada e saída o plano pedia `text-success-500` e `text-error-600`. Ficou `text-success-700` e `text-outflow-700`, porque `contraste-valores.test.ts` proíbe 500/600;
   - para o selecionado o plano pedia `bg-primary`. Ficou `bg-primary-800`;
   - os blocos passaram de `rounded-md` para `rounded-lg … shadow-sm`;
   - o cabeçalho de tabela passou de `bg-neutral-100` para `bg-neutral-50`, o mesmo do componente `Table` de D-26;
   - o valor do KPI usa o token `text-headline-md` (20/28) no lugar de `text-[20px] leading-7`.
2. **Títulos sem `font-serif`.** O orquestrador pediu títulos de seção sem `font-serif`, com `font-semibold text-neutral-800`, e foi o que fiz. A regra global `h1, h2 { font-family: serif }` de `globals.css` (D-26) não foi alterada, então os h2 continuam saindo em Source Serif 4. Para deixá-los em Inter falta decidir se entra `font-sans` ou se a regra global muda.
3. **Faixa Saldo/Entradas/Saídas** (não estava no plano, pedida pelo orquestrador). Fica no cabeçalho de Lançamentos e é calculada no cliente a partir de `cashMovements`, sem backend.
4. **Design com 3 arquivos, não 4.** O `entradas-saidas-computador.png` veio em branco do Stitch e não foi salvo.
5. **[Regra 1] Lint.** O `cashList` derivado com `??` gerava aviso de `react-hooks/exhaustive-deps`, e passou a ser um `useMemo`.

## Known Stubs

Nenhum.

## Self-Check: PASSED

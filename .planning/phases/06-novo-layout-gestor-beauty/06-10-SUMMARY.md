---
phase: 06-novo-layout-gestor-beauty
plan: 10
subsystem: frontend-ui
tags: [inicio, painel, previsao-de-caixa, page-header, d-26, d-27, inter]
requires: [06-01, 06-02, 06-12]
provides:
  - PageHeader com props opcionais eyebrow, description e variant="display" (sem as props, o HTML é o mesmo)
  - Início com cabeçalho "Painel do dia" + h1 "Início" (Inter semibold 28/36 px) + data por extenso
  - ForecastCard em largura total, faixa de números Entradas/Saídas/Saldo com divisórias, saldo como número de destaque
  - Gráfico semanal com grade #E5E7EB, ticks #6B7280, tooltip com borda #E5E7EB, raio 8 e sem sombra
affects: [06-11]
tech-stack:
  added: []
  patterns:
    - "Número grande (>= 20 px em negrito) de entrada/saída usa o token DEFAULT (text-success / text-outflow); texto pequeno usa o tom 700 (D-27)"
    - "Cabeçalho de painel: PageHeader variant=\"display\" com eyebrow sem maiúsculas forçadas (D-13)"
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/inicio-gestor-beauty.test.tsx
    - .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-celular.png
  modified:
    - apps/frontend/src/components/layout/PageHeader.tsx
    - apps/frontend/src/pages/DashboardPage.tsx
    - apps/frontend/src/features/operations/components/ForecastCard.tsx
    - .planning/ROADMAP.md
decisions:
  - "Overrides do orquestrador sobre o plano: Inter em tudo (sem font-serif no h1 do Início, no título do cartão e no saldo), cores D-26 (#109868/#D85A30/#E5E7EB/#6B7280) no lugar de #1B7A43/#BA1A1A/#E2DFE5"
  - "Eyebrow 'Painel do dia' em text-overline sem uppercase, como a trilha do PageHeader (D-13)"
  - "Cartão mantém shadow-sm e rounded-lg (padrão D-26), em vez do 'sem sombra' do plano"
  - "Saldo negativo em text-outflow (#D85A30, D-26) no lugar de text-error-500"
  - "Link 'Ver detalhe' mantém o texto atual (o plano citava 'Ver previsão completa'); o teste forecast-card e o E2E não mudam"
  - "Cores do gráfico ficam como constantes locais no ForecastCard até a junção com chart-theme.ts (06-06)"
metrics:
  duration: ~35min
  completed: 2026-11-06
---

# Phase 6 Plan 10: Início no layout Gestor Beauty Summary

Início com cabeçalho de painel ("Painel do dia", h1 "Início" em Inter semibold 28/36 px e data por extenso) e a previsão de caixa de 30 dias em largura total, com faixa de números Entradas/Saídas/Saldo no padrão D-26/D-27 e gráfico semanal com grade, ticks e tooltip do tema. Não houve mudança em consulta nem no backend.

## O que foi feito (Task 1)

- **PageHeader** (`apps/frontend/src/components/layout/PageHeader.tsx`): props opcionais `eyebrow` (`<p class="mb-xs text-overline text-neutral-500">`, depois da trilha e antes do título), `description` (`<p class="mt-xs text-body text-neutral-500 tabular-nums">` abaixo do h1, que passa a ficar num `div.min-w-0`) e `variant="display"` (h1 `font-sans text-display font-semibold text-neutral-900 lg:text-display-lg`). Sem as props, o HTML continua igual (h1 serifado, sem `<p>`), e `menu-dom`/`casco-gestor-beauty` seguem verdes.
- **DashboardPage**: `flex flex-col gap-md`, sem o `p-md` duplicado (o AppShell já dá o respiro) e sem a grade de 2 colunas com um item só; `description={formatLongDate(new Date())}` (o `format-date-long.ts` já existia).
- **ForecastCard**:
  - `Card` com `max-w-none` (o padrão do Card limita a 400 px); título "Previsão de caixa" em Inter semibold `text-headline-md`; período `text-data tabular-nums`.
  - Faixa de números com `divide-x`/`divide-y` e borda `neutral-200`, rótulos `text-overline uppercase` (texto no DOM igual), Entradas `text-success` e Saídas `text-outflow` a 20 px em negrito (`font-bold`, texto grande pela WCAG), saldo `data-testid="forecast-balance"` em Inter semibold `text-display lg:text-display-lg` (`text-outflow` se negativo). Grupos de custo com `dd` em `text-outflow-700` (D-27). Nenhum `style={{ color }}`.
  - Gráfico: grade `#E5E7EB` tracejada e só horizontal, eixos sem linha com ticks `#6B7280` 12 px, tooltip com borda `#E5E7EB`, raio 8 e `boxShadow: 'none'`, barras `#109868`/`#D85A30` com raio `[3, 3, 0, 0]`. A tabela `sr-only` continua.
  - Links "Ver detalhe" e "Cadastrar despesas fixas": `text-label font-semibold text-primary-500` com alvo de 44 px. "Tentar novamente" com o tamanho padrão do Button (44 px).
  - Testids mantidos: `forecast-card`, `forecast-cost-groups`, `forecast-loading`. Novos: `forecast-balance`, `forecast-inflow`, `forecast-outflow`.
- **Teste novo** `inicio-gestor-beauty.test.tsx` (10 casos): PageHeader com e sem as props, DashboardPage (rótulo, h1, data em 12/11/2026, sem `p-md`, sem `lg:grid-cols-2`, sem textos D-02), ForecastCard (largura total, Inter, saldo, negativo, cores por token, tom 700 nos grupos, link de 44 px).
- **Backlog 999.7** (ROADMAP): faltavam ticket médio diário, noivas no mês/semana, contratos críticos de noivas, comandas em aberto para conferência, "Filtrar período", relógio e "Sincronizado". Acrescentados numa linha. Meta, % da meta, "vs semana anterior", Exportar DRE, bancadas, ações rápidas e unidade já estavam lá; atendimentos do dia estão no UX-20 (999.6).

## Referência do celular

O `design/dashboard-celular.png` foi copiado do scratchpad do orquestrador. **Não há `dashboard-celular.html`**: o plano pedia o HTML pelo MCP do Stitch, mas só a imagem foi fornecida. A comparação do celular foi feita só pela imagem.

## Comparação com o Stitch

Comparação feita lendo o código contra `design/dashboard-desktop.png`/`.html` e `design/dashboard-celular.png`. A auditoria por screenshot (`16-painel`) fica para a junção.

| Bloco do Stitch | Como ficou no SGS | Omitido? |
|---|---|---|
| Rótulo "PAINEL DE CONTROLE DIÁRIO • Atelier JS Matriz" | "Painel do dia" em `text-overline` cinza, sem maiúsculas forçadas e sem unidade | Unidade omitida (D-02) |
| h1 "Visão Geral Operacional" (serifa) | h1 "Início" (o smoke E2E espera esse nome) em Inter semibold 28/36 px | Fonte trocada pelo override D-26 |
| Data por extenso "Quinta-feira, 12 de novembro de 2026 • Gestão centralizada…" | Data por extenso `tabular-nums` abaixo do h1 | Complemento "bancadas e agenda técnica"/"Studio JS" omitido (D-02) |
| "SINCRONIZADO 11:15 BRT", "Filtrar período", "Exportar DRE Diário" | Não aparecem | Sim (D-02, backlog 999.7) |
| Faixa de 4 KPIs (atendimentos, faturamento previsto/meta, noivas, ticket médio) com divisórias | Faixa de 3 números da previsão de 30 dias (Entradas, Saídas, Saldo) com divisórias e borda, rótulos em `overline` maiúsculo, saldo como número de destaque | KPIs omitidos (UX-20 / 999.7); só o padrão visual da faixa foi aproveitado |
| Barras de progresso sob os KPIs | Não aparecem (dependem de meta) | Sim (999.7) |
| "Próximos Atendimentos Imediatos" (tabela no computador, cartões no celular) | Não aparece | Sim (UX-20, bancada e ações em 999.7) |
| "Comandas em Aberto para Conferência" | Não aparece | Sim (999.7) |
| "Contratos Críticos de Noivas" | Não aparece | Sim (999.7) |
| "Ocupação das Bancadas em Tempo Real" | Não aparece | Sim (999.7) |
| Celular: "MÉTRICAS DO DIA" em lista de linhas | No celular a faixa empilha (`grid-cols-1 divide-y`), mesma leitura em linhas | Métricas trocadas pelas da previsão |
| Gráfico semanal | Não existe no Stitch; mantido (é a previsão já entregue na fase 5) com grade/ticks/tooltip do tema D-26 | — |

Divergências conscientes: título "Início" em vez de "Visão Geral Operacional" (heading lido pelo smoke E2E e pelo menu); Inter no lugar da serifa (override D-26 do orquestrador).

## Deviations from Plan

### Overrides do orquestrador (D-26/D-27), aplicados por cima do plano

1. Fonte Inter no h1 do Início, no título do cartão e no saldo (o plano pedia `font-serif`). Para não mudar as outras telas, o PageHeader ganhou `variant="display"`; o padrão continua serifado.
2. Eyebrow sem `uppercase` (o plano pedia `text-overline uppercase`).
3. Cores D-26: textos por token (`text-success`, `text-outflow`, `text-outflow-700`) e gráfico com constantes locais `#109868`/`#D85A30`/`#E5E7EB`/`#6B7280`, sem `chart-theme.ts` (que é do 06-06).
4. Cartão com `shadow-sm` (padrão D-26) em vez de "nenhuma shadow".
5. Entradas/Saídas em `font-bold` a 20 px (e não `font-semibold`) para valer como texto grande na WCAG com o tom 500. Classe `text-success`/`text-outflow` (DEFAULT = 500) porque a varredura `contraste-valores.test.ts` proíbe as classes `-500/-600` em texto.
6. Saldo negativo em `text-outflow` (D-26: negativo = `#D85A30`) no lugar de `text-error-500`.

### Outros

- **Escopo:** só a Task 1 foi executada, a pedido do orquestrador (worktree isolada, em paralelo com o 06-06). O gate completo da Task 2 (backend, integração, E2E), a auditoria por screenshot, o push, o deploy e o CI ficam para a junção. A dependência do 06-09 foi ignorada por instrução: esta tela só usa `ForecastCard`, `DashboardPage` e `PageHeader`.
- O link continua "Ver detalhe" (o plano citava "Ver previsão completa", mas o teste existente e o código atual usam "Ver detalhe").
- Commit único `feat(06-10)` (sem commit RED separado), conforme a mensagem pedida pelo orquestrador; o RED foi conferido localmente (8 de 10 casos falhando antes da implementação).

## Pontos para a junção

- Trocar `GREEN`, `RED`, `GRID`, `TICK` e `TOOLTIP_STYLE` do `ForecastCard.tsx` por `CHART_COLORS.inflow/outflow`, `CHART_GRID_STROKE`, `CHART_TICK` e `CHART_TOOLTIP_STYLE` do `chart-theme.ts` (06-06).
- Rodar o E2E (`smoke.spec.ts`, `financeiro-previsao.spec.ts`) e a auditoria `16-painel`, abrir as capturas ao lado das referências.
- Atualizar STATE e progresso do ROADMAP.

## Known Stubs

Nenhum.

## Verificação

Na worktree, depois de `corepack pnpm install --frozen-lockfile`:

- `corepack pnpm --filter @sgs/frontend exec vitest run`: 92 arquivos e 646 testes passando (inclui `inicio-gestor-beauty`, `forecast-card`, `home-route`, `menu-dom`, `casco-gestor-beauty` e `contraste-valores`).
- `corepack pnpm --filter @sgs/frontend typecheck`: sem erros.
- `corepack pnpm --filter @sgs/frontend lint`: sem erros e sem avisos (`--max-warnings 0`).
- E2E, integração do backend e deploy não foram rodados, por instrução. Os seletores E2E lidos (`smoke.spec.ts`: heading "Início"; `financeiro-previsao.spec.ts`: `forecast-card`, "Previsão de caixa" e `forecast-cost-groups`) continuam no DOM.

## Self-Check: PASSED

Arquivos criados presentes; commit e14f7c6 (feat) na branch worktree-agent-af097df3f0de74204. O grep de GREEN/RED no ForecastCard encontra só as constantes locais do gráfico, que saem na junção com o chart-theme.

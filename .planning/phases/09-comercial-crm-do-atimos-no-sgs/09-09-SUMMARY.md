---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 09
subsystem: backend/commercial
tags: [painel, relatorios, exportacao, exceljs, pdfkit, graphql]
requires: [09-02, 09-04]
provides:
  - commercialDashboard, commercialReport, exportCommercialReport (SDL commercial-reports.graphql)
  - CommercialDashboardService, CommercialReportsService, CommercialReportsResolver
  - commercial-export.ts (escapeCell, buildReportXlsx, buildReportPdf, tipos CommercialReportData)
affects: [09-13]
key-files:
  created:
    - apps/backend/src/graphql/schema/commercial-reports.graphql
    - apps/backend/src/commercial/commercial-dashboard.service.ts
    - apps/backend/src/commercial/commercial-reports.service.ts
    - apps/backend/src/commercial/commercial-reports.resolver.ts
    - apps/backend/src/commercial/commercial-export.ts
    - apps/backend/src/commercial/commercial-export.spec.ts
    - apps/backend/test/integration/phase9-reports.e2e.spec.ts
  modified:
    - apps/backend/src/commercial/commercial-reports.module.ts
decisions:
  - "Erros de entrada do relatório saem como GraphQLError com extensions.code BAD_USER_INPUT e extensions.reason com o código de domínio (PERIOD_INVALID, STATUS_INVALID, KIND_INVALID, SOURCE_INVALID, FORMAT_INVALID)."
  - "Valor do negócio = finalAmount, ou packagePrice - discountAmount, ou 0 (função dealAmount exportada do serviço do painel)."
  - "Lembretes vencidos/de hoje calculados no painel com a mesma regra do 09-08 (não concluídos; vencido = dueAt < agora; hoje = dueAt de agora até o fim do dia local da org), sem depender do serviço de lembretes (plano paralelo)."
  - "No Painel, etapas Ganho/Perdido contam negócios fechados dentro do período (periodDays, padrão 30); etapas abertas contam todos os negócios abertos."
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 9 Plan 09: Painel, relatórios e exportação (backend) Summary

Painel comercial e Relatórios na API com visibilidade por papel em toda contagem, e exportação Excel (exceljs) e PDF (pdfkit, A4 paisagem) entregue em base64 por GraphQL, com escape de fórmulas nas células.

## Tarefas

1. **Exportação pura** (`8c4770f`): `escapeCell` (prefixa apóstrofo em `= + - @ TAB CR`), `buildReportXlsx` (abas Resumo e Negócios, dinheiro como número com formato R$) e `buildReportPdf` (totais, origem, motivos de perda e até 1.000 linhas com rodapé "mostrando 1000 de N"). Spec unitária (5 testes) sem banco.
2. **Painel, relatórios, resolver e integração** (`test` + `b4cdcad`): `commercialDashboard` (COMMERCIAL_READ), `commercialReport` e `exportCommercialReport` (COMMERCIAL_MANAGE). Dia "hoje" no fuso da organização; follow-ups pela regra de SLA (`overdueSince`), mais atrasado primeiro, até 10; relatório filtra por `created_at` do negócio no fuso da org (período até 366 dias) e por responsável, etapa, status, tipo e origem; limite de 5.000 linhas com `truncated`.

## Verificação

- unit `commercial-export` (5) verde; `phase9-reports` (12) verde; typecheck e lint do backend limpos.
- SDL não referencia `CommercialDeal`.

## Deviations from Plan

Nenhuma de escopo. Observações:
- O plano diz que o formato inválido devolve `FORMAT_INVALID`; como query não tem payload de erro, o código fica em `extensions.reason` (com `extensions.code = BAD_USER_INPUT`), igual aos demais erros de entrada. O frontend (09-13) deve ler `extensions.reason`.
- `commercialReminderCounts` (09-08) não existia nesta onda; o painel replica a regra com a mesma visibilidade (`visibilityWhere(...).reminder`).

## Notas para os próximos planos

- `dealAmount`, `money`, `sumAmounts`, `todayRangeTx`, `orgTimezoneTx` são exportados de `commercial-dashboard.service.ts`.
- Linhas do relatório trazem `source` como código; na exportação a coluna Origem usa o rótulo em português.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos criados e commits 8c4770f, a5d61e5 e b4cdcad conferidos.

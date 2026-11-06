---
phase: 05-uso-no-dia-a-dia
plan: 04
subsystem: backend-financial
tags: [cash-forecast, graphql, rbac, rls, commissions]
requires: [05-02, 05-03]
provides:
  - query cashForecast(from, to) com totais, buckets semanais e itens com origem
  - validateRange e orgTimezone exportadas de financial.service.ts
affects: [05-06]
key-files:
  created:
    - apps/backend/src/financial/forecast.service.ts
    - apps/backend/src/financial/forecast.resolver.ts
    - apps/backend/src/graphql/schema/forecast.graphql
    - apps/backend/test/integration/phase5-forecast.e2e.spec.ts
  modified:
    - apps/backend/src/financial/financial.service.ts
    - apps/backend/src/financial/financial.module.ts
    - apps/backend/test/integration/phase5-rls-rbac.e2e.spec.ts
key-decisions:
  - "Fuso vem de orgTimezone(tx, orgId) extraído do método privado; ForecastService não tem fallback próprio"
  - "Comissão estimada de todos os agendamentos da janela, inclusive ligados a contrato; entrada só para os sem contrato"
requirements-completed: []
completed: 2026-11-06
---

# Phase 5 Plan 04: Backend previsão de caixa Summary

Query `cashForecast(from, to)` (financial.read) que soma entradas (agendamentos sem contrato, parcelas e restante de contratos ativos, vencidos em atraso) e saídas (comissão estimada, inclusive itens de contrato sem profissional definido, e despesas fixas), com buckets semanais e lista de itens, no fuso da org e sob RLS.

## Tasks
1. ForecastService + resolver + SDL + módulo: commit 843c0e5
2. Suíte phase5-forecast e casos de RBAC/RLS: commit 314e490

## Verificação
- typecheck, eslint e jest unitário (financial/forecast) passam
- `test:integration -- phase5`: 3 suítes, 24 testes passando (13 da previsão, cobrindo fuso, comanda vs variante, atraso, D-10, despesas, saldo negativo, datas inválidas, RBAC e isolamento entre orgs)
- Suíte de integração completa executada; resultado final informado no relatório do orquestrador

## Deviations from Plan
- [Rule 1 - Bug no plano] O teste do pagamento de contrato usava `kind: 'deposit'`, mas a constraint `chk_cp_kind` só aceita payment/refund/reversal; usado `payment`. Sem outros desvios.

FIN-03 não marcado como completo (instrução do orquestrador).

## Known Stubs
Nenhum.

## Self-Check: PASSED

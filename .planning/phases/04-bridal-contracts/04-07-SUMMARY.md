---
phase: 04-bridal-contracts
plan: 07
subsystem: comandas-financial
tags: [comanda, contrato, dashboard, cobertura-por-item]
requires: [04-01]
provides:
  - coveredCents e regra de "a pagar" (total - itens cobertos) no fechamento da comanda
  - Comanda.covered/owed e ComandaItem.contractId/contractCode no SDL
  - Dashboard com contractBilledTotal, billedContracts e contractCode na lista de caixa
affects: [04-08, 04-14]
key-files:
  modified:
    - apps/backend/src/comandas/comanda-math.ts
    - apps/backend/src/comandas/comanda-math.spec.ts
    - apps/backend/src/comandas/comanda-close.ts
    - apps/backend/src/comandas/comanda-serialize.ts
    - apps/backend/src/graphql/schema/comandas.graphql
    - apps/backend/src/financial/financial.service.ts
    - apps/backend/src/graphql/schema/financial.graphql
  created:
    - apps/backend/test/integration/phase4-comanda-contract.e2e.spec.ts
    - apps/backend/test/integration/phase4-financial-dashboard.e2e.spec.ts
key-decisions:
  - "total do SDL continua sendo o total cheio; remaining/change/canClose/closeError passam a ser sobre owed"
  - "Ticket médio usa só billed_comandas (contratos fora, D-25)"
requirements-completed: [CONT-01]
completed: 2026-11-04
---

# Phase 4 Plan 07: Comanda abatida por contrato e dashboard Summary

Comanda com itens cobertos por contrato fecha cobrando só o não coberto (estoque e comissão pelo preço cheio em todos os itens), e o Faturado soma pagamentos de contrato por `paid_at` mais só a parte não coberta das comandas, sem dupla contagem.

## Tasks
1. Regra de a pagar com cobertura: commit 9297bd5
2. Dashboard D-14/D-25 e contrato na lista de caixa: commit 23f4e18
3. Suítes phase4-comanda-contract (4 testes) e phase4-financial-dashboard (5 testes): commit 280bd19

## Verificação
Lint, tsc e jest unit (191) verdes. Integração: phase3-comanda-*, phase3-financial-dashboard e as 2 suítes novas verdes (dados antigos do dashboard inalterados).

## Deviations from Plan
- Nos testes, `reopenComanda` usa `{ id, reason }` (o plano não detalhava o input) e, após fechar de novo uma comanda com extra, `owed` segue 35.00 (valor cobrado), com `remaining` 0.00.
- Teste extra no dashboard: soma bruta de contrato 8000.00 até D+1 (antes do reembolso); mês de março líquido 1600.00 após o reembolso.
- `reopenComandaTx` conferido: sem mudança (nada a estornar na parte coberta).
- STATE.md e ROADMAP.md não foram atualizados neste worktree paralelo (evitar conflito com 04-05/04-06); o orquestrador consolida. Requisitos não marcados, conforme instrução.

## Known Stubs
None.

## Self-Check: PASSED

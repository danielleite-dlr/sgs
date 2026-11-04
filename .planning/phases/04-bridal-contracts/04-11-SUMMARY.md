---
phase: 04-bridal-contracts
plan: 11
subsystem: backend-contract-payments
tags: [graphql, contracts, payments, cancellation, cash-ledger]
requires: [04-02, 04-06, 04-08]
provides:
  - contract-payments.graphql (recordContractPayment, reverseContractPayment, cancelContract, contractCancellationPreview)
  - recordContractPaymentsTx, reverseContractPaymentTx, previewCancellationTx, cancelContractTx
  - CashKind contract_in/contract_refund e contractId em recordCashMovement
affects: [04-14, 04-15]
tech-stack:
  added: []
  patterns: [ledger append-only com estorno por linha de reversão, lock FOR UPDATE do contrato em toda mutação financeira]
key-files:
  created:
    - apps/backend/src/contracts/payments/contract-payments.ts
    - apps/backend/src/contracts/payments/contract-payments.service.ts
    - apps/backend/src/contracts/payments/contract-payments.resolver.ts
    - apps/backend/src/graphql/schema/contract-payments.graphql
    - apps/backend/test/integration/phase4-contract-payments.e2e.spec.ts
    - apps/backend/test/integration/phase4-contract-cancel.e2e.spec.ts
  modified:
    - apps/backend/src/financial/cash-ledger.ts
    - apps/backend/src/contracts/payments/contract-payments.module.ts
key-decisions:
  - "Saldo pago = Σ de todo o contract_payments (pagamentos, estornos e devoluções), então estorno reabre saldo e devolução zera o pago"
  - "Cancelamento roda com BRIDAL_SCHEDULE_TX_OPTIONS (timeout 30s) por cancelar vários agendamentos"
  - "contractCancellationPreview lança BadRequest em erro de domínio (query não tem payload de erros)"
  - "Após cancelar, syncContractCoverageTx e rebuildTravelBlocksTx recompõem cobertura e deslocamentos do que restou"
requirements-completed: []
duration: ~35min
completed: 2026-11-04
---

# Phase 4 Plan 11: Pagamentos e cancelamento do contrato Summary

Pagamentos do contrato (entrada/restante, 1 a 5 métodos, parciais, sem passar do total) gravam o ledger imutável e o caixa `contract_in`; estorno por linha de reversão (só ADMIN/MANAGER) e cancelamento com acerto: noiva cancela retém tudo, estúdio cancela devolve tudo com saída `contract_refund`, agendamentos vinculados cancelados e link revogado, com prévia do acerto.

## Commits
- 572a6e6 ledger de pagamentos, estorno e cancelamento (funções transacionais, cash-ledger)
- 2d3cbe5 SDL, service, resolver e módulo
- (testes) suítes phase4-contract-payments e phase4-contract-cancel

## Verificação
Lint e typecheck limpos; 201 testes unitários; integração phase4-contract-payments (9) e phase4-contract-cancel (4) verdes; gate phase3 + phase4 sem regressões (exceto o NOAUTH conhecido de phase4-alerts-boot).

## Deviations from Plan
Nenhuma. Observação: o erro de permissão negada vem como erro GraphQL (guard), não no payload.

## Known Stubs
Nenhum.

## Self-Check: PASSED

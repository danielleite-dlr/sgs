---
phase: 03-core-operations
plan: 07
subsystem: backend-comandas
tags: [fechamento, reabertura, comissao, estoque, caixa, credito, audit]
requires: [03-03, 03-04, 03-05, 03-06]
provides:
  - financial/commission-resolver.ts (resolveCommissionRule, computeCommission, categoryChain - puros)
  - catalog/products/stock.ts (applyStockDelta, StockError)
  - comandas/comanda-close.ts (closeComandaTx, reopenComandaTx)
  - mutations closeComanda, reopenComanda; Comanda.commissions, Comanda.hasCommissionWarnings
affects: [03-09, 03-11, 03-12]
key-files:
  created:
    - apps/backend/src/financial/commission-resolver.ts
    - apps/backend/src/financial/commission-resolver.spec.ts
    - apps/backend/src/catalog/products/stock.ts
    - apps/backend/src/comandas/comanda-close.ts
    - apps/backend/test/integration/helpers/phase3-comanda-flow.ts
    - apps/backend/test/integration/phase3-comanda-close.e2e.spec.ts
    - apps/backend/test/integration/phase3-commission-records.e2e.spec.ts
    - apps/backend/test/integration/phase3-comanda-reopen.e2e.spec.ts
  modified:
    - apps/backend/src/catalog/products/products.service.ts
    - apps/backend/src/comandas/comanda-serialize.ts
    - apps/backend/src/comandas/comandas.service.ts
    - apps/backend/src/comandas/comandas.resolver.ts
    - apps/backend/src/graphql/schema/comandas.graphql
key-decisions:
  - "Fechamento e reabertura rodam numa única transação (timeout 15 s); erros de regra são lançados dentro e viram errors[] fora"
  - "Comissão sempre sobre o preço cheio (list_unit_price * quantity), mesmo em pacote; sem regra grava R$ 0,00 com no_rule e não bloqueia"
  - "Reabertura nunca faz UPDATE em commission_records: cria linhas kind 'reversal' negativas com reverses_record_id"
requirements-completed: []  # POS-03/FIN-02/POS-01: backend entregue, UI no 03-09/03-11; seguem Pending
duration: ~75min
completed: 2026-11-02
---

# Phase 3 Plan 07: Fechamento e reabertura da comanda no backend Summary

`closeComanda` fecha a comanda de forma atômica e idempotente (crédito, estoque, comissão com snapshot imutável, caixa com troco, agendamentos concluídos) e `reopenComanda` desfaz tudo por lançamentos de reversão auditados, só para ADMIN/MANAGER e com motivo.

## Tasks

1. Resolver de comissão puro + `applyStockDelta` extraído do `adjustStock` - `5f0477c`
2. `closeComandaTx`, mutação `closeComanda`, `commissions`/`hasCommissionWarnings`, suítes close e commission-records (o `reopenComandaTx` e a mutação `reopenComanda` entraram junto, pois vivem no mesmo arquivo/serviço/SDL) - `4c5d8b1`
3. Suíte de reabertura (`phase3-comanda-reopen`) - `f521652`

## Testes

- Unit backend: 107 (14 suítes; +17 do commission-resolver)
- Integração backend: 266 (30 suítes; +18: close 8, commission-records 5, reopen 5)
- Frontend vitest: 238 (inalterado). lint e typecheck verdes.
- Provas: fluxo do critério #2 (crédito 50 + pix 50 + dinheiro 50, troco 15, estoque 10->9, agendamento concluído); rollback total em pagamento insuficiente, estoque zerado e crédito consumido por outra comanda; fechar/reabrir duas vezes em paralelo executa uma vez; snapshot inalterado após editar/apagar regra; `sgs_app` sem UPDATE/DELETE em `commission_records`.

## Deviations from Plan

- **Task 3 antecipada em código:** `reopenComandaTx`, service e resolver foram escritos na Task 2 (mesmos arquivos); a Task 3 ficou só com a suíte de integração.
- **Helper de teste compartilhado:** `helpers/phase3-comanda-flow.ts` (monta o fluxo do critério #2, queries e payloads) usado pelas 3 suítes, em vez de repetir o fluxo.
- **Casos extras:** comanda vazia (`EMPTY_COMANDA`) e `INVALID_CHANGE` no fechamento (itens removidos depois do pagamento).
- **Soma do recebido:** o caixa do fluxo soma 135,00 (sinal 50 + pix 50 + dinheiro 50 - troco 15); a expectativa inicial do teste de financeiro estava errada, corrigida no teste (código correto).
- Sem desvio de comportamento em relação ao plano. `StockError`/`CreditError` são reexportados de `comanda-close.ts` por conveniência.

## Known Stubs

None.

## Requisitos

POS-03, FIN-02 e POS-01 permanecem **Pending**: o backend está completo, mas a tela de fechamento/reabertura (03-11) e o relatório (03-09) ainda não existem.

## Notas para os próximos planos

- **SDL:** `closeComanda(id)` (`comanda.close`: ADMIN/MANAGER/ATTENDANT) e `reopenComanda(input: { id, reason })` (`comanda.reopen`: ADMIN/MANAGER). Ambos devolvem `ComandaPayload`. `Comanda.commissions` traz os registros do CICLO ATUAL (`closeCycle`) - accrual e reversal, com `reversed` calculado; PROFESSIONAL vê só as próprias. `hasCommissionWarnings` = existe accrual `noRule` não revertido (D-24, mostrar aviso).
- **Códigos de erro novos:** COMANDA_NOT_OPEN (também no fechar duplo), EMPTY_COMANDA, INSUFFICIENT_PAYMENT (mensagem "Falta R$ x,xx para fechar."), INVALID_CHANGE, CREDIT_INSUFFICIENT, STOCK_INSUFFICIENT (mensagem com nome e disponível), REASON_REQUIRED (mín. 3 caracteres após trim), COMANDA_NOT_CLOSED, NOT_FOUND.
- **Ciclos:** `close_cycle` só incrementa no fechamento; a reabertura mantém o valor e o refechamento usa +1. Uma comanda reaberta mostra em `commissions` o ciclo anterior já revertido (`reversed true`, `hasCommissionWarnings` false) até fechar de novo.
- **Reabertura mantém `comanda_payments`** (rascunhos) e o sinal (`deposit_in` não é estornado; o crédito `reopen_refund` devolve só o consumo). Itens de produto removidos na reaberta não reduzem estoque de novo; o estoque devolvido é o líquido de `stock_movements` da comanda.
- **Caixa:** fechamento grava `payment_in` por método (exceto `client_credit`) e `change_out` em dinheiro; reabertura grava `reversal` espelhado por movimento (mesmo método, sinal oposto, `cycle` do fechamento). Dashboard: reaberta sai do Faturado (status volta a `open`, `closed_at` nulo) e o Recebido volta a conter só o sinal.
- **Comissão fixa:** valor fixo é POR UNIDADE (`fixedPer: 'unit'` no snapshot). `rule_snapshot` guarda `itemName`, `baseAmount` (preço cheio), `chargedAmount` (valor cobrado/rateado), `matchedCategoryId` e os campos da regra.
- **Reuso:** `applyStockDelta(tx, {...})` é o caminho único de estoque dentro de transações; `adjustStock` mantém códigos públicos (`NOT_FOUND`, `STOCK_NEGATIVE`).
- **Testes:** `buildFlow135(w)` (helpers/phase3-comanda-flow.ts) monta o cenário do critério #2 sem depender do `createVisit`; o 03-12 (E2E) pode reaproveitar os valores esperados.

## Self-Check: PASSED

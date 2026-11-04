---
phase: 04-bridal-contracts
plan: 14
subsystem: frontend
tags: [contracts, react, apollo, comanda, financeiro, pacote]
requires: [04-04, 04-06, 04-07, 04-09, 04-11]
provides:
  - Telas de contratos (lista, criação a partir do grupo, detalhe, configurações)
  - Cobertura de contrato visível na comanda (owed) e parcela de contratos no financeiro
  - Entrada (R$ ou %) no pacote
affects: [04-15, 04-16]
tech-stack:
  added: []
  patterns:
    - "gql com tipos manuais; MockedProvider com __typename via fixture"
key-files:
  created:
    - apps/frontend/src/features/bridal/api/contracts.api.ts
    - apps/frontend/src/features/bridal/lib/contract-labels.ts
    - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
    - apps/frontend/src/features/bridal/components/ContractSettingsTab.tsx
    - apps/frontend/src/features/bridal/components/ContractLinkCard.tsx
    - apps/frontend/src/features/bridal/components/ContractPaymentDialog.tsx
    - apps/frontend/src/features/bridal/components/ReverseContractPaymentDialog.tsx
    - apps/frontend/src/features/bridal/components/CancelContractDialog.tsx
    - apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-fixtures.ts
    - apps/frontend/src/features/catalog/__tests__/pacote-deposit.test.tsx
  modified:
    - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
    - apps/frontend/src/features/operations/lib/money.ts
    - apps/frontend/src/features/operations/api/comandas.api.ts
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/features/operations/api/financial.api.ts
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/catalog/api/pacotes.api.ts
    - apps/frontend/src/features/catalog/components/PacoteForm.tsx
    - apps/frontend/src/pages/PacotesPage.tsx
decisions:
  - "computePaymentSummary passa a receber o valor a pagar (comanda.owed); a função não mudou, só o contrato de uso e os testes (owed 0 fecha sem pagamento)."
  - "Com pacote na criação, o formulário não envia itens: o backend rateia o pacote para a noiva; a prévia local soma preço do pacote + serviços planejados das demais pessoas cobertas."
  - "Consulta do grupo, pacotes e serviços ficou local em contracts.api.ts (ContractGroupQuery etc.), sem depender do api do 04-13."
metrics:
  tasks: 3
  completed: 2026-11-04
---

# Phase 4 Plan 14: Telas de contratos Summary

Telas completas de contratos (lista com filtros derivados, criação a partir do grupo, detalhe com link/pagamentos/estorno/cancelamento com prévia/PDF, configurações da org), cobertura de contrato na comanda via `owed`, parcela de contratos no financeiro e entrada em R$ ou % no pacote.

## Tarefas

1. Cobertura na comanda, financeiro e pacote (commit 51c0cbf): `ComandaFields` pede `covered owed` e `contractId/contractCode` nos itens; PaymentPanel usa `owed`, mostra "Coberto pelo contrato <código>: R$ x" e "Nada a cobrar — coberto pelo contrato"; ComandaPage mostra badge por item e linha de cobertura; Financeiro mostra "inclui R$ x de contratos" no card Faturado e a coluna de origem (comanda ou contrato) no caixa; PacoteForm ganhou "Entrada do contrato" (Sem entrada / Valor fixo / Percentual) com validação 0–100.
2. Lista, criação e configurações (commit 390bfde): `contracts.api.ts`, `contract-labels.ts`, ContractsPage (filtros → `derived`/`status`, `?grupo=<id>`, aba Configurações só com `contract.settings`), ContractFormDialog, ContractSettingsTab.
3. Detalhe (commit do Task 3): ContractDetailPage, ContractLinkCard, ContractPaymentDialog, ReverseContractPaymentDialog, CancelContractDialog e testes.

## Deviations from Plan

- [Rule 3] `ContractFormDialog` edita sempre com itens explícitos (e `packageId` preservado); a criação com pacote omite itens para o backend ratear.
- A coluna "Comanda" da tabela do caixa passou a se chamar "Origem" (mostra `comandaCode` ou `contractCode`).
- Campos `contractId/contractCode` em `ComandaItemData` são opcionais para não quebrar fixtures/mocks antigos.
- Teste de PaymentPanel dedicado à cobertura não foi criado; a regra é coberta em `money.test.ts` (owed 0 e owed 35) e os testes existentes da comanda/financeiro seguem verdes.

## Notas para próximos planos

- Mudar `eventDate` do grupo não recalcula o prazo do saldo (04-06/04-08). A UI de edição de contrato não mexe nisso: o prazo exibido ("Quitar até") vem de `balanceDueDate` do backend; editar o contrato reenvia `balanceDueDaysBefore` e então o backend recalcula a partir da data atual do evento.
- As flags `noivas`/`contratos` continuam desligadas (04-15).
- Requisitos não marcados em REQUIREMENTS.md, conforme orientação.

## Known Stubs

Nenhum.

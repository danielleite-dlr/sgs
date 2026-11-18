---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 06
subsystem: backend/commercial
tags: [nestjs, graphql, ganho, contratos, clientes, transacao]
requires: [09-02, 09-04]
provides:
  - winCommercialDeal (mutation) e CommercialWinService.win
  - ContractsService.createInTx
  - createClientTx, updateClientTx, validateClientFields, ClientFieldError (clients/client-tx.ts)
affects: [09-12]
key-files:
  created:
    - apps/backend/src/clients/client-tx.ts
    - apps/backend/src/clients/__tests__/client-tx.spec.ts
    - apps/backend/src/graphql/schema/commercial-win.graphql
    - apps/backend/src/commercial/commercial-win.service.ts
    - apps/backend/src/commercial/commercial-win.resolver.ts
    - apps/backend/test/integration/phase9-win-deal.e2e.spec.ts
  modified:
    - apps/backend/src/clients/clients.service.ts
    - apps/backend/src/contracts/contracts.service.ts
    - apps/backend/src/commercial/commercial-win.module.ts
decisions:
  - "Cliente existente (ligada ou achada por telefone/e-mail) não é renomeada pelo modal; só recebe os campos preenchidos."
  - "Quando há várias clientes com o mesmo contato, vale a mais antiga (created_at)."
  - "O ganho roda com timeout de 30 s na transação, por causa da criação do contrato."
metrics:
  tasks: 2
  completed: 2026-11-18
---

# Phase 9 Plan 06: Backend do ganho Summary

`winCommercialDeal` resolve a cliente, cria grupo e contrato rascunho pelo `ContractsService.createInTx`, lança o sinal opcional com `recordContractPaymentsTx` e fecha o negócio, tudo numa única transação com `SELECT ... FOR UPDATE` no negócio.

## Tarefas

1. **Reuso sem duplicar regra** (`6847b08`, `7d84ec9`): validação e gravação de cliente movidas para `client-tx.ts` (`ClientsService.create/update` mantêm o payload público); `ContractsService.createInTx` expõe o `createTx` dentro da transação de quem chama.
2. **Ganho atômico** (`5f3a91d` teste, `e123edd` implementação): ordem das checagens NOT_FOUND (visibilidade) → DEAL_CLOSED → PACKAGE_REQUIRED → EVENT_DATE_REQUIRED → BENEFICIARY_REQUIRED (debutante). Todo erro é exceção dentro do callback (rollback total) e só vira payload fora. Resolver exige `COMMERCIAL_WRITE`; `canWinDeal` decide no serviço (D-21, `WIN_NOT_ALLOWED`).

## Verificação

- `phase9-win-deal` (9 casos): verde, incluindo `Promise.all` com um contrato só e DEAL_CLOSED no outro.
- Regressão: `clients.e2e`, `phase4-contracts-core`, `phase4-contract-payments`, `phase4-bridal-group`, `phase41-contract-preview` (86 testes) verdes, sem alterar nenhum teste existente.
- Unit `src/clients` e `src/commercial` (57), typecheck e lint verdes.

## Deviations from Plan

Nenhuma de escopo. Pequenos detalhes: `createClientTx`/`updateClientTx` também validam internamente (além do pré-check do `ClientsService`), para que o ganho tenha a mesma regra; o `createInTx` recebe cast no input porque `eventKind` chega como string.

## Notas para os próximos planos

- Payload `{ contractId, clientId, errors }`; códigos novos: `EVENT_DATE_REQUIRED`, `BENEFICIARY_REQUIRED`, `STAGE_NOT_FOUND`, mais os de cliente (`CPF_INVALID`, `RG_INVALID`, `POSTAL_CODE_INVALID`, `PHONE_INVALID`, `CONTACT_REQUIRED`) e de contrato/pagamento (`INVALID_METHOD`, `PAYMENT_LINES_REQUIRED`...).
- O ganho registra uma interação `other` ("Negócio ganho: contrato criado") e leva o negócio à etapa de kind `won`.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits (6847b08, 7d84ec9, 5f3a91d, e123edd) conferidos.

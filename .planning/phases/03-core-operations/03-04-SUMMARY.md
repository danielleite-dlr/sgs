---
phase: 03-core-operations
plan: 04
subsystem: backend-comandas
tags: [comanda, pos, pagamentos, pacote, graphql, rls]
requires: [03-01]
provides:
  - comandas/comanda-math.ts (computeComandaTotals, PAYMENT_METHODS, CASH_METHODS)
  - comandas/comanda-code.ts (nextComandaCode, formatComandaCode)
  - comandas/comanda-items.ts (ComandaError, buildServiceItem, buildProductItem, expandPackageItems, recalcComandaTotal, prorateUnits)
  - comandas/comanda-open.ts (openComandaTx)
  - comandas/comanda-serialize.ts (loadComandaView, loadComandaViews, serializeComanda)
  - comandas.graphql (query comanda/comandas; mutations openWalkInComanda, add/removeComandaItem, addComandaPackage, add/removeComandaPayment)
  - migration 20261102000000_walkin_client_contact_optional
affects: [03-06, 03-07, 03-11]
tech-stack:
  added: []
  patterns: ["ComandaError lançado dentro da transação (ROLLBACK) e traduzido para errors[] fora", "FOR UPDATE na linha da comanda em toda mutação", "contador de código por (org, ano) via UPSERT atômico"]
key-files:
  created:
    - apps/backend/src/comandas/comanda-math.ts
    - apps/backend/src/comandas/comanda-code.ts
    - apps/backend/src/comandas/comanda-items.ts
    - apps/backend/src/comandas/comanda-open.ts
    - apps/backend/src/comandas/comanda-serialize.ts
    - apps/backend/src/comandas/comandas.service.ts
    - apps/backend/src/comandas/comandas.resolver.ts
    - apps/backend/src/graphql/schema/comandas.graphql
    - apps/backend/prisma/migrations/20261102000000_walkin_client_contact_optional/migration.sql
    - apps/backend/test/integration/phase3-comanda-code.e2e.spec.ts
    - apps/backend/test/integration/phase3-comanda-open.e2e.spec.ts
    - apps/backend/test/integration/phase3-comanda-payments.e2e.spec.ts
  modified:
    - apps/backend/src/comandas/comandas.module.ts
key-decisions:
  - "Item de pacote: listUnitPrice = preço cheio do serviço (base da comissão, D-23); unitPrice/total = parte rateada (soma exata = preço do pacote)"
  - "Pagamento não grava cash_movements nem client_credit_movements; ledgers só no fechamento (03-07)"
  - "Membro exposto em ComandaItem.professional sem phone/pixKey/birthDate (LGPD)"
requirements-completed: []  # POS-01..03: backend entregue; UI da comanda só no 03-11, seguem Pending
duration: ~60min
completed: 2026-11-02
---

# Phase 3 Plan 04: Núcleo da comanda no backend Summary

Comanda (POS) no backend: código C-AAAA-NNN sem buracos e no fuso da org, abertura walk-in (cliente existente ou só nome + telefone opcional), itens de serviço (com variante), produto e pacote (1 item por unidade com rateio exato e preço cheio em `list_unit_price`), pagamentos parciais dos 6 métodos com pago/falta/troco calculados, e leitura com escopo do PROFESSIONAL.

## Tasks

1. Regras puras (comanda-math, rateio), comanda-code, comanda-open, builders de item - `2e1fae1`
2. SDL comandas.graphql, ComandasService/Resolver, serialização, walk-in, itens, pacote, leitura com escopo (+ migration walk-in) - `926c13f`
3. Pagamentos parciais: suíte phase3-comanda-payments (o código de `addPayment`/`removePayment` entrou junto do service na Task 2, pois o resolver/SDL já os declaravam) - commit seguinte

## Testes

- Unit backend: 90 (13 suites; +13 nesta plan: comanda-math 7, comanda-items 6)
- Integração backend: 217 (23 suites; +26: code 5, open 13, payments 8)
- Frontend vitest: 238 (inalterado). lint e typecheck verdes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `chk_clients_contact` impedia o walk-in só com nome**
- **Found during:** Task 2 (integração do walk-in)
- **Issue:** a tabela `clients` tem `CHECK (phone IS NOT NULL OR email IS NOT NULL)` (Fase 2), incompatível com D-06 (cliente walk-in só com nome, telefone opcional).
- **Fix:** migration `20261102000000_walkin_client_contact_optional` remove a constraint. A regra "telefone OU e-mail" continua no `ClientsService.create` (cadastro completo). Aplicada no banco de dev local com `prisma migrate deploy`.
- **Atenção no deploy:** a migration roda em staging via o serviço `migrate` do compose; não há dados que a violem (apenas afrouxa).

**2. Task 3 antecipada em código**
- `addPayment`/`removePayment` foram escritos junto do service (Task 2) porque o SDL e o resolver da Task 2 já declaram as duas mutações; a Task 3 ficou só com a suíte de integração (8 casos).

**3. Extras**
- `MAX_QUANTITY = 999` em `addItem` (evita estouro do NUMERIC(12,2)); `INVALID_PHONE` (> 30 caracteres) no walk-in; `loadComandaViews` em lote (saldo de crédito agregado por cliente, sem N+1) usado pela listagem.
- `Comanda.client` expõe o `Client` completo (incluindo cpf) a quem tem `comanda.read`, igual ao resto do sistema.

## Known Stubs

None.

## Requisitos

POS-01, POS-02 e POS-03 permanecem **Pending** no REQUIREMENTS.md: o backend está entregue (abrir, itens, pagamentos divididos com falta/troco), mas a tela da comanda e o fechamento (03-07) ainda não existem. POS-02 segue com a redução de escopo aceita (sem Pix QR e sem voucher).

## Notas para os próximos planos

- **Reuso:** `openComandaTx(tx, { orgId, clientId, openedBy, now? })` abre a comanda na transação do chamador (03-06 deve chamá-la dentro do `runWithTenant` com os locks da agenda). `buildServiceItem` aceita `appointmentId`; `expandPackageItems` aceita `assignments[].appointmentId`. Depois de inserir itens, chame `recalcComandaTotal(tx, comandaId)`. `loadComandaView(tx, id)` devolve a view do SDL (`ComandaPayload.comanda`).
- **Erros:** `ComandaError(code, message, field)` e `mapComandaError` em `comanda-items.ts`; lance dentro da transação e traduza fora (`fail` do service não é exportado).
- **Pagamentos:** `comanda_payments` guarda só o rascunho de pagamento. O fechamento (03-07) deve, na mesma transação, gravar `cash_movements` (um por pagamento não-crédito, e o troco como saída em dinheiro, D-07), `client_credit_movements` (débito para `client_credit`), estoque e comissões, e incrementar `close_cycle`. `computeComandaTotals` já dá `canClose`/`error` (`INSUFFICIENT_PAYMENT`, `INVALID_CHANGE`); no fechamento recalcule com os pagamentos travados (a comanda já é travada com `FOR UPDATE`).
- **Validação de pagamento (addPayment):** método fora de `PAYMENT_METHODS` -> `INVALID_METHOD`; valor via `parseMoneyInput` (só ponto, até 2 casas) -> `INVALID_AMOUNT`; crédito acima do saldo (soma do ledger menos o já lançado na comanda) -> `CREDIT_INSUFFICIENT`; não-dinheiro acima do total -> `NON_CASH_EXCEEDS_TOTAL`. Se os itens forem removidos depois de pagar, o total cai e `canClose` pode virar `INVALID_CHANGE`; o fechamento deve revalidar.
- **Comissão (D-23):** a base é `comanda_items.list_unit_price * quantity`, não `unit_price`/`total`; guarde ambos no `rule_snapshot`. Para item avulso `list_unit_price == unit_price`.
- **Remoção de item** vinculado a agendamento é bloqueada (`ITEM_LINKED_TO_APPOINTMENT`); o caminho é cancelar o agendamento (03-03). Itens de produto usam `professionalId` como vendedor (qualquer membro ativo).
- **Códigos de erro desta plan:** NOT_FOUND, COMANDA_NOT_OPEN, CLIENT_REQUIRED, CLIENT_NOT_FOUND, INVALID_NAME, INVALID_PHONE, INVALID_QUANTITY, INVALID_KIND, SERVICE_NOT_FOUND, PRODUCT_NOT_FOUND, PACKAGE_NOT_FOUND, VARIANT_NOT_FOUND, PROFESSIONAL_NOT_FOUND, MEMBER_NOT_FOUND, PROFESSIONAL_DOES_NOT_SERVE_CATEGORY, MISSING_ASSIGNMENT, ITEM_NOT_FOUND, ITEM_LINKED_TO_APPOINTMENT, PAYMENT_NOT_FOUND, INVALID_METHOD, INVALID_AMOUNT, CREDIT_INSUFFICIENT, NON_CASH_EXCEEDS_TOTAL.
- **Listagem:** `comandas(from, to)` usa datas locais no fuso da org (to exclusivo), limite 200; PROFESSIONAL só vê comandas com item dele. `comanda(id)` devolve `null` para comanda de outra org (RLS) ou fora do escopo.
- **Clientes sem contato** agora existem no banco (walk-in); telas/consultas que assumam phone ou email preenchidos devem tratar null.
- Testes novos que criem comandas: `deletePhase3Rows` já limpa tudo, incluindo `comanda_sequences` (útil para reiniciar a numeração por teste).

## Self-Check: PASSED

---
phase: 03-core-operations
plan: 05
subsystem: backend-financial
tags: [financeiro, dashboard, credito, caixa, comissoes, audit, graphql, rls]
requires: [03-01]
provides:
  - common/audit-log.ts (recordAudit)
  - financial/client-credit.ts (lockClient, getCreditBalanceCents, recordCreditMovement, CreditError)
  - financial/cash-ledger.ts (recordCashMovement)
  - financial/client-credit.service.ts (balances, movements, balance, adjust)
  - financial/financial.service.ts (summary, cashMovements, commissionRecords, commissionTotals)
  - financial.graphql (financialSummary, cashMovements, commissionRecords, commissionTotals, clientCreditBalances, clientCreditMovements, adjustClientCredit)
affects: [03-06, 03-07, 03-09]
tech-stack:
  added: []
  patterns: ["helpers de ledger recebem tx e nunca abrem transação", "dashboard em SQL direto com AT TIME ZONE da org e generate_series (sem buracos)", "unidade do date_trunc via whitelist + Prisma.raw"]
key-files:
  created:
    - apps/backend/src/common/audit-log.ts
    - apps/backend/src/financial/client-credit.ts
    - apps/backend/src/financial/cash-ledger.ts
    - apps/backend/src/financial/client-credit.service.ts
    - apps/backend/src/financial/financial.service.ts
    - apps/backend/src/financial/financial.resolver.ts
    - apps/backend/src/graphql/schema/financial.graphql
    - apps/backend/test/integration/phase3-client-credit.e2e.spec.ts
    - apps/backend/test/integration/phase3-financial-dashboard.e2e.spec.ts
  modified:
    - apps/backend/src/financial/financial.module.ts
key-decisions:
  - "Ajuste manual de crédito não gera cash_movements (devolução em dinheiro fica fora do caixa nesta fase)"
  - "Erros de validação de período/granularidade no dashboard são BadRequestException (leitura), não payload"
  - "commissionsTotal e comissões usam calculated_at no fuso da org"
requirements-completed: []  # FIN-01/FIN-02/SCHED-04/POS-02: backend de leitura/ledger entregue; UI vem nos planos 09-11, seguem Pending
duration: ~50min
completed: 2026-11-02
---

# Phase 3 Plan 05: Financeiro e crédito no backend Summary

Helpers transacionais de crédito de cliente (com lock e saldo nunca negativo), caixa e auditoria, mais o dashboard financeiro D-22 em SQL direto: Faturado (comandas fechadas pela data local de fechamento) e Recebido (cash_movements, com breakdown por método) em buckets dia/semana/mês sem buracos no fuso da org, listas de caixa e comissões com escopo do PROFESSIONAL, saldos/extrato e ajuste manual de crédito.

## Tasks

1. Helpers de crédito/caixa/auditoria + ClientCreditService (saldos, extrato, ajuste) - `a8ba2fe`
2. financial.graphql, FinancialService (summary, caixa, comissões), resolver com RBAC - commit seguinte

## Testes

- Unit backend: 90 (inalterado)
- Integração backend: 232 (25 suítes; +15: credit 6, dashboard 9)
- Frontend vitest: 238 (inalterado). lint e typecheck verdes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no teste do plano] Expectativa da semana**
- O plano dizia que o bucket "2030-03-04" "contém o sinal"; como os pagamentos de 09 e 10/03 caem na mesma semana, `received` da semana é 285,00 (50 + 135 + 100), não 50,00. Teste ajustado para o valor correto; a lógica está certa.

**2. Extras de teste**
- Casos adicionais: `CLIENT_NOT_FOUND` no lock, `cashMovements` com código da comanda e cliente, intervalo > 400 dias / invertido / granularidade inválida, `adjustClientCredit` via GraphQL (ATTENDANT negado, MANAGER ok) e `clientCreditBalances` para ATTENDANT.

## Known Stubs

None.

## Requisitos

FIN-01, FIN-02, SCHED-04 e POS-02 permanecem **Pending**: o backend de leitura e os ledgers existem, mas depósito (03-06), fechamento (03-07) e telas (03-09/03-11) ainda não.

## Notas para os próximos planos

- **Assinaturas (todas recebem `tx: TenantPrismaClient` e nunca abrem transação):**
  - `lockClient(tx, clientId)` - `FOR UPDATE` em `clients`; lança `CreditError('CLIENT_NOT_FOUND')`. Chame antes de qualquer `recordCreditMovement`/leitura de saldo que decida algo (serializa uso concorrente do crédito). Se também travar a comanda, trave a comanda primeiro e o cliente depois (ordem única evita deadlock).
  - `getCreditBalanceCents(tx, clientId): Promise<number>`.
  - `recordCreditMovement(tx, { orgId, clientId, amountCents (±, inteiro, ≠0), kind: 'deposit'|'manual_adjustment'|'consumption'|'reopen_refund', appointmentId?, comandaId?, cycle?, reason?, createdBy })` - lança `CreditError('CREDIT_INSUFFICIENT')` se o saldo ficaria negativo. Depósito (03-06) = `+` com kind `deposit`; fechamento com método crédito (03-07) = `-` com kind `consumption`; reabertura = `+` `reopen_refund`.
  - `recordCashMovement(tx, { orgId, kind: 'deposit_in'|'payment_in'|'change_out'|'reversal', method, amountCents (com sinal), comandaId?, appointmentId?, clientId?, cycle?, memberId?, occurredAt?, note? })` - `amountCents === 0` é ignorado. Troco = `change_out` negativo em `cash`; estorno na reabertura = `reversal` negativo. O crédito NÃO gera cash movement (o dinheiro já entrou como sinal).
  - `recordAudit(tx, { orgId, actorMemberId, action, entityType, entityId, reason?, metadata? })`. Já usado com `credit.adjust`.
  - `CreditError` tem `code`; traduza fora da transação (no 03-07, mapear `CREDIT_INSUFFICIENT` para o erro de pagamento da comanda).
- **Dashboard:** "Recebido" soma `cash_movements.amount` com sinal, por `occurred_at` no fuso da org; para o depósito aparecer no dia correto, grave `occurredAt` = momento do recebimento. "Faturado" depende de `comandas.status='closed'` e `closed_at`: o 03-07 deve gravar `closed_at` ao fechar e **limpar/mudar o status** ao reabrir (reaberta sai do faturado). `commissionsTotal` soma `calculated_amount` por `calculated_at` (reversões negativas abatem), então o 03-07 deve gravar `reversal` com `calculated_amount` negativo.
- **Comissões:** `commissionRecords` devolve `itemName` de `rule_snapshot->>'itemName'`; o 03-07 deve gravar `itemName` no `rule_snapshot` (e `reversed` é calculado por `reverses_record_id`). `noRuleCount` conta `no_rule` não revertidos.
- **Fixtures de dashboard:** testes que precisam de comandas fechadas inserem via `adminPrisma.comanda.create` com `status:'closed'`, `closedAt`, `closedBy` e `closeCycle:1` (constraint `chk_comandas_closed`); `commission_records` exigem `comandaItemId` existente.
- **Permissões:** financeiro (`financial.read`) é só ADMIN/MANAGER; `commissionRecord.read` também PROFESSIONAL (filtro forçado); `credit.read` inclui ATTENDANT; `credit.adjust` só ADMIN/MANAGER.
- **GraphQL:** `ClientCreditPayload.errors` usa `UserError` com `code` `INVALID_AMOUNT | REASON_REQUIRED | CREDIT_NEGATIVE | CLIENT_NOT_FOUND`. Erros de período do dashboard vêm como erro GraphQL (BadRequest, pt-BR).

## Self-Check: PASSED

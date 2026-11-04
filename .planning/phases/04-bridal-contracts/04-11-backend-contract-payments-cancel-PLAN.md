---
phase: 04-bridal-contracts
plan: 11
type: execute
wave: 4
depends_on: ["04-06", "04-08"]
files_modified:
  - apps/backend/src/financial/cash-ledger.ts
  - apps/backend/src/contracts/payments/contract-payments.ts
  - apps/backend/src/contracts/payments/contract-payments.service.ts
  - apps/backend/src/contracts/payments/contract-payments.resolver.ts
  - apps/backend/src/contracts/payments/contract-payments.module.ts
  - apps/backend/src/graphql/schema/contract-payments.graphql
  - apps/backend/test/integration/phase4-contract-payments.e2e.spec.ts
  - apps/backend/test/integration/phase4-contract-cancel.e2e.spec.ts
autonomous: true
requirements: [CONT-01, CONT-03]

must_haves:
  truths:
    - "Recepção registra pagamento do contrato (entrada ou restante) com um ou mais métodos, parcial, gerando cash_movements 'contract_in' (D-13)"
    - "Pagamento que passa do total é rejeitado; ledger de pagamentos é imutável e correções são estornos (reversal) com motivo, só ADMIN/MANAGER"
    - "Cancelamento exige motivo e ADMIN/MANAGER; pela noiva retém tudo o que foi pago, pelo estúdio devolve tudo com saída no caixa (D-19, D-22)"
    - "Cancelar o contrato cancela os agendamentos vinculados a ele com o mesmo motivo e revoga o link"
    - "Antes de confirmar, o operador vê a prévia do acerto (pago, retido, devolvido)"
  artifacts:
    - path: "apps/backend/src/contracts/payments/contract-payments.ts"
      exports: ["recordContractPaymentsTx", "reverseContractPaymentTx", "cancelContractTx"]
    - path: "apps/backend/src/graphql/schema/contract-payments.graphql"
      contains: "cancelContract"
  key_links:
    - from: "contract-payments.ts"
      to: "recordCashMovement (kind contract_in / contract_refund / reversal, contractId)"
      via: "mesma transação"
      pattern: "contract_in"
    - from: "cancelContractTx"
      to: "computeCancellationSettlement + cancelGroupAppointmentsTx + rebuildTravelBlocksTx"
      via: "04-02 e 04-08"
      pattern: "computeCancellationSettlement"
---

<objective>
Pagamentos do contrato (D-11, D-13), estornos e cancelamento com acerto (CONT-03; D-19, D-22): ledger `contract_payments` + caixa, prévia do acerto, reembolso no caixa quando o estúdio cancela, cancelamento dos agendamentos vinculados.

Purpose: completa o ciclo financeiro do contrato que o dashboard (04-07) já sabe somar e que os alertas (04-10) acompanham.
Output: `contract-payments.graphql`, ContractPaymentsModule preenchido, extensão de `cash-ledger.ts`, 2 suítes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-06-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-08-SUMMARY.md
@apps/backend/src/financial/cash-ledger.ts
@apps/backend/src/comandas/comanda-close.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase3 phase4`.

<interfaces>
```typescript
// cash-ledger.ts (atual)
export type CashKind = 'deposit_in' | 'payment_in' | 'change_out' | 'reversal';
export type CashMethod = 'cash' | 'pix' | 'credit_card' | 'debit_card' | 'transfer';
export async function recordCashMovement(tx, a: { orgId; kind; method; amountCents; comandaId?; appointmentId?; clientId?; cycle?; memberId?; occurredAt?; note? }): Promise<void>;
// 04-02
computeCancellationSettlement({ party: 'client'|'studio'; paidCents }): { retainedCents; refundCents }
// 04-06
lockContract(tx, id): Promise<LockedContract>; loadContractView(tx, orgId, id); ContractError; mapContractError; type ContractPayload (SDL)
// 04-08
cancelGroupAppointmentsTx(tx, orgId, memberId, { groupId, contractId?, reason }): Promise<number>
rebuildTravelBlocksTx(tx, orgId, memberId, groupId): Promise<void>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ledger de pagamentos do contrato, estorno e cancelamento (funções transacionais)</name>
  <files>apps/backend/src/financial/cash-ledger.ts, apps/backend/src/contracts/payments/contract-payments.ts</files>
  <read_first>
    - apps/backend/src/financial/cash-ledger.ts
    - apps/backend/src/contracts/contract-lock.ts e contract-errors.ts (04-06)
    - apps/backend/src/bridal/bridal-schedule.ts (04-08: cancelGroupAppointmentsTx, rebuildTravelBlocksTx)
    - apps/backend/src/contracts/domain/cancellation-policy.ts (04-02)
  </read_first>
  <action>
1. `cash-ledger.ts`: `CashKind` += `'contract_in' | 'contract_refund'`; parâmetro opcional `contractId?: string | null` gravado em `contractId`.
2. `contract-payments.ts`:
   - `recordContractPaymentsTx(tx, orgId, memberId, contractId, lines: { method: string; amount: string }[], note?: string | null)`: 1..5 linhas (`PAYMENT_LINES_REQUIRED`/`TOO_MANY_LINES`); método ∈ CASH_METHODS (`INVALID_METHOD`); `parseMoneyInput` > 0 (`INVALID_AMOUNT`); `lockContract`; status ∈ {draft, awaiting_acceptance, active} (`CONTRACT_NOT_PAYABLE`); `Σ contract_payments.amount + Σ linhas ≤ total_amount` senão `OVERPAYMENT` ("O valor passa do saldo do contrato (R$ x)."). Para cada linha: `contract_payments { kind 'payment', method, amount, paid_at = now, member_id, note }` + `recordCashMovement({ kind: 'contract_in', method, amountCents, contractId, clientId: bride_client_id, memberId, occurredAt: now, note: code })`. `recordAudit('contract.payment', metadata { lines })`.
   - `reverseContractPaymentTx(tx, orgId, memberId, paymentId, reason)`: motivo ≥ 3 (`REASON_REQUIRED`); pagamento `kind 'payment'` existe (`PAYMENT_NOT_FOUND`); `lockContract`; já estornado (`ALREADY_REVERSED`; P2002 em `uq_cp_reverses` também mapeia para isso); insere `kind 'reversal'`, `amount = −original`, `reverses_payment_id`, `note = reason` + caixa `kind 'reversal'` mesmo método, `contractId`, negativo; audit `contract.payment.reverse`.
   - `previewCancellationTx(tx, contractId, party)` → `{ paidCents, retainedCents, refundCents }` via `computeCancellationSettlement({ party, paidCents: max(0, Σ amount) })`.
   - `cancelContractTx(tx, orgId, memberId, { contractId; party: 'client' | 'studio'; reason; refundMethod?: string | null })`: motivo ≥ 3; party válido (`INVALID_PARTY`); `lockContract`; status ≠ cancelled/completed (`CONTRACT_NOT_CANCELLABLE`); settlement; `refundCents > 0` exige `refundMethod` ∈ CASH_METHODS (`REFUND_METHOD_REQUIRED`) → `contract_payments { kind 'refund', amount −refund, method }` + caixa `contract_refund` negativo; `cancelGroupAppointmentsTx(tx, orgId, memberId, { groupId, contractId, reason })` (só os agendamentos vinculados ao contrato — D-19) e depois `rebuildTravelBlocksTx` (recria deslocamento dos agendamentos que ficaram, ex. madrinhas avulsas); revoga tokens abertos; contrato `status 'cancelled'`, `cancelled_at`, `cancelled_by`, `cancel_reason`, `cancelled_by_party`; audit `contract.cancel` com `metadata { party, paidCents, retainedCents, refundCents }`. Comandas fechadas não são tocadas (serviço prestado).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test:integration -- phase3-comanda-payments phase3-deposit-cancel</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "'contract_in' | 'contract_refund'\|'contract_in'" apps/backend/src/financial/cash-ledger.ts` encontra
    - `grep -n "OVERPAYMENT\|ALREADY_REVERSED\|REFUND_METHOD_REQUIRED\|CONTRACT_NOT_CANCELLABLE" apps/backend/src/contracts/payments/contract-payments.ts` encontra os 4
    - `grep -n "computeCancellationSettlement\|cancelGroupAppointmentsTx" apps/backend/src/contracts/payments/contract-payments.ts` encontra os 2
    - Suítes phase3 de pagamento continuam verdes
  </acceptance_criteria>
  <done>Regras financeiras do contrato implementadas sobre os helpers transacionais.</done>
</task>

<task type="auto">
  <name>Task 2: SDL, service, resolver e módulo de pagamentos/cancelamento</name>
  <files>apps/backend/src/graphql/schema/contract-payments.graphql, apps/backend/src/contracts/payments/contract-payments.service.ts, apps/backend/src/contracts/payments/contract-payments.resolver.ts, apps/backend/src/contracts/payments/contract-payments.module.ts</files>
  <read_first>
    - apps/backend/src/graphql/schema/contracts.graphql (ContractPayload — 04-06)
    - apps/backend/src/contracts/contracts.resolver.ts (padrão)
  </read_first>
  <action>
`contract-payments.graphql`:
```graphql
input ContractPaymentLineInput { method: String!  amount: String! }
input RecordContractPaymentInput { contractId: UUID!  lines: [ContractPaymentLineInput!]!  note: String }
input ReverseContractPaymentInput { paymentId: UUID!  reason: String! }
input CancelContractInput { contractId: UUID!  party: String!  reason: String!  refundMethod: String }
type ContractCancellationPreview { paid: String!  retained: String!  refund: String!  party: String! }
extend type Query { contractCancellationPreview(contractId: UUID!, party: String!): ContractCancellationPreview! }
extend type Mutation {
  recordContractPayment(input: RecordContractPaymentInput!): ContractPayload!
  reverseContractPayment(input: ReverseContractPaymentInput!): ContractPayload!
  cancelContract(input: CancelContractInput!): ContractPayload!
}
```
Service: cada mutation em `runWithTenant` → função da Task 1 → `loadContractView` no payload; erros → payload via `mapContractError` + `mapSchedulingError` (cancelamento pode propagar `COMANDA_CLOSED`). Resolver: `recordContractPayment` com `CONTRACT_PAYMENT`; `reverseContractPayment`, `cancelContract` e `contractCancellationPreview` com `CONTRACT_CANCEL` (ADMIN/MANAGER). Módulo: providers service + resolver; `imports` o que for preciso (ContractsModule para serialização, se exportada como função não precisa).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "cancelContract(input: CancelContractInput!): ContractPayload!" apps/backend/src/graphql/schema/contract-payments.graphql` encontra
    - `grep -n "CONTRACT_PAYMENT" apps/backend/src/contracts/payments/contract-payments.resolver.ts` encontra; `grep -c "CONTRACT_CANCEL" ...resolver.ts` ≥ 3
  </acceptance_criteria>
  <done>Pagamentos, estornos, prévia e cancelamento expostos no GraphQL com os papéis certos.</done>
</task>

<task type="auto">
  <name>Task 3: Suítes phase4-contract-payments e phase4-contract-cancel</name>
  <files>apps/backend/test/integration/phase4-contract-payments.e2e.spec.ts, apps/backend/test/integration/phase4-contract-cancel.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts (04-06: criação de grupo/contrato)
    - apps/backend/test/integration/phase4-bridal-schedule.e2e.spec.ts (04-08: agendar evento)
    - apps/backend/test/integration/phase3-client-credit.e2e.spec.ts (asserts de ledger imutável)
  </read_first>
  <action>
**phase4-contract-payments** (contrato R$ 8.000, entrada 2.400): (1) entrada 2.400 pix → `paid "2400.00"`, `depositPending "0.00"`, 1 `cash_movements` `contract_in` com `contract_id`; (2) restante livre: 3.000 dinheiro; depois uma chamada com 2 linhas (1.600 crédito + 1.000 débito) → `paid "8000.00"`, `settled true` (critério 2 "pagamentos parciais" reinterpretado); (3) +0,01 → `OVERPAYMENT`; (4) `financialSummary` do dia soma `contractBilledTotal` e `receivedByMethod` por método; (5) estorno do pagamento de 3.000 por manager com motivo → linha `reversal −3000`, caixa `reversal −3000`, `paid "5000.00"`, pagamento marcado `reversed true`; segundo estorno → `ALREADY_REVERSED`; (6) attendant registra pagamento ok e tenta estornar → permissão negada; (7) `appPrisma` (sgs_app, tenant setado) `UPDATE contract_payments` e `DELETE` → permission denied; (8) org B não paga contrato da A (`NOT_FOUND`).
**phase4-contract-cancel** (grupo agendado via `scheduleBridalEvent` com noiva coberta + 1 acompanhante avulsa; contrato com 2.400 pagos): (1) `contractCancellationPreview(party: "client")` → `retained "2400.00"`, `refund "0.00"`; `party: "studio"` → `refund "2400.00"`; (2) cancelar sem motivo → `REASON_REQUIRED`; attendant → permissão negada; (3) cancelamento pela noiva: nenhum `contract_refund`; agendamentos da noiva (`contract_id`) `cancelled` com o motivo; o da acompanhante avulsa continua `scheduled`; token revogado (GET público 404); contrato `cancelled`, `cancelledByParty "client"`; pagamento depois → `CONTRACT_NOT_PAYABLE`; (4) outro contrato cancelado pelo estúdio sem `refundMethod` → `REFUND_METHOD_REQUIRED`; com `pix` → `contract_payments refund −2400` + `cash_movements contract_refund −2400`, `paid "0.00"`; (5) após cancelar, `createContract` novo para o mesmo grupo é permitido (índice parcial `uq_contracts_group_live`); (6) `audit_log` tem `contract.cancel` com metadata de acerto.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-contract-payments phase4-contract-cancel</automated>
  </verify>
  <acceptance_criteria>
    - As 2 suítes verdes; `grep -n "REFUND_METHOD_REQUIRED" apps/backend/test/integration/phase4-contract-cancel.e2e.spec.ts` encontra
    - `grep -n "permission denied" apps/backend/test/integration/phase4-contract-payments.e2e.spec.ts` encontra
  </acceptance_criteria>
  <done>CONT-01 (pagamentos) e CONT-03 (retenção/devolução) provados por integração.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase3 phase4` verde.</verification>

<success_criteria>Dinheiro do contrato entra no caixa no dia pago; cancelamento aplica a política snapshot (cliente retém tudo, estúdio devolve tudo).</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-11-SUMMARY.md`
</output>

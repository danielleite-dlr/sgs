---
phase: 04-bridal-contracts
plan: 07
type: execute
wave: 2
depends_on: ["04-01"]
files_modified:
  - apps/backend/src/comandas/comanda-math.ts
  - apps/backend/src/comandas/comanda-math.spec.ts
  - apps/backend/src/comandas/comanda-close.ts
  - apps/backend/src/comandas/comanda-serialize.ts
  - apps/backend/src/graphql/schema/comandas.graphql
  - apps/backend/src/financial/financial.service.ts
  - apps/backend/src/graphql/schema/financial.graphql
  - apps/backend/test/integration/phase4-comanda-contract.e2e.spec.ts
  - apps/backend/test/integration/phase4-financial-dashboard.e2e.spec.ts
autonomous: true
requirements: [CONT-01]

must_haves:
  truths:
    - "Comanda de pessoa incluída no contrato fecha sem pagamento (a pagar = 0), registra comissão pelo preço cheio e baixa estoque (D-08)"
    - "Extra adicionado no dia é cobrado normalmente na mesma comanda"
    - "Fechar → reabrir → fechar a comanda coberta funciona sem gerar caixa para a parte coberta"
    - "Faturado do dia soma pagamentos de contrato por paid_at e só a parte não coberta das comandas (D-14) — sem dupla contagem"
    - "Ticket médio e contagem de comandas consideram só comandas com valor a pagar > 0 (D-25)"
    - "Para dados antigos (sem contrato) o dashboard dá exatamente o mesmo resultado de antes"
  artifacts:
    - path: "apps/backend/src/comandas/comanda-math.ts"
      exports: ["coveredCents", "computeComandaTotals"]
    - path: "apps/backend/src/financial/financial.service.ts"
      contains: "contract_payments"
  key_links:
    - from: "comanda-close.ts"
      to: "comanda_items.contract_id"
      via: "owed = total − Σ itens cobertos, passado a computeComandaTotals"
      pattern: "coveredCents"
    - from: "financial.service.ts CTE billed"
      to: "comanda_items.contract_id IS NOT NULL"
      via: "LEFT JOIN LATERAL subtraindo cobertura"
      pattern: "contract_id IS NOT NULL"
---

<objective>
Abatimento do contrato na comanda (D-08) e Faturado sem dupla contagem (D-14, D-25), pela modelagem "cobertura por item" (RESEARCH Pattern 3): `comanda_items.contract_id` marca itens cobertos; o fechamento cobra só o não coberto; o dashboard subtrai a cobertura e soma `contract_payments` por `paid_at`.

Purpose: os fluxos do evento (04-08) criam itens cobertos; este plano garante que fechar a comanda e o dashboard fiquem corretos. Independe do código de contratos/noivas — usa apenas o schema do 04-01 e fixtures SQL.
Output: regra de "a pagar" no backend, SDL da comanda com `covered/owed`, dashboard ajustado, 2 suítes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-01-SUMMARY.md
@apps/backend/src/comandas/comanda-close.ts
@apps/backend/src/comandas/comanda-math.ts
@apps/backend/src/comandas/comanda-serialize.ts
@apps/backend/src/financial/financial.service.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase3 phase4`. Este plano é o ÚNICO da fase que altera `src/comandas/*` e `src/financial/financial.service.ts`. O espelho do frontend (`features/operations/lib/money.ts`) é feito no 04-14.

<interfaces>
```typescript
// comanda-math.ts (atual)
export function computeComandaTotals(totalCents: number, payments: PaymentCents[]): ComandaTotals;
// comanda-close.ts: closeComandaTx(tx, orgId, memberId, comandaId, now) — usa recalcComandaTotal e depois
//   computeComandaTotals(toCents(total), payments); INSUFFICIENT_PAYMENT se paid < total.
// financial.service.ts summary(): CTE billed = SUM(total), COUNT(*) de comandas closed por closed_at local;
//   received = SUM(cash_movements.amount) por occurred_at; averageTicket = billedCents / closed.
// cashMovements(): LEFT JOIN comandas c ON c.id = m.comanda_id → comandaCode.
```
`contracts` e `contract_payments` (04-01): `contract_payments(amount assinado, paid_at)`; `cash_movements.contract_id`; `comanda_items.contract_id`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Regra de "a pagar" com cobertura (comanda-math, fechamento, serialização, SDL)</name>
  <files>apps/backend/src/comandas/comanda-math.ts, apps/backend/src/comandas/comanda-math.spec.ts, apps/backend/src/comandas/comanda-close.ts, apps/backend/src/comandas/comanda-serialize.ts, apps/backend/src/graphql/schema/comandas.graphql</files>
  <read_first>
    - apps/backend/src/comandas/comanda-math.ts e comanda-math.spec.ts
    - apps/backend/src/comandas/comanda-close.ts (closeComandaTx inteiro e reopenComandaTx)
    - apps/backend/src/comandas/comanda-serialize.ts (serializeComanda, includes)
    - apps/backend/src/graphql/schema/comandas.graphql (type Comanda, ComandaItem)
  </read_first>
  <behavior>
    - `coveredCents([{ totalCents: 10000, contractId: 'c1' }, { totalCents: 5000, contractId: null }])` → 10000
    - `computeComandaTotals(0, [])` → `canClose true`, `error null` (comanda 100% coberta)
    - `computeComandaTotals(5000, [])` → `INSUFFICIENT_PAYMENT`, `remainingCents 5000` (extra não pago)
  </behavior>
  <action>
1. `comanda-math.ts`: `export function coveredCents(items: { totalCents: number; contractId: string | null }[]): number`. Manter `computeComandaTotals` (já aceita totalCents=0); adicionar specs dos 3 casos acima ao spec existente.
2. `comanda-close.ts` (`closeComandaTx`): após `recalcComandaTotal`, calcular `covered = coveredCents(items.map(i => ({ totalCents: toCents(i.total), contractId: i.contractId })))` e chamar `computeComandaTotals(toCents(total) - covered, payments)`. A mensagem `INSUFFICIENT_PAYMENT` usa o restante sobre o "a pagar". Estoque e comissão continuam iterando TODOS os itens (D-08: comissão por `list_unit_price`, D-23 da fase 3). Nenhum `cash_movement` para a parte coberta. `EMPTY_COMANDA` continua exigindo ≥ 1 item. `reopenComandaTx`: sem mudança (nada a estornar na parte coberta) — apenas conferir.
3. `comanda-serialize.ts`: incluir `contractId` dos itens e o `code` do contrato (`include: { contract: { select: { code: true } } }`); `serializeComanda` calcula `covered` e passa `total − covered` a `computeComandaTotals`; expõe `covered: fromCents(covered)`, `owed: fromCents(total − covered)`; `remaining/change/canClose/closeError` passam a ser sobre o "a pagar". Item ganha `contractId`, `contractCode`.
4. `comandas.graphql`: `type Comanda` + `covered: String!` e `owed: String!` (doc: "Parte coberta por contrato de noiva (D-08); owed = total − covered"); item + `contractId: UUID` e `contractCode: String`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- comanda-math && corepack pnpm --filter @sgs/backend test:integration -- phase3-comanda</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function coveredCents" apps/backend/src/comandas/comanda-math.ts` encontra
    - `grep -n "coveredCents" apps/backend/src/comandas/comanda-close.ts apps/backend/src/comandas/comanda-serialize.ts` encontra nos 2
    - `grep -n "owed: String!" apps/backend/src/graphql/schema/comandas.graphql` encontra
    - Todas as suítes `phase3-comanda-*` continuam verdes
  </acceptance_criteria>
  <done>Comanda coberta fecha com a pagar = 0; extras cobrados normalmente.</done>
</task>

<task type="auto">
  <name>Task 2: Dashboard D-14/D-25 e origem do contrato na lista de caixa</name>
  <files>apps/backend/src/financial/financial.service.ts, apps/backend/src/graphql/schema/financial.graphql</files>
  <read_first>
    - apps/backend/src/financial/financial.service.ts (summary e cashMovements)
    - apps/backend/src/graphql/schema/financial.graphql (FinancialSummary, FinancialBucket, CashMovementEntry)
    - .planning/phases/04-bridal-contracts/04-RESEARCH.md ("Dashboard (trecho do CTE billed)")
  </read_first>
  <action>
1. `summary()`: substituir o CTE `billed` por dois CTEs:
```sql
billed_comandas AS (
  SELECT date_trunc(${u}, c.closed_at AT TIME ZONE ${tz})::date AS bucket,
         SUM(c.total - COALESCE(cov.v, 0)) AS v,
         COUNT(*) FILTER (WHERE c.total - COALESCE(cov.v, 0) > 0) AS n
    FROM comandas c
    LEFT JOIN LATERAL (SELECT SUM(i.total) AS v FROM comanda_items i
                        WHERE i.comanda_id = c.id AND i.contract_id IS NOT NULL) cov ON true
   WHERE c.status = 'closed'
     AND c.closed_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
     AND c.closed_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
   GROUP BY 1
), billed_contracts AS (
  SELECT date_trunc(${u}, p.paid_at AT TIME ZONE ${tz})::date AS bucket, SUM(p.amount) AS v
    FROM contract_payments p
   WHERE p.paid_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}
     AND p.paid_at <  (${to}::date)::timestamp AT TIME ZONE ${tz}
   GROUP BY 1
)
```
   e no SELECT final `(COALESCE(bc.v,0) + COALESCE(bk.v,0))::text AS billed`, `COALESCE(bk.v,0)::text AS billed_contracts`, `COALESCE(bc.v,0)::text AS billed_comandas`, `COALESCE(bc.n,0)::int AS n`. Totais: `billedTotal` = Σ billed (inclui contratos, assinado — reembolso reduz na data do reembolso); `contractBilledTotal` = Σ billed_contracts; `closedComandas` = Σ n (só a pagar > 0); `averageTicket = closed ? round(Σ billed_comandas / closed) : 0` (contratos fora do ticket — D-25). `received` não muda (já soma todos os kinds, inclusive `contract_in`/`contract_refund`); `receivedByMethod` idem.
2. `financial.graphql`: `FinancialSummary` + `contractBilledTotal: String!` (doc "Pagamentos de contrato de noiva por data de pagamento — D-14"); `FinancialBucket` + `billedContracts: String!`; `CashMovementEntry` + `contractId: UUID` e `contractCode: String`. `cashMovements()`: `LEFT JOIN contracts k ON k.id = m.contract_id` e expor `contractId/contractCode`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase3-financial-dashboard</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "billed_contracts\|contract_id IS NOT NULL" apps/backend/src/financial/financial.service.ts` encontra os 2
    - `grep -n "contractBilledTotal: String!" apps/backend/src/graphql/schema/financial.graphql` encontra
    - `phase3-financial-dashboard` continua verde sem alterar as expectativas (regressão de dados antigos)
  </acceptance_criteria>
  <done>Faturado/Recebido com contrato corretos, ticket médio protegido.</done>
</task>

<task type="auto">
  <name>Task 3: Suítes phase4-comanda-contract e phase4-financial-dashboard</name>
  <files>apps/backend/test/integration/phase4-comanda-contract.e2e.spec.ts, apps/backend/test/integration/phase4-financial-dashboard.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase3-comanda-flow.ts (buildFlow135, CLOSE, REOPEN, ADD_ITEM, ADD_PAY)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (insertBridalGroupRow, insertContractRow)
    - apps/backend/test/integration/phase3-financial-dashboard.e2e.spec.ts
  </read_first>
  <action>
**phase4-comanda-contract:** montar via fluxo da fase 3 uma visita (agendamento + comanda) da noiva; com `insertBridalGroupRow` + `insertContractRow`, marcar via adminPrisma os itens da comanda com `contract_id` (simula o 04-08). Casos: (1) fechar sem pagamento → ok, `owed "0.00"`, `covered` = total, nenhum `cash_movements` com `comanda_id` desta comanda, `commission_records` criados sobre `list_unit_price`, estoque baixa se houver produto coberto? (não — produto extra apenas); (2) adicionar produto extra (R$ 35) → `owed "35.00"`, fechar sem pagar → `INSUFFICIENT_PAYMENT` "Falta R$ 35,00"; pagar 35 em dinheiro → fecha, estoque −1, `cash_movements` só de 35; (3) reabrir (motivo) → fechar de novo → comissões revertidas e recriadas, caixa: estorno e novo pagamento só da parte extra; (4) comanda sem cobertura segue idêntica à fase 3 (`covered "0.00"`).
**phase4-financial-dashboard (Pitfall 4):** dia D: contrato R$ 8.000 (`insertContractRow`) com 3 `contract_payments` via adminPrisma (2400 em D−20, 3000 em D−10, 2600 em D, método pix) + `cash_movements` `contract_in` correspondentes; no dia D uma comanda 100% coberta (R$ 300 cobertos) fechada e outra comanda com R$ 300 cobertos + extra R$ 50 pago e fechada. Esperado no dia D: `billedTotal = 2600 + 50 = "2650.00"`, `contractBilledTotal "2600.00"`, `receivedTotal "2650.00"`, `closedComandas 1`, `averageTicket "50.00"`. Mês inteiro: `contractBilledTotal "8000.00"`. Reembolso (`refund −1000` + `contract_refund −1000`) em D+1 → `billedTotal` de D+1 = −1000. `cashMovements` lista `contractCode` nas linhas de contrato.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-comanda-contract phase4-financial-dashboard</automated>
  </verify>
  <acceptance_criteria>
    - As 2 suítes verdes; `grep -n "2650.00" apps/backend/test/integration/phase4-financial-dashboard.e2e.spec.ts` encontra
    - `grep -n "INSUFFICIENT_PAYMENT" apps/backend/test/integration/phase4-comanda-contract.e2e.spec.ts` encontra
  </acceptance_criteria>
  <done>D-08, D-14 e D-25 provados por integração com Postgres real.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase3 phase4` verde.</verification>

<success_criteria>Comanda coberta não cobra de novo; dashboard mostra o dinheiro do contrato no dia em que é pago, sem duplicar.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-07-SUMMARY.md`
</output>

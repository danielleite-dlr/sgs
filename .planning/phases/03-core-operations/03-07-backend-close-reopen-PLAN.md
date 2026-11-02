---
phase: 03-core-operations
plan: 07
type: execute
wave: 3
depends_on: ["03-03", "03-04", "03-05"]
files_modified:
  - apps/backend/src/financial/commission-resolver.ts
  - apps/backend/src/financial/commission-resolver.spec.ts
  - apps/backend/src/catalog/products/stock.ts
  - apps/backend/src/catalog/products/products.service.ts
  - apps/backend/src/comandas/comanda-close.ts
  - apps/backend/src/comandas/comanda-serialize.ts
  - apps/backend/src/comandas/comandas.service.ts
  - apps/backend/src/comandas/comandas.resolver.ts
  - apps/backend/src/graphql/schema/comandas.graphql
  - apps/backend/test/integration/phase3-comanda-close.e2e.spec.ts
  - apps/backend/test/integration/phase3-commission-records.e2e.spec.ts
  - apps/backend/test/integration/phase3-comanda-reopen.e2e.spec.ts
autonomous: true
requirements: [POS-03, FIN-02, POS-01]

must_haves:
  truths:
    - "Fechar a comanda com pago >= total (troco coberto por dinheiro) faz, numa única transação: status closed, baixa de estoque dos produtos, consumo do crédito, entradas de caixa por método (+ saída de troco), comissão por item e appointments concluídos (D-12, D-21)"
    - "Se qualquer passo falhar (pagamento insuficiente, troco inválido, estoque insuficiente, crédito insuficiente) nada é gravado"
    - "A comissão usa a regra mais específica (member_service > service > categoria (subindo a hierarquia) > default; produto > default) aplicada sobre o preço CHEIO do serviço, mesmo em item de pacote (D-23)"
    - "Item sem regra gera commission_record de R$ 0,00 com no_rule = true e a comanda devolve o aviso, sem bloquear o fechamento (D-24)"
    - "O snapshot (rule_snapshot) guarda regra, preço cheio (base) e valor cobrado; editar ou apagar a regra depois não altera o registro"
    - "Fechar duas vezes em paralelo fecha uma vez só"
    - "Reabrir exige comanda.reopen (ADMIN/MANAGER) e motivo; reverte estoque, comissão (registros reversal negativos), crédito e caixa, grava audit_log; fechar de novo gera ciclo novo"
  artifacts:
    - path: "apps/backend/src/financial/commission-resolver.ts"
      provides: "resolveCommissionRule, computeCommission, categoryChain (puros)"
      exports: ["resolveCommissionRule", "computeCommission", "categoryChain"]
    - path: "apps/backend/src/catalog/products/stock.ts"
      provides: "applyStockDelta(tx, …) sem transação própria"
      exports: ["applyStockDelta", "StockError"]
    - path: "apps/backend/src/comandas/comanda-close.ts"
      provides: "closeComandaTx, reopenComandaTx"
      exports: ["closeComandaTx", "reopenComandaTx"]
  key_links:
    - from: "comanda-close.closeComandaTx"
      to: "applyStockDelta / recordCreditMovement / recordCashMovement / resolveCommissionRule"
      via: "mesma tx, sem runWithTenant aninhado"
      pattern: "applyStockDelta\\(tx"
    - from: "products.service.adjustStock"
      to: "stock.applyStockDelta"
      via: "refatoração (mesma regra de estoque e notificação stock_low)"
      pattern: "applyStockDelta\\("
    - from: "comanda-close.reopenComandaTx"
      to: "commission_records kind='reversal'"
      via: "INSERT (nunca UPDATE)"
      pattern: "kind: 'reversal'"
---

<objective>
Implementar o fechamento financeiro atômico da comanda (D-12) com cálculo síncrono de comissão e snapshot imutável (D-14, D-23, D-24), baixa de estoque (D-21), consumo de crédito e lançamentos de caixa (D-07/D-22); e a reabertura auditada com reversões (D-08).

Purpose: critério de sucesso #3 (comissão automática com snapshot imutável) e o fechamento do critério #2 (pagamento dividido Pix + dinheiro).
Output: resolver de comissão puro e testado, `applyStockDelta` reutilizável, `closeComanda`/`reopenComanda`, campo `commissions` na Comanda, 3 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@.planning/phases/03-core-operations/03-04-SUMMARY.md
@.planning/phases/03-core-operations/03-05-SUMMARY.md
@apps/backend/src/catalog/products/products.service.ts
@apps/backend/src/catalog/commissions/commissions.service.ts
@apps/backend/src/identity/member-categories.ts
@apps/backend/src/comandas/comandas.service.ts
@apps/backend/src/comandas/comanda-math.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.

**Arquivos que este plano NÃO toca** (plano paralelo 03-06): `src/appointments/**`, `appointments.graphql`.

<interfaces>
Regras de comissão (Fase 2, `commission_rules`): `scope_type ∈ member_service | service | category | product | default`, `kind ∈ fixed | percentage`, `value Decimal(12,4)`, `member_id/service_id/category_id/product_id`, `deleted_at` (soft delete). Índices únicos parciais garantem ≤ 1 regra ativa por escopo/chave.
`loadCategoryParents(tx): Promise<Map<string, string|null>>` (identity/member-categories.ts; MAX_DEPTH 32 + visited).
`adjustStock(orgId, memberId, {productId, delta, reason})` atual: abre `runWithTenant` próprio, `SELECT ... FOR UPDATE` em products, recusa negativo (`STOCK_NEGATIVE`), grava `stock_movements type 'manual_adjustment'`, cria notificação `stock_low` idempotente ao cruzar o mínimo.
De 03-04: `computeComandaTotals(totalCents, payments[{method,cents}])` → `{ ..., changeCents, cashCents, creditCents, canClose, error }`; `loadComandaView(tx, id)`; `ComandaError(code,message,field)`; comandas.graphql com `type Comanda` e `ComandaPayload`.
De 03-05: `lockClient(tx, clientId)`, `recordCreditMovement(tx, {...kind 'consumption'|'reopen_refund'...})`, `CreditError`, `recordCashMovement(tx, {...kind 'payment_in'|'change_out'|'reversal'...})`, `recordAudit(tx, {...})`.
De 03-01: `toCents`, `fromCents`; PERMISSIONS `COMANDA_CLOSE`, `COMANDA_REOPEN`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: commission-resolver.ts (puro) + applyStockDelta extraído do adjustStock</name>
  <files>apps/backend/src/financial/commission-resolver.ts, apps/backend/src/financial/commission-resolver.spec.ts, apps/backend/src/catalog/products/stock.ts, apps/backend/src/catalog/products/products.service.ts</files>
  <read_first>
    - apps/backend/src/catalog/products/products.service.ts (adjustStock completo, linhas ~155–245)
    - apps/backend/src/catalog/commissions/commissions.service.ts (validateScopeShape: forma dos escopos)
    - apps/backend/src/identity/member-categories.ts (loop com visited/MAX_DEPTH)
    - apps/backend/test/integration/catalog-products.e2e.spec.ts e catalog-notifications.e2e.spec.ts (contrato atual do adjustStock que não pode quebrar)
  </read_first>
  <behavior>
    resolveCommissionRule(rules, item):
    - serviço com regras member_service(proA, S1), service(S1), category(C1), default → escolhe member_service quando memberId=proA; service quando memberId=proB
    - sem service rule, com category na categoria-pai (chain [filha, pai]) → escolhe a do pai; se houver na filha e no pai → filha
    - só default → default; nenhuma → null
    - produto: product(P1) > default; regra de service nunca casa com produto
    - regras com deletedAt != null são ignoradas
    categoryChain('filha', Map{filha→pai, pai→null}) = ['filha','pai']; ciclo Map{a→b, b→a} termina sem loop
    computeCommission(rule, { listUnitCents, quantity, chargedCents }):
    - percentage 40 sobre list 10000 qty 1 → baseCents 10000, amountCents 4000
    - item de pacote: list 10000, charged 9000, percentage 40 → base 10000, amount 4000 (D-23: nunca 3600)
    - percentage 33.3333 sobre 10000 → 3333 (half-up)
    - fixed "15.0000", quantity 2 → amount 3000 (fixo por unidade)
    - rule null → { noRule: true, amountCents: 0, baseCents: list*qty }
  </behavior>
  <action>
**financial/commission-resolver.ts** (sem I/O; usa só `Prisma.Decimal` para aritmética):
```ts
export type RuleLite = { id: string; scopeType: 'member_service'|'service'|'category'|'product'|'default'; kind: 'fixed'|'percentage'; value: string; memberId?: string|null; serviceId?: string|null; categoryId?: string|null; productId?: string|null; deletedAt?: Date|null };
export type ItemForRule = { kind: 'service'|'product'; memberId: string; serviceId?: string|null; productId?: string|null; categoryChain: string[] };
export function categoryChain(categoryId: string | null, parents: ReadonlyMap<string, string|null>): string[]; // filha → raiz, visited + MAX_DEPTH 32
export function resolveCommissionRule(rules: RuleLite[], item: ItemForRule): { rule: RuleLite; matchedCategoryId: string | null } | null;
export function computeCommission(match: { rule: RuleLite } | null, a: { listUnitCents: number; quantity: number; chargedCents: number }): { baseCents: number; chargedCents: number; amountCents: number; noRule: boolean };
```
Precedência (Fase 2 D-18, "uma regra, do mais específico ao geral"): serviço → `member_service(memberId, serviceId)` → `service(serviceId)` → `category(c)` para `c` em `categoryChain` na ordem → `default`; produto → `product(productId)` → `default`. Filtrar `deletedAt` não nulo antes. `baseCents = listUnitCents * quantity` SEMPRE (D-23: preço cheio; desconto do pacote é absorvido pelo salão). `percentage`: `new Prisma.Decimal(baseCents).mul(value).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber()`; `fixed`: `toCents(value) * quantity` (fixo por unidade — documentar em comentário e no snapshot `fixedPer: 'unit'`). Sem regra → `{ noRule: true, amountCents: 0 }` (D-24).
Spec com os casos do `<behavior>` primeiro.

**catalog/products/stock.ts**:
```ts
export class StockError extends Error { constructor(public readonly code: 'NOT_FOUND' | 'STOCK_INSUFFICIENT', message: string, public readonly productId: string) { super(message); } }
/** Recebe tx (NÃO abre transação). SELECT ... FROM products WHERE id = $1 FOR UPDATE; newQty < 0 → StockError('STOCK_INSUFFICIENT', `Estoque insuficiente de ${name} (disponível: ${qty}).`); atualiza stock_quantity; cria stock_movements(delta, type, reason, performedBy, comandaId); notificação stock_low idempotente (mesma lógica de hoje). */
export async function applyStockDelta(tx: TenantPrismaClient, a: { orgId: string; productId: string; delta: number; type: 'manual_adjustment' | 'sale' | 'return'; reason: string | null; performedBy: string | null; comandaId?: string | null }): Promise<{ product: Product; newQty: number }>;
```
Mover o corpo de `adjustStock` (lock, cálculo, update, movement, notificação) para `applyStockDelta`; `adjustStock` passa a ser `runWithTenant(orgId, async (tx) => { try { const r = await applyStockDelta(tx, { ..., type: 'manual_adjustment' }); return { product: r.product, errors: [] }; } catch (e) { if (e instanceof StockError) return e.code === 'NOT_FOUND' ? err('NOT_FOUND','Produto não encontrado.') : err('STOCK_NEGATIVE','Estoque resultante seria negativo.','delta'); throw e; } })` — mensagens e códigos públicos do `adjustStock` permanecem idênticos.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- commission-resolver && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "catalog-products|catalog-notifications"</automated>
  </verify>
  <acceptance_criteria>
    - commission-resolver.ts exporta `resolveCommissionRule`, `computeCommission`, `categoryChain` e não importa `TenantContextService` nem `PrismaService`
    - commission-resolver.spec.ts tem ≥ 12 casos e passa (inclui o caso de pacote base 10000 / amount 4000)
    - stock.ts contém `FOR UPDATE` e `STOCK_INSUFFICIENT` e não contém `runWithTenant`
    - products.service.ts `adjustStock` chama `applyStockDelta(`
    - catalog-products e catalog-notifications continuam verdes
  </acceptance_criteria>
  <done>Regra de comissão determinística e testada; baixa de estoque utilizável dentro do fechamento sem perder atomicidade.</done>
</task>

<task type="auto">
  <name>Task 2: closeComandaTx (transação única, idempotente) + mutação closeComanda + suítes close e commission-records</name>
  <files>apps/backend/src/comandas/comanda-close.ts, apps/backend/src/comandas/comanda-serialize.ts, apps/backend/src/comandas/comandas.service.ts, apps/backend/src/comandas/comandas.resolver.ts, apps/backend/src/graphql/schema/comandas.graphql, apps/backend/test/integration/phase3-comanda-close.e2e.spec.ts, apps/backend/test/integration/phase3-commission-records.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/comandas/comandas.service.ts, comanda-serialize.ts, comanda-math.ts (03-04)
    - apps/backend/src/financial/client-credit.ts, cash-ledger.ts (03-05)
    - apps/backend/src/graphql/schema/comandas.graphql
    - .planning/phases/03-core-operations/03-RESEARCH.md "Pattern 4" e "Pattern 5"
  </read_first>
  <action>
**comandas.graphql** — acrescentar:
```graphql
extend type Mutation {
  closeComanda(id: UUID!): ComandaPayload!
  reopenComanda(input: ReopenComandaInput!): ComandaPayload!
}
input ReopenComandaInput { id: UUID! reason: String! }
type ComandaCommission { id: UUID! comandaItemId: UUID! memberId: UUID! memberName: String! itemName: String! kind: String! cycle: Int! baseAmount: String! chargedAmount: String! calculatedAmount: String! noRule: Boolean! reversed: Boolean! }
```
e no `type Comanda`: `commissions: [ComandaCommission!]!` (registros do ciclo atual, accrual + reversal) e `hasCommissionWarnings: Boolean!` (= existe accrual `noRule` não revertido no ciclo atual — D-24).
`comanda-serialize.ts`: carregar `commissionRecords` (`where: { cycle: comanda.closeCycle }`, include member) e derivar `reversed`; para PROFESSIONAL, o service filtra `commissions` para `memberId = tenant.memberId` antes de devolver.

**comanda-close.ts**:
```ts
export async function closeComandaTx(tx: TenantPrismaClient, orgId: string, memberId: string, comandaId: string, now = new Date()): Promise<void>;
```
Passos, nesta ordem, todos em `tx` (o chamador abre UM `runWithTenant(orgId, fn, { timeout: 15000, maxWait: 5000 })`):
1. `SELECT id, status, client_id, close_cycle FROM comandas WHERE id = $1 FOR UPDATE` → inexistente `NOT_FOUND`; `status <> 'open'` → `ComandaError('COMANDA_NOT_OPEN','A comanda não está aberta.')` (idempotência contra duplo clique/retry).
2. Carregar itens (`include service: { select: { categoryId } }`) e pagamentos; sem itens → `EMPTY_COMANDA` ("Adicione ao menos um item."). `recalcComandaTotal`; `totals = computeComandaTotals(totalCents, payments)`; `error === 'INSUFFICIENT_PAYMENT'` → `ComandaError('INSUFFICIENT_PAYMENT', \`Falta R$ ${remaining} para fechar.\`)`; `'INVALID_CHANGE'` → `ComandaError('INVALID_CHANGE','O troco só pode sair de pagamento em dinheiro.')`.
3. `cycle = close_cycle + 1`.
4. Crédito: se `totals.creditCents > 0` → `lockClient(tx, clientId)` → `recordCreditMovement(tx, { kind: 'consumption', amountCents: -creditCents, comandaId, cycle, createdBy: memberId })` (`CreditError` sobe e vira `CREDIT_INSUFFICIENT`).
5. Estoque: itens `product` ordenados por `productId` (evita deadlock) → `applyStockDelta(tx, { delta: -quantity, type: 'sale', reason: \`Venda ${code}\`, performedBy: memberId, comandaId })`. Coletar todos os `StockError` primeiro? Não — o primeiro erro aborta: traduzir para `ComandaError('STOCK_INSUFFICIENT', e.message)`.
6. Comissão: `rules = tx.commissionRule.findMany({ where: { deletedAt: null } })`, `parents = loadCategoryParents(tx)`; para cada item: `match = resolveCommissionRule(rules, { kind, memberId: item.professionalId, serviceId, productId, categoryChain: categoryChain(item.service?.categoryId ?? null, parents) })`; `c = computeCommission(match, { listUnitCents: toCents(item.listUnitPrice), quantity: item.quantity, chargedCents: toCents(item.total) })`; montar `{ organizationId, comandaId, comandaItemId: item.id, memberId: item.professionalId, kind: 'accrual', cycle, baseAmount: fromCents(c.baseCents), chargedAmount: fromCents(c.chargedCents), ruleId: match?.rule.id ?? null, ruleKind: match?.rule.kind ?? null, ruleValue: match?.rule.value ?? null, noRule: c.noRule, calculatedAmount: fromCents(c.amountCents), ruleSnapshot: { ruleId, scopeType, kind, value, memberId, serviceId, categoryId, productId, matchedCategoryId, baseAmount, chargedAmount, listUnitPrice, quantity, itemName: item.nameSnapshot, packageId: item.packageId, fixedPer: 'unit', noRule }, calculatedAt: now }` e gravar com UM `tx.commissionRecord.createMany` (discrição: batch).
7. Caixa: para cada pagamento com `method !== 'client_credit'` → `recordCashMovement(tx, { kind: 'payment_in', method, amountCents, comandaId, clientId, cycle, memberId, occurredAt: now })`; se `changeCents > 0` → `recordCashMovement(tx, { kind: 'change_out', method: 'cash', amountCents: -changeCents, ... })`.
8. `UPDATE comandas SET status='closed', closed_at=now, closed_by=memberId, close_cycle=cycle`.
9. `tx.appointment.updateMany({ where: { comandaId, status: { in: ['scheduled','confirmed','in_progress'] } }, data: { status: 'completed' } })`.

**comandas.service.ts** — `close(orgId, tenant, id)`: `runWithTenant` → `closeComandaTx` → `loadComandaView` → payload; `ComandaError`/`CreditError`/`StockError` → `errors[]` fora da transação. **resolver**: `closeComanda` com `@RequirePermission(PERMISSIONS.COMANDA_CLOSE)`.

**phase3-comanda-close.e2e.spec.ts** (prefixo `p3close`): regra service 40% para `serviceId` criada via adminPrisma.
1. Fluxo do critério #2 (sem depender do `createVisit` do 03-06, que roda em paralelo): `openWalkInComanda` (cliente do world) → `addComandaItem` serviço `serviceId` R$100 para proA → inserir via adminPrisma um appointment `in_progress` do proA com `comanda_id` da comanda e ligar o item (`UPDATE comanda_items SET appointment_id`) + o sinal como o 03-06 grava (`client_credit_movements kind 'deposit' +50.00` e `cash_movements kind 'deposit_in' method 'pix' 50.00`) → `addComandaItem` produto (R$35, qty 1, vendedor proA) → total "135.00" → pagamentos `client_credit 50.00`, `pix 50.00`, `cash 50.00` → `closeComanda` → status `closed`, `closedAt` não nulo, `closeCycle 1`, `change "15.00"`; estoque do produto 10 → 9 e `stock_movements` type `sale` com `comanda_id`; `cash_movements` do ciclo: `payment_in pix 50`, `payment_in cash 50`, `change_out cash -15` (+ o `deposit_in pix 50` da criação); saldo de crédito do cliente "0.00"; appointment `completed`.
2. Pagamento insuficiente → `INSUFFICIENT_PAYMENT` e nada mudou (status open, estoque, ledgers).
3. Estoque 0 do produto (via adminPrisma) → `STOCK_INSUFFICIENT` e nenhum commission_record/cash_movement/credit consumption criado.
4. Crédito consumido por outra comanda entre o add e o close (inserir consumption via adminPrisma) → `CREDIT_INSUFFICIENT`, rollback.
5. `Promise.all([closeComanda, closeComanda])` → um sucesso, outro `COMANDA_NOT_OPEN`; 1 único conjunto de comissões.
6. ATTENDANT fecha; PROFESSIONAL → erro de permissão.

**phase3-commission-records.e2e.spec.ts** (prefixo `p3comm`):
1. Regras: `service(serviceId) percentage 40`, `member_service(proA, serviceBId) fixed 30`, `category(childCategory) percentage 10`, sem default. Comanda com serviceId(proA) + serviceBId(proA) + serviceBId(proB) + produto(proB) → registros 40.00 / 30.00 / 5.00 (categoria 10% de 50) / 0.00 `noRule true`; `hasCommissionWarnings true`; `commissions` traz os 4.
2. Pacote (R$135: serviceId 100 + serviceBId 50) com proB nos dois → comissão do serviceId = 40.00 (40% de 100, não 36.00) e `rule_snapshot.baseAmount "100.00"`, `chargedAmount "90.00"`.
3. Após fechar: editar a regra service para 50% e soft-deletar a member_service → `commission_records` inalterados (valores e `rule_snapshot`).
4. `appPrisma` (sgs_app) em transação com `SET LOCAL app.current_organization`: `UPDATE commission_records SET calculated_amount = 0` e `DELETE FROM commission_records` → `permission denied`.
5. `commissionRecords(from,to)` (03-05) mostra os registros com `itemName` do snapshot.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-comanda-close|phase3-commission-records" && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - comanda-close.ts contém `FOR UPDATE`, `applyStockDelta(tx`, `kind: 'consumption'`, `kind: 'payment_in'`, `kind: 'change_out'`, `createMany`, `fixedPer: 'unit'` e não contém `runWithTenant` nem `.update(` em `commissionRecord`
    - comandas.graphql contém `closeComanda(id: UUID!): ComandaPayload!`, `hasCommissionWarnings: Boolean!`, `type ComandaCommission`
    - comandas.resolver.ts contém `PERMISSIONS.COMANDA_CLOSE`
    - as 2 suítes passam (≥ 6 e ≥ 5 casos)
  </acceptance_criteria>
  <done>Fechar comanda é atômico, idempotente e gera comissões com snapshot imutável, incluindo D-23 e D-24.</done>
</task>

<task type="auto">
  <name>Task 3: reopenComandaTx (reversões + audit_log) + mutação reopenComanda + suíte de reabertura</name>
  <files>apps/backend/src/comandas/comanda-close.ts, apps/backend/src/comandas/comandas.service.ts, apps/backend/src/comandas/comandas.resolver.ts, apps/backend/test/integration/phase3-comanda-reopen.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/comandas/comanda-close.ts (Task 2)
    - apps/backend/src/common/audit-log.ts (03-05)
    - .planning/phases/03-core-operations/03-CONTEXT.md D-08 e o adendo (D-14 esclarecido)
  </read_first>
  <action>
**comanda-close.ts** — `export async function reopenComandaTx(tx, orgId, memberId, comandaId, reason: string, now = new Date()): Promise<void>`:
1. `reason.trim().length < 3` → `ComandaError('REASON_REQUIRED','Informe o motivo da reabertura.','reason')`.
2. `SELECT ... FROM comandas WHERE id = $1 FOR UPDATE`; `status <> 'closed'` → `COMANDA_NOT_CLOSED`. `cycle = close_cycle`.
3. Estoque: net por produto = `SUM(delta)` de `stock_movements WHERE comanda_id = $1 GROUP BY product_id`; para cada net < 0, em ordem de `product_id` → `applyStockDelta(tx, { delta: -net, type: 'return', reason: \`Reabertura ${code}: ${reason}\`, comandaId })`.
4. Comissão: accruals `WHERE comanda_id = $1 AND cycle = cycle AND kind = 'accrual'` sem reversal existente → `createMany` de `{ ...mesmos campos (memberId, comandaItemId, baseAmount, chargedAmount, ruleId, ruleKind, ruleValue, noRule, ruleSnapshot), kind: 'reversal', cycle, calculatedAmount: fromCents(-toCents(orig.calculatedAmount)), reversesRecordId: orig.id, calculatedAt: now }`. NUNCA `update` (D-14, REVOKE).
5. Crédito: `consumo = -SUM(amount)` de `client_credit_movements WHERE comanda_id = $1 AND cycle = cycle AND kind = 'consumption'`; se > 0 → `lockClient` + `recordCreditMovement({ kind: 'reopen_refund', amountCents: consumo, comandaId, cycle })`.
6. Caixa: para cada `cash_movements WHERE comanda_id = $1 AND cycle = cycle AND kind IN ('payment_in','change_out')` → `recordCashMovement({ kind: 'reversal', method: m.method, amountCents: -toCents(m.amount), comandaId, clientId, cycle, memberId, occurredAt: now, note: \`Estorno ${code}\` })`. `deposit_in` não é estornado (o sinal continua sendo crédito do cliente).
7. `UPDATE comandas SET status='open', closed_at=NULL, closed_by=NULL` (close_cycle mantém; o próximo fechamento usa cycle+1).
8. `tx.appointment.updateMany({ where: { comandaId, status: 'completed' }, data: { status: 'in_progress' } })`.
9. `recordAudit(tx, { action: 'comanda.reopen', entityType: 'comanda', entityId: comandaId, reason, metadata: { cycle, total, code } })`.
Pagamentos (`comanda_payments`) permanecem; itens voltam a ser editáveis porque o status é `open`.

**service/resolver**: `reopen(orgId, tenant, { id, reason })` com `runWithTenant(..., { timeout: 15000, maxWait: 5000 })`; `@Mutation('reopenComanda') @RequirePermission(PERMISSIONS.COMANDA_REOPEN)` (ATTENDANT não tem — D-08). Motivo obrigatório para todos os papéis.

**phase3-comanda-reopen.e2e.spec.ts** (prefixo `p3reop`) — partir do fluxo fechado do caso 1 de `phase3-comanda-close` (montar de novo neste arquivo):
1. ATTENDANT → erro de permissão; MANAGER com `reason: ""` → `REASON_REQUIRED`; comanda `open` → `COMANDA_NOT_CLOSED`.
2. MANAGER com motivo "Erro de fechamento" → status `open`; estoque 9 → 10 com `stock_movements` type `return`; para cada accrual do ciclo 1 existe 1 `reversal` com valor oposto e `reverses_record_id`; `client_credit_movements` `reopen_refund +50.00` (saldo volta a "50.00"); soma de `cash_movements` com `comanda_id` e `cycle = 1` = 0.00; appointment `in_progress`; 1 linha em `audit_log` (`action 'comanda.reopen'`, `reason`).
3. `financialSummary` do dia não conta a comanda reaberta em `billedTotal` e o Recebido só mantém o sinal.
4. Remover o produto da comanda reaberta e fechar de novo → `closeCycle 2`; novos accruals com `cycle 2`; estoque continua 10; `commissionRecords` do período mostra os registros do ciclo 1 com `reversed true`.
5. Reabrir duas vezes em paralelo → um sucesso, outro `COMANDA_NOT_CLOSED`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-comanda|phase3-commission|phase3-financial" && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - comanda-close.ts exporta `reopenComandaTx` e contém `kind: 'reversal'`, `kind: 'reopen_refund'`, `type: 'return'`, `action: 'comanda.reopen'`, `REASON_REQUIRED`, `COMANDA_NOT_CLOSED`
    - `grep -n "reversed_at\|reversedAt" apps/backend/src` não retorna nada
    - comandas.resolver.ts contém `PERMISSIONS.COMANDA_REOPEN`
    - phase3-comanda-reopen.e2e.spec.ts passa (≥ 5 casos); todas as suítes `phase3-comanda*`, `phase3-commission*`, `phase3-financial*` verdes
  </acceptance_criteria>
  <done>Reabertura auditada, só para ADMIN/MANAGER, com reversões append-only de estoque, comissão, crédito e caixa; refechamento gera ciclo novo.</done>
</task>

</tasks>

<verification>
Gate completo verde; `test:integration -- --testPathPattern phase3-` verde (todas as suítes da fase até aqui).
</verification>

<success_criteria>
- Critério #3 do ROADMAP provado: comissão automática ao fechar, snapshot imutável (teste de edição de regra + REVOKE)
- Backend do critério #2 completo: sinal R$50 + produto + pagamento dividido Pix/dinheiro/crédito com troco e baixa de estoque
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-07-SUMMARY.md`
</output>

---
phase: 03-core-operations
plan: 04
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - apps/backend/src/comandas/comanda-math.ts
  - apps/backend/src/comandas/comanda-math.spec.ts
  - apps/backend/src/comandas/comanda-code.ts
  - apps/backend/src/comandas/comanda-items.ts
  - apps/backend/src/comandas/comanda-items.spec.ts
  - apps/backend/src/comandas/comanda-open.ts
  - apps/backend/src/comandas/comanda-serialize.ts
  - apps/backend/src/comandas/comandas.service.ts
  - apps/backend/src/comandas/comandas.resolver.ts
  - apps/backend/src/comandas/comandas.module.ts
  - apps/backend/src/graphql/schema/comandas.graphql
  - apps/backend/test/integration/phase3-comanda-code.e2e.spec.ts
  - apps/backend/test/integration/phase3-comanda-open.e2e.spec.ts
  - apps/backend/test/integration/phase3-comanda-payments.e2e.spec.ts
autonomous: true
requirements: [POS-01, POS-02, POS-03]

must_haves:
  truths:
    - "Atendente abre comanda walk-in escolhendo cliente existente ou cadastrando só nome + telefone opcional (sem CPF)"
    - "Toda comanda recebe código C-AAAA-NNN sequencial por organização, sem buraco nem duplicata sob concorrência, com o ano no fuso da org"
    - "Itens de serviço (com variante opcional) e de produto entram na comanda com profissional obrigatório e preço-snapshot; total recalculado a cada alteração"
    - "Pacote adicionado vira 1 item por unidade com preço cobrado rateado (soma exata = preço do pacote) e preço cheio guardado em list_unit_price (D-23)"
    - "Pagamentos aceitam cash, pix, credit_card, debit_card, transfer e client_credit; método inválido e valor ≤ 0 são recusados; crédito acima do saldo é recusado"
    - "A comanda devolve pago, falta e troco calculados (D-07) e não aceita alterações fora do status open"
    - "PROFESSIONAL só lê comandas em que tem item e não consegue alterar"
  artifacts:
    - path: "apps/backend/src/comandas/comanda-math.ts"
      provides: "computeComandaTotals (regra única de pago/falta/troco)"
      exports: ["computeComandaTotals"]
    - path: "apps/backend/src/comandas/comanda-code.ts"
      provides: "nextComandaCode(tx, orgId, now?)"
      exports: ["nextComandaCode", "formatComandaCode"]
    - path: "apps/backend/src/comandas/comanda-items.ts"
      provides: "buildServiceItem, buildProductItem, expandPackageItems, recalcComandaTotal, prorateUnits"
      exports: ["buildServiceItem", "buildProductItem", "expandPackageItems", "recalcComandaTotal"]
    - path: "apps/backend/src/comandas/comanda-open.ts"
      provides: "openComandaTx(tx, …) — reutilizado por createVisit (03-06)"
      exports: ["openComandaTx"]
    - path: "apps/backend/src/graphql/schema/comandas.graphql"
      provides: "Comanda, ComandaItem, ComandaPayment, comanda/comandas, openWalkInComanda, add/remove item, addComandaPackage, add/remove payment"
      contains: "type Comanda"
  key_links:
    - from: "comanda-open.openComandaTx"
      to: "comanda-code.nextComandaCode"
      via: "mesma transação"
      pattern: "nextComandaCode\\(tx"
    - from: "comandas.service add/remove item"
      to: "recalcComandaTotal"
      via: "chamada após cada alteração"
      pattern: "recalcComandaTotal\\("
    - from: "comanda-serialize"
      to: "computeComandaTotals"
      via: "campos paid/remaining/change"
      pattern: "computeComandaTotals\\("
---

<objective>
Construir o núcleo da comanda (POS) no backend: código curto, abertura (helper transacional reutilizável + walk-in), itens de serviço/produto/pacote com profissional por item e preço-snapshot, pagamentos parciais dos 6 métodos com cálculo de pago/falta/troco, leitura com escopo do PROFESSIONAL.

Purpose: POS-01..03 (exceto fechar/reabrir, que é o 03-07) e o helper `openComandaTx` que o 03-06 usa para abrir a comanda junto com o agendamento (D-05).
Output: módulo `comandas` preenchido, SDL `comandas.graphql`, regras puras testadas, 3 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@.planning/phases/03-core-operations/03-01-SUMMARY.md
@apps/backend/src/appointments/appointments.service.ts
@apps/backend/src/catalog/packages/packages.service.ts
@apps/backend/src/clients/clients.service.ts
@apps/backend/src/identity/member-categories.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.

**Arquivos que este plano NÃO toca** (planos paralelos): `src/appointments/**`, `appointments.graphql`, `src/financial/**`, `financial.graphql`, `src/database/**`, `app.module.ts`, `schema.prisma`, `permissions.catalog.ts`.

<interfaces>
De 03-01:
```ts
// common/money.ts
toCents(v: string | number | Prisma.Decimal): number; fromCents(c: number): string;
parseMoneyInput(s: string): number | null; splitProportional(weights: number[], totalCents: number): number[];
// PERMISSIONS (authz/permissions.catalog.ts)
COMANDA_READ 'comanda.read', COMANDA_WRITE 'comanda.write', CREDIT_READ 'credit.read'
// Prisma models: Comanda(code,status,total,openedAt,openedBy,closedAt,closeCycle,...), ComandaSequence(organizationId,year,lastValue),
// ComandaItem(kind,serviceId,serviceVariantId,productId,packageId,appointmentId,professionalId,nameSnapshot,quantity,listUnitPrice,unitPrice,total,createdBy),
// ComandaPayment(method,amount,paidAt,memberId), ClientCreditMovement(clientId,amount,kind,...)
```
Existentes: `professionalServesCategory(tx, memberId, categoryId)`; `TenantContext { organizationId, memberId, roleName }`; `@RequirePermission(...)`, `@CurrentTenant()`; `type UserError { code message field }` (auth.graphql); `type Client`, `type Member` já existem no SDL. Erros sempre como dado (`errors[]` no payload), nunca exceção GraphQL.
Fase 2: `ClientsService.create` exige phone OU email — o walk-in (D-06) NÃO usa esse método: cria o cliente direto com `tx.client.create` só com nome (+ telefone opcional).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Regras puras (comanda-math, rateio de pacote) + comanda-code + comanda-open</name>
  <files>apps/backend/src/comandas/comanda-math.ts, apps/backend/src/comandas/comanda-math.spec.ts, apps/backend/src/comandas/comanda-items.ts, apps/backend/src/comandas/comanda-items.spec.ts, apps/backend/src/comandas/comanda-code.ts, apps/backend/src/comandas/comanda-open.ts, apps/backend/test/integration/phase3-comanda-code.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/common/money.ts (03-01)
    - apps/backend/prisma/schema.prisma (modelos Comanda, ComandaSequence, ComandaItem, Organization.timezone)
    - .planning/phases/03-core-operations/03-RESEARCH.md seções "Pattern 3" e "Contador de comanda"
    - .planning/phases/03-core-operations/03-CONTEXT.md D-07, D-19, D-23
  </read_first>
  <behavior>
    computeComandaTotals(totalCents, payments[{method, cents}]):
    - (20000, [pix 10000, cash 12000]) → { totalCents:20000, paidCents:22000, remainingCents:0, changeCents:2000, cashCents:12000, nonCreditCents:22000, creditCents:0, canClose:true, error:null }
    - (20000, [pix 15000]) → remainingCents 5000, canClose false, error 'INSUFFICIENT_PAYMENT'
    - (10000, [pix 13000]) → changeCents 3000, canClose false, error 'INVALID_CHANGE'
    - (10000, [client_credit 5000, cash 5000]) → creditCents 5000, canClose true
    - (0, []) → canClose true (comanda zerada)
    prorateUnits(listUnitCents[], packagePriceCents):
    - ([10000, 5000], 13500) → [9000, 4500] (soma 13500)
    - ([10000, 10000, 10000], 10000) → soma exata 10000, resto no último ([3333, 3333, 3334])
    formatComandaCode(2026, 7) === 'C-2026-007'; formatComandaCode(2026, 1234) === 'C-2026-1234'
    integração (phase3-comanda-code):
    - 20 openComandaTx em paralelo (cada um em seu runWithTenant) → 20 códigos distintos C-<ano>-001..020 contíguos
    - nextComandaCode com now = 2027-01-01T02:30:00Z e timezone America/Sao_Paulo → código com ano 2026
    - transação que chama nextComandaCode e depois lança erro → próximo código não pula número
    - org B começa em C-<ano>-001 independente da org A
  </behavior>
  <action>
**comanda-math.ts** (regra ÚNICA de D-07, espelhada no frontend `lib/money.ts computePaymentSummary`):
```ts
export type PaymentCents = { method: string; cents: number };
export interface ComandaTotals { totalCents: number; paidCents: number; remainingCents: number; changeCents: number; cashCents: number; creditCents: number; nonCreditCents: number; canClose: boolean; error: 'INSUFFICIENT_PAYMENT' | 'INVALID_CHANGE' | null }
export function computeComandaTotals(totalCents: number, payments: PaymentCents[]): ComandaTotals;
```
`paid = Σ`, `remaining = max(0,total-paid)`, `change = max(0,paid-total)`, `cash = Σ method==='cash'`, `credit = Σ method==='client_credit'`, `nonCredit = paid - credit`; `error = paid < total ? 'INSUFFICIENT_PAYMENT' : change > cash ? 'INVALID_CHANGE' : null`; `canClose = error === null`.
Constantes exportadas no mesmo arquivo: `PAYMENT_METHODS = ['cash','pix','credit_card','debit_card','transfer','client_credit'] as const` e `CASH_METHODS = ['cash','pix','credit_card','debit_card','transfer'] as const` (sem voucher — D-09).

**comanda-items.ts**:
```ts
export function prorateUnits(listUnitCents: number[], packagePriceCents: number): number[]; // = splitProportional(listUnitCents, packagePriceCents)
/** Valida profissional ativo+isProfessional (PROFESSIONAL_NOT_FOUND), serviço não deletado (SERVICE_NOT_FOUND), professionalServesCategory (PROFESSIONAL_DOES_NOT_SERVE_CATEGORY), variante do serviço (VARIANT_NOT_FOUND). Preço cheio = variant.price ?? service.basePrice. */
export async function buildServiceItem(tx, a: { orgId: string; comandaId: string; serviceId: string; serviceVariantId?: string | null; professionalId: string; quantity: number; appointmentId?: string | null; createdBy: string }): Promise<Prisma.ComandaItemUncheckedCreateInput>;
/** Produto não deletado (PRODUCT_NOT_FOUND); vendedor = membro ativo da org (MEMBER_NOT_FOUND); preço = sale_price. Estoque NÃO é baixado aqui (só no fechamento — D-21). */
export async function buildProductItem(tx, a: { orgId; comandaId; productId; professionalId; quantity; createdBy }): Promise<Prisma.ComandaItemUncheckedCreateInput>;
/** Pacote: 1 item (quantity 1) por UNIDADE de cada package_services; listUnitPrice = preço cheio do serviço (variante da atribuição ou base_price); unitPrice = total = parte rateada (prorateUnits sobre package.price); packageId preenchido; nameSnapshot `${service.name} (${package.name})`. Exige uma atribuição {serviceId, professionalId, serviceVariantId?} para cada serviço distinto do pacote (MISSING_ASSIGNMENT). */
export async function expandPackageItems(tx, a: { orgId; comandaId; packageId; assignments: { serviceId: string; professionalId: string; serviceVariantId?: string | null; appointmentId?: string | null }[]; createdBy }): Promise<Prisma.ComandaItemUncheckedCreateInput[]>;
/** UPDATE comandas SET total = COALESCE(SUM(comanda_items.total),0) */
export async function recalcComandaTotal(tx, comandaId: string): Promise<void>;
```
Erros de validação lançados como `ComandaError(code, message, field)` (classe exportada de `comanda-items.ts`, mesmo formato do `SchedulingError`) e traduzidos para `errors[]` fora do `runWithTenant`. `name_snapshot` = nome do serviço/produto (+ ` — ${variant.name}` quando houver variante). `total = unitPrice * quantity` em centavos via `fromCents`.

**comanda-code.ts**:
```ts
export function formatComandaCode(year: number, n: number): string; // `C-${year}-${String(n).padStart(3,'0')}`
export async function nextComandaCode(tx: TenantPrismaClient, orgId: string, now: Date = new Date()): Promise<string>;
```
Implementação: `org = tx.organization.findUnique({ where:{ id: orgId }, select:{ timezone:true } })`; `year` via `tx.$queryRaw<{ y: number }[]>\`SELECT EXTRACT(YEAR FROM (${now}::timestamptz AT TIME ZONE ${org.timezone}))::int AS y\``; contador via
```sql
INSERT INTO comanda_sequences (organization_id, year, last_value) VALUES (${orgId}::uuid, ${year}, 1)
ON CONFLICT (organization_id, year) DO UPDATE SET last_value = comanda_sequences.last_value + 1
RETURNING last_value
```
(`$queryRaw` tagged template; sem SEQUENCE do Postgres — D-19 discrição).

**comanda-open.ts**:
```ts
export async function openComandaTx(tx: TenantPrismaClient, a: { orgId: string; clientId: string; openedBy: string; now?: Date }): Promise<Comanda>;
```
Valida cliente não deletado (CLIENT_NOT_FOUND via ComandaError), `code = await nextComandaCode(tx, a.orgId, a.now)`, cria `comandas(status 'open', total 0, openedBy)`.

**phase3-comanda-code.e2e.spec.ts** (prefixo `p3code`): usa `TenantContextService` do `world.app.get(...)` para rodar `openComandaTx` diretamente; casos do `<behavior>`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- comanda-math comanda-items && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-comanda-code</automated>
  </verify>
  <acceptance_criteria>
    - comanda-math.ts contém `'INVALID_CHANGE'`, `'INSUFFICIENT_PAYMENT'` e `'client_credit'` e não contém `voucher`
    - comanda-code.ts contém `ON CONFLICT (organization_id, year)` e `AT TIME ZONE` e não contém `nextval`
    - comanda-items.ts exporta `expandPackageItems`, `recalcComandaTotal`, `ComandaError`
    - specs unitários passam (≥ 8 casos); phase3-comanda-code passa (≥ 4 casos)
  </acceptance_criteria>
  <done>Regras de pagamento/rateio puras e testadas; código de comanda concorrência-safe e no fuso da org; abertura transacional reutilizável.</done>
</task>

<task type="auto">
  <name>Task 2: SDL comandas.graphql + ComandasService/Resolver (walk-in, itens, pacote, leitura com escopo)</name>
  <files>apps/backend/src/graphql/schema/comandas.graphql, apps/backend/src/comandas/comanda-serialize.ts, apps/backend/src/comandas/comandas.service.ts, apps/backend/src/comandas/comandas.resolver.ts, apps/backend/src/comandas/comandas.module.ts, apps/backend/test/integration/phase3-comanda-open.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/comandas/comandas.module.ts (vazio, de 03-01)
    - apps/backend/src/appointments/appointments.resolver.ts (padrão de resolver, scopeProfessionalFilter)
    - apps/backend/src/graphql/schema/clients.graphql (type Client) e identity.graphql (type Member)
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
  </read_first>
  <action>
**comandas.graphql**:
```graphql
extend type Query {
  comanda(id: UUID!): Comanda
  "from/to = datas locais YYYY-MM-DD no fuso da org; to exclusivo; filtra por opened_at"
  comandas(from: String!, to: String!, status: String, clientId: UUID): [Comanda!]!
}
extend type Mutation {
  openWalkInComanda(input: OpenWalkInComandaInput!): ComandaPayload!
  addComandaItem(input: AddComandaItemInput!): ComandaPayload!
  removeComandaItem(comandaId: UUID!, itemId: UUID!): ComandaPayload!
  addComandaPackage(input: AddComandaPackageInput!): ComandaPayload!
  addComandaPayment(input: AddComandaPaymentInput!): ComandaPayload!
  removeComandaPayment(comandaId: UUID!, paymentId: UUID!): ComandaPayload!
}
type Comanda {
  id: UUID!
  code: String!
  status: String!
  clientId: UUID!
  client: Client!
  openedAt: DateTime!
  closedAt: DateTime
  closeCycle: Int!
  total: String!
  paid: String!
  remaining: String!
  change: String!
  canClose: Boolean!
  closeError: String
  clientCreditBalance: String!
  items: [ComandaItem!]!
  payments: [ComandaPayment!]!
  appointmentIds: [UUID!]!
}
type ComandaItem {
  id: UUID! kind: String! serviceId: UUID productId: UUID packageId: UUID appointmentId: UUID serviceVariantId: UUID
  professionalId: UUID! professional: Member! name: String! quantity: Int!
  listUnitPrice: String! unitPrice: String! total: String!
}
type ComandaPayment { id: UUID! method: String! amount: String! paidAt: DateTime! memberId: UUID }
input WalkInClientInput { fullName: String! phone: String }
input OpenWalkInComandaInput { clientId: UUID newClient: WalkInClientInput }
input AddComandaItemInput { comandaId: UUID! kind: String! serviceId: UUID serviceVariantId: UUID productId: UUID professionalId: UUID! quantity: Int! }
input PackageAssignmentInput { serviceId: UUID! professionalId: UUID! serviceVariantId: UUID }
input AddComandaPackageInput { comandaId: UUID! packageId: UUID! assignments: [PackageAssignmentInput!]! }
input AddComandaPaymentInput { comandaId: UUID! method: String! amount: String! }
type ComandaPayload { comanda: Comanda errors: [UserError!]! }
```

**comanda-serialize.ts**: `loadComandaView(tx, comandaId): Promise<ComandaView | null>` com `include: { client: true, items: { include: { professional: true }, orderBy: { createdAt: 'asc' } }, payments: { orderBy: { paidAt: 'asc' } }, appointments: { select: { id: true } } }`; converte todos os Decimals com `fromCents(toCents(x))`; `paid/remaining/change/canClose/closeError` de `computeComandaTotals(toCents(total), payments)`; `clientCreditBalance` = `fromCents(Σ toCents(client_credit_movements.amount) do cliente)` (agregado `tx.clientCreditMovement.aggregate({ _sum: { amount: true }, where: { clientId } })`); `name` = `nameSnapshot`; `appointmentIds` = ids. Exportar também `serializeComanda(row)` para reuso pelo 03-06/03-07.

**comandas.service.ts** (`@Injectable() ComandasService`, injeta `TenantContextService`). Toda mutação: `runWithTenant` → `SELECT id, status FROM comandas WHERE id = $1 FOR UPDATE` (via `$queryRaw`) → se não existe `NOT_FOUND` ("Comanda não encontrada."); se `status <> 'open'` → `COMANDA_NOT_OPEN` ("A comanda não está aberta."); executa → `recalcComandaTotal` quando mexe em item → retorna `{ comanda: await loadComandaView(tx, id), errors: [] }`. Erros `ComandaError` traduzidos fora da transação.
- `openWalkIn(orgId, memberId, input)`: exatamente um de `clientId`/`newClient` (`CLIENT_REQUIRED`, "Escolha um cliente ou cadastre um novo."); `newClient.fullName.trim().length >= 2` (`INVALID_NAME`); cria `tx.client.create({ data: { organizationId: orgId, fullName: trim, phone: newClient.phone?.trim() || null } })` (D-06: sem CPF, sem e-mail; LGPD mínimo); `openComandaTx`.
- `addItem`: `quantity >= 1` (`INVALID_QUANTITY`); `kind === 'service'` exige `serviceId` → `buildServiceItem`; `kind === 'product'` exige `productId` → `buildProductItem`; outro kind → `INVALID_KIND`.
- `removeItem`: item da comanda (`ITEM_NOT_FOUND`); se `appointmentId` não nulo → `ITEM_LINKED_TO_APPOINTMENT` ("Este serviço veio de um agendamento — cancele o agendamento na agenda."); delete.
- `addPackage`: `expandPackageItems` + `createMany`.
- `get(orgId, tenant, id)`: PROFESSIONAL (`tenant.roleName === 'PROFESSIONAL'`) só recebe a comanda se existir item com `professionalId = tenant.memberId`; senão `null`. Demais papéis: sempre.
- `list(orgId, tenant, { from, to, status?, clientId? })`: datas validadas `^\d{4}-\d{2}-\d{2}$` (senão lista vazia); limites via `$queryRaw` `SELECT id FROM comandas WHERE opened_at >= (${from}::date)::timestamp AT TIME ZONE ${tz} AND opened_at < (${to}::date)::timestamp AT TIME ZONE ${tz}` + filtros + escopo PROFESSIONAL (`EXISTS (SELECT 1 FROM comanda_items i WHERE i.comanda_id = comandas.id AND i.professional_id = ${memberId}::uuid)`), ordem `opened_at DESC`, limite 200; depois `loadComandaView` por id (ou `findMany` com o mesmo include).

**comandas.resolver.ts**: `comanda`/`comandas` → `@RequirePermission(PERMISSIONS.COMANDA_READ)`; as 6 mutações → `@RequirePermission(PERMISSIONS.COMANDA_WRITE)`. Registrar `ComandasService` e `ComandasResolver` em `comandas.module.ts` (providers + `exports: [ComandasService]`).

**phase3-comanda-open.e2e.spec.ts** (prefixo `p3open`, via GraphQL `gqlAs`):
1. walk-in com `newClient { fullName: "Maria Walk-in" }` (sem telefone) → comanda open com código `C-` e cliente novo sem cpf/email.
2. walk-in sem cliente → `CLIENT_REQUIRED`; com ambos → `CLIENT_REQUIRED`.
3. addComandaItem serviço com `variantId` (preço "120.00") → item listUnitPrice=unitPrice="120.00", total da comanda "120.00"; sem variante → "100.00".
4. addComandaItem produto qty 2 → total "70.00"; estoque do produto continua 10.
5. addComandaPackage (pacote "135.00" = serviceId 100 + serviceBId 50) → 2 itens com unitPrice "90.00" e "45.00", listUnitPrice "100.00" e "50.00", soma "135.00".
6. removeComandaItem → total recalculado; item com appointmentId (inserido via adminPrisma) → `ITEM_LINKED_TO_APPOINTMENT`.
7. serviço para profissional que não atende a categoria → `PROFESSIONAL_DOES_NOT_SERVE_CATEGORY`.
8. PROFESSIONAL proB: `comanda(id)` de comanda só com itens do proA → `null`; com item do proB → comanda; `addComandaItem` → erro de permissão; `comandas(from,to)` só traz as dele.
9. Org B: `comanda(id)` de comanda da org A → `null` (RLS).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-comanda-open && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - comandas.graphql contém `openWalkInComanda(input: OpenWalkInComandaInput!): ComandaPayload!`, `addComandaPackage(input: AddComandaPackageInput!)`, `listUnitPrice: String!`, `clientCreditBalance: String!` 
    - comandas.service.ts contém `FOR UPDATE`, `COMANDA_NOT_OPEN`, `ITEM_LINKED_TO_APPOINTMENT`, `CLIENT_REQUIRED`
    - comandas.resolver.ts contém `PERMISSIONS.COMANDA_READ` e `PERMISSIONS.COMANDA_WRITE`
    - comandas.module.ts exporta `ComandasService`
    - phase3-comanda-open.e2e.spec.ts passa (≥ 9 casos)
  </acceptance_criteria>
  <done>Comanda pode ser aberta (walk-in), alimentada com serviços/produtos/pacote e lida com escopo correto.</done>
</task>

<task type="auto">
  <name>Task 3: Pagamentos parciais (6 métodos, falta/troco, validação de crédito) + suíte POS-02/03</name>
  <files>apps/backend/src/comandas/comandas.service.ts, apps/backend/test/integration/phase3-comanda-payments.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/comandas/comandas.service.ts (Task 2)
    - apps/backend/src/comandas/comanda-math.ts (Task 1)
    - .planning/phases/03-core-operations/03-CONTEXT.md D-07, D-09, D-11
  </read_first>
  <action>
Em `comandas.service.ts`:
- `addPayment(orgId, memberId, { comandaId, method, amount })`: `method ∉ PAYMENT_METHODS` → `INVALID_METHOD` ("Forma de pagamento inválida."); `parseMoneyInput(amount)` null ou ≤ 0 → `INVALID_AMOUNT` ("Informe um valor maior que zero."); com o lock da comanda (FOR UPDATE): se `method === 'client_credit'`: `SELECT id FROM clients WHERE id = comanda.client_id FOR UPDATE` e saldo = `Σ client_credit_movements.amount` do cliente; `(Σ client_credit já lançado na comanda + amount) > saldo` → `CREDIT_INSUFFICIENT` (`Saldo de crédito insuficiente (disponível: R$ X).`, formatar com vírgula). Validação de "não-dinheiro acima do total": se `method !== 'cash'` e `(Σ pagamentos não-cash + amount) > total` → `NON_CASH_EXCEEDS_TOTAL` ("Somente dinheiro pode gerar troco."). Inserir `comanda_payments(method, amount: fromCents(cents), memberId)`. NENHUM `cash_movements`/`client_credit_movements` é gravado aqui — só no fechamento (03-07, D-12), para que pagamentos de comanda aberta possam ser removidos sem estorno.
- `removePayment(orgId, { comandaId, paymentId })`: pagamento da comanda (`PAYMENT_NOT_FOUND`), delete.
- Resolver: as 2 mutações já declaradas na Task 2 apontam para estes métodos (`COMANDA_WRITE`).

**phase3-comanda-payments.e2e.spec.ts** (prefixo `p3pay`): comanda walk-in com serviço "100.00" + serviço B "50.00" + produto "35.00" ×1 (total "185.00"):
1. Cada um dos 6 métodos é aceito (comanda separada por método, ou remover entre casos); `voucher` → `INVALID_METHOD`; `amount: "0"` e `"-1"` e `"10,00"` → `INVALID_AMOUNT`.
2. Pix "100.00" + cash "100.00" → `paid "200.00"`, `remaining "0.00"`, `change "15.00"`, `canClose true`.
3. Pix "185.00" + Pix "1.00" → segundo recusado `NON_CASH_EXCEEDS_TOTAL`.
4. Pix "50.00" → `remaining "135.00"`, `canClose false`, `closeError "INSUFFICIENT_PAYMENT"`.
5. Cliente com crédito R$ 50 (inserir `client_credit_movements(kind 'deposit', amount 50)` via adminPrisma): client_credit "50.00" ok, `clientCreditBalance "50.00"`; segundo client_credit "1.00" → `CREDIT_INSUFFICIENT`.
6. removeComandaPayment → paid recalculado.
7. ATTENDANT consegue adicionar pagamento; PROFESSIONAL recebe erro de permissão.
8. Pagamento em comanda `cancelled` (status alterado via adminPrisma) → `COMANDA_NOT_OPEN`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern "phase3-comanda-payments|phase3-comanda-open|phase3-comanda-code" && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - comandas.service.ts contém `CREDIT_INSUFFICIENT`, `NON_CASH_EXCEEDS_TOTAL`, `INVALID_METHOD`, `INVALID_AMOUNT`
    - `grep -n "cashMovement\|cash_movements" apps/backend/src/comandas/comandas.service.ts` não retorna nada
    - phase3-comanda-payments.e2e.spec.ts passa (≥ 8 casos)
  </acceptance_criteria>
  <done>POS-02 (5 métodos manuais + crédito; Pix QR e voucher fora por decisão) e POS-03 (pagamento dividido com falta/troco) funcionando em comanda aberta.</done>
</task>

</tasks>

<verification>
Gate completo verde; `test:integration -- --testPathPattern phase3-comanda` verde.
</verification>

<success_criteria>
- Comanda abre (walk-in), acumula serviços/produtos/pacote, recebe pagamentos divididos com falta/troco
- `openComandaTx`, `buildServiceItem`, `expandPackageItems`, `recalcComandaTotal`, `loadComandaView` exportados para 03-06/03-07
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-04-SUMMARY.md`
</output>

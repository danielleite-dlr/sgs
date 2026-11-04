---
phase: 04-bridal-contracts
plan: 06
type: execute
wave: 2
depends_on: ["04-01", "04-02"]
files_modified:
  - apps/backend/src/graphql/schema/catalog.graphql
  - apps/backend/src/catalog/packages/packages.service.ts
  - apps/backend/src/catalog/packages/dto/package.input.ts
  - apps/backend/src/graphql/schema/contracts.graphql
  - apps/backend/src/contracts/contracts.module.ts
  - apps/backend/src/contracts/contracts.resolver.ts
  - apps/backend/src/contracts/contracts.service.ts
  - apps/backend/src/contracts/contract-settings.service.ts
  - apps/backend/src/contracts/contract-code.ts
  - apps/backend/src/contracts/contract-lock.ts
  - apps/backend/src/contracts/contract-render.ts
  - apps/backend/src/contracts/contract-serialize.ts
  - apps/backend/src/contracts/contract-errors.ts
  - apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts
  - apps/backend/test/integration/phase4-contract-settings.e2e.spec.ts
autonomous: true
requirements: [CONT-01, CONT-03]

must_haves:
  truths:
    - "Pacote de noiva aceita entrada em R$ ou % (D-12)"
    - "Proprietário cria contrato de R$ 8.000,00 para o grupo com itens por pessoa coberta, desconto, entrada e prazo do restante = evento − 10 dias (D-09..D-12)"
    - "O contrato recebe código CT-AAAA-NNN sem buracos nem duplicatas sob concorrência"
    - "Política de cancelamento e cláusula da org são copiadas como snapshot no contrato (CONT-03 / D-22)"
    - "Cada criação/edição gera uma versão de texto com sha256; editar revoga o link e exige novo aceite (D-16, D-23)"
    - "Gerar link devolve URL pública /aceite/<orgId>/<token> válida por 30 dias; só o hash do token fica no banco"
    - "O contrato expõe pago, saldo, entrada pendente, prazo e flags vence-em-3-dias/vencido calculados na leitura"
  artifacts:
    - path: "apps/backend/src/graphql/schema/contracts.graphql"
      contains: "type Contract "
    - path: "apps/backend/src/contracts/contract-lock.ts"
      exports: ["lockContract", "LockedContract"]
    - path: "apps/backend/src/contracts/contract-serialize.ts"
      exports: ["loadContractView", "CONTRACT_INCLUDE"]
    - path: "apps/backend/src/contracts/contract-render.ts"
      exports: ["renderContractVersionTx"]
  key_links:
    - from: "contracts.service.ts"
      to: "contracts/domain/contract-math.ts + contract-template.ts + cancellation-policy.ts + contract-token.ts"
      via: "regras puras do 04-02"
      pattern: "computeContractStatus|renderContract|buildPolicySnapshot|newAccessToken"
    - from: "contract-code.ts"
      to: "contract_sequences"
      via: "UPSERT atômico (clone de nextComandaCode)"
      pattern: "contract_sequences"
---

<objective>
Núcleo do contrato da noiva (CONT-01, CONT-03): entrada no pacote, configurações do contrato da org (prazo, modelo, cláusula, limiares, janela do dia), criação/edição de contrato com itens por pessoa, snapshots, versões de texto com hash, código curto, geração de link de aceite e leitura com status derivado.

Purpose: tudo que pagamentos (04-11), aceite público (04-09), alertas (04-10) e a tela de contratos (04-14) consomem.
Output: `contracts.graphql`, ContractsModule preenchido, campos de entrada em pacotes, 2 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-01-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-02-SUMMARY.md
@apps/backend/src/comandas/comanda-code.ts
@apps/backend/src/comandas/comanda-close.ts
@apps/backend/src/catalog/packages/packages.service.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4 catalog-packages`. Este plano é dono de `contracts.graphql` e de `src/contracts/*.ts` (raiz). NÃO tocar em `src/bridal/` (04-05, paralelo): ler grupos/membros direto via Prisma.

<interfaces>
Do 04-02 (src/contracts/domain/):
```typescript
computeDepositCents(kind: 'fixed'|'percent'|null, value: string|null, totalCents: number): number
computeContractTotals({ itemsCents, discountCents, depositCents }): { itemsTotalCents, totalCents, depositCents } // RangeError DISCOUNT_GT_ITEMS | DEPOSIT_GT_TOTAL | NEGATIVE
balanceDueDate(eventDate: string, daysBefore: number): string
computeContractStatus({ status, totalCents, depositCents, paymentsCents, balanceDueDate, today, depositReferenceDate, depositUnpaidDays })
  → { paidCents, balanceCents, depositPaidCents, depositPendingCents, settled, daysToBalanceDue, balanceDueSoon, balanceOverdue, depositOverdue }
buildPolicySnapshot(clause: string | null) / CancellationPolicySchema / DEFAULT_CANCELLATION_CLAUSE
TEMPLATE_VARIABLES, DEFAULT_BRIDAL_TEMPLATE, validateTemplate(body) → { unknown, missing }, renderContract(body, vars), sha256Hex, formatBRL, maskCpf, formatDateBR
newAccessToken() → { token, tokenHash }; hashToken(t); ACCESS_TOKEN_TTL_DAYS = 30
```
Existentes: `nextComandaCode(tx, orgId, year)` (UPSERT em comanda_sequences) e `formatComandaCode`; `prorateUnits(listUnitCents[], packagePriceCents)`; `recordAudit(tx, {...})`; `toCents/fromCents/parseMoneyInput`; `AppConfigService` tem `FRONTEND_URL` (ver como EmailService lê). "Hoje" local: `SELECT (now() AT TIME ZONE o.timezone)::date::text FROM organizations o WHERE id = org`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Entrada no pacote + configurações do contrato da org</name>
  <files>apps/backend/src/graphql/schema/catalog.graphql, apps/backend/src/catalog/packages/packages.service.ts, apps/backend/src/catalog/packages/dto/package.input.ts, apps/backend/src/contracts/contract-settings.service.ts, apps/backend/src/contracts/contract-errors.ts, apps/backend/test/integration/phase4-contract-settings.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/catalog/packages/packages.service.ts (create/update, validações e payload)
    - apps/backend/src/catalog/packages/dto/package.input.ts
    - apps/backend/src/graphql/schema/catalog.graphql (Package, CreatePackageInput, UpdatePackageInput)
    - apps/backend/test/integration/catalog-packages.e2e.spec.ts
  </read_first>
  <action>
1. **Pacote (D-12):** SDL `type Package` + `depositKind: String` e `depositValue: String`; `CreatePackageInput`/`UpdatePackageInput` + `depositKind: String`, `depositValue: String` (no update, `depositKind: null` explícito limpa os dois). Service: ambos ou nenhum; kind ∈ {fixed, percent}; valor via `parseMoneyInput` ≥ 0; percent ≤ 100 → senão erro de payload `INVALID_DEPOSIT` (field `depositValue`). Serializar como string "30.00".
2. **contract-errors.ts:** `class ContractError extends Error { code; field }` + `mapContractError(e)` (ContractError; `RangeError` de contract-math → `DISCOUNT_GT_ITEMS`/`DEPOSIT_GT_TOTAL`/`NEGATIVE_AMOUNT`; P2002 em `uq_contracts_group_live` → `GROUP_HAS_CONTRACT`).
3. **ContractSettingsService:** `getEffective(tx, orgId)` → linha de `contract_settings` ou defaults (`balanceDueDaysBefore 10`, `templateBody = DEFAULT_BRIDAL_TEMPLATE`, `cancellationClause = DEFAULT_CANCELLATION_CLAUSE`, alertas 3/3/15, janela '06:00'–'20:00'), com flags `isDefaultTemplate`, `isDefaultClause`; `update(orgId, memberId, input)` = UPSERT; validações: `validateTemplate(body).unknown.length > 0` → `UNKNOWN_TEMPLATE_VARIABLE` (mensagem lista as variáveis); cláusula 10..5000 (`INVALID_CLAUSE`); dias nos limites dos CHECKs (`INVALID_DAYS`); horários `/^\d{2}:\d{2}$/` e fim > início (`INVALID_DAY_WINDOW`); `templateBody: null`/`cancellationClause: null` volta ao padrão. Grava `recordAudit(action 'contract.settings.update')`.
4. **SDL em contracts.graphql (seção settings):**
```graphql
type ContractSettings {
  balanceDueDaysBefore: Int!  templateBody: String!  isDefaultTemplate: Boolean!
  cancellationClause: String!  isDefaultClause: Boolean!
  alertDepositUnpaidDays: Int!  alertNotAcceptedDays: Int!  alertCompanionDepositDays: Int!
  scheduleDayStart: String!  scheduleDayEnd: String!
  templateVariables: [String!]!  missingVariables: [String!]!
}
input UpdateContractSettingsInput {
  balanceDueDaysBefore: Int  templateBody: String  cancellationClause: String
  alertDepositUnpaidDays: Int  alertNotAcceptedDays: Int  alertCompanionDepositDays: Int
  scheduleDayStart: String  scheduleDayEnd: String
}
type ContractSettingsPayload { settings: ContractSettings  errors: [UserError!]! }
extend type Query { contractSettings: ContractSettings! }
extend type Mutation { updateContractSettings(input: UpdateContractSettingsInput!): ContractSettingsPayload! }
```
(query com `CONTRACT_READ`, mutation com `CONTRACT_SETTINGS` — resolver na Task 3).
5. Spec `phase4-contract-settings.e2e.spec.ts`: defaults sem linha; update com `{{foo}}` → `UNKNOWN_TEMPLATE_VARIABLE`; update válido persiste; MANAGER sem `contract.settings` → permissão negada; org B não vê a config da A; pacote com `depositKind percent 30` persiste e `percent 120` → `INVALID_DEPOSIT`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-contract-settings catalog-packages</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "depositKind: String" apps/backend/src/graphql/schema/catalog.graphql` encontra ≥ 3 ocorrências (type + 2 inputs)
    - `grep -n "UNKNOWN_TEMPLATE_VARIABLE" apps/backend/src/contracts/contract-settings.service.ts` encontra
    - Suítes verdes (catalog-packages sem regressão)
  </acceptance_criteria>
  <done>Entrada configurável no pacote e configurações do contrato por org com defaults.</done>
</task>

<task type="auto">
  <name>Task 2: Criar/editar contrato, código, versões com hash, link de aceite</name>
  <files>apps/backend/src/contracts/contract-code.ts, apps/backend/src/contracts/contract-lock.ts, apps/backend/src/contracts/contract-render.ts, apps/backend/src/contracts/contracts.service.ts</files>
  <read_first>
    - apps/backend/src/comandas/comanda-code.ts (copiar o UPSERT)
    - apps/backend/src/comandas/comanda-close.ts (lockComanda FOR UPDATE)
    - apps/backend/src/contracts/domain/*.ts (04-02)
    - apps/backend/src/email/email.service.ts (como ler FRONTEND_URL)
  </read_first>
  <action>
1. `contract-code.ts`: `formatContractCode(year, n)` → `CT-${year}-${String(n).padStart(3,'0')}` (≥1000 sem truncar) e `nextContractCode(tx, orgId, year)` clonando `nextComandaCode` sobre `contract_sequences`.
2. `contract-lock.ts`: `type LockedContract = { id; code; status; bridal_group_id; bride_client_id; total_amount: Decimal; deposit_amount: Decimal; current_version: number; accepted_version: number | null; balance_due_date: Date }` e `lockContract(tx, id)` com `SELECT ... FROM contracts WHERE id = $1::uuid FOR UPDATE` (lança `ContractError('NOT_FOUND', 'Contrato não encontrado.', 'id')`).
3. `contract-render.ts`: `renderContractVersionTx(tx, orgId, contractId, memberId): Promise<{ versionId: string; version: number; sha256: string }>` — carrega contrato + grupo + noiva (fullName, cpf) + itens (com `bridal_group_members.relation_label`, nome da cliente) + settings efetivos; monta variáveis: `noiva_nome`; `noiva_cpf` = CPF formatado `000.000.000-00` ou "não informado"; `evento_data` = `formatDateBR`; `evento_local` = "No estúdio" ou o endereço; `itens` = uma linha por item `- <cliente> (<relação|Noiva>): <descrição>[ (teste)] — <formatBRL(total)>` + linha de desconto se > 0; `valor_total`, `entrada` = `formatBRL`; `prazo_restante` = `formatDateBR(balance_due_date)`; `politica_cancelamento` = `cancellation_policy.clause`. `renderContract(settings.templateBody, vars)` → insere `contract_versions` (version = current_version + 1, `text_sha256 = sha256Hex(text)`), atualiza `contracts.current_version`.
4. `ContractsService` (injeta TenantContextService, ContractSettingsService, AppConfigService):
   - `create(orgId, memberId, input: { groupId; packageId?; items?: { groupMemberId; serviceId; unitPrice?; quantity?; purpose? }[]; discountAmount?; depositAmount?; balanceDueDaysBefore? })`: grupo `active` (`GROUP_NOT_ACTIVE`); itens: se `items` vier, cada `groupMemberId` pertence ao grupo e tem `covered_by_contract = true` (`MEMBER_NOT_COVERED`), serviço ativo, `unitPrice` default `services.base_price`; se `items` omitido e `packageId` dado → itens da NOIVA = serviços do pacote com preço rateado `prorateUnits(base_price por serviço × qty, package.price)` (description = `${service.name} (pacote ${package.name})`, `package_id` preenchido) + serviços planejados (`bridal_member_services`) das demais pessoas cobertas a `base_price`; se ambos omitidos → serviços planejados de todas as pessoas cobertas a `base_price`; zero itens → `ITEMS_REQUIRED`. Desconto default 0. Entrada: `depositAmount` informado, senão `computeDepositCents(package.deposit_kind, package.deposit_value, total)`, senão 0. Prazo: `balanceDueDaysBefore ?? settings` → `balance_due_date = balanceDueDate(group.event_date, n)`; se o prazo já passou em relação a "hoje" local → aceitar mas retornar warning? Não: aceitar sem warning (status derivado mostrará vencido). `cancellation_policy = buildPolicySnapshot(settings.cancellationClause)`. Código via `nextContractCode(year do event_date)`. Status `draft`. Renderiza v1. `recordAudit('contract.create')`.
   - `update(orgId, memberId, id, input)` (mesmos campos exceto groupId): `lockContract`; status ∈ {draft, awaiting_acceptance, active} (`CONTRACT_NOT_EDITABLE`); substitui itens se vierem; recalcula totais e `balance_due_date` (sempre a partir do `event_date` atual do grupo — Pitfall 8); total novo < pago (Σ contract_payments) → `TOTAL_BELOW_PAID`; renderiza nova versão; revoga tokens abertos (`UPDATE contract_access_tokens SET revoked_at = now() WHERE contract_id = $1 AND revoked_at IS NULL`); status → `draft` se era draft, senão `awaiting_acceptance` (Pitfall 7); `recordAudit('contract.update', metadata { version })`.
   - `generateLink(orgId, memberId, id)`: lock; status ∈ {draft, awaiting_acceptance, active}; se `accepted_version === current_version` → `ALREADY_ACCEPTED`; revoga tokens abertos; `newAccessToken()`; insere token (version_id da versão atual, `expires_at = now + ACCESS_TOKEN_TTL_DAYS`); status → `awaiting_acceptance`; `link_generated_at = now()`; audit `contract.link.generate`. Retorna `{ url: \`${FRONTEND_URL}/aceite/${orgId}/${token}\`, expiresAt }` (o token em claro só existe nesta resposta).
   - `get`, `list(orgId, { status?, derived?: 'deposit_pending'|'due_soon'|'overdue'|'settled' })` via `loadContractView` (Task 3).
   Escritas em `runWithTenant` e erros → payload via `mapContractError`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "contract_sequences" apps/backend/src/contracts/contract-code.ts` encontra
    - `grep -n "FOR UPDATE" apps/backend/src/contracts/contract-lock.ts` encontra
    - `grep -n "revoked_at = now()\|revokedAt" apps/backend/src/contracts/contracts.service.ts` encontra (update e generateLink)
    - `grep -n "MEMBER_NOT_COVERED\|TOTAL_BELOW_PAID\|ALREADY_ACCEPTED\|CONTRACT_NOT_EDITABLE" apps/backend/src/contracts/contracts.service.ts` encontra os 4
    - `grep -n "/aceite/" apps/backend/src/contracts/contracts.service.ts` encontra
  </acceptance_criteria>
  <done>Contrato criável/editável com snapshot, versões com hash e link revogável de 30 dias.</done>
</task>

<task type="auto">
  <name>Task 3: SDL do contrato, serialização com status derivado, resolver e suíte core</name>
  <files>apps/backend/src/graphql/schema/contracts.graphql, apps/backend/src/contracts/contract-serialize.ts, apps/backend/src/contracts/contracts.resolver.ts, apps/backend/src/contracts/contracts.module.ts, apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/comandas/comanda-serialize.ts (loadComandaView)
    - apps/backend/src/contracts/contracts.service.ts (Task 2)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (insertBridalGroupRow)
    - apps/backend/test/integration/phase3-comanda-code.e2e.spec.ts (teste de concorrência de código)
  </read_first>
  <action>
1. Acrescentar a `contracts.graphql`:
```graphql
type Contract {
  id: UUID!  code: String!  status: String!
  groupId: UUID!  groupName: String!  eventDate: String!
  brideClientId: UUID!  brideName: String!
  packageId: UUID
  itemsTotal: String!  discountAmount: String!  totalAmount: String!  depositAmount: String!
  balanceDueDaysBefore: Int!  balanceDueDate: String!
  paid: String!  balance: String!  depositPaid: String!  depositPending: String!
  settled: Boolean!  daysToBalanceDue: Int!  balanceDueSoon: Boolean!  balanceOverdue: Boolean!  depositOverdue: Boolean!
  cancellationPolicy: JSON!
  currentVersion: Int!  acceptedVersion: Int  needsAcceptance: Boolean!
  linkGeneratedAt: DateTime  linkExpiresAt: DateTime  acceptedAt: DateTime
  acceptance: ContractAcceptanceView
  currentText: String!  currentTextSha256: String!
  items: [ContractItem!]!
  payments: [ContractPaymentView!]!
  cancelledAt: DateTime  cancelReason: String  cancelledByParty: String
  createdAt: DateTime!
}
type ContractItem { id: UUID!  groupMemberId: UUID!  personName: String!  serviceId: UUID!  packageId: UUID  description: String!  quantity: Int!  unitPrice: String!  total: String!  purpose: String! }
type ContractPaymentView { id: UUID!  kind: String!  method: String!  amount: String!  paidAt: DateTime!  memberId: UUID  reversesPaymentId: UUID  reversed: Boolean!  note: String }
type ContractAcceptanceView { acceptedName: String!  acceptedCpfMasked: String!  acceptedAt: DateTime!  ip: String!  textSha256: String!  version: Int! }
input ContractItemInput { groupMemberId: UUID!  serviceId: UUID!  unitPrice: String  quantity: Int  purpose: String }
input CreateContractInput { groupId: UUID!  packageId: UUID  items: [ContractItemInput!]  discountAmount: String  depositAmount: String  balanceDueDaysBefore: Int }
input UpdateContractInput { packageId: UUID  items: [ContractItemInput!]  discountAmount: String  depositAmount: String  balanceDueDaysBefore: Int }
type ContractPayload { contract: Contract  errors: [UserError!]! }
type ContractLinkPayload { url: String  expiresAt: DateTime  contract: Contract  errors: [UserError!]! }
extend type Query {
  contracts(status: String, derived: String): [Contract!]!
  contract(id: UUID!): Contract
}
extend type Mutation {
  createContract(input: CreateContractInput!): ContractPayload!
  updateContract(id: UUID!, input: UpdateContractInput!): ContractPayload!
  generateContractLink(id: UUID!): ContractLinkPayload!
}
```
2. `contract-serialize.ts`: `CONTRACT_INCLUDE` e `loadContractView(tx, orgId, id)` / `loadContractViews(tx, orgId, where)` — busca "hoje" local e `settings.alertDepositUnpaidDays`, aplica `computeContractStatus` (paymentsCents de `contract_payments.amount`; `depositReferenceDate` = data local de `accepted_at` ou de `created_at`); `reversed` = existe linha com `reverses_payment_id = id`; `needsAcceptance = acceptedVersion !== currentVersion`; `linkExpiresAt` = token aberto mais recente; `acceptance` = último `contract_acceptances` com `maskCpf`; `currentText` = `rendered_text` da versão atual. Filtro `derived` aplicado em memória após o cálculo (validar valores; inválido → BadRequest).
3. `ContractsResolver`: `contracts`/`contract`/`contractSettings` com `CONTRACT_READ`; `createContract`/`updateContract`/`generateContractLink` com `CONTRACT_WRITE`; `updateContractSettings` com `CONTRACT_SETTINGS`. `ContractsModule`: providers `ContractsService, ContractSettingsService, ContractsResolver`; exports `ContractsService, ContractSettingsService`.
4. Spec `phase4-contracts-core.e2e.spec.ts` (grupo via `insertBridalGroupRow(w, { companions: 4, covered: [true, true, false, false, false] })`, evento daqui a 60 dias):
   - criar com itens explícitos somando R$ 8.300,00 e desconto 300,00 → `totalAmount "8000.00"`, `depositAmount` informado "2400.00", `balanceDueDate` = evento − 10, código casa `/^CT-\d{4}-\d{3}$/`, `cancellationPolicy.clientCancels = 'retain_all_paid'` e `clause` = cláusula da org (critério 2 reinterpretado);
   - criar com `packageId = w.bridalPackageId` sem itens → itens da noiva rateados somando o preço do pacote; entrada = 30% do total;
   - item para acompanhante não coberta → `MEMBER_NOT_COVERED`; segundo contrato vivo no mesmo grupo → `GROUP_HAS_CONTRACT`;
   - `currentTextSha256` = sha256 do `currentText`; texto não contém `{{`;
   - `generateContractLink` → url `/aceite/<orgId>/<token>`, `contract_access_tokens.token_hash = sha256(token)` e nenhum registro guarda o token em claro; status `awaiting_acceptance`;
   - `updateContract` (novo desconto) → `currentVersion 2`, token anterior com `revoked_at` preenchido;
   - 10 `createContract` concorrentes (10 grupos) → 10 códigos distintos e consecutivos;
   - status derivado: `insertContract` + inserir `contract_payments` via adminPrisma (3 pagamentos) com prazo daqui a 2 dias → `balanceDueSoon true`; prazo ontem → `balanceOverdue true`; `contracts(derived: "overdue")` filtra;
   - RBAC/RLS: PROFESSIONAL sem `contract.read`; `otherAdmin` não vê o contrato (`contract(id)` → null).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-contracts-core phase4-contract-settings</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "generateContractLink(id: UUID!): ContractLinkPayload!" apps/backend/src/graphql/schema/contracts.graphql` encontra
    - `grep -n "computeContractStatus" apps/backend/src/contracts/contract-serialize.ts` encontra
    - Suítes verdes; `grep -c "it(" apps/backend/test/integration/phase4-contracts-core.e2e.spec.ts` ≥ 8
  </acceptance_criteria>
  <done>CONT-01 (valor total, entrada, prazo, código, versões) e snapshot de CONT-03 entregues e testados.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase4` verde; `catalog-packages` sem regressão.</verification>

<success_criteria>Contrato de R$ 8.000 criável com entrada + restante até D-10, política snapshot e link de aceite revogável.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-06-SUMMARY.md`
</output>

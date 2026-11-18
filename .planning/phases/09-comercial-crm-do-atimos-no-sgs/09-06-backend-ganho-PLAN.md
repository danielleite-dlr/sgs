---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 06
type: execute
wave: 3
depends_on: ["09-04"]
files_modified:
  - apps/backend/src/clients/clients.service.ts
  - apps/backend/src/clients/client-tx.ts
  - apps/backend/src/clients/__tests__/client-tx.spec.ts
  - apps/backend/src/contracts/contracts.service.ts
  - apps/backend/src/graphql/schema/commercial-win.graphql
  - apps/backend/src/commercial/commercial-win.service.ts
  - apps/backend/src/commercial/commercial-win.resolver.ts
  - apps/backend/src/commercial/commercial-win.module.ts
  - apps/backend/test/integration/phase9-win-deal.e2e.spec.ts
autonomous: true
requirements: [COM-08, COM-10]

must_haves:
  truths:
    - "winCommercialDeal cria a cliente (ou usa/atualiza a cliente ligada ao lead) e cria grupo + contrato RASCUNHO com o pacote, o tipo e a data do evento, numa única transação (D-08, D-09)"
    - "Se o sinal foi pago, o pagamento entra no contrato e no caixa pelo mesmo recordContractPaymentsTx dos pagamentos de contrato (D-08)"
    - "Qualquer falha (pacote ausente, CPF inválido, pagamento inválido) desfaz tudo: nenhuma cliente, grupo, contrato ou pagamento órfão"
    - "Dois cliques simultâneos geram um contrato só; negócio já ganho/perdido devolve DEAL_CLOSED"
    - "Debutante: a contratante é o lead e a debutante entra como 'noiva' do grupo com o nome informado (D-18)"
    - "Quem pode ganhar é decidido por canWinDeal (D-21, ponto único); ATTENDANT ganha só negócio dela e não precisa de contract.write"
  artifacts:
    - path: "apps/backend/src/clients/client-tx.ts"
      provides: "createClientTx, updateClientTx, validateClientFields"
      exports: ["createClientTx", "updateClientTx", "validateClientFields"]
    - path: "apps/backend/src/contracts/contracts.service.ts"
      provides: "createInTx público"
      contains: "async createInTx("
    - path: "apps/backend/src/commercial/commercial-win.service.ts"
      provides: "CommercialWinService.win"
      exports: ["CommercialWinService"]
  key_links:
    - from: "apps/backend/src/commercial/commercial-win.service.ts"
      to: "ContractsService.createInTx"
      via: "mesmo tx do ganho"
      pattern: "createInTx\\(tx"
    - from: "apps/backend/src/commercial/commercial-win.service.ts"
      to: "recordContractPaymentsTx"
      via: "sinal pago"
      pattern: "recordContractPaymentsTx\\(tx"
    - from: "apps/backend/src/commercial/commercial-win.service.ts"
      to: "canWinDeal"
      via: "D-21"
      pattern: "canWinDeal\\("
---

<objective>
O ganho: `winCommercialDeal` atômico que resolve a cliente, cria grupo + contrato rascunho pelo serviço de contratos que já existe, lança o sinal opcional e fecha o negócio. Exige expor `createInTx` no `ContractsService` e extrair `createClientTx`/`updateClientTx` do `ClientsService` (mesma validação, sem duplicar).

Purpose: COM-08, o fim do funil. É o ponto de maior risco (atomicidade, duplicidade, permissão).
Output: `client-tx.ts`, `createInTx`, `commercial-win.graphql`, serviço, resolver, módulo e `phase9-win-deal`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md
@.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-CONTEXT.md

**Ambiente de execução:** igual ao 09-01. Arquivos de `contracts/` usam aspas duplas (prettier do backend): manter o estilo do arquivo.

**D-21 (confirmada pela usuária em 2026-11-18):** o resolver exige `COMMERCIAL_WRITE`; o serviço checa `canWinDeal(tenant.roleName)` (único ponto, `commercial-access.ts`) e falha com `WIN_NOT_ALLOWED`. Não chamar o resolver de contratos nem exigir `contract.write`.

<interfaces>
`apps/backend/src/contracts/contracts.service.ts`:
```ts
export interface NewContractGroupInput { eventKind?; eventDate: string; name?; eventTime?; readyBy?; locationKind?; locationAddress?; locationName?; notes?; bride: BridalPersonInput; responsibleClientId?: string | null; newResponsible?: { fullName; phone? } | null; }
export interface CreateContractInput { groupId?; newGroup?: NewContractGroupInput | null; packageId?; items?; discountAmount?: string | null; depositAmount?; balanceDueDaysBefore?; paymentMode?; discountDescription?: string | null; installments?; }
async create(orgId, memberId, input): Promise<ContractPayload> // runWithTenant + createTx + loadContractView; catch → this.fail(e)
private async createTx(tx, orgId, memberId, input, mode: TxMode = "commit"): Promise<string> // lança ContractError
```
`BridalPersonInput extends BridalPersonRef { relationLabel?; coveredByContract?; services? }`; `BridalPersonRef { clientId?: string | null; newClient?: { fullName: string; phone?: string | null } | null }` (`bridal/bridal-clients.ts`).
`apps/backend/src/contracts/payments/contract-payments.ts`: `export async function recordContractPaymentsTx(tx, orgId, memberId, contractId, lines: { method: string; amount: string }[], note?: string | null): Promise<void>` — aceita contrato `draft`; métodos válidos = `CASH_METHODS` (`comandas/comanda-math.ts`); lança `ContractError` (`INVALID_METHOD`, `INVALID_AMOUNT`, `OVERPAYMENT`...).
`mapContractError(e)` / `mapBridalError(e)` (usados no `fail` do ContractsService).
`apps/backend/src/clients/clients.service.ts`: `create(orgId, input: CreateClientInput)` e `update(orgId, input: UpdateClientInput)` com `validateExtras`, `normalizeCep`, `emptyToNull`, `normalizeCpf`, `validateCpf`, e-mail minúsculo; devolvem `errPayload(...)` em vez de lançar.
Do 09-04: `findDuplicatesTx(tx, { phone, email })`, `CommercialError`, `mapCommercialError`. Do 09-02: `visibilityWhere`, `canWinDeal`.
Fixtures fase 4: `COMPLETE_CLIENT` (CPF válido, RG, CEP, celulares), `completeStudioSettings(w)`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: createClientTx/updateClientTx e ContractsService.createInTx</name>
  <files>apps/backend/src/clients/client-tx.ts, apps/backend/src/clients/__tests__/client-tx.spec.ts, apps/backend/src/clients/clients.service.ts, apps/backend/src/contracts/contracts.service.ts</files>
  <read_first>
    - apps/backend/src/clients/clients.service.ts
    - apps/backend/src/clients/dto/client.input.ts
    - apps/backend/src/clients/__tests__/ (specs existentes do serviço)
    - apps/backend/src/contracts/contracts.service.ts (linhas ~580-700: fail, create, createTx)
  </read_first>
  <behavior>
    - validateClientFields({ fullName, phone: null, email: null }) → { code: 'CONTACT_REQUIRED' }; CPF inválido → CPF_INVALID; RG/CEP/phone2 inválidos → mesmos códigos de hoje
    - createClientTx lança ClientFieldError(code, message, field) em vez de devolver payload; grava cpf normalizado, email minúsculo, CEP 00000-000
    - ClientsService.create/update continuam devolvendo { client, errors } idênticos ao comportamento atual (specs existentes de clients verdes sem alteração)
    - ContractsService.createInTx(tx, orgId, memberId, input) devolve o id do contrato e lança ContractError (não devolve payload)
  </behavior>
  <action>
1. `client-tx.ts`: mover para cá `RG_RE`, `PHONE_RE`, `emptyToNull`, `normalizeCep`, `validateExtras` (como `validateClientFields(input, mode: 'create' | 'update')` devolvendo `{ code, message, field } | null`), e criar `export class ClientFieldError extends Error { constructor(readonly code: string, message: string, readonly field: string | null = null) }`, `export async function createClientTx(tx, orgId, input: CreateClientInput): Promise<Client>` e `export async function updateClientTx(tx, orgId, input: UpdateClientInput): Promise<Client>` (mesmo corpo de hoje, lançando `ClientFieldError` e `NOT_FOUND`).
2. `clients.service.ts`: `create`/`update` passam a validar com `validateClientFields` e delegar a `createClientTx`/`updateClientTx` dentro do `runWithTenant`, convertendo `ClientFieldError` em `errPayload` (contrato público inalterado).
3. `contracts.service.ts`: acrescentar logo depois de `create`:
```ts
  /**
   * Fase 9 (ganho no Comercial): o mesmo createTx, dentro de uma transação de quem chama.
   * Lança ContractError/BridalError; quem chama decide o rollback.
   */
  async createInTx(
    tx: TenantPrismaClient,
    orgId: string,
    memberId: string,
    input: CreateContractInput,
  ): Promise<string> {
    return this.createTx(tx, orgId, memberId, input, "commit");
  }
```
4. `client-tx.spec.ts` (unit, com `tx` falso de `client.create/update/findFirst`) para o `<behavior>`.
Commits `refactor(09-06): createClientTx/updateClientTx compartilhados` e `feat(09-06): createInTx no ContractsService`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- src/clients src/contracts && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test:integration -- clients.e2e phase4-contracts-core phase41-contract-preview</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function createClientTx" apps/backend/src/clients/client-tx.ts` encontra
    - `grep -n "function validateExtras\|const RG_RE" apps/backend/src/clients/clients.service.ts` vazio (moveu para client-tx.ts)
    - `grep -n "async createInTx(" apps/backend/src/contracts/contracts.service.ts` encontra
    - comando do `<verify>` sai 0 (`clients.e2e`, `phase4-contracts-core` e `phase41-contract-preview` sem alteração nos testes)
  </acceptance_criteria>
  <done>Reuso sem duplicar regra de cliente nem de contrato.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: winCommercialDeal atômico + phase9-win-deal</name>
  <files>apps/backend/src/graphql/schema/commercial-win.graphql, apps/backend/src/commercial/commercial-win.service.ts, apps/backend/src/commercial/commercial-win.resolver.ts, apps/backend/src/commercial/commercial-win.module.ts, apps/backend/test/integration/phase9-win-deal.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/commercial/commercial-win.module.ts (shell do 09-04)
    - apps/backend/src/contracts/payments/contract-payments.ts
    - apps/backend/src/contracts/contracts.module.ts (exports: ContractsService)
    - apps/backend/test/integration/phase4-contract-payments.e2e.spec.ts (como conferir contract_payments e cash_movements)
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (COMPLETE_CLIENT, completeStudioSettings)
  </read_first>
  <behavior>
    - noiva, lead sem cliente ligada, modal com COMPLETE_CLIENT: cria 1 cliente (nome do lead, telefone do lead), 1 grupo eventKind 'noiva' com a data do negócio, 1 contrato status 'draft' com o pacote e discountAmount do negócio; negócio fica status 'won', etapa Ganho, closedAt, wonContractId, wonClientId; lead.clientId = nova cliente; payload { contractId, clientId, errors: [] }
    - lead ligado a cliente existente: não cria cliente; atualiza CPF/endereço informados no modal
    - lead sem vínculo, mas telefone já de cliente do SGS no momento do ganho: usa essa cliente (rechecagem com findDuplicatesTx; primeira por created_at) e liga o lead
    - depositPaid true com lines [{ method: 'pix', amount: '150.00' }]: 1 contract_payments e 1 cash_movements do contrato; sem depositPaid nenhum
    - negócio sem pacote → PACKAGE_REQUIRED; sem eventDate → EVENT_DATE_REQUIRED; nada gravado (counts de clients, bridal_groups, contracts iguais antes/depois)
    - CPF inválido no modal → CPF_INVALID e nada gravado; método 'cheque' inválido → INVALID_METHOD e nada gravado (contrato e cliente também revertidos)
    - duas chamadas simultâneas (Promise.all) → exatamente 1 contrato; a outra DEAL_CLOSED
    - debutante com beneficiaryName 'Sofia' (do negócio ou do input): grupo eventKind 'debutante', 'noiva' do grupo = nova cliente 'Sofia', responsibleClientId = cliente do lead; sem nome → BENEFICIARY_REQUIRED
    - ATTENDANT dona do negócio ganha (sem contract.write); ATTENDANT B no negócio de A → NOT_FOUND; PROFESSIONAL → FORBIDDEN
  </behavior>
  <action>
1. `commercial-win.graphql`:
```graphql
input CommercialWinClientInput {
  fullName: String
  phone: String
  email: String
  cpf: String
  rg: String
  birthDate: String
  postalCode: String
  address: String
  phone2: String
  phone3: String
}

input CommercialDepositLineInput { method: String! amount: String! }

input WinCommercialDealInput {
  dealId: UUID!
  client: CommercialWinClientInput
  beneficiaryName: String
  depositPaid: Boolean!
  depositLines: [CommercialDepositLineInput!]
  discountDescription: String
}

type CommercialWinPayload { contractId: UUID clientId: UUID errors: [UserError!]! }

extend type Mutation {
  winCommercialDeal(input: WinCommercialDealInput!): CommercialWinPayload!
}
```
2. `CommercialWinService.win(orgId, tenant, input)`: `if (!canWinDeal(tenant.roleName)) return erro WIN_NOT_ALLOWED` (comentário D-21). Uma `runWithTenant`: `SELECT id, status FROM commercial_deals WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`; reler com `visibilityWhere(viewer).deal` + `include: { lead: true }` (invisível → NOT_FOUND); `status <> 'open'` → DEAL_CLOSED; sem `packageId` → PACKAGE_REQUIRED; sem `eventDate` → EVENT_DATE_REQUIRED; cliente: `lead.clientId` → `updateClientTx` com os campos não vazios do modal; senão `findDuplicatesTx` → existente (+ update) ou `createClientTx({ fullName: input.client?.fullName ?? lead.fullName, phone: lead.phone, email: lead.email, ...modal })`; grava `lead.clientId`. `newGroup`: noiva → `{ eventKind: 'noiva', eventDate, bride: { clientId }, locationName: deal.location, notes: deal.notes }`; debutante → `{ eventKind: 'debutante', eventDate, bride: { newClient: { fullName: beneficiaryName } }, responsibleClientId: clientId, ... }` (gravar `beneficiaryName` no negócio se veio no input). `contractId = await this.contracts.createInTx(tx, orgId, tenant.memberId, { newGroup, packageId, discountAmount: deal.discountAmount > 0 ? deal.discountAmount.toFixed(2) : null, discountDescription })`. Se `depositPaid`: `recordContractPaymentsTx(tx, orgId, tenant.memberId, contractId, depositLines ?? [], 'Sinal lançado pelo Comercial')`. Atualiza negócio (`status 'won'`, etapa `kind 'won'`, `closedAt`, `wonContractId`, `wonClientId`) e cria interação `type 'other'`, notes 'Negócio ganho: contrato criado'. `catch`: `mapCommercialError` / `mapContractError` / `mapBridalError` / `ClientFieldError` → `{ contractId: null, clientId: null, errors: [..] }`; qualquer outro relança. TODOS os erros saem como exceção de dentro do callback (rollback); nunca devolver payload de erro de dentro do `runWithTenant`.
3. Resolver `winCommercialDeal` → `@RequirePermission(PERMISSIONS.COMMERCIAL_WRITE)`. `CommercialWinModule`: imports `ContractsModule`, `DatabaseModule`, `AuthzModule`; providers `CommercialWinService`, `CommercialWinResolver`.
4. `phase9-win-deal.e2e.spec.ts` com os casos do `<behavior>` (contagens por `adminPrisma` filtradas pela org).
Commits `test(09-06): ganho atômico` e `feat(09-06): ganho cria cliente e contrato rascunho`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-win-deal && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "FOR UPDATE" apps/backend/src/commercial/commercial-win.service.ts` encontra
    - `grep -n "canWinDeal(" apps/backend/src/commercial/commercial-win.service.ts` encontra e `grep -n "D-21" apps/backend/src/commercial/commercial-win.service.ts` encontra
    - `grep -n "createInTx(tx" apps/backend/src/commercial/commercial-win.service.ts` e `grep -n "recordContractPaymentsTx(tx" apps/backend/src/commercial/commercial-win.service.ts` encontram
    - `grep -n "CONTRACT_WRITE" apps/backend/src/commercial/commercial-win.resolver.ts` vazio
    - `grep -n "Promise.all" apps/backend/test/integration/phase9-win-deal.e2e.spec.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Ganho atômico, idempotente e com debutante.</done>
</task>

</tasks>

<verification>
`phase9-win-deal` verde; specs de clientes e contratos existentes sem regressão.
</verification>

<success_criteria>
Negócio ganho vira cliente + contrato rascunho (e sinal no caixa), sem estado parcial.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-06-SUMMARY.md`
</output>

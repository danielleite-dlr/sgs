---
phase: 04-bridal-contracts
plan: 05
type: execute
wave: 2
depends_on: ["04-01"]
files_modified:
  - apps/backend/src/graphql/schema/bridal.graphql
  - apps/backend/src/bridal/bridal.module.ts
  - apps/backend/src/bridal/bridal.resolver.ts
  - apps/backend/src/bridal/bridal.service.ts
  - apps/backend/src/bridal/bridal-errors.ts
  - apps/backend/src/bridal/bridal-clients.ts
  - apps/backend/src/bridal/bridal-serialize.ts
  - apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts
autonomous: true
requirements: [CLI-03]

must_haves:
  truths:
    - "Proprietário cria um grupo com noiva + 4 acompanhantes num só mutation, escolhendo clientes existentes ou criando cliente mínima (nome + telefone opcional)"
    - "Cada pessoa tem serviços planejados (evento ou teste) e a marcação incluída no contrato / paga avulso"
    - "Só existe uma noiva por grupo e a mesma cliente não entra duas vezes no grupo"
    - "Mudar a cobertura de uma pessoa cuja comanda do grupo já foi fechada é bloqueado (D-25)"
    - "Local externo exige endereço; deslocamento entre 0 e 240 minutos"
    - "Org B não lê nem altera grupos da org A"
  artifacts:
    - path: "apps/backend/src/graphql/schema/bridal.graphql"
      contains: "type BridalGroup"
    - path: "apps/backend/src/bridal/bridal.service.ts"
      exports: ["BridalService"]
    - path: "apps/backend/src/bridal/bridal-errors.ts"
      exports: ["BridalError", "mapBridalError"]
  key_links:
    - from: "bridal.resolver.ts"
      to: "PERMISSIONS.BRIDAL_READ / BRIDAL_WRITE"
      via: "@RequirePermission"
      pattern: "BRIDAL_WRITE"
    - from: "bridal.service.ts"
      to: "TenantContextService.runWithTenant"
      via: "toda escrita em transação com RLS"
      pattern: "runWithTenant"
---

<objective>
CRUD de grupos de noivas (CLI-03; D-01, D-02, D-04, D-06, D-25): evento com data, "pronta até", local (estúdio/externo + deslocamento), noiva principal e acompanhantes (cliente existente ou mínima), serviços planejados por pessoa e marcação de cobertura pelo contrato.

Purpose: base para contrato (04-06), agenda do evento (04-08) e IA (04-12).
Output: `bridal.graphql`, BridalModule preenchido (resolver + service), suíte `phase4-bridal-group`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-01-SUMMARY.md
@apps/backend/src/comandas/comandas.service.ts
@apps/backend/src/comandas/comandas.resolver.ts
@apps/backend/src/graphql/schema/comandas.graphql

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4`. Este plano é dono de `bridal.graphql` e de `src/bridal/bridal.*` (o 04-08 estende os mesmos arquivos depois).

<interfaces>
Padrões existentes:
- Resolver: `@Resolver()`, `@Query('x')`/`@Mutation('x')`, `@RequirePermission(PERMISSIONS.X)`, `@CurrentTenant() tenant: TenantContext` (tenant.organizationId, tenant.memberId).
- Erros de domínio como payload `{ <entity>: X | null, errors: [UserError!]! }` (UserError { code message field } em auth.graphql); validação de leitura como BadRequest.
- Cliente mínima (03 D-06, copiado de ComandasService.openWalkIn): `fullName.trim()` 2..255 (`INVALID_NAME`), `phone?.trim() || null` ≤ 30 (`INVALID_PHONE`), `tx.client.create({ data: { organizationId, fullName, phone } })`. NÃO alterar comandas.service.ts — copiar para `bridal-clients.ts`.
- Datas de evento como `String` `YYYY-MM-DD` no SDL (não há scalar Date); instantes como `DateTime`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: SDL bridal.graphql + erros + serialização</name>
  <files>apps/backend/src/graphql/schema/bridal.graphql, apps/backend/src/bridal/bridal-errors.ts, apps/backend/src/bridal/bridal-serialize.ts, apps/backend/src/bridal/bridal-clients.ts</files>
  <read_first>
    - apps/backend/src/graphql/schema/comandas.graphql (estilo de payload/inputs)
    - apps/backend/src/comandas/comanda-items.ts (ComandaError/mapComandaError)
    - apps/backend/src/comandas/comandas.service.ts linhas 115–175 (openWalkIn)
  </read_first>
  <action>
Criar `bridal.graphql`:
```graphql
type BridalGroup {
  id: UUID!  name: String!  eventDate: String!  readyBy: DateTime
  locationKind: String!  locationAddress: String
  travelMinutesBefore: Int!  travelMinutesAfter: Int!
  status: String!  notes: String  cancelReason: String
  members: [BridalGroupMember!]!
  contractId: UUID  contractCode: String  contractStatus: String
  appointmentCount: Int!
  createdAt: DateTime!
}
type BridalGroupMember {
  id: UUID!  clientId: UUID!  clientName: String!  clientPhone: String
  role: String!  relationLabel: String  coveredByContract: Boolean!
  services: [BridalMemberService!]!
  hasClosedComanda: Boolean!
}
type BridalMemberService { id: UUID!  serviceId: UUID!  serviceName: String!  durationMinutes: Int!  purpose: String! }
input BridalGroupFieldsInput {
  name: String!  eventDate: String!  readyBy: DateTime
  locationKind: String  locationAddress: String
  travelMinutesBefore: Int  travelMinutesAfter: Int  notes: String
}
input BridalNewClientInput { fullName: String!  phone: String }
input BridalMemberServiceInput { serviceId: UUID!  purpose: String }
input BridalPersonInput {
  clientId: UUID  newClient: BridalNewClientInput
  relationLabel: String  coveredByContract: Boolean
  services: [BridalMemberServiceInput!]
}
input CreateBridalGroupInput { group: BridalGroupFieldsInput!  bride: BridalPersonInput!  companions: [BridalPersonInput!] }
type BridalGroupPayload { group: BridalGroup  errors: [UserError!]! }
extend type Query {
  bridalGroups(status: String, from: String, to: String): [BridalGroup!]!
  bridalGroup(id: UUID!): BridalGroup
}
extend type Mutation {
  createBridalGroup(input: CreateBridalGroupInput!): BridalGroupPayload!
  updateBridalGroup(id: UUID!, input: BridalGroupFieldsInput!): BridalGroupPayload!
  addBridalGroupMember(groupId: UUID!, person: BridalPersonInput!): BridalGroupPayload!
  removeBridalGroupMember(memberId: UUID!): BridalGroupPayload!
  setBridalMemberCoverage(memberId: UUID!, covered: Boolean!): BridalGroupPayload!
  setBridalMemberServices(memberId: UUID!, services: [BridalMemberServiceInput!]!): BridalGroupPayload!
}
```
`bridal-errors.ts`: `class BridalError extends Error { constructor(code, message, field = null) }` e `mapBridalError(e)` que aceita BridalError e também delega a `mapSchedulingError` (para uso no 04-08), retornando `{code,message,field} | null`; violações únicas Prisma `P2002` em `uq_bgm_group_client` → `MEMBER_ALREADY_IN_GROUP`, `uq_bgm_one_bride` → `BRIDE_ALREADY_SET`.
`bridal-clients.ts`: `resolvePersonClientTx(tx, orgId, person): Promise<string>` — exatamente um de `clientId`/`newClient` (`CLIENT_REQUIRED`), cliente existente ativo (`CLIENT_NOT_FOUND`), ou cria cliente mínima com as validações copiadas.
`bridal-serialize.ts`: `BRIDAL_GROUP_INCLUDE` (members ordenados por role desc 'bride' primeiro + sort_order, com client e services + service{name,durationMinutes}) e `serializeBridalGroup(row, extras: { contract?: {id, code, status} | null; appointmentCount: number; closedComandaClientIds: Set<string> })`. `eventDate` serializado como `YYYY-MM-DD` (`toISOString().slice(0,10)` do DATE).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "createBridalGroup(input: CreateBridalGroupInput!): BridalGroupPayload!" apps/backend/src/graphql/schema/bridal.graphql` encontra
    - `grep -n "export function mapBridalError" apps/backend/src/bridal/bridal-errors.ts` encontra
    - `grep -n "export async function resolvePersonClientTx" apps/backend/src/bridal/bridal-clients.ts` encontra
    - typecheck verde
  </acceptance_criteria>
  <done>Contrato GraphQL dos grupos publicado e helpers prontos.</done>
</task>

<task type="auto">
  <name>Task 2: BridalService + resolver + módulo</name>
  <files>apps/backend/src/bridal/bridal.service.ts, apps/backend/src/bridal/bridal.resolver.ts, apps/backend/src/bridal/bridal.module.ts</files>
  <read_first>
    - apps/backend/src/comandas/comandas.service.ts (padrão try/runWithTenant/catch → payload)
    - apps/backend/src/comandas/comandas.module.ts
    - apps/backend/src/bridal/bridal-errors.ts, bridal-clients.ts, bridal-serialize.ts (Task 1)
  </read_first>
  <action>
`BridalService` (injeta `TenantContextService`), todas as escritas em `runWithTenant(orgId, fn)` e erros → payload via `mapBridalError`:
- `validateGroupFields(input)`: `name` 2..160 (`INVALID_NAME`); `eventDate` `/^\d{4}-\d{2}-\d{2}$/` e data válida (`INVALID_EVENT_DATE`); `locationKind ∈ {studio, external}` default studio (`INVALID_LOCATION`); external exige `locationAddress` não vazio (`ADDRESS_REQUIRED`); travel 0..240 inteiros (`INVALID_TRAVEL`) — com `studio`, gravar travel 0; `readyBy` (se vier) com data local == eventDate no fuso da org (`READY_BY_OUTSIDE_EVENT_DAY`; ler `organizations.timezone` via `SELECT timezone FROM organizations`).
- `create(orgId, memberId, input)`: valida campos, máx. 15 pessoas no total (`TOO_MANY_PEOPLE`); cria grupo (`created_by = memberId`); noiva (`role 'bride'`, `coveredByContract` default **true**) e acompanhantes (`role 'companion'`, default **false** — D-07: madrinha paga avulso), `sort_order` pela ordem; `bridal_member_services` por pessoa (`purpose` default 'event'; serviço ativo — `SERVICE_NOT_FOUND`; máx. 10 por pessoa — `TOO_MANY_SERVICES`).
- `update(orgId, id, input)`: grupo `status = 'active'` (`GROUP_NOT_ACTIVE`); atualiza campos. Se `eventDate` mudou e existe contrato vivo, apenas atualizar o grupo (o 04-06 trata o recálculo do prazo ao editar o contrato — registrar no SUMMARY).
- `addMember(orgId, groupId, person)` (role companion), `removeMember(orgId, memberId)`: bloqueia remover a noiva (`CANNOT_REMOVE_BRIDE`), membro com agendamento do grupo em status bloqueante (`MEMBER_HAS_APPOINTMENTS` — `appointments` com `bridal_group_id = grupo AND client_id = membro.client_id AND status IN ('scheduled','confirmed','in_progress','completed')`) ou com `contract_items` em contrato vivo (`MEMBER_IN_CONTRACT`).
- `setCoverage(orgId, memberId, covered)` (D-06, D-25): se existe comanda `closed` ligada a agendamento do grupo dessa cliente (`appointments.bridal_group_id = g AND client_id = c AND comanda.status = 'closed'`) → `COVERAGE_LOCKED` ("A comanda desta pessoa já foi fechada; a cobertura não pode mudar."); ao desmarcar, se há `contract_items` desse membro em contrato vivo → `MEMBER_IN_CONTRACT` ("Remova os itens desta pessoa do contrato primeiro.").
- `setServices(orgId, memberId, services)`: substitui a lista (delete + createMany) com as mesmas validações.
- `list(orgId, {status, from, to})`: filtros opcionais (`from/to` por `event_date`), ordenado por `event_date`; `get(orgId, id)`: null se não existe. Ambos montam extras: contrato vivo (`status <> 'cancelled'`), `appointmentCount` (status bloqueante) e `closedComandaClientIds`.
Resolver `BridalResolver`: queries com `BRIDAL_READ`; mutations com `BRIDAL_WRITE`. `BridalModule`: `providers: [BridalService, BridalResolver]`, `exports: [BridalService]`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "COVERAGE_LOCKED" apps/backend/src/bridal/bridal.service.ts` encontra
    - `grep -n "MEMBER_IN_CONTRACT\|CANNOT_REMOVE_BRIDE\|TOO_MANY_PEOPLE" apps/backend/src/bridal/bridal.service.ts` encontra os 3
    - `grep -n "providers: \[BridalService, BridalResolver\]" apps/backend/src/bridal/bridal.module.ts` encontra (ordem pode variar)
  </acceptance_criteria>
  <done>Grupos de noivas criáveis e editáveis pelo GraphQL com as regras de D-02/D-06/D-25.</done>
</task>

<task type="auto">
  <name>Task 3: Suíte de integração phase4-bridal-group</name>
  <files>apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase4-fixtures.ts (createPhase4World, gqlAs, insertContractRow)
    - apps/backend/test/integration/phase3-visit.e2e.spec.ts (estilo)
  </read_first>
  <action>
Casos (world `createPhase4World('p4bg')`):
1. Admin cria grupo com noiva (cliente existente `w.clientId`, serviços serviceId+serviceBId) + 4 acompanhantes cliente mínima (2 com telefone) cada uma com serviceBId → payload sem erros, 5 membros, noiva `coveredByContract true`, acompanhantes `false`, clientes mínimas criados na tabela `clients` com só nome/telefone (CLI-03 / critério 1).
2. Mesma cliente duas vezes → `MEMBER_ALREADY_IN_GROUP`; `addBridalGroupMember` com a noiva de novo → erro; tentar segunda noiva via SQL viola `uq_bgm_one_bride`.
3. `locationKind: "external"` sem endereço → `ADDRESS_REQUIRED`; travel 300 → `INVALID_TRAVEL`; `readyBy` em outro dia → `READY_BY_OUTSIDE_EVENT_DAY`.
4. `setBridalMemberCoverage(acompanhante, true)` ok; inserir via adminPrisma agendamento com `bridal_group_id` + comanda `closed` para a cliente → nova troca → `COVERAGE_LOCKED` (D-25).
5. `insertContractRow` com item da acompanhante coberta → desmarcar cobertura → `MEMBER_IN_CONTRACT`; `removeBridalGroupMember` → `MEMBER_IN_CONTRACT`; remover a noiva → `CANNOT_REMOVE_BRIDE`.
6. RBAC: `proA` (PROFESSIONAL) em `bridalGroups` → erro de permissão; `attendant` cria grupo ok. RLS: `otherAdmin` em `bridalGroup(id)` da org A → `null`; `updateBridalGroup` → erro/`NOT_FOUND`.
7. `bridalGroups(from, to)` filtra por data do evento; `contractCode` aparece quando há contrato vivo.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-bridal-group</automated>
  </verify>
  <acceptance_criteria>
    - Suíte verde com ≥ 7 `it(`
    - `grep -n "COVERAGE_LOCKED" apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts` encontra
    - `grep -n "otherAdmin" apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts` encontra
  </acceptance_criteria>
  <done>CLI-03 coberto por integração com RLS e RBAC.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test:integration -- phase4` verde; nenhuma suíte phase3 quebrada.</verification>

<success_criteria>Critério de sucesso 1 do ROADMAP (grupo com noiva + 4 acompanhantes com serviços) atendido no backend.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-05-SUMMARY.md`
</output>

---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 04
type: execute
wave: 2
depends_on: ["09-01", "09-02"]
files_modified:
  - apps/backend/src/app.module.ts
  - apps/backend/src/commercial/commercial.module.ts
  - apps/backend/src/commercial/commercial-errors.ts
  - apps/backend/src/commercial/commercial-win.module.ts
  - apps/backend/src/commercial/commercial-reminders.module.ts
  - apps/backend/src/commercial/commercial-reports.module.ts
  - apps/backend/src/commercial/commercial-intake.module.ts
  - apps/backend/src/graphql/schema/commercial.graphql
  - apps/backend/src/commercial/commercial-stages.service.ts
  - apps/backend/src/commercial/commercial-leads.service.ts
  - apps/backend/src/commercial/commercial.resolver.ts
  - apps/backend/test/integration/phase9-stages.e2e.spec.ts
  - apps/backend/test/integration/phase9-leads.e2e.spec.ts
autonomous: true
requirements: [COM-01, COM-05, COM-10]

must_haves:
  truths:
    - "commercialStages devolve as etapas da org em ordem; org sem etapas ganha as 6 padrão no primeiro acesso (ensureDefaultStages idempotente)"
    - "ADMIN/MANAGER criam, editam (nome, cor, prazo), reordenam e excluem etapas abertas; Ganho/Perdido não são excluídas nem mudam de tipo e ficam sempre depois das abertas; etapa com negócios não é excluída sem destino (D-07, D-13)"
    - "Cadastro de lead manual grava phone_digits; commercialDuplicateCheck acha cliente do SGS e lead pelo telefone (com máscara/+55/9º dígito) e pelo e-mail (D-02)"
    - "linkCommercialLeadClient liga o lead a uma cliente existente; o lead nunca aparece em clients (D-01)"
    - "ATTENDANT só lista/abre leads que criou ou com negócio dela; lead invisível por id dá null; PROFESSIONAL recebe FORBIDDEN em toda operação (D-11, D-12)"
  artifacts:
    - path: "apps/backend/src/graphql/schema/commercial.graphql"
      provides: "SDL de etapas, leads, duplicidade, responsáveis"
      contains: "commercialDuplicateCheck"
    - path: "apps/backend/src/commercial/commercial.module.ts"
      provides: "CommercialModule (importa os 4 submódulos)"
      contains: "CommercialWinModule"
    - path: "apps/backend/src/commercial/commercial-stages.service.ts"
      provides: "ensureDefaultStagesTx, CRUD/reordenação de etapas"
      exports: ["CommercialStagesService", "ensureDefaultStagesTx"]
    - path: "apps/backend/src/commercial/commercial-leads.service.ts"
      provides: "CRUD de lead, duplicidade, vínculo"
      exports: ["CommercialLeadsService", "findDuplicatesTx"]
  key_links:
    - from: "apps/backend/src/commercial/commercial-leads.service.ts"
      to: "visibilityWhere"
      via: "todo where de lead"
      pattern: "visibilityWhere\\("
    - from: "apps/backend/src/commercial/commercial.resolver.ts"
      to: "PERMISSIONS.COMMERCIAL_*"
      via: "@RequirePermission em cada operação"
      pattern: "@RequirePermission\\(PERMISSIONS\\.COMMERCIAL_"
    - from: "apps/backend/src/app.module.ts"
      to: "CommercialModule"
      via: "imports"
      pattern: "CommercialModule"
---

<objective>
Núcleo do backend do Comercial: `CommercialModule` (com os quatro submódulos vazios que os planos 09-06, 09-08, 09-09 e 09-10 preenchem), erros do domínio, SDL de etapas e leads, serviços de etapas e de leads (com duplicidade e vínculo à cliente) e resolver.

Purpose: COM-01 e COM-05 de ponta a ponta na API, com a visibilidade por papel (COM-10) aplicada desde o primeiro serviço.
Output: módulo, SDL `commercial.graphql`, 2 serviços, resolver e 2 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-01-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-02-SUMMARY.md

**Ambiente de execução:** igual ao 09-01.

**Submódulos (interface-first):** para os planos de onda 3 rodarem em paralelo sem disputar `commercial.module.ts`, este plano cria quatro módulos vazios que já ficam importados por `CommercialModule`:
`commercial-win.module.ts` (`CommercialWinModule`, 09-06), `commercial-reminders.module.ts` (`CommercialRemindersModule`, 09-08), `commercial-reports.module.ts` (`CommercialReportsModule`, 09-09), `commercial-intake.module.ts` (`CommercialIntakeModule`, 09-10). Cada um: `@Module({ imports: [DatabaseModule, AuthzModule], providers: [], exports: [] }) export class X {}` com comentário "preenchido no 09-NN". Para evitar import circular, os serviços do núcleo ficam num módulo próprio `CommercialCoreModule` declarado DENTRO de `commercial.module.ts` (mesmo arquivo), exportado, e `CommercialModule` = `@Module({ imports: [CommercialCoreModule, CommercialWinModule, CommercialRemindersModule, CommercialReportsModule, CommercialIntakeModule] })`. Os submódulos importam `CommercialCoreModule` de `./commercial.module` quando precisarem (só o 09-05 edita `commercial.module.ts`).

**SDL:** schema-first, um `.graphql` por área (`typePaths` pega `**/*.graphql`), `extend type Query/Mutation`, erro `UserError { code message field }` já existe em `auth.graphql`, escalares `UUID` e `DateTime`. Datas sem hora como `String` (`YYYY-MM-DD`), dinheiro como `String` ('500.00'), igual a `contracts.graphql`.

<interfaces>
`TenantContextService.runWithTenant(orgId, async (tx) => ...)` (`apps/backend/src/database/tenant-context.service.ts`), `TenantPrismaClient`.
Resolver (modelo `bridal.resolver.ts`): `@Resolver() class X { @Query('nome') @RequirePermission(PERMISSIONS.BRIDAL_READ) m(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {...} }`; `TenantContext { organizationId, memberId, roleName }`.
Do 09-02: `visibilityWhere({ roleName, memberId })` → `{ deal, lead, interaction, reminder }`; `isManagerRole`, `canUseCommercial`; `phoneDigits`, `phoneKey`; `COMMERCIAL_SOURCES`.
Do 09-01: models Prisma `CommercialStage`, `CommercialLead` (`fullName, phone, phoneDigits, email, source, notes, clientId, createdBy, consentAt, consentTextVersion, deletedAt`), `CommercialDeal`; fixtures `createPhase9World`, `insertLeadRow`, `insertDealRow`, `stageIdOf`; `gqlAs`.
Padrão de erro: `ContractError(code, message, field)` + `fail(e)` que converte em `{ x: null, errors: [UserError] }` e relança o resto.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Módulos, erros e SDL do núcleo</name>
  <files>apps/backend/src/app.module.ts, apps/backend/src/commercial/commercial.module.ts, apps/backend/src/commercial/commercial-errors.ts, apps/backend/src/commercial/commercial-win.module.ts, apps/backend/src/commercial/commercial-reminders.module.ts, apps/backend/src/commercial/commercial-reports.module.ts, apps/backend/src/commercial/commercial-intake.module.ts, apps/backend/src/graphql/schema/commercial.graphql</files>
  <read_first>
    - apps/backend/src/app.module.ts
    - apps/backend/src/bridal/bridal.module.ts
    - apps/backend/src/contracts/contract-errors.ts
    - apps/backend/src/graphql/schema/bridal.graphql (estilo de SDL, payloads)
  </read_first>
  <action>
1. `commercial-errors.ts`: `export class CommercialError extends Error { constructor(readonly code: string, message: string, readonly field: string | null = null) { super(message); this.name = 'CommercialError'; } }` e `export function mapCommercialError(e: unknown): { code: string; message: string; field: string | null } | null` (CommercialError → objeto; senão null). Códigos usados na fase: `NOT_FOUND`, `FORBIDDEN_ROLE`, `STAGE_SYSTEM`, `STAGE_NOT_EMPTY`, `STAGE_ORDER`, `STAGE_LAST_OPEN`, `COLOR_INVALID`, `SLA_INVALID`, `NAME_REQUIRED`, `CONTACT_REQUIRED`, `PHONE_INVALID`, `EMAIL_INVALID`, `ASSIGNEE_INVALID`, `DEAL_CLOSED`, `PACKAGE_REQUIRED`, `LOST_REASON_REQUIRED`, `WIN_NOT_ALLOWED`.
2. Módulos conforme o contexto; `CommercialModule` registrado em `app.module.ts` depois de `PushModule`.
3. `commercial.graphql`:
```graphql
enum CommercialStageKind { open won lost }

type CommercialStage {
  id: UUID!
  name: String!
  color: String!
  position: Int!
  slaDays: Int
  kind: CommercialStageKind!
  isSystem: Boolean!
  openDeals: Int!
}

input CommercialStageInput { name: String! color: String! slaDays: Int }

type CommercialMember { id: UUID! displayName: String! roleName: String! }

type CommercialClientRef { id: UUID! fullName: String! phone: String email: String }

type CommercialLeadRef { id: UUID! fullName: String! phone: String email: String }

type CommercialDuplicateCheck { clients: [CommercialClientRef!]! leads: [CommercialLeadRef!]! }

type CommercialLead {
  id: UUID!
  fullName: String!
  phone: String
  email: String
  source: String!
  notes: String
  client: CommercialClientRef
  createdBy: CommercialMember
  consentAt: DateTime
  createdAt: DateTime!
  openDeals: Int!
  lastInteractionAt: DateTime
}

type CommercialLeadPage { items: [CommercialLead!]! total: Int! }

input CommercialLeadFilter {
  search: String
  source: String
  assigneeMemberId: UUID
  unassigned: Boolean
  limit: Int
  offset: Int
}

input CreateCommercialLeadInput {
  fullName: String!
  phone: String
  email: String
  source: String
  notes: String
  clientId: UUID
}

input UpdateCommercialLeadInput {
  id: UUID!
  fullName: String
  phone: String
  email: String
  source: String
  notes: String
}

type CommercialStagePayload { stage: CommercialStage errors: [UserError!]! }
type CommercialStagesPayload { stages: [CommercialStage!]! errors: [UserError!]! }
type CommercialLeadPayload { lead: CommercialLead errors: [UserError!]! }
type CommercialOkPayload { ok: Boolean! errors: [UserError!]! }

extend type Query {
  commercialStages: [CommercialStage!]!
  commercialLeads(filter: CommercialLeadFilter): CommercialLeadPage!
  commercialLead(id: UUID!): CommercialLead
  commercialDuplicateCheck(phone: String, email: String, excludeLeadId: UUID): CommercialDuplicateCheck!
  commercialAssignees: [CommercialMember!]!
}

extend type Mutation {
  createCommercialStage(input: CommercialStageInput!): CommercialStagePayload!
  updateCommercialStage(id: UUID!, input: CommercialStageInput!): CommercialStagePayload!
  reorderCommercialStages(ids: [UUID!]!): CommercialStagesPayload!
  deleteCommercialStage(id: UUID!, moveToStageId: UUID): CommercialOkPayload!
  createCommercialLead(input: CreateCommercialLeadInput!): CommercialLeadPayload!
  updateCommercialLead(input: UpdateCommercialLeadInput!): CommercialLeadPayload!
  linkCommercialLeadClient(leadId: UUID!, clientId: UUID): CommercialLeadPayload!
  deleteCommercialLead(id: UUID!): CommercialOkPayload!
  purgeCommercialLead(id: UUID!): CommercialOkPayload!
}
```
   (`commercialAssignees`: membros ativos, não excluídos, com papel ADMIN/MANAGER/ATTENDANT — D-14. `source` como String validada contra `COMMERCIAL_SOURCES` no serviço.)
4. Typecheck e boot: `corepack pnpm --filter @sgs/backend typecheck` (resolvers ainda não existem; o SDL sem resolver não quebra o boot do Apollo schema-first — conferir rodando `corepack pnpm --filter @sgs/backend test:integration -- phase9-rls-rbac`, que sobe o AppModule).
Commit `feat(09-04): módulo e SDL do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test:integration -- phase9-rls-rbac</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "CommercialModule" apps/backend/src/app.module.ts` encontra 2 (import + uso)
    - `grep -c "export class Commercial.*Module" apps/backend/src/commercial/*.module.ts` = 6 (Core, Module, Win, Reminders, Reports, Intake)
    - `grep -n "commercialDuplicateCheck" apps/backend/src/graphql/schema/commercial.graphql` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Esqueleto do módulo e contrato GraphQL do núcleo no ar.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Etapas (ensureDefaultStages, CRUD, ordem) + phase9-stages</name>
  <files>apps/backend/src/commercial/commercial-stages.service.ts, apps/backend/src/commercial/commercial.resolver.ts, apps/backend/test/integration/phase9-stages.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/bridal/bridal.resolver.ts
    - apps/backend/src/authz/decorators/require-permission.decorator.ts
    - apps/backend/test/integration/phase4-rls-rbac.e2e.spec.ts (uso de gqlAs e asserts de FORBIDDEN)
    - apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql (backfill)
  </read_first>
  <behavior>
    - org nova sem etapas: commercialStages devolve 6 (Novo..Negociação, Ganho, Perdido) e chamar duas vezes em paralelo não duplica
    - createCommercialStage como MANAGER cria etapa aberta na última posição aberta (antes de Ganho)
    - updateCommercialStage altera nome/cor/slaDays; em Ganho aceita nome e cor e ignora/zera slaDays; cor fora de #RRGGBB → COLOR_INVALID
    - reorderCommercialStages com Ganho antes de uma aberta → STAGE_ORDER; lista que não contém exatamente todas as etapas → STAGE_ORDER
    - deleteCommercialStage em Ganho/Perdido → STAGE_SYSTEM; em etapa com negócio sem moveToStageId → STAGE_NOT_EMPTY; com moveToStageId aberto move os negócios (stage_entered_at = now()) e apaga; a última etapa aberta → STAGE_LAST_OPEN
    - ATTENDANT: commercialStages OK; create/update/reorder/delete → FORBIDDEN; PROFESSIONAL: commercialStages → FORBIDDEN
    - openDeals conta só negócios visíveis ao usuário (ATTENDANT conta só os dela)
  </behavior>
  <action>
1. `commercial-stages.service.ts`:
   - `export async function ensureDefaultStagesTx(tx, orgId): Promise<void>`: `SELECT pg_advisory_xact_lock(hashtext('commercial_stages:' || ${orgId}))` e, se `count == 0`, cria as 6 etapas com os mesmos valores do backfill do 09-01 (constante `DEFAULT_STAGES` exportada).
   - `CommercialStagesService` com `list(orgId, viewer)` (chama `ensureDefaultStagesTx`, ordena por `position`, `openDeals` por `groupBy` de `commercialDeal` com `status: 'open'` + `visibilityWhere(viewer).deal`), `create`, `update`, `reorder` (reescreve `position` 0..n, exigindo abertas antes de `won` e `lost`, com `won` antes de `lost`), `remove(orgId, id, moveToStageId)`, todos dentro de `runWithTenant` e convertendo `CommercialError` em payload com `errors`.
   - Validações: nome 1..60 após trim (`NAME_REQUIRED`), cor `^#[0-9A-Fa-f]{6}$` (`COLOR_INVALID`), `slaDays` null ou 1..365 (`SLA_INVALID`).
2. `commercial.resolver.ts` (`@Resolver()`): `commercialStages` → `COMMERCIAL_READ`; `createCommercialStage`/`updateCommercialStage`/`reorderCommercialStages`/`deleteCommercialStage` → `COMMERCIAL_MANAGE`. Viewer = `{ roleName: tenant.roleName, memberId: tenant.memberId }`.
3. `phase9-stages.e2e.spec.ts` com os casos do `<behavior>` (mundo `createPhase9World('p9stages')`).
Commits `test(09-04): etapas do funil` e `feat(09-04): etapas configuráveis por salão`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-stages && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function ensureDefaultStagesTx" apps/backend/src/commercial/commercial-stages.service.ts` encontra
    - `grep -n "pg_advisory_xact_lock" apps/backend/src/commercial/commercial-stages.service.ts` encontra
    - `grep -c "PERMISSIONS.COMMERCIAL_MANAGE" apps/backend/src/commercial/commercial.resolver.ts` ≥ 4
    - `grep -c "STAGE_SYSTEM\|STAGE_NOT_EMPTY\|STAGE_ORDER\|STAGE_LAST_OPEN" apps/backend/test/integration/phase9-stages.e2e.spec.ts` ≥ 4
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Etapas configuráveis com regras de sistema e ordem.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Leads, duplicidade e vínculo + phase9-leads</name>
  <files>apps/backend/src/commercial/commercial-leads.service.ts, apps/backend/src/commercial/commercial.resolver.ts, apps/backend/test/integration/phase9-leads.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/clients/clients.service.ts (campos de Client, e-mail em minúsculas)
    - apps/backend/src/commercial/commercial-phone.ts e commercial-access.ts (09-02)
    - apps/backend/src/commercial/commercial.resolver.ts (Task 2)
  </read_first>
  <behavior>
    - createCommercialLead sem telefone e sem e-mail → CONTACT_REQUIRED; telefone com menos de 10 dígitos → PHONE_INVALID; e-mail sem '@' → EMAIL_INVALID; grava phone_digits e email minúsculo; createdBy = membro atual; source padrão 'manual'
    - commercialDuplicateCheck('+55 (11) 9 9999-0000') acha a cliente do SGS com phone '(11) 99999-0000' e a com phone2 '11 9999-0000'; por e-mail ignora caixa; também acha lead existente; excludeLeadId tira o próprio lead; no máximo 10 de cada
    - linkCommercialLeadClient(leadId, clientId) grava client_id; clientId null desfaz; cliente de outra org ou excluída → NOT_FOUND
    - criar lead não cria linha em clients (count de clients da org igual antes/depois)
    - ATTENDANT A: commercialLeads lista só leads criados por A ou com negócio de A; lead de B por id → null; update/link de lead de B → NOT_FOUND; deleteCommercialLead/purgeCommercialLead → FORBIDDEN (D-13)
    - MANAGER: lista tudo; filtro unassigned=true lista só leads sem negócio com responsável e sem criador ATTENDANT (leads de site/importação, D-20)
    - deleteCommercialLead (MANAGER) marca deleted_at no lead e nos negócios dele; some das listas; purgeCommercialLead (MANAGER) apaga a linha (cascata em negócios, interações, lembretes)
    - PROFESSIONAL: commercialLeads/commercialLead/createCommercialLead/commercialDuplicateCheck/commercialAssignees → FORBIDDEN
    - commercialAssignees devolve admin, manager, attendant e attendantB; não devolve proA/proB
  </behavior>
  <action>
1. `commercial-leads.service.ts`:
   - `export async function findDuplicatesTx(tx, input: { phone?: string | null; email?: string | null; excludeLeadId?: string | null })` com `$queryRaw` sobre `clients` (`deleted_at IS NULL`, `phone`, `phone2`, `phone3`) e `commercial_leads` (`deleted_at IS NULL`, `phone_digits`), comparando DDD + últimos 8 dígitos de `regexp_replace(col, '\D', '', 'g')` (depois de tirar `55` inicial quando tiver 12–13 dígitos) com `phoneKey(input.phone)`, e `lower(email) = lower(input.email)`; `LIMIT 10` cada. RLS já restringe à org. Usado também pelos planos 09-06 e 09-10.
   - `CommercialLeadsService`: `list(orgId, viewer, filter)` (limit padrão 50, máximo 200; `search` em `full_name ILIKE` ou `phone_digits LIKE`; `assigneeMemberId`/`unassigned` só para manager — ATTENDANT ignora), `get`, `create`, `update`, `link`, `softDelete`, `purge`, `duplicates(viewer, ...)`. Todo `where` de lead inclui `...visibilityWhere(viewer).lead`. `openDeals` e `lastInteractionAt` calculados (negócios abertos visíveis; `max(occurred_at)` de interações).
   - `assignees(orgId)`: `member.findMany({ where: { status: 'active', deletedAt: null, role: { name: { in: ['ADMIN','MANAGER','ATTENDANT'] } } } })` → `{ id, displayName, roleName }`.
2. Resolver: `commercialLeads`, `commercialLead`, `commercialDuplicateCheck`, `commercialAssignees` → `COMMERCIAL_READ`; `createCommercialLead`, `updateCommercialLead`, `linkCommercialLeadClient` → `COMMERCIAL_WRITE`; `deleteCommercialLead`, `purgeCommercialLead` → `COMMERCIAL_MANAGE`.
3. `phase9-leads.e2e.spec.ts` com os casos do `<behavior>`.
Commits `test(09-04): leads e duplicidade` e `feat(09-04): leads com aviso de cliente existente`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-leads phase9-stages && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function findDuplicatesTx" apps/backend/src/commercial/commercial-leads.service.ts` encontra
    - `grep -c "visibilityWhere(" apps/backend/src/commercial/commercial-leads.service.ts` ≥ 3
    - `grep -n "regexp_replace" apps/backend/src/commercial/commercial-leads.service.ts` encontra
    - `grep -c "FORBIDDEN" apps/backend/test/integration/phase9-leads.e2e.spec.ts` ≥ 3
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Leads com duplicidade, vínculo e visibilidade por papel na API.</done>
</task>

</tasks>

<verification>
`phase9-stages`, `phase9-leads`, `phase9-rls-rbac` verdes; typecheck e lint do backend verdes.
</verification>

<success_criteria>
COM-01 e COM-05 funcionam pela API, com ATTENDANT restrita e PROFESSIONAL barrado.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md`
</output>

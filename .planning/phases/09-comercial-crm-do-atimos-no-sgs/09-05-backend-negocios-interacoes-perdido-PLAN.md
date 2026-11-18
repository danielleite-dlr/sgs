---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 05
type: execute
wave: 3
depends_on: ["09-04"]
files_modified:
  - apps/backend/src/graphql/schema/commercial-deals.graphql
  - apps/backend/src/commercial/commercial-deals.service.ts
  - apps/backend/src/commercial/commercial-interactions.service.ts
  - apps/backend/src/commercial/commercial-deals.resolver.ts
  - apps/backend/src/commercial/commercial.module.ts
  - apps/backend/test/integration/phase9-deals.e2e.spec.ts
  - apps/backend/test/integration/phase9-lose-deal.e2e.spec.ts
  - apps/backend/test/integration/phase9-interactions.e2e.spec.ts
autonomous: true
requirements: [COM-04, COM-07, COM-09, COM-10]

must_haves:
  truths:
    - "Um lead tem vários negócios independentes, cada um Noiva ou Debutante, com pacote do catálogo (preço fotografado), desconto, valor final, responsável, origem, local e observações (D-03, D-05, D-06)"
    - "Mover de etapa só vale para etapa aberta e negócio aberto; atualiza stage_entered_at; Ganho/Perdido só pelos fluxos próprios"
    - "ATTENDANT cria negócio já como responsável e não troca responsável; ADMIN/MANAGER atribuem a ADMIN/MANAGER/ATTENDANT ativos ou deixam sem responsável (D-13, D-14, D-20)"
    - "Perdido exige motivo da lista fixa (texto livre opcional, obrigatório em 'other') e manda o negócio para a etapa Perdido; só ADMIN/MANAGER reabrem (D-10, D-19)"
    - "Registrar interação atualiza last_interaction_at e, com 'próximo contato em', cria o lembrete na mesma transação (D-15, D-17)"
    - "overdue no negócio segue a regra de SLA por etapa (D-15)"
  artifacts:
    - path: "apps/backend/src/graphql/schema/commercial-deals.graphql"
      provides: "SDL de negócios e interações; extend type CommercialLead"
      contains: "loseCommercialDeal"
    - path: "apps/backend/src/commercial/commercial-deals.service.ts"
      provides: "CommercialDealsService"
      exports: ["CommercialDealsService"]
    - path: "apps/backend/src/commercial/commercial-interactions.service.ts"
      provides: "CommercialInteractionsService"
      exports: ["CommercialInteractionsService"]
  key_links:
    - from: "apps/backend/src/commercial/commercial-interactions.service.ts"
      to: "tx.commercialReminder.create"
      via: "nextContactAt na mesma transação"
      pattern: "commercialReminder\\.create"
    - from: "apps/backend/src/commercial/commercial-deals.service.ts"
      to: "isDealOverdue"
      via: "campo overdue"
      pattern: "isDealOverdue"
---

<objective>
Negócios (criar, editar, mover, atribuir, perder, reabrir, excluir), interações com "próximo contato em" e o campo de SLA, com SDL próprio e visibilidade por papel em toda consulta.

Purpose: COM-04, COM-07 e COM-09 na API; é o que o kanban e a ficha do lead consomem.
Output: `commercial-deals.graphql`, 2 serviços, resolver, 3 suítes de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md

**Ambiente de execução:** igual ao 09-01.

<interfaces>
Do 09-04: `CommercialCoreModule` (em `commercial.module.ts`, este plano acrescenta os providers novos ali), `CommercialError`, `mapCommercialError`, `CommercialStagesService`, `ensureDefaultStagesTx`, tipos SDL `CommercialStage`, `CommercialMember`, `CommercialLeadRef`, `CommercialLead`, `UserError`, `CommercialOkPayload`.
Do 09-02: `visibilityWhere`, `isManagerRole`, `isDealOverdue`, `overdueSince`, `LOST_REASONS`, `INTERACTION_TYPES`, `DEAL_KINDS`, `COMMERCIAL_SOURCES`.
Model `Package`: `price Decimal(12,2)`, `deletedAt`, `name`.
Fixtures (09-01): `createPhase9World`, `insertLeadRow`, `insertDealRow`, `stageIdOf`, `w.bridalPackageId` (500.00), `w.debutantePackageId` (900.00), `w.attendantB`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SDL e serviço de negócios (inclui perdido e reabrir)</name>
  <files>apps/backend/src/graphql/schema/commercial-deals.graphql, apps/backend/src/commercial/commercial-deals.service.ts, apps/backend/src/commercial/commercial-deals.resolver.ts, apps/backend/src/commercial/commercial.module.ts, apps/backend/test/integration/phase9-deals.e2e.spec.ts, apps/backend/test/integration/phase9-lose-deal.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/graphql/schema/commercial.graphql (09-04)
    - apps/backend/src/commercial/commercial-leads.service.ts e commercial.resolver.ts (09-04: padrão de viewer, payload e erros)
    - apps/backend/src/commercial/commercial.module.ts
  </read_first>
  <behavior>
    - createCommercialDeal(kind 'noiva', packageId bridal) → packageName/packagePrice '500.00' fotografados, discountAmount '50.00' → finalAmount '450.00'; desconto maior que o preço → DISCOUNT_INVALID; kind 'social' → KIND_INVALID; sem stageId vai para a primeira etapa aberta
    - ATTENDANT cria → assignee = ela mesma mesmo se mandar outro assigneeMemberId; MANAGER cria com assignee attendantB ou null
    - assignCommercialDeal: MANAGER para attendantB OK; para proA → ASSIGNEE_INVALID; ATTENDANT → FORBIDDEN
    - moveCommercialDeal para etapa aberta atualiza stageEnteredAt; para Ganho/Perdido → STAGE_SYSTEM; negócio ganho/perdido → DEAL_CLOSED
    - commercialDeals(filter) para o kanban: abertos + fechados nos últimos closedSinceDays (padrão 30); ATTENDANT A não vê negócio de B nem sem responsável; commercialDeal(id de B) → null; update/move de B → NOT_FOUND
    - overdue: etapa Contato (3 dias) com stageEnteredAt há 4 dias e sem interação → true; com lastInteractionAt há 1 dia → false
    - lead.deals lista os negócios visíveis do lead
    - loseCommercialDeal sem reasonCode válido → LOST_REASON_REQUIRED; 'other' sem texto → LOST_REASON_REQUIRED; texto > 500 → LOST_REASON_TOO_LONG; OK → status lost, etapa Perdido, closedAt, motivo gravado
    - loseCommercialDeal em negócio ganho → DEAL_CLOSED
    - reopenCommercialDeal como MANAGER → status open, etapa informada (ou primeira aberta), motivo limpo, closedAt null; como ATTENDANT → FORBIDDEN (D-19)
    - deleteCommercialDeal: MANAGER marca deleted_at; ATTENDANT → FORBIDDEN
    - PROFESSIONAL → FORBIDDEN em commercialDeals e createCommercialDeal
  </behavior>
  <action>
1. `commercial-deals.graphql`:
```graphql
type CommercialPackageRef { id: UUID! name: String! price: String! }

type CommercialDeal {
  id: UUID!
  leadId: UUID!
  lead: CommercialLeadRef!
  stage: CommercialStage!
  status: String!
  kind: String!
  beneficiaryName: String
  eventDate: String
  package: CommercialPackageRef
  packageName: String
  packagePrice: String
  discountAmount: String!
  finalAmount: String
  assignee: CommercialMember
  source: String!
  location: String
  notes: String
  stageEnteredAt: DateTime!
  lastInteractionAt: DateTime
  overdue: Boolean!
  overdueSince: DateTime
  lostReasonCode: String
  lostReasonText: String
  closedAt: DateTime
  wonContractId: UUID
  createdAt: DateTime!
}

type CommercialDealPage { items: [CommercialDeal!]! total: Int! }

input CommercialDealFilter {
  stageId: UUID
  status: String
  kind: String
  leadId: UUID
  assigneeMemberId: UUID
  unassigned: Boolean
  closedSinceDays: Int
  limit: Int
  offset: Int
}

input CreateCommercialDealInput {
  leadId: UUID!
  kind: String!
  stageId: UUID
  eventDate: String
  beneficiaryName: String
  packageId: UUID
  discountAmount: String
  assigneeMemberId: UUID
  source: String
  location: String
  notes: String
}

input UpdateCommercialDealInput {
  id: UUID!
  kind: String
  eventDate: String
  beneficiaryName: String
  packageId: UUID
  discountAmount: String
  source: String
  location: String
  notes: String
}

type CommercialDealPayload { deal: CommercialDeal errors: [UserError!]! }

type CommercialInteraction {
  id: UUID!
  leadId: UUID!
  dealId: UUID
  type: String!
  notes: String
  occurredAt: DateTime!
  createdBy: CommercialMember
  reminderId: UUID
}

input CreateCommercialInteractionInput {
  leadId: UUID!
  dealId: UUID
  type: String!
  notes: String
  occurredAt: DateTime
  nextContactAt: DateTime
  nextContactTitle: String
}

type CommercialInteractionPayload { interaction: CommercialInteraction errors: [UserError!]! }

extend type CommercialLead {
  deals: [CommercialDeal!]!
  interactions(limit: Int): [CommercialInteraction!]!
}

extend type Query {
  commercialDeals(filter: CommercialDealFilter): CommercialDealPage!
  commercialDeal(id: UUID!): CommercialDeal
  commercialInteractions(leadId: UUID!, dealId: UUID, limit: Int): [CommercialInteraction!]!
}

extend type Mutation {
  createCommercialDeal(input: CreateCommercialDealInput!): CommercialDealPayload!
  updateCommercialDeal(input: UpdateCommercialDealInput!): CommercialDealPayload!
  moveCommercialDeal(id: UUID!, stageId: UUID!): CommercialDealPayload!
  assignCommercialDeal(id: UUID!, assigneeMemberId: UUID): CommercialDealPayload!
  loseCommercialDeal(id: UUID!, reasonCode: String!, reasonText: String): CommercialDealPayload!
  reopenCommercialDeal(id: UUID!, stageId: UUID): CommercialDealPayload!
  deleteCommercialDeal(id: UUID!): CommercialOkPayload!
  createCommercialInteraction(input: CreateCommercialInteractionInput!): CommercialInteractionPayload!
  deleteCommercialInteraction(id: UUID!): CommercialOkPayload!
}
```
2. `CommercialDealsService` (todas as leituras/escritas com `...visibilityWhere(viewer).deal`; acesso a lead com `visibilityWhere(viewer).lead`): regras do `<behavior>`; `eventDate` validado `^\d{4}-\d{2}-\d{2}$` (`EVENT_DATE_INVALID`) e gravado como `DATE` (sem fuso: `new Date(ymd + 'T00:00:00Z')`); dinheiro em centavos inteiros para calcular `finalAmount` (sem float); `beneficiaryName` até 255; assignee validado por membro ativo, não excluído, papel ADMIN/MANAGER/ATTENDANT (`ASSIGNEE_INVALID`). Campos `overdue`/`overdueSince` via `isDealOverdue`/`overdueSince` com o `slaDays` da etapa e `new Date()`. `lead.deals` como `@ResolveField` em `@Resolver('CommercialLead')`.
3. Resolver `commercial-deals.resolver.ts`: leituras `COMMERCIAL_READ`; create/update/move/lose/createInteraction `COMMERCIAL_WRITE`; assign/reopen/delete/deleteInteraction `COMMERCIAL_MANAGE`.
4. `commercial.module.ts`: `CommercialDealsService`, `CommercialInteractionsService`, resolvers novos nos providers e exports do `CommercialCoreModule`.
5. Specs `phase9-deals` e `phase9-lose-deal` com os casos do `<behavior>`.
Commits `test(09-05): negócios e perdido` e `feat(09-05): negócios por lead com perdido e reabertura`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-deals phase9-lose-deal && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "extend type CommercialLead" apps/backend/src/graphql/schema/commercial-deals.graphql` encontra
    - `grep -c "visibilityWhere(" apps/backend/src/commercial/commercial-deals.service.ts` ≥ 4
    - `grep -n "isDealOverdue" apps/backend/src/commercial/commercial-deals.service.ts` encontra
    - `grep -c "PERMISSIONS.COMMERCIAL_MANAGE" apps/backend/src/commercial/commercial-deals.resolver.ts` ≥ 4
    - `grep -n "D-19\|reopenCommercialDeal" apps/backend/test/integration/phase9-lose-deal.e2e.spec.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Ciclo do negócio (menos o ganho) na API.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Interações com "próximo contato em" + phase9-interactions</name>
  <files>apps/backend/src/commercial/commercial-interactions.service.ts, apps/backend/src/commercial/commercial-deals.resolver.ts, apps/backend/test/integration/phase9-interactions.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/commercial/commercial-deals.service.ts (Task 1)
    - apps/backend/prisma/schema.prisma (CommercialInteraction, CommercialReminder)
  </read_first>
  <behavior>
    - createCommercialInteraction(type 'whatsapp', dealId) grava a interação e deal.lastInteractionAt = occurredAt; type inválido → TYPE_INVALID; notes > 2000 → NOTES_TOO_LONG; occurredAt mais de 5 min no futuro → OCCURRED_IN_FUTURE
    - sem dealId: atualiza lastInteractionAt de todos os negócios ABERTOS visíveis do lead
    - occurredAt mais antigo que o lastInteractionAt atual não volta a data (GREATEST)
    - nextContactAt no futuro cria commercial_reminders com title padrão 'Retomar contato com {nome do lead}' (ou nextContactTitle, até 160), lead_id, deal_id, interaction_id e created_by; reminderId volta no payload
    - nextContactAt no passado → NEXT_CONTACT_PAST e NADA é gravado (nem a interação)
    - dealId de outro lead → NOT_FOUND; ATTENDANT A em lead de B → NOT_FOUND
    - lead.interactions e commercialInteractions em ordem occurredAt desc, limit padrão 50
    - deleteCommercialInteraction: MANAGER OK; ATTENDANT → FORBIDDEN
  </behavior>
  <action>`CommercialInteractionsService.create(orgId, viewer, input)` numa só `runWithTenant`: valida lead (`visibilityWhere(viewer).lead`) e negócio (do lead, visível); cria interação; `UPDATE commercial_deals SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, $1), $1) WHERE ...` (um negócio ou os abertos do lead visíveis); se `nextContactAt`, `tx.commercialReminder.create` com os campos do `<behavior>`. `list`, `remove`. `lead.interactions` como `@ResolveField`. Spec com os casos. Commits `test(09-05): interações` e `feat(09-05): interações com próximo contato`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-interactions phase9-deals && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "commercialReminder.create" apps/backend/src/commercial/commercial-interactions.service.ts` encontra
    - `grep -n "GREATEST" apps/backend/src/commercial/commercial-interactions.service.ts` encontra
    - `grep -n "NEXT_CONTACT_PAST" apps/backend/test/integration/phase9-interactions.e2e.spec.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Histórico de interações único por lead, alimentando SLA e lembretes.</done>
</task>

</tasks>

<verification>
`phase9-deals`, `phase9-lose-deal`, `phase9-interactions` verdes; typecheck e lint.
</verification>

<success_criteria>
O funil anda pela API com regras de papel, SLA e perdido.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-05-SUMMARY.md`
</output>

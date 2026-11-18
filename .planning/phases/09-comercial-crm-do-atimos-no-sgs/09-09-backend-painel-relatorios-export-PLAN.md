---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 09
type: execute
wave: 3
depends_on: ["09-04"]
files_modified:
  - apps/backend/src/graphql/schema/commercial-reports.graphql
  - apps/backend/src/commercial/commercial-dashboard.service.ts
  - apps/backend/src/commercial/commercial-reports.service.ts
  - apps/backend/src/commercial/commercial-export.ts
  - apps/backend/src/commercial/commercial-export.spec.ts
  - apps/backend/src/commercial/commercial-reports.resolver.ts
  - apps/backend/src/commercial/commercial-reports.module.ts
  - apps/backend/test/integration/phase9-reports.e2e.spec.ts
autonomous: true
requirements: [COM-12, COM-10]

must_haves:
  truths:
    - "O Painel comercial mostra, para quem usa o Comercial e só com o que a pessoa vê: leads e negócios novos hoje, interações de hoje, lembretes vencidos e de hoje, follow-ups pendentes (SLA estourado), últimas interações, quantidade e valor por etapa, valor em negociação e taxa de conversão no período"
    - "Relatórios (só ADMIN/MANAGER) filtram por período, responsável, etapa, status, tipo e origem e trazem totais, por etapa, por responsável, por origem e motivos de perda (D-10, D-13)"
    - "Exportação Excel (.xlsx) e PDF sai do backend com as mesmas linhas do relatório, limitada a 5.000, com células que começam com = + - @ escapadas"
    - "ATTENDANT recebe FORBIDDEN em commercialReport e exportCommercialReport; PROFESSIONAL em todas"
  artifacts:
    - path: "apps/backend/src/commercial/commercial-export.ts"
      provides: "escapeCell, buildReportXlsx, buildReportPdf"
      exports: ["escapeCell", "buildReportXlsx", "buildReportPdf"]
    - path: "apps/backend/src/graphql/schema/commercial-reports.graphql"
      provides: "commercialDashboard, commercialReport, exportCommercialReport"
      contains: "exportCommercialReport"
  key_links:
    - from: "apps/backend/src/commercial/commercial-dashboard.service.ts"
      to: "visibilityWhere"
      via: "toda contagem"
      pattern: "visibilityWhere\\("
    - from: "apps/backend/src/commercial/commercial-reports.resolver.ts"
      to: "PERMISSIONS.COMMERCIAL_MANAGE"
      via: "relatório e exportação"
      pattern: "COMMERCIAL_MANAGE"
---

<objective>
Painel comercial e Relatórios no backend, com exportação Excel (exceljs) e PDF (pdfkit) entregue por GraphQL em base64.

Purpose: COM-12. Exportar no servidor mantém permissão e visibilidade sob controle (as rotas REST do projeto são públicas).
Output: SDL, 2 serviços, módulo de exportação puro com spec, resolver, `phase9-reports`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. `exceljs` instalado no 09-02; `pdfkit` 0.20.2 já usado em `contracts/acceptance/contract-pdf.service.ts`.

**SDL sem depender do 09-05:** tipos próprios (`CommercialFollowUp`, `CommercialReportRow`...) com campos planos; não referenciar `CommercialDeal`.

**Referência funcional:** `/root/atmo-crm/atmos-crm/src/components/dashboard/*` e `/root/atmo-crm/atmos-crm/src/app/relatorios/page.tsx`.

<interfaces>
Do 09-02: `visibilityWhere(viewer)`, `LOST_REASONS`, `COMMERCIAL_SOURCES`, `DEAL_KINDS`, regra SQL de SLA no comentário de `commercial-sla.ts`.
Do 09-04: `CommercialCoreModule`, `CommercialStagesService` (`ensureDefaultStagesTx`).
Fuso: `organization.timezone` (padrão `America/Sao_Paulo`); helpers `orgToday`/`localDate` em `contracts/contracts.service.ts` (copiar o uso, não duplicar lógica se forem exportados).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Exportação pura (xlsx/pdf) com escape de fórmula</name>
  <files>apps/backend/src/commercial/commercial-export.ts, apps/backend/src/commercial/commercial-export.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/acceptance/contract-pdf.service.ts (uso do pdfkit, fontes com acento)
    - apps/backend/node_modules/exceljs/index.d.ts (Workbook, addWorksheet, xlsx.writeBuffer)
  </read_first>
  <behavior>
    - escapeCell('=SUM(A1)') → "'=SUM(A1)"; '+55 11' → "'+55 11"; '-10' → "'-10"; '@x' → "'@x"; '\tx' → "'\tx"; 'Ana' → 'Ana'; null → ''
    - buildReportXlsx(report) → Buffer que o exceljs relê com planilhas 'Resumo' e 'Negócios'; 'Negócios' tem cabeçalho + N linhas; célula de nome '=cmd' sai como "'=cmd"
    - buildReportPdf(report) → Buffer que começa com '%PDF' e contém o título 'Relatório comercial' (texto extraído ou busca no buffer não comprimido: usar `compress: false` no doc em teste)
  </behavior>
  <action>
Tipos `CommercialReportData` (totals, byStage, byAssignee, bySource, lostReasons, rows, filtros aplicados, orgName, geradoEm) definidos aqui e reusados pelo serviço. `escapeCell(v: unknown): string`. `buildReportXlsx(data): Promise<Buffer>` com exceljs (todas as células como texto via `escapeCell`, exceto valores numéricos de dinheiro gravados como número com `numFmt '"R$" #,##0.00'`), colunas: Lead, Telefone, Tipo, Data do evento, Etapa, Status, Responsável, Origem, Pacote, Valor final, Motivo da perda, Detalhe da perda, Criado em, Fechado em. `buildReportPdf(data, opts = { compress: true }): Promise<Buffer>` com pdfkit A4 paisagem: título 'Relatório comercial', período, totais, tabelas de motivos e origem, e as primeiras 1.000 linhas (rodapé "mostrando 1.000 de N" quando cortar). Spec do `<behavior>`. Commit `feat(09-09): exportação Excel e PDF do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- src/commercial/commercial-export</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function escapeCell" apps/backend/src/commercial/commercial-export.ts` encontra
    - `grep -n "%PDF" apps/backend/src/commercial/commercial-export.spec.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Exportação testada sem banco.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Painel, relatórios, resolver e phase9-reports</name>
  <files>apps/backend/src/graphql/schema/commercial-reports.graphql, apps/backend/src/commercial/commercial-dashboard.service.ts, apps/backend/src/commercial/commercial-reports.service.ts, apps/backend/src/commercial/commercial-reports.resolver.ts, apps/backend/src/commercial/commercial-reports.module.ts, apps/backend/test/integration/phase9-reports.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/commercial/commercial-reports.module.ts (shell)
    - apps/backend/src/commercial/commercial-sla.ts (regra SQL)
    - apps/backend/src/commercial/commercial-leads.service.ts (padrão)
  </read_first>
  <behavior>
    - com 3 negócios abertos (2 de attendant, 1 de attendantB) e 1 ganho e 1 perdido no período: MANAGER vê openAmount = soma dos 3, wonCount 1, lostCount 1, conversionRate 0.5; ATTENDANT vê só os 2 dela (openAmount dos 2) e conversionRate null se não fechou nenhum
    - followUpsPending conta negócios abertos com SLA estourado (mesma regra de isDealOverdue) e followUps lista até 10, mais atrasado primeiro
    - remindersOverdue/remindersToday batem com commercialReminderCounts (mesma regra, fuso da org)
    - "hoje" = dia local da org (lead criado 02:30Z de 2026-11-18 conta como 17/11 em São Paulo)
    - commercialReport({ from, to }) filtra por created_at do negócio no fuso da org; filtros assignee/stage/status/kind/source combinam; lostReasons agrupa por código com rótulo em português
    - exportCommercialReport(filter, 'xlsx') → { filename 'relatorio-comercial-AAAA-MM-DD.xlsx', mimeType 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } relido pelo exceljs com as mesmas linhas de commercialReport; 'pdf' → 'application/pdf'; formato inválido → FORMAT_INVALID
    - mais de 5.000 linhas → rows com 5.000 e truncated true
    - ATTENDANT: commercialDashboard OK; commercialReport/exportCommercialReport → FORBIDDEN; PROFESSIONAL: todos FORBIDDEN
    - negócios excluídos (deleted_at) não entram em nada
  </behavior>
  <action>
1. `commercial-reports.graphql`:
```graphql
type CommercialFollowUp {
  dealId: UUID!
  leadId: UUID!
  leadName: String!
  kind: String!
  stageName: String!
  stageColor: String!
  overdueSince: DateTime!
  assigneeName: String
}

type CommercialRecentInteraction {
  id: UUID!
  leadId: UUID!
  leadName: String!
  type: String!
  notes: String
  occurredAt: DateTime!
  createdByName: String
}

type CommercialStageSummary {
  stageId: UUID!
  name: String!
  color: String!
  kind: String!
  count: Int!
  amount: String!
}

type CommercialDashboard {
  periodDays: Int!
  newLeadsToday: Int!
  newDealsToday: Int!
  interactionsToday: Int!
  remindersOverdue: Int!
  remindersToday: Int!
  followUpsPending: Int!
  followUps: [CommercialFollowUp!]!
  lastInteractions: [CommercialRecentInteraction!]!
  stages: [CommercialStageSummary!]!
  openAmount: String!
  wonCount: Int!
  wonAmount: String!
  lostCount: Int!
  conversionRate: Float
}

input CommercialReportFilter {
  from: String!
  to: String!
  assigneeMemberId: UUID
  stageId: UUID
  status: String
  kind: String
  source: String
}

type CommercialReportTotals {
  deals: Int!
  open: Int!
  won: Int!
  lost: Int!
  openAmount: String!
  wonAmount: String!
  conversionRate: Float
}

type CommercialAssigneeSummary { memberId: UUID name: String! deals: Int! won: Int! lost: Int! wonAmount: String! }
type CommercialSourceSummary { source: String! label: String! deals: Int! won: Int! }
type CommercialLostReasonSummary { code: String! label: String! count: Int! }

type CommercialReportRow {
  dealId: UUID!
  leadName: String!
  phone: String
  kind: String!
  eventDate: String
  stageName: String!
  status: String!
  assigneeName: String
  source: String!
  packageName: String
  finalAmount: String
  lostReasonLabel: String
  lostReasonText: String
  createdAt: DateTime!
  closedAt: DateTime
}

type CommercialReport {
  totals: CommercialReportTotals!
  byStage: [CommercialStageSummary!]!
  byAssignee: [CommercialAssigneeSummary!]!
  bySource: [CommercialSourceSummary!]!
  lostReasons: [CommercialLostReasonSummary!]!
  rows: [CommercialReportRow!]!
  truncated: Boolean!
}

type CommercialExportFile { filename: String! mimeType: String! base64: String! }

extend type Query {
  commercialDashboard(periodDays: Int): CommercialDashboard!
  commercialReport(filter: CommercialReportFilter!): CommercialReport!
  exportCommercialReport(filter: CommercialReportFilter!, format: String!): CommercialExportFile!
}
```
2. `CommercialDashboardService.get(orgId, viewer, periodDays = 30)` (1..365) e `CommercialReportsService.report(orgId, viewer, filter)` / `export(orgId, viewer, filter, format)`; Prisma com `...visibilityWhere(viewer).deal` (ou SQL com a condição equivalente montada a partir do viewer: `assignee_member_id = $memberId` para ATTENDANT) — o filtro de visibilidade aplica também no relatório (defesa em profundidade). Datas `from`/`to` validadas `^\d{4}-\d{2}-\d{2}$`, `to >= from`, intervalo ≤ 366 dias (`PERIOD_INVALID`). Erros de domínio no relatório saem como `GraphQLError` com `extensions.code` (query não tem payload de erro): `BAD_USER_INPUT`.
3. Resolver: `commercialDashboard` → `COMMERCIAL_READ`; `commercialReport`, `exportCommercialReport` → `COMMERCIAL_MANAGE`. Módulo com os providers.
4. `phase9-reports.e2e.spec.ts` com os casos do `<behavior>`.
Commits `test(09-09): painel e relatórios` e `feat(09-09): painel comercial e relatórios`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase9-reports && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "COMMERCIAL_MANAGE" apps/backend/src/commercial/commercial-reports.resolver.ts` encontra 2
    - `grep -c "visibilityWhere(" apps/backend/src/commercial/commercial-dashboard.service.ts apps/backend/src/commercial/commercial-reports.service.ts` ≥ 1 em cada
    - `grep -n "truncated" apps/backend/test/integration/phase9-reports.e2e.spec.ts` encontra
    - `grep -n "CommercialDeal\b" apps/backend/src/graphql/schema/commercial-reports.graphql` vazio
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Painel e relatórios corretos por papel, com exportação.</done>
</task>

</tasks>

<verification>
`commercial-export` (unit) e `phase9-reports` verdes; typecheck e lint.
</verification>

<success_criteria>
COM-12 no backend com números conferidos contra dados semeados.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-09-SUMMARY.md`
</output>

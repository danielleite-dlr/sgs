---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 13
type: execute
wave: 5
depends_on: ["09-11", "09-08", "09-09"]
files_modified:
  - apps/frontend/src/features/commercial/api/reminders.api.ts
  - apps/frontend/src/features/commercial/api/reports.api.ts
  - apps/frontend/src/features/commercial/lib/download-file.ts
  - apps/frontend/src/features/commercial/components/ReminderFormDialog.tsx
  - apps/frontend/src/features/commercial/pages/RemindersPage.tsx
  - apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx
  - apps/frontend/src/features/commercial/pages/ReportsPage.tsx
  - apps/frontend/src/features/commercial/__tests__/reminders-page.test.tsx
  - apps/frontend/src/features/commercial/__tests__/dashboard-page.test.tsx
  - apps/frontend/src/features/commercial/__tests__/reports-page.test.tsx
autonomous: true
requirements: [COM-11, COM-12]

must_haves:
  truths:
    - "A tela Lembretes separa Vencidos, Hoje, Próximos e Concluídos, permite criar, editar a data, concluir/reabrir e excluir; ?lembrete=ID (vindo do push) destaca o lembrete e ?lead=ID filtra (D-16)"
    - "O Painel comercial mostra números do dia, lembretes vencidos e de hoje em destaque, follow-ups pendentes com link para o lead, últimas interações, quantidade e valor por etapa, valor em negociação e conversão no período"
    - "Relatórios (só ADMIN/MANAGER) com filtros de período, responsável, etapa, status, tipo e origem, tabelas de motivos de perda e origem, e botões Exportar Excel e Exportar PDF que baixam o arquivo gerado pelo backend (D-13)"
    - "O visual segue o Gestor Beauty: números tabulares, cartões sem sombra, sem KPIs gigantes"
  artifacts:
    - path: "apps/frontend/src/features/commercial/pages/RemindersPage.tsx"
      provides: "lista de lembretes por situação"
      contains: "lembrete"
    - path: "apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx"
      provides: "Painel comercial"
      contains: "CommercialDashboardQuery"
    - path: "apps/frontend/src/features/commercial/lib/download-file.ts"
      provides: "downloadBase64File"
      exports: ["downloadBase64File"]
  key_links:
    - from: "apps/frontend/src/features/commercial/pages/ReportsPage.tsx"
      to: "exportCommercialReport"
      via: "useLazyQuery + downloadBase64File"
      pattern: "downloadBase64File\\("
    - from: "apps/frontend/src/features/commercial/pages/RemindersPage.tsx"
      to: "useSearchParams lembrete"
      via: "rota do push /comercial/lembretes?lembrete=ID"
      pattern: "get\\('lembrete'\\)"
---

<objective>
Telas de Lembretes, Painel comercial e Relatórios (com exportação Excel/PDF).

Purpose: COM-11 e COM-12 no navegador; a tela de Lembretes é o destino do toque no push.
Output: 2 APIs, helper de download, diálogo de lembrete, 3 páginas, 3 testes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-08-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-09-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-11-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. `recharts` ^2.15.3 já instalado (ver uso em `features/financial` / painel inicial) — gráfico de barras simples por etapa no Painel e nos Relatórios. Referência funcional: `/root/atmo-crm/atmos-crm/src/app/dashboard/page.tsx`, `src/components/dashboard/*`, `src/app/lembretes/page.tsx`, `src/app/relatorios/page.tsx`.

<interfaces>
Backend 09-08: `commercialReminders(filter { status: 'pending'|'overdue'|'today'|'upcoming'|'done', leadId, dealId, limit, offset })`, `commercialReminder(id)`, `commercialReminderCounts { overdue today }`, `createCommercialReminder(input { title description dueAt leadId dealId })`, `updateCommercialReminder(input { id title description dueAt })`, `completeCommercialReminder(id, completed)`, `deleteCommercialReminder(id)`; tipo `CommercialReminder { id title description dueAt completedAt notifiedAt overdue lead { id fullName phone email } dealId dealKind dealEventDate dealStageName createdBy { id displayName roleName } }`.
Backend 09-09: `commercialDashboard(periodDays)` → `CommercialDashboard { periodDays newLeadsToday newDealsToday interactionsToday remindersOverdue remindersToday followUpsPending followUps { dealId leadId leadName kind stageName stageColor overdueSince assigneeName } lastInteractions { id leadId leadName type notes occurredAt createdByName } stages { stageId name color kind count amount } openAmount wonCount wonAmount lostCount conversionRate }`; `commercialReport(filter { from to assigneeMemberId stageId status kind source })` → `CommercialReport { totals {...} byStage byAssignee bySource lostReasons rows truncated }`; `exportCommercialReport(filter, format: 'xlsx'|'pdf')` → `{ filename mimeType base64 }` (é Query: usar `useLazyQuery` com `fetchPolicy: 'no-cache'`).
Do 09-11: `commercial-labels.ts` (`KIND_LABEL`, `SOURCE_OPTIONS`, `LOST_REASON_OPTIONS`, `INTERACTION_TYPE_OPTIONS`, `formatMoney`, `formatYmd`, `formatDateTime`), `CommercialAssigneesQuery`, `CommercialStagesQuery`.
Do 09-03: `useCommercialAccess()`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lembretes (lista, diálogo, destaque pelo push)</name>
  <files>apps/frontend/src/features/commercial/api/reminders.api.ts, apps/frontend/src/features/commercial/components/ReminderFormDialog.tsx, apps/frontend/src/features/commercial/pages/RemindersPage.tsx, apps/frontend/src/features/commercial/__tests__/reminders-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/commercial/pages/RemindersPage.tsx (placeholder)
    - apps/backend/src/graphql/schema/commercial-reminders.graphql
    - apps/frontend/src/features/commercial/components/InteractionFormDialog.tsx (09-11: datetime-local → ISO)
  </read_first>
  <behavior>
    - abas/segmentos 'Vencidos', 'Hoje', 'Próximos', 'Concluídos' mapeiam para status overdue/today/upcoming/done; o contador de Vencidos e Hoje vem de commercialReminderCounts
    - cada item mostra título, data/hora (fuso da org), lead com link para /comercial/leads/{id}, tipo e etapa do negócio quando houver; vencidos com marca vermelha e texto 'Vencido'
    - checkbox 'Concluir' chama completeCommercialReminder(id, true); em Concluídos, 'Reabrir' chama (id, false)
    - 'Novo lembrete' abre ReminderFormDialog (título, descrição, data/hora, lead opcional por busca em commercialLeads)
    - URL /comercial/lembretes?lembrete=r1 busca commercialReminder(r1), rola até ele e o destaca (atributo data-highlight="true"); lembrete inexistente mostra aviso 'Lembrete não encontrado ou sem acesso'
    - URL ?lead=l1 passa leadId no filtro e mostra 'Filtrando por {nome}' com botão para limpar
  </behavior>
  <action>`reminders.api.ts` com os documentos do `<interfaces>`; `ReminderFormDialog` `{ open, onOpenChange, reminder?, defaultLeadId?, onSaved() }`; `RemindersPage` conforme `<behavior>`, segmento padrão 'Hoje' quando houver, senão 'Vencidos'. Testes. Commit `feat(09-13): tela de lembretes`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial/__tests__/reminders-page.test.tsx && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "get('lembrete')" apps/frontend/src/features/commercial/pages/RemindersPage.tsx` encontra
    - `grep -n "data-highlight" apps/frontend/src/features/commercial/pages/RemindersPage.tsx` encontra
    - `grep -n "CompleteCommercialReminderMutation" apps/frontend/src/features/commercial/pages/RemindersPage.tsx` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Lembretes usáveis e destino do push pronto.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Painel comercial e Relatórios com exportação</name>
  <files>apps/frontend/src/features/commercial/api/reports.api.ts, apps/frontend/src/features/commercial/lib/download-file.ts, apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx, apps/frontend/src/features/commercial/pages/ReportsPage.tsx, apps/frontend/src/features/commercial/__tests__/dashboard-page.test.tsx, apps/frontend/src/features/commercial/__tests__/reports-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/pages/HomeRoute.tsx e o painel inicial da fase 5 (composição de indicadores sem KPI gigante)
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx (uso de atob/createObjectURL para PDF)
    - apps/backend/src/graphql/schema/commercial-reports.graphql
  </read_first>
  <behavior>
    - Painel: linha de números do dia (novos leads, novos negócios, interações, lembretes vencidos, lembretes de hoje) em blocos compactos; 'Follow-ups pendentes (N)' lista até 10 com nome do lead (link), etapa com a cor, 'atrasado desde dd/mm' e responsável; 'Últimas interações'; 'Funil' com quantidade e valor por etapa; 'Em negociação' = openAmount formatado; 'Conversão (30 dias)' = 50% quando 0.5 e '—' quando null; seletor de período 7/30/90 dias
    - Painel para ATTENDANT renderiza normalmente (dados já filtrados pela API)
    - Relatórios: período padrão = mês corrente (from/to no fuso da org); filtros enviados como variáveis; tabelas por etapa, responsável, origem e motivos de perda (rótulos em português); tabela de negócios com aviso 'Mostrando 5.000 primeiros' quando truncated
    - 'Exportar Excel' chama exportCommercialReport(filter, 'xlsx') e downloadBase64File(filename, mimeType, base64); 'Exportar PDF' idem com 'pdf'; botões desabilitados durante a geração
    - downloadBase64File cria Blob com o mimeType, link com download=filename e revoga a URL depois
  </behavior>
  <action>`reports.api.ts` (`CommercialDashboardQuery`, `CommercialReportQuery`, `ExportCommercialReportQuery`); `download-file.ts` (`export function downloadBase64File(filename: string, mimeType: string, base64: string): void`); páginas conforme `<behavior>` com `recharts` (`BarChart` simples, cores das etapas), números com `tabular-nums`. Testes (mock de `URL.createObjectURL`). Commit `feat(09-13): painel comercial e relatórios`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function downloadBase64File" apps/frontend/src/features/commercial/lib/download-file.ts` encontra
    - `grep -n "'xlsx'" apps/frontend/src/features/commercial/pages/ReportsPage.tsx` e `grep -n "'pdf'" apps/frontend/src/features/commercial/pages/ReportsPage.tsx` encontram
    - `grep -n "Follow-ups pendentes" apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx` encontra
    - `grep -n "Em construção" apps/frontend/src/features/commercial/pages/*.tsx` vazio para RemindersPage, CommercialDashboardPage e ReportsPage
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Painel e relatórios no ar (atrás da flag).</done>
</task>

</tasks>

<verification>
`vitest run src/features/commercial`, typecheck e lint do frontend verdes.
</verification>

<success_criteria>
COM-11 e COM-12 na tela, com exportação baixando arquivos válidos.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-13-SUMMARY.md`
</output>

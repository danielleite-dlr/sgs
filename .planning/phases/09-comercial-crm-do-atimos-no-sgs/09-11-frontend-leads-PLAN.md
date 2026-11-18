---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 11
type: execute
wave: 4
depends_on: ["09-03", "09-05"]
files_modified:
  - apps/frontend/src/features/commercial/api/leads.api.ts
  - apps/frontend/src/features/commercial/api/deals.api.ts
  - apps/frontend/src/features/commercial/lib/commercial-labels.ts
  - apps/frontend/src/features/commercial/components/LeadFormDialog.tsx
  - apps/frontend/src/features/commercial/components/DuplicateWarning.tsx
  - apps/frontend/src/features/commercial/components/DealFormDialog.tsx
  - apps/frontend/src/features/commercial/components/InteractionFormDialog.tsx
  - apps/frontend/src/features/commercial/pages/LeadsPage.tsx
  - apps/frontend/src/features/commercial/pages/LeadDetailPage.tsx
  - apps/frontend/src/features/commercial/__tests__/leads-page.test.tsx
  - apps/frontend/src/features/commercial/__tests__/lead-form-dialog.test.tsx
  - apps/frontend/src/features/commercial/__tests__/lead-detail.test.tsx
autonomous: true
requirements: [COM-01, COM-04, COM-07]

must_haves:
  truths:
    - "A tela Leads lista os leads visíveis com busca, filtro por origem e (ADMIN/MANAGER) filtro 'Sem responsável'; botões Novo lead e Importar planilha (D-04, D-20)"
    - "Ao digitar telefone/e-mail no cadastro, aparece 'Já é cliente: Fulana' com 'Ligar a esta cliente' e, para lead repetido, 'Abrir lead existente' (D-02)"
    - "A ficha do lead mostra dados, cliente ligada, os negócios (vários; Noiva/Debutante, pacote, desconto, valor final, responsável, origem, local) e o histórico único de interações (D-03, D-06)"
    - "Registrar interação tem os 6 tipos e o campo opcional 'Próximo contato em', que cria o lembrete (D-17)"
    - "ATTENDANT não vê o seletor de responsável nem os botões de excluir (D-13)"
  artifacts:
    - path: "apps/frontend/src/features/commercial/api/deals.api.ts"
      provides: "gql de negócios e interações (usado também pelo 09-12)"
      exports: ["CommercialDealsQuery", "CreateCommercialDealMutation", "MoveCommercialDealMutation", "CreateCommercialInteractionMutation"]
    - path: "apps/frontend/src/features/commercial/components/DealFormDialog.tsx"
      provides: "criar/editar negócio"
      exports: ["DealFormDialog"]
    - path: "apps/frontend/src/features/commercial/lib/commercial-labels.ts"
      provides: "rótulos de tipo, origem, motivo, interação; formatação de dinheiro e data"
  key_links:
    - from: "apps/frontend/src/features/commercial/components/LeadFormDialog.tsx"
      to: "commercialDuplicateCheck"
      via: "useLazyQuery com debounce"
      pattern: "CommercialDuplicateCheckQuery"
    - from: "apps/frontend/src/features/commercial/pages/LeadsPage.tsx"
      to: "LeadImportDialog"
      via: "ponto de montagem do 09-03"
      pattern: "<LeadImportDialog"
---

<objective>
Telas de Leads: lista, cadastro/edição com aviso de cliente existente, ficha do lead com negócios e histórico de interações, diálogo de negócio e diálogo de interação com "próximo contato em". Também as APIs `gql` de leads, negócios e interações (reusadas pelo kanban).

Purpose: COM-01, COM-04 e COM-07 no navegador.
Output: 2 arquivos de API, rótulos, 4 componentes, 2 páginas, 3 testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-03-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-04-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-05-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. Sem codegen: `gql` do `@apollo/client` escrito à mão com tipos TS manuais (padrão `features/bridal/api/contracts.api.ts`). Visual Gestor Beauty (06-UI-SPEC: botão primário `#570080` 44 px, cartão sem sombra, diálogo com título em serifa, sem pílula/emoji/gradiente). Referência funcional: `/root/atmo-crm/atmos-crm/src/app/clientes/*`.

<interfaces>
SDL do backend (09-04 `commercial.graphql` e 09-05 `commercial-deals.graphql`): Queries `commercialLeads(filter: CommercialLeadFilter)`, `commercialLead(id)` (com `deals`, `interactions(limit)`), `commercialDuplicateCheck(phone, email, excludeLeadId)` → `{ clients { id fullName phone email } leads { ... } }`, `commercialAssignees`, `commercialStages`, `commercialDeals(filter)`, `commercialDeal(id)`; Mutations `createCommercialLead`, `updateCommercialLead`, `linkCommercialLeadClient(leadId, clientId)`, `deleteCommercialLead`, `createCommercialDeal`, `updateCommercialDeal`, `moveCommercialDeal`, `assignCommercialDeal`, `loseCommercialDeal`, `reopenCommercialDeal`, `deleteCommercialDeal`, `createCommercialInteraction(input { leadId dealId type notes occurredAt nextContactAt nextContactTitle })`. Payloads `{ x, errors { code message field } }`. Campos de `CommercialDeal` e `CommercialLead` conforme os SDLs (ler os arquivos .graphql).
Pacotes: `ContractPackagesQuery` em `features/bridal/api/contracts.api.ts` (`packages { id name price depositKind depositValue }`) — reusar.
Do 09-03: `useCommercialAccess()` → `{ roleName, memberId, canUse, isManager, canWin }`; `LeadImportDialog` (props `{ open, onOpenChange, onImported? }`, corpo vem do 09-14); fixtures `setRole`, `STAGES`, `LEAD_ANA`, `DEAL_ANA_NOIVA`.
Componentes ui: `components/ui/{dialog,sheet,tabs,select,input,textarea,button,badge,card,table,dropdown-menu,confirm-by-name-dialog}.tsx`; `use-media-query.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: APIs, rótulos e cadastro de lead com aviso de duplicado</name>
  <files>apps/frontend/src/features/commercial/api/leads.api.ts, apps/frontend/src/features/commercial/api/deals.api.ts, apps/frontend/src/features/commercial/lib/commercial-labels.ts, apps/frontend/src/features/commercial/components/LeadFormDialog.tsx, apps/frontend/src/features/commercial/components/DuplicateWarning.tsx, apps/frontend/src/features/commercial/__tests__/lead-form-dialog.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/api/contracts.api.ts (padrão de gql + tipos)
    - apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx (formulário em diálogo, react-hook-form + zod)
    - apps/backend/src/graphql/schema/commercial.graphql e commercial-deals.graphql
    - apps/frontend/src/features/bridal/__tests__/bridal-group-form.test.tsx (MockedProvider)
  </read_first>
  <behavior>
    - digitar telefone '(11) 99999-0000' e esperar o debounce (400 ms) dispara commercialDuplicateCheck; com cliente 'Fulana' na resposta aparece o texto 'Já é cliente: Fulana' e o botão 'Ligar a esta cliente'
    - clicar 'Ligar a esta cliente' faz o create enviar clientId da Fulana
    - lead duplicado na resposta mostra 'Já existe um lead: Beltrana' com link para /comercial/leads/{id}
    - sem telefone e sem e-mail o botão Salvar mostra o erro 'Informe telefone ou e-mail' sem chamar a API
    - erro da API (errors[0].message) aparece no formulário
  </behavior>
  <action>
1. `leads.api.ts` e `deals.api.ts`: documentos `gql` para todas as operações listadas em `<interfaces>` (nomes `XQuery`/`XMutation`, ex.: `CommercialLeadsQuery`, `CommercialLeadQuery`, `CommercialDuplicateCheckQuery`, `CommercialAssigneesQuery`, `CommercialStagesQuery`, `CreateCommercialLeadMutation`, `UpdateCommercialLeadMutation`, `LinkCommercialLeadClientMutation`, `DeleteCommercialLeadMutation`, `CommercialDealsQuery`, `CommercialDealQuery`, `CreateCommercialDealMutation`, `UpdateCommercialDealMutation`, `MoveCommercialDealMutation`, `AssignCommercialDealMutation`, `LoseCommercialDealMutation`, `ReopenCommercialDealMutation`, `DeleteCommercialDealMutation`, `CreateCommercialInteractionMutation`) e tipos TS (`CommercialLead`, `CommercialDeal`, `CommercialStage`, `CommercialInteraction`, `CommercialMember`, `UserError`). Um fragmento `CommercialDealFields` reusado pelo kanban.
2. `commercial-labels.ts`: `KIND_LABEL` (noiva 'Noiva', debutante 'Debutante'), `SOURCE_OPTIONS`, `LOST_REASON_OPTIONS` (mesmos códigos/rótulos do backend 09-02), `INTERACTION_TYPE_OPTIONS`, `formatMoney('450.00') → 'R$ 450,00'`, `formatYmd('2027-05-10') → '10/05/2027'` (sem `new Date` com fuso), `formatDateTime(iso, timeZone = 'America/Sao_Paulo')`.
3. `DuplicateWarning.tsx`: recebe `{ clients, leads, onLinkClient(clientId), linkedClientId }`; texto conforme `<behavior>`; aviso com `role="status"`.
4. `LeadFormDialog.tsx`: `{ open, onOpenChange, lead?: CommercialLead, onSaved(lead) }`; campos Nome, Telefone, E-mail, Origem (select), Observações; `useLazyQuery(CommercialDuplicateCheckQuery)` com debounce de 400 ms sobre telefone/e-mail (passa `excludeLeadId` ao editar); salvar → create/update (+ `linkCommercialLeadClient` ao editar e ligar).
5. Teste do `<behavior>` com `MockedProvider`.
Commit `feat(09-11): cadastro de lead com aviso de cliente existente`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial/__tests__/lead-form-dialog.test.tsx && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "CommercialDuplicateCheckQuery" apps/frontend/src/features/commercial/components/LeadFormDialog.tsx` encontra
    - `grep -n "Já é cliente" apps/frontend/src/features/commercial/components/DuplicateWarning.tsx` encontra
    - `grep -n "fragment CommercialDealFields" apps/frontend/src/features/commercial/api/deals.api.ts` encontra
    - `grep -n "date_unavailable" apps/frontend/src/features/commercial/lib/commercial-labels.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Cadastro de lead com o aviso da D-02.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Lista de leads, ficha do lead, negócio e interação</name>
  <files>apps/frontend/src/features/commercial/pages/LeadsPage.tsx, apps/frontend/src/features/commercial/pages/LeadDetailPage.tsx, apps/frontend/src/features/commercial/components/DealFormDialog.tsx, apps/frontend/src/features/commercial/components/InteractionFormDialog.tsx, apps/frontend/src/features/commercial/__tests__/leads-page.test.tsx, apps/frontend/src/features/commercial/__tests__/lead-detail.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/commercial/pages/LeadsPage.tsx e LeadDetailPage.tsx (placeholders do 09-03)
    - apps/frontend/src/pages/ClientesPage.tsx (lista com busca no padrão Gestor Beauty, versão celular)
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx (ficha com abas)
    - apps/frontend/src/features/bridal/__tests__/grupo-noivas-gestor-beauty.test.tsx (regra de regressão visual)
  </read_first>
  <behavior>
    - LeadsPage lista nome, telefone, origem, negócios abertos e última interação; busca filtra (variável search); como MANAGER aparece o filtro 'Sem responsável' (variável unassigned true); como ATTENDANT não aparece
    - botão 'Importar planilha' abre LeadImportDialog (open true)
    - LeadDetailPage mostra os dois negócios do lead (Noiva e Debutante) com etapa, pacote, valor final, responsável; selo 'Atrasado' quando overdue
    - 'Novo negócio' abre DealFormDialog: tipo (Noiva/Debutante), data do evento, pacote (preço vem do pacote), desconto, valor final calculado na tela, responsável (só ADMIN/MANAGER), origem, local, observações; para Debutante aparece 'Nome da debutante' (D-18)
    - 'Registrar interação' abre InteractionFormDialog com os 6 tipos, observações, data/hora e 'Próximo contato em' (opcional); enviar com próximo contato manda nextContactAt em ISO e mostra o toast 'Interação registrada e lembrete criado'
    - como ATTENDANT não aparecem 'Excluir lead' nem o seletor de responsável; como MANAGER aparecem
    - lead inexistente/invisível (commercialLead null) mostra 'Lead não encontrado' com link para a lista
  </behavior>
  <action>
1. `LeadsPage.tsx`: PageHeader 'Leads' com ações 'Novo lead' (primário) e 'Importar planilha' (`Upload`, secundário); `Table` no desktop e lista de cartões no celular (`use-media-query`); paginação simples (50) por `offset`; montar `<LeadImportDialog open={...} onOpenChange={...} onImported={() => refetch()} />`.
2. `LeadDetailPage.tsx`: lê `:id`; abas 'Resumo' (dados + cliente ligada com link `/clientes/{id}` + negócios em cartões com borda esquerda na cor da etapa, botões Editar, Mover (select das etapas abertas → `moveCommercialDeal`), Marcar ganho/perdido levam a `/comercial/pipeline?negocio={id}&acao=ganhar` ou `&acao=perder` — os diálogos de ganho/perda vêm no 09-12; 'Marcar ganho' só aparece com `canWin`, D-21), 'Interações' (linha do tempo desc + 'Registrar interação'), 'Lembretes' (link 'Ver lembretes deste lead' para `/comercial/lembretes?lead={id}`). Excluir lead (MANAGER) com `confirm-by-name-dialog`.
3. `DealFormDialog.tsx`: `{ open, onOpenChange, leadId, deal?: CommercialDeal, onSaved(deal) }`; valor final = preço − desconto em centavos (sem float); desconto > preço mostra erro local; responsável só com `isManager`.
4. `InteractionFormDialog.tsx`: `{ open, onOpenChange, leadId, dealId?, deals?: CommercialDeal[], onSaved() }`; 'Próximo contato em' como `input type="datetime-local"` convertido para ISO; título do lembrete opcional.
5. Testes do `<behavior>`.
Commit `feat(09-11): telas de leads, negócios e interações`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "<LeadImportDialog" apps/frontend/src/features/commercial/pages/LeadsPage.tsx` encontra
    - `grep -n "Nome da debutante" apps/frontend/src/features/commercial/components/DealFormDialog.tsx` encontra
    - `grep -n "Próximo contato em" apps/frontend/src/features/commercial/components/InteractionFormDialog.tsx` encontra
    - `grep -n "Em construção" apps/frontend/src/features/commercial/pages/LeadsPage.tsx apps/frontend/src/features/commercial/pages/LeadDetailPage.tsx` vazio
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Leads, negócios e interações usáveis no desktop e no celular.</done>
</task>

</tasks>

<verification>
`vitest run src/features/commercial`, typecheck e lint do frontend verdes.
</verification>

<success_criteria>
A atendente cadastra o lead, vê o aviso de cliente existente, abre negócios e registra interações com próximo contato.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-11-SUMMARY.md`
</output>

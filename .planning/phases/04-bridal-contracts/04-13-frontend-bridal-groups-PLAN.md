---
phase: 04-bridal-contracts
plan: 13
type: execute
wave: 5
depends_on: ["04-04", "04-05", "04-08", "04-12"]
files_modified:
  - apps/frontend/src/features/bridal/api/bridal.api.ts
  - apps/frontend/src/features/bridal/api/ai-schedule.api.ts
  - apps/frontend/src/features/bridal/lib/bridal-labels.ts
  - apps/frontend/src/features/bridal/lib/schedule-rows.ts
  - apps/frontend/src/features/bridal/__tests__/schedule-rows.test.ts
  - apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx
  - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
  - apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx
  - apps/frontend/src/features/bridal/components/BridalPersonFields.tsx
  - apps/frontend/src/features/bridal/components/BridalMembersCard.tsx
  - apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx
  - apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx
  - apps/frontend/src/features/bridal/components/CancelBridalGroupDialog.tsx
  - apps/frontend/src/features/bridal/__tests__/bridal-groups-page.test.tsx
  - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
  - apps/frontend/src/features/bridal/__tests__/ai-suggestion-panel.test.tsx
  - apps/frontend/src/features/operations/lib/operations-labels.ts
autonomous: true
requirements: [CLI-03, AI-01]

must_haves:
  truths:
    - "Em /noivas o proprietário vê os grupos por data do evento e cria um grupo com noiva + acompanhantes (cliente existente ou nova só com nome/telefone) e serviços por pessoa"
    - "No detalhe do grupo marca cada pessoa como 'incluída no contrato' ou 'paga avulso' e edita local/deslocamento"
    - "Clicar em 'Sugerir agenda IA' mostra uma proposta editável (pessoa × serviço × profissional × horário) com a origem (IA ou sugestão simples) e só grava ao clicar 'Confirmar agenda'"
    - "Erros de conflito do backend aparecem em linguagem clara sem perder a edição"
    - "A agenda mostra o bloqueio de deslocamento com rótulo próprio"
  artifacts:
    - path: "apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx"
      provides: "Detalhe do grupo + agenda do evento + IA"
    - path: "apps/frontend/src/features/bridal/lib/schedule-rows.ts"
      exports: ["suggestionToRows", "rowsToScheduleItems", "findRowConflicts"]
  key_links:
    - from: "AiSuggestionPanel.tsx"
      to: "Mutation suggestBridalSchedule / confirmBridalSchedule"
      via: "Apollo useMutation"
      pattern: "suggestBridalSchedule"
    - from: "BridalGroupFormDialog.tsx"
      to: "Mutation createBridalGroup"
      via: "react-hook-form + zod"
      pattern: "createBridalGroup"
---

<objective>
Telas de grupos de noivas (CLI-03) e da sugestão de agenda IA (AI-01): lista, criação, detalhe com pessoas/cobertura/serviços/local, editor da agenda do evento (manual), painel "Sugerir agenda IA" editável com confirmação e cancelamento do grupo.

Purpose: torna visíveis os critérios de sucesso 1 e 3. Preenche as páginas-casca do 04-04 (sem tocar em router.tsx).
Output: APIs GraphQL, 2 páginas, 6 componentes, 1 lib pura, testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-05-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-08-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-12-SUMMARY.md
@apps/backend/src/graphql/schema/bridal.graphql
@apps/backend/src/graphql/schema/ai-schedule.graphql
@apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
@apps/frontend/src/features/operations/api/appointments.api.ts
@apps/frontend/src/features/catalog/components/EntityCombobox.tsx

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm --filter @sgs/frontend codegen && corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend test`. Sem UI-SPEC: seguir padrões das telas da fase 3 (shadcn `Dialog`, `Select`, `Tabs`, `Table`, `Badge`, `sonner` para toast, `PageHeader`, textos PT-BR, WCAG: `label` em todo campo, foco visível, `aria-live` para erros). Não ligar a flag `noivas` aqui (04-15). Não tocar em `router.tsx` nem em `features/operations/lib/money.ts` (04-14).

Artefato gerado: se o merge com um plano paralelo conflitar em `apps/frontend/src/gql/`, não resolver à mão — regenerar com `corepack pnpm --filter @sgs/frontend codegen` e commitar o resultado.

<interfaces>
GraphQL disponível (04-05/04-08/04-12): `bridalGroups(status, from, to)`, `bridalGroup(id)` (members[], services[], appointments[], contractId/contractCode/contractStatus), `createBridalGroup`, `updateBridalGroup`, `addBridalGroupMember`, `removeBridalGroupMember`, `setBridalMemberCoverage`, `setBridalMemberServices`, `scheduleBridalEvent`, `cancelBridalGroup(input: { id, reason })`, `suggestBridalSchedule(groupId)` → `{ suggestion { id source model cached fallbackReason items { personRef groupMemberId personLabel role serviceId serviceName professionalId professionalName startsAt endsAt } unscheduled warnings dayStart dayEnd readyBy } errors }`, `confirmBridalSchedule(input: { groupId, items, deposits })`.
Gate: `useBridalPermission('bridal.write' | 'bridal.aiSuggest' | 'contract.cancel' ...)` (04-04). Clientes: query de busca usada pelo VisitFormDialog (conferir nome em appointments.api.ts / clients api). Serviços/profissionais: queries já usadas no VisitFormDialog.
Ligação com contratos (04-14): botão "Criar contrato" → `Link` para `/contratos?grupo=<groupId>`; "Ver contrato" → `/contratos/<contractId>`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: APIs, rótulos e lib pura das linhas da agenda</name>
  <files>apps/frontend/src/features/bridal/api/bridal.api.ts, apps/frontend/src/features/bridal/api/ai-schedule.api.ts, apps/frontend/src/features/bridal/lib/bridal-labels.ts, apps/frontend/src/features/bridal/lib/schedule-rows.ts, apps/frontend/src/features/bridal/__tests__/schedule-rows.test.ts, apps/frontend/src/features/operations/lib/operations-labels.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/api/appointments.api.ts (padrão de documentos/hooks)
    - apps/backend/src/graphql/schema/bridal.graphql e ai-schedule.graphql
    - apps/frontend/src/features/operations/lib/operations-labels.ts (kinds de time block)
  </read_first>
  <behavior>
    - `suggestionToRows(s)` gera uma linha por item com `date` local ('YYYY-MM-DD'), `start`/`end` 'HH:MM' no fuso America/Sao_Paulo e mantém ids
    - `rowsToScheduleItems(rows, tz)` volta para `{ groupMemberId, serviceId, professionalId, startsAt ISO, endsAt ISO }`
    - `findRowConflicts(rows)` aponta sobreposição do mesmo profissional e da mesma pessoa (índices das linhas)
  </behavior>
  <action>
1. `bridal.api.ts`: fragment `BridalGroupFields` (todos os campos de BridalGroup, members com services, appointments), queries `BridalGroupsQuery`, `BridalGroupQuery`, mutations de todas as operações listadas na interface. `ai-schedule.api.ts`: `SuggestBridalScheduleMutation`, `ConfirmBridalScheduleMutation`.
2. `bridal-labels.ts`: `ROLE_LABEL = { bride: 'Noiva', companion: 'Acompanhante' }`, `LOCATION_LABEL = { studio: 'No estúdio', external: 'Externo' }`, `GROUP_STATUS_LABEL = { active: 'Ativo', completed: 'Concluído', cancelled: 'Cancelado' }`, `FALLBACK_REASON_LABEL = { NO_API_KEY: 'IA não configurada — sugestão simples.', API_ERROR: 'IA indisponível no momento — sugestão simples.', INVALID_OUTPUT: 'A IA não gerou uma agenda válida — sugestão simples.', LIMIT_REACHED: 'Limite diário de sugestões da IA atingido — sugestão simples.' }`, `ERROR_MESSAGES` para os códigos do backend (SLOT_TAKEN, TIME_BLOCKED, COVERAGE_LOCKED, MEMBER_IN_CONTRACT, CANCEL_CONTRACT_FIRST, ALREADY_SCHEDULED, NO_PLANNED_SERVICES, INVALID_PROPOSAL, DEPOSIT_ONLY_FOR_UNCOVERED, EVENT_DATE_MISMATCH) com fallback para `message` do servidor.
3. `schedule-rows.ts` com as 3 funções (usar `date-fns-tz` já presente — `formatInTimeZone`/`fromZonedTime`); `type ScheduleRow = { key; groupMemberId; personLabel; role; serviceId; serviceName; professionalId; date; start; end }`.
4. `operations-labels.ts`: adicionar `{ value: 'deslocamento', label: 'Deslocamento', className: 'bg-amber-100 text-amber-900 border-amber-500' }` à lista de kinds e garantir que o diálogo de bloqueio manual (`TimeBlockDialog`) NÃO ofereça esse kind (filtrar por `manual !== false` ou lista separada — conferir o consumidor).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend codegen && corepack pnpm --filter @sgs/frontend test -- schedule-rows time-block-dialog && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function findRowConflicts" apps/frontend/src/features/bridal/lib/schedule-rows.ts` encontra
    - `grep -n "deslocamento" apps/frontend/src/features/operations/lib/operations-labels.ts` encontra
    - `grep -n "suggestBridalSchedule" apps/frontend/src/features/bridal/api/ai-schedule.api.ts` encontra
    - Testes verdes (incluindo `time-block-dialog` sem regressão)
  </acceptance_criteria>
  <done>Camada de dados e regras puras da tela prontas.</done>
</task>

<task type="auto">
  <name>Task 2: Lista de grupos, criação e detalhe (pessoas, cobertura, serviços, local, cancelamento)</name>
  <files>apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx, apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx, apps/frontend/src/features/bridal/components/BridalPersonFields.tsx, apps/frontend/src/features/bridal/components/BridalMembersCard.tsx, apps/frontend/src/features/bridal/components/CancelBridalGroupDialog.tsx, apps/frontend/src/features/bridal/__tests__/bridal-groups-page.test.tsx, apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/BridalGroupsPage.tsx e BridalGroupDetailPage.tsx (cascas do 04-04)
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx (combobox de cliente + cadastro rápido, seleção de serviço)
    - apps/frontend/src/features/operations/components/calendar/CancelAppointmentDialog.tsx (padrão de motivo obrigatório)
    - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx (MockedProvider)
  </read_first>
  <action>
1. `BridalGroupsPage`: `PageHeader` "Grupos de noivas" + botão "Novo grupo" (só com `bridal.write`); filtro de status (Ativos/Concluídos/Cancelados) e período; tabela/cards: nome, data do evento (dd/MM/yyyy), noiva, nº de pessoas, local, badge do contrato (`contractCode` + status ou "Sem contrato"); linha → `/noivas/:id`; vazio: "Nenhum grupo de noivas ainda."
2. `BridalGroupFormDialog` (react-hook-form + zod): nome, data do evento, "Pronta até" (hora), local (estúdio/externo; endereço obrigatório se externo; deslocamento antes/depois em minutos 0–240, só para externo), notas; seção "Noiva" e lista dinâmica "Acompanhantes" (botão "Adicionar acompanhante", máx. 14) usando `BridalPersonFields`: cliente existente (combobox de busca) OU "Nova cliente" (nome + telefone opcional — D-02), relação (texto, ex. "Madrinha", "Mãe"), checkbox "Incluída no contrato" (noiva marcada por padrão, acompanhantes desmarcadas — D-06/D-07), serviços planejados (multi-select de serviços com finalidade Evento/Teste). Submit → `createBridalGroup`; `errors` do payload mapeados aos campos; sucesso → toast + navegar para o detalhe.
3. `BridalGroupDetailPage`: cabeçalho (nome, data, local, pronta até, status, botões "Editar", "Cancelar grupo" (com `contract.cancel`), e "Criar contrato" → `/contratos?grupo=<id>` ou "Ver contrato <code>" → `/contratos/<contractId>`); `Tabs`: "Pessoas" (`BridalMembersCard`) e "Agenda do evento" (Task 3). `BridalMembersCard`: tabela de pessoas com papel, relação, telefone, serviços planejados (editar via diálogo → `setBridalMemberServices`), switch "Incluída no contrato" → `setBridalMemberCoverage` (desabilitado com tooltip quando `hasClosedComanda` — D-25; erro `COVERAGE_LOCKED`/`MEMBER_IN_CONTRACT` vira toast com `ERROR_MESSAGES`), "Adicionar pessoa", "Remover" (não para a noiva).
4. `CancelBridalGroupDialog`: motivo obrigatório (≥ 3) → `cancelBridalGroup`; `CANCEL_CONTRACT_FIRST` exibe "Cancele o contrato antes (em Contratos)." com link.
5. Testes: `bridal-groups-page.test.tsx` — lista renderiza 2 grupos e badge do contrato; ATTENDANT vê "Novo grupo", PROFESSIONAL não; criação com noiva + 4 acompanhantes novas chama a mutation com `companions.length === 4` e `coveredByContract false` nelas. `bridal-group-detail.test.tsx` — switch de cobertura desabilitado quando `hasClosedComanda`; erro `COVERAGE_LOCKED` mostra a mensagem; botão "Criar contrato" aponta para `/contratos?grupo=<id>`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- bridal-groups-page bridal-group-detail && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "createBridalGroup" apps/frontend/src/features/bridal/components/BridalGroupFormDialog.tsx` encontra
    - `grep -n "/contratos?grupo=" apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx` encontra
    - `grep -n "hasClosedComanda" apps/frontend/src/features/bridal/components/BridalMembersCard.tsx` encontra
    - Testes verdes
  </acceptance_criteria>
  <done>CLI-03 utilizável pela interface.</done>
</task>

<task type="auto">
  <name>Task 3: Agenda do evento — editor manual e painel "Sugerir agenda IA"</name>
  <files>apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx, apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx, apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/features/bridal/__tests__/ai-suggestion-panel.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/lib/schedule-rows.ts (Task 1)
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx (seleção de profissional por serviço/categoria)
    - apps/frontend/src/features/operations/lib/visit-form.ts
  </read_first>
  <action>
1. `BridalScheduleEditor` (props `rows`, `onChange`, `professionalsByService`, `readOnly?`): tabela editável — pessoa (fixa), serviço (fixo), profissional (`Select` só com habilitados para o serviço), data (fixa no evento para 'event'), início (input time), fim calculado pela duração; linhas com conflito de `findRowConflicts` destacadas (borda vermelha + texto "Conflito com a linha N"); campo opcional "Sinal" por acompanhante NÃO incluída no contrato (valor + método: Dinheiro, Pix, Crédito, Débito, Transferência — D-07) que vai em `deposits`.
2. `AiSuggestionPanel` na aba "Agenda do evento": se o grupo já tem agendamentos, mostra a lista (`appointments`: pessoa, serviço, profissional, horário, status, "Coberto pelo contrato" quando `covered`) e esconde a sugestão. Senão: botão "Sugerir agenda IA" (só com `bridal.aiSuggest`; com ícone `Sparkles`) → `suggestBridalSchedule`; enquanto carrega, `aria-busy` + texto "Montando sugestão…"; resultado: badge de origem ("Sugestão da IA" com `model`, ou "Sugestão simples" + `FALLBACK_REASON_LABEL[fallbackReason]`), "(do cache)" se `cached`; lista `unscheduled` como aviso ("Sem horário livre para: …"); `warnings`; `BridalScheduleEditor` com as linhas; botões "Gerar de novo" e "Confirmar agenda" (desabilitado com conflito local) → `confirmBridalSchedule({ groupId, items: rowsToScheduleItems(rows), deposits })`; erros `INVALID_PROPOSAL`/`SLOT_TAKEN` listados sem perder a edição; sucesso → toast "Agenda do evento criada" + `refetch` do grupo. Texto fixo explicando "Nada é gravado na agenda até você confirmar." (SDD §13.2). Botão alternativo "Montar manualmente" abre o editor com uma linha por serviço planejado (profissional/horário vazios).
3. Teste `ai-suggestion-panel.test.tsx`: mock `suggestBridalSchedule` com `source "heuristic"`, `fallbackReason "NO_API_KEY"` → mostra "IA não configurada — sugestão simples." e 7 linhas; editar profissional de uma linha para causar sobreposição → "Confirmar agenda" desabilitado; desfazer → confirmar chama `confirmBridalSchedule` com 7 itens; retorno com erro `INVALID_PROPOSAL` mostra a mensagem e mantém as linhas; ATTENDANT não vê o botão "Sugerir agenda IA".
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- ai-suggestion-panel bridal && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Sugerir agenda IA" apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx` encontra
    - `grep -n "confirmBridalSchedule\|ConfirmBridalSchedule" apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx` encontra
    - `grep -n "Nada é gravado na agenda" apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx` encontra
    - Testes verdes
  </acceptance_criteria>
  <done>Critério 3 visível: sugestão IA (ou simples) editável, confirmada pelo proprietário.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/frontend test -- bridal` verde; lint/typecheck verdes.</verification>

<success_criteria>Proprietário cria grupo com noiva + 4 acompanhantes e monta a agenda do evento com sugestão da IA pela interface.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-13-SUMMARY.md`
</output>

---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 12
type: execute
wave: 5
depends_on: ["09-11", "09-06"]
files_modified:
  - apps/frontend/src/features/commercial/api/win.api.ts
  - apps/frontend/src/features/commercial/api/stages.api.ts
  - apps/frontend/src/features/commercial/components/PipelineBoard.tsx
  - apps/frontend/src/features/commercial/components/StageColumn.tsx
  - apps/frontend/src/features/commercial/components/DealCard.tsx
  - apps/frontend/src/features/commercial/components/WinDealDialog.tsx
  - apps/frontend/src/features/commercial/components/LoseDealDialog.tsx
  - apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx
  - apps/frontend/src/features/commercial/pages/PipelinePage.tsx
  - apps/frontend/src/features/commercial/__tests__/pipeline-board.test.tsx
  - apps/frontend/src/features/commercial/__tests__/win-deal-dialog.test.tsx
  - apps/frontend/src/features/commercial/__tests__/lose-deal-dialog.test.tsx
  - apps/frontend/src/features/commercial/__tests__/stages-settings.test.tsx
autonomous: true
requirements: [COM-05, COM-06, COM-08, COM-09]

must_haves:
  truths:
    - "O Pipeline mostra uma coluna por etapa (cor e prazo da etapa) com os negócios abertos e os ganhos/perdidos dos últimos 30 dias; card em alerta vermelho quando passou do prazo sem interação (D-15)"
    - "No computador, arrastar um card para outra etapa aberta move na hora (otimista) e volta se a API recusar; soltar em Ganho abre o diálogo de ganho e em Perdido o de perda"
    - "No celular as colunas rolam de lado e cada card tem o menu 'Mover para…' (também acessível por teclado), com 'Marcar como ganho' e 'Marcar como perdido'"
    - "O diálogo de ganho mostra os dados da cliente para completar o que o contrato precisa, pede o nome da debutante quando é debutante, pergunta se o sinal já foi pago (formas e valores) e, ao confirmar, abre /contratos/{id} (D-08, D-09, D-18)"
    - "'Marcar como ganho' só aparece para os papéis de WIN_DEAL_ROLES (D-21, ponto único no front)"
    - "O diálogo de perda exige motivo da lista fixa e aceita texto livre (obrigatório em 'Outro') (D-10)"
    - "ADMIN/MANAGER configuram etapas (nome, cor, prazo em dias, ordem, excluir com destino) na aba Etapas; Ganho/Perdido sem excluir e sempre no fim (D-07, D-13)"
  artifacts:
    - path: "apps/frontend/src/features/commercial/components/PipelineBoard.tsx"
      provides: "kanban com @dnd-kit/core"
      contains: "DndContext"
    - path: "apps/frontend/src/features/commercial/components/WinDealDialog.tsx"
      provides: "ganho com dados da cliente e sinal"
      exports: ["WinDealDialog"]
    - path: "apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx"
      provides: "configuração das etapas"
      exports: ["StagesSettingsTab"]
  key_links:
    - from: "apps/frontend/src/features/commercial/components/WinDealDialog.tsx"
      to: "winCommercialDeal + navigate('/contratos/' + contractId)"
      via: "onCompleted"
      pattern: "/contratos/"
    - from: "apps/frontend/src/features/commercial/components/PipelineBoard.tsx"
      to: "MoveCommercialDealMutation"
      via: "optimisticResponse + rollback"
      pattern: "optimisticResponse"
    - from: "apps/frontend/src/features/commercial/components/DealCard.tsx"
      to: "canWinDeal / useCommercialAccess().canWin"
      via: "D-21"
      pattern: "canWin"
---

<objective>
Kanban do Pipeline (arrastar no computador, menu "Mover para…" no celular), diálogos de ganho (cliente + sinal + abre o contrato) e de perda (motivo), e a aba de configuração de etapas.

Purpose: COM-06, COM-08 e COM-09 no navegador, mais a parte de tela do COM-05.
Output: 2 APIs, 6 componentes, página do Pipeline, aba Etapas e 4 testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-06-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-11-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. `@dnd-kit/core` 6.3.1 e `@dnd-kit/modifiers` 9.0.0 já instalados (agenda usa `useDraggable` em `AppointmentCard.tsx`); NÃO instalar `@dnd-kit/sortable` (o kanban só troca de etapa). Referência funcional: `/root/atmo-crm/atmos-crm/src/components/pipeline/*` (DealCard, StageColumn, WonDealModal, LostDealModal, PackageDiscountSelector) e `src/components/settings/PipelineSettings.tsx` — portar comportamento, não código; `DealDetailsSheet.tsx` (2530 linhas) NÃO é portado.

<interfaces>
Backend: `winCommercialDeal(input: WinCommercialDealInput!)` → `CommercialWinPayload { contractId clientId errors }`; `WinCommercialDealInput { dealId, client: CommercialWinClientInput { fullName phone email cpf rg birthDate postalCode address phone2 phone3 }, beneficiaryName, depositPaid: Boolean!, depositLines: [{ method amount }], discountDescription }` (09-06). Etapas: `createCommercialStage(input { name color slaDays })`, `updateCommercialStage(id, input)`, `reorderCommercialStages(ids)`, `deleteCommercialStage(id, moveToStageId)` (09-04). Negócios: `commercialDeals(filter { closedSinceDays assigneeMemberId unassigned kind })`, `moveCommercialDeal(id, stageId)`, `loseCommercialDeal(id, reasonCode, reasonText)`, `reopenCommercialDeal` (09-05).
Do 09-11: `deals.api.ts` (fragmento `CommercialDealFields`, mutações de negócio), `leads.api.ts` (`CommercialStagesQuery`, `CommercialAssigneesQuery`, `CommercialLeadQuery` com `client`), `commercial-labels.ts` (`LOST_REASON_OPTIONS`, `formatMoney`, `formatYmd`).
Do 09-03: `StagesSettingsTab` (assinatura `export function StagesSettingsTab()`), `useCommercialAccess()`, `canWinDeal`.
Contratos: `PAYMENT_METHODS` (`features/operations/lib/operations-labels`), `centsToDecimal`/`decimalToCents` (`features/operations/lib/money`), visual das linhas de pagamento em `features/bridal/components/ContractPaymentDialog.tsx`; campos da contratante em `features/bridal/components/CompleteContractorDialog.tsx`.
`use-media-query.ts` para trocar arrastar/menu.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Kanban com arrastar otimista e menu "Mover para…"</name>
  <files>apps/frontend/src/features/commercial/components/PipelineBoard.tsx, apps/frontend/src/features/commercial/components/StageColumn.tsx, apps/frontend/src/features/commercial/components/DealCard.tsx, apps/frontend/src/features/commercial/pages/PipelinePage.tsx, apps/frontend/src/features/commercial/__tests__/pipeline-board.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/components/AppointmentCard.tsx (useDraggable, sensores)
    - apps/frontend/src/features/commercial/api/deals.api.ts (09-11)
    - apps/frontend/src/features/commercial/pages/PipelinePage.tsx (placeholder)
    - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx (regras visuais)
  </read_first>
  <behavior>
    - renderiza 6 colunas na ordem das etapas, com contagem e soma do valor final dos abertos; Ganho/Perdido mostram só os fechados recentes
    - card mostra nome do lead, Noiva/Debutante, data do evento, pacote, valor final, responsável; card com overdue true tem a classe/atributo de alerta (data-overdue="true") e o texto 'Atrasado'
    - chamar o handler de soltar (onDragEnd simulado) de um card da coluna Novo na coluna Contato: o card aparece em Contato antes da resposta (optimisticResponse) e a mutação recebe { id, stageId: 'st-contato' }; se a mutação devolve errors, o card volta para Novo e aparece toast com a mensagem
    - soltar na coluna Ganho não chama moveCommercialDeal e abre o diálogo de ganho (onWin(deal)); na coluna Perdido abre o de perda
    - menu 'Mover para…' do card lista as etapas abertas (menos a atual), 'Marcar como ganho' (só se canWin) e 'Marcar como perdido'; escolher 'Proposta' chama moveCommercialDeal
    - como ATTENDANT com WIN_DEAL_ROLES padrão, 'Marcar como ganho' aparece; com papel fora de WIN_DEAL_ROLES (testar mockando canWinDeal → false) não aparece
    - PipelinePage lê ?negocio=ID&acao=ganhar|perder e abre o diálogo correspondente para esse negócio
    - filtros: responsável e 'Sem responsável' só para MANAGER; tipo (Noiva/Debutante) para todos
  </behavior>
  <action>
`PipelineBoard.tsx`: `DndContext` com `PointerSensor` (`activationConstraint: { distance: 8 }`) e `TouchSensor` (`activationConstraint: { delay: 250, tolerance: 5 }`); `useDroppable({ id: stage.id })` em `StageColumn`, `useDraggable({ id: deal.id, disabled: deal.status !== 'open' })` em `DealCard`; `onDragEnd` exportável para teste (`handleDealDrop(deal, targetStage)`): aberto → `moveCommercialDeal` com `optimisticResponse` (`stage` alvo, `stageEnteredAt` agora) e `update` do cache; `errors.length` → reverter (`cache.modify` com a etapa original) + `toast.error`; `won` → `onWin(deal)`; `lost` → `onLose(deal)`. Colunas `flex overflow-x-auto snap-x snap-mandatory` com `min-w-[280px] snap-start` (celular) e grade no desktop; menu 'Mover para…' com `DropdownMenu` em todo card (não só no celular) para WCAG 2.1 AA. `PipelinePage`: PageHeader 'Pipeline', filtros, consulta `commercialDeals({ closedSinceDays: 30 })` + `commercialStages`, link 'Configurar etapas' (`/comercial/configuracoes?aba=etapas`) só para MANAGER, monta `WinDealDialog`/`LoseDealDialog` (Task 2) — neste task criar só os pontos de estado (`dealToWin`, `dealToLose`). Testes do `<behavior>`. Commit `feat(09-12): pipeline em kanban`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial/__tests__/pipeline-board.test.tsx && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "distance: 8" apps/frontend/src/features/commercial/components/PipelineBoard.tsx` e `grep -n "delay: 250" apps/frontend/src/features/commercial/components/PipelineBoard.tsx` encontram
    - `grep -n "optimisticResponse" apps/frontend/src/features/commercial/components/PipelineBoard.tsx` encontra
    - `grep -n "Mover para" apps/frontend/src/features/commercial/components/DealCard.tsx` encontra
    - `grep -rn "@dnd-kit/sortable" apps/frontend/package.json apps/frontend/src/features/commercial` vazio
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Kanban funcional no desktop e no celular.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Diálogos de ganho e de perda</name>
  <files>apps/frontend/src/features/commercial/api/win.api.ts, apps/frontend/src/features/commercial/components/WinDealDialog.tsx, apps/frontend/src/features/commercial/components/LoseDealDialog.tsx, apps/frontend/src/features/commercial/pages/PipelinePage.tsx, apps/frontend/src/features/commercial/__tests__/win-deal-dialog.test.tsx, apps/frontend/src/features/commercial/__tests__/lose-deal-dialog.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/components/ContractPaymentDialog.tsx (linhas de pagamento, PAYMENT_METHODS)
    - apps/frontend/src/features/bridal/components/CompleteContractorDialog.tsx (campos da contratante, máscaras)
    - apps/backend/src/graphql/schema/commercial-win.graphql (09-06)
  </read_first>
  <behavior>
    - WinDealDialog de noiva com lead ligado a cliente: campos pré-preenchidos com a cliente (nome, CPF, RG, CEP, endereço, celulares); sem cliente ligada: nome e telefone do lead
    - debutante: campo obrigatório 'Nome da debutante' (pré-preenchido com beneficiaryName); vazio bloqueia confirmar
    - 'O sinal já foi pago?' Não → depositPaid false sem linhas; Sim → pelo menos uma linha (forma + valor), valor sugerido = sinal do pacote quando conhecido
    - confirmar chama winCommercialDeal com dealId, client, depositPaid e depositLines; com contractId na resposta chama navigate('/contratos/{contractId}') e toast 'Negócio ganho. Contrato rascunho criado.'
    - erro da API (ex.: PACKAGE_REQUIRED) mostra a mensagem no diálogo e não navega
    - negócio sem pacote mostra aviso 'Escolha o pacote do negócio antes de marcar ganho' e o botão fica desabilitado
    - LoseDealDialog: sem motivo, confirmar mostra 'Escolha o motivo'; 'Outro' sem texto mostra 'Descreva o motivo'; texto acima de 500 bloqueia; confirmar chama loseCommercialDeal(id, reasonCode, reasonText)
  </behavior>
  <action>
`win.api.ts`: `WinCommercialDealMutation`. `WinDealDialog.tsx`: `{ deal: CommercialDeal | null, open, onOpenChange }`; carrega `CommercialLeadQuery` para a cliente ligada; formulário com os campos do `<behavior>` (CPF e CEP com as mesmas máscaras do `CompleteContractorDialog`); linhas de sinal com `PAYMENT_METHODS` e `decimalToCents`; `useNavigate`. Comentário "D-21: este diálogo só abre quando canWin". `LoseDealDialog.tsx` com `RadioGroup` dos `LOST_REASON_OPTIONS` + `Textarea` (contador 0/500). `PipelinePage` monta os dois e `refetch` ao fechar. Testes do `<behavior>`. Commit `feat(09-12): ganho abre o contrato rascunho e perda com motivo`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial/__tests__/win-deal-dialog.test.tsx src/features/commercial/__tests__/lose-deal-dialog.test.tsx && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "O sinal já foi pago" apps/frontend/src/features/commercial/components/WinDealDialog.tsx` encontra
    - `grep -n "navigate(\`/contratos/" apps/frontend/src/features/commercial/components/WinDealDialog.tsx` encontra
    - `grep -n "Nome da debutante" apps/frontend/src/features/commercial/components/WinDealDialog.tsx` encontra
    - `grep -n "LOST_REASON_OPTIONS" apps/frontend/src/features/commercial/components/LoseDealDialog.tsx` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Ganho e perda fecham o funil pela tela.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Aba de configuração de etapas</name>
  <files>apps/frontend/src/features/commercial/api/stages.api.ts, apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx, apps/frontend/src/features/commercial/__tests__/stages-settings.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx (placeholder do 09-03)
    - apps/frontend/src/features/commercial/pages/CommercialSettingsPage.tsx (09-03)
    - apps/frontend/src/features/bridal/components/ContractSettingsTab.tsx (aba de configuração no padrão)
  </read_first>
  <behavior>
    - lista as etapas com nome, cor (input type color + hex), prazo em dias (vazio = sem prazo); Ganho e Perdido aparecem com selo 'Etapa de sistema', sem campo de prazo e sem botão excluir
    - 'Nova etapa' cria com nome obrigatório; salvar chama createCommercialStage
    - setas subir/descer (botões de 44 px, acessíveis por teclado) reordenam só entre as abertas e chamam reorderCommercialStages com todos os ids (Ganho e Perdido no fim)
    - excluir etapa com negócios abre diálogo 'Mover os negócios para' com select das outras abertas e chama deleteCommercialStage(id, moveToStageId)
    - erro STAGE_LAST_OPEN aparece como 'Mantenha pelo menos uma etapa aberta.'
  </behavior>
  <action>`stages.api.ts` com as 4 mutações de etapa; `StagesSettingsTab` (mesma assinatura do placeholder) conforme o `<behavior>`, usando `CommercialStagesQuery` (`openDeals` decide se pede destino). Teste. Commit `feat(09-12): configuração das etapas do funil`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Etapa de sistema" apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx` encontra
    - `grep -n "ReorderCommercialStagesMutation" apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx` encontra
    - `grep -n "return null" apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx` vazio
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Salão configura o próprio funil.</done>
</task>

</tasks>

<verification>
`vitest run src/features/commercial`, typecheck e lint do frontend verdes.
</verification>

<success_criteria>
Do kanban ao contrato rascunho, pela tela, com regras de papel.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-12-SUMMARY.md`
</output>

---
phase: 04-bridal-contracts
plan: 14
type: execute
wave: 5
depends_on: ["04-04", "04-06", "04-07", "04-09", "04-11"]
files_modified:
  - apps/frontend/src/features/bridal/api/contracts.api.ts
  - apps/frontend/src/features/bridal/lib/contract-labels.ts
  - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
  - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
  - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
  - apps/frontend/src/features/bridal/components/ContractSettingsTab.tsx
  - apps/frontend/src/features/bridal/components/ContractPaymentDialog.tsx
  - apps/frontend/src/features/bridal/components/ReverseContractPaymentDialog.tsx
  - apps/frontend/src/features/bridal/components/CancelContractDialog.tsx
  - apps/frontend/src/features/bridal/components/ContractLinkCard.tsx
  - apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx
  - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
  - apps/frontend/src/features/operations/lib/money.ts
  - apps/frontend/src/features/operations/__tests__/money.test.ts
  - apps/frontend/src/features/operations/api/comandas.api.ts
  - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
  - apps/frontend/src/features/operations/pages/ComandaPage.tsx
  - apps/frontend/src/features/operations/api/financial.api.ts
  - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
  - apps/frontend/src/features/catalog/api/pacotes.api.ts
  - apps/frontend/src/features/catalog/components/PacoteForm.tsx
  - apps/frontend/src/features/catalog/__tests__/pacote-deposit.test.tsx
autonomous: true
requirements: [CONT-01, CONT-02, CONT-03]

must_haves:
  truths:
    - "Pacote de noiva tem campo de entrada em R$ ou %"
    - "Em /contratos o proprietário vê os contratos com filtros (entrada pendente, vence em 3 dias, vencido, quitado) e cria contrato a partir do grupo (/contratos?grupo=<id>) com itens por pessoa, desconto, entrada e prazo"
    - "No detalhe: itens, total, pago, saldo, prazo, status do aceite, link para copiar, pagamentos (com estorno), cancelamento com prévia do acerto e download do PDF"
    - "Em Contratos › Configurações, ADMIN edita prazo padrão, modelo do contrato (com variáveis), cláusula de cancelamento, limiares de alerta e janela do dia"
    - "A comanda mostra 'Coberto pelo contrato CT-…' e cobra só o valor a pagar (espelho da regra única do backend)"
    - "O financeiro mostra quanto do Faturado veio de contratos"
  artifacts:
    - path: "apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx"
      provides: "Detalhe do contrato com ações"
    - path: "apps/frontend/src/features/operations/lib/money.ts"
      contains: "covered"
  key_links:
    - from: "ContractPaymentDialog.tsx"
      to: "Mutation recordContractPayment"
      via: "linhas método+valor"
      pattern: "recordContractPayment"
    - from: "CancelContractDialog.tsx"
      to: "Query contractCancellationPreview + Mutation cancelContract"
      via: "prévia antes de confirmar"
      pattern: "contractCancellationPreview"
    - from: "PaymentPanel.tsx"
      to: "computePaymentSummary(owed)"
      via: "regra única D-07 da fase 3 com cobertura"
      pattern: "owed"
---

<objective>
Telas de contratos (CONT-01..03): lista com status derivado, criação a partir do grupo, detalhe com pagamentos/estorno/cancelamento/link/PDF, configurações do contrato, entrada no pacote, cobertura visível na comanda (espelho do 04-07) e parcela de contratos no financeiro.

Purpose: torna visíveis os critérios 2 e 4 (alertas aparecem no sino do 04-04 e como filtros/badges aqui).
Output: páginas de contratos preenchidas, 6 componentes, ajustes em comanda/financeiro/pacote, testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-06-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-07-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-09-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-11-SUMMARY.md
@apps/backend/src/graphql/schema/contracts.graphql
@apps/backend/src/graphql/schema/contract-payments.graphql
@apps/backend/src/graphql/schema/contract-documents.graphql
@apps/frontend/src/features/operations/lib/money.ts
@apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm --filter @sgs/frontend codegen && corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend test`. Não ligar a flag `contratos` aqui (04-15). Não tocar em `router.tsx` nem em `features/bridal/lib/bridal-labels.ts` (04-13, paralelo).

Artefato gerado: se o merge com um plano paralelo conflitar em `apps/frontend/src/gql/`, não resolver à mão — regenerar com `corepack pnpm --filter @sgs/frontend codegen` e commitar o resultado.

<interfaces>
GraphQL (04-06/04-07/04-09/04-11): `contracts(status, derived)`, `contract(id)` (campos derivados `paid balance depositPaid depositPending settled daysToBalanceDue balanceDueSoon balanceOverdue depositOverdue needsAcceptance linkExpiresAt acceptance currentText currentTextSha256 items payments{ reversed }`), `createContract`, `updateContract`, `generateContractLink` → `{ url expiresAt }`, `contractSettings`, `updateContractSettings`, `recordContractPayment({ contractId, lines: [{ method, amount }], note })`, `reverseContractPayment({ paymentId, reason })`, `contractCancellationPreview(contractId, party)`, `cancelContract({ contractId, party, reason, refundMethod })`, `contractPdf(id) { filename base64 }`; `Comanda.covered/owed`, `ComandaItem.contractId/contractCode`; `FinancialSummary.contractBilledTotal`, `CashMovementEntry.contractCode`; `Package.depositKind/depositValue`.
`computePaymentSummary(total: string, payments)` em `features/operations/lib/money.ts` espelha `computeComandaTotals` do backend.
Gates: `useBridalPermission('contract.read'|'contract.write'|'contract.payment'|'contract.cancel'|'contract.settings')`.
Métodos de pagamento (03 D-09) e rótulos: reutilizar os de `operations-labels.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Espelho da cobertura na comanda, parcela de contratos no financeiro e entrada no pacote</name>
  <files>apps/frontend/src/features/operations/lib/money.ts, apps/frontend/src/features/operations/__tests__/money.test.ts, apps/frontend/src/features/operations/api/comandas.api.ts, apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx, apps/frontend/src/features/operations/pages/ComandaPage.tsx, apps/frontend/src/features/operations/api/financial.api.ts, apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/features/catalog/api/pacotes.api.ts, apps/frontend/src/features/catalog/components/PacoteForm.tsx, apps/frontend/src/features/catalog/__tests__/pacote-deposit.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/lib/money.ts e money.test.ts
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx e pages/ComandaPage.tsx
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/catalog/components/PacoteForm.tsx e catalog/__tests__/pacote-price-summary.test.tsx
  </read_first>
  <behavior>
    - `computePaymentSummary('0.00', [])` → `remaining '0.00'`, sem erro (comanda 100% coberta pode fechar)
    - `computePaymentSummary('35.00', [])` → `remaining '35.00'`
    - Regra idêntica ao backend: o primeiro argumento passa a ser o "a pagar" (owed), não o total
  </behavior>
  <action>
1. `money.ts`: documentar que `computePaymentSummary` recebe o valor a pagar (`comanda.owed`) — regra ÚNICA da fase 3 D-07 com cobertura (D-08); acrescentar os casos ao `money.test.ts`.
2. `comandas.api.ts`: pedir `covered owed` e nos itens `contractId contractCode`. `PaymentPanel`/`ComandaPage`: usar `owed` no resumo; quando `covered > 0`, linha "Coberto pelo contrato <code>: R$ x" e por item badge "Contrato <code>"; com `owed = 0` mostrar "Nada a cobrar — coberto pelo contrato" e permitir "Fechar comanda" sem pagamento.
3. `financial.api.ts`/`FinanceiroPage`: pedir `contractBilledTotal`; abaixo do card Faturado, "inclui R$ x de contratos" quando > 0; na lista de caixa, origem `contractCode` quando existir.
4. `pacotes.api.ts`/`PacoteForm`: campos "Entrada do contrato" (select: Sem entrada / Valor fixo R$ / Percentual %) + valor (máscara de moeda ou número 0–100); envia `depositKind/depositValue` (null quando "Sem entrada"); teste `pacote-deposit.test.tsx`: escolher Percentual 30 envia `{ depositKind: 'percent', depositValue: '30' }`; 120 mostra erro.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend codegen && corepack pnpm --filter @sgs/frontend test -- money payment-panel comanda-page financeiro-page pacote && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "owed" apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx` encontra
    - `grep -n "Coberto pelo contrato" apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx apps/frontend/src/features/operations/pages/ComandaPage.tsx` encontra
    - `grep -n "contractBilledTotal" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` encontra
    - `grep -n "depositKind" apps/frontend/src/features/catalog/components/PacoteForm.tsx` encontra
    - Testes existentes da comanda/financeiro continuam verdes
  </acceptance_criteria>
  <done>Cobertura do contrato visível e consistente na comanda; financeiro e pacote atualizados.</done>
</task>

<task type="auto">
  <name>Task 2: Lista de contratos, criação a partir do grupo e configurações</name>
  <files>apps/frontend/src/features/bridal/api/contracts.api.ts, apps/frontend/src/features/bridal/lib/contract-labels.ts, apps/frontend/src/features/bridal/pages/ContractsPage.tsx, apps/frontend/src/features/bridal/components/ContractFormDialog.tsx, apps/frontend/src/features/bridal/components/ContractSettingsTab.tsx, apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/ContractsPage.tsx (casca do 04-04)
    - apps/backend/src/graphql/schema/contracts.graphql
    - apps/frontend/src/features/catalog/components/PacoteForm.tsx (form com valores monetários)
  </read_first>
  <action>
1. `contracts.api.ts`: fragment `ContractFields` (todos os campos do type Contract) e documentos de todas as operações da interface (incluindo `contractPdf`, `contractCancellationPreview`). `contract-labels.ts`: `CONTRACT_STATUS_LABEL = { draft: 'Rascunho', awaiting_acceptance: 'Aguardando aceite', active: 'Ativo', completed: 'Concluído', cancelled: 'Cancelado' }`, `derivedBadges(c)` → lista de `{ label, tone }`: "Entrada pendente" (warning, `depositPending > 0`), "Vence em N dia(s)" (warning, `balanceDueSoon`), "Vencido" (destructive, `balanceOverdue`), "Quitado" (success, `settled`), "Aguardando aceite" (`needsAcceptance`); `PARTY_LABEL = { client: 'Pela noiva', studio: 'Pelo estúdio' }`; mensagens para códigos (`OVERPAYMENT`, `ALREADY_REVERSED`, `REFUND_METHOD_REQUIRED`, `MEMBER_NOT_COVERED`, `GROUP_HAS_CONTRACT`, `TOTAL_BELOW_PAID`, `UNKNOWN_TEMPLATE_VARIABLE`, `ALREADY_ACCEPTED`).
2. `ContractsPage`: `Tabs` "Contratos" e "Configurações" (esta só com `contract.settings`). Aba Contratos: filtro (Todos / Entrada pendente / Vence em 3 dias / Vencidos / Quitados / Cancelados → `contracts(derived|status)`), tabela com código, noiva, data do evento, total, pago, saldo, prazo e `derivedBadges`; linha → `/contratos/:id`. Se a URL tiver `?grupo=<id>`, abrir `ContractFormDialog` para esse grupo (com `contract.write`).
3. `ContractFormDialog` (criar e editar; props `groupId` ou `contract`): carrega o grupo (`BridalGroupQuery` — importar o documento de `features/bridal/api/bridal.api.ts` do 04-13 se já existir; senão declarar uma query local mínima `ContractGroupQuery` em contracts.api.ts para evitar dependência de arquivo paralelo); pacote opcional (lista de pacotes com entrada); itens por pessoa coberta (pré-preenchidos com os serviços planejados e `base_price`; editar preço/qtd; remover/adicionar) — pessoas não cobertas aparecem desabilitadas com a nota "paga avulso"; desconto; entrada (preenchida pelo pacote — editável); prazo "quitar até N dias antes" (default da org). Resumo: soma dos itens, desconto, total, entrada, data limite do restante (evento − N). Submit → `createContract` / `updateContract` (edição avisa: "Editar gera nova versão e exige novo aceite da noiva."). Sucesso → `/contratos/:id`.
4. `ContractSettingsTab`: prazo padrão (dias), modelo do contrato (`Textarea` grande + lista das variáveis clicáveis para inserir `{{var}}`; aviso de `missingVariables`; botão "Restaurar modelo padrão" envia `templateBody: null`), cláusula de cancelamento (texto; explicação fixa: "Cancelamento pela noiva: os valores pagos ficam retidos. Pelo estúdio: tudo é devolvido." — D-22), limiares de alerta (entrada não paga após N dias, não aceito após N dias, sinal de acompanhante a N dias do evento), janela do dia para a sugestão de agenda (início/fim). Salvar → `updateContractSettings`.
5. Teste `contracts-page.test.tsx`: lista mostra badges "Vencido" e "Entrada pendente"; filtro "Vencidos" chama a query com `derived: 'overdue'`; `?grupo=<id>` abre o formulário; aba Configurações oculta para MANAGER; salvar modelo com `{{foo}}` mostra a mensagem de variável desconhecida.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend codegen && corepack pnpm --filter @sgs/frontend test -- contracts-page && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "derived" apps/frontend/src/features/bridal/pages/ContractsPage.tsx` encontra
    - `grep -n "grupo" apps/frontend/src/features/bridal/pages/ContractsPage.tsx` encontra (`useSearchParams`)
    - `grep -n "Restaurar modelo padrão" apps/frontend/src/features/bridal/components/ContractSettingsTab.tsx` encontra
    - Teste verde
  </acceptance_criteria>
  <done>Contratos listáveis, criáveis a partir do grupo e configuráveis por org.</done>
</task>

<task type="auto">
  <name>Task 3: Detalhe do contrato — link, pagamentos, estorno, cancelamento com prévia e PDF</name>
  <files>apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx, apps/frontend/src/features/bridal/components/ContractLinkCard.tsx, apps/frontend/src/features/bridal/components/ContractPaymentDialog.tsx, apps/frontend/src/features/bridal/components/ReverseContractPaymentDialog.tsx, apps/frontend/src/features/bridal/components/CancelContractDialog.tsx, apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx (casca do 04-04)
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx (linhas método+valor)
    - apps/frontend/src/features/operations/components/comanda/ReopenComandaDialog.tsx (motivo obrigatório)
  </read_first>
  <action>
1. `ContractDetailPage`: cabeçalho com código, status, badges derivados, noiva, grupo (link `/noivas/<groupId>`), data do evento; cards "Valores" (itens, desconto, total, entrada paga/pendente, pago, saldo, "Quitar até dd/MM/yyyy" com contagem de dias), "Itens por pessoa" (tabela), "Pagamentos" (data, método, valor, tipo — Pagamento/Estorno/Devolução —, botão "Estornar" com `contract.cancel` para pagamentos não estornados), "Aceite" (`ContractLinkCard`), "Texto do contrato" (versão atual em `whitespace-pre-wrap`, hash curto). Ações: "Registrar pagamento" (`contract.payment`, não para cancelado), "Editar" (`contract.write`, abre `ContractFormDialog` do Task 2), "Baixar PDF" (quando há aceite: `contractPdf` → `Blob` de base64 → download `filename`), "Cancelar contrato" (`contract.cancel`).
2. `ContractLinkCard`: estado do aceite (Aceito em … por <nome> CPF <mascarado>, IP, versão / Aguardando aceite / Rascunho), aviso "Contrato alterado depois do aceite — gere novo link" quando `needsAcceptance` e `acceptedVersion != null`; botão "Gerar link de aceite" → `generateContractLink`, mostra a URL (somente nesta resposta) com "Copiar link" (`navigator.clipboard.writeText` + toast "Link copiado — envie à noiva pelo WhatsApp") e validade (`expiresAt`, 30 dias).
3. `ContractPaymentDialog`: até 5 linhas método + valor (default: valor pendente da entrada, senão saldo), observação; mostra saldo após o pagamento; erro `OVERPAYMENT` no campo. `ReverseContractPaymentDialog`: motivo ≥ 3 → `reverseContractPayment`.
4. `CancelContractDialog`: escolha "Pela noiva" / "Pelo estúdio" → `contractCancellationPreview` mostra "Pago R$ x · Retido R$ y · Devolver R$ z"; motivo obrigatório; método de devolução obrigatório quando devolver > 0; aviso "Os agendamentos vinculados ao contrato serão cancelados."; confirmar → `cancelContract`.
5. Teste `contract-detail.test.tsx`: contrato com 2 pagamentos mostra pago/saldo e badge "Vence em 2 dias"; "Gerar link" mostra a URL e "Copiar link" chama `clipboard.writeText`; diálogo de pagamento envia 2 linhas; cancelamento "Pelo estúdio" mostra prévia de devolução e exige método; ATTENDANT vê "Registrar pagamento" mas não "Cancelar contrato" nem "Estornar".
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- contract-detail bridal && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "contractCancellationPreview\|ContractCancellationPreview" apps/frontend/src/features/bridal/components/CancelContractDialog.tsx` encontra
    - `grep -n "clipboard.writeText" apps/frontend/src/features/bridal/components/ContractLinkCard.tsx` encontra
    - `grep -n "recordContractPayment\|RecordContractPayment" apps/frontend/src/features/bridal/components/ContractPaymentDialog.tsx` encontra
    - `grep -n "dangerouslySetInnerHTML" apps/frontend/src/features/bridal -r` não encontra
    - Testes verdes
  </acceptance_criteria>
  <done>Critério 2 (contrato, pagamentos, política) operável pela interface.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/frontend test` verde (inclui regressão da comanda e do financeiro).</verification>

<success_criteria>Proprietário cria o contrato de R$ 8.000 a partir do grupo, gera o link, registra entrada e pagamentos livres, vê alertas como badges e cancela com o acerto da política.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-14-SUMMARY.md`
</output>

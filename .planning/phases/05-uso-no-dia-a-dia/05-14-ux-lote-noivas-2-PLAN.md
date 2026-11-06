---
phase: 05-uso-no-dia-a-dia
plan: 14
type: execute
wave: 10
depends_on: ["05-07", "05-08", "05-13"]
files_modified:
  - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
  - apps/frontend/src/features/bridal/components/ContractLinkCard.tsx
  - apps/frontend/src/features/bridal/components/CompleteContractorDialog.tsx
  - apps/frontend/src/features/bridal/__tests__/contract-detail-mobile.test.tsx
  - apps/frontend/src/features/bridal/__tests__/complete-contractor-dialog.test.tsx
  - apps/e2e/tests/ux-contrato-celular.spec.ts
  - apps/e2e/tests/ux-contrato-completar-dados.spec.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "No celular o contrato mostra itens e pagamentos em cartões, com valores inteiros e o aviso de dados faltantes junto do pagamento (UX-12)"
    - "Um único botão "Completar dados da contratante" abre um diálogo e atualiza o contrato sem sair da tela (UX-13)"
  artifacts:
    - path: "apps/frontend/src/features/bridal/__tests__/contract-detail-mobile.test.tsx"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-14-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Noivas e contratos (lote 2 de 2). Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-12 Contratos no celular: tabelas espremidas e valores quebrando
- UX-13 Dados faltantes do contrato exigem abrir a ficha da cliente um por vez

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-14-SUMMARY.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: UX-12 Contrato no celular: cartões empilhados em vez de tabelas espremidas</name>
  <files>apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx, apps/frontend/src/features/bridal/__tests__/contract-detail-mobile.test.tsx, apps/e2e/tests/ux-contrato-celular.spec.ts</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx (tabelas "Itens por pessoa" e "Forma de pagamento"; aviso de dados faltantes; botão de pagamento)
    - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-fixtures.ts
    - apps/e2e/tests/noivas-contrato.spec.ts (modelo de fluxo com contrato)
  </read_first>
  <behavior>
    - Vitest (`contract-detail-mobile.test.tsx`): cada tabela tem versão `hidden md:block` (`data-testid="contract-items-table"`, `contract-payments-table"`) e versão empilhada `md:hidden` (`contract-items-cards`, `contract-payments-cards`) com os mesmos valores; todo valor em R$ tem a classe `whitespace-nowrap`.
    - Vitest: no DOM, o aviso de dados faltantes (`data-testid="contract-missing-alert"`) vem imediatamente antes da seção/botão de pagamento (`contract-payment-section`), sem outra seção entre os dois.
    - Playwright (celular 412x915): em um contrato com pagamento, nenhum valor "R$ ..." quebra em duas linhas (altura do elemento menor que 1,6 vezes a altura da linha) e a página não tem rolagem horizontal.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. Em `ContractDetailPage.tsx`, para "Itens por pessoa" e "Forma de pagamento": manter a `<table>` dentro de `<div className="hidden md:block">` e acrescentar `<ul className="space-y-sm md:hidden">` com um cartão por linha (`rounded-md border border-neutral-200 p-sm`), nome em negrito na primeira linha e os pares rótulo/valor abaixo, valores com `whitespace-nowrap text-right`.
3. Mover o aviso de dados faltantes para logo antes do bloco de pagamento (mesmo nível, sem seção entre eles), com `data-testid="contract-missing-alert"`.
4. Este lote vem depois do 05-13 (mesmo arquivo `ContractDetailPage.tsx`): ler o arquivo atual antes de editar.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- contract-detail && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-contrato-celular.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "md:hidden" apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx` encontra os cartões
    - `contract-detail-mobile.test.tsx` e o Playwright passam; `contract-detail.test.tsx` continua passando
  </acceptance_criteria>
  <done>Contrato legível no celular, com valores inteiros e aviso junto do pagamento (UX-12).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-13 "Completar dados da contratante" em um único diálogo, sem sair do contrato</name>
  <files>apps/frontend/src/features/bridal/components/CompleteContractorDialog.tsx, apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx, apps/frontend/src/features/bridal/components/ContractLinkCard.tsx, apps/frontend/src/features/bridal/__tests__/complete-contractor-dialog.test.tsx, apps/e2e/tests/ux-contrato-completar-dados.spec.ts</files>
  <read_first>
    - apps/frontend/src/features/bridal/components/ContractLinkCard.tsx (links "Editar cliente" por dado faltante)
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx (lista de dados que faltam e como recarregar o contrato)
    - apps/frontend/src/features/clients/api/clients.api.ts (`UpdateClientMutation` com `UpdateClientInput`)
    - apps/frontend/src/features/clients/components/ (campos e validação do formulário de cliente: CPF, CEP, endereço, celular)
    - apps/frontend/src/features/clients/utils/cpf.ts
    - apps/frontend/src/features/clients/utils/masks.ts
    - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
    - apps/backend/src/contracts (função/consulta que lista os campos faltantes da contratante, para usar as mesmas chaves)
  </read_first>
  <behavior>
    - Vitest (`complete-contractor-dialog.test.tsx`): com campos faltantes CPF e celular, o botão "Completar dados da contratante" abre um diálogo com somente esses campos; validar CPF inválido mostra "CPF inválido"; ao salvar chama `UpdateClientMutation` uma única vez com todos os campos preenchidos e depois refaz a consulta do contrato (refetch) e fecha o diálogo.
    - Vitest (`contract-detail.test.tsx`): a tela mostra um único botão "Completar dados da contratante" e nenhum link "Editar cliente" por item faltante; sem dados faltantes o botão não aparece.
    - Playwright (`ux-contrato-completar-dados.spec.ts`): contrato com cliente sem CPF; abrir o diálogo, preencher CPF válido e celular, salvar; a URL continua `/contratos/<id>` e o aviso de dados faltantes some.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. Criar `CompleteContractorDialog.tsx` (shadcn `Dialog`, React Hook Form + Zod como os demais formulários do projeto) que recebe `clientId`, a lista de campos faltantes (CPF, RG, endereço, CEP, cidade, celular etc., com as mesmas chaves que a tela de detalhe usa hoje) e `onSaved`. Mostra apenas os campos faltantes, com as máscaras e validações já existentes (`cpf.ts`, `masks.ts`). Salvar chama `UpdateClientMutation` uma vez e `onSaved()` (que faz `refetch` do contrato).
3. Em `ContractDetailPage.tsx` (e `ContractLinkCard.tsx`) trocar os links "Editar cliente" individuais por um único botão `Completar dados da contratante` (aparece só se a lista de faltantes não está vazia) que abre o diálogo. Não remover a lista informativa dos itens faltantes.
4. Permissão: o botão só aparece para quem pode editar cliente (usar a permissão que o link "Editar cliente" já usava).
5. Depois de 05-13 e do passo anterior deste lote (mesmo arquivo): ler `ContractDetailPage.tsx` atual antes de editar.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- complete-contractor-dialog contract-detail && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-contrato-completar-dados.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "Completar dados da contratante" apps/frontend/src/features/bridal` encontra o botão e o título do diálogo
    - `grep -rn "Editar cliente" apps/frontend/src/features/bridal --include=*.tsx` não retorna mais links por item faltante em `ContractDetailPage.tsx`/`ContractLinkCard.tsx`
    - `complete-contractor-dialog.test.tsx` e o Playwright passam; `contract-detail.test.tsx` passa
  </acceptance_criteria>
  <done>Os dados da contratante se completam de uma vez, dentro do contrato (UX-13).</done>
</task>

<task type="auto">
  <name>Task 3: Gate completo, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md (seção Correções)
  </read_first>
  <action>
1. Rodar o gate completo, na raiz do repositório, e só seguir com tudo verde: `pnpm -r typecheck`, `pnpm -r --if-present lint`, `pnpm --filter @sgs/backend test`, `pnpm --filter @sgs/backend test:integration`, `pnpm --filter @sgs/frontend test`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha causada pelos arquivos deste lote: corrigir. Falha antiga em arquivo não tocado: registrar em `deferred-items.md` da fase e não corrigir.
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-14): contrato: cartões no celular e completar dados da contratante (UX-12, UX-13)`, com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-12, UX-13 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-14): registra commit das correções UX-12, UX-13`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-14)` e citando UX-12, UX-13
    - Linhas UX-12, UX-13 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
    - `./scripts/deploy-staging.sh` concluiu sem erro e `gh run watch` terminou com sucesso
  </acceptance_criteria>
  <done>Lote entregue no staging com CI verde e commit registrado na auditoria.</done>
</task>

</tasks>

<verification>
- Todos os IDs do lote com teste de regressão passando, gate completo verde, deploy no staging feito e CI verde
</verification>

<success_criteria>
Critério de sucesso 1 da fase: itens aprovados deste lote corrigidos no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-14-SUMMARY.md`
</output>

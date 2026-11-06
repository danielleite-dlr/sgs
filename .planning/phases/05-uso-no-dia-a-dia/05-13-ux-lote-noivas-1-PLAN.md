---
phase: 05-uso-no-dia-a-dia
plan: 13
type: execute
wave: 9
depends_on: ["05-07", "05-08", "05-12"]
files_modified:
  - apps/frontend/src/features/bridal/components/ContractTextView.tsx
  - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
  - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
  - apps/frontend/src/features/bridal/__tests__/contract-text-view.test.tsx
  - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
  - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "O texto do contrato aparece com títulos em negrito e sem "**" (UX-11)"
    - "O detalhe do grupo mostra um só status, esconde "Pronta até" vazio e formata o telefone (UX-14)"
  artifacts:
    - path: "apps/frontend/src/features/bridal/__tests__/contract-text-view.test.tsx"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-13-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Noivas e contratos (lote 1 de 2). Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-11 Asteriscos soltos no texto do contrato
- UX-14 Detalhe do grupo de noivas com dois status, campo vazio e telefone sem formatação

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-13-SUMMARY.md`.
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
  <name>Task 1: UX-11 Texto do contrato com negrito interpretado (sem asteriscos soltos)</name>
  <files>apps/frontend/src/features/bridal/components/ContractTextView.tsx, apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx, apps/frontend/src/features/bridal/__tests__/contract-text-view.test.tsx, apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx (`<pre data-testid="contract-text">` ~linha 390 mostrando `c.currentText`)
    - apps/frontend/src/features/bridal/lib/contract-rich-text.ts (parseBold e splitParagraphs)
    - apps/frontend/src/features/bridal/public/ContractDocument.tsx (linhas 7-30: como o aceite público já renderiza negrito e parágrafos)
    - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
    - apps/backend/src/contracts/domain/contract-texts.ts (como o PDF trata `**`)
  </read_first>
  <behavior>
    - Vitest (`contract-text-view.test.tsx`): `<ContractTextView text={"**I. Das partes:**\n\n**Contratado:** Studio JS"} />` produz `<strong>` com "I. Das partes:" e "Contratado:", dois parágrafos, e `container.textContent` NÃO contém "**".
    - Vitest (`contract-detail.test.tsx`): o `data-testid="contract-text"` da tela de detalhe não contém "**" quando o texto do contrato os tem; o teste atual que lê o texto cru é ajustado para ler o texto interpretado.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. Criar `ContractTextView.tsx` (`export function ContractTextView({ text }: { text: string })`) que usa `splitParagraphs(text)` e `parseBold(p)` de `contract-rich-text.ts` e renderiza `<div data-testid="contract-text" className="space-y-sm text-sm text-neutral-700">` com um `<p>` por parágrafo (`\n` simples vira `<br />`) e `<strong className="font-semibold text-neutral-800">` nos trechos em negrito. Mesmo comportamento do `ContractDocument.tsx`, sem importar dele.
3. Em `ContractDetailPage.tsx` trocar o `<pre ...>{c.currentText}</pre>` por `<ContractTextView text={c.currentText} />`, mantendo o `data-testid="contract-text"`.
4. Conferir o PDF: rodar `pnpm --filter @sgs/backend test -- contract` e ler `contract-texts.ts`; o backend já usa a mesma função de negrito. Se algum teste mostrar `**` literal no PDF, abrir item novo na seção Correções da auditoria e tratar neste mesmo commit só se for troca de uma linha; senão registrar em Deferred Issues.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- contract-text-view contract-detail && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "<pre" apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx` não retorna o bloco do texto do contrato
    - `grep -n "ContractTextView" apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx` encontra o uso
    - `contract-text-view.test.tsx` passa e falhava antes; `contract-detail.test.tsx` passa
  </acceptance_criteria>
  <done>Texto do contrato lido com títulos em negrito e sem asteriscos (UX-11).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-14 Detalhe do grupo de noivas: um status, campo vazio escondido, telefone formatado</name>
  <files>apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx (cabeçalho com "Status: Ativo" e Badge "Rascunho"; campo "Pronta até"; telefone)
    - apps/frontend/src/features/bridal/lib/bridal-labels.ts
    - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-fixtures.ts
    - apps/frontend/src/lib/format-phone.ts (criado pelo lote 05-11)
  </read_first>
  <behavior>
    - Vitest: o cabeçalho mostra um único Badge de status (`getAllByTestId('group-status')` com length 1); quando existe contrato em rascunho aparece a legenda "Contrato em rascunho" em texto pequeno abaixo, e não um segundo Badge ao lado.
    - Vitest: sem data limite, o texto "Pronta até" não é renderizado; com data, aparece "Pronta até 20/12/2026".
    - Vitest: telefone "+5511988887777" aparece como "(11) 98888-7777".
  </behavior>
  <action>
1. Atualizar `bridal-group-detail.test.tsx` com os 3 casos (falham antes).
2. No cabeçalho de `BridalGroupDetailPage.tsx` deixar um só `<Badge data-testid="group-status">` com o status do grupo (rótulo de `bridal-labels.ts`); o estado "Rascunho" do contrato vira `<p className="text-xs text-neutral-600">Contrato em rascunho</p>` quando existir. Remover o texto solto "Status:".
3. Renderizar "Pronta até {data}" somente quando o valor existir (nada de "—").
4. Telefone com `formatPhoneBr` de `@/lib/format-phone`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- bridal-group-detail && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "formatPhoneBr" apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx` encontra o uso
    - `grep -n "data-testid=\"group-status\"" apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx` aparece uma vez
    - `bridal-group-detail.test.tsx` passa
  </acceptance_criteria>
  <done>Detalhe do grupo com status único, sem campo vazio e telefone legível (UX-14).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-13): noivas: texto do contrato e detalhe do grupo (UX-11, UX-14)`, com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-11, UX-14 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-13): registra commit das correções UX-11, UX-14`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-13)` e citando UX-11, UX-14
    - Linhas UX-11, UX-14 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-13-SUMMARY.md`
</output>

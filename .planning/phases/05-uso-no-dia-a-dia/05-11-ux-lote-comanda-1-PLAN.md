---
phase: 05-uso-no-dia-a-dia
plan: 11
type: execute
wave: 7
depends_on: ["05-07", "05-08", "05-10"]
files_modified:
  - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
  - apps/frontend/src/features/operations/pages/ComandaPage.tsx
  - apps/frontend/src/features/operations/pages/ComandaListPage.tsx
  - apps/frontend/src/lib/format-phone.ts
  - apps/frontend/src/lib/format-name.ts
  - apps/frontend/src/lib/__tests__/format-phone.test.ts
  - apps/frontend/src/lib/__tests__/format-name.test.ts
  - apps/frontend/src/features/operations/__tests__/ux-comanda-lote1.test.tsx
  - apps/frontend/src/features/operations/__tests__/comanda-list-page.test.tsx
  - apps/e2e/tests/ux-comanda-lista.spec.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "O botão "Fechar comanda" aparece em cor cheia quando já dá para fechar e explica o motivo quando está bloqueado (UX-06)"
    - "A lista de comandas usa a largura da tela, o código fica em uma linha e o nome do cliente aparece em caixa normal (UX-07)"
    - "O cartão "Cliente" começa pelo nome e mostra o telefone como (11) 98888-7777 (UX-08)"
  artifacts:
    - path: "apps/frontend/src/lib/__tests__/format-phone.test.ts"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-11-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Comanda e caixa (lote 1 de 2). Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-06 Botão "Fechar comanda" parece desativado
- UX-07 Lista de comandas estreita, código quebrado em três linhas
- UX-08 Cartão do cliente repete o código e telefone sem formatação

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-11-SUMMARY.md`.
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
  <name>Task 1: UX-06 Botão "Fechar comanda" forte quando pronto e UX-08 cartão do cliente</name>
  <files>apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx, apps/frontend/src/features/operations/pages/ComandaPage.tsx, apps/frontend/src/lib/format-phone.ts, apps/frontend/src/lib/__tests__/format-phone.test.ts, apps/frontend/src/features/operations/__tests__/ux-comanda-lote1.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx (botão "Fechar comanda" e a condição de desativado)
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx (cartão "Cliente" ~linhas 180-200: linha do código e telefone cru)
    - apps/frontend/src/features/operations/__tests__/payment-panel.test.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-fixtures.ts
    - apps/frontend/src/components/ui/button-variants.ts (`disabled:opacity-50`)
  </read_first>
  <behavior>
    - Vitest (`format-phone.test.ts`): `formatPhoneBr('+5511988887777')` = "(11) 98888-7777"; `'11988887777'` = "(11) 98888-7777"; `'1188887777'` = "(11) 8888-7777"; `'+55 11 98888-7777'` = "(11) 98888-7777"; texto sem dígitos ou tamanho inesperado volta como veio.
    - Vitest (`ux-comanda-lote1.test.tsx`): com `Falta R$ 0,00` o botão "Fechar comanda" NÃO está `disabled` e tem as classes `bg-primary` e `text-white`; com falta maior que zero fica `disabled` e exibe, logo abaixo, o texto "Falta R$ X,XX para fechar" (valor da falta); o cartão "Cliente" mostra o nome primeiro, o telefone como "(11) 98888-7777" e NÃO repete o código da comanda.
  </behavior>
  <action>
1. Criar `lib/format-phone.ts` com `export function formatPhoneBr(raw: string | null | undefined): string` (remove não-dígitos, tira o prefixo 55 quando o total tem 12 ou 13 dígitos, formata 11 dígitos como `(DD) 9XXXX-XXXX` e 10 como `(DD) XXXX-XXXX`; qualquer outro caso devolve o texto original) e o teste unitário.
2. UX-08: em `ComandaPage.tsx`, no cartão "Cliente" remover a primeira linha que mostra `comanda.code` (o código já está no título da página) e trocar `<span>{comanda.client.phone}</span>` por `<span>{formatPhoneBr(comanda.client.phone)}</span>`.
3. UX-06: em `PaymentPanel.tsx` achar o botão "Fechar comanda" (`grep -n "Fechar comanda" PaymentPanel.tsx`). Quando `canClose` for verdadeiro usar a variante cheia (`variant="default"`, sem `opacity`, sem classe `bg-primary-50/200` ou `text-primary-*` pálida); quando estiver desativado manter `disabled` e mostrar abaixo `<p className="text-xs text-neutral-600" data-testid="close-blocked-reason">Falta R$ {falta} para fechar</p>` (ou o motivo real já calculado no componente, por exemplo comanda sem itens: "Adicione ao menos um item para fechar").
4. Escrever os testes antes das mudanças e vê-los falhar.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- format-phone ux-comanda-lote1 payment-panel comanda-page && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "formatPhoneBr" apps/frontend/src/features/operations/pages/ComandaPage.tsx` encontra o uso
    - `ux-comanda-lote1.test.tsx` e `format-phone.test.ts` passam e falhavam antes
    - `payment-panel.test.tsx` e `comanda-page.test.tsx` continuam passando
  </acceptance_criteria>
  <done>Botão de fechar com cara de pronto, motivo visível quando bloqueado, cartão do cliente limpo (UX-06, UX-08).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-07 Lista de comandas em largura total, código sem quebra, nome em caixa normal</name>
  <files>apps/frontend/src/features/operations/pages/ComandaListPage.tsx, apps/frontend/src/lib/format-name.ts, apps/frontend/src/lib/__tests__/format-name.test.ts, apps/frontend/src/features/operations/__tests__/comanda-list-page.test.tsx, apps/e2e/tests/ux-comanda-lista.spec.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/ComandaListPage.tsx (container da tabela, `<table className="w-full text-sm">`, colunas Código, Cliente, Aberta em; pais do elemento até o AppShell para achar o que limita a largura)
    - apps/frontend/src/features/operations/__tests__/comanda-fixtures.ts
    - apps/e2e/tests/smoke.spec.ts
  </read_first>
  <behavior>
    - Vitest (`format-name.test.ts`): `toDisplayName('MARIA DA SILVA')` = "Maria da Silva"; `'joão pedro'` = "João Pedro"; partículas `da, de, do, das, dos, e` ficam minúsculas (menos na primeira palavra); espaços repetidos viram um; vazio devolve vazio.
    - Vitest (`comanda-list-page.test.tsx`): linha com cliente "MARIA SILVA" mostra "Maria Silva"; a célula do código tem a classe `whitespace-nowrap`; a coluna "Aberta em" tem `whitespace-nowrap`; a tabela e o container têm `w-full`.
    - Playwright (`ux-comanda-lista.spec.ts`, desktop 1366x768): a largura da tabela `[data-testid="comanda-list"]` é pelo menos 80% da largura do conteúdo principal e o código "C-" cabe em uma linha (`boundingBox().height` da célula menor que 48 px).
  </behavior>
  <action>
1. Criar `lib/format-name.ts` com `export function toDisplayName(raw: string | null | undefined): string` (usa `toLocaleLowerCase('pt-BR')`, depois põe a inicial maiúscula em cada palavra, exceto as partículas acima fora da primeira posição) e o teste unitário. Esta função é reaproveitada pelo lote 05-15 (padronização da caixa dos nomes).
2. Em `ComandaListPage.tsx`: garantir que o `Card`/container da tabela use `w-full min-w-0` (investigar o pai que a espreme: um `flex` sem `flex-1`/`w-full`, `w-fit` ou `max-w-*`; corrigir ali), colocar `whitespace-nowrap` nos `<td>` do código e de "Aberta em" e nos `<th>`, e trocar `{c.client.fullName}` por `{toDisplayName(c.client.fullName)}`.
3. Escrever os testes antes e vê-los falhar.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- format-name comanda-list-page && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-comanda-lista.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "whitespace-nowrap" apps/frontend/src/features/operations/pages/ComandaListPage.tsx` encontra o código e a data
    - `grep -n "toDisplayName" apps/frontend/src/features/operations/pages/ComandaListPage.tsx` encontra o uso
    - `format-name.test.ts`, `comanda-list-page.test.tsx` e o Playwright passam
  </acceptance_criteria>
  <done>Lista de comandas ocupa a largura da tela, código em uma linha e nomes em caixa normal (UX-07).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-11): comanda: botão de fechar, lista e cartão do cliente (UX-06, UX-07, UX-08)`, com o trailer `Co-Authored-By` que o ambiente indicar.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-06, UX-07, UX-08 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-11): registra commit das correções UX-06, UX-07, UX-08`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-11)` e citando UX-06, UX-07, UX-08
    - Linhas UX-06, UX-07, UX-08 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-11-SUMMARY.md`
</output>

---
phase: 05-uso-no-dia-a-dia
plan: 12
type: execute
wave: 8
depends_on: ["05-07", "05-08", "05-11"]
files_modified:
  - apps/frontend/src/features/operations/pages/ComandaPage.tsx
  - apps/frontend/src/components/layout/IconRail.tsx
  - apps/frontend/src/components/layout/AppDrawer.tsx
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/features/operations/__tests__/ux-comanda-lote2.test.tsx
  - apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx
  - apps/e2e/tests/ux-comanda-celular.spec.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "No celular a comanda mostra os itens logo abaixo do cliente e o nome do item cabe (UX-09)"
    - "O menu lateral não gera aviso de HTML inválido no console em nenhuma tela (UX-10)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/ux-comanda-lote2.test.tsx"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-12-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Comanda e caixa (lote 2 de 2) e menu. Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-09 Itens da comanda no celular ficam depois de "Adicionar" e o nome quebra
- UX-10 Aviso de HTML inválido (item de lista dentro de item de lista) no menu

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-12-SUMMARY.md`.
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
  <name>Task 1: UX-09 Itens da comanda logo abaixo do cliente e nome do item com largura (celular)</name>
  <files>apps/frontend/src/features/operations/pages/ComandaPage.tsx, apps/frontend/src/features/operations/__tests__/ux-comanda-lote2.test.tsx, apps/e2e/tests/ux-comanda-celular.spec.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx (ordem dos blocos: Cliente, Adicionar à comanda, Itens da comanda; layout em colunas)
    - apps/frontend/src/features/operations/components/comanda/ (lista de itens e painel de adicionar)
    - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-fixtures.ts
  </read_first>
  <behavior>
    - Vitest: na ordem do DOM, o bloco `data-testid="comanda-itens"` vem depois de `data-testid="comanda-cliente"` e ANTES de `data-testid="comanda-adicionar"`; o nome do item tem `min-w-0` e `break-words` e não tem largura fixa menor que 40%.
    - Playwright (celular 412x915): na comanda aberta, a posição vertical de "Itens da comanda" é menor que a de "Adicionar à comanda", e o nome de um item de 25 caracteres ocupa no máximo 2 linhas.
  </behavior>
  <action>
1. Escrever os testes (falham antes). Incluir `data-testid` nos três blocos se ainda não existirem.
2. Em `ComandaPage.tsx` reordenar o JSX: Cliente, Itens da comanda, Adicionar à comanda (nesta ordem no DOM). Se no computador o layout em duas colunas colocar "Adicionar" ao lado, manter a posição com `lg:order-*`/`lg:col-start-*` sem trocar a ordem do DOM no celular.
3. Na linha do item: nome em `<span className="min-w-0 flex-1 break-words">` e quantidade/valor em `shrink-0 whitespace-nowrap`, para o nome não ficar espremido em três linhas.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- ux-comanda-lote2 comanda-page && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-comanda-celular.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `ux-comanda-lote2.test.tsx` confirma a ordem Cliente, Itens, Adicionar
    - `grep -n "break-words" apps/frontend/src/features/operations/pages/ComandaPage.tsx` (ou o componente da linha de item) encontra a classe
    - `comanda-page.test.tsx` continua passando
  </acceptance_criteria>
  <done>No celular os itens aparecem logo abaixo do cliente, com o nome legível (UX-09).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-10 Menu lateral sem item de lista dentro de item de lista</name>
  <files>apps/frontend/src/components/layout/IconRail.tsx, apps/frontend/src/components/layout/AppDrawer.tsx, apps/frontend/src/components/layout/SidebarNav.tsx, apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx</files>
  <read_first>
    - apps/frontend/src/components/layout/IconRail.tsx (`<ul>` ~linha 84 e `<li>` ~linhas 103-246 com `<ul>`/`<li>` aninhados)
    - apps/frontend/src/components/layout/AppDrawer.tsx (`<ul>` ~linhas 74 e 186, `<li>` ~138-166)
    - apps/frontend/src/components/layout/SidebarNav.tsx
    - apps/frontend/src/components/layout/menu-config.ts
    - apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx
  </read_first>
  <behavior>
    - Vitest (`menu-dom.test.tsx`): renderizar `IconRail` e `AppDrawer` (dentro de `MemoryRouter`, com o store de autenticação de ADMIN como em `sidebar-nav.test.tsx`) com `vi.spyOn(console, 'error')` e afirmar que nenhuma chamada contém "validateDOMNesting" nem "cannot appear as a descendant of".
    - Vitest: nenhum `<li>` do menu tem outro `<li>` como filho direto (`container.querySelectorAll('li > li')` vazio) e todo `<li>` está dentro de `<ul>` ou `<ol>`.
  </behavior>
  <action>
1. Escrever o teste primeiro e ver o aviso falhar. Achar o aninhamento: em `IconRail.tsx` e `AppDrawer.tsx`, procurar `<li>` que contém `<li>` ou componente que renderiza `<li>` (por exemplo item de grupo renderizando outro item diretamente, sem `<ul>` no meio).
2. Corrigir a estrutura: o subitem fica em `<ul>` dentro do `<li>` pai (`<li><a/><ul><li/></ul></li>`), ou o componente filho passa a renderizar `<div>`/`<Link>` quando já estiver dentro de um `<li>`. Não mudar textos, ordem nem permissões do menu.
3. Este lote vem depois do 05-06b e do 05-07, que mexem em `menu-config.ts` e no roteador: ler o arquivo no estado atual antes de editar.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- menu-dom sidebar-nav && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `menu-dom.test.tsx` passa e falhava antes (aviso de aninhamento)
    - `sidebar-nav.test.tsx` continua passando
    - Console do navegador local sem "validateDOMNesting" ao abrir qualquer tela (conferir com Playwright `page.on("console")` em `ux-comanda-celular.spec.ts` ou no teste de fumaça)
  </acceptance_criteria>
  <done>Menu com HTML válido, sem aviso técnico no console (UX-10).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-12): comanda no celular e estrutura do menu (UX-09, UX-10)`, com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-09, UX-10 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-12): registra commit das correções UX-09, UX-10`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-12)` e citando UX-09, UX-10
    - Linhas UX-09, UX-10 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-12-SUMMARY.md`
</output>

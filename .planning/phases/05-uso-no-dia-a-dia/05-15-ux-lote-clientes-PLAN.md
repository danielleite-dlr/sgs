---
phase: 05-uso-no-dia-a-dia
plan: 15
type: execute
wave: 11
depends_on: ["05-07", "05-08", "05-14"]
files_modified:
  - apps/frontend/src/pages/ClientesPage.tsx
  - apps/frontend/src/components/ui/data-table.tsx
  - apps/frontend/src/pages/ClienteDetailPage.tsx
  - apps/frontend/src/features/operations/pages/ComandaPage.tsx
  - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
  - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
  - apps/frontend/src/pages/__tests__/clientes-page.test.tsx
  - apps/e2e/tests/ux-clientes-lista.spec.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "Na lista de clientes o nome é um link, a linha reage ao mouse, colunas vazias somem e o celular mostra cartões (UX-15)"
    - "Os nomes de cliente aparecem com a mesma caixa na lista, na ficha, na comanda, no financeiro e nos contratos (UX-16, parcial)"
  artifacts:
    - path: "apps/frontend/src/pages/__tests__/clientes-page.test.tsx"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-15-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Clientes. Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-15 Lista de clientes sem sinal de clicável e colunas cortadas no celular
- UX-16 Caixa dos nomes de cliente variando (só padronizar a exibição; aviso de duplicidade NÃO aprovado)

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-15-SUMMARY.md`.
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
  <name>Task 1: UX-15 Lista de clientes: nome como link, linha clicável, colunas vazias escondidas, cartões no celular</name>
  <files>apps/frontend/src/pages/ClientesPage.tsx, apps/frontend/src/components/ui/data-table.tsx, apps/frontend/src/pages/__tests__/clientes-page.test.tsx, apps/e2e/tests/ux-clientes-lista.spec.ts</files>
  <read_first>
    - apps/frontend/src/pages/ClientesPage.tsx (colunas, `EntityAvatar`, nome em `<span className="font-semibold">`, coluna "Ações" com `aria-label="Ações"`)
    - apps/frontend/src/components/ui/data-table.tsx
    - apps/frontend/src/components/ui/__tests__/data-table.test.tsx (o DataTable é compartilhado: qualquer opção nova é opcional e não muda os outros usos)
    - grep -rn "DataTable" apps/frontend/src --include=*.tsx -l (conferir os outros usos)
  </read_first>
  <behavior>
    - Vitest (`clientes-page.test.tsx`): o nome da cliente é um `<a href="/clientes/<id>">` (role link); a linha tem `cursor-pointer` e `hover:bg-neutral-50`.
    - Vitest: se todas as clientes carregadas têm e-mail vazio, a coluna "E-mail" não é renderizada (idem CPF); se pelo menos uma tem, a coluna aparece.
    - Vitest/Playwright (celular 412x915): abaixo de `md` a lista aparece como cartões (`data-testid="cliente-card"`) com nome, telefone e menu de ações, sem coluna cortada ("Aç") e sem rolagem horizontal.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. Em `ClientesPage.tsx`: trocar o `<span className="font-semibold">{r.fullName}</span>` por `<Link to={`/clientes/${r.id}`} className="font-semibold text-primary-700 hover:underline" onClick={(e) => e.stopPropagation()}>`. Dar à linha `cursor-pointer hover:bg-neutral-50` (via prop opcional `rowClassName` no `DataTable`, sem mudar o padrão dos outros usos).
3. Calcular `hasEmail`/`hasCpf` com `rows.some(...)` e montar o array de colunas sem as colunas totalmente vazias.
4. Abaixo de `md`: renderizar `<ul className="md:hidden space-y-sm">` de cartões (nome em link, telefone com `formatPhoneBr`, menu "Ações" no canto) e esconder a tabela com `hidden md:block`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- clientes-page data-table && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-clientes-lista.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "to={`/clientes/" apps/frontend/src/pages/ClientesPage.tsx` encontra o link no nome
    - `grep -n "cliente-card" apps/frontend/src/pages/ClientesPage.tsx` encontra os cartões do celular
    - `clientes-page.test.tsx`, `data-table.test.tsx` e o Playwright passam
  </acceptance_criteria>
  <done>Lista de clientes com nome clicável, sem colunas vazias e legível no celular (UX-15).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-16 (parcial) Nomes de cliente com caixa padronizada na exibição</name>
  <files>apps/frontend/src/pages/ClientesPage.tsx, apps/frontend/src/pages/ClienteDetailPage.tsx, apps/frontend/src/features/operations/pages/ComandaPage.tsx, apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/features/bridal/pages/ContractsPage.tsx, apps/frontend/src/lib/__tests__/format-name.test.ts, apps/frontend/src/pages/__tests__/clientes-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/lib/format-name.ts (`toDisplayName`, criado pelo lote 05-11)
    - apps/frontend/src/pages/ClientesPage.tsx
    - apps/frontend/src/pages/ClienteDetailPage.tsx
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx (coluna Cliente: `mv.clientName`)
    - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
    - grep -rn "fullName\|clientName" apps/frontend/src --include=*.tsx | grep -v __tests__ (listar onde o nome de cliente é exibido)
  </read_first>
  <behavior>
    - Vitest (`clientes-page.test.tsx`): clientes "MARIA SILVA" e "maria silva" aparecem os dois como "Maria Silva" na lista.
    - Vitest: a ficha da cliente, o cartão "Cliente" da comanda, a coluna Cliente do Financeiro e a lista de contratos exibem `toDisplayName(nome)`.
    - Escopo: só a EXIBIÇÃO muda. Nada é regravado no banco e a busca continua funcionando com o texto digitado em qualquer caixa. O aviso de cadastro duplicado NÃO faz parte deste lote (não aprovado; backlog 999.6).
  </behavior>
  <action>
1. Estender os testes acima (falham antes).
2. Aplicar `toDisplayName` de `@/lib/format-name` em todos os pontos de exibição do nome da CLIENTE (não de profissionais): `ClientesPage.tsx` (nome no link, no cartão do celular e na confirmação de exclusão), `ClienteDetailPage.tsx` (título), `ComandaPage.tsx` (cartão Cliente; a lista de comandas já usa desde o 05-11), `FinanceiroPage.tsx` (`mv.clientName`), `ContractsPage.tsx` (coluna da cliente).
3. Não alterar a mutação de salvar cliente nem o backend.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- format-name clientes-page comanda-page financeiro-page contracts-page && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rln "toDisplayName" apps/frontend/src/pages/ClientesPage.tsx apps/frontend/src/pages/ClienteDetailPage.tsx apps/frontend/src/features/operations/pages/ComandaPage.tsx apps/frontend/src/features/operations/pages/FinanceiroPage.tsx apps/frontend/src/features/bridal/pages/ContractsPage.tsx` lista os 5 arquivos
    - `clientes-page.test.tsx` mostra "Maria Silva" para as duas grafias
    - `comanda-page.test.tsx`, `financeiro-page.test.tsx` e `contracts-page.test.tsx` continuam passando
  </acceptance_criteria>
  <done>Nomes de cliente aparecem com a mesma caixa em todo lugar (UX-16, só padronização).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-15): clientes: lista clicável e nomes padronizados (UX-15, UX-16)`, com o trailer `Co-Authored-By` que o ambiente indicar.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-15, UX-16 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-15): registra commit das correções UX-15, UX-16`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-15)` e citando UX-15, UX-16
    - Linhas UX-15, UX-16 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-15-SUMMARY.md`
</output>

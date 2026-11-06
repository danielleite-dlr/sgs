---
phase: 05-uso-no-dia-a-dia
plan: 16
type: execute
wave: 12
depends_on: ["05-07", "05-08", "05-15"]
files_modified:
  - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
  - apps/frontend/src/pages/ClientesPage.tsx
  - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
  - apps/frontend/src/pages/__tests__/clientes-page.test.tsx
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "A coluna Tipo do Financeiro mostra "Entrada de contrato" em vez de "contract_in" (UX-17)"
    - "Cada cartão do topo do Financeiro tem uma frase de apoio que explica o número (UX-18)"
    - "Os botões de ações são maiores e o filtro de período fica junto do agrupamento Dia/Semana/Mês (UX-19)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-16-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Financeiro e botões de ação (último lote). Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-17 "contract_in" (código interno) na coluna Tipo do Financeiro
- UX-18 Cartões do topo do Financeiro sem explicação
- UX-19 Botão de ações minúsculo e filtros de período longe do agrupamento

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-16-SUMMARY.md`.
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
  <name>Task 1: UX-17 Tipo de lançamento em português e UX-18 cartões do topo que se explicam</name>
  <files>apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx (`KIND_LABELS` ~linha 37, coluna Tipo ~linha 282, cartões Faturado/Recebido/Comandas fechadas/Ticket médio ~linhas 160-190)
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
    - apps/backend/src/financial/cash-ledger.ts (valores de `kind`: deposit_in, payment_in, change_out, reversal, contract_in)
    - apps/backend/src/financial (resolver do resumo: o que entra em billed, received, comandas fechadas e ticket médio)
  </read_first>
  <behavior>
    - Vitest: um lançamento com `kind: 'contract_in'` mostra "Entrada de contrato" na coluna Tipo; um `kind` desconhecido mostra "Outro lançamento" (nunca o código interno).
    - Vitest: cada cartão tem um texto de apoio (`data-testid="card-hint-faturado"`, `card-hint-recebido"`, `card-hint-comandas"`) em português; "Comandas fechadas" aparece como "Comandas fechadas (sem contratos)" e o apoio de "Recebido" diz que inclui sinais, parcelas de contrato e pagamentos e desconta estornos e troco.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. UX-17: em `KIND_LABELS` acrescentar `contract_in: 'Entrada de contrato'` e usar o fallback `KIND_LABELS[mv.kind] ?? 'Outro lançamento'`.
3. UX-18: ler o resolver do resumo no backend para confirmar o que cada total soma e escrever os textos de apoio exatamente conforme o código (rascunho, a ser ajustado ao que o backend faz): Faturado = "Valor dos contratos e das comandas fechados no período."; Recebido = "Dinheiro que entrou no período: sinais, parcelas de contrato e pagamentos, menos estornos e troco. Pode ser diferente do faturado."; Comandas fechadas = "Só comandas de serviço; os contratos aparecem em Faturado."; Ticket médio = "Faturado das comandas dividido pelas comandas fechadas." Exibir como `<p className="text-xs text-neutral-600">` abaixo do valor em cada cartão (legível, não miúdo demais: `text-xs` mínimo, nunca menor que 12 px). Se o backend somar diferente do rascunho, o texto segue o backend.
4. Substituir a frase miúda antiga que explicava só o faturado por esses textos.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- financeiro-page && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "contract_in" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` encontra o rótulo "Entrada de contrato"
    - `grep -n "card-hint-" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` encontra os 3 textos de apoio
    - `financeiro-page.test.tsx` passa e falhava antes
  </acceptance_criteria>
  <done>Tipos em português e cartões do Financeiro que explicam seus números (UX-17, UX-18).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-19 Botão de ações maior com rótulo acessível e filtros de período e agrupamento juntos</name>
  <files>apps/frontend/src/pages/ClientesPage.tsx, apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/pages/__tests__/clientes-page.test.tsx, apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/pages/ClientesPage.tsx (DropdownMenuTrigger com `Button variant="ghost" size="icon" aria-label="Ações"`)
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx (filtro de período e grupo Dia/Semana/Mês)
    - apps/frontend/src/components/layout/FilterBar.tsx
    - apps/frontend/src/features/operations/__tests__/period-filter.test.tsx
  </read_first>
  <behavior>
    - Vitest (`clientes-page.test.tsx`): o botão de ações de cada cliente tem nome acessível "Ações de Maria Silva" (nome da cliente em caixa normal) e o ícone tem `h-5 w-5`; o botão tem pelo menos `h-11 w-11` (44 px).
    - Vitest (`financeiro-page.test.tsx`): o filtro de período e o seletor Dia/Semana/Mês ficam no mesmo container (`data-testid="financeiro-filtros"`), na mesma linha no computador e empilhados com espaçamento no celular.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. Em `ClientesPage.tsx` trocar `aria-label="Ações"` por `aria-label={`Ações de ${toDisplayName(r.fullName)}`}`, `size="icon"` com `className="h-11 w-11"` e o ícone `MoreHorizontal` com `h-5 w-5`. Este arquivo já foi alterado no lote 05-15: ler a versão atual antes de editar.
3. Em `FinanceiroPage.tsx` colocar o filtro de período e o grupo Dia/Semana/Mês dentro de um único `<div data-testid="financeiro-filtros" className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">`, com o grupo Dia/Semana/Mês logo ao lado do filtro de período no computador.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- clientes-page financeiro-page period-filter && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Ações de" apps/frontend/src/pages/ClientesPage.tsx` encontra o rótulo com o nome
    - `grep -n "financeiro-filtros" apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` encontra o container
    - `clientes-page.test.tsx`, `financeiro-page.test.tsx` e `period-filter.test.tsx` passam
  </acceptance_criteria>
  <done>Botões de ação legíveis e filtros do Financeiro agrupados (UX-19).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-16): financeiro: tipos em português, cartões explicados, ações e filtros (UX-17, UX-18, UX-19)`, com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-17, UX-18, UX-19 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-16): registra commit das correções UX-17, UX-18, UX-19`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-16)` e citando UX-17, UX-18, UX-19
    - Linhas UX-17, UX-18, UX-19 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-16-SUMMARY.md`
</output>

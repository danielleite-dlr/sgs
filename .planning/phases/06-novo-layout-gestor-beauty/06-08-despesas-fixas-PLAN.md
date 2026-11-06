---
phase: 06-novo-layout-gestor-beauty
plan: 08
type: execute
wave: 8
depends_on: ["06-07"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/despesas-fixas-computador.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/despesas-fixas-computador.png
  - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx
  - apps/frontend/src/features/operations/__tests__/despesas-fixas-gestor-beauty.test.tsx
  - apps/e2e/audit/telas.audit.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "A lista de despesas fixas é uma tabela com cabeçalho cinza claro em maiúsculas pequenas, valor tabular à direita sem quebra e 'dia N' tabular (06-UI-SPEC §4)"
    - "A situação aparece como selo com ponto: Ativa (verde) e Inativa (grafite) (D-11)"
    - "Os botões Editar/Desativar/Excluir têm 44 px e o formulário de despesa usa rótulos em maiúsculas pequenas acima do campo (D-10, D-13)"
    - "No topo há um resumo com o total mensal das despesas ativas, calculado da lista já carregada; nada de categoria, centro de custo ou anexo (D-02)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/despesas-fixas-gestor-beauty.test.tsx"
      provides: "Regressão visual de Despesas fixas"
    - path: "apps/e2e/audit/telas.audit.ts"
      contains: "18-financeiro-despesas-fixas"
  key_links:
    - from: "apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx"
      to: "fixed-expenses-total"
      via: "soma dos valores das despesas ativas da lista carregada (sem consulta nova)"
      pattern: "fixed-expenses-total"
---

<objective>
Lote de tela 6 (D-03): Despesas fixas seguindo a tela Stitch "Despesas fixas (computador)" (`3a05c509377a41b3ab728925631a9170`; não há versão de celular no projeto — no celular a tabela rola na horizontal, como hoje), com D-21. Só visual (D-01): criar, editar, ativar/desativar e excluir continuam iguais.

Entra (dado pronto, sem consulta nova): total mensal das despesas ativas somado no cliente a partir da lista já carregada.
Omitir (D-02): categorias, centro de custo, fornecedor, anexos/comprovantes, recorrência diferente de mensal, status de pago no mês, "Exportar", meta, seletor de unidade.

Purpose: cadastro de contas do mês no padrão novo.
Output: tela redesenhada, slug de screenshot, deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-07-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; aspas simples.
- `fixed-expenses-page.test.tsx` usa `getByText('R$ 1.500,00')`, `getByText('Internet')`, `getByText('dia 10')` e botões "Nova despesa fixa", "Salvar", "Excluir Aluguel": não renderizar a mesma linha duas vezes (sem cartões duplicados no celular) e manter textos e nomes acessíveis. Se o total mensal coincidir com o valor de uma única despesa na fixture (ex.: só uma ativa de R$ 1.500,00), ajustar o teste para buscar o valor dentro de `fixed-expenses-table` com `within` — mesma verificação, só com escopo.
- Somar dinheiro com o helper de `features/operations/lib/money.ts` (não somar float solto); helper novo, se precisar, em `lib/*.ts`.
</armadilhas>

<interfaces>
`DespesasFixasPage.tsx` (411 linhas): formulário em diálogo (~linhas 120-200, erros `role="alert" text-xs text-error-600`), `PageHeader` "Despesas fixas" com cta "Nova despesa fixa" (~285), texto `-mt-sm mb-lg text-sm text-neutral-600`, estados sem acesso/carregando/erro/vazio, tabela crua `fixed-expenses-table` (Nome, Valor, Vence todo dia, Situação, Ações) com `Badge variant={e.active ? 'success' : 'secondary'}` e botões Editar/Ativar-Desativar/Excluir `size="sm"`.
`features/operations/lib/money.ts` (somas em centavos; ver o arquivo).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referência do Stitch, slug de auditoria e Despesas fixas no layout novo</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/despesas-fixas-computador.html, .planning/phases/06-novo-layout-gestor-beauty/design/despesas-fixas-computador.png, apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx, apps/frontend/src/features/operations/__tests__/despesas-fixas-gestor-beauty.test.tsx, apps/e2e/audit/telas.audit.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx (inteiro)
    - apps/frontend/src/features/operations/__tests__/fixed-expenses-page.test.tsx
    - apps/frontend/src/features/operations/lib/money.ts
    - apps/e2e/audit/telas.audit.ts (teste `17-financeiro-previsao` do 06-07 como modelo)
  </read_first>
  <behavior>
    - `despesas-fixas-gestor-beauty.test.tsx`:
      - `data-testid="fixed-expenses-total"` mostra a soma das despesas ativas (ex.: Aluguel R$ 1.500,00 ativa + Internet R$ 120,00 ativa + uma inativa → "R$ 1.620,00") em `tabular-nums`, com rótulo "TOTAL MENSAL (ATIVAS)" escrito como "Total mensal (ativas)" com classe `uppercase`.
      - `fixed-expenses-table`: `th` com `text-overline uppercase text-neutral-500` e `thead` `bg-neutral-100`; célula de valor `text-right tabular-nums whitespace-nowrap`; célula "dia N" `tabular-nums`.
      - Situação: ativa → `Badge` com `before:bg-success-500` e texto "Ativa"; inativa → `before:bg-status-done` e "Inativa".
      - Botões de ação da linha têm `min-h-[44px]` (sem `size="sm"`); nomes acessíveis atuais ("Excluir Aluguel" etc.).
      - No diálogo, os rótulos dos campos têm `text-overline uppercase text-neutral-500` e os erros `text-[12px] text-error-600`.
    - `fixed-expenses-page.test.tsx` continua passando.
  </behavior>
  <action>
1. Baixar com o MCP do Stitch (`mcp__stitch__download_file`): `projects/5888991241990799272/screens/3a05c509377a41b3ab728925631a9170/fileEntries/html` → `design/despesas-fixas-computador.html` e `…/fileEntries/screenshot` → `design/despesas-fixas-computador.png`. Abrir o PNG; listar os blocos omitidos (D-02) para o SUMMARY.
2. `telas.audit.ts`: acrescentar `test('18-financeiro-despesas-fixas', …)` com `go(page, '/financeiro/despesas-fixas')` e `shoot(…, '18-financeiro-despesas-fixas', t)`.
3. Escrever `despesas-fixas-gestor-beauty.test.tsx` (falha antes).
4. `DespesasFixasPage.tsx`:
   - Texto de apoio `text-body text-neutral-500` (sem `-mt-sm`).
   - Resumo antes da tabela (só com lista não vazia): `<div className="flex items-baseline justify-between gap-sm rounded-md border border-neutral-200 bg-white p-sm"><p className="text-overline uppercase text-neutral-500">Total mensal (ativas)</p><p data-testid="fixed-expenses-total" className="text-[20px] leading-7 font-semibold tabular-nums whitespace-nowrap text-error-500">…</p></div>` (saída = vermelho, D-12).
   - Tabela: `thead className="bg-neutral-100"`, `th className="px-sm py-xs text-left text-overline uppercase text-neutral-500"` (Valor `text-right`), `tr` `border-t border-neutral-200`, `td` `px-sm py-sm text-body`, Nome `font-medium text-neutral-800`, Valor `text-right tabular-nums whitespace-nowrap`, "dia N" `tabular-nums text-neutral-500`; tabela com `min-w-[640px]` dentro do `overflow-x-auto rounded-md border border-neutral-200 bg-white` (celular rola na horizontal).
   - Situação: `Badge variant={e.active ? 'success' : 'neutral'}`.
   - Ações: `Button variant="outline"` no tamanho padrão (tirar `size="sm"`), Excluir `variant="ghost"` com `text-error-600`; manter `aria-label`.
   - Estados vazio/sem acesso/erro: `rounded-md border border-neutral-200 bg-white p-md text-body text-neutral-500`; "Tentar novamente" sem `size="sm"`.
   - Diálogo: rótulos com `FIELD_LABEL_CLASS` (ou o `Label` padrão), erros `text-[12px] leading-4 font-semibold text-error-600`, campo de valor com `tabular-nums`, rodapé com "Cancelar" outline e "Salvar" padrão.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `design/despesas-fixas-computador.html` e `.png` existem
    - `grep -n "fixed-expenses-total" apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx` encontra o resumo
    - `grep -n "size=\"sm\"" apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx` não encontra nada
    - `grep -n "18-financeiro-despesas-fixas" apps/e2e/audit/telas.audit.ts` encontra o teste
    - `despesas-fixas-gestor-beauty.test.tsx` e `fixed-expenses-page.test.tsx` passam
  </acceptance_criteria>
  <done>Despesas fixas no padrão Gestor Beauty, com total mensal das ativas.</done>
</task>

<task type="auto">
  <name>Task 2: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-08-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
  </read_first>
  <action>
1. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir. Falha antiga em arquivo não tocado: `deferred-items.md`.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-08 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "18-financeiro-despesas-fixas"`. Abrir `desktop/18-financeiro-despesas-fixas.png` e `mobile/18-financeiro-despesas-fixas.png` ao lado de `design/despesas-fixas-computador.png`; registrar `## Comparação com o Stitch` (bloco | como ficou | omitido por D-02?) e corrigir divergência dentro do escopo.
3. Commit (arquivos um a um): `feat(06-08): despesas fixas no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
5. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-08)` em `origin/master`
    - `06-08-SUMMARY.md` tem `## Comparação com o Stitch`; deploy sem erro; CI verde
  </acceptance_criteria>
  <done>Despesas fixas no staging com CI verde.</done>
</task>

</tasks>

<verification>
- Testes de despesas fixas verdes; gate, comparação, deploy e CI verdes
</verification>

<success_criteria>
Lote Despesas fixas entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-08-SUMMARY.md`
</output>

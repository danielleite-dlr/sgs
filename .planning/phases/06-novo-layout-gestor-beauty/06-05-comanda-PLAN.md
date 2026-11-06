---
phase: 06-novo-layout-gestor-beauty
plan: 05
type: execute
wave: 5
depends_on: ["06-04"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/comanda-computador.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/comanda-computador.png
  - .planning/phases/06-novo-layout-gestor-beauty/design/comanda-celular.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/comanda-celular.png
  - apps/frontend/src/features/operations/pages/ComandaPage.tsx
  - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
  - apps/frontend/src/features/operations/__tests__/comanda-gestor-beauty.test.tsx
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "O título da comanda continua 'Comanda C-…' em serifa e o status aparece como selo com ponto colorido (D-11)"
    - "O cartão da cliente começa pelo nome em serifa (toDisplayName) com telefone formatado; os itens mostram nome, profissional/quantidade em texto secundário e valor à direita sem quebrar (UX-08, UX-09, D-07)"
    - "O resumo de pagamento lista Total, Pago, Falta e Troco em linhas com divisor fino e valores tabulares; 'Fechar comanda' é o botão roxo cheio de 44 px (UX-06, D-06)"
    - "Cartões brancos com borda, sem sombra; nada de bancada/cadeira, unidade ou 'Sincronizado' (D-02)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/comanda-gestor-beauty.test.tsx"
      provides: "Regressão visual da comanda"
  key_links:
    - from: "apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx"
      to: "apps/frontend/src/features/operations/__tests__/ux-comanda-lote1.test.tsx"
      via: "comanda-close mantém bg-primary text-white disabled:opacity-100 (UX-06)"
      pattern: "comanda-close"
---

<objective>
Lote de tela 3 (D-03): detalhe da Comanda, seguindo as telas Stitch "Comanda C-2026-014" computador (`4f842ca8578c4861849f5e9fc789dcac`) e celular (`69b81c7989b94f3db4ef6fd602feccda`), com D-21. Só visual (D-01): adicionar item, pagamento, crédito, fechar e reabrir funcionam como hoje; `data-testid` e papéis ARIA ficam.

Omitir (D-02): bancada/cadeira/sala, seletor de unidade, "Sincronizado", relógio, assinatura ou qualquer bloco do design sem campo correspondente na consulta da comanda (o executor lista no SUMMARY cada bloco omitido).

Purpose: fechar comanda e receber com a cara nova.
Output: comanda redesenhada, testes, deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-04-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; aspas simples nestes arquivos.
- Regressões da fase 5 que valem aqui: UX-06 (`ux-comanda-lote1.test.tsx`: `comanda-close` com `bg-primary`, `text-white`, `disabled:opacity-100` e motivo `close-blocked-reason`), UX-08 (cartão da cliente sem a linha do código, telefone `(11) 98888-7777`), UX-09 (`ux-comanda-lote2.test.tsx`: `comanda-adicionar` `lg:col-start-1`, `comanda-itens` `lg:col-start-2`, nome do item `min-w-0 break-words` dentro de `min-w-0 flex-1`, valores `shrink-0 whitespace-nowrap`; E2E `ux-comanda-celular.spec.ts`: nome do item em ≤ 2 linhas e ordem no celular).
- `innerText` aplica `text-transform`: E2E com `innerText` (ex.: `fluxo-agendamento-comanda-pagamento.spec.ts` `normalizeSpaces(innerText)`) — não colocar `uppercase` em textos que esses testes leem (valores, nomes, linhas do resumo).
- Helpers novos em `src/lib/*.ts` ou `features/operations/lib/*.ts`, nunca exportados de `.tsx`.
</armadilhas>

<interfaces>
`ComandaPage.tsx` (461 linhas): `PageHeader` (~160) com `comanda-reopen`; grid `grid grid-cols-1 gap-md lg:grid-cols-3 lg:grid-rows-[auto_1fr]` (~183); `comanda-cliente` > `Card comanda-client-card` com `CardTitle className="text-base …"`, `comanda-client-credit`, `comanda-status`; `comanda-itens` > Card com `comanda-item-<id>`, `comanda-item-name-<id>`, `item-contract-<id>`, `comanda-item-valores-<id>`, `comanda-covered`; `comanda-adicionar` com `comanda-add-service|product|package`; `comanda-commissions` com `comanda-commission-warning`.
`PaymentPanel.tsx` (293 linhas): `payment-panel`, `payment-row-<id>`, `payment-use-credit`, `payment-method-select`, `payment-amount`, `payment-add`, `payment-covered`, `payment-nothing-due`, `dl` com `payment-total`, `payment-paid`, `payment-remaining`, `payment-change` (`text-success-700` quando > 0), `payment-error`, `comanda-close`, `close-blocked-reason`.
Selo de status: `Badge` com variants `success | warning | error | info | neutral` (ponto de 6 px, 06-01).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referências do Stitch e detalhe da comanda (cabeçalho, cliente, itens, comissões)</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/comanda-computador.html, .planning/phases/06-novo-layout-gestor-beauty/design/comanda-computador.png, .planning/phases/06-novo-layout-gestor-beauty/design/comanda-celular.html, .planning/phases/06-novo-layout-gestor-beauty/design/comanda-celular.png, apps/frontend/src/features/operations/pages/ComandaPage.tsx, apps/frontend/src/features/operations/__tests__/comanda-gestor-beauty.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx (inteiro)
    - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx, ux-comanda-lote1.test.tsx, ux-comanda-lote2.test.tsx, comanda-fixtures.ts
    - apps/e2e/tests/ux-comanda-celular.spec.ts e ux-comanda-lista.spec.ts
    - .planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md §4 (Cartão, Badge, Tabela)
  </read_first>
  <behavior>
    - `comanda-gestor-beauty.test.tsx` (fixture de `comanda-fixtures.ts`):
      - O `h1` é "Comanda C-2026-001" (texto igual ao de hoje).
      - `comanda-status` é um selo (`Badge`) com ponto: aberta → variant `info`, fechada → `success`, cancelada → `error` (classes `before:bg-info-500` / `before:bg-success-500` / `before:bg-error-500`).
      - O nome da cliente no `comanda-client-card` tem `font-serif` e aparece com `toDisplayName` ("MARIA SILVA" → "Maria Silva").
      - Cada `comanda-item-valores-<id>` tem `tabular-nums` além de `shrink-0 whitespace-nowrap`; a linha do item tem divisor `border-b border-neutral-200` (menos a última).
      - Os títulos dos cartões ("Cliente", "Itens da comanda", "Adicionar à comanda", comissões) são `h2` com `font-serif text-headline-sm`; nenhum cartão tem `shadow`.
    - `ux-comanda-lote1.test.tsx` e `ux-comanda-lote2.test.tsx` continuam passando sem alteração.
  </behavior>
  <action>
1. Baixar as referências com o MCP do Stitch e salvar em `.planning/phases/06-novo-layout-gestor-beauty/design/`: `mcp__stitch__download_file` com `name` `projects/5888991241990799272/screens/4f842ca8578c4861849f5e9fc789dcac/fileEntries/html` → `comanda-computador.html`, `…/4f842ca8578c4861849f5e9fc789dcac/fileEntries/screenshot` → `comanda-computador.png`, `…/69b81c7989b94f3db4ef6fd602feccda/fileEntries/html` → `comanda-celular.html`, `…/69b81c7989b94f3db4ef6fd602feccda/fileEntries/screenshot` → `comanda-celular.png`. Abrir os PNGs e ler a estrutura dos HTMLs (só referência; não copiar o Tailwind CDN nem Material Symbols, D-18: ícones lucide equivalentes). Listar os blocos do design sem dado no SGS (D-02) para o SUMMARY.
2. Escrever `comanda-gestor-beauty.test.tsx` (falha antes).
3. `ComandaPage.tsx`:
   - Título: manter `title={`Comanda ${comanda.code}`}` no `PageHeader` (o h1 já sai em serifa pelo 06-02; `fluxo-agendamento-comanda-pagamento.spec.ts:80` lê o código do h1 com `innerText`). Não mudar a API do `PageHeader` neste lote.
   - `comanda-status`: `Badge` com variant por status (`open` → `info`, `closed` → `success`, `cancelled` → `error`, outros → `neutral`) e o rótulo em português atual.
   - Cartões: `Card className="max-w-none"` (largura total da coluna), `CardHeader className="pb-sm"`, `CardTitle` como `h2` com `font-serif text-headline-sm text-neutral-800` (tirar `text-base`); ícones do título lucide `h-4 w-4 text-neutral-500`.
   - Cliente: nome em `font-serif text-[17px] font-semibold leading-6 text-neutral-800` com `toDisplayName`; telefone (já formatado, UX-08) e crédito em `text-body text-neutral-500 tabular-nums`.
   - Itens: cada `comanda-item-<id>` `flex items-start gap-sm py-sm border-b border-neutral-200 last:border-b-0`; nome `text-body font-medium text-neutral-800` (mantendo `min-w-0 break-words` e o pai `min-w-0 flex-1`); profissional/quantidade/variação em `text-[12px] leading-4 text-neutral-500`; `item-contract-*` como `Badge variant="outline"`; valores `shrink-0 whitespace-nowrap tabular-nums text-body font-semibold text-neutral-800`, desconto em `text-[12px] text-neutral-500`.
   - "Adicionar à comanda": botões `comanda-add-*` `variant="outline"` com ícone lucide e `min-h-[44px] justify-start`.
   - Comissões: tabela simples com cabeçalho `bg-neutral-100 text-overline uppercase text-neutral-500` e valores `tabular-nums text-right`; `comanda-commission-warning` com `Alert variant="warning"`.
   - Manter `lg:col-start-*`/`lg:row-start-*` e a ordem do celular da fase 5.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Os 4 arquivos `design/comanda-computador.html|png` e `design/comanda-celular.html|png` existem
    - `grep -n "font-serif" apps/frontend/src/features/operations/pages/ComandaPage.tsx` encontra o nome da cliente e os títulos
    - `grep -n "text-base" apps/frontend/src/features/operations/pages/ComandaPage.tsx` não encontra nada
    - `comanda-gestor-beauty.test.tsx`, `comanda-page.test.tsx`, `ux-comanda-lote1.test.tsx` e `ux-comanda-lote2.test.tsx` passam
  </acceptance_criteria>
  <done>Cabeçalho, cliente, itens e comissões da comanda no padrão Gestor Beauty.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Painel de pagamento no padrão Gestor Beauty</name>
  <files>apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx, apps/frontend/src/features/operations/__tests__/comanda-gestor-beauty.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
    - apps/frontend/src/features/operations/__tests__/payment-panel.test.tsx e ux-comanda-lote1.test.tsx
    - .planning/phases/06-novo-layout-gestor-beauty/design/comanda-computador.png e comanda-celular.png
  </read_first>
  <behavior>
    - `comanda-gestor-beauty.test.tsx` (acrescentar): `payment-total`, `payment-paid`, `payment-remaining` e `payment-change` têm `tabular-nums` e `whitespace-nowrap`; cada linha do `dl` tem `border-b border-neutral-200` (menos a última); `payment-remaining` com valor > 0 fica `text-neutral-800 font-semibold` e a linha "Falta" tem rótulo `text-overline uppercase`; `payment-change` > 0 fica `text-success-500`.
    - Cada `payment-row-<id>` mostra o método em `text-body` e o valor `tabular-nums` à direita; o botão de remover tem `h-11 w-11`.
    - `comanda-close` mantém `bg-primary text-white disabled:opacity-100` e ocupa a largura (`w-full`, `min-h-[44px]`).
    - `payment-panel.test.tsx` continua passando.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
2. `PaymentPanel.tsx`: `Card className="max-w-none"`, `CardTitle` "Pagamento" com `font-serif text-headline-sm` (tirar `text-base`). Linhas de pagamento `flex items-center justify-between gap-sm py-sm border-b border-neutral-200 last:border-b-0`, valor `tabular-nums whitespace-nowrap`, remover `Button variant="ghost" size="icon"` (`h-11 w-11`). Campos de método e valor: `payment-method-select` e `payment-amount` com rótulos `FIELD_LABEL_CLASS`, grade `grid grid-cols-1 sm:grid-cols-2 gap-sm`; `payment-add` `variant="outline"` `min-h-[44px]`. Resumo `dl` com `divide-y`-equivalente por linha: `<div className="flex items-baseline justify-between py-sm border-b border-neutral-200 last:border-b-0"><dt className="text-overline uppercase text-neutral-500">Total</dt><dd data-testid="payment-total" className="tabular-nums whitespace-nowrap font-semibold text-neutral-800">…</dd></div>` (idem Pago, Falta, Troco; Troco > 0 `text-success-500`). `payment-covered`/`payment-nothing-due` em `text-body`. `comanda-close` `className="w-full min-h-[44px] …"` mantendo as classes testadas pelo UX-06; `close-blocked-reason` `text-[12px] text-neutral-500`. `payment-error` `text-[12px] font-semibold text-error-600`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "tabular-nums" apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx` ≥ 5
    - `grep -n "text-base" apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx` não encontra nada
    - `payment-panel.test.tsx`, `ux-comanda-lote1.test.tsx` e `comanda-gestor-beauty.test.tsx` passam
  </acceptance_criteria>
  <done>Pagamento com resumo tabular e "Fechar comanda" forte (UX-06 preservado).</done>
</task>

<task type="auto">
  <name>Task 3: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-05-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/audit/telas.audit.ts (slugs `05-comanda-lista` e `06-comanda-detalhe`)
  </read_first>
  <action>
1. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir (só seletor de estilo; `data-testid`/ARIA ficam). Falha antiga em arquivo não tocado: `deferred-items.md`.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-05 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "06-comanda-detalhe"`. Abrir `desktop/06-comanda-detalhe.png` e `mobile/06-comanda-detalhe.png` ao lado de `design/comanda-computador.png` e `design/comanda-celular.png`; registrar `## Comparação com o Stitch` (bloco | como ficou | omitido por D-02?) e corrigir divergência dentro do escopo.
3. Commit (arquivos um a um, inclusive os 4 arquivos de `design/`): `feat(06-05): comanda no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
5. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-05)` em `origin/master`
    - `06-05-SUMMARY.md` tem `## Comparação com o Stitch` com os blocos omitidos por D-02
    - Deploy sem erro e CI verde
  </acceptance_criteria>
  <done>Comanda no staging com CI verde.</done>
</task>

</tasks>

<verification>
- UX-06, UX-07, UX-08 e UX-09 seguem verdes; gate, comparação, deploy e CI verdes
</verification>

<success_criteria>
Lote Comanda entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-05-SUMMARY.md`
</output>

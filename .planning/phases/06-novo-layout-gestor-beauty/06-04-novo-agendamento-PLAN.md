---
phase: 06-novo-layout-gestor-beauty
plan: 04
type: execute
wave: 4
depends_on: ["06-03"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-celular.png
  - .planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-computador.png
  - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
  - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx
  - apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx
  - apps/e2e/support/agenda-ui.ts
  - apps/e2e/tests/agenda-concorrencia.spec.ts
  - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
  - apps/e2e/audit/fluxos-escrita.audit.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "O formulário de agendamento tem rótulos em maiúsculas pequenas acima de cada campo, título em serifa e um único botão de fechar de 44 px (D-13, D-20, UX-04)"
    - "Os serviços escolhidos aparecem como chips com nome e preço, com contagem 'N selecionado(s)' e o chip 'Adicionar serviço' (D-20)"
    - "Com até 4 profissionais, a escolha de profissional é um controle segmentado de 44 px com o selecionado em roxo e texto branco; com mais de 4, continua o select (D-20, D-06)"
    - "Data, Hora e Duração ficam na mesma linha; o erro de conflito aparece escrito logo abaixo da linha do serviço (D-20)"
    - "A seção 'Sinal' começa recolhida e abre com um toque; 'Salvar' fica no rodapé, sempre visível (D-20, UX-03)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx"
      provides: "Regressão visual do novo agendamento"
    - path: "apps/e2e/support/agenda-ui.ts"
      provides: "pickProfessional(page, line, id) e openDeposit(page) para os E2E"
      exports: ["pickProfessional", "openDeposit"]
  key_links:
    - from: "apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts"
      to: "apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx"
      via: "pickProfessional funciona com select (>4) e com o controle segmentado (<=4)"
      pattern: "pickProfessional"
---

<objective>
Lote de tela 2 (D-03): Novo agendamento (diálogo no computador, folha no celular) seguindo as telas Stitch "Novo agendamento (celular)" (`e940967ef5b64f81a360c2b0221ec9f7`) e "(computador)" (`146f645a9e0a4f46a2e8ac2c1ce13229`), com D-20. Só visual e organização: as mutations, validações, cálculo de duração, cadastro rápido de cliente, pacote e sinal continuam iguais.

Omitir (D-02): bancada/cadeira/sala, "Preparação", cerimonial, "Online/Sincronizado", qualquer campo do design sem campo no SGS. O título continua "Cadastrar agendamento" (testes UX-04 usam esse texto).

Purpose: marcar horário, a tarefa mais frequente, com a cara nova e sem perder UX-03/UX-04.
Output: formulário redesenhado, E2E adaptados ao controle segmentado e à seção Sinal recolhida, deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-03-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; `VisitFormDialog.tsx` usa aspas simples.
- Regressões da fase 5 desta tela: UX-03 (`visit-form-scroll.test.tsx` espera `h-[100dvh] sm:h-auto sm:max-h-[90vh]` no `visit-form`, aviso `visit-scroll-hint` "Role para ver mais campos"; E2E `ux-agenda-celular.spec.ts` exige corpo ≥ 60% de 915 px, largura ≥ 400 px e `visit-submit` no viewport), UX-04 (um único botão "Fechar"), UX-01 (`visit-submit` com texto branco sobre roxo, E2E `ux-contraste.spec.ts`).
- Playwright: medições dentro do Dialog só depois da animação terminar (`getAnimations()` finished); `getByText` sem `exact` não diferencia maiúsculas.
- `data-testid` existentes ficam todos: `visit-form`, `visit-form-body`, `visit-client-search`, `visit-client-option-*`, `visit-new-client*`, `visit-date`, `visit-package`, `visit-line-N-service|variant|professional|time|duration`, `visit-add-line`, `visit-deposit-amount`, `visit-deposit-method`, `visit-notes`, `visit-error`, `visit-scroll-hint`, `visit-submit`.
</armadilhas>

<interfaces>
`VisitFormDialog.tsx` (772 linhas): `LABEL_CLASS = 'text-xs font-semibold text-neutral-700'` (linha 63), `SELECT_CLASS` (já usa `NATIVE_SELECT_CLASS` desde o 06-01); componente de linha de serviço (~linhas 120-255) com grid `sm:grid-cols-[1fr_96px_96px_auto]` para profissional/hora/duração/remover; `DialogContent` linha ~461 com `max-w-[720px] p-0 … h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg flex flex-col`; header ~465 `bg-neutral-50` com `DialogTitle` `uppercase`; data + pacote em `grid sm:grid-cols-2` (~611); `fieldset` "Sinal recebido (opcional)" (~682); `visit-error` (~745) no fim do corpo; footer ~761 `bg-neutral-50` com `visit-submit` `size="sm"`.
E2E que escolhem profissional com `selectOption`: `agenda-concorrencia.spec.ts:65`, `fluxo-agendamento-comanda-pagamento.spec.ts:65`, `audit/fluxos-escrita.audit.ts:85`; o fluxo também preenche `visit-deposit-amount` (linha 66) e `visit-deposit-method` (68).
`FIELD_LABEL_CLASS` em `src/lib/field-classes.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referências do Stitch e formulário de agendamento no layout Gestor Beauty</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-celular.png, .planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-computador.png, apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx, apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx, apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx</files>
  <read_first>
    - .planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-mobile.html e novo-agendamento-desktop.html (rótulos, chips h-[34px], segmentado grid-cols-2 h-[36px] dentro de p-1, grid-cols-12 Data/Hora/Duração)
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx (inteiro)
    - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx, visit-form-scroll.test.tsx, ux-agenda-lote1.test.tsx, visit-form.test.ts
    - apps/frontend/src/lib/field-classes.ts
  </read_first>
  <behavior>
    - `novo-agendamento-gestor-beauty.test.tsx`:
      - O `DialogTitle` "Cadastrar agendamento" tem `font-serif text-headline-md` e não tem `uppercase`; existe exatamente um botão "Fechar" (UX-04).
      - Todo `<label>` de campo do formulário tem `text-overline uppercase text-neutral-500`.
      - Com 1 serviço escolhido, `data-testid="visit-service-chips"` mostra um chip com o nome e o preço em `tabular-nums` e o texto "1 selecionado"; com 2, "2 selecionados"; o botão `visit-add-line` fica dentro dessa faixa e tem `min-h-[44px]`.
      - Com 2 profissionais disponíveis, `visit-line-0-professional` tem `role="radiogroup"` e cada opção `visit-line-0-professional-<id>` tem `role="radio"`, `min-h-[44px]`; a marcada tem `aria-checked="true"`, `bg-primary text-white`; clicar troca a seleção. Com 5 profissionais, `visit-line-0-professional` é um `<select>`.
      - Teclado do grupo de rádio (padrão WAI-ARIA radiogroup, WCAG 2.1 AA): o grupo tem `aria-label="Profissional"`; só a opção marcada tem `tabIndex=0` e as outras `tabIndex=-1` (sem nenhuma marcada, a primeira tem `0`); com o foco na opção 1 de 3, `ArrowRight` e `ArrowDown` marcam e focam a opção 2 (chama o mesmo handler de troca de profissional), `ArrowLeft` e `ArrowUp` voltam para a 1; na última, `ArrowRight` vai para a primeira (e `ArrowLeft` na primeira vai para a última); `Space` na opção focada a marca. Testar com `userEvent.keyboard('{ArrowRight}')` etc. e conferir `document.activeElement` e `aria-checked`.
      - `visit-date`, `visit-line-0-time` e `visit-line-0-duration` estão no mesmo contêiner `data-testid="visit-when"` com `grid-cols-12`.
      - `visit-error` fica logo depois do bloco de serviços (antes de "Sinal") e tem `role="alert"` e `text-error-600`.
      - Botão `visit-deposit-toggle` com `aria-expanded="false"` no início; `visit-deposit-amount` não está no documento até clicar; depois do clique aparece. Se o formulário abre com sinal já preenchido, a seção começa aberta.
      - `visit-submit` tem `bg-primary text-white` e `min-h-[44px]` (sem `size="sm"`).
    - `visit-form-dialog.test.tsx`: onde o teste troca o profissional com `fireEvent.change`/`userEvent.selectOptions` no select e o cenário tem ≤ 4 profissionais, passar a clicar na opção do controle segmentado; onde preenche o sinal, clicar antes em `visit-deposit-toggle`. O comportamento verificado (payload da mutation) não muda.
    - `visit-form-scroll.test.tsx` continua passando sem alteração.
  </behavior>
  <action>
1. Baixar as referências que faltam com o MCP do Stitch: `mcp__stitch__download_file` `name: projects/5888991241990799272/screens/e940967ef5b64f81a360c2b0221ec9f7/fileEntries/screenshot` → `design/novo-agendamento-celular.png`; `projects/5888991241990799272/screens/146f645a9e0a4f46a2e8ac2c1ce13229/fileEntries/screenshot` → `design/novo-agendamento-computador.png` (os HTMLs já estão em `design/`). Abrir (Read) as duas imagens.
2. Escrever `novo-agendamento-gestor-beauty.test.tsx` e ajustar `visit-form-dialog.test.tsx` (falham antes).
3. `VisitFormDialog.tsx` (D-13, D-20):
   - `LABEL_CLASS = FIELD_LABEL_CLASS` (import de `@/lib/field-classes`); "(opcional)" dentro do rótulo em `normal-case font-normal`.
   - `DialogContent`: manter `h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh]` (UX-03) e trocar `sm:rounded-lg` por `sm:rounded-md`; header `flex items-start justify-between gap-sm px-md py-md border-b border-neutral-200 bg-white` com `DialogTitle className="font-serif text-headline-md text-neutral-800"` (sem `uppercase`/`tracking-wide`) e `DialogDescription` visível "Preencha os detalhes do atendimento" em `text-[12px] leading-4 text-neutral-500` (deixa de ser `sr-only`).
   - Cliente: campo de busca com o `Input` padrão; cliente escolhido mostrado com o nome em `font-serif text-[15px] font-semibold` (via `toDisplayName`) e telefone `tabular-nums text-neutral-500`; lista de opções `rounded-md border-neutral-200`, cada opção `min-h-[44px]`.
   - Faixa de chips `data-testid="visit-service-chips"` no topo da seção "Serviço" (cabeçalho: rótulo "SERVIÇO" à esquerda e `{n} {n === 1 ? 'selecionado' : 'selecionados'}` em `text-overline text-primary-500` à direita): um chip por linha com serviço escolhido, `inline-flex h-[34px] items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-3 text-[12px] font-semibold text-neutral-800` com o nome e o preço (`R$ x,xx`, `text-[11px] tabular-nums text-neutral-500`), e o botão existente `visit-add-line` como chip `inline-flex min-h-[44px] items-center gap-1 rounded-md border border-dashed border-neutral-200 bg-white px-3 text-label text-neutral-800` "Adicionar serviço". Os selects de serviço/variação de cada linha continuam (testids e `selectOption` dos E2E).
   - Profissional: no componente da linha, se a lista de profissionais disponíveis tem até 4 itens, renderizar `<div role="radiogroup" aria-label="Profissional" data-testid={\`visit-line-${index}-professional\`} className="grid gap-1 rounded-md border border-neutral-200 bg-neutral-100 p-1" style={{ gridTemplateColumns: \`repeat(${n}, minmax(0, 1fr))\` }}>` com um `<button type="button" role="radio" aria-checked={sel} data-testid={\`visit-line-${index}-professional-${p.id}\`}>` por profissional: `min-h-[44px] rounded-md px-sm text-body truncate`, marcado `bg-primary text-white font-semibold`, desmarcado `bg-transparent text-neutral-600 hover:bg-white`; clique chama o mesmo handler do `onChange` do select. Navegação por teclado (radiogroup do WAI-ARIA): tabIndex móvel (`tabIndex={sel || (!algumMarcado && i === 0) ? 0 : -1}`), `onKeyDown` no grupo tratando `ArrowRight`/`ArrowDown` (próxima, com volta ao início) e `ArrowLeft`/`ArrowUp` (anterior, com volta ao fim): `preventDefault()`, chamar o handler de troca com o profissional de destino e mover o foco para o botão dele (refs por índice ou `querySelectorAll('[role="radio"]')` do grupo); `Space`/`Enter` é o clique nativo do `<button>`. Com mais de 4, o `<select>` atual fica (mesmo testid). A lógica de filtro (`… não faz este serviço` etc., ~linha 208) continua igual.
   - Data/Hora/Duração (D-20): na linha de índice 0, `<div data-testid="visit-when" className="grid grid-cols-12 gap-sm">` com Data (`visit-date`, `col-span-12 sm:col-span-5`), Hora (`visit-line-0-time`, `col-span-6 sm:col-span-4`) e Duração (`visit-line-0-duration`, `col-span-6 sm:col-span-3`); passar o campo de data para a linha 0 via prop `dateField?: React.ReactNode` (o estado continua no diálogo). Pacote fica numa linha própria abaixo. Linhas ≥ 1: Hora e Duração no mesmo `grid-cols-12` sem a data. Inputs de hora/duração `tabular-nums`.
   - Cada linha de serviço: `rounded-md border border-neutral-200 bg-white p-sm`; remover (`Trash2`) como botão `h-11 w-11` ghost com `aria-label` atual.
   - Erro (D-20): mover `visit-error` para logo depois do bloco de serviços: `<p role="alert" data-testid="visit-error" className="flex items-start gap-xs text-[12px] leading-4 font-semibold text-error-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>`.
   - Sinal (D-20): trocar o `fieldset` por `<section className="rounded-md border border-neutral-200 bg-neutral-100">` com `<button type="button" data-testid="visit-deposit-toggle" aria-expanded={depositOpen} className="flex min-h-[44px] w-full items-center justify-between px-sm text-label text-neutral-800">Sinal (opcional)<ChevronDown … /></button>` e o conteúdo (campos `visit-deposit-amount`/`visit-deposit-method` e o texto de ajuda) só quando aberto; `depositOpen` começa `true` se o formulário já vier com valor de sinal.
   - Observações: `Textarea` padrão.
   - Rodapé: `<footer className="flex gap-sm px-md py-sm border-t border-neutral-200 bg-white">` com "Cancelar" `variant="outline"` e `visit-submit` no tamanho padrão (`min-h-[44px]`, roxo, texto branco), `flex-1 sm:flex-none` nos dois.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `ls .planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-celular.png .planning/phases/06-novo-layout-gestor-beauty/design/novo-agendamento-computador.png` existe
    - `grep -n "role=\"radiogroup\"" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` e `grep -n "visit-deposit-toggle" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` e `grep -n "visit-service-chips" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` encontram as linhas
    - `grep -n "uppercase tracking-wide" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` não encontra nada
    - `novo-agendamento-gestor-beauty.test.tsx`, `visit-form-dialog.test.tsx`, `visit-form-scroll.test.tsx` e `ux-agenda-lote1.test.tsx` passam
  </acceptance_criteria>
  <done>Formulário de agendamento com chips, controle segmentado, grade de quando, erro sob a linha e Sinal recolhido (D-20).</done>
</task>

<task type="auto">
  <name>Task 2: E2E adaptados (escolha de profissional e Sinal recolhido), gate, comparação com o Stitch, deploy e CI</name>
  <files>apps/e2e/support/agenda-ui.ts, apps/e2e/tests/agenda-concorrencia.spec.ts, apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts, apps/e2e/audit/fluxos-escrita.audit.ts, .planning/phases/06-novo-layout-gestor-beauty/06-04-SUMMARY.md</files>
  <read_first>
    - apps/e2e/support/agenda-ui.ts
    - apps/e2e/tests/agenda-concorrencia.spec.ts (linhas 55-75), fluxo-agendamento-comanda-pagamento.spec.ts (linhas 55-80), apps/e2e/audit/fluxos-escrita.audit.ts (linhas 75-95)
    - apps/e2e/tests/ux-agenda-celular.spec.ts e ux-contraste.spec.ts
    - scripts/deploy-staging.sh
  </read_first>
  <action>
1. `apps/e2e/support/agenda-ui.ts`: acrescentar
   - `export async function pickProfessional(page: Page, line: number, professionalId: string): Promise<void>`: `const el = page.getByTestId(\`visit-line-${line}-professional\`); if (await el.evaluate((n) => n.tagName === 'SELECT')) await el.selectOption(professionalId); else await page.getByTestId(\`visit-line-${line}-professional-${professionalId}\`).click();`
   - `export async function openDeposit(page: Page): Promise<void>`: `const t = page.getByTestId('visit-deposit-toggle'); if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();`
   Trocar `getByTestId('visit-line-0-professional').selectOption(pro.id)` por `pickProfessional(page, 0, pro.id)` nos 3 arquivos e chamar `openDeposit(page)` antes de `visit-deposit-amount` em `fluxo-agendamento-comanda-pagamento.spec.ts`. Nada mais muda nos E2E (D-23).
2. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir. Falha antiga em arquivo não tocado: `deferred-items.md`.
3. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-04 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "03-agenda-novo-agendamento"`. Abrir `desktop/03-agenda-novo-agendamento.png` e `mobile/03-agenda-novo-agendamento.png` ao lado de `design/novo-agendamento-computador.png` e `design/novo-agendamento-celular.png`; registrar `## Comparação com o Stitch` no SUMMARY (bloco | como ficou | omitido por D-02?) e corrigir divergência dentro do escopo.
4. Commit (arquivos um a um, inclusive os PNGs): `feat(06-04): novo agendamento no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
5. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
6. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "visit-line-0-professional').selectOption" apps/e2e` não encontra nada e `grep -rn "pickProfessional" apps/e2e/tests apps/e2e/audit` encontra os 3 arquivos
    - E2E completo verde (inclui `ux-agenda-celular.spec.ts` UX-03 e `ux-contraste.spec.ts` UX-01)
    - Commit `feat(06-04)` em `origin/master`, deploy sem erro, CI verde
    - `06-04-SUMMARY.md` tem `## Comparação com o Stitch`
  </acceptance_criteria>
  <done>Novo agendamento no staging com CI verde.</done>
</task>

</tasks>

<verification>
- UX-03 e UX-04 seguem verdes; E2E de agendamento passam com o controle segmentado e a seção Sinal recolhida; deploy e CI verdes
</verification>

<success_criteria>
Lote Novo agendamento entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-04-SUMMARY.md`
</output>

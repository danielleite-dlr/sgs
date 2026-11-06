---
phase: 05-uso-no-dia-a-dia
plan: 09
type: execute
wave: 5
depends_on: ["05-07", "05-08"]
files_modified:
  - apps/frontend/src/components/ui/button-variants.ts
  - apps/frontend/src/components/ui/tabs.tsx
  - apps/frontend/src/components/ui/dialog.tsx
  - apps/frontend/src/lib/cn.ts
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
  - apps/frontend/src/components/ui/__tests__/contraste-primario.test.tsx
  - apps/frontend/src/features/operations/__tests__/ux-agenda-lote1.test.tsx
  - apps/e2e/tests/ux-contraste.spec.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "A usuária lê "Dia", "Semana" e "Salvar" com letra branca sobre o roxo (UX-01)"
    - "O diálogo "Cadastrar agendamento" tem um único botão de fechar (UX-04)"
    - "O calendário lateral mostra "Novembro de 2026" e o selo "Pgto Indica" não aparece mais (UX-05)"
  artifacts:
    - path: "apps/frontend/src/components/ui/__tests__/contraste-primario.test.tsx"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-09-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Agenda (lote 1 de 2). Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-01 Texto escuro sobre roxo em botões e abas selecionados
- UX-04 Dois botões de fechar no diálogo de agendamento
- UX-05 "Novembro De 2026" e selo "Pgto Indica"

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-09-SUMMARY.md`.
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
  <name>Task 1: UX-01 Texto legível sobre fundo roxo (botões e abas selecionados)</name>
  <files>apps/frontend/src/components/ui/button-variants.ts, apps/frontend/src/components/ui/tabs.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/components/ui/__tests__/contraste-primario.test.tsx, apps/e2e/tests/ux-contraste.spec.ts</files>
  <read_first>
    - apps/frontend/src/components/ui/button-variants.ts
    - apps/frontend/src/components/ui/tabs.tsx
    - apps/frontend/tailwind.config.ts (cores primary.DEFAULT #570080 e primary.foreground #FFFFFF)
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (grupo Dia/Semana e filtros: classes com `bg-primary-500`, `bg-neutral-800`)
    - apps/frontend/src/lib/cn.ts
    - apps/e2e/tests/smoke.spec.ts (modelo de login e base URL)
  </read_first>
  <behavior>
    - Vitest: `<Button>Salvar</Button>` renderizado tem as classes `bg-primary` e `text-white` (ou `text-primary-foreground` resolvido) e NENHUMA classe `text-neutral-*`, `text-primary-500/700/900` ou `text-foreground` no mesmo elemento.
    - Vitest: toda classe com `bg-primary`, `bg-primary-500`, `bg-primary-700` ou `bg-neutral-800` nos componentes `button-variants.ts`, `tabs.tsx` e nos botões selecionados de `SchedulePage.tsx` vem acompanhada de `text-white`.
    - Playwright (`ux-contraste.spec.ts`, desktop): na Agenda, o botão "Dia" selecionado e o botão "Salvar" do diálogo "Cadastrar agendamento" têm `getComputedStyle(el).color` = `rgb(255, 255, 255)` e `backgroundColor` = `rgb(87, 0, 128)` (ou 700).
  </behavior>
  <action>
1. Reproduzir: subir o frontend local (`pnpm --filter @sgs/frontend dev`) com o backend semeado e, com Playwright, ler `getComputedStyle` do botão "Salvar" e do "Dia" selecionado. Escrever o teste Playwright e o vitest primeiro e vê-los falhar.
2. Achar a causa lendo, nesta ordem: (a) se o CSS gerado contém `.text-primary-foreground` (`pnpm --filter @sgs/frontend build` e `grep -c "text-primary-foreground" dist/assets/*.css`); (b) se `tailwind-merge` em `lib/cn.ts` descarta `text-primary-foreground` por tratar o tamanho customizado `text-label` como cor (nesse caso configurar `extendTailwindMerge({ extend: { classGroups: { 'font-size': ['text-label', 'text-body', 'text-heading'] } } })`); (c) classes de aba/filtro que trocam o texto para cor escura quando selecionado (`data-[state=active]:text-primary-500` em `tabs.tsx` é fundo claro, está correto; os grupos Dia/Semana em `SchedulePage.tsx` usam `bg-neutral-800 text-white`, conferir se algum perde o `text-white`).
3. Corrigir na raiz da causa e garantir texto branco explícito (`text-white`) em toda superfície sólida roxa ou grafite: variante `default` de `button-variants.ts` (`bg-primary text-white hover:bg-primary-700 active:bg-primary-900`) e botões selecionados de `SchedulePage.tsx`. Não mudar a cor de fundo (marca #570080).
4. Rodar as telas de Comandas e Financeiro (filtros de período) no Playwright e conferir o mesmo contraste.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- contraste-primario && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-contraste.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "text-white" apps/frontend/src/components/ui/button-variants.ts` mostra a variante default com `bg-primary` e `text-white`
    - `contraste-primario.test.tsx` passa e falhava antes da correção
    - `ux-contraste.spec.ts` confirma `rgb(255, 255, 255)` sobre fundo roxo em "Dia" e "Salvar"
    - Nenhuma classe `text-neutral-800` junto de `bg-primary` em `apps/frontend/src` (`grep -rn "bg-primary[^-/]" apps/frontend/src | grep "text-neutral"` vazio)
  </acceptance_criteria>
  <done>Texto branco legível sobre roxo em botões e abas selecionados (UX-01).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-04 e UX-05 Um só botão de fechar, "Novembro de 2026" e selo "Pgto Indica"</name>
  <files>apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/__tests__/ux-agenda-lote1.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx (header do diálogo, ~linhas 446-462, botão `X` com `aria-label="Fechar"`)
    - apps/frontend/src/components/ui/dialog.tsx (DialogContent já traz o X do canto, linhas 41-44)
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (InlineCalendar: `monthLabel` ~linha 122 e `capitalize` na ~linha 154; selo "Pgto Indica" ~linhas 1100-1108)
    - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx (modelo de render do diálogo)
  </read_first>
  <behavior>
    - Vitest: o diálogo "Cadastrar agendamento" aberto tem exatamente 1 botão com nome acessível "Fechar" (`getAllByRole('button', { name: /fechar/i })` com length 1).
    - Vitest: `InlineCalendar` com data 2026-11-06 mostra o texto "Novembro de 2026" e não contém "Novembro De".
    - Vitest: a Agenda não renderiza o texto "Pgto" nem "Indica".
  </behavior>
  <action>
1. Escrever `ux-agenda-lote1.test.tsx` com os 3 testes acima (falham antes).
2. UX-04: em `VisitFormDialog.tsx` remover o `<Button variant="ghost" size="icon" onClick={close} aria-label="Fechar">` do `<header>` (o X do `DialogContent` fica e continua fechando). Ajustar o texto sr-only do X do `dialog.tsx` de "Close" para "Fechar" se ainda estiver em inglês (`grep -n "Close" apps/frontend/src/components/ui/dialog.tsx`); conferir que `close` ainda é chamado por `onOpenChange`.
3. UX-05 (data): em `InlineCalendar`, remover a classe `capitalize` do `<span>` do mês e capitalizar só a primeira letra por código: `const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1)`, de modo que apareça "Novembro de 2026".
4. UX-05 (selo): o bloco `{/* Pgto Indica indicator */}` é marcação estática, sem dado associado (conferir no código que nenhuma prop o alimenta). Remover o bloco inteiro e o import `AlertCircle` se ficar sem uso. Se for achado um uso real, manter e trocar o texto para uma linha só, "Pagamento indicado", com `whitespace-nowrap` e visível também no celular.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- ux-agenda-lote1 visit-form-dialog && pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Pgto" apps/frontend/src/features/operations/pages/SchedulePage.tsx` não retorna nada
    - `grep -n "capitalize" apps/frontend/src/features/operations/pages/SchedulePage.tsx` não aparece mais no span do mês
    - VisitFormDialog tem um único botão "Fechar"
    - `ux-agenda-lote1.test.tsx` passa; `visit-form-dialog.test.tsx` continua passando
  </acceptance_criteria>
  <done>Diálogo com um só X, mês escrito corretamente e selo confuso removido (UX-04, UX-05).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-09): agenda: contraste do roxo, um só fechar, mês e selo (UX-01, UX-04, UX-05)`, com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-01, UX-04, UX-05 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-09): registra commit das correções UX-01, UX-04, UX-05`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-09)` e citando UX-01, UX-04, UX-05
    - Linhas UX-01, UX-04, UX-05 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-09-SUMMARY.md`
</output>

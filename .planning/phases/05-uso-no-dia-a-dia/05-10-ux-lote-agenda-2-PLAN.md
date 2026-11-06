---
phase: 05-uso-no-dia-a-dia
plan: 10
type: execute
wave: 6
depends_on: ["05-07", "05-08", "05-09"]
files_modified:
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
  - apps/frontend/src/features/operations/lib/professional-label.ts
  - apps/frontend/src/features/operations/__tests__/professional-label.test.ts
  - apps/frontend/src/features/operations/__tests__/visit-form-scroll.test.tsx
  - apps/e2e/tests/ux-agenda-celular.spec.ts
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
autonomous: true
requirements: [UX-DAY]

must_haves:
  truths:
    - "Na Agenda do celular o botão de filtros mostra "Filtros" e os botões de profissional têm pelo menos 44 px (UX-02)"
    - "No celular o formulário de agendamento ocupa a tela e avisa "Role para ver mais campos" (UX-03)"
  artifacts:
    - path: "apps/frontend/src/features/operations/__tests__/professional-label.test.ts"
      provides: "Teste de regressão do lote"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-10-SUMMARY.md"
      via: "IDs UX-xx deste lote e hashes dos commits"
      pattern: "UX-[0-9]+"
---

<objective>
Lote de correção de usabilidade, tela: Agenda no celular (lote 2 de 2). Itens aprovados pela usuária em 2026-11-06 (UX-DAY; D-01, D-02, D-03):
- UX-02 Alvos de toque pequenos e avatares cortados na Agenda do celular
- UX-03 Campos escondidos no formulário de agendamento do celular

Nada além dos itens aprovados entra neste lote (D-01, D-03). Cada correção tem um teste de regressão que falha antes e passa depois. Todo texto visível em português do Brasil, com acentos.

Purpose: a usuária percebe a melhoria no staging depois do deploy deste lote.
Output: correções commitadas, `05-AUDITORIA.md` com os hashes e `05-10-SUMMARY.md`.
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
  <name>Task 1: UX-02 Alvos de toque de 44 px e nomes nos avatares (Agenda no celular)</name>
  <files>apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/lib/professional-label.ts, apps/frontend/src/features/operations/__tests__/professional-label.test.ts, apps/e2e/tests/ux-agenda-celular.spec.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (botão de filtros só com ícone; cluster de avatares ~linhas 1051-1100; botões "Todos" e iniciais h-7 w-7 ~linhas 280-330)
    - apps/frontend/src/features/operations/professional-filter.ts
    - apps/frontend/src/features/operations/__tests__/week-grid.test.tsx
    - apps/e2e/playwright.config.ts (projeto de celular, se houver; senão usar `test.use({ viewport: { width: 412, height: 915 } })`)
  </read_first>
  <behavior>
    - Vitest (`professional-label.test.ts`): `shortProfessionalName('Maria Aparecida Silva')` = "Maria A."; `'Ana'` = "Ana"; `''` = "?"; nomes em caixa alta saem em caixa normal ("JOANA PAULA" = "Joana P.").
    - Playwright (`ux-agenda-celular.spec.ts`, viewport 412x915): na Agenda, o botão de filtros tem texto visível "Filtros" e cada botão de avatar de profissional e o botão "Todos" têm `boundingBox()` com largura e altura de pelo menos 44 px.
  </behavior>
  <action>
1. Criar `lib/professional-label.ts` com `export function shortProfessionalName(full: string): string` (primeiro nome + inicial do segundo com ponto, em caixa normal; vazio vira "?") e o teste unitário (falha antes, pois o arquivo não existe).
2. Em `SchedulePage.tsx`: trocar o botão de filtros só-ícone por botão com ícone e a palavra "Filtros" (`<span className="text-label">Filtros</span>`), `min-h-[44px] min-w-[44px]`. Nos botões "Todos" e de cada profissional trocar `h-7 w-7` por `h-11 w-11 md:h-7 md:w-7` (44 px no celular, tamanho atual no computador) e `px-sm py-xs` do "Todos" por `min-h-[44px] px-md md:min-h-0 md:px-sm md:py-xs`.
3. Na visão da semana (cabeçalho com avatares ~linhas 1051-1100) mostrar `shortProfessionalName(nome)` ao lado do avatar no celular em vez de iniciais cortadas, com `truncate max-w-[88px]`.
4. Escrever o teste Playwright e rodá-lo local contra o frontend semeado (ver como `smoke.spec.ts` entra).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- professional-label week-grid && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-agenda-celular.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Filtros" apps/frontend/src/features/operations/pages/SchedulePage.tsx` encontra o rótulo visível
    - `grep -n "h-11 w-11 md:h-7 md:w-7" apps/frontend/src/features/operations/pages/SchedulePage.tsx` encontra os botões de profissional
    - `professional-label.test.ts` e `ux-agenda-celular.spec.ts` passam; `week-grid.test.tsx` continua passando
  </acceptance_criteria>
  <done>Agenda no celular com alvos de 44 px, botão "Filtros" com texto e nomes curtos nos avatares (UX-02).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UX-03 Formulário de agendamento no celular com mais altura e sugestão de rolagem</name>
  <files>apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx, apps/frontend/src/features/operations/__tests__/visit-form-scroll.test.tsx, apps/e2e/tests/ux-agenda-celular.spec.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx (DialogContent `max-w-[720px] p-0 max-h-[90vh] flex flex-col`; corpo `flex-1 overflow-y-auto px-md py-md space-y-md`; rodapé com Salvar)
    - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx
    - apps/e2e/tests/ux-agenda-celular.spec.ts (criado na Task 1 deste lote)
  </read_first>
  <behavior>
    - Vitest (`visit-form-scroll.test.tsx`): o DialogContent do formulário tem as classes `h-[100dvh]` e `sm:h-auto` e `sm:max-h-[90vh]`; o corpo rolável contém o elemento `data-testid="visit-scroll-hint"` com o texto "Role para ver mais campos".
    - Playwright (viewport 412x915): após abrir "Agendar", o corpo rolável ocupa pelo menos 60% da altura da tela, e os campos "Hora", "Duração" e o botão "Adicionar serviço" ficam visíveis depois de rolar o corpo até o fim (`scrollIntoViewIfNeeded` e `toBeVisible`).
  </behavior>
  <action>
1. Escrever os testes acima (falham antes).
2. Em `VisitFormDialog.tsx`, trocar `max-h-[90vh]` do DialogContent por `h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg`, de modo que no celular o diálogo ocupe a tela inteira (o rodapé com Salvar continua fixo) e no computador não mude.
3. Dentro do corpo rolável, ao final, acrescentar `<div data-testid="visit-scroll-hint" className="sticky bottom-0 -mx-md bg-gradient-to-t from-white to-transparent pt-md text-center text-xs text-neutral-600 sm:hidden">Role para ver mais campos</div>`. Esconder o aviso quando o corpo já estiver no fim: estado `atBottom` atualizado em `onScroll` (`el.scrollTop + el.clientHeight >= el.scrollHeight - 8`) e `hidden` quando `atBottom`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test -- visit-form-scroll visit-form-dialog && pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec playwright test tests/ux-agenda-celular.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "h-\[100dvh\]" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` encontra a classe
    - `grep -n "Role para ver mais campos" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx` encontra o aviso
    - `visit-form-scroll.test.tsx` e o Playwright passam; `visit-form-dialog.test.tsx` continua passando
  </acceptance_criteria>
  <done>No celular o formulário ocupa a tela e avisa que há mais campos abaixo (UX-03).</done>
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
2. Commit dos arquivos do lote (adicionar um a um, nunca `git add .`): `fix(05-10): agenda no celular: alvos de toque e formulário (UX-02, UX-03)`, com o trailer `Co-Authored-By` que o ambiente indicar.
3. Em `05-AUDITORIA.md`, seção `## Correções`, preencher a coluna `Corrigido em (commit)` das linhas UX-02, UX-03 com o hash curto (`git rev-parse --short HEAD`) e commitar com `docs(05-10): registra commit das correções UX-02, UX-03`.
4. `git push origin master`.
5. Este lote não tem migration, então não precisa de backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até ficar verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm -r typecheck && pnpm --filter @sgs/frontend test && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit do lote com assunto começando em `fix(05-10)` e citando UX-02, UX-03
    - Linhas UX-02, UX-03 de `05-AUDITORIA.md` têm hash na coluna `Corrigido em (commit)`
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
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-10-SUMMARY.md`
</output>

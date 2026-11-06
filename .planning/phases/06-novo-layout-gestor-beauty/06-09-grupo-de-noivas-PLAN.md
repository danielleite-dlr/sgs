---
phase: 06-novo-layout-gestor-beauty
plan: 09
type: execute
wave: 9
depends_on: ["06-08"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-computador.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-computador.png
  - .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-celular.html
  - .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-celular.png
  - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
  - apps/frontend/src/features/bridal/components/BridalMembersCard.tsx
  - apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx
  - apps/frontend/src/features/bridal/__tests__/grupo-noivas-gestor-beauty.test.tsx
  - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "O título do grupo usa a caixa padronizada dos nomes ('Noiva julia Souza' vira 'Noiva Julia Souza'), em serifa, e a trilha mostra o mesmo nome em caixa normal, sem maiúsculas forçadas (D-07, D-13; observação deixada pela fase 5)"
    - "Os dados do evento (tipo, responsável, horário, data, pronta até, local, pacote, status) ficam numa ficha com rótulos em maiúsculas pequenas e valores em texto principal; horários e datas em números tabulares (D-13)"
    - "Pessoas do grupo aparecem com nome em serifa, telefone formatado e cobertura como selo com ponto; o cronograma usa horários tabulares e campos de 44 px (D-10, D-11)"
    - "Não aparecem cerimonial/assessoria, dossiê, status de prova nem dados inventados (D-02)"
  artifacts:
    - path: "apps/frontend/src/features/bridal/__tests__/grupo-noivas-gestor-beauty.test.tsx"
      provides: "Regressão visual do grupo de noivas"
  key_links:
    - from: "apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx"
      to: "apps/frontend/src/lib/format-name.ts"
      via: "PageHeader title={toDisplayName(group.name)}"
      pattern: "toDisplayName\\(group.name\\)"
---

<objective>
Lote de tela 7 (D-03): Grupo de noivas (detalhe) seguindo as telas Stitch computador (`c5f9c23d170f4baab46aba264eb8a5fb`) e celular (`3694705c2ace43c3a65a548680e0fae1`), com D-21. Só visual (D-01): editar/cancelar grupo, pessoas, cronograma, sugestão da IA e link para contrato funcionam como hoje.

Entra porque cai naturalmente na tela (deferred do CONTEXT): título do grupo com `toDisplayName`.
Omitir (D-02): cerimonial/assessoria, "dossiê" da noiva, status de prova, contagem regressiva/"Casamento em N dias" se depender de cálculo não exibido hoje (data do evento já aparece; nenhuma métrica nova), bancadas/cadeiras/salas, "Sincronizado". A tabela "Itens por pessoa" do contrato NÃO entra (é outra tela).

Purpose: grupo de noivas no padrão novo, sem regressão de UX-14.
Output: tela redesenhada, testes, deploy com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-08-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write`; aspas simples.
- Regressão UX-14 (fase 5): um único status com legenda curta (`group-status` + `group-contract-status`), campo vazio escondido ou convite a preencher, telefone formatado — testes em `bridal-group-detail.test.tsx`.
- E2E `noivas-contrato.spec.ts:92` procura `getByRole('heading', { name: groupName })` sem `exact` (não diferencia maiúsculas): `toDisplayName` no título não quebra. Não colocar `uppercase` em nomes de pessoa ou do grupo.
- `text-amber-700` (responsável "não definida") vira `text-warning-700` (D-12).
- Testids que ficam: `edit-group`, `cancel-group`, `view-contract`, `create-contract`, `bg-detail-*`, `group-status`, `group-contract-status`, `schedule-editor`, `schedule-row-N`, `row-N-prof|start|end`, `member-<id>`, `coverage-<id>`, `members-errors`.
</armadilhas>

<interfaces>
`BridalGroupDetailPage.tsx` (209 linhas): `PageHeader title={group.name}` (~62) com ações; `dl className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4"` com `dt className="text-xs font-semibold text-neutral-700"`; `Badge variant="outline"` em tipo e status.
`BridalMembersCard.tsx`: tabela de pessoas (`member-<id>`, `coverage-<id>`), formulário `BridalPersonFields` "Acompanhante", erros `text-error`.
`BridalScheduleEditor.tsx`: tabela do cronograma com selects/inputs por linha.
`lib/format-name.ts`: `toDisplayName`; `lib/format-phone.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referências do Stitch e grupo de noivas no layout novo (ficha do evento, pessoas, cronograma)</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-computador.html, .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-computador.png, .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-celular.html, .planning/phases/06-novo-layout-gestor-beauty/design/grupo-noivas-celular.png, apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, apps/frontend/src/features/bridal/components/BridalMembersCard.tsx, apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx, apps/frontend/src/features/bridal/__tests__/grupo-noivas-gestor-beauty.test.tsx, apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts</files>
  <read_first>
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx, components/BridalMembersCard.tsx, components/BridalScheduleEditor.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx, bridal-fixtures.ts, schedule-rows.test.ts, ai-suggestion-panel.test.tsx
    - apps/e2e/tests/noivas-contrato.spec.ts e debutante-contrato.spec.ts
    - apps/frontend/src/lib/format-name.ts
  </read_first>
  <behavior>
    - `grupo-noivas-gestor-beauty.test.tsx` (fixtures de `bridal-fixtures.ts`):
      - Com `name: 'Noiva julia Souza'`, o `h1` é "Noiva Julia Souza".
      - Trilha (D-13): o último item da trilha (`BreadcrumbPage`, `aria-current="page"`) tem `textContent` exatamente "Noiva Julia Souza" e nem ele nem o link "Noivas" têm a classe `uppercase` (nome do grupo em caixa normal).
      - A ficha `data-testid="bg-detail-sheet"` é `rounded-md border border-neutral-200 bg-white`; cada `dt` tem `text-overline uppercase text-neutral-500`; `dd` de horário/data (`bg-detail-event-time`, `bg-detail-ready-by`) tem `tabular-nums`.
      - `group-status` é um `Badge` com ponto (variant `success` para ativo/confirmado, `neutral` para rascunho, `error` para cancelado — usar o mapa de status existente) e o texto atual.
      - Responsável vazio mostra "não definida" com `text-warning-700`.
      - Em `BridalMembersCard`, o nome de cada `member-<id>` tem `font-serif` e caixa normal; `coverage-<id>` é um `Badge` com ponto; os títulos de seção são `h2` `font-serif text-headline-sm`.
      - Em `BridalScheduleEditor`, inputs/selects de `row-N-*` têm `h-11` e as horas `tabular-nums`; cabeçalho da tabela `bg-neutral-100 text-overline uppercase text-neutral-500`.
    - `bridal-group-detail.test.tsx`, `schedule-rows.test.ts` e `ai-suggestion-panel.test.tsx` continuam passando.
  </behavior>
  <action>
1. Baixar com o MCP do Stitch (`mcp__stitch__download_file`) e salvar em `design/`: `projects/5888991241990799272/screens/c5f9c23d170f4baab46aba264eb8a5fb/fileEntries/html` → `grupo-noivas-computador.html`, `…/c5f9c23d170f4baab46aba264eb8a5fb/fileEntries/screenshot` → `grupo-noivas-computador.png`, `…/3694705c2ace43c3a65a548680e0fae1/fileEntries/html` → `grupo-noivas-celular.html`, `…/3694705c2ace43c3a65a548680e0fae1/fileEntries/screenshot` → `grupo-noivas-celular.png`. Abrir os PNGs; listar os blocos omitidos (D-02) para o SUMMARY.
2. Escrever `grupo-noivas-gestor-beauty.test.tsx` (falha antes).
3. `BridalGroupDetailPage.tsx`: `title={toDisplayName(group.name)}` e `breadcrumbs={[{ label: 'Noivas', to: '/noivas' }, { label: toDisplayName(group.name) }]}` (linha ~63; a trilha do PageHeader não tem `uppercase` desde o 06-02, então o nome aparece como no título); a `dl` vira ficha `data-testid="bg-detail-sheet"` `className="mb-md grid grid-cols-2 gap-x-md gap-y-sm rounded-md border border-neutral-200 bg-white p-md sm:grid-cols-4"`; `dt` `text-overline uppercase text-neutral-500`; `dd` `text-body text-neutral-800` (datas/horários com `tabular-nums`); local: nome `text-body font-medium`, endereço `text-[12px] text-neutral-500`; responsável vazio `text-warning-700`; tipo de evento `Badge variant="outline"`; `group-status` com `Badge` de ponto conforme o behavior; `group-contract-status` `text-[12px] text-neutral-500`. Ações do `PageHeader`: botões padrão (44 px), "Cancelar grupo" `variant="outline"` com `text-error-600`.
4. `BridalMembersCard.tsx`: título `h2` `font-serif text-headline-sm`; tabela com `thead bg-neutral-100`, `th` `text-overline uppercase text-neutral-500`, `tr` `border-t border-neutral-200`; nome `font-serif text-[15px] font-semibold text-neutral-800` com `toDisplayName`; telefone formatado `tabular-nums text-neutral-500`; `coverage-*` como `Badge` (`success` coberta / `warning` parcial / `neutral` sem cobertura — usar o critério que o componente já tem); `members-errors` `text-[12px] font-semibold text-error-600` (era `text-error`); botões de ação 44 px.
5. `BridalScheduleEditor.tsx`: cabeçalho `bg-neutral-100 text-overline uppercase text-neutral-500`; selects/inputs de cada linha com `NATIVE_SELECT_CLASS`/`Input` padrão (`h-11`); horários `tabular-nums`; `row-N-end` `tabular-nums text-neutral-500`.
6. `sem-cor-antiga.test.ts`: remover `'features/bridal/pages/BridalGroupDetailPage.tsx'` de `PALETA_PENDENTE` (o passo 3 troca `text-amber-700` por `text-warning-700`; o teste falha se a entrada ficar sobrando). Se a lista ficar vazia, manter `{}`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/bridal src/styles && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - Os 4 arquivos `design/grupo-noivas-*` existem
    - `grep -n "toDisplayName(group.name)" apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx` encontra o título
    - `grep -rn "text-amber-700\|text-neutral-700" apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx` não encontra nada
    - `grep -n "label: toDisplayName(group.name)" apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx` encontra a trilha
    - `grep -n "BridalGroupDetailPage" apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts` não encontra nada e `sem-cor-antiga.test.ts` passa
    - Suítes de `src/features/bridal` passam (inclui `bridal-group-detail.test.tsx`, UX-14)
  </acceptance_criteria>
  <done>Grupo de noivas no padrão Gestor Beauty com título padronizado.</done>
</task>

<task type="auto">
  <name>Task 2: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-09-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/audit/telas.audit.ts (slugs `09-noivas-lista` e `10-noivas-detalhe`)
  </read_first>
  <action>
1. Gate completo na raiz `/root/sgs` (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha deste lote: corrigir. Falha antiga em arquivo não tocado: `deferred-items.md`.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-09 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "10-noivas-detalhe"`. Abrir `desktop/10-noivas-detalhe.png` e `mobile/10-noivas-detalhe.png` ao lado de `design/grupo-noivas-computador.png` e `design/grupo-noivas-celular.png` (se o seed local não tiver grupo, a nota do screenshot diz "sem grupos": nesse caso criar um grupo pelo fluxo de `noivas-contrato.spec.ts` antes ou registrar no SUMMARY que a comparação foi feita com o grupo criado pelo E2E). Registrar `## Comparação com o Stitch` (bloco | como ficou | omitido por D-02?) e corrigir divergência dentro do escopo.
3. Commit (arquivos um a um): `feat(06-09): grupo de noivas no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`; `./scripts/deploy-staging.sh` (sem migration).
5. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas; depois Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-09)` em `origin/master`
    - E2E `noivas-contrato.spec.ts` e `debutante-contrato.spec.ts` verdes
    - `06-09-SUMMARY.md` tem `## Comparação com o Stitch`; deploy sem erro; CI verde
  </acceptance_criteria>
  <done>Grupo de noivas no staging com CI verde.</done>
</task>

</tasks>

<verification>
- UX-14 segue verde; gate, comparação, deploy e CI verdes
</verification>

<success_criteria>
Lote Grupo de noivas entregue no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-09-SUMMARY.md`
</output>

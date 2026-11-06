---
phase: 06-novo-layout-gestor-beauty
plan: 12
type: execute
wave: 6
depends_on: ["06-05"]
files_modified:
  - apps/frontend/tailwind.config.ts
  - apps/frontend/src/styles/globals.css
  - apps/frontend/index.html
  - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts
  - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
  - apps/frontend/src/components/ui/card.tsx
  - apps/frontend/src/components/ui/table.tsx
  - apps/frontend/src/components/ui/badge-variants.ts
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
  - apps/frontend/src/features/operations/lib/appointment-status-style.ts
  - apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "Todas as telas usam o fundo, as linhas e as cores da tela Previsão de caixa do Stitch (D-26): fundo #F9FAFB, bordas #E5E7EB, texto #1F2937/#6B7280, entrada #109868, saída #D85A30, selecionado #521873"
    - "O texto do sistema usa Inter; títulos e nomes de cliente continuam em Source Serif 4"
    - "Cartões têm cantos de 8 px e sombra leve (shadow-sm); controles 6 px"
    - "No menu lateral o item de 1º nível ativo tem fundo lilás claro e texto roxo escuro; o subitem ativo é roxo #521873 com texto branco"
    - "As correções da fase 5 (UX-01..UX-19) e os testes dos lotes 06-01..06-05 continuam verdes"
  artifacts:
    - path: "apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts"
      provides: "Trava dos novos valores de token (D-26)"
---

<objective>
Lote de paleta (D-26, decisão da usuária em 2026-11-06): o SGS inteiro passa a seguir o fundo, as linhas, as cores e a fonte da tela "Previsão de Caixa - Desktop" do Stitch. Como as telas usam os tokens do Tailwind (`neutral-*`, `primary-*`, `success-*`, `error-*`, `rounded-*`, `shadow-*`, `font-sans`), a troca é feita nos tokens e em poucos componentes compartilhados; nenhuma tela precisa ser refeita.

Referência: `.planning/phases/06-novo-layout-gestor-beauty/design/previsao-computador.html` (config `sgs.*` no topo do arquivo) e `previsao-computador.jpg`.

Output: tokens trocados, testes de token e de varredura atualizados, gate completo, deploy no staging e CI verde.
</objective>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md (D-26 substitui D-04, D-05, D-07 só fonte do texto, D-08, D-09, D-12 e o item ativo de D-15)
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tokens, fontes e varredura (D-26)</name>
  <files>apps/frontend/tailwind.config.ts, apps/frontend/src/styles/globals.css, apps/frontend/index.html, apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts, apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts, apps/frontend/src/features/operations/lib/appointment-status-style.ts, apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts</files>
  <read_first>
    - apps/frontend/tailwind.config.ts
    - apps/frontend/src/styles/globals.css
    - apps/frontend/index.html
    - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts
    - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
    - .planning/phases/06-novo-layout-gestor-beauty/design/previsao-computador.html (bloco tailwind.config e classes)
  </read_first>
  <behavior>
    - Vitest `tokens-gestor-beauty.test.ts` (atualizar as expectativas antigas): neutral 50 `#F9FAFB`, 100 `#F3F4F6`, 200 `#E5E7EB`, 300 `#D1D5DB`, 400 `#9CA3AF`, 500 `#6B7280`, 600 `#4B5563`, 700 `#374151`, 800 `#1F2937`, 900 `#111827`; success 500 `#109868`; error 500 `#C53030`; nova cor `outflow` 500 `#D85A30`; primary 800 `#521873` e hover `#4C0070`; fontFamily.sans começa com `Inter`; borderRadius md 6px, lg 8px, DEFAULT 4px; boxShadow.sm `0 1px 2px 0 rgb(0 0 0 / 0.05)`; `index.html` carrega Inter (400;500;600;700) e Source Serif 4 (600;700) e não carrega Public Sans.
    - Vitest `sem-cor-antiga.test.ts`: passa a proibir a paleta anterior (`#F7F6F3`, `#E2DFE5`, `#221E26`, `#6B6670`, `#1B7A43`, `#BA1A1A`, `Public Sans`) além dos hex antigos que já proibia, e deixa de proibir `#D85A30` e `Inter`. Sombras: permitir `shadow-sm` e `shadow-none` (e o anel de foco já permitido); continuar proibindo `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl` e sombras arbitrárias grandes.
  </behavior>
  <action>
1. `tailwind.config.ts`:
   - `neutral`: 0 `#FFFFFF`, 50 `#F9FAFB`, 100 `#F3F4F6`, 200 `#E5E7EB`, 300 `#D1D5DB`, 400 `#9CA3AF`, 500 `#6B7280`, 600 `#4B5563`, 700 `#374151`, 800 `#1F2937`, 900 `#111827`.
   - `primary`: manter 50 `#F5E6FB`, 500 `#570080`, 900 `#370053`; 600 `#4C0070` (hover), 700 `#4C0070`, acrescentar 800 `#521873` (selecionado).
   - `success`: 50 `#ECFDF5`, 100 `#D1FAE5`, 500/600/DEFAULT `#109868`, 700 `#0B7A53`.
   - `error`: 50 `#FEF2F2`, 100 `#FEE2E2`, 200 `#FECACA`, 500/600/DEFAULT `#C53030`, 700 `#B91C1C`.
   - nova `outflow`: { 50 `#FDF0EB`, 500 `#D85A30`, DEFAULT `#D85A30` } (saídas e valores negativos).
   - `destructive`: DEFAULT `#C53030`.
   - `status`: confirmed `#109868`, missed `#C53030` (demais iguais).
   - `muted` `#F3F4F6`/`#6B7280`; `accent` `#F5E6FB`/`#370053`; `card` `#FFFFFF`/`#1F2937`; `popover` idem; `secondary` `#F9FAFB`/`#1F2937`.
   - `fontFamily.sans`: `['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']`.
   - `borderRadius`: none 0, sm 4px, DEFAULT 4px, md 6px, lg 8px, xl 8px, 2xl 8px, 3xl 8px, full 9999px.
   - `boxShadow`: sm `0 1px 2px 0 rgb(0 0 0 / 0.05)`, none `0 0 #0000`; os demais (DEFAULT, md, lg, xl, 2xl, card) apontam para o mesmo valor de `sm` (nada de sombra grande).
2. `globals.css`: variáveis `--color-neutral-50 #F9FAFB`, `--color-neutral-100 #F3F4F6`, `--color-neutral-200 #E5E7EB`, `--color-neutral-500 #6B7280`, `--color-neutral-800 #1F2937`, `--color-success-500 #109868`, `--color-error-500 #C53030`; `--border` passa a `220 13% 91%` (E5E7EB); h1/h2 com `font-weight: 700`; nada mais muda (foco continua roxo).
3. `index.html`: trocar o link de fontes por `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@600;700&display=swap`.
4. `appointment-statuses.ts` e `appointment-status-style.ts`: Confirmado `#109868`, Faltou/Cancelado `#C53030`.
5. Atualizar os dois testes de estilo conforme o behavior. Rodar `grep -rn "#1B7A43\|#BA1A1A\|#F7F6F3\|#E2DFE5\|#221E26\|#6B6670\|Public Sans" apps/frontend/src apps/frontend/index.html --include=*.ts --include=*.tsx --include=*.css --include=*.html | grep -v __tests__` e trocar cada ocorrência pelo token equivalente (`text-success-500`, `text-outflow-500`, `text-error-500`, `bg-neutral-50` etc.) ou pelo hex novo onde for constante de gráfico (ex.: Recharts `fill`: entrada `#109868`, saída `#D85A30`).
6. Onde um valor é **saída/negativo** (Financeiro, Previsão, Comissões estornadas), usar `text-outflow-500` em vez de `text-error-*`; erro de formulário continua `text-error-500`. Fazer `grep -rn "text-error-500\|text-error-600" apps/frontend/src --include=*.tsx | grep -v __tests__` e revisar caso a caso: só troca o que for valor monetário negativo.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/styles && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "'Inter'" apps/frontend/tailwind.config.ts` encontra a fonte do texto
    - `grep -c "Public+Sans" apps/frontend/index.html` retorna 0 e `grep -c "family=Inter" apps/frontend/index.html` retorna 1
    - `grep -n "#F9FAFB\|#E5E7EB\|#109868\|#D85A30\|#521873" apps/frontend/tailwind.config.ts` encontra os 5 valores
    - `grep -rn "#1B7A43\|#F7F6F3\|#E2DFE5\|#221E26\|#6B6670" apps/frontend/src --include=*.ts --include=*.tsx --include=*.css | grep -v __tests__` não acha nada
    - `tokens-gestor-beauty.test.ts` e `sem-cor-antiga.test.ts` passam
  </acceptance_criteria>
  <done>Tokens e fontes seguem a Previsão de caixa (D-26).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Cartões, tabelas, selos e menu lateral no padrão da Previsão</name>
  <files>apps/frontend/src/components/ui/card.tsx, apps/frontend/src/components/ui/table.tsx, apps/frontend/src/components/ui/badge-variants.ts, apps/frontend/src/components/layout/SidebarNav.tsx, apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx</files>
  <read_first>
    - os 4 arquivos de componente acima e o teste do casco
    - apps/frontend/src/components/ui/__tests__/superficies-gestor-beauty.test.tsx e campos-acoes-gestor-beauty.test.tsx (expectativas de classe que mudam)
    - .planning/phases/06-novo-layout-gestor-beauty/design/previsao-computador.html (aside, cartões, thead, selos)
  </read_first>
  <behavior>
    - Card raiz: `rounded-lg border border-neutral-200 bg-white shadow-sm`.
    - TableHeader/TableHead: fundo `bg-neutral-50`, texto `text-[11px] font-semibold uppercase tracking-wider text-neutral-500`; linhas com divisor `border-neutral-100` e hover `hover:bg-neutral-50/60`.
    - Badge: raio `rounded` (4 px); variante neutra `border-neutral-200 bg-neutral-100 text-neutral-600`; variante de alerta "em atraso" (`destructive`/`error`, conforme o nome já usado) `border-error-200 bg-error-50 text-error-700`; variante roxa (`secondary`/`accent`, conforme existir) `border-primary-200 bg-primary-50 text-primary-900`.
    - SidebarNav: item de 1º nível ativo `bg-primary-50 text-primary-900 font-semibold` com ícone `text-primary-500` (não mais roxo cheio); subitem ativo `bg-primary-800 text-white font-semibold rounded-md`; itens inativos `text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900`; rótulo de grupo `text-[10px] font-semibold uppercase tracking-widest text-neutral-400`. Alvo de 44 px continua (D-10).
    - Testes atualizados para essas classes (casco e superfícies), mantendo os nomes acessíveis e os data-testid.
  </behavior>
  <action>
1. Aplicar as classes do behavior nos componentes, sem mudar props nem testids.
2. Atualizar `casco-gestor-beauty.test.tsx`, `superficies-gestor-beauty.test.tsx` e `campos-acoes-gestor-beauty.test.tsx` onde esperavam as classes antigas (roxo cheio no item ativo de 1º nível, raio 6 px em cartão, sem sombra).
3. Conferir com `grep -rn "bg-primary-500 text-white\|bg-primary text-white" apps/frontend/src/components/layout` que o item de 1º nível ativo não usa mais roxo cheio (o subitem usa `bg-primary-800`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/components && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "rounded-lg" apps/frontend/src/components/ui/card.tsx` e `grep -n "shadow-sm" apps/frontend/src/components/ui/card.tsx` encontram as classes
    - `grep -n "bg-primary-800" apps/frontend/src/components/layout/SidebarNav.tsx` encontra o subitem ativo
    - `grep -n "bg-primary-50" apps/frontend/src/components/layout/SidebarNav.tsx` encontra o item de 1º nível ativo
    - Os testes de `src/components` passam
  </acceptance_criteria>
  <done>Componentes compartilhados e menu no padrão da Previsão de caixa.</done>
</task>

<task type="auto">
  <name>Task 3: Gate completo, conferência visual, commit, push, deploy e CI</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-12-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/playwright.audit.config.ts
  </read_first>
  <action>
1. Gate (raiz): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, integração do backend (carregar `.env` linha a linha e rodar `corepack pnpm --filter @sgs/backend test:integration`; só falhas `NOAUTH` do Redis local são aceitas), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. E2E que dependia de cor RGB (ex.: roxo do item ativo, verde/vermelho) deve ser ajustado para os valores novos, sem afrouxar a verificação.
2. Conferência visual (D-24): `AUDIT_TARGET=local` com `apps/e2e/audit/telas.audit.ts` para Financeiro, Previsão, Agenda, Comanda e Clientes; abrir as screenshots e comparar com `design/previsao-computador.jpg` (fundo, bordas, texto, verde/laranja, menu ativo). Registrar em "Comparação com o Stitch" no SUMMARY.
3. Commit (arquivos um a um): `feat(06-12): paleta, linhas e fonte da Previsão de caixa em todo o sistema (D-26)` com trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git push origin master`; `./scripts/deploy-staging.sh`; `gh run watch <run do sha> --exit-status` até verde (máx. 3 tentativas).
4. `06-12-SUMMARY.md` em PT-BR; STATE (`stopped_at: Completed 06-12-paleta-previsao-PLAN.md`, completed_plans +1, last_updated) e ROADMAP (06-12 marcado); commit `docs(06-12): ...`, push e CI.
  </action>
  <verify>
    <automated>cd /root/sgs && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit `feat(06-12)` em origin/master
    - `./scripts/deploy-staging.sh` concluiu e o CI do commit ficou verde
    - `06-12-SUMMARY.md` tem a seção "Comparação com o Stitch"
  </acceptance_criteria>
  <done>Paleta da Previsão de caixa no staging, com CI verde.</done>
</task>

</tasks>

<verification>
- Tokens novos travados por teste; nenhuma cor da paleta anterior no código; gate completo verde; staging atualizado; CI verde
</verification>

<success_criteria>
A usuária abre qualquer tela no staging e vê o fundo, as linhas, as cores e a fonte da Previsão de caixa do Stitch.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-12-SUMMARY.md`
</output>

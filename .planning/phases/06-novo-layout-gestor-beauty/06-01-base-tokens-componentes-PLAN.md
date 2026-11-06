---
phase: 06-novo-layout-gestor-beauty
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/frontend/tailwind.config.ts
  - apps/frontend/src/styles/globals.css
  - apps/frontend/index.html
  - apps/frontend/src/lib/cn.ts
  - apps/frontend/src/lib/field-classes.ts
  - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts
  - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
  - apps/frontend/src/components/ui/button-variants.ts
  - apps/frontend/src/components/ui/badge-variants.ts
  - apps/frontend/src/components/ui/input.tsx
  - apps/frontend/src/components/ui/textarea.tsx
  - apps/frontend/src/components/ui/select.tsx
  - apps/frontend/src/components/ui/label.tsx
  - apps/frontend/src/components/ui/form.tsx
  - apps/frontend/src/components/ui/card.tsx
  - apps/frontend/src/components/ui/table.tsx
  - apps/frontend/src/components/ui/data-table.tsx
  - apps/frontend/src/components/ui/dialog.tsx
  - apps/frontend/src/components/ui/alert-dialog.tsx
  - apps/frontend/src/components/ui/sheet.tsx
  - apps/frontend/src/components/ui/tabs.tsx
  - apps/frontend/src/components/ui/dropdown-menu.tsx
  - apps/frontend/src/components/ui/popover.tsx
  - apps/frontend/src/components/ui/sonner.tsx
  - apps/frontend/src/components/ui/alert.tsx
  - apps/frontend/src/components/ui/radio-group.tsx
  - apps/frontend/src/components/ui/entity-avatar.tsx
  - apps/frontend/src/components/ui/command.tsx
  - apps/frontend/src/components/ui/tooltip.tsx
  - apps/frontend/src/components/ui/skeleton.tsx
  - apps/frontend/src/components/ui/separator.tsx
  - apps/frontend/src/components/ui/__tests__/campos-acoes-gestor-beauty.test.tsx
  - apps/frontend/src/components/ui/__tests__/superficies-gestor-beauty.test.tsx
  - apps/frontend/src/features/operations/pages/PrevisaoPage.tsx
  - apps/frontend/src/features/operations/components/ForecastCard.tsx
  - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
  - apps/frontend/src/features/operations/components/calendar/types.ts
  - apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts
  - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
  - apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx
  - apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx
  - apps/frontend/src/features/bridal/components/BridalPersonFields.tsx
  - apps/frontend/src/pages/DashboardPlaceholder.tsx
  - apps/frontend/src/features/auth/components/AuthCard.tsx
  - apps/frontend/src/features/admin/pages/AdminClientsPage.tsx
  - apps/frontend/src/features/auth/pages/ChangePasswordPage.tsx
  - apps/frontend/src/components/ImpersonationBanner.tsx
  - .gitignore
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "Todas as telas usam Public Sans no texto e Source Serif 4 em h1/h2, e o index.html não carrega mais Inter (D-07)"
    - "O fundo da página é #F7F6F3, as superfícies são brancas com borda #E2DFE5 e o texto principal é #221E26 / secundário #6B6670 em todo tom de neutral usado no código (D-04, D-05)"
    - "Nenhum componente compartilhado tem sombra; o raio é 6 px em botões, campos, cartões, diálogos, menus e badges (D-08, D-09)"
    - "Botões, campos, selects, itens de menu suspenso e abas têm pelo menos 44 px de altura (D-10)"
    - "Campo em foco ganha borda roxa de 1,5 px sem halo; os demais elementos mantêm o anel de foco visível (D-14)"
    - "Os testes de regressão da fase 5 (UX-01 a UX-19) continuam passando (D-22)"
    - "Nenhum arquivo do frontend usa cor da paleta padrão do Tailwind, sombra ou a fonte Inter, fora de uma lista de exceção que os lotes 06-02, 06-03 e 06-09 esvaziam (D-04, D-07, D-09, D-12)"
  artifacts:
    - path: "apps/frontend/tailwind.config.ts"
      provides: "Tokens Gestor Beauty (cores, fontes, tamanhos, raio, sombra)"
      contains: "Source Serif 4"
    - path: "apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts"
      provides: "Trava dos tokens, fontes e foco"
    - path: "apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts"
      provides: "Varredura que falha se voltar cor antiga, cor da paleta padrão do Tailwind, sombra ou Inter (com lista de exceção temporária por lote)"
      contains: "PALETA_PENDENTE"
    - path: "apps/frontend/src/components/ui/__tests__/campos-acoes-gestor-beauty.test.tsx"
      provides: "Classes de botão, badge, campos, select, rótulo e avatar"
    - path: "apps/frontend/src/components/ui/__tests__/superficies-gestor-beauty.test.tsx"
      provides: "Classes de cartão, tabela, diálogo, folha, abas, menus, comando e toast"
    - path: "apps/frontend/src/lib/field-classes.ts"
      provides: "NATIVE_SELECT_CLASS e FIELD_LABEL_CLASS compartilhados"
      exports: ["NATIVE_SELECT_CLASS", "FIELD_LABEL_CLASS"]
  key_links:
    - from: "apps/frontend/src/lib/cn.ts"
      to: "apps/frontend/tailwind.config.ts"
      via: "classGroups font-size com todos os tamanhos novos (senão o tailwind-merge descarta a cor do texto, UX-01)"
      pattern: "headline-lg"
    - from: "apps/frontend/index.html"
      to: "fonts.googleapis.com"
      via: "link com Source Serif 4 (600) e Public Sans (400;500;600)"
      pattern: "Public\\+Sans:wght@400;500;600"
---

<objective>
Primeira metade do lote base da fase 6 (D-03): troca os tokens visuais e os componentes compartilhados para o sistema "Studio Editorial Density" do projeto Stitch Gestor Beauty. Depois deste plano, toda tela do SGS já usa as fontes novas, as cores novas, raio de 6 px, nenhuma sombra e alvos de 44 px nos componentes de `components/ui`. O casco (menu lateral, topo, barra inferior, PageHeader) é o plano 06-02, que vai ao staging junto com este (este plano faz commit local, sem push).

Decisão de implementação (Claude's Discretion do CONTEXT): **manter os nomes de token atuais** (`primary-*`, `neutral-*`, `success-*`, `error-*`, `warning-*`, `text-label/body/heading/display`) e trocar os valores, e criar só os nomes que faltam (`font-serif`, `text-headline-lg/md/sm`, `text-overline`, `text-data`, `text-display-lg`, `info-*`, `status-*`). Assim os testes de classe da fase 5 (ex.: `text-neutral-600`, `bg-primary text-white`, `h-11 w-11`) continuam valendo e nenhuma classe espalhada nas páginas fica com a cor antiga.

Só visual (D-01): nenhuma consulta GraphQL, regra, permissão ou migration muda. Todo texto visível em português do Brasil com acentos.

Purpose: base visual única para os lotes de tela.
Output: tokens e componentes novos (campos/ações e superfícies em tarefas separadas), varredura de cores antigas, paleta padrão, sombras e Inter, gate (typecheck, lint, Vitest e E2E) e commit local `feat(06-01)` (sem push).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/design/DESIGN.md
@.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md

<armadilhas>
- NUNCA rodar `prettier --write` em arquivo existente do frontend (não há configuração de prettier; os arquivos são formatados à mão, aspas simples, ~100 colunas). Editar só as linhas necessárias.
- Não exportar função que não é componente de arquivo `.tsx` de componente (eslint `react-refresh/only-export-components`): constantes/helpers vão para `src/lib/*.ts`.
- `extend.colors.neutral` do Tailwind se MISTURA com a paleta neutral padrão: tons não declarados (100, 300, 400, 600, 700, 900) continuam cinza antigo. Por isso o mapa abaixo declara TODOS os tons usados no código (0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 — contagem feita com grep no planejamento).
- `success`, `error` e `warning` não existem na paleta padrão do Tailwind: hoje `text-error-600`, `bg-success-50`, `text-warning-700` etc. não geram CSS nenhum. O mapa abaixo declara a escala inteira para que essas classes passem a existir.
- `cn()` usa `extendTailwindMerge`: todo tamanho de fonte novo precisa ser registrado em `src/lib/cn.ts`, senão `text-headline-lg` é tratado como cor e derruba `text-white` (regressão UX-01).
- Testes de regressão UX-01..UX-19 da fase 5 precisam continuar verdes (ex.: `contraste-primario.test.tsx`, `clientes-page.test.tsx`, `financeiro-page.test.tsx`, `ux-comanda-lote1/2.test.tsx`, `visit-form-scroll.test.tsx`, `comanda-list-page.test.tsx`).
</armadilhas>

<interfaces>
Arquivos atuais (lidos no planejamento):
- `apps/frontend/tailwind.config.ts`: `extend.colors` com primary {50,200,300,500,700,900}, success/warning/error só 500, neutral {0,50,200,500,800}, `fontFamily.sans: ['Inter', …]`, `fontSize: label 14 / body 16 / heading 20 / display 24`, `borderRadius: lg 12, md 8, sm 4`, `boxShadow.card`.
- `apps/frontend/src/lib/cn.ts`: `extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] } } })`.
- `apps/frontend/src/styles/globals.css`: variáveis `--color-*` antigas, `--border: 41 14% 87%`, `--ring: 245 53% 56%`, `*:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }`.
- `apps/frontend/index.html` linha 10: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />`.
- `components/ui/card.tsx`: `Card` tem `max-w-[400px]` por padrão (páginas sobrescrevem com `max-w-none`; manter o padrão).
- Selects nativos com constante própria `SELECT_CLASS`: `VisitFormDialog.tsx:61`, `AddItemDialog.tsx:35`, `TimeBlockDialog.tsx:40`, `BridalPersonFields.tsx:13`.
- Cores antigas fixas no código: `PrevisaoPage.tsx:24-25` (`GREEN '#1D9E75'`, `RED '#B42318'`), `ForecastCard.tsx:13-14,142-143` (mesmas; 143 é o Bar de saídas com `#B42318`), `FinanceiroPage.tsx:222` (`fill="#1D9E75"`), `calendar/types.ts:30-36` (`PROFESSIONAL_COLORS` com `#5D54C7 #1D9E75 #EF9F27 #D85A30 #3C3489`), `calendar/appointment-statuses.ts:4` (`#1D9E75`), `DashboardPlaceholder.tsx:38,45,68,81,82` (`#5D54C7`, `#1D9E75`, `#D85A30`), `AuthCard.tsx:15` (`shadow-card`), `text-red-600` em `AdminClientsPage.tsx` (7x) e `ChangePasswordPage.tsx` (3x), `bg-amber-100 text-amber-900` em `components/ImpersonationBanner.tsx:23`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tokens Gestor Beauty (Tailwind, CSS global, fontes, tailwind-merge) com teste de trava</name>
  <files>apps/frontend/tailwind.config.ts, apps/frontend/src/styles/globals.css, apps/frontend/index.html, apps/frontend/src/lib/cn.ts, apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts, .gitignore</files>
  <read_first>
    - apps/frontend/tailwind.config.ts
    - apps/frontend/src/styles/globals.css
    - apps/frontend/index.html
    - apps/frontend/src/lib/cn.ts
    - apps/frontend/src/components/ui/__tests__/contraste-primario.test.tsx (padrão de teste que lê arquivo com readFileSync)
    - .planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md (seções 1, 2 e 3)
    - .planning/phases/06-novo-layout-gestor-beauty/design/DESIGN.md (tipografia e Elevation)
    - .gitignore (linhas 71-73, bloco da auditoria da fase 5)
  </read_first>
  <behavior>
    - `tokens-gestor-beauty.test.ts` lê `tailwind.config.ts`, `globals.css` e `index.html` com `readFileSync(join(__dirname, '../../../<arquivo>'))` (não importa o config: ele fica fora do `include` do tsconfig).
    - Falha se `index.html` contém `family=Inter`; exige `family=Source+Serif+4:wght@600` e `family=Public+Sans:wght@400;500;600` e `display=swap`.
    - Exige no config: `'"Public Sans"'`, `'"Source Serif 4"'`, `'#F7F6F3'`, `'#E2DFE5'`, `'#221E26'`, `'#6B6670'`, `'#440064'`, `'#1B7A43'`, `'#BA1A1A'`, `'#0E61A8'`, `'#49454F'`; as chaves neutral `100`, `300`, `400`, `600`, `700`, `900` declaradas; e não contém `Inter`, `#1D9E75`, `#D85A30`, `#888780`, `#2C2C2A`, `#FAFAF8`, `#E5E3DC`, `#3D005A`, `#2B003F`, `12px` (raio antigo) nem `rgba(0,0,0,0.08)`.
    - Exige em `globals.css`: `--border: 270 10% 89%`, `--ring: 281 100% 25%`, a regra de foco de campo com `box-shadow: inset 0 0 0 0.5px` e o `*:focus-visible` com `outline: 2px solid` (anel visível nos demais elementos, D-14).
    - `cn('bg-primary text-white', 'text-headline-lg')` mantém `text-white` e `text-headline-lg`; o mesmo para `text-overline`, `text-data`, `text-headline-md`, `text-headline-sm`, `text-display-lg`.
  </behavior>
  <action>
1. Escrever `apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts` conforme o behavior (falha antes).
2. `index.html`: trocar a linha 10 por `<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=Source+Serif+4:wght@600&display=swap" rel="stylesheet" />` (os dois `preconnect` ficam). Nenhuma outra referência a Inter fica no projeto (D-07).
3. `tailwind.config.ts`, dentro de `theme.extend` (manter `darkMode`, `content`, `container`, `spacing` e o plugin):
   - `colors`:
     - `border: 'hsl(var(--border))'`, `input: 'hsl(var(--border))'`, `ring: 'hsl(var(--ring))'`, `background: 'var(--color-background)'`, `foreground: 'var(--color-text)'` (iguais).
     - `primary: { 50: '#F5E6FB', 100: '#EBD3F5', 200: '#E0B8F0', 300: '#C98EE3', 500: '#570080', 600: '#4D0072', 700: '#440064', 900: '#370053', DEFAULT: '#570080', foreground: '#FFFFFF' }` (D-06: hover da ação principal `#440064` = `primary-700`).
     - `success: { 50: '#E8F3EC', 100: '#D1E7D9', 200: '#A9D3B8', 300: '#7DBB94', 500: '#1B7A43', 600: '#176A3A', 700: '#125530', DEFAULT: '#1B7A43' }` (D-12).
     - `error: { 50: '#FFDAD6', 100: '#FFDAD6', 200: '#FFB4AB', 300: '#F58E84', 500: '#BA1A1A', 600: '#BA1A1A', 700: '#93000A', DEFAULT: '#BA1A1A' }` (D-12; `#BA1A1A` sobre branco tem contraste AA).
     - `warning: { 50: '#FDF3E3', 100: '#FBE7C6', 200: '#F7D29A', 300: '#F3BC67', 500: '#EF9F27', 600: '#B36F0F', 700: '#8A5300', DEFAULT: '#EF9F27' }` (D-12: âmbar em ícone/borda, texto `warning-700`).
     - `info: { 500: '#0E61A8', DEFAULT: '#0E61A8' }`.
     - `status: { scheduled: '#570080', confirmed: '#1B7A43', progress: '#0E61A8', done: '#49454F', missed: '#BA1A1A' }` (D-11).
     - `destructive: { DEFAULT: '#BA1A1A', foreground: '#FFFFFF' }`.
     - `neutral: { 0: '#FFFFFF', 50: '#F7F6F3', 100: '#F4F3F0', 200: '#E2DFE5', 300: '#CFCAD3', 400: '#6B6670', 500: '#6B6670', 600: '#6B6670', 700: '#221E26', 800: '#221E26', 900: '#221E26' }` (D-04/D-05: só dois tons de texto; 50 = papel, 100 = superfície baixa, 200 = linha).
     - `muted: { DEFAULT: '#F4F3F0', foreground: '#6B6670' }`, `accent: { DEFAULT: '#F5E6FB', foreground: '#440064' }`, `card: { DEFAULT: '#FFFFFF', foreground: '#221E26' }`, `popover: { DEFAULT: '#FFFFFF', foreground: '#221E26' }`, `secondary: { DEFAULT: '#F7F6F3', foreground: '#221E26' }`.
   - `fontFamily: { sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'], serif: ['"Source Serif 4"', 'Georgia', 'ui-serif', 'serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] }`.
   - `fontSize` (substituir o comentário "UI-SPEC mandates exactly 4 sizes" por "Escala Gestor Beauty (06-UI-SPEC §2)"): `label: ['13px', { lineHeight: '18px', fontWeight: '600' }]`, `body: ['14px', { lineHeight: '20px', fontWeight: '400' }]`, `heading: ['20px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' }]`, `display: ['28px', { lineHeight: '36px', fontWeight: '600', letterSpacing: '-0.01em' }]`, `'display-lg': ['36px', { lineHeight: '44px', fontWeight: '600', letterSpacing: '-0.02em' }]`, `'headline-lg': ['26px', { lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.015em' }]`, `'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' }]`, `'headline-sm': ['17px', { lineHeight: '24px', fontWeight: '600' }]`, `overline: ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.04em' }]`, `data: ['13px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '0.02em' }]`.
   - `borderRadius: { none: '0px', sm: '6px', DEFAULT: '6px', md: '6px', lg: '6px', xl: '6px', '2xl': '6px', '3xl': '6px', full: '9999px' }` (D-08: raio único; `rounded-full` só avatar e ponto).
   - `boxShadow: { sm: '0 0 #0000', DEFAULT: '0 0 #0000', md: '0 0 #0000', lg: '0 0 #0000', xl: '0 0 #0000', '2xl': '0 0 #0000', inner: '0 0 #0000', card: '0 0 #0000' }` (D-09; usar `0 0 #0000` e não `none`, porque o Tailwind monta uma lista de box-shadow junto com o ring e `none` dentro de lista é CSS inválido).
4. `globals.css`, bloco `:root`: `--color-primary-50: #F5E6FB; --color-primary-500: #570080; --color-primary-700: #440064; --color-primary-900: #370053; --color-success-500: #1B7A43; --color-warning-500: #EF9F27; --color-error-500: #BA1A1A; --color-info-500: #0E61A8; --color-neutral-0: #FFFFFF; --color-neutral-50: #F7F6F3; --color-neutral-100: #F4F3F0; --color-neutral-200: #E2DFE5; --color-neutral-500: #6B6670; --color-neutral-800: #221E26;` (as aliases `--color-background/surface/text/text-muted/border` continuam apontando para neutral-50/0/800/500/200), `--border: 270 10% 89%;` e `--ring: 281 100% 25%;` (HSL de `#E2DFE5` e `#570080`). Em `body` acrescentar `font-size: 14px; line-height: 20px;` depois do `@apply`. Acrescentar dentro de `@layer base`:
   - `h1, h2 { font-family: theme('fontFamily.serif'); font-weight: 600; }` (D-07: títulos de página e de seção em serifa; CardTitle e DialogTitle renderizam h2).
   - Manter `*:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }`.
   - Depois dele: `input:not([type='checkbox']):not([type='radio']):focus-visible, select:focus-visible, textarea:focus-visible { outline: none; border-color: var(--color-primary-500); box-shadow: inset 0 0 0 0.5px var(--color-primary-500); }` (D-14: 1 px de borda + 0,5 px interno = 1,5 px, sem halo).
5. `src/lib/cn.ts`: `'font-size': [{ text: ['label', 'body', 'heading', 'display', 'display-lg', 'headline-lg', 'headline-md', 'headline-sm', 'overline', 'data'] }]` e atualizar o comentário para citar os tamanhos novos.
6. `.gitignore`: logo abaixo da linha da evidência da fase 5, acrescentar `# Fase 6 — screenshots de comparação com o Stitch (auditoria local)` e `.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/styles/__tests__/tokens-gestor-beauty.test.ts src/components/ui/__tests__/contraste-primario.test.tsx && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Inter" apps/frontend/index.html apps/frontend/tailwind.config.ts` retorna 0 nos dois
    - `grep -n "Public+Sans:wght@400;500;600&family=Source+Serif+4:wght@600&display=swap" apps/frontend/index.html` encontra 1 linha
    - `grep -nE "#1D9E75|#D85A30|#888780|#2C2C2A|#FAFAF8|#E5E3DC|#3D005A|#2B003F" apps/frontend/tailwind.config.ts apps/frontend/src/styles/globals.css` não encontra nada
    - `grep -n "600: '#6B6670'" apps/frontend/tailwind.config.ts` e `grep -n "700: '#221E26'" apps/frontend/tailwind.config.ts` encontram as linhas do neutral
    - `grep -n "headline-lg" apps/frontend/src/lib/cn.ts` encontra o registro
    - `grep -n "inset 0 0 0 0.5px" apps/frontend/src/styles/globals.css` encontra a regra de foco de campo
    - `grep -n "06-audit-evidence" .gitignore` encontra a linha
    - `tokens-gestor-beauty.test.ts` e `contraste-primario.test.tsx` passam
  </acceptance_criteria>
  <done>Tokens, fontes e foco do Gestor Beauty no lugar, travados por teste (D-04 a D-09, D-14).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Componentes de campo e ação (botão, badge, campos, select, rótulo, formulário, rádio, avatar) e classes de campo compartilhadas</name>
  <files>apps/frontend/src/components/ui/button-variants.ts, apps/frontend/src/components/ui/badge-variants.ts, apps/frontend/src/components/ui/input.tsx, apps/frontend/src/components/ui/textarea.tsx, apps/frontend/src/components/ui/select.tsx, apps/frontend/src/components/ui/label.tsx, apps/frontend/src/components/ui/form.tsx, apps/frontend/src/components/ui/radio-group.tsx, apps/frontend/src/components/ui/entity-avatar.tsx, apps/frontend/src/lib/field-classes.ts, apps/frontend/src/components/ui/__tests__/campos-acoes-gestor-beauty.test.tsx</files>
  <read_first>
    - Cada arquivo de `apps/frontend/src/components/ui/` listado em files (versão atual, antes de editar)
    - apps/frontend/src/components/ui/__tests__/contraste-primario.test.tsx
    - .planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md (seção 4, Componentes: botão, campo, select, badge)
  </read_first>
  <behavior>
    - `campos-acoes-gestor-beauty.test.tsx` (Vitest + Testing Library):
      - `Button` padrão tem `bg-primary`, `text-white`, `hover:bg-primary-700`, `rounded-md`, `min-h-[44px]`; `variant="outline"` tem `bg-white border-neutral-200 text-neutral-800`; `variant="ghost"` tem `text-neutral-500`; `size="icon"` tem `h-11 w-11`; nenhum variant/size tem classe que case `/(^|\s)shadow/`.
      - `Input`, `Textarea` e `SelectTrigger` têm `h-11` (textarea: `min-h-[88px]`), `rounded-md`, `border-neutral-200`, `bg-white`, `focus-visible:border-primary-500` (SelectTrigger: `focus:border-primary-500`) e NÃO têm `ring-2`/`ring-1`/`shadow-sm`.
      - `SelectItem` (com o `Select` aberto) tem `min-h-[44px]`.
      - `Label` tem `text-overline uppercase text-neutral-500`.
      - `Badge variant="success"` tem `bg-neutral-50`, `border-neutral-200` e `before:bg-success-500`; nenhum variant de Badge tem `shadow`.
      - `EntityAvatar kind="client"` tem `rounded-full`; outro `kind` tem `rounded-md`.
      - `NATIVE_SELECT_CLASS` (de `@/lib/field-classes`) contém `h-11`, `rounded-md`, `border-neutral-200` e `focus-visible:border-primary-500`; `FIELD_LABEL_CLASS` é `'text-overline uppercase text-neutral-500'`.
  </behavior>
  <action>
1. Escrever o teste (falha antes).
2. `button-variants.ts` (D-06, D-10, 06-UI-SPEC §4): base `'inline-flex items-center justify-center gap-xs rounded-md text-label font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-5'`; variants: `default: 'bg-primary text-white hover:bg-primary-700 active:bg-primary-900'`, `destructive: 'bg-error-500 text-white hover:bg-error-700'`, `outline: 'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 hover:border-neutral-500'`, `secondary: 'border border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100'`, `ghost: 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'`, `link` igual ao atual; sizes: `default: 'h-11 px-5'`, `sm: 'h-11 px-md text-label'`, `lg: 'h-12 px-xl'`, `icon: 'h-11 w-11 px-0'`, `full: 'h-11 w-full px-5'`.
3. `badge-variants.ts` (D-08, D-11): base `'inline-flex min-h-6 items-center gap-xs rounded-md border border-neutral-200 bg-neutral-50 px-sm py-0.5 text-[12px] font-semibold leading-4 text-neutral-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'`; variants: `default: 'border-primary bg-primary text-white'`, `secondary: 'bg-neutral-100'`, `destructive: 'border-error-500 bg-error-500 text-white'`, `outline: 'bg-white'`, e os de status com ponto de 6 px: `success`, `warning`, `error`, `info` e `neutral` = `"before:content-[''] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-<cor>"` com `<cor>` = `success-500`, `warning-500`, `error-500`, `info-500`, `status-done`. Sem `shadow` em nenhum.
4. `input.tsx`: classes `'flex h-11 min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-[14px] py-sm text-body text-neutral-800 placeholder:text-neutral-500'`, `'focus-visible:outline-none focus-visible:border-primary-500 focus-visible:shadow-[inset_0_0_0_0.5px_#570080]'`, `'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-neutral-100'`, `'aria-[invalid=true]:border-error-500'` (tirar `ring-*`). `textarea.tsx`: `'flex min-h-[88px] w-full rounded-md border border-neutral-200 bg-white px-[14px] py-[10px] text-body text-neutral-800 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:shadow-[inset_0_0_0_0.5px_#570080] disabled:cursor-not-allowed disabled:opacity-50'` (sem `shadow-sm`, sem `text-base`).
5. `select.tsx`: `SelectTrigger` → `'flex h-11 w-full items-center justify-between whitespace-nowrap rounded-md border border-neutral-200 bg-white px-[14px] text-body text-neutral-800 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 focus:shadow-[inset_0_0_0_0.5px_#570080] data-[state=open]:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1'`, ícone `h-4 w-4 text-neutral-500`; `SelectContent` sem `shadow-md` e com `bg-white border-neutral-200 rounded-md`; `SelectItem` → `'relative flex min-h-[44px] w-full cursor-default select-none items-center rounded-md py-sm pl-8 pr-2 text-body outline-none focus:bg-neutral-50 focus:text-neutral-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'`; `SelectLabel` → `'px-sm py-1.5 text-overline uppercase text-neutral-500'`; `SelectSeparator` `bg-neutral-200`.
6. Criar `src/lib/field-classes.ts` (fora de `.tsx`, regra react-refresh), usado pelos selects nativos na Task 4:
   - `export const NATIVE_SELECT_CLASS = 'flex h-11 min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-[14px] text-body text-neutral-800 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:shadow-[inset_0_0_0_0.5px_#570080] disabled:cursor-not-allowed disabled:opacity-50';`
   - `export const FIELD_LABEL_CLASS = 'text-overline uppercase text-neutral-500';` (D-13: só rótulo curto de campo; nunca em nome de pessoa).
7. `label.tsx` (D-13): `labelVariants` → `'text-overline uppercase text-neutral-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-70'`. `form.tsx`: `FormDescription` → `'text-[12px] leading-4 text-neutral-500'`; `FormMessage` → `'text-[12px] leading-4 font-semibold text-error-600'`; `FormLabel` com erro `text-error-600`.
8. `radio-group.tsx`: item → `'aspect-square h-4 w-4 rounded-full border-[1.5px] border-neutral-200 bg-white text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary'` (sem `shadow`).
9. `entity-avatar.tsx`: com `kind === 'client'` usar `rounded-full` (avatar de pessoa, D-08); os demais tipos mantêm `rounded-md`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/components/ui && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "shadow-(sm|md|lg|xl|card)|\bshadow\b" apps/frontend/src/components/ui/button-variants.ts apps/frontend/src/components/ui/badge-variants.ts apps/frontend/src/components/ui/input.tsx apps/frontend/src/components/ui/textarea.tsx apps/frontend/src/components/ui/select.tsx apps/frontend/src/components/ui/radio-group.tsx` só encontra `shadow-[inset_0_0_0_0.5px_#570080]` (campos)
    - `grep -n "text-overline uppercase text-neutral-500" apps/frontend/src/components/ui/label.tsx apps/frontend/src/lib/field-classes.ts` encontra os dois
    - `grep -n "export const NATIVE_SELECT_CLASS" apps/frontend/src/lib/field-classes.ts` encontra a constante
    - `campos-acoes-gestor-beauty.test.tsx` e `contraste-primario.test.tsx` passam; lint sem aviso
  </acceptance_criteria>
  <done>Botões, badges, campos, selects e rótulos sem sombra, raio 6 px, 44 px e rótulo em maiúsculas pequenas (D-06, D-08, D-10, D-13, D-14).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Superfícies compartilhadas (cartão, tabela, diálogo, folha, abas, menus, comando, dica, toast, alerta, esqueleto, separador)</name>
  <files>apps/frontend/src/components/ui/card.tsx, apps/frontend/src/components/ui/table.tsx, apps/frontend/src/components/ui/data-table.tsx, apps/frontend/src/components/ui/dialog.tsx, apps/frontend/src/components/ui/alert-dialog.tsx, apps/frontend/src/components/ui/sheet.tsx, apps/frontend/src/components/ui/tabs.tsx, apps/frontend/src/components/ui/dropdown-menu.tsx, apps/frontend/src/components/ui/popover.tsx, apps/frontend/src/components/ui/command.tsx, apps/frontend/src/components/ui/tooltip.tsx, apps/frontend/src/components/ui/sonner.tsx, apps/frontend/src/components/ui/alert.tsx, apps/frontend/src/components/ui/skeleton.tsx, apps/frontend/src/components/ui/separator.tsx, apps/frontend/src/components/ui/__tests__/superficies-gestor-beauty.test.tsx</files>
  <read_first>
    - Cada arquivo de `apps/frontend/src/components/ui/` listado em files (versão atual, antes de editar)
    - apps/frontend/src/components/ui/__tests__/data-table.test.tsx
    - .planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md (seção 4, Componentes: cartão, tabela, diálogo, folha, abas, toast)
  </read_first>
  <behavior>
    - `superficies-gestor-beauty.test.tsx` (Vitest + Testing Library):
      - `Card` não tem `shadow-card` e tem `rounded-md border-neutral-200 bg-white`; `CardTitle` tem `font-serif`.
      - `TableHead` tem `text-overline uppercase bg-neutral-100`; `TableCell` tem `tabular-nums`.
      - `DialogContent` aberto: conteúdo sem `shadow-lg`, com `rounded-md`; overlay com `bg-[rgba(34,30,38,0.40)]`; botão "Fechar" com `h-11 w-11`; `DialogTitle` com `font-serif text-headline-md`.
      - `SheetContent` aberto: sem `shadow-lg`, overlay `bg-[rgba(34,30,38,0.40)]`, botão de fechar com nome acessível "Fechar" (não "Close") e `h-11 w-11`.
      - `TabsTrigger` tem `min-h-[44px]` e `data-[state=active]:bg-primary data-[state=active]:text-white`.
      - `DropdownMenuItem` (menu aberto) tem `min-h-[44px]`; `CommandItem` (dentro de `Command`) tem `min-h-[44px]` e `rounded-md`.
      - Nenhum elemento renderizado nos casos acima tem classe que case `/(^|\s)(hover:|focus:)?shadow(-(sm|md|lg|xl|card))?(\s|$)/`.
  </behavior>
  <action>
1. Escrever o teste (falha antes).
2. `card.tsx`: `Card` → `'bg-white border border-neutral-200 rounded-md w-full max-w-[400px]'` (sem `shadow-card`; o `max-w-[400px]` padrão fica, as páginas já sobrescrevem); `CardHeader` → `'flex flex-col space-y-xs p-md pb-0'`; `CardTitle` → `'font-serif text-headline-md text-neutral-800'`; `CardDescription` → `'text-body text-neutral-500'`; `CardContent` → `'p-md pt-sm'`; `CardFooter` → `'flex items-center p-md pt-0'` (densidade 8–16 px, 06-UI-SPEC §3).
3. `table.tsx`: `Table` → `'w-full caption-bottom text-body'`; `TableHeader` → `'bg-neutral-100 [&_tr]:border-b [&_tr]:border-neutral-200'`; `TableFooter` → `'border-t border-neutral-200 bg-neutral-100 font-medium [&>tr]:last:border-b-0'`; `TableRow` → `'border-b border-neutral-200 transition-colors hover:bg-neutral-50 data-[state=selected]:bg-neutral-50'`; `TableHead` → `'h-10 px-sm text-left align-middle text-overline uppercase text-neutral-500 bg-neutral-100 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'`; `TableCell` → `'px-sm py-sm align-middle text-body text-neutral-800 tabular-nums [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'`; `TableCaption` `text-[12px] text-neutral-500`. `data-table.tsx`: tirar `text-label text-neutral-500` dos `TableHead` (linhas ~65 e ~110; manter `c.className`) e trocar o indicador de página (linha ~166) por `'inline-flex h-11 min-w-[44px] items-center justify-center rounded-md bg-primary px-sm text-label tabular-nums text-white'`.
4. `dialog.tsx` e `alert-dialog.tsx` (D-09): overlay `'fixed inset-0 z-50 bg-[rgba(34,30,38,0.40)] …'` (mantendo as classes de animação); conteúdo sem `shadow-lg`, `bg-white`, `gap-md`, `rounded-md` (trocar `sm:rounded-lg` por `rounded-md`); botão fechar do Dialog → `'absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none'` com `<X className="h-5 w-5" />` e `sr-only` "Fechar"; títulos → `'font-serif text-headline-md text-neutral-800'`; descrições → `'text-body text-neutral-500'`.
5. `sheet.tsx`: overlay igual ao do diálogo; base `'fixed z-50 gap-md bg-white p-lg transition ease-in-out …'` sem `shadow-lg`; `bottom` com `rounded-t-md border-neutral-200`; `left`/`right`/`top` com `border-neutral-200`; botão fechar igual ao do Dialog com `sr-only` "Fechar" (era "Close"); `SheetTitle` → `'font-serif text-headline-sm text-neutral-800'`; `SheetDescription` → `'text-body text-neutral-500'`.
6. `tabs.tsx` (D-06, D-10): `TabsList` → `'inline-flex flex-wrap items-center gap-xs'`; `TabsTrigger` → `'inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-md border border-neutral-200 bg-white px-md text-body font-medium text-neutral-500 transition-colors hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-semibold'`.
7. `dropdown-menu.tsx` e `popover.tsx`: tirar `shadow-lg`/`shadow-md`, usar `bg-white border-neutral-200 rounded-md`; `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem` e `DropdownMenuSubTrigger` com `min-h-[44px]`, `rounded-md`, `text-body`, `focus:bg-neutral-50 focus:text-neutral-800`; `DropdownMenuLabel` → `text-overline uppercase text-neutral-500`; separador `bg-neutral-200`.
8. `command.tsx` (usado pela busca de páginas do topo): `CommandInput` → `'flex h-11 w-full rounded-md bg-transparent py-3 text-body outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-50'` e o wrapper `border-b border-neutral-200`; `CommandGroup` heading → `[&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-neutral-500` (tirar `text-xs font-medium`); `CommandItem` → `"relative flex min-h-[44px] cursor-default gap-2 select-none items-center rounded-md px-2 py-1.5 text-body outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-neutral-50 data-[selected='true']:text-neutral-800 data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"`; `CommandEmpty` `text-body text-neutral-500`; `CommandShortcut` `text-[12px] tracking-widest text-neutral-500`; `CommandSeparator` `bg-neutral-200`.
9. `tooltip.tsx`: conteúdo `'z-50 overflow-hidden rounded-md bg-neutral-800 px-3 py-1.5 text-[12px] leading-4 text-white …'` (mantendo as animações; `bg-neutral-800` já vira `#221E26` pelo token). `skeleton.tsx`: `'animate-pulse rounded-md bg-neutral-100'`. `separator.tsx`: conferir que fica `bg-neutral-200` (já é; sem mudança se estiver assim).
10. `sonner.tsx` (06-UI-SPEC §4 Toast): tirar `richColors`; `toast: 'group toast group-[.toaster]:bg-white group-[.toaster]:text-neutral-800 group-[.toaster]:border group-[.toaster]:border-neutral-200 group-[.toaster]:rounded-md group-[.toaster]:!shadow-none'`, `description: 'group-[.toast]:text-neutral-500'`, `actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-white'`, `cancelButton: 'group-[.toast]:bg-neutral-100 group-[.toast]:text-neutral-800'`.
11. `alert.tsx`: `default: 'bg-white text-neutral-800 border-neutral-200'`, `destructive: 'border-error-500 bg-error-50 text-error-700 [&>svg]:text-error-500'` e novo `warning: 'border-warning-500 bg-white text-neutral-800 [&>svg]:text-warning-500'`; `AlertTitle` → `'mb-xs text-label font-semibold leading-5'`; `AlertDescription` → `'text-body [&_p]:leading-relaxed'`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/components/ui && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rnE "shadow-(sm|md|lg|xl|card)|\bshadow\b" apps/frontend/src/components/ui/*.ts apps/frontend/src/components/ui/*.tsx` só encontra `!shadow-none` (sonner) e `shadow-[inset_0_0_0_0.5px_#570080]` (campos da Task 2)
    - `grep -n "rounded-lg" apps/frontend/src/components/ui/*.tsx` não encontra nada
    - `grep -n "sr-only\">Close" apps/frontend/src/components/ui/sheet.tsx` não encontra nada e `grep -n "Fechar" apps/frontend/src/components/ui/sheet.tsx` encontra o rótulo
    - `grep -n "richColors" apps/frontend/src/components/ui/sonner.tsx` não encontra nada
    - `grep -n "min-h-\[44px\]" apps/frontend/src/components/ui/command.tsx apps/frontend/src/components/ui/dropdown-menu.tsx` encontra os dois
    - `grep -n "text-overline uppercase text-neutral-500" apps/frontend/src/components/ui/table.tsx` encontra o `TableHead`
    - `superficies-gestor-beauty.test.tsx`, `campos-acoes-gestor-beauty.test.tsx`, `contraste-primario.test.tsx` e `data-table.test.tsx` passam; lint sem aviso
  </acceptance_criteria>
  <done>Cartões, tabelas, diálogos, folhas, abas, menus, comando, dica e toast sem sombra, raio 6 px, 44 px e títulos em serifa (D-06 a D-10).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Varredura das cores antigas, da paleta padrão do Tailwind, de sombras e de Inter fora dos componentes; gate e commit local do 06-01</name>
  <files>apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts, apps/frontend/src/features/operations/pages/PrevisaoPage.tsx, apps/frontend/src/features/operations/components/ForecastCard.tsx, apps/frontend/src/features/operations/pages/FinanceiroPage.tsx, apps/frontend/src/features/operations/components/calendar/types.ts, apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts, apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx, apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx, apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx, apps/frontend/src/features/bridal/components/BridalPersonFields.tsx, apps/frontend/src/pages/DashboardPlaceholder.tsx, apps/frontend/src/features/auth/components/AuthCard.tsx, apps/frontend/src/features/admin/pages/AdminClientsPage.tsx, apps/frontend/src/features/auth/pages/ChangePasswordPage.tsx, apps/frontend/src/components/ImpersonationBanner.tsx</files>
  <read_first>
    - Os arquivos listados em files (versão atual)
    - apps/frontend/src/features/operations/__tests__/previsao-page.test.tsx e forecast-card.test.tsx (conferir se algum teste compara a cor antiga; se comparar, atualizar o valor esperado para o novo)
    - apps/frontend/src/pages/__tests__/dashboard-placeholder.test.tsx
    - apps/frontend/src/components/__tests__/ (se houver teste do ImpersonationBanner, conferir as classes esperadas)
  </read_first>
  <behavior>
    - `sem-cor-antiga.test.ts` percorre recursivamente `apps/frontend/src` (fs.readdirSync), ignorando pastas `__tests__`, `gql` e arquivos `*.test.ts(x)`, só arquivos `.ts`, `.tsx` e `.css`, e falha listando `arquivo:linha` (caminho relativo a `src/`) em quatro regras:
      1. **Hex/classes antigas** (sem diferenciar maiúsculas, sem lista de exceção): `#1D9E75`, `#D85A30`, `#888780`, `#2C2C2A`, `#FAFAF8`, `#E5E3DC`, `#3D005A`, `#2B003F`, `#B42318`, `#5D54C7`, `#3C3489`, `shadow-card`, `text-red-600`.
      2. **Paleta padrão do Tailwind**: `/\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/` (pega também com prefixo de variante, ex.: `hover:bg-amber-100`).
      3. **Sombras** (só `.ts`/`.tsx`): cada token de classe (separar a linha por espaço, aspas e crase), tirar os prefixos de variante (tudo até o último `:` fora de `[...]`) e o `!` inicial; se o resto começa com `shadow` e não é `shadow-none` nem `shadow-[inset_0_0_0_0.5px_#570080]` (contorno de foco de campo do D-14), é violação. Pega `shadow`, `shadow-sm|md|lg|xl|2xl|inner`, `shadow-[…]` e `hover:shadow-*`.
      4. **Fonte antiga**: `/\bInter\b/` (sensível a maiúsculas: `interface` não conta).
    - Lista de exceção temporária, só para as regras 2 e 3, no topo do teste, com o lote que remove cada entrada:
      ```ts
      // Arquivos que ainda têm paleta padrão ou sombra e são refeitos num lote seguinte.
      // Cada lote remove a sua entrada; o teste falha se uma entrada ficar sobrando.
      const PALETA_PENDENTE: Record<string, string> = {
        'features/operations/lib/operations-labels.ts': '06-03',
        'features/bridal/pages/BridalGroupDetailPage.tsx': '06-09',
      };
      const SOMBRA_PENDENTE: Record<string, string> = {
        'components/layout/BottomNav.tsx': '06-02',
        'components/layout/ChatBubble.tsx': '06-02',
        'components/layout/IconRail.tsx': '06-02',
        'features/operations/components/calendar/AppointmentCard.tsx': '06-03',
        'features/operations/pages/SchedulePage.tsx': '06-03',
      };
      ```
    - Entrada sobrando falha: um `it` confere que cada arquivo das listas existe e ainda tem pelo menos uma ocorrência da regra correspondente; senão falha com "remova `<arquivo>` de PALETA_PENDENTE/SOMBRA_PENDENTE (lote <lote>)". Isso obriga o 06-02, o 06-03 e o 06-09 a tirarem a própria entrada.
  </behavior>
  <action>
1. Antes de escrever o teste, confirmar que a lista de exceção está completa (a varredura tem que passar no fim deste plano). Na raiz `/root/sgs`:
   - `grep -rnE "(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" apps/frontend/src --include=*.ts --include=*.tsx --include=*.css | grep -v __tests__ | grep -v "\.test\."`
   - `grep -rnoE "shadow[a-z0-9_\[\]#.()-]*" apps/frontend/src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v "\.test\."`
   - `grep -rnw "Inter" apps/frontend/src --include=*.ts --include=*.tsx --include=*.css | grep -v __tests__`
   No planejamento (06/11) o resultado foi: paleta em `ImpersonationBanner.tsx` (2), `AdminClientsPage.tsx` (7), `ChangePasswordPage.tsx` (3) — corrigidos aqui —, `BridalGroupDetailPage.tsx` (1, 06-09) e `operations-labels.ts` (15, 06-03); sombras em `components/ui/*` (Tasks 2 e 3), `AuthCard.tsx` (aqui), `BottomNav.tsx`, `ChatBubble.tsx`, `IconRail.tsx` (06-02), `AppointmentCard.tsx` (`shadow-lg` ao arrastar) e `SchedulePage.tsx` (`shadow-sm`, linha ~916) (06-03); nenhum `Inter`. Se aparecer arquivo novo fora dessa lista, corrigir aqui se for troca de cor direta; se o arquivo pertence a um lote de tela seguinte, acrescentar na lista com o lote certo e registrar no SUMMARY.
2. Escrever `sem-cor-antiga.test.ts` (falha antes).
3. Nos 4 arquivos com `const SELECT_CLASS =` (`VisitFormDialog.tsx:61`, `AddItemDialog.tsx:35`, `TimeBlockDialog.tsx:40`, `BridalPersonFields.tsx:13`), trocar o valor pelo `NATIVE_SELECT_CLASS` criado na Task 2 (import de `@/lib/field-classes`), preservando classes de layout que o valor antigo tinha além do visual (ex.: `mt-xs`) com template string: `` const SELECT_CLASS = `${NATIVE_SELECT_CLASS} mt-xs`; ``. Só essa linha (e o import) muda nesses arquivos (o restante do formulário de agendamento é o lote 06-04).
4. Cores fixas (D-12):
   - `PrevisaoPage.tsx` e `ForecastCard.tsx`: `const GREEN = '#1B7A43';` e `const RED = '#BA1A1A';`; no `ForecastCard` o `<Bar dataKey="inflow">` (linha ~142) passa a `fill={GREEN}` e o `<Bar dataKey="outflow">` (linha ~143, hoje `fill="#B42318"`) passa a `fill={RED}`.
   - `FinanceiroPage.tsx:222`: `fill="#1B7A43"` no Bar "Recebido".
   - `calendar/types.ts`: `PROFESSIONAL_COLORS = ['#570080', '#1B7A43', '#0E61A8', '#49454F', '#8A5300']` (todas aceitam texto branco com contraste AA; o lote 06-03 refaz os avatares).
   - `calendar/appointment-statuses.ts`: cores por D-11: `absent` `#E2DFE5`/texto `#221E26`; `scheduled` `#570080`; `confirmed` `#1B7A43`; `no_show` `#BA1A1A`; `in_progress` `#0E61A8`; `completed` `#49454F` (hoje `#5D54C7`, linha 7); `cancelled` `#BA1A1A` com `textOnColor: '#FFFFFF'`; fallback de `statusColor` `'#6B6670'`.
   - `DashboardPlaceholder.tsx`: `#5D54C7` → `#570080` (linhas ~38 e ~82, "Impostos"), `#3C3489` → `#440064` (se aparecer), `#1D9E75` → `#1B7A43` (~45), `#D85A30` → `#BA1A1A` (~68 e ~81), `#888780` → `#6B6670`, `#2C2C2A` → `#221E26`.
   - `AuthCard.tsx`: tirar `shadow-card` e `rounded-lg` (o `Card` já dá `rounded-md`).
   - `AdminClientsPage.tsx` (7x) e `ChangePasswordPage.tsx` (3x): `text-red-600` → `text-error-600`.
   - `components/ImpersonationBanner.tsx` (D-12, alerta com âmbar só em borda e texto escuro AA): `bg-amber-100 px-4 py-2 text-sm text-amber-900` → `border-b border-warning-500 bg-white px-md py-xs text-body text-warning-700` (`#8A5300` sobre branco ≈ 6,3:1, AA); o botão "Voltar ao painel" ganha `min-h-[44px]` (D-10) e mantém `underline` e o texto.
5. `grep -rn "text-warning-500" apps/frontend/src --include=*.tsx`: onde a classe estiver em TEXTO (não em ícone lucide/`svg`), trocar por `text-warning-700` (D-12: âmbar só em ícone/borda). Ícones ficam.
6. Gate antes do commit (CLAUDE.md/memória do projeto: gate completo antes de commit), na raiz `/root/sgs`:
   - `corepack pnpm -r typecheck`
   - `corepack pnpm -r --if-present lint`
   - `corepack pnpm --filter @sgs/frontend exec vitest run` (inteiro)
   - `corepack pnpm --filter @sgs/e2e test:e2e` (inteiro; o casco ainda é o antigo, então os seletores do IconRail continuam valendo)
   Teste que falhar por comparar classe/valor que este plano trocou de propósito (ex.: cor `#1D9E75` esperada): atualizar o valor esperado; teste de comportamento UX-01..UX-19 que falhar: corrigir o código, não o teste. E2E que falhar por seletor de estilo: ajustar só o seletor (`data-testid` e papéis ARIA ficam). Falha antiga em arquivo não tocado: registrar em `.planning/phases/06-novo-layout-gestor-beauty/deferred-items.md` e não corrigir. Backend não muda neste plano; os testes de backend rodam no gate do 06-02, antes do push.
7. Commit local (sem push; o push e o deploy são no 06-02, depois do gate completo de novo): adicionar os arquivos deste plano um a um (`git add <arquivo>`, nunca `git add .`), mensagem `feat(06-01): tokens e componentes do layout Gestor Beauty` com o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rniE "#1D9E75|#D85A30|#888780|#2C2C2A|#FAFAF8|#E5E3DC|#B42318|#5D54C7|#3C3489|shadow-card|text-red-600" apps/frontend/src --include=*.ts --include=*.tsx --include=*.css | grep -v __tests__` não encontra nada
    - `grep -nE "amber|shadow" apps/frontend/src/components/ImpersonationBanner.tsx apps/frontend/src/features/auth/components/AuthCard.tsx` não encontra nada
    - `grep -n "fill={RED}" apps/frontend/src/features/operations/components/ForecastCard.tsx` encontra o Bar de saídas
    - `grep -n "NATIVE_SELECT_CLASS" apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx apps/frontend/src/features/bridal/components/BridalPersonFields.tsx` encontra os 4 arquivos
    - `grep -n "PALETA_PENDENTE\|SOMBRA_PENDENTE" apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts` encontra as duas listas
    - Typecheck e lint de todo o monorepo, Vitest do frontend inteiro (inclui `sem-cor-antiga.test.ts` e UX-01..UX-19 da fase 5) e E2E inteiro verdes
    - `git log -1 --format=%s` começa com `feat(06-01)` e `git status --short apps/frontend` não lista arquivo deste plano pendente
  </acceptance_criteria>
  <done>Nenhuma cor antiga, cor da paleta padrão, sombra ou Inter fora da lista de exceção (que cada lote esvazia), selects nativos e aviso de acesso com o visual novo, gate verde e commit local pronto para ir ao staging com o 06-02.</done>
</task>

</tasks>

<verification>
- Typecheck e lint do monorepo, Vitest do frontend inteiro e E2E inteiro verdes antes do commit
- Varredura `sem-cor-antiga.test.ts` passa com a lista de exceção mínima (só arquivos de lotes seguintes)
- Commit `feat(06-01)` local, ainda sem push (o 06-02 repete o gate completo, inclusive backend, antes do push, deploy e CI)
</verification>

<success_criteria>
Metade do critério do lote base: toda tela já renderiza com fontes, cores, raio, ausência de sombra e 44 px novos nos componentes compartilhados; falta o casco (06-02).
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-01-SUMMARY.md`
</output>

---
phase: 06-novo-layout-gestor-beauty
plan: 02
type: execute
wave: 2
depends_on: ["06-01"]
files_modified:
  - apps/frontend/src/lib/format-date-long.ts
  - apps/frontend/src/lib/brand.ts
  - apps/frontend/src/lib/__tests__/format-date-long.test.ts
  - apps/frontend/src/lib/__tests__/brand.test.ts
  - apps/frontend/src/components/layout/AppShell.tsx
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/components/layout/TopHeader.tsx
  - apps/frontend/src/components/layout/BottomNav.tsx
  - apps/frontend/src/components/layout/AppDrawer.tsx
  - apps/frontend/src/components/layout/PageHeader.tsx
  - apps/frontend/src/components/layout/ChatBubble.tsx
  - apps/frontend/src/components/layout/IconRail.tsx
  - apps/frontend/src/features/notifications/components/NotificationsBell.tsx
  - apps/frontend/src/infrastructure/stores/auth.store.ts
  - apps/frontend/src/features/auth/hooks/useAuth.ts
  - apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx
  - apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx
  - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
  - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
  - apps/e2e/support/ui.ts
  - apps/e2e/tests/ux-comanda-celular.spec.ts
  - apps/e2e/tests/ux-contraste.spec.ts
  - apps/e2e/audit/ux-contraste-staging.audit.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "No computador há um menu lateral branco de 256 px com a marca do estúdio no topo, grupos com rótulo em maiúsculas pequenas, itens de 44 px, item ativo roxo com texto branco e, no rodapé, o nome da usuária logada (com o papel embaixo) e o botão Sair (D-15)"
    - "O topo no computador é branco com borda inferior e mostra a data por extenso, a busca 'Buscar páginas no SGS', o sino e o avatar, sem seletor de unidade, relógio ou 'Sincronizado' (D-16, D-02)"
    - "No celular o topo mostra a marca do estúdio e a data; a barra inferior tem Agenda, Comanda, Clientes, Noivas e Mais, cada item com 48 px, só os itens permitidos ao papel; 'Mais' abre a gaveta com a árvore completa, Início e Notificações (D-17)"
    - "O PageHeader mostra a trilha em texto pequeno (12 px) sem maiúsculas forçadas, com nomes de cliente e de grupo na caixa em que vieram, o h1 em serifa e as ações quebrando para baixo do título no celular (D-13)"
    - "O lote base (06-01 + 06-02) está no staging com CI verde e todas as telas já usam fontes, cores, raio, ausência de sombra e 44 px novos"
  artifacts:
    - path: "apps/frontend/src/components/layout/SidebarNav.tsx"
      provides: "Menu lateral Gestor Beauty (usado pelo AppShell no computador)"
      contains: "w-64"
    - path: "apps/frontend/src/components/layout/BottomNav.tsx"
      provides: "Barra inferior com Agenda, Comanda, Clientes, Noivas, Mais"
      contains: "Noivas"
    - path: "apps/frontend/src/lib/format-date-long.ts"
      provides: "formatLongDate(date) — 'Quinta-feira, 12 de novembro de 2026'"
      exports: ["formatLongDate"]
    - path: "apps/frontend/src/lib/brand.ts"
      provides: "brandInitials(name) e brandName(orgName)"
      exports: ["brandInitials", "brandName"]
    - path: "apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx"
      provides: "Regressão do casco novo"
  key_links:
    - from: "apps/frontend/src/components/layout/AppShell.tsx"
      to: "apps/frontend/src/components/layout/SidebarNav.tsx"
      via: "aside lg:block w-64 sticky top-0 h-screen (IconRail sai)"
      pattern: "<SidebarNav"
    - from: "apps/frontend/src/components/layout/BottomNav.tsx"
      to: "apps/frontend/src/features/operations/operations-permissions.ts"
      via: "useHasPermission('comanda.read') / useBridalPermission('bridal.read') + isPathEnabled"
      pattern: "useHasPermission\\('comanda.read'\\)"
    - from: "apps/e2e/support/ui.ts"
      to: "apps/frontend/src/components/layout/SidebarNav.tsx"
      via: "navigateViaMenu sem o botão Expandir menu do IconRail"
      pattern: "navigateViaMenu"
---

<objective>
Segunda metade do lote base (D-03): o casco do SGS ganha a navegação do Gestor Beauty — menu lateral branco de 256 px no computador (substitui o IconRail roxo), topo branco com data por extenso, barra inferior do celular com Agenda, Comanda, Clientes, Noivas e Mais (D-17), gaveta "Mais" com a árvore completa e PageHeader com h1 em serifa. A árvore de menu continua a de `menu-config.ts` (mesmos itens, submenus e poda por `config/features`); só o visual muda (D-15). No fim, o lote base inteiro (06-01 + 06-02) passa pelo gate, vai ao staging e o CI fica verde.

D-02: sem seletor de unidade, relógio "10:42 BRT", "Sincronizado", "Online", versão do sistema ou "Trocar estabelecimento" (hoje a gaveta tem esse botão falso e o nome "Studio Beleza" fixo: sai, e entra o nome real da organização).

Purpose: a usuária vê o sistema inteiro com a cara nova no staging.
Output: casco novo, E2E ajustados só onde dependiam do IconRail/rótulos da barra, deploy no staging, `06-02-SUMMARY.md` com a comparação de screenshots.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-01-SUMMARY.md

<armadilhas>
- NUNCA rodar `prettier --write` em arquivo existente do frontend; editar à mão, aspas simples, ~100 colunas.
- Helpers (`formatLongDate`, `brandInitials`) ficam em `src/lib/*.ts`, nunca exportados de `.tsx` de componente (react-refresh/only-export-components).
- Playwright: `getByText('x')` sem `exact` não diferencia maiúsculas; usar `exact: true`. Medições dentro de Sheet/Dialog precisam esperar a animação (`await el.evaluate(n => Promise.all(n.getAnimations({ subtree: true }).map(a => a.finished)))`).
- `innerText` aplica `text-transform`: rótulos em `uppercase` (grupos do menu) mudam o `innerText` mas não o `textContent` nem o nome acessível calculado pelo Playwright. Para nomes estáveis, botões e links do menu recebem `aria-label={item.label}`.
- Testes UX-01..UX-19 da fase 5 continuam valendo (UX-10: nenhum `<li>` dentro de `<li>` no menu, na gaveta e na trilha; `menu-dom.test.tsx`).
- D-13: maiúsculas só em rótulos curtos e cabeçalhos de tabela. A trilha do PageHeader carrega nomes de pessoa e de grupo (`pages/ClienteDetailPage.tsx:51` `toDisplayName(c.fullName)`, `features/clients/components/ClientForm.tsx:281` `initial.fullName`, `features/bridal/pages/BridalGroupDetailPage.tsx:63` `group.name`): NUNCA `uppercase` na trilha.
- O nome da usuária (`fullName`) já vem no payload de login/refresh (`features/auth/api/auth.api.ts`, `session.fullName`), mas hoje o `auth.store` não guarda. Guardar só no front (nenhuma consulta GraphQL muda, D-01).
- `NotificationsBell` usa Apollo: testes que renderizam `TopHeader` precisam de `MockedProvider` (`@apollo/client/testing`).
</armadilhas>

<interfaces>
De `menu-config.ts`: `export interface MenuItem { id; label; to?; icon?: LucideIcon; children?: MenuItem[]; searchTerms?; badge?: 'lowStock' }`, `export const MENU: MenuItem[]` (já podado por `isPathEnabled`). Nível 0 hoje: Início (folha `/dashboard`), Agenda (grupo), Meu Estabelecimento (grupo com subgrupos Clientes, Profissionais, Serviços, Produtos…), Financeiro (grupo), Eventos (grupo: Grupos de Noivas, Contratos).
De `config/features.ts`: `FEATURES`, `HOME_PATH`, `isPathEnabled(to)`. `FEATURES.notificacoes === true`, `FEATURES.dashboard === true`.
De `infrastructure/stores/auth.store.ts`: `useAuthStore((s) => s.roleName | s.organizationName | s.permissions)`; `AuthSession` (store) NÃO tem `fullName` hoje; `features/auth/hooks/useAuth.ts` `toStoredSession(payload)` monta a sessão a partir de `payload.session` (que tem `fullName: string`, `features/auth/types.ts:35`); o store tem `initialState`, `enterImpersonation` (guarda `platformSession` campo a campo) e `partialize` (lista campo a campo o que vai para o localStorage).
De `lib/format-name.ts`: `toDisplayName(raw)`. Rótulo `team.roles.ADMIN` = "Admin" (pt-BR.json).
De `features/operations/operations-permissions.ts`: `useHasPermission(permission: string): boolean` (`comanda.read` para ADMIN, MANAGER, ATTENDANT, PROFESSIONAL).
De `features/bridal/bridal-permissions.ts`: `useBridalPermission(permission: string): boolean` (`bridal.read` para ADMIN, MANAGER, ATTENDANT; PROFESSIONAL não tem).
Rótulo de papel: i18n `team.roles.<ROLE>` (`useTranslation()`), como em `ProfissionaisPage.tsx:43`.
E2E: `apps/e2e/support/ui.ts:35` `navigateViaMenu(page, ...path)` hoje expande o IconRail via botão "Expandir menu"; `ux-comanda-celular.spec.ts:120` clica `getByRole('button', { name: 'Menu', exact: true })`; `ux-contraste.spec.ts:6` e `audit/ux-contraste-staging.audit.ts:6` têm `ROXOS` com `rgb(61, 0, 90)` (antigo primary-700).
Rotas da barra inferior: `/agenda`, `/comanda`, `/clientes`, `/noivas`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Menu lateral, topo e AppShell do computador (marca do estúdio, data por extenso, sem IconRail)</name>
  <files>apps/frontend/src/lib/format-date-long.ts, apps/frontend/src/lib/brand.ts, apps/frontend/src/lib/__tests__/format-date-long.test.ts, apps/frontend/src/lib/__tests__/brand.test.ts, apps/frontend/src/components/layout/AppShell.tsx, apps/frontend/src/components/layout/SidebarNav.tsx, apps/frontend/src/components/layout/TopHeader.tsx, apps/frontend/src/components/layout/IconRail.tsx, apps/frontend/src/features/notifications/components/NotificationsBell.tsx, apps/frontend/src/infrastructure/stores/auth.store.ts, apps/frontend/src/features/auth/hooks/useAuth.ts, apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx, apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx, apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx, apps/e2e/support/ui.ts</files>
  <read_first>
    - apps/frontend/src/components/layout/AppShell.tsx, SidebarNav.tsx, TopHeader.tsx, IconRail.tsx, menu-config.ts
    - apps/frontend/src/features/notifications/components/NotificationsBell.tsx e features/notifications/__tests__/notifications-bell.test.tsx
    - apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx e sidebar-nav.test.tsx
    - apps/frontend/src/infrastructure/stores/auth.store.ts e apps/frontend/src/features/auth/hooks/useAuth.ts
    - apps/e2e/support/ui.ts
    - .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-desktop.html (aside `w-64` com cabeçalho `h-14`, grupos e rodapé; header `h-14`) e dashboard-desktop.png
    - .planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md §5 (Casco)
  </read_first>
  <behavior>
    - `formatLongDate(new Date(2026, 10, 12, 12, 0))` → `'Quinta-feira, 12 de novembro de 2026'` (Intl pt-BR, `timeZone: 'America/Sao_Paulo'`, primeira letra maiúscula).
    - `brandInitials('Studio JS')` → `'JS'` (última palavra em maiúsculas de 2–3 letras vira a sigla); `brandInitials('Ateliê Maria Clara')` → `'AM'`; `brandInitials('')`/`null` → `'SG'`; `brandName(null)` → `'SGS'`, `brandName('Studio JS')` → `'Studio JS'`.
    - `casco-gestor-beauty.test.tsx` (computador): com `organizationName: 'Studio JS'` e `roleName: 'ADMIN'`, `SidebarNav` em `MemoryRouter initialEntries={['/dashboard']}` mostra "JS" e "Studio JS" em `data-testid="sidebar-brand"`; a `nav` "Navegação principal" tem `w-64` e `bg-white border-r border-neutral-200`; o link "Início" tem `bg-primary text-white` e `min-h-[44px]`; o botão do grupo "Agenda" tem `aria-expanded="true"`, `aria-label="Agenda"` e classe `uppercase`; existe botão "Sair" com `h-11 w-11` em `data-testid="sidebar-user"`; com `fullName: 'maria silva'` o rodapé mostra "Maria Silva" e, embaixo, "Admin" (rótulo do papel); com `fullName: null` (sessão antiga, salva antes desta mudança) mostra só "Admin"; nenhum elemento do menu tem classe que case `/shadow/`.
    - `TopHeader` (com `MockedProvider` e `vi.setSystemTime(new Date(2026, 10, 12, 12))`): mostra "Quinta-feira, 12 de novembro de 2026"; tem um único botão "Buscar páginas no SGS"; não mostra "Assine agora", "Studio Beleza LTDA", "Ajuda" nem "Tutoriais"; o `header` tem `h-14 bg-white border-b border-neutral-200`.
    - `sidebar-nav.test.tsx` continua passando (grupos de nível 0 visíveis, itens desligados ausentes, ícone de estoque baixo com rótulo "3 produto(s)…").
    - `menu-dom.test.tsx`: o caso do IconRail sai (componente removido); SidebarNav, AppDrawer e trilha continuam sem `<li>` dentro de `<li>`.
  </behavior>
  <action>
1. Escrever os testes (falham antes).
1a. Nome da usuária na sessão (D-15, só front): em `auth.store.ts` acrescentar `fullName: string | null;` em `AuthSession`, `fullName: null` em `initialState`, `fullName: current.fullName` no `platformSession` montado por `enterImpersonation` e `fullName: s.fullName` no `partialize`. Em `useAuth.ts` `toStoredSession`: `fullName: payload.session.fullName ?? null`. Rodar `corepack pnpm --filter @sgs/frontend typecheck`: se algum teste/fixture monta um `AuthSession` completo e quebrar, acrescentar `fullName: null` nele (só isso).
2. `src/lib/format-date-long.ts`: `export function formatLongDate(date: Date): string` com `new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(date)` e primeira letra em maiúscula.
3. `src/lib/brand.ts`: `brandName(org: string | null | undefined): string` (trim; vazio → `'SGS'`) e `brandInitials(org)` (palavras; se a última tem 2–3 letras e é toda maiúscula, retorna ela; senão primeira letra das duas primeiras palavras em maiúscula; vazio → `'SG'`).
4. `NotificationsBell.tsx`: aceitar props opcionais `open?: boolean` e `onOpenChange?: (open: boolean) => void` (controlado quando vierem; senão usa o estado interno atual). Botão do sino → `'relative inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2'`; contador (`data-testid="notifications-badge"`) → `'absolute right-1 top-1 min-w-[18px] rounded-md bg-primary px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums text-white'` (D-08: sem pílula); `aria-label="Notificações"` igual (E2E usa). Título do painel `font-serif text-headline-sm`.
5. `SidebarNav.tsx` (D-15), mesma API (`lowStockCount`, `onNavigate`):
   - `<nav role="navigation" aria-label="Navegação principal" className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white">`.
   - Cabeçalho `data-testid="sidebar-brand"`: `<Link to={HOME_PATH} className="flex h-14 shrink-0 items-center gap-sm border-b border-neutral-200 px-md">` com quadrado `h-8 w-8 rounded-md bg-primary text-white font-serif text-[15px] font-semibold flex items-center justify-center` (`aria-hidden`, conteúdo `brandInitials(organizationName)`) e `<span className="truncate font-serif text-headline-sm text-neutral-800">{brandName(organizationName)}</span>`.
   - Lista `<div className="flex-1 overflow-y-auto px-sm py-md"><ul className="space-y-xs">…`.
   - Nível 0 com filhos = rótulo de grupo: `<button type="button" aria-expanded={open} aria-label={item.label} className="flex min-h-[44px] w-full items-center gap-xs rounded-md px-sm text-left text-overline uppercase text-neutral-500 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2">` com o texto e `ChevronDown`/`ChevronRight` `h-4 w-4` (sem ícone do grupo); aberto por padrão (como hoje).
   - Folha (qualquer nível): `<NavLink end aria-label={item.label} className={({ isActive }) => cn('flex min-h-[44px] items-center gap-sm rounded-md px-sm text-body transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2', isActive ? 'bg-primary text-white font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800')}>` com ícone lucide `h-5 w-5 shrink-0` quando houver; recuo `style={{ paddingLeft: 8 + Math.max(level - 1, 0) * 16 }}`.
   - Subgrupo (nível ≥ 1 com filhos): botão no mesmo visual da folha inativa (`min-h-[44px] … text-neutral-600 font-medium`), `aria-label={item.label}`, `aria-expanded`, chevron; abre sozinho se algum descendente tem `to` igual a `useLocation().pathname`.
   - Ícone de estoque baixo: `TriangleAlert h-4 w-4 text-warning-500` com o `aria-label` e o Tooltip atuais (o teste busca `/3 produto/`).
   - Rodapé `data-testid="sidebar-user"`: `<div className="flex items-center gap-sm border-t border-neutral-200 bg-neutral-100 px-md py-sm">` com avatar `h-8 w-8 rounded-full bg-primary-50 text-primary-700 text-label flex items-center justify-center` (iniciais de `toDisplayName(fullName)`: primeira letra da primeira e da última palavra; sem nome, a primeira letra do rótulo do papel), bloco `min-w-0` com o nome `toDisplayName(fullName)` em `truncate text-body font-semibold text-neutral-800` e, embaixo, o papel `t(\`team.roles.${roleName}\`)` (fallback `roleName ?? '—'`) em `truncate text-[12px] leading-4 text-neutral-500`; se `fullName` estiver vazio (sessão salva antes desta mudança, até o próximo login/refresh), só o papel aparece, na linha principal. Depois `<button type="button" aria-label="Sair" onClick={() => logout()} className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"><LogOut className="h-5 w-5" /></button>`. O dropdown com "Configurações" desabilitado sai.
6. `TopHeader.tsx` (D-16, D-17), props novas `notificationsOpen?: boolean; onNotificationsOpenChange?: (o: boolean) => void` repassadas ao `NotificationsBell`:
   - `<header className="sticky top-0 z-40 flex h-14 items-center gap-md border-b border-neutral-200 bg-white px-md lg:px-lg">`.
   - Celular (`lg:hidden`): `<Link to={HOME_PATH} aria-label={\`${brandName(org)} — início\`} className="flex min-w-0 items-center gap-sm">` com o mesmo quadrado da marca e um bloco com `brandName` em `truncate font-serif text-headline-sm text-neutral-800` e a data em `data-testid="top-date-mobile"` `truncate text-[12px] leading-4 tabular-nums text-neutral-500`.
   - Computador: `<p data-testid="top-date" className="hidden lg:block text-data tabular-nums text-neutral-800">{formatLongDate(new Date())}</p>`.
   - À direita (`ml-auto flex items-center gap-xs`): um único botão de busca `aria-label="Buscar páginas no SGS"` com classes `'inline-flex h-11 w-11 items-center justify-center gap-sm rounded-md border border-neutral-200 bg-neutral-50 text-body text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-800 lg:w-[320px] lg:justify-start lg:px-[14px]'`, ícone `Search h-4 w-4` e `<span className="hidden lg:inline truncate">Buscar páginas no SGS</span>`; `NotificationsBell` (se `FEATURES.notificacoes`); avatar `DropdownMenuTrigger` `inline-flex h-11 w-11 items-center justify-center rounded-md` com círculo interno `h-8 w-8 rounded-full bg-primary text-white text-label` e a inicial; o item "Sair" do dropdown continua.
   - Remover os blocos do seletor de estabelecimento, "Assine agora" e Ajuda/Tutoriais (D-02; as chaves continuam em `config/features.ts`) e o logo roxo `bg-primary-700` (a marca do computador está no menu lateral).
7. `AppShell.tsx`: estrutura `<div className="flex min-h-screen bg-background">` → `<aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen"><SidebarNav lowStockCount={lowStockCount} /></aside>` + `<div className="flex min-w-0 flex-1 flex-col"><TopHeader notificationsOpen={notificationsOpen} onNotificationsOpenChange={setNotificationsOpen} /><main className="flex-1 min-w-0 px-md py-md pb-20 lg:px-lg lg:py-lg lg:pb-lg"><Outlet /></main></div>` + `BottomNav`, `AppDrawer` e `ChatBubble` como hoje; estado novo `const [notificationsOpen, setNotificationsOpen] = useState(false)`. Atualizar o comentário do diagrama. Apagar `IconRail.tsx` (`git rm`) e tirar o import.
8. `menu-dom.test.tsx`: remover o caso do IconRail e o import; os demais casos ficam.
9. `apps/e2e/support/ui.ts` `navigateViaMenu`: remover as linhas do "Expandir/Recolher menu"; para cada grupo: `const group = nav.getByRole('button', { name: label, exact: true }); if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();`; depois `nav.getByRole('link', { name: last, exact: true }).click()`. Atualizar o comentário (menu lateral fixo de 256 px).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/lib src/components/layout src/features/notifications && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/frontend/src/components/layout/IconRail.tsx` falha (arquivo removido) e `grep -rn "IconRail" apps/frontend/src` não encontra nada
    - `grep -n "w-64" apps/frontend/src/components/layout/SidebarNav.tsx apps/frontend/src/components/layout/AppShell.tsx` encontra os dois
    - `grep -n "Expandir menu" apps/e2e/support/ui.ts` não encontra nada
    - `grep -nE "Assine agora|Studio Beleza LTDA|HelpCircle|PlayCircle" apps/frontend/src/components/layout/TopHeader.tsx` não encontra nada
    - `grep -n "formatLongDate" apps/frontend/src/components/layout/TopHeader.tsx` encontra o uso
    - `casco-gestor-beauty.test.tsx`, `sidebar-nav.test.tsx`, `menu-dom.test.tsx`, `notifications-bell.test.tsx`, `format-date-long.test.ts` e `brand.test.ts` passam
  </acceptance_criteria>
  <done>Computador com menu lateral branco de 256 px, topo com data por extenso e sem IconRail (D-15, D-16).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Barra inferior do celular, gaveta "Mais", PageHeader e ajustes de E2E</name>
  <files>apps/frontend/src/components/layout/BottomNav.tsx, apps/frontend/src/components/layout/AppDrawer.tsx, apps/frontend/src/components/layout/AppShell.tsx, apps/frontend/src/components/layout/PageHeader.tsx, apps/frontend/src/components/layout/ChatBubble.tsx, apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx, apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts, apps/e2e/tests/ux-comanda-celular.spec.ts, apps/e2e/tests/ux-contraste.spec.ts, apps/e2e/audit/ux-contraste-staging.audit.ts</files>
  <read_first>
    - apps/frontend/src/components/layout/BottomNav.tsx, AppDrawer.tsx, PageHeader.tsx, ChatBubble.tsx, AppShell.tsx (versão da Task 1)
    - apps/frontend/src/components/ui/breadcrumb.tsx
    - apps/frontend/src/features/operations/operations-permissions.ts e features/bridal/bridal-permissions.ts
    - apps/e2e/tests/ux-comanda-celular.spec.ts (linha ~120), ux-contraste.spec.ts, apps/e2e/audit/ux-contraste-staging.audit.ts
    - .planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-mobile.png e agenda-dia-mobile.html (topo com marca + data; a barra inferior do design tem 5 itens)
  </read_first>
  <behavior>
    - `casco-gestor-beauty.test.tsx` (celular):
      - `BottomNav` com `roleName: 'ADMIN'` renderiza, nesta ordem, links "Agenda", "Comanda", "Clientes", "Noivas" e o botão "Mais"; não tem "Início", "Notificações" nem "Menu"; cada item tem `min-h-[48px]`; a `nav` tem `bg-white border-t border-neutral-200` e nenhuma classe com `shadow`.
      - Com `roleName: 'PROFESSIONAL'`: "Noivas" não aparece (sem `bridal.read`); "Agenda", "Comanda", "Clientes" e "Mais" aparecem.
      - Em `MemoryRouter initialEntries={['/comanda/abc']}` o link "Comanda" tem `text-primary-500` (ativo também nas subrotas).
      - `AppDrawer` aberto com `organizationName: 'Studio JS'` mostra "Studio JS" no cabeçalho, não mostra "Trocar estabelecimento" nem "Studio Beleza"; tem botão "Notificações" que chama `onOpenNotifications` e fecha a gaveta; o link "Início" está na árvore; itens com `min-h-[44px]`.
      - `PageHeader` com trilha e `cta`: o `h1` tem `font-serif text-headline-lg text-neutral-800`; o contêiner de título/ações tem `flex-col sm:flex-row`; o contêiner das ações tem `flex-wrap`; com `breadcrumbs={[{ label: 'Clientes', to: '/clientes' }, { label: 'Maria Silva' }]}` o link "Clientes" e a página atual "Maria Silva" têm `text-[12px]` e NENHUM item da trilha (links, `BreadcrumbPage`, separadores) tem a classe `uppercase`; o `textContent` da página atual é exatamente "Maria Silva" e `getByText('Maria Silva', { exact: true })` acha o item (D-13).
      - `AppDrawer` aberto com `fullName: 'maria silva'` mostra "Maria Silva" e o papel no rodapé.
    - `sem-cor-antiga.test.ts`: as entradas `components/layout/BottomNav.tsx`, `components/layout/ChatBubble.tsx` e `components/layout/IconRail.tsx` saem de `SOMBRA_PENDENTE` (o teste do 06-01 falha se ficarem sobrando: IconRail foi apagado e os outros dois ficam sem sombra); e passa a proibir `bg-primary-700` como fundo em `src/components/layout`.
  </behavior>
  <action>
1. Escrever/estender os testes (falham antes).
2. `BottomNav.tsx` (D-17): props `onOpenMenu: () => void` (tirar `notificationsCount`). No topo do componente: `const canComanda = useHasPermission('comanda.read') && isPathEnabled('/comanda'); const canNoivas = useBridalPermission('bridal.read') && isPathEnabled('/noivas');` e `isPathEnabled` também para `/agenda` e `/clientes`. `<nav role="navigation" aria-label="Navegação principal" data-testid="bottom-nav" className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-neutral-200 bg-white lg:hidden">`. Itens, nesta ordem: Agenda (`CalendarDays`, `/agenda`), Comanda (`Receipt`, `/comanda`), Clientes (`Users`, `/clientes`), Noivas (`Gem`, `/noivas`), Mais (botão `MoreHorizontal`, `aria-label="Mais"`, abre a gaveta). `NavLink` sem `end` (ativo nas subrotas), classe `'flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-xs text-[11px] font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px]'` + ativo `'text-primary-500 font-semibold'` / inativo `'text-neutral-500 hover:text-neutral-800'`; ícone `h-5 w-5`. Sem `shadow-[…]` e sem destaque fixo de Agenda. Itens sem permissão não são renderizados e os demais dividem a largura (`flex-1`).
3. `AppDrawer.tsx` (D-17): prop nova `onOpenNotifications?: () => void`. Cabeçalho `SheetHeader` `border-b border-neutral-200 bg-white px-md py-md` com o quadrado da marca (`brandInitials`) e `brandName(organizationName)` em `font-serif text-headline-sm`; remover "Studio Beleza" e o botão "Trocar estabelecimento ›" (D-02). Logo abaixo, se `FEATURES.notificacoes && onOpenNotifications`: `<button type="button" onClick={() => { onOpenChange(false); onOpenNotifications(); }} className="flex min-h-[44px] w-full items-center gap-sm px-md text-body text-neutral-800 hover:bg-neutral-50"><Bell className="h-5 w-5" />Notificações</button>`. Itens da árvore (mesma lógica de abrir/fechar): folha `min-h-[44px] flex items-center gap-sm px-md text-body` ativo `bg-primary text-white font-semibold` / inativo `text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800` (tirar a borda esquerda `border-l-2`); grupos `min-h-[44px] … text-neutral-800 font-medium`; ícones `h-5 w-5`; `aria-label={item.label}` em links e botões. Rodapé `border-t border-neutral-200 bg-neutral-100`: avatar redondo, nome `toDisplayName(fullName)` e papel por `t('team.roles.…')` embaixo (mesma regra do rodapé do menu lateral, Task 1), botão "Sair" `inline-flex h-11 items-center gap-xs rounded-md px-sm text-body text-error-600 hover:bg-error-50` com texto visível "Sair"; o botão falso "Configurações" sai.
4. `AppShell.tsx`: `<AppDrawer … onOpenNotifications={() => setNotificationsOpen(true)} />`.
5. `PageHeader.tsx` (D-13: a trilha leva nomes de pessoa e de grupo, então SEM `uppercase` e sem `text-overline`, que tem espaçamento de rótulo): trilha com `Breadcrumb className="mb-xs"`; link → `className="text-[12px] leading-4 font-medium text-neutral-500 hover:text-neutral-800"`; página atual `BreadcrumbPage className="text-[12px] leading-4 font-semibold text-neutral-800"`; o texto do item é o `label` como veio (sem transformar caixa; quem chama já passa `toDisplayName` onde é nome); separador `<span role="presentation" aria-hidden="true">` mantido (UX-10). Título/ações: `<div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">` com `<h1 className="min-w-0 break-words font-serif text-headline-lg text-neutral-800">` e `{cta && <div className="flex flex-wrap items-center gap-sm">{cta}</div>}`.
6. `ChatBubble.tsx` (desligado por flag, mas sem estilo antigo): tirar `shadow-lg`/`shadow-*`, bolha `rounded-md` em vez de `rounded-full`, painel `rounded-md border-neutral-200`.
6a. `sem-cor-antiga.test.ts`: tirar `components/layout/BottomNav.tsx`, `components/layout/ChatBubble.tsx` e `components/layout/IconRail.tsx` de `SOMBRA_PENDENTE` e acrescentar a regra de `bg-primary-700` em `src/components/layout`.
7. E2E (só seletor que dependia de estilo/rótulo, D-23): `ux-comanda-celular.spec.ts` `name: 'Menu'` → `name: 'Mais'`; `ux-contraste.spec.ts` e `audit/ux-contraste-staging.audit.ts`: `ROXOS = ['rgb(87, 0, 128)', 'rgb(68, 0, 100)', 'rgb(55, 0, 83)']` (`#570080`, `#440064`, `#370053`). `grep -rn "'Início'\|'Notificações'\|'Menu'" apps/e2e/tests apps/e2e/audit` e confirmar que os restantes são o heading "Início", o sino do topo e o link "Início" do menu lateral (continuam existindo).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "label=\"Noivas\"\|label=\"Comanda\"\|aria-label=\"Mais\"" apps/frontend/src/components/layout/BottomNav.tsx` encontra os três
    - `grep -nE "shadow|Home|Bell" apps/frontend/src/components/layout/BottomNav.tsx` não encontra nada
    - `grep -nE "Trocar estabelecimento|Studio Beleza" apps/frontend/src/components/layout/AppDrawer.tsx` não encontra nada
    - `grep -n "font-serif text-headline-lg" apps/frontend/src/components/layout/PageHeader.tsx` encontra o h1
    - `grep -n "uppercase" apps/frontend/src/components/layout/PageHeader.tsx` não encontra nada
    - `grep -nE "BottomNav|ChatBubble|IconRail" apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts` não encontra nada
    - `grep -n "fullName" apps/frontend/src/infrastructure/stores/auth.store.ts apps/frontend/src/features/auth/hooks/useAuth.ts apps/frontend/src/components/layout/SidebarNav.tsx` encontra os três
    - `grep -n "name: 'Mais'" apps/e2e/tests/ux-comanda-celular.spec.ts` e `grep -n "rgb(68, 0, 100)" apps/e2e/tests/ux-contraste.spec.ts` encontram as linhas
    - Vitest inteiro do frontend passa (inclui UX-01..UX-19)
  </acceptance_criteria>
  <done>Celular com barra Agenda/Comanda/Clientes/Noivas/Mais por permissão, gaveta com Início e Notificações e PageHeader novo (D-17).</done>
</task>

<task type="auto">
  <name>Task 3: Gate completo, comparação de screenshots com o Stitch, commit, push, deploy no staging e CI verde (lote base)</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-02-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/playwright.audit.config.ts e apps/e2e/audit/telas.audit.ts (slugs `01-agenda-dia` … `16-painel`)
    - .planning/phases/06-novo-layout-gestor-beauty/design/dashboard-desktop.png e agenda-dia-mobile.png
  </read_first>
  <action>
1. Na raiz `/root/sgs`, rodar o gate completo e só seguir com tudo verde:
   - `corepack pnpm -r typecheck`
   - `corepack pnpm -r --if-present lint`
   - `corepack pnpm --filter @sgs/backend test`
   - `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais conhecidas de Redis `NOAUTH`; qualquer outra falha bloqueia)
   - `corepack pnpm --filter @sgs/frontend exec vitest run`
   - `corepack pnpm --filter @sgs/e2e test:e2e`
   Falha causada pelos arquivos do 06-01/06-02: corrigir (seletor que dependia de estilo pode ser ajustado; `data-testid` e papéis ARIA ficam). Falha antiga em arquivo não tocado: registrar em `.planning/phases/06-novo-layout-gestor-beauty/deferred-items.md` e não corrigir.
2. Comparação com o Stitch (D-24), ambiente local com o seed do E2E: `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-02 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts`. Abrir (Read) `06-audit-evidence/06-02/desktop/01-agenda-dia.png`, `desktop/16-painel.png`, `mobile/01-agenda-dia.png` e `mobile/05-comanda-lista.png` ao lado de `design/dashboard-desktop.png` e `design/agenda-dia-mobile.png` e conferir só o casco: menu lateral branco 256 px com marca, item ativo roxo/texto branco, topo branco com data, barra inferior com 5 itens, fontes Public Sans/Source Serif 4, fundo `#F7F6F3`, sem sombras. Registrar no SUMMARY a seção `## Comparação com o Stitch` (tabela: elemento do design | como ficou | omitido por D-02?) e corrigir divergência do casco antes do commit.
3. Commit dos arquivos do 06-02 (adicionar um a um, nunca `git add .`; incluir o `git rm` do IconRail): `feat(06-02): casco e navegação do layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master` (leva junto o commit local do 06-01).
5. Sem migration, sem backup. Rodar `./scripts/deploy-staging.sh`.
6. Acompanhar o CI: `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde. Se falhar, corrigir e repetir (máximo 3 tentativas; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commits `feat(06-01)` e `feat(06-02)` em `origin/master` (`git log origin/master --oneline -5`)
    - `ls .planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-02/desktop/01-agenda-dia.png .planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-02/mobile/01-agenda-dia.png` existe
    - `06-02-SUMMARY.md` tem a seção `## Comparação com o Stitch`
    - `./scripts/deploy-staging.sh` terminou sem erro e `gh run watch` terminou com sucesso
  </acceptance_criteria>
  <done>Lote base no staging com CI verde: o sistema inteiro com a cara do Gestor Beauty.</done>
</task>

</tasks>

<verification>
- Gate completo verde, screenshots locais conferidos contra o Stitch, deploy feito e CI verde
</verification>

<success_criteria>
Lote base entregue: depois do deploy, toda página do SGS mostra fontes novas, cores novas, raio 6 px, nenhuma sombra, botões/campos de 44 px e o casco novo (menu lateral, topo, barra inferior).
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-02-SUMMARY.md`
</output>

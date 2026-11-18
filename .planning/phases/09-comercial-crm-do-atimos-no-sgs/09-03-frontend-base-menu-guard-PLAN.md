---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/config/__tests__/features.test.ts
  - apps/frontend/src/components/layout/menu-config.ts
  - apps/frontend/src/components/layout/use-menu.ts
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/components/layout/AppDrawer.tsx
  - apps/frontend/src/components/layout/GlobalSearchSheet.tsx
  - apps/frontend/src/components/layout/__tests__/menu-por-papel.test.ts
  - apps/frontend/src/features/commercial/commercial-permissions.ts
  - apps/frontend/src/features/commercial/components/CommercialRoute.tsx
  - apps/frontend/src/features/commercial/components/LeadImportDialog.tsx
  - apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx
  - apps/frontend/src/features/commercial/components/FormSettingsTab.tsx
  - apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx
  - apps/frontend/src/features/commercial/pages/LeadsPage.tsx
  - apps/frontend/src/features/commercial/pages/LeadDetailPage.tsx
  - apps/frontend/src/features/commercial/pages/PipelinePage.tsx
  - apps/frontend/src/features/commercial/pages/RemindersPage.tsx
  - apps/frontend/src/features/commercial/pages/ReportsPage.tsx
  - apps/frontend/src/features/commercial/pages/CommercialSettingsPage.tsx
  - apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx
  - apps/frontend/src/router.tsx
  - apps/frontend/src/features/commercial/__tests__/commercial-fixtures.ts
  - apps/frontend/src/features/commercial/__tests__/commercial-permissions.test.ts
  - apps/frontend/src/features/commercial/__tests__/commercial-route.test.tsx
autonomous: true
requirements: [COM-10]

must_haves:
  truths:
    - "O grupo Comercial (Painel comercial, Leads, Pipeline, Lembretes, Relatórios, Etapas e formulário) existe no menu para ADMIN, MANAGER e ATTENDANT e não aparece para PROFESSIONAL, com ou sem isProfessional (D-11)"
    - "Relatórios e Etapas e formulário só aparecem para ADMIN e MANAGER (D-13)"
    - "A busca global e a gaveta do celular usam o mesmo menu filtrado por papel"
    - "Acessar /comercial/* como PROFESSIONAL redireciona para a home do papel; /comercial/relatorios e /comercial/configuracoes como ATTENDANT redirecionam para /comercial"
    - "A flag comercial existe e fica false até o 09-15 ligar (rotas e menu desligados em produção até lá)"
  artifacts:
    - path: "apps/frontend/src/components/layout/menu-config.ts"
      provides: "MenuItem.roles, MENU_DEFINITION, filterMenuByRole, menuForRole, searchMenu(query, items)"
      contains: "filterMenuByRole"
    - path: "apps/frontend/src/components/layout/use-menu.ts"
      provides: "useMenu()"
      exports: ["useMenu"]
    - path: "apps/frontend/src/features/commercial/commercial-permissions.ts"
      provides: "COMMERCIAL_ROLES, WIN_DEAL_ROLES, canUseCommercial, isCommercialManager, canWinDeal, useCommercialAccess"
      exports: ["COMMERCIAL_ROLES", "WIN_DEAL_ROLES", "canUseCommercial", "isCommercialManager", "canWinDeal", "useCommercialAccess"]
    - path: "apps/frontend/src/features/commercial/components/CommercialRoute.tsx"
      provides: "guard de rota por papel"
      exports: ["CommercialRoute"]
  key_links:
    - from: "apps/frontend/src/components/layout/SidebarNav.tsx"
      to: "useMenu()"
      via: "troca de MENU por useMenu"
      pattern: "useMenu\\(\\)"
    - from: "apps/frontend/src/router.tsx"
      to: "CommercialRoute"
      via: "elemento das rotas /comercial/*"
      pattern: "<CommercialRoute"
---

<objective>
Esqueleto do Comercial no frontend: flag `comercial`, menu filtrado por papel (sidebar, gaveta e busca), espelho das permissões (com o ponto da D-21), guard de rota por papel, rotas registradas e páginas/abas provisórias que os planos 09-11 a 09-14 substituem.

Purpose: hoje o menu não tem filtro por papel (só por flag) e o router não tem guard de papel; sem isso o PROFESSIONAL veria o Comercial (D-11). As páginas provisórias fixam os pontos de montagem para os planos de tela rodarem em paralelo sem disputar `router.tsx`.
Output: menu por papel, `useMenu`, `commercial-permissions.ts`, `CommercialRoute`, rotas e placeholders.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md

**Ambiente de execução:** igual ao 09-01. Frontend formatado à mão (aspas simples, ~100 colunas), sem prettier.

**Verificado no planejamento:** `lucide-react` ^0.475.0 tem `Handshake`, `LayoutDashboard`, `Users`, `Kanban`, `BellRing`, `BarChart3` (alias de `ChartColumn`, já importado no menu), `Settings2`, `Upload`, `UserPlus`. `Columns3` existe só como `columns-3` (não usar).

<interfaces>
`menu-config.ts` (hoje): `export interface MenuItem { id; label; to?; icon: LucideIcon; children?; searchTerms?; badge? }`; `const ALL_MENU: MenuItem[]` (constante privada); `function pruneMenu(items)` poda por `isPathEnabled`; `export const MENU = pruneMenu(ALL_MENU)`; `export function flattenMenu(items = MENU, breadcrumb = [])`; `export function searchMenu(query)` usa `flattenMenu()`.
Consumidores: `SidebarNav.tsx` (linhas ~94 e ~336 usam `MENU`), `AppDrawer.tsx` (~74 `items={MENU}`), `GlobalSearchSheet.tsx` (~47 `searchMenu(query)` e `flattenMenu().slice(0, 8)`), `config/__tests__/features.test.ts` (`flattenMenu(MENU)`).
`config/features.ts`: `FLAGS` (objeto `as const`), `GATED_PATHS: ReadonlyArray<readonly [string, FeatureKey]>` (a primeira que casar decide; sem `?` casa por prefixo de caminho), `isPathEnabled(to)`, `homePathForRole(roleName)`.
`router.tsx`: `PROTECTED_ROUTES: GatedRoute[]` filtrado por `isPathEnabled`; rotas públicas fora do `ProtectedRoute` (ex.: `{ path: '/aceite/:orgId/:token', element: <ContractAcceptPage /> }`).
`@/infrastructure/stores/auth.store`: `useAuthStore` com `roleName: string | null`, `memberId: string | null`.
`features/bridal/bridal-permissions.ts`: modelo de espelho por `roleName`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Flag comercial e espelho de permissões</name>
  <files>apps/frontend/src/config/features.ts, apps/frontend/src/config/__tests__/features.test.ts, apps/frontend/src/features/commercial/commercial-permissions.ts, apps/frontend/src/features/commercial/__tests__/commercial-permissions.test.ts, apps/frontend/src/features/commercial/__tests__/commercial-fixtures.ts</files>
  <read_first>
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/features/bridal/bridal-permissions.ts
    - apps/frontend/src/features/bridal/__tests__/bridal-permissions.test.ts
    - apps/backend/src/authz/permissions.catalog.ts (se o 09-01 já rodou; senão a matriz do 09-01 Task 2)
  </read_first>
  <behavior>
    - FEATURES.comercial === false; isPathEnabled('/comercial') === false; isPathEnabled('/comercial/leads/x') === false
    - canUseCommercial('PROFESSIONAL') false; 'ATTENDANT' true; null false
    - isCommercialManager('MANAGER') true; 'ATTENDANT' false
    - canWinDeal('ATTENDANT') true (D-21)
    - COMMERCIAL_ROLE_PERMISSIONS.ATTENDANT = ['commercial.read', 'commercial.write']; ADMIN e MANAGER com 'commercial.manage'; PROFESSIONAL []
  </behavior>
  <action>
1. `features.ts`: `/** Comercial (fase 9): funil de noivas e debutantes. Liga no 09-15, junto com o E2E. */ comercial: false,` em `FLAGS`; em `GATED_PATHS`, `['/comercial', 'comercial']` e `['/contato', 'comercial']`.
2. `commercial-permissions.ts` (mesmo padrão de `bridal-permissions.ts`): `COMMERCIAL_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT'] as const`; `COMMERCIAL_ROLE_PERMISSIONS: Record<string, readonly string[]>` com a matriz do `<behavior>`; `WIN_DEAL_ROLES: readonly string[] = ['ADMIN', 'MANAGER', 'ATTENDANT']` com o comentário "D-21 (confirmada pela usuária em 2026-11-18): espelha WIN_DEAL_ROLES de apps/backend/src/commercial/commercial-access.ts; para 'só admin/gerente', trocar nos dois arquivos."; `canUseCommercial`, `isCommercialManager`, `canWinDeal(roleName)`; hook `useCommercialAccess()` → `{ roleName, memberId, canUse, isManager, canWin }` lendo `useAuthStore`.
3. `commercial-fixtures.ts`: helpers de teste `setRole(roleName, memberId = 'm-1')` (escreve no `useAuthStore`) e objetos de exemplo `STAGES` (as 6 etapas padrão com ids `st-novo`… e cores do 09-01), `LEAD_ANA`, `DEAL_ANA_NOIVA`, usados pelos testes dos planos de tela.
4. Testes do `<behavior>`; atualizar `features.test.ts` só no necessário para a flag nova.
Commit `feat(09-03): flag e permissões do Comercial no frontend`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/config/__tests__/features.test.ts src/features/commercial/__tests__/commercial-permissions.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "comercial: false" apps/frontend/src/config/features.ts` encontra
    - `grep -n "\['/comercial', 'comercial'\]" apps/frontend/src/config/features.ts` encontra
    - `grep -n "D-21" apps/frontend/src/features/commercial/commercial-permissions.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Flag e matriz de papéis do Comercial no front.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Menu por papel (sidebar, gaveta e busca)</name>
  <files>apps/frontend/src/components/layout/menu-config.ts, apps/frontend/src/components/layout/use-menu.ts, apps/frontend/src/components/layout/SidebarNav.tsx, apps/frontend/src/components/layout/AppDrawer.tsx, apps/frontend/src/components/layout/GlobalSearchSheet.tsx, apps/frontend/src/components/layout/__tests__/menu-por-papel.test.ts</files>
  <read_first>
    - apps/frontend/src/components/layout/menu-config.ts
    - apps/frontend/src/components/layout/SidebarNav.tsx
    - apps/frontend/src/components/layout/AppDrawer.tsx
    - apps/frontend/src/components/layout/GlobalSearchSheet.tsx
    - apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx e menu-dom.test.tsx (não podem quebrar)
  </read_first>
  <behavior>
    - filterMenuByRole(MENU_DEFINITION, 'PROFESSIONAL') não contém item de id 'comercial' em nível nenhum
    - filterMenuByRole(MENU_DEFINITION, 'ATTENDANT') contém 'comercial' com filhos comercial-painel, comercial-leads, comercial-pipeline, comercial-lembretes e sem comercial-relatorios nem comercial-config
    - filterMenuByRole(MENU_DEFINITION, 'ADMIN') e 'MANAGER' contêm os 6 filhos
    - filterMenuByRole(items, null) remove todo item que tenha `roles`
    - item sem `roles` aparece para qualquer papel (menu atual inalterado: flattenMenu(filterMenuByRole(MENU, 'PROFESSIONAL')) sem o grupo comercial é igual a flattenMenu(MENU) sem o grupo comercial)
    - searchMenu('leads', filterMenuByRole(MENU_DEFINITION, 'PROFESSIONAL')) → []
  </behavior>
  <action>
1. `MenuItem`: `/** Papéis que veem o item (e os filhos). Ausente = todos. */ roles?: readonly string[];`.
2. Grupo novo em `ALL_MENU`, logo depois de `agenda`:
```ts
{
  id: 'comercial',
  label: 'Comercial',
  icon: Handshake,
  roles: COMMERCIAL_ROLES,
  children: [
    { id: 'comercial-painel', label: 'Painel comercial', to: '/comercial', icon: LayoutDashboard,
      searchTerms: ['comercial', 'funil', 'vendas'] },
    { id: 'comercial-leads', label: 'Leads', to: '/comercial/leads', icon: Users,
      searchTerms: ['leads', 'interessadas', 'orçamento'] },
    { id: 'comercial-pipeline', label: 'Pipeline', to: '/comercial/pipeline', icon: Kanban,
      searchTerms: ['pipeline', 'kanban', 'negócios', 'funil'] },
    { id: 'comercial-lembretes', label: 'Lembretes', to: '/comercial/lembretes', icon: BellRing,
      searchTerms: ['lembretes', 'follow-up', 'retorno'] },
    { id: 'comercial-relatorios', label: 'Relatórios', to: '/comercial/relatorios', icon: BarChart3,
      roles: ['ADMIN', 'MANAGER'], searchTerms: ['relatório comercial', 'conversão', 'perdas'] },
    { id: 'comercial-config', label: 'Etapas e formulário', to: '/comercial/configuracoes',
      icon: Settings2, roles: ['ADMIN', 'MANAGER'], searchTerms: ['etapas', 'formulário', 'site'] },
  ],
},
```
   `COMMERCIAL_ROLES` importado de `@/features/commercial/commercial-permissions`. Ícones novos acrescentados ao import existente (`Handshake`, `Kanban`, `BellRing`; os demais já estão).
3. `export const MENU_DEFINITION: readonly MenuItem[] = ALL_MENU;` (para testes; não podado por flag). `export function filterMenuByRole(items: readonly MenuItem[], roleName: string | null | undefined): MenuItem[]` recursivo (item com `roles` sem o papel some; grupo que fica sem filhos some). `export function menuForRole(roleName) { return filterMenuByRole(MENU, roleName); }`. `searchMenu(query: string, items: MenuItem[] = MENU)` passa `items` para `flattenMenu(items)`.
4. `use-menu.ts`: `export function useMenu(): MenuItem[]` com `useAuthStore((s) => s.roleName)` + `useMemo(() => menuForRole(roleName), [roleName])`.
5. `SidebarNav`, `AppDrawer`: `const menu = useMenu();` no lugar de `MENU`. `GlobalSearchSheet`: `const menu = useMenu();` e `searchMenu(query, menu)` / `flattenMenu(menu).slice(0, 8)`. `MENU` continua exportado.
6. `menu-por-papel.test.ts` com os casos do `<behavior>`.
Commit `feat(09-03): menu filtrado por papel`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/components/layout src/config && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function filterMenuByRole" apps/frontend/src/components/layout/menu-config.ts` encontra
    - `grep -n "roles: \['ADMIN', 'MANAGER'\]" apps/frontend/src/components/layout/menu-config.ts` encontra 2 vezes
    - `grep -n "items={MENU}\|MENU.map" apps/frontend/src/components/layout/SidebarNav.tsx apps/frontend/src/components/layout/AppDrawer.tsx` vazio
    - `grep -n "useMenu()" apps/frontend/src/components/layout/SidebarNav.tsx apps/frontend/src/components/layout/AppDrawer.tsx apps/frontend/src/components/layout/GlobalSearchSheet.tsx` encontra 3
    - comando do `<verify>` sai 0 (inclui `sidebar-nav`, `menu-dom`, `casco-gestor-beauty` sem regressão)
  </acceptance_criteria>
  <done>Menu, gaveta e busca respeitam o papel.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: CommercialRoute, rotas e pontos de montagem</name>
  <files>apps/frontend/src/features/commercial/components/CommercialRoute.tsx, apps/frontend/src/features/commercial/components/LeadImportDialog.tsx, apps/frontend/src/features/commercial/components/StagesSettingsTab.tsx, apps/frontend/src/features/commercial/components/FormSettingsTab.tsx, apps/frontend/src/features/commercial/pages/CommercialDashboardPage.tsx, apps/frontend/src/features/commercial/pages/LeadsPage.tsx, apps/frontend/src/features/commercial/pages/LeadDetailPage.tsx, apps/frontend/src/features/commercial/pages/PipelinePage.tsx, apps/frontend/src/features/commercial/pages/RemindersPage.tsx, apps/frontend/src/features/commercial/pages/ReportsPage.tsx, apps/frontend/src/features/commercial/pages/CommercialSettingsPage.tsx, apps/frontend/src/features/commercial/public/PublicLeadFormPage.tsx, apps/frontend/src/router.tsx, apps/frontend/src/features/commercial/__tests__/commercial-route.test.tsx</files>
  <read_first>
    - apps/frontend/src/router.tsx
    - apps/frontend/src/components/ProtectedRoute.tsx
    - apps/frontend/src/features/bridal/pages/ContractsPage.tsx (cabeçalho de página no padrão Gestor Beauty)
    - apps/frontend/src/components/ui/tabs.tsx
  </read_first>
  <behavior>
    - CommercialRoute como PROFESSIONAL → Navigate para homePathForRole('PROFESSIONAL') ('/agenda')
    - CommercialRoute managerOnly como ATTENDANT → Navigate para '/comercial'
    - CommercialRoute como ATTENDANT (sem managerOnly) e como ADMIN (managerOnly) → renderiza os filhos
    - CommercialSettingsPage renderiza abas 'Etapas' e 'Formulário do site'
  </behavior>
  <action>
1. `CommercialRoute.tsx`: `export function CommercialRoute({ children, managerOnly = false }: { children: ReactNode; managerOnly?: boolean })` usando `useCommercialAccess()`; regras do `<behavior>` com `<Navigate replace />`. Comentário: "conforto de UI; quem protege é a API (commercial.*)".
2. Páginas provisórias (`export function XPage()`), cada uma com título no padrão das páginas existentes e o texto 'Em construção' — serão substituídas: `CommercialDashboardPage` ('Painel comercial'), `LeadsPage` ('Leads'), `LeadDetailPage` ('Lead'), `PipelinePage` ('Pipeline'), `RemindersPage` ('Lembretes'), `ReportsPage` ('Relatórios comerciais'), `PublicLeadFormPage` ('Fale com a gente', sem AppShell).
3. Pontos de montagem com a assinatura FINAL (os planos seguintes só trocam o corpo):
   - `LeadImportDialog.tsx`: `export interface LeadImportDialogProps { open: boolean; onOpenChange: (open: boolean) => void; onImported?: (count: number) => void; } export function LeadImportDialog(_props: LeadImportDialogProps) { return null; }` (implementado no 09-14).
   - `StagesSettingsTab.tsx`: `export function StagesSettingsTab()` → `null` (09-12). `FormSettingsTab.tsx`: `export function FormSettingsTab()` → `null` (09-14).
   - `CommercialSettingsPage.tsx` (versão final): título 'Etapas e formulário', `Tabs` com `etapas` → `<StagesSettingsTab />` e `formulario` → `<FormSettingsTab />`, aba inicial pela query `?aba=`.
4. `router.tsx`: em `PROTECTED_ROUTES`:
```tsx
{ path: '/comercial', element: <CommercialRoute><CommercialDashboardPage /></CommercialRoute> },
{ path: '/comercial/leads', element: <CommercialRoute><LeadsPage /></CommercialRoute> },
{ path: '/comercial/leads/:id', element: <CommercialRoute><LeadDetailPage /></CommercialRoute> },
{ path: '/comercial/pipeline', element: <CommercialRoute><PipelinePage /></CommercialRoute> },
{ path: '/comercial/lembretes', element: <CommercialRoute><RemindersPage /></CommercialRoute> },
{ path: '/comercial/relatorios', element: <CommercialRoute managerOnly><ReportsPage /></CommercialRoute> },
{ path: '/comercial/configuracoes',
  element: <CommercialRoute managerOnly><CommercialSettingsPage /></CommercialRoute> },
```
   e, entre as rotas públicas, `...(FEATURES.comercial ? [{ path: '/contato/:orgId/:token', element: <PublicLeadFormPage /> }] : [])` logo depois de `/aceite/:orgId/:token`.
5. `commercial-route.test.tsx` com `MemoryRouter` e `setRole` das fixtures.
Commit `feat(09-03): rotas e guard do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "<CommercialRoute" apps/frontend/src/router.tsx` = 7
    - `grep -n "/contato/:orgId/:token" apps/frontend/src/router.tsx` encontra
    - `grep -n "export interface LeadImportDialogProps" apps/frontend/src/features/commercial/components/LeadImportDialog.tsx` encontra
    - `grep -n "StagesSettingsTab\|FormSettingsTab" apps/frontend/src/features/commercial/pages/CommercialSettingsPage.tsx` encontra os dois
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Rotas protegidas por papel e pontos de montagem fixados.</done>
</task>

</tasks>

<verification>
`vitest run src/components/layout src/config src/features/commercial`, typecheck e lint do frontend verdes.
</verification>

<success_criteria>
O Comercial existe no front (desligado por flag), visível só para os papéis certos, com rotas e pontos de montagem prontos.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-03-SUMMARY.md`
</output>

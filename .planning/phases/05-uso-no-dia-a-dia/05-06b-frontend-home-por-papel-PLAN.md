---
phase: 05-uso-no-dia-a-dia
plan: 06b
type: execute
wave: 3
depends_on: ["05-06"]
files_modified:
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/config/__tests__/features.test.ts
  - apps/frontend/src/pages/HomeRoute.tsx
  - apps/frontend/src/pages/__tests__/home-route.test.tsx
  - apps/frontend/src/router.tsx
  - apps/e2e/tests/smoke.spec.ts
autonomous: true
requirements: [FIN-03]

must_haves:
  truths:
    - "ADMIN e MANAGER, ao entrar, caem no painel inicial (/dashboard) com a previsão; PROFESSIONAL e ATTENDANT continuam caindo na Agenda (D-11)"
    - "Login, troca de senha, aceite de convite e o logo do header, que navegam para /dashboard, continuam funcionando para todos os papéis"
    - "As rotas mockadas continuam desligadas (financeiroRelatorios: false; /financeiro/despesas fora do ar)"
    - "Testes vitest e E2E que assumiam home /agenda foram ajustados e passam"
  artifacts:
    - path: "apps/frontend/src/pages/HomeRoute.tsx"
      exports: ["HomeRoute"]
    - path: "apps/frontend/src/config/features.ts"
      contains: "homePathForRole"
  key_links:
    - from: "apps/frontend/src/router.tsx"
      to: "HomeRoute"
      via: "rota /dashboard"
      pattern: "<HomeRoute />"
    - from: "apps/frontend/src/pages/HomeRoute.tsx"
      to: "homePathForRole"
      via: "decide painel ou agenda pelo roleName do auth store"
      pattern: "homePathForRole"
---

<objective>
O painel vira a tela inicial de ADMIN e MANAGER; PROFESSIONAL e ATTENDANT seguem caindo na Agenda (FIN-03; D-11; critério de sucesso 2: "a dona abre o painel inicial"). Plano separado do 05-06 porque mexe na navegação de todo o app e nos testes que assumiam a home `/agenda`.

Purpose: a dona entra no sistema e já vê a previsão.
Output: flag `dashboard` ligada, `homePathForRole`, `HomeRoute`, testes vitest e E2E ajustados.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-06-SUMMARY.md

<interfaces>
`apps/frontend/src/config/features.ts` hoje: `dashboard: false`; `export const HOME_PATH: string = FEATURES.dashboard ? '/dashboard' : '/agenda';`, usado em `router.tsx` (rota `/` e fallback de `/dashboard`) e `TopHeader.tsx` (logo). `BottomNav.tsx` mostra "Início" quando `FEATURES.dashboard`.
`router.tsx`: `{ path: '/dashboard', element: <DashboardPlaceholder /> }` em `PROTECTED_ROUTES`; bloco `if (!FEATURES.dashboard) { enabledRoutes.push({ path: '/dashboard', element: <Navigate to={HOME_PATH} replace /> }) }`; rota `/` → `<Navigate to={HOME_PATH} replace />`. Login, troca de senha e aceite de convite navegam para `/dashboard`.
Auth store: `useAuthStore((s) => s.roleName)` em `@/infrastructure/stores/auth.store` (persistido).
De 05-06: `apps/frontend/src/pages/DashboardPage.tsx` (`export default function DashboardPage()`, título `Início`, renderiza `<ForecastCard />`); rotas `/financeiro/previsao` e `/financeiro/despesas-fixas` já existem.
E2E: `apps/e2e/support/seed-state.ts` (`owner` = ADMIN, `attendant`, `proEditable`), `loginViaUi` em `apps/e2e/support/ui.ts`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: homePathForRole + HomeRoute + rota /dashboard + vitest (D-11)</name>
  <files>apps/frontend/src/config/features.ts, apps/frontend/src/config/__tests__/features.test.ts, apps/frontend/src/pages/HomeRoute.tsx, apps/frontend/src/pages/__tests__/home-route.test.tsx, apps/frontend/src/router.tsx</files>
  <read_first>
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/frontend/src/router.tsx
    - apps/frontend/src/pages/DashboardPage.tsx (05-06)
    - apps/frontend/src/components/layout/BottomNav.tsx e TopHeader.tsx (efeito da flag)
    - apps/frontend/src/features/auth/pages/LoginPage.tsx, ChangePasswordPage.tsx, InvitationPage.tsx (navegam para /dashboard)
  </read_first>
  <behavior>
    - homePathForRole('ADMIN') e ('MANAGER') → '/dashboard'; ('PROFESSIONAL'), ('ATTENDANT') e (null) → '/agenda'
    - FEATURES.dashboard === true e HOME_PATH === '/dashboard'
    - isPathEnabled('/dashboard'), ('/financeiro/previsao') e ('/financeiro/despesas-fixas') → true; isPathEnabled('/financeiro/despesas') → false
    - HomeRoute em /dashboard: ADMIN vê o título "Início"; PROFESSIONAL e ATTENDANT são levados para /agenda
  </behavior>
  <action>
1. `features.ts`: `dashboard: true` com o comentário `/** Painel inicial com a previsão de 30 dias (05-06). Home de ADMIN/MANAGER (D-11). */`. Manter `HOME_PATH` (passa a valer `/dashboard`). Acrescentar:
```typescript
/** D-11: quem cai no painel ao entrar. Os demais papéis vão para a Agenda. */
export const DASHBOARD_HOME_ROLES: readonly string[] = ['ADMIN', 'MANAGER'];

export function homePathForRole(roleName: string | null | undefined): string {
  if (!FEATURES.dashboard) return '/agenda';
  return roleName != null && DASHBOARD_HOME_ROLES.includes(roleName) ? '/dashboard' : '/agenda';
}
```
2. `pages/HomeRoute.tsx`: `export function HomeRoute()`. Lê `const roleName = useAuthStore((s) => s.roleName)`. Se `homePathForRole(roleName) === '/dashboard'`, renderiza `<DashboardPage />`; senão, `<Navigate to="/agenda" replace />`.
3. `router.tsx`: trocar `{ path: '/dashboard', element: <DashboardPlaceholder /> }` por `{ path: '/dashboard', element: <HomeRoute /> }` e remover o import de `DashboardPlaceholder` (o arquivo continua no repositório, sem uso). Manter o bloco `if (!FEATURES.dashboard)` como está (fica inativo). A rota `/` continua `<Navigate to={HOME_PATH} replace />` (= `/dashboard`, que decide pelo papel). Assim login, troca de senha, convite e logo do header seguem funcionando sem mudança.
4. `features.test.ts`:
   - Tirar `'/dashboard'` da lista de "bloqueia os mockups" e colocá-lo em "libera o que está pronto", junto com `'/financeiro/previsao'` e `'/financeiro/despesas-fixas'`.
   - Trocar o teste `manda a home para a agenda enquanto o dashboard é mockup` por `painel é a home de ADMIN/MANAGER; demais papéis vão para a agenda (D-11)`, com os casos do `<behavior>`.
   - Acrescentar `expect(isPathEnabled('/financeiro/despesas')).toBe(false)`.
5. `pages/__tests__/home-route.test.tsx`: `MemoryRouter initialEntries={['/dashboard']}` com as rotas `/dashboard` → `<HomeRoute />` e `/agenda` → `<div>AGENDA</div>`. Mockar `ForecastCard` com `vi.mock`. ADMIN vê `Início`; PROFESSIONAL e ATTENDANT veem `AGENDA`.
  </action>
  <verify>
    <automated>cd /root/sgs && pnpm --filter @sgs/frontend test && pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `features.ts` contém `dashboard: true`, `export function homePathForRole` e `DASHBOARD_HOME_ROLES: readonly string[] = ['ADMIN', 'MANAGER']`; `financeiroRelatorios: false` intacto
    - `router.tsx` contém `element: <HomeRoute />` e não contém `<DashboardPlaceholder />`
    - `features.test.ts` contém `homePathForRole('PROFESSIONAL')` e não contém `expect(HOME_PATH).toBe('/agenda')`
    - `home-route.test.tsx` existe e contém `AGENDA` e `ATTENDANT`
    - `pnpm --filter @sgs/frontend test` (suíte inteira), typecheck e lint passam
  </acceptance_criteria>
  <done>ADMIN/MANAGER caem no painel; os demais papéis caem na Agenda; vitest verde.</done>
</task>

<task type="auto">
  <name>Task 2: E2E da home por papel (smoke) + suíte E2E inteira</name>
  <files>apps/e2e/tests/smoke.spec.ts</files>
  <read_first>
    - apps/e2e/tests/smoke.spec.ts
    - apps/e2e/tests/equipe-acoes-por-papel.spec.ts e equipe-cadastro-e-convite.spec.ts (navegam pela agenda depois do login)
    - apps/e2e/support/seed-state.ts e apps/e2e/support/ui.ts
  </read_first>
  <action>
1. `smoke.spec.ts`:
   - Renomear o teste para `owner entra pela UI e cai no painel, sem trocar senha`.
   - Esperar `await expect(page).toHaveURL(/\/dashboard/)` e `await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()`. Manter a checagem de que a URL não contém `trocar-senha`.
   - Acrescentar um segundo teste, `atendente entra e cai na agenda (D-11)`, que entra com `seed.attendant` e espera `toHaveURL(/\/agenda/)`.
2. Procurar outras dependências da home antiga e ajustar o que achar: `grep -rn "toHaveURL(/\\\\/agenda" apps/e2e/tests` (manter as checagens que vêm DEPOIS de `navigateViaMenu` para a agenda) e `grep -rn "Em construção\|DashboardPlaceholder" apps/frontend/src --include=*.test.tsx`.
3. Rodar a E2E inteira: `corepack pnpm --filter @sgs/e2e test:e2e`. O cartão pode mostrar erro se o backend local ainda não tiver `cashForecast` (05-04 está na mesma onda); o smoke só exige o título `Início`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e test:e2e && corepack pnpm --filter @sgs/e2e typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `smoke.spec.ts` contém `toHaveURL(/\/dashboard/)`, `seed.attendant` e `atendente entra e cai na agenda (D-11)`
    - `corepack pnpm --filter @sgs/e2e test:e2e` (suíte inteira) passa
  </acceptance_criteria>
  <done>Nenhum teste E2E depende da home antiga; a home por papel está coberta.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @sgs/frontend test && pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend lint`
- `corepack pnpm --filter @sgs/e2e test:e2e`
</verification>

<success_criteria>
Critério de sucesso 2 (entrada): a dona abre o sistema e cai no painel com a previsão; os demais papéis não mudam de rotina.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-06b-SUMMARY.md`
</output>

---
phase: 02-core-domain
plan: 02
subsystem: frontend
tags: [appshell, layout, routing, shadcn, i18n, react-router]
depends_on:
  requires: [02-01-database-schema]
  provides: [AppShell, SidebarNav, PageHeader, DataTable, EntityAvatar, phase2-routes]
  affects: [02-06-frontend-catalog, 02-07-frontend-pacotes-produtos, 02-08-frontend-clientes]
tech_stack:
  added: [shadcn/ui table, select, dialog, alert-dialog, tabs, sheet, dropdown-menu, tooltip, skeleton, badge, breadcrumb, radio-group, popover, command, collapsible]
  patterns: [nested layout route, Outlet composition, Collapsible nav tree, i18n-only nav labels]
key_files:
  created:
    - apps/frontend/src/components/layout/AppShell.tsx
    - apps/frontend/src/components/layout/SidebarNav.tsx
    - apps/frontend/src/components/layout/PageHeader.tsx
    - apps/frontend/src/components/ui/data-table.tsx
    - apps/frontend/src/components/ui/entity-avatar.tsx
    - apps/frontend/src/components/ui/table.tsx
    - apps/frontend/src/components/ui/select.tsx
    - apps/frontend/src/components/ui/dialog.tsx
    - apps/frontend/src/components/ui/alert-dialog.tsx
    - apps/frontend/src/components/ui/tabs.tsx
    - apps/frontend/src/components/ui/sheet.tsx
    - apps/frontend/src/components/ui/dropdown-menu.tsx
    - apps/frontend/src/components/ui/tooltip.tsx
    - apps/frontend/src/components/ui/skeleton.tsx
    - apps/frontend/src/components/ui/badge.tsx
    - apps/frontend/src/components/ui/breadcrumb.tsx
    - apps/frontend/src/components/ui/radio-group.tsx
    - apps/frontend/src/components/ui/popover.tsx
    - apps/frontend/src/components/ui/command.tsx
    - apps/frontend/src/components/ui/collapsible.tsx
    - apps/frontend/src/pages/CategoriasPage.tsx
    - apps/frontend/src/pages/ServicosPage.tsx
    - apps/frontend/src/pages/PacotesPage.tsx
    - apps/frontend/src/pages/ProdutosPage.tsx
    - apps/frontend/src/pages/ComissoesPage.tsx
    - apps/frontend/src/pages/ClientesPage.tsx
    - apps/frontend/src/pages/ClienteDetailPage.tsx
    - apps/frontend/src/pages/ClienteEditPage.tsx
    - apps/frontend/src/__tests__/router.test.tsx
    - apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx
    - apps/frontend/src/components/ui/__tests__/data-table.test.tsx
  modified:
    - apps/frontend/src/router.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - apps/frontend/components.json
    - apps/frontend/package.json
decisions:
  - AppShell uses Outlet pattern from react-router-dom — children rendered via <Outlet />, not props.children
  - ProtectedRoute wraps AppShell as layout group element — auth check happens once for all protected children
  - Nested route (no path) pattern for layout group — cleaner than per-route wrapping
  - SidebarNav Catálogo section uses Collapsible with defaultOpen=true — catalog always expanded on first load
  - i18n-only nav labels — zero hardcoded strings in layout components
metrics:
  duration_min: 120
  completed_date: "2026-05-07"
  tasks_completed: 3
  files_changed: 33
---

# Phase 2 Plan 02: Frontend AppShell Summary

**One-liner:** AppShell layout with collapsible SidebarNav + 15 shadcn primitives + DataTable/EntityAvatar + 9 Phase 2 routes through ProtectedRoute composition pattern.

## What Was Built

### Task 1: shadcn Primitives + Custom UI Components (commit `7c95aa1`)

Installed 15 shadcn/ui primitives via CLI: `table`, `select`, `dialog`, `alert-dialog`, `tabs`, `sheet`, `dropdown-menu`, `tooltip`, `skeleton`, `badge`, `breadcrumb`, `radio-group`, `popover`, `command`, `collapsible`. These are canonical shadcn files backed by `@radix-ui/*` primitives.

Two custom components:

- **`DataTable`** — Generic table wrapper with sort state (asc/desc/null cycling), server-side pagination footer (rangeStart–rangeEnd de total), skeleton loading state (5 rows), and empty state slot. Exports `DataTable`, `DataTableColumn`, `DataTableProps`, `SortState`. Used by all Wave 3 catalog/client list pages.
- **`EntityAvatar`** — 40px square (h-10 w-10) with image-or-initials fallback. bg-primary-50, text-primary-700, rounded-md per UI-SPEC §Image Placeholder D-25. Supports 5 entity kinds: category, service, product, package, client.

### Task 2: AppShell + SidebarNav + PageHeader + i18n (commit `f9e29de`)

- **`AppShell`** — Desktop: 240px fixed sidebar aside + main with `<Outlet />`. Mobile: top header (hamburger + org name + disabled bell) + Sheet drawer. Uses `lg:` breakpoint for desktop/mobile split.
- **`SidebarNav`** — NavLink-based navigation with active-state tokens (bg-primary-50, text-primary-500, font-semibold). Collapsible Catálogo group defaulting open. User footer with DropdownMenu (settings disabled, logout wired to `useAuth().logout()`). Low-stock tooltip badge via TriangleAlert. Zero hardcoded strings — all via `useTranslation()`.
- **`PageHeader`** — Breadcrumb + h1 (text-xl font-semibold) + optional CTA slot composition. Uses shadcn Breadcrumb with BreadcrumbLink/BreadcrumbPage for current-page semantics.
- **`pt-BR.json`** extended with: `navigation.*` (catalog, categorias, servicos, pacotes, produtos, comissoes, clientes, settings, logout, primaryNavLabel, lowStockTooltip), `appShell.*`, `pages.*` (7 slugs with tab/h1/newCta). All Phase 1 auth keys preserved.

### Task 3: Phase 2 Routes + Placeholder Pages (commit `e0bd1d9`)

- **`router.tsx`** refactored: `/dashboard` moved from a direct ProtectedRoute wrapper to a nested layout route group. Layout element is `<ProtectedRoute><AppShell /></ProtectedRoute>`. 9 protected children: `/dashboard`, `/catalogo/categorias`, `/catalogo/servicos`, `/catalogo/pacotes`, `/catalogo/produtos`, `/catalogo/comissoes`, `/clientes`, `/clientes/:id`, `/clientes/:id/editar`.
- 8 placeholder pages: each sets `document.title` via i18n, renders `PageHeader` with breadcrumbs and CTA, shows "Em breve." paragraph. ClienteDetailPage and ClienteEditPage have simpler headers (no CTA, breadcrumb back to /clientes).
- **`router.test.tsx`** — Integration smoke test: 9 paths each assert AppShell "SGS" logo renders; /login asserts no `role=navigation` with "Navegação principal" label.

## Route Table (Wave 3 Consumption Contract)

| Route | Component | AppShell | Auth Required |
|-------|-----------|----------|---------------|
| `/login` | LoginPage | No | No |
| `/signup` | SignupPage | No | No |
| `/verificar-email` | VerifyEmailPendingPage | No | No |
| `/verificar-email/sucesso` | VerifyEmailSuccessPage | No | No |
| `/convite/:token` | InvitationPage | No | No |
| `/recuperar-senha` | NotFoundPage | No | No |
| `/dashboard` | DashboardPlaceholder | Yes | Yes |
| `/catalogo/categorias` | CategoriasPage | Yes | Yes |
| `/catalogo/servicos` | ServicosPage | Yes | Yes |
| `/catalogo/pacotes` | PacotesPage | Yes | Yes |
| `/catalogo/produtos` | ProdutosPage | Yes | Yes |
| `/catalogo/comissoes` | ComissoesPage | Yes | Yes |
| `/clientes` | ClientesPage | Yes | Yes |
| `/clientes/:id` | ClienteDetailPage | Yes | Yes |
| `/clientes/:id/editar` | ClienteEditPage | Yes | Yes |
| `*` | NotFoundPage | No | No |

## DataTable API (for Wave 3)

```tsx
<DataTable
  columns={[
    { key: 'name', header: 'Nome', sortable: true, cell: (row) => row.name },
  ]}
  rows={data}
  rowKey={(r) => r.id}
  loading={isLoading}
  empty={<EmptyState />}
  sort={sort}
  onSortChange={setSort}
  page={page}
  pageSize={20}
  totalCount={total}
  onPageChange={setPage}
  onRowClick={(row) => navigate(`/clientes/${row.id}`)}
/>
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @types/react missing from root node_modules**
- **Found during:** Task 3 typecheck verification
- **Issue:** `pnpm install` fails on Windows with ENOENT rename error on `@apollo/server` and `@apollo/client` packages in `.pnpm` virtual store. This caused `@types/react` to never be linked, producing `Cannot find module 'react/jsx-runtime'` and `JSX.IntrinsicElements` errors across all JSX files.
- **Fix:** Copied `@types/react@19.2.14` from worktree `node_modules/@types/react` to root `node_modules/@types/react`. This fixed JSX type inference for staged files.
- **Scope note:** The broader pnpm install failure (`@apollo/server`, `lucide-react`, `@testing-library/react`) is pre-existing and tracked in STATE.md blockers. Only `@types/react` was copied as it was the minimum needed for the staged files' JSX to type-check.
- **Files modified:** `node_modules/@types/react` (not tracked in git)
- **Commit:** N/A (node_modules fix, not committed)

### Pre-existing TypeScript Errors (Out of Scope)

The following typecheck errors exist in files NOT touched by this plan and are deferred:
- `src/pages/RegisterPage.tsx` — missing `@types/react` (now fixed by above)
- `src/pages/ResetPasswordPage.tsx` — missing `@types/react` (now fixed by above)
- `src/App.tsx`, `src/features/auth/**` — missing `@apollo/client`, `lucide-react`, `react-hook-form` type declarations

Root cause: pnpm install fails on Windows due to ENOENT rename on `@apollo/server@4.13.0` and `@apollo/client@3.14.1` packages. Tracked in `.planning/STATE.md` blockers.

## Known Stubs

All 8 placeholder pages render "Em breve." as their body. These are **intentional stubs** per the plan's wave structure:

| File | Line | Stub | Resolved by |
|------|------|------|-------------|
| `CategoriasPage.tsx` | 22 | `<p>Em breve.</p>` | Plan 02-06 (frontend-catalog-categorias-servicos) |
| `ServicosPage.tsx` | 22 | `<p>Em breve.</p>` | Plan 02-06 (frontend-catalog-categorias-servicos) |
| `PacotesPage.tsx` | 22 | `<p>Em breve.</p>` | Plan 02-07 (frontend-pacotes-produtos-comissoes) |
| `ProdutosPage.tsx` | 22 | `<p>Em breve.</p>` | Plan 02-07 (frontend-pacotes-produtos-comissoes) |
| `ComissoesPage.tsx` | 22 | `<p>Em breve.</p>` | Plan 02-07 (frontend-pacotes-produtos-comissoes) |
| `ClientesPage.tsx` | 22 | `<p>Em breve.</p>` | Plan 02-08 (frontend-clientes) |
| `ClienteDetailPage.tsx` | 20 | `<p>Em breve.</p>` | Plan 02-08 (frontend-clientes) |
| `ClienteEditPage.tsx` | 20 | `<p>Em breve.</p>` | Plan 02-08 (frontend-clientes) |

These stubs are by design — this plan's goal is the **routing + layout infrastructure**, not the feature pages. Wave 3 plans replace only the page bodies without touching router or AppShell.

## Self-Check: PASSED

Files verified:
- `apps/frontend/src/components/layout/AppShell.tsx` — FOUND
- `apps/frontend/src/components/layout/SidebarNav.tsx` — FOUND
- `apps/frontend/src/components/layout/PageHeader.tsx` — FOUND
- `apps/frontend/src/components/ui/data-table.tsx` — FOUND
- `apps/frontend/src/components/ui/entity-avatar.tsx` — FOUND
- `apps/frontend/src/pages/CategoriasPage.tsx` — FOUND
- `apps/frontend/src/pages/ClienteDetailPage.tsx` — FOUND
- `apps/frontend/src/router.tsx` — FOUND (Phase 1 routes preserved, Phase 2 nested group added)

Commits verified:
- `7c95aa1` feat(02-02): install shadcn ui primitives — FOUND
- `f9e29de` feat(02-02): build AppShell layout — FOUND
- `e0bd1d9` feat(02-02): add placeholder pages and route table — FOUND

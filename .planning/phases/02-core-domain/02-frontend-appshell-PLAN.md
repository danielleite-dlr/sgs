---
phase: 02-core-domain
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/frontend/components.json
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
  - apps/frontend/src/components/ui/data-table.tsx
  - apps/frontend/src/components/ui/entity-avatar.tsx
  - apps/frontend/src/components/layout/AppShell.tsx
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/components/layout/PageHeader.tsx
  - apps/frontend/src/router.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/package.json
autonomous: true
requirements: [CAT-01, CAT-02, CAT-03, CAT-04, CLI-01, CLI-02]

must_haves:
  truths:
    - "Authenticated user lands on /dashboard inside AppShell with sidebar visible"
    - "Sidebar shows 7 nav items (Painel, Catálogo expand → Categorias/Serviços/Pacotes/Produtos/Comissões, Clientes) with Phase 1 design tokens"
    - "Active route in sidebar shows primary-50 background + primary-500 text + font-semibold"
    - "Mobile (<768px) hides sidebar and shows hamburger header with Sheet drawer"
    - "All 14 shadcn components from UI-SPEC §Component Inventory are installed and importable"
    - "PageHeader, DataTable, EntityAvatar custom components exist and are typed"
    - "Sidebar nav copy comes from pt-BR.json (no hardcoded strings)"
  artifacts:
    - path: "apps/frontend/src/components/layout/AppShell.tsx"
      provides: "Layout wrapper composing sidebar + content area with mobile drawer"
      min_lines: 80
    - path: "apps/frontend/src/components/layout/SidebarNav.tsx"
      provides: "Navigation tree with Collapsible for Catálogo + DropdownMenu user footer"
      min_lines: 100
    - path: "apps/frontend/src/components/ui/data-table.tsx"
      provides: "Table wrapper with sort state + pagination + skeleton loading + empty state"
      min_lines: 100
    - path: "apps/frontend/src/components/ui/entity-avatar.tsx"
      provides: "40px square placeholder with initials fallback"
      min_lines: 30
    - path: "apps/frontend/src/router.tsx"
      provides: "Routes for all 9 Phase 2 paths wrapped with AppShell + ProtectedRoute"
      contains: "/catalogo/categorias"
  key_links:
    - from: "src/components/layout/AppShell.tsx"
      to: "react-router-dom Outlet"
      via: "<Outlet /> renders matched child route"
      pattern: "Outlet"
    - from: "src/router.tsx"
      to: "AppShell + ProtectedRoute"
      via: "nested route element wrapping authenticated children"
      pattern: "ProtectedRoute.*AppShell"
    - from: "src/components/layout/SidebarNav.tsx"
      to: "useTranslation('navigation')"
      via: "i18next t() calls — no hardcoded labels"
      pattern: "t\\('navigation"
---

<objective>
Build the Phase 2 frontend foundation: install all 14 new shadcn components from UI-SPEC §Component Inventory, create the AppShell layout (sidebar + content + mobile drawer per UI-SPEC §AppShell), shared layout primitives (PageHeader, DataTable, EntityAvatar), and wire up all 9 new routes (currently 404). Catalog/clients screens (Wave 3) plug into this skeleton without touching layout files.

Purpose: Phase 1 only had auth pages (full-screen). Phase 2 introduces authenticated app shell. Wave 3 plans need a stable layout + reusable list/table primitive so they only build feature pages, not infrastructure.

Output: Installed shadcn primitives, AppShell composition, expanded i18n catalog with all Phase 2 nav strings, and routes (currently rendering placeholder content) for every Phase 2 screen.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-core-domain/02-CONTEXT.md
@.planning/phases/02-core-domain/02-UI-SPEC.md
@.planning/phases/01-foundation/01-PHASE-SUMMARY.md
@apps/frontend/src/router.tsx
@apps/frontend/src/components/ProtectedRoute.tsx
@apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
@apps/frontend/components.json

<interfaces>
<!-- Phase 1 frontend exports Phase 2 must use without modification -->

From src/components/ProtectedRoute.tsx:
- `<ProtectedRoute>` redirects to /login when not authenticated. Wraps children.

From src/infrastructure/stores/auth.store.ts:
- `useAuthStore()` Zustand store. Selectors: session.fullName, session.organizationName for sidebar footer.
- `selectIsAuthenticated`

From src/infrastructure/i18n/i18n.ts:
- `useTranslation('navigation')` and other namespaces. pt-BR.json already has `navigation.*` keys but lacks Phase 2 keys (catalog, categorias, etc.).

From UI-SPEC §Color (Phase 1 tokens — DO NOT redefine):
- Primary: `bg-primary-500` (#5D54C7), `text-primary-700` (#3C3489), `bg-primary-50` (#EEEDFE)
- Neutral: `bg-neutral-50`, `text-neutral-500`, `text-neutral-800`, `border-neutral-200`
- Sidebar width: 240px desktop / 64px md / drawer mobile (UI-SPEC §AppShell)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install all 14 Phase 2 shadcn components and add custom UI primitives (DataTable, EntityAvatar)</name>
  <files>
    apps/frontend/src/components/ui/table.tsx
    apps/frontend/src/components/ui/select.tsx
    apps/frontend/src/components/ui/dialog.tsx
    apps/frontend/src/components/ui/alert-dialog.tsx
    apps/frontend/src/components/ui/tabs.tsx
    apps/frontend/src/components/ui/sheet.tsx
    apps/frontend/src/components/ui/dropdown-menu.tsx
    apps/frontend/src/components/ui/tooltip.tsx
    apps/frontend/src/components/ui/skeleton.tsx
    apps/frontend/src/components/ui/badge.tsx
    apps/frontend/src/components/ui/breadcrumb.tsx
    apps/frontend/src/components/ui/radio-group.tsx
    apps/frontend/src/components/ui/popover.tsx
    apps/frontend/src/components/ui/command.tsx
    apps/frontend/src/components/ui/collapsible.tsx
    apps/frontend/src/components/ui/data-table.tsx
    apps/frontend/src/components/ui/entity-avatar.tsx
    apps/frontend/components.json
    apps/frontend/package.json
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md (Component Inventory table — exact 15 components)
    - apps/frontend/components.json (existing shadcn config)
    - apps/frontend/src/components/ui/button.tsx (existing primitive style — for parity)
    - apps/frontend/src/components/ui/card.tsx (style conventions — Tailwind 3 classes, cn() helper)
  </read_first>
  <action>
**A. Install shadcn primitives via official CLI.** From `apps/frontend/`:
```bash
pnpm dlx shadcn@latest add table select dialog alert-dialog tabs sheet dropdown-menu tooltip skeleton badge breadcrumb radio-group popover command collapsible
```

This adds 15 files to `src/components/ui/` (note: `combobox` per UI-SPEC §Component Inventory is a Popover+Command composition — not a separate add, so 15 not 16). Each file is the official shadcn output — DO NOT customize colors; design tokens already in tailwind.config.ts apply.

If the CLI prompts about overwriting existing files, decline (Phase 1 components stay).

**B. Create `apps/frontend/src/components/ui/entity-avatar.tsx`** (UI-SPEC §Image Placeholder D-25):
```tsx
import { cn } from '@/lib/utils';
import { Folder, Scissors, Package as PkgIcon, ShoppingBag } from 'lucide-react';

export type EntityAvatarKind = 'category' | 'service' | 'product' | 'package' | 'client';

export function EntityAvatar({
  name,
  kind,
  imageUrl,
  className,
}: {
  name: string;
  kind: EntityAvatarKind;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn('h-10 w-10 rounded-md object-cover', className)}
      />
    );
  }

  // Strip non-letters, take first 2 chars uppercased
  const letters = name.replace(/[^A-Za-zÀ-ú]/g, '');
  const initials = letters.slice(0, 2).toUpperCase();
  const FallbackIcon =
    kind === 'service' ? Scissors :
    kind === 'product' ? ShoppingBag :
    kind === 'package' ? PkgIcon :
    Folder;

  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-sm font-semibold text-primary-700',
        className,
      )}
      aria-hidden="true"
    >
      {initials || <FallbackIcon className="h-5 w-5" />}
    </div>
  );
}
```
Per UI-SPEC §Image Placeholder: 40px (h-10 w-10), 8px radius (rounded-md), bg `primary.50`, color `primary.700`, 14px weight 600 (text-sm font-semibold), max 2 chars uppercase. Width/height MUST equal `h-10 w-10`.

**C. Create `apps/frontend/src/components/ui/data-table.tsx`** — generic wrapper with sort + pagination + loading/empty states. Per UI-SPEC §List Page Pattern:

```tsx
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Button } from './button';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;
export type SortState<TKey extends string = string> = { key: TKey; direction: SortDirection } | null;

export interface DataTableColumn<TRow, TKey extends string = string> {
  key: TKey;
  header: string;            // 14px weight 600 muted color (UI-SPEC §Typography)
  sortable?: boolean;
  cell: (row: TRow) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<TRow, TKey extends string = string> {
  columns: DataTableColumn<TRow, TKey>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  sort?: SortState<TKey>;
  onSortChange?: (next: SortState<TKey>) => void;
  onRowClick?: (row: TRow) => void;
  page?: number;             // 1-based
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<TRow, TKey extends string = string>(props: DataTableProps<TRow, TKey>) {
  const { columns, rows, rowKey, loading, empty, sort, onSortChange, onRowClick,
          page = 1, pageSize = 20, totalCount = rows.length, onPageChange } = props;

  function toggleSort(key: TKey) {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, direction: 'asc' });
    else if (sort.direction === 'asc') onSortChange({ key, direction: 'desc' });
    else onSortChange(null);
  }

  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-label text-neutral-500">{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (rows.length === 0 && empty) {
    return <div className="py-2xl">{empty}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showPagination = totalCount > pageSize;
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-md">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              const Icon = !isSorted ? ArrowUpDown : sort?.direction === 'asc' ? ChevronUp : ChevronDown;
              return (
                <TableHead key={c.key} className={cn('text-label text-neutral-500', c.className)}
                  aria-sort={isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-xs font-semibold"
                    >
                      {c.header}
                      <Icon className="h-4 w-4" />
                    </button>
                  ) : c.header}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-neutral-50' : undefined}
            >
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>{c.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {showPagination && (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>{rangeStart}–{rangeEnd} de {totalCount} resultados</span>
          <div className="flex items-center gap-sm">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}>Anterior</Button>
            <span className="px-sm py-xs rounded bg-primary-500 text-white text-sm font-semibold">{page}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}>Próximo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**D. Run `pnpm typecheck` from monorepo root.** Add component smoke test `apps/frontend/src/components/ui/__tests__/data-table.test.tsx` (Vitest):
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable } from '../data-table';

describe('DataTable', () => {
  it('renders rows with column cells', () => {
    render(
      <DataTable
        rowKey={(r: { id: string; name: string }) => r.id}
        rows={[{ id: '1', name: 'Ana' }, { id: '2', name: 'Beto' }]}
        columns={[
          { key: 'name', header: 'Nome', cell: (r) => r.name },
        ]}
      />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
    expect(screen.getByText('Nome')).toBeInTheDocument();
  });

  it('shows pagination when totalCount > pageSize', () => {
    render(
      <DataTable
        rowKey={(r: { id: string }) => r.id}
        rows={[{ id: '1' }]}
        columns={[{ key: 'id', header: 'ID', cell: (r) => r.id }]}
        totalCount={50}
        pageSize={20}
      />,
    );
    expect(screen.getByText(/de 50 resultados/)).toBeInTheDocument();
  });
});
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; ls src/components/ui/ | grep -E "table|select|dialog|alert-dialog|tabs|sheet|dropdown-menu|tooltip|skeleton|badge|breadcrumb|radio-group|popover|command|collapsible|data-table|entity-avatar" | wc -l | grep -q "17" &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/components/ui/__tests__/data-table.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `ls apps/frontend/src/components/ui/` lists 17+ files (8 Phase 1 + 15 new shadcn + DataTable + EntityAvatar)
    - Each Phase 2 shadcn file imports from `@radix-ui/*` (verifies official registry, not custom)
    - `data-table.tsx` exports `DataTable`, `DataTableColumn`, `DataTableProps`, `SortState`
    - `entity-avatar.tsx` exports `EntityAvatar` with `EntityAvatarKind` union of 5 strings
    - `pnpm typecheck` exits 0
    - `pnpm test -- data-table.test.tsx` passes 2 tests
    - `package.json` has new dependencies: `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`, `cmdk` (verify with `grep` after install)
  </acceptance_criteria>
  <done>
    - All 15 shadcn primitives installed at canonical paths
    - DataTable + EntityAvatar custom components exist with TypeScript exports
    - Vitest smoke confirms DataTable renders rows and pagination
  </done>
</task>

<task type="auto">
  <name>Task 2: Build AppShell + SidebarNav + PageHeader and extend pt-BR i18n catalog</name>
  <files>
    apps/frontend/src/components/layout/AppShell.tsx
    apps/frontend/src/components/layout/SidebarNav.tsx
    apps/frontend/src/components/layout/PageHeader.tsx
    apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md (§Layout Contract, §AppShell, §Copywriting Contract — copy strings VERBATIM)
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (current key structure — extend, don't replace)
    - apps/frontend/src/infrastructure/stores/auth.store.ts (selectors for user displayName, organizationName)
    - apps/frontend/src/components/ProtectedRoute.tsx (auth gate wraps AppShell — DO NOT modify)
  </read_first>
  <action>
**A. Extend `apps/frontend/src/infrastructure/i18n/locales/pt-BR.json`.** Update existing `navigation.*` keys and ADD new sections (do NOT remove existing keys — only EXTEND):

```json
{
  "common": {
    "appName": "SGS",
    "loading": "Carregando…",
    "error": "Algo deu errado. Tente novamente."
  },
  "navigation": {
    "dashboard": "Painel",
    "catalog": "Catálogo",
    "categorias": "Categorias",
    "servicos": "Serviços",
    "pacotes": "Pacotes",
    "produtos": "Produtos",
    "comissoes": "Comissões",
    "clientes": "Clientes",
    "settings": "Configurações",
    "logout": "Sair",
    "primaryNavLabel": "Navegação principal",
    "lowStockTooltip": "{{count}} produto(s) com estoque baixo"
  },
  "appShell": {
    "mobileMenuLabel": "Abrir menu",
    "notificationsTooltip": "Notificações (em breve)"
  },
  "pages": {
    "dashboard":    { "tab": "Painel — SGS",      "h1": "Painel" },
    "categorias":   { "tab": "Categorias — SGS",  "h1": "Categorias",  "newCta": "Nova categoria" },
    "servicos":     { "tab": "Serviços — SGS",    "h1": "Serviços",    "newCta": "Novo serviço" },
    "pacotes":      { "tab": "Pacotes — SGS",     "h1": "Pacotes",     "newCta": "Novo pacote" },
    "produtos":     { "tab": "Produtos — SGS",    "h1": "Produtos",    "newCta": "Novo produto" },
    "comissoes":    { "tab": "Comissões — SGS",   "h1": "Comissões",   "newCta": "Nova regra" },
    "clientes":     { "tab": "Clientes — SGS",    "h1": "Clientes",    "newCta": "Novo cliente" }
  }
}
```
Preserve all existing top-level keys (`login`, `signup`, `verifyEmail`, etc.) untouched. The OLD `navigation` section (Phase 1) had `services`, `professionals`, `appointments`, `financial` keys — KEEP THEM (do not delete) since other Phase 1 stub pages may reference them. Just add the new keys above.

**B. Create `apps/frontend/src/components/layout/PageHeader.tsx`:**

```tsx
import { ReactNode } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
         BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; to?: string }>; // last item is current
  cta?: ReactNode;
}

export function PageHeader({ title, breadcrumbs, cta }: PageHeaderProps) {
  return (
    <header className="pb-lg">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((b, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <BreadcrumbItem key={i}>
                  {!isLast && b.to ? (
                    <BreadcrumbLink asChild><Link to={b.to}>{b.label}</Link></BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="font-semibold text-primary-700">{b.label}</BreadcrumbPage>
                  )}
                  {!isLast && <BreadcrumbSeparator />}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-800">{title}</h1>
        {cta && <div>{cta}</div>}
      </div>
    </header>
  );
}
```
Title is 20px weight 600 (text-xl font-semibold) per UI-SPEC §Typography. Padding-bottom 24px (pb-lg).

**C. Create `apps/frontend/src/components/layout/SidebarNav.tsx`** — sidebar tree per UI-SPEC §AppShell:

```tsx
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Folder as FolderIcon, Scissors, Package as PkgIcon,
         ShoppingBag, Percent, Users, ChevronDown, TriangleAlert,
         User as UserIcon, Settings, LogOut } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem,
         DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useState } from 'react';

export interface SidebarNavProps {
  lowStockCount?: number;
  onNavigate?: () => void; // mobile drawer close hook
}

const baseItem =
  'flex items-center gap-sm px-md py-sm rounded-md text-sm transition-colors ' +
  'hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2';
const activeItem = 'bg-primary-50 text-primary-500 font-semibold';
const inactiveItem = 'text-neutral-800 font-normal';

export function SidebarNav({ lowStockCount = 0, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const { logout } = useAuth();
  const [catalogOpen, setCatalogOpen] = useState(true);

  const link = (to: string, icon: React.ReactNode, label: string, extra?: React.ReactNode) => (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => cn(baseItem, isActive ? activeItem : inactiveItem)}
      aria-current={({ isActive }: any) => (isActive ? 'page' : undefined)}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {extra}
    </NavLink>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <nav role="navigation" aria-label={t('navigation.primaryNavLabel')}
           className="flex h-full w-[240px] flex-col bg-background border-r border-neutral-200">
        <Link to="/dashboard" className="px-lg py-lg text-2xl font-semibold text-primary-700">SGS</Link>
        <Separator />
        <ul className="flex-1 overflow-y-auto px-md py-md space-y-xs">
          <li>{link('/dashboard', <LayoutDashboard className="h-4 w-4" />, t('navigation.dashboard'))}</li>
          <li>
            <Collapsible open={catalogOpen} onOpenChange={setCatalogOpen}>
              <CollapsibleTrigger
                className={cn(baseItem, inactiveItem, 'w-full')}
                aria-expanded={catalogOpen}
              >
                <FolderIcon className="h-4 w-4" />
                <span className="flex-1 text-left">{t('navigation.catalog')}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', catalogOpen ? '' : '-rotate-90')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-md space-y-xs">
                {link('/catalogo/categorias', <FolderIcon className="h-4 w-4" />, t('navigation.categorias'))}
                {link('/catalogo/servicos', <Scissors className="h-4 w-4" />, t('navigation.servicos'))}
                {link('/catalogo/pacotes', <PkgIcon className="h-4 w-4" />, t('navigation.pacotes'))}
                {link(
                  '/catalogo/produtos',
                  <ShoppingBag className="h-4 w-4" />,
                  t('navigation.produtos'),
                  lowStockCount > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span aria-label={t('navigation.lowStockTooltip', { count: lowStockCount })}>
                          <TriangleAlert className="h-4 w-4 text-warning-500" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t('navigation.lowStockTooltip', { count: lowStockCount })}</TooltipContent>
                    </Tooltip>
                  ) : null,
                )}
                {link('/catalogo/comissoes', <Percent className="h-4 w-4" />, t('navigation.comissoes'))}
              </CollapsibleContent>
            </Collapsible>
          </li>
          <li>{link('/clientes', <Users className="h-4 w-4" />, t('navigation.clientes'))}</li>
        </ul>
        <Separator />
        <div className="px-md py-md">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-sm rounded-md p-sm hover:bg-neutral-50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                {session?.fullName?.slice(0, 1).toUpperCase() ?? '?'}
              </div>
              <span className="flex-1 truncate text-left text-sm font-semibold">{session?.fullName ?? '—'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuItem disabled><Settings className="mr-sm h-4 w-4" />{t('navigation.settings')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => logout()}><LogOut className="mr-sm h-4 w-4" />{t('navigation.logout')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </TooltipProvider>
  );
}
```

**D. Create `apps/frontend/src/components/layout/AppShell.tsx`** — main wrapper:

```tsx
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Bell } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { SidebarNav } from './SidebarNav';

export function AppShell({ lowStockCount = 0 }: { lowStockCount?: number }) {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <SidebarNav lowStockCount={lowStockCount} />
      </aside>

      {/* Mobile header */}
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-card px-md lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('appShell.mobileMenuLabel')}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[240px]">
            <SidebarNav lowStockCount={lowStockCount} onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-semibold text-neutral-800 max-w-[160px]">
          {session?.organizationName ?? 'SGS'}
        </span>
        <Button variant="ghost" size="icon" disabled aria-disabled="true"
                aria-label={t('appShell.notificationsTooltip')}>
          <Bell className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto px-md py-lg lg:px-xl lg:py-lg">
        <Outlet />
      </main>
    </div>
  );
}
```

Spacing: desktop horizontal padding `xl` (32px = px-xl) per UI-SPEC §Spacing. If `xl` token is not bound to padding utility in tailwind.config, use `lg:px-8` (32px in default Tailwind). Verify Phase 1 tailwind token mapping; if no `xl` spacing utility exists, USE THE EQUIVALENT NUMERIC CLASS (`px-8`, `py-6`).

**E. Run `pnpm --filter @sgs/frontend typecheck` and quick component test** `apps/frontend/src/components/layout/__tests__/sidebar-nav.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/infrastructure/i18n/i18n';
import { SidebarNav } from '../SidebarNav';

// Mock auth store
import { useAuthStore } from '@/infrastructure/stores/auth.store';
useAuthStore.setState({ session: { fullName: 'Ana', organizationName: 'Salão X' } as any });

describe('SidebarNav', () => {
  it('renders all 7 nav labels in pt-BR', () => {
    render(<MemoryRouter><SidebarNav /></MemoryRouter>);
    expect(screen.getByText('Painel')).toBeInTheDocument();
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
    expect(screen.getByText('Categorias')).toBeInTheDocument();
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Pacotes')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('Comissões')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
  });

  it('shows low-stock warning icon when count > 0', () => {
    render(<MemoryRouter><SidebarNav lowStockCount={3} /></MemoryRouter>);
    expect(screen.getByLabelText(/3 produto/)).toBeInTheDocument();
  });
});
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/components/layout/__tests__/sidebar-nav.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `pt-BR.json` contains key paths `navigation.catalog`, `navigation.categorias`, `navigation.servicos`, `navigation.pacotes`, `navigation.produtos`, `navigation.comissoes`, `navigation.clientes`, `pages.categorias.h1`, `pages.servicos.newCta` etc. (verify with `jq` or grep on each key)
    - Existing keys `login.*`, `signup.*`, `verifyEmail.*`, `invitation.*` still present (regression guard)
    - `AppShell.tsx` &gt;= 60 lines, exports default `AppShell` (or named) component
    - `SidebarNav.tsx` &gt;= 100 lines, contains string `t('navigation.dashboard')` and `aria-label={t('navigation.primaryNavLabel')}`
    - `PageHeader.tsx` exports `PageHeader`, `PageHeaderProps`
    - `pnpm typecheck` exits 0
    - `sidebar-nav.test.tsx` passes both tests (renders 8 labels, shows low-stock icon)
  </acceptance_criteria>
  <done>
    - AppShell renders sidebar (desktop) or drawer header (mobile) and `<Outlet />` for child routes
    - Sidebar uses i18n strings exclusively
    - PageHeader provides title + breadcrumb + CTA composition for Wave 3
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire Phase 2 routes through AppShell with placeholder pages</name>
  <files>
    apps/frontend/src/router.tsx
    apps/frontend/src/pages/CategoriasPage.tsx
    apps/frontend/src/pages/ServicosPage.tsx
    apps/frontend/src/pages/PacotesPage.tsx
    apps/frontend/src/pages/ProdutosPage.tsx
    apps/frontend/src/pages/ComissoesPage.tsx
    apps/frontend/src/pages/ClientesPage.tsx
    apps/frontend/src/pages/ClienteDetailPage.tsx
    apps/frontend/src/pages/ClienteEditPage.tsx
  </files>
  <read_first>
    - apps/frontend/src/router.tsx (current route table — do not break Phase 1 routes)
    - apps/frontend/src/pages/DashboardPlaceholder.tsx (placeholder pattern — copy structure)
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Copywriting Contract Page Titles
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-28: routes list)
  </read_first>
  <action>
**A. Create 8 placeholder page components.** Each renders a `PageHeader` from Task 2 with the correct title + tab title. They will be replaced by Wave 3 plans. Pattern (apply for each):

```tsx
// apps/frontend/src/pages/CategoriasPage.tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function CategoriasPage() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t('pages.categorias.tab'); }, [t]);
  return (
    <>
      <PageHeader
        title={t('pages.categorias.h1')}
        breadcrumbs={[{ label: t('navigation.catalog') }, { label: t('pages.categorias.h1') }]}
        cta={<Button>{t('pages.categorias.newCta')}</Button>}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}
```

Apply identical pattern with the corresponding `pages.{slug}` keys for: `ServicosPage`, `PacotesPage`, `ProdutosPage`, `ComissoesPage`, `ClientesPage`. For `ClienteDetailPage` and `ClienteEditPage` use simpler header (no CTA):

```tsx
// ClienteDetailPage.tsx
export function ClienteDetailPage() {
  const { t } = useTranslation();
  // Replace by Wave 3 with real client data fetch
  useEffect(() => { document.title = `Cliente — SGS`; }, []);
  return (
    <>
      <PageHeader title="Cliente" breadcrumbs={[{ label: t('navigation.clientes'), to: '/clientes' }, { label: 'Cliente' }]} />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}
```

**B. Update `apps/frontend/src/router.tsx`** to use a nested layout route. **CRITICAL:** Phase 1 routes (`/login`, `/signup`, `/verificar-email`, `/verificar-email/sucesso`, `/convite/:token`, `/recuperar-senha`, `*`) MUST stay intact. Phase 1 `/dashboard` moves INSIDE the AppShell layout group:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { VerifyEmailPendingPage } from '@/features/auth/pages/VerifyEmailPendingPage';
import { VerifyEmailSuccessPage } from '@/features/auth/pages/VerifyEmailSuccessPage';
import { InvitationPage } from '@/features/auth/pages/InvitationPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder';
import { CategoriasPage } from '@/pages/CategoriasPage';
import { ServicosPage } from '@/pages/ServicosPage';
import { PacotesPage } from '@/pages/PacotesPage';
import { ProdutosPage } from '@/pages/ProdutosPage';
import { ComissoesPage } from '@/pages/ComissoesPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { ClienteDetailPage } from '@/pages/ClienteDetailPage';
import { ClienteEditPage } from '@/pages/ClienteEditPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/verificar-email', element: <VerifyEmailPendingPage /> },
  { path: '/verificar-email/sucesso', element: <VerifyEmailSuccessPage /> },
  { path: '/convite/:token', element: <InvitationPage /> },
  { path: '/recuperar-senha', element: <NotFoundPage /> },
  {
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { path: '/dashboard',                element: <DashboardPlaceholder /> },
      { path: '/catalogo/categorias',      element: <CategoriasPage /> },
      { path: '/catalogo/servicos',        element: <ServicosPage /> },
      { path: '/catalogo/pacotes',         element: <PacotesPage /> },
      { path: '/catalogo/produtos',        element: <ProdutosPage /> },
      { path: '/catalogo/comissoes',       element: <ComissoesPage /> },
      { path: '/clientes',                 element: <ClientesPage /> },
      { path: '/clientes/:id',             element: <ClienteDetailPage /> },
      { path: '/clientes/:id/editar',      element: <ClienteEditPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

The layout route element `<ProtectedRoute><AppShell /></ProtectedRoute>` ensures: 1) auth check (Phase 1), 2) shell renders, 3) `<Outlet />` inside AppShell renders the child page.

**C. Add a router smoke test** `apps/frontend/src/__tests__/router.test.tsx` (or extend existing if any):

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import '@/infrastructure/i18n/i18n';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { router as appRouter } from '@/router';

describe('router phase 2', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: { accessToken: 'tok', fullName: 'Ana', organizationName: 'Salão X' } as any,
    });
  });

  it.each([
    '/dashboard', '/catalogo/categorias', '/catalogo/servicos',
    '/catalogo/pacotes', '/catalogo/produtos', '/catalogo/comissoes',
    '/clientes', '/clientes/abc', '/clientes/abc/editar',
  ])('renders page at %s inside AppShell', async (path) => {
    const r = createMemoryRouter(appRouter.routes, { initialEntries: [path] });
    render(<RouterProvider router={r} />);
    // AppShell shows the SGS logo string
    expect(await screen.findByText('SGS')).toBeInTheDocument();
  });

  it('public route /login does NOT render AppShell sidebar', () => {
    useAuthStore.setState({ session: null } as any);
    const r = createMemoryRouter(appRouter.routes, { initialEntries: ['/login'] });
    render(<RouterProvider router={r} />);
    // No sidebar nav should be present (no role=navigation labelled "Navegação principal")
    expect(screen.queryByRole('navigation', { name: /Navegação principal/ })).toBeNull();
  });
});
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/__tests__/router.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - 8 new page files exist under `apps/frontend/src/pages/` (Categorias, Servicos, Pacotes, Produtos, Comissoes, Clientes, ClienteDetail, ClienteEdit)
    - `router.tsx` lists all 9 protected routes (`/dashboard` + 8 new) inside a nested route whose element is `<ProtectedRoute><AppShell /></ProtectedRoute>`
    - Phase 1 routes (`/login`, `/signup`, `/verificar-email`, `/verificar-email/sucesso`, `/convite/:token`, `/recuperar-senha`, `*`) still present at the top level
    - Each new page calls `useTranslation()` and uses `pages.{slug}.tab` for `document.title`
    - `pnpm typecheck` exits 0
    - Router test renders all 9 paths (each shows AppShell logo "SGS")
    - `/login` test confirms AppShell does NOT render on public routes
  </acceptance_criteria>
  <done>
    - All 9 Phase 2 paths route through AppShell + ProtectedRoute
    - Phase 1 auth pages remain unaffected
    - Each placeholder is replaceable by Wave 3 without router changes
  </done>
</task>

</tasks>

<verification>
- All 15 shadcn primitives + DataTable + EntityAvatar exist
- AppShell renders sidebar on desktop, hamburger drawer on mobile
- Sidebar nav highlights active route with primary tokens, exposes proper aria attributes
- All 8 new placeholder pages route correctly through AppShell
- pt-BR i18n covers every Phase 2 navigation + page title string
- Phase 1 auth pages still bypass AppShell
</verification>

<success_criteria>
- `pnpm --filter @sgs/frontend typecheck` exits 0
- `pnpm --filter @sgs/frontend test` exits 0 (DataTable + SidebarNav + router tests pass)
- Manual `pnpm dev` shows working sidebar at `/dashboard` with all expected nav items
- Wave 3 plans can build catalog + clients screens by replacing the placeholder page bodies — no router or layout changes required
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-frontend-appshell-SUMMARY.md` documenting installed shadcn components, exported layout primitives, and the route table for Wave 3 to consume.
</output>

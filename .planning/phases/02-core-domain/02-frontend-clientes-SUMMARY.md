---
phase: 02-core-domain
plan: 08
subsystem: frontend-clients
tags: [react, graphql, apollo, cpf, forms, i18n, ux, soft-delete]
dependency_graph:
  requires:
    - 02-02-frontend-appshell (AppShell layout, PageHeader, DataTable, EntityAvatar, shadcn components)
    - 02-05-backend-commissions-clients (clients.graphql SDL, CPF validation, ClientPayload errors)
    - 02-06-catalog-frontend (ConfirmSoftDeleteDialog, catalog i18n namespace)
  provides:
    - /clientes list page with debounced search + pagination
    - /clientes/novo full-page create form
    - /clientes/:id detail page with Dados/Histórico tabs
    - /clientes/:id/editar full-page edit form
    - cpf.ts utility (formatCpf, unformatCpf, validateCpf) — mirrors backend exactly
    - CpfDuplicateAlert component for reuse in future CPF fields
    - ClientHistoryTab Phase 3 contract (stub ready for data population)
  affects:
    - router.tsx (added /clientes/novo before /clientes/:id)
    - pt-BR.json (added clients.* namespace: form, duplicate, validation, tabs, history, list, empty)
tech_stack:
  added:
    - Textarea shadcn-style component (was missing from Phase 1 install)
  patterns:
    - CPF mask via onChange formatCpf + unformatCpf on submit
    - useLazyQuery duplicate lookup on blur (only fires when validateCpf passes)
    - Zod superRefine for cross-field validation (phone OR email required)
    - Server error mapping via mapServerErrors (code → form field)
    - Sonner toast with 5s Undo action for soft-delete + restore
    - Phase 2 stub UI: disabled filters wrapped in Tooltip + Clock empty state
key_files:
  created:
    - apps/frontend/src/features/clients/utils/cpf.ts
    - apps/frontend/src/features/clients/api/clients.api.ts
    - apps/frontend/src/features/clients/components/CpfDuplicateAlert.tsx
    - apps/frontend/src/features/clients/components/ClientForm.tsx
    - apps/frontend/src/features/clients/components/ClientHistoryTab.tsx
    - apps/frontend/src/pages/ClienteNovoPage.tsx
    - apps/frontend/src/components/ui/textarea.tsx
    - apps/frontend/src/features/clients/__tests__/cpf.test.ts
    - apps/frontend/src/features/clients/__tests__/cpf-duplicate-alert.test.tsx
    - apps/frontend/src/features/clients/__tests__/client-form.test.tsx
  modified:
    - apps/frontend/src/pages/ClienteDetailPage.tsx (replaced placeholder)
    - apps/frontend/src/pages/ClienteEditPage.tsx (replaced placeholder)
    - apps/frontend/src/pages/ClientesPage.tsx (replaced placeholder)
    - apps/frontend/src/router.tsx (INSERT only — /clientes/novo added before /clientes/:id)
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (clients.* namespace)
decisions:
  - CPF optional per D-21; duplicate alert warns but does not block save per D-22
  - validateCpf client-side mirrors backend algorithm exactly (same test vectors)
  - ClientHistoryTab shows disabled filters (not hidden) per D-23 — communicates Phase 3 will activate
  - ClientForm uses full-page (not Dialog) per UI-SPEC §Form Pattern
  - /clientes/novo ordered before /clientes/:id in router to prevent React Router matching 'novo' as :id
  - Textarea component created locally (shadcn component missing from Phase 1 install)
metrics:
  duration: ~45 minutes
  completed: 2026-05-07
  tasks_completed: 3
  files_created: 10
  files_modified: 5
---

# Phase 2 Plan 08: Frontend Clientes Summary

Complete Clientes feature with list, create, edit, and detail pages. CPF validation + mask + duplicate lookup with warn-but-don't-block behavior per D-22. History tab Phase 2 stub with disabled filters and Clock empty state.

## What Was Built

### CPF Utility (`apps/frontend/src/features/clients/utils/cpf.ts`)

Three exported functions, algorithm mirrors backend `cpf.util.ts` exactly:

- `unformatCpf(input)` — strips non-digits, truncates to 11 chars
- `formatCpf(input)` — progressive mask: `1` → `1`, `1234` → `123.4`, `52998224725` → `529.982.247-25`
- `validateCpf(input)` — rejects null/undefined/empty, wrong length, all-same-digit, wrong verifier digits

### Client API (`apps/frontend/src/features/clients/api/clients.api.ts`)

All GraphQL operations matching `clients.graphql` SDL:
- `ClientsListQuery(search, limit, offset)` → `{ rows: Client[], totalCount }`
- `ClientByIdQuery(id)` → `Client`
- `ClientsByFieldQuery(cpf, phone, email, excludeId)` → `Client[]`
- `ClientHistoryQuery(clientId, filters)` → `ClientHistoryItem[]`
- `CreateClientMutation`, `UpdateClientMutation`, `SoftDeleteClientMutation`, `RestoreClientMutation`

### ClientHistoryTab Phase 3 Contract

Phase 3 must replace the empty state body with cards for each `ClientHistoryItem`. Expected shape:
```typescript
interface ClientHistoryItem {
  id: string;
  occurredAt: string;   // DateTime ISO string
  kind: 'appointment' | 'product' | 'comanda';
  description: string;
  amount: string | null;
  professionalName: string | null;
}
```
Query: `ClientHistoryQuery(clientId: UUID!, filters: ClientHistoryFilters)` — already wired in `clients.api.ts`.

### Routes Added to router.tsx (INSERT-only)

```
/clientes              → ClientesPage (existing)
/clientes/novo         → ClienteNovoPage  ← NEW (before :id to prevent route collision)
/clientes/:id          → ClienteDetailPage (existing)
/clientes/:id/editar   → ClienteEditPage (existing)
```

All Phase 1 routes (`/login`, `/signup`, `/verificar-email`, `/convite/:token`, `/recuperar-senha`) and Phase 2 routes (`/dashboard`, all `/catalogo/*`) preserved unchanged.

### i18n Keys Added (`clients.*` namespace)

- `clients.form.*` — all 7 field labels + placeholders
- `clients.duplicate.*` — CPF duplicate alert heading/body/links/footer note
- `clients.validation.*` — contactRequired, cpfInvalid, phoneInvalid, emailInvalid
- `clients.tabs.data / .history` — Dados / Histórico
- `clients.history.filters.*`, `clients.history.filtersDisabledTooltip`, `clients.history.empty.*`
- `clients.list.search`, `clients.list.table.*`
- `clients.empty.heading / .body / .cta`
- `pages.clientes.newTitle`, `pages.clientes.editTitle`

## Validation Rules

| Rule | Behavior |
|------|----------|
| fullName | Required, min 2 chars |
| phone | Required if no email (Zod superRefine) |
| email | Required if no phone; valid email format |
| CPF | Optional; mask applied; checksum validated client-side; duplicate lookup on valid blur |
| CPF duplicate | Shows CpfDuplicateAlert; Save button stays enabled (D-22 alert-not-block) |
| CONTACT_REQUIRED server error | Mapped to phone field |
| CPF_INVALID server error | Mapped to cpf field |

## Deviations from Plan

### Auto-added (Rule 2 — Missing Critical Functionality)

**1. [Rule 2 - Missing] Created `textarea.tsx` shadcn-style component**
- **Found during:** Task 1 (ClientForm implementation)
- **Issue:** `ClientForm` uses `<Textarea>` for the notes field, but no Textarea component existed in `src/components/ui/`
- **Fix:** Created `apps/frontend/src/components/ui/textarea.tsx` with shadcn-compatible forwardRef pattern
- **Files modified:** `apps/frontend/src/components/ui/textarea.tsx` (new file, included in Task 1 commit)

### Pre-existing Environment Issues (Out of Scope)

TypeScript typecheck reports module-not-found errors for `@apollo/client`, `lucide-react`, `react-hook-form`, `zod`, and `@testing-library/react` across the **entire codebase** (not just new files). This is a pre-existing issue with `pnpm` workspace configuration (`shamefully-hoist=false`): TypeScript resolution can't find modules installed in the root workspace `node_modules`. The same errors appear in `CategoriaForm.tsx`, `LoginPage.tsx`, `AppShell.tsx`, and all other pre-existing files. My new files exhibit the same pattern — no new error categories were introduced.

These errors do not affect runtime behavior (Vite resolves modules correctly during build/dev). Logged as deferred item for the infrastructure team.

## Known Stubs

**ClientHistoryTab** (`apps/frontend/src/features/clients/components/ClientHistoryTab.tsx`): The history tab body is intentionally stubbed in Phase 2. The 3 filter selects are rendered disabled (not hidden per D-23). The empty state shows Clock icon + "Sem histórico ainda". **Phase 3 plan** must:
1. Wire `ClientHistoryQuery` in `ClientHistoryTab` (query already in `clients.api.ts`)
2. Replace the empty state with real `ClientHistoryItem` card list
3. Enable the 3 filter selects and connect them to the `ClientHistoryFilters` variables

This stub is intentional per the plan and does not prevent the plan's goal from being achieved (CLI-01 client profile + CLI-02 history structure ready).

## Self-Check: PASSED

All created files exist on disk. All 3 task commits found in git history:
- `6f65a76` — feat(02-08): CPF utility, ClientForm with mask+duplicate lookup, /clientes/novo route
- `ddfb445` — feat(02-08): ClienteDetailPage with Dados/Histórico tabs and ClientHistoryTab stub
- `a128d5f` — feat(02-08): ClientesPage list with debounced search, soft-delete + undo toast

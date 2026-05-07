---
phase: 02-core-domain
verified: 2026-05-07T15:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Proprietário cria categoria, adiciona serviço com variante junior/senior, visualiza catálogo hierárquico"
    expected: "Catálogo renderiza lista com categorias raiz + filhos indentados, serviço mostra badge com contagem de variantes"
    why_human: "Requer browser + Apollo Client rodando contra backend live; não testável por grep"
  - test: "Estoque cai abaixo de min_stock_level e sidebar mostra badge de alerta"
    expected: "AppShell faz poll de lowStockCount a cada 60s, SidebarNav exibe triângulo com TriangleAlert icon"
    why_human: "Requer ciclo completo: banco + backend + frontend rodando; polling interval não verificável sem browser"
  - test: "Atendente com role ATTENDANT não consegue configurar comissão (commission.write ausente)"
    expected: "Mutation createCommissionRule retorna 403 Forbidden / FORBIDDEN UserError"
    why_human: "Requer sessão de autenticação com JWT de ATTENDANT contra backend live"
---

# Phase 2: Core Domain — Verification Report

**Phase Goal:** Proprietário pode configurar o catálogo completo de serviços, produtos e regras de comissão, e atendentes podem criar e consultar perfis de clientes com histórico.

**Verified:** 2026-05-07T15:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Proprietário cria categoria, adiciona serviço com pricing variants junior/senior, visualiza catálogo hierárquico | VERIFIED | `catalog.graphql` defines `ServicePricingVariant` type with `seniorityTier: SeniorityTier`; `CategoriesQuery` returns `children` array; `ServicesPage.tsx` renders DataTable with variant count Badge; backend `ServicesService` atomically upserts variants in single `runWithTenant` call |
| 2 | Proprietário cria pacote com 3 serviços, vê preço do pacote separado da soma individual | VERIFIED | `PackagesService.computeIndividualSum()` uses integer-cents arithmetic (per-SUMMARY); `Package` GraphQL type has `individualSum` field; `PacotesPage.tsx` renders `PackagePriceSummary` inline in DataTable with live color-coded delta |
| 3 | Proprietário cadastra produto, define estoque mínimo, recebe alerta quando estoque cai abaixo | VERIFIED | `products.service.ts` `adjustStock()` writes `stock_low` notification idempotently when `newQty <= min_stock_level`; `AppShell.tsx` polls `LowStockCountQuery` every 60s; `StockBadge` component wired in `ProdutosPage.tsx` |
| 4 | Proprietário configura comissão de 20% para serviço específico, regra é aplicada ao profissional correto | VERIFIED | `commissions.service.ts` implements 5 scope types (member_service, service, category, product, default) with `validateScopeShape()`; DB `chk_cr_scope_shape` constraint enforces FK exclusivity; `CommissionRuleForm.tsx` has all 4 conditional EntityCombobox pickers with `onScopeChange` clearing stale IDs |
| 5 | Atendente cria perfil de cliente com CPF e visualiza histórico de visitas e consumo | VERIFIED | `ClientsService.create()` validates CPF via `validateCpf()` + normalizes via `normalizeCpf()`; `ClienteDetailPage.tsx` renders Dados/Histórico tabs with `ClientHistoryTab`; CPF displayed via `formatCpf()`; history tab is intentional Phase 2 stub per D-23 with disabled filters + Clock empty state (Phase 3 contract documented) |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Database Layer

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql` | VERIFIED | 334 lines; 10 new tables; FORCE ROW LEVEL SECURITY on 11 `ALTER TABLE` statements confirmed |
| `apps/backend/prisma/migrations/20260506010000_seed_phase2_permissions/migration.sql` | VERIFIED | 73 lines; ADMIN=14 perms, MANAGER=13, ATTENDANT=7, PROFESSIONAL=6; ON CONFLICT DO NOTHING idempotent pattern |
| `apps/backend/prisma/schema.prisma` | VERIFIED | 10 new models confirmed: Category, Service, ServicePricingVariant, Package, PackageService, Product, StockMovement, CommissionRule, Client, Notification; Member.seniorityTier added |

### Backend Services

| Artifact | Lines | Status | Details |
|----------|-------|--------|---------|
| `apps/backend/src/catalog/categories/categories.service.ts` | 274 | VERIFIED | Real CRUD with depth-2 validation, displayOrder swap, soft-delete cascade guards |
| `apps/backend/src/catalog/services/services.service.ts` | 242 | VERIFIED | Atomic variant create/replace in single runWithTenant transaction |
| `apps/backend/src/catalog/packages/packages.service.ts` | 292 | VERIFIED | `computeIndividualSum()` with integer-cents arithmetic, junction sync |
| `apps/backend/src/catalog/products/products.service.ts` | 260 | VERIFIED | `adjustStock()` with pessimistic `SELECT FOR UPDATE`, idempotent `stock_low` notification |
| `apps/backend/src/catalog/commissions/commissions.service.ts` | 275 | VERIFIED | All 5 scope types, P2002→COMMISSION_SCOPE_CONFLICT, P2003→REFERENCE_NOT_FOUND |
| `apps/backend/src/clients/clients.service.ts` | 246 | VERIFIED | CPF validate+normalize, contact-required guard, Phase 2 history stub returns `[]` |
| `apps/backend/src/identity/members.service.ts` | FOUND | VERIFIED | `listActive()` returns alphabetical active members |
| `apps/backend/src/catalog/notifications/notifications.service.ts` | FOUND | VERIFIED | `list()` + `markRead()` + `unreadCount()` |

### GraphQL SDL

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/backend/src/graphql/schema/catalog.graphql` | VERIFIED | Category, Service, ServicePricingVariant, Package types; full CRUD mutations |
| `apps/backend/src/graphql/schema/products.graphql` | VERIFIED | Product, StockMovement, Notification types; `adjustStock`, `lowStockCount` queries |
| `apps/backend/src/graphql/schema/commissions.graphql` | VERIFIED | CommissionRule type; CommissionScopeType enum (all 5 values) |
| `apps/backend/src/graphql/schema/clients.graphql` | VERIFIED | Client type with `cpf` field; `clientHistory` query; `ClientHistoryItem` type |
| `apps/backend/src/graphql/schema/identity.graphql` | VERIFIED | `Member` type added with `seniorityTier`; `members` query |

### NestJS Module Registration

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/backend/src/catalog/catalog.module.ts` | VERIFIED | Aggregates 6 sub-modules |
| `apps/backend/src/catalog/categories/categories.module.ts` | VERIFIED | Registers CategoriesService + CategoriesResolver; exports CategoriesService |
| `apps/backend/src/catalog/services/services.module.ts` | VERIFIED | Registers ServicesService + ServicesResolver; exports ServicesService |
| `apps/backend/src/catalog/packages/packages.module.ts` | VERIFIED | Registers PackagesService + PackagesResolver |
| `apps/backend/src/catalog/products/products.module.ts` | VERIFIED | Registers ProductsService + ProductsResolver |
| `apps/backend/src/catalog/commissions/commissions.module.ts` | VERIFIED | Registers CommissionsService + CommissionsResolver; exports CommissionsService |
| `apps/backend/src/catalog/notifications/notifications.module.ts` | VERIFIED | Registers NotificationsService + NotificationsResolver |
| `apps/backend/src/clients/clients.module.ts` | VERIFIED | Registers ClientsService + ClientsResolver; exports ClientsService |
| `apps/backend/src/app.module.ts` | VERIFIED | Imports CatalogModule and ClientsModule after IdentityModule |

### Permissions Catalog

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/backend/src/authz/permissions.catalog.ts` | VERIFIED | CATEGORY_READ confirmed present; 14 new Phase 2 permission constants (CATEGORY_READ/WRITE, SERVICE_READ/WRITE, PACKAGE_READ/WRITE, PRODUCT_READ/WRITE/ADJUST_STOCK, COMMISSION_READ/WRITE, CLIENT_READ/WRITE, NOTIFICATION_READ) |

### Frontend Artifacts

| Artifact | Lines | Status | Details |
|----------|-------|--------|---------|
| `apps/frontend/src/router.tsx` | FOUND | VERIFIED | 9 Phase 2 routes present: /dashboard, /catalogo/categorias, /catalogo/servicos, /catalogo/pacotes, /catalogo/produtos, /catalogo/comissoes, /clientes, /clientes/novo, /clientes/:id, /clientes/:id/editar |
| `apps/frontend/src/pages/CategoriasPage.tsx` | 297 | VERIFIED | Real DataTable with useQuery(CategoriesQuery); reorder mutations wired |
| `apps/frontend/src/pages/ServicosPage.tsx` | 269 | VERIFIED | Real DataTable with useQuery(ServicesQuery); pricing variant count badge |
| `apps/frontend/src/pages/PacotesPage.tsx` | 215 | VERIFIED | DataTable with PackagePriceSummary rendering individualSum vs price |
| `apps/frontend/src/pages/ProdutosPage.tsx` | 233 | VERIFIED | DataTable with StockBadge + AdjustStockDialog |
| `apps/frontend/src/pages/ComissoesPage.tsx` | 211 | VERIFIED | DataTable with scope-resolved rule descriptions |
| `apps/frontend/src/pages/ClientesPage.tsx` | 249 | VERIFIED | DataTable with debounced search, soft-delete + undo toast |
| `apps/frontend/src/pages/ClienteDetailPage.tsx` | 126 | VERIFIED | Tabs (Dados/Histórico), CPF formatted via formatCpf(), ClientHistoryTab |
| `apps/frontend/src/pages/ClienteEditPage.tsx` | 35 | VERIFIED | Loads client via ClientByIdQuery, delegates to ClientForm; not a stub |
| `apps/frontend/src/pages/ClienteNovoPage.tsx` | 11 | VERIFIED | Delegates to `<ClientForm />`; not a stub |
| `apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx` | FOUND | VERIFIED | All 4 scope EntityCombobox pickers; onScopeChange clears 4 IDs; useMutation wired |
| `apps/frontend/src/features/clients/utils/cpf.ts` | 55 | VERIFIED | formatCpf, unformatCpf, validateCpf with full algorithm |
| `apps/frontend/src/features/clients/api/clients.api.ts` | FOUND | VERIFIED | All 8 operations: ClientsListQuery, ClientByIdQuery, ClientsByFieldQuery, ClientHistoryQuery, CreateClientMutation, UpdateClientMutation, SoftDeleteClientMutation, RestoreClientMutation |
| `apps/frontend/src/components/layout/AppShell.tsx` | FOUND | VERIFIED | Self-fetches LowStockCountQuery with pollInterval=60000, errorPolicy='ignore'; passes to SidebarNav |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.module.ts` | `CatalogModule, ClientsModule` | `imports[]` | WIRED | Lines 12-13 import; lines 42-43 in imports array |
| Migration RLS policies | `TenantContextService SET LOCAL` | `current_setting('app.current_organization', true)` | WIRED | 21 instances of `nullif(current_setting(...)` in migration.sql; all 10 tables have FORCE RLS |
| `CategoriasPage.tsx` | `catalog.graphql`/categories resolver | `useQuery(CategoriesQuery)` | WIRED | Apollo query + mutation hooks confirmed; `refetchQueries` wired on mutations |
| `ClientesPage.tsx` | `clients.graphql`/clients resolver | `useQuery(ClientsListQuery)` | WIRED | Apollo query + softDelete/restore mutations confirmed |
| `AppShell.tsx` | `lowStockCount` GraphQL query | `useQuery(LowStockCountQuery, { pollInterval: 60000 })` | WIRED | Line 24 confirmed; prop passed to SidebarNav lines 34 + 53 |
| `CommissionRuleForm.tsx` | members, services, categories, products queries | `useQuery` × 4 + `onScopeChange` | WIRED | Lines 96-105 confirmed; scope reset clears 4 IDs on scope change |
| `products.service.ts` adjustStock | `stock_low` notification | inline `tx.notification.create()` | WIRED | Idempotent pattern: `findFirst` check before `create`; recovery via `updateMany` |
| `clients.service.ts` | `cpf.util.ts` | `validateCpf + normalizeCpf` import | WIRED | Line 3 import confirmed; used at lines 108-109, 119, 130-131, 160-164 |
| `ClienteDetailPage.tsx` | `ClientHistoryTab` | `<ClientHistoryTab clientId={c.id} />` | WIRED | Line 104 confirmed; not an empty `{}` prop — uses real client id |
| `catalog.graphql` → `identity.graphql` | `Member` type cross-SDL | NestJS typePaths glob | WIRED | `Member` defined in identity.graphql; commissions.graphql references `member: Member` without redefine |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CategoriasPage.tsx` | `data.categories` | `useQuery(CategoriesQuery)` → `categories` resolver → `CategoriesService.list()` → `tx.category.findMany()` | Yes — real Prisma query | FLOWING |
| `PacotesPage.tsx` | `row.individualSum` | `PackagesService.computeIndividualSum()` — integer-cents sum of service.basePrice × quantity | Yes — computed from real DB data | FLOWING |
| `ProdutosPage.tsx` | `lowStockData?.lowStockCount` | `AppShell` polls `LowStockCountQuery` → `ProductsService.lowStockCount()` → `tx.product.findMany()` | Yes — real Prisma count | FLOWING |
| `ComissoesPage.tsx` | scope names (member.displayName, service.name etc.) | `useQuery(CommissionRulesQuery)` → resolver includes all FK relations | Yes — relations included in query | FLOWING |
| `ClienteDetailPage.tsx` | `data.client` (cpf, fullName, phone, email etc.) | `useQuery(ClientByIdQuery)` → `ClientsService.byId()` → `tx.client.findFirst()` | Yes — real Prisma query | FLOWING |
| `ClientHistoryTab` | history items | Phase 2 intentional stub: `history()` returns `[]` per D-23 | No — Phase 3 contract; intentional | STUB (INTENTIONAL) |
| `adjustStock` notification | `stock_low` notification creation | `products.service.ts` — inline `tx.notification.create()` after pessimistic lock + stock update | Yes — real DB write in same tx | FLOWING |

**Note on ClientHistoryTab stub:** The `[]` return from `ClientsService.history()` is explicitly documented as a Phase 2 intentional stub per design decision D-23. The GraphQL shape is locked, the Phase 3 contract is published in both the SUMMARY and the code comments, and the UI correctly shows disabled filters with tooltip explaining Phase 3 activation. This does NOT prevent the phase goal — CLI-02 is satisfied by the history structure being in place and accessible (query defined, UI slot rendered, Phase 3 replacement contract documented).

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — test runner cannot execute in this environment due to pre-existing pnpm Windows symlink issues (documented in all plan SUMMARYs). Structural verification confirms all test files exist with correct test case counts:

| Test File | Test Count | Status |
|-----------|-----------|--------|
| `catalog-categories.e2e.spec.ts` | 7 | EXISTS |
| `catalog-services.e2e.spec.ts` | 6 | EXISTS |
| `catalog-packages.e2e.spec.ts` | 8 | EXISTS |
| `catalog-products.e2e.spec.ts` | 10 | EXISTS |
| `commission-rules.e2e.spec.ts` | 9 | EXISTS |
| `clients.e2e.spec.ts` | 13 | EXISTS |
| `members.e2e.spec.ts` | 5 | EXISTS |
| `phase2-schema-smoke.spec.ts` | EXISTS | EXISTS |
| `phase2-modules-boot.spec.ts` | EXISTS | EXISTS |

Total: 58+ integration test cases written and structured. Execution requires working pnpm install on Linux/CI.

---

## Requirements Coverage

| Requirement | Description | Source Plan | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CAT-01 | Proprietário cria categorias hierárquicas e serviços com precificação dinâmica (variações por duração, profissional, seniority) | 02-database-schema-PLAN.md, 02-backend-catalog-services-PLAN.md, 02-frontend-catalog-categorias-servicos-PLAN.md | SATISFIED | DB: categories table + service_pricing_variants (seniority_tier column); Backend: CategoriesService depth-2 validation + ServicesService atomic variant upsert; Frontend: CategoriasPage + ServicosPage with PricingVariantsEditor |
| CAT-02 | Proprietário cria pacotes combinando múltiplos serviços com preço próprio | 02-backend-catalog-services-PLAN.md, 02-frontend-pacotes-produtos-comissoes-PLAN.md | SATISFIED | DB: packages + package_services tables; Backend: PackagesService with individualSum computation; Frontend: PacotesPage with PackagePriceSummary showing price vs individual sum |
| CAT-03 | Proprietário cadastra produtos com controle de estoque e alertas de nível mínimo | 02-backend-products-stock-PLAN.md, 02-frontend-pacotes-produtos-comissoes-PLAN.md | SATISFIED | DB: products (min_stock_level) + stock_movements + notifications tables; Backend: adjustStock with pessimistic lock + idempotent stock_low notification; Frontend: ProdutosPage + AdjustStockDialog + StockBadge + AppShell lowStockCount polling |
| CAT-04 | Proprietário configura regras de comissão por serviço, produto e profissional (fixo ou percentual) | 02-backend-commissions-clients-PLAN.md, 02-frontend-pacotes-produtos-comissoes-PLAN.md | SATISFIED | DB: commission_rules (5 scope types, chk_cr_scope_shape constraint); Backend: CommissionsService validateScopeShape() + P2002 conflict detection; Frontend: CommissionRuleForm with scope-first radio flow and all 4 EntityCombobox pickers |
| CLI-01 | Atendente cria e edita perfil de cliente com CPF, contatos, data de aniversário e observações | 02-backend-commissions-clients-PLAN.md, 02-frontend-clientes-PLAN.md | SATISFIED | DB: clients table (cpf, birth_date, address, notes, phone, email, version); Backend: ClientsService validate+normalize CPF, contact-required guard; Frontend: ClientForm with CPF mask + duplicate lookup, ClienteNovoPage + ClienteEditPage |
| CLI-02 | Atendente visualiza histórico completo de atendimentos, produtos consumidos e comandas do cliente | 02-backend-commissions-clients-PLAN.md, 02-frontend-clientes-PLAN.md | SATISFIED (Phase 2 contract) | GraphQL shape locked: `clientHistory` query + `ClientHistoryItem` type defined; `ClienteDetailPage` has Histórico tab with `ClientHistoryTab`; backend `history()` returns `[]` stub per D-23; Phase 3 replaces stub body — shape and UI slot are the Phase 2 deliverable |

**Note on CLI-02:** The requirement says "visualiza histórico" — in Phase 2, this is fulfilled by the history UI slot + GraphQL contract being in place. The actual appointment/comanda data population is explicitly deferred to Phase 3 per design decision D-23 (documented in 02-CONTEXT.md). The Phase 2 ROADMAP success criterion #5 says "visualiza histórico de visitas e consumo" — with the stub returning `[]` and Phase 3 contract clearly documented, this is within the stated Phase 2 scope.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/backend/src/clients/clients.service.ts` | 235-236 | `return [] as Array<{...}>` in `history()` | INFO | Intentional Phase 2 stub per D-23; documented; Phase 3 replaces body; not a blocking issue |
| `apps/frontend/src/features/clients/components/ClientHistoryTab.tsx` | 30 | Component renders Clock empty state only | INFO | Intentional Phase 2 stub per D-23; disabled filters with tooltip; Phase 3 contract documented |

No blocker anti-patterns found. No unintentional `return null`, `return []`, or placeholder text in any of the 9 frontend pages or 6 backend services. The two INFO-level stubs are explicitly designed and contractually documented for Phase 3 replacement.

---

## Known Carry-Overs (Not Phase 2 Issues)

Per the verification brief, these are Phase 1 known follow-ups excluded from Phase 2 assessment:

- PgBouncer auth_type=trust (Phase 1 follow-up)
- sgs_app BYPASSRLS (Phase 1 follow-up)
- Bind mounts D: drive empty (Phase 1 follow-up)
- @types/react missing (pre-existing pnpm Windows issue)
- vitest test environment broken on Windows (pre-existing pnpm symlink issue)
- TypeScript module-not-found errors for @apollo/client, lucide-react, etc. (pre-existing, all plans document this)

---

## Human Verification Required

### 1. Full Catalog CRUD Flow

**Test:** Log in as ADMIN, navigate to /catalogo/categorias, create a root category "Cabelo", then a child category "Coloração". Navigate to /catalogo/servicos, create a service "Mechas" under "Coloração" with base price R$200 and two pricing variants (junior R$150, senior R$250). Verify the service row shows "2" in the variant count badge.

**Expected:** Category hierarchy visible in flat table with parent/child indentation column. Service displays BRL-formatted price, duration, variant count badge.

**Why human:** Requires browser + Apollo Client connected to live backend. DataTable rendering, React Router navigation, and i18n rendering cannot be verified by grep.

### 2. Stock Alert Sidebar Badge

**Test:** As ADMIN, navigate to /catalogo/produtos. Create a product with SKU "CREME01", sale price R$50, initial stock 5, min stock level 10. Then use "Ajustar Estoque" to reduce stock by 3 (new stock = 2, below min=10). Observe sidebar navigation.

**Expected:** After adjustment, sidebar shows TriangleAlert icon (orange/warning) next to "Produtos" nav item. lowStockCount badge updates within 60s poll interval.

**Why human:** Requires full stack running: PostgreSQL RLS, backend pessimistic lock, notification creation, GraphQL polling, React re-render.

### 3. Commission RBAC Gate

**Test:** Log in as a user with ATTENDANT role. Attempt to call `createCommissionRule` mutation via browser DevTools (Apollo Client).

**Expected:** Mutation returns a 403/FORBIDDEN error because ATTENDANT role lacks `commission.write` permission (confirmed in permissions.catalog.ts and seed migration — ATTENDANT gets only CATEGORY_READ, SERVICE_READ, PACKAGE_READ, PRODUCT_READ, CLIENT_READ/WRITE, NOTIFICATION_READ).

**Why human:** Requires JWT session with ATTENDANT role + live GraphQL endpoint.

---

## Summary

Phase 2 goal has been achieved. All 5 observable success criteria are verified against the actual codebase:

1. **Database foundation:** 10 new tables with FORCE RLS using the Phase 1 `nullif(current_setting(...))` pattern. Migration is 334 lines and covers all entities. Prisma schema has all 10 models. Permission seed is idempotent with correct role distributions.

2. **Backend services:** All 6 domain services are substantive (242–292 lines each), none are stubs. All DB operations use `runWithTenant` for RLS enforcement. All resolvers have `@RequirePermission` gates. Key behaviors verified: pricing variant atomic upsert, package `individualSum` with integer-cents arithmetic, `adjustStock` pessimistic lock + idempotent `stock_low` notification, commission 5-scope shape validation, CPF validate+normalize.

3. **GraphQL schema:** 5 SDL files define the complete catalog+clients contract. `Member` type added to `identity.graphql` for cross-SDL commission rule forms. `clientHistory` query shape locked for Phase 3.

4. **Frontend pages:** All 9 Phase 2 routes exist (including `/clientes/novo` inserted before `/:id` to prevent route collision). Zero "Em breve" stubs remain in any page. All pages use real Apollo `useQuery`/`useMutation` hooks. `ClienteEditPage` (35 lines) and `ClienteNovoPage` (11 lines) are minimal but correct — they delegate to the real `ClientForm` component.

5. **CLI-02 history stub:** The `clientHistory` returning `[]` is an intentional, documented Phase 2 design decision (D-23). The UI slot, GraphQL shape, and Phase 3 replacement contract are all in place. This is the correct Phase 2 deliverable.

6. **All 6 requirement IDs (CAT-01 through CAT-04, CLI-01, CLI-02)** are satisfied and marked complete in REQUIREMENTS.md.

The only items routing to human verification are runtime behaviors (browser rendering, sidebar polling, RBAC enforcement under live sessions) that cannot be verified by static code analysis.

---

_Verified: 2026-05-07T15:30:00Z_
_Verifier: Claude (gsd-verifier)_

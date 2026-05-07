---
phase: 02-core-domain
plan: "05"
subsystem: backend-commissions-clients
tags: [commissions, clients, members, graphql, crud, rbac, rls, cpf]
dependency_graph:
  requires:
    - 02-01 (database schema — commission_rules, clients tables + unique partial indexes)
    - 02-03 (catalog services — Service, Category types for cross-SDL references in commissions.graphql)
  provides:
    - CommissionsService.create/update/softDelete/list/byId
    - ClientsService.create/update/softDelete/restore/list/byId/byField/history
    - MembersService.listActive (for frontend commission picker)
    - Member GraphQL type in identity.graphql (cross-SDL ref anchor)
    - validateCpf + normalizeCpf utilities
  affects:
    - Phase 3 (FIN-02) — will consume CommissionsService for commission snapshot at comanda close
    - Phase 3 (POS) — will call ClientsService.history to populate appointment aggregation
    - Frontend Plan 07 — commission rule member picker consumes members query
tech_stack:
  added: []
  patterns:
    - P2002 unique violation → COMMISSION_SCOPE_CONFLICT user error (no throw)
    - validateScopeShape() defense-in-depth before DB insert (DB CHECK constraint also enforces)
    - normalizeCpf() before storage and comparison (digits-only in DB)
    - clientHistory returns [] stub pattern for Phase 3 slot reservation
    - Cross-SDL Member type: defined once in identity.graphql, consumed by commissions.graphql via NestJS typePaths glob
key_files:
  created:
    - apps/backend/src/graphql/schema/commissions.graphql
    - apps/backend/src/graphql/schema/clients.graphql
    - apps/backend/src/catalog/commissions/commissions.service.ts
    - apps/backend/src/catalog/commissions/commissions.resolver.ts
    - apps/backend/src/catalog/commissions/dto/commission.input.ts
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/identity/members.resolver.ts
    - apps/backend/src/clients/cpf.util.ts
    - apps/backend/src/clients/__tests__/cpf.util.spec.ts
    - apps/backend/src/clients/clients.service.ts
    - apps/backend/src/clients/clients.resolver.ts
    - apps/backend/src/clients/dto/client.input.ts
    - apps/backend/test/integration/commission-rules.e2e.spec.ts
    - apps/backend/test/integration/members.e2e.spec.ts
    - apps/backend/test/integration/clients.e2e.spec.ts
  modified:
    - apps/backend/src/graphql/schema/identity.graphql (Member type + members query added)
    - apps/backend/src/catalog/commissions/commissions.module.ts (CommissionsService/Resolver registered)
    - apps/backend/src/clients/clients.module.ts (ClientsService/Resolver registered)
    - apps/backend/src/identity/identity.module.ts (MembersService/Resolver registered, exports MembersService)
decisions:
  - "CPF stored as digits-only (normalizeCpf) — consistent lookup whether input is formatted or not"
  - "clientHistory returns [] Phase 2 stub — gated by CLIENT_READ so slot is accessible immediately"
  - "Member type owned by identity.graphql, referenced cross-SDL by commissions.graphql via NestJS typePaths glob"
  - "COMMISSION_SCOPE_CONFLICT returned as UserError (not throw) for ergonomic frontend handling"
  - "SeniorityTier enum kept in catalog.graphql (defined by Plan 03) — identity.graphql references it, no redeclaration"
  - "clientsByField alerts but does not block duplicate creation per D-22"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-07"
  tasks: 2
  files: 19
---

# Phase 2 Plan 05: Backend Commissions + Clients Summary

**One-liner:** CommissionRule CRUD with 5-scope/P2002 conflict detection, Client CRUD with Brazilian CPF validation + duplicate lookup, MembersService for frontend commission picker — all tenant-isolated via RLS.

## What Was Built

### Task 1: Commission Rules CRUD + Member type + members query

**CommissionsService** (`apps/backend/src/catalog/commissions/commissions.service.ts`, 276 lines):
- `create()`: validates scope shape (5 types), catches Prisma P2002 → COMMISSION_SCOPE_CONFLICT, catches P2003 → REFERENCE_NOT_FOUND, percentage range 0-100 check
- `update()`: kind/value only (scope is immutable — delete + recreate to change scope)
- `softDelete()`: sets deletedAt, freeing the unique partial index for scope reuse
- `list()` / `byId()`: includes resolved relations (member, service, category, product)
- `validateScopeShape()`: covers all 5 scope types (member_service, service, category, product, default)

**Scope shape contract** (enforced both in service and DB CHECK constraints from Plan 01):
| scopeType | memberId | serviceId | categoryId | productId |
|---|---|---|---|---|
| member_service | required | required | null | null |
| service | null | required | null | null |
| category | null | null | required | null |
| product | null | null | null | required |
| default | null | null | null | null |

**MembersService** (`apps/backend/src/identity/members.service.ts`, 44 lines):
- `listActive(orgId)`: returns active members (deletedAt IS NULL), selects id, displayName, email (from user relation), roleName, seniorityTier, createdAt — ordered alphabetically

**GraphQL SDL additions:**
- `identity.graphql`: `type Member { id, displayName, email, roleName, seniorityTier, createdAt }` + `extend type Query { members: [Member!]! }`
- `commissions.graphql`: Full CommissionRule CRUD SDL with CommissionScopeType (5 values) + CommissionKind (fixed/percentage) enums

**Integration tests** (9 commission-rules + 5 members):
- P2002 conflict detection for duplicate scope
- Soft-delete enables scope reuse (unique partial index excludes deleted)
- Scope shape validation for all cases
- Percentage value range enforcement (0-100)
- FK reference not found (P2003)
- RLS tenant isolation
- Members: soft-deleted exclusion, alphabetical order, RLS

### Task 2: Clients CRUD with CPF validation + history stub

**CPF utility** (`apps/backend/src/clients/cpf.util.ts`, 35 lines):
- `validateCpf(string | null | undefined): boolean` — full algorithm: digits-only extraction, length check, all-same-digit rejection, dual verifier digit checksum
- `normalizeCpf(string): string` — strips formatting, stores digits-only

**CPF algorithm:**
1. Strip non-digits → must be exactly 11 digits
2. Reject if all digits are the same (`/^(\d)\1{10}$/`)
3. First verifier: sum of digits[0..8] × weights[10..2], then `(sum * 10) % 11`, clamp 10 → 0
4. Second verifier: sum of digits[0..9] × weights[11..2], then `(sum * 10) % 11`, clamp 10 → 0
5. Both must match digits[9] and digits[10]

**ClientsService** (`apps/backend/src/clients/clients.service.ts`, 230+ lines):
- `create()`: requires fullName + at least one of (phone, email); optional CPF runs validateCpf; normalizes CPF before storage; lowercases email
- `update()`: preserves existing phone/email if not provided; re-validates CPF if changed; prevents removal of last contact method
- `softDelete()` / `restore()`: soft-delete pattern; restore checks deletedAt is not null
- `list()`: case-insensitive search on fullName/email; CPF search uses normalizeCpf; pagination (limit max 100)
- `byField()`: OR query on cpf/phone/email for duplicate alert lookup; supports excludeId for self-exclusion during updates
- `history()`: Phase 2 stub — verifies client exists in org, returns `[]`; Phase 3 replaces body with appointment + comanda aggregation

**Integration tests** (13 cases):
- Successful create with phone only
- CONTACT_REQUIRED when both phone and email missing
- CPF_INVALID for bogus CPF (`111.111.111-11`)
- Valid CPF stored normalized (`529.982.247-25` → `52998224725`)
- clientsByField lookup by CPF
- clientsByField with excludeId filtering
- Case-insensitive search
- softDelete removes from list
- restoreClient reappears in list
- clientHistory returns `[]` stub
- ATTENDANT has CLIENT_WRITE (permissions catalog check)
- PROFESSIONAL lacks CLIENT_WRITE (read-only per D-02)
- RLS: org B cannot see org A clients

## GraphQL Contract for Downstream Consumers

### Member type (for frontend commission picker — Plan 07)
```graphql
type Member {
  id: UUID!
  displayName: String!
  email: String!
  roleName: String!
  seniorityTier: SeniorityTier  # nullable; enum in catalog.graphql
  createdAt: DateTime!
}

extend type Query {
  members: [Member!]!  # gated by MEMBER_READ, returns all roles
}
```

### clientHistory stub interface (for Phase 3 to implement against)
```graphql
type ClientHistoryItem {
  id: UUID!
  occurredAt: DateTime!
  kind: String!         # "appointment" | "comanda" | "product"
  description: String!
  amount: String        # nullable — products/services
  professionalName: String  # nullable — walk-in without assignment
}

extend type Query {
  clientHistory(clientId: UUID!, filters: ClientHistoryFilters): [ClientHistoryItem!]!
}

input ClientHistoryFilters {
  fromDate: DateTime
  toDate: DateTime
  professionalId: UUID
  kind: ClientHistoryKind  # all | appointment | product | comanda
}
```
Phase 3 replaces the `history()` method body in `ClientsService` — the GraphQL shape above is locked for frontend consumption.

## Known Stubs

| Stub | File | Purpose |
|------|------|---------|
| `history()` returns `[]` | `clients.service.ts:history()` | Phase 2 placeholder; Phase 3 replaces with appointments + comandas aggregation |

This is intentional per D-23/D-24 — the Phase 2 goal is to expose the resolver slot and GraphQL shape. Phase 3 will populate real data.

## Deviations from Plan

None — plan executed exactly as written. The commission rules and members work (Task 1) was pre-implemented in the failing TDD RED commit (9e416af); this plan built the GREEN phase. The clients work (Task 2) was freshly implemented in this execution.

## Self-Check: PASSED

All 16 files found. Both commits verified (0b23b07, ce323a2).

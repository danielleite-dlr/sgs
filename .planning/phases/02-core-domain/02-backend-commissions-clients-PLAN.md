---
phase: 02-core-domain
plan: 05
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/backend/src/graphql/schema/commissions.graphql
  - apps/backend/src/graphql/schema/clients.graphql
  - apps/backend/src/catalog/commissions/commissions.service.ts
  - apps/backend/src/catalog/commissions/commissions.resolver.ts
  - apps/backend/src/catalog/commissions/dto/commission.input.ts
  - apps/backend/src/catalog/commissions/commissions.module.ts
  - apps/backend/src/clients/clients.service.ts
  - apps/backend/src/clients/clients.resolver.ts
  - apps/backend/src/clients/clients.module.ts
  - apps/backend/src/clients/dto/client.input.ts
  - apps/backend/src/clients/cpf.util.ts
  - apps/backend/test/integration/commission-rules.e2e.spec.ts
  - apps/backend/test/integration/clients.e2e.spec.ts
autonomous: true
requirements: [CAT-04, CLI-01, CLI-02]

must_haves:
  truths:
    - "ADMIN can create commission_rule for any of 5 scopes (member_service, service, category, product, default) with kind ∈ {fixed, percentage}"
    - "Conflicting rule for same scope returns COMMISSION_SCOPE_CONFLICT error (precedence enforced by unique partial indexes from Plan 01)"
    - "ATTENDANT can CRUD clients; PROFESSIONAL can read clients only"
    - "CPF validation rejects invalid checksum (e.g., '111.111.111-11' bogus, '123.456.789-09' valid)"
    - "clientsByField(cpf|phone|email) supports duplicate alert lookup before save"
    - "clientHistory query returns empty array in Phase 2 (Phase 3 fills it)"
    - "Client requires at least one of (phone, email)"
    - "All ops tenant-scoped via runWithTenant; RLS proven by integration test"
  artifacts:
    - path: "apps/backend/src/graphql/schema/commissions.graphql"
      provides: "SDL for CommissionRule + 5 scope types + create/update/delete + list-with-resolved-target"
      contains: "type CommissionRule"
    - path: "apps/backend/src/graphql/schema/clients.graphql"
      provides: "SDL for Client + history + duplicate lookup"
      contains: "type Client"
    - path: "apps/backend/src/catalog/commissions/commissions.service.ts"
      provides: "CRUD enforcing scope_shape contract from Plan 01 DB migration"
      min_lines: 100
    - path: "apps/backend/src/clients/clients.service.ts"
      provides: "Client CRUD + duplicate lookup + empty-history stub"
      min_lines: 120
    - path: "apps/backend/src/clients/cpf.util.ts"
      provides: "Pure function validateCpf(string) -> boolean using checksum digits algorithm"
      min_lines: 30
  key_links:
    - from: "commissions.service.ts"
      to: "DB unique partial indexes from Plan 01"
      via: "catch P2002 error code → COMMISSION_SCOPE_CONFLICT response"
      pattern: "P2002"
    - from: "clients.service.ts validate"
      to: "cpf.util.ts validateCpf"
      via: "import + call before persisting"
      pattern: "validateCpf"
    - from: "clients.resolver.ts clientHistory"
      to: "Phase 3 implementation slot"
      via: "currently returns []; phase 3 replaces with real aggregator"
      pattern: "history"
---

<objective>
Implement the remaining Phase 2 backend domains: commission_rules CRUD (config only, calculation is Phase 3) and clients (CRUD + duplicate-lookup + history stub). Both leverage `runWithTenant`, are gated by `@RequirePermission`, and ship with integration tests proving tenant isolation, business validation, and RBAC.

Purpose: CAT-04 ("regras de comissão por serviço/produto/profissional") and CLI-01/CLI-02 ("perfil + histórico"). Phase 3 will implement automatic commission calculation on comanda close (consuming the rules) and populate the client history aggregator. This plan delivers the CRUD + structural query slots they need.

Output: Two NestJS modules (commissions, clients) plus a CPF validation utility, two GraphQL SDL files, two integration test specs.
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
@.planning/phases/02-core-domain/02-database-schema-SUMMARY.md
@apps/backend/prisma/schema.prisma
@apps/backend/src/database/tenant-context.service.ts
@apps/backend/src/authz/permissions.catalog.ts
@apps/backend/src/auth/auth.service.ts

<interfaces>
<!-- Plan 01 outputs commission_rules + clients tables already exist -->

CommissionRule scope contract (Plan 01 DB CHECK constraint enforces shape):
- scope_type='member_service': memberId AND serviceId required, others NULL
- scope_type='service':         serviceId required, others NULL
- scope_type='category':        categoryId required, others NULL
- scope_type='product':         productId required, others NULL
- scope_type='default':         all foreign keys NULL

Plan 01 unique partial indexes (one rule per scope shape per org, excluding soft-deleted):
- uq_cr_org_default, uq_cr_org_member_service, uq_cr_org_service, uq_cr_org_category, uq_cr_org_product

Conflict detection: catch Prisma error `P2002` (unique constraint violation) and return COMMISSION_SCOPE_CONFLICT.

Client requires (D-20):
- Required: full_name, plus at least one of (phone, email) (CHECK constraint enforces)
- Optional: cpf, birth_date, address, notes

CPF validation algorithm (D-21): Brazilian CPF checksum
- Strip non-digits → must be 11 digits
- Reject all-same-digit ('11111111111')
- Compute first verifier digit using sum of first 9 digits × weights 10..2 mod 11
- Compute second verifier using first 10 digits × weights 11..2 mod 11
- Both verifiers must match positions 10 and 11
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Commission rules CRUD with scope precedence + conflict detection</name>
  <files>
    apps/backend/src/graphql/schema/commissions.graphql
    apps/backend/src/catalog/commissions/commissions.service.ts
    apps/backend/src/catalog/commissions/commissions.resolver.ts
    apps/backend/src/catalog/commissions/dto/commission.input.ts
    apps/backend/src/catalog/commissions/commissions.module.ts
    apps/backend/test/integration/commission-rules.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/prisma/schema.prisma (CommissionRule model)
    - apps/backend/prisma/migrations/20260506000000_phase2_catalog_clients/migration.sql (unique partial indexes for conflict detection)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-16, D-17, D-18, D-19)
    - apps/backend/src/auth/auth.service.ts (errorPayload pattern)
  </read_first>
  <behavior>
    - createCommissionRule({ scopeType, kind, value, memberId?, serviceId?, categoryId?, productId? }) validates the scope shape (matches D-17 contract) before insert
    - Catches P2002 unique violation → returns COMMISSION_SCOPE_CONFLICT error (existing rule for that exact scope combination)
    - updateCommissionRule changes kind/value (NOT scope — to change scope, delete + recreate)
    - listCommissionRules returns rules with resolved targets (member.displayName, service.name, etc.) for UI display
    - softDeleteCommissionRule sets deleted_at — once deleted, the unique partial index allows a new rule for the same scope
    - Validate `kind ∈ {fixed, percentage}` and `value >= 0`. For `kind=percentage`, `value <= 100` (UI displays as %; 0–100 expected).
  </behavior>
  <action>
**A. Create `apps/backend/src/graphql/schema/commissions.graphql`:**

```graphql
# ===== Commission Rules =====

extend type Query {
  commissionRules: [CommissionRule!]!
  commissionRule(id: UUID!): CommissionRule
}

extend type Mutation {
  createCommissionRule(input: CreateCommissionRuleInput!): CommissionRulePayload!
  updateCommissionRule(input: UpdateCommissionRuleInput!): CommissionRulePayload!
  softDeleteCommissionRule(input: SoftDeleteInput!): CommissionRulePayload!
}

type CommissionRule {
  id: UUID!
  scopeType: CommissionScopeType!
  kind: CommissionKind!
  value: String!
  member: Member
  service: Service
  category: Category
  product: Product
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum CommissionScopeType { member_service service category product default }
enum CommissionKind { fixed percentage }

input CreateCommissionRuleInput {
  scopeType: CommissionScopeType!
  kind: CommissionKind!
  value: String!
  memberId: UUID
  serviceId: UUID
  categoryId: UUID
  productId: UUID
}

input UpdateCommissionRuleInput {
  id: UUID!
  kind: CommissionKind
  value: String
}

type CommissionRulePayload {
  rule: CommissionRule
  errors: [UserError!]!
}
```

NOTE: `Member` and `Service`, `Category`, `Product` types are referenced — they are defined by Plans 03/04. As long as resolvers don't return null payloads for those branches, GraphQL resolves the references at field time. Backend boot order via NestJS module imports handles this.

**B. Create `dto/commission.input.ts`:**

```ts
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

const DECIMAL = /^\d+(\.\d{1,4})?$/;

export class CreateCommissionRuleInput {
  @IsEnum(['member_service', 'service', 'category', 'product', 'default'])
  scopeType!: 'member_service' | 'service' | 'category' | 'product' | 'default';

  @IsEnum(['fixed', 'percentage']) kind!: 'fixed' | 'percentage';
  @Matches(DECIMAL, { message: 'Valor inválido.' }) value!: string;

  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() productId?: string;
}

export class UpdateCommissionRuleInput {
  @IsUUID() id!: string;
  @IsOptional() @IsEnum(['fixed', 'percentage']) kind?: 'fixed' | 'percentage';
  @IsOptional() @Matches(DECIMAL) value?: string;
}
```

**C. Create `commissions.service.ts`:**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../database/tenant-context.service';
import { CreateCommissionRuleInput, UpdateCommissionRuleInput } from './dto/commission.input';

interface UserError { code: string; message: string; field?: string | null; }
const err = (code: string, message: string, field?: string) => ({
  rule: null, errors: [{ code, message, field: field ?? null }],
});

@Injectable()
export class CommissionsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.commissionRule.findMany({
        where: { deletedAt: null },
        include: { member: true, service: true, category: true, product: true },
        orderBy: [{ scopeType: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async byId(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.commissionRule.findFirst({
        where: { id, deletedAt: null },
        include: { member: true, service: true, category: true, product: true },
      }),
    );
  }

  async create(orgId: string, input: CreateCommissionRuleInput) {
    // Validate scope shape (defense-in-depth: DB CHECK enforces too)
    const shape = this.validateScopeShape(input);
    if (shape) return err(shape.code, shape.message, shape.field);
    if (input.kind === 'percentage' && Number(input.value) > 100) {
      return err('VALUE_OUT_OF_RANGE', 'Percentual deve ser entre 0 e 100.', 'value');
    }

    return this.tenant.runWithTenant(orgId, async (tx) => {
      try {
        const rule = await tx.commissionRule.create({
          data: {
            organizationId: orgId,
            scopeType: input.scopeType,
            kind: input.kind,
            value: input.value,
            memberId: input.memberId ?? null,
            serviceId: input.serviceId ?? null,
            categoryId: input.categoryId ?? null,
            productId: input.productId ?? null,
          },
          include: { member: true, service: true, category: true, product: true },
        });
        return { rule, errors: [] as UserError[] };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return err('COMMISSION_SCOPE_CONFLICT', 'Já existe uma regra para este escopo. Edite a regra existente.');
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          return err('REFERENCE_NOT_FOUND', 'Referência inválida (profissional, serviço, categoria ou produto).');
        }
        throw e;
      }
    });
  }

  async update(orgId: string, input: UpdateCommissionRuleInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.commissionRule.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!existing) return err('NOT_FOUND', 'Regra não encontrada.');
      if (input.kind === 'percentage' && input.value && Number(input.value) > 100) {
        return err('VALUE_OUT_OF_RANGE', 'Percentual deve ser entre 0 e 100.', 'value');
      }
      const rule = await tx.commissionRule.update({
        where: { id: input.id },
        data: {
          kind: input.kind ?? existing.kind,
          value: input.value ?? existing.value,
        },
        include: { member: true, service: true, category: true, product: true },
      });
      return { rule, errors: [] as UserError[] };
    });
  }

  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const cur = await tx.commissionRule.findFirst({ where: { id, deletedAt: null } });
      if (!cur) return err('NOT_FOUND', 'Regra não encontrada.');
      const rule = await tx.commissionRule.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: { member: true, service: true, category: true, product: true },
      });
      return { rule, errors: [] as UserError[] };
    });
  }

  private validateScopeShape(i: CreateCommissionRuleInput) {
    const has = {
      member: !!i.memberId,
      service: !!i.serviceId,
      category: !!i.categoryId,
      product: !!i.productId,
    };
    switch (i.scopeType) {
      case 'member_service':
        if (!has.member || !has.service || has.category || has.product)
          return { code: 'SCOPE_INVALID', message: 'Profissional+Serviço requer profissional e serviço, sem categoria/produto.', field: 'scopeType' };
        return null;
      case 'service':
        if (!has.service || has.member || has.category || has.product)
          return { code: 'SCOPE_INVALID', message: 'Escopo "Serviço" requer apenas serviço.', field: 'scopeType' };
        return null;
      case 'category':
        if (!has.category || has.member || has.service || has.product)
          return { code: 'SCOPE_INVALID', message: 'Escopo "Categoria" requer apenas categoria.', field: 'scopeType' };
        return null;
      case 'product':
        if (!has.product || has.member || has.service || has.category)
          return { code: 'SCOPE_INVALID', message: 'Escopo "Produto" requer apenas produto.', field: 'scopeType' };
        return null;
      case 'default':
        if (has.member || has.service || has.category || has.product)
          return { code: 'SCOPE_INVALID', message: 'Escopo "Padrão" não aceita referências.', field: 'scopeType' };
        return null;
    }
  }
}
```

**D. Create `commissions.resolver.ts`** with `COMMISSION_READ`/`COMMISSION_WRITE` gating. Same structure as previous resolvers.

**E. Update `commissions.module.ts`** to register providers.

**F. Create integration test `commission-rules.e2e.spec.ts`:**
1. ADMIN creates default org rule (scopeType='default', kind='percentage', value='10') — succeeds
2. ADMIN creates second default rule → COMMISSION_SCOPE_CONFLICT
3. After softDelete of first default rule, creating a new one → succeeds
4. Create member_service rule with only memberId (no serviceId) → SCOPE_INVALID
5. Create rule with kind='percentage' value='150' → VALUE_OUT_OF_RANGE
6. Create rule referencing non-existent serviceId → REFERENCE_NOT_FOUND
7. MANAGER can READ but not WRITE (per Plan 01 D-02 — MANAGER lacks COMMISSION_WRITE)
8. RLS: org B cannot read org A's rules
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test:int -- --testPathPattern commission-rules</automated>
  </verify>
  <acceptance_criteria>
    - `commissions.graphql` defines 5-value `enum CommissionScopeType` and 2-value `enum CommissionKind`
    - `commissions.service.ts` &gt;= 100 lines, contains `Prisma.PrismaClientKnownRequestError` with `e.code === 'P2002'` branch
    - `validateScopeShape` covers all 5 scope types
    - 8 integration tests pass
    - Test 7 confirms MANAGER role gets FORBIDDEN on createCommissionRule
    - Test 3 confirms unique partial index excludes soft-deleted (re-create works after delete)
  </acceptance_criteria>
  <done>
    - Commission rules CRUD operational with strict shape validation, conflict detection, range checks
    - DB unique partial indexes leveraged for conflict detection
    - Soft delete enables scope reuse
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Clients CRUD with CPF validation, duplicate lookup, history stub</name>
  <files>
    apps/backend/src/graphql/schema/clients.graphql
    apps/backend/src/clients/cpf.util.ts
    apps/backend/src/clients/clients.service.ts
    apps/backend/src/clients/clients.resolver.ts
    apps/backend/src/clients/clients.module.ts
    apps/backend/src/clients/dto/client.input.ts
    apps/backend/test/integration/clients.e2e.spec.ts
  </files>
  <read_first>
    - apps/backend/prisma/schema.prisma (Client model)
    - .planning/phases/02-core-domain/02-CONTEXT.md (D-20, D-21, D-22, D-23, D-24)
    - apps/backend/src/auth/auth.service.ts (validation pattern)
    - apps/backend/src/authz/permissions.catalog.ts (CLIENT_READ, CLIENT_WRITE per Plan 01)
  </read_first>
  <behavior>
    - createClient({ fullName, phone?, email?, cpf?, birthDate?, address?, notes? }) requires fullName + (phone or email)
    - CPF when provided must pass checksum (cpf.util)
    - Duplicate CPF check is NOT bound at create — `clientsByField` query allows UI to fetch matches and show alert; user can still proceed (D-22)
    - clientHistory(id, filters?) returns empty array in Phase 2 — Phase 3 implementation will replace
    - softDeleteClient sets deleted_at; queries default to deletedAt IS NULL
    - clientsByField({ cpf?: string, phone?: string, email?: string }, excludeId?) returns matches in current org for duplicate alert
  </behavior>
  <action>
**A. Create `apps/backend/src/clients/cpf.util.ts`:**

```ts
/**
 * Validates a Brazilian CPF using the official checksum algorithm.
 * Accepts formatted "123.456.789-09" or unformatted "12345678909" input.
 * Returns false for empty input, wrong length, all-same-digit (e.g., "11111111111"),
 * or mismatched verifier digits.
 */
export function validateCpf(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // all same digit

  const calcVerifier = (slice: string, weightStart: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (weightStart - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const v1 = calcVerifier(digits.slice(0, 9), 10);
  if (v1 !== Number(digits[9])) return false;
  const v2 = calcVerifier(digits.slice(0, 10), 11);
  if (v2 !== Number(digits[10])) return false;
  return true;
}

/** Normalizes CPF to digits-only form for storage and comparison. */
export function normalizeCpf(input: string): string {
  return input.replace(/\D/g, '');
}
```

Add a unit test `apps/backend/src/clients/__tests__/cpf.util.spec.ts`:
```ts
import { describe, it, expect } from '@jest/globals';
import { validateCpf, normalizeCpf } from '../cpf.util';

describe('validateCpf', () => {
  it.each([
    ['111.111.111-11', false],   // all same digit
    ['12345678900', false],      // bad checksum
    ['', false],
    ['abc', false],
    ['000.000.000-00', false],
    ['529.982.247-25', true],    // valid known CPF
    ['52998224725', true],       // unformatted same number
  ])('validates %s as %s', (cpf, expected) => {
    expect(validateCpf(cpf)).toBe(expected);
  });
});
describe('normalizeCpf', () => {
  it('strips formatting', () => {
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
  });
});
```

**B. Create `apps/backend/src/graphql/schema/clients.graphql`:**

```graphql
# ===== Clients =====

extend type Query {
  clients(search: String, limit: Int = 20, offset: Int = 0): ClientConnection!
  client(id: UUID!): Client
  clientsByField(cpf: String, phone: String, email: String, excludeId: UUID): [Client!]!
  clientHistory(clientId: UUID!, filters: ClientHistoryFilters): [ClientHistoryItem!]!
}

extend type Mutation {
  createClient(input: CreateClientInput!): ClientPayload!
  updateClient(input: UpdateClientInput!): ClientPayload!
  softDeleteClient(input: SoftDeleteInput!): ClientPayload!
  restoreClient(input: SoftDeleteInput!): ClientPayload!
}

type Client {
  id: UUID!
  fullName: String!
  phone: String
  email: String
  cpf: String
  birthDate: DateTime
  address: String
  notes: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ClientConnection {
  rows: [Client!]!
  totalCount: Int!
}

input ClientHistoryFilters {
  fromDate: DateTime
  toDate: DateTime
  professionalId: UUID
  kind: ClientHistoryKind
}

enum ClientHistoryKind { all appointment product comanda }

# Phase 2 stub — Phase 3 fills in real fields when comandas/appointments land
type ClientHistoryItem {
  id: UUID!
  occurredAt: DateTime!
  kind: String!
  description: String!
  amount: String
  professionalName: String
}

input CreateClientInput {
  fullName: String!
  phone: String
  email: String
  cpf: String
  birthDate: DateTime
  address: String
  notes: String
}

input UpdateClientInput {
  id: UUID!
  fullName: String
  phone: String
  email: String
  cpf: String
  birthDate: DateTime
  address: String
  notes: String
}

type ClientPayload {
  client: Client
  errors: [UserError!]!
}
```

**C. Create `dto/client.input.ts`:**

```ts
import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const PHONE = /^[\d\s()+\-]{8,30}$/;

export class CreateClientInput {
  @IsString() @MinLength(2) @MaxLength(255) fullName!: string;
  @IsOptional() @Matches(PHONE, { message: 'Telefone inválido.' }) phone?: string;
  @IsOptional() @IsEmail({}, { message: 'E-mail inválido.' }) email?: string;
  @IsOptional() @IsString() @MaxLength(14) cpf?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateClientInput extends CreateClientInput {
  @IsUUID() id!: string;
  // Override fullName to optional
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) fullName?: string;
}
```

**D. Create `clients.service.ts`:**

```ts
import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';
import { validateCpf, normalizeCpf } from './cpf.util';
import { CreateClientInput, UpdateClientInput } from './dto/client.input';

interface UserError { code: string; message: string; field?: string | null; }
const err = (code: string, message: string, field?: string) => ({
  client: null, errors: [{ code, message, field: field ?? null }],
});

@Injectable()
export class ClientsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string, opts: { search?: string; limit?: number; offset?: number } = {}) {
    const limit = Math.min(opts.limit ?? 20, 100);
    const offset = opts.offset ?? 0;
    const search = opts.search?.trim();
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const where = {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' as const } },
                { cpf: { contains: normalizeCpf(search) } },
              ],
            }
          : {}),
      };
      const [rows, totalCount] = await Promise.all([
        tx.client.findMany({ where, orderBy: { fullName: 'asc' }, take: limit, skip: offset }),
        tx.client.count({ where }),
      ]);
      return { rows, totalCount };
    });
  }

  async byId(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.client.findFirst({ where: { id, deletedAt: null } }),
    );
  }

  async byField(
    orgId: string,
    f: { cpf?: string; phone?: string; email?: string; excludeId?: string },
  ) {
    return this.tenant.runWithTenant(orgId, (tx) => {
      const conditions: any[] = [];
      if (f.cpf) conditions.push({ cpf: normalizeCpf(f.cpf) });
      if (f.phone) conditions.push({ phone: f.phone });
      if (f.email) conditions.push({ email: f.email.toLowerCase() });
      if (conditions.length === 0) return [];
      return tx.client.findMany({
        where: {
          deletedAt: null,
          OR: conditions,
          ...(f.excludeId ? { NOT: { id: f.excludeId } } : {}),
        },
        take: 10,
      });
    });
  }

  async create(orgId: string, input: CreateClientInput) {
    if (!input.phone && !input.email) {
      return err('CONTACT_REQUIRED', 'Informe pelo menos um telefone ou e-mail.');
    }
    if (input.cpf && !validateCpf(input.cpf)) {
      return err('CPF_INVALID', 'CPF inválido. Verifique os números.', 'cpf');
    }
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: orgId,
          fullName: input.fullName,
          phone: input.phone ?? null,
          email: input.email?.toLowerCase() ?? null,
          cpf: input.cpf ? normalizeCpf(input.cpf) : null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        },
      });
      return { client, errors: [] as UserError[] };
    });
  }

  async update(orgId: string, input: UpdateClientInput) {
    if (input.cpf && !validateCpf(input.cpf)) {
      return err('CPF_INVALID', 'CPF inválido.', 'cpf');
    }
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.client.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!existing) return err('NOT_FOUND', 'Cliente não encontrado.');

      const phone = input.phone ?? existing.phone;
      const email = input.email ? input.email.toLowerCase() : existing.email;
      if (!phone && !email) return err('CONTACT_REQUIRED', 'Informe pelo menos um telefone ou e-mail.');

      const client = await tx.client.update({
        where: { id: input.id },
        data: {
          fullName: input.fullName ?? existing.fullName,
          phone,
          email,
          cpf: input.cpf !== undefined ? (input.cpf ? normalizeCpf(input.cpf) : null) : existing.cpf,
          birthDate: input.birthDate ? new Date(input.birthDate) : existing.birthDate,
          address: input.address ?? existing.address,
          notes: input.notes ?? existing.notes,
          version: { increment: 1 },
        },
      });
      return { client, errors: [] as UserError[] };
    });
  }

  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.client.findFirst({ where: { id, deletedAt: null } });
      if (!existing) return err('NOT_FOUND', 'Cliente não encontrado.');
      const client = await tx.client.update({ where: { id }, data: { deletedAt: new Date() } });
      return { client, errors: [] as UserError[] };
    });
  }

  async restore(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.client.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!existing) return err('NOT_FOUND', 'Cliente não encontrado ou já ativo.');
      const client = await tx.client.update({ where: { id }, data: { deletedAt: null } });
      return { client, errors: [] as UserError[] };
    });
  }

  async history(orgId: string, clientId: string, _filters?: any) {
    // Phase 2 stub per D-23/D-24. Phase 3 will aggregate appointments + commandas.
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const c = await tx.client.findFirst({ where: { id: clientId, deletedAt: null } });
      if (!c) return [];
      return [] as Array<{
        id: string; occurredAt: Date; kind: string; description: string;
        amount: string | null; professionalName: string | null;
      }>;
    });
  }
}
```

**E. Create `clients.resolver.ts`** with permissions: queries → `CLIENT_READ`, mutations → `CLIENT_WRITE` (except `restoreClient` also `CLIENT_WRITE`).

**F. Update `clients.module.ts`:**

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthzModule } from '../authz/authz.module';
import { ClientsService } from './clients.service';
import { ClientsResolver } from './clients.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ClientsService, ClientsResolver],
  exports: [ClientsService],
})
export class ClientsModule {}
```

**G. Create integration test `clients.e2e.spec.ts`:**
1. createClient({ fullName: 'Ana', phone: '(11) 99999-0000' }) → success
2. createClient({ fullName: 'Beto' }) (no phone, no email) → CONTACT_REQUIRED
3. createClient with cpf='111.111.111-11' → CPF_INVALID
4. createClient with cpf='529.982.247-25' → success, stored as normalized '52998224725'
5. clientsByField({ cpf: '52998224725' }) → returns the created client
6. clientsByField({ cpf: '52998224725', excludeId: <thatClientId> }) → returns []
7. listClients({ search: 'Ana' }) → finds row even when name has accent 'Áná' (case-insensitive)
8. softDeleteClient → next listClients does NOT include
9. restoreClient → row reappears
10. clientHistory(id) → returns [] (Phase 2 stub)
11. ATTENDANT can createClient (CLIENT_WRITE granted)
12. PROFESSIONAL cannot createClient (no CLIENT_WRITE in Phase 2 per D-02)
13. RLS: org B cannot read org A's clients via list/byId/byField/history
  </action>
  <verify>
    <automated>cd apps/backend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/clients/__tests__/cpf.util.spec.ts &amp;&amp; pnpm test:int -- --testPathPattern clients</automated>
  </verify>
  <acceptance_criteria>
    - `cpf.util.ts` exports `validateCpf`, `normalizeCpf`; unit test passes 7 cases
    - `clients.graphql` defines ClientConnection (rows + totalCount), ClientHistoryItem stub, ClientHistoryFilters
    - `clients.service.ts` &gt;= 120 lines, all DB ops in `runWithTenant`
    - CPF normalization happens before storage and lookup (verify by grep `normalizeCpf` in service)
    - 13 integration tests pass
    - History test returns empty array (Phase 2 stub) but resolver is gated by CLIENT_READ
  </acceptance_criteria>
  <done>
    - Client CRUD operational with optional CPF + duplicate-lookup query
    - CPF validation deterministic and tested
    - History query slot ready for Phase 3 implementation
  </done>
</task>

</tasks>

<verification>
- `commissions.graphql` and `clients.graphql` parse on backend boot
- Both modules registered, exporting their services for Phase 3 to import
- All resolvers gated by appropriate permissions
- All DB ops wrapped in `runWithTenant`
- 21 integration tests across both specs pass
- CPF unit tests pass independently of DB
</verification>

<success_criteria>
- `pnpm --filter @sgs/backend typecheck` exits 0
- All integration tests in this plan pass
- Backend boot smoke (Nest test harness) succeeds with new modules registered
- GraphQL playground introspection at /graphql shows: createCommissionRule, clients, clientsByField, clientHistory mutations/queries
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-backend-commissions-clients-SUMMARY.md` documenting commission rule scope contract, CPF validation algorithm, client history stub interface (so Phase 3 has the exact GraphQL shape to implement against).
</output>

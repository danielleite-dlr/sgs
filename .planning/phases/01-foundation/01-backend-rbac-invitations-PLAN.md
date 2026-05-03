---
phase: 01-foundation
plan: 05
type: execute
wave: 4
depends_on: [04]
files_modified:
  - apps/backend/src/authz/authz.module.ts
  - apps/backend/src/authz/permissions.catalog.ts
  - apps/backend/src/authz/role-permissions.seed.ts
  - apps/backend/src/authz/decorators/require-permission.decorator.ts
  - apps/backend/src/authz/decorators/require-role.decorator.ts
  - apps/backend/src/authz/guards/permission.guard.ts
  - apps/backend/src/authz/tenant-context.middleware.ts
  - apps/backend/src/authz/decorators/current-tenant.decorator.ts
  - apps/backend/src/identity/identity.module.ts
  - apps/backend/src/identity/invitation.service.ts
  - apps/backend/src/identity/invitation.resolver.ts
  - apps/backend/src/identity/dto/invite-member.input.ts
  - apps/backend/src/identity/dto/accept-invitation.input.ts
  - apps/backend/src/graphql/schema/identity.graphql
  - apps/backend/src/auth/auth.module.ts
  - apps/backend/src/app.module.ts
  - apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql
  - apps/backend/test/integration/rbac.e2e-spec.ts
  - apps/backend/test/integration/invitation.e2e-spec.ts
autonomous: true
requirements: [AUTH-03]

must_haves:
  truths:
    - "4 system roles (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL) have their permission sets seeded in role_permissions table"
    - "Mutation `inviteMember(email, roleName)` creates a member_invitations row, sends an invitation email via Resend, requires permission `member.invite`"
    - "Mutation `acceptInvitation(token, fullName, password)` creates User (if needed) + Member; consumes the invitation token"
    - "@RequirePermission('xxx.yyy') decorator on resolvers blocks requests where the JWT memberships do not include that permission for the active organization"
    - "Phase 1 Success Criterion #3 holds: a PROFESSIONAL role member receives error when accessing a resolver decorated @RequirePermission('member.invite')"
    - "TenantContextMiddleware extracts organization_id from JWT/header/subdomain and attaches to GraphQL context for downstream resolvers"
  artifacts:
    - path: "apps/backend/src/authz/permissions.catalog.ts"
      provides: "Canonical list of permission strings (e.g. 'member.invite', 'organization.read')"
      exports: ["PERMISSIONS", "ROLE_PERMISSIONS"]
    - path: "apps/backend/src/authz/decorators/require-permission.decorator.ts"
      provides: "@RequirePermission(...permissions) decorator"
      exports: ["RequirePermission", "REQUIRED_PERMISSIONS_KEY"]
    - path: "apps/backend/src/authz/guards/permission.guard.ts"
      provides: "Guard reading required permissions from metadata, comparing against current user's effective permissions for the active org"
      exports: ["PermissionGuard"]
    - path: "apps/backend/src/identity/invitation.service.ts"
      provides: "Invite + accept invitation flows"
      exports: ["InvitationService"]
    - path: "apps/backend/src/graphql/schema/identity.graphql"
      provides: "GraphQL SDL for inviteMember + acceptInvitation"
      contains: "inviteMember"
    - path: "apps/backend/test/integration/rbac.e2e-spec.ts"
      provides: "Test asserting PROFESSIONAL cannot inviteMember; ADMIN can"
      contains: "PROFESSIONAL"
    - path: "apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql"
      provides: "Seed migration assigning permission strings to each system role"
      contains: "INSERT INTO role_permissions"
  key_links:
    - from: "PermissionGuard"
      to: "JwtAccessPayload.memberships"
      via: "JWT payload + active organization extracted by TenantContextMiddleware"
      pattern: "memberships"
    - from: "InvitationService.invite"
      to: "EmailService.sendInvitation"
      via: "Resend HTTP API"
      pattern: "sendInvitation"
    - from: "InvitationService.accept"
      to: "TokenService.issueAccessToken + issueRefreshToken"
      via: "AuthService.issueSession (refactored to be reusable)"
      pattern: "issueRefreshToken"
---

<objective>
Implement the RBAC technical layer (AUTH-03, D-13/D-14) and member invitation flow (D-15). 4 system roles get permission catalogs assigned. A `@RequirePermission(...)` decorator + guard combination blocks unauthorized resolver calls. The owner of an organization can invite a new member by email; the invitee accepts via a tokenized link, sets a password, and gets a working session.

Per CONTEXT.md: this phase delivers ONLY the technical authorization layer — there is no UI to edit roles/permissions (that's deferred to a later phase).

Output: Phase 1 Success Criterion #3 satisfied — a PROFESSIONAL role member receives a clear permission-denied error when attempting an admin-only mutation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-04-SUMMARY.md
@PRD_Backend_Plataforma_Saloes.md
@apps/backend/prisma/schema.prisma
@apps/backend/src/auth/auth.service.ts
@apps/backend/src/auth/types.ts
@apps/backend/src/email/email.service.ts

<interfaces>
<!-- From plan 02: -->
- Role and RolePermission Prisma models
- 4 system roles seeded (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL) with organization_id IS NULL
- MemberInvitation model with token_hash, expires_at, accepted_at, revoked_at, organizationId, email, roleId

<!-- From plan 04: -->
- AuthService with: signup, login, verifyEmail, refresh, logout, getSession, issueSession (private), loadMemberships (private)
  → Refactor needed: extract `issueSession` to public so InvitationService can call it after accept.
- TokenService.issueAccessToken / issueRefreshToken
- PasswordService.hash / verify
- EmailService.sendInvitation(to, salonName, inviterName, token)
- JwtAuthGuard (global APP_GUARD) — already protects all resolvers; @Public() opts out
- JwtAccessPayload includes memberships[] with {memberId, organizationId, roleName}
- @CurrentUser decorator yields JwtAccessPayload

<!-- Locked decisions from CONTEXT.md driving this plan: -->
- D-13: Phase 1 ships authorization technical layer only — no UI for role mgmt
- D-14: 4 roles ADMIN, MANAGER, ATTENDANT, PROFESSIONAL — permissions defined in code, not user-configurable in Phase 1
- D-15: Member invitation IS in Phase 1 — proprietário can invite to test the system

<!-- Permission scheme from PRD §5.3 (recurso.acao): -->
Phase 1 baseline catalog (more added in later phases):
- organization.read, organization.update
- member.read, member.invite, member.remove, member.editRole
- role.read
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define permissions catalog, seed role_permissions, build RequirePermission guard + tenant context middleware</name>
  <files>apps/backend/src/authz/authz.module.ts, apps/backend/src/authz/permissions.catalog.ts, apps/backend/src/authz/decorators/require-permission.decorator.ts, apps/backend/src/authz/decorators/require-role.decorator.ts, apps/backend/src/authz/decorators/current-tenant.decorator.ts, apps/backend/src/authz/guards/permission.guard.ts, apps/backend/src/authz/tenant-context.middleware.ts, apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql, apps/backend/src/app.module.ts</files>
  <read_first>
    - apps/backend/prisma/schema.prisma (Role, RolePermission, Member)
    - apps/backend/src/auth/types.ts (JwtAccessPayload structure)
    - apps/backend/src/auth/jwt.strategy.ts (where memberships claim is set)
    - PRD_Backend_Plataforma_Saloes.md §5.3 (RBAC pattern + permission naming)
    - apps/backend/src/auth/decorators/current-user.decorator.ts (existing decorator pattern to follow)
  </read_first>
  <behavior>
    PermissionGuard:
    - Test: Resolver with @RequirePermission('member.invite') called by JWT containing membership with role ADMIN → allowed (PermissionsGuard returns true)
    - Test: Resolver called by JWT containing only PROFESSIONAL role → denied with FORBIDDEN error code
    - Test: Resolver called with no JWT → denied (JwtAuthGuard catches first)
    - Test: User with multiple memberships, the active organization (from header X-Organization-Id) determines which role is checked

    TenantContextMiddleware:
    - Test: Extracts organizationId from header `X-Organization-Id` and validates it appears in JWT.memberships[].organizationId
    - Test: Mismatch (header org not in JWT) → 403 with TENANT_MISMATCH error
    - Test: Missing header → uses first membership as default (Phase 1 single-org user is the common case per signup flow)
  </behavior>
  <action>
    **Create `apps/backend/src/authz/permissions.catalog.ts`** — single source of truth for permission strings:
    ```typescript
    /**
     * Phase 1 permission catalog.
     * Pattern: <resource>.<action>
     * Add new permissions in the resource's bounded-context module in later phases.
     */
    export const PERMISSIONS = {
      ORGANIZATION_READ: 'organization.read',
      ORGANIZATION_UPDATE: 'organization.update',

      MEMBER_READ: 'member.read',
      MEMBER_INVITE: 'member.invite',
      MEMBER_REMOVE: 'member.remove',
      MEMBER_EDIT_ROLE: 'member.editRole',

      ROLE_READ: 'role.read',
    } as const;

    export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

    /**
     * Default permission set per system role.
     * ADMIN gets everything, others get progressively narrower scopes.
     * Materialized into role_permissions table by the seed migration.
     */
    export const ROLE_PERMISSIONS: Record<'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL', Permission[]> = {
      ADMIN: [
        PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.ORGANIZATION_UPDATE,
        PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_INVITE, PERMISSIONS.MEMBER_REMOVE, PERMISSIONS.MEMBER_EDIT_ROLE,
        PERMISSIONS.ROLE_READ,
      ],
      MANAGER: [
        PERMISSIONS.ORGANIZATION_READ,
        PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_INVITE,
        PERMISSIONS.ROLE_READ,
      ],
      ATTENDANT: [
        PERMISSIONS.ORGANIZATION_READ,
        PERMISSIONS.MEMBER_READ,
      ],
      PROFESSIONAL: [
        PERMISSIONS.ORGANIZATION_READ,
        PERMISSIONS.MEMBER_READ,
      ],
    };
    ```

    **Create the seed migration `apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql`** — idempotent inserts using ON CONFLICT DO NOTHING:
    ```sql
    -- Seed Phase 1 permissions for the 4 system roles created in init migration.
    -- Resource pattern: <resource>.<action>. See apps/backend/src/authz/permissions.catalog.ts.

    DO $$
    DECLARE
      v_admin uuid;
      v_manager uuid;
      v_attendant uuid;
      v_professional uuid;
    BEGIN
      SELECT id INTO v_admin FROM roles WHERE name='ADMIN' AND is_system=true LIMIT 1;
      SELECT id INTO v_manager FROM roles WHERE name='MANAGER' AND is_system=true LIMIT 1;
      SELECT id INTO v_attendant FROM roles WHERE name='ATTENDANT' AND is_system=true LIMIT 1;
      SELECT id INTO v_professional FROM roles WHERE name='PROFESSIONAL' AND is_system=true LIMIT 1;

      -- ADMIN: full access for Phase 1
      INSERT INTO role_permissions (role_id, permission) VALUES
        (v_admin, 'organization.read'),
        (v_admin, 'organization.update'),
        (v_admin, 'member.read'),
        (v_admin, 'member.invite'),
        (v_admin, 'member.remove'),
        (v_admin, 'member.editRole'),
        (v_admin, 'role.read')
      ON CONFLICT DO NOTHING;

      -- MANAGER
      INSERT INTO role_permissions (role_id, permission) VALUES
        (v_manager, 'organization.read'),
        (v_manager, 'member.read'),
        (v_manager, 'member.invite'),
        (v_manager, 'role.read')
      ON CONFLICT DO NOTHING;

      -- ATTENDANT
      INSERT INTO role_permissions (role_id, permission) VALUES
        (v_attendant, 'organization.read'),
        (v_attendant, 'member.read')
      ON CONFLICT DO NOTHING;

      -- PROFESSIONAL
      INSERT INTO role_permissions (role_id, permission) VALUES
        (v_professional, 'organization.read'),
        (v_professional, 'member.read')
      ON CONFLICT DO NOTHING;
    END $$;

    -- ===== Relaxed SELECT policy on member_invitations (Task 2 InvitationService.accept depends on this) =====
    -- The token_hash IS the secret; only the invitee knows the plaintext (sha256 lookup).
    -- INSERT/UPDATE/DELETE remain tenant-scoped via WITH CHECK.
    -- This MUST be in the same migration so prisma migrate deploy applies it before any acceptInvitation() call.
    DROP POLICY IF EXISTS tenant_isolation ON member_invitations;
    CREATE POLICY tenant_isolation_select ON member_invitations
      FOR SELECT
      USING (true);  -- application-layer enforces token check via WHERE token_hash = ?
    CREATE POLICY tenant_isolation_modify ON member_invitations
      FOR ALL
      USING (organization_id = current_setting('app.current_organization', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization', true)::uuid);
    ```

    **Create `apps/backend/src/authz/decorators/require-permission.decorator.ts`:**
    ```typescript
    import { SetMetadata } from '@nestjs/common';
    import type { Permission } from '../permissions.catalog';

    export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

    /**
     * Marks a resolver/controller handler as requiring all listed permissions
     * for the active organization (resolved by TenantContextMiddleware).
     */
    export const RequirePermission = (...permissions: Permission[]) =>
      SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
    ```

    **Create `apps/backend/src/authz/decorators/require-role.decorator.ts`** (escape hatch for cases where role check is more natural than permission check):
    ```typescript
    import { SetMetadata } from '@nestjs/common';

    export const REQUIRED_ROLES_KEY = 'requiredRoles';

    export const RequireRole = (...roleNames: Array<'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL'>) =>
      SetMetadata(REQUIRED_ROLES_KEY, roleNames);
    ```

    **Create `apps/backend/src/authz/decorators/current-tenant.decorator.ts`:**
    ```typescript
    import { createParamDecorator, ExecutionContext } from '@nestjs/common';
    import { GqlExecutionContext } from '@nestjs/graphql';

    export interface TenantContext {
      organizationId: string;
      memberId: string;
      roleName: string;
    }

    export const CurrentTenant = createParamDecorator((_d, ctx: ExecutionContext): TenantContext | null => {
      const gql = GqlExecutionContext.create(ctx);
      return gql.getContext().tenant ?? null;
    });
    ```

    **Create `apps/backend/src/authz/tenant-context.middleware.ts`** — runs in the GraphQL pipeline to resolve which membership is active:
    ```typescript
    import { Injectable, ExecutionContext, NestInterceptor, CallHandler } from '@nestjs/common';
    import { GqlExecutionContext } from '@nestjs/graphql';
    import { Observable } from 'rxjs';
    import type { JwtAccessPayload } from '../auth/types';

    @Injectable()
    export class TenantContextInterceptor implements NestInterceptor {
      intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
        const gql = GqlExecutionContext.create(ctx);
        const req = gql.getContext().req;
        const user = req?.user as JwtAccessPayload | undefined;
        if (user && user.memberships?.length) {
          const headerOrgId = req.headers['x-organization-id'] as string | undefined;
          let active = user.memberships[0];
          if (headerOrgId) {
            const matched = user.memberships.find((m) => m.organizationId === headerOrgId);
            if (!matched) {
              const e = new Error('TENANT_MISMATCH: requested organization not in user memberships');
              (e as any).extensions = { code: 'FORBIDDEN' };
              throw e;
            }
            active = matched;
          }
          gql.getContext().tenant = {
            organizationId: active.organizationId,
            memberId: active.memberId,
            roleName: active.roleName,
          };
        }
        return next.handle();
      }
    }
    ```

    **Create `apps/backend/src/authz/guards/permission.guard.ts`:**
    ```typescript
    import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
    import { Reflector } from '@nestjs/core';
    import { GqlExecutionContext } from '@nestjs/graphql';
    import { PrismaService } from '../../database/prisma.service';
    import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
    import { REQUIRED_ROLES_KEY } from '../decorators/require-role.decorator';
    import type { JwtAccessPayload } from '../../auth/types';
    import type { Permission } from '../permissions.catalog';

    @Injectable()
    export class PermissionGuard implements CanActivate {
      constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
      ) {}

      async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
          ctx.getHandler(), ctx.getClass(),
        ]) ?? [];
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [
          ctx.getHandler(), ctx.getClass(),
        ]) ?? [];

        if (required.length === 0 && requiredRoles.length === 0) return true;

        const gql = GqlExecutionContext.create(ctx);
        const req = gql.getContext().req;
        const tenant = gql.getContext().tenant;
        const user = req?.user as JwtAccessPayload | undefined;
        if (!user || !tenant) {
          throw new ForbiddenException('FORBIDDEN: no active tenant context');
        }

        // Role check
        if (requiredRoles.length > 0 && !requiredRoles.includes(tenant.roleName)) {
          throw new ForbiddenException(`FORBIDDEN: role ${tenant.roleName} not in [${requiredRoles.join(',')}]`);
        }

        // Permission check — resolve role's permissions from DB (cached via prisma layer)
        if (required.length > 0) {
          const role = await this.prisma.role.findFirst({
            where: { name: tenant.roleName, isSystem: true },
            include: { permissions: true },
          });
          const granted = new Set(role?.permissions.map((p) => p.permission) ?? []);
          const missing = required.filter((p) => !granted.has(p));
          if (missing.length > 0) {
            throw new ForbiddenException(`FORBIDDEN: missing permissions [${missing.join(',')}]`);
          }
        }

        return true;
      }
    }
    ```

    **Create `apps/backend/src/authz/authz.module.ts`:**
    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
    import { PermissionGuard } from './guards/permission.guard';
    import { TenantContextInterceptor } from './tenant-context.middleware';

    @Global()
    @Module({
      providers: [
        // Order matters: interceptor sets tenant context, then guard reads it.
        { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    })
    export class AuthzModule {}
    ```

    **Update `apps/backend/src/app.module.ts`** to import AuthzModule (place AFTER AuthModule so the JwtAuthGuard runs first, then PermissionGuard):
    ```typescript
    // Add to imports array, after AuthModule:
    AuthzModule,
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm prisma migrate deploy && pnpm typecheck && docker compose exec -T postgres psql -U postgres -d sgs -c "SELECT r.name, COUNT(rp.permission) FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id WHERE r.is_system=true GROUP BY r.name ORDER BY r.name;"</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/authz/permissions.catalog.ts` exports `PERMISSIONS` constant AND `ROLE_PERMISSIONS` map
    - File `apps/backend/src/authz/permissions.catalog.ts` declares 7 permissions for ADMIN AND 4 for MANAGER AND 2 for ATTENDANT AND 2 for PROFESSIONAL
    - File `apps/backend/src/authz/decorators/require-permission.decorator.ts` exports `RequirePermission` AND `REQUIRED_PERMISSIONS_KEY`
    - File `apps/backend/src/authz/guards/permission.guard.ts` reads `REQUIRED_PERMISSIONS_KEY` via Reflector AND queries `role_permissions` table
    - File `apps/backend/src/authz/tenant-context.middleware.ts` reads header `x-organization-id` AND throws on TENANT_MISMATCH
    - File `apps/backend/src/authz/authz.module.ts` registers `APP_INTERCEPTOR` (TenantContextInterceptor) AND `APP_GUARD` (PermissionGuard)
    - File `apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql` contains literal string `INSERT INTO role_permissions` AND uses `ON CONFLICT DO NOTHING`
    - File `apps/backend/prisma/migrations/20260502010000_seed_role_permissions/migration.sql` contains literal strings `DROP POLICY IF EXISTS tenant_isolation ON member_invitations` AND `CREATE POLICY tenant_isolation_select` AND `CREATE POLICY tenant_isolation_modify` (relaxed SELECT enables InvitationService.accept token lookup; modify operations remain tenant-scoped)
    - After running `prisma migrate deploy`, query `SELECT COUNT(*) FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name='ADMIN')` returns 7
    - After migration, query for MANAGER returns 4, ATTENDANT returns 2, PROFESSIONAL returns 2
  </acceptance_criteria>
  <done>
    Permissions catalog defined in code. Seed migration assigns permission rows to each system role. PermissionGuard + TenantContextInterceptor wired globally. Resolvers can now use `@RequirePermission(...)` to enforce authorization.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement member invitation flow + RBAC e2e test</name>
  <files>apps/backend/src/identity/identity.module.ts, apps/backend/src/identity/invitation.service.ts, apps/backend/src/identity/invitation.resolver.ts, apps/backend/src/identity/dto/invite-member.input.ts, apps/backend/src/identity/dto/accept-invitation.input.ts, apps/backend/src/graphql/schema/identity.graphql, apps/backend/src/auth/auth.service.ts, apps/backend/src/auth/auth.module.ts, apps/backend/src/app.module.ts, apps/backend/test/integration/rbac.e2e-spec.ts, apps/backend/test/integration/invitation.e2e-spec.ts</files>
  <read_first>
    - apps/backend/src/auth/auth.service.ts (existing — to refactor `issueSession` to public)
    - apps/backend/src/auth/auth.module.ts (export refactor)
    - apps/backend/src/email/email.service.ts (sendInvitation API)
    - apps/backend/src/authz/permissions.catalog.ts (PERMISSIONS map)
    - apps/backend/src/authz/decorators/require-permission.decorator.ts
    - apps/backend/src/authz/decorators/current-tenant.decorator.ts
    - apps/backend/prisma/schema.prisma (MemberInvitation model)
    - .planning/phases/01-foundation/01-UI-SPEC.md §"Member invitation acceptance" copy and error states (used by frontend in plan 06)
  </read_first>
  <behavior>
    InvitationService.invite:
    - Test: ADMIN invites by (email, roleName='ATTENDANT') → creates member_invitations row with token_hash, expires in 7 days, sends email
    - Test: Returns the plaintext token URL only via email; the API response does NOT include the token (security)
    - Test: Inviting an email that already has an active invitation for the same org → returns INVITATION_ALREADY_PENDING
    - Test: Inviting an email that's already a member of the org → returns ALREADY_MEMBER

    InvitationService.accept:
    - Test: Valid token + new fullName + password → creates User (or finds existing by email) + Member with the invited role; consumes the invitation; returns AuthPayload with tokens (logs the user in)
    - Test: Token expired → returns INVITATION_EXPIRED
    - Test: Token already used → returns INVITATION_USED
    - Test: Token invalid → returns TOKEN_INVALID

    RBAC e2e:
    - Test: ADMIN account calls inviteMember → success, returns invitation row id
    - Test: PROFESSIONAL account calls inviteMember → returns FORBIDDEN error (Phase 1 Success Criterion #3)
    - Test: User with no membership for the requested org (X-Organization-Id mismatch) → TENANT_MISMATCH
  </behavior>
  <action>
    **Refactor `apps/backend/src/auth/auth.service.ts`** to expose `issueSession` (currently private). Change `private async issueSession` → `async issueSession` and ensure it returns the AuthPayloadDto from existing implementation. No other changes needed.

    **Create `apps/backend/src/identity/dto/invite-member.input.ts`:**
    ```typescript
    import { IsEmail, IsIn, IsString } from 'class-validator';

    export class InviteMemberInput {
      @IsEmail()
      email!: string;

      @IsString()
      @IsIn(['ADMIN', 'MANAGER', 'ATTENDANT', 'PROFESSIONAL'])
      roleName!: 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'PROFESSIONAL';
    }
    ```

    **Create `apps/backend/src/identity/dto/accept-invitation.input.ts`:**
    ```typescript
    import { IsString, MinLength, MaxLength } from 'class-validator';

    export class AcceptInvitationInput {
      @IsString()
      token!: string;

      @IsString() @MinLength(2) @MaxLength(255)
      fullName!: string;

      @IsString() @MinLength(8) @MaxLength(255)
      password!: string;
    }
    ```

    **Create `apps/backend/src/identity/invitation.service.ts`:**
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { ConfigService } from '@nestjs/config';
    import { randomBytes, createHash } from 'node:crypto';
    import { PrismaService } from '../database/prisma.service';
    import { TenantContextService } from '../database/tenant-context.service';
    import { PasswordService } from '../auth/password.service';
    import { AuthService } from '../auth/auth.service';
    import { EmailService } from '../email/email.service';
    import { AuthError } from '../auth/types';
    import type { AuthPayloadDto } from '../auth/dto/auth.payload';
    import type { Env } from '../config/env.config';

    const TTL_DAYS = 7;

    @Injectable()
    export class InvitationService {
      constructor(
        private readonly prisma: PrismaService,
        private readonly tenant: TenantContextService,
        private readonly password: PasswordService,
        private readonly auth: AuthService,
        private readonly email: EmailService,
        private readonly config: ConfigService<Env, true>,
      ) {}

      async invite(args: { organizationId: string; invitedById: string; inviterName: string; salonName: string; email: string; roleName: string }): Promise<{ invitationId: string; expiresAt: Date }> {
        const lowercaseEmail = args.email.toLowerCase();

        // Pre-checks (cross-tenant safe — these queries scope by organizationId in WHERE)
        const existingMember = await this.prisma.member.findFirst({
          where: { organizationId: args.organizationId, user: { email: lowercaseEmail }, deletedAt: null },
        });
        if (existingMember) throw new AuthError('EMAIL_TAKEN', 'Este e-mail já é membro desta organização');

        const pending = await this.prisma.memberInvitation.findFirst({
          where: { organizationId: args.organizationId, email: lowercaseEmail, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        if (pending) throw new AuthError('INVITATION_USED', 'Já existe um convite pendente para este e-mail');

        const role = await this.prisma.role.findFirstOrThrow({ where: { name: args.roleName, isSystem: true } });

        const plaintext = randomBytes(48).toString('base64url');
        const tokenHash = createHash('sha256').update(plaintext).digest('hex');
        const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

        const invitation = await this.tenant.runWithTenant(args.organizationId, async (tx) => {
          return tx.memberInvitation.create({
            data: {
              organizationId: args.organizationId,
              email: lowercaseEmail,
              roleId: role.id,
              tokenHash,
              invitedById: args.invitedById,
              expiresAt,
            },
            select: { id: true, expiresAt: true },
          });
        });

        // Send email outside transaction
        await this.email.sendInvitation(lowercaseEmail, args.salonName, args.inviterName, plaintext);

        return invitation;
      }

      async accept(token: string, fullName: string, password: string): Promise<AuthPayloadDto> {
        const tokenHash = createHash('sha256').update(token).digest('hex');

        // Find invitation across all tenants — invitation lookup is platform-level, not tenant-scoped.
        // Use sgs_migrator path? No — runWithoutTenant on member_invitations would fail RLS.
        // Workaround: query with an explicit organization-set lookup is impossible without knowing the org.
        // Decision: invitations need a non-tenant-scoped lookup. Create a SECURITY DEFINER function `find_invitation_by_token_hash`
        // OR add a separate index path. For Phase 1 simplicity: use $queryRawUnsafe with the migrator role via DIRECT_URL? Avoid.
        //
        // Cleaner approach: drop RLS on member_invitations (it's already protected by token uniqueness; the hash is the secret)
        // and rely on application-layer enforcement of organization scoping for ALL OTHER queries.
        //
        // Phase 1 decision: keep RLS on member_invitations BUT add a session-set bypass policy: the invitation can be selected
        // when the request matches the token hash (which only the invitee knows). Update the policy in this migration.

        // For this task, USE a raw query that pre-resolves the org via the migrator role temporarily.
        // PRACTICAL Phase 1 approach: query via prisma.$queryRaw which goes through sgs_app — but the row is invisible
        // due to RLS (no organization context set yet, the invitee doesn't know the org).
        // Solution: add a lookup table or change the RLS policy.
        //
        // **ACTION**: Update the migration in this same plan-05 to relax RLS on member_invitations to allow SELECT
        // by token_hash regardless of tenant context (the token IS the secret), while keeping INSERT/UPDATE/DELETE tenant-scoped.

        const inv = await this.prisma.$queryRaw<Array<{
          id: string; organization_id: string; email: string; role_id: string;
          expires_at: Date; accepted_at: Date | null; revoked_at: Date | null;
        }>>`
          SELECT id, organization_id, email, role_id, expires_at, accepted_at, revoked_at
          FROM member_invitations
          WHERE token_hash = ${tokenHash}
          LIMIT 1
        `;
        const row = inv[0];
        if (!row) throw new AuthError('TOKEN_INVALID', 'Convite não encontrado');
        if (row.accepted_at) throw new AuthError('INVITATION_USED', 'Este convite já foi utilizado');
        if (row.revoked_at) throw new AuthError('TOKEN_INVALID', 'Convite revogado');
        if (row.expires_at < new Date()) throw new AuthError('INVITATION_EXPIRED', 'Este convite expirou');

        const passwordHash = await this.password.hash(password);

        // Find or create user. Email already lowercased by invite()
        let userId: string;
        const existingUser = await this.prisma.user.findUnique({ where: { email: row.email } });
        if (existingUser) {
          userId = existingUser.id;
          // If user exists but email_verified_at is null, mark verified — accepting the invite implies email control
          if (!existingUser.emailVerifiedAt) {
            await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
          }
        } else {
          const created = await this.prisma.user.create({
            data: { email: row.email, fullName, passwordHash, emailVerifiedAt: new Date() },
          });
          userId = created.id;
        }

        // Create membership inside tenant context, AND consume invitation, in a single transaction.
        await this.tenant.runWithTenant(row.organization_id, async (tx) => {
          await tx.member.create({
            data: {
              organizationId: row.organization_id,
              userId,
              roleId: row.role_id,
              displayName: fullName,
              status: 'active',
            },
          });
          await tx.memberInvitation.update({
            where: { id: row.id },
            data: { acceptedAt: new Date() },
          });
        });

        // Issue session for the new user immediately
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return this.auth.issueSession(user.id, user.email, user.fullName);
      }
    }
    ```

    **NOTE on the RLS policy adjustment:** The relaxed SELECT policy on `member_invitations` is ALREADY part of Task 1's migration file (`20260502010000_seed_role_permissions/migration.sql`). It MUST be in the same migration so `prisma migrate deploy` applies it before any `InvitationService.accept()` raw query runs (which scans without tenant context).

    Document this trade-off in the SUMMARY: relaxed SELECT on member_invitations is acceptable because (a) token_hash is opaque, (b) the application always queries by hash equality, never enumerates, (c) modify operations remain tenant-scoped via tenant_isolation_modify policy.

    **Create `apps/backend/src/graphql/schema/identity.graphql`:**
    ```graphql
    extend type Mutation {
      inviteMember(input: InviteMemberInput!): InviteMemberPayload!
      acceptInvitation(input: AcceptInvitationInput!): AuthPayload!
      revokeInvitation(invitationId: UUID!): RevokeInvitationPayload!
    }

    extend type Query {
      pendingInvitations: [PendingInvitation!]!
    }

    input InviteMemberInput {
      email: Email!
      roleName: String!
    }

    input AcceptInvitationInput {
      token: String!
      fullName: String!
      password: String!
    }

    type InviteMemberPayload {
      invitationId: UUID
      expiresAt: DateTime
      errors: [UserError!]!
    }

    type RevokeInvitationPayload {
      success: Boolean!
      errors: [UserError!]!
    }

    type PendingInvitation {
      id: UUID!
      email: Email!
      roleName: String!
      expiresAt: DateTime!
      createdAt: DateTime!
    }
    ```

    **Create `apps/backend/src/identity/invitation.resolver.ts`:**
    ```typescript
    import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
    import { UseGuards } from '@nestjs/common';
    import { InvitationService } from './invitation.service';
    import { AuthService } from '../auth/auth.service';
    import { PrismaService } from '../database/prisma.service';
    import { TenantContextService } from '../database/tenant-context.service';
    import { Public } from '../auth/decorators/public.decorator';
    import { CurrentUser } from '../auth/decorators/current-user.decorator';
    import { CurrentTenant, TenantContext } from '../authz/decorators/current-tenant.decorator';
    import { RequirePermission } from '../authz/decorators/require-permission.decorator';
    import { PERMISSIONS } from '../authz/permissions.catalog';
    import { AuthError } from '../auth/types';
    import type { JwtAccessPayload } from '../auth/types';

    @Resolver()
    export class InvitationResolver {
      constructor(
        private readonly invitations: InvitationService,
        private readonly prisma: PrismaService,
        private readonly tenant: TenantContextService,
      ) {}

      @RequirePermission(PERMISSIONS.MEMBER_INVITE)
      @Mutation('inviteMember')
      async invite(
        @Args('input') input: { email: string; roleName: string },
        @CurrentUser() user: JwtAccessPayload,
        @CurrentTenant() tenant: TenantContext,
      ) {
        try {
          const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } });
          const result = await this.invitations.invite({
            organizationId: tenant.organizationId,
            invitedById: tenant.memberId,
            inviterName: user.email,
            salonName: org.tradeName,
            email: input.email,
            roleName: input.roleName,
          });
          return { invitationId: result.invitationId, expiresAt: result.expiresAt, errors: [] };
        } catch (e) {
          if (e instanceof AuthError) return { invitationId: null, expiresAt: null, errors: [{ code: e.code, message: e.message }] };
          throw e;
        }
      }

      @Public()
      @Mutation('acceptInvitation')
      async accept(@Args('input') input: { token: string; fullName: string; password: string }) {
        try {
          return await this.invitations.accept(input.token, input.fullName, input.password);
        } catch (e) {
          if (e instanceof AuthError) {
            return { accessToken: null, refreshToken: null, session: null, errors: [{ code: e.code, message: e.message }] };
          }
          throw e;
        }
      }

      @RequirePermission(PERMISSIONS.MEMBER_INVITE)
      @Mutation('revokeInvitation')
      async revoke(@Args('invitationId') invitationId: string, @CurrentTenant() tenant: TenantContext) {
        await this.tenant.runWithTenant(tenant.organizationId, async (tx) => {
          await tx.memberInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
        });
        return { success: true, errors: [] };
      }

      @RequirePermission(PERMISSIONS.MEMBER_READ)
      @Query('pendingInvitations')
      async pending(@CurrentTenant() tenant: TenantContext) {
        return this.tenant.runWithTenant(tenant.organizationId, async (tx) => {
          const rows = await tx.memberInvitation.findMany({
            where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
            include: { role: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
          });
          return rows.map((r) => ({
            id: r.id, email: r.email, roleName: r.role.name,
            expiresAt: r.expiresAt, createdAt: r.createdAt,
          }));
        });
      }
    }
    ```

    **Create `apps/backend/src/identity/identity.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { AuthModule } from '../auth/auth.module';
    import { InvitationService } from './invitation.service';
    import { InvitationResolver } from './invitation.resolver';

    @Module({
      imports: [AuthModule],
      providers: [InvitationService, InvitationResolver],
      exports: [InvitationService],
    })
    export class IdentityModule {}
    ```

    **Update `apps/backend/src/app.module.ts`** to import `IdentityModule` AND `AuthzModule`.

    **Create `apps/backend/test/integration/rbac.e2e-spec.ts`** — proves Phase 1 Success Criterion #3:
    ```typescript
    import { Test } from '@nestjs/testing';
    import type { INestApplication } from '@nestjs/common';
    import * as request from 'supertest';
    import { AppModule } from '../../src/app.module';
    import { adminPrisma } from './setup';

    describe('RBAC enforcement (AUTH-03, Phase 1 Success Criterion #3)', () => {
      let app: INestApplication;
      let adminAccessToken: string;
      let proAccessToken: string;
      let orgId: string;

      beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleRef.createNestApplication();
        await app.init();

        // Cleanup
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'rbac-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rbac-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'rbac-test-%'`);

        // Setup: create org + ADMIN user + PROFESSIONAL user
        const adminRole = await adminPrisma.role.findFirstOrThrow({ where: { name: 'ADMIN', isSystem: true } });
        const proRole = await adminPrisma.role.findFirstOrThrow({ where: { name: 'PROFESSIONAL', isSystem: true } });

        const org = await adminPrisma.organization.create({
          data: { legalName: 'rbac-test-org', tradeName: 'rbac-test', documentType: 'CNPJ', documentNumber: `rbac-${Date.now()}`, email: 't@t.com', subdomain: `rbac-${Date.now()}`, segment: 'salon' },
        });
        orgId = org.id;

        const argon2 = await import('argon2');
        const pwHash = await argon2.hash('password1234', { type: argon2.argon2id });

        const adminUser = await adminPrisma.user.create({
          data: { email: `rbac-test-admin-${Date.now()}@t.com`, fullName: 'admin', passwordHash: pwHash, emailVerifiedAt: new Date() },
        });
        const proUser = await adminPrisma.user.create({
          data: { email: `rbac-test-pro-${Date.now()}@t.com`, fullName: 'pro', passwordHash: pwHash, emailVerifiedAt: new Date() },
        });

        await adminPrisma.member.create({ data: { organizationId: orgId, userId: adminUser.id, roleId: adminRole.id, displayName: 'rbac-test-admin' } });
        await adminPrisma.member.create({ data: { organizationId: orgId, userId: proUser.id, roleId: proRole.id, displayName: 'rbac-test-pro' } });

        // Login both
        const adminLogin = await request(app.getHttpServer()).post('/graphql').send({
          query: `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
          variables: { i: { email: adminUser.email, password: 'password1234' } },
        });
        adminAccessToken = adminLogin.body.data.login.accessToken;

        const proLogin = await request(app.getHttpServer()).post('/graphql').send({
          query: `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
          variables: { i: { email: proUser.email, password: 'password1234' } },
        });
        proAccessToken = proLogin.body.data.login.accessToken;
      });

      afterAll(async () => {
        await app.close();
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'rbac-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rbac-test-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'rbac-test-%'`);
      });

      it('ADMIN can call inviteMember', async () => {
        const res = await request(app.getHttpServer()).post('/graphql')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .set('X-Organization-Id', orgId)
          .send({
            query: `mutation($i: InviteMemberInput!) { inviteMember(input: $i) { invitationId errors { code } } }`,
            variables: { i: { email: `rbac-invitee-${Date.now()}@t.com`, roleName: 'ATTENDANT' } },
          });
        expect(res.body.data.inviteMember.errors).toEqual([]);
        expect(res.body.data.inviteMember.invitationId).toBeTruthy();
      });

      it('PROFESSIONAL cannot call inviteMember (FORBIDDEN)', async () => {
        const res = await request(app.getHttpServer()).post('/graphql')
          .set('Authorization', `Bearer ${proAccessToken}`)
          .set('X-Organization-Id', orgId)
          .send({
            query: `mutation($i: InviteMemberInput!) { inviteMember(input: $i) { invitationId errors { code } } }`,
            variables: { i: { email: `rbac-blocked-${Date.now()}@t.com`, roleName: 'ATTENDANT' } },
          });
        expect(res.body.errors?.[0].extensions?.code ?? res.body.errors?.[0].message).toMatch(/FORBIDDEN/);
      });
    });
    ```

    **Create `apps/backend/test/integration/invitation.e2e-spec.ts`** — accept-invitation happy path + error states:
    ```typescript
    import { Test } from '@nestjs/testing';
    import type { INestApplication } from '@nestjs/common';
    import * as request from 'supertest';
    import { createHash } from 'node:crypto';
    import { AppModule } from '../../src/app.module';
    import { adminPrisma } from './setup';

    describe('Member invitation flow (D-15)', () => {
      let app: INestApplication;
      let orgId: string;
      let adminMemberId: string;

      beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
        await adminPrisma.$executeRawUnsafe(`DELETE FROM member_invitations WHERE email LIKE 'inv-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'inv-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'inv-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'inv-%'`);

        const adminRole = await adminPrisma.role.findFirstOrThrow({ where: { name: 'ADMIN', isSystem: true } });
        const org = await adminPrisma.organization.create({
          data: { legalName: 'inv-org', tradeName: 'inv', documentType: 'CNPJ', documentNumber: `inv-${Date.now()}`, email: 'a@a.com', subdomain: `inv-${Date.now()}`, segment: 'salon' },
        });
        orgId = org.id;
        const argon2 = await import('argon2');
        const adminUser = await adminPrisma.user.create({
          data: { email: `inv-admin-${Date.now()}@t.com`, fullName: 'inv admin', passwordHash: await argon2.hash('password1234', { type: argon2.argon2id }), emailVerifiedAt: new Date() },
        });
        const member = await adminPrisma.member.create({
          data: { organizationId: orgId, userId: adminUser.id, roleId: adminRole.id, displayName: 'inv-admin-member' },
        });
        adminMemberId = member.id;
      });

      afterAll(async () => {
        await app.close();
        await adminPrisma.$executeRawUnsafe(`DELETE FROM member_invitations WHERE email LIKE 'inv-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM members WHERE display_name LIKE 'inv-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'inv-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'inv-%'`);
      });

      it('accept invitation creates user + member + returns valid session', async () => {
        // Manually create an invitation with known plaintext
        const plaintext = 'invtoken-known-' + Date.now();
        const tokenHash = createHash('sha256').update(plaintext).digest('hex');
        const proRole = await adminPrisma.role.findFirstOrThrow({ where: { name: 'PROFESSIONAL', isSystem: true } });
        await adminPrisma.memberInvitation.create({
          data: {
            organizationId: orgId,
            email: `inv-newbie-${Date.now()}@t.com`,
            roleId: proRole.id,
            tokenHash,
            invitedById: adminMemberId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        const res = await request(app.getHttpServer()).post('/graphql').send({
          query: `mutation($i: AcceptInvitationInput!) { acceptInvitation(input: $i) {
            accessToken refreshToken session { memberships { roleName organizationName } } errors { code message }
          } }`,
          variables: { i: { token: plaintext, fullName: 'inv newbie', password: 'newbie12345' } },
        });

        expect(res.body.data.acceptInvitation.errors).toEqual([]);
        expect(res.body.data.acceptInvitation.accessToken).toBeTruthy();
        expect(res.body.data.acceptInvitation.session.memberships[0].roleName).toBe('PROFESSIONAL');
      });

      it('accept with expired token returns INVITATION_EXPIRED', async () => {
        const plaintext = 'invtoken-expired-' + Date.now();
        const tokenHash = createHash('sha256').update(plaintext).digest('hex');
        const proRole = await adminPrisma.role.findFirstOrThrow({ where: { name: 'PROFESSIONAL', isSystem: true } });
        await adminPrisma.memberInvitation.create({
          data: {
            organizationId: orgId,
            email: `inv-expired-${Date.now()}@t.com`,
            roleId: proRole.id,
            tokenHash,
            invitedById: adminMemberId,
            expiresAt: new Date(Date.now() - 60_000),
          },
        });

        const res = await request(app.getHttpServer()).post('/graphql').send({
          query: `mutation($i: AcceptInvitationInput!) { acceptInvitation(input: $i) {
            errors { code }
          } }`,
          variables: { i: { token: plaintext, fullName: 'expired', password: 'expired12345' } },
        });
        expect(res.body.data.acceptInvitation.errors[0].code).toBe('INVITATION_EXPIRED');
      });
    });
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm prisma migrate deploy && pnpm typecheck && pnpm test:integration -- rbac.e2e-spec invitation.e2e-spec</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/identity/invitation.service.ts` exposes methods `invite` and `accept`
    - File `apps/backend/src/identity/invitation.service.ts` calls `email.sendInvitation` AND uses `createHash('sha256')` for token storage
    - File `apps/backend/src/identity/invitation.resolver.ts` decorates `inviteMember` with `@RequirePermission(PERMISSIONS.MEMBER_INVITE)`
    - File `apps/backend/src/identity/invitation.resolver.ts` decorates `acceptInvitation` with `@Public()`
    - File `apps/backend/src/graphql/schema/identity.graphql` declares `inviteMember`, `acceptInvitation`, `revokeInvitation`, `pendingInvitations`
    - File `apps/backend/src/auth/auth.service.ts` `issueSession` is no longer `private` (callable from InvitationService)
    - Migration `20260502010000_seed_role_permissions/migration.sql` includes the relaxed SELECT policy on `member_invitations` (literal `tenant_isolation_select`)
    - Command `pnpm test:integration -- rbac.e2e-spec` exits 0 with both tests passing (ADMIN can invite, PROFESSIONAL cannot)
    - Command `pnpm test:integration -- invitation.e2e-spec` exits 0 with both tests passing
  </acceptance_criteria>
  <done>
    AUTH-03 satisfied: 4 system roles have permissions assigned. RequirePermission decorator + PermissionGuard enforce role-based access. D-15 satisfied: ADMIN can invite by email, invitee can accept and immediately get a session. Phase 1 Success Criterion #3 proven by automated test (PROFESSIONAL → FORBIDDEN on inviteMember).
  </done>
</task>

</tasks>

<verification>
- 4 system roles have correct permission counts in role_permissions
- Resolver decorated with @RequirePermission rejects PROFESSIONAL accounts
- TenantContextInterceptor populates `ctx.tenant` from JWT.memberships and X-Organization-Id header
- TENANT_MISMATCH thrown when X-Organization-Id is not in JWT.memberships
- inviteMember sends email and creates invitation row
- acceptInvitation creates user/member, consumes token, returns valid session
</verification>

<success_criteria>
- AUTH-03 satisfied: 4 roles, code-defined permissions, technical layer works
- D-15 satisfied: invite + accept flow end-to-end
- Phase 1 Success Criterion #3 verified by automated test
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-05-SUMMARY.md` documenting:
- Permission catalog as a table (role × permissions)
- The exact decorator API (`@RequirePermission`, `@RequireRole`, `@CurrentTenant`)
- The TENANT_MISMATCH semantics
- The relaxed SELECT-by-token-hash policy on member_invitations and the security argument for it
- The signature change `AuthService.issueSession` (private → public) and which downstream code uses it
- Known follow-ups: (1) audit log entries for invite/accept/revoke (deferred to Phase 5 audit module), (2) UI for role management (deferred per D-13)
</output>

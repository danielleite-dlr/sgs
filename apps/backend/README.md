# @sgs/backend

NestJS GraphQL API for SGS — multi-tenant salon management platform.

## Local development

```bash
pnpm dev                   # nest start --watch (requires postgres + valkey running via docker compose)
pnpm test                  # unit tests
pnpm test:integration      # integration tests (requires postgres + pgbouncer + valkey via docker compose)
pnpm prisma:generate       # regenerate Prisma client after schema changes
pnpm prisma:migrate:dev    # create and apply a new migration
pnpm prisma:migrate:deploy # apply pending migrations (used in CI and production)
```

## Module layout

See `PRD_Backend_Plataforma_Saloes.md` §2.2 for the full bounded context list. Phase 1 modules:

| Module | Purpose |
|--------|---------|
| `database/` | `PrismaService` (singleton client) + `TenantContextService` (RLS wrapper — the heart of multi-tenancy) |
| `auth/` | Signup, login, refresh, email verification, session issuance |
| `authz/` | Permissions catalog, `RequirePermission` guard, `TenantContextInterceptor`, `JwtAuthGuard` |
| `email/` | `ResendAdapter` (production) + `TestEmailAdapter` (tests) + `EmailService` (facade) |
| `identity/` | Member invitation flow (`InvitationService`, invitation resolver) |
| `graphql/` | SDL type definition files + custom scalars (UUID, DateTime) |
| `config/` | `AppConfigService` typed wrapper + Zod env schema |

## Multi-tenant rules (REQUIRED reading before writing data access code)

1. **Always** use `TenantContextService.runWithTenant(orgId, async (tx) => {...})` for tenant-scoped queries — never bare `PrismaService` for tenant tables.
2. **Never** issue raw SQL with `SET app.current_organization` — always `SET LOCAL` inside `$transaction`.
3. **Never** reuse the `sgs_migrator` role at runtime — only Prisma migrations should use `DIRECT_URL`.
4. **Always** add new tenant-scoped tables with `FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy in the migration.
5. The CI job `integration` enforces isolation correctness via the RLS isolation suite.

## Auth quick reference

| Mutation | Public? | Permission required |
|----------|---------|---------------------|
| `signup` | yes | — |
| `verifyEmail` | yes | — |
| `resendVerification` | yes | — |
| `login` | yes | — |
| `refreshSession` | yes | — |
| `logout` | yes | — |
| `inviteMember` | no | `member.invite` |
| `acceptInvitation` | yes | — |
| `revokeInvitation` | no | `member.invite` |

Add `@Public()` to opt a resolver handler out of `JwtAuthGuard`.
Add `@RequirePermission(PERMISSIONS.member.invite)` for permission enforcement.

## Email in tests

Override the `EMAIL_ADAPTER` token with `TestEmailAdapter` to capture emails in memory:

```typescript
import { TestEmailAdapter } from '../../src/email/test-email.adapter';
import { EMAIL_ADAPTER } from '../../src/email/email.module';

const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(EMAIL_ADAPTER)
  .useClass(TestEmailAdapter)
  .compile();

const mailer = moduleRef.get<TestEmailAdapter>(EMAIL_ADAPTER);
// After signup:
const token = mailer.extractToken(mailer.findByRecipient(email)[0]);
```

## Environment variables

See `.env.example` at repo root. Required for integration tests:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma runtime connection (sgs_app via PgBouncer) |
| `DIRECT_URL` | Prisma migrations connection (sgs_migrator direct to postgres) |
| `JWT_SECRET` | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (min 32 chars) |
| `FRONTEND_URL` | Used to construct email verification/invitation links |
| `EMAIL_FROM` | Sender address for transactional emails |
| `RESEND_API_KEY` | Resend API key (optional — falls back to console log if unset) |

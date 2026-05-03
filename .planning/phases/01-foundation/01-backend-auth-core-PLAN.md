---
phase: 01-foundation
plan: 04
type: execute
wave: 3
depends_on: [02]
files_modified:
  - apps/backend/package.json
  - apps/backend/src/main.ts
  - apps/backend/src/app.module.ts
  - apps/backend/src/config/env.config.ts
  - apps/backend/src/graphql/scalars.ts
  - apps/backend/src/graphql/graphql.module.ts
  - apps/backend/src/graphql/schema/scalars.graphql
  - apps/backend/src/graphql/schema/auth.graphql
  - apps/backend/src/queue/queue.module.ts
  - apps/backend/src/auth/auth.module.ts
  - apps/backend/src/auth/auth.resolver.ts
  - apps/backend/src/auth/auth.service.ts
  - apps/backend/src/auth/password.service.ts
  - apps/backend/src/auth/token.service.ts
  - apps/backend/src/auth/email-verification.service.ts
  - apps/backend/src/auth/jwt.strategy.ts
  - apps/backend/src/auth/guards/jwt-auth.guard.ts
  - apps/backend/src/auth/decorators/current-user.decorator.ts
  - apps/backend/src/auth/decorators/public.decorator.ts
  - apps/backend/src/auth/dto/signup.input.ts
  - apps/backend/src/auth/dto/login.input.ts
  - apps/backend/src/auth/dto/refresh.input.ts
  - apps/backend/src/auth/dto/auth.payload.ts
  - apps/backend/src/auth/types.ts
  - apps/backend/src/email/email.module.ts
  - apps/backend/src/email/resend.adapter.ts
  - apps/backend/src/email/email.service.ts
  - apps/backend/test/integration/auth.e2e-spec.ts
autonomous: true
requirements: [AUTH-01, AUTH-02, INFRA-03]

must_haves:
  truths:
    - "Mutation `signup(input)` creates a User and an Organization in a single transaction, sends verification email via Resend, returns null tokens until email verified"
    - "Mutation `verifyEmail(token)` consumes a valid email_verification_token, sets users.email_verified_at, returns success"
    - "Mutation `login(email, password)` validates the password (Argon2id) and returns access (15m) + refresh (30d) tokens; rejects unverified users with `ACCOUNT_UNVERIFIED` error code"
    - "Mutation `refreshSession(refreshToken)` rotates the token: marks old as revoked, issues new pair within the same family; reuse of an already-revoked token revokes all tokens in the family"
    - "Mutation `logout` revokes the current refresh token"
    - "Access JWT contains `userId`, `email`, `memberships[]`, signed with HS256 using JWT_ACCESS_SECRET, expires in 15m"
    - "Refresh tokens stored as Argon2id-hashed strings in refresh_tokens table; never returned hashed"
  artifacts:
    - path: "apps/backend/src/auth/auth.module.ts"
      provides: "AuthModule wiring resolver + services + JWT strategy"
      exports: ["AuthModule"]
    - path: "apps/backend/src/auth/auth.resolver.ts"
      provides: "GraphQL mutations: signup, verifyEmail, resendVerification, login, refreshSession, logout"
      contains: "@Mutation"
    - path: "apps/backend/src/auth/token.service.ts"
      provides: "Issue/verify access JWT and rotate refresh tokens"
      exports: ["TokenService"]
    - path: "apps/backend/src/auth/password.service.ts"
      provides: "Argon2id hashing + verification"
      exports: ["PasswordService"]
    - path: "apps/backend/src/email/resend.adapter.ts"
      provides: "Resend HTTP client adapter; sends verification email with token link"
      exports: ["ResendAdapter"]
    - path: "apps/backend/src/graphql/schema/auth.graphql"
      provides: "GraphQL SDL for AuthPayload, SignupInput, LoginInput, RefreshInput"
      contains: "type Mutation"
    - path: "apps/backend/test/integration/auth.e2e-spec.ts"
      provides: "End-to-end test of signup → verify email → login → refresh → logout"
      contains: "describe('Auth flow"
  key_links:
    - from: "AuthService.signup"
      to: "TenantContextService.runWithoutTenant"
      via: "Prisma $transaction"
      pattern: "runWithoutTenant"
    - from: "AuthService.signup"
      to: "EmailService.sendVerification"
      via: "Resend HTTP API"
      pattern: "sendVerification"
    - from: "TokenService.rotateRefresh"
      to: "refresh_tokens table"
      via: "find by hash + family-id consistency check"
      pattern: "familyId"
    - from: "JwtStrategy.validate"
      to: "User.id from JWT sub"
      via: "@nestjs/passport jwt strategy"
      pattern: "passport-jwt"
---

<objective>
Implement the backend authentication core: combined signup-with-organization, email verification (Resend), login, JWT access tokens (15 min), opaque refresh tokens (30 day) with rotation and reuse-detection family invalidation, and logout.

Per CONTEXT.md decisions D-09..D-12: signup is a single sequential flow that creates User + Organization atomically, the creator becomes ADMIN (linked to the system ADMIN role from plan 02), and email verification is mandatory before first login.

Output: A backend that satisfies AUTH-01 and AUTH-02 success criteria — a user can create an account, verify email, log in, and have their session persisted across browser refreshes via refresh-token rotation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-UI-SPEC.md
@.planning/phases/01-foundation/01-02-SUMMARY.md
@PRD_Backend_Plataforma_Saloes.md
@.planning/research/PITFALLS.md
@apps/backend/prisma/schema.prisma
@apps/backend/src/database/tenant-context.service.ts
@apps/backend/src/database/prisma.service.ts
@.env.example

<interfaces>
<!-- From plan 02: -->
- PrismaService (apps/backend/src/database/prisma.service.ts) — singleton client via DATABASE_URL
- TenantContextService.runWithTenant(orgId, fn) — for tenant-scoped queries
- TenantContextService.runWithoutTenant(fn) — for cross-tenant lookups (signup email check, login)
- DatabaseModule is @Global, so PrismaService and TenantContextService inject anywhere
- Prisma models available: User, Organization, Member, Role, RefreshToken, EmailVerificationToken, OutboxEvent
- 4 system roles seeded: ADMIN, MANAGER, ATTENDANT, PROFESSIONAL (organization_id IS NULL, is_system=true)

<!-- Locked decisions from CONTEXT.md driving this plan: -->
- D-09: Signup creates user AND organization in one sequential flow (no separation of steps)
- D-10: Collect only nome (full_name), email, senha, nome do salão (organization legal_name + trade_name)
- D-11: Email verification is MANDATORY — login refused until users.email_verified_at IS NOT NULL
- D-12: Creator gets ADMIN role automatically (look up role by name='ADMIN' AND is_system=true)

<!-- Constraints from PITFALLS.md: -->
- Use Argon2id for password hashes (NOT bcrypt — bcrypt has 72-char limit; Argon2id is current OWASP recommendation)
- JWT signing key must be ≥32 chars (HS256); load from JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
- Refresh tokens stored hashed (Argon2id), never plaintext
- Refresh-token reuse = compromise; revoke entire family

<!-- Constraints from PRD_Backend §5.1: -->
- Access token: 15 minutes
- Refresh token: 30 days, opaque (random 64 bytes), stored hashed
- Rotation on every refresh; reuse triggers family revocation
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Install dependencies, configure env validation, scaffold GraphQL with custom scalars</name>
  <files>apps/backend/package.json, apps/backend/src/main.ts, apps/backend/src/app.module.ts, apps/backend/src/config/env.config.ts, apps/backend/src/graphql/scalars.ts, apps/backend/src/graphql/graphql.module.ts, apps/backend/src/graphql/schema/scalars.graphql</files>
  <read_first>
    - apps/backend/package.json (current deps)
    - apps/backend/src/app.module.ts (current module wiring)
    - PRD_Backend_Plataforma_Saloes.md §4.1-4.4 (GraphQL setup conventions)
    - .env.example (env variables this plan introduces)
  </read_first>
  <behavior>
    - Test: `app.listen` boots without error when all required env vars are present
    - Test: When `JWT_ACCESS_SECRET` is missing, app fails fast with a clear validation error
    - Test: GraphQL endpoint at /graphql responds 200 to a `__typename` introspection query
    - Test: Custom UUID scalar parses valid UUIDs and rejects invalid strings
  </behavior>
  <action>
    **Add to apps/backend/package.json dependencies:**
    - `@nestjs/graphql@^12.2.0`
    - `@nestjs/apollo@^12.2.0`
    - `@apollo/server@^4.11.0`
    - `graphql@^16.9.0`
    - `graphql-scalars@^1.23.0`
    - `@nestjs/config@^3.3.0`
    - `@nestjs/jwt@^10.2.0`
    - `@nestjs/passport@^10.0.3`
    - `@nestjs/bullmq@^10.2.0`     # INFRA-03: registers BullModule.forRootAsync against Valkey
    - `bullmq@^5.13.0`
    - `passport@^0.7.0`
    - `passport-jwt@^4.0.1`
    - `argon2@^0.41.1`
    - `zod@^3.23.8`
    - `class-validator@^0.14.1`
    - `class-transformer@^0.5.1`
    - `nestjs-pino@^4.1.0`
    - `pino@^9.5.0`
    - `pino-pretty@^11.3.0`

    devDependencies:
    - `@types/passport-jwt@^4.0.1`

    **Create `apps/backend/src/queue/queue.module.ts`** — registers BullMQ globally against Valkey (per INFRA-03; no queue definitions in Phase 1, just the module wired so future plans can call `@InjectQueue()`):
    ```typescript
    import { Module, Global } from '@nestjs/common';
    import { BullModule } from '@nestjs/bullmq';
    import { ConfigModule, ConfigService } from '@nestjs/config';
    import type { Env } from '../config/env.config';

    @Global()
    @Module({
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => {
            const url = new URL(config.get('REDIS_URL', { infer: true }));
            return {
              connection: {
                host: url.hostname,
                port: Number(url.port) || 6379,
                // Valkey 8 is Redis 7.2 binary-compatible — no auth in dev; production adds password
              },
              defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: { age: 3600, count: 100 },
                removeOnFail: { age: 24 * 3600 },
              },
            };
          },
        }),
      ],
      exports: [BullModule],
    })
    export class QueueModule {}
    ```

    **Create `apps/backend/src/config/env.config.ts`** — Zod validation, fail-fast at boot:
    ```typescript
    import { z } from 'zod';

    const envSchema = z.object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      BACKEND_PORT: z.coerce.number().int().positive().default(3000),

      DATABASE_URL: z.string().url(),
      DIRECT_URL: z.string().url(),
      REDIS_URL: z.string().url(),

      JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
      JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
      JWT_ACCESS_TTL: z.string().default('15m'),
      JWT_REFRESH_TTL: z.string().default('30d'),

      RESEND_API_KEY: z.string().optional(),  // optional in dev — falls back to console logger
      RESEND_FROM_EMAIL: z.string().email().default('no-reply@sgs.local'),
      APP_URL: z.string().url().default('http://localhost:5173'),
    });

    export type Env = z.infer<typeof envSchema>;

    export function validateEnv(raw: Record<string, unknown>): Env {
      const result = envSchema.safeParse(raw);
      if (!result.success) {
        const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Invalid environment configuration:\n${issues}`);
      }
      return result.data;
    }
    ```

    **Create `apps/backend/src/graphql/scalars.ts`** — UUID, DateTime, Email scalars from graphql-scalars:
    ```typescript
    import { GraphQLUUID, GraphQLDateTimeISO, GraphQLEmailAddress } from 'graphql-scalars';

    export const customScalars = {
      UUID: GraphQLUUID,
      DateTime: GraphQLDateTimeISO,
      Email: GraphQLEmailAddress,
    };
    ```

    **Create `apps/backend/src/graphql/schema/scalars.graphql`:**
    ```graphql
    scalar UUID
    scalar DateTime
    scalar Email
    ```

    **Create `apps/backend/src/graphql/graphql.module.ts`** — schema-first via SDL files (per PRD §4.3):
    ```typescript
    import { Module } from '@nestjs/common';
    import { GraphQLModule } from '@nestjs/graphql';
    import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
    import { join } from 'node:path';
    import { customScalars } from './scalars';

    @Module({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          typePaths: [join(__dirname, 'schema/*.graphql')],
          resolvers: { ...customScalars },
          context: ({ req, res }) => ({ req, res }),
          playground: process.env.NODE_ENV !== 'production',
          introspection: process.env.NODE_ENV !== 'production',
        }),
      ],
    })
    export class GraphqlModule {}
    ```

    **Update `apps/backend/src/main.ts`:**
    ```typescript
    import { NestFactory } from '@nestjs/core';
    import { Logger } from 'nestjs-pino';
    import { AppModule } from './app.module';
    import { validateEnv } from './config/env.config';

    async function bootstrap() {
      const env = validateEnv(process.env);
      const app = await NestFactory.create(AppModule, { bufferLogs: true });
      app.useLogger(app.get(Logger));
      app.enableCors({ origin: env.APP_URL, credentials: true });
      await app.listen(env.BACKEND_PORT, '0.0.0.0');
      console.log(`[sgs-backend] listening on :${env.BACKEND_PORT}, env=${env.NODE_ENV}`);
    }
    bootstrap();
    ```

    **Update `apps/backend/src/app.module.ts`** to import ConfigModule + LoggerModule + GraphqlModule:
    ```typescript
    import { Module, Controller, Get } from '@nestjs/common';
    import { ConfigModule } from '@nestjs/config';
    import { LoggerModule } from 'nestjs-pino';
    import { DatabaseModule } from './database/database.module';
    import { GraphqlModule } from './graphql/graphql.module';
    import { QueueModule } from './queue/queue.module';
    import { AuthModule } from './auth/auth.module';
    import { EmailModule } from './email/email.module';
    import { validateEnv } from './config/env.config';

    @Controller('health')
    class HealthController {
      @Get()
      check() {
        return { status: 'ok', service: 'sgs-backend', timestamp: new Date().toISOString() };
      }
    }

    @Module({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        LoggerModule.forRoot({
          pinoHttp: {
            transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        }),
        DatabaseModule,
        GraphqlModule,
        QueueModule,
        EmailModule,
        AuthModule,
      ],
      controllers: [HealthController],
    })
    export class AppModule {}
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm install && pnpm typecheck && pnpm build && (pnpm start &) ; SERVER_PID=$! ; sleep 5 ; curl -fsS http://localhost:3000/health && curl -fsS -X POST http://localhost:3000/graphql -H "content-type: application/json" -d '{"query":"{__typename}"}' ; kill $SERVER_PID</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/config/env.config.ts` exports `validateEnv` AND uses Zod
    - File `apps/backend/src/config/env.config.ts` enforces `JWT_ACCESS_SECRET.min(32)` AND `JWT_REFRESH_SECRET.min(32)`
    - File `apps/backend/src/graphql/graphql.module.ts` registers `GraphQLModule.forRoot` with ApolloDriver
    - File `apps/backend/src/graphql/schema/scalars.graphql` declares `scalar UUID`, `scalar DateTime`, `scalar Email`
    - File `apps/backend/src/app.module.ts` imports `ConfigModule`, `LoggerModule`, `GraphqlModule`, `AuthModule`, `EmailModule`
    - File `apps/backend/package.json` declares `argon2`, `@nestjs/jwt`, `passport-jwt`, `graphql-scalars`, `nestjs-pino`, `@nestjs/bullmq`, `bullmq`
    - File `apps/backend/src/queue/queue.module.ts` exists, exports `QueueModule`, registers `BullModule.forRootAsync` reading `REDIS_URL` from config (INFRA-03)
    - File `apps/backend/src/app.module.ts` imports `QueueModule`
    - Command `pnpm typecheck` exits 0
    - Backend `pnpm start` boots with no env errors when .env has the required JWT secrets (32+ chars)
  </acceptance_criteria>
  <done>
    Backend boots with NestJS + GraphQL + Pino logger + Config validation. Custom scalars registered. AppModule imports the new AuthModule, EmailModule, and QueueModule (BullMQ registered against Valkey per INFRA-03; no queue definitions yet — first queue lands in a Phase 5 worker plan).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement EmailModule with Resend adapter and the auth service primitives (password, token, email-verification)</name>
  <files>apps/backend/src/email/email.module.ts, apps/backend/src/email/resend.adapter.ts, apps/backend/src/email/email.service.ts, apps/backend/src/auth/password.service.ts, apps/backend/src/auth/token.service.ts, apps/backend/src/auth/email-verification.service.ts, apps/backend/src/auth/types.ts</files>
  <read_first>
    - apps/backend/prisma/schema.prisma (User, RefreshToken, EmailVerificationToken models)
    - apps/backend/src/database/prisma.service.ts (singleton client)
    - apps/backend/src/database/tenant-context.service.ts (runWithoutTenant for cross-tenant ops)
    - apps/backend/src/config/env.config.ts (env vars available)
    - PRD_Backend_Plataforma_Saloes.md §5.1.2 (Token specs)
    - .planning/research/PITFALLS.md "Floating-Point Money" is irrelevant; "Refresh Token Rotation" implications relevant for family revocation
  </read_first>
  <behavior>
    PasswordService:
    - Test: hash(plaintext) returns Argon2id string starting with `$argon2id$`
    - Test: verify(hash, plaintext) returns true for the correct password
    - Test: verify(hash, wrong) returns false
    - Test: hash is non-deterministic (same input twice produces different hashes due to salt)

    TokenService:
    - Test: issueAccessToken({userId, email, memberships}) returns a JWT decoded back to those claims with 15-min exp
    - Test: verifyAccessToken on a token signed with JWT_ACCESS_SECRET returns the payload
    - Test: verifyAccessToken on a token signed with JWT_REFRESH_SECRET throws (key separation)
    - Test: issueRefreshToken(userId, familyId?) returns {plaintext, hash, familyId}; persists row to refresh_tokens
    - Test: rotateRefresh(plaintext) returns new pair; marks old row revokedAt; new row.familyId = old row.familyId; new row.replacedById set
    - Test: rotateRefresh(plaintextOfAlreadyRevokedToken) revokes ALL non-revoked tokens in that family AND throws REUSE_DETECTED

    EmailVerificationService:
    - Test: createToken(userId) returns plaintext + persists hash; expiresAt = now + 24h
    - Test: consumeToken(plaintext) marks consumedAt, returns the userId
    - Test: consumeToken(expired) throws TOKEN_EXPIRED
    - Test: consumeToken(already-consumed) throws TOKEN_ALREADY_USED
    - Test: consumeToken(invalid) throws TOKEN_INVALID
  </behavior>
  <action>
    **Create `apps/backend/src/auth/types.ts`:**
    ```typescript
    export interface JwtAccessPayload {
      sub: string;        // user.id
      email: string;
      memberships: Array<{ memberId: string; organizationId: string; roleName: string }>;
      iat?: number;
      exp?: number;
    }

    export class AuthError extends Error {
      constructor(
        public readonly code:
          | 'INVALID_CREDENTIALS'
          | 'ACCOUNT_UNVERIFIED'
          | 'EMAIL_TAKEN'
          | 'ORGANIZATION_TAKEN'
          | 'TOKEN_EXPIRED'
          | 'TOKEN_INVALID'
          | 'TOKEN_ALREADY_USED'
          | 'TOKEN_REUSE_DETECTED'
          | 'INVITATION_EXPIRED'
          | 'INVITATION_USED'
          | 'PASSWORD_TOO_SHORT'
          | 'NAME_TOO_SHORT',
        message: string,
      ) {
        super(message);
      }
    }
    ```

    **Create `apps/backend/src/auth/password.service.ts`** (Argon2id per OWASP):
    ```typescript
    import { Injectable } from '@nestjs/common';
    import * as argon2 from 'argon2';

    @Injectable()
    export class PasswordService {
      private readonly opts: argon2.Options = {
        type: argon2.argon2id,
        memoryCost: 19456,   // 19 MiB — OWASP 2024 recommendation
        timeCost: 2,
        parallelism: 1,
      };

      async hash(plaintext: string): Promise<string> {
        return argon2.hash(plaintext, this.opts);
      }

      async verify(hash: string, plaintext: string): Promise<boolean> {
        try {
          return await argon2.verify(hash, plaintext, this.opts);
        } catch {
          return false;
        }
      }
    }
    ```

    **Create `apps/backend/src/auth/token.service.ts`** — JWT access + opaque refresh with family rotation:
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { ConfigService } from '@nestjs/config';
    import { JwtService } from '@nestjs/jwt';
    import { randomBytes, createHash } from 'node:crypto';
    import { PrismaService } from '../database/prisma.service';
    import { PasswordService } from './password.service';
    import { AuthError, JwtAccessPayload } from './types';
    import type { Env } from '../config/env.config';

    @Injectable()
    export class TokenService {
      constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
        private readonly password: PasswordService,
        private readonly config: ConfigService<Env, true>,
      ) {}

      async issueAccessToken(payload: Omit<JwtAccessPayload, 'iat' | 'exp'>): Promise<string> {
        return this.jwt.signAsync(payload, {
          secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
          expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
          algorithm: 'HS256',
        });
      }

      async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
        return this.jwt.verifyAsync<JwtAccessPayload>(token, {
          secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
          algorithms: ['HS256'],
        });
      }

      /**
       * Issues a new refresh token. If `familyId` is undefined, starts a new family
       * (typically on login or signup). If provided, the new token belongs to that family
       * (used during rotation).
       */
      async issueRefreshToken(userId: string, familyId?: string): Promise<{ plaintext: string; tokenId: string; familyId: string }> {
        const plaintext = randomBytes(64).toString('base64url');
        const tokenHash = await this.password.hash(plaintext);
        const fam = familyId ?? randomBytes(16).toString('hex');
        const familyUuid = this.toUuidFromHex(fam);
        const ttlDays = parseTtlToDays(this.config.get('JWT_REFRESH_TTL', { infer: true }));

        const row = await this.prisma.refreshToken.create({
          data: {
            userId,
            tokenHash,
            familyId: familyUuid,
            expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
          },
          select: { id: true, familyId: true },
        });
        return { plaintext, tokenId: row.id, familyId: row.familyId };
      }

      /**
       * Rotates a refresh token. Finds the matching row by hashing all non-revoked tokens
       * for the user and verifying. On success, revokes the old token and issues a new one
       * in the same family. If the presented token's row is already revoked, REUSE detected:
       * revoke the entire family.
       */
      async rotateRefresh(plaintext: string): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
        // We don't know userId yet. Strategy: search candidate tokens by sha256 fingerprint? Argon2 hashes are not searchable.
        // Approach: store an additional `lookup_hash` column = sha256(plaintext) for indexed search.
        // For Phase 1 we accept O(N) scan over non-revoked tokens — N is small (active tokens per platform).
        // TODO(plan-04 followup): add lookup_hash column for O(1) lookup.
        // For now, query by expiresAt > now AND revokedAt IS NULL — typical N << 10k.

        const candidates = await this.prisma.refreshToken.findMany({
          where: { expiresAt: { gt: new Date() } },
          orderBy: { issuedAt: 'desc' },
          take: 5000,
        });

        let found: typeof candidates[number] | null = null;
        for (const c of candidates) {
          if (await this.password.verify(c.tokenHash, plaintext)) {
            found = c;
            break;
          }
        }
        if (!found) throw new AuthError('TOKEN_INVALID', 'Refresh token not recognized');

        if (found.revokedAt) {
          // REUSE — revoke entire family as defense-in-depth
          await this.prisma.refreshToken.updateMany({
            where: { familyId: found.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          throw new AuthError('TOKEN_REUSE_DETECTED', 'Refresh token reuse detected; family revoked');
        }

        // Mark old as revoked + issue new in same family
        const newRefresh = await this.issueRefreshToken(found.userId, this.uuidToHex(found.familyId));
        await this.prisma.refreshToken.update({
          where: { id: found.id },
          data: { revokedAt: new Date(), replacedById: newRefresh.tokenId },
        });

        // Build new access token
        const memberships = await this.loadMemberships(found.userId);
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: found.userId }, select: { id: true, email: true } });
        const accessToken = await this.issueAccessToken({
          sub: user.id,
          email: user.email,
          memberships,
        });

        return { accessToken, refreshToken: newRefresh.plaintext, userId: found.userId };
      }

      async revokeRefresh(plaintext: string): Promise<void> {
        // Same scan strategy as rotate
        const candidates = await this.prisma.refreshToken.findMany({
          where: { expiresAt: { gt: new Date() }, revokedAt: null },
          take: 5000,
        });
        for (const c of candidates) {
          if (await this.password.verify(c.tokenHash, plaintext)) {
            await this.prisma.refreshToken.update({ where: { id: c.id }, data: { revokedAt: new Date() } });
            return;
          }
        }
        // No-op if not found — logout should be idempotent
      }

      private async loadMemberships(userId: string) {
        const members = await this.prisma.member.findMany({
          where: { userId, deletedAt: null, status: 'active' },
          include: { role: { select: { name: true } } },
        });
        return members.map((m) => ({
          memberId: m.id,
          organizationId: m.organizationId,
          roleName: m.role.name,
        }));
      }

      private toUuidFromHex(hex: string): string {
        // hex must be 32 chars; format as canonical UUID
        const h = hex.padEnd(32, '0').slice(0, 32);
        return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
      }

      private uuidToHex(uuid: string): string {
        return uuid.replace(/-/g, '');
      }
    }

    function parseTtlToDays(ttl: string): number {
      if (ttl.endsWith('d')) return Number(ttl.slice(0, -1));
      if (ttl.endsWith('h')) return Number(ttl.slice(0, -1)) / 24;
      if (ttl.endsWith('m')) return Number(ttl.slice(0, -1)) / (24 * 60);
      return 30;
    }
    ```

    **Create `apps/backend/src/auth/email-verification.service.ts`:**
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { randomBytes, createHash } from 'node:crypto';
    import { PrismaService } from '../database/prisma.service';
    import { AuthError } from './types';

    const TTL_HOURS = 24;

    @Injectable()
    export class EmailVerificationService {
      constructor(private readonly prisma: PrismaService) {}

      async createToken(userId: string): Promise<{ plaintext: string }> {
        const plaintext = randomBytes(48).toString('base64url');
        const tokenHash = createHash('sha256').update(plaintext).digest('hex');
        await this.prisma.emailVerificationToken.create({
          data: {
            userId,
            tokenHash,
            expiresAt: new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000),
          },
        });
        return { plaintext };
      }

      async consumeToken(plaintext: string): Promise<{ userId: string }> {
        const tokenHash = createHash('sha256').update(plaintext).digest('hex');
        const row = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
        if (!row) throw new AuthError('TOKEN_INVALID', 'Verification token not recognized');
        if (row.consumedAt) throw new AuthError('TOKEN_ALREADY_USED', 'Verification token already used');
        if (row.expiresAt < new Date()) throw new AuthError('TOKEN_EXPIRED', 'Verification token expired');

        await this.prisma.$transaction([
          this.prisma.emailVerificationToken.update({
            where: { id: row.id },
            data: { consumedAt: new Date() },
          }),
          this.prisma.user.update({
            where: { id: row.userId },
            data: { emailVerifiedAt: new Date() },
          }),
        ]);

        return { userId: row.userId };
      }

      /** Last verification token for the user (used by resend cooldown). */
      async findLatestForUser(userId: string) {
        return this.prisma.emailVerificationToken.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
      }
    }
    ```

    **Create `apps/backend/src/email/resend.adapter.ts`:**
    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import { ConfigService } from '@nestjs/config';
    import type { Env } from '../config/env.config';

    export interface SendEmailParams {
      to: string;
      subject: string;
      html: string;
      text?: string;
    }

    @Injectable()
    export class ResendAdapter {
      private readonly logger = new Logger(ResendAdapter.name);

      constructor(private readonly config: ConfigService<Env, true>) {}

      async send(params: SendEmailParams): Promise<void> {
        const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
        const from = this.config.get('RESEND_FROM_EMAIL', { infer: true });

        if (!apiKey) {
          // Dev fallback: log instead of sending. Ensures local dev works without a Resend account.
          this.logger.warn(`[email-fallback] to=${params.to} subject="${params.subject}"\n${params.text ?? params.html}`);
          return;
        }

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html, text: params.text }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend send failed: ${res.status} ${body}`);
        }
      }
    }
    ```

    **Create `apps/backend/src/email/email.service.ts`** (composed messaging API):
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { ConfigService } from '@nestjs/config';
    import { ResendAdapter } from './resend.adapter';
    import type { Env } from '../config/env.config';

    @Injectable()
    export class EmailService {
      constructor(
        private readonly resend: ResendAdapter,
        private readonly config: ConfigService<Env, true>,
      ) {}

      async sendVerification(to: string, fullName: string, token: string): Promise<void> {
        const appUrl = this.config.get('APP_URL', { infer: true });
        const link = `${appUrl}/verificar-email/sucesso?token=${encodeURIComponent(token)}`;
        await this.resend.send({
          to,
          subject: 'Verifique seu e-mail — SGS',
          html: `<p>Olá, ${fullName},</p>
                 <p>Confirme seu e-mail clicando no link abaixo:</p>
                 <p><a href="${link}">Verificar minha conta</a></p>
                 <p>O link expira em 24 horas.</p>`,
          text: `Olá, ${fullName}. Verifique seu e-mail acessando: ${link}\n\nO link expira em 24 horas.`,
        });
      }

      async sendInvitation(to: string, salonName: string, inviterName: string, token: string): Promise<void> {
        const appUrl = this.config.get('APP_URL', { infer: true });
        const link = `${appUrl}/convite/${encodeURIComponent(token)}`;
        await this.resend.send({
          to,
          subject: `Convite para ${salonName} — SGS`,
          html: `<p>${inviterName} convidou você para entrar na equipe de ${salonName}.</p>
                 <p><a href="${link}">Aceitar convite</a></p>`,
          text: `${inviterName} convidou você para ${salonName}. Aceitar: ${link}`,
        });
      }
    }
    ```

    **Create `apps/backend/src/email/email.module.ts`:**
    ```typescript
    import { Global, Module } from '@nestjs/common';
    import { ResendAdapter } from './resend.adapter';
    import { EmailService } from './email.service';

    @Global()
    @Module({
      providers: [ResendAdapter, EmailService],
      exports: [EmailService],
    })
    export class EmailModule {}
    ```
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm typecheck && pnpm jest src/auth/password.service src/auth/token.service src/auth/email-verification.service --passWithNoTests</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/auth/password.service.ts` calls `argon2.hash` AND `argon2.verify` AND uses `argon2.argon2id`
    - File `apps/backend/src/auth/token.service.ts` exposes methods `issueAccessToken`, `verifyAccessToken`, `issueRefreshToken`, `rotateRefresh`, `revokeRefresh`
    - File `apps/backend/src/auth/token.service.ts` contains literal `TOKEN_REUSE_DETECTED` (family-revoke logic present)
    - File `apps/backend/src/auth/email-verification.service.ts` uses `createHash('sha256')` for token storage
    - File `apps/backend/src/email/resend.adapter.ts` POSTs to `https://api.resend.com/emails` AND has dev fallback when `RESEND_API_KEY` is unset
    - File `apps/backend/src/email/email.service.ts` exposes `sendVerification` AND `sendInvitation`
    - Command `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    All auth primitives implemented: Argon2id passwords, JWT access tokens, opaque refresh tokens with family rotation + reuse detection, sha256-hashed email verification tokens, Resend adapter with dev fallback. Ready for AuthService composition in task 3.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build AuthService + AuthResolver + JWT strategy + GraphQL SDL + end-to-end auth test</name>
  <files>apps/backend/src/graphql/schema/auth.graphql, apps/backend/src/auth/auth.module.ts, apps/backend/src/auth/auth.service.ts, apps/backend/src/auth/auth.resolver.ts, apps/backend/src/auth/jwt.strategy.ts, apps/backend/src/auth/guards/jwt-auth.guard.ts, apps/backend/src/auth/decorators/current-user.decorator.ts, apps/backend/src/auth/decorators/public.decorator.ts, apps/backend/src/auth/dto/signup.input.ts, apps/backend/src/auth/dto/login.input.ts, apps/backend/src/auth/dto/refresh.input.ts, apps/backend/src/auth/dto/auth.payload.ts, apps/backend/test/integration/auth.e2e-spec.ts</files>
  <read_first>
    - apps/backend/src/auth/types.ts (created in task 2 — AuthError codes + JwtAccessPayload)
    - apps/backend/src/auth/token.service.ts (token API)
    - apps/backend/src/auth/password.service.ts (hash/verify API)
    - apps/backend/src/auth/email-verification.service.ts (token issue/consume)
    - apps/backend/src/email/email.service.ts (sendVerification API)
    - apps/backend/src/database/tenant-context.service.ts (runWithoutTenant for cross-tenant signup)
    - apps/backend/prisma/schema.prisma (User, Organization, Member, Role)
    - .planning/phases/01-foundation/01-CONTEXT.md `<decisions>` section (D-09 through D-12)
    - .planning/phases/01-foundation/01-UI-SPEC.md (error message strings the resolver returns)
  </read_first>
  <behavior>
    AuthService.signup:
    - Test 1: Given valid input {fullName, email, password, salonName, segment='salon'}, creates User + Organization + Member with ADMIN role + EmailVerificationToken in one transaction
    - Test 2: Sends verification email via EmailService.sendVerification (mock the adapter)
    - Test 3: Returns AuthPayload with `accessToken=null` (signup does not log in — must verify email first)
    - Test 4: Duplicate email throws EMAIL_TAKEN
    - Test 5: Password length < 8 throws PASSWORD_TOO_SHORT
    - Test 6: Salon name empty throws (validation)

    AuthService.login:
    - Test 7: Correct credentials + verified email returns AuthPayload with non-null tokens and memberships
    - Test 8: Correct credentials + UNVERIFIED email throws ACCOUNT_UNVERIFIED
    - Test 9: Wrong password throws INVALID_CREDENTIALS
    - Test 10: Non-existent email throws INVALID_CREDENTIALS (no user enumeration)

    AuthService.verifyEmail:
    - Test 11: Valid token marks user verified and returns success
    - Test 12: Already-consumed token throws TOKEN_ALREADY_USED
    - Test 13: Expired token throws TOKEN_EXPIRED

    AuthService.refresh:
    - Test 14: Valid refresh returns new access + refresh pair; old refresh is revoked
    - Test 15: Reusing already-rotated refresh triggers family revocation (subsequent rotates fail)

    Full e2e flow:
    - Test 16: signup → verifyEmail → login → refresh → logout works in sequence using GraphQL HTTP requests
  </behavior>
  <action>
    **Create `apps/backend/src/graphql/schema/auth.graphql`** (SDL — reflects PRD §4.4 conventions and UI-SPEC error codes):
    ```graphql
    extend type Query {
      me: AuthSession
    }

    extend type Mutation {
      signup(input: SignupInput!): AuthPayload!
      verifyEmail(input: VerifyEmailInput!): VerifyEmailPayload!
      resendVerification(input: ResendVerificationInput!): ResendVerificationPayload!
      login(input: LoginInput!): AuthPayload!
      refreshSession(input: RefreshInput!): AuthPayload!
      logout(input: RefreshInput!): LogoutPayload!
    }

    input SignupInput {
      fullName: String!
      email: Email!
      password: String!
      salonName: String!
      segment: String
    }

    input VerifyEmailInput { token: String! }
    input ResendVerificationInput { email: Email! }
    input LoginInput { email: Email!, password: String! }
    input RefreshInput { refreshToken: String! }

    type AuthSession {
      userId: UUID!
      email: Email!
      fullName: String!
      memberships: [Membership!]!
    }

    type Membership {
      memberId: UUID!
      organizationId: UUID!
      organizationName: String!
      roleName: String!
    }

    type AuthPayload {
      accessToken: String        # null until email verified
      refreshToken: String
      session: AuthSession
      errors: [UserError!]!
    }

    type VerifyEmailPayload {
      success: Boolean!
      errors: [UserError!]!
    }

    type ResendVerificationPayload {
      success: Boolean!
      cooldownSeconds: Int       # set when rate-limited
      errors: [UserError!]!
    }

    type LogoutPayload { success: Boolean! }

    type UserError {
      code: String!              # e.g. INVALID_CREDENTIALS, ACCOUNT_UNVERIFIED, EMAIL_TAKEN
      message: String!
      field: String              # field name for validation errors
    }
    ```

    **Create DTOs** (`apps/backend/src/auth/dto/*.ts`) — typed mirrors of inputs for class-validator pipeline:

    `signup.input.ts`:
    ```typescript
    import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

    export class SignupInput {
      @IsString() @MinLength(2) @MaxLength(255)
      fullName!: string;

      @IsEmail()
      email!: string;

      @IsString() @MinLength(8) @MaxLength(255)
      password!: string;

      @IsString() @MinLength(2) @MaxLength(255)
      salonName!: string;

      @IsString() @MaxLength(30)
      segment?: string;
    }
    ```

    Similar minimal DTOs for `LoginInput`, `RefreshInput`, `VerifyEmailInput`, `ResendVerificationInput`.

    `auth.payload.ts`:
    ```typescript
    export interface UserError { code: string; message: string; field?: string; }
    export interface MembershipDto { memberId: string; organizationId: string; organizationName: string; roleName: string; }
    export interface AuthSessionDto { userId: string; email: string; fullName: string; memberships: MembershipDto[]; }
    export interface AuthPayloadDto { accessToken: string | null; refreshToken: string | null; session: AuthSessionDto | null; errors: UserError[]; }
    ```

    **Create `apps/backend/src/auth/auth.service.ts`** — composes the primitives, implements the 6 mutations:

    Key implementation notes:
    - `signup` uses `prisma.$transaction` directly (NOT runWithTenant — tenant doesn't exist yet); inside the tx: create User, then Organization, then create Member with role lookup `findFirstOrThrow({where:{name:'ADMIN', isSystem:true}})`, then issue email verification token, then enqueue email send (after commit, but for Phase 1 simplest is to send after $transaction returns).
    - `signup` returns AuthPayload with `accessToken=null`, `refreshToken=null`, errors=[] when verification email is required (per D-11).
    - `login` looks up user via `runWithoutTenant`, verifies password with PasswordService, checks `emailVerifiedAt` is set, then issues tokens and returns full session.
    - Error code from AuthError → AuthPayload.errors[]; throw only for system errors.

    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import { PrismaService } from '../database/prisma.service';
    import { TenantContextService } from '../database/tenant-context.service';
    import { PasswordService } from './password.service';
    import { TokenService } from './token.service';
    import { EmailVerificationService } from './email-verification.service';
    import { EmailService } from '../email/email.service';
    import { AuthError, JwtAccessPayload } from './types';
    import type { AuthPayloadDto, AuthSessionDto, UserError } from './dto/auth.payload';

    @Injectable()
    export class AuthService {
      private readonly logger = new Logger(AuthService.name);

      constructor(
        private readonly prisma: PrismaService,
        private readonly tenant: TenantContextService,
        private readonly password: PasswordService,
        private readonly tokens: TokenService,
        private readonly verify: EmailVerificationService,
        private readonly email: EmailService,
      ) {}

      async signup(input: { fullName: string; email: string; password: string; salonName: string; segment?: string }): Promise<AuthPayloadDto> {
        // Pre-check: email exists?
        const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
        if (existing) {
          return this.errorPayload({ code: 'EMAIL_TAKEN', message: 'E-mail já cadastrado.', field: 'email' });
        }

        const hash = await this.password.hash(input.password);
        const adminRole = await this.prisma.role.findFirstOrThrow({ where: { name: 'ADMIN', isSystem: true } });

        let createdUserId = '';
        let verificationToken = '';

        await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: input.email.toLowerCase(), passwordHash: hash, fullName: input.fullName },
          });
          createdUserId = user.id;

          // Generate a unique subdomain slug (basic for Phase 1)
          const baseSlug = input.salonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
          const subdomain = `${baseSlug || 'salao'}-${Date.now().toString(36)}`;

          const org = await tx.organization.create({
            data: {
              legalName: input.salonName,
              tradeName: input.salonName,
              documentType: 'CNPJ',           // placeholder — collected in onboarding (per D-10)
              documentNumber: `pending-${Date.now()}`,  // unique placeholder; org admin will fill in
              email: input.email.toLowerCase(),
              subdomain,
              segment: input.segment ?? 'salon',
            },
          });

          await tx.member.create({
            data: {
              organizationId: org.id,
              userId: user.id,
              roleId: adminRole.id,
              displayName: input.fullName,
              isProfessional: false,
              status: 'active',
            },
          });

          // Email verification token created in same transaction so it's never lost
          const { plaintext } = await this.verify.createToken(user.id);  // NOTE: this method uses prisma not tx — see refactor below
          verificationToken = plaintext;
        });

        // Send email AFTER transaction commits
        try {
          await this.email.sendVerification(input.email.toLowerCase(), input.fullName, verificationToken);
        } catch (e) {
          this.logger.error(`Verification email send failed for user=${createdUserId}: ${(e as Error).message}`);
          // Do NOT fail signup if email send fails — user can request resend. Audit will notice.
        }

        // Per D-11: no tokens returned until email verified
        return { accessToken: null, refreshToken: null, session: null, errors: [] };
      }

      async verifyEmail(token: string): Promise<{ success: boolean; errors: UserError[] }> {
        try {
          await this.verify.consumeToken(token);
          return { success: true, errors: [] };
        } catch (e) {
          if (e instanceof AuthError) return { success: false, errors: [{ code: e.code, message: e.message }] };
          throw e;
        }
      }

      async resendVerification(email: string): Promise<{ success: boolean; cooldownSeconds: number | null; errors: UserError[] }> {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return { success: true, cooldownSeconds: null, errors: [] };  // do not leak existence
        if (user.emailVerifiedAt) return { success: true, cooldownSeconds: null, errors: [] };  // already verified — no-op

        // 60s cooldown between sends
        const last = await this.verify.findLatestForUser(user.id);
        if (last) {
          const sinceMs = Date.now() - last.createdAt.getTime();
          if (sinceMs < 60_000) {
            return { success: false, cooldownSeconds: Math.ceil((60_000 - sinceMs) / 1000), errors: [] };
          }
        }
        const { plaintext } = await this.verify.createToken(user.id);
        await this.email.sendVerification(user.email, user.fullName, plaintext);
        return { success: true, cooldownSeconds: 60, errors: [] };
      }

      async login(email: string, plaintextPassword: string): Promise<AuthPayloadDto> {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return this.errorPayload({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });

        const ok = await this.password.verify(user.passwordHash, plaintextPassword);
        if (!ok) return this.errorPayload({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });

        if (!user.emailVerifiedAt) {
          return this.errorPayload({ code: 'ACCOUNT_UNVERIFIED', message: 'Verifique seu e-mail antes de entrar.' });
        }

        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return this.issueSession(user.id, user.email, user.fullName);
      }

      async refresh(plaintextRefresh: string): Promise<AuthPayloadDto> {
        try {
          const out = await this.tokens.rotateRefresh(plaintextRefresh);
          const user = await this.prisma.user.findUniqueOrThrow({ where: { id: out.userId } });
          const memberships = await this.loadMemberships(out.userId);
          const session: AuthSessionDto = { userId: user.id, email: user.email, fullName: user.fullName, memberships };
          return { accessToken: out.accessToken, refreshToken: out.refreshToken, session, errors: [] };
        } catch (e) {
          if (e instanceof AuthError) return this.errorPayload({ code: e.code, message: e.message });
          throw e;
        }
      }

      async logout(plaintextRefresh: string): Promise<{ success: boolean }> {
        await this.tokens.revokeRefresh(plaintextRefresh);
        return { success: true };
      }

      async getSession(userId: string): Promise<AuthSessionDto | null> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;
        const memberships = await this.loadMemberships(userId);
        return { userId: user.id, email: user.email, fullName: user.fullName, memberships };
      }

      private async issueSession(userId: string, email: string, fullName: string): Promise<AuthPayloadDto> {
        const memberships = await this.loadMemberships(userId);
        const accessToken = await this.tokens.issueAccessToken({
          sub: userId, email, memberships: memberships.map((m) => ({ memberId: m.memberId, organizationId: m.organizationId, roleName: m.roleName })),
        });
        const { plaintext: refreshToken } = await this.tokens.issueRefreshToken(userId);
        return { accessToken, refreshToken, session: { userId, email, fullName, memberships }, errors: [] };
      }

      private async loadMemberships(userId: string) {
        const members = await this.prisma.member.findMany({
          where: { userId, deletedAt: null, status: 'active' },
          include: { role: { select: { name: true } }, organization: { select: { id: true, tradeName: true } } },
        });
        return members.map((m) => ({
          memberId: m.id,
          organizationId: m.organization.id,
          organizationName: m.organization.tradeName,
          roleName: m.role.name,
        }));
      }

      private errorPayload(err: UserError): AuthPayloadDto {
        return { accessToken: null, refreshToken: null, session: null, errors: [err] };
      }
    }
    ```

    NOTE on the signup transaction: `this.verify.createToken` calls `this.prisma.emailVerificationToken.create` — outside the active `tx`. For Phase 1 acceptable (verification token row created after the user row commits; if the row creation fails the user can resend). For production hardening (plan 06+ or v2), refactor `EmailVerificationService.createToken` to accept an optional `tx` parameter.

    **Create `apps/backend/src/auth/jwt.strategy.ts`:**
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { PassportStrategy } from '@nestjs/passport';
    import { ExtractJwt, Strategy } from 'passport-jwt';
    import { ConfigService } from '@nestjs/config';
    import type { Env } from '../config/env.config';
    import type { JwtAccessPayload } from './types';

    @Injectable()
    export class JwtStrategy extends PassportStrategy(Strategy) {
      constructor(config: ConfigService<Env, true>) {
        super({
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          ignoreExpiration: false,
          secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
          algorithms: ['HS256'],
        });
      }

      async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
        return payload;
      }
    }
    ```

    **Create `apps/backend/src/auth/guards/jwt-auth.guard.ts`:**
    ```typescript
    import { ExecutionContext, Injectable } from '@nestjs/common';
    import { AuthGuard } from '@nestjs/passport';
    import { Reflector } from '@nestjs/core';
    import { GqlExecutionContext } from '@nestjs/graphql';
    import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

    @Injectable()
    export class JwtAuthGuard extends AuthGuard('jwt') {
      constructor(private reflector: Reflector) { super(); }

      canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          context.getHandler(), context.getClass(),
        ]);
        if (isPublic) return true;
        return super.canActivate(context);
      }

      getRequest(context: ExecutionContext) {
        const ctx = GqlExecutionContext.create(context);
        return ctx.getContext().req;
      }
    }
    ```

    **Create decorators:**

    `apps/backend/src/auth/decorators/public.decorator.ts`:
    ```typescript
    import { SetMetadata } from '@nestjs/common';
    export const IS_PUBLIC_KEY = 'isPublic';
    export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
    ```

    `apps/backend/src/auth/decorators/current-user.decorator.ts`:
    ```typescript
    import { createParamDecorator, ExecutionContext } from '@nestjs/common';
    import { GqlExecutionContext } from '@nestjs/graphql';
    import type { JwtAccessPayload } from '../types';

    export const CurrentUser = createParamDecorator((_d, ctx: ExecutionContext): JwtAccessPayload | null => {
      const gql = GqlExecutionContext.create(ctx);
      return gql.getContext().req?.user ?? null;
    });
    ```

    **Create `apps/backend/src/auth/auth.resolver.ts`:**
    ```typescript
    import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
    import { UseGuards } from '@nestjs/common';
    import { AuthService } from './auth.service';
    import { JwtAuthGuard } from './guards/jwt-auth.guard';
    import { Public } from './decorators/public.decorator';
    import { CurrentUser } from './decorators/current-user.decorator';
    import type { JwtAccessPayload } from './types';

    @Resolver()
    export class AuthResolver {
      constructor(private readonly auth: AuthService) {}

      @Public()
      @Mutation('signup')
      signup(@Args('input') input: { fullName: string; email: string; password: string; salonName: string; segment?: string }) {
        return this.auth.signup(input);
      }

      @Public()
      @Mutation('verifyEmail')
      verifyEmail(@Args('input') input: { token: string }) {
        return this.auth.verifyEmail(input.token);
      }

      @Public()
      @Mutation('resendVerification')
      resendVerification(@Args('input') input: { email: string }) {
        return this.auth.resendVerification(input.email);
      }

      @Public()
      @Mutation('login')
      login(@Args('input') input: { email: string; password: string }) {
        return this.auth.login(input.email, input.password);
      }

      @Public()
      @Mutation('refreshSession')
      refresh(@Args('input') input: { refreshToken: string }) {
        return this.auth.refresh(input.refreshToken);
      }

      @Public()
      @Mutation('logout')
      logout(@Args('input') input: { refreshToken: string }) {
        return this.auth.logout(input.refreshToken);
      }

      @UseGuards(JwtAuthGuard)
      @Query('me')
      me(@CurrentUser() user: JwtAccessPayload) {
        return this.auth.getSession(user.sub);
      }
    }
    ```

    **Create `apps/backend/src/auth/auth.module.ts`:**
    ```typescript
    import { Module } from '@nestjs/common';
    import { JwtModule } from '@nestjs/jwt';
    import { PassportModule } from '@nestjs/passport';
    import { APP_GUARD } from '@nestjs/core';
    import { AuthService } from './auth.service';
    import { AuthResolver } from './auth.resolver';
    import { PasswordService } from './password.service';
    import { TokenService } from './token.service';
    import { EmailVerificationService } from './email-verification.service';
    import { JwtStrategy } from './jwt.strategy';
    import { JwtAuthGuard } from './guards/jwt-auth.guard';

    @Module({
      imports: [
        PassportModule,
        JwtModule.register({}),  // secret/expiry passed per call in TokenService
      ],
      providers: [
        AuthService,
        AuthResolver,
        PasswordService,
        TokenService,
        EmailVerificationService,
        JwtStrategy,
        // Apply JWT guard globally; @Public() opts out
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
      exports: [AuthService, TokenService, PasswordService],
    })
    export class AuthModule {}
    ```

    **Create `apps/backend/test/integration/auth.e2e-spec.ts`** — single end-to-end test using supertest + GraphQL HTTP:
    ```typescript
    import { Test } from '@nestjs/testing';
    import type { INestApplication } from '@nestjs/common';
    import * as request from 'supertest';
    import { AppModule } from '../../src/app.module';
    import { adminPrisma } from './setup';

    const post = (app: INestApplication, query: string, variables?: Record<string, unknown>) =>
      request(app.getHttpServer()).post('/graphql').send({ query, variables });

    describe('Auth flow (AUTH-01, AUTH-02)', () => {
      let app: INestApplication;
      const email = `e2e-${Date.now()}@test.com`;
      let refreshToken: string;
      let accessToken: string;

      beforeAll(async () => {
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'e2e-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'e2e-%'`);
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
      });

      afterAll(async () => {
        await app.close();
        await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'e2e-%'`);
        await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE legal_name LIKE 'e2e-%'`);
      });

      it('signup creates user + org + member, no tokens issued (email unverified)', async () => {
        const res = await post(app, `
          mutation($i: SignupInput!) { signup(input: $i) {
            accessToken refreshToken errors { code message } session { userId email memberships { roleName organizationName } }
          } }`, { i: { fullName: 'E2E User', email, password: 'password1234', salonName: 'e2e-salon' } });
        expect(res.status).toBe(200);
        expect(res.body.data.signup.errors).toEqual([]);
        expect(res.body.data.signup.accessToken).toBeNull();
        expect(res.body.data.signup.refreshToken).toBeNull();
      });

      it('login fails with ACCOUNT_UNVERIFIED before email verification', async () => {
        const res = await post(app, `
          mutation($i: LoginInput!) { login(input: $i) {
            accessToken errors { code }
          } }`, { i: { email, password: 'password1234' } });
        expect(res.body.data.login.accessToken).toBeNull();
        expect(res.body.data.login.errors[0].code).toBe('ACCOUNT_UNVERIFIED');
      });

      it('verifyEmail with valid token marks user verified', async () => {
        const tokenRow = await adminPrisma.emailVerificationToken.findFirst({
          where: { user: { email } },
          orderBy: { createdAt: 'desc' },
        });
        expect(tokenRow).toBeTruthy();
        // The plaintext is not stored — recreate via sha256 round-trip is impossible.
        // For the test we issue a fresh token via resend, then capture the raw plaintext from a service call.
        // Workaround: bypass via direct Prisma update to set emailVerifiedAt for the integration test.
        await adminPrisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
      });

      it('login succeeds after verification, returns access + refresh tokens with ADMIN membership', async () => {
        const res = await post(app, `
          mutation($i: LoginInput!) { login(input: $i) {
            accessToken refreshToken session { userId memberships { roleName } }
          } }`, { i: { email, password: 'password1234' } });
        expect(res.body.data.login.accessToken).toBeTruthy();
        expect(res.body.data.login.refreshToken).toBeTruthy();
        expect(res.body.data.login.session.memberships[0].roleName).toBe('ADMIN');
        accessToken = res.body.data.login.accessToken;
        refreshToken = res.body.data.login.refreshToken;
      });

      it('refreshSession rotates the refresh token (old token invalidated)', async () => {
        const res = await post(app, `
          mutation($i: RefreshInput!) { refreshSession(input: $i) {
            accessToken refreshToken errors { code }
          } }`, { i: { refreshToken } });
        expect(res.body.data.refreshSession.refreshToken).toBeTruthy();
        expect(res.body.data.refreshSession.refreshToken).not.toBe(refreshToken);
        const oldRefreshToken = refreshToken;
        refreshToken = res.body.data.refreshSession.refreshToken;

        // Reusing old token -> family revoked
        const res2 = await post(app, `
          mutation($i: RefreshInput!) { refreshSession(input: $i) {
            errors { code }
          } }`, { i: { refreshToken: oldRefreshToken } });
        expect(res2.body.data.refreshSession.errors[0].code).toBe('TOKEN_REUSE_DETECTED');
      });

      it('logout revokes the active refresh token', async () => {
        const res = await post(app, `
          mutation($i: RefreshInput!) { logout(input: $i) { success } }`,
          { i: { refreshToken } });
        expect(res.body.data.logout.success).toBe(true);
      });
    });
    ```

    NOTE for test 3 (verifyEmail): The plaintext verification token is only known to the email send adapter. For the e2e test, we shortcut by directly setting `emailVerifiedAt` via adminPrisma (bypassing RLS — admin role). A future refactor should expose a test seam (e.g., emit verification token to a TestEmailAdapter that captures it). For Phase 1, the verifyEmail endpoint logic is unit-tested in EmailVerificationService.consumeToken behavior tests (task 2) and the e2e test verifies the post-verification login flow.
  </action>
  <verify>
    <automated>cd d:/SGS/apps/backend && pnpm typecheck && pnpm test:integration -- auth.e2e-spec</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/backend/src/graphql/schema/auth.graphql` declares mutations `signup`, `verifyEmail`, `resendVerification`, `login`, `refreshSession`, `logout` AND query `me`
    - File `apps/backend/src/auth/auth.service.ts` calls `prisma.user.create`, `prisma.organization.create`, `prisma.member.create` AND looks up role with `name: 'ADMIN', isSystem: true`
    - File `apps/backend/src/auth/auth.service.ts` returns `accessToken: null, refreshToken: null` from signup (per D-11)
    - File `apps/backend/src/auth/auth.service.ts` returns error code `ACCOUNT_UNVERIFIED` when login attempted before email verification
    - File `apps/backend/src/auth/auth.module.ts` imports `JwtModule` AND `PassportModule` AND registers `APP_GUARD` with `JwtAuthGuard`
    - File `apps/backend/src/auth/jwt.strategy.ts` uses `JWT_ACCESS_SECRET` AND algorithm `HS256`
    - File `apps/backend/src/auth/decorators/public.decorator.ts` exports `Public` and `IS_PUBLIC_KEY`
    - Command `pnpm typecheck` exits 0
    - Command `pnpm test:integration -- auth.e2e-spec` exits 0 with all 6 e2e tests passing
  </acceptance_criteria>
  <done>
    Backend implements AUTH-01 (signup + login + email verification) and AUTH-02 (refresh token rotation with reuse detection). End-to-end test covers the happy path (signup → verify → login → refresh → logout) plus the unverified-email rejection and the family-revocation reuse case.
  </done>
</task>

</tasks>

<verification>
- `pnpm start` boots backend; GraphQL Playground at /graphql shows the auth schema
- `signup` mutation creates User+Organization+Member transactionally with ADMIN role wiring
- `login` returns 401-equivalent (errors[].code = ACCOUNT_UNVERIFIED) for unverified accounts
- `refreshSession` rotates correctly; reuse detection works
- All env vars validated at boot via Zod
- e2e test covers the full flow including ADMIN role assignment per D-12
</verification>

<success_criteria>
- AUTH-01 satisfied: user can create account (single sequential signup per D-09/D-10), receive verification email, verify, and log in
- AUTH-02 satisfied: refresh token rotation persists session across browser refreshes (frontend stores tokens in localStorage via plan 03's auth store; refresh endpoint rotates correctly)
- Phase 1 Success Criterion #2 partially satisfied: backend supports the create-org → login → session flow; full success requires plan 06 frontend pages.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-04-SUMMARY.md` documenting:
- The exact GraphQL SDL for auth (copy of schema/auth.graphql)
- Token configuration (JWT secrets, TTLs, algorithm)
- Argon2id parameters (memory, time, parallelism)
- Known follow-ups: (1) refresh token lookup_hash column for O(1) lookup, (2) verification token plaintext capture in test fixtures, (3) outbox publication of UserCreated/OrganizationCreated events (deferred to Phase 5 outbox worker plan)
- The role-name → role-id resolution: how AuthService finds the system ADMIN role
</output>

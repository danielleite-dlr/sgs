---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 02
type: execute
wave: 2
depends_on: ["07-01"]
files_modified:
  - apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/graphql/schema/device-tokens.graphql
  - apps/backend/src/push/device-tokens.service.ts
  - apps/backend/src/push/device-tokens.service.spec.ts
  - apps/backend/src/push/device-tokens.resolver.ts
  - apps/backend/src/push/push.module.ts
  - apps/backend/src/app.module.ts
  - apps/backend/test/integration/device-tokens.e2e.spec.ts
  - apps/backend/test/integration/helpers/phase3-cleanup.ts
  - packages/shared/src/generated/graphql.ts
  - packages/shared/src/index.ts
autonomous: true
requirements: [C-03, C-06]

must_haves:
  truths:
    - "Existe a tabela device_tokens com RLS ENABLE + FORCE e política tenant_isolation; uma organização não vê tokens de outra"
    - "Qualquer papel do salão (admin, gerente, atendente, profissional) registra o token do próprio aparelho com registerDeviceToken (permissão notification.read, D-18)"
    - "Registrar o mesmo token com outra usuária do mesmo salão move o token para ela (aparelho compartilhado não avisa a anterior)"
    - "unregisterDeviceToken apaga só o token da própria usuária"
    - "Sessão de platform admin dentro do salão (impersonating) não grava token (decisão do orquestrador nº 3)"
    - "O backend não depende do Capacitor: provider 'fcm' cobre Capacitor e o futuro Expo (D-04)"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql"
      provides: "Tabela device_tokens + RLS"
      contains: "FORCE ROW LEVEL SECURITY"
    - path: "apps/backend/src/push/device-tokens.service.ts"
      provides: "DeviceTokensService.register/unregister"
      exports: ["DeviceTokensService"]
    - path: "apps/backend/src/graphql/schema/device-tokens.graphql"
      provides: "registerDeviceToken / unregisterDeviceToken"
      contains: "registerDeviceToken(input: RegisterDeviceTokenInput!): Boolean!"
    - path: "apps/backend/test/integration/device-tokens.e2e.spec.ts"
      provides: "RLS + upsert + unregister + RBAC dos 4 papéis"
  key_links:
    - from: "apps/backend/src/push/device-tokens.resolver.ts"
      to: "PERMISSIONS.NOTIFICATION_READ"
      via: "@RequirePermission"
      pattern: "RequirePermission\\(PERMISSIONS\\.NOTIFICATION_READ\\)"
    - from: "apps/backend/src/app.module.ts"
      to: "PushModule"
      via: "imports"
      pattern: "PushModule"
---

<objective>
Criar o registro neutro de tokens de aparelho no backend (D-04): tabela `device_tokens` com RLS, model Prisma, SDL e resolver `registerDeviceToken`/`unregisterDeviceToken`, `PushModule` inicial e a suíte de integração com Postgres real.

Purpose: base do push (C-03). O app Capacitor e o futuro Expo registram o mesmo token FCM aqui.
Output: migration, model, módulo/serviço/resolver, testes unitários e de integração, tipos gerados no `packages/shared`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-01-SUMMARY.md

**Ambiente de execução:** igual ao 07-01 (nvm 22, `.env` linha a linha, `corepack pnpm`, sem push/deploy no meio da fase). Backend formatado com o prettier do pacote: `corepack pnpm --filter @sgs/backend exec prettier --write <arquivos novos>`.

**Colisão com a 04.2:** `schema.prisma` foi alterado pela 04.2 (`PackageTimelineStep`, `BridalTimeline`). Ler o arquivo ATUAL e só acrescentar o model novo e as relações; não reordenar nada. A migration nova tem timestamp `20261120000000`, posterior às da 04.2 (`20261114000000_bridal_timeline`, `20261114010000_seed_studio_js_timeline`); se `ls apps/backend/prisma/migrations | tail -3` mostrar alguma migration com nome maior que `20261120000000`, usar o timestamp seguinte a ela.

<interfaces>
Padrões existentes:
```ts
// apps/backend/src/authz/decorators/current-tenant.decorator.ts
export interface TenantContext { organizationId: string; memberId: string; roleName: string }
export const CurrentTenant: ParamDecorator;
// apps/backend/src/authz/decorators/require-permission.decorator.ts → RequirePermission(...perms)
// apps/backend/src/authz/permissions.catalog.ts → PERMISSIONS.NOTIFICATION_READ = 'notification.read' (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL já têm)
// apps/backend/src/database/tenant-context.service.ts → runWithTenant(orgId, (tx) => ..., opts?)
// apps/backend/src/auth/types.ts → JwtAccessPayload { sub, impersonating?: boolean, memberships: [...] }
// GraphQL context: gql.getContext().req.user é o JwtAccessPayload (tenant-context.middleware.ts)
// Integração: test/integration/helpers/phase3-fixtures.ts → createPhase3World(prefix), destroyPhase3World(w), gqlAs(w, token)
//   w.members { admin, manager, attendant, proA, proB }, w.tokens { admin, manager, attendant, proA, proB, otherAdmin }, w.orgId, w.otherOrgId, w.app
// test/integration/setup.ts → adminPrisma (BYPASSRLS), appPrisma
```
Contrato que este plano CRIA (07-07 e 07-08 consomem):
```ts
// apps/backend/src/push/device-tokens.service.ts
export interface RegisterDeviceTokenInput { token: string; platform: string; provider?: string | null; appVersion?: string | null }
@Injectable() export class DeviceTokensService {
  register(orgId: string, memberId: string, input: RegisterDeviceTokenInput): Promise<boolean>;
  unregister(orgId: string, memberId: string, token: string): Promise<boolean>;
}
export function validateDeviceTokenInput(input: RegisterDeviceTokenInput): { field: string; message: string } | null; // cópia local de packages/shared/src/validation.ts (mesmas mensagens)
// apps/backend/src/push/push.module.ts → export class PushModule {} (07-07 acrescenta fila, processor e @Global)
// Prisma: tx.deviceToken { id, organizationId, memberId, provider, platform, token, appVersion, lastSeenAt, createdAt }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration device_tokens com RLS e model Prisma DeviceToken</name>
  <files>apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql, apps/backend/prisma/schema.prisma, apps/backend/test/integration/helpers/phase3-cleanup.ts</files>
  <read_first>
    - apps/backend/prisma/migrations/20261114000000_bridal_timeline/migration.sql (padrão de tabela, FKs nomeadas, RLS ENABLE+FORCE+tenant_isolation)
    - apps/backend/prisma/migrations/20261112000000_hard_delete_member_bridal/migration.sql (exclusão definitiva de membro: device_tokens precisa de ON DELETE CASCADE no member_id)
    - apps/backend/prisma/schema.prisma (model Member ~linha 131, model Organization ~linha 13, models da 04.2 como modelo de @map/@@map)
    - apps/backend/test/integration/helpers/phase3-cleanup.ts (lista de DELETE por organização)
  </read_first>
  <action>
1. `apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql`:
```sql
-- Fase 7: tokens de aparelho para push (FCM v1), neutros em relação ao app (Capacitor agora, Expo depois).
CREATE TABLE device_tokens (
  id              UUID          NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID          NOT NULL,
  member_id       UUID          NOT NULL,
  provider        VARCHAR(10)   NOT NULL DEFAULT 'fcm',
  platform        VARCHAR(10)   NOT NULL,
  token           TEXT          NOT NULL,
  app_version     VARCHAR(20)   NULL,
  last_seen_at    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_device_tokens PRIMARY KEY (id),
  CONSTRAINT fk_device_tokens_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_device_tokens_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT chk_device_tokens_provider CHECK (provider IN ('fcm','expo')),
  CONSTRAINT chk_device_tokens_platform CHECK (platform IN ('android','ios')),
  CONSTRAINT chk_device_tokens_token CHECK (char_length(token) BETWEEN 1 AND 4096)
);

CREATE UNIQUE INDEX uq_device_tokens_org_provider_token ON device_tokens (organization_id, provider, token);
CREATE INDEX ix_device_tokens_org_member ON device_tokens (organization_id, member_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON device_tokens
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
```
   (Grants a `sgs_app` vêm do `ALTER DEFAULT PRIVILEGES` da migration inicial; confirmar com `grep -rn "ALTER DEFAULT PRIVILEGES" apps/backend/prisma/migrations | head -3`. Se a 04.2 precisou de GRANT explícito, replicar.)
2. `schema.prisma`: novo model (seção `// ===== Device tokens (push) =====` logo após o model `Notification`):
```prisma
model DeviceToken {
  id             String   @id @default(dbgenerated("gen_uuid_v7()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  memberId       String   @map("member_id") @db.Uuid
  provider       String   @default("fcm") @db.VarChar(10)
  platform       String   @db.VarChar(10)
  token          String   @db.Text
  appVersion     String?  @map("app_version") @db.VarChar(20)
  lastSeenAt     DateTime @default(now()) @map("last_seen_at") @db.Timestamptz(6)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id])
  member       Member       @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([organizationId, provider, token], name: "uq_device_tokens_org_provider_token")
  @@index([organizationId, memberId], name: "ix_device_tokens_org_member")
  @@map("device_tokens")
}
```
   e as relações inversas `deviceTokens DeviceToken[]` em `Organization` e em `Member`.
3. Aplicar no Postgres local: `cd apps/backend && corepack pnpm prisma migrate deploy && corepack pnpm prisma:generate`. Conferir que `corepack pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$DIRECT_URL"` não mostra diferença de `device_tokens` (se o comando de diff não funcionar no ambiente, registrar no SUMMARY e seguir só com o `migrate deploy`).
4. `phase3-cleanup.ts`: incluir `` `DELETE FROM device_tokens WHERE ${org}` `` como PRIMEIRA linha da lista de DELETEs (o FK de organização não tem cascade).
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm prisma migrate deploy && corepack pnpm prisma:generate && corepack pnpm typecheck && psql "$DIRECT_URL" -Atc "select relrowsecurity, relforcerowsecurity from pg_class where relname='device_tokens'" | grep -x "t|t"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "FORCE ROW LEVEL SECURITY" apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql` = 1
    - `grep -n "ON DELETE CASCADE" apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql` encontra o FK de member_id
    - `grep -n '@@map("device_tokens")' apps/backend/prisma/schema.prisma` encontra a linha
    - `grep -n "deviceTokens *DeviceToken\[\]" apps/backend/prisma/schema.prisma` encontra 2 linhas (Organization e Member)
    - `grep -n "DELETE FROM device_tokens" apps/backend/test/integration/helpers/phase3-cleanup.ts` encontra a linha
    - `psql "$DIRECT_URL" -Atc "select relrowsecurity, relforcerowsecurity from pg_class where relname='device_tokens'"` imprime `t|t`
  </acceptance_criteria>
  <done>Tabela e model existem localmente com RLS forçada e cascade no membro.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: DeviceTokensService, resolver, SDL, PushModule e tipos gerados no shared</name>
  <files>apps/backend/src/graphql/schema/device-tokens.graphql, apps/backend/src/push/device-tokens.service.ts, apps/backend/src/push/device-tokens.service.spec.ts, apps/backend/src/push/device-tokens.resolver.ts, apps/backend/src/push/push.module.ts, apps/backend/src/app.module.ts, packages/shared/src/generated/graphql.ts, packages/shared/src/index.ts</files>
  <read_first>
    - apps/backend/src/catalog/notifications/notifications.resolver.ts (padrão de resolver com @CurrentTenant + @RequirePermission)
    - apps/backend/src/catalog/notifications/notifications.module.ts (imports DatabaseModule, AuthzModule)
    - apps/backend/src/graphql/schema/contract-alerts.graphql (padrão `extend type Mutation`)
    - apps/backend/src/authz/tenant-context.middleware.ts (onde fica `req.user`)
    - apps/backend/src/auth/types.ts (JwtAccessPayload.impersonating)
    - apps/backend/src/app.module.ts (lista de imports)
    - packages/shared/src/validation.ts e packages/shared/codegen.ts (do 07-01)
  </read_first>
  <behavior>
    - validateDeviceTokenInput: mesmos casos do shared (token vazio/4097 chars, platform 'web', provider 'apns', appVersion 21 chars → erro; válido → null)
    - register com input inválido lança BadRequestException com a mensagem pt-BR (o resolver devolve erro GraphQL)
    - register (tenant mockado): chama deleteMany({ where: { provider, token, memberId: { not: memberId } } }) ANTES do upsert por uq_device_tokens_org_provider_token, com update { memberId, platform, appVersion, lastSeenAt } e devolve true
    - unregister chama deleteMany({ where: { token, memberId } }) e devolve true
  </behavior>
  <action>
1. `apps/backend/src/graphql/schema/device-tokens.graphql`:
```graphql
"Token de push do aparelho (FCM). Neutro: serve ao app Capacitor e ao futuro app Expo."
input RegisterDeviceTokenInput {
  token: String!
  "android | ios"
  platform: String!
  "fcm (padrão) | expo (reservado)"
  provider: String
  appVersion: String
}

extend type Mutation {
  "Registra (ou move para a usuária atual) o token do aparelho. Sessão de admin de plataforma dentro do salão não registra e devolve false."
  registerDeviceToken(input: RegisterDeviceTokenInput!): Boolean!
  "Remove o token do aparelho da usuária atual (logout)."
  unregisterDeviceToken(token: String!): Boolean!
}
```
2. `device-tokens.service.ts`: `validateDeviceTokenInput` (cópia local das regras e mensagens do shared, comentário `// Cópia de packages/shared/src/validation.ts — Docker do staging não enxerga o workspace (07-RESEARCH Pitfall 1).`). `register`: valida (erro → `throw new BadRequestException(err.message)`), `provider = input.provider ?? 'fcm'`, dentro de `this.tenant.runWithTenant(orgId, async (tx) => { ... })`: `tx.deviceToken.deleteMany({ where: { provider, token, memberId: { not: memberId } } })`; `tx.deviceToken.upsert({ where: { uq_device_tokens_org_provider_token: { organizationId: orgId, provider, token } }, create: { organizationId: orgId, memberId, provider, platform, token, appVersion: input.appVersion ?? null }, update: { memberId, platform, appVersion: input.appVersion ?? null, lastSeenAt: new Date() } })`; retorna `true`. `unregister`: `token.trim()` vazio → `false`; senão `deleteMany({ where: { token, memberId } })` e `true`. NUNCA logar o token inteiro (se logar, só `…${token.slice(-6)}`).
3. `device-tokens.resolver.ts`:
```ts
@Resolver()
export class DeviceTokensResolver {
  constructor(private readonly tokens: DeviceTokensService) {}

  @Mutation('registerDeviceToken')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  register(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: RegisterDeviceTokenInput,
    @Context() ctx: { req?: { user?: JwtAccessPayload } },
  ): Promise<boolean> | boolean {
    // Admin de plataforma dentro do salão do cliente não recebe push do salão (decisão da fase 7).
    if (ctx.req?.user?.impersonating) return false;
    return this.tokens.register(t.organizationId, t.memberId, input);
  }

  @Mutation('unregisterDeviceToken')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  unregister(@CurrentTenant() t: TenantContext, @Args('token') token: string) {
    return this.tokens.unregister(t.organizationId, t.memberId, token);
  }
}
```
4. `push.module.ts`: `@Module({ imports: [DatabaseModule, AuthzModule], providers: [DeviceTokensService, DeviceTokensResolver], exports: [DeviceTokensService] }) export class PushModule {}`. Importar `PushModule` em `app.module.ts` logo depois de `ContractAlertsModule`.
5. `device-tokens.service.spec.ts`: testes do `<behavior>` com `tenant = { runWithTenant: jest.fn((_org, fn) => fn(tx)) }` e `tx.deviceToken = { deleteMany: jest.fn(), upsert: jest.fn() }`; conferir a ORDEM (deleteMany antes do upsert) via `mock.invocationCallOrder`.
6. Tipos gerados no shared: `corepack pnpm --filter @sgs/shared codegen` (gera `packages/shared/src/generated/graphql.ts` com `RegisterDeviceTokenMutation`, `RegisterDeviceTokenMutationVariables`, `UnregisterDeviceTokenMutation`); acrescentar `export * from './generated/graphql';` em `packages/shared/src/index.ts`; `corepack pnpm --filter @sgs/shared typecheck`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- device-tokens && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint && corepack pnpm --filter @sgs/shared typecheck && grep -n "RegisterDeviceTokenMutation" packages/shared/src/generated/graphql.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "registerDeviceToken(input: RegisterDeviceTokenInput!): Boolean!" apps/backend/src/graphql/schema/device-tokens.graphql` encontra a linha
    - `grep -c "RequirePermission(PERMISSIONS.NOTIFICATION_READ)" apps/backend/src/push/device-tokens.resolver.ts` = 2
    - `grep -n "impersonating" apps/backend/src/push/device-tokens.resolver.ts` encontra a checagem
    - `grep -n "PushModule" apps/backend/src/app.module.ts` encontra import e uso (2 linhas)
    - `grep -n "uq_device_tokens_org_provider_token" apps/backend/src/push/device-tokens.service.ts` encontra o upsert
    - `grep -n "RegisterDeviceTokenMutationVariables" packages/shared/src/generated/graphql.ts` encontra a linha
    - `corepack pnpm --filter @sgs/backend test -- device-tokens` sai 0
  </acceptance_criteria>
  <done>API de registro/remoção de token pronta, tipada e com teste unitário; shared com tipos gerados do SDL real.</done>
</task>

<task type="auto">
  <name>Task 3: Integração device-tokens (RLS, upsert entre membros, unregister, RBAC dos 4 papéis)</name>
  <files>apps/backend/test/integration/device-tokens.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase3-fixtures.ts (createPhase3World, gqlAs, tokens dos papéis)
    - apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts (padrão de teste RLS/RBAC)
    - apps/backend/test/integration/setup.ts (adminPrisma)
    - apps/backend/src/database/tenant-context.service.ts (runWithTenant para checar RLS pelo app)
  </read_first>
  <action>
Criar `device-tokens.e2e.spec.ts` com `w = await createPhase3World('p7devtok')` no `beforeAll` e, no `afterAll`, `await adminPrisma.$executeRawUnsafe("DELETE FROM device_tokens WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'p7devtok-%')")` seguido de `destroyPhase3World(w)`. Mutations: `const REG = 'mutation($input: RegisterDeviceTokenInput!) { registerDeviceToken(input: $input) }'` e `const UNREG = 'mutation($token: String!) { unregisterDeviceToken(token: $token) }'`. Casos (`it` separados):
1. RBAC: com `w.tokens.admin`, `manager`, `attendant`, `proA`, cada um registra `tok-p7-<papel>` (platform 'android') → `data.registerDeviceToken === true` e sem `errors`; `adminPrisma.deviceToken.count({ where: { organizationId: w.orgId } })` = 4.
2. Upsert move entre membros: proA registra `tok-p7-shared`; proB registra o MESMO token → `adminPrisma.deviceToken.findMany({ where: { token: 'tok-p7-shared' } })` tem 1 linha com `memberId === w.members.proB`.
3. Reregistro atualiza `lastSeenAt` (segunda chamada do mesmo membro → `lastSeenAt` maior que o da primeira) e não duplica.
4. RLS: `otherAdmin` registra `tok-p7-shared` na org B → 2 linhas no total (uma por org); `w.app.get(TenantContextService).runWithTenant(w.orgId, (tx) => tx.deviceToken.findMany({ where: { token: 'tok-p7-shared' } }))` devolve 1 linha, com `organizationId === w.orgId`.
5. unregister: proA chama UNREG com `tok-p7-shared` (que é do proB) → `true`, mas a linha do proB continua; proB chama UNREG → linha da org A some, a da org B fica.
6. Validação: platform 'web' → `errors[0].message` contém `Plataforma inválida.`; nada gravado.
7. Sem token de acesso → erro de autenticação (UNAUTHENTICATED/Forbidden, como os outros testes de RBAC do projeto).
Rodar a suíte inteira de integração depois (o cleanup novo não pode quebrar as outras).
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && corepack pnpm test:integration -- device-tokens</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "it(" apps/backend/test/integration/device-tokens.e2e.spec.ts` ≥ 7
    - `grep -n "runWithTenant(w.orgId" apps/backend/test/integration/device-tokens.e2e.spec.ts` encontra o teste de RLS
    - `corepack pnpm --filter @sgs/backend test:integration -- device-tokens` sai 0
    - `corepack pnpm --filter @sgs/backend test:integration` sai 0 (exceção documentada só `phase4-alerts-boot` por Redis NOAUTH local)
  </acceptance_criteria>
  <done>RLS, upsert, unregister e RBAC dos 4 papéis provados contra Postgres real.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/backend test -- device-tokens` e `test:integration -- device-tokens` verdes
- `corepack pnpm -r typecheck` verde (inclui shared com tipos gerados)
</verification>

<success_criteria>
Tokens de aparelho registrados de forma neutra e isolados por salão (D-04, D-18, C-03), prontos para o envio do 07-07.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-02-SUMMARY.md`
</output>

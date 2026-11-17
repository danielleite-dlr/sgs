---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/push/device-tokens.service.ts
  - apps/backend/src/push/device-tokens.service.spec.ts
  - apps/backend/src/graphql/schema/device-tokens.graphql
  - apps/backend/test/integration/device-tokens.e2e.spec.ts
  - packages/shared/src/validation.ts
  - packages/shared/src/__tests__/validation.test.ts
autonomous: true
requirements: [D-08]

must_haves:
  truths:
    - "registerDeviceToken aceita provider 'webpush' com platform 'ios', token = endpoint e as chaves p256dh/auth, e grava as chaves no registro do aparelho (D-08)"
    - "Endpoint fora de https://web.push.apple.com, com credencial na URL, porta, http ou maior que 2048 é recusado com BadRequest (anti-SSRF)"
    - "webpush sem p256dh/auth válidos é recusado; fcm continua funcionando igual (chaves ficam NULL)"
    - "A migration é aditiva: linhas fcm existentes continuam válidas, RLS da tabela não muda"
    - "unregisterDeviceToken(endpoint) apaga a inscrição da própria usuária"
  artifacts:
    - path: "apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql"
      provides: "Colunas p256dh/auth, CHECK com webpush e CHECK das chaves"
      contains: "chk_device_tokens_webpush_keys"
    - path: "apps/backend/src/push/device-tokens.service.ts"
      provides: "validateDeviceTokenInput com webpush e WEBPUSH_ALLOWED_HOSTS"
      exports: ["validateDeviceTokenInput", "DeviceTokensService", "WEBPUSH_ALLOWED_HOSTS"]
  key_links:
    - from: "apps/backend/src/push/device-tokens.service.ts"
      to: "tx.deviceToken.upsert"
      via: "create/update com p256dh e auth"
      pattern: "p256dh"
    - from: "apps/backend/src/graphql/schema/device-tokens.graphql"
      to: "RegisterDeviceTokenInput"
      via: "campos p256dh e auth"
      pattern: "p256dh: String"
---

<objective>
Preparar o registro do aparelho para o Web Push: migration aditiva em `device_tokens` (colunas `p256dh`/`auth`, provider `webpush`), validação do endpoint (anti-SSRF) e das chaves, e o `register` gravando a inscrição. Nada de envio ainda (fica no 08-04).

Purpose: D-08 — o iPhone usa o mesmo `device_tokens` da fase 7 (provider `webpush`, platform `ios`), com a inscrição guardada no registro do aparelho.
Output: migration, schema Prisma, serviço/contrato GraphQL atualizados, cópia da validação em `packages/shared`, testes unit e de integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-CONTEXT.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-02-SUMMARY.md

**Ambiente de execução (vale para todos os planos da fase 8):**
- Carregar o env linha a linha (o `.env` tem `&` sem aspas no `DATABASE_URL`; `source` quebra):
  `set -a; while IFS= read -r l; do [[ -z "$l" || "$l" == \#* ]] && continue; export "$l"; done < /root/sgs/.env; set +a`
- Banco LOCAL `sgs_dev` (postgres 5434 / pgbouncer 5433). NUNCA o staging (`sgs_stg_*`). Se estiver parado: `docker compose -p agent-a9563bd02b3c8c0f5 -f docker-compose.yml up -d --force-recreate --no-deps postgres pgbouncer`. Se a integração travar no boot, `docker exec sgs_valkey valkey-cli ping` primeiro.
- Backend: prettier do backend só nos arquivos tocados. Frontend: sem prettier (arquivos formatados à mão, aspas simples, ~100 colunas); nunca `prettier --write` em arquivo existente.
- Tudo em PT-BR (mensagens, comentários, commits).

<interfaces>
Estado atual (lido do código em 17/11/2026):

`apps/backend/src/push/device-tokens.service.ts`:
```ts
export interface RegisterDeviceTokenInput { token: string; platform: string; provider?: string | null; appVersion?: string | null; }
const DEVICE_PLATFORMS = ['android', 'ios'];
const PUSH_PROVIDERS = ['fcm', 'expo'];
const MAX_DEVICE_TOKEN_LENGTH = 4096;
const MAX_APP_VERSION_LENGTH = 20;
export function validateDeviceTokenInput(input): { field: string; message: string } | null;
export class DeviceTokensService {
  register(orgId, memberId, input): Promise<boolean>; // deleteMany (mesmo provider+token de outra usuária) + upsert por uq_device_tokens_org_provider_token
  unregister(orgId, memberId, token): Promise<boolean>; // deleteMany({ token, memberId }) — sem olhar provider
}
```
`schema.prisma` `model DeviceToken`: `provider String @default("fcm") @db.VarChar(10)`, `platform @db.VarChar(10)`, `token @db.Text`, `appVersion`, `lastSeenAt`, `createdAt`; `@@unique([organizationId, provider, token], name: "uq_device_tokens_org_provider_token")`.
Migration da fase 7 (`20261120000000_device_tokens`): `chk_device_tokens_provider CHECK (provider IN ('fcm','expo'))`, RLS forçada `tenant_isolation`.
`packages/shared/src/validation.ts`: `DEVICE_PLATFORMS`, `PUSH_PROVIDERS = ['fcm','expo'] as const`, `MAX_DEVICE_TOKEN_LENGTH`, `validateDeviceTokenInput` (espelho do backend).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migration aditiva e schema Prisma</name>
  <files>apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql, apps/backend/prisma/schema.prisma</files>
  <read_first>
    - apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql (nomes das constraints e estilo)
    - apps/backend/prisma/schema.prisma (model DeviceToken, linha ~571)
  </read_first>
  <action>
1. Criar `apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql` (SQL à mão, como a 20261120000000):
```sql
-- Fase 8: Web Push (VAPID) no iPhone. token = endpoint da inscrição; chaves em colunas próprias.
-- Aditiva: linhas fcm existentes ficam com p256dh/auth NULL. RLS da tabela não muda.
ALTER TABLE device_tokens
  ADD COLUMN p256dh VARCHAR(255) NULL,
  ADD COLUMN auth   VARCHAR(255) NULL;

ALTER TABLE device_tokens DROP CONSTRAINT chk_device_tokens_provider;
ALTER TABLE device_tokens ADD CONSTRAINT chk_device_tokens_provider
  CHECK (provider IN ('fcm','expo','webpush'));
ALTER TABLE device_tokens ADD CONSTRAINT chk_device_tokens_webpush_keys
  CHECK (provider <> 'webpush' OR (p256dh IS NOT NULL AND auth IS NOT NULL));
```
   Conferir antes no SQL da fase 7 o nome exato da constraint de provider; se for outro, usar o nome real no `DROP`.
2. `schema.prisma`, no `model DeviceToken`, depois de `appVersion`: `p256dh String? @db.VarChar(255)` e `auth String? @db.VarChar(255)` (nomes de coluna iguais, sem `@map`).
3. Com o env local carregado: `cd /root/sgs/apps/backend && corepack pnpm prisma generate && corepack pnpm prisma:migrate:deploy` (conferir antes que `DIRECT_URL` aponta para `localhost:5434`).
4. Commit `feat(08-01): device_tokens aceita inscrição webpush`.
  </action>
  <verify>
    <automated>cd /root/sgs && docker exec sgs_postgres psql -U sgs_migrator -d sgs_dev -Atc "select column_name from information_schema.columns where table_name='device_tokens' and column_name in ('p256dh','auth') order by 1" | tr '\n' ' ' | grep -x "auth p256dh "</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "chk_device_tokens_webpush_keys" apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql` = 1
    - `grep -n "'webpush'" apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql` encontra o CHECK do provider
    - `grep -n "p256dh *String? *@db.VarChar(255)" apps/backend/prisma/schema.prisma` encontra a linha
    - no banco local, `select conname from pg_constraint where conname='chk_device_tokens_webpush_keys'` devolve 1 linha
    - `corepack pnpm --filter @sgs/backend typecheck` sai 0
  </acceptance_criteria>
  <done>Tabela local com as colunas novas e o provider webpush permitido; client Prisma regenerado.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Validação do endpoint e das chaves, register com inscrição e contrato GraphQL</name>
  <files>apps/backend/src/push/device-tokens.service.ts, apps/backend/src/push/device-tokens.service.spec.ts, apps/backend/src/graphql/schema/device-tokens.graphql, apps/backend/test/integration/device-tokens.e2e.spec.ts, packages/shared/src/validation.ts, packages/shared/src/__tests__/validation.test.ts</files>
  <read_first>
    - apps/backend/src/push/device-tokens.service.ts
    - apps/backend/src/push/device-tokens.service.spec.ts
    - apps/backend/src/graphql/schema/device-tokens.graphql
    - apps/backend/test/integration/device-tokens.e2e.spec.ts (fixtures, helper gqlAs, padrão dos casos)
    - packages/shared/src/validation.ts e packages/shared/src/__tests__/validation.test.ts
  </read_first>
  <behavior>
    - fcm/android sem chaves → válido (igual à fase 7)
    - webpush/ios com `https://web.push.apple.com/QK...` + p256dh de 87 chars base64url + auth de 22 chars → válido
    - webpush com `http://web.push.apple.com/x` → `{ field: 'token' }`
    - webpush com `https://127.0.0.1/x`, `https://evil.com/x`, `https://web.push.apple.com.evil.com/x`, `https://user:pw@web.push.apple.com/x`, `https://web.push.apple.com:8443/x`, endpoint de 2049 chars, texto que não é URL → `{ field: 'token' }`
    - webpush com platform 'android' → `{ field: 'platform' }`
    - webpush sem p256dh, sem auth, p256dh com 86 chars, auth com caractere `+` → `{ field: 'p256dh' }` ou `{ field: 'auth' }`
    - integração: register webpush grava p256dh/auth; repetir com outra usuária do mesmo salão move a linha; outra org não vê (RLS); endpoint fora da lista volta erro e não grava; unregister(endpoint) apaga só a da própria usuária; uma linha fcm criada antes continua lá
  </behavior>
  <action>
1. `device-tokens.service.ts`:
   - `RegisterDeviceTokenInput` ganha `p256dh?: string | null; auth?: string | null;`.
   - `const PUSH_PROVIDERS = ['fcm', 'expo', 'webpush'];`
   - `export const WEBPUSH_ALLOWED_HOSTS = ['web.push.apple.com'];` com comentário: "Único lugar da lista. Estender (ex.: fcm.googleapis.com) só se houver Web Push fora do iPhone."
   - `const MAX_WEBPUSH_ENDPOINT_LENGTH = 2048; const P256DH_RE = /^[A-Za-z0-9_-]{87}=?$/; const AUTH_RE = /^[A-Za-z0-9_-]{22}(==)?$/;`
   - Em `validateDeviceTokenInput`, depois das checagens atuais e só quando `(input.provider ?? 'fcm') === 'webpush'`: `platform !== 'ios'` → `{ field: 'platform', message: 'Plataforma inválida.' }`; endpoint: `token.length > 2048` ou `new URL()` lança ou `protocol !== 'https:'` ou `username`/`password` não vazios ou `port !== ''` ou `!WEBPUSH_ALLOWED_HOSTS.includes(url.hostname.toLowerCase())` → `{ field: 'token', message: 'Inscrição de notificação inválida.' }`; `!P256DH_RE.test(p256dh ?? '')` → `{ field: 'p256dh', message: 'Chaves da inscrição inválidas.' }`; `!AUTH_RE.test(auth ?? '')` → `{ field: 'auth', message: 'Chaves da inscrição inválidas.' }`.
   - `register`: `const keys = provider === 'webpush' ? { p256dh: input.p256dh!, auth: input.auth! } : { p256dh: null, auth: null };` e espalhar `...keys` no `create` e no `update` do upsert. O `deleteMany` de outra usuária fica como está.
   - `unregister` não muda (já apaga por `token + memberId`).
2. `device-tokens.graphql`: comentário do tipo passa a "Token de push do aparelho (FCM) ou inscrição Web Push (iPhone)."; `token: String!` com descrição "FCM: token; webpush: endpoint da inscrição"; `provider` com descrição "fcm (padrão) | expo (reservado) | webpush"; acrescentar `"Web Push: chave p256dh da inscrição (base64url)" p256dh: String` e `"Web Push: chave auth da inscrição (base64url)" auth: String`.
3. `packages/shared/src/validation.ts`: mesma regra (é a fonte espelhada): `PUSH_PROVIDERS = ['fcm', 'expo', 'webpush'] as const`, `WEBPUSH_ALLOWED_HOSTS`, as regex e o bloco webpush; tipo de entrada com `p256dh`/`auth` opcionais. Casos novos em `__tests__/validation.test.ts` (os mesmos do `<behavior>`).
4. `device-tokens.service.spec.ts`: casos unit do `<behavior>` (fixtures: endpoint `https://web.push.apple.com/QKfake-endpoint-p8`, p256dh = `'B' + 'a'.repeat(86)`, auth = `'c'.repeat(22)`).
5. `device-tokens.e2e.spec.ts`: novo `describe('Fase 8 - inscrição webpush', ...)` com os casos de integração do `<behavior>` usando o helper existente e `adminPrisma.deviceToken.findMany` para conferir `p256dh`/`auth`.
6. Rodar com o env local: `corepack pnpm --filter @sgs/backend test -- device-tokens`, `corepack pnpm --filter @sgs/shared test`, `corepack pnpm --filter @sgs/backend test:integration -- device-tokens`, `corepack pnpm --filter @sgs/backend lint`, `corepack pnpm --filter @sgs/backend typecheck`.
7. Commit `feat(08-01): registro de inscrição webpush com validação do endpoint`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- device-tokens && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/backend test:integration -- device-tokens</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "WEBPUSH_ALLOWED_HOSTS = \['web.push.apple.com'\]" apps/backend/src/push/device-tokens.service.ts` encontra a linha
    - `grep -n "'webpush'" packages/shared/src/validation.ts` encontra `PUSH_PROVIDERS`
    - `grep -c "p256dh: String" apps/backend/src/graphql/schema/device-tokens.graphql` = 1 e `grep -c "auth: String" apps/backend/src/graphql/schema/device-tokens.graphql` = 1
    - `grep -n "127.0.0.1" apps/backend/src/push/device-tokens.service.spec.ts` encontra o caso SSRF
    - `grep -n "Fase 8 - inscrição webpush" apps/backend/test/integration/device-tokens.e2e.spec.ts` encontra o describe
    - os três comandos do `<verify>` saem 0; `corepack pnpm --filter @sgs/backend lint` sai 0
  </acceptance_criteria>
  <done>Inscrição Web Push registrável com segurança; FCM intacto; contrato e cópia em shared alinhados.</done>
</task>

</tasks>

<verification>
Migration aplicada no banco local, unit e integração de device tokens verdes, shared verde, typecheck e lint do backend verdes.
</verification>

<success_criteria>
Um iPhone autenticado consegue registrar a inscrição Web Push no mesmo `device_tokens` do Android (D-08), e o servidor não aceita endpoints fora do serviço da Apple.
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-01-SUMMARY.md`
</output>

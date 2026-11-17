---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/package.json
  - pnpm-lock.yaml
  - apps/backend/src/config/env.schema.ts
  - apps/backend/src/config/app-config.service.ts
  - apps/backend/src/push/web-push-credentials.ts
  - apps/backend/src/push/web-push-credentials.spec.ts
  - apps/backend/src/push/push-config.resolver.ts
  - apps/backend/src/push/push-config.resolver.spec.ts
  - apps/backend/src/graphql/schema/push-config.graphql
  - apps/backend/src/push/push.module.ts
  - apps/backend/test/integration/push-config.e2e.spec.ts
  - docker-compose.staging.yml
  - .env.example
  - .env.staging.example
  - packages/shared/src/graphql/push-config.ts
  - packages/shared/src/index.ts
autonomous: true
requirements: [D-10]

must_haves:
  truths:
    - "Sem VAPID_* (ou com só parte delas, ou com valor malformado) o backend sobe normal e o canal Web Push fica desligado (D-10)"
    - "A query pushConfig { webPushPublicKey } devolve a chave pública quando as três variáveis são válidas e null quando não são; exige login e permissão NOTIFICATION_READ"
    - "A chave privada VAPID nunca aparece em log, resposta GraphQL ou arquivo versionado"
    - "web-push está fixo em 3.6.7 (CommonJS) e @types/web-push em 3.6.4; nada de 4.x"
  artifacts:
    - path: "apps/backend/src/push/web-push-credentials.ts"
      provides: "parseVapidDetails (nunca lança)"
      exports: ["parseVapidDetails", "VapidDetails"]
    - path: "apps/backend/src/push/push-config.resolver.ts"
      provides: "Query pushConfig"
      contains: "@Query('pushConfig')"
    - path: "apps/backend/src/graphql/schema/push-config.graphql"
      provides: "type PushConfig e Query pushConfig"
      contains: "webPushPublicKey: String"
  key_links:
    - from: "apps/backend/src/push/push-config.resolver.ts"
      to: "AppConfigService.vapid"
      via: "injeção"
      pattern: "config\\.vapid"
    - from: "docker-compose.staging.yml"
      to: ".env.staging"
      via: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no bloco do backend"
      pattern: "VAPID_PRIVATE_KEY: \\$\\{VAPID_PRIVATE_KEY:-\\}"
---

<objective>
Configuração do canal Web Push: dependência `web-push@3.6.7`, variáveis VAPID no schema de env e no compose do staging, leitura segura das chaves e a query autenticada `pushConfig` que entrega a chave pública ao frontend.

Purpose: D-10 — chaves no env, canal desligado sem derrubar o boot, chave pública chegando ao frontend por query (o build do frontend no staging não tem variáveis de ambiente).
Output: credenciais VAPID, query `pushConfig`, compose/env de exemplo, specs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-CONTEXT.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-RESEARCH.md

**Ambiente de execução:** igual ao 08-01 (env carregado linha a linha, banco local, PT-BR).

<interfaces>
`apps/backend/src/config/env.schema.ts` (padrão a copiar, linha ~95):
```ts
FCM_SERVICE_ACCOUNT_JSON: z.string().optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined))
  .describe('...'),
PUSH_NOTIFICATIONS_WORKER: z.enum(['true','false']).default('true').transform((v) => v === 'true'),
```
`apps/backend/src/config/app-config.service.ts`:
```ts
get fcmServiceAccount(): FcmServiceAccount | null { return parseFcmServiceAccount(this.config.get('FCM_SERVICE_ACCOUNT_JSON', { infer: true })); }
```
`apps/backend/src/push/device-tokens.resolver.ts` (padrão de resolver/permissão):
```ts
@Resolver() ... @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
```
`push.module.ts`: `providers: [DeviceTokensService, DeviceTokensResolver, PushEventsService, PushService, { provide: PUSH_PROVIDER, ... }, ...workerProviders]`.
GraphQL: `typePaths: [join(__dirname, '..', '**', '*.graphql')]` — arquivo novo em `src/graphql/schema/` entra sozinho; usar `extend type Query`.
`docker-compose.staging.yml` linhas 134-135 (bloco backend): `FCM_SERVICE_ACCOUNT_JSON: ${FCM_SERVICE_ACCOUNT_JSON:-}` / `PUSH_NOTIFICATIONS_WORKER: ${PUSH_NOTIFICATIONS_WORKER:-true}`.
`.env.example:61-62` e `.env.staging.example:58-59`: `FCM_SERVICE_ACCOUNT_JSON=` / `PUSH_NOTIFICATIONS_WORKER=true`.
`packages/shared/src/index.ts`: `export * from './push'; export * from './validation'; export * from './graphql/device-tokens'; export * from './generated/graphql';`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dependência web-push 3.6.7, env VAPID e parseVapidDetails</name>
  <files>apps/backend/package.json, pnpm-lock.yaml, apps/backend/src/config/env.schema.ts, apps/backend/src/config/app-config.service.ts, apps/backend/src/push/web-push-credentials.ts, apps/backend/src/push/web-push-credentials.spec.ts, docker-compose.staging.yml, .env.example, .env.staging.example</files>
  <read_first>
    - apps/backend/src/config/env.schema.ts
    - apps/backend/src/config/app-config.service.ts
    - apps/backend/src/push/fcm-credentials.ts (padrão "nunca lança")
    - docker-compose.staging.yml (bloco do backend)
    - .env.example e .env.staging.example (bloco da fase 7)
  </read_first>
  <behavior>
    - três chaves válidas (geradas por `webpush.generateVAPIDKeys()`) + subject `https://sgs.jessicaseixasmakeup.com.br` → `{ publicKey, privateKey, subject }`
    - subject `mailto:suporte@exemplo.com.br` → válido
    - qualquer uma ausente/vazia → `null`
    - publicKey com 86 chars ou caractere fora de base64url → `null`; privateKey fora de 43 chars → `null`
    - subject `https://localhost`, `mailto:` vazio, `http://x.com`, `ftp://x` → `null`
    - nunca lança (entrada `undefined` em tudo → `null`)
  </behavior>
  <action>
1. Instalar fixo (a 4.0.0 é ESM-only, sem tipos, quebra CommonJS/jest): `cd /root/sgs && corepack pnpm --filter @sgs/backend add web-push@3.6.7 --save-exact && corepack pnpm --filter @sgs/backend add -D @types/web-push@3.6.4 --save-exact`. Conferir em `apps/backend/package.json` `"web-push": "3.6.7"` (sem `^`) e `node -e "require('/root/sgs/apps/backend/node_modules/web-push')"` sem erro.
2. `env.schema.ts`, logo depois de `PUSH_NOTIFICATIONS_WORKER`, comentário `// Fase 8 — Web Push (VAPID) no iPhone. Faltando qualquer uma => canal desligado, backend sobe normal.` e três campos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, todos `z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined))` com `.describe('Chave pública VAPID (base64url)')`, `.describe('Chave privada VAPID (base64url) — segredo')`, `.describe('Assunto VAPID: https://… ou mailto:…')`.
3. Criar `apps/backend/src/push/web-push-credentials.ts`:
```ts
export interface VapidDetails { publicKey: string; privateKey: string; subject: string; }
const PUBLIC_RE = /^[A-Za-z0-9_-]{87}$/;
const PRIVATE_RE = /^[A-Za-z0-9_-]{43}$/;
/** Lê as chaves VAPID do env. Nunca lança; qualquer problema => null (canal desligado). */
export function parseVapidDetails(raw: { publicKey?: string; privateKey?: string; subject?: string }): VapidDetails | null
```
   Regras: as três presentes; regex acima; subject começa com `https://` ou `mailto:` e tem algo depois (`mailto:` precisa de `@`), e não contém `localhost` nem `127.0.0.1` (a Apple recusa). Tudo dentro de `try/catch` devolvendo `null`.
4. `app-config.service.ts`: `get vapid(): VapidDetails | null { return parseVapidDetails({ publicKey: this.config.get('VAPID_PUBLIC_KEY', { infer: true }), privateKey: this.config.get('VAPID_PRIVATE_KEY', { infer: true }), subject: this.config.get('VAPID_SUBJECT', { infer: true }) }); }` (import de `../push/web-push-credentials`).
5. `web-push-credentials.spec.ts`: casos do `<behavior>`, gerando as chaves com `import * as webpush from 'web-push'; webpush.generateVAPIDKeys()`.
6. `docker-compose.staging.yml`, bloco `environment` do backend, depois de `PUSH_NOTIFICATIONS_WORKER`: `VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:-}`, `VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY:-}`, `VAPID_SUBJECT: ${VAPID_SUBJECT:-}`.
7. `.env.example` e `.env.staging.example`, depois de `PUSH_NOTIFICATIONS_WORKER=true`: comentário `# Fase 8 — Web Push (iPhone). Gerar uma vez: node -e "console.log(require('web-push').generateVAPIDKeys())" dentro de apps/backend. Não trocar depois: invalida as inscrições.` e `VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=`, `VAPID_SUBJECT=` vazios (NUNCA valores reais nesses arquivos).
8. `corepack pnpm --filter @sgs/backend test -- web-push-credentials && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint`. Commit `feat(08-02): chaves VAPID no env e web-push 3.6.7`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- web-push-credentials && grep -n '"web-push": "3.6.7"' apps/backend/package.json && grep -n '"@types/web-push": "3.6.4"' apps/backend/package.json</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '"web-push": "3.6.7"' apps/backend/package.json` encontra (sem `^`)
    - `grep -c "VAPID_" apps/backend/src/config/env.schema.ts` ≥ 3
    - `grep -n "VAPID_PRIVATE_KEY: \${VAPID_PRIVATE_KEY:-}" docker-compose.staging.yml` encontra a linha
    - `grep -E "^VAPID_PRIVATE_KEY=.+" .env.example .env.staging.example` sai vazio (sem valor real)
    - `grep -n "get vapid()" apps/backend/src/config/app-config.service.ts` encontra
    - spec `web-push-credentials` verde; typecheck e lint do backend saem 0
  </acceptance_criteria>
  <done>Backend sabe ler as chaves VAPID com segurança e tem a lib certa instalada.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Query pushConfig e documento espelhado em packages/shared</name>
  <files>apps/backend/src/push/push-config.resolver.ts, apps/backend/src/push/push-config.resolver.spec.ts, apps/backend/src/graphql/schema/push-config.graphql, apps/backend/src/push/push.module.ts, apps/backend/test/integration/push-config.e2e.spec.ts, packages/shared/src/graphql/push-config.ts, packages/shared/src/index.ts</files>
  <read_first>
    - apps/backend/src/push/device-tokens.resolver.ts
    - apps/backend/src/push/push.module.ts
    - apps/backend/test/integration/device-tokens.e2e.spec.ts (como montar o mundo e chamar GraphQL com e sem login)
    - apps/backend/test/integration/phase2-modules-boot.spec.ts (boot sem VAPID não pode quebrar)
    - packages/shared/src/graphql/device-tokens.ts e packages/shared/src/index.ts
  </read_first>
  <behavior>
    - unit: resolver com `config.vapid` = null → `{ webPushPublicKey: null }`; com VapidDetails → `{ webPushPublicKey: publicKey }`; a resposta nunca tem `privateKey`/`subject`
    - integração (env local sem VAPID): usuária logada recebe `{ pushConfig: { webPushPublicKey: null } }`; sem token volta erro de autenticação (não 500)
  </behavior>
  <action>
1. `apps/backend/src/graphql/schema/push-config.graphql`:
```graphql
"Configuração pública do push para o app web (Fase 8)."
type PushConfig {
  "Chave pública VAPID (base64url) ou null quando o Web Push está desligado no servidor."
  webPushPublicKey: String
}

extend type Query {
  "Configuração pública do push. Exige login."
  pushConfig: PushConfig!
}
```
2. `push-config.resolver.ts`:
```ts
@Resolver()
export class PushConfigResolver {
  constructor(private readonly config: AppConfigService) {}
  @Query('pushConfig')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  pushConfig(): { webPushPublicKey: string | null } {
    return { webPushPublicKey: this.config.vapid?.publicKey ?? null };
  }
}
```
   (import `Query, Resolver` de `@nestjs/graphql`; conferir se o `AppConfigService` é global/exportado onde o `PushModule` enxerga — o factory do `PUSH_PROVIDER` já injeta, então está disponível.)
3. `push.module.ts`: acrescentar `PushConfigResolver` em `providers` (só isso neste plano; o provider Web Push entra no 08-04).
4. `push-config.resolver.spec.ts`: casos unit do `<behavior>` com `AppConfigService` falso (`{ vapid: null }` / `{ vapid: { publicKey: 'P', privateKey: 'SEGREDO', subject: 'https://x' } }`), afirmando `JSON.stringify(res)` não contém `SEGREDO`.
5. `test/integration/push-config.e2e.spec.ts` (`describe('Fase 8 - pushConfig', ...)`): reaproveitar o helper de mundo/GraphQL do `device-tokens.e2e.spec.ts`; casos de integração do `<behavior>`. Não setar VAPID em `process.env` aqui (o ConfigModule lê o env na carga; o caso com chave fica no unit).
6. `packages/shared/src/graphql/push-config.ts`: `export const PUSH_CONFIG = /* GraphQL */ \`\n  query PushConfig {\n    pushConfig {\n      webPushPublicKey\n    }\n  }\n\`;` e `export * from './graphql/push-config';` no `index.ts`.
7. Com env local: `corepack pnpm --filter @sgs/backend test -- push-config && corepack pnpm --filter @sgs/backend test:integration -- push-config phase2-modules-boot && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint`. Commit `feat(08-02): query pushConfig com a chave pública VAPID`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- push-config && corepack pnpm --filter @sgs/backend test:integration -- push-config phase2-modules-boot</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "@Query('pushConfig')" apps/backend/src/push/push-config.resolver.ts` encontra
    - `grep -n "NOTIFICATION_READ" apps/backend/src/push/push-config.resolver.ts` encontra
    - `grep -n "PushConfigResolver" apps/backend/src/push/push.module.ts` encontra
    - `grep -n "privateKey" apps/backend/src/graphql/schema/push-config.graphql` sai vazio
    - `grep -n "PUSH_CONFIG" packages/shared/src/graphql/push-config.ts` encontra e `grep -n "graphql/push-config" packages/shared/src/index.ts` encontra
    - comandos do `<verify>` saem 0; `corepack pnpm --filter @sgs/shared test` sai 0
  </acceptance_criteria>
  <done>Frontend consegue perguntar ao servidor a chave pública (ou saber que o canal está desligado), sem vazar segredo.</done>
</task>

</tasks>

<verification>
Unit e integração de pushConfig e credenciais verdes; boot dos módulos sem VAPID verde; lib fixada em 3.6.7.
</verification>

<success_criteria>
D-10 coberto: chaves VAPID configuráveis no staging, canal desligado sem chaves, chave pública disponível ao app por query autenticada.
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-02-SUMMARY.md`
</output>

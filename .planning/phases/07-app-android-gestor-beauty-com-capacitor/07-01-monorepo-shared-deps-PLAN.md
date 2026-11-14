---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - pnpm-workspace.yaml
  - package.json
  - pnpm-lock.yaml
  - packages/shared/package.json
  - packages/shared/tsconfig.json
  - packages/shared/codegen.ts
  - packages/shared/README.md
  - packages/shared/src/index.ts
  - packages/shared/src/push.ts
  - packages/shared/src/validation.ts
  - packages/shared/src/graphql/device-tokens.ts
  - packages/shared/src/__tests__/push.test.ts
  - packages/shared/src/__tests__/validation.test.ts
  - apps/mobile/package.json
  - apps/frontend/package.json
  - apps/backend/package.json
  - .github/workflows/ci.yml
autonomous: true
requirements: [C-06, C-01, C-03, C-04]

must_haves:
  truths:
    - "O workspace pnpm reconhece apps/* e packages/* e `corepack pnpm install --frozen-lockfile` passa com o lockfile commitado"
    - "packages/shared (@sgs/shared) existe com regras de rota do push, validações do token e documentos GraphQL de registro, testados, e NENHUM app (backend/frontend) depende dele (D-05, Pitfall 1)"
    - "As versões dos plugins Capacitor são idênticas e exatas (sem ^) em apps/frontend e apps/mobile (Pitfall 2)"
    - "Os builds Docker do staging (contextos ./apps/backend e ./apps/frontend) continuam passando"
  artifacts:
    - path: "packages/shared/src/push.ts"
      provides: "PUSH_KINDS, PushData, buildAgendaRoute, isAllowedPushRoute"
      exports: ["PUSH_KINDS", "buildAgendaRoute", "isAllowedPushRoute"]
    - path: "packages/shared/src/graphql/device-tokens.ts"
      provides: "Documentos registerDeviceToken/unregisterDeviceToken para o Expo"
      contains: "registerDeviceToken(input: $input)"
    - path: "apps/mobile/package.json"
      provides: "@sgs/mobile com Capacitor 8.6.2 e plugins fixos"
      contains: "\"@capacitor/android\": \"8.6.2\""
  key_links:
    - from: "pnpm-workspace.yaml"
      to: "packages/shared"
      via: "glob packages/*"
      pattern: "packages/\\*"
    - from: ".github/workflows/ci.yml"
      to: "@sgs/shared test"
      via: "passo no job frontend-unit"
      pattern: "@sgs/shared test"
---

<objective>
Preparar o monorepo para a fase: criar `packages/shared` (D-05) como fonte TS pura com testes, registrar `apps/mobile` como pacote do workspace e instalar de uma vez TODAS as dependências novas da fase (Capacitor no frontend e no mobile, `google-auth-library` no backend), gerando um único `pnpm-lock.yaml`.

Purpose: concentrar as mudanças de lockfile num só plano evita conflito entre os planos paralelos da wave 2; e provar cedo que `packages/shared` não quebra CI nem os builds Docker do staging (C-06).
Output: `packages/shared` testado, `apps/mobile/package.json`, dependências fixas nos três apps, lockfile, passo de teste do shared no CI.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md

**Pré-condição da fase:** a execução da fase 7 só começa depois que a fase 04.2 estiver no staging. Conferir `ls .planning/phases/04.2-*/04.2-12-SUMMARY.md` antes de qualquer edição; se não existir, PARAR e avisar o orquestrador.

**Ambiente de execução (igual à 04.2):**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Commit por tarefa: lint + typecheck + testes do pacote tocado. Último commit da wave: gate completo (`corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/e2e test:e2e`). Sem push nem deploy no meio da fase (deploy concentrado no 07-11). `phase4-alerts-boot` local por Redis NOAUTH é falha conhecida.

**Restrição crítica (RESEARCH Pattern 8 / Pitfall 1):** `docker-compose.staging.yml` usa `context: ./apps/backend` e `./apps/frontend` e os Dockerfiles fazem `COPY package.json` + `pnpm install --no-frozen-lockfile` isolados. NUNCA adicionar `"@sgs/shared": "workspace:*"` em `apps/backend/package.json` nem em `apps/frontend/package.json` nesta fase.

<interfaces>
Contrato que este plano CRIA em `packages/shared/src/push.ts` (backend 07-03 e frontend 07-05 mantêm CÓPIAS locais com os mesmos nomes e comportamento):
```ts
export const PUSH_KINDS = ['appointment.created', 'appointment.cancelled', 'bridal.scheduled', 'bridal.cancelled'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
/** Campos do `data` do FCM — todos string (exigência do FCM v1). */
export interface PushData { kind: PushKind; route: string; appointmentId: string; groupId?: string }
export const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;
export function buildAgendaRoute(dateYmd: string, appointmentId?: string | null): string;
//   buildAgendaRoute('2026-11-20') === '/agenda?data=2026-11-20&visao=day'
//   buildAgendaRoute('2026-11-20', 'abc') === '/agenda?data=2026-11-20&visao=day&agendamento=abc'
//   lança Error('data inválida') se dateYmd não casar /^\d{4}-\d{2}-\d{2}$/
export function isAllowedPushRoute(route: unknown): route is string;
//   true só para string que casa AGENDA_ROUTE_RE (sem esquema, host, '//' ou '..')
```
`packages/shared/src/validation.ts`:
```ts
export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export const PUSH_PROVIDERS = ['fcm', 'expo'] as const;   // 'expo' reservado (Expo Push Service), não usado nesta fase
export const MAX_DEVICE_TOKEN_LENGTH = 4096;
export type DeviceTokenInputError = { field: 'token' | 'platform' | 'provider' | 'appVersion'; message: string };
export function validateDeviceTokenInput(input: { token: string; platform: string; provider?: string | null; appVersion?: string | null }): DeviceTokenInputError | null;
//   mensagens: 'Token do aparelho inválido.', 'Plataforma inválida.', 'Provedor de push inválido.', 'Versão do app inválida.' (appVersion > 20 chars)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Criar packages/shared (@sgs/shared) com regras do push, validações e documentos GraphQL</name>
  <files>pnpm-workspace.yaml, package.json, packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/codegen.ts, packages/shared/README.md, packages/shared/src/index.ts, packages/shared/src/push.ts, packages/shared/src/validation.ts, packages/shared/src/graphql/device-tokens.ts, packages/shared/src/__tests__/push.test.ts, packages/shared/src/__tests__/validation.test.ts</files>
  <read_first>
    - pnpm-workspace.yaml (hoje só `apps/*`)
    - package.json (raiz: `workspaces`, scripts `build`/`lint`, packageManager pnpm@9.15.4)
    - apps/e2e/package.json (modelo de pacote mínimo do workspace: type module, scripts typecheck)
    - apps/frontend/codegen.ts (config de scalars a replicar)
    - apps/frontend/src/features/operations/lib/agenda-link.ts (formato `/agenda?data=YYYY-MM-DD&visao=day`)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Pattern 4, Pattern 8)
  </read_first>
  <behavior>
    - buildAgendaRoute('2026-11-20') === '/agenda?data=2026-11-20&visao=day'
    - buildAgendaRoute('2026-11-20', '0193-abc') === '/agenda?data=2026-11-20&visao=day&agendamento=0193-abc'
    - buildAgendaRoute('20/11/2026') lança Error('data inválida')
    - isAllowedPushRoute('/agenda?data=2026-11-20&visao=day&agendamento=x') === true; isAllowedPushRoute('/agenda') === true
    - isAllowedPushRoute para 'https://evil.com/agenda', '//evil.com', '/agenda/../admin', '/admin', 'javascript:alert(1)', 42, null, undefined === false
    - validateDeviceTokenInput({ token: '', platform: 'android' }) → { field: 'token', message: 'Token do aparelho inválido.' }; token com 4097 chars → field 'token'; platform 'web' → field 'platform'; provider 'apns' → field 'provider'; appVersion com 21 chars → field 'appVersion'; entrada válida ({ token: 'abc', platform: 'android' }) → null
  </behavior>
  <action>
1. `pnpm-workspace.yaml` → `packages:\n  - 'apps/*'\n  - 'packages/*'`. No `package.json` raiz, `"workspaces": ["apps/*", "packages/*"]` (o script `build` raiz continua chamando só backend e frontend — NÃO incluir mobile nem shared).
2. `packages/shared/package.json`:
```json
{
  "name": "@sgs/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Código compartilhado para o futuro app Expo (rotas do push, validações, documentos GraphQL). Sem build: fonte TS pura.",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "codegen": "graphql-codegen --config codegen.ts"
  },
  "devDependencies": {
    "@graphql-codegen/cli": "5.0.7",
    "@graphql-codegen/typescript": "4.1.6",
    "@graphql-codegen/typescript-operations": "4.6.1",
    "graphql": "^16.10.0",
    "typescript": "^5.7.3",
    "vitest": "2.1.9"
  }
}
```
3. `packages/shared/tsconfig.json`: `{"compilerOptions":{"target":"ES2022","lib":["ES2022"],"module":"ESNext","moduleResolution":"Bundler","strict":true,"noEmit":true,"skipLibCheck":true,"isolatedModules":true,"types":["vitest/globals"]},"include":["src","codegen.ts"]}`.
4. `packages/shared/codegen.ts` (rodado só no 07-02, depois que o SDL `device-tokens.graphql` existir; aqui só criar o arquivo):
```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: ['../../apps/backend/src/**/*.graphql'],
  documents: ['src/graphql/**/*.ts'],
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        onlyOperationTypes: true,
        enumsAsTypes: true,
        useTypeImports: true,
        scalars: { UUID: 'string', DateTime: 'string', Date: 'string', Email: 'string', JSON: 'Record<string, unknown>' },
      },
    },
  },
};

export default config;
```
5. `src/push.ts` e `src/validation.ts` exatamente como no bloco `<interfaces>`. Implementação de `isAllowedPushRoute`: `typeof route === 'string' && route.length <= 300 && !route.includes('..') && !route.startsWith('//') && AGENDA_ROUTE_RE.test(route)`. `buildAgendaRoute` monta com `URLSearchParams` na ordem `data`, `visao=day`, `agendamento` (só se informado). Validação: `token.trim()` vazio ou `> MAX_DEVICE_TOKEN_LENGTH` → erro token; platform fora de DEVICE_PLATFORMS → platform; provider (default 'fcm') fora de PUSH_PROVIDERS → provider; appVersion não nulo com `length > 20` → appVersion.
6. `src/graphql/device-tokens.ts` (strings puras com comentário mágico, sem graphql-tag):
```ts
export const REGISTER_DEVICE_TOKEN = /* GraphQL */ `
  mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input)
  }
`;
export const UNREGISTER_DEVICE_TOKEN = /* GraphQL */ `
  mutation UnregisterDeviceToken($token: String!) {
    unregisterDeviceToken(token: $token)
  }
`;
```
7. `src/index.ts`: `export * from './push';`, `export * from './validation';`, `export * from './graphql/device-tokens';` (o `export * from './generated/graphql'` entra no 07-02).
8. Testes vitest (globals) em `src/__tests__/push.test.ts` e `validation.test.ts` cobrindo TODOS os casos do `<behavior>`. Escrever os testes primeiro (RED), depois a implementação (GREEN).
9. `packages/shared/README.md` (pt-BR): o que o pacote tem, que é consumido pelo futuro app Expo, e um aviso em destaque: "Não importar @sgs/shared em apps/backend nem apps/frontend nesta fase: os builds Docker do staging usam contexto ./apps/<app> e quebrariam. Backend e frontend têm cópias locais (apps/backend/src/push/push-messages.ts e apps/frontend/src/infrastructure/native/push-route.ts); mudou aqui, mude lá."
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm install && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/shared typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "packages/\*" pnpm-workspace.yaml` encontra a linha
    - `grep -n '"packages/\*"' package.json` encontra a linha
    - `grep -c "it(" packages/shared/src/__tests__/push.test.ts` ≥ 4 e `grep -c "it(" packages/shared/src/__tests__/validation.test.ts` ≥ 5
    - `corepack pnpm --filter @sgs/shared test` sai 0
    - `grep -n "registerDeviceToken(input: \$input)" packages/shared/src/graphql/device-tokens.ts` encontra a linha
    - `grep -n "Não importar @sgs/shared" packages/shared/README.md` encontra a linha
    - `grep -rn "@sgs/shared" apps/backend/package.json apps/frontend/package.json` não encontra nada
  </acceptance_criteria>
  <done>@sgs/shared existe no workspace, testado e tipado, sem consumidores nos apps com Docker.</done>
</task>

<task type="auto">
  <name>Task 2: Instalar as dependências da fase (mobile, frontend, backend), lockfile único e passo de teste no CI</name>
  <files>apps/mobile/package.json, apps/frontend/package.json, apps/backend/package.json, pnpm-lock.yaml, .github/workflows/ci.yml</files>
  <read_first>
    - apps/frontend/package.json (dependências atuais; Capacitor ainda ausente)
    - apps/backend/package.json (dependências atuais)
    - apps/frontend/Dockerfile e apps/backend/Dockerfile (`COPY package.json` + `pnpm install --no-frozen-lockfile`)
    - docker-compose.staging.yml (contextos dos builds)
    - .github/workflows/ci.yml (job `frontend-unit`)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Standard Stack, "Armadilha de dupla instalação")
  </read_first>
  <action>
1. Criar `apps/mobile/package.json` (o resto de `apps/mobile` vem no 07-04):
```json
{
  "name": "@sgs/mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Gestor Beauty — casca Android (Capacitor 8) que carrega o SGS do servidor. Fora do Docker e do build raiz.",
  "scripts": {
    "typecheck": "echo 'typecheck do mobile entra no 07-04'",
    "test": "echo 'check-config do mobile entra no 07-04'",
    "sync": "cap sync android"
  },
  "dependencies": {
    "@capacitor/android": "8.6.2",
    "@capacitor/app": "8.1.2",
    "@capacitor/core": "8.6.2",
    "@capacitor/keyboard": "8.0.6",
    "@capacitor/push-notifications": "8.1.3",
    "@capacitor/splash-screen": "8.0.2",
    "@capacitor/status-bar": "8.0.4"
  },
  "devDependencies": {
    "@capacitor/assets": "4.0.0",
    "@capacitor/cli": "8.6.2",
    "sharp": "0.35.5",
    "typescript": "^5.7.3"
  }
}
```
   Os scripts `typecheck`/`test` ficam como `echo` porque `tsconfig.json` e `scripts/check-config.mjs` só nascem no 07-04, que os troca por `tsc --noEmit` e `node scripts/check-config.mjs`.
2. Frontend (versões EXATAS, iguais às do mobile): `corepack pnpm --filter @sgs/frontend add @capacitor/core@8.6.2 @capacitor/app@8.1.2 @capacitor/push-notifications@8.1.3 @capacitor/splash-screen@8.0.2 @capacitor/status-bar@8.0.4 --save-exact`.
3. Backend: `corepack pnpm --filter @sgs/backend add google-auth-library@11.3.4 --save-exact`.
4. `corepack pnpm install` na raiz e conferir `corepack pnpm install --frozen-lockfile` (lockfile consistente).
5. `.github/workflows/ci.yml`, job `frontend-unit`: depois do passo "Vitest do frontend", adicionar
```yaml
      - name: Testes do pacote compartilhado
        run: pnpm --filter @sgs/shared test
```
   Não alterar mais nada do ci.yml.
6. Provar C-06 (Docker do staging intacto): `cd /root/sgs && docker compose -f docker-compose.staging.yml --env-file .env.staging build backend frontend` (só build; NÃO subir nada, NÃO fazer deploy). Se faltar `.env.staging`, usar `--env-file .env.staging.example`.
7. Rodar `corepack pnpm -r typecheck` e `corepack pnpm -r --if-present lint` e `corepack pnpm --filter @sgs/frontend exec vitest run` (a instalação não pode quebrar nada).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm install --frozen-lockfile && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && grep -n '"@capacitor/core": "8.6.2"' apps/frontend/package.json apps/mobile/package.json && grep -n '"google-auth-library": "11.3.4"' apps/backend/package.json</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '"@capacitor/push-notifications": "8.1.3"' apps/frontend/package.json apps/mobile/package.json` encontra 2 linhas (sem `^`)
    - `grep -n '"@capacitor/android": "8.6.2"' apps/mobile/package.json` encontra a linha
    - `grep -n '"google-auth-library": "11.3.4"' apps/backend/package.json` encontra a linha
    - `grep -n "@sgs/shared test" .github/workflows/ci.yml` encontra a linha
    - `corepack pnpm install --frozen-lockfile` sai 0
    - `docker compose -f docker-compose.staging.yml --env-file .env.staging build backend frontend` sai 0 (registrar no SUMMARY o tempo e o resultado)
    - `grep -n '"build":' package.json` continua sem "mobile" e sem "shared"
  </acceptance_criteria>
  <done>Todas as dependências da fase instaladas com versões exatas, lockfile único commitado, CI testa o shared e os builds Docker do staging seguem verdes.</done>
</task>

</tasks>

<verification>
- `corepack pnpm install --frozen-lockfile && corepack pnpm -r typecheck` verdes
- `corepack pnpm --filter @sgs/shared test` verde
- Build Docker do staging (backend + frontend) verde sem `@sgs/shared` nos package.json dos apps
</verification>

<success_criteria>
`packages/shared` criado e testado (D-05), dependências Capacitor/FCM instaladas uma vez só, sem regressão no CI nem no Docker do staging (C-06).
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-01-SUMMARY.md`
</output>

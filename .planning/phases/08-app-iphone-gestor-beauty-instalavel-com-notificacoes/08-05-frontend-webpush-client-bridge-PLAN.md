---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 05
type: execute
wave: 2
depends_on: ["08-02", "08-03"]
files_modified:
  - apps/frontend/src/infrastructure/webpush/platform-ios.ts
  - apps/frontend/src/infrastructure/webpush/push-config.api.ts
  - apps/frontend/src/infrastructure/webpush/web-push-client.ts
  - apps/frontend/src/infrastructure/webpush/__tests__/platform-ios.test.ts
  - apps/frontend/src/infrastructure/webpush/__tests__/web-push-client.test.ts
  - apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx
  - apps/frontend/src/infrastructure/webpush/__tests__/webpush-bridge.test.tsx
  - apps/frontend/src/App.tsx
  - apps/frontend/src/components/ProtectedRoute.tsx
  - apps/frontend/src/components/__tests__/protected-route-pending.test.tsx
  - apps/frontend/src/infrastructure/native/device-token.api.ts
  - apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts
  - apps/frontend/src/features/auth/hooks/useAuth.ts
  - apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx
autonomous: true
requirements: [D-04, D-05, D-06, D-07]

must_haves:
  truths:
    - "No app instalado (standalone, fora do Capacitor) o service worker /sw.js é registrado no boot, antes de qualquer clique"
    - "enableWebPush pede a permissão como PRIMEIRA chamada assíncrona (gesto preservado), inscreve com userVisibleOnly e registra no backend com provider 'webpush', platform 'ios', p256dh e auth (D-05)"
    - "Toque na notificação com o app aberto navega para a rota (revalidada); sem sessão, guarda a rota pendente e vai para /login (D-04)"
    - "Abrir o app a frio em /agenda?… com sessão vencida guarda a rota pendente no ProtectedRoute, e o login volta para o atendimento"
    - "Logout remove o registro no backend e depois chama subscription.unsubscribe(); erro em qualquer etapa não impede o logout (D-06)"
    - "Com isNativeApp() true nada de Web Push roda: sem register do SW, sem subscribe, sem unsubscribe (D-07)"
  artifacts:
    - path: "apps/frontend/src/infrastructure/webpush/web-push-client.ts"
      provides: "registerServiceWorker, getWebPushState, enableWebPush, syncWebPushSubscription, unsubscribeWebPush, urlBase64ToUint8Array"
      exports: ["registerServiceWorker", "getWebPushState", "enableWebPush", "syncWebPushSubscription", "unsubscribeWebPush", "urlBase64ToUint8Array"]
    - path: "apps/frontend/src/infrastructure/webpush/platform-ios.ts"
      provides: "isIosDevice, isStandalone, isIosSafari, isWebPushContext, supportsWebPush"
    - path: "apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx"
      provides: "Ponte invisível SW ↔ app"
      exports: ["WebPushBridge"]
  key_links:
    - from: "apps/frontend/src/App.tsx"
      to: "WebPushBridge"
      via: "montado ao lado do NativeAppBridge"
      pattern: "<WebPushBridge />"
    - from: "apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx"
      to: "navigator.serviceWorker message 'sgs-open-route'"
      via: "addEventListener('message')"
      pattern: "sgs-open-route"
    - from: "apps/frontend/src/features/auth/hooks/useAuth.ts"
      to: "unsubscribeWebPush"
      via: "logout depois de unregisterCurrentDeviceToken"
      pattern: "unsubscribeWebPush\\("
    - from: "apps/frontend/src/components/ProtectedRoute.tsx"
      to: "savePendingRoute"
      via: "antes do Navigate para /login"
      pattern: "savePendingRoute\\("
---

<objective>
A camada cliente do Web Push no frontend (sem UI visível): detecção de iPhone/iPad/standalone, registro do SW, inscrição/desinscrição, chave pública por `pushConfig`, a ponte que recebe o toque da notificação, a rota pendente no `ProtectedRoute` e o logout desinscrevendo.

Purpose: D-04/D-05/D-06/D-07 — a UI do 08-06 só chama estas funções; o Android (Capacitor) fica intocado.
Output: módulos em `src/infrastructure/webpush/`, ajustes em `device-token.api.ts`, `useAuth.ts`, `ProtectedRoute.tsx`, `App.tsx` e testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-08-SUMMARY.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-03-SUMMARY.md

**Ambiente de execução:** igual ao 08-01. Frontend sem prettier (à mão, aspas simples, ~100 colunas). `consistent-type-imports` do ESLint obriga `import type` para tipos.

<interfaces>
Contrato do backend (08-01/08-02, já definido — não depende do código deles para os testes, que mockam o Apollo):
```graphql
input RegisterDeviceTokenInput { token: String!, platform: String!, provider: String, appVersion: String, p256dh: String, auth: String }
query PushConfig { pushConfig { webPushPublicKey } }   # String ou null
```
`apps/frontend/src/infrastructure/native/device-token.api.ts` (hoje):
```ts
import { gql } from '@apollo/client';
import { apolloClient } from '@/infrastructure/apollo/client';
export const DEVICE_TOKEN_KEY = 'sgs-device-token';
export const REGISTER_DEVICE_TOKEN = gql`mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) { registerDeviceToken(input: $input) }`;
export const UNREGISTER_DEVICE_TOKEN = gql`mutation UnregisterDeviceToken($token: String!) { unregisterDeviceToken(token: $token) }`;
export async function registerDeviceToken(token: string): Promise<void>; // platform 'android', provider 'fcm'; grava DEVICE_TOKEN_KEY
export async function unregisterCurrentDeviceToken(): Promise<void>;   // lê DEVICE_TOKEN_KEY, mutation, remove a chave (finally)
```
`apps/frontend/src/infrastructure/native/platform.ts`: `export function isNativeApp(): boolean` (Capacitor.isNativePlatform()).
`apps/frontend/src/infrastructure/native/push-route.ts`: `isAllowedPushRoute(route: unknown): route is string`, `savePendingRoute(route: unknown): void` (só guarda rota permitida, em sessionStorage), `consumePendingRoute(): string | null`.
`apps/frontend/src/infrastructure/native/NativeAppBridge.tsx`: padrão a espelhar — `useAuthStore((s) => s.memberId | s.organizationId | s.impersonating)`, `useAuthStore(selectIsAuthenticated)`, `router` de `@/router`, `registeredKey = useRef<string|null>`; `onOpenRoute`: autenticada → `router.navigate(route)`, senão `savePendingRoute(route); router.navigate('/login')`.
`apps/frontend/src/components/ProtectedRoute.tsx` (hoje): `if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;` — o `LoginPage` NÃO lê `state.from`, só `consumePendingRoute()` (`LoginPage.tsx:150`), então hoje a rota do toque a frio com sessão vencida se perde.
`apps/frontend/src/features/auth/hooks/useAuth.ts` `logout` (linha ~96): impersonação → `exitClient()`; senão `await unregisterCurrentDeviceToken().catch(() => {})`, depois `logoutMutation`, `clearSession()`, `navigate('/login')`.
`apps/frontend/src/App.tsx`: monta `<NativeAppBridge />` depois do `<Toaster>`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Detecção de plataforma, chave pública e cliente Web Push</name>
  <files>apps/frontend/src/infrastructure/webpush/platform-ios.ts, apps/frontend/src/infrastructure/webpush/push-config.api.ts, apps/frontend/src/infrastructure/webpush/web-push-client.ts, apps/frontend/src/infrastructure/webpush/__tests__/platform-ios.test.ts, apps/frontend/src/infrastructure/webpush/__tests__/web-push-client.test.ts, apps/frontend/src/infrastructure/native/device-token.api.ts, apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts</files>
  <read_first>
    - apps/frontend/src/infrastructure/native/device-token.api.ts
    - apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts (como o apolloClient é mockado)
    - apps/frontend/src/infrastructure/native/platform.ts
    - apps/frontend/src/test-setup.ts (o que o jsdom já simula)
  </read_first>
  <behavior>
    - `isIosDevice`: UA com `iPhone` ou `iPod` → true; `iPad` → true; `Macintosh` com `platform 'MacIntel'` e `maxTouchPoints 5` → true; Mac sem toque → false; Android/Windows → false
    - `isStandalone`: `navigator.standalone === true` → true; `matchMedia('(display-mode: standalone)').matches` → true; jsdom sem `matchMedia` → false (não lança)
    - `isIosSafari`: iPhone Safari → true; UA com `CriOS`, `FxiOS`, `EdgiOS`, `OPiOS`, `GSA/`, `FBAN`, `FBAV`, `Instagram`, `Line/` → false; iOS sem `Safari/` no UA (WebView) → false
    - `supportsWebPush`: precisa `serviceWorker` em navigator, `PushManager` e `Notification` em window
    - `isWebPushContext`: `!isNativeApp() && isStandalone()`
    - `urlBase64ToUint8Array` de uma chave de 87 chars → `Uint8Array` de 65 bytes começando com `0x04`
    - `getWebPushState(null)` → `'off'`; fora do contexto → `'unavailable'`; sem suporte → `'unsupported'`; `Notification.permission` `'denied'` → `'denied'`; `'default'` → `'default'`; `'granted'` sem inscrição → `'needs-subscribe'`; `'granted'` com inscrição → `'granted'`
    - `enableWebPush(key)`: `Notification.requestPermission` é chamado ANTES de qualquer outro `await`; recusa → devolve `'denied'` sem `subscribe`; aceita → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array })` e mutation com `{ token: endpoint, platform: 'ios', provider: 'webpush', p256dh, auth }`; `localStorage['sgs-device-token'] = endpoint`; falha de rede → `'error'`
    - `syncWebPushSubscription()`: permissão `granted` com inscrição → mesma mutation e devolve true; sem inscrição ou sem permissão → false sem mutation
    - `unsubscribeWebPush()`: com inscrição → `unsubscribe()`; `isNativeApp()` true → não toca em `navigator.serviceWorker`; erro → engolido
    - `registerServiceWorker()`: `navigator.serviceWorker.register('/sw.js', { scope: '/' })` só em `isWebPushContext()` com suporte; senão `null`
  </behavior>
  <action>
1. `platform-ios.ts` — funções puras recebendo `nav: Navigator = navigator` e `win: Window = window` para teste:
   `isIosDevice`, `isStandalone`, `isIosSafari`, `supportsWebPush`, `isWebPushContext` (importa `isNativeApp` de `@/infrastructure/native/platform`). Regex de terceiros: `/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//`. `isStandalone` protege com `typeof win.matchMedia === 'function'`.
2. `push-config.api.ts`:
```ts
// Mesmo texto de packages/shared/src/graphql/push-config.ts.
export const PUSH_CONFIG = gql`
  query PushConfig {
    pushConfig {
      webPushPublicKey
    }
  }
`;
export async function fetchWebPushPublicKey(): Promise<string | null> // apolloClient.query({ query: PUSH_CONFIG, fetchPolicy: 'network-only' }); erro → null
```
3. `device-token.api.ts`: acrescentar
```ts
export async function registerWebPushSubscription(endpoint: string, keys: { p256dh: string; auth: string }): Promise<void> {
  await apolloClient.mutate({ mutation: REGISTER_DEVICE_TOKEN, variables: { input: { token: endpoint, platform: 'ios', provider: 'webpush', p256dh: keys.p256dh, auth: keys.auth } } });
  localStorage.setItem(DEVICE_TOKEN_KEY, endpoint);
}
```
   `registerDeviceToken`/`unregisterCurrentDeviceToken` não mudam (o unregister por token já serve para o endpoint). Casos novos em `device-token-api.test.ts`.
4. `web-push-client.ts`:
```ts
export type WebPushState = 'unavailable' | 'unsupported' | 'off' | 'default' | 'needs-subscribe' | 'granted' | 'denied';
export function urlBase64ToUint8Array(base64url: string): Uint8Array;
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null>;
export async function getWebPushState(publicKey: string | null): Promise<WebPushState>;
export async function enableWebPush(publicKey: string): Promise<'granted' | 'denied' | 'default' | 'error'>;
export async function syncWebPushSubscription(): Promise<boolean>;
export async function unsubscribeWebPush(): Promise<void>;
```
   `enableWebPush`: primeira linha `const permission = await Notification.requestPermission();` (iOS ignora pedido fora do gesto); depois `navigator.serviceWorker.ready`, `pushManager.getSubscription() ?? pushManager.subscribe(...)`, `sub.toJSON()` → `endpoint` e `keys` (já base64url, não converter), `registerWebPushSubscription`. Tudo depois da permissão dentro de `try/catch` → `'error'`. `getWebPushState`/`syncWebPushSubscription`/`unsubscribeWebPush` usam `navigator.serviceWorker.getRegistration()` (não `ready`, que espera para sempre se não houver SW). Todas retornam cedo se `isNativeApp()` (D-07).
5. Testes: `platform-ios.test.ts` e `web-push-client.test.ts` com `navigator`/`window` falsos (`Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: ... })`, `globalThis.Notification = { permission, requestPermission: vi.fn() }`, `PushManager` fake), `vi.mock('@/infrastructure/native/platform')`, `vi.mock('@/infrastructure/apollo/client')`; ordem do gesto conferida com `vi.fn().mock.invocationCallOrder`.
6. `corepack pnpm --filter @sgs/frontend test -- webpush device-token-api && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint`. Commit `feat(08-05): cliente Web Push do app instalado`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- webpush device-token-api && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "MacIntel" apps/frontend/src/infrastructure/webpush/platform-ios.ts` encontra
    - `grep -n "userVisibleOnly: true" apps/frontend/src/infrastructure/webpush/web-push-client.ts` encontra
    - `grep -n "provider: 'webpush'" apps/frontend/src/infrastructure/native/device-token.api.ts` encontra e `grep -n "platform: 'ios'" apps/frontend/src/infrastructure/native/device-token.api.ts` encontra
    - `grep -n "invocationCallOrder" apps/frontend/src/infrastructure/webpush/__tests__/web-push-client.test.ts` encontra (ordem do gesto)
    - `grep -rn "webPushPublicKey" apps/frontend/src/infrastructure/webpush/push-config.api.ts` encontra
    - comando do `<verify>` sai 0 e `corepack pnpm --filter @sgs/frontend lint` sai 0
  </acceptance_criteria>
  <done>Funções de Web Push prontas e testadas para a UI do 08-06.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: WebPushBridge, rota pendente no ProtectedRoute e montagem no App</name>
  <files>apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx, apps/frontend/src/infrastructure/webpush/__tests__/webpush-bridge.test.tsx, apps/frontend/src/App.tsx, apps/frontend/src/components/ProtectedRoute.tsx, apps/frontend/src/components/__tests__/protected-route-pending.test.tsx</files>
  <read_first>
    - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx
    - apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx (mocks do router e do store)
    - apps/frontend/src/components/ProtectedRoute.tsx
    - apps/frontend/src/features/auth/__tests__/login-pending-route.test.tsx
    - apps/frontend/src/App.tsx
  </read_first>
  <behavior>
    - bridge em contexto Web Push: na montagem chama `registerServiceWorker()` uma vez e ouve `message` do `navigator.serviceWorker`
    - mensagem `{ type: 'sgs-open-route', route: '/agenda?data=2026-11-20&visao=day&agendamento=abc' }` com sessão → `router.navigate(route)`
    - mesma mensagem sem sessão → `savePendingRoute(route)` + `router.navigate('/login')`
    - mensagem com rota `'/financeiro'` ou `'//evil.com'` ou `type` diferente → nada acontece
    - autenticada, não impersonando, em contexto Web Push → `syncWebPushSubscription()` uma vez por `memberId:organizationId` (trocar de usuária chama de novo); impersonando → não chama
    - `isNativeApp()` true → não registra SW, não adiciona listener, não sincroniza (D-07)
    - desmontar remove o listener
    - ProtectedRoute sem sessão em `/agenda?data=2026-11-20&visao=day&agendamento=abc` → `sessionStorage['sgs-pending-route']` = essa rota e redireciona para `/login`; em `/financeiro` não guarda nada
  </behavior>
  <action>
1. `WebPushBridge.tsx` (não renderiza nada; `return null`): efeito de montagem `if (!isWebPushContext() || !supportsWebPush()) return;` → `void registerServiceWorker().catch((e) => console.warn('Falha ao registrar o service worker', e))`; `const onMessage = (event: MessageEvent) => { const d = event.data as { type?: unknown; route?: unknown } | null; if (!d || d.type !== 'sgs-open-route' || !isAllowedPushRoute(d.route)) return; ... }` com o mesmo fluxo do `NativeAppBridge.onOpenRoute`; `navigator.serviceWorker.addEventListener('message', onMessage)` e remoção no cleanup. Segundo efeito igual ao `registeredKey` do `NativeAppBridge`, chamando `syncWebPushSubscription()` (erro → `console.warn`).
2. `App.tsx`: `import { WebPushBridge } from '@/infrastructure/webpush/WebPushBridge';` e `<WebPushBridge />` logo depois de `<NativeAppBridge />`.
3. `ProtectedRoute.tsx`: antes do `<Navigate>`, `savePendingRoute(location.pathname + location.search);` (import de `@/infrastructure/native/push-route`; a função já ignora rota que não seja da agenda). Comentário: "App aberto a frio pelo toque da notificação com a sessão vencida: o login volta para o atendimento (fase 8)." Manter o `state={{ from: location }}`.
4. Testes do `<behavior>` em `webpush-bridge.test.tsx` (mock de `./platform-ios`, `./web-push-client`, `@/router`, `navigator.serviceWorker` com `addEventListener`/`removeEventListener` espiões) e `protected-route-pending.test.tsx` (`MemoryRouter` com `initialEntries`, store deslogado).
5. `corepack pnpm --filter @sgs/frontend test -- webpush-bridge protected-route native-app-bridge login-pending-route && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint`. Commit `feat(08-05): toque na notificação do iPhone abre a agenda`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- webpush-bridge protected-route native-app-bridge login-pending-route</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "<WebPushBridge />" apps/frontend/src/App.tsx` encontra
    - `grep -n "savePendingRoute(location.pathname + location.search)" apps/frontend/src/components/ProtectedRoute.tsx` encontra
    - `grep -n "sgs-open-route" apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx` encontra
    - `grep -n "isAllowedPushRoute" apps/frontend/src/infrastructure/webpush/WebPushBridge.tsx` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>O toque na notificação leva à agenda do dia, inclusive com o app fechado e a sessão vencida.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Logout desinscreve o Web Push</name>
  <files>apps/frontend/src/features/auth/hooks/useAuth.ts, apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/auth/hooks/useAuth.ts (função logout)
    - apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx
  </read_first>
  <behavior>
    - logout normal: `unregisterCurrentDeviceToken` é chamado ANTES de `unsubscribeWebPush` (a mutation precisa do token de acesso), e os dois antes de `clearSession`
    - `unsubscribeWebPush` rejeitando → logout continua (`clearSession` e `navigate('/login')`)
    - impersonação → nenhum dos dois é chamado (continua `exitClient`)
  </behavior>
  <action>
1. `useAuth.ts`: `import { unsubscribeWebPush } from '@/infrastructure/webpush/web-push-client';` e, logo depois de `await unregisterCurrentDeviceToken().catch(() => {});`, `await unsubscribeWebPush().catch(() => {});` com o comentário "Fase 8: no iPhone a inscrição também é cancelada no aparelho (D-06). No Android é no-op." Nada mais muda.
2. `useAuth-logout.test.tsx`: mock de `@/infrastructure/webpush/web-push-client` e casos do `<behavior>` (ordem com `invocationCallOrder`).
3. `corepack pnpm --filter @sgs/frontend test -- useAuth-logout && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint` (suíte inteira do frontend para pegar efeitos do `ProtectedRoute`/`App`). Commit `feat(08-05): logout desinscreve o Web Push`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "await unsubscribeWebPush().catch(() => {})" apps/frontend/src/features/auth/hooks/useAuth.ts` encontra
    - `grep -n "unsubscribeWebPush" apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx` encontra
    - vitest inteiro do frontend, typecheck e lint saem 0
  </acceptance_criteria>
  <done>Sair do app no iPhone para de receber avisos (D-06), sem afetar o logout do Android nem da web.</done>
</task>

</tasks>

<verification>
Suíte vitest inteira do frontend, typecheck e lint verdes.
</verification>

<success_criteria>
Toda a lógica de Web Push do cliente está pronta e testada; o Android continua só no caminho FCM.
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-05-SUMMARY.md`
</output>

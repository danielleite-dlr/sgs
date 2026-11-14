---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 08
type: execute
wave: 3
depends_on: ["07-05"]
files_modified:
  - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx
  - apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx
  - apps/frontend/src/App.tsx
  - apps/frontend/src/features/auth/hooks/useAuth.ts
  - apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx
  - apps/frontend/src/features/auth/pages/LoginPage.tsx
  - apps/frontend/src/features/auth/__tests__/login-pending-route.test.tsx
autonomous: true
requirements: [C-01, C-03, C-04, C-05]

must_haves:
  truths:
    - "Dentro do app, depois do login, o aparelho pede a permissão de notificação uma vez e registra o token no backend; todos os papéis com o mesmo login (D-18)"
    - "Admin de plataforma dentro de um salão (impersonating) ou sem salão não registra token (decisão do orquestrador nº 3)"
    - "Tocar na notificação abre a rota /agenda do aviso; se a sessão expirou, a rota fica guardada e abre logo depois do login (decisão do orquestrador nº 1)"
    - "Com o app aberto, o aviso aparece como toast (sonner) em vez de notificação do sistema"
    - "O botão voltar do Android fecha o diálogo aberto, senão volta no histórico, e na tela raiz sai do app (Claude's Discretion)"
    - "A splash some assim que o sistema carrega (D-17) e a barra de status usa ícones escuros sobre o cabeçalho claro"
    - "Ao sair (logout), o token do aparelho é removido do backend antes de encerrar a sessão; falha nisso não impede o logout"
    - "No navegador nada muda (NativeAppBridge não faz nada fora do app)"
  artifacts:
    - path: "apps/frontend/src/infrastructure/native/NativeAppBridge.tsx"
      provides: "Ponte nativa montada no App"
      exports: ["NativeAppBridge"]
  key_links:
    - from: "apps/frontend/src/App.tsx"
      to: "NativeAppBridge"
      via: "renderizado dentro do ApolloProvider"
      pattern: "<NativeAppBridge"
    - from: "apps/frontend/src/features/auth/hooks/useAuth.ts"
      to: "unregisterCurrentDeviceToken"
      via: "chamado antes de logoutMutation"
      pattern: "unregisterCurrentDeviceToken"
    - from: "apps/frontend/src/features/auth/pages/LoginPage.tsx"
      to: "consumePendingRoute"
      via: "navega para a rota pendente após login"
      pattern: "consumePendingRoute\\(\\)"
---

<objective>
Ligar a camada nativa do 07-05 ao app: componente `NativeAppBridge` (splash, barra de status, botão voltar, listeners do push, registro do token conforme a sessão), remoção do token no logout e rota pendente do toque depois do login.

Purpose: completar C-03/C-04 no frontend e os ajustes de celular (voltar, splash) sem mudar nada no navegador.
Output: `NativeAppBridge.tsx` + testes, `App.tsx`, `useAuth.ts`, `LoginPage.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-05-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. Frontend sem prettier (aspas simples, ~100 colunas). Textos novos de UI em pt-BR; o toast usa o título/corpo que vêm do servidor (sem chave i18n nova neste plano).

<interfaces>
Do 07-05 (`apps/frontend/src/infrastructure/native/`):
```ts
export function isNativeApp(): boolean;
export function isAllowedPushRoute(route: unknown): route is string;
export function savePendingRoute(route: unknown): void;
export function consumePendingRoute(): string | null;
export async function registerDeviceToken(token: string): Promise<void>;
export async function unregisterCurrentDeviceToken(): Promise<void>;
export async function addPushListeners(h: { onToken(t: string): void; onOpenRoute(r: string): void; onForeground(title: string, body: string): void }): Promise<() => void>;
export async function registerForPush(): Promise<'registered' | 'denied' | 'skipped'>;
```
Existentes:
```ts
// apps/frontend/src/router.tsx → export const router = createBrowserRouter([...]) (tem router.navigate)
// apps/frontend/src/infrastructure/stores/auth.store.ts → useAuthStore (zustand persist, hidrata síncrono do localStorage)
//   campos: accessToken, userId, memberId, organizationId, impersonating, isPlatformAdmin; selectIsAuthenticated(s)
// apps/frontend/src/features/auth/hooks/useAuth.ts → logout(): se impersonating → exitClient(); senão logoutMutation + clearSession + navigate('/login')
// apps/frontend/src/features/auth/pages/LoginPage.tsx (~linha 125-136): após applyAuthPayload → mustChangePassword ? '/trocar-senha' : isPlatformAdmin ? '/admin' : '/dashboard'
// sonner: import { toast } from 'sonner'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: NativeAppBridge (splash, status bar, voltar, push e registro por sessão) montado no App</name>
  <files>apps/frontend/src/infrastructure/native/NativeAppBridge.tsx, apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx, apps/frontend/src/App.tsx</files>
  <read_first>
    - apps/frontend/src/App.tsx
    - apps/frontend/src/router.tsx (export router)
    - apps/frontend/src/infrastructure/stores/auth.store.ts
    - apps/frontend/src/infrastructure/native/native-push.ts, push-route.ts, device-token.api.ts, platform.ts (07-05)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Patterns 3, 4, 6; Pitfalls 3, 5)
  </read_first>
  <behavior>
    - Fora do app (isNativeApp false): render não chama nenhum plugin nem addPushListeners
    - No app: na montagem chama SplashScreen.hide({ fadeOutDuration: 200 }), StatusBar.setStyle({ style: Style.Light }) e addPushListeners uma vez
    - onOpenRoute com sessão autenticada → router.navigate(route); sem sessão → savePendingRoute(route) e router.navigate('/login')
    - onForeground('Novo agendamento', 'Maria · Escova') → toast('Novo agendamento', { description: 'Maria · Escova' })
    - onToken('tok') → registerDeviceToken('tok') (erro é engolido com console.warn)
    - sessão autenticada com memberId e organizationId e impersonating=false → registerForPush() chamado uma vez por par memberId+organizationId (re-render não repete; trocar de usuária repete)
    - impersonating=true, ou sem memberId/organizationId, ou não autenticada → registerForPush NÃO é chamado
    - backButton: com [role="dialog"] aberto → dispara keydown Escape no document e não navega; senão canGoBack=true → window.history.back(); canGoBack=false → App.exitApp()
    - desmontar remove os listeners (função de limpeza de addPushListeners e handle do backButton)
  </behavior>
  <action>
1. `NativeAppBridge.tsx` (componente sem UI: `return null`):
   - `useEffect` de montagem: `if (!isNativeApp()) return;` depois, em uma função async com flag `cancelled`: `const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([import('@capacitor/splash-screen'), import('@capacitor/status-bar'), import('@capacitor/app')])`; `void SplashScreen.hide({ fadeOutDuration: 200 })`; `void StatusBar.setStyle({ style: Style.Light }).catch(() => {})` (Style.Light = ícones escuros, cabeçalho branco; `setBackgroundColor` é ignorado em edge-to-edge — não usar); `backHandle = await App.addListener('backButton', ({ canGoBack }) => { if (document.querySelector('[role="dialog"]')) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; } if (canGoBack) window.history.back(); else void App.exitApp(); })`; `removePush = await addPushListeners({ onToken, onOpenRoute, onForeground })`. Limpeza: `cancelled = true; removePush?.(); void backHandle?.remove();`.
   - `onOpenRoute(route)`: `const s = useAuthStore.getState(); if (selectIsAuthenticated(s)) void router.navigate(route); else { savePendingRoute(route); void router.navigate('/login'); }`.
   - `onForeground(title, body)`: `toast(title || 'Gestor Beauty', { description: body })`.
   - `onToken(token)`: `registerDeviceToken(token).catch((e) => console.warn('Falha ao registrar o aparelho para notificações', e))`.
   - Registro por sessão: `const memberId = useAuthStore((s) => s.memberId)`, `organizationId`, `impersonating`, `isAuth = useAuthStore(selectIsAuthenticated)`; `useRef<string | null>` com a última chave `${memberId}:${organizationId}`; `useEffect` que, se `isNativeApp() && isAuth && memberId && organizationId && !impersonating` e a chave mudou, grava a chave e chama `void registerForPush()`; se a sessão sair, zera a ref.
   - Comentário no topo: o plugin de push retém o toque que abriu o app a frio até o primeiro listener (RESEARCH Pattern 4), por isso os listeners entram na montagem, antes do login.
2. `App.tsx`: `import { NativeAppBridge } from '@/infrastructure/native/NativeAppBridge';` e renderizar `<NativeAppBridge />` logo depois de `<Toaster ... />`, dentro do `ApolloProvider`.
3. Teste (escrever primeiro) com `vi.mock` de `'../platform'`, `'../native-push'` (addPushListeners captura os handlers; registerForPush mock), `'../device-token.api'`, `'../push-route'` (savePendingRoute espiado), `'@/router'` (`{ router: { navigate: vi.fn() } }`), `'sonner'`, `'@capacitor/splash-screen'`, `'@capacitor/status-bar'` (`Style: { Light: 'LIGHT' }`), `'@capacitor/app'` (addListener captura o handler do backButton, exitApp mock). Sessão via `useAuthStore.setState({...})`. Cobrir todos os itens do `<behavior>`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run native-app-bridge && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "<NativeAppBridge" apps/frontend/src/App.tsx` encontra a linha
    - `grep -n "SplashScreen.hide" apps/frontend/src/infrastructure/native/NativeAppBridge.tsx` encontra a linha
    - `grep -n "exitApp" apps/frontend/src/infrastructure/native/NativeAppBridge.tsx` encontra a linha
    - `grep -n "impersonating" apps/frontend/src/infrastructure/native/NativeAppBridge.tsx` encontra a checagem
    - `grep -n "setBackgroundColor" apps/frontend/src/infrastructure/native/NativeAppBridge.tsx` não encontra nada
    - `grep -c "it(" apps/frontend/src/infrastructure/native/__tests__/native-app-bridge.test.tsx` ≥ 8
    - `corepack pnpm --filter @sgs/frontend exec vitest run native-app-bridge` sai 0
  </acceptance_criteria>
  <done>A ponte nativa cuida de splash, status bar, voltar, toque e registro conforme a sessão, inerte no navegador.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Logout remove o token do aparelho e login abre a rota pendente do toque</name>
  <files>apps/frontend/src/features/auth/hooks/useAuth.ts, apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx, apps/frontend/src/features/auth/pages/LoginPage.tsx, apps/frontend/src/features/auth/__tests__/login-pending-route.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/auth/hooks/useAuth.ts (logout, exitClient)
    - apps/frontend/src/features/auth/pages/LoginPage.tsx (navegação após login, linhas ~105-140)
    - apps/frontend/src/features/auth/api/auth.api.ts (LOGIN/LOGOUT para MockedProvider)
    - apps/frontend/src/__tests__/router.test.tsx ou outro teste que já renderiza LoginPage (padrão de mocks)
    - apps/frontend/src/infrastructure/native/push-route.ts e device-token.api.ts (07-05)
  </read_first>
  <behavior>
    - logout (não impersonating) chama unregisterCurrentDeviceToken ANTES de logoutMutation e de clearSession
    - unregisterCurrentDeviceToken rejeitando → logout continua: logoutMutation chamada, sessão limpa, navega para /login
    - logout com impersonating=true → NÃO chama unregisterCurrentDeviceToken (admin dentro do salão não registrou token) e segue o exitClient
    - login bem-sucedido de usuária de salão com rota pendente '/agenda?data=2026-11-20&visao=day&agendamento=a1' → navigate para essa rota (replace) e a rota pendente é consumida
    - sem rota pendente → '/dashboard' (comportamento atual); mustChangePassword → '/trocar-senha' e a rota pendente continua guardada; platform admin → '/admin'
  </behavior>
  <action>
1. `useAuth.ts`, em `logout`, depois do ramo `if (impersonating) { ... }` e ANTES do `if (refreshToken) { await logoutMutation(...) }`: 
```ts
    // Fase 7: o aparelho deixa de receber push desta usuária. Sem rede/erro, segue o logout.
    await unregisterCurrentDeviceToken().catch(() => {});
```
   com `import { unregisterCurrentDeviceToken } from '@/infrastructure/native/device-token.api';`. (No navegador não há token local, então a função não chama o backend.)
2. `LoginPage.tsx`, no ramo final após `mustChangePassword`: 
```tsx
        if (payload.session?.isPlatformAdmin) {
          navigate('/admin', { replace: true });
          return;
        }
        // Toque numa notificação com a sessão vencida: volta para o atendimento (fase 7).
        navigate(consumePendingRoute() ?? '/dashboard', { replace: true });
```
   mantendo o comportamento atual para os outros casos; `import { consumePendingRoute } from '@/infrastructure/native/push-route';`.
3. Testes (escrever primeiro): `useAuth-logout.test.tsx` com `renderHook` dentro de `MemoryRouter` + `MockedProvider` (mock da LOGOUT) e `vi.mock('@/infrastructure/native/device-token.api', () => ({ unregisterCurrentDeviceToken: vi.fn() }))`, afirmando a ordem com `mock.invocationCallOrder` contra um espião de `useAuthStore.getState().clearSession` (ou contra o resultado da mutation); `login-pending-route.test.tsx` renderizando `LoginPage` com o mock da LOGIN e `sessionStorage['sgs-pending-route']` preenchido, afirmando a rota final por uma `Route` de destino que renderiza um texto marcador.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run useAuth login-pending-route && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "unregisterCurrentDeviceToken().catch" apps/frontend/src/features/auth/hooks/useAuth.ts` encontra a linha
    - a linha de `unregisterCurrentDeviceToken` vem antes de `logoutMutation({` no arquivo (`grep -n "unregisterCurrentDeviceToken\|logoutMutation({" apps/frontend/src/features/auth/hooks/useAuth.ts` mostra a ordem)
    - `grep -n "consumePendingRoute() ?? '/dashboard'" apps/frontend/src/features/auth/pages/LoginPage.tsx` encontra a linha
    - `corepack pnpm --filter @sgs/frontend exec vitest run` (suíte toda) sai 0
  </acceptance_criteria>
  <done>Logout limpa o token do aparelho sem travar a saída; o toque com sessão vencida leva à agenda depois do login.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/frontend exec vitest run` verde
- `corepack pnpm --filter @sgs/frontend build` verde
- E2E existentes de login/logout continuam verdes no gate da wave (`corepack pnpm --filter @sgs/e2e test:e2e`)
</verification>

<success_criteria>
O app registra o aparelho, abre o atendimento pelo toque (inclusive depois de logar) e limpa o token ao sair (C-03/C-04), com voltar/splash/status bar de celular (C-01/C-05).
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-08-SUMMARY.md`
</output>

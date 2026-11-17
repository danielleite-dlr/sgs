---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 06
type: execute
wave: 3
depends_on: ["08-05"]
files_modified:
  - apps/frontend/src/infrastructure/webpush/InstallIphoneDialog.tsx
  - apps/frontend/src/features/auth/pages/LoginPage.tsx
  - apps/frontend/src/features/auth/pages/__tests__/login-instalar-iphone.test.tsx
  - apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx
  - apps/frontend/src/infrastructure/webpush/__tests__/enable-notifications.test.tsx
  - apps/frontend/src/components/layout/AppShell.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
autonomous: true
requirements: [D-01, D-05, D-07]

must_haves:
  truths:
    - "Na tela de login, num iPhone/iPad fora do app instalado e fora do Capacitor, aparece 'Instalar no iPhone' no bloco do app Android; em desktop, Android, app nativo e app já instalado o botão não aparece (D-01)"
    - "O botão abre um passo a passo: Safari → Compartilhar → Adicionar à Tela de Início → abrir pelo ícone e entrar de novo → Ativar notificações; fora do Safari aparece o aviso para abrir no Safari com 'Copiar endereço' (D-01)"
    - "Dentro do app instalado no iPhone, com o canal ligado no servidor e permissão não concedida, aparece uma faixa discreta 'Ativar notificações' com 'Agora não' (D-05)"
    - "A faixa mostra o estado: ativadas (depois do sucesso), bloqueadas (com o caminho nos Ajustes) e iOS antigo ('atualize o iOS'); 'Agora não' esconde por 7 dias"
    - "No app Android (Capacitor) e na web comum nem o botão de instalar nem a faixa aparecem (D-07)"
  artifacts:
    - path: "apps/frontend/src/infrastructure/webpush/InstallIphoneDialog.tsx"
      provides: "Diálogo com o passo a passo de instalação"
      exports: ["InstallIphoneDialog"]
    - path: "apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx"
      provides: "Faixa Ativar notificações com estados"
      exports: ["EnableNotificationsBanner"]
  key_links:
    - from: "apps/frontend/src/features/auth/pages/LoginPage.tsx"
      to: "InstallIphoneDialog"
      via: "showIphoneInstall = !isNativeApp() && isIosDevice() && !isStandalone()"
      pattern: "showIphoneInstall"
    - from: "apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx"
      to: "enableWebPush"
      via: "onClick (gesto da usuária)"
      pattern: "enableWebPush\\("
    - from: "apps/frontend/src/components/layout/AppShell.tsx"
      to: "EnableNotificationsBanner"
      via: "topo do <main>, antes do Outlet"
      pattern: "<EnableNotificationsBanner />"
---

<objective>
A parte visível: botão "Instalar no iPhone" com passo a passo na tela de login e a faixa "Ativar notificações" dentro do app instalado, no visual Gestor Beauty existente (Button, Dialog, Alert do shadcn, tokens primary/neutral).

Purpose: D-01 e D-05 (o iOS só permite pedir notificação num gesto, dentro do app instalado), sem mexer no Android (D-07).
Output: dois componentes, mudanças no `LoginPage`/`AppShell`, textos PT-BR e testes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-CONTEXT.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-05-SUMMARY.md

**Ambiente de execução:** igual ao 08-01. Frontend à mão, sem prettier. Visual (fase 6): só tokens do tema (`primary-*`, `neutral-*`, `warning-*`, `success-*`), nada de paleta padrão do Tailwind (`bg-red-600`, `text-purple-700`…), nada de sombra grande e nada de `#F7F6F3` em `src/` — o teste `src/styles/__tests__/sem-cor-antiga.test.ts` reprova. Alvos de toque ≥ 44 px (`h-11`). Nunca importar `tailwind.config.ts`.

<interfaces>
Do 08-05:
```ts
// src/infrastructure/webpush/platform-ios.ts
export function isIosDevice(nav?: Navigator): boolean;
export function isStandalone(win?: Window): boolean;
export function isIosSafari(nav?: Navigator): boolean;
export function supportsWebPush(): boolean;
export function isWebPushContext(): boolean; // !isNativeApp() && isStandalone()
// src/infrastructure/webpush/web-push-client.ts
export type WebPushState = 'unavailable' | 'unsupported' | 'off' | 'default' | 'needs-subscribe' | 'granted' | 'denied';
export async function getWebPushState(publicKey: string | null): Promise<WebPushState>;
export async function enableWebPush(publicKey: string): Promise<'granted' | 'denied' | 'default' | 'error'>;
// src/infrastructure/webpush/push-config.api.ts
export async function fetchWebPushPublicKey(): Promise<string | null>;
```
`LoginPage.tsx` (hoje): `const showApkDownload = !isNativeApp();` (linha ~42); bloco final dentro do `AuthCard`:
```tsx
{showApkDownload && (
  <div className="border-t border-neutral-200 pt-md space-y-xs">
    <Button asChild variant="outline" className="w-full"><a href={APK_URL} download="gestor-beauty.apk"><Smartphone size={16} aria-hidden="true" />{t('login.downloadAndroid')}</a></Button>
    <p className="text-label text-neutral-500 text-center">{t('login.downloadAndroidHint')}</p>
  </div>
)}
```
Teste existente `login-baixar-apk.test.tsx` mocka `@/infrastructure/native/platform` e espera o link do APK na web (jsdom, UA não-iOS) — tem que continuar verde.
`src/components/ui/`: `button.tsx` (variants `default`, `outline`, `ghost`…), `dialog.tsx` (`Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger`), `alert.tsx` (`Alert` variants `default`/`destructive`/`warning`, `AlertTitle`, `AlertDescription`).
`AppShell.tsx`: `<main className="min-w-0 flex-1 px-md py-md pb-[calc(5rem+var(--sgs-safe-bottom))] lg:px-lg lg:py-lg lg:pb-lg"><Outlet /></main>`; teste `components/layout/__tests__/casco-gestor-beauty.test.tsx` renderiza o AppShell em jsdom (sem `matchMedia`/`serviceWorker`).
i18n: `src/infrastructure/i18n/locales/pt-BR.json`, bloco `"login"` com `downloadAndroid`/`downloadAndroidHint` (único locale).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Botão "Instalar no iPhone" e passo a passo no login</name>
  <files>apps/frontend/src/infrastructure/webpush/InstallIphoneDialog.tsx, apps/frontend/src/features/auth/pages/LoginPage.tsx, apps/frontend/src/features/auth/pages/__tests__/login-instalar-iphone.test.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json</files>
  <read_first>
    - apps/frontend/src/features/auth/pages/LoginPage.tsx
    - apps/frontend/src/features/auth/pages/__tests__/login-baixar-apk.test.tsx
    - apps/frontend/src/components/ui/dialog.tsx e apps/frontend/src/components/ui/alert.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (bloco login)
  </read_first>
  <behavior>
    - UA de iPhone Safari, não standalone, não nativo → botão "Instalar no iPhone" visível, fora do `<form>`; o link "Baixar app Android" NÃO aparece (no iPhone ele só confunde)
    - iPadOS (Macintosh + MacIntel + toque) → botão visível
    - desktop (jsdom padrão) → sem botão de iPhone e com o link do APK (teste antigo continua igual)
    - iPhone em standalone → nenhum dos dois
    - nativo (Capacitor) → nenhum dos dois
    - clicar abre o diálogo com título "Instalar no iPhone" e os 5 passos (texto "Adicionar à Tela de Início" e "entre de novo" presentes)
    - iPhone com `CriOS` no UA → o diálogo mostra o aviso de abrir no Safari e o botão "Copiar endereço", que chama `navigator.clipboard.writeText(window.location.origin + '/login')` e troca o texto para "Endereço copiado"
  </behavior>
  <action>
1. `pt-BR.json`:
   - em `"login"`: `"installIphone": "Instalar no iPhone"`, `"installIphoneHint": "Use o Gestor Beauty pela tela de início do iPhone, com notificações."`
   - novo bloco `"pwa": { "install": { ... }, "notifications": { ... } }` com:
     - `install.title` "Instalar no iPhone"; `install.description` "Leva menos de um minuto e não precisa de App Store."; `install.step1` "Abra este endereço no Safari."; `install.step2` "Toque em Compartilhar (o quadrado com a seta para cima), na barra de baixo ou no topo."; `install.step3` "Role a lista e toque em Adicionar à Tela de Início. Depois toque em Adicionar."; `install.step4` "Abra o Gestor Beauty pelo ícone novo na tela de início e entre de novo com seu e-mail e senha. O app instalado tem login próprio."; `install.step5` "Dentro do app, toque em Ativar notificações para receber os avisos da agenda."; `install.notSafariTitle` "Abra no Safari"; `install.notSafari` "Este navegador não instala o app. Copie o endereço e abra no Safari."; `install.copyLink` "Copiar endereço"; `install.copied` "Endereço copiado"; `install.close` "Entendi"
     - `notifications.title` "Receba os avisos da agenda"; `notifications.body` "Ative as notificações para saber na hora de novos agendamentos e cancelamentos."; `notifications.enable` "Ativar notificações"; `notifications.enabling` "Ativando…"; `notifications.later` "Agora não"; `notifications.enabled` "Notificações ativadas neste iPhone."; `notifications.deniedTitle` "Notificações bloqueadas"; `notifications.denied` "Para ligar, abra Ajustes → Notificações → Gestor Beauty e permita."; `notifications.unsupportedTitle` "Atualize o iPhone"; `notifications.unsupported` "Para receber notificações, atualize para o iOS 16.4 ou mais novo (Ajustes → Geral → Atualização de Software)."; `notifications.error` "Não foi possível ativar agora. Tente de novo."; `notifications.close` "Fechar"
2. `InstallIphoneDialog.tsx`: `export function InstallIphoneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void })` com `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`; se `!isIosSafari()`, `Alert variant="warning"` com `install.notSafariTitle`/`install.notSafari` e `Button variant="outline" className="h-11"` "Copiar endereço" (estado `copied`; `navigator.clipboard?.writeText` em `try/catch`); lista `<ol className="list-decimal space-y-xs pl-lg text-body text-neutral-800">` com os 5 passos; rodapé com `DialogClose asChild` → `Button className="h-11 w-full"` "Entendi". Ícones `lucide-react` (`Share`, `PlusSquare`) só decorativos com `aria-hidden`.
3. `LoginPage.tsx`: imports de `isIosDevice`, `isStandalone` (`@/infrastructure/webpush/platform-ios`) e `InstallIphoneDialog`; `const ios = !isNativeApp() && isIosDevice(); const showIphoneInstall = ios && !isStandalone(); const showApkDownload = !isNativeApp() && !ios;` e `const [installOpen, setInstallOpen] = useState(false);`. O bloco final vira `{(showApkDownload || showIphoneInstall) && (<div className="border-t border-neutral-200 pt-md space-y-xs"> … </div>)}` com o link do APK quando `showApkDownload` (sem mudar markup/textos dele) e, quando `showIphoneInstall`, `Button type="button" variant="outline" className="w-full"` com ícone `Smartphone` e `t('login.installIphone')`, abrindo o diálogo, seguido do `<p>` com `t('login.installIphoneHint')`. `<InstallIphoneDialog open={installOpen} onOpenChange={setInstallOpen} />` dentro do bloco.
4. `login-instalar-iphone.test.tsx`: espelhar os mocks do `login-baixar-apk.test.tsx` e mockar `@/infrastructure/webpush/platform-ios` com valores controlados por `vi.hoisted` (`ios`, `standalone`, `safari`); casos do `<behavior>`.
5. `corepack pnpm --filter @sgs/frontend test -- login sem-cor-antiga && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint`. Commit `feat(08-06): botão Instalar no iPhone no login`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- login sem-cor-antiga && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "showIphoneInstall" apps/frontend/src/features/auth/pages/LoginPage.tsx` encontra
    - `grep -n '"installIphone": "Instalar no iPhone"' apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra
    - `grep -n "Adicionar à Tela de Início" apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra e `grep -n "entre de novo" apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra
    - `grep -n "CriOS" apps/frontend/src/features/auth/pages/__tests__/login-instalar-iphone.test.tsx` encontra ou o mock `safari: false` cobre o aviso
    - `login-baixar-apk.test.tsx` continua verde sem alteração
    - comando do `<verify>` sai 0 e lint sai 0
  </acceptance_criteria>
  <done>A equipe sabe instalar o app pelo iPhone direto da tela de login.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Faixa "Ativar notificações" no app instalado</name>
  <files>apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx, apps/frontend/src/infrastructure/webpush/__tests__/enable-notifications.test.tsx, apps/frontend/src/components/layout/AppShell.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json</files>
  <read_first>
    - apps/frontend/src/components/layout/AppShell.tsx
    - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
    - apps/frontend/src/components/ui/alert.tsx e apps/frontend/src/components/ui/button.tsx
    - apps/frontend/src/infrastructure/webpush/web-push-client.ts (08-05)
  </read_first>
  <behavior>
    - fora do contexto Web Push, fora de iOS, nativo ou impersonando → render `null` e `fetchWebPushPublicKey` não é chamado
    - chave `null` (canal desligado) → `null`
    - estado `default` ou `needs-subscribe` → faixa com título, texto, "Ativar notificações" e "Agora não"
    - clicar "Ativar notificações" chama `enableWebPush(chave)` direto no handler (sem outro `await` antes); enquanto roda, botão desabilitado com "Ativando…"; `granted` → texto "Notificações ativadas neste iPhone." com botão "Fechar"; `denied` → estado bloqueado; `error` → texto de erro e o botão volta
    - estado `denied` → `Alert variant="warning"` com o caminho dos Ajustes e "Fechar"
    - estado `unsupported` → `Alert` com "atualize para o iOS 16.4" e "Fechar"
    - estado `granted` ao montar → `null` (a ponte já sincroniza)
    - "Agora não"/"Fechar" grava `localStorage['sgs-webpush-aviso-adiado'] = Date.now()` e esconde; com valor de menos de 7 dias a faixa não aparece; com mais de 7 dias aparece de novo
    - o AppShell renderiza a faixa no topo do `<main>`, e o `casco-gestor-beauty.test.tsx` continua verde
  </behavior>
  <action>
1. `EnableNotificationsBanner.tsx` (`export function EnableNotificationsBanner()`):
   - lê `impersonating` do `useAuthStore`; `const eligible = !impersonating && isWebPushContext() && isIosDevice();`
   - efeito: se `!eligible` ou adiado (`ADIADO_KEY = 'sgs-webpush-aviso-adiado'`, `SETE_DIAS = 7 * 24 * 3600 * 1000`, leitura em `try/catch`) → para; senão `const key = await fetchWebPushPublicKey(); setPublicKey(key); setState(await getWebPushState(key));` com flag de cancelamento.
   - mostra apenas para `default` | `needs-subscribe` | `denied` | `unsupported` | (resultado local `enabled` depois do clique) | `error`.
   - `onEnable` = `function onEnable() { if (!publicKey) return; setBusy(true); void enableWebPush(publicKey).then((r) => { ... }).finally(() => setBusy(false)); }` — `enableWebPush` é a primeira chamada do handler (gesto do iOS).
   - visual: `<section aria-label={t('pwa.notifications.title')} className="mb-md rounded-md border border-primary-200 bg-primary-50 p-md">` com ícone `BellRing` (`aria-hidden`), `<p className="text-body font-semibold text-neutral-900">`, `<p className="text-body text-neutral-700">`, botões `Button className="h-11"` (primário) e `Button variant="ghost" className="h-11"` ("Agora não"); estados `denied`/`unsupported` com `Alert variant="warning"` + `AlertTitle`/`AlertDescription` e `Button variant="ghost" className="h-11"` "Fechar"; mensagens de resultado em `<p role="status">`. Conferir que `primary-50`/`primary-200` existem nos tokens (`tailwind.config.ts` lido como texto ou classes já usadas em outros componentes); se não, usar as classes do `Alert` default.
2. `AppShell.tsx`: `import { EnableNotificationsBanner } from '@/infrastructure/webpush/EnableNotificationsBanner';` e `<EnableNotificationsBanner />` como primeiro filho do `<main>`, antes de `<Outlet />`.
3. `enable-notifications.test.tsx`: mocks de `../platform-ios`, `../web-push-client`, `../push-config.api` e do store; casos do `<behavior>` (o do 7 dias com `vi.setSystemTime`).
4. `corepack pnpm --filter @sgs/frontend test -- enable-notifications casco-gestor-beauty safe-area sem-cor-antiga contraste && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint`. Commit `feat(08-06): faixa Ativar notificações no app do iPhone`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "<EnableNotificationsBanner />" apps/frontend/src/components/layout/AppShell.tsx` encontra
    - `grep -n "sgs-webpush-aviso-adiado" apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx` encontra
    - `grep -n "enableWebPush(publicKey)" apps/frontend/src/infrastructure/webpush/EnableNotificationsBanner.tsx` encontra
    - `grep -n "iOS 16.4" apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra e `grep -n "Ajustes → Notificações → Gestor Beauty" apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra
    - `grep -En "(bg|text|border)-(red|purple|violet|gray|slate)-[0-9]" apps/frontend/src/infrastructure/webpush/*.tsx` sai vazio
    - vitest inteiro, typecheck e lint do frontend saem 0
  </acceptance_criteria>
  <done>No app instalado a usuária ativa as notificações com um toque e vê o estado; nada aparece no Android nem na web comum.</done>
</task>

</tasks>

<verification>
Suíte vitest inteira do frontend, typecheck e lint verdes; testes de visual (sem-cor-antiga, contraste) verdes.
</verification>

<success_criteria>
D-01 e D-05 cobertos com a UI Gestor Beauty; D-07 preservado (Capacitor sem nenhum dos dois elementos).
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-06-SUMMARY.md`
</output>

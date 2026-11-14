---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 04
type: execute
wave: 2
depends_on: ["07-01"]
files_modified:
  - apps/mobile/package.json
  - apps/mobile/tsconfig.json
  - apps/mobile/capacitor.config.ts
  - apps/mobile/www/index.html
  - apps/mobile/www/offline.html
  - apps/mobile/scripts/check-config.mjs
  - apps/mobile/README.md
  - apps/mobile/android/**
  - .gitignore
  - .github/workflows/ci.yml
autonomous: true
requirements: [C-01, C-02, C-05]

must_haves:
  truths:
    - "O app se chama 'Gestor Beauty' e usa o appId estável br.com.gestorbeauty.app (D-03)"
    - "O app abre https://sgs.jessicaseixasmakeup.com.br (server.url) e as telas vêm do servidor: melhoria no staging aparece sem nova versão (D-06, D-07)"
    - "Sem internet (ou servidor fora), o app mostra a página local 'Sem conexão' com 'Tentar novamente', em HTML puro sem plugins (D-08)"
    - "Projeto Android Capacitor 8 com targetSdk 36 e minSdk 24 (exigência da Play em 2026)"
    - "O build de release lê a keystore de variáveis de ambiente e o versionCode de propriedade Gradle; nenhum segredo no repositório (D-03)"
    - "A notificação do FCM usa o canal 'agenda' e a cor #570080"
  artifacts:
    - path: "apps/mobile/capacitor.config.ts"
      provides: "appId, appName, server.url, errorPath, plugins"
      contains: "br.com.gestorbeauty.app"
    - path: "apps/mobile/www/offline.html"
      provides: "Tela Sem conexão (HTML/CSS/JS puro)"
      contains: "Tentar novamente"
    - path: "apps/mobile/android/app/build.gradle"
      provides: "applicationId, signingConfigs release via env, versionCode via -P"
      contains: "ANDROID_KEYSTORE_PATH"
    - path: "apps/mobile/scripts/check-config.mjs"
      provides: "Teste de configuração da casca (pnpm --filter @sgs/mobile test)"
  key_links:
    - from: "apps/mobile/capacitor.config.ts"
      to: "apps/mobile/www/offline.html"
      via: "server.errorPath"
      pattern: "errorPath: 'offline.html'"
    - from: "apps/mobile/android/app/src/main/AndroidManifest.xml"
      to: "canal 'agenda' criado no JS (07-08)"
      via: "meta-data default_notification_channel_id"
      pattern: "default_notification_channel_id"
---

<objective>
Criar a casca nativa `apps/mobile` com Capacitor 8: configuração (`server.url` do staging, `errorPath` com a tela "Sem conexão"), projeto Android gerado por `cap add android` e commitado, ajustes de Gradle (assinatura por env, versionCode por propriedade) e do manifesto (canal/cor do push), e um teste de configuração rodando no CI.

Purpose: C-01/C-02 — a casca é o mínimo nativo possível (D-07); todo o resto vem do servidor.
Output: `apps/mobile` completo menos ícones/splash e workflow (07-06).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-01-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. O Capacitor CLI 8 exige Node >= 22 (nvm 22). **NÃO instalar Android SDK, Gradle nem Android Studio na VPS** (sem recursos; RESEARCH "Build"): `cap add android` e `cap sync android` não precisam do SDK; a compilação (`gradlew`) só roda no GitHub Actions (07-06). `.npmrc` tem `shamefully-hoist=false`: se o `cap add`/`cap sync` não achar `@capacitor/android`, registrar no SUMMARY e acrescentar `public-hoist-pattern[]=@capacitor/*` ao `.npmrc` da raiz (reinstalar com `corepack pnpm install`).
</context>

<tasks>

<task type="auto">
  <name>Task 1: capacitor.config.ts, www (index + offline) e check-config</name>
  <files>apps/mobile/package.json, apps/mobile/tsconfig.json, apps/mobile/capacitor.config.ts, apps/mobile/www/index.html, apps/mobile/www/offline.html, apps/mobile/scripts/check-config.mjs, apps/mobile/README.md, .gitignore, .github/workflows/ci.yml</files>
  <read_first>
    - apps/mobile/package.json (criado no 07-01, scripts provisórios com echo)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Pattern 1, Pattern 6, Pitfalls 2, 3, 4)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md (D-06, D-07, D-08, D-17)
    - apps/frontend/index.html (fontes Inter / Source Serif 4 do layout)
    - .gitignore
    - .github/workflows/ci.yml (job frontend-unit, passo do shared adicionado no 07-01)
  </read_first>
  <action>
1. `apps/mobile/capacitor.config.ts`:
```ts
import type { CapacitorConfig } from '@capacitor/cli';

// Casca do Gestor Beauty: as telas vêm do servidor (D-07). Trocar a URL exige nova versão do app.
export const SERVER_URL = 'https://sgs.jessicaseixasmakeup.com.br';

const config: CapacitorConfig = {
  appId: 'br.com.gestorbeauty.app',
  appName: 'Gestor Beauty',
  webDir: 'www',
  server: {
    url: SERVER_URL,
    // Página local sem plugins (a ponte do Capacitor não existe nela).
    errorPath: 'offline.html',
  },
  android: {
    backgroundColor: '#F7F6F3',
    appendUserAgent: 'GestorBeautyApp/1',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#F7F6F3',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Keyboard: { resize: 'body' },
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
```
2. `apps/mobile/tsconfig.json`: `{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","strict":true,"noEmit":true,"skipLibCheck":true,"types":[]},"include":["capacitor.config.ts"]}`. Em `apps/mobile/package.json`, trocar os scripts provisórios por `"typecheck": "tsc --noEmit"` e `"test": "node scripts/check-config.mjs"` (manter `"sync": "cap sync android"`).
3. `www/index.html`: placeholder mínimo (o `cap sync` exige `webDir` com index.html), `lang="pt-BR"`, fundo `#F7F6F3`, texto "Gestor Beauty" e `<script>location.replace('https://sgs.jessicaseixasmakeup.com.br/')</script>`.
4. `www/offline.html` (D-08, HTML/CSS/JS puro, nenhuma referência a Capacitor, fontes do sistema — sem Google Fonts, pois não há rede):
   - `<html lang="pt-BR">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, fundo `#F7F6F3`, conteúdo centralizado com padding `env(safe-area-inset-*)`.
   - Monograma "GB" num quadrado arredondado `#570080` com letras brancas (CSS, fonte `Georgia, 'Source Serif 4', serif`).
   - Título `<h1>Sem conexão</h1>`, texto `<p>Não foi possível falar com o Gestor Beauty. Confira o Wi-Fi ou os dados móveis e tente de novo.</p>`.
   - Botão `<button id="retry" type="button">Tentar novamente</button>` (fundo `#570080`, texto branco, altura ≥ 48px, foco visível — WCAG) com `document.getElementById('retry').addEventListener('click', function () { this.disabled = true; this.textContent = 'Conectando…'; location.replace('https://sgs.jessicaseixasmakeup.com.br/'); });`.
5. `scripts/check-config.mjs` (Node puro, sem dependências; lê arquivos como texto; cada checagem tem mensagem pt-BR; ao final imprime `check-config: OK (<n> verificações)` ou lista as falhas e `process.exit(1)`). Checagens desta tarefa:
   - `capacitor.config.ts` contém `appId: 'br.com.gestorbeauty.app'`, `appName: 'Gestor Beauty'`, `'https://sgs.jessicaseixasmakeup.com.br'`, `errorPath: 'offline.html'`, `allowMixedContent: false`, `launchAutoHide: true` e NÃO contém `cleartext` nem `http://`.
   - `www/index.html` existe; `www/offline.html` existe, contém `Sem conexão`, `Tentar novamente`, `https://sgs.jessicaseixasmakeup.com.br/` e não contém `Capacitor`.
   - Paridade de versões (Pitfall 2): para cada `@capacitor/*` nas `dependencies` de `apps/frontend/package.json`, a mesma versão exata existe em `apps/mobile/package.json`, e nenhuma versão começa com `^` ou `~`.
   - Função `checkIfExists(path)` utilitária para a Task 2 e o 07-06 acrescentarem checagens do projeto Android.
6. `.gitignore` (raiz), seção nova `# App Android (fase 7) — segredos nunca no git`: `*.jks`, `*.keystore`, `google-services.json`, `**/service-account*.json`, `apps/mobile/android/app/release/`, `apps/mobile/android/.gradle/`, `apps/mobile/android/build/`, `apps/mobile/android/app/build/`.
7. `.github/workflows/ci.yml`, job `frontend-unit`, depois do passo do shared: 
```yaml
      - name: Configuração da casca Android
        run: pnpm --filter @sgs/mobile test
```
8. `apps/mobile/README.md` (pt-BR, curto): o que é a casca, que as telas vêm do servidor, que não entra no Docker nem no `pnpm build` raiz, como rodar `corepack pnpm --filter @sgs/mobile test`, `corepack pnpm --filter @sgs/mobile exec cap sync android`, que o build é só no GitHub Actions (workflow `android.yml`, 07-06), e que plugins novos precisam da MESMA versão exata em `apps/frontend` e `apps/mobile`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/mobile typecheck && corepack pnpm --filter @sgs/mobile test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "appId: 'br.com.gestorbeauty.app'" apps/mobile/capacitor.config.ts` encontra a linha
    - `grep -n "errorPath: 'offline.html'" apps/mobile/capacitor.config.ts` encontra a linha
    - `grep -c "Capacitor" apps/mobile/www/offline.html` = 0
    - `grep -n "Tentar novamente" apps/mobile/www/offline.html` e `grep -n "Sem conexão" apps/mobile/www/offline.html` encontram as linhas
    - `grep -n "\*.jks" .gitignore` e `grep -n "google-services.json" .gitignore` encontram as linhas
    - `grep -n "@sgs/mobile test" .github/workflows/ci.yml` encontra a linha
    - `corepack pnpm --filter @sgs/mobile test` imprime `check-config: OK`
  </acceptance_criteria>
  <done>Configuração da casca e tela offline prontas e verificadas por script no CI.</done>
</task>

<task type="auto">
  <name>Task 2: Gerar o projeto Android (cap add android), ajustar Gradle, manifesto e tema da splash</name>
  <files>apps/mobile/android/** (gerado), apps/mobile/android/app/build.gradle, apps/mobile/android/variables.gradle, apps/mobile/android/app/src/main/AndroidManifest.xml, apps/mobile/android/app/src/main/res/values/gb_colors.xml, apps/mobile/android/app/src/main/res/values/styles.xml, apps/mobile/scripts/check-config.mjs</files>
  <read_first>
    - apps/mobile/capacitor.config.ts (Task 1)
    - apps/mobile/scripts/check-config.mjs (Task 1)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md ("Assinatura no Gradle", Pitfalls 6, 10, 11; "O template do Capacitor aplica o plugin google-services apenas se app/google-services.json existir")
    - Depois de gerar: apps/mobile/android/app/build.gradle, apps/mobile/android/variables.gradle, apps/mobile/android/app/src/main/AndroidManifest.xml, apps/mobile/android/app/src/main/res/values/styles.xml, apps/mobile/android/.gitignore (ler os arquivos gerados ANTES de editar)
  </read_first>
  <action>
1. `cd /root/sgs/apps/mobile && corepack pnpm exec cap add android && corepack pnpm exec cap sync android`. Não rodar `gradlew`. Commitar `apps/mobile/android/` inteiro respeitando o `android/.gitignore` gerado pelo template (ele já ignora `app/src/main/assets/public`, `capacitor.config.json`, `capacitor.plugins.json`, `capacitor-cordova-android-plugins`). Conferir com `git status apps/mobile/android | head` que `local.properties` e `build/` não entram.
2. `android/variables.gradle`: confirmar `minSdkVersion = 24`, `compileSdkVersion = 36`, `targetSdkVersion = 36` (padrão do Capacitor 8; se vier diferente, ajustar para esses valores).
3. `android/app/build.gradle` (editar o arquivo gerado):
   - `defaultConfig`: manter `applicationId "br.com.gestorbeauty.app"`; trocar `versionCode 1` por `versionCode((project.findProperty('versionCode') ?: '1') as Integer)` e `versionName "1.0"` por `versionName(project.findProperty('versionName') ?: '0.1.0')`.
   - Dentro de `android { }`, antes de `buildTypes`:
```groovy
    // Keystore de upload SÓ por variáveis de ambiente (GitHub Actions, secrets). Nunca no repositório (D-03).
    signingConfigs {
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
    }
```
   - Em `buildTypes { release { ... } }`: acrescentar `signingConfig System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : null` e manter `minifyEnabled false`.
   - Manter intacto o bloco do template que aplica `com.google.gms.google-services` só quando `google-services.json` existe (build debug do CI funciona sem o arquivo; push fica inerte).
4. `res/values/gb_colors.xml`: `<resources><color name="gb_primary">#570080</color><color name="gb_paper">#F7F6F3</color></resources>`.
5. `AndroidManifest.xml`, dentro de `<application>` (antes de `</application>`):
```xml
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="agenda" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_gestor_beauty" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/gb_primary" />
```
   Criar já `res/drawable/ic_stat_gestor_beauty.xml` (vetor branco do ícone de agenda — Material "event", Apache 2.0):
```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M17,12h-5v5h5v-5zM16,1v2L8,3L8,1L6,1v2L5,3c-1.11,0 -1.99,0.9 -1.99,2L3,19c0,1.1 0.89,2 2,2h14c1.1,0 2,-0.9 2,-2L21,5c0,-1.1 -0.9,-2 -2,-2h-1L18,1h-2zM19,19L5,19L5,8h14v11z" />
</vector>
```
   (os arquivos de ícone/splash do launcher vêm no 07-06; este vetor é o ícone da barra de status, D-16 fácil de trocar).
6. `res/values/styles.xml`, no tema de launch gerado (`AppTheme.NoActionBarLaunch`, pai `Theme.SplashScreen`): acrescentar `<item name="windowSplashScreenBackground">@color/gb_paper</item>` (D-17: fundo papel no Android 12+; o ícone central é o ícone adaptativo do app).
7. Confirmar `res/values/strings.xml` com `<string name="app_name">Gestor Beauty</string>` e `<string name="title_activity_main">Gestor Beauty</string>`.
8. Acrescentar ao `check-config.mjs`: `android/app/build.gradle` contém `applicationId "br.com.gestorbeauty.app"`, `ANDROID_KEYSTORE_PATH`, `findProperty('versionCode')`; `android/variables.gradle` contém `targetSdkVersion = 36` e `minSdkVersion = 24`; o manifesto contém `default_notification_channel_id` com `agenda`; `strings.xml` contém `>Gestor Beauty<`; `res/drawable/ic_stat_gestor_beauty.xml` existe; `styles.xml` contém `windowSplashScreenBackground`; nenhum arquivo `*.jks`/`google-services.json` versionado (`git ls-files apps/mobile | grep -E '\.jks$|google-services\.json$'` vazio, via `child_process.execSync`).
9. Rodar `corepack pnpm --filter @sgs/mobile exec cap sync android` de novo e confirmar `git diff --exit-code apps/mobile/android` (sync idempotente — o CI do 07-06 cobra isso).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/mobile exec cap sync android && git diff --exit-code apps/mobile/android && corepack pnpm --filter @sgs/mobile test</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/mobile/android/gradlew && test -f apps/mobile/android/app/build.gradle` sai 0
    - `grep -n 'applicationId "br.com.gestorbeauty.app"' apps/mobile/android/app/build.gradle` encontra a linha
    - `grep -n "targetSdkVersion = 36" apps/mobile/android/variables.gradle` encontra a linha
    - `grep -n "ANDROID_KEYSTORE_PATH" apps/mobile/android/app/build.gradle` encontra ≥ 2 linhas
    - `grep -n "default_notification_channel_id" apps/mobile/android/app/src/main/AndroidManifest.xml` encontra a linha
    - `grep -n "windowSplashScreenBackground" apps/mobile/android/app/src/main/res/values/styles.xml` encontra a linha
    - `git ls-files apps/mobile | grep -E '\.jks$|google-services\.json$|local\.properties$'` sai vazio
    - `corepack pnpm --filter @sgs/mobile test` imprime `check-config: OK`
  </acceptance_criteria>
  <done>Projeto Android gerado e commitado, com assinatura por env, versionCode por propriedade, canal/cor do push e splash papel; sem segredos no git.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/mobile test` e `typecheck` verdes
- `cap sync android` idempotente (`git diff --exit-code apps/mobile/android`)
- Nenhum SDK Android instalado na VPS (`which sdkmanager adb` vazio)
</verification>

<success_criteria>
Casca Capacitor do Gestor Beauty pronta para compilar no CI (C-01), carregando o staging com fallback offline local (C-02), com base do splash/cor (C-05).
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-04-SUMMARY.md`
</output>

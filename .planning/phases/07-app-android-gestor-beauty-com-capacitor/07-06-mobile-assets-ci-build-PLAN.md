---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 06
type: execute
wave: 3
depends_on: ["07-04"]
files_modified:
  - apps/mobile/assets/icon.svg
  - apps/mobile/assets/icon-only.png
  - apps/mobile/assets/icon-foreground.png
  - apps/mobile/assets/icon-background.png
  - apps/mobile/assets/splash.png
  - apps/mobile/assets/splash-dark.png
  - apps/mobile/scripts/render-assets.mjs
  - apps/mobile/scripts/check-config.mjs
  - apps/mobile/package.json
  - apps/mobile/android/app/src/main/res/**
  - apps/mobile/KEYSTORE.md
  - apps/mobile/README.md
  - .github/workflows/android.yml
autonomous: true
requirements: [C-01, C-05]

must_haves:
  truths:
    - "O ícone do app é o monograma 'GB' branco sobre roxo #570080 na tipografia serifada do layout (Source Serif 4), inclusive o ícone adaptativo (D-16)"
    - "Trocar o ícone pelo logo oficial é substituir assets/icon.svg e rodar um comando (D-16)"
    - "A splash tem fundo #F7F6F3 com o ícone no centro (D-17)"
    - "Todo PR/push que mexe em apps/mobile gera um APK debug como artefato no GitHub Actions, em ubuntu-24.04 com JDK 21 (decisão do orquestrador nº 5)"
    - "workflow_dispatch ou tag android-v* gera AAB e APK assinados a partir de secrets; sem secrets o job falha com mensagem clara em pt-BR"
    - "O runbook da keystore documenta onde ela fica, o backup e a regra de usar a MESMA chave de upload no futuro app Expo (D-03), e prioriza a criação da conta Play (D-10)"
  artifacts:
    - path: ".github/workflows/android.yml"
      provides: "Build debug (artefato) e release assinado"
      contains: "java-version: '21'"
    - path: "apps/mobile/assets/icon.svg"
      provides: "Fonte versionada do ícone"
      contains: "GB"
    - path: "apps/mobile/KEYSTORE.md"
      provides: "Runbook de keystore, secrets e Play App Signing"
      contains: "ANDROID_KEYSTORE_BASE64"
  key_links:
    - from: ".github/workflows/android.yml"
      to: "apps/mobile/android/app/build.gradle"
      via: "ANDROID_KEYSTORE_PATH / -PversionCode"
      pattern: "PversionCode"
    - from: ".github/workflows/android.yml"
      to: "git diff --exit-code apps/mobile/android"
      via: "cap sync idempotente (Pitfall 2)"
      pattern: "git diff --exit-code apps/mobile/android"
---

<objective>
Gerar ícone adaptativo e splash do Gestor Beauty a partir de um SVG versionado (D-16/D-17), criar o workflow `android.yml` que compila o APK debug (artefato) e o AAB/APK assinados por secrets, e documentar a guarda da keystore (D-03) e a ordem das ações humanas (conta Play primeiro, D-10).

Purpose: C-01 (app instalável) e C-05 (identidade visual) sem Android SDK na VPS.
Output: assets, recursos Android gerados, workflow, `KEYSTORE.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-04-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. Sem Android SDK na VPS: a rasterização (sharp) e o `@capacitor/assets` rodam em Node puro; o Gradle só no GitHub Actions. Este plano NÃO faz push (o workflow roda de verdade no 07-11); validar o YAML localmente.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ícone GB e splash a partir de SVG, recursos Android gerados</name>
  <files>apps/mobile/assets/icon.svg, apps/mobile/assets/icon-only.png, apps/mobile/assets/icon-foreground.png, apps/mobile/assets/icon-background.png, apps/mobile/assets/splash.png, apps/mobile/assets/splash-dark.png, apps/mobile/scripts/render-assets.mjs, apps/mobile/scripts/check-config.mjs, apps/mobile/package.json, apps/mobile/android/app/src/main/res/**</files>
  <read_first>
    - apps/mobile/scripts/check-config.mjs (07-04)
    - apps/mobile/package.json (devDeps sharp 0.35.5 e @capacitor/assets 4.0.0)
    - apps/frontend/tailwind.config.ts (fontFamily.serif = "Source Serif 4"; primary #570080) — só leitura, não importar
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (seção "Ícone e splash")
  </read_first>
  <action>
1. Fonte: conferir `fc-list | grep -i "Source Serif 4"`. Se ausente, baixar a fonte OFL para o usuário (fora do repo): `mkdir -p ~/.local/share/fonts && curl -fsSL -o ~/.local/share/fonts/SourceSerif4.ttf 'https://github.com/google/fonts/raw/main/ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf' && fc-cache -f`. Se o download falhar, usar `Noto Serif` (já instalada) e registrar no SUMMARY.
2. `assets/icon.svg` (1024×1024, fonte da verdade, editável):
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#570080"/>
  <text x="512" y="512" dominant-baseline="central" text-anchor="middle"
        font-family="'Source Serif 4', 'Noto Serif', Georgia, serif" font-weight="600"
        font-size="400" letter-spacing="-8" fill="#FFFFFF">GB</text>
</svg>
```
3. `scripts/render-assets.mjs` (Node, `import sharp from 'sharp'`), gerando a partir do SVG (texto do SVG lido e variado por substituição, sem segunda fonte da verdade):
   - `icon-only.png` 1024 (SVG como está);
   - `icon-background.png` 1024 sólido `#570080`;
   - `icon-foreground.png` 1024 com fundo TRANSPARENTE e o "GB" com `font-size` 300 (cabe na zona segura central de 66% do ícone adaptativo);
   - `splash.png` e `splash-dark.png` 2732×2732 fundo `#F7F6F3` com o `icon-only` reduzido a 512×512 e cantos arredondados (raio 112) no centro.
   Script npm em `apps/mobile/package.json`: `"assets": "node scripts/render-assets.mjs && capacitor-assets generate --android --assetPath assets --iconBackgroundColor '#570080' --iconBackgroundColorDark '#570080' --splashBackgroundColor '#F7F6F3' --splashBackgroundColorDark '#F7F6F3'"`.
4. Rodar `corepack pnpm --filter @sgs/mobile assets`. Conferir visualmente lendo `apps/mobile/assets/icon-only.png` e `splash.png` com a ferramenta de leitura de imagem (o "GB" precisa estar legível, branco, centralizado; se a fonte cair em outra serifada, aceitar e anotar).
5. Confirmar que o `@capacitor/assets` gerou `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`, `mipmap-*/ic_launcher_foreground.png` e `drawable*/splash.png`; que `res/values/ic_launcher_background.xml` tem `#570080`; e que `res/drawable/ic_stat_gestor_beauty.xml` (07-04) e `res/values/gb_colors.xml` continuam lá. `corepack pnpm --filter @sgs/mobile exec cap sync android` e `git diff --exit-code apps/mobile/android` depois de commitar os recursos.
6. `check-config.mjs`: acrescentar as checagens `assets/icon.svg` contém `>GB<` e `#570080`; existem `assets/icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`; existem `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`, `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` e pelo menos um `android/app/src/main/res/drawable*/splash.png` (procurar com `fs.readdirSync`).
7. README do mobile: seção "Trocar o ícone" = editar `assets/icon.svg` (ou substituir pelos PNGs do logo oficial) e rodar `corepack pnpm --filter @sgs/mobile assets`, depois `cap sync android` e commitar `android/app/src/main/res`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/mobile test && test -f apps/mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml && grep -rn "570080" apps/mobile/android/app/src/main/res/values/ic_launcher_background.xml</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n ">GB<" apps/mobile/assets/icon.svg` encontra a linha
    - `node -e "const s=require('sharp');s('apps/mobile/assets/splash.png').metadata().then(m=>{if(m.width!==2732)process.exit(1)})"` (rodado em apps/mobile) sai 0
    - `test -f apps/mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` sai 0
    - `grep -n '"assets":' apps/mobile/package.json` encontra o script
    - `corepack pnpm --filter @sgs/mobile test` imprime `check-config: OK`
  </acceptance_criteria>
  <done>Ícone adaptativo GB e splash papel gerados e versionados, com troca documentada.</done>
</task>

<task type="auto">
  <name>Task 2: Workflow android.yml (debug APK artefato + release assinado) e runbook KEYSTORE.md</name>
  <files>.github/workflows/android.yml, apps/mobile/KEYSTORE.md, apps/mobile/README.md</files>
  <read_first>
    - .github/workflows/ci.yml (padrão pnpm/action-setup@v4, setup-node 22 com cache pnpm)
    - apps/mobile/android/app/build.gradle (signingConfigs por env, findProperty versionCode/versionName — 07-04)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Workflow esqueleto, Pitfalls 7, 10, 11; "Build, assinatura e guarda da keystore")
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md (D-03, D-09, D-10)
  </read_first>
  <action>
1. `.github/workflows/android.yml` (arquivo novo; NÃO alterar ci.yml):
```yaml
name: Android (Gestor Beauty)

on:
  pull_request:
    paths: ['apps/mobile/**', 'apps/frontend/package.json', 'pnpm-lock.yaml', '.github/workflows/android.yml']
  push:
    branches: [master]
    paths: ['apps/mobile/**', 'apps/frontend/package.json', 'pnpm-lock.yaml', '.github/workflows/android.yml']
    tags: ['android-v*']
  workflow_dispatch:

concurrency:
  group: android-${{ github.ref }}
  cancel-in-progress: true

jobs:
  debug:
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21' }
      - uses: gradle/actions/setup-gradle@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @sgs/mobile test
      - name: cap sync (precisa ser idempotente)
        run: pnpm --filter @sgs/mobile exec cap sync android && git diff --exit-code apps/mobile/android
      - name: google-services.json (opcional no debug)
        env:
          GOOGLE_SERVICES_JSON_BASE64: ${{ secrets.GOOGLE_SERVICES_JSON_BASE64 }}
        run: |
          if [ -n "$GOOGLE_SERVICES_JSON_BASE64" ]; then
            echo "$GOOGLE_SERVICES_JSON_BASE64" | base64 -d > apps/mobile/android/app/google-services.json
            echo "google-services.json restaurado (push ativo no APK debug)"
          else
            echo "Sem GOOGLE_SERVICES_JSON_BASE64: APK debug sem push"
          fi
      - name: APK debug
        working-directory: apps/mobile/android
        run: ./gradlew assembleDebug -PversionCode=$((1000 + ${{ github.run_number }})) -PversionName=$(node -p "require('../package.json').version")
      - uses: actions/upload-artifact@v4
        with:
          name: gestor-beauty-debug-apk
          path: apps/mobile/android/app/build/outputs/apk/debug/*.apk
          retention-days: 14

  release:
    if: github.event_name == 'workflow_dispatch' || startsWith(github.ref, 'refs/tags/android-v')
    needs: debug
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    steps:
      # checkout, pnpm, node 22, java 21, setup-gradle, install, cap sync — iguais ao job debug
      - name: Conferir segredos
        env:
          KS: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          KSP: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          KA: ${{ secrets.ANDROID_KEY_ALIAS }}
          KP: ${{ secrets.ANDROID_KEY_PASSWORD }}
          GS: ${{ secrets.GOOGLE_SERVICES_JSON_BASE64 }}
        run: |
          for v in KS KSP KA KP GS; do
            if [ -z "${!v}" ]; then echo "::error::Faltam os secrets do Android (ver apps/mobile/KEYSTORE.md)"; exit 1; fi
          done
      - name: Restaurar keystore e google-services.json
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > "$RUNNER_TEMP/upload.jks"
          echo "${{ secrets.GOOGLE_SERVICES_JSON_BASE64 }}" | base64 -d > apps/mobile/android/app/google-services.json
      - name: AAB e APK assinados
        working-directory: apps/mobile/android
        env:
          ANDROID_KEYSTORE_PATH: ${{ runner.temp }}/upload.jks
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: ./gradlew bundleRelease assembleRelease -PversionCode=$((1000 + ${{ github.run_number }})) -PversionName=$(node -p "require('../package.json').version")
      - uses: actions/upload-artifact@v4
        with:
          name: gestor-beauty-release
          path: |
            apps/mobile/android/app/build/outputs/bundle/release/*.aab
            apps/mobile/android/app/build/outputs/apk/release/*.apk
          retention-days: 30
      - name: Apagar segredos do runner
        if: always()
        run: rm -f "$RUNNER_TEMP/upload.jks" apps/mobile/android/app/google-services.json
```
   (No job `release`, escrever por extenso os passos de checkout/pnpm/node/java/gradle/install/cap sync — YAML não tem herança.)
2. Validar o YAML localmente: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/android.yml'))"` e, se disponível, `gh workflow view` só depois do push (07-11).
3. `apps/mobile/KEYSTORE.md` (pt-BR, SEM segredos), seções:
   - **Ordem das ações humanas (prioridade):** 1) criar a conta de desenvolvedor Google Play pessoa física no nome da usuária (US$ 25, verificação de identidade pode levar dias — começar primeiro, D-10); 2) projeto Firebase com o app Android `br.com.gestorbeauty.app`; 3) keystore e secrets (07-12).
   - **Keystore de upload (D-03):** comando `keytool -genkeypair -v -storetype PKCS12 -keystore gestor-beauty-upload.jks -alias gestorbeauty -keyalg RSA -keysize 2048 -validity 10000`; onde guardar (gerenciador de senhas da usuária com o `.jks` anexado + senhas + alias, e uma segunda cópia offline); nunca no git nem no servidor depois do backup; tabela "Impressões digitais" com SHA-1 e SHA-256 a preencher no 07-12 (`keytool -list -v -keystore ... -alias gestorbeauty`).
   - **Secrets do GitHub:** `ANDROID_KEYSTORE_BASE64` (`base64 -w0 gestor-beauty-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`gestorbeauty`), `ANDROID_KEY_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64`; comando `gh secret set NOME < arquivo`.
   - **Service account do FCM (backend):** separada da keystore; vai só em `.env.staging` como `FCM_SERVICE_ACCOUNT_JSON` (base64).
   - **Play App Signing:** ativar no primeiro upload do AAB; a chave de upload fica com a usuária, a de assinatura com o Google; perda da chave de upload = pedir reset no suporte da Play (não substitui o backup).
   - **Futuro app Expo (D-03):** mesmo appId `br.com.gestorbeauty.app`, mesma chave de upload (importada no EAS), mesmo projeto Firebase e `google-services.json` → sai como atualização do mesmo app.
   - **Gerar um build:** APK debug sai em todo push que mexe em `apps/mobile`; release: `gh workflow run android.yml --ref master` ou tag `android-v0.1.0`; baixar com `gh run download <id> -n gestor-beauty-release`.
   - **Teste antes da conta Play (D-10):** instalar o APK por `adb install -r app-release.apk` num aparelho com depuração USB ligada; desde 30/09/2026 o Brasil exige verificação de desenvolvedor para sideload em aparelhos certificados (Pitfall 7) — se o Android bloquear a instalação pelo arquivo, usar `adb install` ou o fluxo avançado das opções do desenvolvedor.
4. README do mobile: link para `KEYSTORE.md` e para o workflow.
  </action>
  <verify>
    <automated>cd /root/sgs && python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/android.yml')); assert 'debug' in d['jobs'] and 'release' in d['jobs']" && grep -n "java-version: '21'" .github/workflows/android.yml && grep -n "ANDROID_KEYSTORE_BASE64" apps/mobile/KEYSTORE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "runs-on: ubuntu-24.04" .github/workflows/android.yml` encontra 2 linhas
    - `grep -c "java-version: '21'" .github/workflows/android.yml` = 2
    - `grep -n "gestor-beauty-debug-apk" .github/workflows/android.yml` e `grep -n "gestor-beauty-release" .github/workflows/android.yml` encontram as linhas
    - `grep -n "git diff --exit-code apps/mobile/android" .github/workflows/android.yml` encontra ≥ 1 linha
    - `grep -n "android-v\*" .github/workflows/android.yml` encontra a linha
    - `grep -n "conta de desenvolvedor Google Play" apps/mobile/KEYSTORE.md` encontra a linha
    - `grep -n "mesma chave de upload" apps/mobile/KEYSTORE.md` encontra a linha
    - `git diff --stat .github/workflows/ci.yml` vazio neste plano
  </acceptance_criteria>
  <done>Workflow pronto para gerar APK debug e AAB/APK assinados; runbook da keystore documentado sem segredos.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/mobile test` verde (inclui ícones/splash)
- YAML do workflow válido
- Nenhum segredo versionado (`git ls-files | grep -E '\.jks$|google-services\.json$'` vazio)
</verification>

<success_criteria>
Identidade visual provisória do app (D-16/D-17, C-05) e pipeline de build Android no GitHub Actions (C-01) prontos; ações humanas documentadas na ordem certa.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-06-SUMMARY.md`
</output>

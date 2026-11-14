---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 12
type: execute
wave: 6
depends_on: ["07-11"]
files_modified:
  - apps/mobile/KEYSTORE.md
autonomous: false
requirements: [C-01, C-03]
user_setup:
  - service: firebase
    why: "Envio de push (FCM) para o app br.com.gestorbeauty.app"
    env_vars:
      - name: FCM_SERVICE_ACCOUNT_JSON
        source: "Firebase Console -> Configurações do projeto -> Contas de serviço -> Gerar nova chave privada (JSON, em base64 no .env.staging)"
    dashboard_config:
      - task: "Criar o projeto 'Gestor Beauty' e registrar o app Android br.com.gestorbeauty.app; baixar google-services.json"
        location: "https://console.firebase.google.com"
  - service: google-play-console
    why: "Distribuição pelo teste interno (D-09/D-10)"
    dashboard_config:
      - task: "Criar conta de desenvolvedor pessoa física no nome da usuária (US$ 25) e concluir a verificação de identidade"
        location: "https://play.google.com/console/signup"

must_haves:
  truths:
    - "Existe um projeto Firebase com o app Android br.com.gestorbeauty.app e o backend do staging envia push com a service account (log 'Push FCM habilitado')"
    - "A keystore de upload existe, com backup confirmado pela usuária no gerenciador de senhas e numa segunda cópia offline, e não fica no repositório nem no servidor (D-03)"
    - "Os secrets ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD e GOOGLE_SERVICES_JSON_BASE64 estão no GitHub e o workflow gera AAB e APK assinados"
    - "As impressões digitais SHA-1/SHA-256 da chave de upload estão registradas no KEYSTORE.md (sem segredos)"
    - "A criação da conta Play da usuária foi iniciada (prioridade, D-10)"
  artifacts:
    - path: "apps/mobile/KEYSTORE.md"
      provides: "Impressões digitais da chave de upload e data do backup"
      contains: "SHA-256"
  key_links:
    - from: ".env.staging"
      to: "FcmPushProvider"
      via: "FCM_SERVICE_ACCOUNT_JSON"
      pattern: "FCM_SERVICE_ACCOUNT_JSON"
    - from: "GitHub secrets"
      to: ".github/workflows/android.yml job release"
      via: "ANDROID_KEYSTORE_BASE64 etc."
      pattern: "gestor-beauty-release"
---

<objective>
Fazer, com a usuária, o que só ela pode fazer (criar Firebase, iniciar a conta Play, guardar a keystore) e automatizar o resto (gerar a keystore, cadastrar os secrets no GitHub, ligar o FCM no staging, gerar o build assinado).

Purpose: sem isso o push não sai de verdade e não há AAB para a Play (C-01/C-03). O código já funciona sem estas credenciais (push no-op, APK debug), então este plano não bloqueia a execução autônoma anterior.
Output: Firebase ligado ao staging, secrets no GitHub, AAB/APK assinados como artefato, keystore com backup confirmado.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/mobile/KEYSTORE.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-11-SUMMARY.md

**Segredos:** nada de senha, JSON de service account, `google-services.json` ou `.jks` em commit, log de CI, SUMMARY ou resposta ao usuário. Pasta de trabalho temporária na VPS: `/root/gestor-beauty-secrets` com `chmod 700` (fora do repo). Os comandos de backup e deploy são os do 07-11.
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Usuária cria o projeto Firebase e inicia a conta Google Play</name>
  <files>/root/gestor-beauty-secrets/ (fora do repo; nenhum arquivo versionado)</files>
  <read_first>
    - apps/mobile/KEYSTORE.md (seção "Ordem das ações humanas")
  </read_first>
  <what-built>Código do app e do push já está no staging, esperando as credenciais. Antes de apresentar, o executor roda `mkdir -p /root/gestor-beauty-secrets && chmod 700 /root/gestor-beauty-secrets`.</what-built>
  <how-to-verify>
Apresentar à usuária, em pt-BR, exatamente estes passos:

**A. Conta do Google Play (comece por aqui — a verificação pode levar dias)**
1. Acesse https://play.google.com/console/signup com a sua conta Google.
2. Escolha **"Para você" (pessoa física)**, pague a taxa única de US$ 25 e envie o documento pedido para a verificação de identidade.
3. Não precisa esperar a aprovação para seguir com o passo B. Quando a conta for aprovada, me avise (é usada no próximo plano).

**B. Firebase (para as notificações)**
1. Acesse https://console.firebase.google.com e clique em **"Criar um projeto"**. Nome: **Gestor Beauty**. O Google Analytics pode ficar desligado.
2. Na tela do projeto, clique no ícone do **Android** ("Adicionar app"). Em "Nome do pacote do Android" digite exatamente **br.com.gestorbeauty.app**; apelido: **Gestor Beauty**. Não precisa preencher o SHA-1. Clique em **Registrar app**.
3. Clique em **"Fazer o download do google-services.json"**. Pode pular os passos seguintes do assistente (o código já está pronto).
4. Engrenagem → **Configurações do projeto** → aba **Contas de serviço** → **"Gerar nova chave privada"** → confirme. Vai baixar um arquivo `.json` (é uma senha: não mande por WhatsApp nem e-mail).
5. Envie os dois arquivos para o servidor, na pasta `/root/gestor-beauty-secrets/`, com estes nomes: `google-services.json` e `fcm-service-account.json` (por `scp`, ou me peça e eu explico outro jeito seguro).
  </how-to-verify>
  <resume-signal>Responda "firebase pronto" quando os dois arquivos estiverem no servidor, e diga em que pé está a conta Play (criada / em verificação / aprovada).</resume-signal>
  <acceptance_criteria>
    - `test -s /root/gestor-beauty-secrets/google-services.json && test -s /root/gestor-beauty-secrets/fcm-service-account.json` sai 0
    - `python3 -c "import json;d=json.load(open('/root/gestor-beauty-secrets/google-services.json'));assert any(c['client_info']['android_client_info']['package_name']=='br.com.gestorbeauty.app' for c in d['client'])"` sai 0
    - `python3 -c "import json;d=json.load(open('/root/gestor-beauty-secrets/fcm-service-account.json'));assert d['type']=='service_account' and d['project_id']"` sai 0
  </acceptance_criteria>
  <action>Antes de apresentar: `mkdir -p /root/gestor-beauty-secrets && chmod 700 /root/gestor-beauty-secrets`. Apresentar os passos A e B do `<how-to-verify>` e esperar o sinal. Depois do sinal, rodar as checagens do `<acceptance_criteria>`; se alguma falhar (pacote errado, arquivo trocado), explicar em pt-BR o que corrigir e esperar de novo. Nunca imprimir o conteúdo dos arquivos.</action>
  <verify>
    <automated>test -s /root/gestor-beauty-secrets/google-services.json && test -s /root/gestor-beauty-secrets/fcm-service-account.json</automated>
  </verify>
  <done>Os dois arquivos do Firebase estão no servidor, com o pacote br.com.gestorbeauty.app, e a conta Play foi iniciada.</done>
</task>

<task type="auto">
  <name>Task 2: Gerar a keystore, cadastrar secrets, ligar o FCM no staging e gerar o build assinado</name>
  <files>apps/mobile/KEYSTORE.md</files>
  <read_first>
    - apps/mobile/KEYSTORE.md
    - .github/workflows/android.yml (job release e nomes dos secrets)
    - .env.staging.example (bloco da Fase 7)
    - scripts/deploy-staging.sh
  </read_first>
  <action>
1. Keystore (D-03), em `/root/gestor-beauty-secrets`: gerar senhas com `openssl rand -base64 24 | tr -d '/+=' | cut -c1-24` (uma para a store, outra para a chave), gravar em `credenciais-keystore.txt` (chmod 600, com alias `gestorbeauty` e as duas senhas) e rodar `keytool -genkeypair -v -storetype PKCS12 -keystore gestor-beauty-upload.jks -alias gestorbeauty -keyalg RSA -keysize 2048 -validity 10000 -storepass "$STOREPASS" -keypass "$KEYPASS" -dname "CN=Gestor Beauty, O=Gestor Beauty, C=BR"`. (Em PKCS12 a senha da chave costuma ser igual à da store; se o keytool avisar, usar a mesma senha nas duas e registrar assim.)
2. Impressões digitais: `keytool -list -v -keystore gestor-beauty-upload.jks -alias gestorbeauty -storepass "$STOREPASS" | grep -E 'SHA1:|SHA256:'` → preencher a tabela "Impressões digitais" do `apps/mobile/KEYSTORE.md` com SHA-1 e SHA-256 e a data de geração (são públicas; senhas NÃO).
3. Secrets do GitHub (sem ecoar valores): `base64 -w0 gestor-beauty-upload.jks | gh secret set ANDROID_KEYSTORE_BASE64`; `printf '%s' "$STOREPASS" | gh secret set ANDROID_KEYSTORE_PASSWORD`; `printf 'gestorbeauty' | gh secret set ANDROID_KEY_ALIAS`; `printf '%s' "$KEYPASS" | gh secret set ANDROID_KEY_PASSWORD`; `base64 -w0 google-services.json | gh secret set GOOGLE_SERVICES_JSON_BASE64`. Conferir com `gh secret list` (só nomes).
4. FCM no staging: backup NÃO é necessário (sem migration). Acrescentar/atualizar no `.env.staging` a linha `FCM_SERVICE_ACCOUNT_JSON=<base64 -w0 fcm-service-account.json>` (editar com `python3`/`sed` sem imprimir o valor), confirmar `PUSH_NOTIFICATIONS_WORKER=true`, e subir só o backend: `docker compose -f docker-compose.staging.yml --env-file .env.staging up -d backend`. Conferir `docker logs sgs_stg_backend 2>&1 | grep -c "Push FCM habilitado"` ≥ 1.
5. Build assinado: `gh workflow run android.yml --ref master`, `gh run watch <id>` até verde; `gh run download <id> -n gestor-beauty-release -D /root/gestor-beauty-apks/release-$(date +%Y%m%d)`; conferir que há um `.aab` e um `.apk`.
6. Commit `docs(07-12): impressões digitais da chave de upload` (só o KEYSTORE.md) e push.
  </action>
  <verify>
    <automated>cd /root/sgs && gh secret list | grep -cE "^(ANDROID_KEYSTORE_BASE64|ANDROID_KEYSTORE_PASSWORD|ANDROID_KEY_ALIAS|ANDROID_KEY_PASSWORD|GOOGLE_SERVICES_JSON_BASE64)\b" | grep -x 5 && docker logs sgs_stg_backend 2>&1 | grep -q "Push FCM habilitado" && ls /root/gestor-beauty-apks/release-*/*.aab</automated>
  </verify>
  <acceptance_criteria>
    - `gh secret list` mostra os 5 secrets
    - `docker logs sgs_stg_backend 2>&1 | grep "Push FCM habilitado"` encontra a linha
    - `ls /root/gestor-beauty-apks/release-*/*.aab /root/gestor-beauty-apks/release-*/*.apk` encontra os dois
    - `grep -n "SHA-256" apps/mobile/KEYSTORE.md` mostra a impressão preenchida (não o placeholder)
    - `git ls-files | grep -E '\.jks$|google-services\.json$|credenciais'` vazio
  </acceptance_criteria>
  <done>Push real ligado no staging e AAB/APK assinados gerados com a chave de upload.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Usuária guarda a keystore em dois lugares; depois as cópias do servidor são apagadas</name>
  <files>apps/mobile/KEYSTORE.md</files>
  <read_first>
    - apps/mobile/KEYSTORE.md (seção "Keystore de upload")
  </read_first>
  <what-built>Keystore `/root/gestor-beauty-secrets/gestor-beauty-upload.jks` e `credenciais-keystore.txt` gerados; secrets no GitHub; AAB/APK assinados em `/root/gestor-beauty-apks/`.</what-built>
  <how-to-verify>
Apresentar à usuária, em pt-BR:
1. Esta chave é o que permite publicar **atualizações** do Gestor Beauty na loja, inclusive o app novo (Expo) no futuro. Sem ela, só com pedido ao suporte do Google.
2. Baixe do servidor os arquivos `/root/gestor-beauty-secrets/gestor-beauty-upload.jks` e `/root/gestor-beauty-secrets/credenciais-keystore.txt` (por `scp`, ou peça ajuda).
3. Guarde no **gerenciador de senhas** (ex.: Bitwarden, 1Password ou Google Senhas): crie um item "Gestor Beauty — chave de upload Android", anexe o `.jks` e cole o conteúdo do `credenciais-keystore.txt`.
4. Faça uma **segunda cópia offline** (pendrive ou outro armazenamento seu, fora deste servidor).
5. Depois de conferir que as duas cópias abrem, responda "backup feito". Aí eu apago as cópias do servidor (o GitHub fica com a versão cifrada nos secrets).
  </how-to-verify>
  <resume-signal>Responda "backup feito" (ou descreva o problema).</resume-signal>
  <action>Depois do "backup feito": `shred -u /root/gestor-beauty-secrets/gestor-beauty-upload.jks /root/gestor-beauty-secrets/credenciais-keystore.txt /root/gestor-beauty-secrets/fcm-service-account.json /root/gestor-beauty-secrets/google-services.json` (o FCM já está no `.env.staging` e o google-services no secret) e registrar no `KEYSTORE.md` a linha `Backup confirmado em AAAA-MM-DD: gerenciador de senhas da usuária + cópia offline` (data real) e os locais em termos genéricos ("gerenciador de senhas da usuária" + "cópia offline"), sem caminhos pessoais. Commit `docs(07-12): backup da chave de upload registrado`.</action>
  <acceptance_criteria>
    - `ls /root/gestor-beauty-secrets/*.jks 2>/dev/null | wc -l` = 0
    - `grep -nE "Backup confirmado em 20[0-9]{2}-[0-9]{2}-[0-9]{2}" apps/mobile/KEYSTORE.md` encontra a linha
  </acceptance_criteria>
  <verify>
    <automated>test $(ls /root/gestor-beauty-secrets/*.jks 2>/dev/null | wc -l) -eq 0 && grep -qE "Backup confirmado em 20[0-9]{2}-[0-9]{2}-[0-9]{2}" /root/sgs/apps/mobile/KEYSTORE.md</automated>
  </verify>
  <done>Keystore com backup duplo confirmado pela usuária e removida do servidor.</done>
</task>

</tasks>

<verification>
- 5 secrets no GitHub; backend do staging com "Push FCM habilitado"; AAB e APK assinados gerados
- Keystore só com a usuária (2 cópias) e cifrada no GitHub; nada no repo nem no servidor
</verification>

<success_criteria>
Credenciais reais no lugar certo (D-03, D-04, D-10): push de verdade no staging e build assinado pronto para o teste interno.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-12-SUMMARY.md`
</output>

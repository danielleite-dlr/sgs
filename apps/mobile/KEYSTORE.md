# Keystore, secrets e publicação — Gestor Beauty

Este documento NÃO contém segredos. Nada daqui (nem o `.jks`, nem senhas, nem `google-services.json`) vai para o git.

## Ordem das ações humanas (prioridade)

1. **Criar a conta de desenvolvedor Google Play** (pessoa física, no nome da usuária; taxa única de US$ 25). A verificação de identidade pode levar dias, então este é o primeiro passo (D-10).
2. **Projeto Firebase** com o app Android `br.com.gestorbeauty.app` (gera o `google-services.json` e a service account do FCM).
3. **Keystore e secrets do GitHub** (plano 07-12).

## Keystore de upload (D-03)

Gerar (uma única vez):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore gestor-beauty-upload.jks \
  -alias gestorbeauty -keyalg RSA -keysize 2048 -validity 10000
```

Onde guardar:

- No gerenciador de senhas da usuária, com o `.jks` anexado, as senhas e o alias.
- Uma segunda cópia offline (pen drive ou disco guardado em local seguro).
- Nunca no git e nunca deixar no servidor depois do backup.

### Impressões digitais (geradas em 2026-11-17, validade até 2054-04-04)

| Algoritmo | Valor |
| --------- | ----- |
| SHA-1     | `E8:DF:5F:D5:C2:5D:0E:BE:96:BE:E4:96:DB:42:13:92:AD:5D:E0:18` |
| SHA-256   | `91:75:A8:ED:AD:B8:41:4F:9E:62:A7:35:FB:AF:3C:62:7D:37:84:95:EE:66:48:04:E3:C6:B5:2F:11:01:F2:EC` |

Obter com `keytool -list -v -keystore gestor-beauty-upload.jks -alias gestorbeauty`.

## Secrets do GitHub

| Secret | Conteúdo |
| ------ | -------- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 gestor-beauty-upload.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `gestorbeauty` |
| `ANDROID_KEY_PASSWORD` | senha da chave |
| `GOOGLE_SERVICES_JSON_BASE64` | `base64 -w0 google-services.json` |

Cadastro: `gh secret set NOME < arquivo` (para os valores em base64, gerar o arquivo com o comando da tabela).

## Service account do FCM (backend)

É separada da keystore. Vai somente em `.env.staging` como `FCM_SERVICE_ACCOUNT_JSON` (em base64). Não é secret do GitHub.

## Play App Signing

Ativar no primeiro upload do AAB. A chave de upload fica com a usuária; a chave de assinatura final fica com o Google. Se a chave de upload for perdida, é preciso pedir o reset no suporte da Play, o que não substitui o backup.

## Futuro app Expo (D-03)

Usar o mesmo appId `br.com.gestorbeauty.app`, a mesma chave de upload (importada no EAS), o mesmo projeto Firebase e o mesmo `google-services.json`. Assim o app novo sai como atualização do mesmo app, sem perder instalações.

## Gerar um build

- O APK debug sai em todo push ou PR que mexe em `apps/mobile` (artefato `gestor-beauty-debug-apk`).
- Release: `gh workflow run android.yml --ref master` ou criar a tag `android-v0.1.0`. Sem os secrets, o job falha com a mensagem "Faltam os secrets do Android".
- Baixar: `gh run download <id> -n gestor-beauty-release`.

## Teste antes da conta Play (D-10)

Instalar o APK por `adb install -r app-release.apk` em um aparelho com depuração USB ligada. Desde 30/09/2026 o Brasil exige verificação de desenvolvedor para instalar por sideload em aparelhos certificados. Se o Android bloquear a instalação pelo arquivo, usar o `adb install` ou o fluxo avançado das opções do desenvolvedor.

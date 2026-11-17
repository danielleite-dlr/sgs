# Fase 8: App iPhone Gestor Beauty instalável com notificações - Pesquisa

**Pesquisado em:** 2026-11-17
**Domínio:** Web Push (VAPID) para PWA instalada no iOS, reaproveitando o push da fase 7 (device_tokens, PushService, BullMQ)
**Confiança geral:** ALTA para o backend e a infra (código lido); MÉDIA para o comportamento exato do iOS (documentação Apple + fontes secundárias; só o iPhone real confirma)

<user_constraints>
## Restrições da usuária (de 08-CONTEXT.md)

### Decisões travadas
- D-01: Botão "Instalar no iPhone" na tela de login, ao lado do "Baixar app Android" (quick 261117-2pd). Só aparece em iPhone/iPad (inclui iPadOS que se apresenta como Mac com touch) e fora do modo instalado (`display-mode: standalone` / `navigator.standalone`). Abre um passo a passo: Safari → Compartilhar → Adicionar à Tela de Início. Fora do Safari, avisar que precisa abrir no Safari.
- D-02: Web app manifest com nome "Gestor Beauty", ícone GB roxo (mesma arte do Android, fase 7 07-06), `apple-touch-icon`, `display: standalone`, `theme_color`/`background_color` do tema Gestor Beauty, `start_url` e `scope` do app.
- D-03: Não é PWA offline: o service worker NÃO faz cache do sistema (fora do escopo). Ele só trata `push` e `notificationclick`.
- D-04: Service worker com `push` (mostra título/corpo vindos do payload) e `notificationclick` abrindo/focando o app na rota da notificação, usando a mesma rota segura do Android (validação de rota da fase 7, `?agendamento=` na agenda do dia).
- D-05: Botão "Ativar notificações" dentro do app instalado (o iOS exige gesto da usuária; iOS 16.4+). Só aparece quando instalado, com suporte a Push e permissão ainda não concedida. Mostrar estado (ativado / bloqueado nas configurações / iOS antigo sem suporte).
- D-06: Logout desinscreve (remove o registro no backend e chama `unsubscribe`), igual ao Android.
- D-07: No app Android (casca Capacitor) nada muda: o caminho FCM nativo continua; o Web Push só entra quando não é Capacitor nativo.
- D-08: Segundo canal Web Push (VAPID) ao lado do FCM, reaproveitando `device_tokens` (provider `webpush`, platform `ios`), os mesmos destinatários, textos, rotas e a mesma fila/worker da fase 7. A inscrição (endpoint + chaves p256dh/auth) é guardada no registro do aparelho.
- D-09: Inscrição inválida (HTTP 404/410 do serviço de push) é removida, como o FCM faz com token inválido.
- D-10: Chaves VAPID (pública, privada, subject) no `.env.staging` e no schema de env; a pública chega ao frontend (env de build ou query). Sem chaves → canal desligado sem derrubar o boot.
- D-11: nginx sem cache para `sw.js` e manifest (`Cache-Control: no-cache`), tipo correto do manifest.

### Critério do Claude (discricionário)
- Biblioteca Web Push no backend (ex.: `web-push`), formato exato do payload, onde guardar as chaves da inscrição (colunas novas vs JSON), como o frontend recebe a chave pública, divisão em planos/ondas.
- Texto exato do passo a passo e dos estados do botão, seguindo o visual Gestor Beauty existente.

### Ideias adiadas (FORA DE ESCOPO)
- App Store / TestFlight / app nativo iOS.
- Modo offline do sistema (cache de telas e dados).
</user_constraints>

<phase_requirements>
## Requisitos da fase

Sem IDs mapeados no REQUIREMENTS.md (TBD). A cobertura é pelas decisões D-01..D-11.

| ID | Descrição | Apoio da pesquisa |
|----|-----------|-------------------|
| D-01 | Botão "Instalar no iPhone" no login | Seção "Frontend: instalação" e detecção iOS/iPadOS |
| D-02 | Manifest + ícones + apple-touch-icon | Seção "Manifest e ícones" |
| D-03 | SW só push/click, sem cache | Seção "Service worker" e armadilha do nginx |
| D-04 | push + notificationclick com rota segura | Seção "Service worker", terceira cópia de `isAllowedPushRoute` |
| D-05 | Botão "Ativar notificações" (gesto) | Seção "Frontend: ativação" |
| D-06 | Logout desinscreve | Seção "Logout" |
| D-07 | Android inalterado | Gate `isNativeApp()` |
| D-08 | Canal Web Push no mesmo pipeline | Seção "Backend: seam" e "Migration" |
| D-09 | 404/410 remove inscrição | Mapeamento de erros do `web-push` |
| D-10 | Chaves VAPID, boot sem chaves, chave pública ao frontend | Seção "Env e chave pública" |
| D-11 | nginx no-cache sw.js/manifest | Seção "nginx" |
</phase_requirements>

## Resumo

O pipeline da fase 7 já separa bem as peças: `PushService.dispatch` resolve destinatários, monta o texto por pessoa e envia por um `PushProvider` (interface `send(token, message)` com retorno `sent | invalid_token | failed`). A limpeza de token inválido, o retry do BullMQ e o flag `PUSH_NOTIFICATIONS_WORKER` ficam todos no `PushService`/`PushModule`. Para o Web Push basta um segundo provider (`WebPushProvider`) e fazer o `dispatch` consultar tokens de `fcm` e de `webpush`, enviando cada item pelo provider do seu tipo. Nenhum hook de evento, resolução de alvo ou texto muda.

Duas descobertas pesam no plano. (1) `web-push@4.0.0` (publicada em 06/11/2026) virou **ESM-only e sem tipos**; o backend é CommonJS com jest 29, então a versão a usar é **`web-push@3.6.7` fixa (sem `^`) + `@types/web-push@3.6.4`**. Testei: carrega por `require` e gera chaves; erro de rede vem sem `statusCode` (`ECONNREFUSED`), erro HTTP vem como `WebPushError` com `statusCode`. (2) O `apps/frontend/nginx.conf` do container tem uma regra por regex `\.(js|css|...)$` com `Cache-Control: public, immutable` por 1 ano: `sw.js` casaria com ela. Precisa de um `location = /sw.js` exato (exato vence regex) com `no-cache`; sem isso o iPhone fica preso a um service worker antigo. Além disso, sem `sw.js` o fallback da SPA devolve `index.html` com 200 e `text/html`, o que o registro do SW rejeita com erro confuso.

No iOS, Web Push só funciona em app adicionado à Tela de Início, iOS/iPadOS 16.4+, com permissão pedida num gesto da usuária e `userVisibleOnly: true`; todo `push` precisa terminar em `showNotification` (o Safari revoga a inscrição de sites que recebem push sem mostrar notificação). Recomendo o **SW clássico** (evento `push`), não o Declarative Web Push do iOS 18.4: o clássico cobre 16.4+ (o declarativo só 18.4+), permite `data.route` e o `notificationclick` próprio, e o código fica num único caminho.

**Recomendação principal:** `web-push@3.6.7` como segundo provider no `PushService` (colunas novas `p256dh`/`auth`, `token` = endpoint, provider `webpush`), `public/sw.js` simples + `manifest.webmanifest`, chave pública entregue por query GraphQL autenticada, `location = /sw.js` e `/manifest.webmanifest` no nginx do container, e verificação final no iPhone real.

## Stack padrão

### Núcleo
| Biblioteca | Versão | Propósito | Por quê |
|------------|--------|-----------|---------|
| `web-push` | **3.6.7 (fixa)** | Criptografia aes128gcm + assinatura VAPID + POST ao serviço de push | Padrão de fato (web-push-libs); CJS, sem dependência nativa, `engines >=16`, roda no `node:22-alpine` do Dockerfile do backend |
| `@types/web-push` | 3.6.4 (dev) | Tipos | `web-push` 3.x não traz tipos |

**NÃO usar `web-push@4.0.0`:** é `"type": "module"`, sem `exports`/`types`; o backend é CommonJS (`tsconfig module: CommonJS`) e jest 29 não carrega ESM puro sem configuração extra. (Verificado abrindo o tarball: `package.json` da 4.0.0 e da 3.6.7.) Se algum dia o backend migrar para ESM, reavaliar.

### Frontend
Nenhuma dependência nova. Não adicionar `vite-plugin-pwa`/Workbox: não há SW nem manifest hoje (só `public/favicon.svg`; `index.html` sem `<link rel="manifest">`), e D-03 proíbe cache. Um `public/sw.js` escrito à mão é copiado intacto pelo Vite para `dist/sw.js` (sem hash, sem transformação).

### Alternativas consideradas
| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| `web-push` | `fetch` + `crypto` próprios (RFC 8291/8292) | Reimplementar criptografia ECDH/HKDF/aes128gcm e JWT ES256: risco alto, sem ganho |
| SW clássico | Declarative Web Push (iOS 18.4+) | Exige iOS 18.4+, payload no formato `web_push: 8030`, perde controle do clique; só vale como melhoria futura |
| Colunas `p256dh`/`auth` | `token` = JSON da inscrição | Evita parte da migration, mas o unique (org, provider, token) passa a depender das chaves e os logs/`slice(-6)` ficam sem sentido |
| Query GraphQL da chave pública | `VITE_VAPID_PUBLIC_KEY` no build | Ver seção "Env e chave pública" |

**Instalação (backend):**
```bash
pnpm --filter @sgs/backend add web-push@3.6.7 --save-exact
pnpm --filter @sgs/backend add -D @types/web-push@3.6.4 --save-exact
```
Versões conferidas em `npm view` em 17/11/2026: `web-push` latest = 4.0.0 (10/11/2026); 3.6.7 é a última 3.x; `@types/web-push` = 3.6.4.

**Gerar as chaves VAPID (uma vez):** `npx web-push generate-vapid-keys --json` (par base64url; pública 87 chars, privada 43).

## Padrões de arquitetura

### Estrutura proposta
```
apps/backend/
├── prisma/migrations/20261121000000_device_tokens_webpush/migration.sql
├── src/push/
│   ├── web-push.provider.ts          # WebPushProvider + Noop (espelha fcm-push.provider.ts)
│   ├── web-push.provider.spec.ts
│   ├── web-push-credentials.ts       # lê VAPID_* do env; nunca lança
│   ├── push.types.ts                 # PushTarget/PushSendInput ganha p256dh/auth + provider
│   ├── push.service.ts               # dispatch: tokens fcm+webpush, item.provider
│   ├── push.module.ts                # novo provider WEBPUSH_PROVIDER
│   ├── device-tokens.service.ts      # provider 'webpush' + validação do endpoint
│   └── push-config.resolver.ts       # query pushConfig { webPushPublicKey }
├── src/graphql/schema/device-tokens.graphql   # inputs p256dh/auth, query pushConfig
apps/frontend/
├── public/{sw.js, manifest.webmanifest, icons/*.png, apple-touch-icon.png}
├── index.html                        # <link rel=manifest>, apple-touch-icon, metas iOS
├── nginx.conf                        # location = /sw.js e /manifest.webmanifest
└── src/infrastructure/webpush/
    ├── platform-ios.ts               # isIos(), isStandalone(), supportsWebPush()
    ├── web-push-client.ts            # register SW, subscribe, unsubscribe, estados
    ├── WebPushBridge.tsx             # ouve mensagens do SW e navega com rota segura
    ├── EnableNotificationsButton.tsx
    └── InstallIphoneButton.tsx / InstallIphoneDialog.tsx
```

### Backend: o seam

Estado atual (lido do código):
- `PushProvider.send(token: string, message: PushMessage)`; `PUSH_PROVIDER` é um único provider injetado por `createPushProvider(config.fcmServiceAccount)`.
- `PushService.dispatch` retorna `skipped: 'disabled'` se `!provider.enabled`; busca `deviceToken.findMany({ provider: 'fcm' })` e dedupe por `token`; envia em lotes de 10; remove `invalid_token` por `deleteMany({id in})`; lança `Error('FCM indisponível: nova tentativa')` quando `sent === 0 && invalid === 0 && allRetryable` (BullMQ refaz).
- O worker só existe se `PUSH_NOTIFICATIONS_WORKER !== 'false'` (lido de `process.env` na carga do módulo); as suítes de integração definem `false`.

Mudança mínima e compatível com os testes existentes (que fazem `new PushService(tenant, provider)`):
1. Novo token DI `WEBPUSH_PROVIDER` (`PushProvider`-like). `PushService` ganha 3º parâmetro **opcional** `@Optional() @Inject(WEBPUSH_PROVIDER) webPush?: PushProvider`.
2. A assinatura do envio passa a carregar a inscrição. Preferência: `send(token, message, extra?: { p256dh: string; auth: string })` (3º arg opcional; FCM ignora). `token` = endpoint.
3. `dispatch`: `const providers = [fcm.enabled && 'fcm', webPush?.enabled && 'webpush'].filter(Boolean)`; se vazio → `skipped: 'disabled'`; `findMany({ provider: { in: providers } })` selecionando `provider`, `p256dh`, `auth`; `SendItem` ganha `provider`/`p256dh`/`auth`; o envio escolhe o provider por `item.provider`. O dedupe por `token` deve virar `${provider}:${token}`.
4. Limpeza: o `invalid_token` do WebPushProvider cai no mesmo `invalidIds` → `deleteMany`. Nada novo.
5. Retry: a regra "sent === 0 && invalid === 0 && allRetryable" é global; com os dois canais, se o FCM enviar e o Web Push falhar por rede, **não** há retry (sent > 0). É o mesmo limite do FCM hoje (falha parcial não refaz, para não duplicar). Documentar; não tentar resolver nesta fase.
6. Mensagens de log de credencial: hoje `Falha de credencial FCM`; generalizar para `credencial` + nome do provider (`/credencial/i` já é o gatilho).

`WebPushProvider.send` (esboço):
```typescript
// Fonte: web-push 3.6.7 README (sendNotification / setVapidDetails)
import * as webpush from 'web-push';

async send(endpoint: string, message: PushMessage, keys?: { p256dh: string; auth: string }) {
  if (!keys) return { status: 'invalid_token', reason: 'inscrição sem chaves' };
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    data: message.data,            // { kind, route, appointmentId, groupId? } já são strings
  });
  try {
    await webpush.sendNotification(
      { endpoint, keys },
      payload,
      { vapidDetails: this.vapid, TTL: 12 * 3600, urgency: 'high', timeout: 10_000 },
    );
    return { status: 'sent' };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { status: 'invalid_token', reason: `WebPush ${status}` };
    if (status === 401 || status === 403) return { status: 'failed', retryable: false, reason: `erro de credencial VAPID (${status})` };
    if (status === 413 || status === 400) return { status: 'failed', retryable: false, reason: `WebPush ${status}` };
    // sem statusCode = rede/timeout; 429 e 5xx também
    return { status: 'failed', retryable: true, reason: `WebPush ${status ?? 'rede'}: ${(e as Error).message}` };
  }
}
```
Passar `vapidDetails` por chamada (em vez de `setVapidDetails` global) evita estado global do módulo e facilita teste (injetar um `sender` falso, como o `FcmPushProvider` faz com `fetch`/`getAccessToken`).

Mapeamento de erros (Apple/FCM/Mozilla seguem RFC 8030): 404/410 = inscrição expirada ou removida (apagar); 400/403 do serviço Apple costuma ser VAPID inválido (`BadJwtToken`, assunto inválido) = erro de credencial, não retentar; 413 = payload grande; 429/5xx = retentar. Rede sem `statusCode` = retentar.

### Migration (Prisma 5, SQL escrito à mão como a 20261120000000)

Estado atual: `device_tokens` com `provider VARCHAR(10)`, `chk_device_tokens_provider CHECK (provider IN ('fcm','expo'))`, `platform CHECK IN ('android','ios')`, `token TEXT CHECK 1..4096`, único `(organization_id, provider, token)`, RLS forçada com a política `tenant_isolation` por `app.current_organization`. `'webpush'` tem 7 caracteres: cabe em `VARCHAR(10)`. Platform `ios` já é permitido.

```sql
-- Fase 8: Web Push (VAPID) no iPhone. token = endpoint; chaves da inscrição em colunas próprias.
ALTER TABLE device_tokens
  ADD COLUMN p256dh VARCHAR(255) NULL,
  ADD COLUMN auth   VARCHAR(255) NULL;

ALTER TABLE device_tokens DROP CONSTRAINT chk_device_tokens_provider;
ALTER TABLE device_tokens ADD CONSTRAINT chk_device_tokens_provider
  CHECK (provider IN ('fcm','expo','webpush'));
ALTER TABLE device_tokens ADD CONSTRAINT chk_device_tokens_webpush_keys
  CHECK (provider <> 'webpush' OR (p256dh IS NOT NULL AND auth IS NOT NULL));
```
Sem mudança de RLS/índices (colunas novas herdam a política da tabela). Atualizar `schema.prisma` (`p256dh String? @db.VarChar(255)`, `auth String? @db.VarChar(255)`) e rodar `prisma generate`. Migration segue o padrão do repositório: o `migrate` do compose staging roda `prisma migrate deploy` (deploy-staging.sh já faz). O limite de índice B-tree (~2.7 KB) não é problema: endpoints da Apple têm ~200 a 300 caracteres.

Contrato GraphQL: `RegisterDeviceTokenInput` ganha `p256dh: String` e `auth: String` (opcionais); `provider` passa a aceitar `webpush`; a validação do `DeviceTokensService` (cópia local de `PUSH_PROVIDERS`/`DEVICE_PLATFORMS`, o backend não enxerga `@sgs/shared` no Docker) precisa de `'webpush'` e das regras: com `webpush`, `p256dh` e `auth` obrigatórios, tamanho máximo, e **endpoint validado** (ver Segurança). O `upsert` do `register` precisa gravar/atualizar `p256dh`/`auth`. `unregisterDeviceToken(token)` já remove por `token + memberId` sem olhar o provider: serve para o endpoint. Atualizar também `packages/shared/src/graphql/device-tokens.ts`, `packages/shared/src/validation.ts` e o `.graphql`, mais o `generated/graphql.ts` do shared se o codegen for rodado.

### Env e chave pública (D-10)

Backend (`apps/backend/src/config/env.schema.ts`, ao lado de `FCM_SERVICE_ACCOUNT_JSON`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (todos `z.string().optional()` com o mesmo `transform` de vazio → undefined). `AppConfigService` ganha `get vapid(): { publicKey, privateKey, subject } | null` (só se os três existirem; senão `null` e `NoopWebPushProvider`, log `Web Push desabilitado (sem VAPID_*)`). Subject: `mailto:contato@...` ou `https://sgs.jessicaseixasmakeup.com.br`; **nunca localhost** (a 4.0.0 até alerta sobre isso; a Apple rejeita assunto inválido). Propagar em `docker-compose.staging.yml` (bloco do backend, junto de `FCM_SERVICE_ACCOUNT_JSON`/`PUSH_NOTIFICATIONS_WORKER`), `.env.staging`, `.env.staging.example` e `.env.example`. A chave privada não vai em log nem em commit (`.env.staging` já contém a service account do Firebase em claro: não copiar valores para documentos).

Chave pública ao frontend: **recomendo query GraphQL autenticada** `pushConfig { webPushPublicKey }` (permissão `NOTIFICATION_READ`, como as mutations de device token), `null` quando o canal está desligado. Motivos: o build do frontend no staging não tem nenhuma variável de ambiente (Dockerfile sem `ARG`, compose sem `build.args`, comentário explícito "sem VITE_API_URL de propósito"); `VITE_*` exigiria `ARG`/`ENV` no estágio `build` + `build.args` no compose + rebuild a cada rotação; a query também liga/desliga o botão conforme o backend de fato tem chaves. O Apollo já está montado; seguir o padrão de `device-token.api.ts` (`gql` direto, "mesmo texto" espelhado em `packages/shared/src/graphql`). Não consultar a query dentro do SW.

### Frontend: instalação (D-01, D-02)

- `LoginPage.tsx`: o bloco do APK é `showApkDownload = !isNativeApp()` (linha 42) com `APK_URL`, `Button asChild variant="outline"`, ícone `Smartphone`, chaves i18n `login.downloadAndroid`/`downloadAndroidHint` em `infrastructure/i18n/locales/pt-BR.json`. O novo botão entra ao lado, com chaves `login.installIphone*` e `pwa.*`. Condição: `!isNativeApp() && isIosDevice() && !isStandalone()`.
- Detecção (`platform-ios.ts`, funções puras testáveis):
  - iPhone/iPod: `/iPhone|iPod/.test(navigator.userAgent)`.
  - iPadOS 13+ se apresenta como Mac: `navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1` (ou `/Macintosh/` + `maxTouchPoints > 1`).
  - Standalone: `(navigator as {standalone?: boolean}).standalone === true || matchMedia('(display-mode: standalone)').matches`.
  - "Está no Safari": iOS não tem UA único; os navegadores de terceiros no iOS incluem `CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line`. Se algum aparece (ou é WebView), mostrar o aviso "abra no Safari". Observação: Chrome/Edge/Firefox no iOS 16.4+ também podem "Adicionar à Tela de Início" em app web (iOS 16.4+), mas a decisão D-01 manda orientar para o Safari; manter assim.
- `index.html` (hoje só `favicon.svg`, sem manifest): adicionar `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">` (mantém compatibilidade com iOS que lê a meta além do manifest), `<meta name="apple-mobile-web-app-title" content="Gestor Beauty">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="theme-color" content="#570080">`. O `viewport` já tem `viewport-fit=cover`; verificar `env(safe-area-inset-*)` no cabeçalho/BottomNav em modo standalone (a barra de status passa a ser da página).
- Manifest (`public/manifest.webmanifest`): `id: "/"`, `name`/`short_name: "Gestor Beauty"`, `start_url: "/"` (ou `/dashboard`; a raiz redireciona conforme o papel, como o login faz hoje), `scope: "/"`, `display: "standalone"`, `theme_color: "#570080"`, `background_color: "#F7F6F3"` (mesmos valores do Capacitor), `lang: "pt-BR"`, `icons` 192 e 512 (`purpose: any`) e 512 `maskable`. O iOS usa o `apple-touch-icon` (180x180, PNG opaco, sem transparência) para o ícone da Tela de Início; o manifest serve de apoio e ao Android/desktop.
- Ícones: a arte "GB roxo" está em `apps/mobile/assets/icon-only.png` (1024x1024 RGBA) e `icon.svg`. Gerar uma vez (script descartável, resultado versionado) 180, 192, 512 e 512 maskable com `sharp` (já presente no store do pnpm, `sharp@0.35.5`) ou outra ferramenta; o apple-touch precisa de fundo sólido roxo (iOS pinta transparência de preto) e o maskable de margem segura de ~10%.

### Service worker (D-03, D-04): `apps/frontend/public/sw.js`

Escopo: o `sw.js` na raiz controla `/` inteiro; não precisa de `Service-Worker-Allowed`. Sem `fetch` handler, sem `caches`. Sem `skipWaiting` agressivo é aceitável, mas como não há cache, `self.skipWaiting()` + `clients.claim()` no `install`/`activate` é seguro e evita SW velho.

```javascript
// Fonte: padrão MDN/web.dev para push; regra de rota copiada de apps/frontend/src/infrastructure/native/push-route.ts
const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;
function isAllowedPushRoute(r) {
  return typeof r === 'string' && r.length <= 300 && !r.includes('..') && !r.startsWith('//') && AGENDA_ROUTE_RE.test(r);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch { /* payload ruim */ }
  const title = typeof p.title === 'string' && p.title ? p.title : 'Gestor Beauty';
  const route = p.data && isAllowedPushRoute(p.data.route) ? p.data.route : '/agenda';
  // iOS: todo push TEM que mostrar notificação (sem push silencioso).
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof p.body === 'string' ? p.body : '',
    icon: '/icons/icon-192.png',
    tag: p.data && p.data.appointmentId ? `appt-${p.data.appointmentId}` : undefined,
    data: { route },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = isAllowedPushRoute(event.notification.data && event.notification.data.route)
    ? event.notification.data.route : '/agenda';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((c) => c.url.startsWith(self.location.origin));
    if (win) { await win.focus(); win.postMessage({ type: 'sgs-open-route', route }); return; }
    await self.clients.openWindow(route);
  })());
});
```
Notas: o `tag` agrupa/substitui por agendamento (opcional; definir só se não prejudicar lote de noivas); o SW é terceira cópia da regex de rota (as outras: `packages/shared/src/push.ts` e `frontend/.../push-route.ts`): copiar com comentário e cobrir com um teste de paridade que leia os três arquivos. No app, `WebPushBridge` escuta `navigator.serviceWorker.addEventListener('message')`, valida de novo com `isAllowedPushRoute` e usa o mesmo fluxo do Android (`router.navigate(route)` se autenticada; senão `savePendingRoute(route)` + `/login`, e o login já consome via `consumePendingRoute()` em `LoginPage.tsx:150`). Para o app aberto a frio por `openWindow(route)`: o rota `/agenda?...` carrega direto; se a sessão persistida (zustand em `localStorage`) existir, abre na agenda do dia. **Verificar** se o guard de rota preserva o destino quando não autenticada (ver Perguntas em aberto).

### Frontend: ativação (D-05, D-07)

`EnableNotificationsButton` (cliente, só `!isNativeApp() && isStandalone()` e autenticada, sem `impersonating`, como o `NativeAppBridge`): estados derivados de `'serviceWorker' in navigator`, `'PushManager' in window`, `Notification.permission`:
- sem suporte (iOS < 16.4 ou não instalado): mensagem "atualize o iOS" / "abra pelo ícone da Tela de Início";
- `default`: botão **Ativar notificações** → no `onClick` (gesto), em sequência: `Notification.requestPermission()` (pedir ANTES de qualquer `await` que quebre a cadeia do gesto; registrar o SW antes, no boot do app instalado, para o clique só pedir permissão e inscrever) → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → mutation `registerDeviceToken({ token: endpoint, platform: 'ios', provider: 'webpush', p256dh, auth })`; gravar `endpoint` em `localStorage` (`DEVICE_TOKEN_KEY` já usado pelo logout);
- `granted`: se já houver `getSubscription()`, reenviar o registro ao backend uma vez por sessão (equivale ao `registeredKey` do bridge: renova `lastSeenAt` e cobre troca de usuária no aparelho; o `register` já move o token para a usuária atual) e mostrar "Notificações ativadas";
- `denied`: "Bloqueadas nas configurações do iPhone (Ajustes → Notificações → Gestor Beauty)".
`applicationServerKey`: base64url da chave pública → `Uint8Array` (função utilitária pequena, com teste). Chaves da inscrição: `sub.toJSON().keys` (`p256dh`, `auth`, já base64url) — não converter.

Onde montar o botão: `NativeAppBridge` é um componente invisível em `App.tsx`; o botão deve ser visível. Opção simples e de baixo risco: faixa/aviso dismissível no `AppShell` (topo ou menu "Notificações" na `NotificationsBell`/`SessionUser`) só quando as condições valerem. Decisão fica para o plano de UI (UI-SPEC pode ser pulado se o botão reutilizar `Button`/`Alert` existentes; `workflow.ui_phase` está ligado, então o planner decide).

Rotação de inscrição: o iOS pode invalidar a inscrição (reinstalar o app, limpar dados, revogação do Safari). Não existe evento confiável de `pushsubscriptionchange` no iOS; a estratégia é re-sincronizar `getSubscription()` com o backend a cada abertura autenticada do app instalado (barato: uma mutation idempotente por sessão) e deixar o 410 limpar o que morreu.

### Logout (D-06)

`useAuth.logout` já chama `unregisterCurrentDeviceToken()` (lê `sgs-device-token` do `localStorage` e dispara `unregisterDeviceToken`, ignora erro). Para o Web Push, estender para também fazer `(await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()` → `sub.unsubscribe()` (falha silenciosa), mantendo ordem: mutation primeiro (precisa do token de acesso), `unsubscribe` depois. Não precisa nova mutation. Ajustar os testes `useAuth-logout.test.tsx` e `device-token-api.test.ts`. Ponto fraco conhecido (igual ao Android): se o logout acontecer sem rede, o registro no backend permanece até o 410/troca de usuária; aceitável.

### nginx (D-11)

Dois níveis: o nginx do **container do frontend** (`apps/frontend/nginx.conf`, que serve o `dist`) e o nginx do **host** (`infra/nginx/sgs-staging.conf`, só faz `proxy_pass` de `/` para o container em `127.0.0.1:8090`, sem cache). Logo a mudança de D-11 é no `apps/frontend/nginx.conf`; o do host não precisa de bloco novo (apenas conferir que nenhum `proxy_cache` aparece; hoje não há).

Armadilhas já confirmadas no arquivo:
- `location ~* \.(js|css|png|...)$ { expires 1y; add_header Cache-Control "public, immutable"; }` casaria `/sw.js` e os ícones PNG fixos. Adicionar, **antes ou depois (exato tem precedência sobre regex)**:
```nginx
location = /sw.js {
    add_header Cache-Control "no-cache" always;
    add_header Content-Type "application/javascript; charset=utf-8" always;  # só se o mime.types não resolver
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache" always;
    # repetir os 3 headers de segurança (add_header em location substitui os do server)
}
```
- O comentário do arquivo avisa: `add_header` dentro de `location` substitui os herdados, então os três headers de segurança precisam ser repetidos em cada bloco novo.
- `expires 1y` na regra regex gera `Expires`/`Cache-Control: max-age`; o bloco exato não pode herdar isso (não herda: é outra location).
- Ícones PNG em `public/` (sem hash) herdam `immutable` de 1 ano pela regra regex: ao trocar a arte, o iPhone pode manter o ícone antigo. Versionar o nome (`icon-192-v1.png`) ou aceitar. O `apple-touch-icon.png` é lido só na instalação.
- Sem `sw.js` no dist, a SPA fallback devolve `index.html` 200: o registro do SW falha com erro de MIME. O teste de infra deve garantir `Content-Type` JS.
- `nginx:alpine` serve `.webmanifest` como `application/manifest+json` pelo `mime.types` padrão nas versões atuais; **não consegui confirmar no container local** (imagem não estava baixada, a verificação ficou sem saída). Por isso o `default_type` explícito no bloco exato e um teste que confira o header.
- Content-Security-Policy: não há CSP no `nginx.conf`; nada a ajustar.
- Mudar `nginx.conf` do frontend exige rebuild da imagem `frontend` (já é o que o deploy faz: `build` + `up -d backend frontend`).

### Backend: segurança do endpoint (SSRF)

O backend fará POST para a URL que o cliente enviar. Sem validação, qualquer usuária autenticada registra `endpoint=http://127.0.0.1:...` e usa o servidor como proxy interno (SSRF). No `validateDeviceTokenInput`, para `provider === 'webpush'`: exigir `https:`, hostname dentro de lista permitida (para `platform ios`: `web.push.apple.com`; manter a lista num único lugar, p.ex. `WEBPUSH_ALLOWED_HOSTS`, estendível a `fcm.googleapis.com` e `*.push.services.mozilla.com` se um dia houver Android/desktop web), sem credenciais na URL, tamanho ≤ 2048; `p256dh` base64url de 65 bytes (87 chars) e `auth` de 16 bytes (22 chars). Rejeitar com `BadRequestException` igual ao resto.

## Não reinventar

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Criptografia do payload e JWT VAPID | ECDH/HKDF/aes128gcm/ES256 manuais | `web-push@3.6.7` | RFC 8291/8292, fácil errar; a lib é a referência |
| Gerar chaves VAPID | Script de openssl | `web-push generate-vapid-keys` | Formato base64url exato |
| Limpeza 410 | Rotina própria de varredura | O `invalid_token` → `deleteMany` já existente | Paridade com FCM, mesma transação RLS |
| Fila/retry | Novo worker | A fila `push-notifications` e o `PushProcessor` | Mesmo job, mesmos destinatários |
| Texto e rota | Novos textos | `buildPushMessage`/`buildAgendaRoute` | Idênticos ao Android |
| Cache offline | Workbox/vite-plugin-pwa | Nada (D-03) | Fora de escopo |
| Validação de rota | Nova regex | `isAllowedPushRoute` | Já tem duas cópias; a do SW é a terceira, com teste de paridade |

## Inventário de estado de execução

Fase aditiva (nem rename nem migração de dados). Mesmo assim:
- Dados armazenados: tabela `device_tokens` ganha colunas e novo valor de `provider`; linhas FCM existentes não mudam (colunas novas `NULL`). Migration é de **esquema**, não de dados.
- Config de serviço vivo: nenhuma (Firebase não muda; VAPID é nosso).
- Estado registrado no SO: nenhum no servidor. No iPhone, a inscrição vive no aparelho.
- Segredos/env: três variáveis novas no `.env.staging` (VAPID_*). Nada renomeado.
- Artefatos de build: o frontend precisa ser reconstruído (nginx.conf, `public/`); imagem do backend reconstruída para `web-push`. O APK Android não muda (a casca carrega as telas do servidor, mas `isNativeApp()` mantém o Web Push desligado nele).

## Armadilhas comuns

### 1. `sw.js` preso em cache de 1 ano
**O que dá errado:** o regex do `apps/frontend/nginx.conf` aplica `immutable` ao `sw.js`; correções do SW nunca chegam ao iPhone.
**Como evitar:** `location = /sw.js` com `no-cache`; teste automatizado de header no container.
**Sinal:** `curl -sI https://.../sw.js` mostra `max-age=31536000`.

### 2. `web-push@4` instalada por `latest`
**O que dá errado:** `pnpm add web-push` traz a 4.0.0 (ESM, sem tipos) → falha no `nest build`/jest (`ERR_REQUIRE_ESM`/TS7016).
**Como evitar:** `web-push@3.6.7 --save-exact`, `@types/web-push@3.6.4`.

### 3. Permissão fora do gesto / SW sem registro
**O que dá errado:** `requestPermission()` depois de `await` longo ou fora de clique é ignorado no iOS; push só em app instalado.
**Como evitar:** registrar o SW no boot (não no clique); clique chama `requestPermission` direto e depois `subscribe`. `userVisibleOnly: true` obrigatório.

### 4. Push silencioso revoga a inscrição
**O que dá errado:** se o handler `push` não chamar `showNotification` (payload inválido, exceção), o Safari acaba revogando.
**Como evitar:** `try/catch` no parse e **sempre** `showNotification` com título padrão.

### 5. Armazenamento separado entre Safari e app instalado
**O que dá errado:** a usuária entra no Safari, instala e abre o ícone: o app instalado começa sem sessão (localStorage próprio no iOS). A tela de login aparece de novo. Isso é esperado e deve constar no passo a passo ("depois de instalar, abra pelo ícone e entre de novo").
**Como evitar:** texto do passo a passo e do teste manual.

### 6. iPadOS parece Mac
**O que dá errado:** só testar `/iPhone|iPad/` perde o iPad; testar `Macintosh` sozinho acerta Macs reais.
**Como evitar:** `MacIntel` + `maxTouchPoints > 1`.

### 7. VAPID subject inválido
**O que dá errado:** a Apple responde 403 (credencial) para `mailto:` malformado, `localhost` ou assunto vazio; vira "falha não retentável".
**Como evitar:** `mailto:` real ou `https://sgs.jessicaseixasmakeup.com.br`; checar no primeiro envio de teste.

### 8. SSRF pelo endpoint
Ver seção de segurança. Teste de integração: endpoint `http://127.0.0.1/x` e host fora da lista são rejeitados.

### 9. Mesma pessoa, vários canais
**O que dá errado:** o dedupe por `token` do `dispatch` ignora o provider; um token FCM e um endpoint nunca colidem na prática, mas mantenha `${provider}:${token}`.
**Como evitar:** ajustar o dedupe e cobrir no unit test.

### 10. Falha parcial sem retry
Documentada acima (mesmo comportamento do FCM): não "corrigir" nesta fase, para não duplicar notificação no Android.

### 11. Testes/jest e flag do worker
`PUSH_NOTIFICATIONS_WORKER=false` nas suítes de integração: manter. O novo provider não pode abrir conexão no boot (só no `send`), para o boot sem VAPID e os testes de módulo (`phase2-modules-boot.spec.ts`) continuarem passando.

## Exemplos de código

### Registro e inscrição no cliente (gesto)
```typescript
// Fonte: MDN PushManager.subscribe / Notification.requestPermission
export async function enableWebPush(publicKey: string) {
  const reg = await navigator.serviceWorker.ready;            // SW já registrado no boot
  const perm = await Notification.requestPermission();        // dentro do onClick
  if (perm !== 'granted') return { status: perm } as const;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await registerWebPushSubscription(endpoint, keys);          // platform 'ios', provider 'webpush'
  localStorage.setItem(DEVICE_TOKEN_KEY, endpoint);
  return { status: 'granted' } as const;
}
```

### Contrato GraphQL (esboço)
```graphql
input RegisterDeviceTokenInput {
  token: String!            # FCM: token; webpush: endpoint
  platform: String!
  provider: String          # fcm (padrão) | expo | webpush
  appVersion: String
  p256dh: String
  auth: String
}
type PushConfig { webPushPublicKey: String }
extend type Query { pushConfig: PushConfig! }
```

## Estado da arte

| Antigo | Atual | Quando | Impacto |
|--------|-------|--------|---------|
| Sem push em iOS web | Web Push em app instalado | iOS/iPadOS 16.4 (03/2023) | Base desta fase |
| SW obrigatório para push | Declarative Web Push (sem SW) | iOS/iPadOS 18.4 (03/2025); Safari 18.5 no macOS | Opcional futuro; não usar agora (exclui 16.4–18.3) |
| `web-push` 3.x CJS | `web-push` 4.0.0 ESM, sem tipos | 10/11/2026 | Ficar na 3.6.7 |

**Fontes de iOS (nível MÉDIO):** WebKit/Apple Developer Forums e artigos secundários confirmam 16.4 (clássico) e 18.4 (declarativo), ambos só para app na Tela de Início. A busca não confirmou nenhuma chave de manifest chamada `web_push` como requisito do push clássico (isso é do formato declarativo). Comportamento fino (revogação por push sem notificação, expiração) vem de documentação Apple/WebKit e experiência da comunidade; só o iPhone real valida.

## Perguntas em aberto

1. **Guard de rota sem sessão:** ao tocar na notificação com o app fechado e sessão expirada, `openWindow('/agenda?...')` cai no guard. Não confirmei no `router.tsx` se o destino é preservado.
   - Recomendação: o plano inclui verificar isso; se não preservar, `WebPushBridge` chama `savePendingRoute(location.pathname + location.search)` antes do redirect (o `LoginPage` já consome a rota pendente).
2. **Subject VAPID:** qual e-mail/URL a usuária quer? Recomendação: `https://sgs.jessicaseixasmakeup.com.br` (não exige caixa de e-mail) ou `mailto:` do suporte; decidir antes de gerar `.env.staging`.
3. **Local do botão "Ativar notificações":** faixa no `AppShell` vs item de menu. Decisão de UI para o planner (reutilizar componentes existentes).
4. **Mime do manifest no `nginx:alpine`:** não verificado localmente; resolvido pelo `default_type` explícito e pelo teste de header.
5. **Versão mínima do iOS da equipe:** desconhecida; o botão mostra "atualize o iOS" abaixo de 16.4. Confirmar o modelo/versão do iPhone da usuária no teste final.

## Disponibilidade do ambiente

| Dependência | Necessária para | Disponível | Versão | Alternativa |
|-------------|-----------------|------------|--------|-------------|
| Node (host) | testes, geração de chaves | sim | v26.9.0 (Docker usa node:22-alpine) | — |
| pnpm / Docker / Docker Compose | build e deploy staging | sim (usados pelo `deploy-staging.sh`) | — | — |
| PostgreSQL local | testes de integração | sim (já usado pelas suítes `test:integration`) | — | — |
| `sharp` | gerar ícones PNG | sim (no store do pnpm, 0.35.5) | 0.35.5 | ImageMagick não instalado; `convert`/`rsvg-convert` ausentes |
| Internet para `web.push.apple.com` | envio real | sim no VPS (staging) | — | testes com sender falso |
| iPhone real iOS 16.4+ | verificação final | com a usuária | — | sem alternativa para o aceite final |

Sem dependência bloqueante. Rodar `node_modules/.bin/web-push generate-vapid-keys` só depois de instalar a lib.

## Arquitetura de validação

### Framework de teste
| Propriedade | Valor |
|-------------|-------|
| Backend unit | jest 29 (`apps/backend/jest.config.ts`, `pnpm --filter @sgs/backend test`) |
| Backend integração | jest + Postgres real com RLS (`jest-integration.config.ts`, `pnpm --filter @sgs/backend test:integration`, `--runInBand`; usa `PUSH_NOTIFICATIONS_WORKER=false`) |
| Frontend | vitest 2 + jsdom + Testing Library (`apps/frontend/vitest.config.ts`, `pnpm --filter @sgs/frontend test`) |
| E2E | Playwright (`apps/e2e`, chromium desktop, backend 3100, vite 5180) |
| Comando rápido | `pnpm --filter @sgs/backend test -- push` e `pnpm --filter @sgs/frontend test -- webpush native login` |
| Suíte completa | gate do projeto (lint + typecheck + testes unit + integração), como nas fases anteriores |

### Mapa decisão → teste
| Decisão | Comportamento | Tipo | Comando / Ação | Arquivo |
|---------|---------------|------|----------------|---------|
| D-01 | Botão aparece em iPhone/iPad (inclui iPadOS "Mac" com touch) fora do standalone; some em desktop, Android, nativo e standalone; aviso fora do Safari | unit (vitest) | `pnpm --filter @sgs/frontend test -- login-instalar-iphone platform-ios` | Wave 0: `features/auth/pages/__tests__/login-instalar-iphone.test.tsx`, `infrastructure/webpush/__tests__/platform-ios.test.ts` (espelha `login-baixar-apk.test.tsx`: mock de `platform`, `navigator.userAgent`) |
| D-01 | Diálogo mostra o passo a passo | unit | idem | idem |
| D-02 | Manifest válido (campos, ícones existem em `public/`, `display`, `start_url`/`scope`, cores) e `index.html` com `<link rel=manifest>` e `apple-touch-icon` | unit (vitest lê os arquivos) | `pnpm --filter @sgs/frontend test -- manifest` | Wave 0: `src/__tests__/pwa-manifest.test.ts` |
| D-02 | Manifest e ícones servidos pelo vite dev | E2E | Playwright `request.get('/manifest.webmanifest')` 200, `<link rel=manifest>` no DOM | Wave 0: `apps/e2e/tests/pwa-instalavel.spec.ts` |
| D-03 | `sw.js` não referencia `caches`/`fetch` handler | unit (lê o arquivo) | `pnpm --filter @sgs/frontend test -- sw` | Wave 0: `src/__tests__/service-worker.test.ts` |
| D-04 | SW: `push` sempre chama `showNotification` (payload válido, inválido, vazio); `notificationclick` usa só rotas permitidas e cai em `/agenda`; paridade da regex com `push-route.ts` | unit (vitest com `self` simulado/`vm`) | idem | idem |
| D-04 | App recebe `sgs-open-route`, valida e navega; deslogada salva rota pendente | unit | `pnpm --filter @sgs/frontend test -- webpush-bridge` | Wave 0 |
| D-05 | Estados do botão: sem suporte / não instalado (oculto) / `default` / `granted` / `denied`; clique chama `requestPermission` e `subscribe` e a mutation com `platform:'ios', provider:'webpush'`; oculto no Capacitor e em impersonação | unit | `pnpm --filter @sgs/frontend test -- enable-notifications` | Wave 0 |
| D-06 | Logout chama `unregisterDeviceToken` e `subscription.unsubscribe()`; erro de rede não impede o logout | unit | `pnpm --filter @sgs/frontend test -- useAuth-logout device-token-api` | existe (`useAuth-logout.test.tsx`, `device-token-api.test.ts`): estender |
| D-07 | Com `isNativeApp()` true nenhum código de Web Push roda; FCM continua | unit | `pnpm --filter @sgs/frontend test -- native-app-bridge` | existe: estender |
| D-08 | `WebPushProvider.send` com sender falso: sucesso, payload JSON com title/body/data.route, TTL/urgency, sem chaves → invalid | unit (jest) | `pnpm --filter @sgs/backend test -- web-push.provider` | Wave 0: `src/push/web-push.provider.spec.ts` |
| D-08 | `PushService.dispatch` com FCM + webpush: mesmos destinatários e textos, cada item sai pelo provider certo, dedupe por provider+token, canal desligado ignora tokens `webpush`, sem VAPID e sem FCM → `skipped: disabled` | unit (jest, estende `push.processor.spec.ts` / novo `push.service.webpush.spec.ts`) | `pnpm --filter @sgs/backend test -- push` | Wave 0 |
| D-08 | `registerDeviceToken` com `provider:'webpush'` grava `p256dh`/`auth`, token = endpoint, RLS por org, move entre usuárias; rejeita sem chaves; rejeita endpoint fora da lista/não https (SSRF); `unregister` por endpoint | integração (Postgres real) | `pnpm --filter @sgs/backend test:integration -- device-tokens` | existe `device-tokens.e2e.spec.ts`: estender; unit em `device-tokens.service.spec.ts` |
| D-08 | Migration aplica limpa (colunas, CHECK com `webpush`, CHECK de chaves) e linhas `fcm` antigas continuam válidas | integração | `pnpm --filter @sgs/backend test:integration -- device-tokens` (+ `prisma migrate deploy` no banco de teste) | Wave 0: teste de schema no mesmo arquivo |
| D-09 | `WebPushProvider`: 404 e 410 → `invalid_token`; 401/403/413 → `failed` não retentável; 429/5xx/rede → retentável; no `dispatch`, a linha `webpush` é removida | unit + integração (provider falso devolvendo 410, como `push-dispatch.e2e.spec.ts` faz com `tok-p7-dead`) | `pnpm --filter @sgs/backend test -- web-push.provider` e `test:integration -- push-dispatch` | existe `push-dispatch.e2e.spec.ts`: estender com token `webpush` morto |
| D-10 | Env: sem VAPID → provider no-op e boot normal; com VAPID parcial → desligado; `pushConfig.webPushPublicKey` devolve a chave ou `null`; requer permissão `NOTIFICATION_READ` | unit + integração (boot + GraphQL) | `pnpm --filter @sgs/backend test -- web-push-credentials` / `test:integration -- push-config phase2-modules-boot` | Wave 0 |
| D-10 | Chaves não aparecem em log | unit (spy de `Logger`) | idem | Wave 0 |
| D-11 | Imagem do frontend serve `/sw.js` com `Cache-Control: no-cache` e JS, `/manifest.webmanifest` com `application/manifest+json` e `no-cache`, ícones 200; `index.html` ainda `no-cache` | teste de infra (script shell) | `docker build -t sgs-fe-test apps/frontend --target production && docker run -d -p 8099:80 ... && curl -sI` | Wave 0: `scripts/check-pwa-headers.sh` (também rodável contra o staging real após o deploy) |
| D-11 | Staging real após deploy | smoke manual-automatizado | `curl -sI https://sgs.jessicaseixasmakeup.com.br/sw.js` | pós-deploy |
| Aceite | Instalar no iPhone, ativar, receber aviso de agendamento, tocar e abrir a agenda no dia, logout para de receber | **manual (iPhone real)** | Roteiro em 08-VERIFICATION/UAT: Safari → Adicionar à Tela de Início → abrir pelo ícone → entrar → Ativar notificações → criar agendamento por outra conta → notificação → toque → agenda do dia; depois sair e criar outro agendamento sem receber | não automatizável (permissão e entrega Apple) |

O que o Playwright (chromium desktop) **não** cobre: permissão real de notificação, entrega pela Apple, comportamento standalone do iOS, ícone na Tela de Início. Ficam com a verificação manual.

### Taxa de amostragem
- Por commit de tarefa: testes do pacote tocado (`push` no backend; `webpush native login` no frontend).
- Por merge de onda: unit completo dos dois pacotes + `test:integration` das suítes de push/device tokens + typecheck e lint.
- Gate da fase: gate completo do projeto (lint, typecheck, unit, integração; E2E de PWA), depois deploy no staging, `check-pwa-headers.sh` contra o staging e o roteiro no iPhone.

### Lacunas da Onda 0
- [ ] `apps/backend/src/push/web-push.provider.spec.ts`
- [ ] `apps/backend/src/push/web-push-credentials` + spec
- [ ] estender `push.processor.spec.ts`/`device-tokens.service.spec.ts` e as integrações `device-tokens.e2e.spec.ts`, `push-dispatch.e2e.spec.ts`
- [ ] `apps/frontend/src/infrastructure/webpush/__tests__/*` (plataforma, botão, bridge, SW, manifesto)
- [ ] `apps/frontend/src/features/auth/pages/__tests__/login-instalar-iphone.test.tsx`
- [ ] `apps/e2e/tests/pwa-instalavel.spec.ts`
- [ ] `scripts/check-pwa-headers.sh`
- [ ] instalar `web-push@3.6.7` e `@types/web-push@3.6.4`

## Sugestão de divisão em ondas (critério do planner)

1. Onda 1 (paralela): (a) backend migration + schema Prisma + validação/registro `webpush` + env/config + query `pushConfig`; (b) frontend estático: ícones, manifest, `index.html`, `sw.js`, `nginx.conf` + script de headers.
2. Onda 2: backend `WebPushProvider` + `PushService` (depende de 1a); frontend cliente Web Push (detecção, registro do SW, subscribe/unsubscribe, bridge) (depende de 1b e do contrato 1a).
3. Onda 3: UI (botão de login + diálogo; botão "Ativar notificações"), logout, i18n.
4. Onda 4: gate, deploy staging (instalar `web-push`, VAPID no `.env.staging`, rebuild), verificação no iPhone real.

## Restrições do CLAUDE.md aplicáveis
- Stack fixa: Node + NestJS 10 + GraphQL schema-first + Prisma 5 + PostgreSQL 16 + Redis 7 / React + Vite + Apollo Client 3 + Tailwind + shadcn/ui (usar `Button`/`Dialog` existentes). Observação: a stack real do frontend já está em React 19 e Vite 6 (lido do `package.json`).
- RLS por `app.current_organization` não negociável: tudo passa por `TenantContextService.runWithTenant`.
- LGPD/OWASP: validar entrada do endpoint (SSRF), não logar chaves/endpoint completo (usar sufixo, como o FCM faz).
- WCAG 2.1 AA: botões e diálogos acessíveis (roles, foco, contraste do roxo `#570080`).
- Testes: 80% de cobertura no domínio; E2E para fluxos críticos.
- Fluxo GSD: nada de edição fora de `/gsd:execute-phase`.
- Idioma: tudo em PT-BR.

## Fontes

### Primárias (ALTA)
- Código lido: `apps/backend/src/push/*`, `apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql`, `schema.prisma` (`DeviceToken`), `src/config/env.schema.ts`, `docker-compose.staging.yml`, `apps/frontend/{nginx.conf,Dockerfile,index.html,vite.config.ts,package.json}`, `src/infrastructure/native/*`, `features/auth/hooks/useAuth.ts`, `LoginPage.tsx`, `infra/nginx/sgs-staging.conf`, `scripts/deploy-staging.sh`, `apps/e2e/playwright.config.ts`.
- Tarballs do npm de `web-push@4.0.0` e `3.6.7` (campos `type`, `main`, `engines`, dependências) e teste local de `sendNotification` na 3.6.7.
- `npm view web-push` / `@types/web-push` (17/11/2026).

### Secundárias (MÉDIA)
- Release notes do `web-push` 4.0.0 (migração para ESM; github.com/web-push-libs/web-push/releases).
- WebKit "Meet Declarative Web Push" e resultados de busca sobre iOS 16.4/18.4: https://webkit.org/blog/16535/meet-declarative-web-push/ e https://webkit.org/blog/16574/digital-credentials-api/ (Safari 18.4); https://firt.dev/notes/pwa-ios/ (compatibilidade PWA iOS).

### Terciárias (BAIXA, validar no iPhone)
- Detalhes de revogação por push sem notificação, expiração/rotação de inscrição, e Chrome/Edge no iOS adicionarem à Tela de Início.

## Metadados

**Confiança:**
- Stack padrão: ALTA (versões e formato de módulo verificados no tarball).
- Arquitetura backend/infra: ALTA (código lido).
- Comportamento iOS: MÉDIA (aceite só no aparelho real).
- Armadilhas: ALTA para as de repositório (nginx regex, ESM, SSRF); MÉDIA para as de iOS.

**Data da pesquisa:** 2026-11-17
**Válido até:** ~2026-12-17 (a 4.0.0 do `web-push` é recente; reconferir se mudar a versão do backend para ESM)

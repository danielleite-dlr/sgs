# Phase 7: App Android Gestor Beauty com Capacitor - Research

**Researched:** 2026-11-14
**Domain:** Capacitor 8 (casca Android sobre `server.url` remoto), push FCM v1 a partir do NestJS, monorepo pnpm, build de AAB no CI
**Confidence:** MEDIUM-HIGH (stack e requisitos de build verificados em npm/fonte/docs oficiais; política da Play sobre WebView e a verificação de desenvolvedor para APK têm pontos LOW, marcados abaixo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Já decididos antes da discussão (2026-11-14)**
- **D-01:** O público é a equipe do salão. O app mostra as mesmas telas do SGS, sem telas exclusivas.
- **D-02:** Só Android nesta fase.
- **D-03:** O nome na loja e no ícone é "Gestor Beauty". O appId `br.com.gestorbeauty.app` é estável e a keystore de upload fica guardada fora do repositório, com backup documentado, para o futuro app Expo sair como **atualização do mesmo app** na loja.
- **D-04:** O registro de tokens de aparelho e o envio de push ficam no backend de forma neutra (FCM v1 do lado do servidor, sem depender do Capacitor), para o Expo reaproveitar.
- **D-05:** Criar `packages/shared` (queries GraphQL, tipos gerados, validações) pensando no Expo.

**Servidor e atualização**
- **D-06:** O app aponta para `https://sgs.jessicaseixasmakeup.com.br`, que hoje é o único ambiente e já é usado de verdade pelo Studio JS. Esta fase não cria ambiente de produção separado; isso continua no backlog 999.3.
- **D-07:** As telas são **carregadas do servidor** (Capacitor `server.url`): toda melhoria que sobe para o staging aparece no app na hora, sem publicar versão nova. Só a casca nativa (plugins, ícone, permissões) exige build e publicação.
- **D-08:** Sem internet, o app mostra uma tela amigável "Sem conexão" com o botão "Tentar novamente". Não há funcionamento offline.

**Distribuição**
- **D-09:** A primeira entrega vai pelo **teste interno da Play Console** (só e-mails convidados, até 100). Não entra na loja pública nesta fase.
- **D-10:** A conta de desenvolvedor do Google Play é de **pessoa física, no nome da usuária** (US$ 25). A usuária cria a conta. Até ela existir, o app é testado por APK. A publicação aberta (que exige teste fechado com 12 pessoas por 14 dias) fica para depois.

**Notificações (push)**
- **D-11:** Eventos desta fase: **novo agendamento** e **cancelamento**. Remarcação e os alertas do sino ficam para depois.
- **D-12:** Quem recebe: a **profissional do atendimento** (só os dela) e **admin e gerente** (todos do salão).
- **D-13:** Quem criou ou cancelou o agendamento **não recebe** o aviso da própria ação.
- **D-14:** Tocar na notificação **abre a agenda no dia do atendimento**, com ele em destaque/aberto.
- **D-15:** Agendamentos criados em lote no grupo de noivas geram **uma notificação por profissional**, resumindo os atendimentos dela no evento (ex.: "3 atendimentos no casamento da Vitória, 08/11"). Gestoras recebem um resumo do evento, não um aviso por atendimento.

**Ícone, splash e acesso**
- **D-16:** Ícone provisório criado pelo Claude: monograma "GB" em branco sobre o roxo `#570080`, com a tipografia do layout Gestor Beauty. Deve ser fácil de trocar quando houver logo oficial (inclusive o ícone adaptativo do Android).
- **D-17:** Splash com fundo `#F7F6F3` (o papel do layout) e o ícone no centro. Some assim que o sistema carrega.
- **D-18:** **Todos os papéis** (admin, gerente, atendente, profissional) usam o app com o mesmo login. Cada uma vê o que já vê no web.

### Claude's Discretion
- Versão mínima do Android e targetSdk exigido pela Play.
- Comportamento do botão voltar: navegar para trás no histórico e, na tela raiz, sair do app.
- Área segura/notch, teclado sobre formulários, barra de status com a cor do layout.
- Login persistente reaproveitando o refresh token (30 dias) já guardado; como fica o armazenamento no WebView (localStorage vs Preferences do Capacitor).
- Como o app pede permissão de notificação (Android 13+) e em que momento.
- Onde fica o projeto Android no monorepo (ex.: `apps/mobile`) e como o build AAB/APK é gerado (VPS ou Mac).
- Dedup e limpeza de tokens inválidos, e envio fora da transação (fila BullMQ já existente).
- Sessão de platform admin dentro do app (entrar no salão pelo painel) segue o comportamento do web.

### Deferred Ideas (OUT OF SCOPE)
- Publicação aberta na Play Store (teste fechado de 12 pessoas por 14 dias, conta pessoa física).
- Push de remarcação e dos alertas do sino (parcelas de contrato etc.).
- Agenda do dia offline.
- Ambiente de produção separado (backlog 999.3) e migrar o app para ele.
- iOS (Capacitor) e o app React Native/Expo como atualização do mesmo appId.
- Logo oficial do Gestor Beauty.
- Biometria/desbloqueio por digital.
</user_constraints>

<phase_requirements>
## Phase Requirements

Nenhum ID de requisito mapeado (TBD). Os critérios abaixo, derivados do CONTEXT, são o contrato da fase.

| ID | Descrição | Research Support |
|----|-----------|------------------|
| C-01 | App "Gestor Beauty" (appId `br.com.gestorbeauty.app`) instalável por APK e pelo teste interno da Play | Capacitor 8.6.2, targetSdk 36, build AAB no GitHub Actions, keystore em secret (seções Stack, Build) |
| C-02 | Telas carregadas de `server.url`; tela "Sem conexão" com "Tentar novamente" | `server.errorPath` + `offline.html` local; banner SPA para queda no meio da sessão |
| C-03 | Push de novo agendamento e cancelamento, com regras D-12/D-13/D-15 | Tabela `device_tokens` + fila BullMQ + cliente FCM v1 |
| C-04 | Toque na notificação abre `/agenda?data=...&visao=day&agendamento=<id>` | `pushNotificationActionPerformed` (retido até consumo) + allowlist de rota |
| C-05 | Ícone adaptativo GB roxo, splash `#F7F6F3`, status bar/safe area | `@capacitor/assets`, SplashScreen, SystemBars/`viewport-fit=cover` |
| C-06 | `packages/shared` criado sem quebrar CI/Docker | pnpm workspace + restrição dos Docker contexts |
</phase_requirements>

## Summary

O caminho é direto e todos os componentes existem na versão atual: **Capacitor 8.6.2** (Node >= 22, JDK 21, AGP 8.13.0, Gradle 8.14.3, compileSdk/targetSdk 36, minSdk 24) com `server.url` apontando para o staging, plugins oficiais 8.x, e push por FCM v1 enviado do NestJS. O targetSdk 36 que o Capacitor 8 já traz por padrão é exatamente o exigido pela Play para apps novos e atualizações desde 31/08/2026. O backend não depende do Capacitor: guarda tokens FCM numa tabela neutra com RLS e envia pela fila BullMQ já existente; o Expo reaproveita porque `getDevicePushTokenAsync()` devolve o mesmo token FCM nativo.

Três armadilhas moldam o plano. (1) A documentação oficial do Capacitor diz que `server.url`/`allowNavigation` "não são para produção"; funciona (o bridge injeta o JS nativo na origem remota e adiciona o `server.url` às origens permitidas, verificado no código-fonte 8.6.2), mas a tela offline (`errorPath`) é uma página local **sem acesso a plugins** (PR #7781 que corrigiria isso foi fechado sem merge em 23/02/2026), então ela precisa ser HTML/JS puro. (2) Os Docker contexts do staging são `./apps/frontend` e `./apps/backend`: se front ou back importarem `packages/shared`, o deploy quebra; nesta fase `packages/shared` deve nascer sem consumidores nos builds Docker. (3) A VPS (2 vCPU, 7 GB, ~4 GB já em uso, sem Android SDK) não é lugar para Gradle; o runner `ubuntu-24.04` do GitHub já traz Android SDK (platform 36, build-tools 36.0.0), então o AAB assinado sai do GitHub Actions. Atenção: o Java padrão do runner é 17, é preciso fixar JDK 21.

**Primary recommendation:** `apps/mobile` (Capacitor 8, `server.url` fixo, `errorPath: offline.html`), push neutro no backend (tabela `device_tokens` + fila `push-notifications` + cliente FCM v1 via `google-auth-library`), código nativo do frontend isolado atrás de `Capacitor.isNativePlatform()` com import dinâmico, e workflow `android.yml` que gera AAB assinado a partir de secrets.

## Project Constraints (from CLAUDE.md)

- Stack travada: NestJS 10 + GraphQL schema-first (SDL em `apps/backend/src/graphql/schema/*.graphql`) + Prisma + PostgreSQL com RLS ("não negociável") + Redis/Valkey + BullMQ. Frontend React 19/Vite/Apollo 3/Tailwind 3 (na prática o frontend já está em React 19).
- Multi-tenancy por RLS em toda tabela nova (`organization_id`, `FORCE ROW LEVEL SECURITY`, política `tenant_isolation`).
- Compliance: LGPD, WCAG 2.1 AA, OWASP. Tokens de aparelho são dado pessoal indireto: não logar o token inteiro; apagar no logout.
- Testes: unitários no domínio, E2E nos fluxos críticos, bloqueio de PR em falha (CI atual: typecheck, lint, frontend-unit, integration, ...).
- Fluxo GSD obrigatório antes de editar arquivos (esta pesquisa só escreve o RESEARCH.md).
- Frontend sem prettier configurado (aspas simples, ~100 colunas); textos em pt-BR via i18n.
- Staging: backup antes de deploy com migration; roles `sgs_migrator`/`sgs_app`.

## Standard Stack

Versões verificadas com `npm view` em 2026-11-14.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor/core` | 8.6.2 | Runtime JS (`Capacitor.isNativePlatform()`, `registerPlugin`) | Necessário no **frontend** (bundle servido) e em `apps/mobile` |
| `@capacitor/cli` | 8.6.2 | `cap add/sync`, `cap build` | devDependency de `apps/mobile`; exige Node >= 22 |
| `@capacitor/android` | 8.6.2 | Projeto nativo (JDK 21, AGP 8.13.0, targetSdk 36) | Oficial |
| `@capacitor/push-notifications` | 8.1.3 | `register`, permissões Android 13, canais, ação de toque | Oficial; embute `firebase-messaging` 25.0.1 sem SDK extra |
| `@capacitor/splash-screen` | 8.0.2 | Splash (usa a API SplashScreen do Android 12+) | Oficial |
| `@capacitor/app` | 8.1.2 | `backButton`, `exitApp`/`minimizeApp`, `appUrlOpen` | Oficial |
| `@capacitor/keyboard` | 8.0.6 | Comportamento do teclado (resize) | Oficial |
| `@capacitor/status-bar` | 8.0.4 | Estilo da barra de status | Oficial (cor de fundo é ignorada em edge-to-edge, ver Pitfalls) |
| `@capacitor/assets` | 4.0.0 | Gera ícone adaptativo e splash a partir de PNG (Node >= 20.9) | Oficial |
| `google-auth-library` | 11.3.4 | Token OAuth2 da service account (escopo `firebase.messaging`) para FCM v1 HTTP | Leve; o envio é um `fetch` mockável |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/network` 8.0.1 | Estado de rede via plugin | **Não instalar nesta fase**: `navigator.onLine` + eventos `online/offline` bastam no WebView |
| `@capacitor/preferences` 8.0.1 | Armazenamento nativo | **Não instalar**: manter `localStorage` (ver Pattern 5) |
| `firebase-admin` 14.5.1 (Node >= 22) | Alternativa ao HTTP direto | Só se o time preferir o SDK; puxa árvore grande de dependências para um único endpoint |
| `expo-notifications` 58.1.9 | Futuro app Expo | Fora desta fase; usa `getDevicePushTokenAsync()` (token FCM) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FCM HTTP v1 + `google-auth-library` | `firebase-admin` | Admin SDK resolve auth e retries, mas é pesado; HTTP direto são ~60 linhas atrás de uma interface `PushProvider` |
| `server.url` remoto | Bundle local do `dist` | Bundle local exigiria publicar versão a cada mudança, contradiz D-07 (decisão travada) |
| `localStorage` | `@capacitor/preferences` | Preferences seria mais "nativo", mas só funciona com a ponte injetada (não na tela offline) e exigiria reescrever o `persist` do zustand; WebView persiste localStorage da origem remota normalmente |

**Installation:**
```bash
# apps/mobile (casca nativa; os plugins aqui definem o que é registrado no Android)
pnpm --filter @sgs/mobile add @capacitor/core@8.6.2 @capacitor/android@8.6.2 \
  @capacitor/push-notifications@8.1.3 @capacitor/splash-screen@8.0.2 \
  @capacitor/app@8.1.2 @capacitor/keyboard@8.0.6 @capacitor/status-bar@8.0.4
pnpm --filter @sgs/mobile add -D @capacitor/cli@8.6.2 @capacitor/assets@4.0.0 typescript

# apps/frontend (lado JS que o WebView carrega do servidor; MESMAS versões)
pnpm --filter @sgs/frontend add @capacitor/core@8.6.2 @capacitor/push-notifications@8.1.3 \
  @capacitor/splash-screen@8.0.2 @capacitor/app@8.1.2 @capacitor/status-bar@8.0.4

# apps/backend
pnpm --filter @sgs/backend add google-auth-library@11.3.4
```
**Armadilha de dupla instalação:** com `server.url`, o JS dos plugins vem do bundle do **frontend** (servido pelo nginx) e o código nativo vem do `apps/mobile` (`cap sync` lê o package.json de lá). Versões divergentes entre os dois dão `UNIMPLEMENTED`/métodos ausentes. Fixar versões exatas (sem `^`) nos dois.

## Architecture Patterns

### Recommended Project Structure
```
apps/mobile/                  # NOVO — casca Capacitor (não entra em nenhum Docker)
├── capacitor.config.ts       # appId, server.url, errorPath, plugins
├── package.json              # @sgs/mobile
├── www/
│   ├── index.html            # placeholder (cap sync exige webDir com index.html)
│   └── offline.html          # tela "Sem conexão" (HTML/CSS/JS puro)
├── assets/                   # icon-only/foreground/background.png, splash.png (+ fonte SVG)
├── scripts/check-config.mjs  # teste: appId, https, errorPath existe
└── android/                  # projeto nativo gerado por `cap add android`, COMMITADO
packages/shared/              # NOVO — fonte TS pura, sem build (main: src/index.ts)
├── package.json              # @sgs/shared
├── src/push.ts               # PUSH_KINDS, tipo do `data`, buildAgendaRoute(), isAllowedPushRoute()
├── src/graphql/device-tokens.ts  # documentos registerDeviceToken/unregisterDeviceToken
└── src/__tests__/
.github/workflows/android.yml # NOVO — build debug em PR, AAB assinado em dispatch/tag
apps/backend/src/push/        # NOVO — module, device-tokens service/resolver, fila, FCM client
```

### Pattern 1: Configuração Capacitor com `server.url` e tela offline
**What:** O bridge Android abre `server.url`, injeta o JS nativo só na origem remota (`addDocumentStartJavaScript`) e adiciona o `server.url` às origens permitidas (Bridge.java 8.6.2, linhas 240-242), logo `allowNavigation` **não é necessário** para o próprio host. Links externos (ex. `wa.me`) abrem no navegador do sistema por padrão. `BridgeWebViewClient` carrega `errorPath` quando um erro de **frame principal** ocorre em `onReceivedError` **e** em `onReceivedHttpError` (então 502 do nginx durante deploy também mostra a tela offline).
**When to use:** Sempre, para D-07/D-08.
**Example:**
```ts
// apps/mobile/capacitor.config.ts
// Source: https://capacitorjs.com/docs/config + Bridge.java/BridgeWebViewClient.java (8.6.2)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.gestorbeauty.app',
  appName: 'Gestor Beauty',
  webDir: 'www',
  server: {
    url: 'https://sgs.jessicaseixasmakeup.com.br',
    errorPath: 'offline.html', // relativo a webDir; SEM plugins nessa página
  },
  android: {
    backgroundColor: '#F7F6F3',
    appendUserAgent: 'GestorBeautyApp/1', // segunda detecção; útil p/ logs do nginx
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: { launchAutoHide: true, launchShowDuration: 3000, backgroundColor: '#F7F6F3', androidSplashResourceName: 'splash' },
    Keyboard: { resize: 'body' },
    SystemBars: { insetsHandling: 'css' },
  },
};
export default config;
```
`offline.html`: botão "Tentar novamente" faz `location.replace('https://sgs.jessicaseixasmakeup.com.br/')` (JS puro; sem plugin). Se a rede ainda estiver fora, o `errorPath` é acionado de novo, o que é o comportamento certo.

### Pattern 2: Detecção de nativo e carga dinâmica dos plugins
**What:** `Capacitor.isNativePlatform()` de `@capacitor/core` (já no bundle do frontend) é `true` só dentro do app. Todo código de plugin fica em `apps/frontend/src/infrastructure/native/` com `import()` dinâmico atrás desse guard para o bundle web não pagar o custo e os testes mockarem um único ponto.
```ts
// apps/frontend/src/infrastructure/native/platform.ts
import { Capacitor } from '@capacitor/core';
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
```

### Pattern 3: Registro de token após login, remoção no logout
- Hook `useNativePush()` montado no layout autenticado (dentro do `RouterProvider`, para usar `useNavigate`). Só roda se `isNativeApp()` e `selectIsAuthenticated` e `!impersonating` e há `organizationId`/`memberId` (platform admin sem salão não registra).
- Sequência: `PushNotifications.createChannel({ id: 'agenda', name: 'Agenda', importance: 4 })` -> `checkPermissions()` -> se `prompt`, `requestPermissions()` (Android 13+; em <=12 é sempre `granted`) -> `register()` -> listener `registration` -> mutation `registerDeviceToken` e guardar o token em `localStorage['sgs-device-token']`.
- **Quando pedir permissão (Claude's Discretion, recomendado):** logo após o primeiro login bem-sucedido dentro do app (contexto claro, equipe sabe por que), uma vez; gravar `sgs-push-asked` e não insistir se negou (o Android só mostra o prompt duas vezes). Nunca antes do login.
- Logout (`useAuth.logout`): antes de `logoutMutation`/`clearSession`, chamar `unregisterDeviceToken(token)` best-effort (`.catch(() => {})`, como o logout já faz) e remover a chave local. Não chamar `PushNotifications.unregister()` (apagaria o token FCM; desnecessário, a linha no servidor é que importa). Expiração de sessão via `error-link` (`clearSession`) não consegue chamar o backend: o registro fica órfão até a próxima pessoa registrar o mesmo token (upsert move para o novo membro) ou até o FCM devolver `UNREGISTERED`.
- Reregistrar a cada abertura do app (atualiza `last_seen_at`).

### Pattern 4: Toque na notificação -> agenda no dia, atendimento aberto
- `PushNotifications.addListener('pushNotificationActionPerformed', ev => ...)`. No Android o plugin emite com `retainUntilConsumed = true` (PushNotificationsPlugin.java:86), então um toque que **abre o app a frio** é entregue assim que o listener for adicionado, mesmo com o WebView remoto carregando depois. Registrar o listener cedo (no mount do layout/`App`).
- Payload FCM `data` carrega `route` (ex.: `/agenda?data=2026-11-20&visao=day&agendamento=<uuid>`). O handler valida com **allowlist** (`route.startsWith('/agenda')` e sem esquema/host) antes de `navigate(route)`; ignora qualquer outra coisa (evita open redirect via payload).
- **Lacuna no código existente:** `SchedulePage` lê `data` e `visao` (via `parseAgendaDate`/`parseAgendaView` em `features/operations/lib/agenda-link.ts`) mas não existe parâmetro para abrir o atendimento. Adicionar `agendamento=<id>` que abre o `AppointmentDetailsDialog` (e rola/destaca). Reaproveitar `toAgendaDateParam` (datas locais, nunca `toISOString`).
- Se a usuária não estiver logada ao tocar, o guard manda para `/login`; a rota pretendida se perde (ver Open Questions).
- Primeiro plano: `pushNotificationReceived` mostra `toast` (sonner já instalado) em vez de notificação do sistema.

### Pattern 5: Sessão persistente
`auth.store.ts` usa zustand `persist` em `localStorage` (`sgs-auth`), com refresh token de 30 dias. No Android WebView o localStorage da origem `https://sgs.jessicaseixasmakeup.com.br` persiste entre aberturas do app e é apagado só com "Limpar dados" ou desinstalação. **Recomendação: manter localStorage, sem `@capacitor/preferences`.** O Apollo `authLink` já injeta Bearer e `X-Organization-Id`; `HttpLink` usa `/graphql` relativo, que resolve para o próprio host do `server.url` (mesma origem, sem CORS).

### Pattern 6: Botão voltar, teclado, safe area
- `App.addListener('backButton', ({ canGoBack }) => canGoBack ? window.history.back() : App.exitApp())` (ou `App.minimizeApp()` na raiz, comportamento mais amigável no Android; `exitApp` cumpre literalmente o CONTEXT). Diálogos Radix abertos devem fechar antes de voltar: o handler pode checar `document.querySelector('[role="dialog"]')` e disparar `Escape`.
- Android 15+/targetSdk 36 força edge-to-edge. `index.html` hoje tem `viewport` **sem** `viewport-fit=cover` e o código **não usa** `env(safe-area-inset-*)`/`--safe-area-inset-*`. Adicionar `viewport-fit=cover` e padding de safe area no cabeçalho e na barra inferior do layout Gestor Beauty (afeta também o web; inofensivo fora de entalhes). `SystemBars` (core do Capacitor 8) com `insetsHandling: 'css'` injeta `--safe-area-inset-*`.
- Cor da barra de status: `StatusBar.setBackgroundColor` é ignorado em edge-to-edge; pintar o fundo do cabeçalho do layout (roxo/papel) sob a barra e usar `StatusBar.setStyle` para ícones claros/escuros.
- Teclado: `Keyboard.resize: 'body'` (ou `native`) para formulários não ficarem sob o teclado; testar no aparelho.

### Pattern 7: Backend de push neutro
- **Tabela `device_tokens`** (migration `2026111X..._device_tokens`, Prisma model `DeviceToken` `@@map("device_tokens")`):

| Coluna | Tipo | Nota |
|--------|------|------|
| `id` | uuid v7 | `gen_uuid_v7()` como as demais |
| `organization_id` | uuid | RLS |
| `member_id` | uuid FK `members` | dono do token |
| `provider` | varchar(10) | `'fcm'` (valor `'expo'` reservado para Expo Push Service, não usado) |
| `platform` | varchar(10) | `'android'`/`'ios'` |
| `token` | text | nunca logar inteiro |
| `app_version` | varchar(20) null | opcional |
| `last_seen_at` | timestamptz | atualizado a cada registro |
| `created_at` | timestamptz | |

  Índices: `UNIQUE (organization_id, provider, token)`; `INDEX (organization_id, member_id)`. RLS exatamente como em `20261114000000_bridal_timeline`: `ENABLE` + `FORCE ROW LEVEL SECURITY` + política `tenant_isolation` com `nullif(current_setting('app.current_organization', true), '')::uuid` em `USING` e `WITH CHECK`. Grants a `sgs_app` já vêm de `ALTER DEFAULT PRIVILEGES` da migration inicial.
- **Expo reaproveita?** Sim. `expo-notifications` `getDevicePushTokenAsync()` devolve o token FCM nativo (e o doc diz que serve para enviar via FCM direto); o app Expo precisa do mesmo projeto Firebase e do mesmo `applicationId` (`google-services.json`). Por isso `provider='fcm'` cobre Capacitor e Expo com token de aparelho; `provider='expo'` só existiria se um dia se usar o Expo Push Service (token `ExponentPushToken[...]`).
- **GraphQL (schema-first, novo `device-tokens.graphql`):** `registerDeviceToken(input: { token, platform, provider, appVersion }): Boolean!` e `unregisterDeviceToken(token: String!): Boolean!`. Permissão: reutilizar `PERMISSIONS.NOTIFICATION_READ` (`notification.read`), que ADMIN, MANAGER, ATTENDANT e PROFESSIONAL já têm (permissions.catalog.ts linhas 112/155/189/213). Evita nova permissão e migration de seed de `role_permissions`. Se o planner preferir `device.register` explícito, precisa de migration de seed para os 4 papéis.
- **Upsert de registro (dentro de `runWithTenant`):** apagar linhas com o mesmo `token` de **outros** membros da org, depois upsert por `(org, provider, token)` atualizando `member_id`, `last_seen_at`, `app_version`. Um aparelho compartilhado que troca de usuária não deixa o token da anterior recebendo avisos. Colisão entre organizações é intencionalmente por-org (RLS impede ver a linha de outra org); resíduo cross-org é limpo por logout ou por `UNREGISTERED`.
- **Envio fora da transação, com a fila existente:** hook **após o commit** em `AppointmentsService.createVisit` (cobre `quickCreate`, linha ~177), `AppointmentsService.cancel` e `BridalService.schedule` (retorna `appointmentIds`). Enfileirar `{ kind, orgId, actorMemberId, appointmentIds }` na fila `push-notifications` (`@InjectQueue`; `QueueModule` global já define `attempts: 3` + backoff exponencial). Envolver o `add()` em try/catch: falha de Redis nunca pode falhar a mutation de agenda. Só enfileirar quando `errors.length === 0`. Padrão de processor: `@Processor(...) extends WorkerHost` como `ContractAlertsProcessor`.
- **Processor:** carrega os agendamentos (`runWithTenant`), resolve destinatários e envia.
  - Destinatários (função pura testável `resolvePushTargets`): profissionais dos agendamentos (`professionalId`) + membros `status: 'active'`, `deletedAt: null`, `role.name in ['ADMIN','MANAGER']` (mesmo filtro de `RECIPIENT_ROLES` em `contract-alerts.service.ts`), **menos** o `actorMemberId` (D-13), dedup por membro.
  - Agendamento comum: profissional recebe só o(s) dele(s); gestoras recebem um aviso por visita/lote.
  - Noivas (D-15): quando os agendamentos têm `bridalGroupId`, agrupar por `professionalId` -> uma notificação "N atendimentos no <grupo>, dd/MM" por profissional; gestoras recebem **um** resumo do evento. A data usa o fuso da organização (padrão `localDateOf(d, timezone)` de `contract-alerts.service.ts`).
  - Cancelamento: um aviso por agendamento cancelado (profissional do atendimento + gestoras, exceto quem cancelou). `cancelBridalGroup` cancela vários de uma vez: decidir se cai no escopo (Open Questions).
  - Tokens do membro: `device_tokens` por `member_id`, dedup por token.
- **Mensagem FCM v1:**
```json
{ "message": {
  "token": "<fcm>",
  "notification": { "title": "Novo agendamento", "body": "Maria - Escova, 20/11 às 14:00 (com Ana)" },
  "data": { "kind": "appointment.created", "route": "/agenda?data=2026-11-20&visao=day&agendamento=<uuid>", "appointmentId": "<uuid>" },
  "android": { "priority": "HIGH", "notification": { "channel_id": "agenda", "color": "#570080" } }
} }
```
  Todos os valores de `data` devem ser **strings**. Mensagem com `notification` + `data` é exibida pelo sistema com app em segundo plano/fechado e o `data` chega no `pushNotificationActionPerformed`. Usar só `data` perderia a entrega com app morto (o plugin não tem serviço headless, conforme a doc). O mesmo formato serve ao Expo.
- **Cliente FCM:** interface `PushProvider { send(msg): Promise<SendResult> }` com `FcmPushProvider` (google-auth-library `GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })` + `fetch POST https://fcm.googleapis.com/v1/projects/<project_id>/messages:send`, Bearer). Credencial em env (`FCM_SERVICE_ACCOUNT_JSON` base64) lida por `AppConfigService`; **sem credencial o provider vira no-op com log** (backend sobe em dev/CI). Adicionar a `.env.staging.example` e ao compose do staging. Sem endpoint de batch no v1: enviar por token com concorrência limitada (~10-20 paralelos).
- **Limpeza de tokens inválidos** (doc de gerenciamento de tokens do FCM): HTTP 404 `UNREGISTERED` -> apagar a linha; 403 `SENDER_ID_MISMATCH` -> apagar; 400 `INVALID_ARGUMENT` -> só logar (pode ser payload ruim; só apagar se o erro indicar token); 429/5xx/`UNAVAILABLE` -> lançar para o BullMQ re-tentar; 401/403 de autenticação -> falhar alto (credencial errada). Opcional: job repetível que apaga `last_seen_at` com mais de 60 dias (o FCM descarta após 270 dias; considera obsoleto após ~1 mês sem conexão).

### Pattern 8: Monorepo pnpm e `packages/shared`
- `pnpm-workspace.yaml`: `packages: ['apps/*', 'packages/*']` (o `workspaces` do `package.json` raiz é ignorado pelo pnpm; atualizar por consistência). Rodar `pnpm install` e **commitar o `pnpm-lock.yaml` atualizado** (CI usa `--frozen-lockfile`).
- **Restrição crítica:** `docker-compose.staging.yml` usa `context: ./apps/backend` e `./apps/frontend`, e os Dockerfiles fazem `COPY package.json` + `pnpm install --no-frozen-lockfile` isolados do workspace. **Qualquer `"@sgs/shared": "workspace:*"` em backend/frontend quebra o build de imagem do deploy.** Portanto, nesta fase `packages/shared` não é dependência de backend nem frontend. Ele nasce como fonte TS pura (`"main": "src/index.ts"`, sem build, com `typecheck` e testes próprios para o `pnpm -r typecheck` do CI cobrir) contendo o que o Expo vai consumir: constantes/tipos do push, `buildAgendaRoute`/`isAllowedPushRoute`, documentos GraphQL de registro de token e validações zod. Backend e frontend mantêm cópias locais enxutas até uma fase futura mudar os contextos Docker para a raiz. Documentar isso explicitamente no README do pacote para ninguém "consertar" importando.
- `apps/mobile` também fica fora de Docker e fora do `pnpm build` raiz (script `build` raiz só chama backend/frontend; não adicionar `mobile` lá). `pnpm -r typecheck`/`lint` rodam em tudo que tiver o script: `@sgs/mobile` não deve definir `typecheck` que exija SDK Android.
- `.npmrc` do repo usa `shamefully-hoist`; `cap sync` com pnpm gera caminhos relativos em `android/capacitor.settings.gradle` para `node_modules/@capacitor/*`. Funciona no CI se o `pnpm install` roda antes; validar no primeiro build (Wave 0).

### Anti-Patterns to Avoid
- **Chamar plugin Capacitor de `offline.html`:** não há ponte lá (PR #7781 fechado sem merge). Só HTML/CSS/JS puro.
- **Instalar plugins só em `apps/mobile`:** o JS vem do bundle do frontend; sem as dependências no frontend o `registerPlugin` não existe.
- **Importar `@capacitor/push-notifications` estaticamente no frontend:** no browser os métodos lançam `unimplemented`; sempre guard + import dinâmico.
- **Enviar push dentro da transação de agendamento** (`runWithTenant`/`SCHEDULE_TX_OPTIONS`): segura locks de agenda e notificaria de agendamento que sofreu rollback.
- **Um push por agendamento no lote de noivas:** viola D-15.
- **Guardar `google-services.json`/keystore/service account no git.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token OAuth2 do FCM | Assinar JWT da service account na mão | `google-auth-library` `GoogleAuth` | Cache e renovação do access token, escopo correto |
| Fila/retry/backoff do envio | `setTimeout`/loops próprios | BullMQ (`QueueModule` já configurado, `attempts: 3`) | Retry, DLQ, idempotência por `jobId` |
| Ícone adaptativo e densidades, splash em todas as telas | Redimensionar PNGs à mão | `@capacitor/assets generate --android` | Gera `mipmap-*`, foreground/background, splash |
| Edge-to-edge/safe area | Reimplementar insets nativos | `SystemBars` + `viewport-fit=cover` + `--safe-area-inset-*` | Capacitor 8 trata Chromium < 140 e >= 140 |
| Assinatura do AAB | Scripts de `jarsigner` | Gradle `signingConfigs` lendo env + Play App Signing | Padrão da Play; Google guarda a chave de app |
| Permissão POST_NOTIFICATIONS | Código nativo | `PushNotifications.requestPermissions()` | O plugin declara e pede a permissão |
| Roteamento do toque | Intent filters/serviço nativo | `pushNotificationActionPerformed` (retido até consumo) | Funciona com app morto |

**Key insight:** o lado nativo precisa ser o mínimo possível (D-07). Quase tudo é config + JS no bundle existente + um módulo de backend; qualquer necessidade de Java/Kotlin próprio (ex. `DownloadListener`) deve ser tratada como exceção justificada.

## Runtime State Inventory

Não é fase de rename/refactor/migração de dados. Omitido. (Observação: a migration `device_tokens` exige backup do staging antes do deploy, conforme o padrão do projeto; o app Android passa a depender do host `sgs.jessicaseixasmakeup.com.br` fixo no `capacitor.config.ts`, então mudar o domínio no futuro exige nova versão do app.)

## Common Pitfalls

### Pitfall 1: Docker do staging quebra ao introduzir `packages/shared`
**What goes wrong:** `pnpm install` dentro da imagem não encontra `@sgs/shared` (contexto é só `apps/frontend` ou `apps/backend`).
**Why:** `context: ./apps/<app>` + Dockerfile com `COPY package.json`.
**How to avoid:** não declarar `@sgs/shared` em backend/frontend nesta fase (Pattern 8). **Warning signs:** `deploy-staging.sh` falha em "Construindo imagens".

### Pitfall 2: Plugins "somem" no app (UNIMPLEMENTED)
**What goes wrong:** `PushNotifications.register()` não faz nada ou lança erro.
**Why:** dependência só em um dos lados, versões divergentes, ou `cap sync` não rodado após adicionar plugin; ou chamada feita na `offline.html`.
**How to avoid:** versões idênticas fixas em `apps/frontend` e `apps/mobile`; CI roda `cap sync` e falha se `git diff` em `android/` mudar. **Warning signs:** `Capacitor.isPluginAvailable('PushNotifications') === false`.

### Pitfall 3: Splash eterna quando o servidor está fora
**What goes wrong:** com `launchAutoHide: false` e `SplashScreen.hide()` chamado só pelo SPA, se a página remota falha e cai no `offline.html` (sem plugins), a splash nunca some.
**How to avoid:** `launchAutoHide: true` com `launchShowDuration` como teto (~3000 ms) **e** `SplashScreen.hide({ fadeOutDuration: 200 })` assim que o SPA monta (some "assim que o sistema carrega", D-17).

### Pitfall 4: Tela offline só cobre navegação principal
**What goes wrong:** `errorPath` dispara em erros do **frame principal** (abrir o app, recarregar, mudar de página por navegação de documento). Navegação do SPA (react-router, `pushState`) e chamadas GraphQL sem rede não disparam nada: a usuária vê erros do Apollo.
**How to avoid:** além do `errorPath`, um overlay no SPA (somente no app nativo, ou em todos os ambientes) ouvindo `window` `offline`/`online` com texto "Sem conexão" + "Tentar novamente" (`window.location.reload()`). Cold start com sinal fraco pode demorar até o timeout do WebView antes do `errorPath` (relatos de comunidade, LOW): considerar `splash` com teto e aceitar.

### Pitfall 5: Cor da barra de status ignorada / conteúdo sob a barra
**What goes wrong:** com targetSdk 36 o app é edge-to-edge; `StatusBar.setBackgroundColor` não pinta; sem `viewport-fit=cover` e padding de safe area o cabeçalho encosta no relógio ou na câmera.
**How to avoid:** Pattern 6; validar em aparelho real e em emulador com entalhe.

### Pitfall 6: Canal e ícone de notificação
**What goes wrong:** notificação sem som/importância certa, ou ícone vira quadrado branco.
**Why:** o canal enviado em `android.notification.channel_id` precisa existir (criado por `createChannel` no JS); senão o FCM cai no canal padrão. O ícone de status bar deve ser branco sobre transparente.
**How to avoid:** `createChannel('agenda')` antes de `register`; no `AndroidManifest.xml`: `com.google.firebase.messaging.default_notification_channel_id=agenda`, `default_notification_icon` (vetor branco do monograma) e `default_notification_color=#570080`.

### Pitfall 7: Sideload de APK em aparelhos certificados no Brasil
**What goes wrong:** D-10 prevê testar por APK até existir a conta. Desde **30/09/2026** a verificação de desenvolvedor do Android está em vigor no **Brasil**, Indonésia, Singapura e Tailândia para apps instalados em dispositivos certificados Android 7+ (developer.android.com/developer-verification). APK avulso de desenvolvedor não registrado pode exigir o "fluxo avançado" (opções do desenvolvedor + espera de 24 h) ou `adb install`. A página oficial menciona contas de "distribuição limitada" (até 20 dispositivos, sem documento nem taxa) para estudantes/hobbistas; **não consegui confirmar nas fontes oficiais** os requisitos exatos para sideload nem se `adb install` é isento. (LOW/MEDIUM.)
**How to avoid:** planejar o teste pré-Play por `adb install` num aparelho de desenvolvimento e/ou registro do pacote como distribuição limitada; priorizar a criação da conta Play pela usuária (Pessoa física exige verificação de identidade). Tarefa humana explícita no plano.

### Pitfall 8: Política da Play para app "casca" de WebView
**What goes wrong:** possível rejeição como funcionalidade mínima/spam em revisão de produção.
**Status:** a doc do Capacitor diz que `server.url` não é para produção, e blogs relatam que Apple rejeita; para a Play não achei regra oficial que proíba WebView de site do próprio desenvolvedor (a política "Device and Network Abuse" trata de WebView com JavaScript interface carregando conteúdo **não confiável**; não é o caso, o domínio é do próprio produto). Teste interno tem pouca ou nenhuma revisão de conteúdo. **(LOW: texto da política "Minimum Functionality" não foi lido.)**
**How to avoid:** manter `allowMixedContent: false`, só HTTPS, sem `addJavascriptInterface` próprio, e o app tem funcionalidade nativa real (push, deep link). Reavaliar na fase de publicação aberta; plano B documentado: empacotar `dist` local com o mesmo código (mudança de config, sem reescrita).

### Pitfall 9: Downloads e PDFs em blob no WebView
**What goes wrong:** `ContractDetailPage.tsx` (linha ~121) e `use-contract-preview.ts` (linha ~60) usam `URL.createObjectURL(base64ToBlob(...))` para PDF de contrato; o WebView do Android não baixa/abre blob URLs como o Chrome, e o Capacitor não traz `DownloadListener`. Exportações (`/financeiro/exportacao`) podem ter o mesmo problema.
**How to avoid:** tratar como risco a **verificar no aparelho** na validação; se falhar, usar `@capacitor/share`/`@capacitor/filesystem` ou abrir via `data:`/endpoint HTTP autenticado, fora do escopo mínimo (D-01 diz "mesmas telas"); registrar como pendência se quebrar. (LOW: comportamento não testado aqui.)

### Pitfall 10: Runner do GitHub com Java 17 por padrão
**What goes wrong:** Capacitor 8 exige JDK 21 (`sourceCompatibility VERSION_21` nos `build.gradle` do pacote); o `ubuntu-24.04` vem com 17 como padrão (21 está instalado, mas não é o default).
**How to avoid:** `actions/setup-java@v4` com `distribution: temurin`, `java-version: 21`.

### Pitfall 11: versionCode da Play
**What goes wrong:** upload rejeitado por `versionCode` repetido.
**How to avoid:** derivar de `github.run_number` (`-PversionCode=$((1000 + RUN_NUMBER))`) lido no `build.gradle`; `versionName` do `package.json` de `apps/mobile`.

### Pitfall 12: Token de aparelho em logs / LGPD
Não logar tokens inteiros (últimos 6 caracteres bastam); apagar no logout; incluir `device_tokens` no tratamento de exclusão de membro se houver rotina (a migration `hard_delete_member_bridal` indica exclusão definitiva de membro: a FK precisa de `ON DELETE CASCADE` ou a rotina deve limpar `device_tokens`).

## Code Examples

### Hook de registro (esqueleto)
```ts
// apps/frontend/src/infrastructure/native/use-native-push.ts
// Source: https://capacitorjs.com/docs/apis/push-notifications
import { isNativeApp } from './platform';

export async function setupNativePush(opts: {
  onToken: (token: string) => void;
  onOpenRoute: (route: string) => void;
  onForeground: (title: string, body: string) => void;
}) {
  if (!isNativeApp()) return () => {};
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.createChannel({ id: 'agenda', name: 'Agenda', importance: 4 });
  const handles = await Promise.all([
    PushNotifications.addListener('registration', (t) => opts.onToken(t.value)),
    PushNotifications.addListener('pushNotificationActionPerformed', (ev) => {
      const route = ev.notification.data?.route;
      if (typeof route === 'string' && /^\/agenda(\?|$)/.test(route)) opts.onOpenRoute(route);
    }),
    PushNotifications.addListener('pushNotificationReceived', (n) =>
      opts.onForeground(n.title ?? '', n.body ?? '')),
  ]);
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
  if (perm.receive === 'granted') await PushNotifications.register();
  return () => handles.forEach((h) => h.remove());
}
```

### Envio FCM v1
```ts
// apps/backend/src/push/fcm-push.provider.ts
// Source: https://firebase.google.com/docs/cloud-messaging/send/v1-api
const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
const client = await auth.getClient();
const { token: bearer } = await client.getAccessToken();
const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
});
// 404 + details[].errorCode === 'UNREGISTERED' -> invalidToken
```

### Voltar do Android
```ts
// Source: https://capacitorjs.com/docs/apis/app
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) window.history.back();
  else void App.exitApp();
});
```

### Assinatura no Gradle (apps/mobile/android/app/build.gradle)
```groovy
android {
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
  buildTypes { release { signingConfig signingConfigs.release; minifyEnabled false } }
  defaultConfig {
    versionCode (project.findProperty('versionCode') ?: 1) as Integer
    versionName project.findProperty('versionName') ?: '0.1.0'
  }
}
```
O template do Capacitor aplica o plugin `google-services` apenas se `app/google-services.json` existir, então o build debug do CI funciona sem o arquivo (push inerte) e o build de release recebe o arquivo do secret.

### Workflow (esqueleto)
```yaml
# .github/workflows/android.yml — arquivo novo; não altera ci.yml
on:
  pull_request: { paths: ['apps/mobile/**', '.github/workflows/android.yml'] }
  workflow_dispatch:
  push: { tags: ['android-v*'] }
jobs:
  android:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21' }
      - uses: gradle/actions/setup-gradle@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @sgs/mobile exec cap sync android
      - name: Debug APK (PR)
        if: github.event_name == 'pull_request'
        working-directory: apps/mobile/android
        run: ./gradlew assembleDebug
      - name: Restaurar segredos (release)
        if: github.event_name != 'pull_request'
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > "$RUNNER_TEMP/upload.jks"
          echo "${{ secrets.GOOGLE_SERVICES_JSON_BASE64 }}" | base64 -d > apps/mobile/android/app/google-services.json
      - name: AAB assinado
        if: github.event_name != 'pull_request'
        working-directory: apps/mobile/android
        env:
          ANDROID_KEYSTORE_PATH: ${{ runner.temp }}/upload.jks
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: ./gradlew bundleRelease -PversionCode=$((1000 + ${{ github.run_number }}))
      - uses: actions/upload-artifact@v4
        if: github.event_name != 'pull_request'
        with: { name: gestor-beauty-aab, path: apps/mobile/android/app/build/outputs/bundle/release/*.aab, retention-days: 30 }
```
Também gerar um APK de release assinado (`assembleRelease`) como artefato para teste antes da conta Play existir (D-10).

### Ícone e splash
`assets/icon-foreground.png` (1024x1024, "GB" branco, margem segura de ~66% central para a máscara adaptativa), `assets/icon-background.png` (1024, `#570080` sólido), `assets/icon-only.png`, `assets/splash.png` e `splash-dark.png` (2732x2732, `#F7F6F3`, ícone ao centro). Gerar PNGs a partir de um SVG-fonte versionado (`assets/icon.svg`) com um script de rasterização (ex.: `sharp`/`rsvg-convert` fora do CI) e rodar `npx @capacitor/assets generate --android --iconBackgroundColor '#570080' --splashBackgroundColor '#F7F6F3'`. Trocar o logo oficial depois = substituir os PNGs/SVG e rodar o comando (D-16). Ícone de notificação (branco/transparente) é um vetor drawable à parte.

## Build, assinatura e guarda da keystore (recomendação)

**VPS: não.** A VPS tem Java 21 e `keytool`, mas **não** tem Android SDK, Gradle nem `adb`; tem 7 GB de RAM com ~4 GB em uso pelos serviços do staging e 2 vCPU. Gradle + AGP 8.13 + daemon do Kotlin pedem 3-4 GB e baixam ~2-3 GB de SDK; rodaria junto do Postgres/Valkey/Meilisearch do staging e arrisca derrubá-los (OOM). **Mac da usuária:** exige instalar Android Studio, dependente de uma pessoa para cada release.
**Recomendado: GitHub Actions** (repo `danielleite-dlr/sgs`, `gh` autenticado na VPS). O `ubuntu-24.04` traz Android SDK com `android-36` e build-tools 36.0.0, JDK 21 instalável por `setup-java`. Com `server.url`, o build **não precisa compilar o frontend**: só `cap sync` + Gradle (~5-8 min, a verificar).

**Keystore (D-03):**
1. Gerar uma vez, **fora do repo** e fora da VPS de deploy se possível: `keytool -genkeypair -v -storetype PKCS12 -keystore gestor-beauty-upload.jks -alias gestorbeauty -keyalg RSA -keysize 2048 -validity 10000`.
2. Guardar: gerenciador de senhas (arquivo `.jks` anexado + senhas + alias) **e** uma cópia offline em segundo lugar (pendrive/outro cloud privado), documentado em um runbook (sem segredos) no repo, ex. `apps/mobile/KEYSTORE.md` com impressões digitais SHA-1/SHA-256 do upload key (`keytool -list -v`).
3. GitHub Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64`. `.gitignore`: `*.jks`, `*.keystore`, `google-services.json`, chaves de service account.
4. **Play App Signing:** ativar no primeiro upload (obrigatório para AAB em apps novos). A chave do **upload** é a que fica com a usuária; a chave de **app signing** fica com o Google. Perder a chave de upload é recuperável via suporte da Play (reset de upload key), mas isso não substitui o backup. O futuro app Expo/EAS assina o AAB com a **mesma upload key** (importada no EAS) e o mesmo appId, saindo como atualização do mesmo app (D-03).
5. Service account do FCM (envio do backend) é **separada** da keystore: criar no console Firebase (projeto `gestor-beauty`), papel mínimo "Firebase Cloud Messaging API Admin", e passar só por `.env.staging` (nunca no repo).

**Pré-requisito humano:** projeto Firebase com app Android `br.com.gestorbeauty.app`, download do `google-services.json`, geração da service account. Registrar também as SHA-256 do upload key e da app signing key (Play Console) no Firebase se algum dia usar App Links/Google Sign-In (não necessário para FCM).

## Deep link (D-14): App Links ou só push?
O toque na notificação **não** precisa de App Links/`assetlinks.json`: o `route` vai no `data` do FCM e o `pushNotificationActionPerformed` navega dentro do SPA. App Links (links `https://sgs.../agenda?...` abrindo o app) só são necessários para abrir o app a partir de links externos (WhatsApp, e-mail). **Recomendação: não implementar App Links nesta fase** (o CONTEXT só pede como opção do planner); se for incluído, precisa de `intent-filter` com `autoVerify` + `/.well-known/assetlinks.json` no nginx com a SHA-256 da chave de **app signing** da Play (não da upload key).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FCM legacy HTTP API / server key | FCM HTTP v1 com OAuth2 de service account | legado desligado em 2024 | Só v1 (decidido em D-04) |
| `@capacitor/status-bar` para tudo | `SystemBars` (core, Capacitor 8) + CSS safe area | Capacitor 8 (`adjustMarginsForEdgeToEdge` removido) | Layout deve usar `env()`/`--safe-area-inset-*` |
| targetSdk 35 | **targetSdk 36 obrigatório** para apps novos/atualizações | 31/08/2026 (extensão até 01/11/2026 já passou) | Capacitor 8 já nasce em 36 |
| Contas pessoais: publicar direto | Contas pessoais novas (>13/11/2023): teste fechado com 12 testes por 14 dias antes de produção | 2023, ajustado depois | Só afeta publicação aberta (diferida); teste interno é permitido (fontes secundárias; verificar no Console) |
| Sideload livre | Verificação de desenvolvedor (Brasil desde 30/09/2026) | 2026 | Ver Pitfall 7 |

**Deprecated/outdated:** `subscriptions-transport-ws` (já fora do projeto); `bridge_layout_main.xml` (renomeado no Capacitor 8); Cordova no `@capacitor/assets`.

## Open Questions

1. **Toque na notificação com sessão expirada.**
   - Sabido: o guard manda para `/login`. Não sabido: se o login preserva a rota de destino.
   - Recomendação: guardar `route` pendente em `sessionStorage` e navegar após login; se complexo, aceitar cair no dashboard (refresh de 30 dias torna raro).
2. **`cancelBridalGroup` e cancelamentos em massa devem notificar?** D-11 fala em "cancelamento" de agendamento. Recomendação: notificar por agendamento só no `cancel` individual; cancelamento de grupo gera um resumo por profissional (mesma lógica de D-15) ou fica fora. Decidir no plano; padrão sugerido: fora desta fase (documentar).
3. **Aparelho compartilhado entre salões / platform admin (impersonating).** Recomendado não registrar token quando `impersonating` ou sem `memberId`. Confirmar.
4. **PDF/blob e downloads no WebView** (Pitfall 9): precisa de teste manual antes de decidir correção.
5. **Notificação também no sino (`notifications`)?** D-11 diz que alertas do sino ficam para depois; recomendação: não criar linha em `notifications` nesta fase.
6. **Verificação de desenvolvedor para APK** (Pitfall 7): requisitos exatos para instalar APK avulso no Brasil não confirmados; definir caminho de teste antes da conta Play.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | cap CLI (>=22), build | ✓ (VPS) | v26.9.0; CI usa 22 | — |
| pnpm | monorepo | ✓ | 9.15.4 | — |
| JDK 21 | Gradle/Capacitor 8 | ✓ (VPS); runner precisa de `setup-java` | 21.0.12 | — |
| keytool | gerar keystore | ✓ (VPS) | JDK 21 | — |
| Android SDK / cmdline-tools / adb | build local de APK | ✗ (VPS) | — | **GitHub Actions** (SDK 36 pré-instalado); aparelho/`adb` na máquina da usuária ou do dev |
| Gradle | build | ✗ | — | Wrapper (`gradlew`) gerado pelo `cap add android` |
| Docker | staging | ✓ | — | — |
| `gh` CLI autenticado | secrets/workflow | ✓ | conta `danielleite-dlr` | — |
| Conta Google Play (pessoa física) | teste interno | ✗ (D-10: usuária cria) | — | APK assinado do CI (ver Pitfall 7) |
| Projeto Firebase + `google-services.json` + service account FCM | push | ✗ | — | Sem eles, push fica inerte (provider no-op); app abre normalmente |
| Valkey/Redis (BullMQ) | fila de push | ✓ (staging/CI) | 8 | — |

**Missing dependencies with no fallback:** projeto Firebase (ação humana: criar projeto, registrar app `br.com.gestorbeauty.app`, baixar `google-services.json`, criar service account). Sem isso o push não pode ser validado de ponta a ponta.
**Missing dependencies with fallback:** Android SDK na VPS -> CI; conta Play -> APK.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend | Jest 29 (`apps/backend`, specs `*.spec.ts` em `src/`; integração `test/integration/*.e2e.spec.ts` com Postgres real, `jest-integration.config.ts`) |
| Frontend | Vitest (jsdom, `globals: true`, setup `src/test-setup.ts`), Testing Library |
| Mobile | `node --test`/script em `apps/mobile/scripts/check-config.mjs` (sem framework novo) |
| Shared | Vitest simples ou `node --test` em `packages/shared` (sem dependência de DOM) |
| Quick run | `pnpm --filter @sgs/backend test -- push` · `pnpm --filter @sgs/frontend test -- native` |
| Full suite | `pnpm -r typecheck && pnpm --filter @sgs/backend test && pnpm --filter @sgs/frontend test` (+ job `integration` do CI) |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| C-03 | `resolvePushTargets`: profissional só os dele; ADMIN/MANAGER todos; exclui ator (D-13); dedup | unit | `pnpm --filter @sgs/backend test -- resolve-push-targets` | ❌ Wave 0 |
| C-03 | Noivas D-15: uma notificação por profissional + um resumo gestora; texto "3 atendimentos no casamento da Vitória, 08/11" | unit | `pnpm --filter @sgs/backend test -- push-bridal` | ❌ Wave 0 |
| C-03 | `FcmPushProvider` com `fetch`/GoogleAuth mockados: payload (strings, channel_id), 404 UNREGISTERED -> invalidToken, 5xx -> lança | unit | `pnpm --filter @sgs/backend test -- fcm-push` | ❌ Wave 0 |
| C-03 | Processor apaga token inválido; sem credencial = no-op | unit | `... test -- push.processor` | ❌ Wave 0 |
| C-03 | Hooks pós-commit em `createVisit`/`cancel`/`schedule` enfileiram; falha de fila não falha a mutation | unit (fila mockada) | `... test -- appointments.service` | ✅ specs existentes podem precisar do novo provider injetado (verificar construtores) |
| C-03 | `device_tokens` RLS: org B não vê token da org A; upsert move token entre membros; unregister apaga | integration | `pnpm --filter @sgs/backend test:integration -- device-tokens` | ❌ Wave 0 |
| C-04 | `isAllowedPushRoute`/`buildAgendaRoute` (allowlist só `/agenda`) | unit (shared + frontend) | `pnpm --filter @sgs/frontend test -- push-route` | ❌ Wave 0 |
| C-04 | `SchedulePage` abre atendimento com `?agendamento=<id>` | unit (RTL) | `pnpm --filter @sgs/frontend test -- schedule` | ❌ Wave 0 (estender testes de operations) |
| C-03/C-04 | `setupNativePush` com `@capacitor/core` e `@capacitor/push-notifications` mockados (`vi.mock`): permissão, register, token -> mutation, toque -> navigate, ignora rota fora da allowlist | unit | `pnpm --filter @sgs/frontend test -- use-native-push` | ❌ Wave 0 |
| C-03 | Logout chama `unregisterDeviceToken` e limpa chave local; falha da mutation não impede logout | unit | `pnpm --filter @sgs/frontend test -- useAuth` | ❌ Wave 0 |
| C-02 | Overlay offline (eventos `online/offline`) e botão "Tentar novamente" | unit | `pnpm --filter @sgs/frontend test -- offline` | ❌ Wave 0 |
| C-01/C-02 | `capacitor.config.ts`: appId, `server.url` https do staging, `errorPath` aponta para arquivo existente em `www/` | unit/script | `pnpm --filter @sgs/mobile test` | ❌ Wave 0 |
| C-01 | Projeto Android compila (debug APK) | CI | job `android` (`assembleDebug`) | ❌ Wave 0 |
| C-06 | `pnpm install --frozen-lockfile` + `pnpm -r typecheck` verdes com `packages/shared`; `docker build` do frontend/backend continuam passando | CI + manual | job `typecheck`; `docker compose -f docker-compose.staging.yml build` | ❌ Wave 0 |
| C-05 | Ícones/splash gerados presentes (`mipmap-anydpi-v26/ic_launcher.xml`, `drawable*/splash.png`) | script | `pnpm --filter @sgs/mobile test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** teste do módulo alterado (quick run acima) + `pnpm -r typecheck`.
- **Per wave merge:** suite completa backend + frontend; migration aplicada no Postgres do CI (job `integration`).
- **Phase gate:** CI verde (incl. job `android`), AAB/APK assinado gerado como artefato, e checklist humano concluído antes de `/gsd:verify-work`.

### Verificação humana (não automatizável nesta fase)
- Instalar o APK/AAB em aparelho real Android (ideal: um com Android 13+ e outro mais antigo): login, permanência após fechar/abrir, ícone, nome "Gestor Beauty", splash `#F7F6F3`.
- Permissão de notificações (prompt Android 13+), push com app **em primeiro plano, segundo plano e fechado** para novo agendamento, cancelamento e lote de noivas (verificar D-12/D-13/D-15 com duas contas em dois aparelhos).
- Toque abre `/agenda` no dia com o atendimento aberto (inclusive abrir a frio).
- Modo avião ao abrir -> tela "Sem conexão" -> reconectar -> "Tentar novamente"; queda no meio da sessão (overlay SPA).
- Botão voltar, teclado sobre formulários, entalhe/safe area, cor da barra de status; PDF de contrato e exportações (Pitfall 9).
- Teste interno na Play Console (convite por e-mail, instalação pela loja) quando a conta existir; verificar estado da conta e identidade.

### Wave 0 Gaps
- [ ] `apps/backend/src/push/*.spec.ts` (targets, FCM client, processor, hooks)
- [ ] `apps/backend/test/integration/device-tokens.e2e.spec.ts` (RLS + upsert)
- [ ] `apps/frontend/src/infrastructure/native/__tests__/*` (mocks de `@capacitor/*`; criar helper de mock em `test-setup`/`__mocks__`)
- [ ] `apps/mobile/scripts/check-config.mjs` + script `test` no `package.json` do mobile
- [ ] `packages/shared` com `typecheck` e testes; atualizar `pnpm-workspace.yaml` e `pnpm-lock.yaml`
- [ ] `.github/workflows/android.yml` e secrets no GitHub
- [ ] Validar `cap sync` + Gradle com a estrutura pnpm (hoisting) na primeira execução do CI

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-11-14): versões de `@capacitor/*`, `@capacitor/assets`, `firebase-admin` (engines Node >=22), `expo-notifications`, `google-auth-library`.
- https://capacitorjs.com/docs/updating/8-0 : Android Studio Otter 2025.2.1+, Node 22+, compileSdk/targetSdk 36, minSdk 24, AGP 8.13.0, Gradle 8.14.3, edge-to-edge/SystemBars, `adjustMarginsForEdgeToEdge` removido.
- Código-fonte `@capacitor/android@8.6.2` (`npm pack`): JDK 21 (`VERSION_21`), AGP 8.13.0, `Bridge.java` (origens permitidas incluem `server.url`; injeção por `addDocumentStartJavaScript`; `errorUrl`), `BridgeWebViewClient.java` (errorPath só em frame principal, em erro de rede e HTTP).
- Código-fonte `@capacitor/push-notifications@8.1.3`: `notifyListeners("pushNotificationActionPerformed", ..., true)` (retido), `POST_NOTIFICATIONS`, `firebase-messaging` 25.0.1, `MessagingService`.
- https://capacitorjs.com/docs/config : `server.url`/`allowNavigation`/`cleartext` "não para produção"; `errorPath` sem plugins no Android; `android.*`.
- https://capacitorjs.com/docs/apis/push-notifications : setup Android, permissões, canais, ícone, data-only não chega com app morto.
- https://capacitorjs.com/docs/apis/system-bars : `insetsHandling`, `viewport-fit=cover`, relação com status-bar.
- https://developer.android.com/google/play/requirements/target-sdk : API 36 desde 31/08/2026 (novos apps e atualizações), extensão até 01/11/2026.
- https://firebase.google.com/docs/cloud-messaging/send/v1-api e /manage-tokens : endpoint v1, escopo, `UNREGISTERED` (404), `INVALID_ARGUMENT`, 270 dias, ~1 mês.
- https://docs.expo.dev/versions/latest/sdk/notifications/ : `getDevicePushTokenAsync()` devolve token FCM nativo utilizável diretamente.
- https://developer.android.com/developer-verification : enforcement desde 30/09/2026 no Brasil, contas de distribuição limitada.
- https://github.com/actions/runner-images (Ubuntu2404-Readme): Android SDK platforms 36/37, build-tools 36.0.0, Java 21 instalado, 17 padrão.
- https://github.com/ionic-team/capacitor-assets : arquivos-fonte, tamanhos, flags.
- Código do repositório lido: `auth.store.ts`, `auth-link.ts`, `apollo/client.ts`, `router.tsx`, `agenda-link.ts`, `useAuth.ts`, `appointments.service.ts`, `bridal.service.ts`/`bridal-schedule.ts`, `contract-alerts.service.ts/processor`, `queue.module.ts`, `permissions.catalog.ts`, migration `20261114000000_bridal_timeline`, `schema.prisma`, Dockerfiles, `docker-compose.staging.yml`, `ci.yml`, `pnpm-workspace.yaml`.

### Secondary (MEDIUM confidence)
- https://github.com/ionic-team/capacitor/pull/7781 (fechado sem merge em 23/02/2026) e issue #7373: plugins indisponíveis na página de erro.
- Android Authority / Notebookcheck / gadgethacks (via busca): detalhes da verificação de desenvolvedor, ADB não é "isenção" documentada.
- Blogs de testers (testerscommunity, extendsclass etc.): regra dos 12 testers só para produção em contas pessoais novas; teste interno sem mínimo.

### Tertiary (LOW confidence)
- Texto oficial da política "Minimum Functionality"/webview da Play **não lido** (página consultada era outra); risco de rejeição de casca WebView em produção não confirmado nem descartado.
- Comportamento de blob/PDF e downloads no WebView Capacitor: inferido, não testado.
- Tempo de build no runner (5-8 min) e latência do `errorPath` em sinal fraco: estimativas.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, versões do registro e requisitos do guia oficial 8.0 conferidos, mais código-fonte dos pacotes.
- Architecture: MEDIUM-HIGH, padrões do repo lidos direto; pontos de enganche (pós-commit em três serviços) ainda dependem de conferir construtores dos specs existentes.
- Pitfalls: MEDIUM, os de build/Docker/plugins estão verificados em fonte; política da Play, verificação de desenvolvedor e blob/PDF são LOW.

**Research date:** 2026-11-14
**Valid until:** ~2026-12-14 para versões de pacotes (Capacitor ~8.x patch semanal); a política de verificação de desenvolvedor da Play evolui rápido, rechecar antes do teste por APK.

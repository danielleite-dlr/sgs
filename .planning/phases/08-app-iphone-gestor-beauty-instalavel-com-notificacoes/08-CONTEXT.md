# Phase 8: App iPhone Gestor Beauty instalável com notificações - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning
**Source:** Escopo do ROADMAP.md aprovado pela usuária em 17/11/2026 (caminho 1 de 4, com notificações); sem discuss-phase

<domain>
## Phase Boundary

A equipe do salão instala o Gestor Beauty no iPhone sem App Store e sem conta Apple, como app web
instalável (Safari → Compartilhar → Adicionar à Tela de Início), e recebe as mesmas notificações do
Android (novo agendamento, cancelamento, lote de noivas, e os demais eventos já ligados na fase 7)
por Web Push.

</domain>

<decisions>
## Implementation Decisions

### Instalação (frontend)
- D-01: Botão "Instalar no iPhone" na tela de login, ao lado do "Baixar app Android" (quick 261117-2pd).
  Só aparece em iPhone/iPad (inclui iPadOS que se apresenta como Mac com touch) e fora do modo
  instalado (`display-mode: standalone` / `navigator.standalone`). Abre um passo a passo:
  Safari → Compartilhar → Adicionar à Tela de Início. Fora do Safari, avisar que precisa abrir no Safari.
- D-02: Web app manifest com nome "Gestor Beauty", ícone GB roxo (mesma arte do Android, fase 7 07-06),
  `apple-touch-icon`, `display: standalone`, `theme_color`/`background_color` do tema Gestor Beauty,
  `start_url` e `scope` do app.
- D-03: Não é PWA offline: o service worker NÃO faz cache do sistema (fora do escopo). Ele só trata
  `push` e `notificationclick`.

### Notificações (frontend)
- D-04: Service worker com `push` (mostra título/corpo vindos do payload) e `notificationclick`
  abrindo/focando o app na rota da notificação, usando a mesma rota segura do Android
  (validação de rota da fase 7, `?agendamento=` na agenda do dia).
- D-05: Botão "Ativar notificações" dentro do app instalado (o iOS exige gesto da usuária; iOS 16.4+).
  Só aparece quando instalado, com suporte a Push e permissão ainda não concedida. Mostrar estado
  (ativado / bloqueado nas configurações / iOS antigo sem suporte).
- D-06: Logout desinscreve (remove o registro no backend e chama `unsubscribe`), igual ao Android.
- D-07: No app Android (casca Capacitor) nada muda: o caminho FCM nativo continua; o Web Push só
  entra quando não é Capacitor nativo.

### Backend
- D-08: Segundo canal Web Push (VAPID) ao lado do FCM, reaproveitando `device_tokens`
  (provider `webpush`, platform `ios`), os mesmos destinatários, textos, rotas e a mesma fila/worker
  da fase 7. A inscrição (endpoint + chaves p256dh/auth) é guardada no registro do aparelho.
- D-09: Inscrição inválida (HTTP 404/410 do serviço de push) é removida, como o FCM faz com
  token inválido.
- D-10: Chaves VAPID (pública, privada, subject) no `.env.staging` e no schema de env; a pública
  chega ao frontend (env de build ou query). Sem chaves → canal desligado sem derrubar o boot.

### Infra
- D-11: nginx sem cache para `sw.js` e manifest (`Cache-Control: no-cache`), tipo correto do manifest.

### Claude's Discretion
- Biblioteca Web Push no backend (ex.: `web-push`), formato exato do payload, onde guardar as chaves
  da inscrição (colunas novas vs JSON), como o frontend recebe a chave pública, divisão em planos/ondas.
- Texto exato do passo a passo e dos estados do botão, seguindo o visual Gestor Beauty existente.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fase 7 (push FCM e app Android — base a reaproveitar)
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md` — decisões D-01..D-15 do push
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md` — arquitetura do push
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-02-SUMMARY.md` — `device_tokens`
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-03-SUMMARY.md` — cliente FCM, alvos e textos
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-07-SUMMARY.md` — PushModule, fila e worker
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-08-SUMMARY.md` — NativeAppBridge, logout
- `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-05-SUMMARY.md` — rota segura e deep link

### Login e deploy
- `.planning/quick/261117-2pd-botao-baixar-apk-no-login/` — botão "Baixar app Android" e nginx do staging
- `infra/nginx/sgs-staging.conf`, `scripts/deploy-staging.sh`

</canonical_refs>

<specifics>
## Specific Ideas

- Mesmo ícone GB roxo do Android.
- Verificação final no iPhone real da usuária (instalar, ativar, receber um aviso de agendamento e
  tocar para abrir a agenda no dia).

</specifics>

<deferred>
## Deferred Ideas

- App Store / TestFlight / app nativo iOS.
- Modo offline do sistema (cache de telas e dados).

</deferred>

---

*Phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes*
*Context gathered: 2026-11-17 from ROADMAP scope*

---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/generate-pwa-icons.mjs
  - apps/frontend/public/icons/apple-touch-icon-180.png
  - apps/frontend/public/icons/icon-192.png
  - apps/frontend/public/icons/icon-512.png
  - apps/frontend/public/icons/icon-512-maskable.png
  - apps/frontend/public/manifest.webmanifest
  - apps/frontend/index.html
  - apps/frontend/src/__tests__/pwa-manifest.test.ts
  - apps/frontend/public/sw.js
  - apps/frontend/src/__tests__/service-worker.test.ts
  - apps/frontend/nginx.conf
  - scripts/check-pwa-headers.sh
  - apps/e2e/tests/pwa-instalavel.spec.ts
autonomous: true
requirements: [D-02, D-03, D-04, D-11]

must_haves:
  truths:
    - "O site tem manifest 'Gestor Beauty' com display standalone, cores do tema, start_url/scope '/' e ícones GB roxo; index.html liga o manifest e o apple-touch-icon (D-02)"
    - "O service worker só trata install/activate/push/notificationclick: sem handler de fetch e sem caches (D-03)"
    - "Todo push termina em showNotification (com título padrão se o payload vier ruim) e o toque abre/foca o app numa rota permitida da agenda, senão /agenda (D-04)"
    - "A regex de rota do sw.js é idêntica à de push-route.ts e de packages/shared/src/push.ts (teste de paridade)"
    - "O container do frontend serve /sw.js e /manifest.webmanifest com Cache-Control no-cache, tipo JS e application/manifest+json, mantendo os 3 headers de segurança (D-11)"
  artifacts:
    - path: "apps/frontend/public/manifest.webmanifest"
      provides: "Manifest do app instalável"
      contains: "\"display\": \"standalone\""
    - path: "apps/frontend/public/sw.js"
      provides: "Service worker de push"
      contains: "showNotification"
    - path: "apps/frontend/nginx.conf"
      provides: "location = /sw.js e = /manifest.webmanifest sem cache"
      contains: "location = /sw.js"
    - path: "scripts/check-pwa-headers.sh"
      provides: "Teste de headers contra a imagem local ou o staging"
  key_links:
    - from: "apps/frontend/index.html"
      to: "/manifest.webmanifest"
      via: "<link rel=\"manifest\">"
      pattern: "rel=\"manifest\""
    - from: "apps/frontend/public/sw.js"
      to: "apps/frontend/src/infrastructure/native/push-route.ts"
      via: "cópia de AGENDA_ROUTE_RE com teste de paridade"
      pattern: "AGENDA_ROUTE_RE"
---

<objective>
A parte estática do app instalável: ícones GB roxo, manifest, metas do iOS no `index.html`, o `sw.js` (só push e clique, sem cache) e o nginx do container servindo `sw.js`/manifest sem cache, com um script que confere os headers.

Purpose: D-02/D-03/D-04/D-11 — sem isso o iPhone não instala como app, não recebe push, ou fica preso a um service worker velho (regra regex de cache de 1 ano do nginx casaria com `/sw.js`).
Output: arquivos em `public/`, `index.html`, `nginx.conf`, `scripts/check-pwa-headers.sh`, testes vitest e E2E.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-CONTEXT.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-RESEARCH.md

**Ambiente de execução:** igual ao 08-01. Frontend sem prettier: arquivos novos à mão (aspas simples, ~100 colunas). Não adicionar `vite-plugin-pwa`/Workbox (D-03). Nada aqui muda o `pnpm-lock.yaml`.

<interfaces>
Arte do ícone: `apps/mobile/assets/icon-only.png` (1024x1024, fundo roxo `#570080` de ponta a ponta com "GB" branco; tem canal alfa) e `apps/mobile/assets/icon.svg`. `sharp@0.35.5` existe em `/root/sgs/node_modules/.pnpm/sharp@0.35.5/node_modules/sharp` (não é dependência declarada; ImageMagick não está instalado).
Cores: `theme_color` `#570080`, `background_color` `#F7F6F3` (mesmas do `apps/mobile/capacitor.config.ts`). O teste `src/styles/__tests__/sem-cor-antiga.test.ts` varre só `src/` e proíbe `#F7F6F3` lá: manter a cor só em `public/manifest.webmanifest` e `index.html`, nunca em `src/`.
`apps/frontend/src/infrastructure/native/push-route.ts`:
```ts
export const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;
export function isAllowedPushRoute(route: unknown): route is string; // string, <=300, sem '..', sem '//' no início, casa a regex
```
`packages/shared/src/push.ts` tem a mesma `AGENDA_ROUTE_RE` (linha `export const AGENDA_ROUTE_RE = ...`).
Payload enviado pelo backend (08-04): `{"title": string, "body": string, "data": {"kind", "route", "appointmentId", "groupId"?}}`.
`apps/frontend/nginx.conf` hoje: headers de segurança no server; `location ~* \.(js|css|png|...)$ { expires 1y; Cache-Control "public, immutable" }`; `location = /index.html` e `location /` com `no-cache`. `add_header` em location SUBSTITUI os herdados: repetir os 3 headers de segurança em cada bloco novo.
Build: `apps/frontend/Dockerfile` target `production` (nginx:alpine copia `dist` e `nginx.conf`); contexto `./apps/frontend`.
E2E: `apps/e2e/playwright.config.ts` com `baseURL http://localhost:${FRONTEND_PORT}` (vite dev 5180) — o Vite serve `public/` na raiz.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ícones GB, manifest e metas do iOS no index.html</name>
  <files>scripts/generate-pwa-icons.mjs, apps/frontend/public/icons/apple-touch-icon-180.png, apps/frontend/public/icons/icon-192.png, apps/frontend/public/icons/icon-512.png, apps/frontend/public/icons/icon-512-maskable.png, apps/frontend/public/manifest.webmanifest, apps/frontend/index.html, apps/frontend/src/__tests__/pwa-manifest.test.ts</files>
  <read_first>
    - apps/frontend/index.html
    - apps/mobile/capacitor.config.ts (cores)
    - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts (padrão de teste que lê arquivo como texto)
  </read_first>
  <behavior>
    - manifest é JSON válido com `id "/"`, `name` e `short_name` "Gestor Beauty", `start_url "/"`, `scope "/"`, `display "standalone"`, `theme_color "#570080"`, `background_color "#F7F6F3"`, `lang "pt-BR"`
    - todo `icons[].src` do manifest existe em `public/`; há 192 e 512 `purpose any` e 512 `purpose maskable`
    - `index.html` tem `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` = Gestor Beauty, `theme-color` `#570080`, e o `viewport-fit=cover` continua
    - os PNG têm as dimensões declaradas e o apple-touch-icon não tem transparência (lido pelo cabeçalho IHDR: largura/altura nos bytes 16-23, tipo de cor no byte 25 = 2, RGB)
  </behavior>
  <action>
1. `scripts/generate-pwa-icons.mjs` (versionado para refazer os ícones; roda uma vez): achar o sharp por `fs.readdirSync('node_modules/.pnpm').find((d) => d.startsWith('sharp@'))` a partir da raiz do repo e importar `node_modules/.pnpm/<dir>/node_modules/sharp/lib/index.js` com `createRequire`; ler `apps/mobile/assets/icon-only.png` e gravar em `apps/frontend/public/icons/`:
   - `apple-touch-icon-180.png`: `resize(180,180).flatten({ background: '#570080' }).removeAlpha().png()` (iOS pinta transparência de preto)
   - `icon-192.png`: `resize(192,192).flatten({ background: '#570080' }).png()`
   - `icon-512.png`: `resize(512,512).flatten({ background: '#570080' }).png()`
   - `icon-512-maskable.png`: igual ao 512 (a arte já é fundo roxo de ponta a ponta com "GB" dentro da área segura de 80%)
   Rodar `node scripts/generate-pwa-icons.mjs` e conferir `file apps/frontend/public/icons/*.png`.
2. `apps/frontend/public/manifest.webmanifest`:
```json
{
  "id": "/",
  "name": "Gestor Beauty",
  "short_name": "Gestor Beauty",
  "description": "Agenda, comandas e clientes do salão.",
  "lang": "pt-BR",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#570080",
  "background_color": "#F7F6F3",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/apple-touch-icon-180.png", "sizes": "180x180", "type": "image/png", "purpose": "any" }
  ]
}
```
3. `index.html`, no `<head>` depois do favicon: `<link rel="manifest" href="/manifest.webmanifest" />`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />`, `<meta name="apple-mobile-web-app-capable" content="yes" />`, `<meta name="mobile-web-app-capable" content="yes" />`, `<meta name="apple-mobile-web-app-title" content="Gestor Beauty" />`, `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`, `<meta name="theme-color" content="#570080" />`. Não mexer no `viewport` nem nas fontes.
4. `src/__tests__/pwa-manifest.test.ts`: ler `public/manifest.webmanifest`, `index.html` e os PNG com `node:fs` (`join(__dirname, '../..', ...)`), casos do `<behavior>`.
5. `corepack pnpm --filter @sgs/frontend test -- pwa-manifest sem-cor-antiga`. Commit `feat(08-03): manifest e ícones do Gestor Beauty para o iPhone`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- pwa-manifest sem-cor-antiga</automated>
  </verify>
  <acceptance_criteria>
    - `ls apps/frontend/public/icons/` lista `apple-touch-icon-180.png icon-192.png icon-512.png icon-512-maskable.png`
    - `node -e "JSON.parse(require('fs').readFileSync('/root/sgs/apps/frontend/public/manifest.webmanifest','utf8'))"` sai 0
    - `grep -c 'rel="manifest"' apps/frontend/index.html` = 1 e `grep -c 'rel="apple-touch-icon"' apps/frontend/index.html` = 1
    - `grep -c "viewport-fit=cover" apps/frontend/index.html` = 1
    - `grep -rn "F7F6F3" apps/frontend/src` não encontra nada novo
    - vitest `pwa-manifest` e `sem-cor-antiga` verdes
  </acceptance_criteria>
  <done>App instalável com nome e ícone certos no iPhone.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Service worker de push (sem cache) com teste de comportamento e de paridade da rota</name>
  <files>apps/frontend/public/sw.js, apps/frontend/src/__tests__/service-worker.test.ts</files>
  <read_first>
    - apps/frontend/src/infrastructure/native/push-route.ts
    - packages/shared/src/push.ts
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-RESEARCH.md (seção "Service worker")
  </read_first>
  <behavior>
    - `push` com payload `{title:'Novo agendamento', body:'Ana · 14:00', data:{route:'/agenda?data=2026-11-20&visao=day&agendamento=abc', appointmentId:'abc'}}` → `showNotification('Novo agendamento', { body, icon:'/icons/icon-192.png', badge?, tag:'appt-abc', data:{ route } })`
    - `push` sem data, com texto que não é JSON, ou com `title` vazio → ainda chama `showNotification` com título `Gestor Beauty`
    - `push` com `data.route` `'https://evil.com'`, `'//evil.com'`, `'/agenda/../admin'`, `'/financeiro'` → `data.route` gravado é `/agenda`
    - `notificationclick` com janela do app aberta → `close()`, `focus()` e `postMessage({ type:'sgs-open-route', route })`, sem `openWindow`
    - `notificationclick` sem janela → `openWindow(route)`
    - `notificationclick` com rota adulterada na notificação → usa `/agenda`
    - o arquivo não contém `addEventListener('fetch'`, `caches` nem `importScripts`
    - paridade: o literal de `AGENDA_ROUTE_RE` no `sw.js`, no `push-route.ts` e no `packages/shared/src/push.ts` é o mesmo texto
  </behavior>
  <action>
1. `apps/frontend/public/sw.js` (JavaScript puro, sem módulo, sem build):
```js
// Service worker do Gestor Beauty (fase 8). Só push e clique na notificação: SEM cache e SEM
// handler de fetch (D-03, fora do escopo o modo offline).
// Cópia de apps/frontend/src/infrastructure/native/push-route.ts e packages/shared/src/push.ts;
// o teste service-worker.test.ts confere que as três regex são iguais.
const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;
const DEFAULT_ROUTE = '/agenda';
function isAllowedPushRoute(r) { /* igual ao push-route.ts */ }
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => { /* parse em try/catch; SEMPRE showNotification */ });
self.addEventListener('notificationclick', (event) => { /* close; matchAll({type:'window', includeUncontrolled:true}); focus+postMessage ou openWindow */ });
```
   Detalhes: `push` — `let p = {}; try { p = event.data ? event.data.json() : {}; } catch (e) { p = {}; }`; título = `typeof p.title === 'string' && p.title ? p.title : 'Gestor Beauty'`; `body` string ou `''`; `route` permitido ou `DEFAULT_ROUTE`; `tag` = `appt-<appointmentId>` só se `appointmentId` for string não vazia (senão sem `tag`; lote de noivas manda `groupId` → `tag` `grupo-<groupId>`); `icon: '/icons/icon-192.png'`; `event.waitUntil(self.registration.showNotification(title, options))`. `notificationclick` — `event.notification.close()`; rota revalidada; janela = `clients.find((c) => new URL(c.url).origin === self.location.origin)`; se houver `await win.focus(); win.postMessage({ type: 'sgs-open-route', route }); return;` senão `await self.clients.openWindow(route)`.
2. `src/__tests__/service-worker.test.ts`: ler `public/sw.js` como texto e executar com `vm.runInNewContext(code, ctx)` (`import vm from 'node:vm'`), onde `ctx.self = { addEventListener(type, fn) { handlers[type] = fn; }, registration: { showNotification: vi.fn(async () => {}) }, clients: { matchAll: vi.fn(), openWindow: vi.fn(), claim: vi.fn() }, skipWaiting: vi.fn(), location: { origin: 'https://sgs.exemplo' } }` e `ctx.URL = URL`; eventos falsos com `waitUntil(p) { promises.push(p) }` e `data: { json: () => payload }` (ou `json` que lança). Casos do `<behavior>`. Paridade: extrair com `/AGENDA_ROUTE_RE = (\/.+\/);/` dos três arquivos (`public/sw.js`, `src/infrastructure/native/push-route.ts`, `join(__dirname, '../../../../packages/shared/src/push.ts')`) e comparar o texto.
3. `corepack pnpm --filter @sgs/frontend test -- service-worker`. Commit `feat(08-03): service worker de push sem cache`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- service-worker</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "addEventListener('fetch'" apps/frontend/public/sw.js` = 0 e `grep -c "caches" apps/frontend/public/sw.js` = 0
    - `grep -c "showNotification" apps/frontend/public/sw.js` ≥ 1
    - `grep -n "sgs-open-route" apps/frontend/public/sw.js` encontra
    - `grep -n "paridade\|AGENDA_ROUTE_RE" apps/frontend/src/__tests__/service-worker.test.ts` encontra
    - vitest `service-worker` verde
  </acceptance_criteria>
  <done>SW mínimo e seguro: sempre notifica, só abre rotas da agenda, não guarda nada em cache.</done>
</task>

<task type="auto">
  <name>Task 3: nginx sem cache para sw.js/manifest, script de headers e E2E</name>
  <files>apps/frontend/nginx.conf, scripts/check-pwa-headers.sh, apps/e2e/tests/pwa-instalavel.spec.ts</files>
  <read_first>
    - apps/frontend/nginx.conf
    - apps/frontend/Dockerfile
    - infra/nginx/sgs-staging.conf (confirmar que não há proxy_cache no host)
    - apps/e2e/tests/smoke.spec.ts (padrão de spec sem login)
  </read_first>
  <action>
1. `apps/frontend/nginx.conf`, antes da regra regex de assets (exato tem precedência, mas a ordem deixa claro), com comentário "Fase 8 (D-11): o iPhone precisa buscar o service worker e o manifest de novo a cada deploy":
```nginx
location = /sw.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

location = /manifest.webmanifest {
    default_type application/manifest+json;
    types { }
    add_header Cache-Control "no-cache" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```
   (`types { }` vazio faz o `default_type` valer para o manifest mesmo que o `mime.types` não conheça `.webmanifest`. Em `/sw.js` o `mime.types` já resolve `.js`; o `default_type` é só reforço.) Ícones em `/icons/*.png` continuam na regra de 1 ano (arte estável; trocar a arte = trocar o nome do arquivo). `infra/nginx/sgs-staging.conf` não muda (só `proxy_pass`, sem cache) — só conferir.
2. `scripts/check-pwa-headers.sh` (executável, `set -euo pipefail`), uso `./scripts/check-pwa-headers.sh <url-base>` (ex.: `http://127.0.0.1:8099` ou `https://sgs.jessicaseixasmakeup.com.br`). Com `curl -fsS -o /dev/null -D -` e `grep -i`, falhar com mensagem PT-BR se:
   - `/sw.js`: não 200, sem `cache-control: no-cache`, `content-type` sem `javascript`, ou com `immutable`/`max-age=31536000`
   - `/manifest.webmanifest`: não 200, `content-type` diferente de `application/manifest+json`, sem `no-cache`
   - `/icons/apple-touch-icon-180.png` e `/icons/icon-192.png`: não 200 ou `content-type` diferente de `image/png`
   - `/`: sem `no-cache`
   - qualquer um dos acima sem `x-content-type-options: nosniff`
   Termina com `✓ Headers do app instalável OK em <url>`.
3. Testar contra a imagem local (rede do Docker ok, não mexe no staging): `cd /root/sgs && docker build -t sgs-fe-pwa-test --target production apps/frontend && docker run -d --rm --name sgs-fe-pwa-test -p 127.0.0.1:8099:80 sgs-fe-pwa-test && sleep 2 && ./scripts/check-pwa-headers.sh http://127.0.0.1:8099; docker stop sgs-fe-pwa-test`.
4. `apps/e2e/tests/pwa-instalavel.spec.ts` (`test.describe('Fase 8 - app instalável no iPhone')`, sem login): `request.get('/manifest.webmanifest')` 200 e JSON com `display` `standalone` e `name` `Gestor Beauty`; `request.get('/sw.js')` 200 e corpo contém `showNotification`; `page.goto('/login')` e `page.locator('link[rel="manifest"]')` com `href` `/manifest.webmanifest` e `link[rel="apple-touch-icon"]` presente; `request.get('/icons/apple-touch-icon-180.png')` 200.
5. `corepack pnpm --filter @sgs/e2e test:e2e --grep "app instalável"` (sem `--` antes das flags). Commit `feat(08-03): nginx sem cache para sw.js e manifest`.
  </action>
  <verify>
    <automated>cd /root/sgs && docker build -q -t sgs-fe-pwa-test --target production apps/frontend >/dev/null && docker run -d --rm --name sgs-fe-pwa-test -p 127.0.0.1:8099:80 sgs-fe-pwa-test >/dev/null && sleep 2 && ./scripts/check-pwa-headers.sh http://127.0.0.1:8099; rc=$?; docker stop sgs-fe-pwa-test >/dev/null; exit $rc</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "location = /sw.js" apps/frontend/nginx.conf` = 1 e `grep -c "location = /manifest.webmanifest" apps/frontend/nginx.conf` = 1
    - `grep -c 'X-Content-Type-Options "nosniff" always' apps/frontend/nginx.conf` = 6 (server + regex de assets + /index.html + / + /sw.js + /manifest.webmanifest)
    - `test -x scripts/check-pwa-headers.sh` sai 0
    - o comando do `<verify>` termina com `✓ Headers do app instalável OK`
    - `corepack pnpm --filter @sgs/e2e test:e2e --grep "app instalável"` sai 0
  </acceptance_criteria>
  <done>O container serve o app instalável com headers certos; o script serve também para o staging no 08-07.</done>
</task>

</tasks>

<verification>
vitest `pwa-manifest`, `service-worker`, `sem-cor-antiga` verdes; imagem local passa no `check-pwa-headers.sh`; E2E de PWA verde.
</verification>

<success_criteria>
D-02, D-03, D-04 (lado do SW) e D-11 cobertos: o iPhone consegue adicionar à Tela de Início com nome/ícone certos e o SW recebe push e abre a agenda.
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-03-SUMMARY.md`
</output>

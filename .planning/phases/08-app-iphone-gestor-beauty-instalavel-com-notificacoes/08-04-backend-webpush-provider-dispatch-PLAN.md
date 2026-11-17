---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 04
type: execute
wave: 2
depends_on: ["08-01", "08-02"]
files_modified:
  - apps/backend/src/push/push.types.ts
  - apps/backend/src/push/web-push.provider.ts
  - apps/backend/src/push/web-push.provider.spec.ts
  - apps/backend/src/push/push.service.ts
  - apps/backend/src/push/push.service.webpush.spec.ts
  - apps/backend/src/push/push.processor.spec.ts
  - apps/backend/src/push/push.module.ts
  - apps/backend/test/integration/push-dispatch.e2e.spec.ts
autonomous: true
requirements: [D-08, D-09, D-10]

must_haves:
  truths:
    - "Os mesmos eventos da fase 7 (novo agendamento, cancelamento, lote e cancelamento de noivas) saem também por Web Push para quem tem inscrição webpush, com os mesmos destinatários, textos e rotas (D-08)"
    - "Cada envio sai pelo provider do seu registro (fcm → FCM, webpush → WebPushProvider); dedupe por provider+token"
    - "Inscrição respondida com 404/410 é apagada de device_tokens; 401/403/400/413 falham sem retry; 429/5xx/rede são retentáveis (D-09)"
    - "Sem VAPID o canal Web Push fica desligado: tokens webpush são ignorados e o FCM segue igual; sem FCM e sem VAPID → skipped 'disabled' (D-10)"
    - "O log do módulo diz 'Web Push habilitado' ou 'Web Push desabilitado (sem VAPID_*)' e nunca imprime chave nem endpoint completo"
  artifacts:
    - path: "apps/backend/src/push/web-push.provider.ts"
      provides: "WebPushProvider, NoopWebPushProvider, createWebPushProvider"
      exports: ["WebPushProvider", "NoopWebPushProvider", "createWebPushProvider"]
    - path: "apps/backend/src/push/push.service.ts"
      provides: "dispatch com dois canais"
      contains: "WEBPUSH_PROVIDER"
  key_links:
    - from: "apps/backend/src/push/push.module.ts"
      to: "createWebPushProvider(config.vapid)"
      via: "factory do WEBPUSH_PROVIDER"
      pattern: "createWebPushProvider\\(config\\.vapid\\)"
    - from: "apps/backend/src/push/push.service.ts"
      to: "tx.deviceToken.findMany"
      via: "provider in [fcm, webpush] selecionando p256dh/auth"
      pattern: "provider: \\{ in:"
    - from: "apps/backend/src/push/web-push.provider.ts"
      to: "web-push sendNotification"
      via: "vapidDetails por chamada"
      pattern: "sendNotification"
---

<objective>
O segundo canal de envio: `WebPushProvider` (web-push 3.6.7, VAPID) e o `PushService.dispatch` mandando cada registro pelo provider do seu tipo, com a limpeza de inscrição morta (404/410) igual à do FCM.

Purpose: D-08/D-09/D-10 — o iPhone recebe os mesmos avisos do Android pela mesma fila/worker, sem tocar nos ganchos de evento, destinatários ou textos.
Output: provider + specs, dispatch de dois canais, wiring no módulo, integração do dispatch estendida.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-RESEARCH.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-01-SUMMARY.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-02-SUMMARY.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-07-SUMMARY.md

**Ambiente de execução:** igual ao 08-01.

<interfaces>
`apps/backend/src/push/push.types.ts` (hoje):
```ts
export const PUSH_QUEUE = 'push-notifications';
export const PUSH_PROVIDER = 'PUSH_PROVIDER';
export interface PushMessage { title: string; body: string; data: Record<string, string>; }
export type PushSendResult = { status: 'sent' } | { status: 'invalid_token'; reason: string } | { status: 'failed'; retryable: boolean; reason: string };
export interface PushProvider { readonly enabled: boolean; send(token: string, message: PushMessage): Promise<PushSendResult>; }
```
`apps/backend/src/push/push.service.ts` (hoje): `constructor(tenant: TenantContextService, @Inject(PUSH_PROVIDER) provider: PushProvider)`; `dispatch(job)`: `if (!this.provider.enabled) return {..., skipped: 'disabled'}`; ... `tx.deviceToken.findMany({ where: { memberId: { in }, provider: 'fcm' }, select: { id, memberId, token } })`; `interface SendItem { tokenId; token; message }`; dedupe `seen.has(t.token)`; envio em lotes de 10 `this.provider.send(item.token, item.message)`; `invalidIds` → `deleteMany`; log `Falha de credencial FCM: ...` quando `/credencial/i`; `throw new Error('FCM indisponível: nova tentativa')` se `results.length > 0 && sent === 0 && invalid === 0 && allRetryable`.
Testes que constroem o serviço com 2 argumentos (devem continuar compilando): `push.processor.spec.ts:52`, `test/integration/push-hooks.e2e.spec.ts:259`, `test/integration/push-dispatch.e2e.spec.ts:37`. `push.processor.spec.ts:112` espera a mensagem `'FCM indisponível: nova tentativa'`.
Do 08-02: `import type { VapidDetails } from './web-push-credentials'` (`{ publicKey, privateKey, subject }`), `AppConfigService.vapid: VapidDetails | null`, `web-push@3.6.7` + `@types/web-push@3.6.4` instalados.
Do 08-01: `DeviceToken.p256dh`/`auth` (`string | null`), provider `'webpush'`, CHECK que exige chaves para webpush.
web-push 3.6.7: `sendNotification(subscription: { endpoint, keys: { p256dh, auth } }, payload: string, options: { vapidDetails, TTL, urgency, timeout })`; erro HTTP = `WebPushError` com `statusCode`; erro de rede sem `statusCode`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: WebPushProvider com mapeamento de erros</name>
  <files>apps/backend/src/push/push.types.ts, apps/backend/src/push/web-push.provider.ts, apps/backend/src/push/web-push.provider.spec.ts</files>
  <read_first>
    - apps/backend/src/push/push.types.ts
    - apps/backend/src/push/fcm-push.provider.ts (padrão Noop + deps injetáveis)
    - apps/backend/src/push/fcm-push.provider.spec.ts
    - apps/backend/src/push/web-push-credentials.ts (08-02)
  </read_first>
  <behavior>
    - sucesso: `sendNotification` falso recebe `{ endpoint, keys: { p256dh, auth } }`, payload `JSON.stringify({ title, body, data })` e opções `{ vapidDetails: { subject, publicKey, privateKey }, TTL: 43200, urgency: 'high', timeout: 10000 }` → `{ status: 'sent' }`
    - sem `keys` → `{ status: 'invalid_token', reason: 'inscrição sem chaves' }` sem chamar `sendNotification`
    - erro com `statusCode` 404 e 410 → `invalid_token` (`reason` 'WebPush 404'/'WebPush 410')
    - 401 e 403 → `failed`, `retryable: false`, `reason` contém 'credencial'
    - 400 e 413 → `failed`, `retryable: false`
    - 429, 500, 503 e erro sem `statusCode` (ECONNREFUSED) → `failed`, `retryable: true`
    - `NoopWebPushProvider.enabled === false`; `createWebPushProvider(null)` → Noop; com VapidDetails → `WebPushProvider` com `enabled === true`
    - nenhuma `reason` contém a chave privada
  </behavior>
  <action>
1. `push.types.ts`: `export const WEBPUSH_PROVIDER = 'WEBPUSH_PROVIDER';`, `export interface WebPushKeys { p256dh: string; auth: string; }` e a assinatura `send(token: string, message: PushMessage, keys?: WebPushKeys): Promise<PushSendResult>;` (3º argumento opcional; o FCM ignora — `FcmPushProvider.send(token, message)` continua compatível).
2. `web-push.provider.ts`:
```ts
import * as webpush from 'web-push';
import type { VapidDetails } from './web-push-credentials';
import type { PushMessage, PushProvider, PushSendResult, WebPushKeys } from './push.types';

type Sender = typeof webpush.sendNotification;
export const WEBPUSH_TTL_SECONDS = 12 * 3600;

export class NoopWebPushProvider implements PushProvider {
  readonly enabled = false;
  async send(): Promise<PushSendResult> { return { status: 'failed', retryable: false, reason: 'web push desabilitado' }; }
}

export class WebPushProvider implements PushProvider {
  readonly enabled = true;
  private readonly sender: Sender;
  constructor(private readonly vapid: VapidDetails, deps: { sendNotification?: Sender } = {}) {
    this.sender = deps.sendNotification ?? webpush.sendNotification;
  }
  async send(endpoint: string, message: PushMessage, keys?: WebPushKeys): Promise<PushSendResult> { ... }
}

export function createWebPushProvider(vapid: VapidDetails | null): PushProvider {
  return vapid ? new WebPushProvider(vapid) : new NoopWebPushProvider();
}
```
   Corpo do `send`: mapeamento do `<behavior>`; `vapidDetails` por chamada (sem `setVapidDetails` global); mensagem do erro de credencial `erro de credencial VAPID (${status})`; demais `WebPush ${status ?? 'rede'}: ${(e as Error).message}` (a mensagem do `WebPushError` não traz a chave).
3. `web-push.provider.spec.ts`: casos do `<behavior>` com `sendNotification` falso (`jest.fn`) e erros simulados `Object.assign(new Error('x'), { statusCode: 410 })`; VapidDetails de `webpush.generateVAPIDKeys()` + subject `https://sgs.jessicaseixasmakeup.com.br`.
4. `corepack pnpm --filter @sgs/backend test -- web-push.provider fcm-push.provider && corepack pnpm --filter @sgs/backend typecheck`. Commit `feat(08-04): provider Web Push (VAPID)`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- web-push.provider fcm-push.provider && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export const WEBPUSH_PROVIDER = 'WEBPUSH_PROVIDER'" apps/backend/src/push/push.types.ts` encontra
    - `grep -n "keys?: WebPushKeys" apps/backend/src/push/push.types.ts` encontra
    - `grep -n "setVapidDetails" apps/backend/src/push/web-push.provider.ts` sai vazio
    - `grep -c "410" apps/backend/src/push/web-push.provider.spec.ts` ≥ 1 e `grep -c "ECONNREFUSED\|statusCode: undefined\|sem statusCode" apps/backend/src/push/web-push.provider.spec.ts` ≥ 1
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Provider Web Push isolado, testado e com erros mapeados como o FCM.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: dispatch de dois canais, wiring no PushModule e integração</name>
  <files>apps/backend/src/push/push.service.ts, apps/backend/src/push/push.service.webpush.spec.ts, apps/backend/src/push/push.processor.spec.ts, apps/backend/src/push/push.module.ts, apps/backend/test/integration/push-dispatch.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/push/push.service.ts
    - apps/backend/src/push/push.processor.spec.ts (como o tenant falso e o provider falso são montados)
    - apps/backend/src/push/push.module.ts
    - apps/backend/test/integration/push-dispatch.e2e.spec.ts
  </read_first>
  <behavior>
    - FCM e Web Push ligados; membro com 1 token fcm e 1 webpush → os dois recebem a MESMA `PushMessage`; o fcm sai pelo provider FCM com `send(token, message)` e o webpush pelo Web Push com `send(endpoint, message, { p256dh, auth })`
    - Web Push desligado (Noop ou ausente) → `findMany` só com `provider in ['fcm']`; tokens webpush não são enviados
    - FCM desligado e Web Push ligado → só webpush sai
    - os dois desligados → `{ sent: 0, invalid: 0, failed: 0, skipped: 'disabled' }` sem ler o banco
    - Web Push devolve `invalid_token` → id entra no `deleteMany`
    - todos os envios retentáveis → lança `'Push indisponível: nova tentativa'`; se o FCM enviou e o Web Push falhou por rede, NÃO lança (falha parcial não reenvia, igual à fase 7)
    - integração (Postgres real): org com um membro profissional que tem token fcm `tok-p8-fcm`, webpush `https://web.push.apple.com/p8-ok` e webpush `https://web.push.apple.com/p8-dead` (chaves válidas via adminPrisma) → criar agendamento e despachar: FCM falso recebe 1, Web Push falso recebe 2 com as chaves; a linha `p8-dead` some; `tok-p8-fcm` e `p8-ok` continuam
  </behavior>
  <action>
1. `push.service.ts`:
   - `constructor(private readonly tenant: TenantContextService, @Inject(PUSH_PROVIDER) private readonly provider: PushProvider, @Optional() @Inject(WEBPUSH_PROVIDER) private readonly webPush?: PushProvider)` (`Optional` de `@nestjs/common`; os testes com 2 argumentos continuam valendo).
   - Início do `dispatch`: `const channels = [this.provider.enabled ? 'fcm' : null, this.webPush?.enabled ? 'webpush' : null].filter((c): c is 'fcm' | 'webpush' => c !== null); if (channels.length === 0) return { sent: 0, invalid: 0, failed: 0, skipped: 'disabled' };`
   - `findMany({ where: { memberId: { in: ... }, provider: { in: channels } }, select: { id: true, memberId: true, token: true, provider: true, p256dh: true, auth: true } })`.
   - `interface SendItem { tokenId: string; token: string; provider: 'fcm' | 'webpush'; keys?: WebPushKeys; message: PushMessage }`; dedupe por `${t.provider}:${t.token}`; `keys` só quando `provider === 'webpush' && t.p256dh && t.auth`.
   - Envio: `item.provider === 'webpush' ? this.webPush!.send(item.token, item.message, item.keys) : this.provider.send(item.token, item.message)`.
   - Logs: `Falha de credencial ${item.provider === 'webpush' ? 'Web Push' : 'FCM'}: ${reason}` uma vez por provider (trocar o `credentialLogged` booleano por um `Set`); sufixo `…${item.token.slice(-6)}` continua (nunca endpoint inteiro, nunca chaves).
   - Erro de retry: `throw new Error('Push indisponível: nova tentativa')`; atualizar `push.processor.spec.ts:112` para a nova mensagem.
   - Comentário curto no retry: "Falha parcial (um canal enviou) não reenvia, para não duplicar aviso (mesmo limite da fase 7)."
2. `push.module.ts`: novo provider
```ts
{
  provide: WEBPUSH_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    const provider = createWebPushProvider(config.vapid);
    new Logger('PushModule').log(provider.enabled ? 'Web Push habilitado' : 'Web Push desabilitado (sem VAPID_*)');
    return provider;
  },
},
```
   Nenhuma conexão no boot (a lib só faz rede no `send`).
3. `push.service.webpush.spec.ts`: casos unit do `<behavior>` reaproveitando o tenant falso do `push.processor.spec.ts` (copiar o helper para o spec novo, sem exportar de spec). Incluir um caso com `jest.spyOn(Logger.prototype, 'log'|'warn'|'error')` afirmando que nenhum argumento contém o endpoint inteiro nem `p256dh`.
4. `push-dispatch.e2e.spec.ts`: novo `describe('Fase 8 - dispatch com Web Push', ...)` com o cenário de integração do `<behavior>` (`new PushService(tenant, fakeFcm, fakeWebPush)`; chaves: p256dh `'B' + 'a'.repeat(86)`, auth `'c'.repeat(22)`; `fakeWebPush.send` devolve `invalid_token` para o endpoint terminado em `p8-dead`). Os casos da fase 7 ficam como estão.
5. Com env local: `corepack pnpm --filter @sgs/backend test -- push && corepack pnpm --filter @sgs/backend test:integration -- push-dispatch push-hooks phase2-modules-boot && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint`. Commit `feat(08-04): avisos da agenda também por Web Push`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- push && corepack pnpm --filter @sgs/backend test:integration -- push-dispatch push-hooks phase2-modules-boot</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "@Optional() @Inject(WEBPUSH_PROVIDER)" apps/backend/src/push/push.service.ts` encontra
    - `grep -n "provider: { in: channels }" apps/backend/src/push/push.service.ts` encontra
    - `grep -n "provider: 'fcm' }" apps/backend/src/push/push.service.ts` sai vazio
    - `grep -n "Push indisponível: nova tentativa" apps/backend/src/push/push.service.ts apps/backend/src/push/push.processor.spec.ts` encontra nos dois
    - `grep -n "createWebPushProvider(config.vapid)" apps/backend/src/push/push.module.ts` encontra e `grep -n "Web Push desabilitado (sem VAPID_\*)" apps/backend/src/push/push.module.ts` encontra
    - `grep -n "Fase 8 - dispatch com Web Push" apps/backend/test/integration/push-dispatch.e2e.spec.ts` encontra
    - comandos do `<verify>` saem 0; lint e typecheck do backend saem 0
  </acceptance_criteria>
  <done>A fila da fase 7 entrega para Android e iPhone; inscrição morta é limpa; sem VAPID nada muda para o Android.</done>
</task>

</tasks>

<verification>
Unit de push inteiro verde, integrações push-dispatch/push-hooks/phase2-modules-boot verdes, typecheck/lint do backend verdes.
</verification>

<success_criteria>
D-08/D-09/D-10 cobertos no backend: o mesmo job gera o mesmo aviso nos dois canais, com limpeza de inscrição inválida e canal desligável por env.
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-04-SUMMARY.md`
</output>

---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 03
type: execute
wave: 2
depends_on: ["07-01"]
files_modified:
  - apps/backend/src/push/push.types.ts
  - apps/backend/src/push/resolve-push-targets.ts
  - apps/backend/src/push/resolve-push-targets.spec.ts
  - apps/backend/src/push/push-messages.ts
  - apps/backend/src/push/push-messages.spec.ts
  - apps/backend/src/push/push-bridal.spec.ts
  - apps/backend/src/push/fcm-credentials.ts
  - apps/backend/src/push/fcm-push.provider.ts
  - apps/backend/src/push/fcm-push.provider.spec.ts
  - apps/backend/src/config/env.schema.ts
  - apps/backend/src/config/app-config.service.ts
  - .env.example
  - .env.staging.example
  - docker-compose.staging.yml
autonomous: true
requirements: [C-03, C-04]

must_haves:
  truths:
    - "A profissional do atendimento recebe só os atendimentos dela; ADMIN e MANAGER recebem todos do salão (D-12)"
    - "Quem criou ou cancelou não recebe o aviso da própria ação, mesmo sendo gestora ou a profissional (D-13)"
    - "Agendamento em lote de noivas vira UM aviso por profissional ('3 atendimentos no casamento da Vitória, 08/11') e UM resumo para cada gestora (D-15)"
    - "Cancelamento em massa (grupo/contrato) segue a mesma regra: um resumo por profissional e um por gestora, nunca um push por atendimento (decisão do orquestrador nº 2)"
    - "Todo aviso leva no data a rota /agenda?data=<dia>&visao=day&agendamento=<id> (D-14)"
    - "Sem FCM_SERVICE_ACCOUNT_JSON o provedor é no-op e o backend sobe normalmente em dev/CI"
    - "O envio usa FCM HTTP v1 com service account (google-auth-library), sem depender do Capacitor (D-04)"
  artifacts:
    - path: "apps/backend/src/push/resolve-push-targets.ts"
      provides: "resolvePushTargets (função pura)"
      exports: ["resolvePushTargets"]
    - path: "apps/backend/src/push/push-messages.ts"
      provides: "buildPushMessage, buildAgendaRoute, eventPhrase"
      exports: ["buildPushMessage", "buildAgendaRoute"]
    - path: "apps/backend/src/push/fcm-push.provider.ts"
      provides: "FcmPushProvider, NoopPushProvider, createPushProvider"
      exports: ["FcmPushProvider", "createPushProvider"]
  key_links:
    - from: "apps/backend/src/push/fcm-push.provider.ts"
      to: "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
      via: "fetch POST com Bearer do GoogleAuth"
      pattern: "fcm\\.googleapis\\.com/v1/projects"
    - from: "apps/backend/src/config/app-config.service.ts"
      to: "FCM_SERVICE_ACCOUNT_JSON"
      via: "getter fcmServiceAccount"
      pattern: "FCM_SERVICE_ACCOUNT_JSON"
---

<objective>
Construir, por TDD e sem banco nem Nest, o núcleo do push: quem recebe (D-12/D-13), o texto e a rota de cada aviso (D-14/D-15), e o cliente FCM HTTP v1 (D-04) com tratamento de token inválido e erros re-tentáveis; mais as variáveis de ambiente.

Purpose: as regras de negócio do push ficam em funções puras testáveis; o processor do 07-07 só carrega dados e chama estas funções.
Output: `push.types.ts`, `resolve-push-targets.ts`, `push-messages.ts`, `fcm-credentials.ts`, `fcm-push.provider.ts`, specs, env.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md

**Ambiente de execução:** igual ao 07-01. Prettier do backend nos arquivos novos. Testes: `corepack pnpm --filter @sgs/backend test -- <padrão>`.

<interfaces>
Contrato que este plano CRIA (07-07 e 07-09 consomem exatamente estes nomes):
```ts
// apps/backend/src/push/push.types.ts
export const PUSH_QUEUE = 'push-notifications';
export const PUSH_PROVIDER = 'PUSH_PROVIDER';
export const PUSH_KINDS = ['appointment.created', 'appointment.cancelled', 'bridal.scheduled', 'bridal.cancelled'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushJob =
  | { kind: 'appointment.created' | 'appointment.cancelled' | 'bridal.scheduled'; orgId: string; actorMemberId: string; appointmentIds: string[] }
  | { kind: 'bridal.cancelled'; orgId: string; actorMemberId: string; since: string; groupId?: string | null; contractId?: string | null };
export interface PushMessage { title: string; body: string; data: Record<string, string> }
export type PushSendResult =
  | { status: 'sent' }
  | { status: 'invalid_token'; reason: string }
  | { status: 'failed'; retryable: boolean; reason: string };
export interface PushProvider { readonly enabled: boolean; send(token: string, message: PushMessage): Promise<PushSendResult> }

// apps/backend/src/push/resolve-push-targets.ts
export interface PushAppointmentRef { id: string; professionalId: string }
export interface PushTarget { memberId: string; scope: 'own' | 'all'; appointmentIds: string[] }
export function resolvePushTargets(a: {
  appointments: PushAppointmentRef[];
  managerMemberIds: string[];          // ADMIN/MANAGER ativos do salão
  activeMemberIds: ReadonlySet<string>; // profissionais ativos (status 'active', deletedAt null)
  actorMemberId: string | null;
}): PushTarget[];

// apps/backend/src/push/push-messages.ts
export interface PushBridalGroupView { id: string; name: string; eventKind: string; eventDate: Date; brideName: string | null }
export interface PushAppointmentView {
  id: string; professionalId: string; professionalName: string; clientName: string; serviceName: string;
  startsAt: Date; bridalGroup: PushBridalGroupView | null;
}
export function buildAgendaRoute(dateYmd: string, appointmentId?: string | null): string; // cópia do packages/shared
export function localDateYmd(d: Date, timezone: string): string;   // 'YYYY-MM-DD' no fuso
export function formatDayMonth(d: Date, timezone: string): string; // 'dd/MM'
export function formatTime(d: Date, timezone: string): string;     // 'HH:mm' (h23)
export function eventPhrase(g: PushBridalGroupView): string;
export function buildPushMessage(kind: PushKind, target: PushTarget, appointments: PushAppointmentView[], timezone: string): PushMessage;

// apps/backend/src/push/fcm-credentials.ts
export interface FcmServiceAccount { projectId: string; clientEmail: string; privateKey: string }
export function parseFcmServiceAccount(raw: string | undefined): FcmServiceAccount | null; // base64 de JSON da service account

// apps/backend/src/push/fcm-push.provider.ts
export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const ANDROID_CHANNEL_ID = 'agenda';
export const ANDROID_NOTIFICATION_ICON = 'ic_stat_gestor_beauty';
export const ANDROID_NOTIFICATION_COLOR = '#570080';
export class NoopPushProvider implements PushProvider { readonly enabled = false; }
export class FcmPushProvider implements PushProvider {
  readonly enabled = true;
  constructor(creds: FcmServiceAccount, deps?: { fetch?: typeof fetch; getAccessToken?: () => Promise<string> });
}
export function createPushProvider(creds: FcmServiceAccount | null): PushProvider;
```
Existentes: `localDateOf(d, tz)` em `apps/backend/src/contracts/alerts/contract-alerts.service.ts` (Intl 'en-CA'); `RECIPIENT_ROLES = ['ADMIN','MANAGER']` no mesmo arquivo.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tipos do push, resolvePushTargets e textos/rotas dos avisos (D-12..D-15)</name>
  <files>apps/backend/src/push/push.types.ts, apps/backend/src/push/resolve-push-targets.ts, apps/backend/src/push/resolve-push-targets.spec.ts, apps/backend/src/push/push-messages.ts, apps/backend/src/push/push-messages.spec.ts, apps/backend/src/push/push-bridal.spec.ts</files>
  <read_first>
    - apps/backend/src/contracts/alerts/contract-alerts.service.ts (localDateOf com Intl en-CA, RECIPIENT_ROLES)
    - apps/backend/prisma/schema.prisma (models Appointment, BridalGroup: eventKind 'noiva'|'debutante', eventDate @db.Date, BridalGroupMember.role)
    - apps/backend/src/bridal/bridal-serialize.ts (papéis do grupo; confirmar que a noiva/debutante é role 'bride')
    - packages/shared/src/push.ts (buildAgendaRoute a copiar)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md (D-12, D-13, D-14, D-15 e o texto "3 atendimentos no casamento da Vitória, 08/11")
  </read_first>
  <behavior>
resolvePushTargets (resolve-push-targets.spec.ts):
- a1(proA), a2(proB), gestoras [adm, ger], ator = atendente → targets: proA own [a1]; proB own [a2]; adm all [a1,a2]; ger all [a1,a2]
- ator = proA → proA fica de fora (D-13); ator = adm → adm fica de fora
- proA também é gestora (está em managerMemberIds) → um único target para proA com scope 'all' e todos os ids (dedup)
- proB fora de activeMemberIds → proB não recebe; gestoras continuam recebendo
- dois atendimentos da mesma profissional → um target com os 2 ids, na ordem recebida
- lista de atendimentos vazia → []

buildPushMessage (push-messages.spec.ts), fuso 'America/Sao_Paulo', atendimento a1: cliente 'Maria Souza', serviço 'Escova', profissional 'Ana', início 2026-11-20T17:00:00Z (14:00 local):
- 'appointment.created', own → { title: 'Novo agendamento', body: 'Maria Souza · Escova, 20/11 às 14:00' }
- 'appointment.created', all → body 'Maria Souza · Escova, 20/11 às 14:00 (com Ana)'
- 'appointment.created', own, 2 atendimentos da mesma cliente (14:00 e 15:00) → body 'Maria Souza · 2 serviços, 20/11 a partir de 14:00'
- 'appointment.cancelled', own → { title: 'Agendamento cancelado', body: 'Maria Souza · Escova, 20/11 às 14:00' }
- data === { kind: 'appointment.created', route: '/agenda?data=2026-11-20&visao=day&agendamento=a1', appointmentId: 'a1' } (todos string; o primeiro atendimento por startsAt define rota e id)
- início 2026-11-21T02:30:00Z → dia local 20/11 23:30 (rota com data=2026-11-20): datas SEMPRE no fuso do salão, nunca toISOString

push-bridal.spec.ts (D-15), grupo { name: 'Noiva Vitória', eventKind: 'noiva', eventDate: new Date('2026-11-08T00:00:00Z'), brideName: 'Vitória Almeida' }:
- eventPhrase → 'no casamento da Vitória'; eventKind 'debutante', brideName 'Ana Luíza Prado' → 'nos 15 anos da Ana'; brideName null → 'no evento Noiva Vitória'
- 'bridal.scheduled', own, 3 atendimentos da proA → { title: 'Novo agendamento de noiva', body: '3 atendimentos no casamento da Vitória, 08/11' }
- 1 atendimento → body '1 atendimento no casamento da Vitória, 08/11'
- 'bridal.scheduled', all, 5 atendimentos de 2 profissionais → body '5 atendimentos no casamento da Vitória, 08/11 (2 profissionais)'; de 1 profissional 'Ana' → '... 08/11 (com Ana)'
- debutante → title 'Novo agendamento de debutante'
- 'bridal.cancelled', own, 2 atendimentos → { title: 'Agendamentos cancelados', body: '2 atendimentos cancelados no casamento da Vitória, 08/11' }; 1 → { title: 'Agendamento cancelado', body: '1 atendimento cancelado no casamento da Vitória, 08/11' }
- data do lote inclui groupId (string) e a rota do primeiro atendimento por startsAt
- 'bridal.scheduled' com atendimentos sem bridalGroup → cai no formato de 'appointment.created'
- dd/MM do evento vem de eventDate (coluna DATE, usar getUTCDate/getUTCMonth), não do fuso

  </behavior>
  <action>

1. RED: escrever os três specs com TODOS os casos acima; `corepack pnpm --filter @sgs/backend test -- push` deve falhar. Commit `test(07-03): ...`.
2. GREEN:
   - `push.types.ts` exatamente como no `<interfaces>`.
   - `resolve-push-targets.ts`: `managers = unique(managerMemberIds).filter(id => id !== actorMemberId)`; para cada atendimento, se `professionalId !== actorMemberId && activeMemberIds.has(professionalId) && !managers.includes(professionalId)` acumula em `Map<memberId, ids[]>` (ordem de aparição); saída = profissionais (scope 'own') seguidas das gestoras (scope 'all', todos os ids). Vazio → [].
   - `push-messages.ts`: `buildAgendaRoute` idêntico ao shared (comentário: cópia de packages/shared/src/push.ts); `localDateYmd` com `Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' })`; `formatDayMonth` com `Intl.DateTimeFormat('pt-BR', { timeZone, day:'2-digit', month:'2-digit' })`; `formatTime` com `{ hour:'2-digit', minute:'2-digit', hourCycle:'h23' }`. `firstName(n) = n.trim().split(/\s+/)[0]`. `eventPhrase`: brideName vazio/null → `no evento ${g.name}`; `eventKind === 'debutante'` → `nos 15 anos da ${firstName}`; senão `no casamento da ${firstName}`. `buildPushMessage`: ordenar cópia por `startsAt`; `first` define `route = buildAgendaRoute(localDateYmd(first.startsAt, tz), first.id)` e `data = { kind, route, appointmentId: first.id, ...(group ? { groupId: group.id } : {}) }`. Formato comum (created/cancelled sem grupo): 1 atendimento → `${cliente} · ${serviço}, ${dd/MM} às ${HH:mm}`; N>1 → `${cliente do primeiro} · ${N} serviços, ${dd/MM} a partir de ${HH:mm}`; scope 'all' com 1 profissional distinto acrescenta ` (com ${nome})`, com mais de 1 acrescenta ` (${k} profissionais)`. Lote (bridal.* com todos os atendimentos do mesmo grupo): `${N} ${N===1?'atendimento':'atendimentos'}${cancelado?(N===1?' cancelado':' cancelados'):''} ${eventPhrase}, ${dd/MM de eventDate em UTC}` + o mesmo sufixo de gestora. Títulos: 'Novo agendamento', 'Agendamento cancelado', 'Novo agendamento de noiva' / 'Novo agendamento de debutante', 'Agendamentos cancelados' (N>1) / 'Agendamento cancelado' (N=1). 'bridal.cancelled' sem grupo usa o formato comum com título de cancelamento.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- resolve-push-targets push-messages push-bridal && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function resolvePushTargets" apps/backend/src/push/resolve-push-targets.ts` encontra a linha
    - `grep -n "export const PUSH_QUEUE = 'push-notifications'" apps/backend/src/push/push.types.ts` encontra a linha (aspas conforme o prettier)
    - `grep -n "3 atendimentos no casamento da Vitória, 08/11" apps/backend/src/push/push-bridal.spec.ts` encontra a linha
    - `grep -n "no casamento da" apps/backend/src/push/push-messages.ts` e `grep -n "nos 15 anos da" apps/backend/src/push/push-messages.ts` encontram as linhas
    - `grep -n "toISOString" apps/backend/src/push/push-messages.ts` não encontra nada
    - `grep -c "it(" apps/backend/src/push/resolve-push-targets.spec.ts` ≥ 6 e `grep -c "it(" apps/backend/src/push/push-bridal.spec.ts` ≥ 7
    - os 3 specs saem 0 (e falharam antes da implementação: commit `test(07-03)` antes do `feat(07-03)`)
  </acceptance_criteria>
  <done>Quem recebe e o que cada um lê estão definidos e testados como funções puras.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Credenciais e cliente FCM HTTP v1 (no-op sem credencial) e variáveis de ambiente</name>
  <files>apps/backend/src/push/fcm-credentials.ts, apps/backend/src/push/fcm-push.provider.ts, apps/backend/src/push/fcm-push.provider.spec.ts, apps/backend/src/config/env.schema.ts, apps/backend/src/config/app-config.service.ts, .env.example, .env.staging.example, docker-compose.staging.yml</files>
  <read_first>
    - apps/backend/src/push/push.types.ts (Task 1)
    - apps/backend/src/config/env.schema.ts (padrão ANTHROPIC_API_KEY / CONTRACT_ALERTS_SCHEDULER)
    - apps/backend/src/config/app-config.service.ts (getters)
    - .env.example, .env.staging.example (bloco da Fase 4)
    - docker-compose.staging.yml (serviço backend, environment)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Pattern 7: mensagem FCM v1, limpeza de tokens inválidos; Code Examples "Envio FCM v1")
  </read_first>
  <behavior>parseFcmServiceAccount (fcm-push.provider.spec.ts):
- undefined/'' → null; base64 de JSON sem private_key → null; base64 de '{"project_id":"gestor-beauty","client_email":"x@y","private_key":"-----BEGIN PRIVATE KEY-----\n..."}' → { projectId: 'gestor-beauty', clientEmail: 'x@y', privateKey: '-----BEGIN…' }; texto que não é base64/JSON → null (sem lançar)

FcmPushProvider (fetch e getAccessToken mockados):
- POST em 'https://fcm.googleapis.com/v1/projects/gestor-beauty/messages:send' com header Authorization 'Bearer tok-123' e corpo { message: { token, notification: { title, body }, data, android: { priority: 'HIGH', notification: { channel_id: 'agenda', icon: 'ic_stat_gestor_beauty', color: '#570080' } } } }
- valores não-string em data são convertidos com String() antes do envio
- 200 → { status: 'sent' }
- 404 (UNREGISTERED) → { status: 'invalid_token' }; 400 com details[].errorCode 'UNREGISTERED' → invalid_token; 403 com errorCode 'SENDER_ID_MISMATCH' → invalid_token
- 400 INVALID_ARGUMENT sem UNREGISTERED → { status: 'failed', retryable: false }
- 401 / 403 sem SENDER_ID_MISMATCH → failed retryable false, reason contém 'credencial'
- 429, 500, 503 → failed retryable true; fetch que lança (rede) → failed retryable true
- createPushProvider(null) → enabled false; NoopPushProvider.send → { status: 'failed', retryable: false, reason: 'push desabilitado' } sem chamar fetch
    </behavior>
  <action>
RED (spec com todos os casos, commit `test(07-03)`), depois GREEN:
   - `fcm-credentials.ts`: `Buffer.from(raw.trim(), 'base64').toString('utf8')` → `JSON.parse` em try/catch; exige `project_id`, `client_email`, `private_key` string não vazias.
   - `fcm-push.provider.ts`: `FcmPushProvider` usa `deps.getAccessToken ?? (async () => { const auth = new GoogleAuth({ credentials: { client_email, private_key }, scopes: [FCM_SCOPE] }); const client = await auth.getClient(); const { token } = await client.getAccessToken(); if (!token) throw new Error('sem access token FCM'); return token; })` — criar o `GoogleAuth` uma vez no construtor (ele faz cache e renovação). Parse do erro: `json.error.status` e `json.error.details?.find(d => d.errorCode)?.errorCode`. Mapeamento conforme `<behavior>`. Nunca incluir o token completo em `reason`. `createPushProvider(creds) = creds ? new FcmPushProvider(creds) : new NoopPushProvider()`.

Env (commit separado `feat(07-03): variáveis do push`):
   - `env.schema.ts`, depois de `CONTRACT_ALERTS_SCHEDULER`:
```ts
  // Fase 7 — push (FCM HTTP v1). Ausente => push desligado (no-op), backend sobe normal.
  FCM_SERVICE_ACCOUNT_JSON: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined))
    .describe('JSON da service account do Firebase em base64 (papel Firebase Cloud Messaging API Admin)'),
  PUSH_NOTIFICATIONS_WORKER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true')
    .describe('Liga o worker BullMQ que envia os pushes'),
```
   - `app-config.service.ts`: `get fcmServiceAccount(): FcmServiceAccount | null { return parseFcmServiceAccount(this.config.get('FCM_SERVICE_ACCOUNT_JSON', { infer: true })); }` e `get pushWorkerEnabled(): boolean`.
   - `.env.example` e `.env.staging.example`: bloco `# Fase 7 — push do app Gestor Beauty (FCM v1). Vazio = push desligado.` com `FCM_SERVICE_ACCOUNT_JSON=` e `PUSH_NOTIFICATIONS_WORKER=true`, e a linha de comentário `# Gerar: base64 -w0 service-account.json (NUNCA commitar o JSON)`.
   - `docker-compose.staging.yml`, serviço `backend.environment`, depois de `CONTRACT_ALERTS_SCHEDULER`: `FCM_SERVICE_ACCOUNT_JSON: ${FCM_SERVICE_ACCOUNT_JSON:-}` e `PUSH_NOTIFICATIONS_WORKER: ${PUSH_NOTIFICATIONS_WORKER:-true}`.
    </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- fcm-push && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "fcm.googleapis.com/v1/projects" apps/backend/src/push/fcm-push.provider.ts` encontra a linha
    - `grep -n "firebase.messaging" apps/backend/src/push/fcm-push.provider.ts` encontra o escopo
    - `grep -n "channel_id" apps/backend/src/push/fcm-push.provider.ts` encontra a linha
    - `grep -ln "FCM_SERVICE_ACCOUNT_JSON" apps/backend/src/config/env.schema.ts .env.example .env.staging.example docker-compose.staging.yml` lista os 4 arquivos
    - `grep -n "PUSH_NOTIFICATIONS_WORKER" apps/backend/src/config/env.schema.ts docker-compose.staging.yml` encontra 2 linhas
    - `grep -n "firebase-admin" apps/backend/package.json` não encontra nada
    - `corepack pnpm --filter @sgs/backend test -- fcm-push` sai 0
  </acceptance_criteria>
  <done>Envio FCM v1 com mapeamento de erros testado; sem credencial o push é no-op e o backend sobe.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/backend test -- resolve-push-targets` verde
- `corepack pnpm --filter @sgs/backend test -- push-bridal` verde e contém o texto exato '3 atendimentos no casamento da Vitória, 08/11'
- `corepack pnpm --filter @sgs/backend test -- fcm-push` verde
- `corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend lint` verdes
- `grep -n "fcm.googleapis.com/v1/projects" apps/backend/src/push/fcm-push.provider.ts`
- `grep -n "FCM_SERVICE_ACCOUNT_JSON" apps/backend/src/config/env.schema.ts .env.staging.example docker-compose.staging.yml` encontra 3 arquivos
- `grep -n "3 atendimentos no casamento da Vitória, 08/11" apps/backend/src/push/push-bridal.spec.ts`
- `grep -rn "firebase-admin" apps/backend/package.json` não encontra nada
</verification>

<success_criteria>
Regras D-12/D-13/D-14/D-15 e o envio FCM v1 (D-04) existem como código puro com testes vermelhos→verdes; o backend sobe sem credencial FCM.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-03-SUMMARY.md`
</output>

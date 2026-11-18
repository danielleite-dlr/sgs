---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 07
type: execute
wave: 2
depends_on: ["09-01"]
files_modified:
  - apps/backend/src/push/push.types.ts
  - apps/backend/src/push/push.service.ts
  - apps/backend/src/push/push-messages.ts
  - apps/backend/src/push/push-commercial.spec.ts
  - apps/backend/test/integration/phase9-push-reminder.e2e.spec.ts
  - packages/shared/src/push.ts
  - packages/shared/src/__tests__/push.test.ts
  - apps/frontend/public/sw.js
  - apps/frontend/src/infrastructure/native/push-route.ts
  - apps/frontend/src/infrastructure/native/__tests__/push-route.test.ts
  - apps/frontend/src/__tests__/service-worker.test.ts
autonomous: true
requirements: [COM-11]

must_haves:
  truths:
    - "Um job { kind: 'commercial.reminder', orgId, reminderId } manda push para o responsável do negócio + ADMIN/MANAGER ativos; sem negócio, para quem criou + ADMIN/MANAGER; cada membro uma vez (D-16)"
    - "Lembrete concluído ou excluído não gera envio; responsável que não usa mais o Comercial (virou PROFESSIONAL, inativo) não recebe"
    - "O texto é o mesmo no Android (FCM) e no iPhone (Web Push), com data.route = /comercial/lembretes?lembrete=<id> (decisão da fase 8)"
    - "Tocar na notificação abre /comercial/lembretes nas três camadas (sw.js, push-route.ts do app, packages/shared); rotas adulteradas continuam caindo em /agenda"
    - "Os envios de agendamento e de noivas continuam idênticos (specs de push existentes verdes)"
  artifacts:
    - path: "apps/backend/src/push/push.service.ts"
      provides: "dispatch com ramo commercial.reminder e envio comum extraído"
      contains: "dispatchCommercialReminder"
    - path: "apps/backend/src/push/push-messages.ts"
      provides: "buildCommercialReminderMessage, buildReminderRoute"
      contains: "buildCommercialReminderMessage"
    - path: "packages/shared/src/push.ts"
      provides: "PUSH_ROUTE_RE com /comercial/lembretes"
      contains: "comercial\\/lembretes"
  key_links:
    - from: "apps/frontend/public/sw.js"
      to: "packages/shared/src/push.ts"
      via: "mesma regex copiada"
      pattern: "comercial\\\\/lembretes"
    - from: "apps/backend/src/push/push.service.ts"
      to: "commercial_reminders"
      via: "tx.commercialReminder.findFirst"
      pattern: "commercialReminder\\.findFirst"
---

<objective>
Novo tipo de push `commercial.reminder` no `PushService` (alvos, mensagem, envio pelos dois canais já existentes) e alargamento da lista de rotas permitidas no toque da notificação nas quatro cópias, para abrir `/comercial/lembretes`.

Purpose: D-16 (push na hora marcada, Android e iPhone). Sem alargar a allowlist o toque abriria `/agenda` (armadilha 3 da pesquisa). O tick que dispara os jobs vem no 09-08.
Output: ramo no dispatch, mensagem, regex nas 4 cópias, specs unit/vitest e integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md
@.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-01-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. `sw.js` e `push-route.ts` são JS/TS do frontend formatados à mão.

<interfaces>
`apps/backend/src/push/push.types.ts` (hoje): `PUSH_KINDS = ['appointment.created','appointment.cancelled','bridal.scheduled','bridal.cancelled'] as const`; `PushJob` união: `{ kind: 'appointment.created'|'appointment.cancelled'|'bridal.scheduled'; orgId; actorMemberId; appointmentIds }` | `{ kind: 'bridal.cancelled'; orgId; actorMemberId; since; groupId?; contractId? }`; `PushMessage { title; body; data: Record<string,string> }`; `PushProvider.send(token, message, keys?)`.
`apps/backend/src/push/push.service.ts::dispatch(job)`: calcula `channels` (fcm/webpush habilitados; nenhum → `skipped: 'disabled'`); monta `plan` dentro de `runWithTenant` (agendamentos, `MANAGER_ROLES`, `resolvePushTargets`, `tx.deviceToken.findMany({ where: { memberId: { in }, provider: { in: channels } } })`, `SendItem { tokenId, token, provider, keys, message }` com dedupe `${provider}:${token}`); depois o laço de envio em lotes de `CONCURRENCY`, contagem `sent/failed/invalidIds`, log de credencial, `deleteMany` dos inválidos e `throw new Error('Push indisponível: nova tentativa')` quando tudo falhou retentável.
Allowlist hoje (`/^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/`): `apps/frontend/public/sw.js` (`AGENDA_ROUTE_RE`, `DEFAULT_ROUTE = '/agenda'`, `safeRoute`), `apps/frontend/src/infrastructure/native/push-route.ts` (`AGENDA_ROUTE_RE`, `isAllowedPushRoute`, usado por `native-push.ts` e `WebPushBridge.tsx`), `packages/shared/src/push.ts` (`AGENDA_ROUTE_RE`, `buildAgendaRoute`, `isAllowedPushRoute`, `PUSH_KINDS`, `PushData { kind; route; appointmentId; groupId? }`), teste `apps/frontend/src/__tests__/service-worker.test.ts` (`it.each(['https://evil.com', '//evil.com', '/agenda/../admin', '/financeiro'])('rota adulterada %s vira /agenda')`).
Tabela `commercial_reminders` (09-01): `title, description, due_at, completed_at, notified_at, lead_id, deal_id, created_by`; `commercial_deals.assignee_member_id, kind, event_date, lead_id`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Allowlist de rota nas quatro cópias</name>
  <files>packages/shared/src/push.ts, packages/shared/src/__tests__/push.test.ts, apps/frontend/public/sw.js, apps/frontend/src/infrastructure/native/push-route.ts, apps/frontend/src/infrastructure/native/__tests__/push-route.test.ts, apps/frontend/src/__tests__/service-worker.test.ts</files>
  <read_first>
    - packages/shared/src/push.ts e __tests__/push.test.ts
    - apps/frontend/public/sw.js
    - apps/frontend/src/infrastructure/native/push-route.ts e __tests__/push-route.test.ts
    - apps/frontend/src/__tests__/service-worker.test.ts
  </read_first>
  <behavior>
    - isAllowedPushRoute('/comercial/lembretes') e '/comercial/lembretes?lembrete=0193-abc' → true (nas 3 implementações)
    - continuam false: 'https://evil.com', '//evil.com', '/agenda/../admin', '/financeiro', '/comercial', '/comercial/leads', '/comercial/lembretes/../admin', '/comercial/lembretesx'
    - sw.js: push com route '/comercial/lembretes?lembrete=r1' mostra a notificação com data.route igual e o clique abre essa rota; rota adulterada vira '/agenda'
    - buildReminderRoute('r1') → '/comercial/lembretes?lembrete=r1'; id com caractere fora de [A-Za-z0-9-] → lança Error
  </behavior>
  <action>
Em `packages/shared/src/push.ts`: manter `AGENDA_ROUTE_RE` exportado (compatibilidade) e criar `export const PUSH_ROUTE_RE = /^\/(agenda|comercial\/lembretes)(\?[A-Za-z0-9=&._~%-]*)?$/;`; `isAllowedPushRoute` passa a usar `PUSH_ROUTE_RE`; `export function buildReminderRoute(reminderId: string): string` (valida `^[A-Za-z0-9-]{1,64}$`); `PUSH_KINDS` ganha `'commercial.reminder'`; `PushData` passa a `{ kind; route; appointmentId?: string; groupId?: string; reminderId?: string }`. Mesma regex copiada em `push-route.ts` (comentário "Cópia de packages/shared/src/push.ts") e em `sw.js` (renomear a constante para `PUSH_ROUTE_RE` e usá-la em `safeRoute`; `DEFAULT_ROUTE` continua '/agenda'). Testes do `<behavior>` acrescentados aos três arquivos de teste (sem remover casos existentes). Commit `feat(09-07): toque no push abre /comercial/lembretes`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/shared test && corepack pnpm --filter @sgs/frontend exec vitest run src/__tests__/service-worker.test.ts src/infrastructure/native && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "comercial\\\\/lembretes" packages/shared/src/push.ts apps/frontend/public/sw.js apps/frontend/src/infrastructure/native/push-route.ts` mostra ≥1 em cada um dos 3
    - `grep -n "'/financeiro'" apps/frontend/src/__tests__/service-worker.test.ts` continua encontrando (caso de rota adulterada mantido)
    - `grep -n "/comercial/lembretes?lembrete=" apps/frontend/src/__tests__/service-worker.test.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>As quatro cópias aceitam só a rota nova, sem abrir brecha.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ramo commercial.reminder no PushService</name>
  <files>apps/backend/src/push/push.types.ts, apps/backend/src/push/push.service.ts, apps/backend/src/push/push-messages.ts, apps/backend/src/push/push-commercial.spec.ts, apps/backend/test/integration/phase9-push-reminder.e2e.spec.ts</files>
  <read_first>
    - apps/backend/src/push/push.service.ts
    - apps/backend/src/push/push-messages.ts e push-messages.spec.ts
    - apps/backend/src/push/push.service.webpush.spec.ts e push.processor.spec.ts (não podem quebrar)
    - apps/backend/test/integration/push-dispatch.e2e.spec.ts (modelo: providers falsos e device_tokens)
  </read_first>
  <behavior>
    - buildCommercialReminderMessage({ reminderId: 'r1', title: 'Ligar para Ana', leadName: 'Ana', dealKind: 'noiva', eventDate: '2027-05-10' }, 'America/Sao_Paulo') → title 'Lembrete: Ligar para Ana', body 'Ana · Noiva · 10/05/2027', data { kind: 'commercial.reminder', route: '/comercial/lembretes?lembrete=r1', reminderId: 'r1' }
    - sem negócio e sem lead: body = description (até 140) ou 'Abra o Comercial para ver o lembrete'; título cortado em 100 caracteres
    - dispatch({ kind: 'commercial.reminder', orgId, reminderId }) com negócio de attendantB: envia para attendantB, admin e manager (1 vez cada mesmo com 2 tokens iguais), não para attendant nem proA
    - lembrete sem negócio criado por attendant → attendant + admin + manager
    - lembrete com completed_at → { skipped: 'no-reminder' }; reminderId inexistente → idem
    - responsável inativo ou com papel PROFESSIONAL → não recebe (gerentes recebem)
    - sem canais → skipped 'disabled' (igual aos outros kinds)
    - specs existentes de push (push.service.webpush, push.processor, push-messages, push-bridal) e integração push-dispatch/push-hooks verdes sem mudança de expectativa
  </behavior>
  <action>
1. `push.types.ts`: `'commercial.reminder'` em `PUSH_KINDS`; nova variante `| { kind: 'commercial.reminder'; orgId: string; reminderId: string }` em `PushJob`.
2. `push-messages.ts`: `export function buildReminderRoute(id)` (mesma regra do shared; o backend não importa o pacote shared hoje — conferir; se importar, reusar) e `export function buildCommercialReminderMessage(view, timezone): PushMessage` conforme `<behavior>` (rótulo 'Noiva'/'Debutante'; data `dd/MM/yyyy` sem converter fuso, é DATE).
3. `push.service.ts`: extrair o trecho de envio/contagem/limpeza/retry para `private async sendItems(orgId: string, items: SendItem[]): Promise<PushDispatchResult>` (comportamento idêntico, inclusive a mensagem 'Push indisponível: nova tentativa'); `dispatch` passa a terminar com `return this.sendItems(job.orgId, plan.items)`. No topo de `dispatch`, depois do cálculo de `channels`: `if (job.kind === 'commercial.reminder') return this.dispatchCommercialReminder(job, channels);`. `dispatchCommercialReminder`: dentro de `runWithTenant`, `tx.commercialReminder.findFirst({ where: { id: job.reminderId, completedAt: null }, include: { deal: { include: { lead: true } }, lead: true } })` → null ⇒ `skipped: 'no-reminder'`; alvos = (`deal?.assigneeMemberId` ou, sem negócio, `createdBy`) + membros ativos ADMIN/MANAGER; filtrar por `member.findMany({ where: { id: { in }, status: 'active', deletedAt: null, role: { name: { in: ['ADMIN','MANAGER','ATTENDANT'] } } } })`; deduplicar; tokens e `SendItem` como no ramo existente; `sendItems`. Acrescentar `'no-reminder'` ao tipo de `skipped`.
4. `push-commercial.spec.ts` (unit com tx/provider falsos, padrão de `push.service.webpush.spec.ts`) e `phase9-push-reminder.e2e.spec.ts` (integração com providers falsos, padrão de `push-dispatch.e2e.spec.ts`, mundo `createPhase9World`) cobrindo o `<behavior>`.
Commits `test(09-07): push do lembrete comercial` e `feat(09-07): push commercial.reminder para responsável e gerentes`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- src/push && corepack pnpm --filter @sgs/backend test:integration -- phase9-push-reminder push-dispatch push-hooks && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "'commercial.reminder'" apps/backend/src/push/push.types.ts` encontra
    - `grep -n "private async sendItems" apps/backend/src/push/push.service.ts` encontra
    - `grep -n "dispatchCommercialReminder" apps/backend/src/push/push.service.ts` encontra
    - `grep -n "export function buildCommercialReminderMessage" apps/backend/src/push/push-messages.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Push do lembrete pronto para o tick do 09-08.</done>
</task>

</tasks>

<verification>
Specs de push (unit e integração), shared e vitest das rotas verdes.
</verification>

<success_criteria>
Lembrete comercial notifica as pessoas certas no Android e no iPhone e o toque abre a tela de Lembretes.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-07-SUMMARY.md`
</output>

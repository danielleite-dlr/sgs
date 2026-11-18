---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 04
subsystem: backend
tags: [web-push, vapid, push, bullmq, nestjs]
requires: [08-01, 08-02]
provides: [WebPushProvider, dispatch de push em dois canais (fcm + webpush)]
affects: [08-07]
tech-stack:
  added: []
  patterns: [provider por registro, canal desligável por env, falha parcial não reenvia]
key-files:
  created:
    - apps/backend/src/push/web-push.provider.ts
    - apps/backend/src/push/web-push.provider.spec.ts
    - apps/backend/src/push/push.service.webpush.spec.ts
  modified:
    - apps/backend/src/push/push.types.ts
    - apps/backend/src/push/push.service.ts
    - apps/backend/src/push/push.module.ts
    - apps/backend/src/push/push.processor.spec.ts
    - apps/backend/test/integration/push-dispatch.e2e.spec.ts
decisions:
  - "send() ganhou 3º argumento opcional keys; FCM o ignora"
  - "Dedupe por provider:token; mensagem de retry genérica 'Push indisponível: nova tentativa'"
  - "vapidDetails por chamada, sem setVapidDetails global"
metrics:
  tasks: 2
  completed: 2026-11-17
requirements: [D-08, D-09, D-10]
---

# Fase 8 Plano 04: WebPushProvider e dispatch de dois canais Summary

O mesmo job de push da fase 7 agora sai também por Web Push (VAPID) para inscrições `webpush`, com limpeza de inscrição morta (404/410) e canal desligado quando não há VAPID.

## Commits
- 0d35427 feat(08-04): provider Web Push (VAPID)
- 951055d feat(08-04): avisos da agenda também por Web Push

## Resultados de teste
- Unit `src/push`: 111 passando (inclui 8 novos do dispatch e web-push.provider).
- `tsc --noEmit` e eslint (src/push e o spec de integração): sem erros.
- **Integração NÃO executada** (regra de execução paralela): `push-dispatch.e2e.spec.ts` (describe "Fase 8 - dispatch com Web Push") escrito.

## Deviations from Plan
- Prettier rodado com `--single-quote --print-width 100` só nos arquivos novos/tocados (não há config de prettier no repo; o padrão sem flags usaria aspas duplas).
- Tokens sem campo `provider` (mocks antigos) são tratados como fcm, mantendo os testes da fase 7 intactos.
- Integração e `phase2-modules-boot` não rodados (orquestrador).

## Para o orquestrador rodar após o merge
`corepack pnpm --filter @sgs/backend test:integration -- push-dispatch push-hooks phase2-modules-boot` (migration 08-01 já aplicada no dev).

## Known Stubs
Nenhum.

## Self-Check: PASSED

---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 03
subsystem: backend-push
tags: [push, fcm, nestjs, tdd]
requires:
  - phase: 07-01
    provides: google-auth-library no backend e regras de rota em packages/shared
provides:
  - push.types.ts (PUSH_QUEUE, PUSH_PROVIDER, PushJob, PushProvider, PushSendResult)
  - resolvePushTargets (D-12/D-13) e buildPushMessage/buildAgendaRoute (D-14/D-15) como funções puras
  - FcmPushProvider (FCM HTTP v1), NoopPushProvider, createPushProvider, parseFcmServiceAccount
  - variáveis FCM_SERVICE_ACCOUNT_JSON e PUSH_NOTIFICATIONS_WORKER
affects: [07-07, 07-09]
tech-stack:
  added: []
  patterns: ["regras de negócio do push em funções puras; provider injetável com fetch/getAccessToken mockáveis"]
key-files:
  created:
    - apps/backend/src/push/push.types.ts
    - apps/backend/src/push/resolve-push-targets.ts
    - apps/backend/src/push/push-messages.ts
    - apps/backend/src/push/fcm-credentials.ts
    - apps/backend/src/push/fcm-push.provider.ts
  modified:
    - apps/backend/src/config/env.schema.ts
    - apps/backend/src/config/app-config.service.ts
    - .env.example
    - .env.staging.example
    - docker-compose.staging.yml
key-decisions:
  - "Sem credencial FCM o provider é no-op (enabled=false) e o backend sobe normalmente"
  - "Cancelamento em massa usa o mesmo formato de lote: um resumo por profissional e um por gestora"
  - "Datas dos avisos sempre no fuso do salão; a data do evento da noiva (coluna DATE) lê em UTC"
requirements-completed: [C-03, C-04]
duration: ~25min
completed: 2026-11-16
---

# Phase 7 Plan 03: Núcleo do push no backend Summary

Regras de quem recebe (D-12/D-13), textos e rotas (D-14/D-15) e cliente FCM HTTP v1 (D-04) prontos como código puro, com testes vermelhos antes dos verdes.

## Commits

- `1caa982` test: specs de alvos e textos (RED)
- `c0e1e2b` feat: resolvePushTargets e textos/rotas
- `fc02720` test: spec do cliente FCM (RED)
- `a95a2ad` feat: cliente FCM v1 e credenciais
- `6927ece` feat: variáveis do push

## Verificação

- Jest `push` e `config`: 43/43 (resolve-push-targets 7, push-messages 6, push-bridal 12, fcm-push 18, config)
- `tsc --noEmit` e `eslint` do backend: verdes
- Não rodados: suíte jest completa e integração (nenhum código existente foi alterado além de getters de config)
- Sem `firebase-admin` no backend

## Deviations from Plan

None - plano executado como escrito. Observações: o `prisma generate` precisou ser rodado no worktree para o typecheck (client não gerado); prettier não está instalado, então os arquivos foram formatados à mão.

## Known Stubs

Nenhum. `NoopPushProvider` é intencional (sem credencial); o processor/fila que consome estas funções vem no 07-07.

## Self-Check: PASSED

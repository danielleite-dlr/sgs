---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 02
subsystem: backend
tags: [push, device-tokens, rls, graphql, prisma]
requires: [07-01]
provides:
  - tabela device_tokens com RLS ENABLE+FORCE
  - registerDeviceToken / unregisterDeviceToken
  - PushModule com DeviceTokensService
  - tipos gerados em packages/shared
affects: [07-07, 07-08]
tech-stack:
  added: []
  patterns: [upsert por unique (org, provider, token), validação local copiada do shared]
key-files:
  created:
    - apps/backend/prisma/migrations/20261120000000_device_tokens/migration.sql
    - apps/backend/src/graphql/schema/device-tokens.graphql
    - apps/backend/src/push/device-tokens.service.ts
    - apps/backend/src/push/device-tokens.service.spec.ts
    - apps/backend/src/push/device-tokens.resolver.ts
    - apps/backend/src/push/push.module.ts
    - apps/backend/test/integration/device-tokens.e2e.spec.ts
    - packages/shared/src/generated/graphql.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.module.ts
    - apps/backend/test/integration/helpers/phase3-cleanup.ts
    - packages/shared/src/index.ts
key-decisions:
  - "Provider 'fcm' cobre Capacitor e o futuro Expo; backend sem dependência do Capacitor (D-04)"
  - "Sessão impersonating não grava token (retorna false)"
requirements-completed: [C-03, C-06]
duration: 40min
completed: 2026-11-16
---

# Phase 7 Plan 02: Registro de tokens de aparelho Summary

Registro neutro de tokens FCM por salão: tabela `device_tokens` com RLS forçada, mutations `registerDeviceToken`/`unregisterDeviceToken` com permissão `notification.read`, token movido entre usuárias do mesmo salão e `PushModule` inicial.

## Tarefas

1. Migration + model Prisma + cleanup da fase 3: `f8b3a8d`
2. Serviço, resolver, SDL, PushModule, tipos gerados no shared: `0ea6413`
3. Integração (7 casos: RBAC dos 4 papéis, upsert entre membros, lastSeenAt, RLS, unregister, validação, sem autenticação): `9105be6`

## Verificação

- Jest unitário device-tokens: 7/7. tsc backend e shared: ok. eslint backend: ok.
- Integração device-tokens: 7/7 (Postgres de dev).
- Suíte completa de integração: 65 suítes / 708 testes verdes (inclui phase4-alerts-boot).
- RLS confirmada: `relrowsecurity|relforcerowsecurity = t|t`.

## Desvios do plano

- O `prisma migrate diff` com banco shadow não foi executado, para não criar bancos extras no Postgres de dev compartilhado com outros agentes; vale só o `migrate deploy` (aplicado ao `sgs_dev`).
- Prettier do backend rodou com `--single-quote --trailing-comma all` nos arquivos novos (o padrão sem flags usa aspas duplas, diferente do restante do código).
- O `index.ts` do shared já exportava `graphql/device-tokens` (07-01); só foi acrescentado `generated/graphql`.

## Problemas conhecidos

Nenhum stub. A migration já está aplicada no `sgs_dev` compartilhado.

## Self-Check: PASSED (arquivos e commits conferidos)

---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 01
subsystem: backend
tags: [webpush, device-tokens, anti-ssrf, prisma, graphql]
requires: [phase-07 device_tokens]
provides: [registro de inscrição Web Push (provider webpush, platform ios) em device_tokens]
affects: [08-04 envio de push]
tech-stack:
  added: []
  patterns: [validação espelhada backend/shared, allowlist de host]
key-files:
  created:
    - apps/backend/prisma/migrations/20261121000000_device_tokens_webpush/migration.sql
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/push/device-tokens.service.ts
    - apps/backend/src/push/device-tokens.service.spec.ts
    - apps/backend/src/graphql/schema/device-tokens.graphql
    - apps/backend/test/integration/device-tokens.e2e.spec.ts
    - packages/shared/src/validation.ts
    - packages/shared/src/__tests__/validation.test.ts
decisions:
  - "Allowlist WEBPUSH_ALLOWED_HOSTS = ['web.push.apple.com']; sem porta, credencial ou http; máx. 2048 chars"
  - "Chaves p256dh (87 chars base64url) e auth (22) validadas por regex; fcm grava NULL"
metrics:
  tasks: 2
  completed: 2026-11-17
requirements: [D-08]
---

# Fase 8 Plano 01: Backend de device tokens com Web Push Summary

Registro de inscrição Web Push do iPhone no mesmo `device_tokens` da fase 7, com migration aditiva (colunas p256dh/auth, provider webpush) e validação anti-SSRF do endpoint.

## Commits
- c342177 feat(08-01): device_tokens aceita inscrição webpush
- 1d09575 feat(08-01): registro de inscrição webpush com validação do endpoint

## Resultados de teste
- Unit backend (`test -- device-tokens`): 20 passando.
- Vitest do `@sgs/shared`: 23 passando.
- `typecheck` e `lint` do backend: ok.
- `prisma generate`: ok.
- **Integração (`device-tokens.e2e.spec.ts`, describe "Fase 8 - inscrição webpush"): escrita, NÃO executada. Pendente de execução pelo orquestrador**, assim como a aplicação da migration no `sgs_dev` (não aplicada para não afetar o banco compartilhado).

## Deviations from Plan
- O passo de `prisma:migrate:deploy` e a verificação via psql da Task 1 não foram feitos (instrução do orquestrador para execução paralela).
- O prettier do backend foi aplicado aos 3 arquivos TS tocados (conforme o plano) e reformatou trechos preexistentes, o que aumentou o diff dos dois specs e do service.
- Nome da constraint de provider conferido: `chk_device_tokens_provider` (confere com o plano).

## Known Stubs
Nenhum.

## Self-Check: PASSED

---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 02
subsystem: api
tags: [web-push, vapid, graphql, nestjs, config]
requires: []
provides:
  - Leitura segura das chaves VAPID (parseVapidDetails, AppConfigService.vapid)
  - Query pushConfig { webPushPublicKey } autenticada
  - Variáveis VAPID_* no compose e nos exemplos de env
affects: [08-04, 08-07]
tech-stack:
  added: [web-push@3.6.7, "@types/web-push@3.6.4"]
  patterns: [parser de credenciais que nunca lança, canal desligado sem chaves]
key-files:
  created:
    - apps/backend/src/push/web-push-credentials.ts
    - apps/backend/src/push/web-push-credentials.spec.ts
    - apps/backend/src/push/push-config.resolver.ts
    - apps/backend/src/push/push-config.resolver.spec.ts
    - apps/backend/src/graphql/schema/push-config.graphql
    - apps/backend/test/integration/push-config.e2e.spec.ts
    - packages/shared/src/graphql/push-config.ts
  modified:
    - apps/backend/package.json
    - pnpm-lock.yaml
    - apps/backend/src/config/env.schema.ts
    - apps/backend/src/config/app-config.service.ts
    - apps/backend/src/push/push.module.ts
    - packages/shared/src/index.ts
    - docker-compose.staging.yml
    - .env.example
    - .env.staging.example
key-decisions:
  - "web-push fixo em 3.6.7 (CommonJS); 4.x é ESM-only e quebra jest"
  - "Qualquer VAPID ausente ou malformado desliga o canal (null) sem derrubar o boot"
requirements-completed: [D-10]
duration: 15min
completed: 2026-11-17
---

# Phase 8 Plan 02: Config VAPID e query pushConfig Summary

Chaves VAPID lidas do env com validação estrita (base64url 87/43 chars, subject https/mailto sem localhost), e query `pushConfig` que entrega só a chave pública ao frontend.

## Tarefas

1. Dependência web-push 3.6.7, env VAPID, `parseVapidDetails`, compose e exemplos: d8be8cf
2. Query `pushConfig`, resolver, schema, módulo e documento em packages/shared: 53114ce

## Verificação

- Jest unit: web-push-credentials (11) e push-config.resolver (2) verdes
- typecheck e lint do backend: 0; typecheck e vitest do shared (11 testes): verdes
- **Teste de integração `push-config.e2e.spec.ts` escrito, mas NÃO executado** (pendente do orquestrador, junto com `phase2-modules-boot`), por regra de não usar o Postgres compartilhado.

## Deviations from Plan

- Necessário rodar `corepack pnpm install` e `prisma generate` (só gera cliente, sem tocar no banco) no worktree para o typecheck passar. Sem alteração de código.
- O caso "sem token" da integração aceita qualquer erro de autenticação (status != 500, sem data), pois o formato exato do erro não foi verificável sem rodar a suíte.

## Known Stubs

Nenhum.

## Self-Check: PASSED

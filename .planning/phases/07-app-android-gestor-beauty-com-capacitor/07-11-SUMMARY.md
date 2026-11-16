---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 11
subsystem: infra
tags: [gate, deploy, staging, ci, android, migration, rls]
requires:
  - phase: 07-06
  - phase: 07-09
  - phase: 07-10
provides:
  - Staging rodando o código da fase 7 com a tabela device_tokens (RLS forçada)
  - APK debug baixável fora do repositório
  - 07-VALIDATION.md com linhas automatizadas em green
affects: [07-12, 07-13]
tech-stack:
  added: []
  patterns: [backup do Postgres do staging antes de deploy com migration]
key-files:
  created: []
  modified:
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-VALIDATION.md
key-decisions:
  - "Disparado workflow_dispatch do Android no HEAD publicado, porque o workflow tem filtro de paths e não roda em commits só de documentação"
requirements-completed: [C-01, C-02, C-03, C-04, C-05, C-06]
duration: ~70min
completed: 2026-11-16
---

# Phase 7 Plan 11: Gate, deploy no staging e CI Summary

**Gate completo verde no master, staging atualizado com a migration `device_tokens` (RLS forçada, push desligado sem FCM) e APK debug baixado do CI.**

## Resultados do gate (master, antes do push)

| Etapa | Resultado |
|-------|-----------|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm -r typecheck` | ok |
| `pnpm -r --if-present lint` (backend e frontend) | ok, 0 warnings |
| Backend jest unit | 47 suítes, 509 testes |
| Backend integração | 67 suítes, 716 testes |
| Frontend vitest | 119 arquivos, 860 testes |
| `@sgs/shared` | 2 arquivos, 11 testes |
| `@sgs/mobile` (check-config) | 47 verificações |
| E2E Playwright | 53 passed (8,8 min), sem falhas nem flaky |
| Build Docker `backend frontend` do staging | ok |

Verificações estáticas: sem `.jks`/`.keystore`/`google-services.json`/service-account versionados; sem `@sgs/shared` nos package.json do backend/frontend; sem import de `@capacitor/push-notifications` fora de testes; `build` raiz sem mobile/shared.

## Deploy

- Backup: `/root/sgs-backups/stg-pre-app-android-20261116-1620.sql.gz` (267.583 bytes, `gzip -t` ok, 50 CREATE TABLE).
- Push: `d18782e..06876ef`, depois `06876ef..f983fe4`.
- `./scripts/deploy-staging.sh` terminou com "Deploy concluído"; backend OK e frontend OK.
- `device_tokens` no staging: `relrowsecurity|relforcerowsecurity` = `true|true` (equivale a `t|t`); `_prisma_migrations` registra `20261120000000_device_tokens` como finalizada.
- Log do backend: "Push desabilitado (sem FCM_SERVICE_ACCOUNT_JSON)". Credenciais FCM não foram configuradas (07-12).
- Site: HTTP 200, `viewport-fit=cover` presente (1 ocorrência).
- `mutation unregisterDeviceToken` sem token: `UNAUTHENTICATED` (401), sem 500 e sem "Cannot query field".
- O container `sgs_stg_backend` não tem healthcheck Docker; a saúde foi confirmada pelo "backend OK" do script e pelo GraphQL respondendo.

## CI

- CI do commit publicado `06876ef`: run 43938294943, success (5m51s).
- Workflow `Android (Gestor Beauty)` só dispara com mudanças em `apps/mobile/**`, `apps/frontend/package.json`, lockfile ou o próprio yml, então não rodou nos commits de documentação. Foi disparado `workflow_dispatch` no HEAD: run 43939348503, job `debug` success; artefato `gestor-beauty-debug-apk` (5.358.261 bytes).
- O job `release` do mesmo run falhou no passo "Conferir segredos" (esperado: keystore e `GOOGLE_SERVICES_JSON_BASE64` ainda não existem; pertence ao 07-12). Não é regressão.
- Run anterior de push (onda 3) do Android: 43926788694, success.
- APK baixado em `/root/gestor-beauty-apks/debug-20261116/app-debug.apk` (6.345.555 bytes), fora do repositório. Este APK foi gerado sem `google-services.json`, portanto sem push.

## Commits

- `06876ef` docs(07-11): gate verde e mapa de validação
- `f983fe4` docs(07-11): staging publicado e CI verde

## Deviations from Plan

None - o plano foi executado como escrito. Único acréscimo: disparo manual do workflow Android para validar o HEAD publicado (justificado acima). Nenhuma regressão encontrada; a exceção `phase4-alerts-boot` não ocorreu (Valkey de dev respondeu PONG).

## Known Stubs

None.

## Self-Check: PASSED

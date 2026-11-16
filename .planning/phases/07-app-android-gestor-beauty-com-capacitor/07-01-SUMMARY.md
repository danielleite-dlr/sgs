---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 01
subsystem: infra
tags: [pnpm, monorepo, capacitor, shared, fcm]
requires:
  - phase: 04.2
    provides: staging com o cronograma da noiva (pré-condição da fase 7)
provides:
  - packages/shared (@sgs/shared) com regras de rota do push, validação do token e documentos GraphQL
  - apps/mobile (@sgs/mobile) registrado no workspace com Capacitor 8.6.2
  - dependências Capacitor (frontend) e google-auth-library (backend) com versões exatas
  - passo de teste do shared no CI
affects: [07-02, 07-03, 07-04, 07-05]
tech-stack:
  added: ["@capacitor/* 8.x", "google-auth-library 11.3.4", "@sgs/shared (fonte TS pura)"]
  patterns: ["shared sem consumidores nos apps com Docker; backend e frontend mantêm cópias locais"]
key-files:
  created:
    - packages/shared/package.json
    - packages/shared/src/push.ts
    - packages/shared/src/validation.ts
    - packages/shared/src/graphql/device-tokens.ts
    - apps/mobile/package.json
  modified:
    - pnpm-workspace.yaml
    - package.json
    - pnpm-lock.yaml
    - apps/frontend/package.json
    - apps/backend/package.json
    - .github/workflows/ci.yml
key-decisions:
  - "Nenhum app com Docker depende de @sgs/shared (Pitfall 1)"
  - "Versões do Capacitor fixas e idênticas entre frontend e mobile"
requirements-completed: [C-06, C-01, C-03, C-04]
duration: ~25min
completed: 2026-11-16
---

# Phase 7 Plan 01: Monorepo e dependências compartilhadas Summary

`packages/shared` (@sgs/shared) criado e testado (11 testes), `apps/mobile` registrado no workspace e todas as dependências da fase instaladas num único lockfile, com o build Docker do staging intacto.

## Tarefas

1. **Task 1 (TDD):** packages/shared com `buildAgendaRoute`, `isAllowedPushRoute`, `validateDeviceTokenInput` e documentos GraphQL; workspace passa a incluir `packages/*`. Commit `261e17e`.
2. **Task 2:** `apps/mobile/package.json`, plugins Capacitor exatos no frontend, `google-auth-library@11.3.4` no backend, passo `@sgs/shared test` no job `frontend-unit`. Commit `3101ab6`.

## Verificação

- `pnpm install --frozen-lockfile`: ok
- `pnpm -r typecheck`: verde
- `pnpm -r --if-present lint`: verde (backend e frontend)
- `@sgs/shared test`: 11/11
- Vitest do frontend: 810/810 (110 arquivos)
- `docker compose -f docker-compose.staging.yml --env-file .env.staging build backend frontend`: verde, 5m05s
- Não rodados neste plano (sem mudança de código de backend/frontend): jest unit/integração do backend e E2E; ficam para o gate final da wave.

## Deviations from Plan

None - plano executado como escrito. Observação: `prettier` não está instalado no workspace, então os arquivos novos do shared não foram passados por ele (formatados à mão).

## Known Stubs

Os scripts `typecheck` e `test` de `apps/mobile` são `echo` por desenho do plano; o 07-04 os troca por `tsc --noEmit` e `check-config`.

## Self-Check: PASSED

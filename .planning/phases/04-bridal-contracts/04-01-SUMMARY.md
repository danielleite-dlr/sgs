---
phase: 04-bridal-contracts
plan: 01
subsystem: database
tags: [postgres, rls, prisma, nestjs, permissions, contracts, bridal]
requires: []
provides:
  - migration 20261103000000_phase4_bridal_contracts (13 tabelas, RLS forçada, ledgers imutáveis, job_list_active_orgs)
  - modelos Prisma da fase 4 e colunas novas em packages/appointments/time_blocks/cash_movements/comanda_items
  - 8 permissões bridal.* e contract.* (catálogo TS == role_permissions)
  - env ANTHROPIC_*, AI_SCHEDULE_DAILY_LIMIT, CONTRACT_ALERTS_SCHEDULER
  - 6 módulos Nest vazios registrados no AppModule
  - helpers de teste createPhase4World, insertBridalGroupRow, insertContractRow
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10]
tech-stack:
  added: ["@anthropic-ai/sdk 1.4.0", "pdfkit 0.20.2", "@nestjs/throttler 6.7.1", "@types/pdfkit"]
  patterns: ["migration única por fase", "função SECURITY DEFINER para jobs sem tenant", "ledgers com REVOKE UPDATE/DELETE"]
key-files:
  created:
    - apps/backend/prisma/migrations/20261103000000_phase4_bridal_contracts/migration.sql
    - apps/backend/src/bridal/bridal.module.ts
    - apps/backend/src/bridal/ai/ai-schedule.module.ts
    - apps/backend/src/contracts/contracts.module.ts
    - apps/backend/src/contracts/payments/contract-payments.module.ts
    - apps/backend/src/contracts/acceptance/contract-acceptance.module.ts
    - apps/backend/src/contracts/alerts/contract-alerts.module.ts
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
    - apps/backend/test/integration/helpers/phase4-cleanup.ts
    - apps/backend/test/integration/phase4-schema-smoke.e2e.spec.ts
    - apps/backend/test/integration/phase4-job-orgs.e2e.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/config/env.schema.ts
    - apps/backend/src/config/app-config.service.ts
    - apps/backend/src/app.module.ts
    - apps/backend/package.json
    - pnpm-lock.yaml
    - .env.example
    - apps/backend/test/integration/setup.ts
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Migration aditiva aplicada no sgs_dev compartilhado; sem drop/reset"
  - "ANTHROPIC_API_KEY opcional: backend sobe sem ela (heurística)"
  - "createPhase4World limpa linhas da fase 4 antes do cleanup da fase 3 para evitar violação de FK"
requirements-completed: [CLI-03, CONT-01, CONT-02, CONT-03, AI-01]
duration: ~60min
completed: 2026-11-03
---

# Phase 4 Plan 01: Fundação de banco Summary

Migration única da fase 4 com 13 tabelas sob RLS forçada, ledgers de contrato imutáveis para sgs_app, função `job_list_active_orgs()` e 8 permissões, mais Prisma, env, dependências, módulos vazios e fixtures para os planos paralelos.

## Tasks

1. Migration da fase 4 — commit 582c79c
2. schema.prisma, permissões, env, deps e módulos vazios — commit 7118096
3. Fixtures, cleanup, smoke e teste da função de job, nota no REQUIREMENTS — commit 561c486

## Verificação

- `prisma migrate deploy` aplicado; 13 tabelas com `relrowsecurity` e `relforcerowsecurity`; 13 policies; 3 REVOKE
- Gate completo (lint, tsc, jest unit 107, integração 31 suítes/293 testes, vitest frontend 300) verde antes do commit da task 2; `phase4-*` (9 testes), lint e tsc verdes antes da task 3

## Deviations from Plan

- [Rule 3 - Bloqueio] O worktree não tinha `node_modules` nem `.env`: `pnpm install --frozen-lockfile` no worktree e `.env` carregado de `/root/sgs/.env` via script. Sem impacto no código.
- `apps/backend/package.json`: o pnpm reformatou os arrays do bloco `jest`; reformatação revertida para manter o diff mínimo.
- `@types/pdfkit` existe (^0.17.7); não foi preciso `src/types/pdfkit.d.ts`.
- `prisma migrate diff` com shadow database não foi executado (sem `SHADOW_DATABASE_URL`); usado `prisma validate`/`generate` (ok). Nomes de índices parciais ficam só no SQL.
- `uq_ca_version`, `uq_cat_token_hash` e `uq_cp_reverses` foram modelados como `@unique(map: ...)` no Prisma.

## Known Stubs

Os 6 módulos Nest são vazios de propósito; cada plano posterior preenche o seu.

## Self-Check: PASSED

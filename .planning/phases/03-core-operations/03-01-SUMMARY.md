---
phase: 03-core-operations
plan: 01
subsystem: database
tags: [postgres, prisma, rls, migration, permissions, money]
requires: []
provides:
  - migration 20261101000000_phase3_operations (9 tabelas, ALTER appointments/stock_movements)
  - modelos Prisma da fase 3
  - 8 permissoes novas (catalogo TS = seed SQL)
  - src/common/money.ts
  - ComandasModule e FinancialModule vazios no AppModule
  - helpers de teste createPhase3World/destroyPhase3World/gqlAs/deletePhase3Rows
affects: [03-02, 03-03, 03-04, 03-05, 03-06]
tech-stack:
  added: []
  patterns: [ledger append-only via REVOKE, dinheiro em centavos inteiros nos services]
key-files:
  created:
    - apps/backend/prisma/migrations/20261101000000_phase3_operations/migration.sql
    - apps/backend/src/common/money.ts
    - apps/backend/src/common/money.spec.ts
    - apps/backend/src/comandas/comandas.module.ts
    - apps/backend/src/financial/financial.module.ts
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
    - apps/backend/test/integration/helpers/phase3-cleanup.ts
    - apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts
    - apps/backend/test/integration/phase3-fixtures.e2e.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/authz/permissions.catalog.ts
    - apps/backend/src/app.module.ts
    - apps/backend/test/integration/members.e2e.spec.ts
    - apps/backend/test/integration/members-lifecycle.e2e.spec.ts
    - apps/backend/test/integration/professional-categories.e2e.spec.ts
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Ledgers (commission_records, audit_log, cash_movements, client_credit_movements) sem UPDATE/DELETE para sgs_app; sem trigger, para nao quebrar cleanup via sgs_migrator"
  - "Exclusion constraint de appointments cobre scheduled, confirmed, in_progress, completed"
requirements-completed: []  # so a fundacao de banco; requisitos fecham nos planos de feature
duration: ~45min
completed: 2026-11-02
---

# Phase 3 Plan 01: Fundacao de banco Summary

Migration unica da fase 3 (9 tabelas com RLS FORCE, constraint de agenda alargada, ledgers append-only, 8 permissoes novas) mais schema Prisma, helper de dinheiro em centavos, modulos vazios e fixtures de integracao para a wave 2.

## Tasks

1. Migration da fase 3 - `76ca378`
2. schema.prisma, permissoes, money.ts, modulos vazios - `de3c5ab`
3. Smoke do schema, fixtures/cleanup, ajuste dos cleanups antigos, nota POS-02 - `22f56fd`

## Testes

- Unit backend: 63 (8 suites; money.spec com 9 casos)
- Integracao backend: 154 (16 suites, inclui phase3-schema-smoke com 6 e phase3-fixtures com 2)
- Frontend vitest: 207 (21 arquivos)
- lint e typecheck verdes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Teste extra phase3-fixtures.e2e.spec.ts**
- Os helpers de fixtures nao seriam exercitados por nenhum teste neste plano; adicionei uma suite pequena para garantir que o mundo sobe, loga e limpa antes de os planos da wave 2 dependerem dele.
- `cleanupRows` do fixtures tambem apaga `notifications` (nao listado no plano) por causa da FK de products/members.

**2. [Rule 1 - Bug] Cliente do smoke precisa de telefone**
- `chk_clients_contact` exige phone ou email; o fixture do smoke ganhou phone.

`prisma format` reformatou o alinhamento do schema.prisma inteiro (so espacos).

## Notes para os proximos planos

- `prisma migrate diff` contra o banco acusa drift apenas de nomes de FK/indices (padrao da Fase 2: schema Prisma nao replica nomes `fk_*`); nao usar `migrate dev`.
- Fixtures: `createPhase3World(prefix)` usa orgs `${prefix}-org-a/b`, senha `password1234`, proA tem seniority `senior`. `professionalsForService` e a query para validar tokens (nao existe query `professionals`).
- Cleanup de qualquer suite nova que crie appointments/clients deve chamar `deletePhase3Rows` antes de apagar appointments.
- Permissoes de bloqueios e cancelamento reaproveitam `appointment.write`; "commission.adjust" = `commission.write` (so ADMIN).

## Self-Check: PASSED

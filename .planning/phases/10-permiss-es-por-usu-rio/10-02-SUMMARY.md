---
phase: 10-permiss-es-por-usu-rio
plan: 02
subsystem: database
tags: [prisma, postgres, rls, permissions]
requires: []
provides:
  - tabela member_access_overrides (RLS forçada)
  - model Prisma MemberAccessOverride
  - phase10-fixtures (createPhase10World, destroyPhase10World, setOverrideRow, clearOverrides, gqlAs)
affects: [10-03, 10-07, 10-08]
tech-stack:
  added: []
  patterns: [RLS tenant_isolation com FORCE, cascata via FK]
key-files:
  created:
    - apps/backend/prisma/migrations/20261125000000_member_access_overrides/migration.sql
    - apps/backend/test/integration/helpers/phase10-fixtures.ts
    - apps/backend/test/integration/phase10-rls-access.e2e.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/test/integration/helpers/phase3-cleanup.ts
key-decisions:
  - "Sem CHECK de item_id no banco: o catálogo vive em código"
  - "ON DELETE CASCADE no membro e SET NULL em updated_by; purge_member não precisou mudar"
duration: 25min
completed: 2026-11-25
---

# Phase 10 Plan 02: member_access_overrides Summary

Tabela de ajustes de acesso por pessoa (só diferenças do padrão do papel) com RLS habilitada e forçada, cascata ao excluir o membro e mundo de teste da fase 10.

## Tasks
1. Migração e model Prisma: dddceb3
2. Cleanup, fixtures e suíte phase10-rls-access: c948785

## Verificação
- `relrowsecurity|relforcerowsecurity` = `t|t`; typecheck e eslint limpos.
- Integração: phase10-rls-access, phase9-leads e hard-delete-member-bridal passam (24 testes).
- `prisma migrate diff` da tabela nova só mostra diferença de nomes das FKs (constraints criadas à mão com nome padrão do Postgres, sem nome Prisma); sem diferença de colunas, PK ou índice.

## Deviations from Plan
- [Rule 3 - Bloqueio] O worktree não tinha node_modules nem .env: rodei `pnpm install --frozen-lockfile` e copiei o .env (ignorado pelo git).
- Em `purge_member` usei `$executeRawUnsafe` (a função retorna void e `$queryRaw` não deserializa).

## Known Stubs
Nenhum.

## Self-Check: PASSED

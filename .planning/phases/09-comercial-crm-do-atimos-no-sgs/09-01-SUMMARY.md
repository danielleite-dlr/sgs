---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 01
subsystem: database
tags: [postgres, rls, prisma, rbac, comercial, crm]
requires:
  - phase: 04-bridal-contracts
    provides: contracts, bridal_groups, createPhase4World, purge_member/purge_bridal_group
provides:
  - 6 tabelas commercial_* com RLS forçada e política tenant_isolation
  - 6 etapas padrão por organização (backfill)
  - permissões commercial.read/write/manage (migração e catálogo)
  - models Prisma do Comercial
  - fixtures createPhase9World, insertLeadRow, insertDealRow, stageIdOf
affects: [09-04, 09-05, 09-06, 09-07, 09-08, 09-09, 09-10, 09-15]
tech-stack:
  added: []
  patterns: ["FKs para members/contracts/clients/packages anuláveis com ON DELETE SET NULL (compatível com purge_*)"]
key-files:
  created:
    - apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql
    - apps/backend/src/authz/permissions.catalog.spec.ts
    - apps/backend/test/integration/helpers/phase9-fixtures.ts
    - apps/backend/test/integration/helpers/phase9-cleanup.ts
    - apps/backend/test/integration/phase9-rls-rbac.e2e.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/authz/permissions.catalog.ts
key-decisions:
  - "As funções purge_* não precisam de alteração: todas as FKs novas para members/contracts/clients/packages são SET NULL, e o teste prova isso."
  - "won_contract_id fica sem @unique no Prisma porque o banco usa índice único parcial (uq_cd_won_contract)."
requirements-completed: [COM-05, COM-10]
duration: 35min
completed: 2026-11-18
---

# Phase 9 Plan 01: Dados, RLS e permissões do Comercial Summary

**Seis tabelas commercial_* com RLS forçada, etapas padrão por organização e permissões commercial.read/write/manage (ADMIN/MANAGER/ATTENDANT), com fixtures e suíte de isolamento no banco real.**

## Tarefas

1. **Migração e models Prisma** — `4ba552a`. Tabelas, índices (inclusive parciais), RLS, triggers de updated_at, backfill das 6 etapas (Ganho/Perdido `is_system`) e permissões. CHECKs: kind noiva/debutante (D-05) e `chk_cd_lost` (D-10).
2. **Permissões no catálogo** — `b37682e`. ADMIN/MANAGER: as 3; ATTENDANT: read e write; PROFESSIONAL: nenhuma. Spec unitário (4 casos).
3. **Fixtures e suíte phase9-rls-rbac** — `0d5d82b`. 16 testes verdes: isolamento nas 6 tabelas, WITH CHECK, `relforcerowsecurity`, matriz de permissões, etapas, CHECKs e `purge_member`/`purge_bridal_group` com negócios apontando para o membro e o contrato.

## Deviations from Plan

None - plano executado como escrito. Ajustes de teste sem impacto: o Prisma não expõe o nome do índice no erro 23505, então a asserção de `uq_cs_won` casa `23505|already exists`; `purge_*` são chamados com `$executeRawUnsafe` (retorno `void` não desserializa em `$queryRaw`).

Observação de ambiente: `prettier` no worktree não encontra a config do repo, então foi rodado com `--single-quote --trailing-comma all --print-width 100` apenas nos arquivos novos/tocados.

## Observação sobre `prisma migrate diff`

A comparação schema x banco mostra apenas ruído de nomes (PKs e FKs renomeadas, `uq_cfs_org`) idêntico ao das tabelas antigas, e os índices parciais/de expressão que o Prisma não modela (`uq_cs_won`, `uq_cs_lost`, `uq_cd_won_contract`, `ix_cl_org_email`, `ix_cd_org_stage`, `ix_cr_due`, `ix_ci_org_lead` com DESC). Nenhuma divergência de colunas.

## Known Stubs

Nenhum.

## Issues Encountered

Nenhum bloqueio. Migração aplicada no `sgs_dev` local (todas as orgs existentes ficaram com 6 etapas). Gate rodado: lint, typecheck, unit de permissões e `phase9-rls-rbac`.

## Self-Check: PASSED

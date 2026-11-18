---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 02
subsystem: backend/commercial
tags: [tdd, dominio-puro, telefone, sla, acesso, exceljs]
requires: []
provides:
  - commercial-phone (phoneDigits, phoneKey, samePhone)
  - commercial-sla (isDealOverdue, overdueSince)
  - commercial-access (COMMERCIAL_ROLES, isManagerRole, canUseCommercial, WIN_DEAL_ROLES, canWinDeal, visibilityWhere)
  - commercial-constants (LOST_REASONS, INTERACTION_TYPES, DEAL_KINDS, COMMERCIAL_SOURCES e guards)
  - exceljs 4.4.0 no backend
affects: [09-04, 09-05, 09-06, 09-08, 09-09, 09-10]
tech-stack:
  added: [exceljs@4.4.0]
  patterns: [funções puras com spec, ponto único de regra de acesso]
key-files:
  created:
    - apps/backend/src/commercial/commercial-constants.ts
    - apps/backend/src/commercial/commercial-constants.spec.ts
    - apps/backend/src/commercial/commercial-phone.ts
    - apps/backend/src/commercial/commercial-phone.spec.ts
    - apps/backend/src/commercial/commercial-sla.ts
    - apps/backend/src/commercial/commercial-sla.spec.ts
    - apps/backend/src/commercial/commercial-access.ts
    - apps/backend/src/commercial/commercial-access.spec.ts
  modified:
    - apps/backend/package.json
    - pnpm-lock.yaml
decisions:
  - "visibilityWhere devolve Record<string, unknown> (client Prisma do 09-01 roda em paralelo); o 09-04 pode estreitar para Prisma.*WhereInput"
  - "D-21 num único ponto: WIN_DEAL_ROLES = ADMIN, MANAGER, ATTENDANT"
metrics:
  completed: 2026-11-18
  tasks: 2
  files: 10
---

# Phase 9 Plan 02: Domínio puro do Comercial (TDD) Summary

Regras de telefone (duplicidade por DDD + últimos 8 dígitos), SLA por etapa, visibilidade por papel (com D-21 num único ponto) e listas fixas, tudo puro e testado, mais a dependência `exceljs@4.4.0`.

## O que foi feito

- **Task 1** (RED `9851b5b`, GREEN `45b296a`): constants, phone e sla, com specs. O SQL equivalente do SLA e a regra do telefone estão documentados em comentário.
- **Task 2** (RED `a63cdd6`, GREEN `eae13db`, chore `b657045`): `commercial-access` com `visibilityWhere` (ADMIN/MANAGER veem tudo; ATTENDANT só o que é dela; PROFESSIONAL lança `FORBIDDEN`) e instalação do `exceljs`.
- 37 testes passando em `src/commercial`; `tsc --noEmit` do backend verde (após `prisma generate` no worktree).

## Auditoria do exceljs

`pnpm audit --prod` aponta 104 vulnerabilidades no monorepo (2 críticas, 58 altas), todas pré-existentes; nenhuma tem caminho que passe por `exceljs` (busca por `exceljs` nos caminhos do relatório JSON voltou vazia). Portanto não bloqueia a fase.

## Deviations from Plan

Nenhuma de lógica. Observação de ambiente: no worktree foi preciso `prisma generate` antes do typecheck (client não gerado). Adicionado um `commercial-constants.spec.ts` (não listado no plano) para cobrir as listas fixas.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits (9851b5b, 45b296a, a63cdd6, eae13db, b657045) conferidos.

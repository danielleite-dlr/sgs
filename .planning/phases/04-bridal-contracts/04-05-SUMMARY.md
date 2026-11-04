---
phase: 04-bridal-contracts
plan: 05
subsystem: api
tags: [nestjs, graphql, bridal, rls, prisma]
requires: [04-01]
provides:
  - bridal.graphql (BridalGroup, queries bridalGroups/bridalGroup, 6 mutations)
  - BridalService/BridalResolver/BridalModule (exporta BridalService)
  - BridalError/mapBridalError (delega a mapSchedulingError), resolvePersonClientTx, serializeBridalGroup/BRIDAL_GROUP_INCLUDE
affects: [04-06, 04-08, 04-12]
tech-stack:
  patterns: ["escrita em runWithTenant com erros de domínio como payload { group, errors }"]
key-files:
  created:
    - apps/backend/src/graphql/schema/bridal.graphql
    - apps/backend/src/bridal/bridal.service.ts
    - apps/backend/src/bridal/bridal.resolver.ts
    - apps/backend/src/bridal/bridal-errors.ts
    - apps/backend/src/bridal/bridal-clients.ts
    - apps/backend/src/bridal/bridal-serialize.ts
    - apps/backend/test/integration/phase4-bridal-group.e2e.spec.ts
  modified:
    - apps/backend/src/bridal/bridal.module.ts
    - .planning/ROADMAP.md
key-decisions:
  - "Finalidade do serviço planejado usa 'event' | 'trial' (check chk_bms_purpose do banco), não 'test'"
  - "Violação do índice parcial uq_bgm_one_bride chega do Prisma como P2002 com target (group_id); mapeada para BRIDE_ALREADY_SET"
  - "Duplicidade de cliente é pré-verificada no service (MEMBER_ALREADY_IN_GROUP) além do mapeamento do P2002"
requirements-completed: []
duration: ~40min
completed: 2026-11-04
---

# Phase 4 Plan 05: CRUD de grupos de noivas Summary

Grupos de noivas via GraphQL: um mutation cria evento + noiva + até 14 acompanhantes (cliente existente ou mínima), com serviços planejados, cobertura pelo contrato (noiva true, acompanhante false por padrão), travas de D-25 e isolamento por RLS/RBAC.

## Tasks

1. SDL, erros, cliente mínima e serialização — 06a001d
2. BridalService, resolver e módulo — afd73a8
3. Suíte `phase4-bridal-group` (8 testes) e ajustes — 40c09e0

## Verificação

Backend lint, tsc, jest unit (188) e integração `phase4` (4 suítes, 19 testes) verdes.

## Notas para os próximos planos

- `updateBridalGroup` com `eventDate` alterado e contrato vivo só atualiza o grupo; o 04-06 deve recalcular o prazo do saldo ao editar o contrato.
- `purpose` válido: `event` e `trial`.
- `bridalGroups(from, to)` filtra por `event_date` inclusivo nas duas pontas, limite 200.
- `mapBridalError` já delega a `mapSchedulingError` para o 04-08.

## Deviations from Plan

**1. [Rule 1 - Bug] Finalidade 'test' viola o banco** — o plano dizia `evento ou teste`, mas o CHECK é `('event','trial')`. Usado `trial`. Commit 40c09e0.

**2. [Rule 1 - Bug] Mapeamento do índice parcial da noiva** — o Prisma não informa o nome do índice; mapeado pelo target `(group_id)`. Commit 40c09e0.

**3. Escopo de docs** — STATE.md não foi alterado neste worktree (execução paralela com 04-06/04-07, evita conflito de merge); só o checkbox de 04-05 no ROADMAP.md. O orquestrador consolida STATE. REQUIREMENTS.md não foi tocado (CLI-03 é marcado após a verificação da fase).

## Known Stubs

Nenhum.

## Self-Check: PASSED

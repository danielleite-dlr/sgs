---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 02
subsystem: identity
tags: [prisma, graphql, members, prioridade, noiva]
requires: []
provides:
  - "members.is_fixed e members.serves_bridal (NOT NULL DEFAULT false)"
  - "bridal_groups.companions_ready_by (TIMESTAMPTZ NULL)"
  - "Member.isFixed / Member.servesBridal na API (members, allMembers, professionalsForService)"
  - "professionalsForService(serviceId, bridal) com filtro rígido e fixas primeiro"
  - "helpers markServesBridal / markFixed e createPhase4World({ bridalPros })"
affects: [11-03, 11-04, 11-05]
tech-stack:
  added: []
  patterns: ["marcação booleana no Member copiando isBridalAssistant (09.1)"]
key-files:
  created:
    - apps/backend/prisma/migrations/20261126000000_phase11_priority_flags/migration.sql
    - apps/backend/test/integration/phase11-members-flags.e2e.spec.ts
    - apps/backend/test/integration/helpers/phase11-fixtures.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/identity/dto/member.input.ts
    - apps/backend/src/graphql/schema/identity.graphql
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/identity/members.resolver.ts
    - apps/backend/test/integration/helpers/phase4-fixtures.ts
key-decisions:
  - "Migração só com ADD COLUMN, sem UPDATE/INSERT (D-03): todas as profissionais começam desmarcadas"
  - "companions_ready_by é coluna nova; ready_by segue sendo a saída da noiva"
  - "Fixas primeiro só em listProfessionalsForService; listActive/listAll mantêm a ordem por nome (D-20)"
  - "Sem guarda de vínculos ao desmarcar: as marcações só mudam ordem/filtro"
requirements-completed: [PRIO-01, PRIO-16]
duration: 45min
completed: 2026-11-26
---

# Phase 11 Plan 02: marcações da profissional e filtro bridal Summary

Marcações "Fixa (equipe do studio)" e "Atende noiva/debutante" ponta a ponta no backend (migração, Prisma, DTO, SDL, serviço, resolver), mais a coluna "acompanhantes prontas até" e o filtro `bridal` com ordem "fixas primeiro" em `professionalsForService`.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | Migração, Prisma, DTO, SDL e serviço das marcações | 7daae3c |
| 2 | Resolver com filtro bridal, fixtures e integração | 1850274 |

## Comportamento entregue

- `createMember`/`updateMember` aceitam `isFixed` e `servesBridal`. Para quem não é profissional ficam `false`; marcar `true` devolve `PRIORITY_FLAG_REQUIRES_PROFESSIONAL` (campo da marcação). Deixar de ser profissional zera as duas.
- `professionalsForService(serviceId, bridal: true)` devolve só quem atende noiva/debutante; sem ninguém marcada devolve `[]` (D-04).
- Ordem `isFixed desc, displayName asc, id asc` apenas em `professionalsForService`.
- Fixtures: `createPhase4World` marca proA e proB com `servesBridal` por padrão (`bridalPros: false` desliga); `markServesBridal`/`markFixed` em `helpers/phase11-fixtures.ts`.

## Testes

- `phase11-members-flags.e2e.spec.ts`: 10 testes (padrão desmarcado, lista vazia, marcar/refletir, erro para não profissional na edição e na criação, filtro bridal, ordem fixas primeiro, ordem da grade inalterada, zerar ao deixar de ser profissional, RLS entre organizações, PROFESSIONAL negado).
- `phase91-members-assistant` e `src/identity` + `src/authz` (170 testes unitários): verdes.
- Suíte de integração completa: ver seção "Suíte completa" abaixo.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Ambiente do worktree**
- O worktree não tinha `node_modules` nem `.env`: usei links simbólicos para os do checkout principal e copiei o `.env` (nenhum dos dois é versionado nem commitado). A migração foi aplicada só no Postgres local de desenvolvimento (porta 5434); o staging não foi tocado.

**2. [Rule 1 - Estilo] Prettier sem configuração no repo**
- O prettier sem config reformatou arquivos inteiros na tarefa 1; o ruído foi revertido na tarefa 2 (formatação com `--single-quote`, igual ao código existente), então o diff final dos arquivos de serviço/DTO só contém as mudanças da fase.

Fora isso, plano executado como escrito. `pnpm -r typecheck` foi substituído por `tsc --noEmit` no backend (nenhuma mudança de frontend neste plano).

## Known Stubs

Nenhum.

## Suíte completa

Os 100 arquivos da integração passaram, 0 falhas: 85 na primeira execução em `--runInBand` (que terminou sem memória no heap do Node, sem nenhuma falha antes disso) e os 15 restantes, mais `phase11-members-flags`, rodados em seguida com `NODE_OPTIONS=--max-old-space-size=4096` (59 testes). A falta de memória ao rodar tudo numa execução só já existia antes deste plano e não tem relação com ele.

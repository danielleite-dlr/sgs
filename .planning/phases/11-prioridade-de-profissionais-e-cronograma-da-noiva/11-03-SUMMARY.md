---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 03
subsystem: scheduling
tags: [ranking, graphql, members, revezamento, minutos-do-dia]
requires: ["11-01", "11-02"]
provides:
  - "loadRankingDataTx / loadBusyInIntervalTx (scheduling/professional-ranking-data)"
  - "suggestProfessionalsTx (scheduling/professional-suggestion)"
  - "query suggestProfessionals(serviceId, startsAt, endsAt, bridal, ignoreAppointmentIds)"
affects: [11-07, 11-08, 11-11]
tech-stack:
  added: []
  patterns: ["revezamento derivado de max(created_at) dos agendamentos (nada gravado ao consultar)"]
key-files:
  created:
    - apps/backend/src/scheduling/professional-ranking-data.ts
    - apps/backend/src/scheduling/professional-suggestion.ts
    - apps/backend/test/integration/phase11-ranking-data.e2e.spec.ts
    - apps/backend/test/integration/phase11-suggest-professionals.e2e.spec.ts
  modified:
    - apps/backend/src/identity/members.service.ts
    - apps/backend/src/identity/members.resolver.ts
    - apps/backend/src/graphql/schema/identity.graphql
    - apps/backend/src/authz/access/access-inventory.spec.ts
key-decisions:
  - "Dia local = [00:00, +1 dia) no fuso do salão, calculado no banco (date + 1 AT TIME ZONE), seguro com horário de verão"
  - "Livres antes de ocupadas, depois compareCandidates; suggested só na primeira livre"
  - "professionalsForServiceTx extraído como helper privado, usado por listProfessionalsForService e suggestProfessionals"
requirements-completed: [PRIO-05, PRIO-10]
duration: 40min
completed: 2026-11-26
---

# Phase 11 Plan 03: dados do ranking e sugestão de profissional Summary

Loaders do ranking (minutos do dia por agregação única, último agendamento em 90 dias, ocupadas por agendamento ou bloqueio) e a query `suggestProfessionals`, que ordena livres primeiro e depois pelo ranking da 11-01, marcando só a primeira livre como sugerida.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | Loaders do ranking + spec (12 testes) | 2df2e7a |
| 2 | Query suggestProfessionals + spec (12 testes) | 312fe7e |

## Testes

- `phase11-ranking-data` (12), `phase11-suggest-professionals` (12), `phase11-members-flags` (11): 35 verdes.
- Unit de `src/authz`, `src/identity`, `src/scheduling` (187) incluindo o inventário de acesso: verdes. `phase91-members` e `phase3-professionals`: verdes.
- `tsc --noEmit` e eslint do backend limpos. Gate completo da suíte não foi rodado (execução paralela; só specs relevantes).

## Deviations from Plan

**1. [Rule 1 - Bug no plano] Tipos de bloqueio nos testes**
- A constraint `chk_time_blocks_kind` só aceita `folga/intervalo/feriado/indisponibilidade/deslocamento`, e `chk_time_blocks_scope` exige `professional_id NULL` somente para `feriado`. O spec usa `folga` (próprio), `feriado` (salão todo) e `deslocamento` (grupo).

**2. [Ambiente]** worktree com symlinks de `node_modules` e cópia do `.env` (não versionados).

Fora isso, plano executado como escrito. `pnpm -r typecheck` substituído por `tsc --noEmit` no backend (sem mudança de frontend).

## Known Stubs

Nenhum.

## Self-Check: PASSED

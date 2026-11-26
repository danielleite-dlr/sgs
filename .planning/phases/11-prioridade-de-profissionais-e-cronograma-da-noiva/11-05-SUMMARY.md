---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 05
subsystem: bridal
tags: [bridal, servidor, filtro, noiva, debutante]
requires: ["11-02"]
provides:
  - "createBridalScheduleTx recusa profissional sem servesBridal para itens da noiva/debutante (PROFESSIONAL_NOT_BRIDAL)"
affects: [11-07, 11-08]
key-files:
  created:
    - apps/backend/test/integration/phase11-bridal-filter.e2e.spec.ts
  modified:
    - apps/backend/src/bridal/bridal-schedule.ts
key-decisions:
  - "Checagem única em createBridalScheduleTx cobre editor manual, prova e confirmação da sugestão por IA"
requirements-completed: [PRIO-09, PRIO-15]
duration: 25min
completed: 2026-11-26
---

# Phase 11 Plan 05: filtro "atende noiva/debutante" no servidor Summary

`createBridalScheduleTx` agora recusa, antes de qualquer escrita, serviço da noiva/debutante (`role='bride'`, evento ou prova) com profissional sem "Atende noiva/debutante", devolvendo `PROFESSIONAL_NOT_BRIDAL` com o nome da profissional. Acompanhantes seguem sem filtro (D-02).

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | Recusar profissional sem marcação nos itens da noiva | 1b5d0d5 |
| 2 | Integração do filtro (6 testes) | 6670c56 |

## Testes

- `phase11-bridal-filter.e2e.spec.ts`: 6 testes (noiva recusada/aceita, acompanhante livre, prova, debutante, confirmação por IA).
- Unit `src/bridal`: 96 testes verdes; `tsc --noEmit` do backend limpo.
- Regressão de integração nos specs que tocam noiva (phase4-bridal-*, phase4-ai, phase4-travel, phase42-*, push-hooks, quick-*, phase10-bridal, hard-delete-member, comanda/contract-cancel): 124 testes verdes, 0 falhas. Nenhum spec antigo precisou de ajuste de fixture (o `createPhase4World` já marca proA/proB).

## Deviations from Plan

- A suíte de integração completa não foi rodada de uma vez (estoura o heap, já conhecido); rodei os specs que tocam noiva, e os demais não usam agendamento de noiva. Os agentes paralelos compartilham o Postgres local.
- No teste de confirmação por IA foi preciso criar um `bridalMemberService` planejado, senão o confirm retorna `NO_PLANNED_SERVICES` antes do filtro.
- `pnpm -r typecheck` substituído por `tsc --noEmit` no backend (plano só toca o backend).

## Known Stubs

Nenhum.

## Self-Check: PASSED

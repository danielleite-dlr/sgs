---
phase: 04-bridal-contracts
plan: 03
subsystem: bridal-ai
tags: [ai, scheduling, tdd, zod, heuristic]
requires: []
provides:
  - ScheduleContext / ProposalSchema (contrato para 04-12 e 04-13)
  - validateProposal / ViolationCode
  - buildHeuristicProposal (fallback sem rede)
affects: [04-12, 04-13]
tech-stack:
  added: []
  patterns: [funções puras testadas por tabela, intervalos semiabertos [start,end), grade de 5 min]
key-files:
  created:
    - apps/backend/src/bridal/ai/ai-schedule.schema.ts
    - apps/backend/src/bridal/ai/schedule-validator.ts
    - apps/backend/src/bridal/ai/schedule-validator.spec.ts
    - apps/backend/src/bridal/ai/heuristic-scheduler.ts
    - apps/backend/src/bridal/ai/heuristic-scheduler.spec.ts
  modified: []
key-decisions:
  - "Schema enviado ao Claude permanece simples (strings, sem min/max); regras fortes só no validador"
  - "Aviso BRIDE_NOT_LAST não bloqueia (ok continua true)"
  - "Heurística aplica o acolchoado de deslocamento a cada item (mais estrito que o validador, que checa só primeiro/último)"
requirements-completed: [AI-01]
duration: ~25 min
completed: 2026-11-03
---

# Phase 04 Plan 03: Núcleo da agenda por IA (validador + heurística) Summary

Validador puro de propostas de agenda (14 códigos de violação + aviso BRIDE_NOT_LAST) e heurística determinística de fallback que gera, sem rede, uma agenda válida para noiva + acompanhantes terminando em "pronta até".

## Tarefas

| Tarefa | Commits |
|--------|---------|
| 1. Schema Zod + validateProposal | b71bf44 (RED), 5b69d8c (GREEN) |
| 2. buildHeuristicProposal | b430d8c |

## Verificação
Lint, typecheck e suíte completa do backend verdes (16 suites, 134 testes). `grep Math.random|Date.now` na heurística: nada.

## Deviations from Plan

**1. [Processo] RED da Tarefa 1 com stub** — o commit RED inclui `validateProposal` como stub (`throw`) para manter lint/tsc verdes, conforme a regra de commits sem erros. Testes falharam (19/20) antes do GREEN.

**2. [Processo] Tarefa 2 sem commit RED separado** — spec e implementação da heurística foram escritos juntos e commitados num único `feat`; os testes (7) passaram na primeira execução.

**3. [Rule 3 - Ambiente]** worktree sem `node_modules`: criados symlinks locais (não commitados) para o `node_modules` do repositório principal. Prettier rodado com `--single-quote --trailing-comma all --print-width 100` para casar com o estilo existente (sem arquivo de config no repo).

## Known Stubs
Nenhum.

## Self-Check: PASSED
Arquivos e commits b71bf44, 5b69d8c, b430d8c existem.

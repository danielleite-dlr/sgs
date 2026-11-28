---
phase: 12-ajustar-cadastro-de-agendamento
plan: 02
subsystem: frontend-ui
tags: [date-field, calendario, popover, pt-BR]
requires: []
provides:
  - "DateField (components/ui/date-field.tsx)"
  - "lib/date-br.ts e lib/month-grid.ts"
affects: [12-04]
tech-stack:
  added: []
  patterns: ["grade de mês própria com datas locais (sem toISOString)"]
key-files:
  created:
    - apps/frontend/src/lib/date-br.ts
    - apps/frontend/src/lib/month-grid.ts
    - apps/frontend/src/lib/__tests__/month-grid.test.ts
    - apps/frontend/src/components/ui/date-field.tsx
    - apps/frontend/src/components/ui/__tests__/date-field.test.tsx
  modified:
    - apps/frontend/src/features/operations/lib/input-masks.ts
key-decisions:
  - "Grade de mês própria, sem react-day-picker (D-09)"
  - "Máscaras de data movidas para lib/date-br, com re-export em input-masks"
requirements-completed: [D-08, D-09]
duration: 10min
completed: 2026-11-27
---

# Fase 12 Plano 02: DateField com calendário Summary

Componente reutilizável `DateField`: campo com máscara dd/mm/aaaa mais botão de calendário que abre um Popover com grade de mês em pt-BR (domingo primeiro), sem dependência nova.

## Tarefas

1. Task 1 (4ed75dc): `lib/date-br.ts` (máscaras movidas, re-exportadas por `input-masks.ts`) e `lib/month-grid.ts` (42 células, datas locais) com 6 testes.
2. Task 2 (8e85a42): `components/ui/date-field.tsx` com 5 testes de componente (máscara, abertura, seleção que fecha, navegação de mês, mês de hoje com `aria-current`).

## Verificação

vitest (month-grid, input-masks, date-field), `tsc --noEmit` e eslint `--max-warnings 0` nos arquivos novos passam. Sem `type="date"`, sem imports de `@/features/`, sem mudança no package.json.

## Desvios do plano

Nenhum. O plano foi executado como escrito. Instalei as dependências do worktree (pnpm install), sem alterar lockfile.

## Known Stubs

Nenhum. O componente ainda não está ligado ao `VisitFormDialog` (isso é do plano 12-04).

## Self-Check: PASSED

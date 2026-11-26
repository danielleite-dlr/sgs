---
phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva
plan: 15
subsystem: entrega
tags: [gate, deploy, staging, ci]
requires: ["11-14"]
provides: ["prioridade de profissionais e cronograma da noiva no staging"]
key-files:
  modified:
    - .planning/phases/11-prioridade-de-profissionais-e-cronograma-da-noiva/11-VALIDATION.md
requirements-completed: [PRIO-01, PRIO-02, PRIO-03, PRIO-04, PRIO-05, PRIO-06, PRIO-07, PRIO-08, PRIO-09, PRIO-10, PRIO-11, PRIO-12, PRIO-13, PRIO-14, PRIO-15, PRIO-16]
completed: 2026-11-26
---

# Fase 11 Plano 15: gate, deploy no staging e CI

Fase 11 publicada no staging com backup prévio, migração aplicada, nenhuma profissional marcada pela subida e CI verde.

## Gate local (HEAD 647167c em código; nada mudou em apps/, packages/ ou infra/ desde então)

| Etapa | Resultado |
|-------|-----------|
| install / typecheck / lint | ok |
| backend unit | 72 suítes, 867 testes ok |
| integração (`--runInBand`, heap 6 GB) | 104 suítes, 1026 testes ok |
| vitest frontend | 169 arquivos, 1193 testes ok |
| shared | 2 arquivos, 26 testes ok |
| codegen | ok, contra `apps/backend/src/graphql/schema/**/*.graphql` (backend não precisou subir); saída removida depois |
| E2E Playwright | 82/82 do 11-14 (13,9 min) reaproveitado: `git diff 647167c HEAD -- apps packages infra` vazio |

Verificações estáticas: as 5 passaram (migração sem UPDATE/INSERT; ranking sem Date.now/Math.random/@prisma/client; `checkPriority` só na definição; `sortFixedFirst` fora de SchedulePage/DayGrid/WeekGrid; `tailwind.config` só lido como texto nos testes).

## Staging

- Backup: `/root/sgs-backups/stg-pre-prioridade-20261126-0316.sql.gz` (324.743 bytes, `gunzip -t` ok), antes do deploy.
- Push `525c3af..8d38eb6`; árvore limpa, deploy direto de `/root/sgs`, "Deploy concluído"; nenhum worktree criado.
- `_prisma_migrations`: `20261126000000_phase11_priority_flags|t` (finalizada).
- `count(*) filter (is_fixed), filter (serves_bridal)` em `members`: `0|0` (D-03).
- `bridal_groups` com `companions_ready_by` preenchido: `0`.
- `/login` -> 200; log do backend sem erro de schema.

## CI

Run `CI` 45767109668 do commit 8d38eb6: `completed success`.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Primeiro deploy falhou no build do frontend**
- **Causa:** o codegen local do gate gerou `apps/frontend/src/gql/` (não rastreado) na árvore de trabalho; o Docker o incluiu e o `tsc` não achou `@graphql-typed-document-node/core`.
- **Correção:** removido `src/gql/` e repetido o deploy; staging nada sofreu na primeira tentativa (falhou antes de subir).
- **Arquivos:** nenhum versionado.

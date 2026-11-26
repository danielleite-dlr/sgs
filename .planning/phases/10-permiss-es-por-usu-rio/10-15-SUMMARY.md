---
phase: 10-permiss-es-por-usu-rio
plan: 15
subsystem: entrega
tags: [gate, deploy, staging, ci]
requires: ["10-14"]
provides: ["permissões por pessoa no staging"]
key-files:
  modified:
    - .planning/phases/10-permiss-es-por-usu-rio/10-VALIDATION.md
completed: 2026-11-26
---

# Fase 10 Plano 15: gate, deploy no staging e CI

Permissões por pessoa publicadas no staging com backup prévio, migração conferida e CI verde.

## Gate local (HEAD 516530f, sem mudança de código depois)

| Etapa | Resultado |
|-------|-----------|
| install / typecheck / lint | ok |
| backend unit | 71 suítes, 827 testes ok |
| integração (`--runInBand`, heap 6 GB) | 99 suítes, 960 testes ok |
| vitest frontend | 165 arquivos ok |
| shared | 2 arquivos ok |
| E2E Playwright | 76/76 ok (16,2 min) |
| codegen contra `apps/backend/src/graphql/schema/**/*.graphql` | ok |

A primeira rodada da integração estourou o heap do Jest (limite conhecido); refeita com `NODE_OPTIONS=--max-old-space-size=6144`, toda verde.

Verificações estáticas: as 5 passaram. A de `tailwind.config` só encontra os testes que leem o arquivo como texto (`readFileSync`), padrão permitido — nenhum import.

## Staging

- Backup: `/root/sgs-backups/stg-pre-permissoes-20261125-2359.sql.gz` (321 KB), antes do deploy.
- Árvore limpa → `./scripts/deploy-staging.sh` direto de `/root/sgs`; "✓ Deploy concluído"; nenhum worktree criado.
- `_prisma_migrations`: `20261125000000_member_access_overrides` com `finished_at`.
- `pg_class` de `member_access_overrides`: `t|t` (RLS ligada e forçada).
- `count(*)`: `0`.
- `/login` → 200; log do backend sem erro de schema nem de guard.
- `myAccess` sem token → `UNAUTHENTICATED` (campo existe no schema). Sem credencial de teste no `.env.staging`: consulta logada fica para o 10-16.

## CI

Run `CI` 45746043500 do commit 19cf6e0: `completed success`.

## Deviations from Plan

Nenhuma além da rodada extra da integração com heap maior.

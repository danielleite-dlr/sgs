---
quick_id: 261126-fgp
type: quick
files_modified:
  - apps/backend/prisma/migrations/20261126140000_refresh_token_lookup_hash/migration.sql
  - apps/backend/prisma/schema.prisma
  - apps/backend/src/auth/token.service.ts
  - apps/backend/test/integration/refresh-token-lookup.e2e.spec.ts
  - apps/frontend/src/features/auth/hooks/useAuth.ts
  - apps/frontend/src/features/auth/__tests__/useAuth-logout.test.tsx
---

# Quick 261126-fgp: Sair e renovação de sessão rápidos

Pedido (26/11): o botão Sair demora muito e às vezes só sai com F5.

Causa medida no staging: a mutation `logout` levava ~6 s mesmo com token inválido.
`TokenService.revokeRefresh` comparava o token com todos os refresh tokens vivos via Argon2
(84 ativos); `rotateRefresh` (renovação a cada 15 min / ao abrir o app) fazia o mesmo sobre
todos os não vencidos, inclusive revogados (591). No front, o logout esperava em série
unregister do push + unsubscribe + logout, sem teto de tempo.

## Tarefa 1 — busca indexada (backend + migração)
- Coluna `refresh_tokens.lookup_hash VARCHAR(64)` com índice único; token novo grava sha256 hex.
- `findRefresh`: índice + uma conferência Argon2; tokens antigos (NULL) pela busca antiga restrita a
  eles (vivos primeiro). Reuso continua detectado (revogados entram na rotação).
- verify: `refresh-token-lookup.e2e.spec.ts` + `auth.e2e-spec`/`full-auth-flow` existentes.

## Tarefa 2 — teto no logout do front
- `useAuth.logout`: mesma ordem (D-06 da fase 8: token do aparelho antes do logout), mas limitado a
  `LOGOUT_CLEANUP_TIMEOUT_MS` (3 s); passado o teto, encerra a sessão local e vai para o login.
- verify: teste com mutation que nunca responde (fake timers).

## Entrega
Backup do staging antes (migração), deploy, medir o logout de novo, CI.

---
quick_id: 261126-fgp
status: complete
commits: [3776e4b, 4df5fdf]
---

# Quick 261126-fgp: Sair e renovação de sessão rápidos — resumo

- Backend: `refresh_tokens.lookup_hash` (sha256 hex, índice único `ux_refresh_tokens_lookup_hash`);
  `findRefresh` acha pelo índice e confere uma vez com Argon2. Tokens antigos (NULL) seguem pela
  busca antiga, restrita a eles, até vencer (30 dias) ou renovar. Reuso continua detectado.
- Front: `useAuth.logout` com teto de 3 s (`LOGOUT_CLEANUP_TIMEOUT_MS`) mantendo a ordem do D-06.
- Gate: backend tsc/eslint limpos, jest unit 867/867, integração 105 suítes / 1031 testes;
  front vitest 169/1196; E2E 82/82.
- Staging (26/11): backup `/root/sgs-backups/stg-pre-refresh-lookup-20261126-2011.sql.gz`,
  migração aplicada. Logout antes: 4,3–5,0 s (token inválido, 3 medições). Depois, teste da usuária
  às 20:42: logout com token novo 72 ms e 58 ms; token antigo 201 ms. Busca por índice 0,15 ms.
- CI do GitHub (run 45912453382): 7/7 jobs verdes.

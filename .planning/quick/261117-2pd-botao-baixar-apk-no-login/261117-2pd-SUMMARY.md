---
phase: quick-261117-2pd
plan: 01
subsystem: frontend-auth, infra-staging, mobile
tags: [android, apk, login, nginx, deploy]
requires: [android.yml job release (artifact gestor-beauty-release)]
provides:
  - botão "Baixar app Android" na LoginPage (só web)
  - scripts/publish-apk.sh
  - rota nginx /download/gestor-beauty.apk
affects: [scripts/deploy-staging.sh, infra/nginx/sgs-staging.conf]
tech-stack:
  added: []
  patterns: [publicação atômica com install para .tmp.$$ + mv -f, download em .part.$$ + mv]
key-files:
  created:
    - apps/frontend/src/features/auth/pages/__tests__/login-baixar-apk.test.tsx
    - scripts/publish-apk.sh
  modified:
    - apps/frontend/src/features/auth/pages/LoginPage.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - scripts/deploy-staging.sh
    - infra/nginx/sgs-staging.conf
    - apps/mobile/KEYSTORE.md
decisions:
  - "APK servido pelo nginx do host na mesma origem (/download/gestor-beauty.apk), antes do proxy para o container"
  - "Publicação do APK no deploy é não fatal; SKIP_APK=1 pula"
metrics:
  duration: ~20min
  completed: 2026-11-17
---

# Quick 261117-2pd: botão "Baixar app Android" no login Summary

Link "Baixar app Android" na tela de login (escondido no app Capacitor) apontando para
`/download/gestor-beauty.apk`, servido pelo nginx do host. O arquivo é publicado por
`scripts/publish-apk.sh`, que pega o último release assinado do GitHub (ou um `--file` local) de forma
atômica e idempotente. O `deploy-staging.sh` chama o script no fim.

## Tarefas

| # | Tarefa | Commit |
|---|--------|--------|
| 1 | Botão na LoginPage + testes (TDD) | 181bf76 |
| 2 | publish-apk.sh, gancho no deploy, rota nginx | 3017dc2 |
| 3 | Seção "Publicar o APK no staging" no KEYSTORE.md | 3278d1e |

## Verificação

- RED: `login-baixar-apk.test.tsx` falhou no teste da web antes da implementação (o do nativo já passava).
- Frontend (`apps/frontend`): `npx vitest run src/features/auth/pages/__tests__/` deu 9/9; `npm run lint` e
  `npm run typecheck` limpos; `npx vitest run` completo deu 120 arquivos e 862 testes passando.
- PWA/Workbox: `grep -rn -i "workbox\|vite-plugin-pwa\|serviceWorker" apps/frontend/package.json apps/frontend/src`
  vazio. Não há service worker, então não foi preciso mexer em denylist.
- Infra: `bash -n` nos dois scripts ok; `nginx -t` ok (o site aponta para o conf do working tree por symlink;
  nginx não foi recarregado). Nenhuma rota `/apk-<token>` no conf nem no diff.
- publish-apk.sh com destino no scratchpad (`GB_APK_DEST`/`GB_APK_STORE`):
  - `--file` publicou (sha256 a192608f…1901) sem sobrar `.tmp.*`; a segunda vez imprimiu "já publicado";
    um APK diferente substituiu o arquivo.
  - Modo GitHub: achou o run 44010411126 (versionCode 1003, master, 2026-11-17T03:31:40Z), baixou em
    `release-20261117-run44010411126`; a segunda execução imprimiu "run ... já baixado" e não baixou de novo.
    O APK do GitHub tem o mesmo sha256 do que já está publicado em `/var/www/gb-apk`.
  - `--xyz` sai com 2; arquivo inexistente ou menor que 1 MB sai com 1.
  - `/var/www/gb-apk/gestor-beauty.apk` não foi tocado.

## Deviations from Plan

Nenhuma. O conf do nginx já estava igual ao HEAD (sem o bloco temporário), então não havia bloco para remover.
Os testes do script usaram o scratchpad da sessão em vez de `/tmp/claude-0/pubapk`.

## Pendente (orquestrador)

`nginx -t && systemctl reload nginx`, deploy, e conferir com curl que `/download/gestor-beauty.apk` responde 200
com `application/vnd.android.package-archive`, `attachment` e `no-cache`.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos criados existem; commits 181bf76, 3017dc2 e 3278d1e estão no log.

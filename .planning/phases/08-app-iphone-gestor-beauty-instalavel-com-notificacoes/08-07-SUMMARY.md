---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 07
subsystem: gate-deploy
tags: [web-push, vapid, staging, deploy, ci]
requires: [08-04, 08-06]
provides:
  - Gate completo verde e staging com Web Push ligado (VAPID)
affects: [08-08]
key-files:
  modified:
    - .planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-VALIDATION.md
decisions:
  - "Chaves VAPID geradas uma vez no .env.staging (ignorado pelo git); subject https://sgs.jessicaseixasmakeup.com.br"
metrics:
  tasks: 2
  completed: 2026-11-18
requirements: [D-02, D-08, D-09, D-10, D-11]
---

# Fase 8 Plano 07: Gate, VAPID e deploy no staging Summary

Gate completo verde, chaves VAPID no `.env.staging`, backup do banco, deploy no staging com a migration `device_tokens_webpush` e conferências de headers e logs aprovadas.

## Gate

- typecheck e lint: ok em todos os pacotes
- jest unit backend: 52 suítes, 566 testes
- integração (Postgres local): 69 suítes, 733 testes
- vitest frontend: 135 arquivos, 973 testes
- shared: 23 testes; mobile `check-config`: 47 verificações
- E2E Playwright: 57 de 57 (segunda rodada, ver desvios)
- Estáticas: `web-push` 3.6.7 fixo, sem chave privada versionada, `sw.js` sem handler de `fetch`, sem workbox/vite-plugin-pwa, sem `@capacitor/push-notifications` fora de `infrastructure/native`
- Imagens backend/frontend construídas; `check-pwa-headers.sh` ok na imagem local

## Staging

- `.env.staging`: 3 variáveis VAPID preenchidas; cópia anterior em `/root/sgs-backups/env.staging.pre-vapid-*`
- Backup do Postgres antes do deploy: `/root/sgs-backups/stg-pre-iphone-webpush-20261118-0125.sql.gz` (270 KB)
- Deploy de `/root/sgs` (árvore sem mudanças rastreadas): "Deploy concluído"
- Colunas `p256dh`/`auth` presentes (2); `relforcerowsecurity` = `t`; migration aplicada
- Logs do backend: "Web Push habilitado" e "Push FCM habilitado"; nenhum vazamento da chave privada
- `pushConfig` sem token: `UNAUTHENTICATED` (401), sem 500
- `VAPID_PUBLIC_KEY` do contêiner idêntica à do `.env.staging` (87 caracteres)
- `check-pwa-headers.sh` contra o staging: ok; `/login` devolve 200

## Deviations from Plan

1. **E2E primeira rodada com 6 falhas (ambiental, não regressão do 08-06).** Os traces mostraram `ERR_NETWORK_CHANGED` em recursos do Vite (inclusive módulos sem relação com a fase) e nenhum `pageerror`. A causa foi o `docker compose build` e o `docker run` da verificação de headers, rodando em paralelo ao E2E (mudança de interfaces de rede e CPU). Repetido sem nada concorrente, passou 57/57. Lição: não mexer em Docker durante o E2E.
2. **Verificação de `pushConfig.webPushPublicKey` com usuária logada não feita contra o staging**: não há credencial de teste disponível ao executor e não se deve usar senha do Studio JS. Substituída por: erro de autenticação sem token, chave do contêiner igual à do `.env.staging`, e o teste de integração `push-config` verde.
3. Integração e migration já estavam aplicadas no `sgs_dev` local (nenhum passo extra).

## Known Stubs

Nenhum.

## Self-Check: PASSED

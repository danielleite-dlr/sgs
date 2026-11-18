---
phase: 08-app-iphone-gestor-beauty-instalavel-com-notificacoes
plan: 03
subsystem: frontend-pwa
tags: [pwa, manifest, service-worker, nginx, ios]
requires: []
provides:
  - manifest.webmanifest do Gestor Beauty e ícones GB roxo
  - sw.js de push sem cache
  - nginx sem cache para /sw.js e /manifest.webmanifest
  - scripts/check-pwa-headers.sh
affects: [08-07]
tech-stack:
  added: []
  patterns: [teste de paridade de regex entre sw.js, push-route.ts e shared]
key-files:
  created:
    - scripts/generate-pwa-icons.mjs
    - scripts/check-pwa-headers.sh
    - apps/frontend/public/manifest.webmanifest
    - apps/frontend/public/sw.js
    - apps/frontend/public/icons/ (4 PNG)
    - apps/frontend/src/__tests__/pwa-manifest.test.ts
    - apps/frontend/src/__tests__/service-worker.test.ts
    - apps/e2e/tests/pwa-instalavel.spec.ts
  modified:
    - apps/frontend/index.html
    - apps/frontend/nginx.conf
decisions:
  - "sw.js sem fetch/caches/importScripts (D-03); tag grupo-<groupId> quando não há appointmentId"
metrics:
  tasks: 3
  completed: 2026-11-17
---

# Phase 8 Plan 03: manifest, service worker e nginx Summary

App instalável no iPhone: manifest "Gestor Beauty" standalone com ícones GB roxo, metas do iOS no index.html, service worker só de push/clique (sempre notifica, só abre rotas da agenda) e nginx servindo sw.js/manifest com no-cache.

## Commits
- 08351b5: manifest e ícones do Gestor Beauty para o iPhone
- efcd47d: service worker de push sem cache
- ffc9433: nginx sem cache para sw.js e manifest (inclui script de headers e spec E2E)

## Verificação
- vitest `pwa-manifest` (5), `service-worker` (15), `sem-cor-antiga` (8): verdes
- `tsc --noEmit` e `eslint` do frontend: limpos; tsc do e2e: limpo
- Imagem `production` do frontend buildada localmente e testada em container descartável (porta 18099, removido depois): `check-pwa-headers.sh` imprimiu "Headers do app instalável OK"
- `grep -c 'X-Content-Type-Options "nosniff" always' nginx.conf` = 6

## Pendente para o orquestrador
- Spec E2E `apps/e2e/tests/pwa-instalavel.spec.ts` escrita, NÃO executada: o projeto `setup` do Playwright sobe backend e seed (banco compartilhado). Rodar `corepack pnpm --filter @sgs/e2e test:e2e --grep "app instalável"` onde o stack estiver disponível.
- `check-pwa-headers.sh` contra o staging fica para o 08-07.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Caminho do sharp**
- Plano apontava `sharp/lib/index.js`; no sharp 0.35.5 só existe `lib/index.d.ts`, o código está em `dist/index.cjs`. `scripts/generate-pwa-icons.mjs` usa `dist/index.cjs`.

**2. [Rule 3] Tipagem dos testes**
- `service-worker.test.ts` tipa o mock de `showNotification` com parâmetros para passar no `tsc` do projeto.

## Known Stubs
Nenhum.

## Self-Check: PASSED
Arquivos e commits 08351b5, efcd47d, ffc9433 conferidos.

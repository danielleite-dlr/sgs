---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 04
subsystem: mobile
tags: [capacitor, android, gradle, offline]
requires: [07-01]
provides:
  - casca Capacitor 8 `apps/mobile` com projeto Android commitado
  - tela local "Sem conexão" (errorPath)
  - check-config no CI (frontend-unit)
affects: [07-05, 07-06, 07-08]
tech-stack:
  added: []
  patterns: [server.url remoto com errorPath local, assinatura Gradle por variáveis de ambiente]
key-files:
  created:
    - apps/mobile/capacitor.config.ts
    - apps/mobile/tsconfig.json
    - apps/mobile/www/index.html
    - apps/mobile/www/offline.html
    - apps/mobile/scripts/check-config.mjs
    - apps/mobile/README.md
    - apps/mobile/android/** (55 arquivos versionados)
  modified:
    - apps/mobile/package.json
    - .gitignore
    - .github/workflows/ci.yml
key-decisions:
  - "Só Android (sem cap add ios); targetSdk 36, minSdk 24"
  - "Keystore apenas por env (ANDROID_KEYSTORE_PATH etc.); versionCode/versionName por -P"
  - "Canal FCM 'agenda', cor #570080 e ícone de status vetorial no manifesto"
requirements-completed: [C-01, C-02, C-05]
metrics:
  tasks: 2
  completed: 2026-11-16
---

# Phase 7 Plan 04: Casca Capacitor Android Summary

Casca `apps/mobile` do Gestor Beauty (Capacitor 8) que abre o staging por `server.url`, com fallback local "Sem conexão" e projeto Android gerado, ajustado (assinatura por env, versionCode por propriedade, canal/cor de push, fundo papel na splash) e coberto por teste de configuração no CI.

## Tarefas

1. Configuração, www e check-config — commit `468bf9e`
2. Projeto Android (cap add android) e ajustes — commit `50c1d3b`

## Verificação

- `pnpm --filter @sgs/mobile typecheck`: OK
- `pnpm --filter @sgs/mobile test`: `check-config: OK (38 verificações)`
- `cap sync android` repetido: `git diff --exit-code apps/mobile/android` limpo (idempotente)
- Nenhum `.jks`, `google-services.json` ou `local.properties` versionado; `sdkmanager`/`adb` não instalados na VPS
- Gradle não foi executado (build só no GitHub Actions, 07-06)

## Desvios do plano

- Node 22 do nvm não foi usado; rodei com Node 24.14 (atende ao requisito >= 22).
- `.npmrc` não precisou de `public-hoist-pattern`: `cap add`/`cap sync` acharam `@capacitor/android`.
- O `check-config.mjs` já nasceu com as checagens Android (Task 2); logo, entre os dois commits o teste falha só nessas verificações.
- `apps/mobile/www/index.html` e `offline.html` são os únicos ativos web; ícones/splash definitivos ficam para o 07-06.

## Known Stubs

Nenhum. O ícone de status (`ic_stat_gestor_beauty.xml`) é o definitivo desta fase; ícones do launcher/splash do template são os padrão do Capacitor até o 07-06.

## Self-Check: PASSED

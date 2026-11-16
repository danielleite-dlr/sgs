# Gestor Beauty — casca Android

Casca nativa mínima (Capacitor 8) que abre o SGS publicado em `https://sgs.jessicaseixasmakeup.com.br`.
As telas vêm do servidor, então são as mesmas do web e qualquer melhoria aparece sem nova versão do app.
Só Android nesta fase.

Este pacote não entra no Docker nem no `pnpm build` da raiz.

## Comandos

- `corepack pnpm --filter @sgs/mobile test`: confere a configuração da casca (roda no CI).
- `corepack pnpm --filter @sgs/mobile typecheck`: confere `capacitor.config.ts`.
- `corepack pnpm --filter @sgs/mobile exec cap sync android`: sincroniza o projeto Android.

## Build

O build do APK/AAB acontece só no GitHub Actions (workflow `android.yml`, plano 07-06). Não há SDK Android na VPS.

## Plugins

Plugin novo precisa da MESMA versão exata em `apps/frontend` e em `apps/mobile` (sem `^` ou `~`).

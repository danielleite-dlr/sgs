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

O build do APK/AAB acontece só no GitHub Actions (workflow [`.github/workflows/android.yml`](../../.github/workflows/android.yml)). Não há SDK Android na VPS.
Keystore, secrets e ordem das ações humanas (conta Play primeiro): veja [`KEYSTORE.md`](./KEYSTORE.md).

## Trocar o ícone

1. Os SVGs da marca vêm de `docs/marca/gestor-beauty/svg` (copiados em `assets/`: `icon.svg` = `icone-app.svg`, `simbolo-branco.svg`, `logo-vertical-*.svg`). `scripts/render-assets.mjs` gera os PNGs-fonte a partir deles.
2. Rode `corepack pnpm --filter @sgs/mobile assets` (gera os PNGs-fonte e os recursos Android).
3. Rode `corepack pnpm --filter @sgs/mobile exec cap sync android` e commite `android/app/src/main/res`.
4. O gerador não mexe em `res/values/ic_launcher_background.xml`; ele já está em `#A855F7` (roxo vivo da marca).

## Plugins

Plugin novo precisa da MESMA versão exata em `apps/frontend` e em `apps/mobile` (sem `^` ou `~`).

---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 06
subsystem: mobile
tags: [capacitor, android, icon, splash, github-actions, keystore]
requires: [07-04]
provides:
  - ícone adaptativo GB e splash a partir de assets/icon.svg
  - workflow android.yml (APK debug e release assinado)
  - runbook KEYSTORE.md
affects: [07-11, 07-12]
key-files:
  created:
    - apps/mobile/assets/icon.svg
    - apps/mobile/assets/icon-only.png
    - apps/mobile/assets/icon-foreground.png
    - apps/mobile/assets/icon-background.png
    - apps/mobile/assets/splash.png
    - apps/mobile/assets/splash-dark.png
    - apps/mobile/scripts/render-assets.mjs
    - apps/mobile/KEYSTORE.md
    - .github/workflows/android.yml
  modified:
    - apps/mobile/package.json
    - apps/mobile/scripts/check-config.mjs
    - apps/mobile/README.md
    - apps/mobile/android/app/src/main/res/**
decisions:
  - "values/ic_launcher_background.xml ajustado para #570080 (o gerador não o toca)"
requirements-completed: [C-01, C-05]
duration: ~15min
completed: 2026-11-16
---

# Phase 7 Plan 06: Ativos mobile e CI de build Summary

Ícone GB (Source Serif 4, branco sobre #570080) e splash #F7F6F3 gerados de um SVG versionado, mais workflow GitHub Actions com APK debug como artefato e release assinado por secrets.

## Tarefas

| Tarefa | Commit |
| ------ | ------ |
| 1. Ícone GB e splash, recursos Android | 941291f |
| 2. Workflow android.yml e KEYSTORE.md | 1df75bd |

## Verificação

- `corepack pnpm --filter @sgs/mobile test`: `check-config: OK (47 verificações)`.
- `cap sync android` após o commit: working tree limpa (idempotente).
- YAML validado com PyYAML (jobs `debug` e `release`); 2x `ubuntu-24.04` e 2x JDK 21.
- Nenhum `.jks` ou `google-services.json` versionado.
- Ícone conferido visualmente: "GB" branco, serifado, centralizado.
- Não foi possível rodar prettier (binário ausente no worktree); o workflow real roda só no 07-11.

## Desvios

**1. [Rule 1 - Bug] ic_launcher_background.xml ficou #FFFFFF**
O `@capacitor/assets` não regenera `values/ic_launcher_background.xml`; editado manualmente para `#570080`. O ícone adaptativo em si usa o PNG de fundo roxo.

**2. [Rule 3] Manifesto reformatado pelo gerador**
`capacitor-assets` reescreveu `AndroidManifest.xml` (só formatação); revertido com `git checkout` para não poluir o diff.

**3. Passos do job release**
No job `release`, os segredos são passados por `env` (em vez de interpolar `${{ secrets }}` dentro do shell) para evitar injeção/vazamento em logs. Também adicionei a checagem do `cap sync` idempotente no release.

Fonte Source Serif 4 baixada para `~/.local/share/fonts` (fora do repo); sem fallback necessário.

## Known Stubs

Nenhum. Campos de impressão digital em KEYSTORE.md são placeholders intencionais, preenchidos no 07-12.

## Self-Check: PASSED

---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 10
subsystem: frontend
tags: [capacitor, offline, safe-area, edge-to-edge, i18n]
requires: [07-08]
provides:
  - OfflineOverlay (tela "Sem conexão" no meio da sessão, só no app)
  - utilitários safe-top/safe-bottom e variáveis --sgs-safe-top/--sgs-safe-bottom
affects: [layout Gestor Beauty]
tech-stack:
  added: []
  patterns: ["viewport-fit=cover", "box-content + padding de área segura sobre h-14/h-16"]
key-files:
  created:
    - apps/frontend/src/infrastructure/native/OfflineOverlay.tsx
    - apps/frontend/src/infrastructure/native/__tests__/offline-overlay.test.tsx
    - apps/frontend/src/components/layout/__tests__/safe-area.test.tsx
  modified:
    - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
    - apps/frontend/index.html
    - apps/frontend/src/styles/globals.css
    - apps/frontend/src/components/layout/TopHeader.tsx
    - apps/frontend/src/components/layout/BottomNav.tsx
    - apps/frontend/src/components/layout/AppShell.tsx
key-decisions:
  - "Fundo da sobreposição usa o token bg-background em vez de bg-[#F7F6F3]"
requirements-completed: [C-02, C-05, C-01]
duration: ~25min
completed: 2026-11-16
---

# Phase 7 Plan 10: Sem conexão e área segura Summary

Sobreposição "Sem conexão" (online/offline do window, só no app, com "Tentar novamente" que recarrega) e área segura do Android (viewport-fit=cover, safe-top no cabeçalho, safe-bottom na barra inferior e no conteúdo).

## Tarefas

1. OfflineOverlay + i18n `native.offline.*` + montagem na NativeAppBridge (commit fd46a26; ajuste de cor em commit posterior).
2. viewport-fit=cover, variáveis/utilitários de área segura, TopHeader/BottomNav/AppShell (commit 6ad23ec).

## Deviations from Plan

**1. [Rule 1 - Bug] Cor #F7F6F3 proibida em src**
- **Found during:** gate (vitest completo)
- **Issue:** o plano mandava `bg-[#F7F6F3]`, mas `sem-cor-antiga.test.ts` (fase 6) proíbe essa cor em `src`.
- **Fix:** `bg-background` (token do app, neutral-50). A splash nativa continua #F7F6F3 em `apps/mobile`, então há pequena diferença de tom entre a splash e a tela offline.
- **Arquivo:** OfflineOverlay.tsx

## Verificação

- vitest frontend completo: 119 arquivos (um falhou antes do ajuste de cor; depois do ajuste os testes `sem-cor-antiga` e `offline` passam).
- typecheck, eslint (max-warnings 0) e `build` do frontend: verdes.
- NÃO executado: gate completo da wave (backend unit/integração e E2E Playwright), por ser um plano só de frontend e rodar em paralelo; fica para o orquestrador.

## Known Stubs

Nenhum.

## Self-Check: PASSED

---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 10
type: execute
wave: 4
depends_on: ["07-08"]
files_modified:
  - apps/frontend/src/infrastructure/native/OfflineOverlay.tsx
  - apps/frontend/src/infrastructure/native/__tests__/offline-overlay.test.tsx
  - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/index.html
  - apps/frontend/src/styles/globals.css
  - apps/frontend/src/components/layout/TopHeader.tsx
  - apps/frontend/src/components/layout/BottomNav.tsx
  - apps/frontend/src/components/layout/AppShell.tsx
  - apps/frontend/src/components/layout/__tests__/safe-area.test.tsx
autonomous: true
requirements: [C-02, C-05, C-01]

must_haves:
  truths:
    - "Se a internet cair no meio do uso do app, aparece a tela 'Sem conexão' com 'Tentar novamente'; ao voltar a rede ela some sozinha (D-08, Pitfall 4)"
    - "'Tentar novamente' recarrega o sistema"
    - "No navegador comum a sobreposição não aparece (só no app)"
    - "O cabeçalho e a barra inferior respeitam o entalhe/câmera e a barra de gestos do Android (edge-to-edge do targetSdk 36), sem mudar nada em telas sem entalhe"
    - "Os textos novos estão em pt-BR via i18n"
  artifacts:
    - path: "apps/frontend/src/infrastructure/native/OfflineOverlay.tsx"
      provides: "Sobreposição Sem conexão (online/offline)"
      exports: ["OfflineOverlay"]
    - path: "apps/frontend/src/styles/globals.css"
      provides: "Variáveis --sgs-safe-top/--sgs-safe-bottom e utilitários safe-top/safe-bottom"
      contains: "--sgs-safe-top"
    - path: "apps/frontend/index.html"
      provides: "viewport-fit=cover"
      contains: "viewport-fit=cover"
  key_links:
    - from: "apps/frontend/src/infrastructure/native/NativeAppBridge.tsx"
      to: "OfflineOverlay"
      via: "renderizado quando isNativeApp()"
      pattern: "<OfflineOverlay"
    - from: "apps/frontend/src/components/layout/TopHeader.tsx"
      to: "safe-top"
      via: "className do header"
      pattern: "safe-top"
---

<objective>
Completar os ajustes de celular no SPA: sobreposição "Sem conexão" para queda de rede no meio da sessão (o `errorPath` local só cobre a abertura/recarga — Pitfall 4) e área segura (entalhe, barra de gestos) no cabeçalho e na barra inferior do layout Gestor Beauty.

Purpose: C-02 e C-05 dentro do WebView com edge-to-edge (Android 15+/targetSdk 36), sem efeito em telas comuns.
Output: `OfflineOverlay`, chaves i18n, `viewport-fit=cover`, utilitários de safe area aplicados no layout.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-08-SUMMARY.md

**Ambiente de execução:** igual ao 07-01. Frontend sem prettier (aspas simples, ~100 colunas); textos via i18n (`useTranslation`); tokens do layout Gestor Beauty (roxo `#570080` = `bg-primary`/`primary-500`; papel `#F7F6F3` como valor arbitrário `bg-[#F7F6F3]`, igual à splash); nunca importar `tailwind.config.ts` em `src`. O teste `casco-gestor-beauty.test.tsx` afirma `h-14` no header — manter a classe.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: OfflineOverlay com i18n, montado pela NativeAppBridge</name>
  <files>apps/frontend/src/infrastructure/native/OfflineOverlay.tsx, apps/frontend/src/infrastructure/native/__tests__/offline-overlay.test.tsx, apps/frontend/src/infrastructure/native/NativeAppBridge.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json</files>
  <read_first>
    - apps/frontend/src/infrastructure/native/NativeAppBridge.tsx (07-08; hoje `return null`)
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (chaves de topo: common, appShell, ...)
    - apps/mobile/www/offline.html (07-04: mesmos textos, para a experiência ser igual)
    - apps/frontend/src/components/ui/button.tsx (botão do design system)
  </read_first>
  <behavior>
    - isNativeApp false → nada renderizado mesmo com navigator.onLine false
    - isNativeApp true e online → nada renderizado
    - evento 'offline' no window → aparece role="alertdialog" com o título 'Sem conexão', o texto da descrição e o botão 'Tentar novamente'
    - evento 'online' → a sobreposição some sem recarregar
    - clique em 'Tentar novamente' → window.location.reload chamado (mock)
    - montagem com navigator.onLine=false → já aparece
  </behavior>
  <action>
1. `pt-BR.json`: nova chave de topo `"native"`:
```json
  "native": {
    "offline": {
      "title": "Sem conexão",
      "description": "Não foi possível falar com o Gestor Beauty. Confira o Wi-Fi ou os dados móveis e tente de novo.",
      "retry": "Tentar novamente"
    }
  }
```
2. `OfflineOverlay.tsx`: `useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)`; listeners `online`/`offline` no `window` com limpeza; `if (!isNativeApp() || online) return null;`. Markup: `<div role="alertdialog" aria-modal="true" aria-labelledby="sgs-offline-title" aria-describedby="sgs-offline-desc" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-md bg-[#F7F6F3] px-lg text-center safe-top safe-bottom">`, monograma `<div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary font-serif text-2xl font-semibold text-white">GB</div>`, `<h1 id="sgs-offline-title" className="font-serif text-headline-sm text-neutral-800">{t('native.offline.title')}</h1>`, `<p id="sgs-offline-desc" className="max-w-xs text-neutral-500">{t('native.offline.description')}</p>`, `<Button onClick={() => window.location.reload()} className="h-12 min-w-[12rem]">{t('native.offline.retry')}</Button>` com foco automático (`autoFocus`). (As classes `safe-top`/`safe-bottom` vêm da Task 2; se a Task 1 rodar antes, elas só não têm efeito.)
3. `NativeAppBridge.tsx`: trocar `return null` por `return <OfflineOverlay />;` (o próprio overlay já checa `isNativeApp()`).
4. Teste com `vi.mock('../platform')`, `Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })`, `window.dispatchEvent(new Event('offline'))`, `vi.spyOn(window.location, 'reload')` (ou redefinir `window.location` com `reload: vi.fn()` se o jsdom não permitir spy) e i18n real (`import '@/infrastructure/i18n'`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run offline native-app-bridge && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '"title": "Sem conexão"' apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra a linha
    - `grep -n '"retry": "Tentar novamente"' apps/frontend/src/infrastructure/i18n/locales/pt-BR.json` encontra a linha
    - `grep -n "t('native.offline.retry')" apps/frontend/src/infrastructure/native/OfflineOverlay.tsx` encontra a linha
    - `grep -n "<OfflineOverlay" apps/frontend/src/infrastructure/native/NativeAppBridge.tsx` encontra a linha
    - `grep -n "Sem conexão" apps/frontend/src/infrastructure/native/OfflineOverlay.tsx` NÃO encontra (texto vem do i18n)
    - `corepack pnpm --filter @sgs/frontend exec vitest run offline` sai 0
  </acceptance_criteria>
  <done>Queda de rede no meio da sessão mostra a tela amigável com "Tentar novamente", só no app.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Área segura (viewport-fit=cover + utilitários) no cabeçalho, barra inferior e conteúdo</name>
  <files>apps/frontend/index.html, apps/frontend/src/styles/globals.css, apps/frontend/src/components/layout/TopHeader.tsx, apps/frontend/src/components/layout/BottomNav.tsx, apps/frontend/src/components/layout/AppShell.tsx, apps/frontend/src/components/layout/__tests__/safe-area.test.tsx</files>
  <read_first>
    - apps/frontend/index.html (meta viewport sem viewport-fit)
    - apps/frontend/src/styles/globals.css (@layer base :root)
    - apps/frontend/src/components/layout/TopHeader.tsx (header `sticky top-0 ... h-14 ...`, linha ~47)
    - apps/frontend/src/components/layout/BottomNav.tsx (nav `fixed inset-x-0 bottom-0 z-30 flex h-16 ...`, linha ~32)
    - apps/frontend/src/components/layout/AppShell.tsx (main `pb-20 ... lg:pb-lg`, linha ~88)
    - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx (afirmações de classe que precisam continuar valendo)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Pattern 6, Pitfall 5)
  </read_first>
  <behavior>
    - header do TopHeader tem as classes 'h-14', 'box-content' e 'safe-top' (e continua com 'bg-white', 'border-b')
    - nav do BottomNav tem 'h-16', 'box-content' e 'safe-bottom'
    - main do AppShell tem 'pb-[calc(5rem+var(--sgs-safe-bottom))]' e continua com 'lg:pb-lg'
  </behavior>
  <action>
1. `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`.
2. `globals.css`: no `:root` do `@layer base`, acrescentar
```css
    /* Fase 7 — área segura (entalhe/barra de gestos). O SystemBars do Capacitor injeta
       --safe-area-inset-*; no navegador vale env(); sem entalhe, 0px. */
    --sgs-safe-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
    --sgs-safe-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
```
   e um bloco novo `@layer utilities { .safe-top { padding-top: var(--sgs-safe-top); } .safe-bottom { padding-bottom: var(--sgs-safe-bottom); } }`.
3. `TopHeader.tsx`: no `<header>`, acrescentar `box-content safe-top` (mantendo `h-14`: com `box-content` a altura útil continua 56px e o padding fica por cima, pintado de branco sob a barra de status — Pitfall 5).
4. `BottomNav.tsx`: no `<nav>`, acrescentar `box-content safe-bottom` (mantendo `h-16`).
5. `AppShell.tsx`: no `<main>`, trocar `pb-20` por `pb-[calc(5rem+var(--sgs-safe-bottom))]` (mantendo `lg:pb-lg`).
6. Teste `safe-area.test.tsx` renderizando `TopHeader`, `BottomNav` e `AppShell` com os mesmos providers/mocks de `casco-gestor-beauty.test.tsx` e afirmando as classes do `<behavior>`. Rodar também `casco-gestor-beauty`, `menu-dom`, `sidebar-nav`.
7. Gate completo da wave (último commit da wave 4, se este for o último plano da wave a terminar): `corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/e2e test:e2e`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run safe-area casco-gestor-beauty && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "viewport-fit=cover" apps/frontend/index.html` encontra a linha
    - `grep -n "\-\-sgs-safe-top" apps/frontend/src/styles/globals.css` e `grep -n "\.safe-bottom" apps/frontend/src/styles/globals.css` encontram as linhas
    - `grep -n "safe-top" apps/frontend/src/components/layout/TopHeader.tsx` e `grep -n "safe-bottom" apps/frontend/src/components/layout/BottomNav.tsx` encontram as linhas
    - `grep -n "var(--sgs-safe-bottom)" apps/frontend/src/components/layout/AppShell.tsx` encontra a linha
    - `grep -rn "tailwind.config" apps/frontend/src --include=*.ts --include=*.tsx` não encontra import
    - `corepack pnpm --filter @sgs/frontend exec vitest run` sai 0 e `corepack pnpm --filter @sgs/frontend build` sai 0
  </acceptance_criteria>
  <done>O layout respeita entalhe e barra de gestos no app, sem diferença visual em telas comuns.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/frontend exec vitest run` e `build` verdes
- E2E Playwright do layout (fase 6) verdes no gate da wave
</verification>

<success_criteria>
O app mostra "Sem conexão" também no meio da sessão (C-02) e o layout Gestor Beauty respeita a área segura do Android (C-05).
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-10-SUMMARY.md`
</output>

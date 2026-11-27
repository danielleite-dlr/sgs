---
phase: quick-261127-oea
plan: 01
subsystem: frontend, mobile, backend-push
tags: [marca, gestor-beauty, branding, pwa, android, tailwind]
requires: []
provides:
  - marca Gestor Beauty versionada em docs/marca/gestor-beauty
  - logo/símbolo, favicon, ícones PWA e paleta roxa nova no web
  - ícone, splash e ícone de notificação do Android; push com #7E22CE
affects: [apps/frontend, apps/mobile, apps/backend/src/push, apps/e2e]
key-files:
  created:
    - docs/marca/gestor-beauty/ (svg/, png/, LEIA-ME.txt)
    - apps/frontend/src/assets/marca/logo-horizontal-principal.svg
    - apps/frontend/src/assets/marca/simbolo-principal.svg
    - apps/mobile/assets/{simbolo-branco,logo-vertical-principal,logo-vertical-fundo-escuro}.svg
  modified:
    - apps/frontend (Logo, BrandMark, SidebarNav, index.html, tailwind.config.ts, globals.css, cores em src)
    - apps/mobile (render-assets.mjs, check-config.mjs, package.json, res/**, offline.html, README)
    - apps/backend/src/push/fcm-push.provider.ts (+ spec)
    - apps/e2e (ux-contraste, audit, agenda-cor-profissional)
decisions:
  - BrandMark perdeu a prop organizationName (o símbolo não usa mais iniciais); 3 chamadores ajustados
  - Menu aberto mostra o logo h-6 e o nome do estúdio em text-xs abaixo; aria-label e testid mantidos
  - Teste sem-cor-antiga proíbe as cores do roxo anterior (#570080 etc.)
metrics:
  tasks: 3
  completed: 2026-11-27
---

# Quick 261127-oea: marca Gestor Beauty no web e no app Android

Logo e símbolo Gestor Beauty no login e no menu, favicon/ícones PWA novos, escala roxa #7E22CE no web e
ícone/splash/notificação do Android regenerados a partir dos SVGs oficiais.

## Commits

| Tarefa | Commit | Resumo |
| --- | --- | --- |
| 1 | 09620cf | marca versionada, logo no login/menu, BrandMark = símbolo, favicon e ícones PWA, título e theme-color |
| 2 | dc31a88 | escala primary nova, `--ring`, cores antigas trocadas em todo o src, testes de tokens |
| 3 | 7adf877 | assets e recursos Android, ícone de notificação, cor do push, specs E2E de cor |

## Gates

- Frontend: lint e tsc limpos; vitest 1214/1214 (a rodada completa deu 1213/1214 e a falha, o `rgb()` do
  avatar neutro em day-grid.test, foi corrigida e reexecutada com 40/40 nos arquivos afetados).
- Backend: jest de fcm-push.provider.spec 18/18.
- Mobile: `check-config` OK (51 verificações); typecheck limpo.
- E2E Playwright: 87 testes na rodada completa, 86 passaram e 1 falhou (UX-10 de ux-comanda-celular, timeout
  de 30 s com ~31 s sob carga; repetido isolado junto de agenda-cor-profissional e ux-contraste: 6/6 passaram,
  UX-10 em 23 s, perto do limite).
- graphql-codegen contra `apps/backend/src/graphql/schema/**/*.graphql`: sucesso (saída no scratchpad).
- Grep de cores antigas em apps/: só sobra a lista proibida em sem-cor-antiga.test.ts (intencional).

## Prints (spec temporário apagado)

- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/login-desktop.png
- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/login-celular.png
- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/app-desktop.png
- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/app-celular.png
- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/mobile-splash.png
- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/mobile-splash-dark.png
- /tmp/claude-0/-root/5168df2d-3b3b-4fd8-b37b-e184d1610479/scratchpad/prints/mobile-foreground.png

Conferidos: logo cabe no h-14 do menu com o nome do estúdio embaixo, símbolo de 32 px no topo do celular,
roxo novo nos botões e links.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Specs E2E com cores antigas**
- **Found during:** Tarefa 3 (E2E)
- **Issue:** ux-contraste.spec.ts (e o audit de staging) esperavam os `rgb()` do roxo antigo e
  agenda-cor-profissional.spec.ts esperava `rgb(245, 230, 251)`; falhariam com a paleta nova.
- **Fix:** valores atualizados para os novos `rgb()` (126,34,206 / 107,33,168 / 88,28,135 / 37,11,66 e 250,245,255).
- **Commit:** 7adf877

**2. [Rule 1 - Bug] Regex da lista de cores antigas trocada pelo mapa**
- A substituição em massa alterou `#5D54C7` dentro da própria regex de sem-cor-antiga; restaurado e
  acrescentadas as cores do roxo anterior. Commit dc31a88.

**3. [Rule 3] Reformatação do AndroidManifest.xml pelo capacitor-assets**
- O gerador reescreveu o XML (só formatação); revertido com `git checkout` e não entrou no commit.

**4. [Rule 3] Jest do backend**
- `pnpm exec jest` exige `--config jest.config.ts` (há duas configs); usado `pnpm test <arquivo>`.

Obs.: o `ux-contraste-staging.audit.ts` roda contra staging e só passa depois do deploy do web.

## Known Stubs

Nenhum.

## Para o usuário

- Ícone e splash novos só aparecem com um NOVO APK gerado e instalado; as mudanças do web chegam ao app
  sem APK, via server.url.
- O staging precisa de deploy para o web refletir a marca.
- O APK não foi buildado aqui.

## Self-Check: PASSED

Commits 09620cf, dc31a88 e 7adf877 existem; docs/marca/gestor-beauty existe e gestor-beauty-logo/ não existe;
zz-tmp-marca.spec.ts apagado.

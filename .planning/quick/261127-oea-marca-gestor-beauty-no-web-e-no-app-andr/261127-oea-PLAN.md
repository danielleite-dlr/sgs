---
phase: quick-261127-oea
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/marca/gestor-beauty/**
  - gestor-beauty-logo/ (removida)
  - apps/frontend/src/assets/marca/*.svg
  - apps/frontend/src/features/auth/components/Logo.tsx
  - apps/frontend/src/components/layout/BrandMark.tsx
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
  - apps/frontend/index.html
  - apps/frontend/public/favicon.svg
  - apps/frontend/public/manifest.webmanifest
  - apps/frontend/public/icons/*.png
  - apps/frontend/tailwind.config.ts
  - apps/frontend/src/styles/globals.css
  - apps/frontend/src/pages/DashboardPlaceholder.tsx
  - apps/frontend/src/features/operations/components/calendar/types.ts
  - apps/frontend/src/features/operations/lib/appointment-status-style.ts
  - apps/frontend/src/components/ui/textarea.tsx
  - apps/frontend/src/components/ui/input.tsx
  - apps/frontend/src/components/ui/select.tsx
  - apps/frontend/src/lib/field-classes.ts
  - apps/frontend/src/__tests__/pwa-manifest.test.ts
  - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
  - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts
  - apps/frontend/src/features/operations/__tests__/*.test.tsx (day-grid, novo-agendamento-gestor-beauty, agenda-gestor-beauty, time-block-dialog)
  - apps/frontend/src/components/ui/__tests__/campos-acoes-gestor-beauty.test.tsx
  - apps/mobile/assets/icon.svg
  - apps/mobile/assets/*.png
  - apps/mobile/scripts/render-assets.mjs
  - apps/mobile/scripts/check-config.mjs
  - apps/mobile/package.json
  - apps/mobile/www/offline.html
  - apps/mobile/android/app/src/main/res/** (values/gb_colors.xml, values/ic_launcher_background.xml, drawable/ic_stat_gestor_beauty.xml, mipmaps e splash gerados)
  - apps/backend/src/push/fcm-push.provider.ts
  - apps/backend/src/push/fcm-push.provider.spec.ts
autonomous: true
requirements: [QUICK-261127-oea]

must_haves:
  truths:
    - "A tela de login (e troca de senha/convite) mostra o logo horizontal Gestor Beauty no lugar do texto 'SGS'"
    - "O menu lateral aberto mostra o logo horizontal Gestor Beauty; menu recolhido, topo do celular e gaveta mostram o símbolo da marca"
    - "A aba do navegador mostra o título 'Gestor Beauty' e o favicon novo; o PWA instalado usa os ícones novos"
    - "Botões, foco e destaques do web usam o roxo #7E22CE (e a escala nova); nenhuma cor antiga (#570080, #4C0070, #521873, #370053, #5D54C7) sobra no código"
    - "O app Android gerado a partir do repo tem ícone (normal e adaptativo) e splash da marca nova, e a notificação push usa a cor #7E22CE"
    - "Os arquivos-fonte da marca ficam versionados em docs/marca/gestor-beauty/ e a pasta solta gestor-beauty-logo/ deixa de existir"
  artifacts:
    - path: "docs/marca/gestor-beauty/LEIA-ME.txt"
      provides: "Guia da marca versionado (com svg/ e png/, sem .DS_Store)"
    - path: "apps/frontend/src/assets/marca/logo-horizontal-principal.svg"
      provides: "Logo usado no login e no menu"
    - path: "apps/frontend/src/assets/marca/simbolo-principal.svg"
      provides: "Símbolo usado no BrandMark"
    - path: "apps/frontend/public/favicon.svg"
      provides: "Favicon = icone-app.svg"
      contains: "#A855F7"
    - path: "apps/frontend/tailwind.config.ts"
      contains: "#7E22CE"
    - path: "apps/mobile/scripts/render-assets.mjs"
      provides: "Geração de icon-only/foreground/background/splash a partir dos SVGs da marca"
    - path: "apps/backend/src/push/fcm-push.provider.ts"
      contains: "#7E22CE"
  key_links:
    - from: "apps/frontend/src/features/auth/components/Logo.tsx"
      to: "apps/frontend/src/assets/marca/logo-horizontal-principal.svg"
      via: "import de asset do Vite + <img alt='Gestor Beauty'>"
      pattern: "logo-horizontal-principal\\.svg"
    - from: "apps/frontend/src/components/layout/BrandMark.tsx"
      to: "apps/frontend/src/assets/marca/simbolo-principal.svg"
      via: "import de asset"
      pattern: "simbolo-principal\\.svg"
    - from: "apps/mobile/package.json (script assets)"
      to: "apps/mobile/scripts/render-assets.mjs"
      via: "node scripts/render-assets.mjs && capacitor-assets generate --iconBackgroundColor '#A855F7'"
      pattern: "#A855F7"
---

<objective>
Aplicar a nova identidade visual "Gestor Beauty" no SGS web (apps/frontend) e no app Android
(apps/mobile, casca Capacitor 8): logo no login e no menu, favicon/ícones PWA, paleta roxa nova,
ícone + splash do Android e cor da notificação push.

Purpose: o produto passa a se chamar e se parecer com "Gestor Beauty" em todos os pontos de contato.
Output: marca versionada em docs/marca/gestor-beauty/, web com logo/cores novas, recursos Android
regenerados, gate verde e prints de validação do login e do menu.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@gestor-beauty-logo/LEIA-ME.txt

Guia da marca (resumo):
- Roxo escuro #250B42 (texto "gestor", fundos escuros) · Roxo #7E22CE (símbolo e "beauty" no fundo claro)
  · Roxo vivo #A855F7 (símbolo no fundo escuro, FUNDO DO ÍCONE) · Lilás #D8B4FE ("beauty" no fundo escuro).
- Fonte Sora, mas os SVGs já estão em curvas: NÃO carregar a fonte nem trocar a tipografia do app (fora de escopo).
- PNGs de ícone são quadrados sem cantos arredondados (a loja/launcher aplica a máscara).

Fatos levantados no código (o executor não precisa redescobrir):

```
svg/icone-app.svg (viewBox 0 0 100 100):
  <rect width="100" height="100" fill="#A855F7"/>
  <path transform="translate(20 20) scale(0.6)" d="M22 8 H78 A12 12 0 0 1 90 20 V80 A12 12 0 0 1 78 92 H53 L10 56 V20 A12 12 0 0 1 22 8 Z M27 23 H74 V76 H54 V48 H27 Z" fill="#FFFFFF" fill-rule="evenodd" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>
svg/simbolo-branco.svg: viewBox "7 5.5 86 89", mesmo path em branco.
svg/logo-horizontal-principal.svg: viewBox "6 5 507.1 90" (proporção ~5,6:1).
```

apps/frontend/src/lib/brand.ts: `brandName(org)` (nome do estúdio ou "SGS") e `brandInitials(org)`.
Ambos continuam existindo (o nome do estúdio é do tenant, não da marca do produto).

SidebarNav.tsx (menu aberto, ~linha 78): `<Link data-testid="sidebar-brand" aria-label={`${brandName(organizationName)} — início`} className="flex h-14 ... px-md">`
contém `<BrandMark organizationName/>` + `<span className="truncate font-serif text-headline-sm text-neutral-800">{brandName(...)}</span>`.
Menu recolhido (~linha 326): mesmo Link só com `<BrandMark/>`. TopHeader.tsx (celular, linha 53) e AppDrawer.tsx
usam `<BrandMark/>` + nome do estúdio. BrandMark hoje = quadrado `bg-primary` com `brandInitials`.

Testes que dependem disso:
- src/__tests__/router.test.tsx:62 espera `sidebar-brand` com nome acessível 'SGS — início' → MANTER o aria-label.
- components/layout/__tests__/casco-gestor-beauty.test.tsx:51 espera `within(marca).getByText('JS')` → atualizar.
- apps/e2e/tests/noivas-contrato.spec.ts:309 clica em `getByTestId('sidebar-brand')` → manter o testid.
- Nenhum spec E2E procura o texto "SGS" do logo do login.

Cores antigas → novas (mapa único para todo o repo):
  #570080 → #7E22CE (500/DEFAULT) · #4C0070 → #6B21A8 (600/700) · #521873 → #581C87 (800)
  #370053 → #250B42 (900) · #5D54C7 → #7E22CE · #F5E6FB → #FAF5FF (50) · #EBD3F5 → #F3E8FF (100)
  #E0B8F0 → #E9D5FF (200) · #C98EE3 → #D8B4FE (300)
  globals.css `--ring: 281 100% 25%` → `--ring: 272 72% 47%` (HSL de #7E22CE).
  Contraste: branco sobre #7E22CE ≈ 6,9:1 e #6B21A8 sobre branco ≈ 8,6:1 (AA ok).

Mobile:
- package.json script `assets`: `node scripts/render-assets.mjs && capacitor-assets generate --android --assetPath assets --iconBackgroundColor '#570080' --iconBackgroundColorDark '#570080' --splashBackgroundColor '#F7F6F3' --splashBackgroundColorDark '#F7F6F3'`.
- check-config.mjs linhas ~87-88: `contem('assets/icon.svg', '>GB<'); contem('assets/icon.svg', '#570080');` e exige
  assets/{icon-only,icon-foreground,icon-background,splash}.png, mipmap-anydpi-v26/ic_launcher.xml,
  mipmap-xxxhdpi/ic_launcher_foreground.png, drawable/ic_stat_gestor_beauty.xml, styles.xml com windowSplashScreenBackground.
- res/values/gb_colors.xml: gb_primary #570080, gb_paper #F7F6F3 (styles.xml usa @color/gb_paper no splash).
- res/values/ic_launcher_background.xml: #570080. www/offline.html: #570080 em 2 lugares.
- capacitor.config.ts: backgroundColor e SplashScreen.backgroundColor #F7F6F3 → MANTER (splash claro).
- Backend: fcm-push.provider.ts:8 `ANDROID_NOTIFICATION_COLOR = '#570080'`; spec linha 84 espera '#570080'.

Armadilhas do projeto (obrigatórias):
- Sem prettier no frontend: editar à mão (aspas simples, ~100 colunas). NUNCA rodar prettier em arquivo existente.
- NUNCA importar tailwind.config.ts em teste/código de src (CI quebra com TS6305); testes leem como texto.
- Usar `corepack pnpm` para comandos do monorepo.
- `sharp` está nas devDeps de apps/mobile: scripts de geração de PNG rodam a partir de apps/mobile
  (ex.: `cd /root/sgs/apps/mobile && node /caminho/script.mjs`, com o script importando sharp via
  createRequire(path.join('/root/sgs/apps/mobile','package.json'))). Scripts temporários ficam no scratchpad, não no repo.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Versionar a marca e aplicar logo, favicon e ícones PWA no web</name>
  <files>docs/marca/gestor-beauty/{LEIA-ME.txt,svg/*,png/*}, gestor-beauty-logo/ (remover), apps/frontend/src/assets/marca/{logo-horizontal-principal,simbolo-principal}.svg, apps/frontend/src/features/auth/components/Logo.tsx, apps/frontend/src/components/layout/BrandMark.tsx, apps/frontend/src/components/layout/SidebarNav.tsx, apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx, apps/frontend/index.html, apps/frontend/public/favicon.svg, apps/frontend/public/icons/*.png</files>
  <behavior>
    - Login (AuthCard → Logo) renderiza `<img alt="Gestor Beauty">` cujo src aponta para logo-horizontal-principal; o texto "SGS" some do login.
    - Menu aberto: dentro de `sidebar-brand` há `<img alt="Gestor Beauty">` do logo horizontal; o nome do estúdio ("Studio JS") continua visível como linha pequena abaixo do logo; aria-label continua `${brandName} — início` (router.test 'SGS — início' passa sem mudança).
    - BrandMark (menu recolhido, topo do celular, gaveta) renderiza o símbolo da marca (img decorativa, `alt=""`, `data-testid="brand-symbol"`), não mais as iniciais.
  </behavior>
  <action>
    1. Organização: `mkdir -p docs/marca/gestor-beauty` e mover (git mv não serve — não versionado; usar mv) `gestor-beauty-logo/svg`, `gestor-beauty-logo/png` e `LEIA-ME.txt` para lá; apagar todos os `.DS_Store` (`find docs/marca -name .DS_Store -delete`) e remover a pasta `gestor-beauty-logo/` da raiz. ATENÇÃO: o `<context>` deste plano referencia `gestor-beauty-logo/LEIA-ME.txt`; depois de mover, a fonte da verdade é `docs/marca/gestor-beauty/`.
    2. Copiar `logo-horizontal-principal.svg` e `simbolo-principal.svg` para `apps/frontend/src/assets/marca/` (cópia, a pasta docs é o acervo; o front importa daqui). Conferir que `vite/client` está nas types do tsconfig/vite-env.d.ts (import de `.svg` como URL); se não estiver, adicionar `/// <reference types="vite/client" />`.
    3. `Logo.tsx`: `import logoUrl from '@/assets/marca/logo-horizontal-principal.svg';` e renderizar `<div className="mb-lg flex justify-center"><img src={logoUrl} alt="Gestor Beauty" className="h-10 w-auto" /></div>`.
    4. `BrandMark.tsx`: trocar o quadrado de iniciais por `<img src={simboloUrl} alt="" aria-hidden="true" data-testid="brand-symbol" className="h-8 w-8 shrink-0" />` (mesmo tamanho 32px para não mexer no layout de TopHeader/AppDrawer/menu recolhido). Manter a assinatura `{ organizationName }` (prop pode ficar sem uso; prefixar/ignorar de forma que o lint passe — se o lint reclamar, remover a prop e ajustar os 4 chamadores). Atualizar o comentário do componente. `brandInitials` continua em brand.ts (tem teste próprio).
    5. `SidebarNav.tsx` (menu aberto): dentro do Link `sidebar-brand`, substituir `<BrandMark/> + <span nome>` por uma coluna: `<img src={logoUrl} alt="Gestor Beauty" className="h-6 w-auto self-start" />` e, abaixo, `<span className="truncate text-label-sm text-neutral-600">{brandName(organizationName)}</span>` (se `text-label-sm` não existir no tailwind config, usar `text-xs`). Trocar `items-center gap-sm` do Link por `flex-col justify-center gap-0.5` mantendo `h-14`. Menu recolhido continua usando `<BrandMark/>` (agora símbolo). Não mexer em TopHeader/AppDrawer além do que o BrandMark já muda.
    6. Teste `casco-gestor-beauty.test.tsx:51`: trocar `getByText('JS')` por `getByAltText('Gestor Beauty')` + `getByText('Studio JS')` dentro de `marca`. Rodar a busca `grep -rn "getByText('JS')\|brandInitials\|'SG'" apps/frontend/src --include=*.test.tsx` e ajustar outros testes de layout que dependam das iniciais renderizadas (exceto brand.test.ts, que testa a função).
    7. `index.html`: `<title>Gestor Beauty</title>`; `meta description` → "Gestor Beauty — Gestão para salões de beleza"; `theme-color` → `#7E22CE`.
    8. `public/favicon.svg` = conteúdo de `docs/marca/gestor-beauty/svg/icone-app.svg`.
    9. `public/icons/`: com sharp (script temporário no scratchpad, executado de apps/mobile): `icon-192.png` ← png/icone-app-192.png (cópia); `icon-512.png` e `icon-512-maskable.png` ← png/icone-app-512.png (o símbolo ocupa a área 20–80 do ícone, dentro da zona segura circular de 80% do maskable, então serve direto); `apple-touch-icon-180.png` ← resize 180x180 de icone-app-1024.png. Conferir com `file` que as dimensões batem.
  </action>
  <verify>
    <automated>cd /root/sgs && test ! -d gestor-beauty-logo && test -f docs/marca/gestor-beauty/svg/icone-app.svg && test -z "$(find docs/marca -name .DS_Store)" && corepack pnpm --filter @sgs/frontend exec vitest run src/components/layout src/__tests__/router.test.tsx src/features/auth && file apps/frontend/public/icons/*.png</automated>
  </verify>
  <done>Login e menu exibem o logo Gestor Beauty; BrandMark é o símbolo; título/favicon/ícones PWA novos; marca versionada em docs/marca/gestor-beauty sem .DS_Store; testes de layout/router/auth verdes.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Trocar a paleta do web para a escala roxa Gestor Beauty</name>
  <files>apps/frontend/tailwind.config.ts, apps/frontend/src/styles/globals.css, apps/frontend/public/manifest.webmanifest, apps/frontend/src/pages/DashboardPlaceholder.tsx, apps/frontend/src/features/operations/components/calendar/types.ts, apps/frontend/src/features/operations/lib/appointment-status-style.ts, apps/frontend/src/components/ui/{textarea,input,select}.tsx, apps/frontend/src/lib/field-classes.ts, testes listados em files_modified</files>
  <behavior>
    - tokens-gestor-beauty.test.ts: tailwind.config.ts (lido como TEXTO) tem primary 50 #FAF5FF, 100 #F3E8FF, 200 #E9D5FF, 300 #D8B4FE, 500/DEFAULT #7E22CE, 600/700 #6B21A8, 800 #581C87, 900 #250B42; globals.css tem `--color-primary-500: #7E22CE` e `--ring: 272 72% 47%`.
    - sem-cor-antiga.test.ts: a lista de cores proibidas passa a incluir #570080, #4C0070, #521873, #370053, #5D54C7, #F5E6FB, #EBD3F5, #E0B8F0, #C98EE3 (case-insensitive), além das que já estavam; o teste varre src e falha se alguma sobrar.
    - pwa-manifest.test.ts: manifest theme_color '#7E22CE' e index.html `name="theme-color" content="#7E22CE"`.
  </behavior>
  <action>
    1. RED: atualizar primeiro os 3 testes de tokens acima com os valores novos e rodar (devem falhar).
    2. GREEN: aplicar o mapa de cores do `<context>` em tailwind.config.ts (escala primary inteira; se existir 400, usar #A855F7 — o roxo vivo da marca) e em globals.css (`--color-primary-50/500/700/900` e `--ring: 272 72% 47%`). manifest.webmanifest: `theme_color` → `#7E22CE` (background_color #F7F6F3 fica).
    3. Substituir as cores antigas fixas nos arquivos de src: `grep -rniE "570080|4C0070|521873|370053|5D54C7|F5E6FB|EBD3F5|E0B8F0|C98EE3" apps/frontend/src apps/frontend/public apps/frontend/index.html` e trocar cada ocorrência pelo par do mapa (preservar a caixa usada no arquivo e a formatação manual; editar com Edit/sed pontual, nunca prettier). Isso inclui DashboardPlaceholder.tsx, calendar/types.ts, appointment-status-style.ts, ui/textarea|input|select.tsx, lib/field-classes.ts e os testes day-grid, novo-agendamento-gestor-beauty, agenda-gestor-beauty, time-block-dialog, campos-acoes-gestor-beauty (as asserções passam a esperar as cores novas). Se alguma cor estiver em rgb()/hsl() equivalente, converter também.
    4. Não importar tailwind.config.ts em nenhum teste (ler com readFileSync como já é feito).
    5. Gate do frontend: lint + tsc + vitest completos.
  </action>
  <verify>
    <automated>cd /root/sgs && ! grep -rniE "570080|4C0070|521873|370053|5D54C7|F5E6FB|EBD3F5|E0B8F0|C98EE3" apps/frontend/src apps/frontend/public apps/frontend/index.html apps/frontend/tailwind.config.ts && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend test</automated>
  </verify>
  <done>Nenhuma cor antiga no frontend; escala primary nova em tailwind e globals.css; testes de tokens/manifest/cor-antiga atualizados e verdes; lint, tsc e vitest do frontend verdes.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Ícone, splash e cores do Android + cor do push; gate final e prints</name>
  <files>apps/mobile/assets/icon.svg, apps/mobile/assets/*.png, apps/mobile/scripts/render-assets.mjs, apps/mobile/scripts/check-config.mjs, apps/mobile/package.json, apps/mobile/www/offline.html, apps/mobile/android/app/src/main/res/**, apps/backend/src/push/fcm-push.provider.ts, apps/backend/src/push/fcm-push.provider.spec.ts</files>
  <action>
    1. Fontes do mobile: copiar para `apps/mobile/assets/` os SVGs `icone-app.svg` (substitui `icon.svg` — sobrescrever `assets/icon.svg` com o conteúdo de icone-app.svg), `simbolo-branco.svg`, `logo-vertical-principal.svg` e `logo-vertical-fundo-escuro.svg` (a partir de docs/marca/gestor-beauty/svg).
    2. Reescrever `scripts/render-assets.mjs` (comentário no topo explicando a origem) com constantes `ROXO_VIVO = '#A855F7'`, `ROXO_ESCURO = '#250B42'`, `PAPEL = '#F7F6F3'`:
       - `icon-only.png` 1024 ← icon.svg (icone-app) renderizado a 1024 (usar `sharp(buf, { density: 1024/100*72 })` ou resize de densidade alta para não borrar).
       - `icon-background.png` 1024 sólido ROXO_VIVO.
       - `icon-foreground.png` 1024 transparente com `simbolo-branco.svg` renderizado a ~410px de largura centralizado (o ícone mostra o símbolo a 60% da área visível; a área visível do adaptativo é 66,7% do canvas → 0,6 × 0,667 ≈ 40%; fica dentro da zona segura).
       - `splash.png` 2732 fundo PAPEL com `logo-vertical-principal.svg` a ~900px de largura no centro.
       - `splash-dark.png` 2732 fundo ROXO_ESCURO com `logo-vertical-fundo-escuro.svg` a ~900px no centro.
       - Remover a lógica antiga de `<rect>`/`font-size="400"` e a máscara arredondada. Lançar erro claro se algum SVG não existir.
    3. `package.json` script `assets`: `--iconBackgroundColor '#A855F7' --iconBackgroundColorDark '#A855F7' --splashBackgroundColor '#F7F6F3' --splashBackgroundColorDark '#250B42'`.
    4. `check-config.mjs`: trocar `contem('assets/icon.svg', '>GB<')` e `'#570080'` por `contem('assets/icon.svg', '#A855F7')` e `contem('assets/icon.svg', 'fill-rule="evenodd"')`; exigir também `assets/simbolo-branco.svg` e `assets/logo-vertical-principal.svg`; adicionar checagem de que `android/app/src/main/res/values/ic_launcher_background.xml` contém `#A855F7` e `gb_colors.xml` contém `#7E22CE`. Se o script validar `#570080` em outro ponto, trocar pelo valor novo.
    5. Rodar `corepack pnpm --filter @sgs/mobile assets` (gera mipmaps/drawables em android/app/src/main/res). Depois conferir/ajustar à mão: `values/ic_launcher_background.xml` → `#A855F7` (o generate pode reescrever; garantir); `values/gb_colors.xml` gb_primary → `#7E22CE` (gb_paper fica #F7F6F3); se o generate criar `values-night` com splash, conferir que aponta para #250B42. `capacitor.config.ts` não muda (splash claro #F7F6F3).
    6. Ícone de notificação monocromático `drawable/ic_stat_gestor_beauty.xml` (hoje um calendário): trocar por vector `android:viewportWidth="100" android:viewportHeight="100"` 24dp com `<path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="M22 8 H78 A12 12 0 0 1 90 20 V80 A12 12 0 0 1 78 92 H53 L10 56 V20 A12 12 0 0 1 22 8 Z M27 23 H74 V76 H54 V48 H27 Z"/>` (símbolo da marca; nome do recurso igual, o backend e o manifest já apontam para ele).
    7. `www/offline.html`: as 2 ocorrências de `#570080` → `#7E22CE`.
    8. Backend: `fcm-push.provider.ts` `ANDROID_NOTIFICATION_COLOR = '#7E22CE'` e spec linha 84 espera `'#7E22CE'`.
    9. Grep final no repo (fora de node_modules, docs/marca e .planning): `grep -rniE "570080|4C0070|5D54C7|370053" apps --exclude-dir=node_modules --exclude-dir=build --exclude-dir=dist` deve voltar vazio (se sobrar algo legítimo, ex. fixture histórica, registrar no SUMMARY).
    10. E2E e prints: rodar `corepack pnpm --filter @sgs/e2e test:e2e` (toca login e menu). Criar `apps/e2e/tests/zz-tmp-marca.spec.ts` temporário que faz `page.screenshot` do login (desktop 1280 e celular 390) e do app logado com menu aberto (desktop) e topo do celular, salvando no scratchpad; ver os prints (Read) para conferir proporção do logo no h-14, símbolo 32px e cores; ajustar classes se o logo ficar cortado/grande. APAGAR o spec temporário depois.
    11. Gate completo antes do commit: frontend lint+tsc+vitest; `corepack pnpm --filter @sgs/backend exec jest src/push/fcm-push.provider.spec.ts`; `corepack pnpm --filter @sgs/mobile test` (check-config) e `corepack pnpm --filter @sgs/mobile typecheck`. Commitar (o APK NÃO é buildado aqui).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/mobile test && corepack pnpm --filter @sgs/mobile typecheck && corepack pnpm --filter @sgs/backend exec jest src/push/fcm-push.provider.spec.ts && grep -q '#A855F7' apps/mobile/android/app/src/main/res/values/ic_launcher_background.xml && grep -q 'evenOdd' apps/mobile/android/app/src/main/res/drawable/ic_stat_gestor_beauty.xml && test ! -f apps/e2e/tests/zz-tmp-marca.spec.ts && ! grep -rniE "570080|4C0070|5D54C7|370053" apps --exclude-dir=node_modules --exclude-dir=build --exclude-dir=dist -l</automated>
  </verify>
  <done>Recursos Android regenerados com ícone/splash da marca (fundo #A855F7, símbolo branco, splash claro e escuro com logo vertical); ícone de notificação = símbolo; push com cor #7E22CE; check-config, typecheck mobile, jest do push, gate do frontend e E2E verdes; prints conferidos e spec temporário apagado.</done>
</task>

</tasks>

<verification>
- `test ! -d /root/sgs/gestor-beauty-logo` e marca em docs/marca/gestor-beauty (svg/, png/, LEIA-ME.txt, sem .DS_Store).
- Nenhuma cor antiga em apps/ (grep do passo 9 da Tarefa 3).
- Gate: frontend lint+tsc+vitest; jest do fcm-push; check-config + typecheck do mobile; E2E Playwright.
- Prints do login e do menu (desktop e celular) conferidos visualmente.
</verification>

<success_criteria>
- Login, menu lateral, topo do celular e gaveta exibem a marca Gestor Beauty (logo/símbolo), mantendo o nome do estúdio e os testids/aria-labels usados nos testes.
- Título "Gestor Beauty", favicon e ícones PWA novos; theme-color #7E22CE.
- Paleta primary nova aplicada e protegida pelo teste sem-cor-antiga.
- Ícone (normal + adaptativo), splash (claro/escuro) e ícone de notificação do Android regenerados; push com #7E22CE.
- SUMMARY registra: (a) o usuário precisa gerar e instalar uma NOVA versão do APK para ver ícone/splash novos (a mudança do web chega sem APK, via server.url); (b) staging precisa de deploy para o web refletir a marca.
</success_criteria>

<output>
After completion, create `.planning/quick/261127-oea-marca-gestor-beauty-no-web-e-no-app-andr/261127-oea-SUMMARY.md`
</output>

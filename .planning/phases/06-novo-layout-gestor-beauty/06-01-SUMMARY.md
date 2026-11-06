---
phase: 06-novo-layout-gestor-beauty
plan: 01
subsystem: frontend-ui
tags: [design-system, tailwind, shadcn, gestor-beauty, tokens]
requires: []
provides:
  - Tokens Gestor Beauty no Tailwind (cores, fontes, escala de texto, raio 6 px, sem sombra)
  - Componentes de components/ui no visual novo (44 px, sem sombra, foco por borda)
  - lib/field-classes.ts (NATIVE_SELECT_CLASS, FIELD_LABEL_CLASS)
  - Varredura sem-cor-antiga.test.ts com PALETA_PENDENTE/SOMBRA_PENDENTE por lote
affects: [06-02, 06-03, 06-04, 06-09]
tech-stack:
  added: []
  patterns:
    - "Nomes de token mantidos (primary-*, neutral-*, text-label/body/heading/display) com valores novos; nomes novos só onde faltavam"
    - "Todo tamanho de fonte novo registrado no extendTailwindMerge de lib/cn.ts"
    - "Sombras zeradas com '0 0 #0000' (não 'none') para não quebrar a lista de box-shadow do ring"
key-files:
  created:
    - apps/frontend/src/lib/field-classes.ts
    - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts
    - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
    - apps/frontend/src/components/ui/__tests__/campos-acoes-gestor-beauty.test.tsx
    - apps/frontend/src/components/ui/__tests__/superficies-gestor-beauty.test.tsx
  modified:
    - apps/frontend/tailwind.config.ts
    - apps/frontend/src/styles/globals.css
    - apps/frontend/index.html
    - apps/frontend/src/lib/cn.ts
    - apps/frontend/src/components/ui/* (24 componentes)
    - telas com cor fixa antiga (Previsão, ForecastCard, Financeiro, agenda, painel, AuthCard, AdminClients, ChangePassword, ImpersonationBanner, PacoteForm, PackagePriceSummary)
    - .gitignore
decisions:
  - "Manter os nomes de token atuais e trocar os valores (testes de classe da fase 5 continuam valendo)"
  - "Um único commit de código no fim, depois do gate completo (regra do projeto: gate antes de commit)"
  - "Status da agenda: Agendado #570080, Confirmado #1B7A43, Em atendimento #0E61A8, Finalizado #49454F, Faltou/Cancelado #BA1A1A com texto branco"
metrics:
  duration: 24min
  completed: 2026-11-06
  tasks: 4
  files: 49
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 01: Base de tokens e componentes Gestor Beauty — Resumo

Tokens "Studio Editorial Density" (Public Sans + Source Serif 4, papel #F7F6F3, linha #E2DFE5,
texto #221E26/#6B6670, semânticas #1B7A43/#BA1A1A/#0E61A8, raio único de 6 px e nenhuma sombra)
aplicados ao Tailwind e a todos os componentes de `components/ui`, com alvos de 44 px, foco de campo
por borda roxa de 1,5 px e uma varredura que trava cor antiga, paleta padrão, sombra e Inter.

## O que foi feito

**Task 1 — Tokens.** `tailwind.config.ts` com a escala completa de `primary`, `success`, `error`,
`warning`, `info`, `status` e `neutral` (todos os tons 0–900 declarados, para nenhum tom cair no
cinza padrão), `font-serif`, tamanhos novos (`display-lg`, `headline-lg/md/sm`, `overline`, `data`),
raio 6 px em todas as chaves e sombras zeradas. `globals.css` com as variáveis novas, `--border`/
`--ring` em HSL, `h1, h2` em serifa, corpo 14/20 e foco de campo `inset 0 0 0 0.5px` (o
`*:focus-visible` com anel de 2 px continua nos demais elementos). `index.html` carrega Public Sans
(400/500/600) e Source Serif 4 (600); Inter saiu. `cn.ts` registra os tamanhos novos (UX-01).
`.gitignore` ignora `06-audit-evidence/`.

**Task 2 — Campos e ações.** Botão (44 px, hover `primary-700`, outline branco, ghost secundário,
`icon` 44×44), Badge (selo claro com ponto de 6 px nos status, novos `info` e `neutral`), Input/
Textarea/SelectTrigger (44 px, foco por borda, sem `ring`/`shadow-sm`), SelectItem 44 px, Label em
maiúsculas pequenas, FormMessage/FormLabel em `error-600`, RadioGroup sem sombra, EntityAvatar de
cliente redondo. `lib/field-classes.ts` com `NATIVE_SELECT_CLASS` e `FIELD_LABEL_CLASS`.

**Task 3 — Superfícies.** Card sem sombra e com padding denso, CardTitle/DialogTitle em serifa
`headline-md`; Table com cabeçalho `overline` sobre `neutral-100` e células `tabular-nums`; Dialog,
AlertDialog e Sheet com fundo `rgba(34,30,38,0.40)`, sem sombra, botão fechar de 44 px (Sheet agora
"Fechar", era "Close"); Tabs com itens de 44 px e ativo roxo/branco; DropdownMenu, Popover, Command
sem sombra e itens de 44 px; Toast sem `richColors` e sem sombra; Alert com variante `warning`;
Skeleton `neutral-100`; indicador de página do DataTable 44 px.

**Task 4 — Varredura e telas.** `sem-cor-antiga.test.ts` (4 regras + checagem de entrada sobrando)
e trocas de cor fixa: Previsão/ForecastCard (`fill={GREEN}`/`fill={RED}`), Financeiro, cores de
profissional e de status da agenda, DashboardPlaceholder, AuthCard sem `shadow-card`,
`text-red-600` → `text-error-600` (AdminClients 7x, ChangePassword 3x), ImpersonationBanner com
borda âmbar e texto `warning-700` e botão de 44 px; os 4 `SELECT_CLASS` nativos usam
`NATIVE_SELECT_CLASS` + `mt-xs`.

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (backend e frontend, 0 avisos) |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 83 arquivos, 563 testes verdes (inclui UX-01..UX-19 da fase 5) |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 38 passaram, 0 falhas, 0 flaky (6,2 min) |
| `vite build` (conferência extra) | ok; CSS gerado com Source Serif 4, `text-error-600` = rgb(186 26 26), `bg-neutral-50` = rgb(247 246 243) |

Backend não mudou; os testes de backend rodam no gate do 06-02, antes do push.

## Desvios do plano

### Corrigidos automaticamente

**1. [Regra 1 - Bug] Trava `12px` conflitava com o próprio plano**
- **Encontrado na:** Task 1
- **Problema:** o behavior proibia a string `12px` no config inteiro (raio antigo), mas o mesmo plano
  define `overline: ['12px', …]`.
- **Correção:** o teste só proíbe `4px/8px/12px` dentro do bloco `borderRadius`.
- **Arquivo:** `src/styles/__tests__/tokens-gestor-beauty.test.ts`

**2. [Regra 1 - Bug] Consulta do SelectTrigger com o Select aberto**
- **Encontrado na:** Task 2
- **Problema:** com o Select aberto o Radix marca o resto da página com `aria-hidden`, e
  `getByRole('combobox')` não achava o gatilho.
- **Correção:** `{ hidden: true }` na consulta do gatilho.

**3. [Regra 3 - Bloqueio] Import `cn` sem uso no data-table**
- **Encontrado na:** Task 3. Depois de tirar `text-label text-neutral-500` dos `TableHead`, o `cn`
  ficou sem uso e o lint falhava; o import saiu.

**4. [Regra 2] `text-warning-500` em texto, fora da lista de arquivos do plano**
- **Encontrado na:** Task 4 (passo 5 do plano). `PacoteForm.tsx:377` e
  `PackagePriceSummary.tsx:31` usavam âmbar em texto; trocados para `text-warning-700` (D-12).
  Os ícones (`TriangleAlert`, `Sparkles`) mantêm `text-warning-500`.

**5. Commit único em vez de um por tarefa**
- O plano e a regra do projeto pedem gate completo antes de commit; as quatro tarefas foram para um
  único commit `feat(06-01)` depois do gate verde.

Um erro meu durante a Task 4 (script que esvaziou `appointment-statuses.ts`) foi pego pelo
typecheck do gate, o arquivo foi restaurado do git e a troca refeita antes do commit.

## Para o 06-02

- `SOMBRA_PENDENTE` tem `components/layout/BottomNav.tsx`, `ChatBubble.tsx` e `IconRail.tsx` com o
  lote `06-02`: ao refazer o casco, tirar as sombras **e remover as três entradas**; o teste falha se
  uma entrada ficar sobrando.
- `bg-neutral-0`, `text-neutral-600/700/900` etc. já resolvem para as cores novas; `font-serif`,
  `text-headline-lg` (h1 de página) e `text-overline` (rótulo de grupo do menu) estão prontos e
  registrados no `cn`.
- O botão fechar do Sheet agora se chama "Fechar" (era "Close") e mede 44 px em `right-2 top-2`; se
  algum E2E ou teste do casco procurar "Close", trocar.
- Nada foi enviado ao remoto: push, deploy no staging e CI ficam com o 06-02, depois do gate
  completo com backend.

## Stubs conhecidos

Nenhum.

## Self-Check: PASSED

- Arquivos criados conferidos: `field-classes.ts`, `tokens-gestor-beauty.test.ts`,
  `sem-cor-antiga.test.ts`, `campos-acoes-gestor-beauty.test.tsx`, `superficies-gestor-beauty.test.tsx`.
- Commit `2e26872` presente em `master` (local, sem push).

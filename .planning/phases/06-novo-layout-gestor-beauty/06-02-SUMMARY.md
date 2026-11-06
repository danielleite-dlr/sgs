---
phase: 06-novo-layout-gestor-beauty
plan: 02
subsystem: frontend-ui
tags: [casco, navegação, gestor-beauty, menu-lateral, barra-inferior]
requires: [06-01]
provides:
  - SidebarNav de 256 px com marca do estúdio, grupos em overline, itens de 44 px e rodapé com usuária/Sair
  - TopHeader branco com data por extenso, busca, sino controlável e avatar
  - BottomNav Agenda/Comanda/Clientes/Noivas/Mais filtrada por permissão
  - AppDrawer ("Mais") com marca real, Notificações e árvore completa
  - PageHeader com h1 em serifa e trilha de 12 px sem maiúsculas
  - lib/format-date-long.ts (formatLongDate), lib/brand.ts (brandName, brandInitials, personInitials)
  - fullName na sessão do front (auth.store)
affects: [06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 06-09, 06-10]
tech-stack:
  added: []
  patterns:
    - "Componentes pequenos compartilhados do casco: BrandMark.tsx e SessionUser.tsx (menu lateral, topo e gaveta)"
    - "Botões e links do menu com aria-label={item.label}: nome acessível estável mesmo com uppercase"
    - "NotificationsBell controlado opcionalmente (open/onOpenChange) pelo AppShell"
key-files:
  created:
    - apps/frontend/src/lib/format-date-long.ts
    - apps/frontend/src/lib/brand.ts
    - apps/frontend/src/lib/__tests__/format-date-long.test.ts
    - apps/frontend/src/lib/__tests__/brand.test.ts
    - apps/frontend/src/components/layout/BrandMark.tsx
    - apps/frontend/src/components/layout/SessionUser.tsx
    - apps/frontend/src/components/layout/__tests__/casco-gestor-beauty.test.tsx
  modified:
    - apps/frontend/src/components/layout/AppShell.tsx
    - apps/frontend/src/components/layout/SidebarNav.tsx
    - apps/frontend/src/components/layout/TopHeader.tsx
    - apps/frontend/src/components/layout/BottomNav.tsx
    - apps/frontend/src/components/layout/AppDrawer.tsx
    - apps/frontend/src/components/layout/PageHeader.tsx
    - apps/frontend/src/components/layout/ChatBubble.tsx
    - apps/frontend/src/features/notifications/components/NotificationsBell.tsx
    - apps/frontend/src/infrastructure/stores/auth.store.ts
    - apps/frontend/src/features/auth/hooks/useAuth.ts
    - apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx
    - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
    - apps/e2e/support/ui.ts
    - apps/e2e/tests/ux-comanda-celular.spec.ts
    - apps/e2e/tests/ux-contraste.spec.ts
    - apps/e2e/tests/noivas-contrato.spec.ts
    - apps/e2e/audit/ux-contraste-staging.audit.ts
  removed:
    - apps/frontend/src/components/layout/IconRail.tsx
decisions:
  - "Marca do menu lateral com aria-label '<estúdio> — início' (mesmo padrão do topo do celular); E2E clica por data-testid=sidebar-brand"
  - "Rodapé de usuária (menu e gaveta) num componente único SessionUser; papel por t('team.roles.X', { defaultValue: X })"
  - "Regra nova da varredura: bg-primary-700 como fundo base proibido em components/layout (hover:bg-primary-700 continua, é o hover de D-06)"
  - "Um único commit de código depois do gate completo (regra do projeto), como no 06-01"
metrics:
  duration: 75min
  completed: 2026-11-06
  tasks: 3
  files: 25
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 02: Casco e navegação Gestor Beauty — Resumo

Menu lateral branco de 256 px com a marca do estúdio, topo branco com a data por extenso, barra
inferior do celular Agenda/Comanda/Clientes/Noivas/Mais por permissão, gaveta "Mais" com a árvore
completa e Notificações, e PageHeader com h1 em serifa. O IconRail roxo saiu. O lote base
(06-01 + 06-02) está no staging com CI verde.

## O que foi feito

**Task 1: computador.** `auth.store` guarda `fullName` (vem do payload de login/refresh, só front;
entra no `initialState`, no `platformSession` da impersonação e no `partialize`). `formatLongDate`
("Quinta-feira, 12 de novembro de 2026", fuso de São Paulo) e `brandName`/`brandInitials`/
`personInitials` em `src/lib`. `SidebarNav`: `w-64 bg-white border-r`, cabeçalho `h-14` com o
quadrado roxo da sigla e o nome em serifa, grupos de nível 0 em `text-overline uppercase` (abertos
por padrão), folhas e subgrupos de 44 px com ícone de 20 px, ativo `bg-primary text-white`,
subgrupo abre sozinho quando contém a rota atual, rodapé `bg-neutral-100` com avatar, nome
(`toDisplayName`), papel embaixo e botão Sair de 44 px. `TopHeader`: `h-14 bg-white border-b`,
data por extenso, uma única busca (320 px no computador, ícone de 44 px no celular), sino e avatar
de 44 px; saíram logo `bg-primary-700`, seletor de estabelecimento, "Assine agora" e
Ajuda/Tutoriais. `NotificationsBell` aceita `open/onOpenChange`, botão de 44 px e contador
`rounded-md bg-primary`. `AppShell`: `aside sticky top-0 h-screen w-64` + coluna com topo e conteúdo.
`IconRail.tsx` apagado; `navigateViaMenu` do E2E sem "Expandir menu".

**Task 2: celular.** `BottomNav` com Agenda, Comanda (`comanda.read`), Clientes, Noivas
(`bridal.read`) e Mais, todos `min-h-[48px]`, ativos também nas subrotas, sem sombra e sem
Início/Notificações/Menu. `AppDrawer` com a marca real (sem "Studio Beleza" nem "Trocar
estabelecimento"), botão Notificações (fecha a gaveta e abre o painel do sino), itens de 44 px,
ativo roxo cheio, rodapé com usuária e "Sair" visível. `PageHeader`: trilha `text-[12px]`, sem
`uppercase`, página atual `neutral-800`; h1 `font-serif text-headline-lg`; título/ações
`flex-col sm:flex-row`, ações `flex-wrap`. `ChatBubble` sem sombra e com raio de 6 px.
`SOMBRA_PENDENTE` sem BottomNav/ChatBubble/IconRail e regra nova contra `bg-primary-700` no casco.
E2E: "Menu" → "Mais"; `ROXOS` com `#570080`, `#440064`, `#370053`.

**Task 3: gate, comparação, commit, deploy e CI.**

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 32 suítes, 367 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 55/56 suítes, 599/601 testes; as 2 falhas são `phase4-alerts-boot` (timeout do `beforeAll` com `ReplyError: NOAUTH Authentication required` do Redis local, falha conhecida e aceita) |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 86 arquivos, 579 testes verdes (inclui UX-01..UX-19) |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 38 passaram, 0 falhas (6,0 min), na segunda rodada, depois da correção abaixo |
| Auditoria local `telas.audit.ts` | 33 passaram (16 telas × desktop/mobile + seed) |

Commit `1285a94`, push para `origin/master` (com os dois commits do 06-01), `./scripts/deploy-staging.sh`
concluído (https://sgs.jessicaseixasmakeup.com.br responde 200), CI run `42274163740` verde (lint,
typecheck, integration, e2e, boot-time, frontend-codegen).

## Comparação com o Stitch

Screenshots locais em `06-audit-evidence/06-02/` (ignorado pelo git) comparados com
`design/dashboard-desktop.png` e `design/agenda-dia-mobile.png`. Só o casco foi conferido; o
conteúdo de cada tela é de lotes seguintes.

| Elemento do design | Como ficou | Omitido por D-02? |
|--------------------|-----------|-------------------|
| Menu lateral branco 256 px, borda à direita | Igual (`desktop/16-painel.png`, `01-agenda-dia.png`) | não |
| Cabeçalho do menu: quadrado roxo "JS" + "Studio JS" em serifa | Igual, com a sigla e o nome reais ("ES" / "E2E Salao …") | não |
| "SGS ATELIER V2.4" e cadeado no cabeçalho do menu | Fora | sim (versão do sistema) |
| Grupos "OPERAÇÃO & AGENDA", "CONTROLADORIA" em maiúsculas pequenas | Grupos da árvore do SGS ("AGENDA", "MEU ESTABELECIMENTO", "FINANCEIRO", "EVENTOS") no mesmo estilo; a árvore continua a de `menu-config.ts` (D-15) | não |
| Item ativo roxo cheio com texto branco, 44 px | Igual ("Início" e "Minha agenda") | não |
| Rodapé com usuária, cargo e sair | Nome da usuária, papel ("Admin") e botão Sair, fundo `#F4F3F0` | não |
| Topo branco 56 px com borda inferior e data por extenso | Igual ("Sexta-feira, 6 de novembro de 2026") | não |
| "SISTEMA OPERACIONAL", relógio "10:42 BRT", "Atelier Jardins • Matriz" | Fora | sim |
| Busca, sino e avatar no topo | Busca "Buscar páginas no SGS" de 320 px (o design tem só o ícone), sino e avatar roxo | não |
| Celular: topo com marca + data | Igual (quadrado da sigla, nome em serifa, data truncada) | não |
| Celular: selo "SGS" e "ONLINE" no topo | Fora | sim |
| Barra inferior Agenda · Comanda · Clientes · Noivas · Mais, 48 px, ativo roxo | Igual (`mobile/01-agenda-dia.png`, `mobile/05-comanda-lista.png`), sem sombra | não |
| PageHeader: trilha pequena + h1 em serifa | Trilha 12 px sem maiúsculas (D-13; o design usa overline, mas a trilha leva nomes) e h1 Source Serif 4 26 px | não |
| Fundo `#F7F6F3`, fontes Public Sans/Source Serif 4, sem sombras | Confere | não |

Nenhuma divergência de casco a corrigir. Observações de conteúdo (não são do casco) estão em
"Para o 06-03".

## Desvios do plano

### Corrigidos automaticamente

**1. [Regra 1 - Bug] E2E clicava no logo antigo "SGS — início"**
- **Encontrado na:** Task 3 (gate E2E, `noivas-contrato.spec.ts:277`).
- **Problema:** o link "SGS — início" era o logo roxo do topo no computador, que saiu (a marca do
  computador agora fica no menu lateral).
- **Correção:** a marca do menu lateral ganhou `aria-label="<estúdio> — início"` (mesmo padrão do
  topo do celular) e o E2E clica por `getByTestId('sidebar-brand')`.
- **Arquivos:** `SidebarNav.tsx`, `apps/e2e/tests/noivas-contrato.spec.ts`.

**2. [Regra 2] Componentes compartilhados `BrandMark.tsx` e `SessionUser.tsx` e `personInitials`**
- O quadrado da marca aparece em 3 lugares e o bloco usuária/papel em 2; viraram componentes
  pequenos em `components/layout` (sem export que não seja componente). `personInitials` foi para
  `lib/brand.ts`.

**3. Avatar do topo com `aria-label="Conta"`**
- O gatilho do menu do avatar não tinha nome acessível além da inicial.

**4. Regra de `bg-primary-700` só no fundo base**
- `hover:bg-primary-700` é o hover da ação principal (D-06, `#440064`) e continua permitido; a
  regra pega só `bg-primary-700` sem variante.

**5. Commit único em vez de um por tarefa** (gate completo antes de commit, regra do projeto).

### Primeira rodada do E2E

Além da falha 1, a primeira rodada teve 2 testes com a página em branco e "session closed" do
navegador (`noivas-contrato.spec.ts:62` e `ux-comanda-celular.spec.ts:110`, UX-10). Rodados de novo,
passaram; na segunda rodada completa (depois da correção 1) foram 38 de 38.

## Para o 06-03

- `SOMBRA_PENDENTE` continua com `AppointmentCard.tsx` e `SchedulePage.tsx` (06-03) e
  `PALETA_PENDENTE` com `operations-labels.ts` (06-03): remover as entradas ao refazer a agenda.
- Na agenda (`01-agenda-dia.png`), fora do casco: botão "+ Agendar" vermelho (deveria ser a ação
  principal roxa), legenda de status em pílulas `rounded-full` coloridas, faixa azul-clara nas horas
  fora do expediente, rodapé "Meu site | SGS Ajuda | Blog | Fale conosco | Contato" com redes
  sociais (não existe no design; avaliar D-02) e o painel lateral com calendário e atalhos.
- O `main` já tem `pb-20` no celular por causa da barra inferior de 64 px; a agenda não precisa
  compensar de novo.
- A marca do menu lateral é `getByTestId('sidebar-brand')` (nome "<estúdio> — início"); no celular,
  o link do topo tem o mesmo nome. A barra inferior é `getByTestId('bottom-nav')`.
- `navigateViaMenu` não expande mais nada além dos grupos; grupos de nível 0 nascem abertos.

## Stubs conhecidos

Nenhum.

## Self-Check: PASSED

- Arquivos criados conferidos: `format-date-long.ts`, `brand.ts`, `BrandMark.tsx`,
  `SessionUser.tsx`, `casco-gestor-beauty.test.tsx`, `brand.test.ts`, `format-date-long.test.ts`;
  `IconRail.tsx` removido.
- Commit `1285a94` em `origin/master`; CI run `42274163740` com sucesso.

---
phase: 06-novo-layout-gestor-beauty
plan: 12
subsystem: frontend-ui
tags: [design-system, tailwind, paleta, previsao-de-caixa, d-26, inter]
requires: [06-01, 06-02, 06-05]
provides:
  - Tokens da Previsão de caixa do Stitch (D-26) em todo o sistema (neutral, success, error, outflow, primary-800)
  - Fonte do texto Inter; títulos e nomes de cliente em Source Serif 4 600/700 (h1/h2 em 700)
  - Raio 4/6/8 px (selo/controle/cartão) e sombra leve shadow-sm; sombras grandes viraram a leve
  - Card rounded-lg shadow-sm; tabela com cabeçalho 11 px sobre #F9FAFB e divisor #F3F4F6; selos de 4 px
  - Badge `accent` (roxo claro) novo; `destructive` virou o selo "em atraso" claro; `secondary` neutro
  - Menu lateral e gaveta: 1º nível ativo lilás com texto #370053 e ícone roxo; subitem ativo #521873 com texto branco
affects: [06-06, 06-07, 06-08, 06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "Saída/valor negativo em text-outflow-500 (#D85A30); erro de formulário continua text-error-*"
    - "Subitem de menu = nível >= 2 ou item sem ícone; item de 1º nível = item com ícone (D-26)"
    - "Sombra permitida na varredura: shadow-sm, shadow-none e o foco de campo"
key-files:
  created: []
  modified:
    - apps/frontend/tailwind.config.ts
    - apps/frontend/src/styles/globals.css
    - apps/frontend/index.html
    - apps/frontend/src/styles/__tests__/tokens-gestor-beauty.test.ts
    - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
    - apps/frontend/src/components/ui/card.tsx
    - apps/frontend/src/components/ui/table.tsx
    - apps/frontend/src/components/ui/badge-variants.ts
    - apps/frontend/src/components/ui/dialog.tsx
    - apps/frontend/src/components/ui/alert-dialog.tsx
    - apps/frontend/src/components/ui/sheet.tsx
    - apps/frontend/src/components/layout/SidebarNav.tsx
    - apps/frontend/src/components/layout/AppDrawer.tsx
    - apps/frontend/src/features/operations/lib/appointment-status-style.ts
    - apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts
    - apps/e2e/tests/ux-contraste.spec.ts
    - apps/e2e/audit/ux-contraste-staging.audit.ts
decisions:
  - "Tokens mantêm os nomes (neutral-*, primary-*, success-*, error-*) e trocam os valores; nome novo só `outflow` e `primary-800`"
  - "Subitem de menu também é a folha sem ícone do nível 1 (Financeiro > Previsão de caixa), como no Stitch"
  - "Badge secondary ficou neutro (cinza) e o roxo claro virou variante nova `accent`, para o selo 'estimada' da Previsão continuar cinza como no Stitch"
  - "Rótulo de grupo do menu em text-neutral-500 e não neutral-400 (#9CA3AF tem 2,54:1 sobre branco)"
  - "Cor de profissional verde passou a #0B7A53 (5,3:1 com texto branco); #109868 só tem 3,68:1"
metrics:
  duration: 95min
  completed: 2026-11-06
  tasks: 3
  files: 36
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 12: Paleta, linhas e fonte da Previsão de caixa (D-26) — Resumo

O SGS inteiro passou a usar o fundo `#F9FAFB`, as linhas `#E5E7EB`, o texto `#1F2937`/`#6B7280`,
o verde `#109868`, o laranja de saída `#D85A30` e a fonte Inter da tela "Previsão de Caixa -
Desktop" do Stitch. Títulos e nomes de cliente continuam em Source Serif 4. Cartões têm cantos de
8 px e sombra leve; no menu, o item de 1º nível ativo é lilás claro com texto roxo escuro e o
subitem ativo é roxo `#521873` com texto branco. Como as telas usam os tokens, nenhuma tela foi
refeita.

## O que foi feito

**Task 1: tokens, fontes e varredura.** `tailwind.config.ts`: `neutral` 0–900 da escala cinza do
Stitch, `primary` 600/700 `#4C0070` e 800 `#521873`, `success` `#109868` (700 `#0B7A53`), `error`
`#C53030` (50 `#FEF2F2`, 200 `#FECACA`, 700 `#B91C1C`), `outflow` novo (`#D85A30`, 50 `#FDF0EB`),
`destructive` e `status.missed` `#C53030`, `status.confirmed` `#109868`, `muted`/`accent`/`card`/
`popover`/`secondary` nos valores novos, `fontFamily.sans` começando com Inter, raio sm/DEFAULT 4 px,
md 6 px, lg–3xl 8 px, e `boxShadow` com só a sombra leve (`none` e `inner` zeradas).
`globals.css` com as variáveis novas, `--border: 220 13% 91%` e h1/h2 em peso 700. `index.html`
carrega Inter 400–700 e Source Serif 4 600/700. Hex antigos trocados em DashboardPlaceholder,
Previsão/ForecastCard (`GREEN #109868`, `RED #D85A30`), gráfico do Financeiro, status da agenda,
cor de ausência, grade fora do expediente e bloqueio (`#F4F3F0` → `#F3F4F6`), fundo dos diálogos
(`rgba(31,41,55,0.40)`). Valores monetários negativos em `text-outflow-500` (Financeiro, crédito
do cliente, parcelas do contrato, lucro do pacote); erros de formulário seguem `error`.
Testes: `tokens-gestor-beauty` reescrito com cada valor de D-26 (13 casos);
`sem-cor-antiga` proíbe a paleta do 06-01 (`#F7F6F3`, `#E2DFE5`, `#221E26`, `#6B6670`, `#1B7A43`,
`#BA1A1A`, `#F4F3F0`, `#CFCAD3`) e Public Sans, libera `#D85A30`, Inter e `shadow-sm`.

**Task 2: componentes e menu.** Card `rounded-lg border border-neutral-200 bg-white shadow-sm`;
TableHeader/TableHead `bg-neutral-50` com `text-[11px] font-semibold uppercase tracking-wider
text-neutral-500`, linhas `border-neutral-100 hover:bg-neutral-50/60`; Badge com raio 4 px,
`secondary` neutro (`bg-neutral-100 text-neutral-600`), `accent` roxo claro, `destructive` "em
atraso" (`bg-error-50 text-error-700 border-error-200`) e o "em atraso" da Previsão usando-o.
SidebarNav e AppDrawer com o ativo de D-26; o subgrupo que contém a rota atual (ex.: Clientes)
também fica lilás. Rótulo de grupo `text-[10px] font-semibold uppercase tracking-widest`.
Testes atualizados: casco (ativo lilás, subitem roxo, folha sem ícone roxa), superfícies, campos,
agenda (cores de status) e comanda (proíbe só `shadow`, `shadow-md/lg/xl/2xl`).

**Task 3: E2E.** `ROXOS` de `ux-contraste.spec.ts` e do audit de staging: `#570080`, `#4C0070`,
`#521873`, `#370053` (saiu `#440064`, que não existe mais). UX-01 continua: letra branca em todo
fundo roxo.

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 32 suítes, 367 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 54/56 suítes, 599/601; `phase4-alerts-boot` (2 testes, `ReplyError: NOAUTH`) e `phase3-appointments-move` ("Test suite failed to run", `NOAUTH`); esta sozinha passou 12/12. Só Redis local, aceito |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 90 arquivos, 634 testes verdes |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 38 passaram, 0 falhas (5,7 min) |

Commit `cdc24ec` em `origin/master`; `./scripts/deploy-staging.sh` concluído (backend e frontend
reiniciados; o HTML do staging já carrega Inter). Sem migration.
CI run `42304378623` verde (lint, typecheck, frontend-unit, integration, e2e, boot-time,
frontend-codegen).

## Comparação com o Stitch

Screenshots locais em `06-audit-evidence/06-12/desktop/` (ignorado pelo git; `AUDIT_TARGET=local`,
6 passaram) de Agenda, Comanda, Financeiro, Previsão (painel e detalhe) e Clientes, comparadas com
`design/previsao-computador.jpg`.

| Item do Stitch | Como ficou | Observação |
|----------------|-----------|------------|
| Fundo da página `#F9FAFB`, superfícies brancas | Igual em todas as telas | — |
| Bordas `#E5E7EB`, cartões 8 px com sombra leve | Cartões (Card) iguais; blocos montados à mão com `rounded-md` ainda têm 6 px | os lotes 06-06+ trocam por `rounded-lg` ao refazer as telas |
| Texto Inter, títulos em Source Serif 4 bold | Igual (h1/h2 700) | — |
| Cabeçalho de tabela 11 px em maiúsculas sobre `#F9FAFB` | Igual em Clientes e na Previsão | — |
| Valores `+R$` verdes e `−R$` laranja | Igual na Previsão (detalhe e painel) e nos negativos do Financeiro | — |
| Selo "EM ATRASO" vermelho claro | Variante `destructive` nova, usada na Previsão | — |
| Selo neutro "estimada — sem profissional definido" | `secondary` cinza | — |
| Menu: Financeiro lilás com texto roxo escuro | Item de 1º nível e subgrupo ativos em lilás | — |
| Subitem ativo roxo com texto branco | Folhas sem ícone e do nível 2 (Previsão de caixa, Todos os clientes, Minha agenda) | — |
| Filtro segmentado "30 dias" em `#521873` | Ainda `#570080` (botões da página) | fica para 06-07 (Previsão) e 06-06 (Entradas e saídas): usar `bg-primary-800 text-white` |
| Rótulo de grupo do menu `#9CA3AF` | `#6B7280` | contraste (ver desvios) |

## Desvios do plano

### Corrigidos automaticamente

**1. [Regra 2 - Acessibilidade] Texto legível em neutral-400**
- **Encontrado na:** Task 1
- **Problema:** `neutral-400` passou de `#6B6670` para `#9CA3AF` (2,54:1 sobre branco); dois textos
  usavam o tom (aviso em ComissoesCalculadas e horário das notificações).
- **Correção:** os dois passaram a `text-neutral-500` (4,83:1); ícones continuam em 400. O rótulo
  de grupo do menu também ficou em 500 em vez de 400.

**2. [Regra 2 - Acessibilidade] Cor de profissional verde**
- **Problema:** a cor verde de profissional (fundo com letra branca) era `#1B7A43`; com `#109868`
  ficaria 3,68:1.
- **Correção:** `#0B7A53` (success-700, 5,3:1).

**3. [Regra 1 - Coerência] Subitem pelo ícone e não só pelo nível**
- **Encontrado na:** Task 3 (conferência visual)
- **Problema:** com a regra "nível ≥ 2", "Previsão de caixa" (nível 1, sem ícone) ficava lilás,
  ao contrário do Stitch.
- **Correção:** subitem = nível ≥ 2 ou sem ícone; teste novo no casco.

**4. [Regra 1 - Coerência] Restos da paleta anterior fora da lista do plano**
- `#F4F3F0` (grade fora do expediente e bloqueio), `rgba(34,30,38,0.40)` (fundo dos diálogos) e
  `#440064` trocados; `#F4F3F0` e `#CFCAD3` entraram na varredura. A gaveta do celular (AppDrawer)
  recebeu o mesmo ativo do menu lateral.

**5. Badge `accent` em vez de `secondary` roxo.** O plano permitia `secondary`/`accent`; `secondary`
é o selo neutro da Previsão no Stitch, então o roxo virou a variante nova `accent`.

## Pendências e pontos de atenção

- **Contraste de texto pequeno:** `#109868` (3,68:1) e `#D85A30` (3,87:1) sobre branco passam para
  texto grande e elementos gráficos (3:1), mas não para texto normal (4,5:1, WCAG 1.4.3). São os
  valores escolhidos pela usuária em D-26 e estão nos valores `+R$`/`−R$` das tabelas. Decisão a
  confirmar com a usuária: manter ou escurecer só o texto pequeno (ex.: `#0B7A53` e `#B5481F`).
- Filtro segmentado selecionado (`30 dias`, `Mês atual`, `Dia`) ainda em `#570080`; o `ROXOS` do
  E2E já aceita `#521873`.

## Self-Check: PASSED

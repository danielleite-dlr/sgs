---
phase: 06-novo-layout-gestor-beauty
plan: 05
subsystem: frontend-ui
tags: [comanda, pagamento, gestor-beauty, selo-de-status, tabular-nums]
requires: [06-01, 06-02, 06-04]
provides:
  - Detalhe da comanda no layout Gestor Beauty (selo de status com ponto, cartões de largura cheia, títulos h2 em serifa)
  - Cartão da cliente com nome em serifa (toDisplayName), telefone, abertura e crédito tabulares
  - Itens em lista com divisor fino, linha secundária "profissional · 1x R$ x" e valor tabular sem quebra
  - Painel de pagamento com resumo Total/Pago/Falta/Troco em linhas com divisor, rótulos overline e "Fechar comanda" roxo de 44 px
  - Comissões em tabela com cabeçalho overline e aviso em Alert warning
affects: [06-12, 06-06]
tech-stack:
  added: []
  patterns:
    - "Selo de status no cta do PageHeader (ao lado do título no computador, abaixo no celular), mantendo data-testid"
    - "Resumo financeiro: dl com linhas flex + border-b border-neutral-200 last:border-b-0, dt overline, dd tabular-nums whitespace-nowrap"
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/comanda-gestor-beauty.test.tsx
  modified:
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
decisions:
  - "comanda-status saiu do cartão da cliente e foi para o cta do PageHeader (como no Stitch); a API do PageHeader não mudou"
  - "Falta > 0 fica text-neutral-800 font-semibold com text-headline-sm (destaque por tamanho, não por cor âmbar)"
  - "Ícones coloridos (quadrado roxo/verde) dos itens saíram; o produto aparece como 'Produto · <profissional>' na linha secundária"
  - "Remover item virou Button ghost de 44 × 44 (antes era X solto de 16 px, D-10)"
metrics:
  duration: 30min
  completed: 2026-11-06
  tasks: 3
  files: 3
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 05: Comanda no layout Gestor Beauty — Resumo

A tela da comanda ganhou a cara do Gestor Beauty: título "Comanda C-…" em serifa com o status num
selo de ponto colorido ao lado, cartões brancos de largura cheia com título em serifa e ícone
neutro, nome da cliente em serifa, itens em lista com divisor fino e valores tabulares sem quebra,
e o painel de pagamento com o resumo Total/Pago/Falta/Troco em linhas com rótulo em maiúsculas
pequenas e "Fechar comanda" roxo cheio de 44 px. Adicionar item, pagamento, crédito, fechar,
reabrir e comissões funcionam como antes; `data-testid` e papéis ARIA ficaram.

## O que foi feito

**Task 1: cabeçalho, cliente, itens e comissões (`ComandaPage.tsx`).**
- `comanda-status`: `Badge` com variant por status (`open` → `info`, `closed` → `success`,
  `cancelled` → `error`, outro → `neutral`) no `cta` do `PageHeader`, ao lado do botão
  `comanda-reopen`. Título continua `Comanda ${code}` (E2E lê o código do h1).
- Cartões com `max-w-none`; `CardTitle` (h2) em `font-serif text-headline-sm text-neutral-800`
  com ícone lucide `h-4 w-4 text-neutral-500`. Nenhum `text-base` sobrou.
- Cliente: nome `font-serif text-[17px] font-semibold` com `toDisplayName`; telefone, "Aberta às"
  e `comanda-client-credit` em `text-body tabular-nums text-neutral-500`. Nome continua sendo o
  primeiro texto do cartão (UX-08).
- Itens: contagem "N itens" ao lado do título (fora do h2, para o `getByText('Itens da comanda',
  exact)` do E2E); cada `comanda-item-<id>` com `border-b border-neutral-200 py-sm
  last:border-b-0`; nome `text-body font-medium` mantendo `min-w-0 break-words` dentro de
  `min-w-0 flex-1` (UX-09); linha secundária `text-[12px] text-neutral-500` com profissional (ou
  "Produto · profissional") e `1x R$ x` sem quebra; contrato em `Badge variant="outline"`;
  `comanda-item-valores-*` com `shrink-0 whitespace-nowrap tabular-nums font-semibold`; remover em
  `Button ghost size="icon"` (44 px). Total em serifa com valor tabular.
- "Adicionar à comanda": botões outline `min-h-[44px] justify-start` com ícone neutro. Ordem do DOM
  e `lg:col-start-*`/`lg:row-start-*` da fase 5 intactos.
- Comissões: tabela com borda, cabeçalho `bg-neutral-100 text-overline uppercase text-neutral-500`,
  valores `tabular-nums text-right whitespace-nowrap`; `comanda-commission-warning` com
  `Alert variant="warning"`.

**Task 2: pagamento (`PaymentPanel.tsx`).** Título "Pagamento" em serifa com ícone; linhas
`payment-row-*` com divisor fino, método em `text-body`, valor tabular sem quebra e remover
`h-11 w-11`; Forma/Valor com `FIELD_LABEL_CLASS` e select com `NATIVE_SELECT_CLASS` em grade
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2` (no `lg` a coluna é estreita);
`payment-add` e `payment-use-credit` com 44 px; resumo `dl` com linhas `border-b
border-neutral-200 last:border-b-0`, `dt` overline e `dd` `tabular-nums whitespace-nowrap
font-semibold`; Falta > 0 em `text-headline-sm`, Troco > 0 em `text-success-500`;
`payment-error` 12 px semibold `text-error-600`; `comanda-close` `w-full min-h-[44px]` com ícone
de check, mantendo `bg-primary text-white disabled:opacity-100` (UX-06); `close-blocked-reason`
12 px `text-neutral-500`. `payment-covered` virou faixa neutra (roxo só na ação principal, D-06).

**Teste novo:** `comanda-gestor-beauty.test.tsx` (18 casos: h1, selo por status ×3, nome em serifa,
divisores e tabular dos itens, títulos h2 e ausência de sombra, botões de adicionar, tabela e aviso
de comissões, resumo, troco, linha de pagamento, Fechar comanda, rótulos overline).
`comanda-page`, `payment-panel`, `ux-comanda-lote1` e `ux-comanda-lote2` passaram sem alteração.

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (saída 0, 0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 32 suítes, 367 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 54/56 suítes, 599/601; `phase4-alerts-boot` (2 testes, timeout do `beforeAll` com `ReplyError: NOAUTH`) e `phase4-comanda-contract` ("Test suite failed to run: Unhandled error ReplyError: NOAUTH", sem teste com falha); rodada sozinha a `phase4-comanda-contract` passou 4/4. Só Redis local, aceito |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 90 arquivos, 629 testes verdes |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 38 passaram, 0 falhas (5,7 min) |

Commit `74153bf` em `origin/master`; `./scripts/deploy-staging.sh` concluído (backend e frontend
reiniciados, https://sgs.jessicaseixasmakeup.com.br), sem migration.
CI run `42298411907` verde (lint, typecheck, frontend-unit, integration, e2e, boot-time,
frontend-codegen).

## Comparação com o Stitch

Screenshots locais em `06-audit-evidence/06-05/` (ignorado pelo git; `AUDIT_TARGET=local`,
3 passaram, sem erro de console, sem estouro horizontal, sem alvo pequeno) comparados com
`design/comanda-computador.png` e `design/comanda-celular.png`. A comanda do seed tem 1 item e
nenhum pagamento.

| Bloco do design | Como ficou | Omitido por D-02? |
|-----------------|-----------|-------------------|
| Trilha "Comandas / C-2026-014" | "Financeiro › Comandas › C-…" (trilha do SGS, UX-10) | não |
| Título "Comanda #C-2026-014" em serifa + selo "EM ATENDIMENTO" | "Comanda C-…" em serifa (sem "#", E2E) + selo com ponto ("Aberta"/"Fechada"/"Cancelada"), ao lado no computador e abaixo no celular; sem maiúsculas | não |
| "Atendimento iniciado hoje às 10:15 · Bancada 01 & Suíte VIP · Profissional principal" | "Aberta às HH:MM" no cartão da cliente; bancada/suíte fora; profissional aparece em cada item | bancada: sim |
| "IDENTIFICADOR FISCAL NFe #08821-A" e menu "⋮" | Fora | sim (NF-e fora do MVP; sem menu de ações extra) |
| Celular: "REGISTRO #C-…", "Abertura 14:15 · Bancada 03", "Atendimento presencial", data | Código fica só no h1 (UX-08 proíbe repetir no cartão); bancada e "Atendimento presencial" fora | sim |
| Celular: "Quitada / Pendente" segmentado no topo | Fora (não é filtro, só rótulo; status já está no selo) | sim |
| Ficha da cliente: nome em serifa + telefone | Igual (nome em serifa, telefone tabular) + abertura e crédito do cliente | não |
| Botão "WhatsApp" | Fora | sim (não há envio de WhatsApp pela comanda) |
| "Observações do atendimento", "Histórico rápido", "Pontualidade" | Fora | sim (não existe na consulta da comanda) |
| Borda roxa à esquerda da ficha | Fora (borda de status é só da agenda, D-11; roxo só na ação principal, D-06) | não |
| Tabela "Discriminação de Serviços & Produtos" (computador) / lista "Serviços e produtos" (celular) | Lista única nos dois tamanhos: nome, "profissional · 1x R$ x" em cinza e total à direita, divisor fino; contagem "N itens" no cabeçalho | não (lista em vez de tabela para caber na coluna do meio e manter UX-09) |
| "Estação 02", "Sala Penteados", "SKU FX-091" na linha do item | Fora; produto mostra "Produto · profissional" | sim |
| "+ Adicionar item" e atalho "⌘ + I" | Cartão "Adicionar à comanda" com serviço/produto/pacote (os três fluxos existentes); sem atalho de teclado | atalho: sim |
| Subtotal + "Total da Comanda" em serifa | "Total" em serifa com valor tabular; "Coberto pelo contrato" quando houver | não |
| "Alocação de Espaço / Transferir bancada" | Fora | sim |
| "Pagamentos lançados" com detalhe (conciliação, autorização, Stone POS, "Entrada/Saldo Balcão") | Linhas com método e valor tabular + remover de 44 px; detalhes de conciliação/autorização fora | detalhes: sim |
| "Adicionar forma de pagamento" / "Registrar pagamento" | Forma + Valor (rótulos overline) e "Adicionar" outline de 44 px; "Usar crédito do cliente" quando há crédito | não |
| Resumo "Total / Total pago / Status do saldo Falta R$ 0,00 / Situação contábil" | Total (ou "A pagar"), Pago, Falta (maior quando > 0) e Troco em linhas com divisor e rótulos overline; "Situação contábil" fora | situação: sim |
| "Conclusão de caixa" com "Demo: Liquidado / Pendente (R$ 120)" | Fora | sim (contador inventado) |
| "Fechar comanda" roxo cheio com ícone de check | Igual, `w-full` 44 px; motivo do bloqueio abaixo ("Falta R$ x para fechar") | não |
| "Todos os pagamentos foram autorizados e conciliados" | Fora (sem conciliação no SGS) | sim |
| "Comprovantes & fiscal": imprimir comprovante, enviar recibo por WhatsApp | Fora | sim |
| "Protocolo de fechamento" (libera bancada…) | Fora | sim |
| "Terminal #04 · Jardins Matriz", "Op: Juliana S.", "Operador: Recepção Central" | Fora | sim |
| Casco (Sistema operacional, relógio, unidade, "ONLINE") | Já tratado no 06-02 | sim |
| Comissões geradas (não está no design) | Mantido (existe no SGS), no mesmo padrão de cartão/tabela | não |

Divergência corrigida durante a comparação: no celular a linha secundária do item quebrava o preço
unitário ("1x R$ / 80,00"); o trecho `1x R$ x` passou a `whitespace-nowrap`. Na captura do celular a
barra inferior fixa aparece sobre o meio da página por causa da captura de página inteira (efeito
da ferramenta, não do layout).

## Desvios do plano

### Corrigidos automaticamente

**1. [Regra 2] Remover item com 44 px.** O X do item era um `button` de 16 px (abaixo do alvo de
44 px, D-10); virou `Button variant="ghost" size="icon"` com o mesmo `aria-label`.

**2. Selo de status no cabeçalho.** O plano não fixava o lugar do `comanda-status`; foi para o
`cta` do `PageHeader` (como no Stitch) sem mudar a API do componente. No cartão da cliente o nome
continua o primeiro texto (UX-08).

**3. Falta > 0 sem âmbar.** O plano pede `text-neutral-800 font-semibold`; antes era
`text-warning-700`. Para não perder o destaque, o valor cresce para `text-headline-sm`.

**4. Download do Stitch pulado.** Por instrução do orquestrador, os PNGs já estavam versionados
(`a42009a`); os HTMLs `comanda-computador.html`/`comanda-celular.html` não foram baixados e a
comparação usou só os PNGs.

**5. Commit único de código** depois do gate completo (regra do projeto).

## Para o 06-12 / 06-06

- **D-26 (06-12) muda a regra de sombra:** cartões passam a ter `shadow-sm`. O teste
  `comanda-gestor-beauty.test.tsx` ("nenhum cartão tem sombra") procura `shadow` nas classes de
  `.rounded-md.border`; com `rounded-lg shadow-sm` no `Card` ele precisará ser ajustado (trocar a
  checagem para "sem sombra difusa", ex.: proibir `shadow-md|lg|xl`). Mesma coisa para os testes de
  sombra dos lotes 06-03/06-04, se existirem.
- O resumo do pagamento usa só tokens (`border-neutral-200`, `text-neutral-500/800`,
  `text-success-500`); mudando os valores dos tokens no 06-12, a comanda acompanha sem editar a tela.
- Padrão de resumo financeiro (`dl` com linhas de divisor, `dt` overline, `dd` tabular sem quebra)
  serve para os totais de Entradas e saídas (06-06).
- `ProfessionalSegmented` não foi extraído (a comanda não precisou).

## Stubs conhecidos

Nenhum.

## Self-Check: PASSED

- Arquivos conferidos: `comanda-gestor-beauty.test.tsx`, `design/comanda-computador.png`,
  `design/comanda-celular.png`.
- Greps de aceite: `font-serif` no nome da cliente e nos títulos; nenhum `text-base` em
  `ComandaPage.tsx` nem em `PaymentPanel.tsx`; `tabular-nums` em 5 linhas do `PaymentPanel.tsx`.
- Commit `74153bf` em `origin/master`; CI run `42298411907` com sucesso.

---
phase: 06-novo-layout-gestor-beauty
plan: 04
subsystem: frontend-ui
tags: [agenda, novo-agendamento, gestor-beauty, radiogroup, sinal]
requires: [06-01, 06-02, 06-03]
provides:
  - VisitFormDialog no layout Gestor Beauty (título em serifa, rótulos em overline, fechar único de 44 px)
  - Faixa de chips de serviço com nome e preço, contagem "N selecionado(s)" e "Adicionar serviço"
  - ProfessionalSegmented (radiogroup WAI-ARIA, tabIndex móvel, setas com volta) para até 4 profissionais
  - Grade visit-when (Data, Hora, Duração em grid-cols-12) na linha 0
  - Seção "Sinal" recolhida (visit-deposit-toggle) com resumo "R$ x por <forma>"
  - E2E pickProfessional(page, line, id) e openDeposit(page) em apps/e2e/support/agenda-ui.ts
affects: [06-05, 06-09]
tech-stack:
  added: ["@testing-library/user-event ^14.6.8 (devDependency do frontend)"]
  patterns:
    - "Controle segmentado acessível: role=radiogroup + aria-label, role=radio + aria-checked, tabIndex móvel, onKeyDown no grupo"
    - "Helper E2E tolerante à troca select <-> segmentado: expect(...).toPass() até a escolha ficar marcada"
    - "DialogContent com p-0/gap-0 precisa de sm:p-0 sm:gap-0 max-sm:gap-0 (cn não funde tokens de espaço)"
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx
    - .planning/phases/06-novo-layout-gestor-beauty/deferred-items.md
  modified:
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/operations/__tests__/visit-form-dialog.test.tsx
    - apps/frontend/package.json
    - pnpm-lock.yaml
    - apps/e2e/support/agenda-ui.ts
    - apps/e2e/tests/agenda-concorrencia.spec.ts
    - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
    - apps/e2e/audit/fluxos-escrita.audit.ts
decisions:
  - "Limite do controle segmentado em 4 profissionais visíveis (depois do filtro por serviço); com 0 ou mais de 4 fica o select"
  - "Cliente escolhido mostrado em faixa própria (visit-client-selected) com nome em serifa e telefone; o texto 'Cliente selecionado:' ficou só para leitor de tela"
  - "Sinal reabre aberto quando já há valor; o botão mostra o resumo 'Sinal (opcional): R$ 50,00 por Pix'"
  - "Aviso 'Role para ver mais campos' sem gradiente (D-09): faixa branca com borda superior"
  - "Pacote numa linha própria depois do erro e antes do Sinal"
metrics:
  duration: 110min
  completed: 2026-11-06
  tasks: 2
  files: 10
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 04: Novo agendamento no layout Gestor Beauty — Resumo

O formulário "Cadastrar agendamento" (folha de tela cheia no celular, diálogo no computador) ganhou
a cara do Gestor Beauty: título em serifa com "Preencha os detalhes do atendimento", rótulos em
maiúsculas pequenas, chips dos serviços escolhidos com preço, profissional em controle segmentado
roxo, Data/Hora/Duração na mesma grade, erro escrito logo abaixo dos serviços, "Sinal" recolhido e
"Salvar" roxo de 44 px no rodapé. Mutations, validações, cálculo de duração, cadastro rápido de
cliente, pacote e sinal não mudaram.

## O que foi feito

**Task 1: formulário.** `LABEL_CLASS = FIELD_LABEL_CLASS` e "(opcional)" em `normal-case
font-normal`. `DialogContent` mantém `h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto
sm:max-h-[90vh]` (UX-03), passa a `sm:rounded-md` e zera padding/gap herdados. Cabeçalho branco
com `DialogTitle` `font-serif text-headline-md` (sem `uppercase`) e descrição visível de 12 px.
Busca de cliente com opções de 44 px (nome via `toDisplayName` e telefone tabular); cliente
escolhido em `visit-client-selected` com nome em serifa e telefone. Seção "Serviço" com a contagem
`visit-service-count` em roxo, faixa `visit-service-chips` (chips de 34 px com nome e `R$ x,xx`
tabular) e `visit-add-line` como chip tracejado de 44 px. Cada linha de serviço em cartão branco com
os selects de serviço/variação, remover de 44 × 44, profissional e a grade de horário.
`ProfessionalSegmented`: até 4 profissionais visíveis, `role="radiogroup" aria-label="Profissional"`,
opções `role="radio"` de 44 px (marcada `bg-primary text-white font-semibold`), tabIndex móvel,
setas direita/baixo e esquerda/cima com volta, foco acompanha a escolha e usa o mesmo handler do
select (sugestão de variação por senioridade incluída). Linha 0 com `visit-when` em `grid-cols-12`
(Data 12/5, Hora 6/4, Duração 6/3); demais linhas com Hora e Duração 6/6. `visit-error` com
`role="alert"`, ícone e `text-error-600` logo depois dos serviços. Pacote em linha própria.
"Sinal" em bloco `bg-neutral-100` com `visit-deposit-toggle` (`aria-expanded`, 44 px, chevron) e
conteúdo só quando aberto. `visit-notes` ganhou `data-testid`. Rodapé branco com "Cancelar"
(outline) e `visit-submit` no tamanho padrão, `flex-1 sm:flex-none`.

Testes: `novo-agendamento-gestor-beauty.test.tsx` (13 testes: título/fechar, rótulos, chips e
contagem, prefixo `appointment-card-`, radiogroup com 2, select com 5, tabIndex móvel, teclado com
`userEvent.keyboard`, grade, posição do erro, Salvar, Sinal recolhido e reaberto).
`visit-form-dialog.test.tsx` passou a conferir `visit-client-selected`.
`visit-form-scroll.test.tsx` e `ux-agenda-lote1.test.tsx` sem alteração.

**Task 2: E2E, gate, comparação, commit, deploy e CI.** `pickProfessional` (select ou
segmentado, com `toPass` porque a lista troca quando `professionalsForService` volta) e
`openDeposit` em `support/agenda-ui.ts`; usados em `agenda-concorrencia`, `fluxo-agendamento-
comanda-pagamento` (com `openDeposit` antes do valor do sinal) e `audit/fluxos-escrita`.

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 32 suítes, 367 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 55/56 suítes, 599/601; as 2 falhas são `phase4-alerts-boot` (timeout do `beforeAll` com `ReplyError: NOAUTH Authentication required`, Redis local, aceita) |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 88 arquivos, 612 testes verdes; repetido depois da correção do padding: 88/612 verdes |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 38 passaram, 0 falhas (6,0 min); depois da correção do padding, `ux-agenda-celular` (UX-02, UX-03), `ux-contraste` (UX-01), `agenda-concorrencia` e `fluxo-agendamento-comanda-pagamento`: 7/7 |

Commit `3e58324` em `origin/master`; `./scripts/deploy-staging.sh` concluído (backend e frontend
OK, https://sgs.jessicaseixasmakeup.com.br), sem migration. CI run `42290755959` verde.

## Comparação com o Stitch

Screenshots locais em `06-audit-evidence/06-04/` (ignorado pelo git; `AUDIT_TARGET=local`,
3 passaram) comparados com a estrutura de `design/novo-agendamento-desktop.html` e
`design/novo-agendamento-mobile.html` (não há PNG desta tela). A auditoria abre o formulário com a
busca "ana" sem resultado, então os chips aparecem vazios ("0 selecionados"); chips e Sinal foram
conferidos pelos testes.

| Bloco do design | Como ficou | Omitido por D-02? |
|-----------------|-----------|-------------------|
| Título "Novo agendamento" em serifa + subtítulo | "Cadastrar agendamento" em Source Serif 20 px (título fixo pelos testes) + "Preencha os detalhes do atendimento" | não |
| Fechar de 44 px | Um único X de 44 px (UX-04) | não |
| Cliente com ícone, nome em serifa, telefone e "Trocar cliente" | Busca de 44 px; escolhido mostra nome em serifa e telefone tabular; trocar = digitar de novo na busca | não (botão "Trocar" não entrou; a busca já faz isso) |
| Selo do cliente ("NOIVA"/"VIP") | Fora | sim (não existe dado) |
| "SERVIÇO" + "N selecionados" | Igual, contagem em overline roxo | não |
| Chips de serviço com preço e check | Chips de 34 px com nome e preço tabular (sem check: só mostram o escolhido; o catálogo não vira chip porque a escolha continua no select da linha) | não |
| Chip "Adicionar" | "Adicionar serviço" tracejado de 44 px | não |
| Profissional segmentado (2 colunas, ícone/ponto, "(Ativa)") | Segmentado de até 4 colunas, selecionado roxo com texto branco (D-06, em vez do branco com sombra do design) | "(Ativa)" e ícone fora |
| Data / Hora / Duração em 12 colunas | Igual no computador (5/4/3); no celular Data ocupa a linha e Hora/Duração dividem a de baixo | não |
| Hora em vermelho e "Camila já tem horário às 14:20…" | Erro do servidor/validação em `visit-error` vermelho com ícone, logo abaixo dos serviços; o campo Hora não fica vermelho (o conflito só é conhecido no salvar) | não |
| Sinal recolhido com resumo "R$ 100,00 por Pix" | Igual, "Sinal (opcional)" + resumo quando há valor; abre para valor e forma | não |
| "Comprovante ID", "Recebido em", selo "PAGO" | Fora | sim (não existe dado no formulário) |
| Rodapé "Salvar agendamento" + aviso de conflito | "Cancelar" + "Salvar" roxo 44 px; botão não fica desabilitado por conflito (não há checagem prévia) | parcial |
| Folha com cantos superiores arredondados (celular) | Tela cheia (UX-03 exige corpo ≥ 60% da altura) | não (regra da fase 5 prevalece) |
| Variante de preço, Pacote, Observações | Mantidos (existem no SGS, não estão no design) | não |

Divergência corrigida durante a comparação: no computador o diálogo ainda tinha 24 px de padding e
16 px de gap herdados do `DialogContent` (cabeçalho recuado, borda curta) — ver desvio 3.

## Desvios do plano

### Corrigidos automaticamente

**1. [Regra 3 - Bloqueio] `@testing-library/user-event` não estava instalado**
- O plano pede `userEvent.keyboard` no teste do radiogroup; o pacote não existia no frontend.
- Adicionado como devDependency `^14.6.8` (lockfile conferido com `pnpm install --frozen-lockfile`).

**2. [Regra 1] Texto "Cliente selecionado: Ana Lima" quebrado em trechos**
- O nome em serifa e o telefone viraram `span`s separados; o teste passou a usar
  `visit-client-selected` com `toHaveTextContent` e o componente ganhou os espaços explícitos
  (leitor de tela lê "Cliente selecionado: Ana Lima · (11) 98765-4321").

**3. [Regra 1] Padding e gap herdados do diálogo no computador**
- `cn('… gap-md p-lg', 'gap-0 p-0')` mantém `gap-md p-lg` (o tailwind-merge não conhece os tokens
  de espaço do tema) e no CSS eles vencem. Correção local: `sm:p-0 sm:gap-0 max-sm:gap-0` e teste.
  O conserto global no `cn` ficou em `deferred-items.md`.

**4. [Regra 2] Aviso de rolagem sem gradiente** (D-09): faixa branca com borda superior; texto e
comportamento iguais (UX-03 verde).

**5. Referências PNG do Stitch não baixadas**: por instrução do orquestrador, a comparação usou os
HTMLs já versionados; `novo-agendamento-celular.png`/`-computador.png` não existem.

**6. Commit único de código** depois do gate completo (regra do projeto).

## Para o 06-05

- `cn` não funde `p-*`/`gap-*`/`m-*` com tokens do tema (`xs…3xl`): em `DialogContent`/`SheetContent`
  com `p-0` use também `sm:p-0` (e `gap-0` com variantes), ou resolva o item de `deferred-items.md`.
- `@testing-library/user-event` está disponível para testes de teclado.
- Padrão de radiogroup segmentado em `ProfessionalSegmented` (dentro do `VisitFormDialog.tsx`); se a
  Comanda precisar de um, vale extrair para `components/ui`.
- `BuscarAgendarModal` e `SelecaoProfissionaisModal` da `SchedulePage` continuam com cabeçalho
  `text-sm font-bold uppercase` e fechar `h-8 w-8` (este lote não mexeu na `SchedulePage`).
- Nenhum `data-testid` novo começa com `appointment-card-` (há teste para isso no formulário).

## Stubs conhecidos

Nenhum.

## Self-Check: PASSED

- Arquivos conferidos: `novo-agendamento-gestor-beauty.test.tsx`, `deferred-items.md`,
  `VisitFormDialog.tsx` com `role="radiogroup"`, `visit-deposit-toggle` e `visit-service-chips`;
  sem `uppercase tracking-wide`; sem `selectOption` de profissional nos E2E.
- Commit `3e58324` em `origin/master`; CI run `42290755959` com sucesso (lint, typecheck, integration, e2e, boot-time, frontend-codegen, frontend-unit).

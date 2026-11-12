---
phase: 06-novo-layout-gestor-beauty
plan: 08
subsystem: frontend-ui
tags: [financeiro, despesas-fixas, gestor-beauty, d-26, d-27]
requires: [06-07, 06-12]
provides:
  - Despesas fixas no layout Gestor Beauty (total mensal das ativas, tabela do componente Table, selos com ponto, ações de 44 px)
  - Slug de auditoria `18-financeiro-despesas-fixas` em `apps/e2e/audit/telas.audit.ts`
affects: [06-09, 06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "Total de saída em text-outflow-700 (22 px), como os totais da Previsão; error-* só em erro de formulário e na ação Excluir"
    - "Tabela larga dentro de bloco overflow-x-auto com min-w e ações sem quebra: no celular rola de lado em vez de empilhar botões"
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/despesas-fixas-gestor-beauty.test.tsx
  modified:
    - apps/frontend/src/features/operations/pages/DespesasFixasPage.tsx
    - apps/e2e/audit/telas.audit.ts
decisions:
  - "Total mensal das ativas em text-outflow-700 e 22 px (não text-error-500 e 20 px do plano): é saída (D-26) e contraste-valores.test.ts proíbe outflow-500/600"
  - "Selo Inativa com a variante `neutral` existente (ponto status-done #49454F, grafite); nenhuma variante nova"
  - "Tabela com o componente Table do 06-12 (cabeçalho 11 px em maiúsculas sobre neutral-50), não thead bg-neutral-100/text-overline do plano"
  - "Excluir como Button ghost em text-error-600 (ação destrutiva); Editar e Ativar/Desativar outline"
metrics:
  duration: 80min
  completed: 2026-11-12
  tasks: 2
  files: 3
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 08: Despesas fixas no layout Gestor Beauty: resumo

A tela de Despesas fixas ganhou o padrão Gestor Beauty com a paleta de D-26 e o contraste de D-27.
Acima da tabela há um bloco branco com "Total mensal (ativas)" em maiúsculas pequenas e o valor
tabular de 22 px em laranja de saída (`text-outflow-700`), somado em centavos a partir da lista já
carregada (sem consulta nova). A tabela usa o componente `Table` do 06-12, com valor tabular à
direita sem quebra, "dia N" tabular em cinza, situação como selo com ponto (Ativa verde, Inativa
grafite) e ações de 44 px; "Excluir" fica em vermelho. No celular a tabela rola de lado. O diálogo
tem rótulos em maiúsculas pequenas e erros de 12 px. Criar, editar, ativar/desativar e excluir não
mudaram.

## O que foi feito

**Task 1: teste, página e slug de auditoria**
- `despesas-fixas-gestor-beauty.test.tsx` (7 casos, escrito antes e falhando 6 de 7): total
  `R$ 1.620,00` (duas ativas, uma inativa ignorada) em `tabular-nums whitespace-nowrap
  text-outflow-700` sem `text-error-*`, bloco `rounded-lg shadow-sm`; sem total com lista vazia;
  cabeçalhos do `Table` (`uppercase text-neutral-500 bg-neutral-50`), Valor `text-right`, tabela
  `min-w-[640px]` em caixa `overflow-x-auto`; selo `before:bg-success-500` / `before:bg-status-done`;
  botões `min-h-[44px]` com os nomes acessíveis atuais e Excluir em `text-error-600`; texto de apoio
  `text-body text-neutral-500`; diálogo com rótulos `text-overline uppercase`, valor `tabular-nums` e
  erros `text-[12px] text-error-600`.
- `DespesasFixasPage.tsx`:
  - raiz `flex flex-col gap-md`, texto de apoio `-mt-md text-body text-neutral-500` (como no 06-07);
  - `BLOCK_CLASS = 'rounded-lg border border-neutral-200 bg-white shadow-sm'` para total, tabela,
    estado vazio e sem acesso;
  - `monthlyTotal = sumDecimals(ativas.map(amount))` de `lib/money.ts` (centavos inteiros);
  - `Table`/`TableHead`/`TableCell`; Nome `min-w-[160px] font-medium text-neutral-800`; Valor
    `text-right tabular-nums whitespace-nowrap`; dia `tabular-nums whitespace-nowrap text-neutral-500`;
    cabeçalho "Vence todo dia" sem quebra; ações em `flex gap-xs` sem `flex-wrap`;
  - `Badge` `success` / `neutral`; botões sem `size="sm"`; Excluir `ghost` com
    `text-error-600 hover:bg-error-50 hover:text-error-700`; "Tentar novamente" no tamanho padrão;
  - diálogo: `FIELD_ERROR_CLASS = 'text-[12px] leading-4 font-semibold text-error-600'`, "Situação"
    com `FIELD_LABEL_CLASS`, opções Ativa/Inativa em texto comum (`normal-case`), valor `tabular-nums`,
    ajuda do dia em 12 px.
- `telas.audit.ts`: teste `18-financeiro-despesas-fixas` depois de `17-financeiro-previsao`.
- `fixed-expenses-page.test.tsx` e o E2E `financeiro-previsao.spec.ts` (que cadastra e exclui despesa
  fixa pela UI) passaram sem alteração.

**Task 2: gate, comparação, commit, deploy e CI.** Ver abaixo.

## Resultados do gate (antes do commit, depois da última mudança de código)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde (backend, frontend, e2e) |
| `corepack pnpm -r --if-present lint` | verde (saída 0, 0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 34 suítes, 382 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 56/56 suítes, 609/609 testes verdes |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 101 arquivos, 733 testes verdes |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 44 passaram, 0 falhas (6,8 min) |

O ajuste do celular (ver desvio 5) foi feito antes do gate; nenhuma mudança de código depois dele.

## Commit, deploy e CI

Commit `8593862` em `origin/master`. `./scripts/deploy-staging.sh` terminou sem erro (backend e
frontend reiniciados, sem migration nova; nenhum dado do staging foi tocado). CI run
`43146652884` verde na primeira tentativa (lint, typecheck, frontend-unit, integration, e2e,
boot-time, frontend-codegen).

## Comparação com o Stitch

O MCP do Stitch não estava disponível nesta execução e não há referência de Despesas fixas em
`design/` (ver desvios). A comparação foi feita contra o 06-UI-SPEC §4, a tela "Previsão de Caixa -
Desktop" (`design/previsao-computador.jpg`, mesma linguagem) e o que o plano descreve da tela
`3a05c509377a41b3ab728925631a9170`.

Screenshots locais em `06-audit-evidence/06-08/` (ignorados pelo git; `AUDIT_TARGET=local`):
`desktop|mobile/18-financeiro-despesas-fixas.png` (slug oficial, 3 passaram; a organização de
auditoria local não tem despesas, então mostra o estado vazio) e `desktop|mobile/18-com-dados.png` e
`18-dialogo-erro.png`, de um audit temporário (não commitado) que cadastrou 3 despesas no banco local,
fotografou e excluiu.

| Bloco | Como ficou | Omitido por D-02? |
|-------|-----------|-------------------|
| Título "Despesas fixas" em serifa + "Nova despesa fixa" | Igual (PageHeader); no celular o botão fica abaixo do título | não |
| Resumo com total mensal | Bloco branco: "TOTAL MENSAL (ATIVAS)" e `R$ 1.620,00` em laranja 700, 22 px | não |
| Tabela Nome/Valor/Vence/Situação/Ações, cabeçalho 11 px sobre `#F9FAFB` | Igual (componente `Table`); valor tabular à direita, "dia N" cinza | não |
| Situação como selo | Ponto verde "Ativa" e ponto grafite "Inativa" | não |
| Ações da linha | Editar e Ativar/Desativar outline 44 px; Excluir em texto vermelho | não |
| Formulário em diálogo | Rótulos em maiúsculas pequenas, erro vermelho de 12 px, rodapé Cancelar/Salvar | não |
| Celular | Tabela rola de lado (Situação e Ações à direita); sem cartões duplicados | não (pedido do plano) |
| Categorias, centro de custo, fornecedor, anexos/comprovantes | — | sim |
| Recorrência diferente de mensal, "pago no mês" | — | sim |
| "Exportar", meta, seletor de unidade | — | sim |

## Desvios do plano

1. **[Correção do orquestrador D-26/D-27] Cor e tamanho do total.** O plano pedia
   `text-[20px] … text-error-500`. Ficou `text-[22px] leading-7 … text-outflow-700`: total mensal é
   saída, `contraste-valores.test.ts` proíbe `text-success/outflow-500/600`, e 22 px é o tamanho dos
   totais da Previsão (06-07). `text-error-*` só aparece nos erros de formulário e no Excluir.
2. **Decisões do 06-12/06-07 sobre o plano:** blocos `rounded-lg … shadow-sm` (não `rounded-md`
   sem sombra), padding `p-md` no resumo (não `p-sm`); cabeçalho do componente `Table` (`text-[11px]
   font-semibold uppercase tracking-wider text-neutral-500` sobre `bg-neutral-50`) em vez de
   `thead bg-neutral-100` + `th text-overline` — o teste checa as classes do `Table`. Texto de apoio
   com `-mt-md`, como no 06-07 (o plano pedia sem margem negativa).
3. **Selo Inativa.** A variante `neutral` existe em `badge-variants.ts` com
   `before:bg-status-done` (`#49454F`, grafite), como o plano pedia; usada sem mudança.
4. **Referência do Stitch não baixada.** Nesta execução não havia ferramenta do MCP do Stitch
   (nem ToolSearch para carregá-la), então `design/despesas-fixas-computador.html` e `.png` não foram
   criados e não existe referência de Despesas fixas em `design/`. Comparação feita contra o 06-UI-SPEC
   e a Previsão de caixa do Stitch (tabela abaixo). Pendente: baixar a tela
   `3a05c509377a41b3ab728925631a9170` e conferir quando o MCP estiver disponível.
5. **[Regra 1] Linhas altas no celular.** Na comparação, as ações quebravam em coluna
   (`flex-wrap`) e cada linha ficava com ~130 px; o cabeçalho "Vence todo dia" quebrava em duas
   linhas e os nomes também. Ações sem quebra, cabeçalho `whitespace-nowrap` e Nome `min-w-[160px]`:
   a tabela rola de lado e as linhas ficam compactas.
6. **Extras pequenos dentro do escopo:** "Situação" do diálogo com o rótulo padrão (era
   `text-sm font-medium`); opções Ativa/Inativa em texto comum (o `Label` padrão agora é
   maiúsculo); ajuda do dia em 12 px.

## Known Stubs

Nenhum.

## Self-Check: PASSED

---
phase: 05-uso-no-dia-a-dia
plan: 15
subsystem: frontend-ux
tags: [ux, clientes, celular, cartões, nomes]
requires: [05-07, 05-08, 05-14]
provides: [UX-15, UX-16 (parcial) corrigidos no staging]
key-files:
  created:
    - apps/frontend/src/pages/__tests__/clientes-page.test.tsx
    - apps/e2e/tests/ux-clientes-lista.spec.ts
  modified:
    - apps/frontend/src/pages/ClientesPage.tsx
    - apps/frontend/src/pages/ClienteDetailPage.tsx
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/bridal/pages/ContractsPage.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
    - apps/frontend/src/features/bridal/__tests__/contracts-page.test.tsx
    - apps/e2e/tests/ux-agenda-celular.spec.ts
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
decisions:
  - "UX-15: nome da cliente é Link para /clientes/<id>; a linha já tinha cursor-pointer e hover:bg-neutral-50 no DataTable quando há onRowClick, então o DataTable não mudou"
  - "UX-15: E-mail e CPF só aparecem se pelo menos uma cliente da página carregada tiver o dado"
  - "UX-15: abaixo de md, cartões (cliente-card) com nome em link, telefone formatado e menu Ações; como a paginação do DataTable fica escondida junto da tabela, os cartões têm paginação própria (Anterior / Página x de y / Próximo)"
  - "UX-16: toDisplayName só na exibição (lista, cartões, confirmação e toasts de exclusão, título e campo Nome da ficha, cartão Cliente da comanda, coluna Cliente do financeiro, coluna da noiva em contratos); nada é regravado e a busca não mudou"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 15: Clientes (UX-15, UX-16 parcial) Summary

Na lista de clientes o nome virou link azul-roxo para a ficha, a linha reage ao mouse e as colunas E-mail e CPF somem quando ninguém da página tem o dado. No celular a lista aparece em cartões com nome, telefone e o menu Ações, sem coluna cortada e sem rolagem lateral. Os nomes de cliente aparecem com a mesma caixa ("Maria Silva") na lista, na ficha, na comanda, no financeiro e nos contratos, sem regravar nada no banco.

## Commits

- b231240: fix(05-15) correção do lote (UX-15, UX-16), com testes
- 94a2a24: test(05-15) UX-02 mede os filtros só depois da animação do painel
- 5ae8d22: docs(05-15) hash na auditoria
- 08931f2: test(05-15) UX-16 confere a grafia em maiúsculas com comparação exata
- commit final de docs: SUMMARY, STATE e ROADMAP

## Testes de regressão

- `clientes-page.test.tsx` (6 testes, todos falhavam antes): nome como link com href da ficha e linha com `cursor-pointer hover:bg-neutral-50`; E-mail/CPF ocultos quando vazios e visíveis quando alguém tem; cartões em `md:hidden` e tabela em `hidden md:block`; "MARIA SILVA" e "maria silva" viram "Maria Silva"; título da ficha "Maria da Silva".
- `comanda-page`, `financeiro-page`, `contracts-page`: um teste novo cada, nome em caixa normal (falhavam antes).
- `ux-clientes-lista.spec.ts` (Playwright 412x915): cliente criada em MAIÚSCULAS aparece em cartão com nome padronizado, tabela escondida, sem rolagem horizontal; o link abre a ficha com o título padronizado.

## Gate

- typecheck e lint (-r): limpos
- Frontend: 79 arquivos, 524 testes. Backend unit: 367 de 367
- Backend integração: 599 de 601. As 2 falhas são `phase4-alerts-boot` e `phase4-schema-smoke`, ambas `NOAUTH` do Redis local (o lote não toca o backend; no CI passam)
- E2E completo: 38 de 38 depois do ajuste do UX-02 (ver Deviations)
- Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration)
- CI na master: verde (run 42244360642 em 08931f2, todos os jobs com sucesso)

## Deviations from Plan

1. **DataTable sem `rowClassName`.** O plano previa uma prop nova; o DataTable já aplica `cursor-pointer hover:bg-neutral-50` quando há `onRowClick`. Nada mudou nele.
2. **Paginação própria nos cartões (Regra 2).** Esconder a tabela no celular escondia também a paginação; os cartões ganharam Anterior/Próximo.
3. **UX-02 no E2E (Regra 1, teste).** Voltou a falhar localmente com 43,99998 px. Causa: o painel de filtros é um Sheet que entra deslizando e o teste media no meio da animação (deslocamento fracionado). O teste agora espera `getAnimations()` terminar antes de medir; passou 3 vezes seguidas e no CI.
4. **E2E do UX-16 no CI (Regra 1, teste).** `getByText(raw)` sem `exact` ignora a caixa e casava com o nome já padronizado; passou a usar `exact: true`.

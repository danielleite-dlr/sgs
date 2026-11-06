---
phase: 05-uso-no-dia-a-dia
plan: 11
subsystem: frontend-ux
tags: [ux, comanda, caixa, lista, telefone, nomes]
requires: [05-07, 05-08, 05-10]
provides: [UX-06, UX-07, UX-08 corrigidos e verificados no staging]
key-files:
  created:
    - apps/frontend/src/lib/format-phone.ts
    - apps/frontend/src/lib/format-name.ts
    - apps/frontend/src/lib/__tests__/format-phone.test.ts
    - apps/frontend/src/lib/__tests__/format-name.test.ts
    - apps/frontend/src/features/operations/__tests__/ux-comanda-lote1.test.tsx
    - apps/frontend/src/features/operations/__tests__/comanda-list-page.test.tsx
    - apps/e2e/tests/ux-comanda-lista.spec.ts
    - apps/e2e/audit/ux-comanda-staging.audit.ts
  modified:
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/features/operations/pages/ComandaListPage.tsx
    - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
    - .planning/phases/05-uso-no-dia-a-dia/deferred-items.md
decisions:
  - "Causa da lista estreita: o Card base tem max-w-[400px]; corrigido só na lista de comandas (max-w-none). Mudar o Card base ficou em deferred-items para aprovação"
  - "Botão 'Fechar comanda' pronto fica em cor cheia também enquanto uma ação está salvando (disabled:opacity-100 + aria-busy); o visual pálido só aparece quando está realmente bloqueado, sempre com o motivo embaixo"
  - "Comanda sem itens mostra 'Adicione ao menos um item para fechar' (o backend recusa com EMPTY_COMANDA)"
  - "formatPhoneBr e toDisplayName ficam em apps/frontend/src/lib para reaproveitar no lote 05-15"
metrics:
  tasks: 3
  completed: 2026-11-06
  duration: ~75min
---

# Phase 5 Plan 11: Comanda e caixa, lote 1 (UX-06, UX-07, UX-08) Summary

O botão "Fechar comanda" fica em roxo cheio quando dá para fechar (inclusive enquanto salva) e, quando está bloqueado, diz por quê ("Falta R$ 135,00 para fechar" ou "Adicione ao menos um item para fechar"). A lista de comandas usa a largura da tela (1188 px de 1254 px no staging, antes 334 px), com código, data e valores em uma linha e nomes em caixa normal. O cartão "Cliente" começa pelo nome e mostra o telefone como (11) 98888-7777. Está no staging com CI verde.

## Commits

- dff8996: fix(05-11) correção do lote (UX-06, UX-07, UX-08)
- dae2cdc: docs(05-11) hashes na auditoria
- commit final de docs: SUMMARY, verificação no staging na auditoria, STATE e ROADMAP

## Testes de regressão

- `format-phone.test.ts`: +55 com 13 dígitos, 11 dígitos, fixo com 10, texto com espaços e traço, fixo com 55, formatos desconhecidos voltam como vieram, vazio/nulo (falhava: módulo não existia)
- `format-name.test.ts`: "MARIA DA SILVA" vira "Maria da Silva", acentos, partículas, espaços repetidos, vazio (falhava: módulo não existia)
- `ux-comanda-lote1.test.tsx`: motivo "Falta R$ 135,00 para fechar" com `data-testid="close-blocked-reason"`; comanda vazia com "Adicione ao menos um item para fechar"; cor cheia e `aria-busy` enquanto salva; cartão "Cliente" começa pelo nome, telefone formatado, sem o código. 4 de 5 falhavam antes; o caso "habilitado com bg-primary/text-white" já passava (o botão já usava a variante cheia) e fica como trava
- `comanda-list-page.test.tsx`: nome em caixa normal, `whitespace-nowrap` no código, na data e nos cabeçalhos, cartão com `max-w-none` (falhava)
- `ux-comanda-lista.spec.ts` (Playwright, 1366x768): falhou antes com "tabela 334px de 1254px"; passa depois, com o código em uma linha e nome em caixa normal

## Gate

- typecheck e lint (-r): limpos
- Frontend: 73 arquivos, 490 testes. Backend unit: 367 de 367
- Backend integração: 599 de 601; as 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local NOAUTH, conhecida e aceita; CI cobre)
- E2E completo: 33 de 33 (rodado sozinho)
- CI na master: verde (run 42199580719 em dae2cdc). Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration, sem backup necessário)

## Verificação no staging (somente leitura, usuário de auditoria, computador 1366x768)

`audit/ux-comanda-staging.audit.ts` com o guard de mutação (nada bloqueado; só navegou, não fechou comanda nem registrou pagamento):
- UX-07: tabela com 1188 px de 1254 px úteis; 1 comanda no período, código com 43 px de altura (uma linha); 0 nomes todo em maiúsculas
- UX-08: cartão "Cliente" não repete o código; telefone no formato (DD) NNNNN-NNNN
- UX-06: a comanda aberta do staging ainda tem saldo, então o botão aparece bloqueado (opacidade 0,5) com o motivo visível. O estado "pronto para fechar" não pode ser criado no staging sem registrar pagamento; foi coberto no Vitest e no E2E local
- Capturas em `05-audit-evidence/desktop/05-11-*.png` (fora do git, como as demais evidências). O script não registra nomes nem telefones

## Deviations from Plan

- [Rule 1 - Bug] A causa provável do botão "pálido" com Falta R$ 0,00 era o estado `busy` (qualquer ação em andamento desativa o botão com `disabled:opacity-50`), já que a variante já era a cheia. Quando a comanda está pronta, o botão agora mantém a cor cheia enquanto salva (`disabled:opacity-100`, `aria-busy`).
- [Rule 2] Comanda sem itens: o backend recusa (`EMPTY_COMANDA`), mas a tela deixava o botão habilitado. Agora fica bloqueado com "Adicione ao menos um item para fechar". A checagem considera também `total > 0` para não depender só da lista de itens.
- [Rule 3] Ao remover a linha do código do cartão (`data-testid="comanda-code"`), o E2E `fluxo-agendamento-comanda-pagamento.spec.ts` passou a ler o código do título da página (h1 "Comanda C-...").
- A causa da lista estreita não era um pai `flex`, e sim o `max-w-[400px]` do `Card` base. Corrigido só na lista; a mudança no `Card` base, que afetaria outras telas, foi para `deferred-items.md`.
- Dentro do UX-07, as colunas Total e Pago também ficaram sem quebra ("R$" e o valor em linhas separadas na evidência) e as células ganharam o mesmo espaçamento do cabeçalho.
- Adicionei a auditoria de staging `ux-comanda-staging.audit.ts` (não prevista), no mesmo padrão do 05-09 e 05-10.

## Known Stubs

Nenhum.

## Self-Check: PASSED

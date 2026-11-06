---
phase: 05-uso-no-dia-a-dia
plan: 12
subsystem: frontend-ux
tags: [ux, comanda, celular, html, breadcrumb]
requires: [05-07, 05-08, 05-11]
provides: [UX-09, UX-10 corrigidos e verificados no staging]
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/ux-comanda-lote2.test.tsx
    - apps/frontend/src/components/layout/__tests__/menu-dom.test.tsx
    - apps/e2e/tests/ux-comanda-celular.spec.ts
    - apps/e2e/audit/ux-comanda-celular-staging.audit.ts
  modified:
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx
    - apps/frontend/src/components/layout/PageHeader.tsx
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
decisions:
  - "Comanda: ordem no DOM Cliente, Itens, Adicionar, Pagamento; no computador o grid (lg:grid-rows-[auto_1fr], col/row-start) mantém o layout de antes, com Adicionar na 1ª coluna abaixo do Cliente"
  - "UX-10: a causa era a trilha (breadcrumb) do PageHeader, não o menu lateral; o separador virou <span> dentro do item, com o mesmo espaçamento de antes (gap de 6 px do item), em vez de <li> irmão (que mudaria o espaçamento no computador)"
  - "IconRail, AppDrawer e SidebarNav não foram alterados: já tinham HTML válido; ganharam teste de trava em menu-dom.test.tsx"
metrics:
  tasks: 3
  completed: 2026-11-06
  duration: ~70min
---

# Phase 5 Plan 12: Comanda e caixa, lote 2 (UX-09, UX-10) Summary

No celular a comanda mostra agora Cliente, depois Itens da comanda, depois Adicionar à comanda e Pagamento; no computador o layout de três colunas ficou como estava. O nome do item tem a largura que sobra (os valores não encolhem mais), e no staging um nome de 21 caracteres ocupa 2 linhas, antes eram 3. O aviso de "item de lista dentro de item de lista" sumiu. Ele vinha da trilha no topo das páginas (Financeiro > Comandas > C-...), não do menu lateral. Está no staging com CI verde.

## Commits

- 8da3f19: fix(05-12) correção do lote (UX-09, UX-10), com testes e auditoria do staging
- b8908dd: docs(05-12) hashes na auditoria
- commit final de docs: SUMMARY, verificação no staging e nota da causa do UX-10 na auditoria, STATE e ROADMAP

## Testes de regressão

- `ux-comanda-lote2.test.tsx`: ordem no DOM Cliente → Itens → Adicionar; Adicionar com `lg:col-start-1` e Itens com `lg:col-start-2`; nome do item com `min-w-0 break-words`, contêiner `min-w-0 flex-1`, sem largura fixa estreita; valores com `shrink-0 whitespace-nowrap`. Os 3 falhavam antes.
- `menu-dom.test.tsx`: IconRail, AppDrawer (aberto), SidebarNav e PageHeader com trilha. Sem aviso de aninhamento no `console.error` e todo `<li>` com pai `<ul>`/`<ol>`. Só o caso do PageHeader falhava antes; os três menus já passavam e ficam como trava.
- `ux-comanda-celular.spec.ts` (Playwright, 412x915): "Itens da comanda" acima de "Adicionar à comanda"; nome de 25 caracteres em até 2 linhas; console sem aviso de HTML em agenda, comanda, financeiro, comissões, clientes, menu do celular e computador. Com as correções desfeitas, o UX-09 falha. Com elas, passa.

## Gate

- typecheck e lint (-r): limpos
- Frontend: 75 arquivos, 497 testes. Backend unit: 367 de 367
- Backend integração: 599 de 601. As 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local NOAUTH, conhecida e aceita; o CI cobre)
- E2E completo: 35 de 35 (rodado sozinho)
- CI na master: verde (run 42203826511 em b8908dd, todos os jobs com sucesso). Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration, sem backup necessário)

## Verificação no staging (somente leitura, usuário de auditoria, celular Pixel 7)

`audit/ux-comanda-celular-staging.audit.ts` rodou com o guard de mutação. Nada foi bloqueado: o script só navegou, sem adicionar item, registrar pagamento ou fechar comanda.
- UX-10: 0 `<li>` fora de `<ul>`/`<ol>` em /agenda, /comanda, /financeiro, /financeiro/comissoes, /noivas, /contratos e no detalhe da comanda. O build de produção não emite o aviso do React, então a medida é feita no HTML.
- UX-09 (comanda aberta): Cliente em 168 px, Itens da comanda em 436 px, Adicionar à comanda em 713 px. Há 1 item, de 21 caracteres, em 2 linhas, ao lado de "R$ 270,00".
- A captura fica em `05-audit-evidence/mobile/05-12-comanda-detalhe.png`, fora do git como as outras evidências. O script não registra nomes.

## Deviations from Plan

- [Rule 1 - Bug] A causa do UX-10 não estava no menu lateral, como a auditoria registrou. O stack do aviso (metrics-*.jsonl) aponta para dentro do `<main>`/Outlet, e o aviso só aparecia nas telas com trilha no topo. No `PageHeader` o `BreadcrumbSeparator` (um `<li>`) ficava dentro do `BreadcrumbItem` (outro `<li>`). A correção foi no `PageHeader.tsx`, arquivo fora do `files_modified` do plano. `IconRail.tsx`, `AppDrawer.tsx` e `SidebarNav.tsx` não mudaram. O componente `ui/breadcrumb.tsx` também não mudou (o PageHeader é o único que usa o separador).
- No E2E e no Vitest a busca de aviso aceita também o texto do React 19 ("cannot be a descendant of"). O projeto usa React 19, que não emite mais "validateDOMNesting".
- Criei a auditoria de staging `ux-comanda-celular-staging.audit.ts`, que o plano não previa, no mesmo padrão do 05-09 a 05-11.

## Observações (fora do escopo, sem mudança)

- No cartão "Cliente" do staging o nome aparece todo em maiúsculas porque está gravado assim. A padronização da caixa dos nomes é o UX-16, previsto para o lote 05-15.

## Known Stubs

Nenhum.

## Self-Check: PASSED

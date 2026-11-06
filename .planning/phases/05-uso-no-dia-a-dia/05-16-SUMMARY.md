---
phase: 05-uso-no-dia-a-dia
plan: 16
subsystem: frontend-ux
tags: [ux, financeiro, clientes, acessibilidade]
requires: [05-07, 05-08, 05-15]
provides: [UX-17, UX-18, UX-19 corrigidos no staging]
key-files:
  modified:
    - apps/frontend/src/features/operations/pages/FinanceiroPage.tsx
    - apps/frontend/src/features/operations/lib/operations-labels.ts
    - apps/frontend/src/features/operations/__tests__/financeiro-page.test.tsx
    - apps/frontend/src/pages/ClientesPage.tsx
    - apps/frontend/src/pages/__tests__/clientes-page.test.tsx
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
decisions:
  - "UX-17: cashKindLabel em operations-labels.ts (fora do arquivo de página, por causa do lint react-refresh): Sinal, Pagamento, Troco, Estorno, Entrada de contrato, Devolução de contrato; código desconhecido vira 'Outro lançamento'"
  - "UX-18: textos de apoio seguem o financial.service: Faturado = comandas fechadas (parte não coberta por contrato) + pagamentos de contrato do período; Recebido = soma de cash_movements (sinais, pagamentos, parcelas de contrato, menos estornos, troco e devoluções); Comandas fechadas conta só comandas com valor a pagar; Ticket = faturado das comandas / comandas fechadas. Texto em text-xs text-neutral-600 (antes neutral-400)"
  - "UX-19: período e Dia/Semana/Mês no mesmo bloco (financeiro-filtros), lado a lado no computador e empilhados no celular, sem justify-between; botão de ações da cliente h-11 w-11, ícone h-5 w-5, rótulo 'Ações de <nome>'"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 16: Financeiro e botões de ação (UX-17, UX-18, UX-19) Summary

A coluna Tipo do Financeiro não mostra mais "contract_in": aparece "Entrada de contrato" (e "Outro lançamento" para qualquer código novo). Cada cartão do topo explica o que soma, e o Recebido diz por que pode ser diferente do Faturado. "Comandas fechadas" virou "Comandas fechadas (sem contratos)". O período e o agrupamento Dia/Semana/Mês ficam juntos. Na lista de clientes o botão de ações tem 44 px, ícone maior e é lido como "Ações de Maria Silva".

## Commits

- 464a89e: fix(05-16) correção do lote (UX-17, UX-18, UX-19), com testes
- 76f58e3: docs(05-16) hash na auditoria
- commit final de docs: SUMMARY, STATE e ROADMAP

## Testes de regressão (todos falhavam antes)

- `financeiro-page.test.tsx`: `contract_in` → "Entrada de contrato" e código desconhecido → "Outro lançamento", sem código cru; os quatro textos de apoio (`card-hint-faturado/-recebido/-comandas/-ticket`) com o conteúdo certo e `text-xs text-neutral-600`; "Comandas fechadas (sem contratos)"; filtros no mesmo bloco `financeiro-filtros`.
- `clientes-page.test.tsx`: botão "Ações de Maria Silva" com `h-11 w-11` e ícone `h-5 w-5`; o teste dos cartões passou a usar o rótulo novo.

## Gate

- typecheck e lint (-r): limpos
- Frontend: 79 arquivos, 528 testes. Backend unit: 367 de 367
- Backend integração: 599 de 601. As 2 falhas (`phase4-alerts-boot`, `phase4-public-acceptance`) são `NOAUTH` do Redis local; backend não foi tocado e o CI passa
- E2E completo: 38 de 38
- Deploy do staging concluído (sem migration)
- CI na master: verde (run 42253775175 em 76f58e3)

## Deviations from Plan

1. **Rótulos fora do arquivo da página.** O plano pedia `contract_in` em `FinanceiroPage.tsx`; a função foi para `lib/operations-labels.ts` (lint react-refresh não aceita exportar função comum de arquivo de componente). A página usa `cashKindLabel`.
2. **"Devolução de contrato" (Regra 2).** O backend também grava `contract_refund`; ganhou rótulo para não cair em "Outro lançamento".
3. **Texto do Faturado ajustado ao backend.** O rascunho dizia "valor dos contratos"; o backend soma os pagamentos de contrato do período, e é isso que o texto diz.
4. **Quarto texto de apoio (Ticket médio).** Previsto no rascunho do plano, ganhou `card-hint-ticket`.

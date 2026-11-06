---
phase: 05-uso-no-dia-a-dia
plan: 13
subsystem: frontend-ux
tags: [ux, noivas, contratos, negrito, telefone]
requires: [05-07, 05-08, 05-12]
provides: [UX-11, UX-14 corrigidos no staging]
key-files:
  created:
    - apps/frontend/src/features/bridal/components/ContractTextView.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-text-view.test.tsx
  modified:
    - apps/frontend/src/features/bridal/pages/ContractDetailPage.tsx
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
    - apps/frontend/src/features/bridal/components/BridalMembersCard.tsx
    - apps/frontend/src/features/bridal/lib/bridal-labels.ts
    - apps/frontend/src/features/bridal/__tests__/contract-detail.test.tsx
    - apps/frontend/src/features/bridal/__tests__/bridal-group-detail.test.tsx
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
decisions:
  - "UX-11: ContractTextView usa parseBold/splitParagraphs de contract-rich-text.ts, mesmo comportamento do ContractDocument do aceite público, sem importar dele; o data-testid contract-text foi mantido"
  - "UX-14: um único Badge group-status no cabeçalho; contrato em rascunho vira legenda pequena; 'Pronta até' só aparece com data; telefone dos integrantes com formatPhoneBr"
metrics:
  tasks: 3
  completed: 2026-11-06
---

# Phase 5 Plan 13: Noivas e contratos, lote 1 (UX-11, UX-14) Summary

O texto do contrato na tela interna agora mostra os títulos em negrito e nenhum asterisco solto, igual ao aceite público e ao PDF. O detalhe do grupo de noivas mostra um status só (com "Contrato em rascunho" em legenda quando é o caso), esconde "Pronta até" quando não há data e formata o telefone como (11) 98888-7777. Está no staging.

## Commits

- 870e8d7: fix(05-13) correção do lote (UX-11, UX-14), com testes
- 603992c: docs(05-13) hash na auditoria
- ce48cef: docs(05-13) SUMMARY, STATE e ROADMAP
- 780bc90: fix(05-13) filtros da agenda com shrink-0 (UX-02), achado pelo CI

## Testes de regressão

- `contract-text-view.test.tsx`: `**I. Das partes:**` e `**Contratado:**` viram `<strong>`, dois parágrafos, `textContent` sem `**`.
- `contract-detail.test.tsx`: o bloco `contract-text` da tela de detalhe não contém `**`.
- `bridal-group-detail.test.tsx`: um único `group-status`, legenda "Contrato em rascunho", "Pronta até" ausente sem data e presente com data, telefone formatado.

## Gate

- typecheck e lint (-r): limpos
- Frontend: 76 arquivos, 504 testes. Backend unit: 367 de 367 (inclui os testes de contrato; o PDF já usa a mesma regra de negrito, nada a corrigir)
- Backend integração: 599 de 601. As 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local NOAUTH, conhecida e aceita; o CI cobre)
- E2E completo: na primeira rodada 34 de 35, com falha em `ux-agenda-celular.spec.ts` (UX-02). Depois da correção 780bc90: 35 de 35
- Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration, sem backup necessário)
- CI na master: verde (run 42210081849 em 603992c, todos os jobs com sucesso)

## Deviations from Plan

**[Regra 1, bug] Botões do painel de filtros da agenda encolhiam abaixo de 44 px (UX-02).** O CI do commit ce48cef falhou no E2E do UX-02 (`profissional 11: largura` 43,99 px). A suíte cria várias profissionais e os botões `w-11` do painel, itens de `flex-wrap` sem `shrink-0`, encolhiam frações de pixel. Não foi causado por este lote, mas bloqueava o CI. Correção: `shrink-0` nos botões de profissional e em "Todos", com teste de regressão no Vitest (12 profissionais) que falhava antes.

## Deferred Issues

Nenhuma.

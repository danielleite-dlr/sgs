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
- commit final de docs: SUMMARY, STATE e ROADMAP

## Testes de regressão

- `contract-text-view.test.tsx`: `**I. Das partes:**` e `**Contratado:**` viram `<strong>`, dois parágrafos, `textContent` sem `**`.
- `contract-detail.test.tsx`: o bloco `contract-text` da tela de detalhe não contém `**`.
- `bridal-group-detail.test.tsx`: um único `group-status`, legenda "Contrato em rascunho", "Pronta até" ausente sem data e presente com data, telefone formatado.

## Gate

- typecheck e lint (-r): limpos
- Frontend: 76 arquivos, 504 testes. Backend unit: 367 de 367 (inclui os testes de contrato; o PDF já usa a mesma regra de negrito, nada a corrigir)
- Backend integração: 599 de 601. As 2 falhas são só `phase4-alerts-boot.e2e.spec.ts` (Redis local NOAUTH, conhecida e aceita; o CI cobre)
- E2E completo: 34 de 35. A falha foi `ux-agenda-celular.spec.ts` (UX-02), arquivo não tocado; rodado sozinho passou 3 de 3, instabilidade por carga da suíte completa
- Deploy do staging concluído (`./scripts/deploy-staging.sh`, sem migration, sem backup necessário)
- CI na master: verde (run 42210081849 em 603992c, todos os jobs com sucesso)

## Deviations from Plan

Nenhuma.

## Deferred Issues

- `ux-agenda-celular.spec.ts` (UX-02) instável quando roda junto com a suíte completa do E2E; passa sozinho.

---
phase: quick-261117-i6j
plan: 01
subsystem: comanda / noivas
tags: [graphql, comanda, contrato, teste-de-noiva]
provides:
  - ComandaItem.linkableContractId/linkableContractCode
  - mutation linkComandaItemToContract
  - botão "Vincular ao contrato CT-…" na comanda
key-files:
  created:
    - apps/backend/src/comandas/comanda-trial-link.ts
    - apps/backend/src/comandas/comanda-trial-link.spec.ts
    - apps/backend/test/integration/quick-261117-i6j-trial-link.e2e.spec.ts
    - apps/frontend/src/features/operations/__tests__/comanda-vincular-teste.test.tsx
  modified:
    - apps/backend/src/comandas/{comanda-serialize,comandas.service,comandas.resolver}.ts
    - apps/backend/src/graphql/schema/comandas.graphql
    - apps/frontend/src/features/operations/{api/comandas.api.ts,pages/ComandaPage.tsx}
metrics:
  completed: 2026-11-17
---

# Quick 261117-i6j: vincular o teste de noiva ao contrato na comanda

## Causa

O contrato CT-2026-008 (Ewelly) foi lançado com itens avulsos do evento, sem item `trial`. O
`coveragePriceMapTx(..., 'trial')` devolve `null`, então o teste de 17/11 nasceu sem `contract_id` e a
comanda não tinha como ser ligada ao contrato.

## O que foi feito

- `linkableTrialContract`: item de serviço sem contrato, atendimento `trial` de grupo, cliente
  `coveredByContract` e contrato não cancelado → `{ id, code }`.
- `ComandaItem.linkableContractId/Code` e a mutation `linkComandaItemToContract` (COMANDA_WRITE,
  comanda aberta com FOR UPDATE): item a R$ 0,00 com `contract_id`, `list_unit_price` mantém
  (comissão cheia, D-08), `appointments.contract_id` gravado, total recalculado. É idempotente e
  devolve `ITEM_NOT_LINKABLE` nos demais casos.
- Comanda: botão "Vincular ao contrato CT-…" com nota "fica R$ 0,00 aqui e é pago no evento"; depois
  aparecem os selos "Contrato …" e "Teste incluso no pacote — pago no evento".
- O caso da Ewelly NÃO foi ligado por SQL: o usuário usa o botão (no staging é elegível: service,
  sem contrato, trial, coberta, CT-2026-008 draft).

## Gate

- Backend: lint ok, tsc ok, jest unit 48 suites / 516, integração 68 suites / 721.
- Frontend: lint ok, tsc ok, vitest 123 arquivos / 879.
- E2E (fluxo-agendamento-comanda-pagamento, noivas-contrato, ux-comanda-celular, ux-comanda-lista,
  cronograma-noiva): 13/14 na rodada com 5 arquivos; o que falhou ("Sugerir agenda IA", timeout de
  30s ao avançar dia a dia na agenda, fora do código alterado) passou ao rodar noivas-contrato
  sozinho, 8/8, em 24,4s, perto do limite. Fica o risco de instabilidade com carga.

## Deploy

- Backup: /root/sgs-backups/stg-pre-vincular-teste-20261117.sql.gz (sem migration).
- `./scripts/deploy-staging.sh` ok; Nest iniciou sem erro.

## Deviations

- Executado inline (sem planner/executor separados): mudança pequena e com o contexto já lido.

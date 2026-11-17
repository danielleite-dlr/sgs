---
phase: quick-261117-j1w
plan: 01
subsystem: comanda / comissão / noivas
tags: [comissao, teste-de-noiva, contrato]
key-files:
  modified:
    - apps/backend/src/comandas/comanda-close.ts
    - apps/backend/src/comandas/comanda-trial-link.ts (isTrialSettledAtEvent)
    - apps/backend/src/comandas/comanda-serialize.ts (includedInEvent usa o mesmo helper)
    - apps/backend/test/integration/quick-261117-i6j-trial-link.e2e.spec.ts
metrics:
  completed: 2026-11-17
---

# Quick 261117-j1w: comissão do teste de noiva incluso só no evento

## Problema (usuário, 17/11)

Ao fechar a comanda do teste da Ewelly (C-2026-022), a Jessica Seixas ganhou R$ 400 (regra fixa de
"Maquiagem noiva"), e a comanda do evento de 20/11 lançaria mais R$ 400. Para o usuário, teste e
evento são um serviço só: a comissão deve sair uma vez, quando o evento for concluído.

## O que foi feito

- `isTrialSettledAtEvent` (contrato + atendimento trial + total 0, a mesma regra do selo
  `includedInEvent`): no fechamento, o accrual do item fica com `calculatedAmount = 0` e o snapshot
  recebe `settledAtEvent: true`. A base e a regra continuam no registro para auditoria, e `noRule`
  fica false (sem aviso D-24).
- Teste avulso (pago, sem contrato) mantém a comissão normal.
- A comissão do evento não muda: o item coberto do evento gera a comissão inteira.
- Limite aceito: se o teste for feito por outra profissional, ela não recebe pelo teste; a comissão
  vai para quem fizer o evento.

## Testes

- Unit 48 suites / 518; integração 68 suites / 723 (novos: regra fixa com teste 0 e evento 400;
  teste avulso com 40%).
- E2E fluxo-agendamento-comanda-pagamento 2/2. O frontend não mudou.

## Dados

- A Ewelly C-2026-022 segue com R$ 400 lançados antes da correção. O jeito auditado de corrigir é
  reabrir a comanda (estorno −400) e fechar de novo (accrual 0); fica com o usuário.
- Backup: /root/sgs-backups/stg-pre-comissao-teste-20261117.sql.gz. Deploy ok.

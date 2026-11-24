---
phase: quick-261124-owd
plan: 01
subsystem: agenda/comandas
tags: [comanda, visita, agendamento]
key-files:
  modified:
    - apps/backend/src/comandas/comanda-open.ts
    - apps/backend/src/appointments/visits.ts
  created:
    - apps/backend/test/integration/quick-261124-owd-comanda-unica.e2e.spec.ts
decisions:
  - A regra vale também para o agendamento pelo grupo da noiva (correção dentro de createVisitTx).
metrics:
  completed: 2026-11-24
---

# Quick 261124-owd: comanda única por cliente no dia

## Pedido
Agendamento novo da mesma cliente no mesmo dia deve entrar na comanda aberta, não abrir outra
(caso Edna: make na C-2026-117 separada do penteado na C-2026-025).

## Feito
- `findReusableComandaTx` (comanda-open.ts): advisory lock por cliente, depois busca a comanda `open`
  da cliente com agendamento ativo (scheduled/confirmed/in_progress/completed) em algum dos mesmos
  dias locais (fuso da organização) e trava com `FOR UPDATE`.
- `createVisitTx` (visits.ts) usa a comanda reaproveitada antes de abrir nova; itens, total e sinal
  (crédito + caixa) vão para ela; o payload devolve o `comandaId` reaproveitado. Walk-in não mudou.
- Commit: a55f873 (master).

## Testes
- Novo spec de integração (5 casos): mesmo dia junta (2 itens, total 150, 1 comanda); outro dia
  separa; comanda fechada separa; agendamento cancelado não conta; sinal vai para a reaproveitada.
- Gate: eslint dos arquivos, tsc, jest unit (662), integração completa (860, 85 suítes), vitest (1083)
  verdes. Nenhum teste antigo precisou de ajuste de cenário.
- CI do a55f873: success. Deploy staging: concluído (sem migration), containers no ar.

## Dados (staging)
- Backup: `/root/sgs-backups/staging-pre-261124-owd-20261124-1818.sql.gz` (gzip validado).
- Pré-checagem: C-2026-117 sem pagamento, caixa, crédito, comissão ou estoque; ambas abertas, mesma cliente.
- Transação com verificação: item e agendamento da make movidos para a C-2026-025, total recalculado
  = 500.00; C-2026-117 cancelada (motivo "Juntada na C-2026-025", total 0.00).
- Depois: C-2026-025 open 500.00 com Penteado madrinha + Maquiagem madrinha e 2 agendamentos.
- Outros casos iguais (cliente com 2+ comandas abertas com agendamento ativo no mesmo dia): nenhum.

## Deviations from Plan
Nenhuma. Observação: `pg_advisory_xact_lock` precisa de `$executeRaw` (retorno void quebra `$queryRaw`).

## Self-Check: PASSED

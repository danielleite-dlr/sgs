# Quick 261117-mtn — Teste de noiva + dia da noiva = 1 atendimento no relatório de comissões

**Pedido (17/11):** no relatório da profissional o teste de noiva aparece como atendimento separado; ele é
incluso no dia da noiva (só a data é outra), então teste + evento devem contar como 1 atendimento.
Hoje a Jessica Seixas aparece com 2 porque a comanda do teste da Ewelly foi reaberta (accrual estornado
também era contado).

## Tarefa 1 — Backend (`financial.service.ts`, `financial.graphql`)
- `commissionTotals.records`: só accruals não estornados e que não sejam teste de noiva incluso no contrato
  (agendamento `purpose='trial'` + item com `contract_id`).
- `commissionRecords`: novos campos `bridalTrialIncluded` (teste incluso), `trialDate` (para o item do evento
  com contrato: data do teste da mesma cliente no mesmo grupo, não cancelado).

## Tarefa 2 — Frontend
- lib `reportRows`: some com accrual estornado + estorno quando os dois estão no período; o teste incluso é
  somado à linha do evento da mesma cliente/contrato ("teste em dd/mm incluso"); sem evento no período,
  fica uma linha "Teste (incluso — comissão no dia da noiva)".
- Tela, PDF e WhatsApp usam as mesmas linhas; caixa "Mostrar estornos" na tela para a auditoria completa.

## Gate
lint + tsc + jest unit + integração + vitest; push; deploy staging; CI.

# Quick 261117-mtn — Teste de noiva + dia da noiva = 1 atendimento (resumo)

**Data:** 2026-11-17

## Problema
No relatório de comissões, a Jessica Seixas aparecia com 2 atendimentos para a Ewelly: a comanda do teste
(C-2026-022) foi reaberta e fechada de novo, e a contagem somava o lançamento estornado; além disso o teste
incluso no contrato contava como atendimento à parte. Para o salão, teste + dia da noiva são um atendimento só.

## O que mudou
- **Backend** `commissionTotals.records`: só lançamentos não estornados e sem o teste de noiva incluso no
  contrato (agendamento `trial` + item com contrato). `commissionRecords` ganhou `bridalTrialIncluded`,
  `trialDate` (no item do dia da noiva: data do teste da mesma cliente no grupo), `reversesRecordId`, `contractId`.
- **Frontend** `reportRows` (lib): some com o par lançamento/estorno quando os dois estão no período; o teste
  incluso é somado à linha do dia da noiva do mesmo contrato ("Dia da noiva + teste em dd/mm (1 atendimento)");
  sem o evento no período, fica "Teste da noiva (incluso; comissão no dia da noiva)". Tela, PDF e WhatsApp usam
  essas linhas; "Mostrar estornos e lançamentos separados (auditoria)" volta à lista completa.

## Testes
- Integração: teste incluso fechado, reaberto, fechado de novo + evento do mesmo contrato → `records = 1`,
  total R$ 400, `trialDate` = início do teste. Unit 518, integração 725, vitest 888, lint e tsc ok.
- E2E `fluxo-agendamento-comanda-pagamento` falha localmente também sem esta mudança (profissional parada no
  login, timeout de 30 s); o CI do commit anterior estava verde.

## Dados
A Ewelly continua com R$ 400 lançados no teste (fechado antes da 261117-j1w). Quando o dia da noiva (20/11)
for fechado, o relatório soma os dois na mesma linha (R$ 800). Para ficar R$ 400, reabrir e fechar a C-2026-022.

# Quick 261117-klg — Relatório de comissões por profissional (resumo)

**Data:** 2026-11-17

## O que mudou
- **Backend** (`financial.service.ts`, `financial.graphql`): `CommissionRecordEntry` ganhou `clientName`
  (cliente da comanda) e `serviceDate` (início do agendamento do item; sem agendamento, abertura da comanda).
  `CommissionMemberTotal` ganhou `memberPhone`. Só LEFT JOINs novos; RLS e filtro de período (data do
  fechamento) inalterados.
- **Frontend** (`ComissoesCalculadasPage`):
  - linha/nome da profissional nos totais é clicável e seleciona a profissional (linha destacada);
  - registros em ordem de atendimento: Data, Cliente, Serviço, Cobrado, Comissão; Regra (com preço cheio
    quando difere) e Comanda como colunas secundárias; coluna "Item" dos totais virou "Atendimentos";
  - **Gerar relatório (PDF)**: `CommissionPrintReport` em portal no `<body>` + `window.print()`; a classe
    `printing-commission-report` no body faz o CSS de impressão esconder o app; título vira o nome do PDF;
  - **Enviar por WhatsApp** (admin/gerente): `wa.me/<55+telefone>?text=` com período, atendimentos e total;
    sem telefone abre `wa.me/?text=` para escolher o contato.
  - lib `commission-report.ts` (texto, URL, período com `to` exclusivo).

## Testes
- Integração: `phase3-commission-records` — cliente, serviceDate = opened_at sem agendamento, memberPhone.
- Vitest: clique na linha, ordem/colunas, WhatsApp, impressão; `commission-report.test.ts`.
- SQL conferida (só leitura) no staging: Jessica Seixas / Ewelly / horário do agendamento.

# Quick 261117-klg — Relatório de comissões por profissional

**Pedido:** ao clicar na profissional, ver os atendimentos (data, cliente, serviço) e ter um relatório para mandar a ela.

## Tarefa 1 — Backend
- `commissionRecords`: novos campos `clientName` (clients.full_name via comandas.client_id) e `serviceDate`
  (COALESCE(appointments.starts_at do comanda_item, comandas.opened_at)); LEFT JOINs, RLS intacta.
- `commissionTotals`: novo campo `memberPhone` (members.phone).
- SDL `financial.graphql` + teste de integração em `phase3-commission-records.e2e.spec.ts`.

## Tarefa 2 — Frontend (`ComissoesCalculadasPage`)
- Linha da profissional na tabela de totais é clicável (teclado também) e seleciona a profissional.
- Registros: Data do atendimento, Cliente, Serviço, Cobrado, Comissão; Comanda/Regra/Preço cheio como secundárias.
- "Gerar relatório (PDF)": bloco `.print-report` + `window.print()`; CSS de impressão esconde o resto do app.
- "Enviar por WhatsApp" (admin/gerente): texto com período, atendimentos e total; `wa.me/55<telefone>`
  ou `wa.me/` sem número.
- Testes vitest para clique na linha, colunas novas, texto do WhatsApp.

## Gate
lint + tsc + jest unit + integração + vitest; push; deploy staging; CI.

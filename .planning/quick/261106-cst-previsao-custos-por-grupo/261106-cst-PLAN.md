# Quick 261106-cst: Previsão de caixa com custos por grupo

Pedido: considerar "Outros custos" dos pacotes (lanche, champagne, assistente) na previsão de caixa e deixar bem visível o que é custo profissional, operacional e fixo.
Decisão do usuário: os custos do pacote contam uma vez por contrato, na data do evento.

## Backend
- Novo kind `package_cost` (saída): contrato `active` com `package_id`, evento (`bridal_groups.event_date`) em [from, to), um item por `package_cost_items` do pacote (pacote excluído fora, custo 0 ignorado), refId = contrato, label "Nome — CT-código".
- `costGroup` no item (`professional` | `operational` | `fixed`, nulo nas entradas) via função pura em `forecast.ts`.
- `professionalOutflowTotal`/`operationalOutflowTotal`/`fixedOutflowTotal` em CashForecast e `professionalOutflow`/`operationalOutflow`/`fixedOutflow` em ForecastBucket.
- Testes unitários (forecast.spec.ts) e de integração (phase5-forecast).

## Frontend
- Documentos gql, tipos, rótulos; ForecastCard com as três linhas; PrevisaoPage com bloco de resumo, divisão por semana, coluna "Grupo" e rodapé atualizado.
- Testes vitest e E2E (financeiro-previsao.spec.ts) e auditoria de staging (somente leitura).

## Entrega
Gate completo, commits atômicos, push, deploy staging, CI verde, verificação no staging.

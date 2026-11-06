# Quick 261106-cst: Previsão de caixa com custos por grupo - Summary

Previsão de caixa agora inclui "Outros custos" dos pacotes (item `package_cost`, uma vez por contrato ativo na data do evento) e separa as saídas em Custo profissional (comissões), Custo operacional (outros custos do pacote) e Custo fixo (despesas fixas), no cartão do painel e no detalhe.

## Commits
- 01ed966 backend (forecast.ts/service/graphql, testes unitários e integração)
- aab7f5a frontend, E2E e auditoria de staging

## Verificação
- typecheck e lint ok; backend unit 367 ok; integração 599 ok (só phase4-alerts-boot falha, Redis NOAUTH local pré-existente); vitest 463 ok; E2E 30 ok; CI 42167954764 verde; deploy staging ok.
- Staging (Studio JS): janela de 30 dias mostra R$ 0,00 nos três grupos (evento em 12/12 fora da janela); período 01/12 a 31/12: profissional R$ 940,00, operacional R$ 440,00 (Lanche 200, Champagne 40, Assistente 200 de CT-2026-001), fixo R$ 0,00.

## Deviations
Nenhuma. Valores dos custos são os atuais de package_cost_items (sem snapshot).

---
quick_id: 261124-qhs
type: quick
autonomous: true
---

# Quick 261124-qhs — profissional vê só a comissão (sem valor cobrado)

**Pedido (24/11/2026):** "remova do relatório o valor cobrado; o profissional deve ver somente o que recebe (comissão)".

## Decisões
- **Relatório impresso/PDF** (`CommissionPrintReport.tsx`): sai a coluna "Valor cobrado" para todo mundo — o relatório é o que se entrega à profissional. Colunas: Data, Cliente, Serviço, Comissão. Ajustar `colSpan` do vazio e do total.
- **Tela Comissões** (`ComissoesCalculadasPage.tsx`): para `roleName === 'PROFESSIONAL'` esconder a coluna "Cobrado", o "cheio R$ X" e a coluna "Regra" (percentual + comissão revela o cobrado). Admin/gerente continuam vendo tudo.
- **Backend** (`financial.resolver.ts` → `commissionRecords`): para PROFESSIONAL, mascarar no retorno `chargedAmount` e `baseAmount` como `"0.00"`, `ruleValue` = null, `ruleSnapshot` = `"{}"` (schema `String!` continua; sem mudança de SDL/codegen). Conferir também `commissionTotals` e qualquer outra query de comissão acessível à PROFESSIONAL que traga valor cobrado; mascarar igual.
- `commission-report.ts` (agregação do relatório) pode continuar somando chargedAmount; só não é exibido.

## Tarefa 1 — Backend: mascarar valor cobrado para PROFESSIONAL
- Helper `maskForProfessional(record)` no resolver (ou service), aplicado quando `tenant.roleName === 'PROFESSIONAL'`.
- Teste de integração novo `quick-261124-qhs-comissao-profissional.e2e.spec.ts` (seguir padrão de testes existentes de commissionRecords com papel PROFESSIONAL): profissional recebe calculatedAmount correto e chargedAmount/baseAmount "0.00", ruleValue null, ruleSnapshot "{}"; admin recebe os valores reais.

## Tarefa 2 — Frontend: tela e relatório
- Remover coluna "Valor cobrado" do `CommissionPrintReport`.
- Esconder "Cobrado", "cheio" e "Regra" na tabela para PROFESSIONAL (`colSpan` do vazio dinâmico).
- Vitest: ajustar/adicionar testes existentes de comissões (procurar `__tests__` com commission) — relatório impresso não tem "Valor cobrado"; profissional não vê "Cobrado"/"Regra"; admin vê.

## Tarefa 2b — Frontend: linha "Total a pagar" (acréscimo do usuário)
- Rodapé `data-testid="commission-totals-sum"` na tabela `commission-totals`: soma atendimentos e Total ganho em centavos (`sumMemberTotals`). Só quando há linhas e não é PROFESSIONAL. Vitest: soma e ausência para PROFESSIONAL.

## Tarefa 3 — Gate e entrega
- Gate completo (lint, tsc, jest unit, integração, vitest). E2E de comissões se existir spec que cite "Valor cobrado"/"Cobrado" (grep em apps/e2e) — ajustar.
- Commit por tarefa, push master, `scripts/deploy-staging.sh` (só `.planning/` untracked é aceitável), `gh run watch` até verde.
- SUMMARY em `261124-qhs-SUMMARY.md`.

# Quick 261124-qhs: profissional vê só a comissão

**Resumo:** PROFESSIONAL deixa de ver valor cobrado, base e regra de comissão (API e telas); o relatório impresso perde a coluna "Valor cobrado" para todos; admin/gerente ganham a linha "Total a pagar".

## Commits
- 7c6b2f0 — backend: máscara para PROFESSIONAL
- 713f4df — frontend: tela, relatório impresso e Total a pagar (Tarefas 2 e 2b)

## Tarefa 1 — Backend
- `maskForProfessional` em `financial.resolver.ts`: `chargedAmount`/`baseAmount` = "0.00", `ruleValue` = null, `ruleSnapshot` = "{}" (SDL inalterado).
- `comanda.commissions` do PROFESSIONAL (`comandas.service.ts`) sai com cobrado/base "0.00". Extra além do plano, pela mesma exposição.
- `commissionTotals` não traz valor cobrado: nada a mascarar.
- Teste novo `quick-261124-qhs-comissao-profissional.e2e.spec.ts`: profissional recebe 40.00 de comissão e valores mascarados; admin vê os reais.

## Tarefa 2 — Frontend
- `CommissionPrintReport`: colunas Data, Cliente, Serviço, Comissão (colSpan ajustado).
- `ComissoesCalculadasPage`: PROFESSIONAL não vê Cobrado, Regra nem "cheio".
- Vitest: relatório sem "Valor cobrado"; admin vê Cobrado/Regra; profissional não.

## Tarefa 2b — Total a pagar (acréscimo do usuário)
- Rodapé `commission-totals-sum` com "Total a pagar", soma de atendimentos e total em centavos (`sumMemberTotals` em `commission-report.ts`). Só para não-PROFESSIONAL e com linhas.
- Vitest: 120,10 + 20,20 = R$ 140,30 e 3 atendimentos; não aparece para PROFESSIONAL.

## Testes antigos ajustados
- `phase3-financial-dashboard.e2e.spec.ts`: esperava `ruleSnapshot` real para PROFESSIONAL; agora espera "{}" (mudança pedida).
- Nenhum teste que exigisse "Valor cobrado" no relatório impresso; E2E Playwright não cita "Cobrado".

## Gate
- lint, tsc backend/frontend (`tsc -b`) limpos
- jest unit: 662/662
- integração: 864/865 na primeira passada (1 falha = assert acima); após o ajuste o spec passou 9/9 e o resto 85/86 suítes verdes
- vitest: 156 arquivos, 1091/1091

## Entrega
- Push master 65c27e4..713f4df; CI 45501779323 success (todos os jobs); `deploy-staging.sh` exit 0, containers stg no ar.

## Desvios
- [Rule 2] máscara também em `comanda.commissions` (mesma exposição).
- Frontend das Tarefas 2 e 2b em um único commit.

## Stubs
Nenhum.

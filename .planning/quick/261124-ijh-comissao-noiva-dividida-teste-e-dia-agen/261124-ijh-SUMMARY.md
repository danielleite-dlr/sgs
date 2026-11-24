---
quick_id: 261124-ijh
status: complete
commits: [aea0e55, 5672a5b]
---

# Quick 261124-ijh — Resumo

## Feito
1. **Comissão dividida** (`aea0e55`): `splitTrialCommission` (teste = metade arredondada para baixo, dia = resto).
   No fechamento, o teste incluso (`isTrialSettledAtEvent`) leva a metade; o item do dia coberto por contrato
   leva a outra metade quando a cliente tem teste do mesmo serviço no grupo, ligado a contrato e não
   cancelado/falta (`eventItemsWithIncludedTrial`). Snapshot: `splitWithTrial`. Substitui 261117-j1w (0 + inteira).
   Texto do relatório para teste sem o dia no período atualizado.
2. **Agenda** (`5672a5b`): `AppointmentsQuery` em `cache-and-network`; `closeComanda`/`reopenComanda` com
   `refetchQueries: ['Appointments']`; modal em atendimento mostra "Finalizar na comanda" + dica. E2E do fluxo
   agora inicia o atendimento, finaliza pela comanda e confere "Concluído" ao voltar para a agenda.
3. **Staging** (24/11, backup `/root/sgs-backups/staging-pre-261124-ijh-comissoes-20261124-1403.sql.gz`):
   C-2026-022, C-2026-020 e C-2026-058 reabertas e fechadas pela API (sem caixa/estoque/crédito).
   Líquido: Jessica Seixas/Ewelly 200 (teste) + 200 (dia); Jessica Rodrigues/Ewelly 400 (penteado, sem teste);
   Camila/Graziele 200 (teste; o dia sai com 200 ao fechar).

## Gate
lint ✓ · tsc ✓ · jest 649 ✓ · integração 846 ✓ · vitest 1067 ✓ · E2E 64 ✓

## Desvio do fluxo
Plano e execução feitos na sessão principal (sem planner/executor em worktree): as edições do backend já estavam
na árvore de trabalho quando a quick foi aberta.

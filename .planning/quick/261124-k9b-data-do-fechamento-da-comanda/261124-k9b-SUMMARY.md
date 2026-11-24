---
quick_id: 261124-k9b
status: complete
commits: [8b579f8]
---

# Quick 261124-k9b — Resumo

## Feito
1. **Backend**: `resolveCloseInstant` (`comanda-close-date.ts`): sem data ou hoje = agora; data passada = 12:00
   locais no fuso da org; futura/inválida = `INVALID_CLOSE_DATE` (`closedOn`). `closeComanda(id, closedOn)`
   passa o instante ao `closeComandaTx` (caixa `payment_in`/`change_out`, comissão, `closed_at`) e, quando
   retroativo, regrava `comanda_payments.paid_at`. `Comanda.serviceAt` = primeiro atendimento da comanda.
2. **Front**: "Data do fechamento" no painel de pagamento (padrão = dia do atendimento; atendimento futuro ou
   comanda avulsa = hoje; máx. hoje; aviso "Caixa e comissão entram em dd/mm/aaaa"). Helper em `lib/close-date.ts`.
3. **E2E**: o fluxo de comanda espera os toasts saírem antes de clicar em "Voltar à agenda" (toast sob o mouse não
   fecha e interceptava o clique — falhou 1x na suíte completa).
4. **Staging**: C-2026-021 (Ana Célia, 20/11, R$ 500 dinheiro) já estava reaberta pelo usuário com caixa e comissão
   estornados; basta fechar de novo — o campo vem com 20/11.

## Não muda
Estoque (`stock_movements.created_at`) e baixa de crédito do cliente seguem com a hora real do fechamento.

## Gate
lint ✓ · tsc ✓ · jest 659 ✓ · integração 849 ✓ · vitest 1071 ✓ · E2E 63/64 na suíte + spec corrigido 3/3 ✓

## Desvio do fluxo
Plano e execução na sessão principal (sem planner/executor).

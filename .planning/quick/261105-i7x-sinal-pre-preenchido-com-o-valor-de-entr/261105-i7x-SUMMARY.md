---
phase: quick-261105-i7x
plan: 01
subsystem: frontend/bridal-contracts
tags: [contrato, sinal, pacote, frontend]
requirements: [QUICK-261105-i7x]
key-files:
  modified:
    - apps/frontend/src/features/bridal/components/ContractFormDialog.tsx
    - apps/frontend/src/features/bridal/__tests__/contract-form.test.tsx
    - apps/e2e/tests/noivas-contrato.spec.ts
decisions:
  - "Sinal derivado do pacote com flag depositManual (sem useEffect); contrato existente com sinal salvo abre como manual"
metrics:
  completed: 2026-11-05
  tasks: 2
---

# Quick 261105-i7x: Sinal pré-preenchido com a entrada do pacote

O campo "Valor do sinal (R$)" agora vem preenchido (como value) com a entrada do pacote escolhido, fixa ou em % do total, e continua editável.

## O que mudou
- `depositManual` + `depositDisplay`: sem edição manual o campo segue o pacote (troca de pacote e mudança de total/desconto recalculam). Valor digitado não é sobrescrito.
- Limpar o campo e sair (blur) volta a seguir o pacote. O botão "Usar valor do pacote (R$ x)" aparece quando o valor digitado difere do sugerido.
- Editar contrato com sinal salvo mantém o depositAmount. À vista inalterado (readOnly = total).
- Prévia, Salvar, resumo e parcela única usam o mesmo `depositCents`. Backend e contract-preview.ts intactos.
- 7 testes vitest novos; E2E confere `2.370,00` (30% de R$ 7.900,00) antes de sobrescrever manualmente.

## Commits
- 54ae21d feat: ContractFormDialog + testes vitest
- 271b726 test: asserção no E2E noivas-contrato

## Gate
lint limpo, tsc (typecheck e tsc -b) limpo, vitest frontend 60 arquivos / 426 testes, E2E noivas-contrato 8/8.

## Deviations from Plan
- Etapa RED separada não foi feita (testes e implementação escritos juntos); todos passam.
- As tarefas 1 e 2 foram commitadas separadamente após o gate completo rodado uma vez para ambas (o E2E só valida com a implementação).

## Self-Check: PASSED

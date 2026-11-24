---
quick_id: 261124-ijh
type: quick
autonomous: true
---

# Quick 261124-ijh — Comissão da noiva dividida entre teste e dia + agenda atualiza após fechar comanda

## Contexto

- Usuário (24/11): Ewelly 20/11 — Jessica Seixas recebeu R$ 400 no teste (C-2026-022) + R$ 400 no dia (C-2026-020).
  O certo é R$ 400 no total, **dividido R$ 200 no teste + R$ 200 no dia** quando há teste incluso.
  Decisão do usuário: vale para qualquer serviço/profissional; sem teste incluso, o dia fica com a regra inteira.
  Substitui a regra da 261117-j1w (teste 0, dia inteiro).
- O teste da Ewelly foi fechado antes da j1w entrar em staging, por isso registrou 400.
- Agenda: fechar a comanda já marca os agendamentos como `completed`, mas a `SchedulePage` usa
  cache-first e o fechamento não refaz a `AppointmentsQuery` → card continua "Em atendimento".

## Tarefas

### 1. Backend — divisão da comissão
- files: `apps/backend/src/comandas/comanda-trial-link.ts`, `apps/backend/src/comandas/comanda-close.ts`,
  `apps/backend/src/comandas/comanda-trial-link.spec.ts`, `apps/backend/test/integration/quick-261117-i6j-trial-link.e2e.spec.ts`
- action: `splitTrialCommission(full, 'trial'|'event')` (teste = floor(full/2), dia = resto).
  No fechamento: item de teste incluso (`isTrialSettledAtEvent`) → metade; item do dia coberto por contrato
  cuja cliente tem, no mesmo grupo, teste do mesmo serviço (não cancelado/falta, ligado a contrato) → outra metade.
  Snapshot ganha `splitWithTrial`.
- verify: unit + integração (teste 200 + dia 200 com regra fixa 400; dia sem teste = 400; teste avulso = normal).
- done: gate verde.

### 2. Frontend — agenda atualiza e atalho para a comanda
- files: `apps/frontend/src/features/operations/pages/SchedulePage.tsx`, `apps/frontend/src/features/operations/pages/ComandaPage.tsx`,
  `apps/frontend/src/features/operations/components/calendar/AppointmentDetailsDialog.tsx`
- action: `AppointmentsQuery` com `cache-and-network`; close/reopen da comanda com `refetchQueries` da agenda;
  modal com status `in_progress` mostra "Finalizar na comanda" (primário) no lugar de "Abrir comanda".
- verify: vitest + tsc + lint.

### 3. Dados do staging — corrigir comissões já lançadas
- action: para itens de teste/dia de noiva já fechados com a regra antiga, lançar `reversal` do accrual vigente e novo
  `accrual` com o valor dividido (append-only, sem mexer em caixa). Backup antes.
- verify: soma por profissional/noiva = regra (Jessica Seixas/Ewelly = 200 + 200).

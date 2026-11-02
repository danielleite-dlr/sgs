---
phase: 03-core-operations
plan: 10
subsystem: frontend-agenda
tags: [apollo, dialogs, createVisit, time-blocks, cancel, masks-br, a11y]
requires: [03-03, 03-06, 03-08]
provides:
  - "lib/visit-form: buildCreateVisitInput, expandPackageLines, suggestVariant (puros)"
  - "VisitFormDialog: agendamento multi-serviço, pacote, sinal (createVisit)"
  - "AppointmentDetailsDialog, CancelAppointmentDialog, TimeBlockDialog"
  - "Remoção de bloqueio pela agenda (AlertDialog)"
  - "Contrato de seletores data-testid para o E2E 03-12"
affects: [03-11, 03-12]
tech-stack:
  added: []
  patterns:
    - "Linha de serviço como componente próprio (LineRow) para cada uma ter sua query professionalsForService"
    - "Link da comanda condicionado a comandaId && isPathEnabled('/comanda'); código sempre visível como texto"
key-files:
  created:
    - apps/frontend/src/features/operations/lib/visit-form.ts
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/operations/components/calendar/AppointmentDetailsDialog.tsx
    - apps/frontend/src/features/operations/components/calendar/CancelAppointmentDialog.tsx
    - apps/frontend/src/features/operations/components/calendar/TimeBlockDialog.tsx
    - apps/frontend/src/features/operations/__tests__/visit-form.test.ts
    - apps/frontend/src/features/operations/__tests__/cancel-appointment-dialog.test.tsx
    - apps/frontend/src/features/operations/__tests__/time-block-dialog.test.tsx
    - apps/frontend/src/features/operations/__tests__/appointment-details-dialog.test.tsx
  modified:
    - apps/frontend/src/features/operations/api/appointments.api.ts
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
    - apps/frontend/src/features/operations/components/calendar/types.ts
key-decisions:
  - "Query local VisitPackagesQuery em appointments.api.ts: PackagesQuery do catálogo não traz defaultDurationMinutes do serviço"
  - "ScheduleProfessional ganhou seniorityTier opcional para sugerir a variante de preço (D-07 da Fase 2)"
  - "Com pacote escolhido as linhas ficam fixas (serviço travado, sem + nem remover); máximo de 10 linhas sem pacote"
  - "Bloqueio dia inteiro envia 00:00 do dia até 00:00 do dia seguinte (horário local) com allDay true"
requirements-completed: [SCHED-03, SCHED-04]
duration: ~75min
completed: 2026-11-02
---

# Phase 3 Plan 10: Diálogos da agenda (frontend) Summary

A agenda agora escreve: modal de agendamento multi-serviço com pacote e sinal via `createVisit` (comanda nasce junto, código no toast), detalhes do agendamento com confirmar/iniciar/cancelar com motivo obrigatório, e criação/remoção de bloqueios dos 4 tipos, tudo com máscaras BR.

## Tarefas e commits

1. Helper puro `visit-form` + mutações na API - `2f22576`
2. `VisitFormDialog` substituindo o `AppointmentModal` (SchedulePage sem `maskTime`/`maskDateBR` locais) - `573c815`
3. Detalhes + cancelamento + bloqueio ligados à agenda - `a89eeb8`

## Testes

- Frontend vitest: 280 (38 arquivos); eram 262 antes do plano (+10 visit-form, +3 cancel, +2 time-block, +3 details)
- Backend unit: 107; integração: 266 (30 suítes); backend não foi alterado
- lint e typecheck verdes; Playwright E2E existente: 8 passando
- Gate completo (lint, typecheck, unit, integração, vitest) rodado antes de cada um dos 3 commits

## Deviations from Plan

- **[Rule 3] Query local de pacotes:** o plano pedia "conferir o nome real"; `PackagesQuery` existe mas não traz `service.defaultDurationMinutes`, então criei `VisitPackagesQuery` em `appointments.api.ts` (não toquei no catálogo).
- **[Rule 2] `DialogTitle`/`DialogDescription` nos diálogos** (Radix exige para acessibilidade); o modal antigo não tinha.
- **[Rule 3] Teste extra** `appointment-details-dialog.test.tsx` (flag desligada/ligada por `vi.mock`, sem permissão de escrita), previsto nos critérios de aceite do plano.
- Sem checkbox shadcn no projeto: "Dia inteiro" usa `<input type="checkbox">` nativo com label.
- `CreateAppointmentMutation` continua exportada em `appointments.api.ts`, mas a UI não a usa mais.
- Verificação manual no navegador (criar visita com sinal R$ 50, cancelar, bloquear) NÃO foi feita neste executor; fica para o E2E do 03-12.

## Requisitos

- **SCHED-03** (bloqueios) e **SCHED-04** (sinal ao criar agendamento) marcados como concluídos: backend (03-03/03-06) e UI (este plano) cobrem criação, remoção e sinal com forma de pagamento ponta a ponta.
- **POS-01** NÃO marcado: depende da UI da comanda (03-11); aqui só nasce a comanda e o código aparece.

## Known Stubs

None.

## Notas para os próximos planos

- **Seletores (não renomear), conforme o contrato do plano:**
  - VisitFormDialog: `visit-form`, `visit-client-search`, `visit-client-option-${id}`, `visit-date`, `visit-package`, `visit-line-${i}-{service|variant|professional|time|duration}`, `visit-add-line`, `visit-deposit-amount`, `visit-deposit-method`, `visit-submit`, `visit-error`.
  - Detalhes: `appointment-details`, `appointment-comanda-code`, `appointment-confirm`, `appointment-start`, `appointment-open-comanda` (só com flag), `appointment-cancel`.
  - Cancelamento: `cancel-reason`, `cancel-reason-tag-${value}`, `cancel-submit`.
  - Bloqueio: `block-open`, `block-kind-${value}`, `block-professional` (some no feriado), `block-date`, `block-all-day`, `block-start`/`block-end` (só aparecem com "Dia inteiro" desmarcado), `block-submit`, `block-error`. Extra: `block-remove-confirm` (AlertDialog de remoção ao clicar no overlay do bloqueio).
- Padrões de entrada: `visit-date`/`block-date` são `dd/mm/aaaa` (máscara); `visit-line-${i}-time` é `HH:mm` (digitar `1000` já vira `10:00`); sinal digitado em centavos (`5000` vira `50,00`).
- Defaults: forma de pagamento do sinal "pix"; bloqueio "folga" e "feriado" iniciam com "Dia inteiro" marcado, "intervalo" e "indisponibilidade" desmarcado. Há dois botões "Bloquear horário" (barra superior com `block-open` e painel lateral sem testid).
- A duração da linha é preenchida ao escolher o serviço (ou a variante); o profissional é filtrado por `professionalsForService` e limpo se deixar de atender o serviço.
- Erros do payload (`SLOT_TAKEN` etc.) aparecem em `visit-error` com `errors[0].message` do backend e o modal permanece aberto.
- 03-11: ao ligar a flag `comanda`, `appointment-open-comanda` passa a existir sem mudança neste plano. O toast de criação mostra "Comanda <código> aberta." mesmo com a flag desligada.
- Cancelados e no_show não aparecem na grade (`HIDDEN_STATUSES`), então depois de cancelar o card some; o E2E deve verificar a ausência do card.
- Apenas `canWriteAppointments` (não PROFESSIONAL) vê Agendar/Bloquear, clica no bloqueio para remover e tem ações nos detalhes; PROFESSIONAL só vê os detalhes.

## Self-Check: PASSED

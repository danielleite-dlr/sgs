---
phase: 12-ajustar-cadastro-de-agendamento
plan: 03
subsystem: frontend-operations
tags: [agenda, pacote, modal, tdd]
requires: ["12-01"]
provides:
  - "Pacote escolhido dentro da linha de serviço (seletor Serviço | Pacote)"
affects: [12-04]
tech-stack:
  added: []
  patterns: ["linhas com id estável (key=line.id)", "expansão do pacote no lugar da linha"]
key-files:
  created:
    - apps/frontend/src/features/operations/__tests__/visit-form-package.test.tsx
  modified:
    - apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx
    - apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx
key-decisions:
  - "Linha em modo Pacote sem pacote escolhido bloqueia o envio com 'Escolha o pacote ou volte para Serviço.'"
  - "Prefill do grupo da noiva (prop prefill) não oferece o seletor de pacote"
requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-10, D-12]
duration: 40min
completed: 2026-11-27
---

# Fase 12 Plano 03: Pacote na linha de serviço Summary

O select "Pacote" do fim do modal saiu; cada linha ganhou o seletor Serviço | Pacote (alvos de 44 px) e o pacote escolhido expande no lugar da linha a partir da hora e da profissional dela, usando os helpers do 12-01.

## O que mudou

- `VisitFormDialog.tsx`: `LineState` com `id`, `kind` e `fromPackage`; `key={line.id}`; componente `KindToggle` (radiogroup com setas); `choosePackageAt` (expandPackageAt + packageStartTime + expandPackageLines) e `removePackage` (removePackageLines); selo "do pacote X", serviço travado, sem lixeira e um único "Remover pacote" nas linhas do pacote.
- D-03: com pacote escolhido, "Pacote" fica desabilitado nas demais linhas; backend e GraphQL intocados (um `packageId`).
- D-05: efeito de pacote inválido chama `removePackage` (antes zerava todas as linhas); só roda depois de `packagesData` chegar.
- Botão "Adicionar serviço" agora aparece mesmo com pacote (avulsos misturam com pacote).
- Testids de E2E preservados.

## Testes

- `visit-form-package.test.tsx` (novo, 12 casos): D-01, D-12 com e sem hora (10:00/11:00 e 09:00/10:00), D-02, D-03, D-10/D-07, D-04 (com avulsos e só pacote), D-05, envio com `packageId` e horas, `packageId: null` após remover, e mensagem para linha em modo Pacote sem pacote.
- `novo-agendamento-gestor-beauty.test.tsx`: caso novo de D-01.
- Suíte completa do frontend: 172 arquivos, 1251 testes verdes (rodada antes de um ajuste de comentário/eslint; `src/features/operations` reexecutado depois: 409 verdes). `tsc --noEmit` e `eslint src --max-warnings 0` limpos.
- Commits: RED `d020ed1`, GREEN `233ea8a`.

## Deviations from Plan

**1. [Rule 2 - validação] Linha em modo Pacote sem pacote escolhido**
- Pedido pelo orquestrador (aviso do checker). Sem isso o envio mostrava "Escolha o serviço de cada linha.", confuso.
- Fix: `handleSave` retorna 'Escolha o pacote ou volte para Serviço.' antes do `buildCreateVisitInput`; coberto por teste.

**2. [Rule 3] Mock de `ProfessionalsForServiceQuery` no teste novo** para evitar ruído de mocks ausentes. Sem impacto no comportamento.

Fora isso, executado como planejado. O grep de `apps/e2e` por `visit-package` não foi rodado separadamente; nenhum testid E2E listado foi alterado.

## Known Stubs

Nenhum.

## Self-Check: PASSED

Arquivos e commits `d020ed1`, `233ea8a` conferidos.

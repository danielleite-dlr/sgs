---
phase: 10-permiss-es-por-usu-rio
plan: 06
subsystem: comercial
tags: [permissoes, comercial, graphql, access]
requires: [10-03]
provides:
  - CommercialViewer.scopeAll, commercialViewerFrom, canWinAs
  - "@RequireAccess em todas as operações do Comercial, viewer por operação"
affects: [10-10]
key-files:
  modified:
    - apps/backend/src/commercial/commercial-access.ts
    - apps/backend/src/commercial/commercial-access.spec.ts
    - apps/backend/src/commercial/commercial.resolver.ts
    - apps/backend/src/commercial/commercial-deals.resolver.ts
    - apps/backend/src/commercial/commercial-intake.resolver.ts
    - apps/backend/src/commercial/commercial-reminders.resolver.ts
    - apps/backend/src/commercial/commercial-reports.resolver.ts
    - apps/backend/src/commercial/commercial-win.resolver.ts
    - apps/backend/src/commercial/commercial-win.service.ts
decisions:
  - "@RequirePermission foi mantido ao lado de @RequireAccess (padrão do piloto cashForecast): o guard une as permissões do item ligado"
  - Helper viewer() privado por resolver, chamando AccessService.forContext (memoizado por requisição)
metrics:
  completed: 2026-11-25
requirements: [PERM-05, PERM-06]
---

# Phase 10 Plan 06: Comercial por item de acesso Summary

O Comercial decide pelo acesso efetivo do banco: `CommercialViewer.scopeAll` vale para Admin/Gerente ou para quem ganhou um item do Comercial na operação em curso, e todas as operações declaram seus itens.

## Operação para itens

| Operação | Itens (OU) |
| --- | --- |
| commercialStages | COMERCIAL_NEGOCIOS, comercial-config, comercial-painel, comercial-relatorios |
| create/update/reorder/deleteCommercialStage | comercial-config |
| commercialLeads, commercialDuplicateCheck, create/update/linkCommercialLeadClient, delete/purgeCommercialLead | COMERCIAL_NEGOCIOS |
| commercialLead | COMERCIAL_NEGOCIOS, comercial-lembretes (a tela de Lembretes consulta o lead) |
| commercialAssignees | COMERCIAL_NEGOCIOS, comercial-lembretes, comercial-relatorios |
| commercialDeals/Deal, create/update/move/lose/assign/reopen/deleteCommercialDeal, interações, campos deals/interactions do lead | COMERCIAL_NEGOCIOS |
| commercialFormSettings, update..., regenerateCommercialFormToken | comercial-config |
| previewCommercialLeadImport, importCommercialLeads | COMERCIAL_NEGOCIOS |
| commercialReminders, commercialReminder, create/update/complete/deleteCommercialReminder | comercial-lembretes |
| commercialReminderCounts | comercial-lembretes, comercial-painel |
| commercialDashboard | comercial-painel |
| commercialReport, exportCommercialReport | comercial-relatorios |
| winCommercialDeal | COMERCIAL_NEGOCIOS |

Limite: Leads e Pipeline compartilham os mesmos resolvers (porteiro COMERCIAL_NEGOCIOS = leads OU pipeline), então desligar só um dos dois não separa as operações na API.

## Comportamento

- Atendente com Relatórios ganho: scopeAll só nas operações de relatório; em Leads/Pipeline continua com o recorte "só os meus".
- Profissional com Leads/Pipeline ganho: scopeAll, vê tudo e pode marcar ganho (`canWinAs`).
- `commercial-win.service.win()` agora recebe `CommercialViewer` em vez de `TenantContext`.

## Commits

1. a4f6354: viewer do Comercial com escopo pelo acesso efetivo
2. 8cb766e: acesso por item no Comercial

## Verificação

- Unit do backend: 68 suítes, 811 testes verdes. tsc e eslint (src/commercial) limpos; prettier conferido nos arquivos do Comercial.
- Integração `phase9` (17 suítes, 150 testes) verde.
- Loop de anotação: todas as operações dos 6 resolvers têm @RequireAccess (deals tem 14 para 12 operações por causa dos 2 ResolveField).

## Deviations from Plan

- `commercialLead` e `commercialAssignees` ganharam itens extras (lembretes/relatórios) conforme a conferência pedida pelo plano no frontend (RemindersPage e ReportsPage usam essas consultas).
- Os campos de ctx não usados em `commercialFormSettings`, `regenerateCommercialFormToken` e `commercialAssignees` foram removidos (lint).

## Known Stubs

Nenhum.

## Self-Check: PASSED

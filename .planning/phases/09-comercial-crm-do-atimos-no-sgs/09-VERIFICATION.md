---
phase: 09-comercial-crm-do-atimos-no-sgs
verified: 2026-11-24T22:10:00Z
status: passed
score: 10/10 verdades do objetivo verificadas (86/86 verdades dos planos com evidência)
re_verification: false
---

# Fase 9: Comercial - CRM do Atimos no SGS — Relatório de verificação

**Objetivo da fase:** Trazer para o SGS o acompanhamento comercial do Atimos CRM: menu Comercial (Painel comercial, Leads, Pipeline, Lembretes, Relatórios só admin/gerente); leads com histórico de interações; pipeline kanban com etapas configuráveis por salão (padrão Novo, Contato, Proposta, Negociação, Ganho, Perdido); ganho/perdido com motivo e pacote/desconto; lembretes de follow-up; negócio ganho vira cliente e abre contrato rascunho com o pacote.
**Verificado em:** 2026-11-24
**Status:** passed
**Reverificação:** Não, é a verificação inicial

## Alcance do objetivo

### Verdades observáveis (nível do objetivo)

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | O menu Comercial tem os 5 submenus e mais "Etapas e formulário"; Relatórios e Configurações só aparecem para ADMIN/MANAGER; PROFESSIONAL não vê nada | VERIFICADO | `menu-config.ts:461-507` (`roles: COMMERCIAL_ROLES`, relatórios/config `roles: ['ADMIN','MANAGER']`); `SidebarNav`, `AppDrawer` e `GlobalSearchSheet` usam `useMenu()`; `router.tsx:147-155` envolve tudo em `<CommercialRoute>` (com `managerOnly` em relatórios/config); `FEATURES.comercial: true` |
| 2 | As etapas são configuráveis por salão, com as 6 padrão e Ganho/Perdido de sistema | VERIFICADO | migração: backfill idempotente das 6 etapas (posições 100/101, `is_system`, kind won/lost); `ensureDefaultStagesTx` cobre orgs novas; `StagesSettingsTab.tsx`; CHECK `kind='open' OR sla_days IS NULL` |
| 3 | O lead fica separado da cliente, com aviso de duplicidade por telefone e e-mail e vínculo à cliente | VERIFICADO | `commercial-phone.ts` (`phoneKey`/`samePhone`), `findDuplicatesTx`, `LeadFormDialog` usa `CommercialDuplicateCheckQuery`; tabela própria `commercial_leads` |
| 4 | O lead tem vários negócios (só Noiva ou Debutante) com pacote, desconto, valor final, responsável, origem e local | VERIFICADO | `chk_cd_kind IN ('noiva','debutante')`, `chk_cd_discount`; `commercial-deals.service.ts`; `DealFormDialog.tsx` |
| 5 | Existe um histórico único de interações (6 tipos), e "próximo contato em" cria o lembrete | VERIFICADO | `chk_ci_type` com 6 tipos; `commercial-interactions.service.ts:149` `tx.commercialReminder.create` na mesma transação |
| 6 | O kanban permite arrastar no computador (otimista com rollback), rolar de lado no celular e usar "Mover para…" | VERIFICADO | `PipelineBoard.tsx`: `DndContext`, `PointerSensor`, `TouchSensor` (delay 250), `optimisticResponse`, `overflow-x-auto snap-x`; `DealCard.tsx:92` "Mover para…"; toque aprovado manualmente em 09-VALIDATION |
| 7 | O perdido exige motivo de lista fixa mais texto livre, e só ADMIN/MANAGER reabrem | VERIFICADO | `chk_cd_lost` + `chk_cd_lost_code` (6 códigos); `commercial-deals.service.ts:558` bloqueia reabertura fora da gestão; `LoseDealDialog` |
| 8 | O negócio ganho cria ou reaproveita a cliente e abre grupo + contrato RASCUNHO com o pacote; o sinal entra no contrato e no caixa; tudo atômico | VERIFICADO | `commercial-win.service.ts`: `FOR UPDATE` + `DEAL_CLOSED`, `createClientTx`/`updateClientTx`, `contracts.createInTx(tx, …)`, `recordContractPaymentsTx(…)`, `canWinDeal`, debutante com `beneficiaryName`; `Contract.status @default("draft")`; integração `phase9-win-deal` confere `status === 'draft'`; `WinDealDialog.tsx:145` navega para `/contratos/{id}` |
| 9 | Os lembretes aparecem em lista (vencidos, hoje, próximos, concluídos), com destaque no Painel e push na hora marcada | VERIFICADO | `commercial-reminders.service.ts` (`SKIP LOCKED`, `kind: 'commercial.reminder'`), scheduler `* * * * *`; `push.service.ts:55,193-198` `dispatchCommercialReminder`; `PUSH_ROUTE_RE` com `comercial\/lembretes` em `packages/shared` e `sw.js`; `RemindersPage.tsx:142` lê `?lembrete=`; push no aparelho aprovado manualmente |
| 10 | O Painel mostra os números e os Relatórios (só ADMIN/MANAGER) têm filtros e exportação Excel/PDF; a visibilidade por papel é imposta na API | VERIFICADO | `CommercialDashboardPage` → `useQuery(CommercialDashboardQuery)`; `commercial-dashboard.service.ts` com `visibilityWhere(` em toda contagem; `commercial-reports.resolver.ts` com `COMMERCIAL_MANAGE`; `commercial-export.ts` (`escapeCell`, xlsx/pdf); `ReportsPage.tsx:115` `downloadBase64File(`; `@RequirePermission(PERMISSIONS.COMMERCIAL_*)` em 14 operações do resolver principal |

**Pontuação:** 10/10 verdades verificadas.

Também conferi as 86 verdades declaradas nos `must_haves` dos 17 planos pelos artefatos e key links abaixo. As verdades de staging do 09-16 (migração aplicada, scheduler, headers) não foram reconferidas no ambiente, como pedido. Elas ficam apoiadas no 09-16-SUMMARY e no CI verde.

### Artefatos obrigatórios

`gsd-tools verify artifacts` deu 47/49. As duas falhas são falsos negativos, causados pelo padrão com escape duplo:

| Artefato | Status | Detalhe |
|----------|--------|---------|
| `apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql` | VERIFICADO | 261 linhas, 6 tabelas, ENABLE + FORCE RLS + `tenant_isolation` nas 6, CHECKs, FKs `ON DELETE SET NULL`, backfill, permissões |
| `apps/backend/prisma/schema.prisma` (models Commercial*) | VERIFICADO | presente |
| `apps/backend/src/commercial/*` (access, phone, sla, constants, stages, leads, deals, interactions, win, reminders + scheduler, dashboard, reports, export, lead-sheet, import, public-lead) | VERIFICADO | todos existem, têm código real e estão ligados ao `CommercialModule` (`app.module.ts:67`) |
| `apps/backend/src/graphql/schema/commercial*.graphql` | VERIFICADO | `commercialDuplicateCheck`, `loseCommercialDeal`, `exportCommercialReport`, `previewCommercialLeadImport` |
| `apps/backend/src/clients/client-tx.ts`, `contracts.service.ts#createInTx` | VERIFICADO | usados pelo ganho |
| `apps/backend/src/push/push.service.ts`, `push-messages.ts` | VERIFICADO | ramo `commercial.reminder` |
| `packages/shared/src/push.ts` | VERIFICADO | `PUSH_ROUTE_RE = /^\/(agenda\|comercial\/lembretes)…/` e `buildReminderRoute`. O "Missing pattern" da ferramenta é falso negativo |
| `apps/frontend/src/features/commercial/**` (páginas, componentes, api, lib, public) | VERIFICADO | presentes e ligados às rotas |
| `apps/frontend/nginx.conf` | VERIFICADO | `location ^~ /contato/` com `frame-ancestors *`; o resto segue `SAMEORIGIN` |
| `apps/e2e/support/phase9.ts`, `apps/e2e/tests/comercial-{funil,visibilidade,formulario}.spec.ts` | VERIFICADO | o funil espera `/\/contratos\/[0-9a-f-]{36}$/` e "Rascunho". O "Missing pattern" da ferramenta é falso negativo, porque o arquivo usa regex com barra escapada |
| `apps/backend/test/integration/phase9-*.e2e.spec.ts` | VERIFICADO | 12 suítes (rls-rbac, stages, leads, deals, interactions, lose, win, reminders, push-reminder, reports, import, public-form) |

### Verificação dos key links

`gsd-tools verify key-links` acusou 19 falhas. Todas vieram de padrões com `\\(` em dobro ("Invalid regex") ou de escape incompatível. Conferi cada uma manualmente com grep:

| De | Para | Status | Evidência |
|----|------|--------|-----------|
| permissions.catalog.ts | migração role_permissions | LIGADO | `commercial.manage` nas duas fontes |
| SidebarNav/AppDrawer/GlobalSearchSheet | `useMenu()` | LIGADO | `SidebarNav.tsx:58,317`, `AppDrawer.tsx:37` |
| router.tsx | `<CommercialRoute>` | LIGADO | linhas 147-155 |
| commercial-leads.service | `visibilityWhere(` | LIGADO | 4 usos |
| commercial.resolver | `@RequirePermission(PERMISSIONS.COMMERCIAL_` | LIGADO | 14 usos |
| app.module | CommercialModule | LIGADO | importado e registrado |
| interactions.service | `commercialReminder.create` | LIGADO | linha 149 (`tx.`) |
| deals.service | `isDealOverdue` | LIGADO | ferramenta OK |
| win.service | `createInTx(tx` / `recordContractPaymentsTx` / `canWinDeal(` | LIGADO | linhas 188, 196, 88 |
| sw.js | regex do shared | LIGADO | regex idêntica nas duas fontes |
| push.service | `commercialReminder.findFirst` | LIGADO | linha 198 |
| reminders.service | PushEvents (`kind: 'commercial.reminder'`) / `SKIP LOCKED` | LIGADO | ferramenta OK |
| dashboard.service | `visibilityWhere(` | LIGADO | presente |
| reports.resolver | `COMMERCIAL_MANAGE` | LIGADO | 2 usos |
| import.service | `matchAssignee(` / `findDuplicatesTx` | LIGADO | linha 97; ferramenta OK |
| public-lead.controller | `@UseGuards(ThrottlerGuard)` + `@Throttle` 5/min | LIGADO | linhas 28, 41; sem novo `forRoot` |
| public-lead.service | `timingSafeEqual` | LIGADO | ferramenta OK |
| ReportsPage | `downloadBase64File(` | LIGADO | linha 115 |
| RemindersPage | `params.get('lembrete')` | LIGADO | linha 142 (o plano previa `get('lembrete')`, e a implementação é equivalente) |
| PublicLeadFormPage | `/public/leads/` | LIGADO | por `fetchPublicLeadForm` em `api/public-lead.api.ts:38` |
| WinDealDialog | `/contratos/` | LIGADO | linha 145 |
| PipelineBoard | `optimisticResponse` | LIGADO | linha 55 |
| DealCard | `canWin` | LIGADO | linhas 29, 99 |
| features.ts | `comercial: true` | LIGADO | linha 58 |
| deploy-staging.sh | migração | LIGADO | `run --rm migrate` aplica todas as migrações pendentes (não cita a fase 9 pelo nome, nem precisa) |
| docker-compose.staging.yml | `COMMERCIAL_REMINDERS_SCHEDULER` | LIGADO | `${…:-true}` |

### Rastreio do fluxo de dados (nível 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| CommercialDashboardPage | `data.commercialDashboard` | `useQuery` → dashboard.service (Prisma + `visibilityWhere`) | Sim | FLUINDO |
| ReportsPage | `data.commercialReport` + export | `useQuery`/`useLazyQuery` → reports.service | Sim | FLUINDO |
| PipelineBoard | negócios por etapa | `CommercialDealsQuery`/`MoveCommercialDealMutation` | Sim | FLUINDO |
| RemindersPage | lembretes por segmento | reminders.service | Sim | FLUINDO |
| PublicLeadFormPage | config do formulário | `fetch` GET `/public/leads/:orgId/:token` | Sim | FLUINDO |

### Verificações de comportamento

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Domínio comercial, push e client-tx (unitários) | `pnpm --filter @sgs/backend exec jest --config jest.config.ts src/commercial src/push src/clients` | 20 suítes, 197 testes verdes | PASSOU |
| Frontend comercial, menu, flag e allowlist do service worker | `pnpm --filter @sgs/frontend exec vitest run src/features/commercial src/components/layout/__tests__ src/config/__tests__/features.test.ts src/__tests__/service-worker.test.ts` | 23 arquivos, 131 testes verdes | PASSOU |
| Typecheck do backend e do frontend | `pnpm --filter @sgs/{backend,frontend} typecheck` | sem erros | PASSOU |
| CI no master | `gh run list --branch master` | os 3 últimos runs com `success` (o mais recente é `3cbd544`) | PASSOU |

Não rodei, conforme instruído: integração com Postgres, Playwright E2E e staging. O 09-16-SUMMARY registra esses itens verdes, e o CI confirma.

### Cobertura de requisitos

| Requisito | Planos | Descrição (resumo) | Status | Evidência |
|-----------|--------|--------------------|--------|-----------|
| COM-01 | 02, 04, 11, 15, 16 | lead separado, aviso "já é cliente", vínculo | SATISFEITO | verdade 3 |
| COM-02 | 10, 14, 16 | importação xlsx/csv com prévia e responsável (D-22) | SATISFEITO | `lead-sheet.ts` (`matchAssignee`, limites), `commercial-import.service.ts`, `LeadImportDialog` |
| COM-03 | 10, 14, 15, 16, 17 | formulário público com token, LGPD, honeypot, throttle e iframe | SATISFEITO | controller/service públicos, nginx `/contato/`, iframe aprovado manualmente |
| COM-04 | 05, 11, 16 | vários negócios Noiva/Debutante com pacote e desconto | SATISFEITO | verdade 4 |
| COM-05 | 01, 02, 04, 12, 16 | etapas configuráveis, padrão, SLA | SATISFEITO | verdade 2 + `commercial-sla.ts` |
| COM-06 | 12, 15, 16, 17 | kanban com arrastar, rolagem e "Mover para…" | SATISFEITO | verdade 6 |
| COM-07 | 05, 11, 15, 16 | interações com 6 tipos e próximo contato | SATISFEITO | verdade 5 |
| COM-08 | 06, 12, 15, 16, 17 | ganho → cliente + contrato rascunho + sinal no caixa | SATISFEITO | verdade 8; ganho com Pix aprovado manualmente |
| COM-09 | 05, 12, 15, 16 | perdido com motivo; reabrir só gestão | SATISFEITO | verdade 7 |
| COM-10 | 01-06, 08-10, 15, 16 | RBAC e visibilidade impostos na API | SATISFEITO | `commercial-access.ts` (`visibilityWhere`, `WIN_DEAL_ROLES`), permissões na migração, `@RequirePermission`, `FORBIDDEN_ROLE` em responsável/reabrir, suíte `phase9-rls-rbac` |
| COM-11 | 07, 08, 13, 15, 16, 17 | lembretes, destaque e push | SATISFEITO | verdade 9 |
| COM-12 | 09, 13, 16 | painel e relatórios com exportação | SATISFEITO | verdade 10 |

Os 12 IDs aparecem nos planos e no REQUIREMENTS.md, todos mapeados para a Fase 9. Nenhum requisito ficou órfão.

### Anti-padrões encontrados

| Arquivo | Linha | Padrão | Gravidade | Impacto |
|---------|-------|--------|-----------|---------|
| `apps/backend/src/commercial/*` e `apps/frontend/src/features/commercial/*` | — | sem TODO/FIXME/placeholder | — | — |
| `commercial-*.service.ts` | vários | `return null` / `return []` | Info | são cláusulas de guarda (entrada vazia, registro não visível dá null), não stubs |
| `apps/backend/package.json` + `jest.config.ts` | — | duas configs do Jest; `jest` sem `--config` falha | Info | o comando rápido do 09-VALIDATION (`exec jest src/commercial`) não roda sem `--config jest.config.ts`. O script `test` do pacote não é afetado |
| `09-*-PLAN.md` (`key_links.pattern`) | — | padrões com escape duplo (`\\(`) | Info | dão falsos negativos no `gsd-tools verify key-links`; não afetam o código |

Nenhum bloqueador.

### Verificação humana

Nenhuma pendente. Os 4 itens manuais (push no iPhone/Android, arrastar por toque no kanban, iframe em outra origem, ganho com sinal Pix) foram aprovados pela usuária em 2026-11-24 e estão registrados no 09-VALIDATION.md.

### Resumo de lacunas

Nenhuma lacuna. O código entrega o objetivo inteiro. As 6 tabelas commercial_* têm FORCE RLS e as permissões estão materializadas. O domínio puro tem testes. Há serviços para etapas, leads, negócios, interações, ganho atômico, perdido, lembretes com agendador e push, painel, relatórios com exportação, importação e formulário público. O frontend tem menu filtrado por papel, guard de rota e todas as telas ligadas às queries reais. A flag está ligada e os E2E cobrem o funil até o contrato rascunho. As falhas apontadas pelas ferramentas automáticas eram todas falsos negativos de padrão, e conferi cada uma à mão.

---

_Verificado em: 2026-11-24_
_Verificador: Claude (gsd-verifier)_

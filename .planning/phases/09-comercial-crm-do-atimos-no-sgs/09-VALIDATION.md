---
phase: 9
slug: comercial-crm-do-atimos-no-sgs
status: green
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-18
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `09-RESEARCH.md` §Arquitetura de validação.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest (backend unit/integração), Vitest 2 + Testing Library (frontend), Playwright (E2E) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vite.config.ts`, `apps/e2e/playwright.config.ts` |
| **Quick run command** | `corepack pnpm --filter @sgs/backend exec jest src/commercial` / `corepack pnpm --filter @sgs/frontend exec vitest run src/features/commercial` |
| **Full suite command** | `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | ~600 seconds (suíte completa); quick run < 60 s |

---

## Sampling Rate

- **After every task commit:** comando rápido do módulo tocado (jest do módulo ou vitest da feature) + typecheck do pacote
- **After every plan wave:** `corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase9 && corepack pnpm --filter @sgs/frontend test`
- **Before `/gsd:verify-work`:** suíte completa verde (lint, typecheck, jest, integração completa, vitest, Playwright)
- **Max feedback latency:** 60 seconds (quick run)

---

## Per-Task Verification Map

> Mapa por requisito/comportamento; a coluna Planos é preenchida pelo planner.

| Req | Comportamento | Test Type | Planos | Automated Command | File Exists | Status |
|-----|---------------|-----------|--------|-------------------|-------------|--------|
| COM-01 | normalização de telefone e duplicidade (máscara, +55, 9º dígito) | unit | 09-02 | `... exec jest src/commercial/commercial-phone.spec.ts` | ✅ | ✅ green |
| COM-01 | aviso/vínculo a cliente existente; lead não aparece em `clients` | integração | 09-04, 09-11 | `... test:integration -- phase9-leads` | ✅ | ✅ green |
| COM-02 | importação: prévia, inválidas, duplicadas, limite de linhas; responsável da planilha (D-22): casa por e-mail, por nome com acento, não casa → sem responsável + aviso, PROFESSIONAL/inativo não casa, atendente B vê o negócio atribuído a ela | unit + integração | 09-10, 09-14 | `... exec jest src/commercial/lead-sheet.spec.ts`, `... test:integration -- phase9-import` | ✅ | ✅ green |
| COM-03 | formulário público: token inválido/inativo 404, throttle, honeypot, consentimento, RLS | integração | 09-10, 09-14, 09-15 | `... test:integration -- phase9-public-form` | ✅ | ✅ green |
| COM-04/05 | etapas padrão, backfill, ordem/exclusão, Ganho/Perdido de sistema; negócios por lead | unit + integração | 09-01, 09-04, 09-05, 09-12 | `... test:integration -- phase9-stages phase9-deals` | ✅ | ✅ green |
| COM-05 | SLA por etapa (limites, sem interação, sem prazo) | unit | 09-02, 09-05 | `... exec jest src/commercial/commercial-sla.spec.ts` | ✅ | ✅ green |
| COM-06 | kanban: mover otimista, reverter em erro, "Mover para…" no celular | vitest | 09-12, 09-15 | `... exec vitest run src/features/commercial/__tests__/pipeline-board.test.tsx` | ✅ | ✅ green |
| COM-07 | interação atualiza `last_interaction_at`; "próximo contato em" cria lembrete | integração | 09-05, 09-11 | `... test:integration -- phase9-interactions` | ✅ | ✅ green |
| COM-08 | ganho atômico (cliente nova/existente, contrato rascunho, sinal no caixa), rollback, concorrência, debutante | integração | 09-06, 09-12, 09-15 | `... test:integration -- phase9-win-deal` | ✅ | ✅ green |
| COM-09 | perdido: motivo obrigatório, texto livre, reabrir | unit + integração | 09-05, 09-12 | `... test:integration -- phase9-lose-deal` | ✅ | ✅ green |
| COM-10 | `visibilityWhere` puro | unit | 09-02 | `... exec jest src/commercial/commercial-access.spec.ts` | ✅ | ✅ green |
| COM-10 | matriz papel × operação; ATTENDANT A não vê nada de B (lista, id, contagens, export); PROFESSIONAL FORBIDDEN; RLS entre orgs com FORCE RLS | integração | 09-01 (RLS + permissões), 09-04/05/06/08/09/10 (matriz por área) | `... test:integration -- phase9-rls-rbac phase9-leads phase9-deals phase9-win-deal phase9-reminders phase9-reports phase9-import phase9-public-form` | ✅ | ✅ green |
| COM-10 (front) | menu por papel; flag `comercial`; guard de rota | vitest | 09-03, 09-15 | `... exec vitest run src/components/layout/__tests__ src/config/__tests__/features.test.ts` | ✅ | ✅ green |
| COM-11 | `claimDueReminders` idempotente, reagendar zera `notified_at`, alvos e mensagem do push | unit + integração | 09-07, 09-08 | `... exec jest src/push/push-commercial.spec.ts`, `... test:integration -- phase9-push-reminder phase9-reminders` | ✅ | ✅ green |
| COM-11 | allowlist do push aceita `/comercial/lembretes` e segue rejeitando `https://evil.com`, `//evil.com`, `/agenda/../admin` | vitest | 09-07 | `... exec vitest run src/__tests__/service-worker.test.ts` | ✅ | ✅ green |
| COM-12 | painel/relatórios: conversão, valor em negociação, filtros; export xlsx/pdf; `commercial.manage`; injeção de fórmula escapada | integração + unit | 09-09, 09-13 | `... test:integration -- phase9-reports` | ✅ | ✅ green |
| E2E | lead → negócio → arrastar etapas → interação com próximo contato → ganho com sinal → contrato rascunho; perdido com motivo; atendente só vê o dela | Playwright | 09-15 | `corepack pnpm --filter @sgs/e2e test:e2e tests/comercial-funil.spec.ts tests/comercial-visibilidade.spec.ts tests/comercial-formulario.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/backend/test/integration/helpers/phase9-fixtures.ts` e `phase9-cleanup.ts` (mundo da fase 4 + atendentes A/B + profissional + pacotes noiva/debutante; apagar `commercial_*` antes de `destroyPhase4World`)
- [x] specs unitários puros: `commercial-phone`, `commercial-sla`, `commercial-access`, `lead-sheet`
- [x] `phase9-rls-rbac.e2e.spec.ts` criado junto da migração
- [x] fixtures do frontend `features/commercial/__tests__/commercial-fixtures.ts`
- [x] helper E2E `apps/e2e/support/phase9.ts`
- [x] `COMMERCIAL_REMINDERS_SCHEDULER ??= 'false'` em `test/integration/setup.ts`
- [x] dependência `exceljs` instalada antes dos testes de importação/exportação (09-02)

**Verificados no planejamento (itens "não verificado" da pesquisa):** `bodyLimit` do Fastify = 4 MiB (importação limitada a 2,5 MB, 09-10); `purge_member`/`purge_bridal_group` não precisam mudar com FKs `ON DELETE SET NULL` (provado em `phase9-rls-rbac`, 09-01); `X-Frame-Options SAMEORIGIN` vem do nginx do container (`apps/frontend/nginx.conf`), liberado só em `/contato/` com `frame-ancestors` (09-14); ícones lucide conferidos (`Handshake`, `Kanban`, `BellRing`, `BarChart3`, `Settings2`; `Columns3` não existe com esse nome); `ThrottlerModule` é `@Global()` e não pode ter segundo `forRoot` (09-10).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push do lembrete chega no iPhone e abre `/comercial/lembretes` | COM-11 | depende de dispositivo real com app instalado | no staging, criar lembrete para daqui a 2 min com o usuário inscrito no push; tocar na notificação |
| Arrastar no kanban pelo toque no celular | COM-06 | gesto de toque real | abrir Pipeline no iPhone, arrastar um card e usar "Mover para…" |
| Formulário público embutido (iframe) no site do salão | COM-03 | depende do nginx/site externo | colar o snippet numa página de teste e enviar um lead |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** gate automatizado verde em 09-16 (linhas manuais no 09-17)

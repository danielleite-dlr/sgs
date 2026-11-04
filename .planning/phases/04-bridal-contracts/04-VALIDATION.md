---
phase: 4
slug: bridal-contracts
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `04-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest (backend unit/integração), Vitest + Testing Library (frontend), Playwright 1.55 (E2E) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vite.config.ts`, `apps/e2e/playwright.config.ts` |
| **Quick run command** | `corepack pnpm --filter @sgs/backend test -- <padrão>` / `corepack pnpm --filter @sgs/frontend test -- <padrão>` |
| **Full suite command** | `corepack pnpm -r typecheck && corepack pnpm -r --if-present lint && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | ~600 seconds (suíte completa); quick run < 60 s |

---

## Sampling Rate

- **After every task commit:** unit do módulo tocado + typecheck do pacote
- **After every plan wave:** `corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4 && corepack pnpm --filter @sgs/frontend test`
- **Before `/gsd:verify-work`:** suíte completa verde (inclui regressão de integração da Fase 3 — dashboard/comanda — e E2E)
- **Max feedback latency:** 60 seconds (quick run)

---

## Per-Task Verification Map

> Mapa por requisito/comportamento, com os planos que o cobrem (coluna Planos).

| Req / Decisão | Comportamento | Planos | Test Type | Automated Command | File Exists | Status |
|---------------|---------------|-----------|--------|-------------------|-------------|--------|
| CLI-03 | Grupo com noiva + 4 acompanhantes (cliente mínima), 1 noiva por grupo, unicidade de membro | integração | 04-05 | `corepack pnpm --filter @sgs/backend test:integration -- phase4-bridal-group` | ✅ | ✅ green |
| CLI-03 / D-03 | Evento cria N agendamentos + 1 comanda/pessoa; conflito → `SLOT_TAKEN`; concorrência de 2 grupos | integração | 04-08 | `... test:integration -- phase4-bridal-schedule` | ✅ | ✅ green |
| D-04 | Deslocamento cria `time_blocks` `deslocamento`; conflita com agendamento; cancelar grupo remove blocos | integração | 04-08 | `... test:integration -- phase4-travel-blocks` | ✅ | ✅ green |
| CONT-01 | Código CT-AAAA-NNN sem buracos sob concorrência; snapshots; entrada R$/% do pacote; desconto | unit + integração | 04-02, 04-06 | `corepack pnpm --filter @sgs/backend test -- contract-math` | ✅ | ✅ green |
| CONT-01 / D-13 | Pagamentos parciais/múltiplos métodos geram `cash_movements`; sobrepagamento rejeitado; ledger imutável | integração | 04-11 | `... test:integration -- phase4-contract-payments` | ✅ | ✅ green |
| D-14 | Dashboard: contrato R$ 8.000 em 3 pagamentos + comanda 100% coberta + extra ⇒ Faturado/Recebido corretos; regressão | integração | 04-07 | `... test:integration -- phase4-financial-dashboard` | ✅ | ✅ green |
| D-08 | Fechar comanda coberta (`owed=0`), com extra, comissão e estoque; reabrir/fechar | integração + unit | 04-07 | `... test:integration -- phase4-comanda-contract` | ✅ | ✅ green |
| D-15/16 | Aceite: token válido/inválido/expirado/revogado, hash divergente, CPF inválido, aceite duplo 409, append-only, nova versão exige novo aceite | integração + unit | 04-09 | `... test:integration -- phase4-public-acceptance` | ✅ | ✅ green |
| D-15 | Rate limit → 429 após N chamadas | integração | 04-09 | `... test:integration -- phase4-public-ratelimit` | ✅ | ✅ green |
| CONT-03 / D-17..19 | `computeCancellationSettlement` (cliente/estúdio × política × antecedência); motivo + ADMIN/MANAGER; reembolso no caixa; cancela agendamentos | unit + integração | 04-02, 04-11 | `corepack pnpm --filter @sgs/backend test -- cancellation-policy` | ✅ | ✅ green |
| CONT-02 / D-20,21 | `runForOrg(now)`: 4 tipos de alerta, dedupe, só ADMIN/MANAGER, e-mail resumo no outbox, idempotência, fuso | integração | 04-10 | `... test:integration -- phase4-contract-alerts` | ✅ | ✅ green |
| CONT-02 | `job_list_active_orgs()` enxerga todas as orgs sob `sgs_app` | integração | 04-10 | `... test:integration -- phase4-job-orgs` | ✅ | ✅ green |
| AI-01 | `validateProposal`, heurística determinística, client fake: sucesso / falha → heurística / sem chave / saída inválida / cache hit / limite diário | unit + integração | 04-03, 04-12 | `corepack pnpm --filter @sgs/backend test -- ai-schedule` | ✅ | ✅ green |
| RBAC/RLS | Todas as tabelas novas isoladas por org; matriz de permissões; rota pública não vaza entre orgs | integração | 04-01, 04-15 T1 | `... test:integration -- phase4-rls-rbac` | ✅ | ✅ green |
| Frontend | Telas de grupo/contrato/aceite pública, gate por papel, `computePaymentSummary` com cobertura | vitest | 04-04, 04-13, 04-14 | `corepack pnpm --filter @sgs/frontend test -- bridal` | ✅ | ✅ green |
| E2E | Pacote com entrada → grupo → contrato → link → aceite público → entrada → dashboard → Sugerir agenda IA (heurística) → confirmar → cancelar | Playwright | 04-15 T2 | `corepack pnpm --filter @sgs/e2e test:e2e noivas-contrato` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/backend/test/integration/helpers/phase4-fixtures.ts` — 2 orgs, profissionais por categoria, pacote de noiva com entrada, `gqlAs` (estende `phase3-fixtures`)
- [x] Specs de integração listados acima + `apps/backend/src/{contracts,bridal}/**/*.spec.ts` das funções puras
- [x] Fake `ANTHROPIC_CLIENT` e relógio injetável (`now`) como utilitários de teste
- [x] Smoke de boot do módulo de fila com `CONTRACT_ALERTS_SCHEDULER=false` nas suítes que bootam `AppModule`
- [x] `apps/e2e/tests/noivas-contrato.spec.ts` + `apps/e2e/support/phase4.ts`; mutation `runContractAlertsNow` para disparar alertas
- [x] Instalar `@anthropic-ai/sdk`, `pdfkit`, `@nestjs/throttler`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sugestão real da Claude API (com chave) | AI-01 | Exige `ANTHROPIC_API_KEY` válida e custo; CI usa client fake | No staging com chave: abrir grupo → "Sugerir agenda IA" → conferir proposta editável sem conflitos e confirmar |
| IP real gravado no aceite atrás do nginx | D-15 | Depende do proxy do staging (`trustProxy`) | Aceitar contrato pelo link público no staging e conferir IP do registro de aceite ≠ 127.0.0.1 |
| Layout do PDF do contrato | D-15 | Avaliação visual | Baixar PDF de contrato aceito e conferir texto, dados e rodapé com hash |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** aprovado em 2026-11-04 (04-15) — suíte automatizada verde; itens manuais seguem no 04-16

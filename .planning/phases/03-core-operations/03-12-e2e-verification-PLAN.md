---
phase: 03-core-operations
plan: 12
type: execute
wave: 5
depends_on: ["03-06", "03-07", "03-08", "03-09", "03-10", "03-11"]
files_modified:
  - apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts
  - apps/e2e/tests/seed.setup.ts
  - apps/e2e/support/seed-state.ts
  - apps/e2e/tests/agenda-dnd.spec.ts
  - apps/e2e/tests/agenda-concorrencia.spec.ts
  - apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts
  - apps/e2e/tests/financeiro-dashboard.spec.ts
  - .planning/phases/03-core-operations/03-VALIDATION.md
autonomous: false
requirements: [SCHED-01, SCHED-02, SCHED-03, SCHED-04, POS-01, POS-02, POS-03, FIN-01, FIN-02]

must_haves:
  truths:
    - "Os 5 critérios de sucesso da Fase 3 do ROADMAP são provados por specs Playwright contra backend e frontend reais"
    - "Org B não lê nem escreve nenhuma das 9 tabelas novas da org A (RLS) e a matriz de permissões por papel é aplicada nos resolvers novos"
    - "A suíte completa (lint, typecheck, unit, integration, vitest, E2E) está verde"
    - "A redução de escopo do POS-02 (Pix manual, sem QR; sem voucher) está registrada para o verificador"
  artifacts:
    - path: "apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts"
      provides: "RLS + RBAC transversal da fase"
    - path: "apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts"
      provides: "critérios #2 e #3"
    - path: "apps/e2e/tests/agenda-dnd.spec.ts"
      provides: "critério #1"
    - path: "apps/e2e/tests/financeiro-dashboard.spec.ts"
      provides: "critério #4"
    - path: "apps/e2e/tests/agenda-concorrencia.spec.ts"
      provides: "critério #5"
  key_links:
    - from: "apps/e2e/tests/seed.setup.ts"
      to: "SeedState.phase3"
      via: "writeSeedState"
      pattern: "phase3"
---

<objective>
Provar a fase de ponta a ponta: suíte transversal de RLS/RBAC no backend, seed E2E estendido e 4 specs Playwright cobrindo os 5 critérios de sucesso do ROADMAP, atualização do VALIDATION e verificação humana final.

Purpose: gate da fase antes do `/gsd:verify-work`.
Output: 1 suíte de integração, 4 specs E2E, seed estendido, VALIDATION atualizado, checkpoint de verificação.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-VALIDATION.md
@.planning/phases/03-core-operations/03-06-SUMMARY.md
@.planning/phases/03-core-operations/03-07-SUMMARY.md
@.planning/phases/03-core-operations/03-08-SUMMARY.md
@.planning/phases/03-core-operations/03-09-SUMMARY.md
@.planning/phases/03-core-operations/03-10-SUMMARY.md
@.planning/phases/03-core-operations/03-11-SUMMARY.md
@apps/e2e/tests/seed.setup.ts
@apps/e2e/support/seed-state.ts
@apps/e2e/support/ui.ts
@apps/e2e/support/graphql.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`; Playwright: `corepack pnpm --filter @sgs/e2e exec playwright install chromium` se faltar o browser
```
Branch `master`. Gate final: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/e2e test:e2e`.
Regras E2E do repo: usar `loginViaUi`, `navigateViaMenu`, `markNoReload`/`expectNoReload` de `support/ui.ts`; projeto único `chromium`, 1 worker, `timezoneId America/Sao_Paulo`; seed via API (não SQL). `locator.dragTo()` costuma falhar com dnd-kit: usar `page.mouse.move/down/move(steps: 10)/up`.

<interfaces>
`apps/e2e/support/graphql.ts`: `gql<T>(query, variables?, token?)`, `expectNoUserErrors(payload, label)`; `support/seed-state.ts`: `SeedState { suffix, orgId, owner, manager, attendant, proBlocked, proEditable, appointment }`, `writeSeedState`, `readSeedState`, `apiLogin(email, password)`.
Seed atual cria: categoria, membros (owner/manager/attendant/2 profissionais), serviço, cliente, 1 appointment.
APIs da fase: `createVisit`, `moveAppointment`, `cancelAppointment`, `createTimeBlock`, `comanda`, `addComandaItem`, `addComandaPayment`, `closeComanda`, `reopenComanda`, `financialSummary`, `commissionRecords`, `createProduct`/`createCommissionRule` (Fase 2 — conferir nomes no SDL `products.graphql`/`commissions.graphql`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Suíte transversal phase3-rls-rbac (RLS das 9 tabelas + matriz de permissões nos resolvers)</name>
  <files>apps/backend/test/integration/phase3-rls-rbac.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/rls-isolation.spec.ts (padrão de RLS com appPrisma + SET LOCAL)
    - apps/backend/test/integration/helpers/phase3-fixtures.ts
    - apps/backend/src/authz/permissions.catalog.ts
  </read_first>
  <action>
`phase3-rls-rbac.e2e.spec.ts` (prefixo `p3rls`):
1. **RLS**: criar na org A (via GraphQL como admin A) uma visita com sinal, um bloqueio, uma comanda walk-in com produto e pagamentos, fechar. Depois, com `appPrisma.$transaction` + `SET LOCAL app.current_organization = '<orgB>'`, `SELECT count(*)` em `time_blocks, comandas, comanda_sequences, comanda_items, comanda_payments, client_credit_movements, cash_movements, commission_records, audit_log` → todos 0; `INSERT` em `comandas` com `organization_id = orgA` → erro de policy (`new row violates row-level security`).
2. **GraphQL cross-tenant**: admin B em `comanda(id: <comanda A>)` → `null`; `closeComanda(id: <comanda A>)` → `NOT_FOUND`; `moveAppointment` de appointment A → `NOT_FOUND`; `financialSummary` B não contém valores de A.
3. **Matriz** (tabela `[papel, operação, permitido]`, executada em loop): ATTENDANT — `openWalkInComanda` ✓, `addComandaPayment` ✓, `closeComanda` ✓, `reopenComanda` ✗, `adjustClientCredit` ✗, `financialSummary` ✗, `createTimeBlock` ✓, `cancelAppointment` ✓; MANAGER — `reopenComanda` ✓, `adjustClientCredit` ✓, `financialSummary` ✓; PROFESSIONAL — `comanda` (com item próprio) ✓, `addComandaItem` ✗, `closeComanda` ✗, `moveAppointment` ✗, `commissionRecords` ✓ (só dele), `financialSummary` ✗. "✗" = resposta com erro GraphQL de permissão (mesma forma que `rbac.e2e-spec.ts` observa — conferir a mensagem/extension do `PermissionGuard`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-rls-rbac</automated>
  </verify>
  <acceptance_criteria>
    - phase3-rls-rbac.e2e.spec.ts existe, cobre as 9 tabelas por nome e passa
    - A matriz tem ≥ 18 linhas (papel × operação)
  </acceptance_criteria>
  <done>Isolamento multi-tenant e RBAC das funcionalidades novas comprovados.</done>
</task>

<task type="auto">
  <name>Task 2: Seed E2E estendido + 4 specs Playwright dos critérios de sucesso</name>
  <files>apps/e2e/tests/seed.setup.ts, apps/e2e/support/seed-state.ts, apps/e2e/tests/agenda-dnd.spec.ts, apps/e2e/tests/agenda-concorrencia.spec.ts, apps/e2e/tests/fluxo-agendamento-comanda-pagamento.spec.ts, apps/e2e/tests/financeiro-dashboard.spec.ts</files>
  <read_first>
    - apps/e2e/tests/seed.setup.ts e support/seed-state.ts
    - apps/e2e/support/ui.ts (helpers obrigatórios)
    - apps/e2e/tests/equipe-cadastro-e-convite.spec.ts (estilo dos specs existentes)
    - Contratos de seletores `data-testid` declarados em 03-08 (Task 2/3), 03-09 (Task 1), 03-10 (Task 3) e 03-11 (Tasks 1–2) — usar SOMENTE esses identificadores
    - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx, AppointmentCard.tsx, VisitFormDialog.tsx
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx, components/comanda/PaymentPanel.tsx, pages/FinanceiroPage.tsx
  </read_first>
  <action>
**seed-state.ts**: `SeedState` ganha `phase3: { serviceId: string; serviceName: string; productId: string; productName: string; clientId: string; clientName: string; proId: string; proName: string; proEmail: string; proPassword: string }`.
**seed.setup.ts**: após o seed atual, via API como owner: criar produto `E2E Shampoo ${suffix}` (sale_price "35.00", estoque 10, mínimo 1), regra de comissão `service` percentage 40 para o serviço do seed, e reaproveitar cliente/serviço/profissional editável existentes; gravar em `phase3`. Datas dos specs de agenda: usar um dia útil futuro calculado (`próxima quarta-feira` a partir de hoje, no fuso SP), com horários distintos por spec, para não colidir com o appointment existente. O spec do financeiro usa hoje (D-22).

**Independência entre specs:** cada spec cria os próprios dados em `beforeAll` via API (sufixo único por spec + `Date.now()`), nunca depende de dados criados por outro spec nem da ordem de execução (Playwright roda os arquivos em ordem alfabética com 1 worker). O seed compartilhado só fornece usuários, cliente, serviço, produto, regra de comissão e profissional.

**agenda-dnd.spec.ts** (critério #1): `beforeAll` via API cria 2 agendamentos do proEditable na data alvo (10:00–11:00 e 14:00–15:00); `loginViaUi` atendente → `/agenda` → navegar até a data; `markNoReload`; localizar o card por `getByTestId('appointment-card-<id1>')`; arrastar 2 slots para baixo com `page.mouse.move/down/move(steps: 10)/up` (altura do slot = `boundingBox` de `slot-<proId>-10:00`) → toast "Agendamento movido." → `expect(card).toHaveAttribute('data-starts', '11:00')`; `expectNoReload`; recarregar e conferir de novo `data-starts="11:00"`/`data-ends="12:00"`; arrastar o mesmo card 6 slots para baixo (sobre o das 14:00) → toast "Não foi possível mover" e `data-starts` volta a `"11:00"`.
**agenda-concorrencia.spec.ts** (critério #5): `Promise.all` de duas `createVisit` via `gql` (mesmo profissional, 16:00–17:00 e 16:30–17:30) → exatamente uma com `errors[0].code === 'SLOT_TAKEN'` e mensagem "Horário já reservado por outra pessoa — escolha outro slot"; na UI, clicar em `slot-<proId>-16:00`, preencher `visit-client-search`/`visit-client-option-<clientId>`, `visit-line-0-service`, `visit-submit` → `getByTestId('visit-error')` com essa mensagem e o modal (`visit-form`) continua aberto.
**fluxo-agendamento-comanda-pagamento.spec.ts** (critérios #2 e #3): UI como atendente: `slot-<proId>-09:00` → `visit-form` (cliente, `visit-line-0-service`, `visit-line-0-professional`, `visit-deposit-amount` "50,00", `visit-deposit-method` Pix, `visit-submit`) → toast "Comanda C-… aberta" → clicar no card → `appointment-open-comanda` → `comanda-add-product` → `add-item-product`, `add-item-professional`, `add-item-quantity` 1, `add-item-submit` → `payment-use-credit` (texto contém "R$ 50,00") → `payment-method-select` Pix + `payment-amount` com (total − 100) + `payment-add` → `payment-method-select` Dinheiro + `payment-amount` "50,00" + `payment-add` → `payment-change` diferente de "R$ 0,00" → `comanda-close` → `comanda-status` "Fechada" e `comanda-commissions` contém o nome do profissional e 40% do preço cheio. Via API: estoque do produto 9; `commissionRecords` com `ruleSnapshot` contendo `"kind":"percentage"`; alterar a regra para 50% via API e conferir que `calculatedAmount` não mudou; login como o profissional → `/financeiro/comissoes` mostra só o próprio registro.
**financeiro-dashboard.spec.ts** (critério #4) — autossuficiente: `beforeAll` via API como owner: `createVisit` para hoje + 1 h (cliente/serviço/profissional do seed; se cair fora da faixa 07h–22h, usar o próximo slot livre do dia seguinte — o filtro NÃO usa a data do agendamento) com `deposit { amount: "50.00", method: "pix" }`; `addComandaPayment` `client_credit` "50.00", `pix` com (total do serviço − 50 − 20) e `cash` "30.00" (troco 10,00); `closeComanda`; ler `financialSummary(preset Hoje)` via API **antes** de criar os dados e **depois**, e calcular os deltas esperados: Faturado += total da comanda; Recebido += 50 (sinal pix) + pix + 30 − 10 (troco) — porque D-22 conta Faturado pela data de fechamento e Recebido pela data do movimento, ambas hoje; Pix += 50 + pix; Dinheiro += 20. UI: owner → `/financeiro` → `period-preset-today` → `kpi-billed` e `kpi-received` iguais aos valores "depois" da API; `received-method-pix` e `received-method-cash` presentes com os totais "depois"; `financial-chart` contém `.recharts-bar-rectangle`; `granularity-week` e `granularity-month` mantêm `kpi-billed`/`kpi-received`. Comparar com os valores lidos da API (e não com números absolutos), para não depender de outros specs que também fecham comandas hoje.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <acceptance_criteria>
    - Os 4 specs novos existem e passam junto com os specs antigos (`smoke`, `equipe-*`)
    - seed-state.ts contém `phase3:`
    - agenda-dnd.spec.ts usa `page.mouse.down` (não `dragTo`)
    - fluxo-agendamento-comanda-pagamento.spec.ts contém `50,00`, `payment-use-credit` e `comanda-close`
    - financeiro-dashboard.spec.ts contém `beforeAll`, `closeComanda`, `period-preset-today` e não contém `Personalizado` nem referência a dados de outro spec
    - Os specs só usam `getByTestId(...)` com identificadores declarados em 03-08/03-09/03-10/03-11 (e textos de toast)
  </acceptance_criteria>
  <done>Os 5 critérios de sucesso da Fase 3 estão automatizados e verdes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verificação humana do loop operacional + registro do desvio POS-02</name>
  <read_first>
    - .planning/phases/03-core-operations/03-VALIDATION.md
    - .planning/phases/03-core-operations/03-CONTEXT.md (adendo D-22..D-25 e ajustes técnicos)
    - .planning/ROADMAP.md (critérios de sucesso da Fase 3)
  </read_first>
  <acceptance_criteria>
    - 03-VALIDATION.md contém `nyquist_compliant: true` e `wave_0_complete: true`
    - 03-VALIDATION.md contém a seção `Desvios aceitos` com `POS-02`, `voucher` e `Pix QR`
    - Gate final (lint, typecheck, unit, integration, vitest, E2E) verde antes de pedir a verificação
    - Usuário respondeu "aprovado"
  </acceptance_criteria>
  <files>.planning/phases/03-core-operations/03-VALIDATION.md</files>
  <action>Antes de pausar: (1) rodar o gate final completo (lint, typecheck, unit, integration, vitest, E2E); (2) atualizar `03-VALIDATION.md`: marcar cada linha da tabela "Per-Requirement Verification Map" como ✅ (ou ❌ com motivo), ajustar os nomes de arquivo que mudaram/foram acrescentados (`phase3-visit`, `phase3-appointments-lifecycle`, `phase3-client-credit`, `phase3-rls-rbac`), setar no frontmatter `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`, e acrescentar a seção `## Desvios aceitos` com: POS-02 sem Pix QR (registro manual; gateway na Fase 5) e sem voucher (v2) — D-09/D-10; D-01 com lock por profissional em vez de hash do slot; D-14 com reversão por registro novo (`kind='reversal'`); todo cancelamento exige motivo (inclusive ADMIN); D-25 sem expediente (faixa fixa 07h–22h); ajuste manual de crédito não gera movimento de caixa; pacote vendido entra inteiro na comanda (1 item por unidade, comissão sobre o preço cheio — D-23); comissão `fixed` é por unidade. (3) Então apresentar o checkpoint abaixo.</action>
  <what-built>Agenda com DnD/semana/bloqueios/sinal, comanda (walk-in, itens, pacote, pagamento dividido, fechamento com comissão, reabertura), financeiro (dashboard Faturado × Recebido, comissões, crédito de cliente).</what-built>
  <how-to-verify>
    1. `corepack pnpm --filter @sgs/backend dev` e `corepack pnpm --filter @sgs/frontend dev`; logar como dono.
    2. Agenda: arrastar um card para outro horário e para outra raia; arrastar por cima de outro card (deve voltar com toast); alternar Dia/Semana; criar um Intervalo e um Feriado (cores distintas; feriado em todas as raias).
    3. Criar agendamento com 2 serviços e sinal R$ 50,00 (Pix) → abrir a comanda pelo card → adicionar um produto → usar o crédito + Pix + Dinheiro com troco → fechar → conferir "Comissões geradas".
    4. Reabrir a comanda com motivo (como gerente) → conferir que voltou a "Aberta" e que o estoque voltou.
    5. Financeiro: "Mês atual" mostra Faturado e Recebido, gráfico e tabela por forma de pagamento; Comissões calculadas; Crédito de cliente.
    6. Teclado: focar um card na agenda, Espaço, setas, Espaço — o card move (WCAG 2.1.1). Conferir legibilidade das 4 cores de bloqueio.
  </how-to-verify>
  <verify>
    <automated>cd /root/sgs && grep -q "nyquist_compliant: true" .planning/phases/03-core-operations/03-VALIDATION.md && grep -q "Desvios aceitos" .planning/phases/03-core-operations/03-VALIDATION.md && corepack pnpm --filter @sgs/e2e test:e2e</automated>
  </verify>
  <done>VALIDATION atualizado, gate final verde e usuário aprovou a verificação manual.</done>
  <resume-signal>Digite "aprovado" ou descreva os problemas encontrados</resume-signal>
</task>

</tasks>

<verification>
Gate final completo (incluindo E2E) verde; `03-VALIDATION.md` com `nyquist_compliant: true` e a seção de desvios aceitos.
</verification>

<success_criteria>
- Critérios #1–#5 do ROADMAP com spec E2E verde
- RLS/RBAC das tabelas e resolvers novos comprovados
- Desvios de escopo documentados para o verificador
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-12-SUMMARY.md`
</output>

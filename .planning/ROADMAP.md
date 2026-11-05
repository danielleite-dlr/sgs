# Roadmap: SGS — Plataforma de Gestão para Salões de Beleza

**Milestone:** v1.0 — MVP
**Total phases:** 5
**Requirements covered:** 33/33

## Overview

Construir um SaaS multi-tenant completo para salões de beleza, partindo da fundação de infraestrutura e identidade, avançando pelo catálogo e clientes, entregando o loop operacional central de agendamento+POS+financeiro como uma unidade atômica, adicionando a vertical de noivas como diferenciador, e finalizando com comunicação automatizada e qualidade de lançamento.

## Phases

- [x] **Phase 1: Foundation** - Infraestrutura multi-tenant, autenticação e RLS — pré-requisito não negociável para tudo
 (completed 2026-05-06)
- [ ] **Phase 2: Core Domain** - Catálogo de serviços/produtos e perfis de clientes — o inventário do negócio
- [ ] **Phase 3: Core Operations** - Loop atômico de agendamento + POS + financeiro + comissões
- [ ] **Phase 4: Bridal & Contracts** - Vertical de noivas, contratos de evento e IA de otimização de agenda
- [ ] **Phase 5: Communication & Launch** - Automação WhatsApp, campanhas, previsão financeira e qualidade de produção

## Phase Details

### Phase 1: Foundation

**Goal:** Infraestrutura multi-tenant com RLS, autenticação JWT e RBAC estão prontos — qualquer módulo de negócio pode ser construído com segurança de isolamento garantida.

**Depends on:** Nothing (first phase)

**Requirements:**
- INFRA-01: Monorepo NestJS + React com Docker Compose (backend, frontend, postgres, redis, meilisearch)
- INFRA-02: PgBouncer em transaction-mode com roles `sgs_migrator`/`sgs_app` e FORCE ROW LEVEL SECURITY
- INFRA-03: Redis com AOF persistence + BullMQ para filas assíncronas
- AUTH-01: Login e criação de conta com email/senha e JWT (access 15min + refresh 30 dias)
- AUTH-02: Sessão persistida entre refreshes de browser via refresh token rotation
- AUTH-03: RBAC com 4 roles: Administrador, Gerente, Atendente, Profissional

**Success Criteria** (what must be TRUE):
1. Um desenvolvedor consegue rodar `docker compose up` e ter todos os serviços prontos em menos de 5 minutos
2. Um usuário consegue criar uma organização, fazer login e ter sua sessão mantida após fechar e reabrir o browser
3. Um usuário com role Profissional recebe erro ao tentar acessar rotas restritas a Administrador
4. Um CI smoke test verifica que queries da `sgs_app` role não conseguem ler dados de outra organização (RLS enforcement comprovado)
5. PgBouncer está em transaction-mode e o CI test confirma que `SET LOCAL` para `app.current_tenant_id` não vaza entre conexões

**Plans:** 7/7 plans complete

Plans:
- [x] 01-PLAN-monorepo-docker.md — pnpm monorepo + Docker Compose stack (postgres, pgbouncer, valkey, backend, frontend) booting in <5min
- [x] 01-PLAN-database-rls.md — Prisma schema, identity tables, FORCE ROW LEVEL SECURITY, TenantContextService, CI RLS isolation suite
- [x] 01-PLAN-frontend-scaffold.md — Tailwind 3 + shadcn/ui design tokens, Apollo Client, Zustand auth store, react-i18next pt-BR, React Router
- [x] 01-PLAN-backend-auth-core.md — Signup with org creation, email verification (Resend), login, refresh-token rotation, JWT access tokens
- [x] 01-PLAN-backend-rbac-invitations.md — 4 system roles + permission catalog + RequirePermission guard + member invitation flow
- [x] 01-PLAN-frontend-auth-pages.md — Login, Signup (2-step), Verify Email, Invitation Acceptance, 404 pages per UI-SPEC
- [x] 01-PLAN-ci-integration.md — TestEmailAdapter, full-auth-flow integration test, complete CI workflow, operator README, phase summary

**UI hint:** yes

---

### Phase 2: Core Domain

**Goal:** Proprietário pode configurar o catálogo completo de serviços, produtos e regras de comissão, e atendentes podem criar e consultar perfis de clientes com histórico.

**Depends on:** Phase 1

**Requirements:**
- CAT-01: Categorias hierárquicas e serviços com precificação dinâmica (variações por duração, profissional, seniority)
- CAT-02: Pacotes combinando múltiplos serviços com preço próprio
- CAT-03: Produtos com controle de estoque e alertas de nível mínimo
- CAT-04: Regras de comissão por serviço, produto e profissional (fixo ou percentual)
- CLI-01: Perfil de cliente com CPF, contatos, data de aniversário e observações
- CLI-02: Histórico completo de atendimentos, produtos consumidos e comandas do cliente

**Success Criteria** (what must be TRUE):
1. Proprietário consegue criar uma categoria, adicionar um serviço com preço diferente para profissional júnior vs sênior, e visualizar o catálogo hierárquico completo
2. Proprietário consegue criar um pacote com 3 serviços e ver o preço do pacote calculado separadamente do preço individual dos serviços
3. Proprietário consegue cadastrar um produto, definir nível mínimo de estoque, e receber alerta quando o estoque cai abaixo do limite
4. Proprietário consegue configurar regra de comissão de 20% para um serviço específico e ver a regra aplicada ao profissional correto
5. Atendente consegue criar perfil de cliente com CPF e visualizar o histórico completo de visitas e consumo daquele cliente

**Plans:** 6/8 plans executed

Plans:
- [x] 02-database-schema-PLAN.md — Phase 2 Prisma migration (10 tables + RLS), permissions catalog, empty bounded-context modules
- [x] 02-frontend-appshell-PLAN.md — AppShell + SidebarNav + PageHeader + DataTable + 15 shadcn primitives + 9 routes
- [x] 02-backend-catalog-services-PLAN.md — Categories, Services (with pricing variants), Packages CRUD via GraphQL
- [x] 02-backend-products-stock-PLAN.md — Products CRUD + adjustStock with movements audit + low-stock notifications
- [x] 02-backend-commissions-clients-PLAN.md — CommissionRule scope-first CRUD + Clients with CPF + history stub
- [x] 02-frontend-catalog-categorias-servicos-PLAN.md — Categorias + Serviços screens with PricingVariantsEditor
- [x] 02-frontend-pacotes-produtos-comissoes-PLAN.md — Pacotes (price-vs-sum) + Produtos (StockBadge, AdjustStockDialog) + Comissões (scope-first)
- [x] 02-frontend-clientes-PLAN.md — Clientes list + create/edit + detail with Dados/Histórico tabs + CPF mask/duplicate lookup

**UI hint:** yes

---

### Phase 02.1: Equipe e profissionais — cadastro completo de profissionais (INSERTED)

**Goal:** Um admin convida um profissional definindo papel e senioridade, gerencia a equipe em `/profissionais` (editar, desativar, reativar, revogar convite), e esse profissional passa a aparecer no seletor da agenda e no formulário de regra de comissão.

**Requirements:**
- EQUIPE-01: Convidar membro já definindo papel, `isProfessional` e senioridade, com a configuração aplicada ao membro no aceite do convite
- EQUIPE-02: `updateMember` altera papel, `isProfessional` e senioridade de membro existente (permissão `member.editRole`)
- EQUIPE-03: `deactivateMember`/`reactivateMember` desligam e religam o profissional sem perder histórico; a desativação é recusada enquanto houver agendamento futuro, com quantidade e identificação (permissão `member.remove`)
- EQUIPE-04: A query `members` (picker da agenda e da regra de comissão) só devolve ativos; a query nova `allMembers` devolve todos com status, para a tela administrativa
- EQUIPE-05: Tela `/profissionais` no ar — rota registrada em `router.tsx` e flag `equipe: true` no mesmo commit em que a tela lê dado real

**Fora de escopo:** `/profissionais/perfis` e o filtro `?filtro=aniversariantes` em `/clientes` (ambos do M1 do ROADMAP-MOCKS, cortados desta fase).

**Depends on:** Phase 2
**Plans:** 2 plans (2 waves)

Plans:
- [x] 02.1-backend-members-lifecycle-PLAN.md — SDL + DTOs, `MembersService` (listAll/update/deactivate com guarda/reactivate), resolvers autorizados e cobertura RBAC/RLS de integração
- [x] 02.1-frontend-profissionais-PLAN.md — API layer + i18n, dialogs de convidar/editar/desativar, `ProfissionaisPage`, rota e flag `equipe: true`

### Phase 3: Core Operations

**Goal:** O loop operacional central está completo — atendente agenda, executa o atendimento com comanda, registra pagamento e o sistema calcula comissões e atualiza o financeiro automaticamente em uma única sequência sem fricção.

**Depends on:** Phase 2

**Requirements:**
- SCHED-01: Calendário com raias por profissional (dia/semana), protegido contra double-booking via advisory lock
- SCHED-02: Criar agendamentos e mover via drag-and-drop no calendário
- SCHED-03: Criar bloqueios de horário (intervalos, feriados, indisponibilidade)
- SCHED-04: Registrar sinal/depósito ao criar agendamento com rastreamento do valor pré-pago
- POS-01: Criar comanda acumulando serviços e produtos durante o atendimento
- POS-02: Registrar pagamento com múltiplos métodos (dinheiro, Pix QR, cartão, transferência, crédito, voucher) — **Fase 3 (redução de escopo aceita, D-09/D-10):** Pix por registro manual (sem QR/gateway, que vai para a Fase 5) e sem voucher; crédito na conta incluído.
- POS-03: Dividir total de comanda em múltiplos pagamentos parciais de métodos diferentes
- FIN-01: Dashboard financeiro com receita por dia/semana/mês e breakdown por método de pagamento
- FIN-02: Cálculo automático de comissões por profissional ao fechar comanda, com snapshot imutável dos inputs

**Success Criteria** (what must be TRUE):
1. Atendente consegue visualizar a agenda em calendário com raias por profissional e arrastar um agendamento para outro horário sem causar double-booking
2. Atendente consegue criar um agendamento, registrar sinal de R$50, abrir a comanda, adicionar serviços e produtos, e fechar o pagamento dividido entre Pix e dinheiro
3. Ao fechar a comanda, o sistema calcula automaticamente a comissão do profissional e registra o snapshot imutável dos valores — sem intervenção manual
4. Proprietário consegue abrir o dashboard financeiro e ver receita do dia/semana/mês com breakdown por método de pagamento
5. Tentativa de criar dois agendamentos simultâneos para o mesmo profissional no mesmo horário resulta em erro claro para o segundo tentante

**Plans:** 12 plans (5 waves)

Plans:
- [x] 03-01-database-schema-PLAN.md — Migration única (bloqueios, comanda, pagamentos, crédito, caixa, comissões, audit_log), constraint recriada, RLS, REVOKE nos ledgers, permissões, money.ts, fixtures de teste (W1)
- [x] 03-02-frontend-foundation-PLAN.md — dnd-kit + override react-is (Recharts), libs puras de dinheiro/período/semana/grade 07h–22h/rótulos/máscaras (W1)
- [x] 03-03-backend-scheduling-PLAN.md — Advisory lock por profissional, mover/status/cancelar com motivo, bloqueios dos 4 tipos, testes de concorrência (W2)
- [x] 03-04-backend-comandas-core-PLAN.md — Código C-AAAA-NNN, walk-in, itens/pacote rateado, pagamentos parciais com falta/troco (W2)
- [x] 03-05-backend-financial-credit-PLAN.md — Ledger de crédito/caixa/auditoria, dashboard Faturado × Recebido por método, comissões e crédito de cliente (W2)
- [x] 03-06-backend-visit-deposit-PLAN.md — createVisit/createAppointment abrem comanda na mesma transação, sinal como crédito + caixa (W3)
- [x] 03-07-backend-close-reopen-PLAN.md — Resolver de comissão (preço cheio, sem regra = R$0 + aviso), fechamento atômico, reabertura auditada com reversões (W3)
- [x] 03-08-frontend-agenda-grid-PLAN.md — Grade componentizada, drag-and-drop com revert otimista, vista Semana, bloqueios na grade (W3)
- [x] 03-09-frontend-financeiro-PLAN.md — /financeiro, /financeiro/comissoes e /financeiro/credito-cliente reais + flags (W3)
- [x] 03-10-frontend-agenda-dialogs-PLAN.md — Modal de visita multi-serviço/pacote com sinal, detalhes/status/cancelamento, bloqueios (W4)
- [x] 03-11-frontend-comanda-PLAN.md — /comanda e /comanda/:id reais, pagamento dividido, fechamento com comissões, reabertura + flag comanda (W4)
- [ ] 03-12-e2e-verification-PLAN.md — RLS/RBAC transversal, Playwright dos 5 critérios, VALIDATION + verificação humana (W5)

**UI hint:** yes

---

### Phase 4: Bridal & Contracts

**Goal:** Proprietário consegue criar grupos de noivas, emitir contratos com parcelamento e cancelamento configurável, e usar IA para sugerir a alocação ótima de profissionais para o evento — o diferenciador competitivo primário do SGS.

**Depends on:** Phase 3

**Requirements:**
- CLI-03: Criar grupo de noivas associando noiva principal + acompanhantes para o mesmo evento
- CONT-01: Criar contrato de evento para grupo de noivas com valor total, parcelamento e datas de vencimento
- CONT-02: Rastrear status de cada parcela e alertar sobre vencimentos próximos e atrasos
- CONT-03: Contrato com política de cancelamento configurável e regras de retenção de valor
- AI-01: Sugestão de alocação ótima de profissionais para agenda completa de evento de noivas via Claude API

**Success Criteria** (what must be TRUE):
1. Proprietário consegue criar um grupo de noivas com noiva principal e 4 acompanhantes, associando cada uma a serviços específicos no mesmo dia de evento
2. Proprietário consegue criar um contrato de R$8.000 parcelado em 4x, definir política de retenção de 50% em caso de cancelamento com menos de 30 dias, e ver alertas automáticos de parcelas vencendo
3. Ao clicar em "Sugerir agenda IA", o sistema consulta a Claude API e retorna uma alocação otimizada de profissionais para o grupo de noivas considerando disponibilidade e tempo de serviço
4. Sistema alerta automaticamente sobre parcela de contrato vencida ou vencendo em 3 dias, sem necessidade de verificação manual pelo proprietário

**Plans:** 16 plans (7 waves)

Plans:
- [x] 04-01-database-schema-PLAN.md — Migration única (13 tabelas + ALTERs, RLS, ledgers imutáveis, job_list_active_orgs, permissões), Prisma, env da IA, deps, módulos vazios, fixtures
- [x] 04-02-contract-domain-tdd-PLAN.md — TDD: entrada/total/prazo/status derivado, cancelamento (D-22), modelo do contrato + hash, token
- [x] 04-03-ai-schedule-core-tdd-PLAN.md — TDD: schema da proposta, validador de conflitos e heurística determinística
- [x] 04-04-frontend-notifications-foundation-PLAN.md — Sino de notificações (D-24), permissões de noivas, páginas-casca e rota pública /aceite
- [x] 04-05-backend-bridal-groups-PLAN.md — CRUD de grupos de noivas (noiva + acompanhantes, cobertura, serviços, local)
- [x] 04-06-backend-contracts-core-PLAN.md — Entrada no pacote, configurações, contrato com versões/hash, código CT, link de aceite, status derivado
- [x] 04-07-backend-comanda-coverage-dashboard-PLAN.md — Abatimento do contrato na comanda (D-08) e Faturado sem dupla contagem (D-14/D-25)
- [x] 04-08-backend-bridal-schedule-PLAN.md — Agenda do evento (agendamentos reais, cobertura, sinal, deslocamento, teste, cancelamento do grupo)
- [x] 04-09-public-acceptance-pdf-PLAN.md — Aceite público com rate limit/trustProxy, PDF e página pública
- [x] 04-10-backend-contract-alerts-PLAN.md — Job BullMQ diário de alertas, notificações deduplicadas por papel e e-mail de resumo
- [x] 04-11-backend-contract-payments-cancel-PLAN.md — Pagamentos livres, estorno e cancelamento com acerto
- [x] 04-12-backend-ai-schedule-PLAN.md — Sugestão de agenda via Claude API com cache, limite, fallback e confirmação
- [x] 04-13-frontend-bridal-groups-PLAN.md — Telas de grupos de noivas e "Sugerir agenda IA"
- [x] 04-14-frontend-contracts-PLAN.md — Telas de contratos, pagamentos, cancelamento, configurações; cobertura na comanda; entrada no pacote
- [x] 04-15-e2e-verification-PLAN.md — Flags ligadas, suíte RLS/RBAC da fase 4, E2E noivas-contrato, suíte completa
- [ ] 04-16-human-verification-PLAN.md — Verificação humana (IP real, PDF, Claude real, sino por papel)

**UI hint:** yes

---

### Phase 04.1: Layout e regras do contrato (modelo Studio JS) (INSERTED)

**Goal:** O contrato de evento segue o layout e as regras do modelo do Studio JS (referência em `phases/04.1-.../04.1-REFERENCE-modelo-studio-js.md`): PDF em 2 páginas com tabelas Contratante / Orçamento / Forma de pagamento, logo de fundo, cláusulas I–VIII, local e data e linhas de assinatura, mais o bloco de aceite digital do SGS; tipo Noiva/Debutante; dados da contratante (RG, CEP, celulares 1–3, endereço), horário do evento, nome do local e endereço do atendimento; serviços adicionais e desconto com descrição; pagamento à vista ou sinal parcelado com vencimentos e alertas; dados do studio, logo e modelo configuráveis por salão.

**Decisões do usuário (2026-11-04):**
- Assinatura: mantém o aceite por link do SGS (D-15). O PDF ganha as linhas de assinatura e o bloco de aceite digital. ZapSign fora de escopo.
- Sinal parcelado: parcelas do sinal com valor e vencimento próprios, controladas pelo sistema (soma = sinal) e com alerta de vencida/vencendo. Estende D-10/D-11; o restante continua com pagamentos livres até X dias antes.
- Configurável por salão: dados do studio (razão/nome, CNPJ, endereço, representante + RG, cidade do foro) e logo de fundo nas Configurações de contrato; cláusulas I–VIII viram o modelo padrão editável (D-16), pré-preenchido com os dados do Studio JS.
- Debutante entra agora: grupo/contrato com tipo Noiva ou Debutante; na debutante, a responsável é a contratante e o nome da debutante aparece à parte.

**Requirements**: CONT-01, CONT-02, CONT-03 (refinamento)
**Depends on:** Phase 4
**Plans:** 17/17 plans complete

Plans:
- [x] 04.1-01-database-schema-seed-PLAN.md — Migration única (campos novos, parcelas do sinal, papel timbrado por hash, snapshot, RLS, backfill D-18) + seed do Studio JS pelo id da org
- [x] 04.1-02-contract-texts-tdd-PLAN.md — TDD: textos padrão do Studio JS com variáveis, negrito, WinAnsi, data por extenso, nome do arquivo
- [x] 04.1-03-snapshot-installments-tdd-PLAN.md — TDD: snapshot canônico + hash, orçamento pacote/adicionais, alocação e validação das parcelas, gate D-09
- [x] 04.1-04-backend-client-package-group-fields-PLAN.md — RG/CEP/celulares da cliente, descrição do pacote, tipo/responsável/horário/local do grupo
- [x] 04.1-05-backend-settings-letterhead-PLAN.md — Dados do studio, textos editáveis com restaurar padrão, upload do papel timbrado, bodyLimit
- [x] 04.1-06-pdf-structured-layout-PLAN.md — PDF pdfkit no layout do Studio JS (tabelas, fundo 0,8, margens, aviso pré-aceite, aceite), legado intacto
- [x] 04.1-07-backend-installment-alerts-PLAN.md — Alertas de parcela vencendo/vencida no job diário, à vista, dedupe por parcela
- [x] 04.1-08-backend-contracts-core-PLAN.md — Forma de pagamento + parcelas do sinal, desconto descrito, contratante, correção packageItem (D-05; omitido preserva), parcelas com situação derivada no detalhe
- [x] 04.1-09-backend-snapshot-version-gate-PLAN.md — Versão com snapshot estruturado + hash, contractReadiness/CONTRACT_INCOMPLETE (inclui DEPOSIT_ZERO e STUDIO_DATA), versão nova ao gerar link (D-18 sob demanda)
- [x] 04.1-10-frontend-client-package-forms-PLAN.md — Ficha da cliente (RG, CEP, celulares) e descrição do pacote no catálogo
- [x] 04.1-11-frontend-bridal-group-form-PLAN.md — Grupo de noiva/debutante com responsável, horário, nome e endereço do local
- [x] 04.1-12-frontend-contract-settings-PLAN.md — Configurações: studio, prazos, textos por seção e papel timbrado
- [x] 04.1-13-backend-acceptance-pdf-wiring-PLAN.md — Aceite/página pública com snapshot, CPF da contratante, PDF desde o rascunho, nome do arquivo, backfill testado
- [x] 04.1-14-frontend-contract-form-detail-PLAN.md — Formulário com sinal/parcelado/à vista, detalhe com parcelas, pendências do link e PDF
- [x] 04.1-15-frontend-public-accept-page-PLAN.md — Página pública com o contrato estruturado, legível no celular
- [x] 04.1-16-e2e-verification-PLAN.md — RLS/RBAC das tabelas novas, E2E noiva (sinal parcelado) e debutante (à vista), gate completo, VALIDATION.md
- [ ] 04.1-17-deploy-human-verification-PLAN.md — Push + deploy staging + CI, conferência do seed e verificação humana do PDF vs. gerador do Studio

### Phase 5: Communication & Launch

**Goal:** Comunicação com clientes está automatizada via WhatsApp oficial, previsão financeira está disponível, e o sistema atende os critérios de qualidade e observabilidade necessários para operar em produção com 250+ organizações.

**Depends on:** Phase 4

**Requirements:**
- COMM-01: Lembrete automático via WhatsApp 24h antes do agendamento
- COMM-02: Campanhas de comunicação segmentadas (aniversário, clientes inativos, sazonais)
- FIN-03: Previsão financeira para os próximos 30 dias baseada em histórico e agendamentos confirmados
- QA-01: Cobertura de testes unitários >= 80% do código de domínio no backend
- QA-02: Testes E2E (Playwright) cobrindo fluxos críticos: signup org, login, criar agendamento, fechar comanda, calcular comissão, criar contrato
- QA-03: Suite de testes de isolamento de tenant em CI verificando que RLS impede vazamento de dados entre organizações
- QA-04: Monitoramento em produção com Sentry (error tracking) e Grafana (métricas de latência, filas, DB)

**Success Criteria** (what must be TRUE):
1. Cliente recebe mensagem WhatsApp de lembrete automaticamente 24h antes do agendamento, sem ação manual do atendente
2. Proprietário consegue criar uma campanha de aniversário e ver a lista segmentada de clientes que farão aniversário no mês seguinte antes de enviar
3. Proprietário consegue abrir a previsão financeira e ver projeção de receita para os próximos 30 dias baseada em agendamentos confirmados + histórico sazonal
4. CI pipeline bloqueia merge se cobertura unitária do domínio cair abaixo de 80% ou se qualquer teste E2E dos fluxos críticos falhar
5. Sentry captura erros em produção e Grafana exibe dashboard de latência P95 da API, tamanho das filas BullMQ e conexões DB em tempo real

**Plans:** TBD

**UI hint:** yes

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 7/7 | Complete   | 2026-05-06 |
| 2. Core Domain | 6/8 | In Progress|  |
| 3. Core Operations | 0/? | Not started | - |
| 4. Bridal & Contracts | 0/? | Not started | - |
| 5. Communication & Launch | 0/? | Not started | - |

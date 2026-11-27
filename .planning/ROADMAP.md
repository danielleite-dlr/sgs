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
- [x] **Phase 4: Bridal & Contracts** - Vertical de noivas, contratos de evento e IA de otimização de agenda (completed 2026-11-05)
- [x] **Phase 5: Uso no dia a dia** - Rodada de usabilidade das telas principais e previsão financeira de 30 dias (completed 2026-11-06)
- [x] **Phase 6: Novo layout Gestor Beauty** - O sistema inteiro com a cara do Stitch "Gestor Beauty", só visual (completed 2026-11-16)
- [ ] **Phase 7: App Android Gestor Beauty com Capacitor** - App Android com avisos push, publicado na Play
- [ ] **Phase 8: App iPhone Gestor Beauty instalável** - Instalação pela tela de início do iPhone, sem loja, com notificações Web Push
- [x] **Phase 9: Comercial - CRM do Atimos no SGS** - Menu Comercial com painel, leads, pipeline, lembretes e relatórios; ganho vira cliente e contrato (completed 2026-11-25)

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

**Plans:** 16/16 plans complete

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
- [x] 04-16-human-verification-PLAN.md — Verificação humana (IP real, PDF, Claude real, sino por papel)

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

### Phase 04.2: Cronograma da noiva e das acompanhantes (modelo Studio JS) (INSERTED)

**Goal:** O grupo de noivas ganha o cronograma do dia do evento, calculado a partir do horário de saída e do pacote (Experience, Glam, Elegance), conforme as regras do Studio JS (referência em `phases/04.2-.../04.2-REFERENCE-cronograma-studio-js.md`). As madrinhas e acompanhantes só podem ser agendadas em horários que respeitem esse cronograma, já que elas também participam das fotos e do making of. O texto sai pronto para mandar no WhatsApp.

**Decisões do usuário (2026-11-14):**
- A feature fica junto da vertical de noivas (grupo de noivas da fase 4), não em tela separada.
- Base do cálculo: horário de saída (S). Cada etapa = S − offset do pacote, e os fotógrafos chegam 20 min antes do registro (fotos/making of). Os offsets só mudam com instrução explícita.
- As profissionais de make e penteado não são fixas por pacote. Quem indica é o studio em cada cronograma; sem indicação, aparece "[a definir]" com aviso. O sistema nunca preenche nem repete nomes por conta própria.
- Acompanhantes: o atendimento delas precisa terminar antes do início do registro (making of/fotos) e não pode colidir com as profissionais ocupadas na noiva.

**Requirements**: BRI-01, BRI-02
**Depends on:** Phase 04.1
**Plans:** 12/12 plans complete

**Success Criteria** (what must be TRUE):
1. Informando pacote, saída, noiva e data, o sistema gera o cronograma com os horários dos três casos de teste da referência (Experience 15h → chegada 08h; Glam 15:30 → 08h; Elegance 17:30 → 11:30) e o exemplo Glam 17h idêntico ao texto de referência
2. A hora segue o formato do Studio (08h, 17h, 12:30), as etapas aparecem em ordem e os extras (chegada dos fotógrafos) vêm depois de uma linha em branco; o texto é copiável para o WhatsApp
3. Chegada antes das 06h gera aviso antes de devolver o cronograma; profissional não indicada aparece como "[a definir]" com aviso de pendência
4. Ao agendar uma madrinha ou acompanhante do grupo, o sistema bloqueia (ou avisa) horários que terminem depois do início do making of/fotos ou que usem uma profissional já alocada na noiva naquele intervalo
5. Alterar a saída ou o pacote recalcula o cronograma e sinaliza os agendamentos de acompanhantes que deixaram de caber

Plans:
- [x] 04.2-01-timeline-domain-tdd-PLAN.md — Domínio puro com TDD: horários, formato 08h/12:30, texto do WhatsApp, avisos e janelas da noiva (4 casos da referência, Glam 17h com fotógrafos 15:10)
- [x] 04.2-02-database-schema-seed-PLAN.md — Migration: package_timeline_steps e bridal_timelines com RLS, permissão bridal.scheduleOverride, seed Experience/Glam/Elegance do Studio JS (90 min)
- [x] 04.2-03-backend-package-timeline-PLAN.md — API packageTimeline/setPackageTimeline com validação e RBAC
- [x] 04.2-04-backend-companion-guard-PLAN.md — Guarda das acompanhantes em createVisitTx e moveAppointmentTx, override Gerente/Admin com auditoria (nunca dispensa SLOT_TAKEN), bloqueio do arrastar da noiva
- [x] 04.2-05-backend-timeline-preview-PLAN.md — Simulação sem persistência, buildTimelineTx, conflitos com quem ocupa, findAdoptableBrideAppointmentsTx, cronograma confirmado com acompanhantes fora da janela
- [x] 04.2-06-backend-timeline-confirm-PLAN.md — "Ok do studio": cria/move make e penteado (90 min), adota agendamento importado, reconfirmar sem duplicar, readyBy = saída, refaz deslocamentos
- [x] 04.2-07-backend-ai-schedule-timeline-PLAN.md — Sugestão IA após o cronograma: sem ALREADY_SCHEDULED, limite no início do registro
- [x] 04.2-08-frontend-package-timeline-PLAN.md — Frontend: diálogo "Cronograma do dia" nas regras do pacote
- [x] 04.2-09-frontend-timeline-override-PLAN.md — Frontend: mensagem da guarda e "Forçar mesmo assim" (Gerente/Admin) no novo agendamento e no arrastar; pendência registrada no 06-09
- [x] 04.2-10-frontend-timeline-tab-PLAN.md — Frontend: aba "Cronograma do dia" no grupo de noivas (simulações, copiar, confirmar, acompanhantes que não cabem)
- [x] 04.2-11-e2e-rbac-gate-PLAN.md — RLS/RBAC phase42, E2E cronograma-noiva e gate completo
- [x] 04.2-12-deploy-human-verification-PLAN.md — Backup, push, deploy staging, CI e verificação humana (texto no WhatsApp, regras dos pacotes)

### Phase 5: Uso no dia a dia

**Goal:** O SGS é usável na rotina diária do Studio JS: as telas mais usadas (agenda, comanda e caixa, noivas e contratos, clientes e financeiro, painel) não travam nem confundem, e a dona vê no painel quanto deve entrar e sair nos próximos 30 dias.

**Depends on:** Phase 4.1

**Requirements:**
- FIN-03: Previsão financeira para os próximos 30 dias (agenda confirmada + parcelas de contratos − comissões a pagar − despesas fixas)
- UX-DAY: Rodada de usabilidade — auditoria das telas principais feita pelo Claude, lista priorizada aprovada pela usuária, correções aplicadas

**Success Criteria** (what must be TRUE):
1. Existe uma lista priorizada de problemas de usabilidade das telas principais, aprovada pela usuária, e os itens aprovados estão corrigidos no staging
2. A dona abre o painel inicial e vê o total previsto de entradas, saídas e saldo dos próximos 30 dias, com gráfico por semana, e clica para o detalhe no Financeiro
3. A previsão soma agendamentos confirmados e parcelas de contratos a vencer, e desconta comissões a pagar e despesas fixas cadastradas
4. A dona consegue cadastrar despesas fixas mensais (nome, valor, dia de vencimento) que entram na previsão

**Plans:** 18/18 plans complete

Plans:
- [x] 05-01-auditoria-usabilidade-PLAN.md — Auditoria no staging (usuário dedicado, só leitura) + local; 05-AUDITORIA.md commitado aguardando aprovação (D-01, D-12)
- [x] 05-02-backend-previsao-fundacao-PLAN.md — Migration fixed_expenses (RLS), permissão financial.expenseWrite, funções puras da previsão (TDD)
- [x] 05-03-backend-despesas-fixas-PLAN.md — API GraphQL de despesas fixas + integração RLS/RBAC
- [x] 05-04-backend-cash-forecast-PLAN.md — Query cashForecast (agenda, parcelas, comissões, despesas; atraso D-09; fallback D-10) + integração
- [x] 05-05-frontend-despesas-fixas-PLAN.md — Tela /financeiro/despesas-fixas + camada de API da fase
- [x] 05-06-frontend-painel-previsao-PLAN.md — Cartão no painel e detalhe /financeiro/previsao
- [x] 05-06b-frontend-home-por-papel-PLAN.md — Painel como home de ADMIN/MANAGER; PROFESSIONAL/ATTENDANT na Agenda (D-11)
- [x] 05-07-e2e-deploy-previsao-PLAN.md — E2E da previsão, gate completo, backup, deploy no staging e CI
- [x] 05-08-gerar-lotes-correcao-PLAN.md — Aprovação da auditoria pela usuária (2026-11-06) + gera os lotes de correção 05-09…05-16
- [x] 05-09-ux-lote-agenda-1-PLAN.md — Lote 1 de usabilidade: Agenda (UX-01, UX-04, UX-05)
- [x] 05-10-ux-lote-agenda-2-PLAN.md — Lote 2 de usabilidade: Agenda no celular (UX-02, UX-03)
- [x] 05-11-ux-lote-comanda-1-PLAN.md — Lote 3 de usabilidade: Comanda e caixa (UX-06, UX-07, UX-08)
- [x] 05-12-ux-lote-comanda-2-PLAN.md — Lote 4 de usabilidade: Comanda no celular e menu (UX-09, UX-10)
- [x] 05-13-ux-lote-noivas-1-PLAN.md — Lote 5 de usabilidade: Noivas e contratos (UX-11, UX-14)
- [x] 05-14-ux-lote-noivas-2-PLAN.md — Lote 6 de usabilidade: Contrato no celular e completar dados (UX-12, UX-13)
- [x] 05-15-ux-lote-clientes-PLAN.md — Lote 7 de usabilidade: Clientes (UX-15, UX-16 só padronizar nomes)
- [x] 05-16-ux-lote-financeiro-PLAN.md — Lote 8 de usabilidade: Financeiro e botões de ação (UX-17, UX-18, UX-19)
- [x] 05-20-fechamento-PLAN.md — Reverificação no staging, alinhamento do FIN-03 no REQUIREMENTS, aceite da usuária, desativação do usuário de auditoria

**UI hint:** yes

### Phase 6: Novo layout Gestor Beauty

**Goal:** O SGS ganha a cara do projeto Stitch "Gestor Beauty" (projects/5888991241990799272, sistema de design "Studio Editorial Density"): papel #F7F6F3, superfícies brancas com borda de 1 px, roxo #570080 só na ação principal (texto branco), Source Serif 4 em títulos e nomes de cliente, Public Sans no resto com números tabulares, raio 6 px, sem sombras, alvos de 44 px e status por borda esquerda de 3 px. Só o visual, com os dados que o SGS já tem (decisão da usuária em 2026-11-06); bancadas/cadeiras, meta de faturamento, exportar DRE, ocupação em tempo real, cerimonial e status de prova vão para o backlog. Ordem: lote base (tokens, componentes, menu lateral e barra inferior) e depois um lote por tela: Agenda do dia, Novo agendamento, Comanda, Entradas e saídas, Previsão de caixa, Despesas fixas, Grupo de noivas, Início.
**Requirements**: UI-LAYOUT (fase só visual, decidida pela usuária em 2026-11-06)
**Depends on:** Phase 5
**Plans:** 12 plans (completed 2026-11-16)

Plans:
- [x] 06-01-base-tokens-componentes-PLAN.md — Lote base 1/2: tokens (cores, fontes, raio, sem sombra), componentes compartilhados e varredura de cores antigas (commit local)
- [x] 06-02-base-casco-navegacao-PLAN.md — Lote base 2/2: menu lateral 256 px, topo, barra inferior Agenda/Comanda/Clientes/Noivas/Mais, PageHeader; deploy do lote base
- [x] 06-03-agenda-do-dia-PLAN.md — Agenda do dia (celular e computador): borda de status, linha do tempo, hora atual roxa, bloqueio em hachura
- [x] 06-04-novo-agendamento-PLAN.md — Novo agendamento: chips de serviço, controle segmentado de profissional, Data/Hora/Duração, Sinal recolhido
- [x] 06-05-comanda-PLAN.md — Comanda: cliente, itens e pagamento no padrão novo
- [x] 06-12-paleta-previsao-PLAN.md — Paleta, linhas e fonte da Previsão de caixa do Stitch em todo o sistema (D-26, executado logo após o 06-05)
- [x] 06-06-entradas-e-saidas-PLAN.md — Entradas e saídas (Financeiro): faixa de números, filtros, gráfico e lançamentos
- [x] 06-07-previsao-de-caixa-PLAN.md — Previsão de caixa: painel de totais, filtro segmentado, tabelas semanais
- [x] 06-08-despesas-fixas-PLAN.md — Despesas fixas: tabela, selos de situação, total mensal das ativas
- [x] 06-09-grupo-de-noivas-PLAN.md — Grupo de noivas: ficha do evento, pessoas e cronograma; título com caixa padronizada
- [x] 06-10-inicio-PLAN.md — Início: cabeçalho do painel e previsão de 30 dias no padrão novo
- [x] 06-11-fechamento-PLAN.md — Auditoria completa, roteiro de conferência e aceite da usuária

### Phase 7: App Android Gestor Beauty com Capacitor

**Goal:** A equipe do salão instala o app Android "Gestor Beauty" pela Play Store e usa o SGS no celular com as mesmas telas do sistema web, empacotado com Capacitor (sem PWA — decisão da usuária em 2026-11-14). Escopo: appId estável `br.com.gestorbeauty.app` e keystore guardada em local seguro, para que o futuro app React Native/Expo saia como atualização do mesmo app na loja; ajustes de celular (área segura/notch, teclado, botão voltar do Android, login persistente com refresh token, splash e ícone); push de novo agendamento via FCM, com registro de tokens de aparelho no backend de forma neutra (reaproveitável pelo Expo); build AAB assinado e publicação na Play Store. Preparar `packages/shared` (queries GraphQL, tipos gerados, validações) para o Expo. Fora do escopo: iOS e o app Expo (fases futuras), app para clientes/noivas.
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 13/13 plans executed (teste interno da Play pendente da conta)

Plans:
- [x] 07-01-monorepo-shared-deps-PLAN.md — packages/shared (rotas do push, validações, documentos GraphQL) e todas as dependências da fase num lockfile só, sem quebrar Docker
- [x] 07-02-backend-device-tokens-PLAN.md — tabela device_tokens com RLS, registerDeviceToken/unregisterDeviceToken e integração
- [x] 07-03-backend-push-engine-PLAN.md — destinatários (D-12/D-13), textos e rotas dos avisos (D-14/D-15) e cliente FCM HTTP v1
- [x] 07-04-mobile-capacitor-shell-PLAN.md — casca Capacitor 8 (server.url do staging, tela Sem conexão), projeto Android e check-config
- [x] 07-05-frontend-native-libs-deeplink-PLAN.md — camada nativa do frontend (push, rota segura, token) e agenda abrindo ?agendamento=
- [x] 07-06-mobile-assets-ci-build-PLAN.md — ícone GB e splash, workflow android.yml (APK debug e AAB assinado) e runbook da keystore
- [x] 07-07-backend-push-processor-PLAN.md — fila push-notifications, PushService/processor e PushModule global
- [x] 07-08-frontend-native-bridge-PLAN.md — NativeAppBridge (splash, voltar, push, registro por sessão), logout e rota pendente no login
- [x] 07-09-backend-push-hooks-PLAN.md — ganchos pós-commit em agendamento, cancelamento, noivas, cronograma e contrato
- [x] 07-10-frontend-offline-safe-area-PLAN.md — sobreposição Sem conexão e área segura no layout Gestor Beauty
- [x] 07-11-gate-deploy-staging-PLAN.md — gate completo, backup, deploy no staging e CI verde com APK debug
- [x] 07-12-firebase-keystore-secrets-PLAN.md — Firebase, conta Play, keystore com backup e secrets (ações humanas)
- [x] 07-13-device-verification-play-PLAN.md — teste no aparelho e teste interno da Play Console

### Phase 8: App iPhone Gestor Beauty instalável com notificações

**Goal:** A equipe do salão instala o Gestor Beauty no iPhone sem App Store e sem conta Apple, como app web instalável (Safari → Compartilhar → Adicionar à Tela de Início), e recebe as mesmas notificações do Android (novo agendamento, cancelamento, lote de noivas) por Web Push. Escopo: botão "Instalar no iPhone" na tela de login (só em iPhone/iPad fora do modo instalado) com passo a passo; manifest com nome "Gestor Beauty", ícone GB roxo, apple-touch-icon e tela cheia (standalone); service worker com `push` e `notificationclick` abrindo a agenda no dia (mesma rota segura do Android); botão "Ativar notificações" dentro do app instalado (o iOS exige gesto da usuária; iOS 16.4+); backend com segundo canal Web Push (VAPID) ao lado do FCM, reaproveitando `device_tokens` (provider `webpush`, platform `ios`), destinatários, textos e fila; remoção de inscrição inválida (404/410); logout desinscreve; chaves VAPID no `.env.staging`; nginx sem cache para `sw.js` e manifest. Fora do escopo: App Store/TestFlight, modo offline do sistema. Decisão da usuária em 17/11/2026 (caminho 1 de 4, com notificações).
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 8 plans

Plans:
- [x] 08-01-backend-device-tokens-webpush-PLAN.md — migration p256dh/auth e provider webpush, validação anti-SSRF do endpoint e registro da inscrição
- [x] 08-02-backend-vapid-push-config-PLAN.md — web-push 3.6.7, chaves VAPID no env/compose e query pushConfig com a chave pública
- [x] 08-03-frontend-manifest-sw-nginx-PLAN.md — ícones GB, manifest, metas iOS, sw.js só push/clique, nginx sem cache e check-pwa-headers.sh
- [x] 08-04-backend-webpush-provider-dispatch-PLAN.md — WebPushProvider (404/410 remove) e dispatch de dois canais na fila da fase 7
- [x] 08-05-frontend-webpush-client-bridge-PLAN.md — detecção iPhone/standalone, inscrição, WebPushBridge, rota pendente e logout desinscrevendo
- [x] 08-06-frontend-ui-instalar-ativar-PLAN.md — botão Instalar no iPhone com passo a passo e faixa Ativar notificações
- [x] 08-07-gate-vapid-deploy-staging-PLAN.md — gate completo, VAPID no .env.staging, backup, deploy, headers no staging e CI verde
- [ ] 08-08-iphone-verification-PLAN.md — verificação no iPhone real da usuária

### Phase 9: Comercial - CRM do Atimos no SGS

**Goal:** Trazer para o SGS o acompanhamento comercial do Atimos CRM (`/root/atmo-crm/atmos-crm`): novo menu **Comercial** com os submenus Painel comercial, Leads, Pipeline, Lembretes e Relatórios (relatórios só admin/gerente). Leads com histórico de interações; pipeline em kanban com etapas configuráveis por salão (padrão Novo, Contato, Proposta, Negociação, Ganho, Perdido), ganho/perdido com motivo e pacote/desconto; lembretes de follow-up. Negócio ganho vira cliente do SGS e abre contrato rascunho com o pacote escolhido. Vem antes do app nativo iOS (decisão da usuária em 2026-11-18, depois de achar fraca a usabilidade do app instalado pela Tela de Início).
**Requirements:** COM-01, COM-02, COM-03, COM-04, COM-05, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11, COM-12 (detalhe e rastreabilidade em REQUIREMENTS.md, seção "Comercial (Fase 9)")
**Depends on:** Phase 8
**Plans:** 17/17 plans complete

Plans:
- [x] 09-01-dados-rls-permissoes-PLAN.md — tabelas commercial_* com FORCE RLS, etapas padrão, permissões commercial.*, fixtures e phase9-rls-rbac (onda 1)
- [x] 09-02-dominio-puro-tdd-PLAN.md — TDD de telefone, SLA por etapa, visibilidade por papel e ponto único da D-21; instala exceljs (onda 1)
- [x] 09-03-frontend-base-menu-guard-PLAN.md — flag comercial, menu filtrado por papel, guard de rota, rotas e pontos de montagem (onda 1)
- [x] 09-04-backend-nucleo-etapas-leads-PLAN.md — CommercialModule + submódulos, SDL, etapas configuráveis, leads com duplicidade (onda 2)
- [x] 09-07-push-lembrete-rotas-PLAN.md — push commercial.reminder e allowlist /comercial/lembretes nas 4 cópias (onda 2)
- [x] 09-05-backend-negocios-interacoes-perdido-PLAN.md — negócios, mover/atribuir, perdido/reabrir, interações com próximo contato (onda 3)
- [x] 09-06-backend-ganho-PLAN.md — ganho atômico: cliente + grupo + contrato rascunho + sinal no caixa (createInTx, createClientTx) (onda 3)
- [x] 09-08-backend-lembretes-agendador-PLAN.md — CRUD de lembretes e tick BullMQ por minuto que dispara o push (onda 3)
- [x] 09-09-backend-painel-relatorios-export-PLAN.md — painel comercial, relatórios e exportação Excel/PDF no backend (onda 3)
- [x] 09-10-backend-formulario-importacao-PLAN.md — importação de planilha com prévia e formulário público com LGPD/anti-spam (onda 3)
- [x] 09-11-frontend-leads-PLAN.md — telas de leads, aviso de cliente existente, negócios e interações (onda 4)
- [x] 09-14-frontend-formulario-importacao-PLAN.md — diálogo de importação, aba do formulário, página pública e nginx frame-ancestors (onda 4)
- [x] 09-12-frontend-pipeline-ganho-perdido-PLAN.md — kanban, diálogos de ganho (abre o contrato) e perda, configuração de etapas (onda 5)
- [x] 09-13-frontend-lembretes-painel-relatorios-PLAN.md — telas de lembretes, painel comercial e relatórios com exportação (onda 5)
- [x] 09-15-e2e-ligar-flag-PLAN.md — liga a flag e E2E Playwright do funil, visibilidade e formulário (onda 6)
- [x] 09-16-gate-deploy-staging-PLAN.md — gate completo, backup, deploy no staging (worktree limpo se preciso) e CI verde (onda 7)
- [ ] 09-17-verificacao-humana-PLAN.md — push no aparelho, toque no kanban e iframe (onda 8)

### Phase 09.1: Assistente de noiva (INSERTED)

**Goal:** Pedido da usuária em 2026-11-24. Noivas atendidas **no estúdio** com pacote marcado "inclui assistente da noiva" têm uma **assistente** (profissional com a função "Assistente da Noiva", sem uso do sistema) que acompanha a noiva o dia todo. Diária da configuração do salão (padrão **R$ 220**, snapshot ao vincular), só **custo interno** (não muda preço nem contrato); vínculo/troca no grupo da noiva (ADMIN/MANAGER/ATTENDANT); agenda dela **bloqueada o dia todo** ("Acompanhando noiva X"); repasse da diária **ao fechar a comanda** (cancelou, não paga); noivas já cadastradas ficam pendentes, com aviso no grupo e filtro "Sem assistente" na lista. Noiva externa e debutantes ficam fora. Decisões D-01..D-18 em `.planning/phases/09.1-assistente-de-noiva/09.1-CONTEXT.md`.
**Requirements**: AN-01, AN-02, AN-03, AN-04, AN-05, AN-06, AN-07, AN-08, AN-09
**Depends on:** Phase 9
**Plans:** 10/12 plans executed

Plans:
- [x] 09.1-01-PLAN.md — migrações (colunas, bloqueio acompanhamento, purge_member, backfill guardado da Studio JS), Prisma, diária vigente e fixtures (onda 1)
- [x] 09.1-02-PLAN.md — TDD das regras puras (elegibilidade, pendência) e diária no custo do pacote (onda 1)
- [x] 09.1-03-PLAN.md — backend da função Assistente da Noiva na profissional (onda 2)
- [x] 09.1-04-PLAN.md — backend do pacote com assistente, custo/lucro e configuração da diária (onda 2)
- [x] 09.1-05-PLAN.md — backend do vínculo/troca, candidatas livres, bloqueio all-day e recusa de conflitos (onda 2)
- [x] 09.1-06-PLAN.md — repasse da diária no fechamento da comanda e ciclo do grupo (local, pacote, data, cancelamento) (onda 3)
- [x] 09.1-07-PLAN.md — frontend de Profissionais, bloqueio na agenda e textos i18n (onda 3)
- [x] 09.1-09-PLAN.md — frontend do card da assistente no grupo, filtro e selo "Sem assistente" (onda 3)
- [x] 09.1-08-PLAN.md — frontend do pacote com assistente e card da diária em Pacotes (onda 4)
- [x] 09.1-10-PLAN.md — E2E Playwright do fluxo completo (onda 5)
- [ ] 09.1-11-PLAN.md — gate, confirmação da remoção do custo manual, backup, deploy no staging e CI (onda 6)
- [ ] 09.1-12-PLAN.md — verificação humana no staging (onda 7)

### Phase 10: Permissões por usuário

**Goal:** Cada papel (Admin, Gerente, Atendente, Profissional) continua vindo com permissões padrão, mas o Admin/Gerente consegue **ligar e desligar funcionalidades por pessoa**, no nível de **item do menu/área** (Agenda, Clientes, Comandas, Financeiro, Previsão de caixa, Contratos, Noivas, Comercial, Relatórios, Catálogo, Profissionais…). Desligado ⇒ some do menu, a rota bloqueia e a **API recusa**. Ex.: um gerente que não vê Financeiro; uma profissional que não vê X. Pedido da usuária em 2026-11-18; decisões: granularidade por item do menu (não por ação), fazer logo depois da fase 9 e antes do app nativo iOS.
**Requirements**: PERM-01, PERM-02, PERM-03, PERM-04, PERM-05, PERM-06, PERM-07, PERM-08, PERM-09, PERM-10, PERM-11, PERM-12, PERM-13, PERM-14, PERM-15, PERM-16
**Depends on:** Phase 9
**Plans:** 16/16 plans executed — concluída em 2026-11-26

Plans:
- [x] 10-01-PLAN.md — TDD do catálogo de itens de acesso, matriz padrão por papel e resolveAccess (onda 1)
- [x] 10-02-PLAN.md — migração member_access_overrides (RLS forçada), Prisma e mundo de teste da fase 10 (onda 1)
- [x] 10-03-PLAN.md — AccessService, @RequireAccess, ACCESS_DENIED, guard lendo papel/ajustes do banco e query myAccess (onda 2)
- [x] 10-04-PLAN.md — acesso por item em financeiro, comandas, clientes, agenda e catálogo; custos para quem ganhou Financeiro (onda 3)
- [x] 10-05-PLAN.md — acesso por item em noivas e contratos; diária e cronograma pelo acesso efetivo (onda 3)
- [x] 10-06-PLAN.md — acesso por item no Comercial e viewer com escopo do Gerente para quem ganhou (onda 3)
- [x] 10-07-PLAN.md — administração de acessos (D-08/D-09/D-15) com auditoria, troca de papel e equipe (onda 3)
- [x] 10-08-PLAN.md — push, alertas de contrato e sino respeitam o item desligado (onda 3)
- [x] 10-09-PLAN.md — frontend: myAccess no store, atualização ao vivo, ACCESS_DENIED sem logout (onda 3)
- [x] 10-10-PLAN.md — serviços do Comercial pelo acesso efetivo e inventário automático da API (onda 4)
- [x] 10-11-PLAN.md — menu, barra inferior, busca e cartões do painel por item (onda 4)
- [x] 10-12-PLAN.md — rotas por item, tela inicial sem laço, Comercial e link de contrato por item (onda 4)
- [x] 10-13-PLAN.md — tela Profissionais › Perfis de acesso e atalho "Acessos" (onda 5)
- [x] 10-14-PLAN.md — E2E Playwright das permissões e E2E de menu por papel atualizados (onda 6)
- [x] 10-15-PLAN.md — gate, backup, deploy no staging e CI (onda 7)
- [x] 10-16-PLAN.md — verificação humana no staging: matriz padrão, iPhone/Android e tela (onda 8)

### Phase 11: Prioridade de profissionais e cronograma da noiva

**Goal:** Pedido da usuária em 2026-11-18. (1) Na tela Profissionais, marcar quem **atende noiva** e quem é **fixa**. (2) Ao sugerir/distribuir atendimentos, **preencher primeiro as fixas livres** (e, para noivas, as fixas que atendem noiva), só depois as não fixas; com **duas ou mais fixas livres, sugerir a divisão mais justa possível**. (3) No cronograma do grupo de noiva, a noiva e as acompanhantes do grupo têm prioridade para cumprir o cronograma da noiva: **todas maquiadas e penteadas antes do make-off (fotos)** e **prontas no horário de saída configurável**, sempre respeitando o cronograma. Base existente: cronograma por pacote da 04.2 (`departureTime`, etapas antes da saída) e a sugestão de agenda da fase 4 (heurística/IA em `apps/backend/src/bridal/ai`). Ordem decidida: depois da fase 10, antes do app iOS.
**Requirements**: PRIO-01, PRIO-02, PRIO-03, PRIO-04, PRIO-05, PRIO-06, PRIO-07, PRIO-08, PRIO-09, PRIO-10, PRIO-11, PRIO-12, PRIO-13, PRIO-14, PRIO-15, PRIO-16
**Depends on:** Phase 10
**Plans:** 15/24 plans executed

Plans:
- [x] 11-01-PLAN.md — TDD do ranking puro de profissionais (fixa estrita, minutos do dia, revezamento, id) (onda 1)
- [x] 11-02-PLAN.md — migração das marcações e de companions_ready_by, API do Member, filtro bridal e fixtures (onda 1)
- [x] 11-03-PLAN.md — dados do ranking (minutos do dia, revezamento derivado) e query suggestProfessionals (onda 2)
- [x] 11-04-PLAN.md — "Acompanhantes prontas até" no grupo e guarda com limite do make-off (onda 2)
- [x] 11-05-PLAN.md — servidor recusa profissional que não atende noiva/debutante (evento, prova, IA) (onda 2)
- [x] 11-06-PLAN.md — frontend das marcações em Profissionais, helper fixas primeiro e queries com isFixed/bridal (onda 2)
- [x] 11-07-PLAN.md — contexto, heurística e validador da sugestão com ranking e limite por papel (onda 3)
- [x] 11-08-PLAN.md — cronograma sugere make/penteado, avisos de lista vazia e grava saída das acompanhantes (onda 3)
- [x] 11-09-PLAN.md — agendamento comum pré-seleciona a fixa livre mais justa (onda 3)
- [x] 11-10-PLAN.md — fixas primeiro nos demais seletores (bloqueio, comissão, comanda) (onda 3)
- [x] 11-11-PLAN.md — IA: prompt/hash, checkPriority no decide, selo não fixa e motivo do não coube (onda 4)
- [x] 11-12-PLAN.md — frontend da aba Cronograma e do formulário do grupo (onda 4)
- [x] 11-13-PLAN.md — frontend da sugestão do grupo, editor manual e teste da noiva (onda 5)
- [x] 11-14-PLAN.md — E2E Playwright da prioridade e ajuste dos E2E de noiva (onda 6)
- [x] 11-15-PLAN.md — gate, backup, deploy no staging e CI (onda 7)
- [ ] 11-16-PLAN.md — verificação humana no staging, inclusive celular (onda 8)
- [ ] 11-17-PLAN.md — gap G-02: Cronograma do dia antes da Agenda do evento, aviso sem trava (gaps onda 1)
- [ ] 11-18-PLAN.md — gap G-01: papel Assistente no backend (cadastro sem login, sem acessos) (gaps onda 1)
- [ ] 11-19-PLAN.md — gap G-01: Assistente fora do agendamento, da sugestão e do cronograma (gaps onda 2)
- [ ] 11-20-PLAN.md — gap G-01: só diária (sem comissão) e assistente de debutante no estúdio (gaps onda 2)
- [ ] 11-21-PLAN.md — gap G-01: papel Assistente nos diálogos, Profissionais e Perfis de acesso (gaps onda 2)
- [ ] 11-22-PLAN.md — gap G-01: Novo agendamento/comissão sem Assistente e card de debutante (gaps onda 3)
- [ ] 11-23-PLAN.md — gap G-01: E2E do papel Assistente (gaps onda 4)
- [ ] 11-24-PLAN.md — gaps: gate, backup, deploy no staging e CI; depois retoma o 11-16 (gaps onda 5)

### Phase 12: Ajustar cadastro de agendamento

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 12 to break down)

---

## Backlog

Ideias estacionadas, sem ordem. Entram no roadmap só quando a usuária promover (`/gsd:review-backlog`).

### 999.1: Comunicação com clientes (WhatsApp)
- COMM-01: Lembrete automático via WhatsApp 24h antes do agendamento
- COMM-02: Campanhas segmentadas (aniversário, clientes inativas, sazonais)
- Envio do link de aceite do contrato e lembretes para a noiva por WhatsApp/e-mail (prometido na fase 4, D-15/D-21)
- Pré-requisito externo: verificação do negócio na Meta (WABA), 1–4 semanas; consentimento LGPD da cliente para mensagens
- Retirado da fase 5 pela usuária em 2026-11-05: "o foco precisa ser em entregar um sistema usável para o dia a dia"

### 999.2: Pix com QR via gateway
- Pix QR real (Pagar.me/Stripe Connect) com webhooks, adiado da fase 3 (D-10)

### 999.3: Produção e monitoramento
- QA-04: Sentry (erros) e Grafana (latência, filas, DB)
- Ambiente de produção separado do staging, com backup automático

### 999.4: Fechamento da cobertura de testes
- QA-01: ≥80% de cobertura unitária no domínio, com bloqueio no CI
- QA-02: E2E dos fluxos críticos (signup, login, agendamento, comanda, comissão, contrato) — boa parte já existe
- QA-03: Suíte de isolamento de tenant (RLS) no CI — já existe por fase; consolidar

### 999.5: Sugestão de agenda com a Claude real
- Ligar `ANTHROPIC_API_KEY` no staging e repetir o passo 3 do 04-16 (adiado pela usuária em 2026-11-05)

### 999.6: Usabilidade — itens adiados da auditoria da fase 5
- UX-20: painel inicial com resumo do dia (agendamentos de hoje e amanhã, valores a receber, parcelas de contrato vencendo); a previsão de 30 dias já entra no painel na fase 5
- UX-16 (parte não aprovada): aviso de cliente duplicado (mesmo telefone) ao cadastrar
- Remarcar agendamento pelo menu do cartão (alternativa ao arrastar, útil no celular), a decidir depois da conferência manual no celular

### 999.7: Funções vistas no design Gestor Beauty (fora da fase 6)
- Bancadas/cadeiras/salas por agendamento e ocupação em tempo real
- Meta de faturamento e % da meta no painel; comparação com a semana anterior
- Exportar DRE diário
- Cerimonial/assessoria e "dossiê" da noiva; status de prova
- Ações rápidas no painel ("Iniciar", "Check-in", "Fechar" comanda pela lista)
- Multiunidade (seletor de unidade no topo)
- Entradas e saídas (06-06): "Exportar diário"; chips "Apenas entradas/saídas"; busca e filtro por forma de pagamento; painel "Estado do Sistema / Diretriz operacional"; "Previsão D+7 / Cartões a compensar / Auditoria fiscal"; selo "Fechamento provisório"; rodapé "Conciliação em dia / Atualizado às"; botão "Lançar" (lançamento manual)
- Painel (Início, 06-10): "Filtrar período", relógio e status "Sincronizado" no topo, barras de progresso de meta e ocupação das bancadas em tempo real (ticket médio, noivas, comandas em aberto e contratos próximos já aparecem no Início; conferido na auditoria local do 06-11; atendimentos do dia ficam no UX-20 do 999.6)
- Casco (06-02): versão "SGS Atelier" e cadeado no menu; relógio, "Sistema operacional/Online" e nome da unidade no topo
- Agenda (06-03): selo de verificado e especialidade no cabeçalho da profissional; rótulo "Agora" no indicador de hora; lista de espera e bloqueio técnico no painel; "Exibir bloqueios internos"; "Horário livre/Preparação de bancada/Higienização"; cadeira, sala e valor no bloco do atendimento
- Novo agendamento (06-04): selo do cliente (Noiva/VIP); "(Ativa)" e ícone no profissional; comprovante, "Recebido em" e selo "Pago" no sinal; aviso prévio de conflito de horário antes de salvar
- Comanda (06-05): botão WhatsApp, observações do atendimento, histórico rápido e pontualidade; NF-e e menu de ações; filtro Quitada/Pendente; atalho de teclado para adicionar item; transferir bancada; conciliação e autorização de pagamento; comprovantes e recibo por WhatsApp; protocolo de fechamento; situação contábil; terminal e operador
- Previsão de caixa (06-07): total e "% do desembolso" por grupo de custo; selo "Semana corrente"; busca por atalho de teclado
- Despesas fixas (06-08): categorias, centro de custo, fornecedor e anexos; recorrência diferente de mensal e "pago no mês"; exportar e meta
- Grupo de noivas (06-09): coluna profissional e valor por pessoa; assessoria responsável e local da produção; plano financeiro, envio e checklist do contrato; notas da diretora criativa e código do contrato no cabeçalho
- Decisão da usuária em 2026-11-06: fase 6 é só o visual com os dados que já existem

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 7/7 | Complete   | 2026-05-06 |
| 2. Core Domain | 6/8 | In Progress|  |
| 3. Core Operations | 0/? | Not started | - |
| 4. Bridal & Contracts | 16/16 | Complete    | 2026-11-05 |
| 5. Uso no dia a dia | 1/18 | Complete    | 2026-11-06 |

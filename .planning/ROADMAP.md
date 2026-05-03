# Roadmap: SGS — Plataforma de Gestão para Salões de Beleza

**Milestone:** v1.0 — MVP
**Total phases:** 5
**Requirements covered:** 33/33

## Overview

Construir um SaaS multi-tenant completo para salões de beleza, partindo da fundação de infraestrutura e identidade, avançando pelo catálogo e clientes, entregando o loop operacional central de agendamento+POS+financeiro como uma unidade atômica, adicionando a vertical de noivas como diferenciador, e finalizando com comunicação automatizada e qualidade de lançamento.

## Phases

- [ ] **Phase 1: Foundation** - Infraestrutura multi-tenant, autenticação e RLS — pré-requisito não negociável para tudo
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

**Plans:** TBD

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

**Plans:** TBD

**UI hint:** yes

---

### Phase 3: Core Operations

**Goal:** O loop operacional central está completo — atendente agenda, executa o atendimento com comanda, registra pagamento e o sistema calcula comissões e atualiza o financeiro automaticamente em uma única sequência sem fricção.

**Depends on:** Phase 2

**Requirements:**
- SCHED-01: Calendário com raias por profissional (dia/semana), protegido contra double-booking via advisory lock
- SCHED-02: Criar agendamentos e mover via drag-and-drop no calendário
- SCHED-03: Criar bloqueios de horário (intervalos, feriados, indisponibilidade)
- SCHED-04: Registrar sinal/depósito ao criar agendamento com rastreamento do valor pré-pago
- POS-01: Criar comanda acumulando serviços e produtos durante o atendimento
- POS-02: Registrar pagamento com múltiplos métodos (dinheiro, Pix QR, cartão, transferência, crédito, voucher)
- POS-03: Dividir total de comanda em múltiplos pagamentos parciais de métodos diferentes
- FIN-01: Dashboard financeiro com receita por dia/semana/mês e breakdown por método de pagamento
- FIN-02: Cálculo automático de comissões por profissional ao fechar comanda, com snapshot imutável dos inputs

**Success Criteria** (what must be TRUE):
1. Atendente consegue visualizar a agenda em calendário com raias por profissional e arrastar um agendamento para outro horário sem causar double-booking
2. Atendente consegue criar um agendamento, registrar sinal de R$50, abrir a comanda, adicionar serviços e produtos, e fechar o pagamento dividido entre Pix e dinheiro
3. Ao fechar a comanda, o sistema calcula automaticamente a comissão do profissional e registra o snapshot imutável dos valores — sem intervenção manual
4. Proprietário consegue abrir o dashboard financeiro e ver receita do dia/semana/mês com breakdown por método de pagamento
5. Tentativa de criar dois agendamentos simultâneos para o mesmo profissional no mesmo horário resulta em erro claro para o segundo tentante

**Plans:** TBD

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

**Plans:** TBD

**UI hint:** yes

---

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
| 1. Foundation | 1/? | In progress | - |
| 2. Core Domain | 0/? | Not started | - |
| 3. Core Operations | 0/? | Not started | - |
| 4. Bridal & Contracts | 0/? | Not started | - |
| 5. Communication & Launch | 0/? | Not started | - |

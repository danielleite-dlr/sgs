# Requirements: SGS — Plataforma de Gestão para Salões de Beleza

**Defined:** 2026-05-02
**Core Value:** Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.

---

## v1 Requirements

### Infraestrutura

- [ ] **INFRA-01**: Monorepo NestJS + React configurado com Docker Compose para dev environment completo (backend, frontend, postgres, redis, meilisearch)
- [ ] **INFRA-02**: PgBouncer em transaction-mode com 2 roles DB (`sgs_migrator` com BYPASSRLS, `sgs_app` sem) e FORCE ROW LEVEL SECURITY em todas as tabelas tenant-scoped
- [ ] **INFRA-03**: Redis com AOF persistence (`appendonly yes`) + BullMQ para filas de jobs assíncronos

### Autenticação

- [ ] **AUTH-01**: Usuário consegue criar conta e fazer login com email/senha usando JWT (access 15min + refresh 30 dias)
- [ ] **AUTH-02**: Sessão do usuário persiste entre refreshes de browser via refresh token rotation
- [ ] **AUTH-03**: Sistema aplica RBAC com 4 roles configuráveis: Administrador, Gerente, Atendente, Profissional

### Catálogo

- [ ] **CAT-01**: Proprietário consegue criar categorias hierárquicas e serviços com precificação dinâmica (variações por duração, profissional, seniority)
- [ ] **CAT-02**: Proprietário consegue criar pacotes combinando múltiplos serviços com preço próprio
- [ ] **CAT-03**: Proprietário consegue cadastrar produtos com controle de estoque e alertas de nível mínimo
- [ ] **CAT-04**: Proprietário consegue configurar regras de comissão por serviço, produto e profissional (fixo ou percentual)

### Clientes

- [ ] **CLI-01**: Atendente consegue criar e editar perfil de cliente com CPF, contatos, data de aniversário e observações
- [ ] **CLI-02**: Atendente consegue visualizar histórico completo de atendimentos, produtos consumidos e comandas do cliente
- [ ] **CLI-03**: Proprietário consegue criar grupo de noivas associando noiva principal + acompanhantes para o mesmo evento

### Agendamento

- [ ] **SCHED-01**: Profissional/Atendente consegue visualizar agenda em calendário com raias por profissional (visão dia e semana), protegido contra double-booking via advisory lock no PostgreSQL
- [ ] **SCHED-02**: Atendente consegue criar agendamentos e movê-los via drag-and-drop no calendário
- [ ] **SCHED-03**: Atendente consegue criar bloqueios de horário (intervalos, feriados, indisponibilidade de qualquer duração)
- [ ] **SCHED-04**: Atendente consegue registrar sinal/depósito ao criar agendamento, com rastreamento do valor pré-pago

### POS / Comanda

- [ ] **POS-01**: Atendente consegue criar comanda acumulando serviços e produtos consumidos durante o atendimento
- [ ] **POS-02**: Atendente consegue registrar pagamento com múltiplos métodos: dinheiro, Pix (QR code), cartão de crédito/débito, transferência, crédito na conta, voucher
- [ ] **POS-03**: Atendente consegue dividir o total de uma comanda em múltiplos pagamentos parciais de métodos diferentes

### Financeiro

- [ ] **FIN-01**: Proprietário consegue visualizar dashboard financeiro com receita por dia/semana/mês e breakdown por método de pagamento
- [ ] **FIN-02**: Sistema calcula e registra comissões automaticamente por profissional ao fechar comanda, com snapshot imutável dos inputs
- [ ] **FIN-03**: Sistema gera previsão financeira para os próximos 30 dias baseada em histórico e agendamentos confirmados

### Contratos / Noivas

- [ ] **CONT-01**: Proprietário consegue criar contrato de evento para grupo de noivas com valor total, parcelamento e datas de vencimento
- [ ] **CONT-02**: Sistema rastreia status de cada parcela e alerta sobre vencimentos próximos e atrasos
- [ ] **CONT-03**: Contrato suporta política de cancelamento configurável com regras de retenção de valor

### Comunicação

- [ ] **COMM-01**: Sistema envia lembrete via WhatsApp automaticamente 24h antes do horário do agendamento
- [ ] **COMM-02**: Proprietário consegue criar e enviar campanhas de comunicação segmentadas (aniversário, clientes inativos, sazonais)

### IA / Inteligência

- [ ] **AI-01**: Sistema sugere alocação ótima de profissionais para agenda completa de evento de noivas via Claude API, considerando disponibilidade e tempo de serviço

### Qualidade / Observabilidade

- [ ] **QA-01**: Cobertura de testes unitários ≥80% do código de domínio no backend (regras de negócio, entidades, value objects)
- [ ] **QA-02**: Testes E2E (Playwright) cobrindo fluxos críticos: signup org, login, criar agendamento, fechar comanda, calcular comissão, criar contrato
- [ ] **QA-03**: Suite de testes de isolamento de tenant em CI que verifica que RLS impede vazamento de dados entre organizações diferentes
- [ ] **QA-04**: Monitoramento em produção com Sentry (error tracking) e Grafana (métricas de latência, filas, DB)

---

## v2 Requirements

### Autenticação
- **AUTH-04**: TOTP (autenticação de 2 fatores opcional)
- **AUTH-05**: Suporte a múltiplas organizações por conta de usuário

### Clientes
- **CLI-04**: Formulários de anamnese configuráveis por categoria de serviço (saúde, preferências)
- **CLI-05**: Rastreamento de consentimento LGPD com audit trail completo *(atenção: pesquisa indica que deve ser v1 por compliance — reavaliar antes de lançamento)*

### POS
- **POS-04**: Caixa com abertura/fechamento formal e registro de discrepâncias

### Comunicação
- **COMM-03**: WhatsApp 2-way: cliente responde confirmação/cancelamento e sistema atualiza status do agendamento automaticamente
- **COMM-04**: Link de agendamento público para clientes (booking online sem login)

### Plataforma
- **PLAT-01**: PWA com suporte offline básico para visualização de agenda
- **PLAT-02**: CI/CD completo com GitHub Actions (staging deploy + aprovação manual para produção)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| App mobile nativo (iOS/Android) | Web-first; PWA cobre 80% do caso de uso; Fase 5 |
| Multi-unidade / franquia | Complexidade arquitetural adicional ao RLS; Fase 5+ |
| Integração fiscal NFe/NFSe | Stack fiscal completa por município; Fase 4 |
| Marketplace de profissionais | Modelo de negócio diferente; Fase 5 |
| Sincronização Google Calendar | Fase 5 |
| Folha de pagamento / eSocial | Território de software contábil |
| REST API pública | GraphQL-first; adicionar REST se demanda aparecer |
| Previsão de demanda IA | Requer 3+ meses de dados históricos para ser útil; Fase 4 |
| Alertas operacionais IA | Requer baseline de dados; Fase 4 |
| Assinatura digital em contratos | Integração com provider externo (ClickSign/DocuSign); v2 |

---

## Traceability

*Preenchido durante a criação do roadmap.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| CAT-01 | Phase 2 | Pending |
| CAT-02 | Phase 2 | Pending |
| CAT-03 | Phase 2 | Pending |
| CAT-04 | Phase 2 | Pending |
| CLI-01 | Phase 2 | Pending |
| CLI-02 | Phase 2 | Pending |
| CLI-03 | Phase 4 | Pending |
| SCHED-01 | Phase 3 | Pending |
| SCHED-02 | Phase 3 | Pending |
| SCHED-03 | Phase 3 | Pending |
| SCHED-04 | Phase 3 | Pending |
| POS-01 | Phase 3 | Pending |
| POS-02 | Phase 3 | Pending |
| POS-03 | Phase 3 | Pending |
| FIN-01 | Phase 3 | Pending |
| FIN-02 | Phase 3 | Pending |
| FIN-03 | Phase 5 | Pending |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |
| COMM-01 | Phase 5 | Pending |
| COMM-02 | Phase 5 | Pending |
| AI-01 | Phase 4 | Pending |
| QA-01 | Phase 5 | Pending |
| QA-02 | Phase 5 | Pending |
| QA-03 | Phase 5 | Pending |
| QA-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33/33 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-02 — Traceability filled after roadmap creation*

# Requirements: SGS — Plataforma de Gestão para Salões de Beleza

**Defined:** 2026-05-02
**Core Value:** Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.

---

## v1 Requirements

### Infraestrutura

- [x] **INFRA-01**: Monorepo NestJS + React configurado com Docker Compose para dev environment completo (backend, frontend, postgres, redis, meilisearch)
- [x] **INFRA-02**: PgBouncer em transaction-mode com 2 roles DB (`sgs_migrator` com BYPASSRLS, `sgs_app` sem) e FORCE ROW LEVEL SECURITY em todas as tabelas tenant-scoped
- [x] **INFRA-03**: Redis com AOF persistence (`appendonly yes`) + BullMQ para filas de jobs assíncronos

### Autenticação

- [x] **AUTH-01**: Usuário consegue criar conta e fazer login com email/senha usando JWT (access 15min + refresh 30 dias)
- [x] **AUTH-02**: Sessão do usuário persiste entre refreshes de browser via refresh token rotation
- [x] **AUTH-03**: Sistema aplica RBAC com 4 roles configuráveis: Administrador, Gerente, Atendente, Profissional

### Catálogo

- [x] **CAT-01**: Proprietário consegue criar categorias hierárquicas e serviços com precificação dinâmica (variações por duração, profissional, seniority)
- [x] **CAT-02**: Proprietário consegue criar pacotes combinando múltiplos serviços com preço próprio
- [x] **CAT-03**: Proprietário consegue cadastrar produtos com controle de estoque e alertas de nível mínimo
- [x] **CAT-04**: Proprietário consegue configurar regras de comissão por serviço, produto e profissional (fixo ou percentual)

### Clientes

- [x] **CLI-01**: Atendente consegue criar e editar perfil de cliente com CPF, contatos, data de aniversário e observações
- [x] **CLI-02**: Atendente consegue visualizar histórico completo de atendimentos, produtos consumidos e comandas do cliente
- [ ] **CLI-03**: Proprietário consegue criar grupo de noivas associando noiva principal + acompanhantes para o mesmo evento

### Agendamento

- [x] **SCHED-01**: Profissional/Atendente consegue visualizar agenda em calendário com raias por profissional (visão dia e semana), protegido contra double-booking via advisory lock no PostgreSQL
- [x] **SCHED-02**: Atendente consegue criar agendamentos e movê-los via drag-and-drop no calendário
- [x] **SCHED-03**: Atendente consegue criar bloqueios de horário (intervalos, feriados, indisponibilidade de qualquer duração)
- [x] **SCHED-04**: Atendente consegue registrar sinal/depósito ao criar agendamento, com rastreamento do valor pré-pago

### POS / Comanda

- [x] **POS-01**: Atendente consegue criar comanda acumulando serviços e produtos consumidos durante o atendimento
- [x] **POS-02**: Atendente consegue registrar pagamento com múltiplos métodos: dinheiro, Pix (QR code), cartão de crédito/débito, transferência, crédito na conta, voucher — **Fase 3 (redução de escopo aceita, D-09/D-10):** Pix por registro manual (sem QR/gateway, que vai para a Fase 5) e sem voucher; crédito na conta incluído.
- [x] **POS-03**: Atendente consegue dividir o total de uma comanda em múltiplos pagamentos parciais de métodos diferentes

### Financeiro

- [x] **FIN-01**: Proprietário consegue visualizar dashboard financeiro com receita por dia/semana/mês e breakdown por método de pagamento
- [x] **FIN-02**: Sistema calcula e registra comissões automaticamente por profissional ao fechar comanda, com snapshot imutável dos inputs
- [ ] **UX-DAY**: Rodada de usabilidade das telas principais (auditoria do Claude, lista aprovada pela usuária, correções aplicadas)
- [ ] **FIN-03**: Sistema gera previsão financeira para os próximos 30 dias: agenda confirmada + parcelas de contratos a receber (vencidas entram como "em atraso") − comissões estimadas − despesas fixas cadastradas (sem média histórica)

### Contratos / Noivas

- [ ] **CONT-01**: Proprietário consegue criar contrato de evento para grupo de noivas com valor total, parcelamento e datas de vencimento _(Fase 4: parcelamento reinterpretado como entrada + restante livre até D-10 — 04 D-10/D-11; retenção = cliente cancela retém tudo o que foi pago, estúdio cancela devolve tudo — 04 D-22, sem faixas por antecedência)_
- [ ] **CONT-02**: Sistema rastreia status de cada parcela e alerta sobre vencimentos próximos e atrasos
- [ ] **CONT-03**: Contrato suporta política de cancelamento configurável com regras de retenção de valor _(Fase 4: parcelamento reinterpretado como entrada + restante livre até D-10 — 04 D-10/D-11; retenção = cliente cancela retém tudo o que foi pago, estúdio cancela devolve tudo — 04 D-22, sem faixas por antecedência)_
- [x] **BRI-01**: Proprietário gera o cronograma do dia da noiva a partir do pacote (Experience/Glam/Elegance) e do horário de saída, com etapas, profissionais de make e penteado indicadas pelo studio, chegada dos fotógrafos e texto pronto para WhatsApp _(regras: phases/04.2-.../04.2-REFERENCE-cronograma-studio-js.md)_
- [x] **BRI-02**: O agendamento de madrinhas e acompanhantes do grupo respeita o cronograma da noiva: termina antes do making of/fotos (de que elas participam) e não colide com as profissionais alocadas na noiva

### Comunicação

- [ ] **COMM-01**: Sistema envia lembrete via WhatsApp automaticamente 24h antes do horário do agendamento
- [ ] **COMM-02**: Proprietário consegue criar e enviar campanhas de comunicação segmentadas (aniversário, clientes inativos, sazonais)

### IA / Inteligência

- [ ] **AI-01**: Sistema sugere alocação ótima de profissionais para agenda completa de evento de noivas via Claude API, considerando disponibilidade e tempo de serviço

### Comercial (Fase 9)

- [x] **COM-01**: Atendente cadastra lead (manual) separado das clientes, com aviso "já é cliente: Fulana" por telefone/e-mail e vínculo à cliente existente _(09 D-01, D-02)_
- [x] **COM-02**: Gerente/atendente importa leads de planilha Excel/CSV com prévia de linhas válidas, inválidas e duplicadas, mantendo o responsável do Atimos (coluna Responsável casada com membro ADMIN/MANAGER/ATTENDANT por e-mail ou nome; sem casamento vai para a fila sem responsável com aviso) _(09 D-04, D-20, D-22)_
- [x] **COM-03**: Salão recebe leads pelo formulário público do site (token por organização, consentimento LGPD, anti-spam, limite de requisições, embutível em iframe) _(09 D-04, D-20)_
- [x] **COM-04**: Lead tem vários negócios independentes, só Noiva ou Debutante, com data do evento, pacote do catálogo, desconto, valor final, responsável, origem, local e observações _(09 D-03, D-05, D-06, D-18)_
- [x] **COM-05**: Etapas do funil configuráveis por salão (nome, cor, ordem, prazo em dias), padrão Novo/Contato/Proposta/Negociação/Ganho/Perdido, com Ganho/Perdido de sistema e alerta de SLA por etapa _(09 D-07, D-15)_
- [x] **COM-06**: Pipeline em kanban: arrastar no computador, rolagem lateral e menu "Mover para…" no celular _(09, critério do Claude)_
- [x] **COM-07**: Histórico único de interações por lead (6 tipos) com "próximo contato em" que cria o lembrete _(09 D-17)_
- [x] **COM-08**: Negócio ganho cria ou reaproveita a cliente, cria grupo + contrato rascunho com o pacote pelo fluxo de contratos existente, lança o sinal opcional no contrato e no caixa e abre o contrato _(09 D-08, D-09, D-18, D-21)_
- [x] **COM-09**: Negócio perdido exige motivo de lista fixa + texto livre; só ADMIN/MANAGER reabrem _(09 D-10, D-19)_
- [x] **COM-10**: Comercial só para ADMIN/MANAGER/ATTENDANT; ATTENDANT vê só os negócios dela e os leads deles; sem responsável só ADMIN/MANAGER; configurar etapas, excluir, trocar responsável e relatórios só ADMIN/MANAGER; tudo imposto na API _(09 D-11 a D-14, D-20)_
- [x] **COM-11**: Lembretes com lista (vencidos, hoje, próximos), destaque no Painel e push Android/iPhone na hora marcada para o responsável e gerentes/admins _(09 D-16)_
- [x] **COM-12**: Painel comercial (números do dia, follow-ups pendentes, últimas interações, funil, conversão, valor em negociação) e Relatórios só ADMIN/MANAGER com filtros, motivos de perda, origem e exportação Excel/PDF _(09 D-13)_

### Assistente de noiva (Fase 09.1)

- [ ] **AN-01**: Profissional pode ter a função "Assistente da Noiva" (marcada em Profissionais, sem uso do sistema e sem notificação) _(09.1 D-01, D-02)_
- [x] **AN-02**: Pacote tem a marcação "Inclui assistente da noiva (no estúdio)"; a migração marca Decidida, Essencial, Elegance, Essence, Experience e Glam da Studio JS _(09.1 D-03, D-04)_
- [x] **AN-03**: Diária da assistente é configuração do salão (padrão R$ 220, editável por ADMIN/MANAGER) e cada vínculo guarda o valor vigente ao vincular _(09.1 D-06, D-07, D-08)_
- [ ] **AN-04**: Pacote marcado mostra a diária no custo/lucro (só ADMIN/MANAGER); a diária não muda preço, contrato nem cobrança da noiva _(09.1 D-09, D-10)_
- [ ] **AN-05**: ADMIN/MANAGER/ATTENDANT vinculam ou trocam a assistente no grupo da noiva, escolhendo entre assistentes livres no dia (ocupadas aparecem indisponíveis) _(09.1 D-13, D-15, D-16)_
- [ ] **AN-06**: Agenda da assistente fica bloqueada o dia todo no dia do evento ("Acompanhando noiva X") e recusa outro atendimento ou bloqueio nesse dia _(09.1 D-14)_
- [ ] **AN-07**: Diária vira repasse "a pagar" ao fechar a comanda do evento da noiva, junto das comissões; noiva cancelada não paga; reabrir reverte _(09.1 D-11, D-12)_
- [ ] **AN-08**: Noiva que vira externa ou pacote sem assistente remove a assistente com aviso e libera a agenda; mudar a data move o bloqueio _(09.1 D-05)_
- [ ] **AN-09**: Noivas elegíveis sem assistente (inclusive as já cadastradas) ficam pendentes: aviso no grupo e filtro/selo "Sem assistente" na lista _(09.1 D-17, D-18)_

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
| INFRA-01 | Phase 1 | Complete — Plan 01-01 (2026-05-03) |
| INFRA-02 | Phase 1 | Complete — Plan 01-02 (2026-05-03) |
| INFRA-03 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| CAT-01 | Phase 2 | Complete |
| CAT-02 | Phase 2 | Complete |
| CAT-03 | Phase 2 | Complete |
| CAT-04 | Phase 2 | Complete |
| CLI-01 | Phase 2 | Complete |
| CLI-02 | Phase 2 | Complete |
| CLI-03 | Phase 4 | Pending |
| SCHED-01 | Phase 3 | Complete |
| SCHED-02 | Phase 3 | Complete |
| SCHED-03 | Phase 3 | Complete |
| SCHED-04 | Phase 3 | Complete |
| POS-01 | Phase 3 | Complete |
| POS-02 | Phase 3 | Complete |
| POS-03 | Phase 3 | Complete |
| FIN-01 | Phase 3 | Complete |
| FIN-02 | Phase 3 | Complete |
| FIN-03 | Phase 5 | In Progress |
| UX-DAY | Phase 5 | In Progress |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |
| COMM-01 | Backlog | Deferred |
| COMM-02 | Backlog | Deferred |
| AI-01 | Phase 4 | Pending |
| BRI-01 | Phase 04.2 | Complete |
| BRI-02 | Phase 04.2 | Complete |
| COM-01 | Phase 9 | Complete |
| COM-02 | Phase 9 | Complete |
| COM-03 | Phase 9 | Complete |
| COM-04 | Phase 9 | Complete |
| COM-05 | Phase 9 | Complete |
| COM-06 | Phase 9 | Complete |
| COM-07 | Phase 9 | Complete |
| COM-08 | Phase 9 | Complete |
| COM-09 | Phase 9 | Complete |
| COM-10 | Phase 9 | Complete |
| COM-11 | Phase 9 | Complete |
| COM-12 | Phase 9 | Complete |
| AN-01 | Phase 09.1 | Pending |
| AN-02 | Phase 09.1 | Complete |
| AN-03 | Phase 09.1 | Complete |
| AN-04 | Phase 09.1 | Pending |
| AN-05 | Phase 09.1 | Pending |
| AN-06 | Phase 09.1 | Pending |
| AN-07 | Phase 09.1 | Pending |
| AN-08 | Phase 09.1 | Pending |
| AN-09 | Phase 09.1 | Pending |
| QA-01 | Backlog | Deferred |
| QA-02 | Backlog | Deferred |
| QA-03 | Backlog | Deferred |
| QA-04 | Backlog | Deferred |

**Coverage:**
- v1 requirements: 56 total
- Mapped to phases: 56/56 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-11-24 — AN-01..AN-09 (fase 09.1, Assistente de noiva) acrescentados no plan-phase*

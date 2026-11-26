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

- [x] **AN-01**: Profissional pode ter a função "Assistente da Noiva" (marcada em Profissionais, sem uso do sistema e sem notificação) _(09.1 D-01, D-02)_
- [x] **AN-02**: Pacote tem a marcação "Inclui assistente da noiva (no estúdio)"; a migração marca Decidida, Essencial, Elegance, Essence, Experience e Glam da Studio JS _(09.1 D-03, D-04)_
- [x] **AN-03**: Diária da assistente é configuração do salão (padrão R$ 220, editável por ADMIN/MANAGER) e cada vínculo guarda o valor vigente ao vincular _(09.1 D-06, D-07, D-08)_
- [x] **AN-04**: Pacote marcado mostra a diária no custo/lucro (só ADMIN/MANAGER); a diária não muda preço, contrato nem cobrança da noiva _(09.1 D-09, D-10)_
- [x] **AN-05**: ADMIN/MANAGER/ATTENDANT vinculam ou trocam a assistente no grupo da noiva, escolhendo entre assistentes livres no dia (ocupadas aparecem indisponíveis) _(09.1 D-13, D-15, D-16)_
- [x] **AN-06**: Agenda da assistente fica bloqueada o dia todo no dia do evento ("Acompanhando noiva X") e recusa outro atendimento ou bloqueio nesse dia _(09.1 D-14)_
- [x] **AN-07**: Diária vira repasse "a pagar" ao fechar a comanda do evento da noiva, junto das comissões; noiva cancelada não paga; reabrir reverte _(09.1 D-11, D-12)_
- [x] **AN-08**: Noiva que vira externa ou pacote sem assistente remove a assistente com aviso e libera a agenda; mudar a data move o bloqueio _(09.1 D-05)_
- [x] **AN-09**: Noivas elegíveis sem assistente (inclusive as já cadastradas) ficam pendentes: aviso no grupo e filtro/selo "Sem assistente" na lista _(09.1 D-17, D-18)_

### Permissões por usuário (Fase 10)

- [x] **PERM-01**: Existe um catálogo de itens de acesso (um por submenu ativo do menu, mais o grupo como agrupador na tela); itens placeholder (flag desligada) ficam fora do catálogo e da tela; "Início", notificações e a troca de senha/perfil ficam sempre ligados e fora do ajuste _(10 D-06, D-07, critério do Claude)_
- [x] **PERM-02**: O padrão de cada item para cada papel é derivado das permissões que o papel já tem no banco; quem ganha um item passa a poder nele o mesmo que o Gerente, e quem tem o item ligado por padrão mantém o que o papel já permitia _(10 D-04, D-05)_
- [x] **PERM-03**: Admin/Gerente liga ou desliga cada item para uma pessoa (tirar e dar); só a diferença em relação ao padrão é guardada, por membro e por salão, com isolamento por salão (RLS forçada) _(10 D-04, D-12)_
- [x] **PERM-04**: Item desligado para a pessoa: a API recusa com um erro de acesso próprio (sem derrubar a sessão) na próxima ação, e o item ligado a mais passa a funcionar na API; o acesso é lido do banco a cada requisição, não do token _(10 D-02, D-13)_
- [x] **PERM-05**: Toda operação da API que hoje exige permissão passa a declarar também o(s) item(ns) de acesso que a servem; um teste automático falha se alguma ficar de fora _(10 D-02, critério do Claude)_
- [x] **PERM-06**: Quem ganha um item do Comercial passa a ver como o Gerente: Atendente com Relatórios vê os relatórios de todos (sem ganhar poder de excluir/trocar responsável nos Leads e Pipeline) e Profissional com Comercial vê todos os leads e negócios _(10 D-05, D-06)_
- [x] **PERM-07**: Quem ganha Financeiro (controle, previsão ou despesas fixas) vê também os custos e a diária da assistente que antes eram só do Gerente; recortes "só os meus" de itens que o papel já tinha (comandas e comissões da Profissional, agenda) continuam valendo _(10 D-05)_
- [x] **PERM-08**: Admin sempre vê tudo e não é ajustável; Admin ajusta qualquer pessoa; Gerente ajusta só Atendente e Profissional (nunca a si, outro Gerente ou Admin) e só concede itens que ele mesmo tem; Atendente e Profissional não ajustam acessos _(10 D-08)_
- [x] **PERM-09**: "Perfis de acesso" não pode ser ligado para Atendente nem Profissional _(10 D-09)_
- [x] **PERM-10**: Cada mudança de acesso (e cada "voltar ao padrão") grava no registro de auditoria quem mudou, em quem, quais itens e de qual valor para qual _(10, critério do Claude)_
- [x] **PERM-11**: Quando a pessoa muda de papel, os ajustes dela voltam ao padrão do novo papel, com aviso na tela de edição, e a mudança é auditada _(10, critério do Claude)_
- [x] **PERM-12**: Lembretes do Comercial, avisos de agenda (push), alertas de contrato (notificação e e-mail), estoque baixo e o contador do sino respeitam o item desligado: quem perdeu o item não recebe nem vê o aviso _(10 critério do Claude)_
- [x] **PERM-13**: O menu (barra lateral, gaveta do celular, barra inferior e busca global) mostra só os itens ligados para a pessoa; grupo sem itens some; cartões do painel inicial não aparecem nem consultam o que está desligado _(10 D-02, D-06)_
- [x] **PERM-14**: A rota (inclusive telas de detalhe) de um item desligado bloqueia e leva a pessoa para uma tela inicial válida, sem laço e sem logout _(10 D-02)_
- [x] **PERM-15**: O app consulta os acessos da pessoa e atualiza o menu em até 1 minuto, ao trocar de tela, ao voltar do segundo plano (iPhone instalado e Android) e quando a API recusa, sem sair e entrar _(10 D-13)_
- [x] **PERM-16**: A tela Profissionais › Perfis de acesso lista as pessoas ativas e, para cada uma, as áreas e itens com liga/desliga acessível, controle de grupo, indicação do que é padrão do papel e do que foi ajustado e "voltar ao padrão"; o atalho "Acessos" no editar profissional abre o mesmo ajuste _(10 D-06, D-10, D-11)_

### Prioridade de profissionais (Fase 11)

- [x] **PRIO-01**: A profissional tem as marcações "Fixa (equipe do studio)" (`isFixed`) e "Atende noiva/debutante" (`servesBridal`), falsas por padrão e sem migração de dados que marque alguém; só profissionais podem tê-las; a API cria, edita e devolve as duas; a marcação muda só a ordem/sugestão (comissão, repasse e diária não mudam) _(11 D-01, D-03, D-05)_
- [ ] **PRIO-02**: Os diálogos criar/editar profissional mostram e editam as duas marcações (só para profissional) e a tela Profissionais mostra os selos "Fixa" e "Atende noiva/debutante" _(11 D-05)_
- [x] **PRIO-03**: Um módulo de domínio puro e determinístico ordena candidatas: só livres → (noiva/debutante: só quem atende noiva) → fixas antes de não fixas com prioridade estrita → menos minutos agendados no dia → revezamento (quem recebeu há mais tempo; nunca = primeiro) → id _(11 D-07, D-10, D-11, D-12, D-18)_
- [x] **PRIO-04**: Existe uma ordenação "fixas primeiro, depois por nome" reutilizável no backend e no frontend para as listas de escolha _(11 D-09)_
- [ ] **PRIO-05**: Os dados do ranking vêm do banco: minutos agendados no dia local do salão (só status que ocupam agenda) e o último agendamento criado por profissional (revezamento derivado, sem gravar nada ao só ver uma sugestão) _(11 D-10, D-11)_
- [ ] **PRIO-06**: A heurística da sugestão de agenda do grupo escolhe pela ordem do ranking (inclui a divisão entre fixas dentro da mesma sugestão), com prioridade estrita da fixa e aviso "atendida X min antes do make-off" quando a prioridade antecipa o horário _(11 D-07, D-18)_
- [ ] **PRIO-07**: A sugestão por IA recebe fixa, minutos do dia e ordem de revezamento (sem dados pessoais), o cache de 24h muda quando as marcações mudam, a prioridade é conferida na resposta da Claude (violação → nova tentativa/heurística) sem bloquear a troca manual para não fixa na confirmação, e o cartão mostra o selo "não fixa" _(11 D-07, D-12)_
- [ ] **PRIO-08**: A simulação do cronograma já sugere make e penteado da noiva/debutante (fixa livre que atende noiva, pelo critério justo), o studio pode trocar e a confirmação continua explícita; sem elegível livre fica "[a definir]" com aviso (revoga 04.2 D-03) _(11 D-06)_
- [x] **PRIO-09**: O filtro "Atende noiva/debutante" vale em todo serviço da noiva/debutante (cronograma, sugestão de agenda, prova e editor manual) e o servidor recusa quem não atende; sem ninguém marcado, a lista fica vazia com aviso e link para Profissionais, sem fallback para "todas"; acompanhantes sem filtro _(11 D-02, D-04, D-19)_
- [ ] **PRIO-10**: Uma consulta devolve, para serviço + horário, as profissionais que fazem o serviço ordenadas (livres antes de ocupadas, depois o ranking), com a sugerida marcada, isolada por salão _(11 D-08, D-09)_
- [ ] **PRIO-11**: No agendamento comum, com serviço e horário preenchidos, o formulário pré-seleciona a fixa livre mais justa; profissional já escolhida nunca é trocada (só aparece "Sugestão: Fulana (fixa livre)") _(11 D-08)_
- [x] **PRIO-12**: O limite de cada acompanhante é o mais cedo entre o make-off (início do registro do cronograma confirmado) e "Acompanhantes prontas até"; as mensagens usam o nome "make-off"; o guarda do agendamento manual só atua com cronograma confirmado _(11 D-13, D-14, D-21)_
- [x] **PRIO-13**: O grupo tem o campo "Acompanhantes prontas até" (vazio = igual ao make-off), editável no formulário do grupo e na aba Cronograma, no mesmo dia do evento _(11 D-14)_
- [ ] **PRIO-14**: A sugestão de agenda usa limite por papel (noiva: pronta até/make-off; acompanhante: limite efetivo), encaixa a acompanhante o mais perto possível do limite e lista "não coube" com o motivo, sem remarcar clientes comuns _(11 D-15, D-16)_
- [x] **PRIO-15**: Tudo da fase vale igual para noiva e debutante (`eventKind`); o título do texto do cronograma mantém o formato da 04.2 _(11 D-17, D-21)_
- [x] **PRIO-16**: Todos os seletores de profissional mostram as fixas primeiro (depois as não fixas); a ordem das colunas da grade da Agenda não muda _(11 D-09, D-20)_

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
| AN-01 | Phase 09.1 | Complete |
| AN-02 | Phase 09.1 | Complete |
| AN-03 | Phase 09.1 | Complete |
| AN-04 | Phase 09.1 | Complete |
| AN-05 | Phase 09.1 | Complete |
| AN-06 | Phase 09.1 | Complete |
| AN-07 | Phase 09.1 | Complete |
| AN-08 | Phase 09.1 | Complete |
| AN-09 | Phase 09.1 | Complete |
| PERM-01 | Phase 10 | Complete |
| PERM-02 | Phase 10 | Complete |
| PERM-03 | Phase 10 | Complete |
| PERM-04 | Phase 10 | Complete |
| PERM-05 | Phase 10 | Complete |
| PERM-06 | Phase 10 | Complete |
| PERM-07 | Phase 10 | Complete |
| PERM-08 | Phase 10 | Complete |
| PERM-09 | Phase 10 | Complete |
| PERM-10 | Phase 10 | Complete |
| PERM-11 | Phase 10 | Complete |
| PERM-12 | Phase 10 | Complete |
| PERM-13 | Phase 10 | Complete |
| PERM-14 | Phase 10 | Complete |
| PERM-15 | Phase 10 | Complete |
| PERM-16 | Phase 10 | Complete |
| PRIO-01 | Phase 11 | Complete |
| PRIO-02 | Phase 11 | Pending |
| PRIO-03 | Phase 11 | Complete |
| PRIO-04 | Phase 11 | Complete |
| PRIO-05 | Phase 11 | Pending |
| PRIO-06 | Phase 11 | Pending |
| PRIO-07 | Phase 11 | Pending |
| PRIO-08 | Phase 11 | Pending |
| PRIO-09 | Phase 11 | Complete |
| PRIO-10 | Phase 11 | Pending |
| PRIO-11 | Phase 11 | Pending |
| PRIO-12 | Phase 11 | Complete |
| PRIO-13 | Phase 11 | Complete |
| PRIO-14 | Phase 11 | Pending |
| PRIO-15 | Phase 11 | Complete |
| PRIO-16 | Phase 11 | Complete |
| QA-01 | Backlog | Deferred |
| QA-02 | Backlog | Deferred |
| QA-03 | Backlog | Deferred |
| QA-04 | Backlog | Deferred |

**Coverage:**
- v1 requirements: 88 total
- Mapped to phases: 88/88 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-11-26 — PRIO-01..PRIO-16 (fase 11, Prioridade de profissionais e cronograma da noiva) acrescentados no plan-phase*

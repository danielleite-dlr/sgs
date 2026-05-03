# Documento de Desenho de Software (SDD)

**Plataforma de Gestão Inteligente para Salões de Beleza**

Salões, barbearias, clínicas de estética, manicures, studios de noivas, lash designers

---

**Versão:** 1.1
**Data:** Maio de 2026
**Autor:** Daniel Leite Rodrigues

---

## Controle de Versões

| Versão | Data       | Autor                  | Descrição                       |
|--------|------------|------------------------|---------------------------------|
| 1.0    | 02/05/2026 | Daniel Leite Rodrigues | Versão inicial do documento                                  |
| 1.1    | 02/05/2026 | Daniel Leite Rodrigues | Adicionada Seção 3 — Padrões de Qualidade e Testes           |

---

## Sumário

1. [Introdução](#1-introdução)
2. [Visão Geral da Arquitetura](#2-visão-geral-da-arquitetura)
3. [Padrões de Qualidade e Testes](#3-padrões-de-qualidade-e-testes)
4. [Requisitos do Sistema](#4-requisitos-do-sistema)
5. [Stack Tecnológica](#5-stack-tecnológica)
6. [Modelo de Domínio](#6-modelo-de-domínio)
7. [Multi-tenancy e Isolamento](#7-multi-tenancy-e-isolamento)
8. [Segurança e Privacidade](#8-segurança-e-privacidade)
9. [Integrações Externas](#9-integrações-externas)
10. [Implantação e Operação](#10-implantação-e-operação)
11. [Roteiro de Evolução](#11-roteiro-de-evolução)
12. [Riscos e Mitigações](#12-riscos-e-mitigações)
13. [Decisões Pendentes](#13-decisões-pendentes)
14. [Anexos](#anexos)

---

## 1. Introdução

### 1.1 Propósito do Documento

Este documento descreve o desenho técnico e funcional da plataforma SaaS de gestão para salões de beleza e segmentos correlatos. Serve como referência para o time de desenvolvimento, aliados estratégicos e investidores avaliarem decisões arquiteturais, escopo do MVP e roteiro de evolução.

### 1.2 Escopo do Produto

A plataforma atende quatro segmentos do mercado de beleza e estética: salões tradicionais, barbearias, clínicas de estética e studios especializados em noivas. Cada organização que assina o serviço opera de forma isolada, com seus próprios cadastros, agenda, financeiro e relatórios.

O MVP cobre cadastros base, agenda, atendimento, financeiro e comissões. Funcionalidades de comunicação automática com cliente final, contratos de eventos com previsibilidade, planejador de cronograma para noivas e sugestões com inteligência artificial entram na sequência como diferenciais competitivos.

### 1.3 Público-alvo

O sistema é operado por quatro perfis dentro de cada organização:

- **Administrador:** dono ou sócio do salão. Tem acesso total, configura perfis, define comissões, vê o financeiro completo.
- **Gerente:** coordenador operacional. Acompanha agenda, atendimentos e produtividade da equipe.
- **Atendente:** recepção. Marca agendamentos, recebe clientes, abre e fecha comandas.
- **Profissional:** executor de serviços. Vê própria agenda e comissão, registra serviços executados.

O cliente final não acessa o sistema. Recebe comunicações enviadas pela organização (lembretes, confirmações, links de pagamento) por canais externos como WhatsApp.

### 1.4 Diferencial Competitivo

O mercado brasileiro tem soluções consolidadas como Belasis, Trinks e Booksy. Cada uma resolve bem o básico (agenda + cadastro). A plataforma proposta nasce com foco em três frentes que os concorrentes tratam de forma rasa ou inexistente:

- **Inteligência aplicada à gestão:** previsibilidade financeira, sugestões automáticas de cronograma, alertas operacionais — não apenas relatórios passivos.
- **Atendimento ao mercado de eventos:** modelagem nativa de noivas com acompanhantes, contratos com vencimento, cronograma calculado por duração de serviço.
- **Automação ponta a ponta:** comunicação com cliente, lembretes, cobrança recorrente e fluxos de retorno integrados ao núcleo do sistema.

### 1.5 Glossário

| Termo                  | Definição                                                                                                                                  |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Tenant / Organização   | Cada salão (ou rede de salões com a mesma conta) que usa o sistema. Dados isolados por tenant.                                             |
| Membro                 | Pessoa que opera o sistema dentro de uma organização. Pode ser administrador, gerente, atendente ou profissional.                          |
| Comanda                | Documento de consumo do cliente no dia. Acumula serviços e produtos, recebe pagamentos parciais, fecha ao final do atendimento.            |
| Pacote                 | Combo de serviços vendido como unidade única, com preço próprio e duração calculada.                                                       |
| Anamnese               | Ficha de avaliação do cliente, contém histórico, alergias, condições clínicas. Dado sensível pela LGPD.                                    |
| Grupo de Noivas        | Agrupamento que conecta uma noiva às suas acompanhantes para o mesmo evento.                                                               |
| Contrato de Evento     | Acordo de prestação de serviço para data futura, parcelado, com data limite de quitação.                                                   |
| RLS                    | Row-Level Security. Mecanismo do PostgreSQL que isola linhas por tenant no nível do banco.                                                 |

---

## 2. Visão Geral da Arquitetura

### 2.1 Estilo Arquitetural

A aplicação adota o estilo de monolito modular com bordas para microserviços. O backend é uma única aplicação executável, organizada internamente em domínios bem delimitados (bounded contexts). Quando o crescimento exigir, contextos específicos como Fiscal, Pagamentos ou IA podem ser extraídos para serviços independentes sem reescrita.

Essa escolha equilibra velocidade de desenvolvimento no início (deploy único, debug simples) com possibilidade de evolução sem dívida técnica.

### 2.2 Camadas Principais

A plataforma é organizada em sete camadas, lidas de cima para baixo conforme o fluxo de uma requisição:

- **Quem usa:** os quatro perfis internos da organização.
- **Por onde acessam:** sistema web, app móvel do profissional, API para integrações. Canais de saída como WhatsApp e link público de agendamento.
- **Portão de Entrada:** ponto único que identifica organização, valida login e aplica permissões.
- **Capacidades de negócio:** agrupadas em quatro blocos: Organização e Acesso, Catálogo, Clientes e Agenda, Financeiro.
- **Comunicação e Inteligência:** lembretes automáticos, campanhas e sugestões com IA.
- **Persistência:** banco principal, arquivos, memória rápida, banco de relatórios e auditoria.
- **Serviços externos:** WhatsApp Cloud API, gateway de pagamento, emissor fiscal, provedor de IA, email e SMS.

### 2.3 Princípios de Design

- **Isolamento por organização em todas as camadas:** do banco até a interface, nenhum dado de uma organização vaza para outra. Garantido por Row-Level Security no PostgreSQL e middleware de tenant na aplicação.
- **Configurabilidade pelo administrador:** perfis de acesso, regras de comissão, política de cancelamento e modelos de contrato são configuráveis sem necessidade de mudança no código.
- **Eventos como espinha dorsal:** ações relevantes (agendamento criado, venda concluída, pagamento recebido) emitem eventos que outros módulos consomem. Acoplamento baixo, evolução independente.
- **Interface enxuta no MVP:** evita o erro comum de tentar reproduzir todas as telas dos concorrentes. Foco em fluxos de alto valor primeiro, expansão guiada por uso real.
- **Toda funcionalidade nasce testada:** nenhum código entra em produção sem testes unitários, testes ponta a ponta e validação de performance. Pull request sem cobertura mínima é bloqueado pelo CI. Detalhes na Seção 3 — Padrões de Qualidade e Testes.

---

## 3. Padrões de Qualidade e Testes

### 3.1 Princípio

Toda funcionalidade nasce com testes. Não existe funcionalidade pronta sem cobertura de testes unitários, testes ponta a ponta e validação de performance. Esta regra vale do MVP em diante e é aplicada via CI: pull request que não atende aos critérios mínimos é bloqueado automaticamente, sem exceção.

A justificativa é direta. Software de gestão financeira em SaaS multi-tenant não tolera regressão silenciosa. Um cálculo de comissão errado, um vazamento de dado entre organizações ou uma agenda que trava em horário de pico são incidentes que custam clientes. Testes não são tarefa secundária — são parte do entregável.

### 3.2 Pirâmide de testes adotada

A plataforma segue a pirâmide clássica, ajustada para o contexto:

- **Base ampla — testes unitários:** rápidos, isolados, cobrem regras de negócio e funções puras. Rodam em segundos no laptop e em cada push.
- **Camada média — testes de integração e ponta a ponta:** validam fluxos completos atravessando múltiplas camadas (API, banco, filas). Mais lentos, executam em CI.
- **Topo estreito — testes de performance:** garantem que operações críticas atendem aos SLAs definidos. Executam em pipelines dedicados, fora do caminho do desenvolvedor.

### 3.3 Testes Unitários

Cobrem a menor unidade testável do código (função, método, classe).

- **Cobertura mínima exigida:** 80% das linhas em código de domínio (regras de negócio, cálculos, validações). Código de infraestrutura tem alvo menor (60%).
- **Velocidade alvo:** suite completa em até 60 segundos no laptop do desenvolvedor.
- **Isolamento total:** sem banco real, sem rede, sem filas. Dependências externas mockadas.
- **Ferramentas:** Jest no Node.js, com `jest-mock-extended` para tipagem de mocks.
- **Obrigatórios para:** todo serviço de domínio, todo cálculo (comissão, previsibilidade, totais), toda validação de regra (cancelamento, agendamento, contrato).

### 3.4 Testes Ponta a Ponta (E2E)

Validam o sistema como um todo, executando cenários reais de uso.

- **Escopo:** desde a chamada da API até a persistência no banco, passando por autenticação, autorização, RLS e eventos de domínio.
- **Cobertura mínima exigida:** todo fluxo crítico de negócio tem ao menos um teste E2E. Lista mínima inicial: cadastro de organização, login, criar agendamento, abrir e fechar comanda, calcular comissão, criar contrato e registrar pagamento de parcela.
- **Banco real:** ambiente de teste sobe PostgreSQL via Docker, aplica migrations e seeds determinísticos.
- **Isolamento entre testes:** cada teste roda em transação que faz rollback no final, ou em organização criada e descartada.
- **Ferramentas:** Playwright para cenários que envolvem o frontend; Supertest + Jest para cenários só de API.
- **Velocidade alvo:** suite E2E completa em até 10 minutos em CI.

### 3.5 Testes de Performance

Garantem que operações críticas atendem aos SLAs definidos na Seção 4.2 — Requisitos Não-funcionais.

- **Operações cobertas:** carregar agenda do dia, listar clientes paginado, abrir comanda, fechar comanda com cálculo de comissão, calcular previsibilidade financeira, painel financeiro do mês.
- **SLAs alvo:** definidos no PRD de Banco de Dados (P95 e P99 por operação). Falha do teste se a média ultrapassa o SLA em ambiente representativo.
- **Volume realista:** dataset de teste com 100 organizações, 1000 clientes por organização, 50 mil agendamentos. Renovado automaticamente a cada release.
- **Ferramenta:** k6 para carga sintética. Métricas exportadas para Grafana e arquivadas por release.
- **Frequência:** suite completa roda no merge em main e antes de cada release. Testes pontuais rodam quando o PR toca código de fluxo crítico.

### 3.6 Testes de Isolamento de Tenant

Categoria especial, obrigatória dado o caráter multi-tenant da plataforma.

- **Escopo:** para cada tabela com Row-Level Security, validar que SELECT, INSERT, UPDATE e DELETE de uma organização nunca afetam dados de outra.
- **Estratégia:** criar duas organizações fictícias, popular ambas com dados, executar operações com a sessão de uma e validar que a outra permanece intacta.
- **Critério de falha:** qualquer linha vazada quebra o build imediatamente. Não há tolerância nesse tipo de teste.
- **Frequência:** roda em todo PR.

### 3.7 Critérios de Bloqueio no CI

Pull request é bloqueado automaticamente quando:

- Cobertura unitária do código novo está abaixo do mínimo.
- Algum teste unitário, E2E ou de isolamento falha.
- Tempo de execução de operação crítica regride mais de 20% em relação ao baseline.
- Linter, type-check ou validador de schema acusa erro.
- Migration de banco não tem rollback documentado quando aplicável.

### 3.8 Documentação dos Testes

Todo teste tem nome descritivo no formato "deve [comportamento esperado] quando [condição]". Exemplos:

- `deve calcular comissão percentual correta quando profissional fecha comanda`
- `deve impedir agendamento quando profissional já tem outro no mesmo horário`
- `deve registrar contrato como vencido quando data limite passou e há saldo aberto`

Cenários de borda e bugs corrigidos viram regression tests permanentes.

### 3.9 Testes Manuais

Não substituem os automatizados. São complementares, restritos a:

- Validação visual de telas novas (UX, responsividade, contraste).
- Cenários impossíveis de automatizar (fluxos com dependência externa de terceiros como gateway real).
- Smoke test em produção após cada release, com checklist documentado.

### 3.10 Responsabilidade

O desenvolvedor que entrega a funcionalidade é responsável por entregar os testes. Não existe handoff para QA escrever testes depois — isso garante que regressão seja detectada no momento em que o código é introduzido, não meses depois.

QA atua como guardião dos critérios e como pareador em cenários complexos. A automação dos testes é parte do trabalho de desenvolvimento.

---

## 4. Requisitos do Sistema

### 4.1 Requisitos Funcionais

#### 4.1.1 Gestão da Organização

- Cadastro inicial da organização com dados fiscais, endereço e contatos.
- Configurações gerais: idioma, fuso horário, política de cancelamento, regras financeiras.
- Suporte a múltiplas unidades (filiais) sob a mesma conta administrativa, com dados segregados quando necessário.

#### 4.1.2 Membros e Perfis

- Cadastro de membros com nome, contato, vínculo, modalidade de comissão (percentual ou valor fixo).
- Atribuição de perfil (Administrador, Gerente, Atendente, Profissional) por membro.
- Edição de permissões de cada perfil pelo Administrador, sem alteração de código.
- Visualização de comissão pelo próprio profissional, filtrada por períodos predefinidos (hoje, ontem, 7 dias, mês atual, intervalo customizado).
- Visualização da agenda própria pelo profissional, com atendimentos atribuídos.

#### 4.1.3 Catálogo

- Cadastro hierárquico: Categoria > Serviço. Exemplo: Penteados > Trança, Babyliss, Coque.
- Por serviço: valor, duração, tipo de comissão (percentual ou valor fixo).
- Pacotes que combinam vários serviços, com preço próprio e exibição de custo e lucro durante o cadastro.
- Cadastro de produtos com estoque, custo e preço de venda.
- Promoções sazonais e cashback configuráveis.

#### 4.1.4 Clientes

- Cadastro com nome, apelido, celular, aniversário, observações.
- Painel individual do cliente: débitos em aberto, créditos disponíveis, pacotes em andamento, últimos atendimentos.
- Marcação de cliente como noiva, com criação automática de Grupo de Noiva.
- Vinculação de acompanhantes a uma noiva existente.
- Anamneses com fichas customizáveis por organização.
- Listagem de aniversariantes do mês e clientes inativos para campanhas de retorno.

#### 4.1.5 Agenda e Atendimento

- Agenda do salão com visualização por dia, semana, profissional e status.
- Slots configuráveis (15, 20, 30 minutos).
- Agendamentos com cobrança opcional de entrada para confirmação.
- Bloqueios de horário por profissional (folga, almoço, indisponibilidade).
- Comanda automaticamente vinculada ao agendamento ao iniciar o atendimento.
- Comanda avulsa para clientes que chegam sem agendamento prévio.
- Planejador de cronograma para noivas, calculado a partir das durações de cada serviço da noiva e das acompanhantes.

#### 4.1.6 Financeiro

- Caixa com abertura, fechamento, sangria e suprimento.
- Recebimentos por dinheiro, Pix, cartão (à vista e parcelado), vouchers.
- Contas a pagar (fornecedores, despesas fixas e variáveis).
- Cálculo automático de comissões por profissional, serviço e período.
- Painel financeiro consolidado com filtros por período.

#### 4.1.7 Contratos de Eventos

- Criação de contrato vinculado a noiva, evento e data.
- Definição de data limite de quitação (X dias antes do evento, configurável).
- Registro de pagamentos parciais com data e valor.
- Listagem de contratos pendentes com nome, evento, vencimento, valor pago e valor pendente.
- Detalhamento de pagamentos ao clicar no campo Valor Pago.

#### 4.1.8 Previsibilidade Financeira

- Projeção de saída futura: total de comissões a pagar com base em agendamentos confirmados de período selecionado.
- Projeção de entrada futura: total a receber dos serviços agendados, descontando o que já foi pago.
- Alerta visual de contratos próximos do vencimento.

#### 4.1.9 Comunicação

- Envio automático de lembretes via WhatsApp 24h antes do agendamento.
- Envio de confirmação no dia do atendimento.
- Disparos de campanhas (aniversário, retorno, promoção sazonal).
- Templates de mensagem editáveis pela organização.

#### 4.1.10 Inteligência Artificial

- Sugestão de cronograma ótimo para grupos de noivas, considerando duração de serviços e quantidade de profissionais disponíveis.
- Previsão de demanda baseada em histórico (sazonalidade).
- Alertas de gestão: quedas de faturamento, profissionais ociosos, clientes em risco de churn.

### 4.2 Requisitos Não-funcionais

#### 4.2.1 Desempenho

- Tempo de carregamento da agenda do dia: até 1 segundo no percentil 95.
- Tempo de resposta da API GraphQL: até 300 ms no percentil 95 para queries comuns.
- Suporte a até 1000 organizações ativas até o ano 3, com média de 5 a 15 membros por organização.

#### 4.2.2 Disponibilidade

- SLA-alvo: 99,5% (aproximadamente 3,6 horas de indisponibilidade aceitável por mês).
- Janela de manutenção planejada: domingo de madrugada, comunicada com 7 dias de antecedência.

#### 4.2.3 Segurança e Privacidade

- Conformidade com a LGPD desde o lançamento.
- Anamneses tratadas como dado sensível: criptografia em repouso, acesso restrito por permissão.
- Autenticação com senha forte e segundo fator opcional para administradores.
- Tokens de API com escopo e expiração configuráveis.
- Audit log imutável de alterações em entidades financeiras e de configuração.

#### 4.2.4 Backup e Recuperação

- Backup contínuo do banco principal com Point-In-Time Recovery (PITR).
- RPO (perda máxima aceitável de dados): 5 minutos.
- RTO (tempo máximo de recuperação): 1 hora.
- Backup de arquivos (anamneses, fotos, contratos) replicado em região geográfica distinta.

#### 4.2.5 Escalabilidade

- Arquitetura preparada para crescimento horizontal (adicionar mais instâncias da aplicação) sem reescrita.
- Workers de processamento assíncrono escaláveis independentemente da API.
- Banco de relatórios separado do transacional, alimentado por replicação.

#### 4.2.6 Usabilidade

- Interface responsiva, otimizada para uso em tablet (cenário comum no salão).
- Onboarding guiado para novas organizações com tempo médio até primeiro agendamento de até 15 minutos.
- Acessibilidade básica: contraste WCAG AA, navegação por teclado em telas críticas.

---

## 5. Stack Tecnológica

### 5.1 Frontend

| Componente      | Tecnologia              | Justificativa                                           |
|-----------------|-------------------------|---------------------------------------------------------|
| Aplicação Web   | React 18 + TypeScript   | Maturidade, ecossistema, time já familiarizado          |
| Roteamento      | React Router            | Padrão de mercado para SPA                              |
| Estado servidor | Apollo Client           | Cache normalizado, integração nativa com GraphQL        |
| Formulários     | React Hook Form + Zod   | Performance e validação tipada                          |
| UI Kit          | shadcn/ui + Tailwind CSS| Componentização flexível, design customizável           |
| Mobile          | React Native + Expo     | Reuso de conhecimento, distribuição via Expo            |
| PWA             | Workbox                 | Modo offline básico para tablet do salão                |

### 5.2 Backend

| Componente    | Tecnologia                   | Justificativa                                             |
|---------------|------------------------------|-----------------------------------------------------------|
| Runtime       | Node.js 20 LTS               | Ecossistema, performance suficiente, mesmo runtime do front|
| Framework     | NestJS                       | Modularidade nativa, DI, decorators, suporte a GraphQL    |
| API           | GraphQL via Apollo Server    | Eficiência mobile, persisted queries, tipagem forte       |
| ORM           | Prisma                       | Type-safe, migrations versionadas, suporte a RLS          |
| Autenticação  | JWT + refresh tokens         | Stateless, escalável, padrão de mercado                   |
| Autorização   | CASL                         | Permissões granulares, configuráveis por tenant           |
| Filas         | BullMQ sobre Redis           | Confiável, suporta retry e prioridade                     |
| Mensageria    | Redis Streams                | Simples para começar, RabbitMQ se complexidade crescer    |

### 5.3 Persistência

| Camada              | Tecnologia                       | Uso                                                  |
|---------------------|----------------------------------|------------------------------------------------------|
| Banco principal     | PostgreSQL 16                    | Cadastros, agendamentos, vendas, comissões           |
| Cache e sessões     | Redis 7                          | Cache de queries, filas, pub/sub, rate limit         |
| Arquivos            | S3 / Cloudflare R2               | Anamneses, fotos, contratos PDF                      |
| Banco de relatórios | ClickHouse                       | Agregações pesadas, alimentado por CDC               |
| Busca textual       | Meilisearch                      | Busca rápida em clientes e agendamentos              |
| Auditoria           | PostgreSQL (tabela append-only)  | Registro imutável de mudanças críticas               |

### 5.4 Integrações Externas

| Serviço                | Provedor                       | Função                                         |
|------------------------|--------------------------------|------------------------------------------------|
| WhatsApp               | Meta Cloud API                 | Lembretes, confirmações, campanhas             |
| Pagamentos             | Pagar.me ou Stripe Connect     | Pix, cartão, link de cobrança, split           |
| Fiscal                 | Focus NFe ou eNotas            | Emissão de NFS-e e NFC-e                       |
| Inteligência Artificial| Anthropic Claude API           | Sugestões, cronogramas, alertas                |
| Email                  | Resend                         | Notificações transacionais, recuperação de senha|
| SMS                    | Twilio ou Zenvia               | Backup quando WhatsApp falhar                  |
| Observabilidade        | Sentry + Grafana Cloud         | Erros, métricas, logs                          |

### 5.5 Infraestrutura e DevOps

- **Hospedagem inicial:** VPS Hostinger (já em uso pelo autor) com Docker Compose. Migração para Kubernetes (EKS ou GKE) prevista quando atingir 200 organizações ativas.
- **CI/CD:** GitHub Actions com pipelines de teste, build, deploy em ambientes de staging e produção.
- **Infraestrutura como código:** Terraform para provisionamento de recursos cloud. Ansible para configuração de servidores.
- **Monitoramento:** Sentry para erros, Grafana Cloud para métricas e logs, uptime checks externos.

---

## 6. Modelo de Domínio

### 6.1 Bounded Contexts

O backend é organizado em contextos delimitados, cada um responsável por um conjunto de regras de negócio. Contextos comunicam-se preferencialmente via eventos de domínio.

| Contexto                  | Responsabilidades                                                              | Entidades principais                                |
|---------------------------|--------------------------------------------------------------------------------|-----------------------------------------------------|
| Identidade e Organização  | Cadastro de organizações, membros, perfis, permissões, plano de assinatura     | Organization, Member, Role, Permission, Subscription|
| Catálogo                  | Categorias, serviços, produtos, pacotes, promoções, estoque                    | Category, Service, Product, Package, Promotion      |
| Clientes                  | Cadastro de clientes, anamneses, agrupamentos de noivas, histórico             | Client, Anamnesis, BridalGroup, ClientNote          |
| Agenda                    | Agendamentos, bloqueios, disponibilidade, planejador de cronograma             | Appointment, TimeBlock, BridalSchedule              |
| Atendimento               | Comandas, registro de execução, vinculação de profissionais                    | Order, OrderItem, ServiceExecution                  |
| Financeiro                | Caixa, recebimentos, contas a pagar, conciliação                               | Cashier, Payment, Receivable, Payable               |
| Comissões                 | Cálculo, fechamento, pagamento, regras configuráveis                           | Commission, CommissionRule, CommissionPayment       |
| Contratos                 | Contratos de eventos, parcelamento, vencimento, alertas                        | Contract, ContractInstallment                       |
| Comunicação               | Lembretes, campanhas, templates, envios                                        | Message, Campaign, Template                         |
| Inteligência              | Sugestões com IA, previsões, alertas operacionais                              | Suggestion, Prediction, Alert                       |
| Relatórios                | Painéis, KPIs, exportações, metas                                              | Report, Dashboard, Goal                             |

### 6.2 Entidades Centrais

#### 6.2.1 Organization (Organização / Tenant)

Representa um salão ou rede sob uma mesma conta. É o ponto de isolamento de todos os dados do sistema. Toda entidade de negócio carrega referência a uma organização e é filtrada por ela em todas as consultas.

#### 6.2.2 Member (Membro)

Pessoa que opera o sistema dentro de uma organização. Possui perfil, vínculo de comissão (percentual ou fixo) e permissões herdadas do perfil. Um mesmo email pode pertencer a múltiplas organizações com perfis diferentes em cada.

#### 6.2.3 Client (Cliente)

Pessoa atendida pela organização. Carrega cadastro pessoal, histórico de atendimentos, créditos, débitos. Pode ser marcada como noiva (cria-se um Grupo de Noivas) ou vinculada como acompanhante a um grupo existente.

#### 6.2.4 BridalGroup (Grupo de Noivas)

Agrupa uma noiva às suas acompanhantes para um evento específico. Possui data do evento, contrato vinculado e cronograma sugerido. Permite visualização consolidada das clientes envolvidas no mesmo dia.

#### 6.2.5 Appointment (Agendamento)

Marca um cliente em um horário específico com um ou mais serviços e um profissional. Pode ter entrada paga para confirmação. Gera Comanda quando o atendimento inicia.

#### 6.2.6 Order (Comanda)

Documento que acumula serviços e produtos consumidos pelo cliente em uma visita. Recebe pagamentos parciais. Fecha quando totalmente quitada. Origina o cálculo de comissões e a movimentação no caixa.

#### 6.2.7 Contract (Contrato de Evento)

Acordo formal de prestação de serviços para um evento futuro, tipicamente vinculado a uma noiva. Possui valor total, parcelas com vencimentos, política de cancelamento e data limite de quitação.

### 6.3 Eventos de Domínio Principais

- **AppointmentCreated:** agendamento foi marcado. Consumido por Comunicação (envia confirmação) e Previsibilidade (atualiza projeções).
- **AppointmentConfirmed:** cliente confirmou. Consumido por Agenda e Comunicação.
- **OrderClosed:** comanda foi quitada. Consumido por Financeiro (registra recebimentos), Comissões (calcula comissão dos profissionais envolvidos), Estoque (baixa de produtos).
- **ContractInstallmentDue:** parcela de contrato vencendo. Consumido por Comunicação (envia lembrete) e Painel Financeiro (alerta visual).
- **ClientBirthdayApproaching:** aniversário do cliente em 7 dias. Consumido por Campanhas.
- **BridalGroupCreated:** grupo de noivas criado. Consumido por Inteligência (sugere cronograma).

---

## 7. Multi-tenancy e Isolamento

### 7.1 Estratégia

A plataforma adota o modelo de multi-tenancy compartilhado com isolamento por linha (Row-Level Security). Todas as organizações compartilham a mesma instância de aplicação e o mesmo banco de dados, mas cada linha de dado é etiquetada com a organização proprietária e o banco bloqueia automaticamente o acesso a linhas de outras organizações.

Esta escolha equilibra custo operacional baixo (uma única infraestrutura para todos os tenants) com isolamento confiável garantido pelo próprio motor do banco.

### 7.2 Implementação

- **Coluna organization_id em todas as tabelas:** exceto tabelas estritamente de catálogo global. Constraint NOT NULL e índice composto.
- **Políticas de Row-Level Security no PostgreSQL:** cada tabela tem política que filtra automaticamente por organization_id da sessão atual.
- **Variável de sessão:** no início de cada requisição, a aplicação define `SET LOCAL app.current_organization` conforme o tenant identificado pelo JWT.
- **Middleware no NestJS:** intercepta toda requisição autenticada, extrai organization_id do JWT, valida e injeta na sessão antes de qualquer query.
- **Testes automatizados:** suite específica que tenta acessar dados cruzados entre tenants e falha o build se conseguir.

### 7.3 Identificação do Tenant

A organização é identificada de três formas, em ordem de preferência:

- **Subdomínio:** `studiojessica.plataforma.com.br`. Forma preferida para usuários finais, deixa a organização visível.
- **Header HTTP:** `X-Organization-Id` em chamadas de API por integrações de terceiros.
- **Claim no JWT:** fallback usado em todas as situações como verificação cruzada.

Em caso de divergência entre as três fontes, a requisição é rejeitada com erro 403.

### 7.4 Multi-unidade dentro da mesma Organização

Uma organização pode operar múltiplas unidades físicas (filiais). O modelo suporta dois modos:

- **Compartilhado:** clientes, catálogo e financeiro compartilhados entre filiais. Cada agendamento carrega referência à filial específica.
- **Isolado:** cada filial opera como se fosse uma sub-organização, com cadastros próprios. Útil para franquias.

A escolha é configurada no plano da organização.

---

## 8. Segurança e Privacidade

### 8.1 Autenticação

- Senha com mínimo de 10 caracteres, validação contra lista de senhas comprometidas.
- Hash com Argon2id, parâmetros conforme recomendação OWASP.
- Segundo fator (TOTP) opcional para todos os perfis, obrigatório para Administrador a partir do plano profissional.
- Sessões com refresh token rotativo, expiração de access token em 15 minutos.
- Bloqueio progressivo após tentativas falhas (rate limiting por IP e por conta).

### 8.2 Autorização

- RBAC com perfis editáveis pelo Administrador da organização.
- Cada permissão é uma capacidade nomeada (ex: `appointment.create`, `finance.view`, `member.delete`).
- Validação dupla: no resolver GraphQL e via política CASL aplicada à entidade.
- Decisões de autorização registradas em audit log para análise posterior.

### 8.3 Proteção de Dados

- **Em trânsito:** TLS 1.3 obrigatório em todas as conexões externas.
- **Em repouso:** criptografia transparente do disco. Anamneses e dados de saúde com criptografia em coluna usando chaves gerenciadas (KMS).
- **Backups:** criptografados com chaves separadas das chaves de produção.
- **Logs:** dados sensíveis (senhas, tokens, CPF parcial) automaticamente removidos antes da gravação.

### 8.4 Conformidade com LGPD

- Consentimento explícito do cliente final no momento do cadastro pelo salão.
- Direito de acesso: cliente pode solicitar via salão um relatório de seus dados.
- Direito de exclusão: anonimização de dados pessoais mantendo histórico financeiro para fins fiscais.
- Termo de uso e política de privacidade próprios da plataforma, complementares aos da organização.
- DPO designado pela empresa operadora da plataforma.
- Tratamento de incidentes documentado, com notificação à ANPD em até 72 horas em caso de vazamento.

### 8.5 Auditoria

- Log imutável de todas as operações que alteram entidades financeiras, contratos e configurações de permissão.
- Registro contém: quem (member_id), quando (timestamp UTC), o quê (entidade e id), antes/depois (snapshot).
- Retenção mínima: 5 anos.
- Acesso ao log restrito ao Administrador da organização e ao DPO da plataforma.

---

## 9. Integrações Externas

### 9.1 WhatsApp

Integração com WhatsApp Cloud API oficial da Meta. Justificativa: APIs não-oficiais (BotConversa, Z-API) oferecem custo mais baixo no início mas têm risco operacional significativo (banimento de número, instabilidade) que não combina com a confiabilidade exigida por um SaaS de gestão.

- Templates pré-aprovados pela Meta para mensagens iniciadas pela plataforma.
- Mensagens livres apenas dentro da janela de 24 horas após interação do cliente.
- Webhook recebe respostas e atualiza status de confirmação automaticamente.
- Custo de envio repassado ao plano da organização ou cobrado por excedente.

### 9.2 Pagamentos

Integração com gateway terceirizado (Pagar.me ou Stripe Connect, decisão final no início da implementação). Funcionalidades cobertas:

- Geração de link de cobrança para entrada de agendamento.
- Cobrança recorrente para parcelas de contrato.
- Pix com QR Code estático e dinâmico.
- Cartão à vista e parcelado.
- Split de pagamento entre plataforma e organização (modelo marketplace).
- Webhook de atualização de status (pago, falhou, estornado).

### 9.3 Emissão Fiscal

Integração com emissor terceirizado (Focus NFe ou eNotas). Cobertura:

- NFS-e para serviços, conforme município da organização.
- NFC-e para venda de produtos, quando aplicável.
- Emissão automática ao fechar comanda, configurável pela organização.
- Reemissão e cancelamento dentro do prazo legal.

Decisão de escopo: emissão fiscal não entra no MVP. Salões de pequeno porte frequentemente não emitem nota e a integração adiciona complexidade significativa. Entra na fase 2 do roteiro.

### 9.4 Inteligência Artificial

Consumo da API da Anthropic (Claude) para funcionalidades de IA. Justificativa: melhor custo-benefício para casos de uso da plataforma (texto estruturado, raciocínio sobre dados de gestão), e fundador já possui familiaridade com a API.

- Sugestão de cronograma para grupos de noivas.
- Resumos automáticos de painéis financeiros.
- Geração de templates de mensagem de WhatsApp a partir de contexto.
- Camada de cache para reduzir chamadas repetidas.
- Limite de uso por organização conforme plano contratado.

### 9.5 Email e SMS

- Email: Resend para notificações transacionais (recuperação de senha, confirmação de cadastro, faturas da plataforma). Domínio próprio com SPF, DKIM e DMARC configurados.
- SMS: Twilio ou Zenvia como backup quando WhatsApp falhar ou cliente não tiver WhatsApp cadastrado. Custo repassado ou incluído conforme plano.

---

## 10. Implantação e Operação

### 10.1 Ambientes

| Ambiente   | Propósito                       | Característica                                |
|------------|---------------------------------|-----------------------------------------------|
| Local      | Desenvolvimento                 | Docker Compose com todos os serviços          |
| Staging    | Validação antes de produção     | Réplica reduzida da produção, dados sintéticos|
| Produção   | Atendimento aos clientes        | Alta disponibilidade, monitoramento ativo     |

### 10.2 Pipeline de Entrega

- Push em branch de feature dispara: lint, type-check, testes unitários, testes de integração.
- Pull request aprovado dispara deploy automático em staging.
- Merge em main dispara deploy em produção com aprovação manual.
- Rollback automatizado em caso de falha em healthcheck pós-deploy.

### 10.3 Versionamento

- Versionamento semântico para releases visíveis ao cliente.
- Migrações de banco versionadas via Prisma Migrate, sempre compatíveis para frente.
- Feature flags via Unleash para liberar funcionalidades por organização ou plano.

### 10.4 Monitoramento

- **Métricas de aplicação:** latência por endpoint, taxa de erro, throughput, fila de jobs.
- **Métricas de negócio:** agendamentos por hora, comandas fechadas, MRR, churn.
- **Logs estruturados:** JSON com correlation ID, organization_id, member_id, ação.
- **Alertas:** Slack do time de plantão para incidentes de prioridade alta.
- **Status page pública:** para clientes acompanharem disponibilidade em tempo real.

### 10.5 Suporte e SLA

- Atendimento ao cliente em horário comercial (9h às 18h, dias úteis) no plano básico.
- Atendimento estendido (8h às 22h, todos os dias) no plano profissional.
- Tempo de resposta inicial: até 4 horas úteis no plano básico, 1 hora no profissional.
- Canal: chat na plataforma, WhatsApp e email.

---

## 11. Roteiro de Evolução

### 11.1 Visão

A construção é incremental. Cada fase entrega valor real ao cliente e gera aprendizado para a próxima. O escopo é deliberadamente enxuto no início para reduzir risco e acelerar feedback.

### 11.2 Fase 1 — MVP (semanas 1 a 12)

Objetivo: validar com 5 a 10 organizações piloto que o sistema substitui ferramentas atuais (planilha, agenda de papel, WhatsApp manual).

- Cadastro de organização e membros.
- Catálogo: categorias, serviços, produtos, pacotes.
- Cadastro de clientes com painel individual básico.
- Agenda do salão com agendamentos.
- Comanda e fechamento de atendimento.
- Caixa, recebimentos, comissões.
- Painel financeiro básico.

### 11.3 Fase 2 — Diferencial de Noivas (semanas 13 a 20)

Objetivo: capturar o segmento de studios de noivas, mercado mal atendido pelos concorrentes.

- Grupos de Noivas e acompanhantes.
- Contratos de eventos com parcelamento e vencimento.
- Planejador de cronograma com cálculo automático.
- Previsibilidade financeira (entrada e saída).

### 11.4 Fase 3 — Comunicação e Crescimento (semanas 21 a 28)

Objetivo: automatizar a operação e ativar funcionalidades de marketing.

- Lembretes automáticos via WhatsApp.
- Campanhas (aniversário, retorno, sazonal).
- Cashback e promoções.
- Link público de agendamento online.

### 11.5 Fase 4 — Inteligência e Escala (semanas 29 a 40)

Objetivo: ativar o diferencial de IA e preparar a infraestrutura para 500+ organizações.

- Sugestões com IA: cronograma, mensagens, alertas.
- Previsão de demanda baseada em histórico.
- Painéis de inteligência operacional.
- Integração fiscal (NFS-e e NFC-e).
- Migração para Kubernetes.
- Banco de relatórios separado com replicação CDC.

### 11.6 Fase 5 — Expansão (ano 2)

- App móvel para profissional.
- Multi-unidade avançado para franquias.
- Marketplace de profissionais autônomos.
- Integração com Google Calendar e iCal.
- API pública documentada para parceiros.

---

## 12. Riscos e Mitigações

| Risco                                              | Impacto                              | Probabilidade | Mitigação                                                                |
|----------------------------------------------------|--------------------------------------|---------------|--------------------------------------------------------------------------|
| Vazamento de dados entre tenants                   | Alto (perda de confiança, multa LGPD)| Baixa         | RLS no banco + middleware + testes específicos. Auditoria periódica.     |
| Banimento do número WhatsApp                       | Alto (canal principal de comunicação)| Média         | API oficial da Meta. Templates aprovados. Volume controlado por organização. |
| Migração de dados de concorrentes                  | Médio (atrito no onboarding)         | Alta          | Importadores prontos para Trinks, Belasis e planilhas. Onboarding assistido. |
| Concorrente lança funcionalidade similar           | Médio                                | Média         | Foco em nicho de noivas + IA aplicada. Velocidade de execução.           |
| Custo de infraestrutura cresce mais rápido que receita | Alto                             | Média         | Monitoramento de custo por organização. Otimização de queries. Cache agressivo. |
| Complexidade de comissões trava cadastro de profissional | Médio                          | Alta          | UX guiada. Templates pré-configurados. Validação progressiva.            |
| Falha do gateway de pagamento                      | Alto (dia de quitação de contrato)   | Baixa         | Fallback para segundo gateway. Alertas de fila travada.                  |
| IA gera resposta inadequada                        | Médio (perda de credibilidade)       | Média         | Camada de validação. Modelos com baixa temperatura. Revisão humana opcional. |

---

## 13. Decisões Pendentes

Pontos que requerem definição antes ou durante o início da implementação:

### 13.1 Comanda Avulsa vs Comanda de Agendamento

Ambas existem na proposta. Decisão pendente: a comanda avulsa nasce sem agendamento ou ela cria automaticamente um agendamento retroativo? Recomendação inicial: criar comanda livre, sem agendamento associado, simplificando o modelo.

### 13.2 Cronograma da Noiva: Sugestivo ou Vinculante

O planejador calcula uma sequência ótima de atendimento. A organização aceita como está ou edita manualmente? Recomendação: sugerir e permitir ajuste manual livre. O sistema aprende com os ajustes para melhorar sugestões futuras.

### 13.3 Contrato como Pacote Especial ou Entidade Própria

Contratos de noivas têm muito em comum com pacotes (combinação de serviços com preço). Mas têm regras adicionais (parcelamento, vencimento, cancelamento) que pesam contra unificar. Decisão atual: entidade separada. Reavaliar após Fase 2.

### 13.4 IA Própria ou Via API

Começar consumindo Claude/OpenAI é mais rápido e barato no início. Modelo proprietário só faz sentido com volume e dados próprios suficientes (estimativa: 200+ organizações ativas).

### 13.5 Plano de Cobrança

Modelo de pricing ainda não definido. Opções: por organização (preço fixo), por membro ativo, por volume de agendamentos, ou híbrido. Decisão impacta modelagem da entidade Subscription.

### 13.6 Multi-unidade no MVP

A funcionalidade aparece nos requisitos mas adiciona complexidade significativa. Recomendação: MVP suporta uma unidade por organização. Multi-unidade entra na Fase 2 ou 3 conforme demanda dos pilotos.

---

## Anexos

### Anexo A — Referência Visual

Este SDD é acompanhado pelo arquivo de arquitetura visual em formato draw.io:

- **arquitetura_capacidades_negocio_v2.drawio:** arquitetura organizada por capacidades de negócio, com nomenclatura em português, indicando claramente quem opera o sistema, por onde acessam, quais funcionalidades estão agrupadas em cada bloco e como os dados fluem.

O arquivo é editável em https://app.diagrams.net e deve ser versionado junto com este documento.

### Anexo B — Próximos Passos

Após aprovação deste SDD pelo time e investidores:

- Definir métricas de sucesso de cada fase do roteiro.
- Iniciar prototipação de baixa fidelidade dos fluxos críticos (agenda, comanda, contrato).
- Configurar repositório, pipeline de CI/CD e ambiente de staging.
- Recrutar 5 organizações piloto representativas dos quatro segmentos-alvo.
- Iniciar Fase 1 com sprint zero focado em fundação técnica.

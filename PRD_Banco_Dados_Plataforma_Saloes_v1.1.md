# PRD de Banco de Dados

**Plataforma de Gestão Inteligente para Salões de Beleza**

Modelagem, isolamento por tenant, índices, performance e migrações

---

**Versão:** 1.1
**Data:** Maio de 2026
**Autor:** Daniel Leite Rodrigues

---

## Controle de Versões

| Versão | Data       | Autor                  | Descrição                                                  |
|--------|------------|------------------------|-------------------------------------------------------------|
| 1.0    | 02/05/2026 | Daniel Leite Rodrigues | Versão inicial do documento                                 |
| 1.1    | 02/05/2026 | Daniel Leite Rodrigues | Adicionada referência aos padrões de teste definidos no SDD |

---

## Sumário

1. [Introdução](#1-introdução)
2. [Estratégia de Multi-tenant](#2-estratégia-de-multi-tenant)
3. [Convenções de Modelagem](#3-convenções-de-modelagem)
4. [Entidades Principais](#4-entidades-principais)
5. [Mapa de Relacionamentos](#5-mapa-de-relacionamentos)
6. [Estratégia de Índices](#6-estratégia-de-índices)
7. [Performance e Escala](#7-performance-e-escala)
8. [Row-Level Security em Detalhe](#8-row-level-security-em-detalhe)
9. [Migrações e Versionamento](#9-migrações-e-versionamento)
10. [Backup, Recuperação e Retenção](#10-backup-recuperação-e-retenção)
11. [Roteiro de Implementação](#11-roteiro-de-implementação)
12. [Decisões Pendentes](#12-decisões-pendentes)
13. [Anexos](#anexos)

---

## 1. Introdução

### 1.1 Propósito

Este PRD especifica o desenho da camada de banco de dados da plataforma de gestão para salões. Cobre escolha de tecnologia, modelagem entidade-relacionamento, regras de isolamento por tenant, estratégia de índices, políticas de retenção e plano de migrações. O documento serve como referência para o time que vai implementar o esquema, validar performance e auditar o isolamento de dados.

### 1.2 Relação com outros documentos

- **SDD da plataforma:** este PRD detalha a camada que o SDD descreve em alto nível na seção 'Persistência'.
- **Diagrama de arquitetura:** as entidades aqui modeladas correspondem aos blocos do diagrama de capacidades de negócio.
- **PRDs de funcionalidade:** PRDs específicos (agenda, comanda, contratos) consomem este modelo como base.

### 1.3 Tecnologia escolhida

- **PostgreSQL 16:** banco relacional principal. Justificativa: maturidade, suporte nativo a Row-Level Security, JSON nativo, full-text search, replicação lógica, ecossistema rico de ferramentas.
- **Redis 7:** cache, filas (BullMQ), sessões, pub/sub. Não armazena dados primários.
- **ClickHouse:** data warehouse para relatórios pesados (Fase 4). Alimentado por replicação CDC do PostgreSQL.
- **S3 ou Cloudflare R2:** armazenamento de arquivos (anamneses, fotos, contratos PDF). Banco guarda apenas a URL e metadados.
- **Meilisearch:** índice de busca textual rápida. Sincronizado com PostgreSQL via eventos.

### 1.4 Princípios de modelagem

- **Isolamento por tenant em todas as camadas:** coluna `organization_id` em toda tabela de negócio, com RLS habilitado por padrão.
- **Soft delete onde fizer sentido:** entidades com histórico (clientes, agendamentos, comandas) usam `deleted_at` em vez de DELETE físico.
- **Auditoria automática:** tabelas críticas têm timestamps (`created_at`, `updated_at`) e versão (`version`) para concorrência otimista.
- **Identificadores opacos:** chaves primárias UUIDv7 em vez de inteiros sequenciais. Evita vazamento de informação (quantidade de tenants, ordem de cadastro) e facilita merge entre ambientes.
- **Tipos brasileiros tratados como string:** CPF, CNPJ, CEP, telefone armazenados como texto com formato canônico (apenas dígitos). Validação na aplicação.
- **Dinheiro nunca em float:** valores monetários em `NUMERIC(12,2)` para evitar arredondamento.
- **Datas e horários:** `TIMESTAMPTZ` sempre que envolver momento real. `DATE` para datas do calendário (aniversário, data de evento).
- **Testes obrigatórios em toda alteração de schema:** migrations, políticas de RLS, índices e funções têm cobertura de testes seguindo os padrões definidos no SDD, Seção 3 — Padrões de Qualidade e Testes. Testes de isolamento de tenant são bloqueantes no CI.

---

## 2. Estratégia de Multi-tenant

### 2.1 Modelo escolhido

A plataforma usa o modelo Shared Database, Shared Schema com Row-Level Security do PostgreSQL. Justificativa: equilibra custo operacional baixo (uma única instância de banco para todos os clientes) com isolamento confiável aplicado pelo próprio motor.

Escala esperada: 250 organizações no ano 1, 1000 no ano 3. Esse volume é confortavelmente atendido por uma única instância PostgreSQL bem dimensionada (16 vCPU, 64 GB RAM, SSD NVMe). A migração para sharding ou banco-por-tenant só seria necessária acima de 5000 organizações ativas, cenário do ano 5.

### 2.2 Implementação técnica

#### 2.2.1 Coluna organization_id

Toda tabela de negócio carrega a coluna `organization_id UUID NOT NULL`. Exceções são tabelas globais (catálogo de países, lista de bancos, planos da plataforma) e tabelas de auditoria de plataforma.

#### 2.2.2 Variável de sessão

No início de cada requisição autenticada, a aplicação executa:

```sql
SET LOCAL app.current_organization = '<uuid-do-tenant>';
SET LOCAL app.current_member = '<uuid-do-membro>';
SET LOCAL app.is_super_admin = 'false';
```

#### 2.2.3 Política de RLS

Cada tabela tem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` e uma política que filtra automaticamente:

```sql
CREATE POLICY tenant_isolation ON appointments
  USING (organization_id = current_setting('app.current_organization')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization')::uuid);
```

#### 2.2.4 Bypass para administradores da plataforma

Operações de suporte (não da organização) usam um role separado com `BYPASSRLS`. Acesso restrito a um pequeno time, com auditoria explícita de toda query executada.

### 2.3 Garantias de segurança

- **Defesa em profundidade:** RLS no banco + middleware na aplicação + validação no resolver GraphQL. Mesmo se uma camada falhar, as outras seguram.
- **Testes de isolamento:** suite automatizada que tenta acessar dados de outra organização e o build falha se conseguir.
- **Audit trail de bypass:** toda query executada com o role `super_admin` é registrada e revisada semanalmente.

---

## 3. Convenções de Modelagem

### 3.1 Nomenclatura

| Elemento            | Convenção                       | Exemplo                              |
|---------------------|---------------------------------|--------------------------------------|
| Tabela              | snake_case, plural, em inglês   | `appointments`, `bridal_groups`      |
| Coluna              | snake_case, em inglês           | `created_at`, `total_amount`         |
| Chave primária      | `id` (sempre)                   | `id UUID PRIMARY KEY`                |
| Chave estrangeira   | `<entidade>_id`                 | `client_id`, `organization_id`       |
| Índice              | `ix_<tabela>_<colunas>`         | `ix_appointments_org_date`           |
| Constraint única    | `uq_<tabela>_<colunas>`         | `uq_members_org_email`               |
| Constraint check    | `ck_<tabela>_<descrição>`       | `ck_appointments_end_after_start`    |
| View                | `vw_<descrição>`                | `vw_daily_revenue`                   |
| Função              | `fn_<descrição>`                | `fn_calculate_commission`            |
| Trigger             | `tg_<tabela>_<momento>_<ação>`  | `tg_orders_before_update`            |

### 3.2 Colunas padrão

Toda tabela de negócio carrega o seguinte conjunto de colunas:

```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
organization_id UUID NOT NULL REFERENCES organizations(id),
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at      TIMESTAMPTZ NULL,
version         INTEGER NOT NULL DEFAULT 1
```

Trigger global atualiza `updated_at` em cada UPDATE e incrementa `version` (concorrência otimista).

### 3.3 Tipos de dado padronizados

| Domínio           | Tipo PostgreSQL    | Observação                                                |
|-------------------|--------------------|-----------------------------------------------------------|
| Identificador     | UUID               | UUIDv7 para ordenação temporal natural                    |
| Texto curto       | VARCHAR(255)       | Nomes, títulos, descrições breves                         |
| Texto livre       | TEXT               | Observações, notas, anamnese                              |
| Dinheiro          | NUMERIC(12,2)      | Nunca FLOAT. Cobre até R$ 9.999.999.999,99                |
| Percentual        | NUMERIC(5,2)       | 0,00 a 999,99. Comissões, descontos                       |
| Data e hora       | TIMESTAMPTZ        | Sempre com timezone, padronizado em UTC                   |
| Apenas data       | DATE               | Aniversário, data do evento                               |
| Apenas hora       | TIME               | Horário do agendamento (combinado com data)               |
| Booleano          | BOOLEAN            | NOT NULL com DEFAULT explícito                            |
| Status / enum     | VARCHAR + CHECK    | Não usar tipo ENUM nativo (difícil de migrar)             |
| JSON estruturado  | JSONB              | Configurações flexíveis, anamneses customizadas           |
| Email             | VARCHAR(255)       | Validado na aplicação, lowercase no banco                 |
| Telefone          | VARCHAR(20)        | Apenas dígitos, com código do país                        |
| CPF / CNPJ        | VARCHAR(14)        | Apenas dígitos, validação na aplicação                    |

### 3.4 Soft delete

Entidades com histórico relevante usam `deleted_at TIMESTAMPTZ NULL`. Quando preenchido, a linha é considerada removida mas continua disponível para auditoria, relatórios históricos e recuperação.

- Queries da aplicação filtram `WHERE deleted_at IS NULL` por padrão.
- Views materializadas para relatórios podem incluir registros excluídos.
- Job mensal arquiva registros com `deleted_at > 5 anos` para tabela de cold storage.
- Hard delete manual apenas em caso de solicitação LGPD do titular dos dados.

---

## 4. Entidades Principais

### 4.1 Bloco: Identidade e Organização

#### 4.1.1 organizations

Tabela raiz do isolamento. Todo dado de negócio referencia uma organização.

```sql
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  legal_name      VARCHAR(255) NOT NULL,
  trade_name      VARCHAR(255) NOT NULL,
  document_type   VARCHAR(10) NOT NULL CHECK (document_type IN ('CPF','CNPJ')),
  document_number VARCHAR(14) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(20),
  subdomain       VARCHAR(63) UNIQUE NOT NULL,
  timezone        VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  locale          VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  currency        VARCHAR(3) NOT NULL DEFAULT 'BRL',
  segment         VARCHAR(30) NOT NULL CHECK (segment IN
                    ('salon','barber','aesthetic','bridal','nails','lash')),
  plan_id         UUID NOT NULL REFERENCES plans(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','cancelled')),
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_organizations_document UNIQUE (document_number)
);
```

#### 4.1.2 members

Pessoa que opera o sistema dentro de uma organização. Um mesmo email pode ter membros em múltiplas organizações com perfis diferentes.

```sql
CREATE TABLE members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  role_id           UUID NOT NULL REFERENCES roles(id),
  display_name      VARCHAR(255) NOT NULL,
  document_number   VARCHAR(14),
  phone             VARCHAR(20),
  is_professional   BOOLEAN NOT NULL DEFAULT FALSE,
  commission_type   VARCHAR(20) CHECK (commission_type IN ('percentage','fixed','none')),
  commission_value  NUMERIC(10,2),
  hire_date         DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','vacation')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT uq_members_org_user UNIQUE (organization_id, user_id)
);
```

#### 4.1.3 users

Conta de acesso à plataforma. Independe de organização. Um user pode ser membro de várias organizações.

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  full_name         VARCHAR(255) NOT NULL,
  totp_secret       VARCHAR(255),
  totp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.1.4 roles e permissions

Perfis de acesso são editáveis pela organização. A tabela `roles` guarda perfis padrão (system) e perfis customizados por organização.

```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID REFERENCES organizations(id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roles_org_name UNIQUE (organization_id, name)
);

CREATE TABLE role_permissions (
  role_id      UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission   VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission)
);
```

Permissões são strings nomeadas (ex: `appointment.create`, `finance.view`). Lista mantida na aplicação, não no banco — facilita evolução sem migração.

### 4.2 Bloco: Catálogo

#### 4.2.1 categories e services

```sql
CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            VARCHAR(100) NOT NULL,
  parent_id       UUID REFERENCES categories(id),
  display_order   INTEGER NOT NULL DEFAULT 0,
  color           VARCHAR(7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  category_id       UUID NOT NULL REFERENCES categories(id),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  price             NUMERIC(12,2) NOT NULL,
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes > 0),
  commission_type   VARCHAR(20) NOT NULL DEFAULT 'inherit'
                      CHECK (commission_type IN ('percentage','fixed','inherit','none')),
  commission_value  NUMERIC(10,2),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
```

#### 4.2.2 packages

```sql
CREATE TABLE packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  price           NUMERIC(12,2) NOT NULL,
  validity_days   INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE package_services (
  package_id  UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id),
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (package_id, service_id)
);
```

#### 4.2.3 products

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            VARCHAR(255) NOT NULL,
  brand           VARCHAR(100),
  sku             VARCHAR(50),
  cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price      NUMERIC(12,2) NOT NULL,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  stock_min       INTEGER NOT NULL DEFAULT 0,
  unit            VARCHAR(20) NOT NULL DEFAULT 'unit',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT uq_products_org_sku UNIQUE (organization_id, sku)
);
```

### 4.3 Bloco: Clientes

#### 4.3.1 clients

```sql
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  full_name       VARCHAR(255) NOT NULL,
  nickname        VARCHAR(100),
  document_number VARCHAR(14),
  birth_date      DATE,
  phone           VARCHAR(20),
  email           VARCHAR(255),
  address         JSONB,
  notes           TEXT,
  source          VARCHAR(50),
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
```

#### 4.3.2 anamneses

Ficha clínica do cliente. Dado sensível pela LGPD: criptografia em coluna específica.

```sql
CREATE TABLE anamneses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id       UUID NOT NULL REFERENCES clients(id),
  template_id     UUID REFERENCES anamnesis_templates(id),
  responses       JSONB NOT NULL,
  encrypted_data  BYTEA,
  signed_at       TIMESTAMPTZ,
  signature_url   VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE anamnesis_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            VARCHAR(255) NOT NULL,
  questions       JSONB NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.3.3 bridal_groups

Agrupamento de noiva e acompanhantes para o mesmo evento. Entidade central para a funcionalidade de cronograma.

```sql
CREATE TABLE bridal_groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  bride_id        UUID NOT NULL REFERENCES clients(id),
  event_name      VARCHAR(255) NOT NULL,
  event_date      DATE NOT NULL,
  event_location  VARCHAR(255),
  contract_id     UUID REFERENCES contracts(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bridal_group_members (
  bridal_group_id UUID NOT NULL REFERENCES bridal_groups(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  role            VARCHAR(50) NOT NULL DEFAULT 'companion'
                    CHECK (role IN ('bride','companion','mother','sister','friend')),
  PRIMARY KEY (bridal_group_id, client_id)
);
```

### 4.4 Bloco: Agenda e Atendimento

#### 4.4.1 appointments

Tabela de alta cardinalidade (uma das maiores do sistema). Particionamento por mês considerado a partir de 1 milhão de linhas.

```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id       UUID NOT NULL REFERENCES clients(id),
  professional_id UUID NOT NULL REFERENCES members(id),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN
                      ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
  origin          VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (origin IN ('manual','online','recurring','imported')),
  bridal_group_id UUID REFERENCES bridal_groups(id),
  deposit_amount  NUMERIC(12,2),
  deposit_paid_at TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID REFERENCES members(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  CONSTRAINT ck_appointments_end_after_start CHECK (ends_at > starts_at)
);

CREATE TABLE appointment_services (
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id     UUID NOT NULL REFERENCES services(id),
  PRIMARY KEY (appointment_id, service_id)
);
```

#### 4.4.2 time_blocks

Bloqueios de horário do profissional (folga, almoço, indisponibilidade). Não geram comissão nem aparecem para agendamento.

```sql
CREATE TABLE time_blocks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  professional_id UUID NOT NULL REFERENCES members(id),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  reason          VARCHAR(100),
  is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_time_blocks_end_after_start CHECK (ends_at > starts_at)
);
```

#### 4.4.3 orders e order_items

Comanda do cliente. Acumula serviços e produtos consumidos. Recebe pagamentos parciais. Fecha quando totalmente quitada.

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id       UUID NOT NULL REFERENCES clients(id),
  appointment_id  UUID REFERENCES appointments(id),
  cashier_id      UUID REFERENCES cashiers(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','cancelled')),
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid            NUMERIC(12,2) NOT NULL DEFAULT 0,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type       VARCHAR(20) NOT NULL CHECK (item_type IN ('service','product','package')),
  service_id      UUID REFERENCES services(id),
  product_id      UUID REFERENCES products(id),
  package_id      UUID REFERENCES packages(id),
  professional_id UUID REFERENCES members(id),
  description     VARCHAR(255) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.5 Bloco: Financeiro

#### 4.5.1 cashiers e cashier_movements

```sql
CREATE TABLE cashiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  opened_by       UUID NOT NULL REFERENCES members(id),
  closed_by       UUID REFERENCES members(id),
  opened_at       TIMESTAMPTZ NOT NULL,
  closed_at       TIMESTAMPTZ,
  initial_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_amount NUMERIC(12,2),
  counted_amount  NUMERIC(12,2),
  difference      NUMERIC(12,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cashier_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  cashier_id      UUID NOT NULL REFERENCES cashiers(id),
  movement_type   VARCHAR(20) NOT NULL
                    CHECK (movement_type IN ('inflow','outflow','adjustment')),
  amount          NUMERIC(12,2) NOT NULL,
  description     VARCHAR(255),
  created_by      UUID NOT NULL REFERENCES members(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.5.2 payments

Pagamento recebido. Pode estar associado a uma comanda, contrato ou ser avulso.

```sql
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  order_id          UUID REFERENCES orders(id),
  contract_id       UUID REFERENCES contracts(id),
  client_id         UUID NOT NULL REFERENCES clients(id),
  payment_method    VARCHAR(30) NOT NULL
                      CHECK (payment_method IN
                        ('cash','pix','credit_card','debit_card','transfer','voucher','credit')),
  amount            NUMERIC(12,2) NOT NULL,
  installments      INTEGER NOT NULL DEFAULT 1,
  card_brand        VARCHAR(30),
  gateway_id        VARCHAR(255),
  gateway_status    VARCHAR(30),
  paid_at           TIMESTAMPTZ NOT NULL,
  notes             TEXT,
  created_by        UUID REFERENCES members(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.5.3 commissions

Comissão calculada por `order_item`. Tabela populada por trigger ou job conforme regra de negócio.

```sql
CREATE TABLE commissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  professional_id UUID NOT NULL REFERENCES members(id),
  order_item_id   UUID NOT NULL REFERENCES order_items(id),
  reference_date  DATE NOT NULL,
  base_amount     NUMERIC(12,2) NOT NULL,
  commission_type VARCHAR(20) NOT NULL,
  commission_rate NUMERIC(10,2) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at         TIMESTAMPTZ,
  payment_id      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.6 Bloco: Contratos

#### 4.6.1 contracts e contract_installments

```sql
CREATE TABLE contracts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  client_id           UUID NOT NULL REFERENCES clients(id),
  bridal_group_id     UUID REFERENCES bridal_groups(id),
  contract_number     VARCHAR(50) NOT NULL,
  event_date          DATE,
  total_amount        NUMERIC(12,2) NOT NULL,
  paid_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_deadline    DATE NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft','active','paid','overdue','cancelled')),
  cancellation_policy JSONB,
  signed_at           TIMESTAMPTZ,
  signature_url       VARCHAR(500),
  notes               TEXT,
  created_by          UUID REFERENCES members(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at        TIMESTAMPTZ,
  CONSTRAINT uq_contracts_org_number UNIQUE (organization_id, contract_number)
);

CREATE TABLE contract_installments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  installment_no  INTEGER NOT NULL,
  due_date        DATE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','overdue','cancelled')),
  CONSTRAINT uq_installments_contract_no UNIQUE (contract_id, installment_no)
);
```

#### 4.6.2 contract_services

```sql
CREATE TABLE contract_services (
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  service_id   UUID NOT NULL REFERENCES services(id),
  client_id    UUID NOT NULL REFERENCES clients(id),
  unit_price   NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (contract_id, service_id, client_id)
);
```

### 4.7 Bloco: Comunicação e Auditoria

#### 4.7.1 messages

```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id       UUID REFERENCES clients(id),
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  template_id     UUID REFERENCES message_templates(id),
  content         TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','delivered','read','failed')),
  external_id     VARCHAR(255),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 4.7.2 audit_log

Registro imutável. Não permite UPDATE nem DELETE. Particionamento por mês a partir do segundo ano.

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id UUID,
  member_id       UUID,
  user_id         UUID,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       UUID,
  before_data     JSONB,
  after_data      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
```

---

## 5. Mapa de Relacionamentos

### 5.1 Hierarquia principal

Resumo dos relacionamentos críticos:

- `organizations` 1—N `members`, `clients`, `services`, `products`, `appointments`, `orders`, `contracts`
- `clients` 1—N `appointments`, `orders`, `payments`, `anamneses`
- `clients` 1—N `bridal_groups` (como noiva)
- `bridal_groups` N—N `clients` (via `bridal_group_members`)
- `appointments` N—N `services` (via `appointment_services`)
- `appointments` 1—1 `orders` (opcional, comanda pode ser avulsa)
- `orders` 1—N `order_items`
- `orders` 1—N `payments`
- `contracts` 1—N `contract_installments`
- `contracts` N—N `services` (via `contract_services`)
- `order_items` 1—1 `commissions` (gerado por trigger)

### 5.2 Cardinalidades atípicas

- **Comanda avulsa:** `orders.appointment_id` é NULLABLE. Permite atendimento sem agendamento prévio.
- **Múltiplos profissionais por comanda:** cada `order_item` tem seu próprio `professional_id`, permitindo dividir comissão por item.
- **Pagamento sem comanda:** `payments.order_id` é NULLABLE quando o pagamento é referente a contrato.
- **Contrato sem evento:** `contracts.event_date` é NULLABLE para contratos não vinculados a evento (raro mas possível).

### 5.3 Cascade rules

| Relacionamento                       | ON DELETE | Justificativa                                     |
|--------------------------------------|-----------|---------------------------------------------------|
| package → package_services           | CASCADE   | Itens não fazem sentido sem o pacote              |
| order → order_items                  | CASCADE   | Idem                                              |
| bridal_group → bridal_group_members  | CASCADE   | Grupo dissolvido remove vínculos                  |
| contract → contract_installments     | CASCADE   | Parcelas pertencem ao contrato                    |
| client → orders                      | RESTRICT  | Não pode apagar cliente com comandas              |
| client → appointments                | RESTRICT  | Idem                                              |
| organization → *                     | RESTRICT  | Soft delete da organização, nunca hard            |

---

## 6. Estratégia de Índices

### 6.1 Princípio

Todo índice é justificado por uma query real do sistema. Índices a mais custam escrita e armazenamento; índices a menos custam latência. A regra é: criar o índice quando a query for parte de fluxo crítico (carregamento de tela, relatório frequente).

### 6.2 Índices essenciais por tabela

#### 6.2.1 organizations

```sql
CREATE UNIQUE INDEX ix_organizations_subdomain ON organizations(subdomain);
CREATE INDEX ix_organizations_status ON organizations(status) WHERE status = 'active';
```

#### 6.2.2 members

```sql
CREATE INDEX ix_members_org_status ON members(organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_members_user ON members(user_id);
CREATE INDEX ix_members_professional ON members(organization_id)
  WHERE is_professional = TRUE AND deleted_at IS NULL;
```

#### 6.2.3 clients

```sql
CREATE INDEX ix_clients_org_name ON clients(organization_id, full_name)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_clients_org_phone ON clients(organization_id, phone)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_clients_org_birthday ON clients(organization_id, EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date))
  WHERE deleted_at IS NULL AND birth_date IS NOT NULL;
CREATE INDEX ix_clients_tags_gin ON clients USING GIN(tags)
  WHERE deleted_at IS NULL;
```

#### 6.2.4 appointments

Tabela mais consultada do sistema. Índices cobrem os três cenários principais: agenda do dia, agenda do profissional, busca por cliente.

```sql
CREATE INDEX ix_appointments_org_starts ON appointments(organization_id, starts_at)
  WHERE status NOT IN ('cancelled','no_show');
CREATE INDEX ix_appointments_professional_starts ON appointments(professional_id, starts_at)
  WHERE status NOT IN ('cancelled','no_show');
CREATE INDEX ix_appointments_client ON appointments(client_id, starts_at DESC);
CREATE INDEX ix_appointments_bridal_group ON appointments(bridal_group_id)
  WHERE bridal_group_id IS NOT NULL;
CREATE INDEX ix_appointments_status_starts ON appointments(organization_id, status, starts_at);
```

#### 6.2.5 orders e order_items

```sql
CREATE INDEX ix_orders_org_status ON orders(organization_id, status, opened_at DESC);
CREATE INDEX ix_orders_client ON orders(client_id, opened_at DESC);
CREATE INDEX ix_orders_appointment ON orders(appointment_id) WHERE appointment_id IS NOT NULL;

CREATE INDEX ix_order_items_order ON order_items(order_id);
CREATE INDEX ix_order_items_professional_date
  ON order_items(professional_id, created_at);
```

#### 6.2.6 payments

```sql
CREATE INDEX ix_payments_org_paid_at ON payments(organization_id, paid_at DESC);
CREATE INDEX ix_payments_client ON payments(client_id, paid_at DESC);
CREATE INDEX ix_payments_order ON payments(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX ix_payments_contract ON payments(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX ix_payments_method_date ON payments(organization_id, payment_method, paid_at);
```

#### 6.2.7 contracts e contract_installments

```sql
CREATE INDEX ix_contracts_org_status ON contracts(organization_id, status);
CREATE INDEX ix_contracts_client ON contracts(client_id);
CREATE INDEX ix_contracts_bridal ON contracts(bridal_group_id) WHERE bridal_group_id IS NOT NULL;
CREATE INDEX ix_contracts_deadline ON contracts(payment_deadline)
  WHERE status IN ('active','overdue');

CREATE INDEX ix_installments_due_status
  ON contract_installments(due_date, status)
  WHERE status IN ('pending','overdue');
```

#### 6.2.8 commissions

```sql
CREATE INDEX ix_commissions_professional_date
  ON commissions(professional_id, reference_date);
CREATE INDEX ix_commissions_org_status_date
  ON commissions(organization_id, status, reference_date);
```

### 6.3 Índices futuros

- **appointments por mês:** particionamento por `RANGE(starts_at)` quando a tabela passar de 5 milhões de linhas.
- **audit_log por mês:** mesma estratégia. Esperado a partir do ano 2.
- **Full-text search em clients:** índice GIN com `to_tsvector` quando a busca textual via Meilisearch não for suficiente.
- **BRIN para tabelas grandes ordenadas por tempo:** alternativa econômica em `audit_log`, `messages` e `payments`.

---

## 7. Performance e Escala

### 7.1 Estimativas de volume

Cálculo baseado em premissas conservadoras: organização média com 8 profissionais, 30 atendimentos por dia, 6 dias por semana.

| Tabela        | Linhas/mês por org | Volume ano 3 (1000 orgs) |
|---------------|--------------------|---------------------------|
| appointments  | 780                | 9,3 milhões               |
| order_items   | 1.500              | 18 milhões                |
| payments      | 900                | 10,8 milhões              |
| commissions   | 1.200              | 14,4 milhões              |
| messages      | 2.000              | 24 milhões                |
| audit_log     | 5.000              | 60 milhões                |

Total estimado de dados primários no ano 3: aproximadamente 200 GB. Com índices, backups e WAL, infraestrutura precisa suportar 1 TB confortavelmente.

### 7.2 Pool de conexões

- **PgBouncer obrigatório:** modo transaction pooling. Reduz overhead de conexões, especialmente importante com múltiplas instâncias da aplicação.
- **Conexões diretas no banco:** limite de 200 simultâneas. PgBouncer multiplica para 2000+ conexões da aplicação.
- **Pool por aplicação:** 10 a 20 conexões por instância de NestJS. Workers BullMQ têm pool próprio menor.

### 7.3 Réplicas de leitura

A partir de 100 organizações ativas, configurar réplica de leitura assíncrona:

- Replicação física streaming via WAL.
- Lag aceitável: até 5 segundos.
- Roteamento na aplicação: leituras de relatórios e listagens vão para a réplica; transações vão para o primário.
- Failover automático com Patroni quando justificar a complexidade operacional (200+ organizações).

### 7.4 Particionamento

Aplicado em tabelas que crescem proporcionalmente ao tempo:

- **appointments:** `PARTITION BY RANGE (starts_at)`, partições mensais. Implementar a partir de 5 milhões de linhas.
- **audit_log:** `PARTITION BY RANGE (created_at)`, partições mensais. Implementar a partir de 10 milhões de linhas.
- **messages:** `PARTITION BY RANGE (created_at)`, partições trimestrais. Avaliar quando passar de 20 milhões.

Particionamento por `organization_id` (HASH) considerado mas rejeitado: complica queries cross-org de plataforma e oferece ganho marginal vs RLS bem indexado.

### 7.5 VACUUM e manutenção

- Autovacuum agressivo em tabelas de alta escrita (`appointments`, `order_items`, `audit_log`).
- Manual `VACUUM ANALYZE` semanal nas top 10 tabelas durante janela de baixa atividade.
- `REINDEX` trimestral em índices de tabelas com alto turnover (`orders`, `payments`).
- Monitoramento de bloat: alertar quando uma tabela passar de 30% de espaço morto.

### 7.6 Métricas alvo

| Operação                                            | P50    | P95     | P99     |
|-----------------------------------------------------|--------|---------|---------|
| Carregar agenda do dia (1 org, 1 profissional)      | 30 ms  | 100 ms  | 300 ms  |
| Listar clientes (paginado, 50 itens)                | 20 ms  | 80 ms   | 200 ms  |
| Abrir comanda existente                             | 15 ms  | 50 ms   | 150 ms  |
| Fechar comanda (com cálculo de comissão)            | 100 ms | 400 ms  | 800 ms  |
| Calcular previsibilidade financeira (30 dias)       | 200 ms | 800 ms  | 1500 ms |
| Painel financeiro do mês                            | 500 ms | 1500 ms | 3000 ms |

---

## 8. Row-Level Security em Detalhe

### 8.1 Habilitação

Toda tabela de negócio segue o mesmo padrão:

```sql
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON appointments
  USING (organization_id = current_setting('app.current_organization')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization')::uuid);
```

`FORCE` garante que mesmo o owner da tabela respeita a política. Sem isso, migrations e jobs administrativos vazariam entre tenants.

### 8.2 Roles do PostgreSQL

- **app_user:** role da aplicação. Sujeito a RLS. Usado em todas as conexões via PgBouncer.
- **app_admin:** role com `BYPASSRLS`. Usado apenas em migrations e jobs de plataforma. Acesso restrito.
- **app_readonly:** role para BI/relatórios. RLS aplicado. Permissão SELECT apenas.
- **app_audit:** role com leitura em `audit_log` e algumas views específicas. Usado pelo time de compliance.

### 8.3 Pitfalls comuns

- **Esquecer FORCE:** owner da tabela pula a política. Pode acontecer em migrations e quebrar isolamento silenciosamente.
- **Função SECURITY DEFINER:** executa com permissão do criador, ignora `app.current_organization`. Usar com extrema cautela e sempre validar manualmente.
- **View sem security_barrier:** query planner pode reordenar predicados e expor dados. Sempre criar views como `WITH (security_barrier = true)`.
- **Connection pooling em modo session:** variáveis de sessão vazam entre requisições. Obrigatório usar transaction pooling no PgBouncer.
- **Subqueries cruzadas:** EXISTS e JOIN com tabelas sem RLS podem vazar. Toda tabela de negócio deve ter RLS por padrão.

### 8.4 Testes de isolamento

Suite obrigatória que roda em CI:

- Para cada tabela com RLS, testa SELECT, INSERT, UPDATE e DELETE de uma organização sobre dados de outra. Espera-se 0 linhas afetadas em todos os casos.
- Tenta `FORCE` com role `app_admin` e valida que apenas migrations passam.
- Stress test: 100 conexões simultâneas alternando entre 10 organizações. Valida que nenhuma sessão herda `app.current_organization` de outra.

### 8.5 Auditoria de bypass

Toda query executada com `app_admin` é registrada via `log_statement = 'all'` nesse role específico. Logs vão para um bucket S3 imutável e são revisados semanalmente.

---

## 9. Migrações e Versionamento

### 9.1 Ferramenta

Prisma Migrate como ferramenta principal. Justificativa: integração nativa com Prisma ORM, geração automática de migrations a partir do schema declarativo, suporte a múltiplos ambientes.

### 9.2 Princípios

- **Sempre compatível para frente:** uma migration nunca quebra uma versão da aplicação que ainda esteja em produção. Mudanças destrutivas são divididas em fases (deprecate → migrate → remove).
- **Migrations são revisadas como código:** todo PR que altera schema passa por revisão específica focada em performance, índices e impacto em RLS.
- **Rollback documentado:** toda migration tem um plano de rollback descrito no commit, mesmo quando o rollback automático não é viável.
- **Aplicação em produção:** migrations rodam antes do deploy da aplicação que depende delas. Se houver janela de alguns minutos com schema novo + código antigo, deve funcionar.

### 9.3 Tipos de mudança e estratégia

| Mudança                              | Estratégia                                          | Risco                     |
|--------------------------------------|-----------------------------------------------------|---------------------------|
| Adicionar tabela                     | Direta                                              | Baixo                     |
| Adicionar coluna NULLABLE            | Direta                                              | Baixo                     |
| Adicionar coluna NOT NULL com DEFAULT| Direta no PG 11+                                    | Baixo                     |
| Adicionar índice                     | CONCURRENTLY, fora de migration                     | Médio (lock breve)        |
| Renomear coluna                      | Adicionar nova → migrar dados → remover antiga      | Alto                      |
| Mudar tipo de coluna                 | Idem renomear                                       | Alto                      |
| Remover coluna                       | Marcar como deprecated → remover em release seguinte| Médio                     |
| Remover tabela                       | Idem coluna                                         | Médio                     |
| Adicionar constraint                 | NOT VALID → VALIDATE em background                  | Médio                     |

### 9.4 Migrations e RLS

- Todo `CREATE TABLE` para tabela de negócio é seguido obrigatoriamente de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`.
- Linter de schema (custom) bloqueia merge se uma tabela com `organization_id` estiver sem política RLS.
- Migrations rodam com role `app_admin` (BYPASSRLS). Validação dos dados pós-migration usa `app_user` para confirmar isolamento.

### 9.5 Seeds

- Dados de catálogo global (lista de bancos, países, tipos de documento) versionados como seeds determinísticos.
- Dados de demonstração para staging gerados por factories com Faker.
- Produção nunca recebe seeds automáticos exceto os de catálogo global.

---

## 10. Backup, Recuperação e Retenção

### 10.1 Backup contínuo

- **WAL archiving:** Write-Ahead Log enviado continuamente para S3 (wal-g ou pgBackRest).
- **Base backup:** snapshot completo a cada 24 horas, retido por 30 dias.
- **PITR (Point-In-Time Recovery):** permite recuperar até qualquer momento dos últimos 30 dias.
- **RPO efetivo:** 5 minutos (intervalo máximo entre arquivamentos de WAL).
- **RTO efetivo:** 1 hora para restauração completa em ambiente novo.

### 10.2 Testes de restore

- Restore automático mensal em ambiente isolado, com validação de integridade.
- Métricas de tempo de restore reportadas e otimizadas continuamente.
- Verificação de checksum em todos os backups armazenados.

### 10.3 Retenção de dados

| Categoria                            | Retenção mínima | Justificativa                       |
|--------------------------------------|-----------------|-------------------------------------|
| Dados ativos (sem deleted_at)        | Indefinida      | Operação                            |
| Soft delete (deleted_at preenchido)  | 5 anos          | Auditoria + LGPD                    |
| Logs de aplicação                    | 90 dias quentes, 1 ano frios | Investigação de incidentes |
| Audit log                            | 5 anos          | Compliance fiscal e LGPD            |
| Mensagens enviadas                   | 2 anos          | Comprovação de envio                |
| Backups WAL                          | 30 dias         | PITR                                |
| Backups base                         | 12 meses        | Recuperação de desastre             |

### 10.4 Direito ao esquecimento (LGPD)

Quando o titular solicita exclusão de dados pessoais:

- Anonimização imediata em campos identificáveis: nome substituído por hash, telefone e email apagados, documento removido.
- Manutenção dos dados financeiros (notas fiscais, recebimentos) por exigência legal de 5 anos, mas dissociados da identidade.
- Registro da solicitação em `audit_log` para comprovação.
- Confirmação ao titular em até 15 dias úteis.

---

## 11. Roteiro de Implementação

### 11.1 Fase 1 — Núcleo (Sprint 1 e 2)

- `organizations`, `users`, `members`, `roles`, `role_permissions`
- `plans`, `subscriptions`
- Habilitação de RLS e roles do PostgreSQL
- Suite inicial de testes de isolamento

### 11.2 Fase 2 — Catálogo e Clientes (Sprint 3 e 4)

- `categories`, `services`, `products`, `packages`, `package_services`
- `clients`, `anamneses`, `anamnesis_templates`
- `bridal_groups`, `bridal_group_members`

### 11.3 Fase 3 — Operação (Sprint 5 a 7)

- `appointments`, `appointment_services`, `time_blocks`
- `orders`, `order_items`
- `cashiers`, `cashier_movements`, `payments`

### 11.4 Fase 4 — Financeiro Avançado (Sprint 8 a 10)

- `commissions` e regras de comissão
- `contracts`, `contract_installments`, `contract_services`
- Triggers de cálculo de previsibilidade
- Views materializadas para painéis

### 11.5 Fase 5 — Comunicação e Auditoria (Sprint 11 e 12)

- `messages`, `message_templates`
- `audit_log` com particionamento
- Integração com Meilisearch

---

## 12. Decisões Pendentes

### 12.1 UUID v7 vs ULID

Ambos oferecem identificadores temporais ordenáveis. UUIDv7 tem suporte nativo a partir do PostgreSQL 17 (próximo release) e ULID requer extensão. Decisão: usar UUIDv7 via função custom até PG 17, migrar para nativo depois.

### 12.2 JSONB vs colunas tipadas para configurações

Settings de organização e responses de anamnese usam JSONB. Vantagem: flexibilidade total. Desvantagem: validação fora do banco. Decisão atual: manter JSONB com schema validado pelo Prisma na aplicação. Reavaliar se aparecerem queries frequentes em campos específicos.

### 12.3 Tabela de comissões: derivada ou primária?

Comissão pode ser calculada on-demand (a partir de `order_items` + regras) ou materializada (tabela `commissions`). Decisão atual: materializada. Justificativa: cálculo é caro, regras mudam ao longo do tempo (e não queremos recalcular histórico), e relatórios precisam de leitura rápida. Trade-off aceito: dados duplicados.

### 12.4 Multi-unidade: mesma tabela ou separação por schema?

Quando uma organização tem múltiplas filiais. Decisão atual: coluna `location_id` NULLABLE em entidades operacionais (`appointments`, `orders`, `members`). Schema dedicado por filial complica queries consolidadas e raramente é necessário. Reavaliar se algum cliente solicitar isolamento legal entre filiais.

### 12.5 Particionamento de appointments: quando começar?

Padrão da indústria sugere começar a partir de 5 milhões de linhas. Com nossa projeção, isso acontece no ano 2. Mas migrar tabela existente para particionada é dolorido. Alternativa: já criar particionada desde o dia zero, mesmo com partição única no início. Decisão pendente: avaliar custo de complexidade vs flexibilidade futura.

### 12.6 Estratégia de cache de queries pesadas

Painéis financeiros e previsibilidade fazem queries com agregação custosa. Opções: views materializadas (refresh agendado), cache em Redis (invalidado por evento), ou banco de relatórios dedicado (ClickHouse). Decisão: começar com Redis no MVP, migrar para ClickHouse na Fase 4. Views materializadas como solução intermediária se necessário.

---

## Anexos

### Anexo A — Diagrama de Entidade-Relacionamento

O DER físico completo será produzido em ferramenta dedicada (dbdiagram.io ou DrawSQL) como entregável separado deste PRD. Será mantido sincronizado com o schema Prisma e versionado junto com o código.

### Anexo B — Schema Prisma

O schema declarativo (`.prisma`) que materializa este PRD é mantido em `/backend/prisma/schema.prisma`. Cada alteração passa por revisão de PR e gera uma migration nomeada.

### Anexo C — Próximos passos

- Validar este PRD com o time técnico.
- Implementar as tabelas da Fase 1 (núcleo) com testes de RLS.
- Configurar PgBouncer e Patroni em ambiente de staging.
- Configurar pipeline de backup com pgBackRest.
- Estabelecer baseline de performance com pgbench em ambiente representativo.
- Documentar o DER em ferramenta visual.

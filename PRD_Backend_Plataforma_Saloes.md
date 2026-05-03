# PRD de Backend

**Plataforma de Gestão Inteligente para Salões de Beleza**

Arquitetura modular, API GraphQL, autenticação, jobs, observabilidade

---

**Versão:** 1.0
**Data:** Maio de 2026
**Autor:** Daniel Leite Rodrigues

---

## Controle de Versões

| Versão | Data       | Autor                  | Descrição                                                  |
|--------|------------|------------------------|-------------------------------------------------------------|
| 1.0    | 02/05/2026 | Daniel Leite Rodrigues | Versão inicial do documento                                 |

---

## Sumário

1. [Introdução](#1-introdução)
2. [Arquitetura Interna](#2-arquitetura-interna)
3. [Estrutura de Código](#3-estrutura-de-código)
4. [API GraphQL](#4-api-graphql)
5. [Autenticação e Autorização](#5-autenticação-e-autorização)
6. [Eventos de Domínio](#6-eventos-de-domínio)
7. [Jobs e Workers](#7-jobs-e-workers)
8. [Cache](#8-cache)
9. [Integrações Externas](#9-integrações-externas)
10. [Observabilidade](#10-observabilidade)
11. [Configuração e Secrets](#11-configuração-e-secrets)
12. [Padrões de Código](#12-padrões-de-código)
13. [Decisões Pendentes](#13-decisões-pendentes)
14. [Anexos](#anexos)

---

## 1. Introdução

### 1.1 Propósito

Este PRD define a camada de backend da plataforma de gestão para salões. Detalha como o servidor é organizado internamente, como expõe sua API, como autentica e autoriza usuários, como executa tarefas em segundo plano, como integra-se com serviços externos e como é monitorado em produção. Serve de referência para o time de engenharia implementar e evoluir o sistema.

### 1.2 Relação com outros documentos

- **SDD da plataforma:** este PRD detalha a camada de aplicação descrita no SDD em alto nível. Princípios gerais (multi-tenancy, segurança, padrões de teste) vivem lá e são referenciados aqui.
- **PRD de Banco de Dados:** o backend consome o modelo definido naquele documento. Toda referência a tabelas, colunas e índices remete ao PRD de banco.
- **PRD de Frontend (futuro):** consumidor primário desta API. Decisões de schema GraphQL consideram o frontend como cliente preferencial.

### 1.3 Escopo

Cobre:

- Organização interna do servidor (módulos, bounded contexts).
- API GraphQL: schema, resolvers, persisted queries, validação.
- Autenticação JWT, autorização RBAC, multi-tenancy.
- Filas BullMQ, eventos de domínio, jobs agendados.
- Integrações com serviços externos (WhatsApp, gateway, IA).
- Logs, métricas, tracing, alertas.

Não cobre:

- Modelo de dados detalhado (vive no PRD de Banco de Dados).
- Componentes de frontend.
- Infraestrutura de deploy (Docker, Kubernetes, CI/CD) — vive no SDD e no PRD de DevOps futuro.

### 1.4 Stack tecnológica

A stack está definida no SDD, Seção 5.2. Resumo do que importa para este PRD:

- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10
- **API:** GraphQL via Apollo Server
- **ORM:** Prisma 5
- **Filas:** BullMQ sobre Redis 7
- **Validação:** Zod nos boundaries da aplicação
- **Testes:** Jest, Supertest, Playwright

### 1.5 Princípios

- **Modular monolith:** uma única aplicação NestJS organizada em módulos por bounded context. Microserviços ficam para quando houver pressão real (escala, time, isolamento de falha), não como ponto de partida.
- **Boundaries explícitos entre módulos:** módulos comunicam-se via eventos de domínio ou interfaces públicas, nunca acessando repositórios uns dos outros.
- **Domínio puro de infraestrutura:** lógica de negócio em classes que não dependem de NestJS, Prisma ou bibliotecas externas. Adapters traduzem para o mundo externo.
- **Falha rápida e explícita:** validação no início da requisição, erros tipados, sem `any` em código de domínio.
- **Tudo testado conforme SDD Seção 3:** sem exceção.

---

## 2. Arquitetura Interna

### 2.1 Camadas

A aplicação adota Clean Architecture adaptada ao contexto, com quatro camadas concêntricas:

```
┌─────────────────────────────────────────────┐
│  Interface (GraphQL resolvers, REST, jobs)  │
│  ┌───────────────────────────────────────┐  │
│  │  Application (casos de uso)           │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  Domain (regras de negócio)     │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │  Entities + Value Objects │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│  Infrastructure (Prisma, BullMQ, HTTP)      │
└─────────────────────────────────────────────┘
```

- **Domain:** entidades, value objects, regras invariantes. Sem dependência de infraestrutura.
- **Application:** casos de uso (orquestram entidades para resolver uma intenção do usuário).
- **Interface:** ponto de entrada (resolver GraphQL, controller REST, job handler).
- **Infrastructure:** implementações concretas de repositórios, gateways, adapters.

### 2.2 Bounded Contexts

Cada bounded context vira um módulo NestJS independente. Lista alinhada com o SDD, Seção 6.1:

| Módulo            | Responsabilidade                                     |
|-------------------|------------------------------------------------------|
| `identity`        | Organizações, usuários, membros, perfis, permissões  |
| `catalog`         | Categorias, serviços, produtos, pacotes, promoções   |
| `clients`         | Clientes, anamneses, grupos de noivas                |
| `scheduling`      | Agenda, agendamentos, bloqueios, cronograma          |
| `pos`             | Comandas, itens, fechamento                          |
| `finance`         | Caixa, pagamentos, contas a pagar                    |
| `commissions`     | Cálculo, regras, pagamento                           |
| `contracts`       | Contratos de eventos, parcelas, vencimentos          |
| `communication`   | Mensagens, templates, campanhas                      |
| `intelligence`    | Sugestões IA, previsões, alertas                     |
| `reporting`       | Painéis, métricas, exportações                       |
| `audit`           | Audit log, retenção                                  |

Módulos transversais (não são bounded contexts mas suportam todos):

| Módulo            | Responsabilidade                                     |
|-------------------|------------------------------------------------------|
| `core`            | Tipos base, decoradores, exceções                    |
| `database`        | Cliente Prisma, transações, multi-tenant context     |
| `auth`            | Guards, JWT, validação de tenant                     |
| `events`          | Bus interno, publicação e consumo                    |
| `queue`           | Configuração BullMQ, registro de workers             |
| `external`        | Adapters de serviços externos                        |
| `observability`   | Logger, tracer, métricas                             |

### 2.3 Comunicação entre módulos

Regras estritas:

- **Não permitido:** módulo A importar repositório do módulo B.
- **Permitido:** módulo A publicar evento que B consome.
- **Permitido:** módulo A invocar interface pública (`@Public()`) exposta por B via DI.
- **Permitido:** módulo A consultar via GraphQL (federation interno) — usado raramente.

Exemplo: quando uma comanda fecha (módulo `pos`), publica `OrderClosed`. O módulo `commissions` consome o evento e calcula. O módulo `pos` não conhece comissões.

### 2.4 Transações

- Casos de uso que afetam múltiplas entidades rodam dentro de transação Prisma explícita.
- Eventos publicados durante uma transação só são entregues após o commit (outbox pattern simplificado).
- Falha em qualquer ponto da transação causa rollback total e nenhum evento é entregue.

---

## 3. Estrutura de Código

### 3.1 Layout de pastas

```
backend/
├── src/
│   ├── main.ts                          # bootstrap
│   ├── app.module.ts                    # módulo raiz
│   ├── core/                            # transversal
│   │   ├── errors/
│   │   ├── decorators/
│   │   └── types/
│   ├── database/
│   │   ├── prisma.service.ts
│   │   └── tenant-context.middleware.ts
│   ├── auth/
│   │   ├── jwt.strategy.ts
│   │   ├── guards/
│   │   └── tenant.guard.ts
│   ├── events/
│   │   ├── event-bus.ts
│   │   └── domain-event.base.ts
│   ├── queue/
│   │   ├── queue.module.ts
│   │   └── queue.config.ts
│   └── modules/
│       ├── identity/
│       │   ├── domain/                  # entidades, VOs
│       │   ├── application/             # casos de uso
│       │   ├── infrastructure/          # Prisma, adapters
│       │   ├── interface/               # resolvers GraphQL
│       │   └── identity.module.ts
│       ├── scheduling/
│       ├── pos/
│       └── ...
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
│   ├── e2e/
│   ├── integration/
│   └── helpers/
└── package.json
```

### 3.2 Convenções de nomenclatura

| Tipo                | Convenção                       | Exemplo                                |
|---------------------|---------------------------------|----------------------------------------|
| Arquivo             | kebab-case                      | `create-appointment.use-case.ts`       |
| Classe              | PascalCase                      | `CreateAppointmentUseCase`             |
| Função / método     | camelCase                       | `calculateCommission()`                |
| Interface           | PascalCase, sem prefixo `I`     | `AppointmentRepository`                |
| Implementação       | sufixo descritivo               | `PrismaAppointmentRepository`          |
| Evento              | PascalCase, no passado          | `AppointmentCreated`                   |
| Caso de uso         | PascalCase, no infinitivo       | `CreateAppointmentUseCase`             |
| DTO de entrada      | sufixo `Input`                  | `CreateAppointmentInput`               |
| DTO de saída        | sufixo `Output` ou tipo direto  | `AppointmentOutput`                    |
| Constante           | UPPER_SNAKE_CASE                | `MAX_APPOINTMENT_DURATION`             |

### 3.3 Estrutura de um módulo

Cada módulo segue o mesmo template:

```
modules/scheduling/
├── domain/
│   ├── entities/
│   │   ├── appointment.entity.ts
│   │   └── time-block.entity.ts
│   ├── value-objects/
│   │   ├── time-range.vo.ts
│   │   └── appointment-status.vo.ts
│   ├── events/
│   │   ├── appointment-created.event.ts
│   │   └── appointment-cancelled.event.ts
│   └── repositories/                    # interfaces
│       └── appointment.repository.ts
├── application/
│   ├── use-cases/
│   │   ├── create-appointment.use-case.ts
│   │   └── cancel-appointment.use-case.ts
│   └── ports/                           # interfaces para externos
│       └── notification.port.ts
├── infrastructure/
│   ├── persistence/
│   │   └── prisma-appointment.repository.ts
│   ├── adapters/
│   │   └── whatsapp-notification.adapter.ts
│   └── mappers/
│       └── appointment.mapper.ts
├── interface/
│   ├── resolvers/
│   │   └── appointment.resolver.ts
│   ├── dto/
│   │   ├── create-appointment.input.ts
│   │   └── appointment.output.ts
│   └── subscriptions/
│       └── appointment.subscription.ts
└── scheduling.module.ts
```

---

## 4. API GraphQL

### 4.1 Visão geral

API única via GraphQL, exposta em `/graphql`. Schema construído com SDL (não code-first), versionado e revisado em PR.

### 4.2 Persisted queries

Em produção, apenas queries pré-aprovadas são executadas. Justificativa: evita queries arbitrárias maliciosas, reduz payload (cliente envia apenas hash), dá visibilidade exata de quais queries existem.

- Build do frontend gera arquivo `persisted-queries.json` com hash SHA-256 de cada query.
- Backend carrega esse arquivo no startup e rejeita queries não listadas em produção.
- Em desenvolvimento e staging, queries livres são aceitas para facilitar debug.

### 4.3 Estrutura do schema

```
schema/
├── scalars.graphql                     # DateTime, UUID, Money, etc
├── common.graphql                      # PageInfo, Connection, Error
├── identity.graphql
├── catalog.graphql
├── clients.graphql
├── scheduling.graphql
├── pos.graphql
└── ...
```

Cada bounded context tem seu próprio arquivo `.graphql`. Tipos compartilhados ficam em `common.graphql`.

### 4.4 Convenções de schema

#### 4.4.1 Tipos

- **Object types em PascalCase:** `Appointment`, `BridalGroup`.
- **Input types com sufixo:** `CreateAppointmentInput`, `UpdateClientInput`.
- **Enums em UPPER_SNAKE_CASE:** `APPOINTMENT_STATUS`, `PAYMENT_METHOD`.

#### 4.4.2 Queries

Sempre com filtros opcionais e paginação cursor-based:

```graphql
type Query {
  appointment(id: UUID!): Appointment
  appointments(
    filter: AppointmentFilter
    after: String
    first: Int = 50
  ): AppointmentConnection!
}

type AppointmentConnection {
  edges: [AppointmentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

#### 4.4.3 Mutations

Padrão: verbo + entidade. Sempre retornam payload tipado.

```graphql
type Mutation {
  createAppointment(input: CreateAppointmentInput!): CreateAppointmentPayload!
  cancelAppointment(input: CancelAppointmentInput!): CancelAppointmentPayload!
}

type CreateAppointmentPayload {
  appointment: Appointment
  errors: [UserError!]!
}
```

Erros de validação retornam em `errors[]` (não como exceção). Erros de sistema (banco fora do ar) retornam exceção GraphQL.

#### 4.4.4 Subscriptions

Usadas com parcimônia, apenas para fluxos onde push é claramente superior a polling:

- `appointmentUpdated(organizationId: UUID!)`: agenda em tempo real.
- `orderUpdated(orderId: UUID!)`: comanda atualizada por outro usuário.

Implementadas via Redis Pub/Sub.

### 4.5 Resolvers

#### 4.5.1 Estrutura padrão

Resolvers são finos. Validam, autorizam, delegam para caso de uso, formatam resposta.

```typescript
@Resolver(() => Appointment)
export class AppointmentResolver {
  constructor(
    private readonly createAppointmentUseCase: CreateAppointmentUseCase,
    private readonly findAppointmentUseCase: FindAppointmentUseCase,
  ) {}

  @Query(() => Appointment, { nullable: true })
  @UseGuards(AuthGuard, TenantGuard)
  @RequirePermission('appointment.read')
  async appointment(
    @Args('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ): Promise<Appointment | null> {
    return this.findAppointmentUseCase.execute({ id, tenant });
  }
}
```

#### 4.5.2 DataLoader

Resolução de campos relacionados sempre via DataLoader. Evita problema N+1.

```typescript
@ResolveField(() => Client)
async client(
  @Parent() appointment: Appointment,
  @Context('loaders') loaders: AppLoaders,
): Promise<Client> {
  return loaders.clientById.load(appointment.clientId);
}
```

DataLoaders criados por requisição (não compartilhados entre requisições) e injetados no contexto.

### 4.6 Tratamento de erros

Hierarquia de erros customizada:

- **DomainError:** violação de regra de negócio. Vira `UserError` no payload, status 200 no HTTP.
- **AuthorizationError:** falta de permissão. Vira erro GraphQL com extension `code: "FORBIDDEN"`.
- **AuthenticationError:** sessão inválida. Extension `code: "UNAUTHENTICATED"`.
- **InfrastructureError:** falha de banco, gateway, etc. Extension `code: "INTERNAL"`. Reportado ao Sentry.
- **ValidationError:** input mal formado. Extension `code: "BAD_REQUEST"`.

Stack traces nunca são expostas ao cliente em produção.

---

## 5. Autenticação e Autorização

### 5.1 Autenticação

#### 5.1.1 Login

Mutation `login(input: LoginInput!): LoginPayload!`. Recebe email e senha, retorna par de tokens (access + refresh) e dados do usuário.

#### 5.1.2 Tokens

- **Access token JWT:** vida útil de 15 minutos. Contém `userId`, `memberId`, `organizationId`, `roleId`, `permissions[]`.
- **Refresh token opaco:** string aleatória de 64 bytes, armazenada em tabela `refresh_tokens` com hash. Vida útil de 30 dias.
- **Rotação:** a cada refresh, o token antigo é invalidado e um novo emitido. Reuso de token antigo dispara invalidação de toda a árvore de tokens daquele usuário (defesa contra roubo).

#### 5.1.3 Multi-organização

Um usuário pode pertencer a múltiplas organizações. Após login, retorna lista de organizações disponíveis. Mutation `selectOrganization(organizationId: UUID!)` emite novo access token com organização específica.

#### 5.1.4 TOTP (segundo fator)

- Configuração: mutation `setupTotp` retorna QR Code e segredo.
- Ativação: mutation `confirmTotp(code: String!)` valida o primeiro código.
- Login com TOTP: response indica `totpRequired: true`, cliente envia segundo passo via `verifyTotp(code: String!)`.

### 5.2 Identificação do tenant

Conforme SDD Seção 7.3, com três fontes:

- **Subdomínio:** prioridade máxima quando presente.
- **Header `X-Organization-Id`:** usado por integrações via API.
- **Claim no JWT:** fallback e verificação cruzada.

Middleware executa em ordem:

1. Extrai tenant das três fontes.
2. Se houver divergência, rejeita com 403.
3. Define `app.current_organization` na sessão Prisma para ativar RLS.
4. Anexa `TenantContext` ao request para os resolvers consumirem.

### 5.3 Autorização

#### 5.3.1 Modelo

RBAC com perfis editáveis pela organização. Cada permissão é uma string nomeada no formato `<recurso>.<ação>`:

- `appointment.create`, `appointment.update`, `appointment.cancel`
- `client.read`, `client.write`, `client.delete`
- `finance.view`, `finance.manage`
- `member.invite`, `member.delete`, `member.editPermissions`

Lista mantida em código (não no banco) para evitar migration a cada nova feature. Banco guarda apenas as permissões atribuídas a cada perfil.

#### 5.3.2 Aplicação

Validação dupla:

- **Decorador no resolver:** `@RequirePermission('appointment.create')`. Bloqueia antes de executar a lógica.
- **Política CASL na entidade:** valida operações sobre instância específica (ex: profissional só altera próprio agendamento).

```typescript
@Mutation(() => CreateAppointmentPayload)
@RequirePermission('appointment.create')
async createAppointment(
  @Args('input') input: CreateAppointmentInput,
  @CurrentMember() member: Member,
): Promise<CreateAppointmentPayload> {
  // dentro do use case, validação CASL adicional:
  // ability.can('create', subject('Appointment', input))
}
```

### 5.4 Audit

Toda decisão de autorização (sucesso ou falha) gera entrada em `audit_log` quando aplicável a recurso sensível: financeiro, contratos, configurações de permissão. Logs incluem `member_id`, `permission`, `resource`, `decision`, `timestamp`.

---

## 6. Eventos de Domínio

### 6.1 Conceito

Eventos representam algo que aconteceu (passado), não um comando. São publicados por agregados de domínio quando uma transição relevante ocorre, e consumidos por outros módulos interessados.

### 6.2 Estrutura

```typescript
abstract class DomainEvent {
  readonly id: string;
  readonly aggregateId: string;
  readonly organizationId: string;
  readonly occurredAt: Date;
  readonly version = 1;
}

class AppointmentCreated extends DomainEvent {
  constructor(
    public readonly appointmentId: string,
    public readonly clientId: string,
    public readonly professionalId: string,
    public readonly startsAt: Date,
    organizationId: string,
  ) {
    super();
  }
}
```

### 6.3 Publicação e entrega

#### 6.3.1 Outbox pattern

Eventos publicados durante uma transação são gravados na tabela `outbox` junto com a operação. Após commit, um worker dedicado lê o outbox e publica no Redis Pub/Sub. Isso garante que eventos só são entregues se a transação for bem-sucedida, e que nenhum evento é perdido.

```sql
CREATE TABLE outbox (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ
);
```

#### 6.3.2 Consumo

Handlers registrados via decorador:

```typescript
@EventHandler(AppointmentCreated)
export class SendConfirmationOnAppointmentCreated {
  async handle(event: AppointmentCreated): Promise<void> {
    await this.queue.add('send-whatsapp-confirmation', {
      appointmentId: event.appointmentId,
    });
  }
}
```

Consumo é assíncrono. Falhas no handler não afetam a transação que originou o evento.

### 6.4 Eventos principais

Lista alinhada com SDD Seção 6.3:

- `AppointmentCreated`, `AppointmentConfirmed`, `AppointmentCancelled`
- `OrderOpened`, `OrderClosed`, `OrderCancelled`
- `PaymentReceived`, `PaymentRefunded`
- `CommissionCalculated`, `CommissionPaid`
- `ContractCreated`, `ContractInstallmentDue`, `ContractPaid`, `ContractOverdue`
- `ClientBirthdayApproaching`
- `BridalGroupCreated`

### 6.5 Idempotência

Handlers devem ser idempotentes — receber o mesmo evento duas vezes não pode causar dois efeitos. Estratégias:

- Verificar se a ação já foi feita antes de executar (consulta ao estado).
- Tabela de eventos processados, com chave única em `(handler, event_id)`.

---

## 7. Jobs e Workers

### 7.1 Visão geral

Tarefas que não precisam (ou não devem) bloquear a requisição principal rodam em workers BullMQ. Exemplos: envio de WhatsApp, cálculo de relatório pesado, conciliação bancária, cobrança recorrente.

### 7.2 Filas

Filas separadas por característica de carga:

| Fila              | Propósito                              | Prioridade | Retry    |
|-------------------|----------------------------------------|------------|----------|
| `notifications`   | Envio de WhatsApp, SMS, email          | Alta       | 5x       |
| `reports`         | Geração de relatórios pesados          | Baixa      | 2x       |
| `recurring`       | Cobranças e renovações                 | Média      | 3x       |
| `fiscal`          | Emissão de notas fiscais               | Alta       | 5x       |
| `reconciliation`  | Conciliação bancária e cartões         | Média      | 3x       |
| `commissions`     | Cálculo em lote                        | Baixa      | 2x       |
| `outbox`          | Publicação de eventos                  | Crítica    | infinito |
| `cdc`             | Pipeline para warehouse                | Baixa      | 3x       |

### 7.3 Padrão de worker

```typescript
@Processor('notifications')
export class NotificationWorker {
  @Process('send-whatsapp-confirmation')
  async sendConfirmation(job: Job<{ appointmentId: string }>): Promise<void> {
    const appointment = await this.repository.findById(job.data.appointmentId);
    if (!appointment) return; // idempotência

    await this.whatsappAdapter.send({
      to: appointment.clientPhone,
      template: 'appointment-confirmation',
      variables: { /* ... */ },
    });

    await this.messagesRepository.recordSent(appointment.id);
  }
}
```

### 7.4 Retry e dead-letter

- Retry automático com backoff exponencial: 1s, 5s, 30s, 5min, 30min.
- Após exceder retries, job vai para dead-letter queue específica da fila original.
- Dead-letter queue tem dashboard no painel administrativo da plataforma.
- Alerta automático quando dead-letter passa de 10 jobs em 1 hora.

### 7.5 Jobs agendados

Cron interno via BullMQ:

| Job                              | Frequência       | Descrição                                    |
|----------------------------------|------------------|----------------------------------------------|
| `daily-appointment-reminders`    | 18h diariamente  | Envia lembretes para agendamentos do dia seguinte |
| `birthday-campaigns`             | 9h diariamente   | Identifica aniversariantes do dia            |
| `contract-due-check`             | 8h diariamente   | Marca contratos vencidos, envia lembretes    |
| `daily-aggregations`             | 2h diariamente   | Atualiza views materializadas                |
| `cleanup-soft-deleted`           | Domingo 3h       | Arquiva registros com deleted_at > 5 anos    |
| `recurring-billing`              | Hora em hora     | Processa cobranças recorrentes               |

### 7.6 Multi-tenancy nos workers

Jobs sempre carregam `organizationId` no payload. Worker define o contexto Prisma antes de executar:

```typescript
async process(job: Job): Promise<void> {
  await this.tenantContext.run(job.data.organizationId, async () => {
    // toda query daqui já está filtrada por RLS
  });
}
```

---

## 8. Cache

### 8.1 Estratégia

Cache só é introduzido quando há benefício mensurável. Não é otimização preventiva.

### 8.2 Camadas

#### 8.2.1 Cache de query (Redis)

Para queries pesadas que não mudam com frequência:

- Painéis financeiros consolidados (refresh a cada 5 minutos).
- Estatísticas de aniversariantes do mês.
- Dashboards de profissional.

Chave: `query:<organizationId>:<query-name>:<hash-dos-args>`.
TTL: definido por query, tipicamente 5 a 60 minutos.
Invalidação: por evento (ex: `OrderClosed` invalida painel financeiro do dia).

#### 8.2.2 Cache de sessão (Redis)

- Permissões resolvidas do membro (TTL 5 min).
- Configurações da organização (TTL 30 min).
- Lista de tokens revogados (sem TTL, removido só após expiração natural).

#### 8.2.3 Cache de DataLoader (memória)

Por requisição. Não persiste entre requisições. Sem necessidade de invalidação.

### 8.3 Invalidação

Estratégia preferida: invalidação por evento. Quando algo muda, o evento de domínio dispara remoção da chave de cache afetada.

```typescript
@EventHandler(OrderClosed)
export class InvalidateFinancialPanelCache {
  async handle(event: OrderClosed): Promise<void> {
    const day = format(event.closedAt, 'yyyy-MM-dd');
    await this.cache.del(`query:${event.organizationId}:financial-panel:${day}`);
  }
}
```

TTL serve como rede de segurança quando invalidação por evento falha.

---

## 9. Integrações Externas

### 9.1 Princípio

Cada integração externa é encapsulada em um adapter. Domínio depende de uma interface (port), implementação concreta vive em `infrastructure/adapters/`. Isso permite trocar provedor sem refatorar negócio.

### 9.2 Padrão de adapter

```typescript
// domain/ports/notification.port.ts
export interface NotificationPort {
  send(input: SendNotificationInput): Promise<NotificationResult>;
}

// infrastructure/adapters/whatsapp-cloud-api.adapter.ts
@Injectable()
export class WhatsappCloudApiAdapter implements NotificationPort {
  async send(input: SendNotificationInput): Promise<NotificationResult> {
    // chamada à API do WhatsApp
    // tratamento de erro padronizado
    // métricas de latência e taxa de sucesso
  }
}
```

### 9.3 WhatsApp

- **Provedor:** Meta Cloud API oficial.
- **Templates:** pré-aprovados pela Meta, gerenciados via painel administrativo da plataforma.
- **Webhook:** recebe atualizações de status (enviado, entregue, lido) e respostas dos clientes. Endpoint `/webhooks/whatsapp` validado via assinatura HMAC.
- **Rate limiting:** controlado por organização conforme plano contratado. Excesso vai para fila secundária com prioridade baixa.

### 9.4 Pagamentos

- **Provedor:** Pagar.me ou Stripe Connect (decisão pendente conforme SDD Seção 9.2).
- **Operações:** criar link de cobrança, criar Pix, criar assinatura recorrente, processar webhook.
- **Webhook:** endpoint `/webhooks/payments` valida assinatura. Idempotência via `gateway_id` (mesmo ID nunca é processado duas vezes).
- **Retry:** falhas temporárias retornam ao job original. Falhas definitivas (cartão recusado) viram evento `PaymentFailed`.

### 9.5 Emissão Fiscal

- **Provedor:** Focus NFe ou eNotas (decisão pendente).
- **Escopo:** fora do MVP conforme SDD Seção 9.3.
- **Quando implementar:** Fase 4 do roteiro.

### 9.6 Inteligência Artificial

- **Provedor:** Anthropic Claude API.
- **Casos de uso iniciais:** sugestão de cronograma para grupos de noivas, geração de templates de mensagem, resumos de painéis.
- **Cache agressivo:** prompts equivalentes (mesma organização, mesmos parâmetros) reusam resposta por até 24h.
- **Custo controlado:** limite por plano da organização. Excedente bloqueia novas chamadas até renovação ou upgrade.
- **Fallback:** se a API falhar, funcionalidade degrada graciosamente (ex: sugestão de cronograma vira sugestão padrão por ordem alfabética, com aviso ao usuário).

### 9.7 Email e SMS

- **Email:** Resend, com domínio próprio configurado (SPF, DKIM, DMARC).
- **SMS:** Twilio ou Zenvia como backup quando WhatsApp falhar.
- **Templates:** mesma engine usada para WhatsApp, com versões específicas por canal.

### 9.8 Resiliência

Toda chamada externa segue o padrão:

- **Timeout explícito:** 5 segundos para chamadas críticas, 30 segundos para batch.
- **Circuit breaker:** após 10 falhas consecutivas, para de chamar por 1 minuto.
- **Bulkhead:** pool de conexões separado por integração, para que falha em uma não derrube outras.
- **Métricas:** latência, taxa de sucesso, número de circuit breakers abertos.

---

## 10. Observabilidade

### 10.1 Logs

#### 10.1.1 Padrão

Logs estruturados em JSON. Nunca `console.log`. Toda saída vai para stdout, coletada pelo orquestrador.

```json
{
  "level": "info",
  "timestamp": "2026-05-02T14:32:11.234Z",
  "correlationId": "01HXY3...",
  "organizationId": "0ab12...",
  "memberId": "f7c3e...",
  "module": "scheduling",
  "event": "appointment.created",
  "appointmentId": "9d4e1...",
  "duration_ms": 47
}
```

#### 10.1.2 Níveis

- **debug:** detalhes de execução, só em desenvolvimento.
- **info:** eventos de negócio relevantes (login, criação, fechamento).
- **warn:** comportamento inesperado mas tratado (retry, fallback, rate limit).
- **error:** falhas que precisam atenção (gateway fora do ar, exception não tratada).
- **fatal:** falhas que comprometem o servidor (perda de conexão com banco prolongada).

#### 10.1.3 Sanitização

Antes de gravar, logger remove campos sensíveis: `password`, `token`, `cpf`, `cnpj`, `cardNumber`. Lista mantida em config.

### 10.2 Métricas

Exportadas em formato Prometheus, via endpoint `/metrics` (protegido por basic auth interno).

#### 10.2.1 Métricas de aplicação

- `http_requests_total{method, route, status}`: contador.
- `http_request_duration_seconds{method, route}`: histograma.
- `graphql_resolver_duration_seconds{type, field}`: histograma.
- `graphql_resolver_errors_total{type, field, code}`: contador.
- `database_query_duration_seconds{operation, table}`: histograma.
- `queue_jobs_total{queue, status}`: contador.
- `queue_job_duration_seconds{queue, job_name}`: histograma.

#### 10.2.2 Métricas de negócio

- `appointments_created_total{organization_segment}`: contador.
- `orders_closed_total`: contador.
- `payments_received_amount_total{method}`: contador (em centavos).
- `active_organizations`: gauge.
- `mrr_amount`: gauge.

### 10.3 Tracing

Distributed tracing via OpenTelemetry. Cada requisição GraphQL gera um trace que percorre resolver, casos de uso, banco e chamadas externas.

- **Backend:** Tempo (Grafana) ou Jaeger.
- **Sampling:** 10% das requisições normais, 100% das que erram.
- **Correlation ID:** propagado em todos os logs, métricas e chamadas externas.

### 10.4 Alertas

Configurados no Grafana, disparam para Slack do time de plantão.

| Alerta                                         | Threshold                          |
|------------------------------------------------|-------------------------------------|
| Taxa de erro 5xx                                | > 1% por 5 minutos                 |
| Latência P95 acima do alvo                     | P95 > 500ms por 10 minutos         |
| Fila com mais de 100 jobs aguardando           | Por 15 minutos                     |
| Dead-letter queue acima de 10 jobs             | Em 1 hora                          |
| Banco indisponível                              | Imediato                           |
| Disco do banco acima de 80%                    | Imediato                           |
| Certificado TLS vencendo                        | 14 dias antes                      |
| Webhook externo falhando                       | 5 falhas em 5 minutos              |

### 10.5 Health checks

Endpoint `/health` retorna estado dos componentes:

```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok",
    "external_whatsapp": "degraded",
    "external_payments": "ok"
  },
  "uptime_seconds": 84321
}
```

Status global é o pior entre os checks. Orquestrador reinicia container se `/health` retornar `unhealthy` por 3 verificações seguidas.

### 10.6 Erro tracking

Sentry coleta exceções não tratadas. Cada erro vem com:

- Stack trace completo.
- Correlation ID para cruzar com logs.
- Tenant e usuário (com hash, não dado bruto).
- Versão do release.
- Breadcrumbs (sequência de eventos antes do erro).

Erros são agrupados por fingerprint. Alerta no Slack quando um novo grupo aparece em produção.

---

## 11. Configuração e Secrets

### 11.1 Princípios

- Configuração nunca em código.
- Secrets nunca em arquivo versionado.
- Mesma binaria roda em todos os ambientes, mudando apenas variáveis de ambiente.

### 11.2 Variáveis de ambiente

Validação no startup via Zod. Se faltar variável obrigatória, aplicação não sobe.

```typescript
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  WHATSAPP_API_TOKEN: z.string(),
  PAYMENT_GATEWAY_API_KEY: z.string(),
  CLAUDE_API_KEY: z.string(),
  SENTRY_DSN: z.string().url().optional(),
});
```

### 11.3 Gerenciamento de secrets

- **Desenvolvimento:** arquivo `.env` local, nunca versionado.
- **Staging:** secrets em GitHub Secrets, injetados pelo CI no deploy.
- **Produção:** AWS Secrets Manager ou Doppler. Aplicação busca no startup, faz cache em memória.
- **Rotação:** chaves de assinatura JWT e API tokens rotacionados a cada 90 dias.

### 11.4 Feature flags

Unleash como provedor. Flags têm escopo:

- **Global:** afeta todos os tenants (ex: liberar novo schema GraphQL).
- **Por plano:** afeta tenants de plano específico (ex: IA disponível apenas no Pro).
- **Por organização:** afeta organizações específicas (ex: piloto de funcionalidade nova).

Flags consultadas no início da requisição, com cache em memória de 30 segundos.

---

## 12. Padrões de Código

### 12.1 TypeScript

- **Strict mode obrigatório** em `tsconfig.json`.
- **Sem `any`** em código de domínio. Em adapters, permitido apenas em fronteira com bibliotecas sem tipos.
- **Tipos explícitos** em assinaturas públicas (parâmetros e retorno). Inferência aceita em escopo local.
- **Nunca usar `as`** para forçar tipo. Quando inevitável, isolar em função `assertX()` com runtime check.

### 12.2 Imutabilidade

- Entidades de domínio são imutáveis. Mudanças retornam nova instância.
- Coleções tratadas como imutáveis (`readonly`, sem `push`/`splice`).
- Apenas adapters de infraestrutura mutam (banco, fila, cache).

### 12.3 Erros

- Erros de domínio herdam de `DomainError` com código tipado.
- Nunca `throw new Error("string genérica")` em código de produção.
- Nunca silenciar exceção (`catch (e) { }`). No mínimo, log com contexto.

### 12.4 Async

- Sempre `async/await`, nunca `.then()`/`.catch()` encadeados.
- Promise não aguardada gera warning do linter.
- Operações que podem ficar em paralelo usam `Promise.all`, não `await` sequencial.

### 12.5 Lint e formatação

- ESLint com plugins: `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-unicorn`.
- Prettier com configuração compartilhada no monorepo.
- Husky pré-commit roda lint, format check e testes do código alterado.
- Pull request bloqueia merge se lint falhar.

### 12.6 Testes

Padrões definidos no SDD, Seção 3. Reforço dos pontos específicos do backend:

- **Unitários:** cada caso de uso, cada serviço de domínio, cada cálculo. Mocks via `jest-mock-extended`.
- **Integração:** repositórios contra Postgres real (Docker no CI). Valida queries Prisma e RLS.
- **E2E:** cenários completos via Supertest, autenticando com JWT real.
- **Isolamento de tenant:** suite obrigatória conforme SDD Seção 3.6.

### 12.7 Documentação

- README por módulo descrevendo bounded context, eventos publicados e consumidos.
- ADRs (Architecture Decision Records) versionados em `/docs/decisions/` para escolhas relevantes (escolha de gateway, mudança de estratégia de cache, etc).
- Schema GraphQL é a documentação da API. Tipos e campos têm comentários renderizados pelo GraphQL Playground.

---

## 13. Decisões Pendentes

### 13.1 Schema-first vs Code-first no GraphQL

Schema-first dá controle total sobre o contrato e facilita revisão. Code-first reduz duplicação e gera schema automaticamente. Decisão atual: schema-first. Reavaliar se a duplicação entre `.graphql` e DTOs virar atrito.

### 13.2 REST público para integrações

Além do GraphQL, deve haver uma API REST pública para integrações externas (parceiros, ERPs)? GraphQL é difícil para clientes simples. Decisão pendente: começar só com GraphQL e expor REST quando aparecer demanda concreta.

### 13.3 Outbox: tabela ou Debezium

Outbox simples (tabela + worker) é suficiente para começar. Debezium captura mudanças do WAL e elimina o worker, mas adiciona infraestrutura. Decisão atual: tabela + worker no MVP. Migrar para Debezium quando volume justificar.

### 13.4 BullMQ vs Temporal

Temporal oferece workflows duradouros e melhor visibilidade que BullMQ, mas é uma peça pesada. BullMQ basta para MVP. Reavaliar quando aparecerem fluxos complexos de longa duração (ex: orquestração de cronograma de noiva com múltiplas confirmações).

### 13.5 Apollo Server vs Mercurius

Apollo é o padrão de fato. Mercurius (sobre Fastify) é mais rápido e leve. Decisão atual: Apollo no NestJS, pelo ecossistema. Mercurius entra em consideração se latência virar gargalo.

### 13.6 Subscription via WebSocket vs SSE

WebSocket é bidirecional e padrão para GraphQL Subscription. Server-Sent Events é mais simples e suficiente para nosso caso (atualizações do servidor para o cliente). Decisão pendente: começar com WebSocket via Apollo, avaliar SSE se complexidade não compensar.

---

## Anexos

### Anexo A — Diagrama de fluxo de uma requisição

Fluxo completo de uma mutation de criar agendamento, da chegada da requisição ao retorno:

```
Cliente
  ↓ HTTP POST /graphql (com persisted query hash + variables + JWT)
Load Balancer
  ↓
NestJS HTTP Server
  ↓ middleware: persisted query lookup, parse query
Tenant Middleware
  ↓ identifica organização, valida divergência, define contexto Prisma
Auth Guard
  ↓ valida JWT, extrai member, role, permissions
Resolver: createAppointment
  ↓ valida input com Zod
  ↓ verifica permissão via decorador
Use Case: CreateAppointment
  ↓ inicia transação Prisma
  ↓ valida regras de domínio (slot livre, profissional disponível)
  ↓ persiste via repositório
  ↓ publica evento AppointmentCreated no outbox
  ↓ commit
Outbox Worker (assíncrono)
  ↓ lê evento, publica no Redis Pub/Sub
Event Handlers (paralelos)
  ↓ NotificationHandler: enfileira envio de WhatsApp
  ↓ ForecastHandler: invalida cache de previsibilidade
Resolver retorna payload
  ↓
Cliente recebe resposta
```

### Anexo B — Próximos passos

- Validar este PRD com o time técnico.
- Implementar bootstrap do NestJS com módulos `core`, `database`, `auth`.
- Configurar Prisma com middleware de tenant.
- Implementar primeiro módulo de domínio (`identity`) como referência arquitetural.
- Configurar pipeline de testes com coverage gate.
- Configurar Sentry, Grafana e exportação de métricas.
- Documentar primeiros ADRs (escolha de Apollo, escolha de Prisma, modelo de RBAC).

### Anexo C — Glossário específico de backend

| Termo                    | Definição                                                                              |
|--------------------------|----------------------------------------------------------------------------------------|
| Bounded Context          | Conjunto coeso de regras de negócio que evolui de forma independente                   |
| Use Case                 | Classe que orquestra entidades para realizar uma intenção do usuário                   |
| Adapter                  | Implementação concreta de uma porta (interface) que liga o domínio a um serviço externo|
| Port                     | Interface definida pelo domínio que descreve o que ele precisa do mundo externo        |
| DataLoader               | Padrão de batching e caching para resolver campos relacionados sem N+1                 |
| Persisted Query          | Query GraphQL pré-aprovada, identificada por hash, executada apenas se constar na lista|
| Outbox Pattern           | Garantia de entrega de evento usando tabela transacional                               |
| Circuit Breaker          | Padrão que para de chamar serviço externo após sequência de falhas                     |
| Idempotência             | Característica de uma operação que pode ser executada várias vezes com o mesmo efeito  |
| Saga                     | Sequência de operações distribuídas que mantém consistência via compensação            |

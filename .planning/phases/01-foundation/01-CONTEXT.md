# Phase 1: Foundation - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Infraestrutura multi-tenant com isolamento RLS comprovado, autenticação JWT com refresh token rotation, verificação de email, RBAC com 4 roles aplicado nas rotas/resolvers, e fluxo de signup + criação de organização + convite de membros. Esta fase não inclui UI de gerenciamento de roles/permissões — apenas enforcement técnico e convite de membros.

</domain>

<decisions>
## Implementation Decisions

### Stack Versions (upgrade greenfield — custo zero)
- **D-01:** Node.js **22 LTS** (não 20 — Node 20 entra em Maintenance em abr/2026, criaria upgrade debt no Ano 1)
- **D-02:** Prisma **6** (não 5 — release estável nov/2024)
- **D-03:** React **19** (não 18 — release estável dez/2024)
- **D-04:** **Valkey 8** no lugar de Redis (fork Linux Foundation, compatível binário com Redis 7.2, licença MIT — Redis 7.4+ é RSALv2/SSPL, restritivo para SaaS comercial)
- **D-05:** Versões do Vite, NestJS e Tailwind: usar versão mais recente estável no momento da implementação (não fixar agora — Claude decide)

### Monorepo Tooling
- **D-06:** **pnpm workspaces** (sem Turborepo ou Nx — suficiente para 2 apps; adicionar Turborepo se CI ficar lento)
- **D-07:** Estrutura: `apps/backend/` + `apps/frontend/` na raiz do monorepo
- **D-08:** Shared types entre backend e frontend: Claude decide se cria `packages/shared` ou usa apenas `graphql-codegen` para tipos gerados

### Signup + Criação de Organização
- **D-09:** Signup cria conta **e** organização em um **único fluxo sequencial** — sem separação de etapas: dados pessoais → nome do salão → pronto
- **D-10:** Dados coletados no cadastro: apenas **nome, email, senha e nome do salão** — restante configurado depois no onboarding
- **D-11:** **Verificação de email obrigatória** antes do primeiro acesso ao sistema — link de verificação enviado via Resend após cadastro
- **D-12:** O usuário que cria a organização recebe automaticamente o role **Administrador**

### RBAC na Fase 1
- **D-13:** Fase 1 entrega o **layer de autorização técnico** (guards no NestJS, decorators nos resolvers, verificação de role no frontend) — sem UI de gerenciamento de roles
- **D-14:** 4 roles implementados: `ADMIN`, `MANAGER`, `ATTENDANT`, `PROFESSIONAL` — permissões definidas no código (CASL ou similar), não configuráveis pelo usuário nesta fase
- **D-15:** **Convite de membros incluído na Fase 1** — proprietário precisa poder convidar profissionais desde o início para testar o sistema. Fluxo: proprietário insere email → sistema envia convite → convidado aceita e define senha

### Claude's Discretion
- Estrutura interna dos módulos NestJS (pasta/arquivo layout dentro de cada bounded context)
- Estratégia de migration Prisma em dev (script ou automático no startup)
- Implementação do PgBouncer local no Docker Compose (container dedicado vs pgbouncer no postgres container)
- Biblioteca de RBAC: CASL vs implementação custom com decorators
- Setup do GraphQL codegen (schema watching, output location)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRDs do Projeto (raiz do repositório)
- `PRD_Backend_Plataforma_Saloes.md` — Arquitetura NestJS, bounded contexts, módulo identity, eventos de domínio, Outbox Pattern, Clean Architecture layers
- `PRD_Banco_Dados_Plataforma_Saloes_v1.1.md` — Schema PostgreSQL completo, estratégia RLS, duas roles DB (`sgs_migrator`/`sgs_app`), índices, tabela outbox
- `PRD_Frontend_Plataforma_Saloes.md` — Arquitetura React SPA, design system, autenticação no frontend, estrutura de rotas
- `SDD_Plataforma_Saloes_v1.1.md` — Decisões arquiteturais, deployment, integrações, seção de identidade/autenticação

### Pesquisa do Projeto
- `.planning/research/STACK.md` — Validação do stack, gaps críticos (PgBouncer, bibliotecas faltando, versões)
- `.planning/research/PITFALLS.md` — Armadilhas críticas de RLS (SET vs SET LOCAL, roles), segurança JWT
- `.planning/research/ARCHITECTURE.md` — Análise dos bounded contexts, build order, gaps do outbox table

### Requisitos
- `.planning/REQUIREMENTS.md` §INFRA e §AUTH — Requisitos INFRA-01..03 e AUTH-01..03 que esta fase cobre

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum — projeto greenfield, sem codebase existente

### Established Patterns
- Nenhum estabelecido ainda — esta fase define os padrões que as fases seguintes seguirão

### Integration Points
- Esta fase cria os pontos de integração que as Fases 2-5 consumirão:
  - Middleware de tenant injection (Prisma `$transaction` + `SET LOCAL app.current_tenant_id`)
  - Guards NestJS de autenticação e autorização (usados em todos os resolvers futuros)
  - Apollo Client setup com headers de auth (consumido por todos os módulos frontend futuros)
  - Base schema Prisma com campos obrigatórios (id UUIDv7, organization_id, created_at, updated_at, deleted_at, version)

</code_context>

<specifics>
## Specific Ideas

- PgBouncer em transaction-mode é não-negociável — o CI smoke test que verifica isso deve ser implementado na Fase 1, não depois
- A tabela `outbox` deve ter seu schema definido nesta fase mesmo que o worker seja implementado depois — inclui `organization_id`, `event_type`, `payload`, `status`, `retry_count`, `created_at`, índice com `SKIP LOCKED`
- Dois roles de banco de dados criados na migration inicial: `sgs_migrator` (BYPASSRLS, usado só em migrations) e `sgs_app` (sem bypass, usado pela aplicação em runtime)
- Campos base de toda entidade tenant-scoped: `id UUID DEFAULT gen_uuid_v7()`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`, `version INTEGER DEFAULT 1`

</specifics>

<deferred>
## Deferred Ideas

- UI de gerenciamento de roles e permissões — Fase 2 ou posterior (proprietário pode mudar role de membros)
- TOTP (2FA) — v2 (AUTH-04)
- Múltiplas organizações por usuário — v2 (AUTH-05)
- Recuperação de senha — incluir na Fase 1 como parte do fluxo de auth (Claude decide incluir ou não)

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-05-02*

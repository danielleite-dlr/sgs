# Phase 2: Core Domain - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Source:** Discuss-phase (Claude's Discretion mode — user delegated all decisions)

<domain>
## Phase Boundary

Catálogo completo (categorias hierárquicas, serviços com precificação dinâmica, pacotes, produtos com estoque, regras de comissão) e perfis de clientes com estrutura de histórico pronta. Esta fase entrega CRUD + estrutura de dados; cálculo automático de comissão e popula histórico ficam na Phase 3 (Core Operations). Não inclui UI de noivas (Phase 4) nem integração WhatsApp (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Bounded Contexts (Backend)

- **D-01:** Criar dois bounded contexts novos:
  - `apps/backend/src/catalog/` — categories, services, packages, products, commission_rules
  - `apps/backend/src/clients/` — clients, client_history_view
  Seguir o padrão da Phase 1 (module + service + resolver + DTOs por contexto).

- **D-02:** Manter o RBAC herdado — `ADMIN` e `MANAGER` editam catálogo e clientes; `ATTENDANT` lê catálogo e CRUD clientes; `PROFESSIONAL` lê catálogo + lê clientes que atendeu (Phase 3 amarra "atendeu"). Phase 2 só impõe os 3 primeiros via `@RequirePermission`.

- **D-03:** Todas as tabelas Phase 2 são **tenant-scoped** (FORCE ROW LEVEL SECURITY com `organization_id` UUID). Sem exceções — a fundação da Phase 1 já estabelece o padrão.

### Categorias hierárquicas (CAT-01)

- **D-04:** Profundidade fixa em **2 níveis** (parent → children). Sem categoria-raiz infinitamente profunda. Schema: `category.parent_id` nullable (null = raiz). Validação no service garante que `parent.parent_id` é null.
- **D-05:** Reorder via campo `display_order` (integer). UI inicial usa botões up/down. Drag-drop adiado (nice-to-have, não bloqueia).
- **D-06:** Serviço pertence a **exatamente uma categoria** (`service.category_id` not null). Simplifica relatórios e UX. Múltiplas categorias por serviço fica para v2 se demanda aparecer.

### Precificação dinâmica de serviços (CAT-01)

- **D-07:** Modelo "variantes nomeadas" (não combinações automáticas):
  - `service` tem `base_price` (preço default) e `default_duration_minutes`.
  - `service.pricing_variants[]` (1-N) — cada variante tem `name` (ex.: "Júnior 30min", "Sênior 60min"), `duration_minutes`, `seniority_tier` (`junior` | `pleno` | `senior`, opcional), `price`. Variante NÃO referencia profissional individual em Phase 2.
  - Quando atendente abre um agendamento (Phase 3) ou comanda, vê a lista de variantes do serviço e escolhe uma. Sem matching automático "qual variante se aplica".
- **D-08:** `seniority_tier` no `professional` (campo no model `Member` ou em `professional_profile` — Claude decide localização). Phase 2 só armazena; Phase 3 usa para sugerir variante.

### Pacotes (CAT-02)

- **D-09:** Pacote tem **preço próprio** (`package.price`) explicitamente diferente da soma dos serviços. Permite descontos promocionais ou markups premium. UI mostra "soma individual: R$X | preço do pacote: R$Y" para transparência.
- **D-10:** Composição do pacote é **fixa** — cliente não pode trocar serviços ao comprar. Para variações, proprietário cria outro pacote. Tabela `package_services` (n-n com `service`).
- **D-11:** **Sem validade** (`valid_for_days` campo nullable, default null = indefinido). Pacotes pré-pagos com expiração ficam para v2 (relacionado a "crédito na conta" em POS-02).

### Produtos e estoque (CAT-03)

- **D-12:** `product` tem campos: `name`, `sku` (único por org), `cost_price`, `sale_price`, `stock_quantity`, `min_stock_level`, `unit` (un/ml/g — controlled vocabulary).
- **D-13:** Estoque decrementa quando **comanda é fechada** (venda confirmada — Phase 3). Não na abertura da comanda. Phase 2 implementa apenas a lógica de ajuste manual via mutation `adjustStock(productId, delta, reason)`.
- **D-14:** Tabela `stock_movements` para auditoria — campos: `product_id`, `delta` (+/-), `type` (`initial`, `manual_adjustment`, `sale`, `return`), `reason` (texto), `performed_by` (member_id), `created_at`. Phase 2 só popula via ajuste manual e initial; Phase 3 popula sale/return.
- **D-15:** Alerta de estoque mínimo: **badge visual** na lista de produtos (vermelho quando ≤ `min_stock_level`) + entrada no `notifications` (tabela criada nesta phase para o futuro notification center). Email/WhatsApp ficam para Phase 5.

### Regras de comissão (CAT-04)

- **D-16:** Phase 2 entrega **apenas configuração** (CRUD) das regras. Cálculo automático ao fechar comanda + snapshot imutável é Phase 3 (FIN-02).
- **D-17:** Modelo `commission_rule` com escopo nullable (do mais específico ao geral):
  - `service_id` + `member_id` (regra para profissional X no serviço Y) — mais específica
  - `service_id` apenas (qualquer profissional)
  - `category_id` (qualquer serviço da categoria)
  - `product_id` (regras de comissão sobre venda de produto)
  - default da org (todas as outras vendas)
- **D-18:** Cada regra tem `kind` (`fixed` | `percentage`) e `value` (decimal). Apenas UMA regra entre as 4 opções acima é aplicada (precedência do mais específico ao geral). Validação no service garante que regras conflitantes do mesmo escopo não existem.
- **D-19:** Cálculo sobre **valor bruto** (preço cobrado pelo serviço/produto, sem descontos de meio de pagamento). Phase 4+ pode adicionar "comissão sobre líquido" como flag por org.

### Clientes (CLI-01)

- **D-20:** Campos do `client`:
  - Obrigatórios: `full_name`, ao menos um de (`email` ou `phone`)
  - Opcionais: `cpf`, `birth_date`, `address`, `notes` (texto livre)
  - Sistema: `id`, `organization_id`, `created_at`, `updated_at`, `deleted_at`, `version`
- **D-21:** CPF é **opcional**. Cliente walk-in pode ser cadastrado só com nome + telefone. Quando preenchido, validar dígitos verificadores client-side (máscara) + server-side (regex + checksum).
- **D-22:** Duplicata de CPF dentro da mesma org: **alertar mas não bloquear**. Antes de salvar, sistema busca clientes com mesmo CPF/email/phone e mostra ao atendente; ele decide criar novo ou usar o existente. Cross-org duplicates não são problema — RLS isola.

### Histórico de cliente (CLI-02)

- **D-23:** Phase 2 entrega a **tela com layout e filtros prontos** (período, profissional, tipo de evento). Mostra empty state "Sem histórico ainda" enquanto Phase 3 não popula. Componentes UI completos (cards, tabs).
- **D-24:** Camada de dados: criar **GraphQL resolver `client.history`** que retorna lista vazia em Phase 2. Implementação real (agregando appointments + commandas + products) é trabalho da Phase 3 — substitui o stub. View materializada NÃO é necessária; query direta com joins basta para escala Ano 1.

### Imagens (transversal)

- **D-25:** Phase 2 **sem upload de imagens** em produção. Schema tem `cover_image_url` (nullable text) em `service`, `product`, `category` para preparar futuro. UI mostra placeholder com iniciais ou ícone lucide-react. Cloudflare R2 + upload validation (MIME, tamanho) ficam para fase posterior — provavelmente junto com WhatsApp na Phase 5 ou phase dedicada de mídia.

### Convenções gerais

- **D-26:** Soft delete em todas as entidades de catálogo (`category`, `service`, `package`, `product`) e clientes via `deleted_at`. **Não fazer hard delete** — comandas e relatórios futuros precisam das referências. Listagens default filtram `deleted_at IS NULL`.
- **D-27:** Sem catálogo pré-populado. Cada org começa vazia e cadastra seu próprio catálogo. Onboarding wizard fica para fase posterior.
- **D-28:** Frontend: novas rotas `/catalogo/categorias`, `/catalogo/servicos`, `/catalogo/pacotes`, `/catalogo/produtos`, `/catalogo/comissoes`, `/clientes`. ProtectedRoute herdado da Phase 1. Layout com sidebar lateral surge nesta phase (a Phase 1 só tinha telas de auth full-screen).

### Claude's Discretion (não locked, planner decide)

- Estrutura interna dos módulos NestJS (resolvers/services/repository pattern)
- Estratégia de paginação (cursor vs offset) nas listagens
- Bibliotecas auxiliares (validação CPF: `cpf-cnpj-validator` ou implementação inline)
- Strategy de migration Prisma (1 migration por bounded context ou consolidada)
- Componentização frontend (shadcn DataTable vs custom Table)
- Onde colocar `seniority_tier` (no `Member` direto ou em tabela `professional_profile`)
- Sidebar layout component (criar shared `AppShell` com nav + content area)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRDs do Projeto (raiz do repositório)
- `PRD_Backend_Plataforma_Saloes.md` — bounded contexts catalog/clients, evento de domínio, regras de comissão
- `PRD_Banco_Dados_Plataforma_Saloes_v1.1.md` — schema completo (services, products, packages, clients, commission_rules), índices
- `PRD_Frontend_Plataforma_Saloes.md` — telas de catálogo e cliente, layout com sidebar
- `SDD_Plataforma_Saloes_v1.1.md` — decisões arquiteturais

### Phase 1 (fundação, já entregue)
- `.planning/phases/01-foundation/01-CONTEXT.md` — decisões D-01 a D-15 da Phase 1 (stack, RLS, RBAC)
- `.planning/phases/01-foundation/01-PHASE-SUMMARY.md` — retrospectiva e known follow-ups
- `.planning/phases/01-foundation/01-UI-SPEC.md` — design tokens (cores, tipografia, espaçamento)
- `apps/backend/prisma/schema.prisma` — schema atual (organization, user, member, role, etc)
- `apps/backend/src/database/tenant-context.service.ts` — pattern para tenant injection
- `apps/backend/src/authz/` — guards, decorators, permissions catalog

### Requisitos
- `.planning/REQUIREMENTS.md` §CAT (CAT-01..04) e §CLI (CLI-01, CLI-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (de Phase 1)
- `TenantContextService.runWithTenant` para queries tenant-scoped
- `PermissionGuard` + `@RequirePermission` decorator para autorização
- `PrismaService` (singleton, conectado como sgs_app)
- shadcn primitives instalados: Button, Input, Label, Card, Alert, Form, Separator, Sonner
- React Router 6 com `ProtectedRoute`
- Apollo Client + Zustand auth store
- i18next pt-BR namespace structure

### Established Patterns
- Schema-first GraphQL SDL em `apps/backend/src/graphql/schema/*.graphql`
- DTOs com class-validator
- Migrations Prisma versionadas em `apps/backend/prisma/migrations/`
- pt-BR copy convention (Phase 1 UI-SPEC §Copywriting Contract)
- Design tokens (#5D54C7 primary, Inter font, 4 sizes / 2 weights, espaçamento base 4px)

### Integration Points
- Phase 3 (POS) consumirá: `service.pricing_variants`, `package.services`, `commission_rule` para snapshot, `product.stock_quantity` para decremento na venda
- Phase 4 (Bridal) consumirá: `client` (associação noiva principal + acompanhantes via `client_relationships`)
- Phase 5 (Communication) consumirá: `client.birth_date` (campanhas), `notifications` (alertas)

</code_context>

<specifics>
## Specific Ideas

- **`seniority_tier` em member** — começar com 3 valores (`junior`, `pleno`, `senior`) como enum. Pode evoluir para escala numérica em phases futuras se necessário.
- **`pricing_variants` shape** — JSON estruturado em campo dedicado da tabela `service_pricing_variants` (relacional, não JSON column) para permitir índices e queries.
- **`stock_movements`** — incluir `created_at` indexado para relatórios de movimentação por período (cobre futura demanda de auditoria sem migration).
- **Notifications table** — campos: `id`, `organization_id`, `member_id` (destinatário), `kind` (`stock_low`, `commission_rule_changed` no futuro), `payload` (JSONB), `read_at` (nullable), `created_at`. Estruturada para receber novos kinds nas próximas phases.
- **Layout AppShell** — sidebar fixa esquerda (lg+), drawer mobile. Itens: Catálogo (subitens), Clientes, Dashboard placeholder. Header com nome do salão + avatar. Padrão shadcn/ui.

</specifics>

<deferred>
## Deferred Ideas

- **Drag-drop reorder** de categorias e serviços — `display_order` permite implementar depois sem breaking change.
- **Múltiplas categorias por serviço** — só se demanda aparecer; refactor não-trivial.
- **Validade de pacotes** (`valid_for_days`) — relacionado a "crédito na conta" da Phase 3.
- **Upload de imagens** (Cloudflare R2, validação MIME, redimensionamento) — phase dedicada ou junto com WhatsApp na Phase 5.
- **Catálogo pré-populado de serviços comuns** — onboarding wizard, fase futura.
- **Anamnese estruturada** (CLI-04 já está em v2 da REQUIREMENTS.md).
- **Comissão sobre valor líquido** — flag por org, fase posterior se contadores reclamarem.
- **Histórico exportável** (PDF/CSV) — baixa prioridade, fase posterior.
- **Notificações por email/WhatsApp** de estoque mínimo — Phase 5.
- **Relatórios de movimentação de estoque** com filtros — fase posterior.
- **Auditoria de mudanças em comissões** (quem alterou regra X) — fase posterior.

</deferred>

---

*Phase: 02-core-domain*
*Context gathered: 2026-05-06 via discuss-phase (Claude's Discretion)*

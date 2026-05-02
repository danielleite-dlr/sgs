# Research Summary: SGS Beauty Salon SaaS

*Research completed: 2026-05-02 | Overall confidence: MEDIUM-HIGH*

---

## Stack Verdict

O stack decidido é fundamentalmente sólido para um SaaS brasileiro em 2025/2026, mas sofre de version drift: Node 20, React 18, Vite 5 e Prisma 5 já foram superados por sucessores LTS ativos. Para um projeto greenfield, o custo de começar com Node 22, React 19, Vite 6 e Prisma 6 é zero. Além das versões, três componentes estão completamente ausentes do stack decidido: PgBouncer (obrigatório para isolamento RLS correto), Meilisearch (referenciado no SDD), e pgBackRest/wal-g (mandatório para o SLA de RPO de 5 minutos).

### Critical Gaps to Address Before Phase 1

- **PgBouncer ausente** — sem ele, `SET LOCAL app.current_organization` vaza entre conexões no pool, criando falha silenciosa de isolamento de tenant
- **Duas roles DB necessárias** — `sgs_migrator` (com BYPASSRLS para migrations) e `sgs_app` (sem BYPASSRLS, para a aplicação); nunca reutilizar role de migration em runtime
- **Schema do `outbox` table ausente do DB PRD** — precisa de definição, política RLS e índice `SKIP LOCKED` antes de qualquer implementação do Outbox Pattern
- **Colunas LGPD faltando em `clients`** — adicionar `whatsapp_consent_at`, `whatsapp_consent_channel` antes de qualquer dado de cliente ser coletado
- **Bibliotecas faltando**: `argon2`, `otplib`, `nestjs-pino`, `graphql-scalars`, `@bull-board/nestjs`, `graphql-ws`, `@graphql-codegen/cli`, `react-i18next`, `@sentry/react`
- **WABA (WhatsApp Business Account) verification** — iniciar processo com Meta imediatamente; demora 1–4 semanas, fora do controle da engenharia

### Top 3 Mudanças Antes da Fase 1

1. Adicionar PgBouncer em transaction-mode + CI smoke test asserting mode está correto
2. Upgrade para Node 22 LTS + React 19 + Vite 6 + Prisma 6 (custo zero no greenfield)
3. Decidir Pagar.me vs Stripe Connect agora — o design da interface `PaymentGateway` depende do modelo escolhido

---

## Feature Landscape

SGS compete num mercado brasileiro onde o Trinks domina por volume mas é superável em qualidade de produto e profundidade vertical. Pix e WhatsApp são admission tickets (sem eles o produto não é vendável), não diferenciadores. A oportunidade real está em: (1) gestão de estúdios de noivas — nicho sem SaaS dedicado no Brasil, ingressos de R$3k–15k por evento; (2) clínicas estéticas LGPD-compliant — concorrentes tratam mal; (3) confirmação WhatsApp 2-way — concorrentes enviam só em uma direção.

### Must-Have (table stakes v1)

- Calendário visual com raias por profissional e drag-to-reschedule
- Perfis de clientes com CPF, histórico, aniversário e formulários de anamnese
- Catálogo de serviços com faixas de preço (curto/médio/longo, júnior/sênior)
- Comanda/POS com geração de QR Pix, dinheiro, cartão, split multi-método
- Cálculo automático de comissões por serviço/produto por profissional
- Lembrete WhatsApp 24h antes do agendamento (maior redutor de no-show no Brasil)
- Link de agendamento público (seleção de serviço + profissional + slots disponíveis)
- Dashboard financeiro básico (receita diária/semanal/mensal por método)
- RBAC: Proprietário, Gerente, Recepcionista, Profissional
- Rastreamento de consentimento LGPD na criação de cliente e coleta de anamnese

### Differentiators (competitive edge)

- Gestão de grupos de noivas + planner de evento (nenhum concorrente tem; vertical de maior ticket)
- WhatsApp 2-way: cliente responde "1 confirmar / 2 cancelar", sistema atualiza status automaticamente
- Detecção de clientes em risco + campanhas segmentadas (reativação, aniversário, calendário sazonal brasileiro)
- IA de otimização de agenda de noivas via Claude API (sugestão de alocação ótima de profissionais para grupo)
- Transparência de comissão em tempo real para profissionais (reduz disputas e rotatividade)
- Anamnese LGPD-compliant com armazenamento encriptado + galeria de fotos antes/depois
- Precificação dinâmica por senioridade do profissional (júnior vs sênior para o mesmo serviço)

### Defer to v2+

- App mobile nativo (iOS/Android) — PWA cobre 80%; Fase 5
- Gestão multi-unidade/franquia — Fase 5+
- Integração fiscal NFe/NFSe — Fase 4
- Programa de fidelidade/gamificação — Fase 3 candidato
- Marketplace/descoberta de profissionais — modelo de negócio diferente
- Sincronização Google Calendar — Fase 5
- Folha de pagamento/eSocial — território de software contábil

---

## Architecture Assessment

A arquitetura Shared Database / Shared Schema + PostgreSQL RLS é validada para a escala alvo de 1000 orgs. Os 12 bounded contexts estão bem desenhados com uma lacuna: um contexto `billing`/`subscription` está ausente — sem ele, a lógica de lifecycle de assinatura vai vazar para o módulo `identity`. A ordem de build é ditada por dependências duras — `identity → catalog → clients → scheduling + POS + finance + commissions` formam um loop transacional único e devem ser entregues juntos na Fase 1.

### Phase 1 Must Include (não negociável)

- Estratégia de duas roles DB (`sgs_migrator` / `sgs_app`) com `FORCE ROW LEVEL SECURITY` em todas as tabelas tenant-scoped
- Wrapper Prisma `$transaction` que executa `SET LOCAL app.current_tenant_id` antes de cada query
- PgBouncer em transaction-mode com CI smoke test
- Tabela `outbox` com `organization_id`, `event_version`, `retry_count`, worker com `SKIP LOCKED`
- Tabela `AppointmentProfessional` join (não FK simples em Appointment) — mudança de schema pós-dados é cara
- Todos os valores monetários como `NUMERIC(10,2)` no PostgreSQL + Prisma `Decimal` + `decimal.js` na camada de aplicação
- Tabela `consent_records` para audit trail LGPD antes de qualquer dado de cliente ser escrito
- Redis com AOF persistence (`appendonly yes`) — jobs BullMQ devem sobreviver restart do Redis
- Testes de isolamento cross-tenant no CI asserting RLS é aplicado

### Build Order Constraint

```
DB roles (sgs_migrator/sgs_app) + RLS foundation
  → identity (users, orgs, members, roles)
    → catalog (services, products, packages, pricing)
      → clients (profiles, CPF, consent records)
        → scheduling (appointments + advisory lock + overlap check)
          → POS (orders, order_items, payments, cashier)
            → finance (cashier movements, payables)
              → commissions (calculation at OrderClosed, snapshot inputs)
                → audit (cross-cutting wiring)
                  → reporting-basic (SQL dashboard queries)
```

Esta sequência não pode ser quebrada. Cada camada requer a anterior.

---

## Top Pitfalls to Avoid

1. **RLS bypass via role errada ou `SET` em vez de `SET LOCAL`** — manter duas roles DB; sempre usar `SET LOCAL` dentro de `$transaction`; adicionar CI assertion cross-tenant; risco existencial ao negócio
2. **Race condition de double-booking** — usar `pg_advisory_xact_lock(professional_id_hash, slot_start_epoch)` dentro da transação de booking; adicionar índice único parcial em `(professional_id, start_time)`
3. **Aritmética monetária com float JS** — armazenar como `NUMERIC(10,2)` no PostgreSQL, tipo `Decimal` no Prisma, `decimal.js` na aplicação; nunca `+` nativo de JS em dinheiro
4. **LGPD sem audit trail de consentimento** — implementar tabela `consent_records` com IP, timestamp, versão e tipo de consentimento antes de qualquer coleta de dados de cliente
5. **WhatsApp API não-oficial (Baileys/Evolution)** — somente BSP oficial Meta; um ban = todas as 250+ organizações perdem notificações simultaneamente, sem SLA nem caminho de recuperação

---

## Open Decisions (resolver antes de começar a construir)

| Decisão | Opções | Quando Necessário |
|---------|--------|-------------------|
| Payment gateway | Pagar.me (recomendado para BR) vs Stripe Connect (melhor para expansão) | Fase 1 — design da interface `PaymentGateway` depende do modelo |
| Node.js version | Node 22 LTS (recomendado) vs Node 20 LTS (Maintenance em abr/2026) | Antes do setup do dev environment |
| WhatsApp sender model | WABA compartilhado (onboarding simples) vs WABA por org (melhor deliverability) | Fase 1 — registro WABA demora 1–4 semanas |
| Tailwind version | v4 + shadcn/ui v2 (verificar compatibilidade) vs v3 + shadcn/ui stable (seguro) | Antes do scaffold do frontend |
| Redis vs Valkey | Redis 7.2.x (último MIT) vs Valkey 7.2+ (fork Linux Foundation, compatível binário) | Antes do setup de infra |
| Particionamento de `appointments` | Criar particionada desde o day zero vs migrar depois | Fase 1 schema — custo zero criar desde o início |
| Regra de comissão em pacotes | Sobre total do pacote vs proporcional por serviço dentro do pacote | Fase 1 domain model — não especificado nos PRDs |

---

## Key Insights for Roadmap

- **Fase 1 deve entregar o loop completo ou não entrega nada utilizável.** Calendário, POS, comissões e financeiro são uma unidade atômica para operações de salão. Uma fase que entrega só agendamento sem pagamento não é utilizável por um salão real.
- **O módulo de noivas é o diferenciador primário de aquisição e deve ser Fase 2, não Fase 3+.** É a feature que nenhum concorrente tem, comanda os tickets mais altos, e tem demo visível que fecha clientes enterprise.
- **Onboarding do WhatsApp oficial deve começar antes do início da Fase 3, não quando ela entrega.** Verificação de conta Meta Business demora 1–4 semanas; aprovação de templates demora 24–72h cada. A engenharia não consegue acelerar isso.
- **Compliance LGPD não é preocupação da Fase 2+.** Consent records, padrão de anonimização em duas etapas e encriptação de anamnese devem estar no schema da Fase 1. Retrofit depois que dados existem requer data migration cara.
- **Features de IA (Claude API, demand forecasting) precisam de mínimo 3 meses de dados operacionais para entregar valor.** Fase 4 é o timing correto. Construir antes produz IA sem dados para raciocinar.

---

## Confidence Assessment

| Área | Confiança | Notas |
|------|-----------|-------|
| Stack | MEDIUM-HIGH | Choices centrais são sólidos; versões baseadas em releases conhecidos até ago/2025 |
| Features | HIGH (table stakes) / MEDIUM (competitor gaps) | Table stakes são HIGH; feature parity de concorrentes é MEDIUM — acesso web indisponível durante pesquisa |
| Arquitetura | HIGH | PRDs muito detalhados; lacunas identificadas (outbox table, billing context) são concretas |
| Pitfalls | HIGH (PostgreSQL/Prisma) / MEDIUM (LGPD enforcement, pagamentos BR) | Pitfalls técnicos centrais são comportamentos documentados |

---

*Ready for requirements definition: YES*

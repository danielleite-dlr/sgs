# SGS — Plataforma de Gestão para Salões de Beleza

## What This Is

Sistema SaaS multi-tenant de gestão inteligente para salões de beleza, barbearias, clínicas estéticas e estúdios de noivas no Brasil. Substitui planilhas, agendas em papel e WhatsApp manual por uma plataforma unificada de agendamento, financeiro, clientes e comunicação. Voltado para proprietários e profissionais que precisam de controle operacional completo sem complexidade técnica.

## Core Value

Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Organização multi-tenant com isolamento por Row-Level Security no PostgreSQL
- [ ] Autenticação JWT com refresh tokens e TOTP opcional
- [ ] Membros com roles: Administrador, Gerente, Atendente, Profissional
- [ ] Catálogo hierárquico: categorias → serviços → pacotes com precificação dinâmica
- [ ] Produtos com controle de estoque
- [ ] Perfis de clientes com histórico, anamnese e rastreamento de aniversário
- [ ] Agenda por dia/semana/profissional com slots configuráveis (15/20/30 min)
- [ ] Bloqueios de horário (intervalos, feriados, indisponibilidade)
- [ ] Agendamentos com sinal/depósito opcional
- [ ] Ordens de serviço (comandas) com serviços e produtos
- [ ] Múltiplas formas de pagamento: dinheiro, Pix, cartão, transferência, voucher, crédito
- [ ] Caixa com abertura/fechamento e registro de discrepâncias
- [ ] Cálculo automático de comissões por item
- [ ] Dashboard financeiro consolidado
- [ ] Grupos de noivas e planner de evento com IA
- [ ] Contratos de eventos com parcelas e assinatura digital
- [ ] Automação WhatsApp (lembretes 24h, confirmação dia)
- [ ] Campanhas de comunicação (aniversário, retorno, sazonal)
- [ ] Sugestões IA via Claude API (agenda ótima de noivas, alertas operacionais)
- [ ] Previsão de demanda baseada em histórico
- [ ] Link de agendamento público

### Out of Scope

- Mobile app nativo — web-first (PWA), app mobile na Fase 5
- Multi-unidade/franquia — single-unit MVP, multi-unit Fase 5+
- Integração fiscal (NFe) — Fase 4
- Integração Google Calendar — Fase 5
- Marketplace de profissionais — Fase 5
- REST API pública — GraphQL first, REST se demanda aparecer

## Context

**Documentação de origem:** 4 PRDs detalhados na raiz do projeto:
- `PRD_Backend_Plataforma_Saloes.md` — arquitetura NestJS, módulos, eventos de domínio
- `PRD_Banco_Dados_Plataforma_Saloes_v1.1.md` — schema PostgreSQL, RLS, estratégia de índices
- `PRD_Frontend_Plataforma_Saloes.md` — SPA React, design system, componentes por módulo
- `SDD_Plataforma_Saloes_v1.1.md` — decisões arquiteturais, integrações, deployment

**Contexto de negócio:** Mercado brasileiro, LGPD compliance obrigatório, comunicação WhatsApp-first, suporte a Pix como método de pagamento primário.

**Arquitetura já decidida:** Clean Architecture (Domain→Application→Interface→Infrastructure), Modular Monolith com bounded contexts, event-driven com Outbox Pattern, persisted queries GraphQL em produção.

**SLAs definidos nos PRDs:** P95 API ≤300ms, agenda load ≤1s, uptime 99.5%, RPO 5min, RTO 1h.

## Constraints

- **Stack**: Node.js 20 LTS + NestJS 10 + GraphQL (Apollo) + Prisma 5 + PostgreSQL 16 + Redis 7 — já decidido nos PRDs
- **Frontend**: React 18 + TypeScript + Vite 5 + Apollo Client 3 + Tailwind CSS 3 + shadcn/ui — já decidido
- **Multi-tenancy**: Row-Level Security no PostgreSQL — abordagem definida, não negociável
- **Compliance**: LGPD, WCAG 2.1 AA, OWASP — obrigatórios
- **Scalabilidade**: 250 orgs Ano 1 → 1000 orgs Ano 3
- **Testes**: 80% cobertura unitária no domínio, E2E para fluxos críticos, bloqueio de PR em falha

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Schema-first GraphQL (não code-first) | Melhor controle do contrato de API, PR review mais claro | — Pending |
| Shared DB / Shared Schema multi-tenancy | Simplicidade operacional vs. isolated DB; RLS garante isolamento | — Pending |
| Outbox Pattern via tabela + worker (não Debezium) | Mais simples no MVP, Debezium avaliado depois | — Pending |
| BullMQ (não Temporal) | Suficiente para MVP, reavaliar para workflows complexos | — Pending |
| WebSocket via Apollo Subscriptions | Padrão GraphQL, uso parcial (agenda em tempo real) | — Pending |
| Pagar.me vs Stripe Connect | Ambos viáveis; decidir no início da implementação de pagamentos | — Pending |

---
*Last updated: 2026-05-02 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

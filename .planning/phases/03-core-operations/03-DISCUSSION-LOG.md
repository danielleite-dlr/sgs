# Phase 3: Core Operations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 03-core-operations
**Areas discussed:** Agenda (concorrência+sinal+bloqueios+DnD), Comanda (abertura+walk-in+pagamento+reabertura), Pagamento (Pix+métodos+crédito), Financeiro (cálculo+rateio+snapshot+dashboard), Visões+Numeração, Permissões, Cancelamento, Estoque

---

## Agenda — Concorrência

| Option | Description | Selected |
|--------|-------------|----------|
| Advisory lock no Postgres | pg_advisory_xact_lock por (org, professional, slot). Atomic, sem race | ✓ |
| Constraint DB unique parcial | Unique index parcial em (professional_id, slot_start) WHERE status NOT cancelled | |
| Optimistic com retry | Tenta criar; se falhar, mostra erro. Sem lock | |

**User's choice:** Advisory lock (recomendado)
**Notes:** Funciona com PgBouncer transaction-mode (lock libera no commit/rollback do XID). Adicionado SQLSTATE 55P03 detection para mostrar toast "Horário já reservado".

---

## Agenda — Bloqueios

| Option | Description | Selected |
|--------|-------------|----------|
| 4 tipos: folga, intervalo, feriado, indisponibilidade | Cada tipo com semantica e cor distintas | ✓ |
| Tipo único 'block' com label livre | Mais simples mas perde semântica para relatórios | |
| 2 tipos: folga + feriado | Minimalista MVP | |

**User's choice:** 4 tipos (recomendado)
**Notes:** Recorrência (toda terça) fica para v2. Cada tipo com cor distinta na UI já antecipada nos chips coloridos do mockup.

---

## Agenda — Sinal/Depósito

| Option | Description | Selected |
|--------|-------------|----------|
| Registro manual no MVP | Atendente marca sinal. Pix QR fica pra Phase 5 | ✓ |
| Pix QR via gateway nesta fase | Pagar.me/Stripe Connect agora. +30-50% scope | |
| Sem sinal no MVP | Adia SCHED-04 — mas Phase 4 (noivas) precisa | |

**User's choice:** Registro manual (recomendado)
**Notes:** Sinal vira crédito do cliente quando agendamento é cancelado.

---

## Agenda — Drag and Drop

| Option | Description | Selected |
|--------|-------------|----------|
| Otimista com revert se falhar | Move imediato; reverte com toast se servidor rejeitar | ✓ |
| Síncrono com loading | Card 'movendo...' até confirmar | |
| Confirmação explícita | Drag move temp + botão 'Confirmar' | |

**User's choice:** Otimista com revert (recomendado)
**Notes:** Padrão Google Calendar. UX rápida.

---

## Comanda — Abertura

| Option | Description | Selected |
|--------|-------------|----------|
| Atendente abre manualmente | Botão '+ Abrir comanda' no card do agendamento | |
| Abre automática ao iniciar agendamento | Cria comanda quando atendente clica 'Iniciar atendimento' | |
| Abre quando agendamento confirmado pelo cliente | WhatsApp 2-way trigger | |

**User's choice:** **(Custom)** "A comanda é aberta quando o agendamento do serviço é feito. ou seja o cliente vem e compra um pacote de serviços quando agenda o a execução desse serviços e a atendente registra esses agendamenteo, ai a comanda é aberta automaticamente, e todos os serviços agendados entram para essa comanda"

**Notes:** Diferente das opções apresentadas — abre na **criação do agendamento** (não no início do atendimento). Comanda + agendamento ciclo de vida acoplado. Itens podem ser adicionados/removidos durante o atendimento (produtos vendidos, serviços extras).

---

## Comanda — Walk-in

| Option | Description | Selected |
|--------|-------------|----------|
| Comanda aceita cliente mínimo | Nome + telefone opcional, CPF depois | ✓ |
| Comanda exige cliente cadastrado completo | CPF obrigatório | |
| Comanda anônima permitida | Sem associar a registro | |

**User's choice:** Cliente mínimo (recomendado)
**Notes:** Reduz fricção no balcão. CPF preenchido depois na ficha.

---

## Comanda — Pagamento Dividido

| Option | Description | Selected |
|--------|-------------|----------|
| Lista de parciais com troco automático | Sistema calcula 'falta' e 'troco' | ✓ |
| Multi-pagamento sem troco automático | Atendente faz aritmética | |
| Pagamento único apenas | Quebra POS-03 | |

**User's choice:** Parciais com troco automático (recomendado)
**Notes:** Troco em dinheiro registrado em `cash_movements` para auditoria.

---

## Comanda — Reabertura

| Option | Description | Selected |
|--------|-------------|----------|
| Só ADMIN/MANAGER, com motivo | Audit_log + reverte stock/commission/credit | ✓ |
| Ninguém reabre — só estorno | Imutável após fechar | |
| Qualquer atendente até X minutos | Janela de graça | |

**User's choice:** ADMIN/MANAGER com motivo (recomendado)
**Notes:** Reabertura cria entradas de reversão (não UPDATE). Mantem `commission_records` imutável.

---

## Pix — Integração

| Option | Description | Selected |
|--------|-------------|----------|
| Registro manual | Cliente paga via app, atendente confirma | ✓ |
| Pix QR via gateway agora | Pagar.me/Stripe Connect + webhook | |
| Pix QR estático sem gateway | QR fixo da chave da org, confirmação manual | |

**User's choice:** Registro manual (recomendado)
**Notes:** Adia integração real para Phase 5 junto com WhatsApp Business API onboarding (mesmo bloco de business verification).

---

## Métodos de Pagamento

| Option | Description | Selected |
|--------|-------------|----------|
| 6 do PRD (com Voucher) | Dinheiro + Pix + Crédito + Débito + Transferência + Voucher | |
| Só Pix + Dinheiro + Cartão genérico | 3 métodos. Cartão único | |
| 5 sem Voucher | Dinheiro + Pix + Crédito + Débito + Transferência | ✓ |

**User's choice:** 5 sem Voucher
**Notes:** Voucher/vale-presente fica para v2 se demanda aparecer.

---

## Crédito de Cliente

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela client_credit_movements + método 'Pagar com crédito' | Mockup já tem tela. Saldo origem: cancelamento, ajuste manual | ✓ |
| Sem crédito no MVP | Adia para Phase 4 com contratos | |
| Crédito implícito por pacote | Sem tabela genérica | |

**User's choice:** Tabela com método (recomendado)
**Notes:** Saldo = SUM(amount) com validação de saldo não-negativo.

---

## Financeiro — Gatilho

| Option | Description | Selected |
|--------|-------------|----------|
| Síncrono ao fechar comanda | Mesma transação | ✓ |
| Job assíncrono via BullMQ | Worker processa em background | |
| On-demand quando profissional consulta | Sem snapshot — quebra FIN-02 | |

**User's choice:** Síncrono (recomendado)
**Notes:** BullMQ infra existe (Phase 1) caso precise virar async em escala.

---

## Financeiro — Rateio

| Option | Description | Selected |
|--------|-------------|----------|
| 1 profissional por item | Single, alinha com Phase 2 commission_rule | ✓ |
| Rateio por percentuais (split) | Múltiplos profissionais por % | |
| Profissional do agendamento (sem editar na comanda) | Rígido | |

**User's choice:** 1 profissional por item (recomendado)
**Notes:** Rateio split fica para v2. Cobre 90% dos casos.

---

## Financeiro — Snapshot

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela commission_records nova | 1 row por item-comissionado, imutável | |
| Campos diretos no comanda_item | commission_member_id + amount + JSONB | |
| commission_records + JSON da regra | Tabela + rule_snapshot JSONB | ✓ |

**User's choice:** commission_records + JSON da regra (recomendado)
**Notes:** Auditoria contábil máxima. JSONB com regra completa permite saber o que foi aplicado mesmo se regra for editada depois.

---

## Financeiro — Dashboard Período

| Option | Description | Selected |
|--------|-------------|----------|
| Presets + Date range customizado | Atalhos + 'Personalizado' | ✓ |
| Só presets fixos | Hoje/semana/mês | |
| Só date range customizado | Sempre 2 datas | |

**User's choice:** Presets + customizado (recomendado)
**Notes:** Default 'Mês atual'. Padrão Trinks/ferramentas similares.

---

## Visões + Numeração de Comanda

| Option | Description | Selected |
|--------|-------------|----------|
| Dia padrão + Semana opcional, código curto C-2026-001 | Visão dia (mockup), semana via toggle. Código sequencial anual por org | ✓ |
| Só dia + UUID truncado 8 chars | Mais simples | |
| Dia + Semana + Mês + customizável | Mais visões, mais scope | |

**User's choice:** Dia + Semana + código curto (recomendado)
**Notes:** Vista mensal NÃO em scope. UUID interno permanece para FK.

---

## Permissões POS

| Option | Description | Selected |
|--------|-------------|----------|
| ATTENDANT CRUD + PROFESSIONAL read-only suas comandas | Modelo clássico | ✓ |
| PROFESSIONAL também CRUDa próprias comandas | Salão pequeno sem recepcionista | |
| MANAGER obrigatório para fechar | Controle financeiro maior | |

**User's choice:** ATTENDANT CRUD + PROFESSIONAL read-only (recomendado)
**Notes:** Decorators novos: `comanda.create | close | reopen`, `commission.adjust`, `credit.adjust`.

---

## Cancelamento

| Option | Description | Selected |
|--------|-------------|----------|
| Cancela com motivo + sinal vira saldo | Crédito automático | ✓ |
| Cancela e estorna sinal manualmente | Mais flexível mas exige conhecimento contábil | |
| Cancela sem sinal só | Política rígida | |

**User's choice:** Motivo + sinal vira saldo (recomendado)
**Notes:** Política de retenção (% por antecedência) fica para Phase 4 com contratos de noivas.

---

## Estoque

| Option | Description | Selected |
|--------|-------------|----------|
| Decremento ao fechar comanda + badge sidebar (já existe) | Phase 2 pending implementado | ✓ |
| Decremento + entrada em /notificacoes | Visibilidade extra | |
| Só decremento, sem alerta visual em Phase 3 | Mais enxuto, alerta vai pra Phase 5 | |

**User's choice:** Decremento + badge (recomendado)
**Notes:** Notification center adiado para Phase 5 com WhatsApp/email alerts.

---

## Claude's Discretion

Áreas onde o usuário delegou decisão técnica ao Claude:
- Lib de calendar (FullCalendar vs custom)
- UX de overlay vermelho em slots ocupados durante drag
- Postgres SEQUENCE vs função custom para código de comanda
- Batch insert vs N inserts em commission_records
- Schema do audit_log (genérico vs específico)
- Layout exato da vista semana

## Deferred Ideas

- Pix QR via gateway real → Phase 5
- Voucher → v2
- Caixa formal POS-04 → Adicionais/Futuro
- Previsão financeira 30d → Phase 5
- Política de retenção configurável → Phase 4 (CONT-03)
- WhatsApp 2-way → Phase 5
- Recorrência em bloqueios → v2
- Rateio split de comissão → v2
- Vista mensal do calendar → over-engineering
- View materializada de dashboard → só se load testing identificar gargalo
- Notification center com alertas → Phase 5
- Código de comanda customizável → v2
- Comanda anônima → rejeitado (D-06)

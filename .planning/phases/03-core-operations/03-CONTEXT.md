# Phase 3: Core Operations - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Discuss-phase (interactive — 16 decisions across 4 areas)

<domain>
## Phase Boundary

Loop operacional atômico — atendente cria agendamento → comanda abre automaticamente → atendimento é executado → atendente registra pagamento → sistema calcula comissões síncronas e atualiza financeiro, **tudo numa sequência sem fricção**.

**Esta fase entrega:**
- Agenda com calendar por profissional, drag-drop, bloqueios e prevenção de double-booking
- Comanda (POS) que abre automaticamente ao criar agendamento, aceita walk-ins, pagamento dividido com troco
- 5 métodos de pagamento (Dinheiro, Pix, Cartão Crédito, Cartão Débito, Transferência) — **registro manual no MVP** (sem gateway real)
- Crédito de cliente (saldo) — entrada automática quando cancelar agendamento com sinal
- Cálculo automático de comissão síncrono ao fechar comanda, com snapshot imutável
- Dashboard financeiro com presets de período + date range customizado
- Decremento de estoque (Phase 2 prep) acionado ao fechar comanda

**Esta fase NÃO inclui:**
- Pix QR via gateway real (Pagar.me/Stripe Connect) — fica para Phase 5 com WhatsApp
- Voucher/vale-presente — adicionado se demanda real aparecer
- Caixa formal com abertura/fechamento (POS-04) — listado em "Adicionais/Futuro"
- Previsão financeira 30 dias (FIN-03) — Phase 5
- WhatsApp confirmation 2-way → comanda — Phase 5
- Contratos de noivas (Phase 4) — sinal vira crédito do cliente nesta fase, sem amarração ao contrato de evento

</domain>

<decisions>
## Implementation Decisions

### Agenda — Concorrência, Bloqueios e Drag-and-drop

- **D-01:** **Postgres advisory lock** previne double-booking. Toda operação de criar/mover agendamento abre transação e chama `pg_advisory_xact_lock(hashtext(organization_id || ':' || professional_id || ':' || slot_start))` antes do insert/update. Lock libera no commit/rollback. UI: botão "Salvar" mostra loading; se falhar com SQLSTATE 55P03 (lock timeout) ou validação de overlap, mostra toast "Horário já reservado por outra pessoa — escolha outro slot".

- **D-02:** **4 tipos de bloqueio** em tabela `time_blocks` com campo `kind` enum:
  - `folga` — dia inteiro sem trabalho do profissional
  - `intervalo` — pausa curta (almoço, café)
  - `feriado` — org-wide, todos os profissionais
  - `indisponibilidade` — médico, compromisso pessoal específico

  Cada um tem cor distinta na UI da agenda (já antecipado no mockup com chips coloridos). Recorrência (toda terça às 14h) **fica para v2** — MVP só bloqueio único.

- **D-03:** **Sinal/depósito é registro manual** no MVP (SCHED-04). Modal "Cadastrar Agendamento" tem campo "Sinal recebido (R$)" + select de método (qualquer um dos 5). Não gera QR — cliente paga via app bancário, atendente confirma. Sinal entra como **crédito do cliente** (tabela `client_credit_movements` — ver D-09) e é debitado quando comanda do agendamento é fechada (ou liberado se cancelar — ver D-15).

- **D-04:** **Drag-and-drop otimista com revert**. Card muda visualmente para o novo horário imediatamente; mutation roda em background. Se servidor retornar erro (advisory lock falha, fora-expediente, profissional bloqueado), card volta para posição original + toast "Não foi possível mover: [motivo]". Padrão Google Calendar.

### Comanda — Abertura, Walk-in, Pagamento, Reabertura

- **D-05:** **Comanda abre automaticamente ao criar agendamento**. Quando atendente confirma a criação do agendamento (com 1 ou múltiplos serviços, possivelmente de um pacote), o sistema cria a comanda no mesmo evento, pré-populada com os serviços agendados. Status inicial: `aberta`. Itens podem ser adicionados/removidos durante o atendimento (produtos vendidos, serviços extras). Comanda + agendamento têm ciclo de vida acoplado:
  - `agendamento.status: scheduled` → `comanda.status: aberta`
  - `agendamento.status: em_atendimento` → `comanda.status: aberta` (atendente trabalhando)
  - `agendamento.status: concluido` → `comanda` segue aberta até fechamento financeiro
  - `agendamento.status: cancelled` → `comanda.status: cancelled`

- **D-06:** **Walk-in com cliente mínimo**. Atendente clica "+ Nova comanda" sem agendamento prévio; modal pede cliente — pode escolher um existente OU cadastrar novo com **só nome + telefone opcional** no mesmo modal. Cadastro completo (CPF, aniversário, endereço) preenchido depois na ficha do cliente. Não requer CPF para abrir comanda walk-in.

- **D-07:** **Pagamento dividido com troco automático**. UI de fechamento mostra Total: R$X. Atendente adiciona linhas de pagamento parcial (1-N): cada linha tem método + valor. Sistema calcula:
  - `pago = soma(parciais)`
  - `falta = total - pago` (se positivo, atendente precisa adicionar mais)
  - `troco = pago - total` (se positivo, mostra "Troco: R$X" — relevante quando linha de Dinheiro tem valor maior que falta)

  Comanda fecha quando `pago >= total`. Troco em dinheiro é registrado como saída no `cash_movements` (mesmo padrão de stock_movements para auditoria).

- **D-08:** **Reabertura só por ADMIN/MANAGER, com motivo obrigatório**. ATTENDANT não tem permissão `comanda.reopen`. Reabrir cria entrada em `audit_log` com motivo (ex.: "estorno solicitado pelo cliente", "erro de fechamento"). Reverte:
  - `stock_movements` da comanda (cria entradas type='return' compensando os 'sale')
  - `commission_records` da comanda (marca como `reversed_at` + cria registros de reversão para profissionais, valores negativos)
  - `client_credit_movements` se houver débito (cria entrada de crédito de volta)

  Itens da comanda voltam a ser editáveis. Fechar de novo gera novos snapshots.

### Pagamento — Métodos e Crédito de Cliente

- **D-09:** **5 métodos de pagamento no MVP**: Dinheiro, Pix, Cartão de Crédito, Cartão de Débito, Transferência. **Voucher/vale-presente fica fora** — implica fluxo de emissão de crédito da org que adiciona scope desnecessário. Todos os 5 são **registro manual** (atendente confirma "recebido via X"). Schema: `payment_methods` enum + `comanda_payments` table com (method, amount, paid_at, member_id).

- **D-10:** **Pix QR real adiado para Phase 5**. MVP usa Pix por confirmação manual (cliente paga pelo próprio app, atendente marca "Pix R$X"). Integração com Pagar.me/Stripe Connect + webhooks + business verification fica junto com WhatsApp Business API integration da Phase 5 — ambos requerem onboarding com providers externos que tomam 2-4 semanas.

- **D-11:** **Crédito de cliente é gerenciado** via tabela `client_credit_movements`:
  - Origem: sinal de agendamento cancelado (D-15), ajuste manual pelo gerente (em `/financeiro/credito-cliente`), reembolso de comanda reaberta
  - Consumo: método "Crédito" no fechamento de comanda — atendente debita parcial ou total
  - Saldo do cliente = `SUM(amount)` de todos movimentos (entradas positivas, saídas negativas)
  - Validação no service: não permitir saldo negativo
  - UI: tela `/financeiro/credito-cliente` (já mockada) lista clientes com saldo > 0 + botão "Incluir Crédito"

### Financeiro — Cálculo de Comissão e Dashboard

- **D-12:** **Cálculo de comissão é síncrono ao fechar comanda**. Quando atendente clica "Fechar comanda" e `pago >= total`, na mesma transação:
  1. Atualiza `comanda.status = fechada` + `closed_at = now()`
  2. Aplica regras de comissão de Phase 2 (precedência: member_service > service > category > product > default)
  3. Cria 1 row em `commission_records` por item-comissionado
  4. Decrementa `product.stock_quantity` para itens type='product' + cria `stock_movements` type='sale'
  5. Debita `client_credit_movements` se método "Crédito" foi usado

  Se qualquer passo falhar, transação rola atrás — nada é parcialmente persistido. Atendente vê erro e pode corrigir.

- **D-13:** **1 profissional por item** (single, não rateio). Cada `comanda_item` tem `professional_id` único — quem realizou serviço ou vendeu produto. Comissão vai 100% para esse profissional. Padrão alinha com modelo de regras Phase 2 (`commission_rule.member_id`). Rateio split (múltiplos profissionais por % no mesmo item) fica para v2 se demanda real aparecer.

- **D-14:** **Snapshot imutável em `commission_records`** com regra completa em JSONB:
  ```
  {
    id, organization_id, comanda_id, comanda_item_id, member_id,
    base_amount,                  -- valor bruto do item (cents)
    rule_kind,                    -- 'fixed' | 'percentage'
    rule_value,                   -- decimal(5,2) ou cents
    rule_snapshot (JSONB),        -- regra completa no momento (id, kind, value, scope)
    calculated_amount,            -- valor final em cents
    calculated_at,                -- timestamp
    reversed_at (nullable),       -- preenchido se comanda for reaberta
    reversed_by_record_id (nullable) -- aponta para record de reversão
  }
  ```

  Imutabilidade: nenhum UPDATE — só INSERT (records de reversão são novos rows). Permite auditoria contábil completa mesmo se regra for editada depois.

- **D-15:** **Cancelamento de agendamento exige motivo**. Modal de cancelar tem campo "Motivo" obrigatório (free text + tags pré-definidas: "cliente desmarcou", "profissional doente", "no-show"). Se agendamento tinha sinal:
  - Status `cancelled` → cria `client_credit_movements` entrada (positiva, saldo do cliente)
  - Cliente pode usar saldo em outro agendamento ou ser reembolsado por ajuste manual
  - Política de retenção (cancelar com X horas de antecedência reembolsa só Y%) **fica para Phase 4** com contratos de noivas

  Sem sinal: só atualiza status e libera horário.

### Dashboard Financeiro

- **D-16:** **Filtros: presets + date range customizado**. Atalhos rápidos: Hoje / Ontem / Esta semana / Mês atual / Mês anterior. Botão "Personalizado" abre date range picker. Padrão é "Mês atual". Cobre 90% dos casos com 1 clique.

- **D-17:** **Query direta sem view materializada**. Schema `cash_movements` + `comanda_payments` + `commission_records` agregados via SQL on-demand. Para escala Ano 1 (250 orgs × ~30 vendas/dia = 7500 rows/dia/org), agregação direta é rápida. View materializada só se queries lentas aparecerem em load testing.

### Visões do Calendário e Numeração

- **D-18:** **Vista padrão = Dia** (colunas por profissional, mockup atual). Vista "Semana" disponível via toggle no top-bar — mostra 5-7 colunas (segunda-domingo) com cards de agendamentos por dia, sem detalhe de profissional. Vista mensal NÃO está em scope (over-engineering).

- **D-19:** **Comanda com código curto legível** sequencial por org: `C-2026-001`, `C-2026-002`, etc. Reset anual. Geração via sequence Postgres por org (ou função). UUID interno permanece para chaves estrangeiras; código curto é apresentação. Útil para impressão e busca.

### Permissões POS

- **D-20:** **Permissões granulares no POS**:
  - `ATTENDANT`: CRUD completo de agendamento + comanda. Pode adicionar itens, registrar pagamento, fechar comanda
  - `PROFESSIONAL`: read-only de **suas** comandas (`WHERE professional_id = self`) + suas comissões em `/financeiro/comissoes` (filtro forçado em backend pela `RequirePermission` policy)
  - `MANAGER`: tudo de ATTENDANT + reabrir comandas + ajustar crédito de cliente + relatórios completos
  - `ADMIN`: tudo de MANAGER + alterar regras de comissão + cancelar agendamentos com sinal sem motivo

  Decorators novos: `@RequirePermission('comanda.create' | 'comanda.close' | 'comanda.reopen' | 'commission.adjust' | 'credit.adjust')`

### Estoque (Phase 2 pending → completed em Phase 3)

- **D-21:** **Decremento de estoque ao fechar comanda**. Phase 2 deixou pending: `stock_movements` type='sale' não é criado em nenhum fluxo. Phase 3 implementa:
  - Trigger no `closeComanda` mutation: para cada `comanda_item` type='product', cria `stock_movements` (delta = -quantity, type='sale', reference_id=comanda_id) e atualiza `product.stock_quantity` na mesma transação
  - Badge na sidebar (`lowStockCount` query, polling 60s) — **já implementado**, só ganha dados reais
  - Notification center (entrada em `notifications` quando produto cai abaixo do mínimo) — **adiado para Phase 5** junto com WhatsApp/email alerts

### Claude's Discretion

Áreas onde o usuário delegou decisão técnica ao Claude no planning/implementação:
- **Calendar component**: usar lib (FullCalendar/Mantine) vs custom. Mockup atual usa custom — manter se atender drag-drop nativo aceitável; senão, mudar para FullCalendar com plugin DnD
- **Conflict detection UX em tempo real**: ao arrastar card, mostrar overlay vermelho nos slots já ocupados — Claude decide se vale o overhead ou só validar no drop
- **Sequence de código de comanda**: Postgres SEQUENCE por org vs função custom — Claude decide
- **Batch insert de commission_records**: 1 INSERT múltiplo vs N inserts — perf decision baseada em volume real
- **Schema do `audit_log`** (para reabertura de comanda): tabela genérica vs específica — Claude decide
- **Vista semana** layout exato — colunas dom-sáb com cards minimal ou só lista de "agendamentos da semana"

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRDs do Projeto (raiz do repositório)
- `PRD_Backend_Plataforma_Saloes.md` — Bounded contexts (operations, financial), eventos de domínio (`comanda.fechada`, `agendamento.criado`, `agendamento.cancelado`), Outbox Pattern para events
- `PRD_Banco_Dados_Plataforma_Saloes_v1.1.md` §calendar §comanda §financeiro — Schema appointments, time_blocks, comandas, comanda_items, comanda_payments, commission_records, client_credit_movements, advisory lock pattern
- `PRD_Frontend_Plataforma_Saloes.md` §agenda §POS §financeiro — Componentes, fluxos, estados de UI
- `SDD_Plataforma_Saloes_v1.1.md` §3 §5 — Decisões de scheduling, payment provider abstraction (mesmo que MVP seja manual)

### Pesquisa do Projeto
- `.planning/research/STACK.md` — Validação de gateway de pagamento (Pagar.me vs Stripe Connect — adiado para Phase 5)
- `.planning/research/PITFALLS.md` — Advisory lock + transaction-mode PgBouncer compatibility, RLS pitfalls de SET vs SET LOCAL

### Phase Anterior (decisões herdadas)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Stack versions (Node 22, Prisma 6, Valkey 8), bounded context pattern, RLS + RBAC infrastructure
- `.planning/phases/02-core-domain/02-CONTEXT.md` — `commission_rules` schema com escopo, `stock_movements` table, `Member.seniorityTier`, `service.pricing_variants[]`, currency em cents

### Mockups validados (Phase 3)
- `apps/frontend/src/features/operations/pages/SchedulePage.tsx` — UI de Agenda com sidebar de filtros, modal "Cadastrar Agendamento", layout 1-prof-por-coluna
- `apps/frontend/src/features/operations/pages/ComandaPage.tsx` — Layout do POS
- `apps/frontend/src/features/operations/pages/FinanceiroPage.tsx` — Controle de entrada e saída
- `apps/frontend/src/features/operations/pages/FinancialSubPages.tsx` — Caixa, Pagamento de Profissionais (5 abas), Despesas, Crédito de cliente, Motivos de desconto
- `apps/frontend/src/features/operations/components/FinancialReportLayout.tsx` — Filter bar reutilizável + tabs

### Design System (Trinks-style adaptado)
- `apps/frontend/src/components/layout/menu-config.ts` — Hierarquia de navegação (Financeiro tem 13 sub-itens)
- `apps/frontend/src/components/layout/AppShell.tsx` + `IconRail.tsx` + `TopHeader.tsx` — Shell pattern
- `apps/frontend/tailwind.config.ts` — Primary `#570080`, escala completa
- `apps/frontend/src/styles/globals.css` — CSS vars do design system
- `apps/frontend/src/features/catalog/utils/currency-mask.ts` — `maskCurrency` / `unmaskCurrency` (BRL ↔ backend "1500.00")

### Requisitos
- `.planning/REQUIREMENTS.md` §SCHED §POS §FIN — SCHED-01..04, POS-01..03, FIN-01..02 cobertos por esta phase

### Memory persistente
- `C:\Users\CBYK-DEV\.claude\projects\d--SGS\memory\feedback_input_masks.md` — Toda input de valor/data/hora/% nasce com máscara BR (não retrofit)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**Backend (já em apps/backend/src/):**
- `auth/` — JWT + refresh token rotation, `RequirePermission` decorator
- `authz/` — Guards e CASL policies, `TenantContextInterceptor`, `runWithTenant`
- `database/` — `TenantPrismaClient`, `runWithTenant` helper, RLS + advisory lock helpers
- `catalog/` — `services`, `packages`, `products`, `categories`, `commissions`, `notifications` modules. Phase 3 importa `services`, `products`, `commissions` para resolver agendamento+comanda
- `clients/` — `clients.service.ts` + `cpf.util.ts`. Phase 3 importa para validar cliente em comanda + walk-in
- `email/` — `EmailService` + `EMAIL_ADAPTER` token. Phase 3 não consome (notificações ficam para Phase 5)
- `queue/` — BullMQ infrastructure já configurada (Phase 1). Phase 3 NÃO usa (cálculo síncrono D-12), mas existe se precisar virar async depois

**Frontend (já em apps/frontend/src/):**
- `features/operations/pages/*.tsx` — Mockups completos com layouts validados pelo usuário. Phase 3 substitui dados mockados por queries reais GraphQL, mantém estrutura visual
- `features/operations/mocks/*.ts` — Estruturas de tipo úteis (MockAppointment, MockComanda, MockComandaItem) servem como base para tipos GraphQL
- `features/operations/components/FinancialReportLayout.tsx` — Reutilizável para todas as páginas /financeiro/*
- `features/catalog/utils/currency-mask.ts` — Já usada em catalog forms; reusar em comanda + financeiro
- `components/ui/*` — DataTable, Dialog, Sheet, Tooltip, RadioGroup, Select, Combobox, Card, Badge, Button (com variants default/destructive/outline/ghost/secondary), Tabs, Form, Skeleton — todos disponíveis
- `infrastructure/i18n/locales/pt-BR.json` — `operations.schedule.*`, `operations.pos.*`, `operations.financial.*`, `operations.commissions.*` já populados pelos mockups

**Tooling:**
- `prisma/migrations/` — 4 migrations existentes (init+permissions+phase2+phase2 permissions). Phase 3 cria 1-2 novas (operations + permissions de POS)
- `apps/backend/test/integration/` — pattern de e2e tests com TestPrismaClient e fixture loaders
- `apps/frontend/codegen.ts` — GraphQL codegen configurado, types auto-gerados em `infrastructure/graphql/generated/`

### Established Patterns

- **Bounded context = pasta**: `apps/backend/src/{auth, catalog, clients, ...}/` — Phase 3 cria `apps/backend/src/operations/` + `apps/backend/src/financial/` (separar agenda/POS de cálculo de comissão/dashboard)
- **module + service + resolver + DTOs**: Cada bounded context segue o pattern de Phase 1+2 — `operations/scheduling/{module,service,resolver,dto}.ts`, `operations/comandas/{...}`, etc.
- **GraphQL schema-first com SDL**: Cada feature declara seu fragmento `.graphql` em `apps/backend/src/graphql/schema/`. Phase 3 adiciona `scheduling.graphql`, `comandas.graphql`, `financial.graphql`
- **Currency em cents (int)** no backend, máscara BR no frontend (D-07 phase 2 confirmou)
- **RLS forced em todas as tabelas tenant-scoped**: Phase 3 segue (todas as tabelas de operations têm `organization_id`)
- **`runWithTenant`** para abrir transação com `SET LOCAL app.current_tenant_id` — usado em todo service que toca DB
- **PageHeader + breadcrumbs** em toda página: `<PageHeader title="..." breadcrumbs={[{label:"X"},{label:"Y"}]} />`
- **FilterBar component** para listas com filtros básicos + Mais filtros colapsável + Limpar/Exportar (em `components/layout/FilterBar.tsx`)
- **Tríptico (Lista filtrável → Ficha → Form)** em todos os módulos administrativos
- **Memory rule** (input masks): currency, date, time, %, CPF, phone — sempre com máscara BR desde a primeira implementação

### Integration Points

- **Agendamento ↔ Comanda**: D-05 cria comanda automaticamente — service `appointments.service.ts` chama `comandas.service.ts` na mesma transação
- **Comanda → Stock**: D-21 — close comanda chama `products.service.adjustStock(productId, -quantity, 'sale')` da Phase 2
- **Comanda → CommissionRecords**: D-12, D-14 — close comanda chama novo `commissions.service.calculateForComanda(comandaId)` (Phase 3 implementa)
- **Comanda → ClientCredit**: D-11 — método "Crédito" no fechamento debita `client_credit_movements`; comanda reaberta crédita de volta
- **Agendamento cancelado → ClientCredit**: D-15 — service de cancel cria entrada positiva em `client_credit_movements`
- **Frontend Schedule UI ↔ Backend**: GraphQL queries `appointments(filters)`, `members(role:'PROFESSIONAL')`, `services()`, `timeBlocks(filters)`. Mutations `createAppointment`, `moveAppointment`, `cancelAppointment`, `createTimeBlock`
- **Frontend Comanda UI ↔ Backend**: Queries `comanda(id)`, `comandasByDate(date)`. Mutations `addComandaItem`, `removeComandaItem`, `addComandaPayment`, `removeComandaPayment`, `closeComanda`, `reopenComanda`
- **Frontend Financeiro UI ↔ Backend**: Queries `financialSummary(periodStart, periodEnd)`, `commissionRecords(memberId, period)`, `cashMovements(period)`, `clientCreditBalance(clientId)`

</code_context>

<specifics>
## Specific Ideas

- **Comanda abre com agendamento** (D-05): inspiração veio do fluxo real do salão — cliente compra um pacote ou define os serviços junto com o agendamento, e a comanda já existe acumulando os itens. Não há "iniciar atendimento" como um clique extra; quando o atendimento começa fisicamente, a comanda já tá lá pronta para receber produtos vendidos durante o serviço.

- **Mockups Trinks-style já validados**: o usuário aprovou o layout de SchedulePage (avatares por profissional, sidebar com filtros, modal cadastrar agendamento), ComandaPage, FinanceiroPage. **Phase 3 mantém o visual e substitui dados mockados por GraphQL real.**

- **Pix manual no MVP** (D-10): pragmatismo — gateway integration adiciona 30-50% de scope (Pagar.me onboarding + webhooks + business verification). User explicitamente preferiu MVP enxuta. Phase 5 vai integrar ambos (Pix real + WhatsApp) em um único onboarding bloco.

- **Memory rule de máscaras** já vale: toda input de valor (R$), data (dd/mm/aaaa), hora (HH:mm), CPF, telefone deve nascer com máscara BR. Existe `currency-mask.ts` com helpers (`maskCurrency`, `unmaskCurrency`, `formatCurrencyDisplay`, `maskPercentage`, `unmaskPercentage`) já usado em ServicoForm/PacoteForm/ProdutoForm/CommissionRuleForm. Phase 3 reusa.

- **Não regredir o design system**: o usuário pediu para manter o design system SGS (`#570080` primary, `<Button>` defaults, `PageHeader` + breadcrumbs) e NÃO copiar 1:1 as cores Trinks (laranja/coral). Mockups das sub-páginas financeiras já foram corrigidos. Phase 3 segue o mesmo padrão.

</specifics>

<deferred>
## Deferred Ideas

Ideias que apareceram durante a discussão mas pertencem a outras phases ou v2:

- **Pix QR via gateway real** → Phase 5 (junto com WhatsApp Business API onboarding)
- **Voucher/vale-presente** como método de pagamento → v2 se demanda real aparecer
- **Caixa formal com abertura/fechamento** (POS-04) → "Adicionais/Futuro" no REQUIREMENTS
- **Previsão financeira 30 dias** (FIN-03) → Phase 5
- **Política de cancelamento configurável** (regras de retenção de % por antecedência) → Phase 4 com contratos de noivas (CONT-03)
- **WhatsApp 2-way** (cliente confirma/cancela via mensagem → comanda) → Phase 5 (COMM-03)
- **Recorrência em bloqueios de horário** (toda terça às 14h) → v2 se solicitado
- **Rateio split de comissão** (múltiplos profissionais por % no mesmo item) → v2 se demanda real aparecer
- **Vista mensal do calendar** → over-engineering, fora de scope
- **View materializada para dashboard** → só se load testing identificar gargalo
- **Notification center** com alertas de estoque baixo → Phase 5 com email/WhatsApp
- **Código de comanda customizável por org** (Configurações) → v2
- **Comanda anônima** (sem cliente associado) → rejeitado em D-06, exige cliente mínimo

</deferred>

---

*Phase: 03-core-operations*
*Context gathered: 2026-05-07*

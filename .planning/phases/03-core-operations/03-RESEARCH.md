# Phase 3: Core Operations - Research

**Researched:** 2026-11-01
**Domain:** Agenda concorrente (PostgreSQL advisory lock + exclusion constraint), POS/comanda transacional, comissão com snapshot imutável, dashboard financeiro (SQL direto), calendário React com drag-and-drop
**Confidence:** HIGH para banco/concorrência (verificado empiricamente no Postgres 16.13 local, via PgBouncer) e para o inventário do código; MEDIUM para o comportamento exato dos códigos de erro do Prisma e para a decisão de contabilização da receita (confirmar com o dono do produto)

<user_constraints>
## User Constraints (from CONTEXT.md)

> Copiado de `03-CONTEXT.md` (gathered 2026-05-07). D-01..D-21 são decisões travadas. Onde o código atual (Phase 2/2.1) contradiz uma decisão, isso está em "Discrepâncias CONTEXT x código" abaixo, com a adaptação recomendada.

### Locked Decisions

**Agenda — Concorrência, Bloqueios e Drag-and-drop**

- **D-01:** **Postgres advisory lock** previne double-booking. Toda operação de criar/mover agendamento abre transação e chama `pg_advisory_xact_lock(hashtext(organization_id || ':' || professional_id || ':' || slot_start))` antes do insert/update. Lock libera no commit/rollback. UI: botão "Salvar" mostra loading; se falhar com SQLSTATE 55P03 (lock timeout) ou validação de overlap, mostra toast "Horário já reservado por outra pessoa — escolha outro slot".
- **D-02:** **4 tipos de bloqueio** em tabela `time_blocks` com campo `kind` enum: `folga` (dia inteiro sem trabalho do profissional), `intervalo` (pausa curta), `feriado` (org-wide, todos os profissionais), `indisponibilidade` (médico, compromisso pessoal). Cada um tem cor distinta na UI da agenda. Recorrência **fica para v2** — MVP só bloqueio único.
- **D-03:** **Sinal/depósito é registro manual** no MVP (SCHED-04). Modal "Cadastrar Agendamento" tem campo "Sinal recebido (R$)" + select de método (qualquer um dos 5). Não gera QR. Sinal entra como **crédito do cliente** (`client_credit_movements`) e é debitado quando a comanda do agendamento é fechada (ou liberado se cancelar — D-15).
- **D-04:** **Drag-and-drop otimista com revert**. Card muda imediatamente; mutation roda em background. Se o servidor retornar erro (lock falha, fora-expediente, profissional bloqueado), card volta + toast "Não foi possível mover: [motivo]". Padrão Google Calendar.

**Comanda — Abertura, Walk-in, Pagamento, Reabertura**

- **D-05:** **Comanda abre automaticamente ao criar agendamento** (1 ou múltiplos serviços, possivelmente de um pacote), no mesmo evento, pré-populada com os serviços agendados. Status inicial `aberta`. Itens podem ser adicionados/removidos (produtos vendidos, serviços extras). Ciclo de vida acoplado: `scheduled` → comanda aberta; `em_atendimento` → aberta; `concluido` → comanda segue aberta até fechamento financeiro; `cancelled` → comanda cancelled.
- **D-06:** **Walk-in com cliente mínimo**: "+ Nova comanda" sem agendamento; escolher cliente existente OU cadastrar novo com **só nome + telefone opcional** no mesmo modal. Não requer CPF.
- **D-07:** **Pagamento dividido com troco automático**: `pago = soma(parciais)`, `falta = total - pago`, `troco = pago - total`. Comanda fecha quando `pago >= total`. Troco em dinheiro é registrado como saída em `cash_movements`.
- **D-08:** **Reabertura só por ADMIN/MANAGER, com motivo obrigatório**. ATTENDANT não tem `comanda.reopen`. Cria entrada em `audit_log` com motivo. Reverte: `stock_movements` (type='return' compensando 'sale'), `commission_records` (marca `reversed_at` + registros de reversão com valores negativos), `client_credit_movements` (crédito de volta). Itens voltam a ser editáveis; fechar de novo gera novos snapshots.

**Pagamento — Métodos e Crédito de Cliente**

- **D-09:** **5 métodos no MVP**: Dinheiro, Pix, Cartão de Crédito, Cartão de Débito, Transferência. **Voucher fora.** Todos são **registro manual**. Schema: enum de métodos + `comanda_payments` (method, amount, paid_at, member_id).
- **D-10:** **Pix QR real adiado para Phase 5.** MVP usa Pix por confirmação manual.
- **D-11:** **Crédito de cliente** via `client_credit_movements`: origem = sinal de agendamento cancelado (D-15), ajuste manual pelo gerente (`/financeiro/credito-cliente`), reembolso de comanda reaberta. Consumo = método "Crédito" no fechamento. Saldo = `SUM(amount)`. Validação no service: não permitir saldo negativo. UI: tela `/financeiro/credito-cliente` (já mockada) lista clientes com saldo > 0 + botão "Incluir Crédito".

**Financeiro — Cálculo de Comissão e Dashboard**

- **D-12:** **Cálculo de comissão síncrono ao fechar comanda**, na mesma transação: (1) `comanda.status = fechada` + `closed_at`; (2) aplica regras de comissão Phase 2 (precedência member_service > service > category > product > default); (3) 1 row em `commission_records` por item comissionado; (4) decrementa `product.stock_quantity` + `stock_movements` type='sale'; (5) debita `client_credit_movements` se método "Crédito". Qualquer falha dá rollback total.
- **D-13:** **1 profissional por item** (sem rateio). Comissão 100% para `comanda_item.professional_id`.
- **D-14:** **Snapshot imutável em `commission_records`** (id, organization_id, comanda_id, comanda_item_id, member_id, base_amount, rule_kind, rule_value, rule_snapshot JSONB, calculated_amount, calculated_at, reversed_at, reversed_by_record_id). Imutabilidade: nenhum UPDATE — só INSERT (reversões são novos rows).
- **D-15:** **Cancelamento de agendamento exige motivo** (free text + tags: "cliente desmarcou", "profissional doente", "no-show"). Com sinal: status `cancelled` → cria `client_credit_movements` positivo. Política de retenção por antecedência fica para Phase 4. Sem sinal: só atualiza status e libera horário.

**Dashboard Financeiro**

- **D-16:** Presets (Hoje / Ontem / Esta semana / Mês atual / Mês anterior) + "Personalizado" (date range picker). Padrão "Mês atual".
- **D-17:** **Query direta sem view materializada** (`cash_movements` + `comanda_payments` + `commission_records` agregados on-demand).

**Visões do Calendário e Numeração**

- **D-18:** Vista padrão = **Dia** (colunas por profissional). **Semana** via toggle (5-7 colunas segunda-domingo, cards por dia, sem detalhe de profissional). Vista mensal fora de escopo.
- **D-19:** Código curto sequencial por org: `C-2026-001`, reset anual. UUID interno permanece nas FKs.

**Permissões POS**

- **D-20:** `ATTENDANT`: CRUD completo de agendamento + comanda (itens, pagamento, fechar). `PROFESSIONAL`: read-only das **suas** comandas (`professional_id = self`) + suas comissões em `/financeiro/comissoes` (filtro forçado no backend). `MANAGER`: tudo de ATTENDANT + reabrir comandas + ajustar crédito + relatórios completos. `ADMIN`: tudo de MANAGER + alterar regras de comissão + cancelar agendamentos com sinal sem motivo. Decorators: `@RequirePermission('comanda.create' | 'comanda.close' | 'comanda.reopen' | 'commission.adjust' | 'credit.adjust')`.

**Estoque**

- **D-21:** Decremento de estoque ao fechar comanda (`stock_movements` type='sale', delta=-quantity, reference_id=comanda_id; atualiza `product.stock_quantity` na mesma transação). Badge `lowStockCount` já implementado. Notification center adiado para Phase 5.

### Claude's Discretion

- **Calendar component**: usar lib (FullCalendar/Mantine) vs custom. Mockup atual usa custom — manter se atender drag-drop nativo aceitável; senão, mudar para FullCalendar com plugin DnD
- **Conflict detection UX em tempo real**: overlay vermelho nos slots ocupados durante o drag vs só validar no drop
- **Sequence de código de comanda**: Postgres SEQUENCE por org vs função custom
- **Batch insert de commission_records**: 1 INSERT múltiplo vs N inserts
- **Schema do `audit_log`**: tabela genérica vs específica
- **Vista semana** layout exato — colunas dom-sáb com cards minimal ou só lista

### Deferred Ideas (OUT OF SCOPE)

- Pix QR via gateway real → Phase 5
- Voucher/vale-presente → v2
- Caixa formal com abertura/fechamento (POS-04)
- Previsão financeira 30 dias (FIN-03) → Phase 5
- Política de cancelamento configurável (retenção %) → Phase 4
- WhatsApp 2-way → Phase 5 (COMM-03)
- Recorrência em bloqueios de horário → v2
- Rateio split de comissão → v2
- Vista mensal do calendar → fora de escopo
- View materializada para dashboard → só se load testing apontar gargalo
- Notification center com alertas de estoque baixo → Phase 5
- Código de comanda customizável por org → v2
- Comanda anônima (sem cliente) → rejeitado em D-06
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHED-01 | Calendário com raias por profissional (dia/semana), protegido contra double-booking via advisory lock | Lock por profissional + `lock_timeout` + exclusion constraint já existente (precisa ter o predicado alargado); grade custom já existe em `SchedulePage.tsx`; vista semana (D-18) |
| SCHED-02 | Criar agendamentos e mover via drag-and-drop | `updateAppointment`/`moveAppointment` sob o mesmo lock; `@dnd-kit/core` 6.3.1 sobre a grade atual; Apollo `optimisticResponse` com revert automático |
| SCHED-03 | Bloqueios de horário (intervalos, feriados, indisponibilidade) | Tabela `time_blocks` (4 kinds), checados dentro do mesmo lock; feriado org-wide via lock compartilhado/exclusivo em duas camadas |
| SCHED-04 | Sinal/depósito ao criar agendamento, com rastreamento do valor pré-pago | `client_credit_movements` (kind=deposit, ligado ao appointment) + `cash_movements` (deposit_in); pré-preenche linha "Crédito" no fechamento |
| POS-01 | Comanda acumulando serviços e produtos | `comandas` + `comanda_items`; abertura atômica com o agendamento; código `C-AAAA-NNN` via tabela contador; pacote expandido em itens |
| POS-02 | Pagamento com múltiplos métodos (dinheiro, Pix, cartão crédito/débito, transferência, crédito na conta) | `comanda_payments`; 5 métodos + `client_credit`. **Pix QR e voucher fora (D-09/D-10) — redução de escopo aceita, ver abaixo** |
| POS-03 | Dividir total em pagamentos parciais de métodos diferentes | N linhas em `comanda_payments`, troco calculado, validação `pago >= total` no fechamento |
| FIN-01 | Dashboard financeiro com receita por dia/semana/mês e breakdown por método | SQL direto com `AT TIME ZONE` da org, `generate_series` para dias vazios, Recharts (com ajuste de `react-is`) |
| FIN-02 | Comissões automáticas por profissional ao fechar comanda, snapshot imutável | Resolver puro de regra + `commission_records` insert-only (REVOKE UPDATE/DELETE) + reversão por novo registro |

**Redução de escopo aceita (POS-02):** o texto do ROADMAP/REQUIREMENTS lista "Pix (QR code)" e "voucher". D-09/D-10 cortaram Pix QR (vira registro manual de Pix) e voucher. Deve constar no VERIFICATION como desvio aceito, e o planner deve ajustar o texto de POS-02 em `REQUIREMENTS.md`/`ROADMAP.md` (ou registrar a nota) para o verificador não reprovar a fase por isso.
</phase_requirements>

## Summary

A fase é maior no banco/transação do que em bibliotecas: **não há dependência nova de backend**. O backend já tem tudo (Prisma 6.x, Nest 10, graphql schema-first). O que falta é **modelagem + transações corretas**. No frontend, a única dependência nova recomendada é `@dnd-kit/core` (+ `@dnd-kit/modifiers`); a grade custom da `SchedulePage` já existe e fica.

**Achados que mudam o plano** (todos verificados no código/DB; detalhes em "Discrepâncias"):
1. A tabela `appointments` **já tem** exclusion constraint (`btree_gist` + `tstzrange`), mas o predicado é `status IN ('scheduled','confirmed')` — um agendamento `in_progress`/`completed` **sai da proteção**. A migration da fase precisa recriar a constraint e alargar o CHECK de status.
2. O `appointments` é **um serviço por linha**, sem `comanda_id`, sem variante de preço, sem sinal. O "agendamento com vários serviços" de D-05 deve ser modelado como **N appointments (um por serviço/raia) ligados à mesma comanda** — encaixa com a constraint por profissional e com "1 profissional por item" (D-13).
3. D-01 (hash de `slot_start`) **não protege sobreposição parcial** (10:00–11:00 vs 10:30–11:30 têm chaves diferentes). Usar **lock por profissional** (`org:professional`), não por slot. Como a exclusion constraint já cobre appointments x appointments, o lock serve para (a) cobrir `time_blocks`, que a constraint não alcança, e (b) dar erro determinístico e rápido (`lock_timeout`) em vez de bloquear até o outro commit.
4. Dinheiro: o CONTEXT diz "cents", mas o código real da Phase 2 usa **`Decimal(12,2)` com strings "80.00" no GraphQL**. Seguir o código (Decimal(12,2)), calculando em centavos inteiros dentro do service (padrão já usado em `packages`).
5. **Não existem** no repo: helper de advisory lock, `audit_log`, `commissions.service.calculateForComanda`, função de resolução de regra de comissão, nem um `adjustStock` reutilizável dentro de uma transação (ele abre o próprio `runWithTenant`). Tudo isso é trabalho novo desta fase.
6. D-14 é auto-contraditório (diz "nenhum UPDATE" mas lista `reversed_at`/`reversed_by_record_id` preenchidos depois). Resolver com **reversão = novo registro `kind='reversal'`** apontando para o original; "estornado?" é derivado, nunca gravado.

**Primary recommendation:** Uma migration consolidada (como na Phase 2) cria todo o schema + permissões; backend em `src/appointments/` (estendido), `src/comandas/` e `src/financial/` (pastas planas, como o resto do repo — não `src/operations/`); `closeComanda`/`reopenComanda` como **uma única `runWithTenant`** com `SELECT ... FOR UPDATE` na comanda; frontend troca mocks por Apollo (padrão `gql` manual, sem codegen) e liga cada flag no mesmo commit em que a tela passa a ler dado real.

## Discrepâncias CONTEXT x código (ler antes de planejar)

| # | CONTEXT diz | Código real (verificado) | Adaptação recomendada |
|---|-------------|--------------------------|------------------------|
| 1 | Moeda em **cents (int)** (D-12 "padrão", D-14) | `services.base_price`, `products.sale_price`, `packages.price`, `commission_rules.value`: **`DECIMAL(12,2)`/`(12,4)`**; GraphQL expõe **`String` "80.00"**; `currency-mask.ts` devolve `"50.00"`. Só os `mocks/*.ts` usam cents | Novas tabelas: `NUMERIC(12,2)` (Prisma `Decimal @db.Decimal(12,2)`), GraphQL `String`. Somar/ratear em **centavos inteiros** no service (helper `toCents`/`fromCents`), como `packages` já faz. `formatBRL(cents)` dos mocks é descartado/reescrito para string decimal |
| 2 | `src/operations/scheduling/...` + `src/financial/` | Backend é **plano**: `src/appointments/`, `src/clients/`, `src/catalog/`, `src/identity/` | Estender `src/appointments/` (agenda + time blocks); criar `src/comandas/` e `src/financial/`. SDL novo em `src/graphql/schema/` (`comandas.graphql`, `financial.graphql`; time blocks vai em `appointments.graphql`). Não mover `appointments` |
| 3 | "`database/` — RLS + advisory lock helpers" | `database/` só tem `TenantContextService` (`runWithTenant`/`runWithoutTenant`), `PrismaService`, `uuidv7`. **Sem helper de advisory lock** | Criar `src/database/advisory-lock.ts` (ver Code Examples) |
| 4 | `SET LOCAL app.current_tenant_id` | O nome real é **`app.current_organization`** (policies: `nullif(current_setting('app.current_organization', true),'')::uuid`) | Usar `runWithTenant`; toda tabela nova copia a policy `tenant_isolation` do `appointments` |
| 5 | `commissions.service.calculateForComanda` "Phase 3 implementa" / "regras de Phase 2" | `CommissionsService` é só CRUD + `validateScopeShape`. **Não existe resolução** de regra | Escrever `resolveCommissionRule()` **puro** (unit-testável) em `src/financial/commission-resolver.ts` |
| 6 | `products.service.adjustStock(productId,-qty,'sale')` | `adjustStock` abre **o próprio `runWithTenant`** (transação aninhada = perde atomicidade com o fechamento), grava `type:'manual_adjustment'`, recusa negativo, cria notificação `stock_low` inline | Extrair `applyStockDelta(tx, {orgId, productId, delta, type, reason, performedBy, referenceId})` (recebe `tx`), `adjustStock` passa a chamá-la. `stock_movements` **não tem coluna `reference_id`** → migration adiciona `comanda_id uuid NULL` (+ `type` é VARCHAR sem CHECK; usar `'sale'`/`'return'`) |
| 7 | `audit_log` (D-08) | **Não existe** tabela de auditoria (grep nas migrations: zero) | Criar `audit_log` genérica, insert-only (decisão de discrição: genérica) |
| 8 | Permissões `comanda.create`, `commission.adjust`, `credit.adjust`; "agenda.*" no briefing | Catálogo atual: `appointment.read/write` (já existem), `commission.read/write`, `client.*`. PermissionGuard lê **`role_permissions` no DB** (papéis `is_system`) — o catálogo TS e a migration SQL de seed são duas fontes que precisam andar juntas | Ver "Catálogo de permissões" abaixo. Não renomear `appointment.*` |
| 9 | "Agendamento com 1 ou múltiplos serviços, possivelmente de um pacote" | `appointments.service_id` único; sem `comanda_id`/variante/sinal | Modelo "visita = comanda; cada serviço = 1 appointment" (ver Architecture) |
| 10 | Status `em_atendimento`, `no-show` | CHECK atual: `scheduled, confirmed, completed, cancelled`. Nomes em **inglês** no código | Adicionar `in_progress`, `no_show` ao CHECK; **status em inglês** (`open/closed/cancelled` na comanda). `SchedulePage` já usa `in_progress` nos mocks |
| 11 | "Frontend React 18" (CLAUDE.md) | `apps/frontend/package.json`: **React 19.2.5**, Vite 6, react-router-dom 7, Recharts 2.15.4 | Escolher libs compatíveis com React 19 (dnd-kit core 6.3.1 declara `react >=16.8` ✓) |
| 12 | `codegen` "tipos auto-gerados" | Telas existentes usam `gql` manual (`appointments.api.ts`, `members.api.ts`); STATE: "manual gql templates, codegen deferred" | Seguir o padrão manual: `features/operations/api/*.api.ts` com interfaces TS à mão |
| 13 | D-14 imutável **e** `reversed_at` atualizável | Contradição interna | Reversão = novo row; sem colunas `reversed_*` (ver Pattern 5) |
| 14 | D-20: ADMIN "cancela agendamento com sinal sem motivo" vs D-15 "motivo obrigatório" | Conflito leve | Exigir motivo sempre (mais simples, auditável); registrar como desvio menor |
| 15 | Mockups com "business hours" / "fora de expediente" (D-04) | Não há `business_hours` (está em M2 do ROADMAP-MOCKS, não nos decisions da Phase 3). `SchedulePage` usa constantes `WORK_START_HOUR/WORK_END_HOUR` | **Não construir business_hours nesta fase** (ver Open Questions #3). "Fora do expediente" fica só visual |

## Standard Stack

### Core (já no repo — sem novas dependências de backend)

| Library | Versão no repo | Purpose | Observação |
|---------|----------------|---------|------------|
| NestJS | ^10.4.15 | módulos/resolvers | schema-first (`*.graphql` em `src/graphql/schema/`) |
| Prisma | ^6.3.1 | ORM + `$queryRaw`/`$executeRaw` p/ lock e agregações | interactive transactions via `TenantContextService.runWithTenant` |
| PostgreSQL | 16.13 (local) | RLS, `btree_gist`, `pg_advisory_xact_lock` | verificado: `SHOW lock_timeout`, advisory lock via PgBouncer ✓ |
| PgBouncer | transaction mode (`SERVER_RESET_QUERY: DISCARD ALL`) | pool | advisory **xact** lock é seguro; **session** lock (`pg_advisory_lock`) é proibido |
| Apollo Client | ^3.13.4 | queries/mutations/optimistic | `optimisticResponse` p/ drag-and-drop |
| React Hook Form + zod | ^7.53 / ^3.23 | forms | padrão do repo |
| Recharts | 2.15.4 (instalado) | gráficos do dashboard | **ajuste de `react-is` necessário** (ver Pitfall 7) |
| sonner | ^1.5.0 | toasts (D-01/D-04) | já usado |

### Novas (frontend)

| Library | Versão | Purpose | Why |
|---------|--------|---------|-----|
| `@dnd-kit/core` | 6.3.1 (npm view 2026-11-01; modificado 2024-12) | drag-and-drop dos cards entre raias/horários | MIT, headless (mantém o layout/visual validado), `PointerSensor`+`KeyboardSensor` (WCAG 2.1.1), peer `react >=16.8` |
| `@dnd-kit/modifiers` | 9.0.0 | `createSnapModifier`, `restrictToParentElement` | snap de 30 min (altura do slot) |

`@dnd-kit/utilities` (3.2.2) entra como transitiva. **Não usar** `@dnd-kit/react` 0.5.3 (pré-1.0, API diferente, ainda em 0.x em 2026-10).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dnd-kit | **FullCalendar resource-timeline / resource-timegrid** | 6.1.22, licença `SEE LICENSE IN LICENSE.md`; a página oficial de licença diz que uso comercial de plugins Premium por empresa com fins lucrativos exige **licença comercial paga** (grátis só para ONG registrada ou projeto 100% AGPLv3). Um SaaS fechado = pagar, e a regra de raias por profissional é exatamente o plugin de recursos (premium). **Rejeitado.** Também descartaria a grade validada pelo usuário |
| dnd-kit | HTML5 DnD nativo (`draggable`) | sem teclado, sem touch, feedback de preview ruim, e Playwright lida mal. Rejeitado |
| dnd-kit | handler de pointer events custom | reimplementa sensor/teclado/cancelamento; só vale se a página ficasse sem dependência a qualquer custo. Rejeitado |
| Recharts 2.15.4 + override `react-is` | Recharts 3.10.1 (peer `react-is ^19` ok) | upgrade major só para gráfico simples; preferir override (1 linha) e re-avaliar na M7 |
| `Intl.DateTimeFormat` com `timeZone` | `date-fns` 4.4.0 + `@date-fns/tz` 1.5.0 | não há lib de datas instalada no frontend hoje. Os presets (Hoje/Ontem/Semana/Mês) são poucos; `Intl` + pequena função pura basta. Se o time preferir, `date-fns@4` + `@date-fns/tz` (`TZDate`) é a escolha, **não** `date-fns-tz` |

**Installation:**
```bash
pnpm --filter @sgs/frontend add @dnd-kit/core@6.3.1 @dnd-kit/modifiers@9.0.0
# Recharts + React 19: forçar react-is 19 (ver Pitfall 7) — em package.json raiz:
#   "pnpm": { "overrides": { "react-is": "^19.0.0" } }
```
**Version verification:** `npm view` executado em 2026-11-01: `@dnd-kit/core` 6.3.1, `@dnd-kit/modifiers` 9.0.0, `@dnd-kit/react` 0.5.3, `date-fns` 4.4.0, `@date-fns/tz` 1.5.0, `recharts` 3.10.1 (repo está em 2.15.4), `@fullcalendar/resource-timeline` 6.1.22 (licença comercial).

## Architecture Patterns

### Estrutura recomendada

```
apps/backend/
├── prisma/migrations/2026MMDD000000_phase3_operations/migration.sql   # UMA migration (como a Phase 2) + seed de permissões
├── src/
│   ├── database/advisory-lock.ts          # lockProfessional / lockOrgShared / isPgError
│   ├── appointments/                      # EXISTENTE — estender (não mover)
│   │   ├── appointments.service.ts        # + update/move/cancel/setStatus, usa advisory-lock
│   │   ├── time-blocks.service.ts         # CRUD time_blocks (kinds), mesmo módulo
│   │   └── deposits.ts                    # registra sinal (credit + cash movement)
│   ├── comandas/
│   │   ├── comandas.module.ts / .service.ts / .resolver.ts
│   │   ├── comanda-code.ts                # next_comanda_code(tx, orgId, tz)
│   │   ├── comanda-close.ts               # closeComanda / reopenComanda (1 transação)
│   │   └── money.ts                       # toCents/fromCents/splitProportional
│   ├── financial/
│   │   ├── commission-resolver.ts         # PURO: resolve regra por item
│   │   ├── financial.service.ts           # dashboard (SQL), cash, comissões (query)
│   │   ├── client-credit.service.ts       # saldo (lock cliente), ajuste manual
│   │   └── financial.resolver.ts
│   ├── catalog/products/stock.ts          # applyStockDelta(tx, …) extraído de adjustStock
│   └── graphql/schema/{appointments,comandas,financial}.graphql
apps/frontend/src/features/operations/
├── api/{appointments,comandas,financial}.api.ts   # gql manual
├── components/calendar/{DayGrid,WeekGrid,AppointmentCard,TimeBlockDialog,CancelDialog}.tsx
├── pages/{SchedulePage,ComandaListPage,ComandaPage,FinanceiroPage,ComissoesCalculadasPage}.tsx
├── lib/{money.ts,period.ts}                       # decimal-string helpers, presets de período em tz
└── __tests__/
```

### Modelo de dados (migration única; todas com `organization_id`, RLS `ENABLE`+`FORCE`, policy `tenant_isolation` idêntica à de `appointments`)

| Tabela | Colunas-chave / constraints |
|--------|-----------------------------|
| `appointments` (ALTER) | `+comanda_id uuid NULL FK`, `+service_variant_id uuid NULL FK`, `+deposit_amount numeric(12,2) NOT NULL DEFAULT 0` (denormalizado p/ exibir; fonte da verdade = `client_credit_movements`), `+cancel_reason text`, `+cancelled_at`. CHECK status → `('scheduled','confirmed','in_progress','completed','cancelled','no_show')`. **Recriar** `ex_appointments_professional_interval` com `WHERE (status IN ('scheduled','confirmed','in_progress','completed'))` |
| `time_blocks` | `kind` CHECK IN (`folga`,`intervalo`,`feriado`,`indisponibilidade`), `professional_id uuid NULL` (NULL = org-wide; CHECK `kind='feriado' ⇔ professional_id IS NULL`), `starts_at/ends_at timestamptz` (`ends_at > starts_at`), `all_day bool`, `note`, `created_by`. Índice `(organization_id, professional_id, starts_at)` |
| `comandas` | `code varchar(20)` + `UNIQUE(organization_id, code)`, `client_id`, `status` CHECK IN (`open`,`closed`,`cancelled`), `opened_at`, `closed_at`, `closed_by`, `close_cycle int NOT NULL DEFAULT 0`, `subtotal`/`total numeric(12,2)` (recalculados a cada alteração de item), `appointment`-link é no appointments |
| `comanda_sequences` | `PRIMARY KEY (organization_id, year)`, `last_value int` |
| `comanda_items` | `comanda_id`, `kind` CHECK IN (`service`,`product`), `service_id`/`product_id` (CHECK exatamente um), `package_id NULL`, `appointment_id NULL`, `professional_id NOT NULL` (D-13), `quantity int > 0`, `unit_price numeric(12,2) >= 0`, `total numeric(12,2)`, `name_snapshot` |
| `comanda_payments` | `comanda_id`, `method` CHECK IN (`cash`,`pix`,`credit_card`,`debit_card`,`transfer`,`client_credit`), `amount numeric(12,2) > 0`, `paid_at`, `member_id` (quem registrou) |
| `client_credit_movements` | `client_id`, `amount numeric(12,2)` (± ; `<> 0`), `kind` CHECK IN (`deposit`,`cancel_refund_credit`,`manual_adjustment`,`consumption`,`reopen_refund`), `appointment_id NULL`, `comanda_id NULL`, `cycle int NULL`, `reason`, `created_by`. Índice `(organization_id, client_id)` |
| `cash_movements` | `kind` CHECK IN (`payment_in`,`change_out`,`deposit_in`,`reversal`), `method`, `amount numeric(12,2)` (± assinado), `comanda_id NULL`, `appointment_id NULL`, `cycle int NULL`, `occurred_at timestamptz`, `member_id`. Índice `(organization_id, occurred_at)` |
| `commission_records` | `comanda_id`, `comanda_item_id`, `member_id`, `kind` CHECK IN (`accrual`,`reversal`), `cycle int`, `base_amount`, `rule_kind`, `rule_value numeric(12,4)`, `rule_snapshot jsonb`, `calculated_amount` (negativo em reversal), `reverses_record_id NULL`, `calculated_at`. `UNIQUE (comanda_item_id, cycle, kind)`. **`REVOKE UPDATE, DELETE ... FROM sgs_app`** |
| `audit_log` | `actor_member_id`, `action varchar(60)`, `entity_type`, `entity_id`, `reason text`, `metadata jsonb`, `created_at`. `REVOKE UPDATE, DELETE FROM sgs_app` |
| `stock_movements` (ALTER) | `+comanda_id uuid NULL` (D-21 "reference_id") |
| permissions seed | `role_permissions` (DO $$ como `20260506010000_seed_phase2_permissions`) |

Notas de modelagem:
- **Imutabilidade**: use `REVOKE UPDATE, DELETE ON commission_records, audit_log FROM sgs_app;` (guardado por `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sgs_app')`, padrão de `member_categories`). **Não** use trigger de bloqueio: os testes de integração limpam via `adminPrisma` (dono da tabela, BYPASSRLS) e um trigger quebraria o cleanup. Os grants default do repo (`ALTER DEFAULT PRIVILEGES … GRANT SELECT, INSERT, UPDATE, DELETE`) dão UPDATE/DELETE a tabelas novas, por isso o REVOKE explícito é obrigatório.
- Prisma: marcar `@@map` e `@map` snake_case como no resto; relações em `Organization`/`Member`/`Client`/`Service`/`Product`.
- RLS: toda policy `USING` **e** `WITH CHECK` com `nullif(current_setting('app.current_organization', true), '')::uuid`.
- Remover/limpar dados no teste: respeitar ordem de FK (commission_records → comanda_payments/items → comandas → appointments …).

### Pattern 1: Lock por profissional + exclusion constraint como rede (resolve SCHED-01/05, D-01)

**What:** Toda criação/movimentação/redimensionamento de appointment e toda criação de `time_block` roda numa `runWithTenant` que, **antes de ler/escrever**, faz `SET LOCAL lock_timeout`, adquire `pg_advisory_xact_lock_shared(orgKey)` e `pg_advisory_xact_lock(profKey)`; depois checa sobreposição (appointments **e** time_blocks do profissional ou org-wide) e escreve. A exclusion constraint continua como segunda linha de defesa (SQLSTATE `23P01`).

**Por que não o hash de `slot_start` (D-01 literal):** a chave só colide para o *mesmo* início. 10:00–11:00 e 10:30–11:30 pegam locks diferentes, passam juntos na checagem e só a constraint os separa; para `time_blocks` (sem constraint) o double-booking passaria. O lock por profissional serializa **todas** as escritas daquela raia (carga irrelevante: poucos writes/profissional/minuto). Mantém a *intenção* de D-01 (advisory xact lock + toast de 55P03 + overlap), muda só a granularidade da chave. Registrar como refinamento de D-01.

**Duas camadas (feriado org-wide):** appointment → `shared(orgKey)` + `exclusive(profKey)`; criar `feriado` → `exclusive(orgKey)` (espera todos os writes de agenda em voo, e bloqueia novos). Ordem fixa org → professional ⇒ sem deadlock. Mover entre raias → travar as duas raias **em ordem determinística** (ordenar as chaves).

**Verificado empiricamente (PG 16.13 via PgBouncer :5433, usuário `sgs_app`):**
- `pg_advisory_xact_lock` dentro de `BEGIN…COMMIT` funciona em transaction pooling.
- `SET LOCAL lock_timeout='500ms'` **se aplica a advisory lock**: segunda sessão falhou com `canceling statement due to lock timeout` (SQLSTATE 55P03).
- `hashtextextended(text, 0)` retorna `bigint` (64 bits) — preferir a `hashtext` (32 bits); evita colisões e casa direto com `pg_advisory_xact_lock(bigint)`.
- Inserção sobreposta em coluna com `EXCLUDE USING gist (… tstzrange WITH &&)` → `ERROR 23P01 conflicting key value violates exclusion constraint`.

**Código:** ver Code Examples (`advisory-lock.ts`).

**Prisma:** o lock deve usar `tx.$executeRaw`/`$queryRaw` (tagged template, sem `Unsafe`). Erros de SQL cru chegam como `PrismaClientKnownRequestError` com `code:'P2010'` e `meta.code` = SQLSTATE (o código atual já checa `meta?.code === '23P01'`); para `create()/update()` tipados o SQLSTATE pode vir em `P2004`/mensagem. **Helper `isPgError(e, sqlstate)` que cobre `meta.code`, `e.code` e `e.message.includes(sqlstate)`** — e, no primeiro teste de concorrência, travar o formato real observado (ver Open Questions #2).

**Transação do Prisma:** default `timeout` 5000 ms / `maxWait` 2000 ms em `$transaction` interativa. O `lock_timeout` (≈3 s) tem de ficar **abaixo** do timeout da transação, senão o erro vira "Transaction already closed" em vez de 55P03. `TenantContextService.runWithTenant` hoje não passa options; para os fluxos de agenda/fechamento aceitar um 3º parâmetro opcional `{ timeout, maxWait }` (ou manter defaults e `lock_timeout=2s`).

**Após erro SQL dentro da transação o Postgres a marca como abortada.** O `create()` atual captura o erro e *retorna* um payload; funciona (o COMMIT vira ROLLBACK), mas é mais seguro lançar uma exceção sentinela interna (`SlotConflictError`) e traduzi-la para payload **fora** do `runWithTenant`, garantindo rollback explícito.

### Pattern 2: Visita = comanda; serviço = appointment (D-05)

`createAppointment` atual (1 serviço) continua; novo `createVisit`/`createAppointments(input: { clientId, items: [{ serviceId, variantId?, professionalId, startsAt, endsAt }], packageId?, deposit?: { amount, method } })` cria **N appointments + 1 comanda + N comanda_items(kind=service, appointment_id)** numa transação (locks de todas as raias, ordenados). `createAppointment` (compat com testes/E2E existentes) passa a abrir comanda também (mesmo código). Pacote: expandir `package_services` em itens (quantity → N appointments ou 1 item com quantity; para MVP: 1 appointment por unidade agendada, itens com `quantity` = nº de unidades daquele serviço no pacote) e **ratear `package.price` proporcionalmente ao `base_price`** dos serviços em centavos inteiros (`splitProportional`, resto no último item) — a comissão do item usa o preço rateado como `base_amount`. (Decisão de planejamento; ver Open Questions #4.)

**Preço do item:** `service_pricing_variants` (Phase 2 D-07: o atendente escolhe a variante; Phase 3 *sugere* pela `members.seniority_tier`). Snapshot em `comanda_items.unit_price`; sem variante → `services.base_price`.

**Ciclo de vida (D-05 em inglês):** appointment `scheduled|confirmed → in_progress → completed`; `cancelled`/`no_show` encerram. `closeComanda` marca appointments ligados (não cancelados) como `completed`; `reopenComanda` volta `completed → in_progress`. Cancelar o último appointment ativo de uma comanda **sem pagamentos** cancela a comanda; comanda com pagamentos exige reabrir/estornar antes (erro `COMANDA_HAS_PAYMENTS`).

### Pattern 3: Código da comanda `C-AAAA-NNN` (D-19)

Tabela contador + `INSERT … ON CONFLICT DO UPDATE … RETURNING` na **mesma transação** da criação da comanda. O upsert toma lock de linha ⇒ serializa concorrentes por (org, ano); se a transação desfaz, o incremento desfaz junto (sem buracos). `SEQUENCE` por org foi rejeitado: exige DDL por tenant, não faz reset anual e `nextval` não é transacional (buracos), além de ficar fora do RLS. O ano é o **ano local da org** (`organizations.timezone`, default America/Sao_Paulo), não UTC — comandas das 23:30 de 31/12 não podem receber o código do ano seguinte. Formato: `C-${year}-${String(n).padStart(3,'0')}` (3 dígitos é mínimo; passa de 999 sem problema).

### Pattern 4: Fechar comanda — uma transação, idempotente (D-12, D-21)

Passos dentro de **uma** `runWithTenant`:
1. `SELECT … FROM comandas WHERE id=$1 FOR UPDATE` — se `status<>'open'` → erro `COMANDA_NOT_OPEN` (idempotência contra duplo clique / retry).
2. Carregar itens + pagamentos; recalcular `total`; `pago = Σ payments`; exigir `pago >= total`; `troco = pago - total` só se houver linha `cash` com `amount >= troco` (senão `INVALID_CHANGE`).
3. Se há linha `client_credit`: `SELECT … FROM clients WHERE id=$client FOR UPDATE` (serializa uso concorrente do saldo), `balance = Σ amount`, exigir `balance >= consumo` → insere `client_credit_movements(kind='consumption', amount=-X, comanda_id, cycle)`.
4. Produtos: para cada item `product` → `applyStockDelta(tx, …, delta=-qty, type='sale', comandaId)`. Estoque insuficiente → erro `STOCK_INSUFFICIENT` (lista os produtos) e rollback — consistente com `adjustStock`, que recusa estoque negativo. Ordenar por `product_id` ao travar (evita deadlock entre fechamentos concorrentes).
5. `close_cycle = close_cycle + 1`; `status='closed'`, `closed_at=now()`, `closed_by`.
6. Para cada item: `resolveCommissionRule(...)` (Pattern 5) → `commission_records(kind='accrual', cycle)`; batch com `createMany` (um INSERT; discrição: usar `createMany`, o volume por comanda é pequeno).
7. `cash_movements`: uma linha `payment_in` por pagamento **não-crédito** (+tendered) e, se houve troco, `change_out` (−troco, method=`cash`); todas com `comanda_id` e `cycle`.
8. appointments ligados → `completed`.
9. Dados do payload de retorno: comanda + totais + comissões geradas (a UI mostra "Comissão gerada" sem nova query).

**Reabertura (`reopenComanda(id, reason)`)**, `@RequirePermission(COMANDA_REOPEN)`, `reason` obrigatório (min. 3 chars): `FOR UPDATE`; exige `closed`; para o `cycle` atual: (a) `applyStockDelta(+qty, type='return')` por item produto; (b) para cada `commission_records` accrual do ciclo sem reversal → insere `kind='reversal'`, `calculated_amount = -x`, `reverses_record_id`; (c) `client_credit_movements(kind='reopen_refund', +consumo do ciclo)`; (d) `cash_movements(kind='reversal')` com o oposto de cada linha do ciclo; (e) `status='open'`, `closed_at=null`; (f) `audit_log(action='comanda.reopen', reason, metadata:{cycle,total})`; (g) appointments `completed → in_progress`. Pagamentos continuam gravados (atendente pode removê-los/ajustá-los antes de fechar de novo). O dashboard só conta comandas `closed` e `cash_movements` somados (reversal já neutraliza), então o estorno aparece sem lógica extra.

### Pattern 5: Regra de comissão — resolver puro + snapshot

Precedência (Phase 2 D-18: "apenas UMA regra, do mais específico ao geral"). **Para cada item**, entre as regras **não deletadas** da org:
- item `service`: `member_service(member, service)` → `service(service)` → `category(service.category, subindo pela hierarquia de pais)` → `default`
- item `product`: `product(product)` → `default`
- nenhuma regra casa → **não cria registro** (sem regra = sem comissão); o payload do fechamento sinaliza os itens sem comissão. Ver Open Questions #5.

`calculated_amount = percentage ? round(base * value/100) : value` — **`fixed` é por linha de comanda, não por unidade** (documentar na UI; Open Questions #6). Arredondamento em centavos inteiros, half-up, `Math.round` sobre centavos. `rule_snapshot` JSONB = `{ruleId, scopeType, kind, value, serviceId, memberId, categoryId, productId, matchedCategoryId}`.

A mesma hierarquia de categorias já tem utilitário: `loadCategoryParents(tx)` + a lógica de subida em `identity/member-categories.ts` (cópia local do loop com `visited`/`MAX_DEPTH`; ciclo acidental não entra em loop). Reusar `loadCategoryParents`.

`UNIQUE(comanda_item_id, cycle, kind)` torna o fechamento idempotente também no banco.

### Pattern 6: Drag-and-drop com dnd-kit sobre a grade existente (SCHED-02, D-04)

A grade (`SchedulePage.tsx` ~linhas 1470–1650) já é `grid` com uma coluna por profissional, slots de 30 min de altura fixa (`slotHeight`), cards `position:absolute` calculados por `getAppointmentStyle`. Plano:
- `DndContext` envolve a área de colunas; cada coluna = `useDroppable({ id: professionalId, data })`; cada card = `useDraggable({ id: appointmentId })` (somente quando `canWriteAppointments(role)`).
- Sensores: `PointerSensor` com `activationConstraint:{distance:6}` (não rouba o clique que abre o card), `TouchSensor` com `delay:250`, `KeyboardSensor` (setas movem por slot; WCAG 2.1.1).
- No `onDragEnd`: `slotsMoved = Math.round(delta.y / slotHeight)` → novo `startsAt = startsAt + slotsMoved*30min` (mesma duração); raia nova = `over?.id ?? professionalId`. Mutação `moveAppointment`.
- `createSnapModifier(slotHeight)` em `@dnd-kit/modifiers` p/ snap vertical visual. Conflito em tempo real: **só validar no drop** (discrição: overlay vermelho durante o drag exigiria carregar todos os cards/blocks por raia no `onDragOver`; ganho pequeno, custo de re-render; adiar).
- **Revert automático via Apollo:** `optimisticResponse` com o appointment já na nova posição e `errors: []`; a resposta real substitui a camada otimista. Como o erro é "erro-como-dado" (`errors[]` no payload, `appointment: null`), a camada otimista simplesmente cai e o card volta à posição do cache original — **não** escrever no cache quando `errors.length>0` e disparar `toast.error("Não foi possível mover: " + message)`. Para erro de rede (rejeição), `onError` + a mesma camada cai.
- Redimensionar (arrastar a borda) é opcional; MVP: alterar duração no modal de edição. (SCHED-02 pede "mover".)
- E2E: `locator.dragTo()` do Playwright costuma falhar com dnd-kit; usar `page.mouse.move/down/move(steps)/up` (os `PointerSensor` reagem a pointer events que o mouse do Playwright gera).

Vista **Semana** (D-18): componente separado `WeekGrid` — 7 colunas (segunda→domingo, `date_trunc('week')` do Postgres é segunda-feira, igual), cards compactos; query `appointments(startsAt: segunda 00:00 local, endsAt: próxima segunda)`; sem DnD na semana no MVP (somente abrir). `professionalId` forçado no backend para PROFESSIONAL (já existe `scopeProfessionalFilter`).

### Pattern 7: Dashboard financeiro (D-17, FIN-01) — SQL direto, fuso da org

Todos os intervalos chegam como `from`/`to` **datas locais** (`YYYY-MM-DD`) + o backend lê `organizations.timezone`; converte para limites `timestamptz` com `AT TIME ZONE` e agrega por `date_trunc(unit, ts AT TIME ZONE tz)`. Presets são calculados no **frontend** (função pura testável, "hoje" no fuso da org via `Intl.DateTimeFormat('en-CA',{timeZone})`) e enviados como datas; o backend não tem preset (menos superfície). Dias sem movimento: `generate_series` + LEFT JOIN (gráfico sem buracos). Ver Code Examples.

**Definição de "receita" (decisão recomendada — confirmar, Open Questions #1):**
- **Faturamento** = `SUM(comandas.total)` de comandas `status='closed'` agrupadas por `closed_at` no fuso da org (regime de competência — gráfico de barras por dia/semana/mês).
- **Recebido por método** = `SUM(cash_movements.amount)` agrupado por `method` (regime de caixa; inclui sinais, desconta troco, reversões neutralizam). `client_credit` não gera cash movement (o dinheiro entrou no depósito).
- KPIs: faturamento, recebido, nº de comandas fechadas, ticket médio, comissões do período (`SUM(commission_records.calculated_amount)` — reversões negativas já abatem).
Evita dupla contagem de sinal e mantém breakdown reconciliável com `cash_movements`.

### Pattern 8: Permissões e escopo do PROFESSIONAL

Catálogo (adicionar em `permissions.catalog.ts` **e** na migration SQL de seed — as duas fontes):

| Permissão | ADMIN | MANAGER | ATTENDANT | PROFESSIONAL |
|-----------|:-----:|:-------:|:---------:|:------------:|
| `appointment.read` / `appointment.write` (existem; time blocks e cancelar reaproveitam `appointment.write`) | ✓ | ✓ | ✓ | read |
| `comanda.read` | ✓ | ✓ | ✓ | ✓ (escopo próprio) |
| `comanda.write` (abrir walk-in, itens, pagamentos) | ✓ | ✓ | ✓ | – |
| `comanda.close` | ✓ | ✓ | ✓ | – |
| `comanda.reopen` | ✓ | ✓ | – | – |
| `credit.read` | ✓ | ✓ | ✓ | – |
| `credit.adjust` | ✓ | ✓ | – | – |
| `financial.read` (dashboard) | ✓ | ✓ | – | – |
| `commissionRecord.read` | ✓ | ✓ | – | ✓ (forçado a `memberId=self`) |
| `commission.write` (existe — alterar regras) | ✓ | – | – | – |

(O "commission.adjust" de D-20 é o `commission.write` já existente.) Escopo do PROFESSIONAL: reaproveitar o padrão `scopeProfessionalFilter(tenant, requested)` de `appointments.resolver.ts`; para comandas `WHERE EXISTS (item.professional_id = self)` e, para detalhe, só itens dele; para `commissionRecords`, `memberId` sempre = `tenant.memberId`. Teste de integração obrigatório (RBAC + isolamento).

### Anti-Patterns to Avoid
- **`pg_advisory_lock` (session-level):** vaza lock na conexão do pool; só `*_xact_*`.
- **Hash de `slot_start`** (D-01 literal): não protege sobreposição parcial nem time_blocks.
- **Transação aninhada:** chamar `adjustStock`/`runWithTenant` de dentro de `closeComanda` abre outra transação e quebra a atomicidade.
- **UPDATE em `commission_records`:** nunca; reversão = INSERT.
- **Somar dinheiro em `number`/float:** converter para centavos inteiros (ou usar `Prisma.Decimal`) antes de somar/ratear.
- **Flag antes da hora:** `features.ts` — a flag vira `true` no mesmo commit em que a tela lê dado real; remover o mock correspondente (`mocks/comanda.mock.ts`, `mocks/financeiro.mock.ts`, `mocks/schedule.mock.ts`) e a faixa "Mockup — Phase 3" no mesmo commit.
- **`/comanda/demo`** no `menu-config.ts` (item "Comandas") — trocar para uma lista real `/comanda` (a flag `/comanda` já cobre `/comanda/*`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anti double-booking entre appointments | Só checagem em app | Exclusion constraint `btree_gist` (já existe, **alargar**) + lock | Corrida entre dois commits só é fechada pelo banco |
| Mutex distribuído | Redis lock / tabela de lock | `pg_advisory_xact_lock` (+ `lock_timeout`) | Libera sozinho no commit/rollback; funciona em PgBouncer transaction mode (verificado) |
| Drag-and-drop | Pointer events manual / HTML5 DnD | `@dnd-kit/core` | Teclado, touch, cancelamento, a11y |
| Contador `C-AAAA-NNN` | `MAX(code)+1` ou `COUNT(*)` | Upsert em `comanda_sequences` | Concorrência-safe e sem buracos |
| Gráficos | SVG à mão | Recharts (já na lista de deps) | – |
| Rateio de pacote em centavos | `price/n` em float | `splitProportional(cents[], total)` único e testado (resto no último) | Soma tem de bater exatamente |
| Datas/fuso no dashboard | Offset fixo `-03:00` | `AT TIME ZONE organizations.timezone` no SQL; `Intl.DateTimeFormat({timeZone})` no front | DST/regra pode mudar; o campo `timezone` já existe |
| Imutabilidade | Convenção "não faça UPDATE" | `REVOKE UPDATE, DELETE` do `sgs_app` | Garantia no banco, não no código |
| Hierarquia de categoria | Novo walker | `loadCategoryParents` + loop com `visited` | Já tratado contra ciclo |

**Key insight:** o domínio é "dinheiro + concorrência". A correção vem de constraints e de uma única transação com `FOR UPDATE`, não de bibliotecas.

## Common Pitfalls

### Pitfall 1: Exclusion constraint deixa de proteger agendamentos em atendimento
**What goes wrong:** `in_progress`/`completed` não estão no `WHERE` da constraint; mover/criar por cima de um atendimento em andamento passa.
**How to avoid:** a migration faz `ALTER TABLE appointments DROP CONSTRAINT ex_appointments_professional_interval, ADD CONSTRAINT … WHERE (status IN ('scheduled','confirmed','in_progress','completed'))` e o pré-check em app usa a mesma lista (hoje `["scheduled","confirmed"]` em `appointments.service.ts`). Teste: criar sobre `in_progress` falha.
**Warning signs:** constante de status duplicada em 3 lugares — extrair `BLOCKING_STATUSES`.

### Pitfall 2: Timeout da transação < lock_timeout
**What goes wrong:** usuário vê "Transaction already closed" em vez do toast de horário reservado.
**How to avoid:** `SET LOCAL lock_timeout='3s'` com transação ≥ 5 s (default) — ok; documentar a relação e testar com sessão externa segurando o lock (`pg_advisory_xact_lock` em tx aberta via `adminPrisma`).

### Pitfall 3: Saldo de crédito corrida (double spend)
**What goes wrong:** dois fechamentos simultâneos do mesmo cliente leem o mesmo saldo.
**How to avoid:** `SELECT … FROM clients WHERE id=… FOR UPDATE` antes de somar `client_credit_movements` (mesmo padrão `FOR UPDATE` do `adjustStock`). Teste de concorrência com `Promise.all`.

### Pitfall 4: Troco inconsistente
**What goes wrong:** troco > dinheiro recebido, ou troco gerado só com Pix.
**How to avoid:** `troco ≤ Σ(linhas cash)`; senão `INVALID_CHANGE`. Pagamento maior que o total só é aceito se a diferença for coberta por dinheiro.

### Pitfall 5: Fuso na virada do dia / ano / semana
**What goes wrong:** `date_trunc('day', closed_at)` em UTC joga comanda das 22h do dia 31 no dia 1; código `C-2027-001` às 22h de 31/12.
**How to avoid:** sempre `ts AT TIME ZONE tz` antes de `date_trunc`; ano do código pela timezone da org; semana começa na segunda (`date_trunc('week')` do PG). Playwright já roda com `timezoneId: 'America/Sao_Paulo'`. Teste com comanda fechada às 23:30 local.

### Pitfall 6: Optimistic UI + erro-como-dado
**What goes wrong:** payload `{ appointment: null, errors:[…] }` não é erro GraphQL ⇒ `onError` não dispara; sem tratar, o cache mantém a posição nova ou apaga o card.
**How to avoid:** tratar `data.moveAppointment.errors.length>0` no `onCompleted`/`await` → toast; não escrever no cache nesse caso (a camada otimista cai sozinha). Cobrir com vitest (MockedProvider) e E2E.

### Pitfall 7: Recharts 2.15 + React 19 renderiza vazio
**What goes wrong:** no repo, `recharts@2.15.4` resolve **`react-is@18.3.1`** (verificado em `node_modules/.pnpm/recharts@2.15.4*/node_modules/react-is`) com React 19.2.5 — combinação com problema conhecido (gráficos sem render). Nenhum arquivo do frontend usa Recharts ainda, então ninguém viu.
**How to avoid:** `pnpm.overrides: { "react-is": "^19.0.0" }` (ou dependência direta `react-is@^19` no frontend) e um teste vitest/Playwright que confirme `.recharts-bar-rectangle` no DOM na primeira tela com gráfico. (MEDIUM — problema conhecido do ecossistema; validar no primeiro task do dashboard.)

### Pitfall 8: Prisma `Decimal` e serialização
**What goes wrong:** `Prisma.Decimal` em `JSON`/GraphQL vira objeto; soma em `Number` perde precisão.
**How to avoid:** converter sempre `d.toFixed(2)` para o SDL (`String!`); somar via `toCents(d)`; agregações SQL devolvem `numeric` → `::text` no `$queryRaw` e converter na borda.

### Pitfall 9: `commission_rules` soft-deleted e regra editada
**What goes wrong:** regra apagada/alterada depois do fechamento muda histórico.
**How to avoid:** o `rule_snapshot` guarda a regra completa; a UI/relatórios leem do snapshot, nunca dão join em `commission_rules` para mostrar valor.

### Pitfall 10: Testes que o Jest não enxerga
**What goes wrong:** `jest-integration.config.ts` usa `testRegex '.*\.spec\.ts$'`; arquivos `*.e2e-spec.ts` (hífen) **nunca rodam** (todo do STATE; confirmado por comentário em `members-lifecycle.e2e.spec.ts`). `pnpm test:e2e` do backend aponta para `test/jest-e2e.json` inexistente.
**How to avoid:** novos testes de integração se chamam **`phase3-<tema>.e2e.spec.ts`** (ponto antes de `spec`) em `apps/backend/test/integration/`. Não citar `rbac.e2e-spec.ts` como prova de RBAC.

### Pitfall 11: Seed de permissões em duas fontes
**What goes wrong:** adiciona a constante em `permissions.catalog.ts` mas esquece a migration de seed (ou vice-versa): o PermissionGuard consulta `role_permissions` no DB ⇒ 403 para todos.
**How to avoid:** migration `DO $$ … INSERT … ON CONFLICT DO NOTHING` com os 4 papéis no mesmo arquivo da migration de schema; teste de integração que lê `role_permissions` e compara com `ROLE_PERMISSIONS`.

### Pitfall 12: Hook de deleção em dados de teste
**What goes wrong:** cleanup das suítes (`DELETE FROM … WHERE organization_id IN (…LIKE 'memlc-%')`) agora precisa conhecer as tabelas novas e a ordem de FK; `members-lifecycle` apaga `appointments`→`clients` sem apagar `comandas`/`comanda_items` ⇒ FK impede.
**How to avoid:** os cleanups existentes que apagam `appointments` (ex.: `members-lifecycle.e2e.spec.ts`, `professional-categories`, e `apps/e2e` seed) devem apagar antes `comanda_items/payments/commission_records/cash_movements/client_credit_movements/comandas/time_blocks`, **ou** as FKs novas apontando para appointments/clients usam `ON DELETE CASCADE`/`SET NULL` onde fizer sentido (precedente: `member_categories ON DELETE CASCADE` "cleanups por SQL cru não podem ser barrados por FK restritiva"). Recomendado: `comanda_id` em `appointments` com `ON DELETE SET NULL`, e filhos de comanda `ON DELETE CASCADE` (exceto `commission_records`/`audit_log`, que são só-insert).

## Code Examples

### advisory-lock.ts (padrão para todo write de agenda)
```typescript
// src/database/advisory-lock.ts — locks de transação (nunca session-level).
import { Prisma } from '@prisma/client';
import type { TenantPrismaClient } from './types';

const ns = 'sgs:sched';

/** Falha rápido com SQLSTATE 55P03 em vez de esperar indefinidamente. Chamar ANTES dos locks. */
export async function setLockTimeout(tx: TenantPrismaClient, ms = 3000) {
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${Math.trunc(ms)}ms'`); // ms é number interno, não input
}

/** Compartilhado na org: appointments convivem; feriado (exclusivo) espera todos. */
export async function lockOrgShared(tx: TenantPrismaClient, orgId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`${ns}:org:${orgId}`}, 0))`;
}
export async function lockOrgExclusive(tx: TenantPrismaClient, orgId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ns}:org:${orgId}`}, 0))`;
}
/** Raia do profissional. Ao travar duas raias (mover entre profissionais), ordenar os ids antes. */
export async function lockProfessional(tx: TenantPrismaClient, orgId: string, professionalId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ns}:pro:${orgId}:${professionalId}`}, 0))`;
}

/** SQLSTATE vindo do Prisma em qualquer formato (raw → P2010/meta.code; tipado → P2004/mensagem). */
export function isPgError(e: unknown, sqlstate: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const metaCode = (e.meta as { code?: string } | undefined)?.code;
  return metaCode === sqlstate || e.message.includes(sqlstate);
}
export const isLockTimeout = (e: unknown) => isPgError(e, '55P03');
export const isExclusionViolation = (e: unknown) => isPgError(e, '23P01');
```

### Fluxo de criação/movimentação (esqueleto)
```typescript
// appointments.service.ts (esqueleto)
return this.tenant.runWithTenant(orgId, async (tx) => {
  await setLockTimeout(tx);
  await lockOrgShared(tx, orgId);
  await lockProfessional(tx, orgId, professionalId);      // ordenado se houver 2 raias
  await assertNoBlockOrAppointmentOverlap(tx, { professionalId, startsAt, endsAt, ignoreId });
  // …create/update; constraint 23P01 → SlotConflictError
}).catch(mapSchedulingError);   // 55P03 e 23P01 → { code: 'SLOT_TAKEN', message: 'Horário já reservado por outra pessoa — escolha outro slot' }
```
`assertNoBlockOrAppointmentOverlap` consulta `time_blocks WHERE (professional_id = $p OR professional_id IS NULL) AND starts_at < $end AND ends_at > $start` além de `appointments` com `BLOCKING_STATUSES`, excluindo o próprio `id` ao mover.

### Contador de comanda (concorrência-safe)
```sql
-- dentro da mesma transação que insere a comanda
INSERT INTO comanda_sequences (organization_id, year, last_value)
VALUES ($1, $2, 1)
ON CONFLICT (organization_id, year)
DO UPDATE SET last_value = comanda_sequences.last_value + 1
RETURNING last_value;
-- $2 = EXTRACT(YEAR FROM (now() AT TIME ZONE <org.timezone>))
```

### Dashboard: receita por bucket e por método (fuso da org)
```sql
-- :tz = organizations.timezone ; :from/:to = datas locais (to exclusivo = dia seguinte)
WITH bounds AS (
  SELECT (:from::date)::timestamp AT TIME ZONE :tz AS t0,
         (:to::date)::timestamp   AT TIME ZONE :tz AS t1
), days AS (
  SELECT d::date AS day FROM bounds, generate_series(:from::date, (:to::date - 1), interval '1 day') d
)
SELECT days.day::text,
       COALESCE(SUM(c.total), 0)::text AS faturamento,
       COUNT(c.id) AS comandas
FROM days
LEFT JOIN comandas c
  ON c.status = 'closed'
 AND (c.closed_at AT TIME ZONE :tz)::date = days.day
GROUP BY days.day ORDER BY days.day;

-- breakdown por método (regime de caixa)
SELECT method, SUM(amount)::text AS total
FROM cash_movements, bounds
WHERE occurred_at >= t0 AND occurred_at < t1
GROUP BY method ORDER BY SUM(amount) DESC;
-- semana: date_trunc('week', closed_at AT TIME ZONE :tz) (segunda); mês: date_trunc('month', …)
```
Usar `tx.$queryRaw` (tagged template, parâmetros `${}`) dentro de `runWithTenant` ⇒ RLS aplica nas tabelas (a policy filtra por org; `organizations.timezone` lido antes via `tx.organization.findFirst`).

### Imutabilidade
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
    REVOKE UPDATE, DELETE ON commission_records FROM sgs_app;
    REVOKE UPDATE, DELETE ON audit_log FROM sgs_app;
  END IF;
END $$;
```

### dnd-kit sobre a grade
```tsx
// Source: https://docs.dndkit.com (core API: DndContext, useDraggable, useDroppable, sensors)
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  useSensor(KeyboardSensor),
);
function onDragEnd({ active, over, delta }: DragEndEvent) {
  const appt = byId.get(String(active.id)); if (!appt) return;
  const slots = Math.round(delta.y / slotHeight);          // 30 min por slot
  const startsAt = addMinutes(new Date(appt.startsAt), slots * 30);
  const professionalId = String(over?.id ?? appt.professionalId);
  if (slots === 0 && professionalId === appt.professionalId) return;
  moveAppointment({ variables: {...}, optimisticResponse: {...errors: []} });
}
```

### Resolver de comissão (puro)
```typescript
export type RuleLite = { id: string; scopeType: 'member_service'|'service'|'category'|'product'|'default';
  kind: 'fixed'|'percentage'; value: string; memberId?: string|null; serviceId?: string|null;
  categoryId?: string|null; productId?: string|null };
export function resolveCommissionRule(rules: RuleLite[], item:
  { kind: 'service'|'product'; memberId: string; serviceId?: string; productId?: string;
    categoryChain: string[] /* da categoria do serviço até a raiz */ }): RuleLite | null {
  const find = (p: (r: RuleLite) => boolean) => rules.find(p) ?? null;
  if (item.kind === 'product')
    return find(r => r.scopeType==='product' && r.productId===item.productId) ?? find(r => r.scopeType==='default');
  return find(r => r.scopeType==='member_service' && r.memberId===item.memberId && r.serviceId===item.serviceId)
    ?? find(r => r.scopeType==='service' && r.serviceId===item.serviceId)
    ?? item.categoryChain.map(cid => find(r => r.scopeType==='category' && r.categoryId===cid)).find(Boolean) ?? null
    ?? find(r => r.scopeType==='default');
}
```
(Índices únicos parciais da Phase 2 garantem ≤1 regra ativa por escopo/chave.)

## State of the Art

| Old Approach | Current Approach | Impacto |
|--------------|------------------|---------|
| `hashtext` (int4) para advisory lock | `hashtextextended(text, seed)` → bigint | menos colisões, chave de 64 bits direta |
| `react-beautiful-dnd` | `@dnd-kit/core` (rbd arquivado) | mantido, a11y por teclado |
| `@dnd-kit/react` 0.x | permanece 0.x (0.5.3 em 2026-10) | não adotar ainda |
| date-fns-tz | `@date-fns/tz` (`TZDate`) com date-fns 4 | só se o time quiser lib de datas |
| Recharts 2.x + React 19 | Recharts 3.x tem `react-is ^19` | override resolve no 2.15 |

**Deprecated/outdated:** `pg_advisory_lock` de sessão em pool transacional; `SEQUENCE` por tenant.

## Open Questions

1. **Definição de "receita" no FIN-01 (competência x caixa).**
   - Sabemos: sinais entram como caixa na data do sinal; a comanda é fechada depois.
   - Incerto: o dono quer "receita = faturamento de comandas fechadas" ou "dinheiro que entrou"?
   - Recomendação: expor ambos (Faturamento por bucket + Recebido por método), com o breakdown por método vindo de `cash_movements` e rótulos explícitos. Implementar assim e confirmar na revisão da UI; trocar é só SQL.
2. **Formato exato do erro do Prisma para 55P03/23P01 em operações tipadas dentro de `$transaction` interativa (Prisma 6.x).**
   - Sabemos: o repo já trata `P2004` ou `meta.code==='23P01'`; SQL cru traz `P2010` + `meta.code`. Verificado no Postgres que 55P03 e 23P01 são os SQLSTATEs reais.
   - Incerto: o formato exato nesta versão (o client não está gerado neste sandbox — `prisma generate` não rodou, e a conexão `sgs_migrator` falhou por senha, então não executei o teste).
   - Recomendação: o **primeiro** teste de integração da fase (`phase3-concurrency.e2e.spec.ts`) trava o formato; `isPgError` já cobre `meta.code`, `code` e `message`. Fazer o lock via `$executeRaw` (formato conhecido).
3. **`business_hours` / "fora de expediente" (D-04, ROADMAP-MOCKS M2).**
   - Não está em D-01..D-21 nem nos success criteria da fase. A grade usa constantes (`WORK_START_HOUR` etc.).
   - Recomendação: **não construir** `business_hours` agora; "fora do expediente" fica visual/constante, e bloqueios cobrem folga/intervalo. Registrar como adiado (M8/Configurações). Se o dono exigir bloqueio duro, vira um plano extra pequeno.
4. **Pacote na comanda: rateio de preço e unidades.** Recomendação em Pattern 2 (rateio proporcional ao `base_price`, resto no último). Confirmar que o desconto do pacote deve reduzir a base da comissão (assumido: sim, comissão sobre o valor efetivamente cobrado).
5. **Item sem regra de comissão aplicável.** Recomendado: **sem registro** e sinal na UI ("sem comissão"); alternativa seria registro de R$ 0,00. `commissions` Phase 2 não obriga regra `default`.
6. **`fixed` é por linha ou por unidade?** Recomendado por linha de comanda (documentar na UI de regra/comissão).
7. **`clientHistory` (stub da Phase 2).** Não é requisito da Phase 3 (REQ CLI-02 mapeado a M6/ROADMAP-MOCKS). Recomendação: **não** incluir; se sobrar capacidade, agregação simples sobre appointments+comandas fecha o gap. Manter o stub intacto (não remover D-23 tooltips).
8. **Desconto no item/comanda.** Fora dos decisions; a sub-página "Motivos de desconto" continua gated (`financeiroRelatorios`). Nesta fase, `unit_price` é editável por quem tem `comanda.write` com o preço-snapshot original preservado em `list_price`? Recomendação: **sem desconto**; `unit_price` = preço da variante/serviço; ajuste de preço exige novo plano (com `discount_reason`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | todo o backend/integration | ✓ (local, 5432) | 16.13 | — |
| PgBouncer (transaction mode) | testes de integração (DATABASE_URL :5433) | ✓ | up em :5433 | — |
| `btree_gist` | exclusion constraint | ✓ (migration `20260919113000` já cria) | — | — |
| psql / docker | verificações | ✓ | — | — |
| Node | build/testes | ✓ default **v26.9.0**; nvm tem 20.20.0, 22.12.0, 24.14.0 | projeto declara Node 20/22 | `nvm use 22` antes de rodar |
| pnpm | todos os comandos do repo | ✗ não está no PATH do sandbox | — | `corepack enable` / `npx pnpm`; CI usa pnpm |
| `sgs_migrator` (DIRECT_URL) | `adminPrisma` nos testes | senha do `.env.example` **não autenticou** neste sandbox | — | usar o `.env` real do ambiente que roda os testes; CI sobe do zero |
| Prisma Client gerado | tipos/testes | ✗ não gerado neste sandbox (sem `.prisma`) | — | `pnpm prisma:generate` |
| Playwright Chromium | E2E | não verificado | — | CI instala (`playwright install --with-deps chromium`) |

**Missing dependencies with no fallback:** nenhuma para o planejamento. **Com fallback:** pnpm/Prisma generate/DIRECT_URL (preparar ambiente antes de executar).

## Validation Architecture

> `workflow.nyquist_validation = true` em `.planning/config.json` ⇒ seção incluída.

### Test Framework

| Property | Value |
|----------|-------|
| Backend unit | Jest 29 + ts-jest, `apps/backend/jest.config.ts` (`rootDir: src`, `*.spec.ts`) |
| Backend integration | Jest `apps/backend/jest-integration.config.ts` (`rootDir: test/integration`, `testRegex '.*\.spec\.ts$'`, setup `setup.ts` com `adminPrisma` (DIRECT_URL) e `appPrisma` (DATABASE_URL via PgBouncer), timeout 30 s, `--runInBand`) |
| Frontend | Vitest 2 + jsdom + Testing Library (`apps/frontend/vitest.config.ts`) |
| E2E | Playwright 1.55 (`apps/e2e`), 1 worker, backend em :3100, frontend :5180, `timezoneId: America/Sao_Paulo`; seed via API em `tests/seed.setup.ts` → `.e2e-state/seed.json` |
| CI | `.github/workflows/ci.yml`: jobs typecheck, lint, integration (postgres+pgbouncer+valkey, `pnpm test:integration`), e2e (`pnpm --filter @sgs/e2e test:e2e`), codegen check |

**Comandos (os do repo):**
- Quick backend unit (um arquivo): `pnpm --filter @sgs/backend test -- commission-resolver`
- Backend unit completo: `pnpm --filter @sgs/backend test`
- Integration (um arquivo): `pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-<tema>.e2e.spec`
- Integration completo: `pnpm --filter @sgs/backend test:integration`
- Frontend: `pnpm --filter @sgs/frontend test -- <padrão>` ; typecheck `pnpm -r typecheck` ; lint `pnpm -r --if-present lint`
- E2E: `pnpm --filter @sgs/e2e test:e2e` (um arquivo: `… test:e2e -- tests/<nome>.spec.ts`)
- **Atenção:** nome `phase3-*.e2e.spec.ts` (ponto) — `*.e2e-spec.ts` não é descoberto. `pnpm --filter @sgs/backend test:e2e` está quebrado (config inexistente); não usar.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | Mutações concorrentes na mesma raia, intervalos **sobrepostos com início diferente**: exatamente 1 sucesso, outro `SLOT_TAKEN`; vs `time_block`; `lock_timeout` → 55P03 mapeado | integration | `pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-scheduling-concurrency.e2e.spec` | ❌ Wave 0 |
| SCHED-01 | Constraint recriada protege `in_progress`/`completed` | integration | `… --testPathPattern phase3-schema-smoke.e2e.spec` | ❌ Wave 0 |
| SCHED-01 | `scopeProfessionalFilter` / vista semana consulta intervalo certo | unit | `pnpm --filter @sgs/frontend test -- week-range` | ❌ Wave 0 |
| SCHED-02 | move: valida conflito/bloqueio/mesma duração, muda de raia, bloqueia `cancelled` | integration | `… --testPathPattern phase3-appointments-move.e2e.spec` | ❌ |
| SCHED-02 | Arrastar card em outra hora/raia persiste; arrastar sobre ocupado volta com toast | E2E | `pnpm --filter @sgs/e2e test:e2e -- tests/agenda-dnd.spec.ts` | ❌ |
| SCHED-02 | revert otimista com `errors[]` não escreve no cache | unit (vitest, MockedProvider) | `pnpm --filter @sgs/frontend test -- move-appointment` | ❌ |
| SCHED-03 | CRUD de 4 kinds; feriado org-wide impede agendar qualquer profissional; criar bloqueio sobre appointment existente é recusado; cores por kind | integration + unit | `… --testPathPattern phase3-time-blocks.e2e.spec` | ❌ |
| SCHED-04 | Sinal R$50 cria credit(+50)/cash(deposit_in)/`deposit_amount`; cancelar com sinal mantém crédito e exige motivo; cancelar sem sinal só libera horário | integration | `… --testPathPattern phase3-deposit-cancel.e2e.spec` | ❌ |
| POS-01 | Criar visita → N appointments + 1 comanda + N itens com código `C-AAAA-NNN`; walk-in com cliente mínimo; adicionar/remover item; pacote rateado soma exata | integration + unit (`money.ts`) | `… --testPathPattern phase3-comanda-open.e2e.spec` ; `pnpm --filter @sgs/backend test -- money` | ❌ |
| POS-01 | Código sequencial concorrente: 20 criações paralelas ⇒ 20 códigos distintos e contíguos; virada de ano por tz | integration | `… --testPathPattern phase3-comanda-code.e2e.spec` | ❌ |
| POS-02 | 5 métodos + crédito aceitos; método inválido rejeitado; crédito > saldo recusado | integration | `… --testPathPattern phase3-comanda-payments.e2e.spec` | ❌ |
| POS-03 | Pix 100 + dinheiro 50 + crédito 50; `falta`/`troco`; troco só com linha de dinheiro; fecha apenas se `pago >= total`; duplo `closeComanda` concorrente fecha 1 vez | integration | `… --testPathPattern phase3-comanda-close.e2e.spec` | ❌ |
| FIN-02 | Resolver: precedência member_service>service>category(hier.)>default / product>default; arredondamento; fixed | unit | `pnpm --filter @sgs/backend test -- commission-resolver` | ❌ |
| FIN-02 | Fechar grava snapshot (`rule_snapshot`), editar/apagar regra depois **não** muda registro; `sgs_app` não consegue UPDATE/DELETE em `commission_records` (REVOKE) | integration | `… --testPathPattern phase3-commission-records.e2e.spec` | ❌ |
| FIN-02 | Estoque baixa na venda e volta no reabrir; reabrir reverte comissão (reversal), crédito, caixa; exige `comanda.reopen` + motivo; grava `audit_log`; ATTENDANT proibido; refechar gera novo ciclo | integration | `… --testPathPattern phase3-comanda-reopen.e2e.spec` | ❌ |
| FIN-01 | Totais por dia/semana/mês e breakdown por método; dias vazios; comanda às 23:30 local cai no dia certo; reconcilia com `cash_movements`; só ADMIN/MANAGER | integration | `… --testPathPattern phase3-financial-dashboard.e2e.spec` | ❌ |
| FIN-01 | Presets Hoje/Ontem/Semana/Mês atual/Mês anterior em America/Sao_Paulo | unit (vitest) | `pnpm --filter @sgs/frontend test -- period` | ❌ |
| FIN-01 | Dashboard exibe KPIs/gráfico/breakdown com dado real | E2E | `… test:e2e -- tests/financeiro-dashboard.spec.ts` | ❌ |
| Transversal | RLS: org B não lê/escreve tabelas novas; PROFESSIONAL só vê suas comandas/comissões; matriz de permissões = `ROLE_PERMISSIONS` | integration | `… --testPathPattern phase3-rls-rbac.e2e.spec` | ❌ |
| Transversal | Migration aplicada: tabelas, RLS FORCE, CHECKs, constraint recriada, permissões seed | integration | `… --testPathPattern phase3-schema-smoke.e2e.spec` | ❌ (modelo: `phase2-schema-smoke.spec.ts`) |

**Cobertura E2E dos 5 critérios de sucesso (Playwright, `apps/e2e/tests/`):**

| # | Critério | Spec E2E proposto |
|---|----------|-------------------|
| 1 | Agenda com raias e arrastar sem double-booking | `agenda-dnd.spec.ts`: (a) arrastar para horário livre persiste (reload mantém), (b) arrastar sobre card ocupado do mesmo profissional ⇒ volta + toast "Não foi possível mover" |
| 2 | Agendamento + sinal R$50 + comanda + serviços/produtos + pagamento dividido Pix+dinheiro | `fluxo-agendamento-comanda-pagamento.spec.ts`: UI cria agendamento com sinal 50, abre comanda, adiciona produto, paga crédito(50)+Pix+dinheiro, fecha; assert na UI e via API (estoque baixou) |
| 3 | Comissão calculada e snapshot imutável sem intervenção | no mesmo spec: após fechar, `commissionRecords` via API tem registro com `ruleSnapshot`; editar regra depois não altera; `/financeiro/comissoes` mostra o valor (login como PROFESSIONAL vê só o dele) |
| 4 | Dashboard receita dia/semana/mês + breakdown por método | `financeiro-dashboard.spec.ts`: valores batem com a comanda fechada do spec anterior (ordem determinística no projeto único `chromium`/1 worker) |
| 5 | Dois agendamentos simultâneos ⇒ erro claro ao segundo | `agenda-concorrencia.spec.ts`: duas mutações GraphQL em `Promise.all` (mesmo profissional, intervalos sobrepostos de início diferente); 1 ok + 1 `SLOT_TAKEN`; e na UI o modal mostra a mensagem. Cobertura primária fica no integration (`phase3-scheduling-concurrency`) |

Seed E2E: estender `tests/seed.setup.ts`/`support/seed-state.ts` com cliente, serviço com categoria, produto com estoque, regra de comissão (service) e profissional já existentes — via API, como já é feito. Playwright: respeitar a regra do repo de usar `expectNoReload`/`loginViaUi`/`navigateViaMenu` helpers de `support/ui.ts`.

### Sampling Rate
- **Por commit de task:** unit do módulo tocado (backend `pnpm --filter @sgs/backend test -- <arquivo>` ou frontend `pnpm --filter @sgs/frontend test -- <arquivo>`) + `pnpm -r typecheck`.
- **Por merge de wave:** `pnpm --filter @sgs/backend test:integration -- --testPathPattern phase3-` + `pnpm --filter @sgs/frontend test` + lint.
- **Gate da fase:** suíte integration completa + `pnpm --filter @sgs/e2e test:e2e` verdes (job `e2e` do CI) antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/backend/test/integration/phase3-schema-smoke.e2e.spec.ts` — migration, RLS, CHECK, constraint recriada, REVOKE, permissões seed (modelo `phase2-schema-smoke.spec.ts`)
- [ ] Helper de seed de integração `test/integration/helpers/phase3-fixtures.ts` (org + profissionais + cliente + serviço + produto + regra) — hoje cada suíte repete o setup; criar um para as ~10 suítes novas
- [ ] Atualizar cleanups existentes (`members-lifecycle`, `professional-categories`, seed do E2E) para as tabelas novas ou usar `ON DELETE CASCADE` (Pitfall 12)
- [ ] `apps/frontend/src/features/operations/lib/{money,period}.ts` com testes unit
- [ ] Dependências `@dnd-kit/*` + override `react-is` (Pitfall 7)
- [ ] Spike de 30 min no 1º teste de concorrência para travar o formato do erro Prisma (Open Question #2)

## Plano sugerido (9 planos, 5 waves)

> Segue a granularidade da Phase 2 (migration consolidada primeiro; backend por bounded context; frontend por tela). Cada plano que mexe em API pública termina com seus testes de integração.

| Wave | Plano | Conteúdo | Reqs | Depende de |
|------|-------|----------|------|-----------|
| 1 | **03-01 database-schema** | Migration única (tabelas, ALTER appointments + constraint recriada, REVOKEs, RLS, seed de permissões) + `schema.prisma` + `permissions.catalog.ts` + `phase3-schema-smoke` + fixtures + ajuste dos cleanups | todos (base) | – |
| 2 | **03-02 backend-scheduling** | `advisory-lock.ts`; `move/update/cancel/setStatus`; `time_blocks` CRUD; sinal (credit+cash); `createVisit`; SDL; testes de concorrência/move/time-blocks/deposit-cancel | SCHED-01..04 | 01 |
| 2 | **03-03 backend-comandas-core** | módulo `comandas`: código, abrir (da visita / walk-in com cliente mínimo), itens (variante/pacote rateado), pagamentos (add/remove, falta/troco), `money.ts`, queries `comanda(id)`/`comandasByDate`, escopo PROFESSIONAL | POS-01..03 | 01 |
| 3 | **03-04 backend-close-reopen-commissions** | `commission-resolver.ts` (puro) + `applyStockDelta` extraído + `closeComanda`/`reopenComanda` + `audit_log` + crédito (lock cliente) + cash movements; testes de close/reopen/commission-records | POS-03, FIN-02 | 02, 03 |
| 3 | **03-05 backend-financial** | `financialSummary` (SQL), `commissionRecords`, `cashMovements`, `clientCreditBalances` + `adjustClientCredit`; testes de dashboard/RBAC/RLS | FIN-01, FIN-02 | 03 (tabelas), 04 (dados) |
| 4 | **03-06 frontend-agenda** | trocar mocks por API; dnd-kit; vista semana; bloqueios (4 cores); campo sinal; cancelar com motivo; status; remover `schedule.mock.ts`; `agendaRelatorio` permanece off | SCHED-01..04 | 02 |
| 4 | **03-07 frontend-comanda** | lista `/comanda` + `ComandaPage` real (itens, pagamento dividido com falta/troco, walk-in, fechar, reabrir com motivo, crédito); atualizar menu (`/comanda`); flag `comanda`; remover `comanda.mock.ts` | POS-01..03 | 03, 04 |
| 4 | **03-08 frontend-financeiro** | `/financeiro` (presets+range, KPIs, Recharts, breakdown), `/financeiro/comissoes` (profissional vê só o seu), `/financeiro/credito-cliente`; **flags**: `financeiro`, `financeiroComissoes` + nova flag por-rota para `credito-cliente` (hoje atrelada a `financeiroRelatorios`, que deve continuar off); remover `financeiro.mock.ts` | FIN-01, FIN-02 | 05 |
| 5 | **03-09 e2e-and-verification** | specs Playwright dos 5 critérios + seed estendido + ajuste no job `e2e`; `03-VERIFICATION` com a nota da redução POS-02 | todos | 06, 07, 08 |

Paralelismo: 02 ∥ 03; 04 ∥ 05 (05 precisa só do schema; testes que dependem de comandas fechadas usam fixtures SQL); 06 ∥ 07 ∥ 08.

## Project Constraints (from CLAUDE.md)

- **Stack fixa:** Node 20 LTS + NestJS 10 + GraphQL (Apollo, schema-first SDL) + Prisma + PostgreSQL 16 + Redis; frontend React + TS + Vite + Apollo Client 3 + Tailwind 3 + shadcn/ui. (O repo está em Prisma 6, Valkey 8, React 19/Vite 6 — seguir o repo.)
- **Multi-tenancy por RLS** — "não negociável": todas as tabelas novas com `organization_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation` (USING + WITH CHECK).
- **PgBouncer transaction mode obrigatório** — nada de `SET` de sessão, advisory lock de sessão ou `LISTEN`; só `SET LOCAL`/`*_xact_*`.
- **Compliance:** LGPD (walk-in coleta o mínimo: nome + telefone opcional; audit_log para ações sensíveis), **WCAG 2.1 AA** (DnD com `KeyboardSensor`; foco e `aria-label` nos cards/slots; contraste das 4 cores de bloqueio), OWASP (queries parametrizadas — `$queryRaw` tagged template; o único `Unsafe` permitido é o `SET LOCAL` com número interno).
- **Testes:** 80% de cobertura unitária no domínio (resolver de comissão, money, período, regras de status = código puro e testável), E2E nos fluxos críticos, PR bloqueado em falha.
- **GSD workflow:** edições de repositório passam por comando GSD (`/gsd:execute-phase`); esta pesquisa só escreve o RESEARCH.md.
- **Memória do usuário (CONTEXT specifics):** toda entrada de valor/data/hora/%/CPF/telefone nasce com **máscara BR** (`currency-mask.ts`: `maskCurrency`/`unmaskCurrency`/`formatCurrencyDisplay`); não copiar cores Trinks — manter `#570080`, `PageHeader` + breadcrumbs; UI em pt-BR via i18n (`operations.*` já existe em `pt-BR.json`).
- Idioma da conversa/artefatos: PT-BR.

## Sources

### Primary (HIGH confidence)
- Código do repositório (leitura direta): `apps/backend/src/appointments/*`, `database/tenant-context.service.ts`, `authz/permissions.catalog.ts` + `guards/permission.guard.ts`, `catalog/commissions/commissions.service.ts`, `catalog/products/products.service.ts` (`adjustStock`), `identity/member-categories.ts`, `prisma/schema.prisma`, migrations (`20260919113000_appointments`, `20260506000000_phase2_catalog_clients`, `20260502000000_init…`, `20260929120000_…`), `apps/frontend/src/config/features.ts`, `router.tsx`, `SchedulePage.tsx`, `ComandaPage.tsx`, `mocks/*`, `package.json` (backend e frontend), `.github/workflows/ci.yml`, `apps/e2e/*`, `jest*.config.ts`, `test/integration/setup.ts`
- Verificação empírica no PostgreSQL 16.13 local via PgBouncer (:5433, role `sgs_app`): `pg_advisory_xact_lock` em transação; `lock_timeout` aplicado a advisory lock (erro "canceling statement due to lock timeout"); `hashtextextended` → bigint; exclusion constraint → `23P01`
- `npm view` (2026-11-01): `@dnd-kit/core` 6.3.1, `@dnd-kit/modifiers` 9.0.0, `@dnd-kit/react` 0.5.3, `date-fns` 4.4.0, `@date-fns/tz` 1.5.0, `recharts` 3.10.1, `@fullcalendar/resource-timeline` 6.1.22 (licença `SEE LICENSE`)
- https://fullcalendar.io/license — uso comercial de plugins Premium por empresa com fins lucrativos exige licença comercial (grátis só ONG registrada / projeto AGPLv3)

### Secondary (MEDIUM confidence)
- Comportamento de `pg_advisory_xact_lock_shared` e ordem de aquisição (documentação PostgreSQL, conhecimento consolidado; não re-fetchado nesta sessão)
- `Recharts 2.x + React 19 + react-is` como causa de gráfico vazio (problema conhecido do ecossistema; a versão resolvida no repo foi **verificada** — 18.3.1 com React 19.2.5 — mas o sintoma não foi reproduzido aqui)
- Formato dos erros do Prisma (P2010/P2004) — inferido do código existente e de uso comum; não executado

### Tertiary (LOW confidence)
- Nenhum dado de decisão depende só de busca web. Comportamento de `dragTo` do Playwright com dnd-kit é experiência geral (recomenda-se spike no spec de DnD).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — sem libs novas de backend; dnd-kit verificado no registry; FullCalendar descartado por licença oficial
- Architecture (lock, constraint, transação de fechamento, sequência): HIGH — comportamento do Postgres confirmado empiricamente; padrões já usados no repo (`FOR UPDATE`, RLS)
- Modelo de dados / contabilização da receita: MEDIUM — decisões de design com 2 perguntas abertas para o dono (Open Questions #1, #4)
- Pitfalls: HIGH para os derivados do código (status/constraint, cleanups, regex do Jest, seed de permissões); MEDIUM para Recharts/React 19 e formato de erro do Prisma

**Research date:** 2026-11-01
**Valid until:** ~30 dias (stack estável); revalidar `@dnd-kit/react` e Recharts 3 se a decisão for revisitada

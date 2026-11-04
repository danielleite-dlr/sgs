# Phase 4: Bridal & Contracts - Research

**Researched:** 2026-11-03
**Domain:** Eventos de noivas (agenda multi-profissional), contratos com aceite digital público, ledger financeiro de contrato, job BullMQ diário, sugestão de agenda via Claude API (NestJS 10 + Prisma 6 + PostgreSQL 16 + RLS)
**Confidence:** MEDIUM-HIGH (código do repo e SDK verificados diretamente; semântica de runtime da API Claude lida dos tipos do SDK 1.4.0, não de docs oficiais)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(D-01..D-21 copiados de `04-CONTEXT.md`; o planejador DEVE honrá-los literalmente.)

**Grupo de noivas e evento**
- **D-01:** Grupo de noivas = **evento** com data, noiva principal (cliente) e acompanhantes (madrinhas, mãe etc.). Cada pessoa do grupo tem seus serviços.
- **D-02:** **Acompanhante é cliente mínima** — nome + telefone opcional, mesmo padrão do walk-in da fase 3 (03 D-06). Pode escolher cliente existente ou criar no ato. Fica com histórico e pode voltar como cliente normal.
- **D-03:** **Serviços do evento viram agendamentos reais** (pessoa × serviço × profissional × horário), usando o mesmo lock anti-conflito por profissional da fase 3 (03 D-01 ajustado) e a exclusion constraint. A agenda mostra os profissionais ocupados com o evento.
- **D-04:** **Local do evento: estúdio (padrão) ou externo** (endereço: casa da noiva, hotel etc.), com **tempo de deslocamento opcional** que bloqueia o profissional antes/depois (time_block ou equivalente) para atendimento externo.
- **D-05:** **Contrato pode incluir atendimentos antes do evento** (ex.: teste de maquiagem/penteado semanas antes), que também viram agendamentos vinculados ao grupo/contrato.

**Quem paga o quê**
- **D-06:** **O contrato é da noiva.** Ele pode cobrir **nenhuma, uma ou mais acompanhantes** (ex.: a mãe). Cada pessoa do grupo tem uma marcação "incluída no contrato" ou "paga avulso".
- **D-07:** **Acompanhante avulsa (fora do contrato) — o caso mais comum (madrinhas):** sem contrato; tem agendamento + comanda própria como qualquer cliente da fase 3. Fluxo usual: **sinal antes** (crédito de cliente, 03 D-03) + **quitação na comanda no dia**. Pagar tudo antes é raro, mas é permitido (sinal = valor total).
- **D-08:** **Pessoa incluída no contrato:** no dia, a comanda gerada pelo agendamento **abate do contrato** (não cobra de novo). Ela continua registrando comissão (03 D-12/D-23) e baixa de estoque (03 D-21). **Extras não previstos no contrato são cobrados na própria comanda**, como pagamento normal.
- **D-09:** **Itens por pessoa no contrato:** o contrato lista cada pessoa coberta com seus serviços/pacote (ex.: noiva: maquiagem + penteado; mãe: maquiagem). O valor total do contrato pode ter desconto sobre a soma dos itens.

**Contrato, entrada e restante**
- **D-10:** **Estrutura de pagamento do contrato = Entrada + Restante.** A entrada tem valor definido no **pacote de noiva** (R$ ou %) e vence na assinatura/aceite. O **restante deve ser quitado até X dias antes do evento** (padrão da org = **10 dias**).
- **D-11:** **Restante com pagamentos livres** — sem plano de parcelas: a noiva paga quanto quiser, quando quiser (ex.: mês a mês), até o prazo. O sistema controla o **saldo devedor** e o **prazo final (data do evento − X dias)**. Os "vencimentos" que geram alertas são: entrada e prazo final do restante.
- **D-12:** **Configuração:** o valor de entrada fica no **pacote** (campo novo no catálogo para pacotes de noiva); o prazo "quitar até X dias antes" é **padrão da organização (10)**. Ambos podem ser **ajustados em cada contrato** (valores gravados no contrato como snapshot).
- **D-13:** **Pagamento de contrato = registro manual no caixa**, mesmo padrão da fase 3: método (dinheiro, Pix, crédito, débito, transferência — 03 D-09) + valor, aceitando pagamento parcial e múltiplos métodos, e gerando `cash_movements`. Pix sem QR (03 D-10).
- **D-14 (financeiro/dashboard):** cada pagamento de contrato conta em **Faturado e Recebido na data em que é pago** (entrada entra no dashboard quando paga; cada pagamento do restante, quando pago). As **comandas do evento que abatem do contrato NÃO contam de novo no Faturado**; só os extras cobrados na comanda somam. Isso é uma **exceção explícita à 03 D-22** (Faturado = comandas fechadas) para receita de contrato.

**Aceite digital**
- **D-15:** **Aceite por link nesta fase.** O proprietário gera um **link público único** do contrato. A noiva abre, lê o contrato, **informa nome + CPF** e clica "Aceito". O sistema registra data/hora, IP, user-agent e **hash do texto exato aceito**. O registro de aceite é imutável (append-only, padrão dos ledgers da fase 3). Até a fase 5, o link é enviado manualmente (copiar link → WhatsApp). Depois de aceito, o contrato também pode ser baixado em PDF.
- **D-16:** **Texto do contrato vem de um modelo editável da org**, com variáveis automáticas: nome/CPF da noiva, data e local do evento, pessoas e serviços incluídos, valor total, entrada, prazo do restante, política de cancelamento. O sistema traz um **modelo padrão** para o template de estúdio de noivas. Alterar o contrato depois do aceite exige novo aceite (o hash muda).

**Cancelamento**
- **D-17:** **Política padrão (template de noivas): cliente cancela → retém 100% do que já foi pago; a entrada nunca é devolvida.** Nada é devolvido.
- **D-18:** **Política configurável (CONT-03):** a org pode trocar o padrão por **faixas de retenção por antecedência** (ex.: <30 dias → retém 50% do total). A política vigente é copiada para o contrato como **snapshot** na criação.
- **D-19:** **Cancelamento pelo estúdio → devolve tudo, inclusive a entrada** (saída no caixa). Cancelar contrato exige **motivo obrigatório** e é restrito a **ADMIN/MANAGER** (mesmo padrão de 03 D-08/D-15/D-20). Cancelar o contrato cancela os agendamentos vinculados a ele, com o mesmo motivo.

**Alertas automáticos**
- **D-20:** **Alertas gerados por job diário** (BullMQ repeatable, no fuso da org): (1) Restante **vence em 3 dias** / **vencido** (saldo > 0 depois do prazo D-X); (2) **Entrada não paga** depois de N dias da criação/aceite do contrato; (3) **Contrato não aceito** N dias depois de o link ser gerado; (4) **Sinal de acompanhante avulsa pendente** perto do evento. Os limiares N ficam a critério do planejador, com padrões razoáveis, configuráveis por org se for barato.
- **D-21:** **Canal: in-app + e-mail diário.** O sistema cria notificação no sino (tabela `notifications`, já existente) para **ADMIN/MANAGER** e envia **um resumo diário por e-mail** (EmailService/Resend existente). Não repetir o mesmo alerta todos os dias no sino (deduplicar por contrato + tipo + estado). Lembrete para a noiva por e-mail/WhatsApp **fica fora** (fase 5).

### Claude's Discretion
- **Sugestão de agenda IA (AI-01) — não discutida; diretriz:** "Sugerir agenda IA" monta uma **proposta editável** (pessoa × serviço × profissional × horário) que o proprietário revisa e confirma. **Nada é gravado na agenda sem confirmação** (SDD §13.2: sugestivo, não vinculante). A sugestão considera disponibilidade (agendamentos + time_blocks), duração dos serviços, profissionais habilitados por serviço, deslocamento (D-04) e ordem lógica (noiva por último / mais perto do horário da cerimônia). A saída do Claude deve ser validada (estrutura + conflitos) antes de exibir. O sistema precisa funcionar **sem a chave da API ou quando a API falha** (mensagem clara e, se viável, sugestão heurística simples), com cache de respostas e limite de uso por org (CLAUDE.md). O planejador escolhe o modelo Claude (preferir o mais recente/capaz, conforme `claude-api` skill).
- Modelo de dados exato (bridal_groups / members / contracts / contract_items / contract_payments / acceptances) — seguir os PRDs como base e adaptar às decisões acima.
- Código curto legível do contrato (ex.: `CT-2026-001`, padrão de 03 D-19) — recomendado.
- Layout das telas (placeholders já existem em `features/bridal/`).
- Geração de PDF (lib/abordagem).
- Permissões granulares novas (ex.: `bridal.manage`, `contract.cancel`, `contract.payment.record`) seguindo o catálogo de permissões existente.
- Como o abatimento da comanda no contrato é modelado (novo método interno "contrato" × crédito vinculado ao contrato), desde que respeite D-08 e D-14 e não conte duas vezes.

### Deferred Ideas (OUT OF SCOPE)
- Envio do link de aceite e lembretes para a noiva por WhatsApp/e-mail automático — fase 5 (Communication).
- Pix com QR/gateway para pagar a entrada/restante — fase 5 (03 D-10).
- "Sistema aprende com os ajustes manuais da sugestão de IA" (SDD §13.2) — futuro, fora desta fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-03 | Grupo de noivas: noiva principal + acompanhantes, mesmo evento | Tabelas `bridal_groups` + `bridal_group_members`; acompanhante = cliente mínima (walk-in, migração `20261102000000`); agendamentos reais via `createVisitTx` por pessoa (Pattern 2) |
| CONT-01 | Contrato de evento com valor total, parcelamento (reinterpretado: entrada + restante livre) e vencimentos | `contracts` + `contract_items` + `contract_payments` (ledger); datas derivadas (`balance_due_date = event_date - N dias`); snapshots (D-12); aceite digital (D-15/16) |
| CONT-02 | Rastrear status e alertar vencimentos próximos/atrasos | Status derivado (saldo, prazo) calculado em função pura; job diário BullMQ + `notifications` deduplicadas + e-mail resumo (Pattern 5) |
| CONT-03 | Política de cancelamento configurável com retenção | `contract_settings.cancellation_policy` (JSON validado por Zod) copiada como snapshot; função pura `computeCancellationSettlement` com testes de tabela (Pattern 4) |
| AI-01 | Sugestão de alocação ótima via Claude API | `@anthropic-ai/sdk` 1.4.0 `messages.parse` + `zodOutputFormat`, validação de conflitos, cache por hash, limite por org, fallback heurístico (Pattern 6) |
</phase_requirements>

## Summary

A fase é majoritariamente **composição de padrões já existentes** na Fase 3: ledgers append-only com `REVOKE UPDATE, DELETE`, locks advisory por profissional (`acquireScheduleLocks`), `createVisitTx` (N agendamentos + 1 comanda), `recordCashMovement`/`recordAudit`, códigos curtos por sequência (`comanda_sequences`), notificações com dedupe (padrão `stock_low`). Os três itens genuinamente novos são: (1) o **primeiro processador BullMQ** (job agendado), (2) a **rota pública sem autenticação** (o repo é 100% GraphQL com guards GraphQL-bound; não há rate limit nem `trustProxy`), e (3) a **integração Claude** (SDK ainda inexistente no repo).

Três armadilhas estruturais descobertas no código: **(a)** `organizations` tem RLS FORCE, então o job diário **não consegue listar orgs** sem uma função `SECURITY DEFINER` (mesmo padrão de `auth_user_memberships`); **(b)** o `JwtAuthGuard` global usa `GqlExecutionContext`, então qualquer controller REST precisa de `@Public()` e não consegue autenticar o dono (PDF do dono deve sair por GraphQL em base64, e o público por REST `@Public()`); **(c)** o `FastifyAdapter` não tem `trustProxy`, então atrás do nginx `req.ip` seria o IP do proxy — o IP gravado no aceite (D-15) e o rate limit ficariam errados.

Para D-08/D-14 a modelagem recomendada é **cobertura por item de comanda** (`comanda_items.contract_id`): o valor coberto não gera pagamento nem `cash_movement`, é descontado do "a pagar" no fechamento e é excluído do Faturado por uma subtração no SQL do dashboard; a receita do contrato entra por um ledger próprio `contract_payments` (assinado, inclui estornos/reembolsos) por `paid_at`.

**Primary recommendation:** Reutilizar `createVisitTx` (estendido com `bridalGroupId/contractId/covered`) uma vez por pessoa dentro de UMA transação que adquire os locks de todos os profissionais ordenados primeiro; modelar abatimento como `comanda_items.contract_id`; público via REST `@Public()` + `@nestjs/throttler` 6.x + token de 256 bits guardado como SHA-256; job via `upsertJobScheduler` horário com checagem de hora local por org + tabela de idempotência; IA via `@anthropic-ai/sdk@1.4.0` com `claude-sonnet-5-5` por padrão, saída Zod, validação servidor e fallback heurístico determinístico.

## Project Constraints (from CLAUDE.md)

- Stack fixa: Node.js 20 LTS + NestJS 10 + GraphQL (Apollo, schema-first) + Prisma + PostgreSQL 16 + Redis/Valkey; frontend React + Vite + Apollo Client 3 + Tailwind 3 + shadcn/ui. **Não propor upgrade de NestJS/Fastify** (Nest 10.4.22, Fastify 4.28.1 instalados).
- **Multi-tenancy RLS não negociável** — toda tabela nova com `ENABLE` + `FORCE ROW LEVEL SECURITY` + policy `tenant_isolation` e entrada na suíte transversal.
- Compliance LGPD, WCAG 2.1 AA, OWASP. (CPF no aceite e dados enviados à API Claude exigem cuidado; ver Pitfalls.)
- Testes: 80% de cobertura unitária no domínio; E2E para fluxos críticos; bloqueio de PR em falha.
- CLAUDE.md "GSD Workflow Enforcement": edições de repo só via comandos GSD (esta pesquisa é artefato de planejamento).
- Não existem `.claude/skills/` nem `.agents/skills/` no projeto.
- Memória do usuário: toda a comunicação em PT-BR; gate completo (lint/typecheck/test) antes de commit.

## Standard Stack

### Core (já instalado — reutilizar)
| Library | Versão instalada | Purpose | Observação |
|---------|------------------|---------|------------|
| NestJS | 10.4.22 | Framework | manter 10 |
| Fastify | 4.28.1 | HTTP (via `@nestjs/platform-fastify` 10.4.22) | determina versões de plugins (ver abaixo) |
| Prisma Client | 6.19.3 | ORM + `$queryRaw` | |
| BullMQ | 5.76.5 (`upsertJobScheduler` presente — verificado em `queue.d.ts`) | Job diário | **não** subir para 6.x/Nest bullmq 12 (exige Nest 12) |
| @nestjs/bullmq | 10.2.3 (`WorkerHost` presente) | `@Processor` | manter |
| zod (backend) | 3.25.76 | Validação | satisfaz peer `^3.25.0 \|\| ^4` do SDK Anthropic |

### Novos (a instalar no backend)
| Library | Versão (npm, 2026-11-03) | Purpose | Por que |
|---------|--------------------------|---------|---------|
| `@anthropic-ai/sdk` | **1.4.0** (publicado 2026-11-02) | Claude API | SDK oficial; traz `messages.parse` + `zodOutputFormat` (helpers/zod) — verificado no tarball |
| `pdfkit` | **0.20.2** (2026-09-07) | PDF do contrato | Texto puro, sem browser/headless; Helvetica embutida cobre acentos PT-BR (WinAnsi); deps leves (fontkit, fflate, noble). CJS ok em Nest/ts-jest |
| `@nestjs/throttler` | **6.7.1** (2026-09-24) | Rate limit da rota pública | Peer Nest ^7..^12 (inclui 10); funciona em Fastify; escopo só no controller público |

### Alternativas consideradas
| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| pdfkit | pdfmake 0.3.13 | API declarativa (tabelas), mas fontes/vfs exigem configuração em Node; pdfkit basta para contrato textual |
| pdfkit | puppeteer 25.x / @react-pdf/renderer 4.9 | Puppeteer = Chromium no container (pesado, superfície de ataque); react-pdf puxa React no backend. **Não usar** |
| @nestjs/throttler | @fastify/rate-limit | **v11.2.2 (latest) é para Fastify 5**; para Fastify 4 seria a linha 9.x. Throttler evita descasamento |
| throttler in-memory | storage Redis (`@nest-lab/throttler-storage-redis`) | In-memory vale por instância; staging/prod hoje = 1 container backend (verificado `docker ps`). Documentar upgrade se escalar |
| `claude-sonnet-5-5` | `claude-opus-5-5` | Opus é o mais capaz; Sonnet 5.5 mais barato/rápido e suficiente para um problema de agenda pequeno com validação servidor. Tornar configurável por env |

**Não adotar:** `@nestjs/schedule` (cron em processo; duplica execução com múltiplas instâncias — BullMQ já resolve com lock distribuído), `pdf-lib` (sem manutenção desde 2022).

**Installation:**
```bash
pnpm --filter @sgs/backend add @anthropic-ai/sdk@1.4.0 pdfkit@0.20.2 @nestjs/throttler@6.7.1
pnpm --filter @sgs/backend add -D @types/pdfkit
```
(Versões confirmadas via `npm view` em 2026-11-03. `@types/pdfkit` não verificado — checar no install.)

**Modelos Claude (confirmados no union `Model` do SDK 1.4.0):** `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` existem (também `claude-fable-5-1`, `claude-mythos-5-1`; ignorar). Padrão recomendado: `claude-sonnet-5-5`; override via `ANTHROPIC_MODEL`.

## Architecture Patterns

### Estrutura recomendada
```
apps/backend/src/
├── bridal/                     # grupos de noivas, membros, agendamento do evento
│   ├── bridal.module.ts / bridal.resolver.ts / bridal.service.ts
│   ├── bridal-schedule.ts      # createBridalScheduleTx (locks + createVisitTx por pessoa + time_blocks de deslocamento)
│   └── ai/
│       ├── ai-schedule.service.ts   # orquestra: cache -> limite -> Claude -> validação -> fallback
│       ├── ai-schedule.schema.ts    # Zod do input/output
│       ├── schedule-validator.ts    # PURO: conflitos, durações, habilitação
│       └── heuristic-scheduler.ts   # PURO: fallback determinístico
├── contracts/
│   ├── contracts.module.ts / contracts.resolver.ts / contracts.service.ts
│   ├── contract-code.ts             # clone de comanda-code.ts (contract_sequences) -> CT-2026-001
│   ├── contract-math.ts             # PURO: totais, entrada, saldo, prazo, status derivado
│   ├── cancellation-policy.ts       # PURO + Zod do JSON de política + settlement
│   ├── contract-template.ts         # PURO: render de variáveis + sha256
│   ├── contract-payments.ts         # recordContractPayment/refund (ledger + cash)
│   ├── contract-pdf.service.ts      # pdfkit
│   ├── public-contract.controller.ts# REST @Public() + ThrottlerGuard
│   └── alerts/
│       ├── contract-alerts.queue.ts     # registra scheduler (onModuleInit)
│       ├── contract-alerts.processor.ts # WorkerHost -> chama service
│       └── contract-alerts.service.ts   # runForOrg(orgId, now) PURO-ish, testável sem Redis
└── config/env.schema.ts          # + ANTHROPIC_API_KEY?, ANTHROPIC_MODEL?, limites
apps/frontend/src/features/bridal/
├── api/  pages/  components/  lib/   # espelha features/operations (api/*.api.ts, lib/money.ts)
└── public/ContractAcceptPage.tsx     # rota pública fora do ProtectedRoute/AppShell
```

### Pattern 1: Modelo de dados (migração única `2026110X..._phase4_bridal_contracts`)

Base: PRD DB §4.3.3/§4.6 adaptado a D-01..D-19 (PRD previa `contract_installments`; **substituído** por entrada+restante livre — não criar tabela de parcelas).

| Tabela | Colunas-chave | Notas |
|--------|---------------|-------|
| `packages` (ALTER) | `deposit_kind VARCHAR(10) NULL CHECK IN ('fixed','percent')`, `deposit_value NUMERIC(12,2) NULL` | D-12. `percent` entre 0 e 100. Atualizar GraphQL/CRUD de pacotes (Fase 2) e a tela de pacotes |
| `contract_settings` | `organization_id PK`, `balance_due_days_before INT DEFAULT 10`, `cancellation_policy JSONB`, `template_body TEXT`, limiares de alerta (`alert_deposit_unpaid_days`, `alert_not_accepted_days`, `alert_companion_deposit_days`), `ai_daily_limit INT` | Uma linha por org (criar sob demanda com defaults). Preferível a `organizations.settings` JSONB (mantém CHECKs e RLS testável). Modelo padrão de noivas em constante TS usada como default |
| `bridal_groups` | `code`?, `name`, `event_date DATE`, `event_starts_at TIMESTAMPTZ` (hora da cerimônia/"pronta até"), `location_kind CHECK IN ('studio','external')`, `location_address TEXT`, `travel_minutes_before/after INT DEFAULT 0`, `status CHECK IN ('draft','confirmed','completed','cancelled')`, `notes`, `created_by`, `deleted_at` | `chk`: external ⇒ address NOT NULL |
| `bridal_group_members` | `group_id`, `client_id`, `role CHECK IN ('bride','companion')`, `relation_label`, `covered_by_contract BOOL DEFAULT false` | `UNIQUE(group_id, client_id)`; índice único parcial `ON (group_id) WHERE role='bride'` (1 noiva por grupo) |
| `appointments` (ALTER) | `bridal_group_id UUID NULL`, `contract_id UUID NULL`, `purpose VARCHAR(10) NULL CHECK IN ('event','trial')` | FKs; `ON DELETE SET NULL` como `comanda_id` |
| `time_blocks` (ALTER) | ampliar `chk_time_blocks_kind` com `'deslocamento'`; `bridal_group_id UUID NULL` | Mantém `chk_time_blocks_scope` (profissional NOT NULL). Permite cancelar/recriar blocos do grupo e rotular na agenda. `TIME_BLOCK_KINDS` (service) e rótulos do frontend precisam do novo kind; bloquear criação manual do kind |
| `contracts` | `code` (CT-AAAA-NNN), `bridal_group_id`, `client_id` (noiva), `status CHECK IN ('draft','awaiting_acceptance','active','completed','cancelled')`, `total_amount`, `discount_amount`, `deposit_amount`, `balance_due_days_before` (snapshot), `balance_due_date DATE` (recalcular se evento mudar), `cancellation_policy JSONB` (snapshot), `current_version INT`, `cancelled_at/by/reason`, `cancelled_by_party CHECK IN ('client','studio')`, `created_by` | `chk`: `total_amount >= 0`, `deposit_amount <= total_amount`. Código por `contract_sequences` (clone de `comanda_sequences`) |
| `contract_items` | `contract_id`, `group_member_id`, `service_id` NULL, `package_id` NULL, `description_snapshot`, `quantity`, `unit_price`, `total`, `purpose CHECK IN ('event','trial')`, `scheduled_at`? | D-09: itens por pessoa. Soma dos itens − `discount_amount` = `total_amount` |
| `contract_versions` | `contract_id`, `version`, `rendered_text TEXT`, `text_sha256 CHAR(64)`, `created_by`, `created_at`; `UNIQUE(contract_id, version)` | **Append-only.** Nova versão sempre que itens/valores/texto mudam → exige novo aceite (D-16) |
| `contract_access_tokens` | `contract_id`, `version_id`, `token_hash CHAR(64) UNIQUE`, `expires_at`, `revoked_at`, `created_by`, `created_at` | Só o SHA-256 do token é guardado. Gerar novo token revoga o anterior (UPDATE de `revoked_at` — esta tabela NÃO é ledger) |
| `contract_acceptances` | `contract_id`, `version_id UNIQUE`, `accepted_name`, `accepted_cpf`, `accepted_at`, `ip INET/VARCHAR(45)`, `user_agent TEXT`, `text_sha256` | **Append-only** (`REVOKE UPDATE, DELETE`). `UNIQUE(version_id)` torna aceite duplo impossível sob corrida |
| `contract_payments` | `contract_id`, `kind CHECK IN ('payment','refund','reversal')`, `method`, `amount NUMERIC` (assinado: pagamento +, reembolso/reversal −, `<> 0`), `paid_at`, `member_id`, `reverses_payment_id`, `cash_movement_id`?, `note` | **Append-only ledger.** Entrada vs restante NÃO é gravada: `depositPaid = min(Σpagos, deposit_amount)` (função pura). Correção de erro = `reversal` |
| `cash_movements` (ALTER) | `contract_id UUID NULL` FK; ampliar `chk_cash_movements_kind` com `'contract_in'`, `'contract_refund'` | Evita misturar com `payment_in/reversal` de comanda; dashboard soma `amount` por data, então já entra em Recebido/por método |
| `comanda_items` (ALTER) | `contract_id UUID NULL` FK | **Chave do abatimento** (Pattern 3) |
| `ai_schedule_suggestions` | `group_id`, `input_hash CHAR(64)`, `source CHECK IN ('claude','heuristic')`, `model`, `proposal JSONB`, `input_tokens`, `output_tokens`, `created_by`, `created_at`; `UNIQUE(org, group_id, input_hash)` para cache | Serve de cache E de contador de uso (count últimas 24h por org com `source='claude'`) |
| `contract_alert_runs` | `organization_id`, `run_date DATE`, `created_at`; `PK(org, run_date)` | Idempotência do job diário por data local da org |

Todas com `organization_id`, FK para `organizations`, `gen_uuid_v7()`, trigger `fn_set_updated_at` onde houver `updated_at`, **RLS idêntica** ao bloco M da migração `20261101000000` e `REVOKE UPDATE, DELETE FROM sgs_app` (bloco N, dentro de `DO $$ IF EXISTS pg_roles sgs_app`) para: `contract_payments`, `contract_acceptances`, `contract_versions`. Seed de permissões como bloco O.

Atualizar `apps/backend/prisma/schema.prisma` (models + relações em Organization/Client/Appointment/Comanda/Package) e rodar `prisma generate`. Migrações são SQL escrito à mão (padrão do repo); manter nome `YYYYMMDDHHMMSS_phase4_bridal_contracts`.

### Pattern 2: Agendar o evento (D-03, D-04, D-05)
**What:** Uma transação `runWithTenant(orgId, fn, SCHEDULE_TX_OPTIONS)` que (1) chama `acquireScheduleLocks(tx, orgId, TODOS os professionalIds do grupo)` **uma vez** (ordenados internamente), (2) para cada pessoa chama `createVisitTx` (1 comanda por pessoa → D-07/D-08), (3) cria os `time_blocks` de deslocamento.
**Por que funciona:** os locks são `pg_advisory_xact_*` — reentrantes na mesma sessão/transação — então as chamadas internas a `acquireScheduleLocks` dentro de `createVisitTx` não bloqueiam; adquirir todos antes evita deadlock entre dois grupos concorrentes com profissionais em ordem diferente.
**Extensão necessária em `createVisitTx`:** aceitar `{ bridalGroupId, contractId, purpose, covered }` e gravá-los em `appointments`; quando `covered`, setar `comanda_items.contract_id` e `unit_price` = preço acordado do `contract_item`, `list_unit_price` = preço de catálogo (comissão por preço cheio, 03 D-23).
**Limite:** `MAX_VISIT_ITEMS = 10` por pessoa — suficiente.
**Deslocamento (D-04):** para cada profissional, bloco `[firstStart − travelBefore, firstStart)` e `[lastEnd, lastEnd + travelAfter)`; chamar `assertSlotFree` na janela do bloco **antes** de criar (não há exclusion constraint em `time_blocks`; a proteção é lock + checagem). Só quando `location_kind='external'` e minutos > 0.
**Cancelamento do grupo/contrato:** cancelar agendamentos (`status='cancelled'` + motivo, reaproveitando a lógica de `cancelAppointment` da Fase 3 para sinal/crédito) e **apagar os `time_blocks` com `bridal_group_id`** (são derivados).
**Teste antes do evento (D-05):** mesma rota com `purpose='trial'` e data diferente; mesmos locks.
```typescript
// Esqueleto (fonte: padrão de apps/backend/src/appointments/visits.ts + scheduling-guard.ts)
await this.tenant.runWithTenant(orgId, async (tx) => {
  await acquireScheduleLocks(tx, orgId, allProfessionalIds); // 1x, ordenado
  for (const person of persons) {
    await createVisitTx(tx, orgId, memberId, {
      clientId: person.clientId, items: person.items,
      bridalGroupId, contractId: person.covered ? contractId : null, purpose: 'event',
    });
  }
  await createTravelBlocksTx(tx, group, byProfessionalRange);
}, SCHEDULE_TX_OPTIONS);
```
Erros: `mapSchedulingError` já traduz `SLOT_TAKEN`/`TIME_BLOCKED`/exclusion violation → payload `errors[]`, não exceção (padrão 03-05).

### Pattern 3: Abatimento do contrato sem dupla contagem (D-08, D-14)
**Modelo recomendado: cobertura por item.**
- `comanda_items.contract_id` marca itens cobertos (preenchido na criação pelo fluxo do evento; itens extras adicionados no dia pelo `addItem` normal ficam `NULL` → cobrados normalmente).
- Em `closeComandaTx` (`apps/backend/src/comandas/comanda-close.ts`): `owed = total − Σ(total dos itens com contract_id)`; passar `owed` a `computeComandaTotals` (hoje recebe `total`). Pagamentos continuam sendo só do "owed". **Nenhum** `cash_movement` para a parte coberta (como já ocorre com `client_credit`). Comissão e estoque seguem iguais (loop sobre todos os itens — preserva D-08).
- Um fechamento com `owed = 0` precisa ser permitido (hoje `INSUFFICIENT_PAYMENT` só dispara se `paid < total`; com `owed=0` e `paid=0` passa — **cobrir com teste**). O espelho no frontend (`features/operations/lib/money.ts computePaymentSummary`) deve receber o mesmo ajuste (regra ÚNICA D-07 da Fase 3).
- Reabertura (`reopenComandaTx`): nada a estornar na parte coberta (não há caixa); comissão/estoque já revertem. Sem mudança, mas testar ciclo fechar→reabrir→fechar.
- **Dashboard** (`apps/backend/src/financial/financial.service.ts`, CTE `billed`): trocar `SUM(total)` por `SUM(c.total − COALESCE(cov.v,0))` com `LEFT JOIN LATERAL (SELECT SUM(total) v FROM comanda_items WHERE comanda_id=c.id AND contract_id IS NOT NULL) cov ON true`, e **somar** um segundo bloco `contract_billed` = `SUM(amount)` de `contract_payments` por `date_trunc(unit, paid_at AT TIME ZONE tz)` (assinado → reembolsos reduzem Faturado na data do reembolso). `received` já inclui os novos `cash_movements` (todos os kinds são somados) e `receivedByMethod` também.
- **Decisão a tomar no plano (recomendação):** `closedComandas`/`averageTicket` — contar apenas comandas com `owed > 0` para o ticket médio não despencar com comandas 100% cobertas; documentar. Outras consultas de `financial.service.ts` que fazem `JOIN comandas`/`cash_movements` (lista de caixa, linha 153) precisam tolerar `comanda_id NULL` (já usam `LEFT JOIN`) e exibir o contrato (código) como origem.
- **Alternativa descartada:** novo método de pagamento `contract` em `comanda_payments` — exigiria o operador lançar o pagamento manualmente e abriria espaço para valor divergente; cobertura por item é automática e auditável.
- Valor coberto = `contract_item.unit_price` acordado (antes do desconto global). O desconto de D-09 vive só no total do contrato; Faturado do contrato = pagamentos reais. Não ratear desconto nos itens.

### Pattern 4: Pagamentos, saldo, status e cancelamento (D-10..D-13, D-17..D-19)
- `recordContractPayment(tx, {...})`: lock `FOR UPDATE` na linha do contrato (padrão `lockComanda`) → valida `status` ∈ {awaiting_acceptance, active} e que `Σpago + amount ≤ total_amount` (decisão: rejeitar sobrepagamento) → insere `contract_payments` + `recordCashMovement` com `kind:'contract_in'` (ampliar tipo `CashKind` em `cash-ledger.ts`; hoje o helper não aceita `contractId` — acrescentar) → `recordAudit`.
- **Status derivado (CONT-02)** em função pura `contract-math.ts` (testável sem DB): `paid`, `balance`, `depositPaid`, `depositPending`, `balanceDueDate`, flags `balanceDueSoon` (≤3 dias), `balanceOverdue` (saldo>0 e hoje > prazo, **na data local da org**), `depositOverdue`. Não persistir status derivado (evita drift).
- **Cancelamento** (`cancelContract`, ADMIN/MANAGER, motivo ≥3 chars como `reopenComandaTx`): `lockContract` → calcula `computeCancellationSettlement(policy, { totalCents, paidCents, depositPaidCents, eventDate, now, party })`:
  - `party='studio'` ⇒ `refund = paid` (tudo, inclusive entrada).
  - `party='client'`, política `retain_all_paid` (padrão D-17) ⇒ `refund = 0`.
  - `party='client'`, política em faixas (`[{ minDaysBefore, retainPercent }]` ordenadas; escolher a faixa de maior `minDaysBefore ≤ diasAteEvento`; ex.: `{<30d: 50%}` ⇒ `retained = max(depositPaid, min(paid, 50% × total))`, `refund = paid − retained`).
  - Reembolso grava `contract_payments(kind:'refund', amount<0)` + `cash_movement(kind:'contract_refund', amount<0)` (método escolhido pelo operador). Depois cancela agendamentos vinculados (`appointments.contract_id`) + apaga time_blocks do grupo, `contract.status='cancelled'`, `recordAudit('contract.cancel')`.
  - Comandas já **fechadas** com itens cobertos não são tocadas (serviço prestado); abertas com cobertura são canceladas junto com o agendamento.
- Política validada por Zod (`z.discriminatedUnion('mode', [retain_all_paid, tiers])`, `retainPercent` 0–100, faixas sem sobreposição); inválida ⇒ erro de domínio no payload.

### Pattern 5: Primeiro job BullMQ + alertas (D-20, D-21)
- `QueueModule` hoje não registra filas. Adicionar `BullModule.registerQueue({ name: 'contract-alerts' })` num módulo novo e um `@Processor('contract-alerts') class X extends WorkerHost { process(job) }` (WorkerHost verificado em `@nestjs/bullmq`).
- **Fuso por org:** NÃO criar um job por org. Registrar **um scheduler horário** (`queue.upsertJobScheduler('contract-alerts-tick', { pattern: '0 * * * *' }, { name: 'tick', opts: { removeOnComplete: true } })` — idempotente, chamado em `onModuleInit`; API verificada em bullmq 5.76.5). No tick, para cada org ativa: calcular hora local (`AT TIME ZONE org.timezone`); se hora ≥ 8 e não existe `contract_alert_runs(org, data_local)` ⇒ rodar e inserir (PK garante exatamente-uma-vez e **recupera** execuções perdidas por indisponibilidade).
- **Listar orgs sob RLS:** `organizations` tem `FORCE ROW LEVEL SECURITY` ⇒ `runWithoutTenant` devolve 0 linhas. Criar função `SECURITY DEFINER` `job_list_active_orgs()` (retorna `id`, `timezone`; `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO sgs_app` em bloco `IF EXISTS pg_roles`), copiando o formato de `auth_user_memberships` (migração `20260918220000`). Depois, para cada org: `runWithTenant(orgId, ...)`.
- **Lógica por org** (`ContractAlertsService.runForOrg(orgId, now)`): consulta contratos ativos/aguardando; gera candidatos `{ contractId, type, state }` para os 4 tipos de D-20 (restante vence ≤3d, restante vencido, entrada não paga após N dias, não aceito após N dias, sinal de acompanhante avulsa pendente = membro `covered_by_contract=false` sem crédito/depósito a ≤ X dias do evento).
- **Dedupe (D-21):** padrão `stock_low` (`stock.ts`): `notification.findFirst({ kind, readAt: null, payload.path['contractId'] equals ... })` — mas incluir `type` e `state` no payload e na chave (`contract_balance_due_soon` → `contract_balance_overdue` é estado novo e gera nova notificação). Resolver: marcar lidas as notificações cujo estado deixou de valer (ex.: quitado). `memberId = NULL` (org inteira) é o padrão atual, mas D-21 pede ADMIN/MANAGER: **criar uma linha por membro ADMIN/MANAGER ativo** (`member_id` preenchido) OU manter `NULL` e filtrar no front — recomendar por-membro para respeitar o papel (PROFESSIONAL/ATTENDANT têm `NOTIFICATION_READ` e veriam alertas financeiros em notificações com `member_id NULL`, pois `NotificationsService.list` inclui `memberId IS NULL`).
- **E-mail diário:** um resumo por org/dia a cada ADMIN/MANAGER com e-mail (`users.email` via `members`); adicionar `EmailService.sendContractDigest(to, orgName, items)` seguindo `sendInvitation` (html + text). `EMAIL_OUTBOX_DIR` grava JSON em dev/E2E — testável sem Resend. Só enviar se houver itens **novos** (mesmo dedupe) para não repetir diariamente o que já foi avisado? Recomendação: o e-mail lista todas as pendências abertas (resumo); o sino só os novos.
- **Testes:** `runForOrg(orgId, now)` recebe `now` injetável e roda direto nos testes de integração (Postgres real) — sem depender de Redis/worker. O worker em si é coberto por um smoke de boot. Redis/Valkey local está acessível em `localhost:6379` (verificado) e o CI sobe `valkey`. Adicionar env `CONTRACT_ALERTS_SCHEDULER` (default `true`; `false` em testes) para não registrar o scheduler em suítes que bootam `AppModule`. Para E2E (Playwright não espera o relógio): mutation `runContractAlertsNow` (ADMIN/MANAGER, só da própria org, idempotente por dedupe).

### Pattern 6: IA (AI-01) com Claude API
- **Chamada (SDK 1.4.0, tipos verificados):**
```typescript
// Source: @anthropic-ai/sdk@1.4.0 resources/messages/messages.d.ts (JSDoc de messages.parse) + helpers/zod.d.ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
const msg = await client.messages.parse({
  model: 'claude-sonnet-5-5',
  max_tokens: 4096,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: JSON.stringify(input) }],
  output_config: { format: zodOutputFormat(ProposalSchema) /*, effort: 'medium' */ },
});
const proposal = msg.parsed_output; // null/undefined se não parseável -> tratar como falha
// uso: msg.usage.input_tokens / output_tokens
```
  `OutputConfig.effort` (`low|medium|high|xhigh|max`) existe; começar em `medium`. `thinking` não é necessário (tarefa pequena + validação servidor). **MEDIUM:** semântica de runtime (limitações do JSON Schema aceito pelo structured output, p.ex. restrições `min/max`) não foi verificada em docs oficiais — manter o schema enviado **simples** (strings ISO, ids, enums) e aplicar regras fortes no validador próprio.
- **Config:** `env.schema.ts` + `AppConfigService`: `ANTHROPIC_API_KEY` `z.string().min(1).optional()`, `ANTHROPIC_MODEL` default `'claude-sonnet-5-5'`, `AI_SCHEDULE_DAILY_LIMIT` default 20. Sem chave ⇒ serviço não instancia o client e usa fallback. Tratar `string vazia` como ausente (compose/CI costumam passar `ANTHROPIC_API_KEY=`).
- **Fluxo `AiScheduleService.suggest(groupId)`:** montar input canônico (ordenado) → `input_hash = sha256` → cache hit em `ai_schedule_suggestions` (TTL 24h, PRD §9.6) devolve sem custo → checar limite (count `source='claude'` últimas 24h por org ≥ limite ⇒ erro de domínio `AI_LIMIT_REACHED`, mas **ainda oferece heurística**) → chamar Claude → validar → se inválido, 1 retry opcional com a lista de violações; persistir; senão heurística (`source:'heuristic'`, mensagem clara "IA indisponível, sugestão simples").
- **Input mínimo e sem PII (LGPD):** enviar rótulos (`pessoa_1 (noiva)`), serviços (id, nome, duração), profissionais habilitados por serviço (id, nome de exibição opcional), janelas ocupadas (agendamentos + time_blocks do dia), `readyBy` (hora do evento), minutos de deslocamento. **Nunca** enviar nome completo/CPF/telefone de clientes.
- **Validador puro `validateProposal(proposal, ctx)`** (também reusado pela heurística e pelo `confirm`): cada item referencia pessoa/serviço/profissional válidos; profissional habilitado na categoria (`professionalServesCategory`); `endsAt − startsAt` = duração do serviço; sem sobreposição com ocupados/blocos nem entre itens do mesmo profissional; mesma pessoa sem serviços simultâneos; noiva termina ≤ `readyBy`; dentro do expediente se existir. Falhas ⇒ descartar IA.
- **Heurística (fallback):** determinística — acompanhantes primeiro, noiva por último terminando em `readyBy`; para cada serviço escolher o profissional habilitado com primeiro encaixe livre varrendo para trás a partir de `readyBy`. Pura, com testes de tabela.
- **Confirmação:** mutation `confirmBridalSchedule(groupId, proposal)` **revalida no servidor** e cria tudo via Pattern 2 em uma transação; nunca confiar na proposta vinda do cliente (pode ter sido editada). Nada é escrito na suggestion → agenda sem esta chamada (SDD §13.2).
- **Testes:** injetar um `AnthropicClient` fake via token Nest (`ANTHROPIC_CLIENT`) — nenhum teste chama a rede.

### Pattern 7: Rota pública de aceite (D-15, D-16)
- **Transporte:** controller REST `@Public()` (obrigatório: `JwtAuthGuard` é GraphQL-bound; mesmo comentário do `HealthController`) em `/public/contracts/:orgId/:token` — `GET` (texto + hash + status), `POST .../accept`, `GET .../pdf` (só após aceite). Frontend usa `fetch` (não Apollo).
- **Token:** `crypto.randomBytes(32).toString('base64url')`; no banco só `sha256(token)`; comparação por lookup no índice único (hash de segredo de alta entropia ⇒ sem necessidade de comparação constante). Link = `${FRONTEND_URL}/aceite/${orgId}/${token}`. **orgId no path** resolve o tenant sem `SECURITY DEFINER`: validar `isUuid`, `runWithTenant(orgId)`, buscar por `token_hash`. Resposta 404 genérico para token inexistente/revogado/expirado (sem oráculo). `expires_at` padrão 30 dias.
- **Aceite:** valida `validateCpf` (`clients/cpf.util.ts`), nome ≥ 3 chars, `accepted=true` e `textSha256` enviado == hash da versão atual (garante "o texto exato aceito"); insere `contract_acceptances` (append-only, `UNIQUE(version_id)` ⇒ segunda tentativa vira 409/idempotente); atualiza `contracts.status → 'active'`; `recordAudit`. IP = `req.ip`, UA = header.
- **IP real:** `new FastifyAdapter({ logger: true, trustProxy: true })` em `main.ts` (hoje ausente) — senão IP gravado = nginx. Registrar no plano como mudança de `main.ts` (e confirmar que o nginx do VPS envia `X-Forwarded-For`).
- **Rate limit:** `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])` e `@UseGuards(ThrottlerGuard)` **só** no controller público (não global — o GraphQL exigiria `getRequestResponse` customizado). Limite mais apertado no POST de aceite (`@Throttle({ default: { limit: 5, ttl: 60_000 } })`). Fastify 4 + throttler 6 funciona com `req.ip`.
- **Cabeçalhos:** `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` no controller público (token na URL). Página React com `<meta name="robots" content="noindex">`.
- **PDF:** `pdfkit` renderizando `rendered_text` da versão aceita + bloco "Aceite digital" (nome, CPF mascarado `***.456.789-**`, data/hora no fuso da org, IP, hash). Público: stream após aceite. Dono (autenticado): query GraphQL `contractPdf(id): { filename, base64 }` (REST autenticado não funciona com o guard atual). Gerar sob demanda, sem armazenar.
- **Modelo de texto (D-16):** substituição de variáveis `{{noiva_nome}}`, `{{noiva_cpf}}`, `{{evento_data}}`, `{{evento_local}}`, `{{itens}}`, `{{valor_total}}`, `{{entrada}}`, `{{prazo_restante}}`, `{{politica_cancelamento}}` por função pura (`escape` não é HTML — saída é texto puro; renderizar no front com `white-space: pre-wrap`, **nunca** `dangerouslySetInnerHTML`). Variável desconhecida ⇒ erro de validação ao salvar o modelo. Cada `render` produz `contract_versions` com `sha256(rendered_text)` (UTF-8, normalizar `\r\n`→`\n`).

### Pattern 8: Permissões (catálogo + suíte transversal)
Adicionar em `permissions.catalog.ts` (convenção `recurso.ação`): `bridal.read`, `bridal.write`, `bridal.aiSuggest`, `contract.read`, `contract.write`, `contract.payment`, `contract.cancel`, `contract.settings`. Distribuição sugerida: ADMIN tudo; MANAGER tudo exceto `contract.settings` (decisão do planejador; D-19 pede cancelar = ADMIN/MANAGER); ATTENDANT `bridal.read/write` + `contract.read`; PROFESSIONAL nenhuma (ou `bridal.read`). Seed em SQL na própria migração (bloco O) — `ROLE_PERMISSIONS` no TS é só espelho/documentação (não há outro consumidor, verificado por grep). Espelhar no front em `features/bridal/bridal-permissions.ts` (mesmo padrão de `operations-permissions.ts`, gate por `roleName`). Estender `phase3-rls-rbac.e2e.spec.ts` ou criar `phase4-rls-rbac.e2e.spec.ts` com a lista `NINE_TABLES` → nova lista das tabelas da fase 4 + matriz de papéis.

### Pattern 9: Frontend
- Rotas `/noivas`, `/contratos`, `/contratos/:id` já existem em `PROTECTED_ROUTES` (`router.tsx`) apontando para placeholders; **ligar as flags** `noivas` e `contratos` em `src/config/features.ts` no mesmo commit que liga o backend (regra do arquivo + `ROADMAP-MOCKS.md` M9). Substituir placeholders; `features/bridal/mocks/bridal.mock.ts` sai de uso.
- Rota pública `/aceite/:orgId/:token` fora do `ProtectedRoute/AppShell` (como `/convite/:token`), sem Apollo/auth store.
- Estrutura espelhando Fase 3: `features/bridal/api/*.api.ts` (documentos GraphQL + hooks), `lib/` (dinheiro/saldo — **reusar** `features/operations/lib/money.ts`), `components/` (diálogos shadcn existentes: Radix dialog/select/tabs), toasts com `sonner`.
- Telas: lista/detalhe de grupo (membros, toggle "incluída no contrato", serviços por pessoa, local/deslocamento), "Sugerir agenda IA" (tabela editável + Confirmar), lista de contratos (filtros por status derivado), detalhe de contrato (itens, saldo, pagamentos, ações: gerar/copiar link, registrar pagamento, cancelar com motivo, baixar PDF), configurações do contrato (prazo, política, modelo) — `/configuracoes` está desligada; colocar a configuração numa aba dentro de `/contratos`.
- Sino de notificações: flag `notificacoes` está `false` ("backend existe, painel não") — **alerta in-app só aparece se esse painel for ligado**; incluir no escopo (plano) ou documentar que o entregável visível é o painel mínimo.
- Pacotes: adicionar campos de entrada (R$/%) na tela e API de pacotes (Fase 2).
- Codegen: `pnpm --filter @sgs/frontend codegen` (graphql-codegen) após alterar `src/graphql/schema/*.graphql` (novos `bridal.graphql`, `contracts.graphql`).

### Anti-Patterns to Avoid
- **Persistir "status derivado" (vencido/vencendo)** — usa data/relógio; calcular em tempo de leitura e no job.
- **Duplicar o contador de Faturado** somando `comandas.total` de comandas cobertas (D-14) — sempre subtrair `contract_id IS NOT NULL`.
- **Tabela de parcelas** (`contract_installments` do PRD/ROADMAP-MOCKS) — contradiz D-11.
- **Confiar na proposta de agenda vinda do cliente/IA** sem revalidar no servidor.
- **`UPDATE` em `contract_payments`/`contract_acceptances`** — correção só por novo registro.
- **Cron em processo (`@nestjs/schedule`)** ou job por org com fuso fixo.
- **`req.ip` sem `trustProxy`** para evidência de aceite.
- **Enviar dados pessoais de clientes ao prompt do Claude.**

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Lock anti-conflito de agenda | novo mecanismo | `acquireScheduleLocks` + `assertSlotFree` + exclusion constraint existentes | Já provado por `phase3-scheduling-concurrency` |
| Criar agendamentos+comanda+itens | novo fluxo | `createVisitTx` (estendido) | Rateio de pacote, habilitação por categoria, sinal |
| Ledger de caixa / auditoria / crédito | SQL direto | `recordCashMovement`, `recordAudit`, `recordCreditMovement` | Transacionais, append-only |
| Código curto sequencial | MAX()+1 | clone de `nextComandaCode` (UPSERT atômico) | Sem buracos/duplicatas sob concorrência |
| Validação de CPF | regex | `clients/cpf.util.ts validateCpf/normalizeCpf` | Dígitos verificadores |
| Dinheiro | float | `common/money.ts` (`toCents/fromCents/splitProportional`) | Centavos inteiros |
| Agendamento recorrente | cron `setInterval` | BullMQ `upsertJobScheduler` | Lock distribuído, retry, sobrevive a restart |
| Rate limiting | contador em Map | `@nestjs/throttler` | Janela deslizante, headers 429 |
| PDF | HTML→PDF com browser | `pdfkit` | Sem Chromium |
| Saída JSON do LLM | regex/`JSON.parse` solto | `messages.parse` + `zodOutputFormat` | Schema imposto + parse tipado |
| Hash do texto | algoritmo próprio | `crypto.createHash('sha256')` | Padrão |
| Envio de e-mail | SMTP próprio | `EmailService` (Resend / file-outbox) | Já testável em E2E |

**Key insight:** o risco do domínio não está em tecnologia nova e sim em **consistência financeira e concorrência** — reutilizar os helpers transacionais e manter regras de dinheiro em funções puras com testes de tabela.

## Runtime State Inventory

> Fase de feature nova (greenfield sobre o modelo existente) — não é rename/refactor/migração. Seção omitida, exceto os itens abaixo que alteram dados existentes:
- **Stored data:** `packages` ganha colunas NULL (sem backfill); `cash_movements`/`time_blocks` têm CHECK de `kind` ampliada (ALTER seguro, linhas existentes continuam válidas); `comanda_items.contract_id` NULL para todo o histórico (dashboard idêntico ao anterior para dados antigos — **cobrir com teste de regressão do dashboard**).
- **Secrets/env:** `ANTHROPIC_API_KEY` novo e opcional — adicionar a `.env.example`, `docker-compose.yml` e secrets do staging (CI/VPS); sem ela o sistema roda em modo heurístico.

## Common Pitfalls

### Pitfall 1: Job diário vê zero organizações
**What goes wrong:** `runWithoutTenant` + `tx.organization.findMany()` devolve `[]` (RLS FORCE em `organizations`).
**How to avoid:** função `SECURITY DEFINER job_list_active_orgs()` (Pattern 5); teste de integração que chama o tick com 2 orgs.
**Warning signs:** job "roda" e nunca cria notificações.

### Pitfall 2: Guard global quebra REST
**What goes wrong:** controller sem `@Public()` ⇒ 500 (`req.logIn` indefinido) — documentado no `HealthController`.
**How to avoid:** `@Public()` no controller público; PDF do dono via GraphQL.

### Pitfall 3: IP do aceite = IP do nginx
**How to avoid:** `trustProxy: true` no `FastifyAdapter`; teste unitário do extrator + verificação manual no staging com `X-Forwarded-For`.

### Pitfall 4: Dupla contagem no Faturado / ticket médio distorcido
**How to avoid:** Pattern 3; teste de integração: contrato R$ 8.000 pago em 3 pagamentos + comanda 100% coberta + extra R$ 50 ⇒ `billedTotal` = pagamentos + 50, `receivedTotal` idem, `closedComandas` conforme decisão.
**Warning signs:** Faturado do dia do evento sobe pelo valor do pacote.

### Pitfall 5: Fechar comanda totalmente coberta
**What goes wrong:** fluxo exige itens e pagamento; `owed=0` pode cair em `EMPTY_COMANDA`/validações do front que exigem ≥1 pagamento.
**How to avoid:** teste explícito e ajuste no `computePaymentSummary` do front (UI mostra "Coberto pelo contrato CT-…").

### Pitfall 6: Deadlock/serialização ao criar o evento
**How to avoid:** adquirir locks de todos os profissionais antes (ordenados); `SCHEDULE_TX_OPTIONS` (timeout 10s) — com ~10 pessoas × vários serviços a transação é maior que a da Fase 3: medir; considerar `timeout` maior só para esta rota.

### Pitfall 7: Mudança de itens/valores após o aceite
**What goes wrong:** aceite vale para o texto antigo.
**How to avoid:** qualquer edição cria `contract_versions` nova, revoga token, volta `status` para `awaiting_acceptance`; pagamentos anteriores permanecem. Bloquear edição de contrato `cancelled`/`completed`.

### Pitfall 8: Data do evento muda
**How to avoid:** recalcular `balance_due_date` (= `event_date − balance_due_days_before`), regenerar versão (texto cita prazo) e, se houver agendamentos, oferecer mover (fora do escopo automático — sinalizar na UI).

### Pitfall 9: Fuso nos alertas/prazos
**How to avoid:** `event_date` é `DATE` local; "hoje" via `(now AT TIME ZONE tz)::date`; testes com `now` injetado cruzando meia-noite em `America/Sao_Paulo` vs UTC.

### Pitfall 10: Notificação financeira visível a quem não deve
**How to avoid:** `member_id` por ADMIN/MANAGER (Pattern 5); teste RBAC no sino.

### Pitfall 11: Saída da IA válida em forma mas inviável
**How to avoid:** `validateProposal` obrigatório antes de exibir **e** antes de confirmar; limitar tamanho (máx. pessoas × serviços) para controlar tokens.

### Pitfall 12: Bump de versões
**What goes wrong:** `bullmq` 6.x e `@nestjs/bullmq` 12.x (latest) exigem Nest 12; `@fastify/rate-limit` 11 exige Fastify 5.
**How to avoid:** manter as versões listadas; registrar em PLAN para não rodar `pnpm update`.

## Code Examples

### Hash e token (público)
```typescript
// Source: Node.js crypto (stdlib)
import { createHash, randomBytes } from 'node:crypto';
export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
export const normalizeText = (s: string) => s.replace(/\r\n/g, '\n').trim();
```

### Scheduler horário idempotente
```typescript
// Source: bullmq 5.76.5 queue.d.ts (upsertJobScheduler) + @nestjs/bullmq WorkerHost
@Injectable()
export class ContractAlertsScheduler implements OnModuleInit {
  constructor(@InjectQueue('contract-alerts') private readonly q: Queue) {}
  async onModuleInit() {
    await this.q.upsertJobScheduler('contract-alerts-tick', { pattern: '0 * * * *' },
      { name: 'tick', opts: { removeOnComplete: true } });
  }
}
@Processor('contract-alerts')
export class ContractAlertsProcessor extends WorkerHost {
  constructor(private readonly alerts: ContractAlertsService) { super(); }
  async process(): Promise<void> { await this.alerts.tick(new Date()); }
}
```

### Dashboard (trecho do CTE `billed`)
```sql
-- comandas: descontar itens cobertos por contrato (D-14)
SELECT date_trunc(${u}, c.closed_at AT TIME ZONE ${tz})::date AS bucket,
       SUM(c.total - COALESCE(cov.v, 0)) AS v, COUNT(*) FILTER (WHERE c.total - COALESCE(cov.v,0) > 0) AS n
  FROM comandas c
  LEFT JOIN LATERAL (SELECT SUM(total) v FROM comanda_items i
                      WHERE i.comanda_id = c.id AND i.contract_id IS NOT NULL) cov ON true
 WHERE c.status='closed' AND c.closed_at >= ... AND c.closed_at < ...
 GROUP BY 1
-- + UNION ALL: contract_payments por paid_at (amount assinado)
```

### Settlement de cancelamento (puro)
```typescript
export function computeCancellationSettlement(a: {
  policy: CancellationPolicy; party: 'client'|'studio';
  totalCents: number; paidCents: number; depositPaidCents: number;
  daysUntilEvent: number;
}): { retainedCents: number; refundCents: number } {
  if (a.party === 'studio') return { retainedCents: 0, refundCents: a.paidCents };
  if (a.policy.mode === 'retain_all_paid') return { retainedCents: a.paidCents, refundCents: 0 };
  const tier = pickTier(a.policy.tiers, a.daysUntilEvent);            // maior minDaysBefore <= dias; sem faixa => 0%
  const pct = tier?.retainPercent ?? 0;
  const retained = Math.min(a.paidCents, Math.max(a.depositPaidCents, Math.round((a.totalCents * pct) / 100)));
  return { retainedCents: retained, refundCents: a.paidCents - retained };
}
```

## State of the Art

| Antigo | Atual | Impacto |
|--------|-------|---------|
| `@Cron` do `@nestjs/schedule` | BullMQ Job Schedulers (`upsertJobScheduler`, bullmq ≥5.16) — `repeat` antigo está depreciado | Usar a API nova |
| Pedir JSON ao LLM no prompt + parse | `output_config.format` (structured outputs) com `zodOutputFormat` + `messages.parse` | Schema garantido; ainda validar semântica |
| Modelos Claude 4.x | Família 5 (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`) | Default Sonnet 5.5 |

**Deprecated/outdated:** `@fastify/rate-limit` latest (v11) não serve ao Fastify 4; `pdf-lib` sem manutenção.

## Open Questions

1. **Retenção por faixas — base e piso da entrada**
   - Sabe-se: D-17 padrão retém tudo; D-18 exemplo "<30 dias → retém 50% do total".
   - Incerto: a retenção percentual é sobre o *total do contrato* ou o *pago*? A entrada continua intocável nas faixas? Cliente que pagou menos que a retenção deve a diferença?
   - Recomendação: `retained = max(depositPaid, min(paid, pct × total))`, **sem cobrança de diferença** (sem cobrança no sistema); registrar a premissa no plano e na tela de política; confirmar com o usuário se possível.
2. **Contrato que cobre acompanhante com comanda já aberta/paga avulsa**
   - Recomendação: bloquear alteração de cobertura de pessoa cuja comanda já foi fechada; permitir enquanto aberta (converte itens).
3. **Sino in-app**
   - Flag `notificacoes` desligada (sem painel). Recomendação: incluir painel mínimo no plano de frontend, senão D-21 fica sem canal visível.
4. **Quem é "ADMIN/MANAGER" para e-mail** — usar `users.email` do membro; membros sem e-mail verificado? Recomendação: enviar a todos ativos; ignorar sem e-mail.
5. **Expediente dos profissionais** — não existe modelo de horário de trabalho no repo (só `time_blocks`); IA/heurística considera apenas ocupações. Recomendação: janela do dia = parâmetro (ex.: 06:00–20:00) no input; não criar modelo de jornada nesta fase.
6. **Validade/expiração do token e revogação ao editar** — recomendado 30 dias; confirmar.

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|-----------------|-----------|--------|----------|
| Node | tudo | ✓ | v26.9.0 (host; projeto alvo Node 20/22) | — |
| PostgreSQL | migrações, integração | ✓ | aceitando conexões (`pg_isready`) | — |
| Valkey/Redis :6379 | BullMQ | ✓ | porta aberta | — |
| Docker | staging | ✓ | containers `sgs_stg_*` rodando | — |
| `redis-cli`/`valkey-cli` | debug | ✗ | — | `/dev/tcp` ou node |
| `ANTHROPIC_API_KEY` | AI-01 em produção | ✗ (não verificado/ausente do schema) | — | **Fallback heurístico (requisito)**; testes usam fake |
| npm registry | instalar libs | ✓ | `npm view` ok | — |
| Chromium/Playwright | E2E | não verificado (`apps/e2e` existe, relatórios presentes) | — | — |

**Missing sem fallback:** nenhum bloqueante. **Com fallback:** chave Anthropic (heurística).

## Validation Architecture

### Test Framework
| Propriedade | Valor |
|-------------|-------|
| Backend unit | Jest 29 + ts-jest (`apps/backend/jest.config.ts`, `rootDir: src`, `*.spec.ts`) |
| Backend integração | Jest `--runInBand` (`jest-integration.config.ts`, `rootDir: test/integration`, `*.spec.ts`, setup com `adminPrisma` (DIRECT_URL, BYPASSRLS) e `appPrisma` (sgs_app, RLS)); timeout 30s; Postgres + PgBouncer + Valkey |
| Frontend | Vitest (`apps/frontend`, testes em `features/*/__tests__`) + Testing Library |
| E2E | Playwright 1.55 (`apps/e2e`, backend+frontend reais, `support/*.ts` helpers, outbox de e-mail em `support/outbox.ts`) |
| Quick run | `pnpm --filter @sgs/backend test -- <arquivo>` / `pnpm --filter @sgs/frontend test -- <arquivo>` |
| Full suite | `pnpm -r typecheck && pnpm -r --if-present lint && pnpm --filter @sgs/backend test && pnpm --filter @sgs/backend test:integration && pnpm --filter @sgs/frontend test && pnpm --filter @sgs/e2e test:e2e` |

### Phase Requirements → Test Map
| Req | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|-----|---------------|------|----------------------|-----------------|
| CLI-03 | Criar grupo com noiva + 4 acompanhantes (cliente mínima), 1 noiva por grupo, unicidade de membro | integração | `pnpm --filter @sgs/backend test:integration -- phase4-bridal-group` | ❌ Wave 0 |
| CLI-03 / D-03 | Evento cria N agendamentos + 1 comanda/pessoa; conflito → `SLOT_TAKEN`; concorrência de 2 grupos no mesmo profissional | integração | `... -- phase4-bridal-schedule` | ❌ Wave 0 |
| D-04 | Deslocamento cria `time_blocks` `deslocamento`; bloqueio conflita com agendamento; cancelar grupo remove blocos | integração | `... -- phase4-travel-blocks` | ❌ Wave 0 |
| CONT-01 | Contrato: código CT-AAAA-NNN sem buracos sob concorrência; snapshots; entrada R$/% do pacote; total com desconto | unit (`contract-math`, `contract-code`) + integração | `pnpm --filter @sgs/backend test -- contract-math` | ❌ Wave 0 |
| CONT-01 / D-13 | Pagamentos parciais/múltiplos métodos geram `cash_movements`; sobrepagamento rejeitado; ledger imutável (UPDATE/DELETE negados a sgs_app) | integração | `... -- phase4-contract-payments` | ❌ Wave 0 |
| D-14 | Dashboard: contrato R$ 8.000 em 3 pagamentos + comanda 100% coberta + extra ⇒ Faturado/Recebido corretos; regressão de dados antigos | integração | `... -- phase4-financial-dashboard` | ❌ Wave 0 |
| D-08 | Fechar comanda coberta (`owed=0`), com extra, comissão e estoque; reabrir/fechar | integração + unit `comanda-math` | `... -- phase4-comanda-contract` | ❌ Wave 0 |
| D-15/16 | Aceite: token válido/inválido/expirado/revogado, hash divergente rejeitado, CPF inválido, aceite duplo (409), registro append-only, nova versão exige novo aceite | integração (HTTP via supertest) + unit `contract-template` | `... -- phase4-public-acceptance` | ❌ Wave 0 |
| D-15 | Rate limit → 429 após N chamadas | integração | `... -- phase4-public-ratelimit` | ❌ Wave 0 |
| CONT-03 / D-17..19 | `computeCancellationSettlement` tabela (cliente/estúdio × política × antecedência); cancelamento exige motivo e papel ADMIN/MANAGER; reembolso gera caixa negativo; cancela agendamentos | unit + integração | `pnpm --filter @sgs/backend test -- cancellation-policy` | ❌ Wave 0 |
| CONT-02 / D-20,21 | `runForOrg(now)`: 4 tipos de alerta, dedupe por contrato+tipo+estado, notificações só para ADMIN/MANAGER, e-mail resumo no outbox, idempotência por `contract_alert_runs`, fuso | integração | `... -- phase4-contract-alerts` | ❌ Wave 0 |
| CONT-02 | `job_list_active_orgs()` enxerga todas as orgs sob `sgs_app` | integração | `... -- phase4-job-orgs` | ❌ Wave 0 |
| AI-01 | `validateProposal` (conflitos, duração, habilitação, noiva por último), heurística determinística, serviço com client fake: sucesso, API falha → heurística, sem chave → heurística, saída inválida → fallback, cache hit sem chamada, limite diário | unit + integração | `pnpm --filter @sgs/backend test -- ai-schedule` | ❌ Wave 0 |
| RBAC/RLS | Todas as tabelas da fase: org B não lê/escreve dados de A; matriz de permissões por papel; rota pública não vaza entre orgs (orgId do path ≠ do token ⇒ 404) | integração | `... -- phase4-rls-rbac` | ❌ Wave 0 |
| Frontend | Telas de grupo/contrato/aceite pública (render, validações, estados de erro, gate por papel), espelho `computePaymentSummary` com cobertura | vitest | `pnpm --filter @sgs/frontend test -- bridal` | ❌ Wave 0 |
| E2E | Fluxo crítico: criar pacote com entrada → grupo → contrato → gerar link → aceitar (página pública) → registrar entrada → dashboard → "Sugerir agenda IA" (sem chave ⇒ heurística) → confirmar → cancelar contrato | Playwright | `pnpm --filter @sgs/e2e test:e2e -- noivas-contrato` | ❌ Wave 0 |

### Sampling Rate
- **Por commit de tarefa:** unit do módulo tocado (`pnpm --filter @sgs/backend test -- <padrão>`) + typecheck.
- **Por merge de wave:** `pnpm --filter @sgs/backend test && pnpm --filter @sgs/backend test:integration -- phase4 && pnpm --filter @sgs/frontend test`.
- **Phase gate:** suíte completa (inclui Fase 3 integração — regressão do dashboard/comanda — e E2E) verde antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/backend/test/integration/helpers/phase4-fixtures.ts` — mundo com 2 orgs, profissionais por categoria, pacote de noiva com entrada, helpers `gqlAs` (estender `phase3-fixtures`).
- [ ] Specs listados acima (todos ❌) + `apps/backend/src/{contracts,bridal}/**/*.spec.ts` das funções puras.
- [ ] Fake `ANTHROPIC_CLIENT` e fake relógio (`now` injetável) como utilitários de teste.
- [ ] Teste de boot do módulo de fila (smoke) com `CONTRACT_ALERTS_SCHEDULER=false` nas suítes que bootam `AppModule`.
- [ ] `apps/e2e/tests/noivas-contrato.spec.ts` + `support/phase4.ts` (leitura do link de aceite; e-mail digest via `support/outbox.ts`); botão/mutation `runContractAlertsNow` para disparar alertas.
- [ ] Instalar `@anthropic-ai/sdk`, `pdfkit`, `@nestjs/throttler`.

## Sources

### Primary (HIGH)
- Código do repositório (leitura direta): `comanda-close.ts`, `comanda-math.ts`, `comanda-open.ts`, `comanda-code.ts`, `visits.ts`, `scheduling-guard.ts`, `advisory-lock.ts`, `time-blocks.service.ts`, `cash-ledger.ts`, `client-credit.ts`, `audit-log.ts`, `financial.service.ts`, `stock.ts`, `tenant-context.service.ts`, `jwt-auth.guard.ts`, `health.controller.ts`, `permission.guard.ts`, `permissions.catalog.ts`, `queue.module.ts`, `env.schema.ts`, `main.ts`, `router.tsx`, `config/features.ts`, migrações `20261101000000_phase3_operations`, `20260918220000_auth_user_memberships_fn`, `schema.prisma`.
- `@anthropic-ai/sdk@1.4.0` tarball (npm pack, 2026-11-03): `messages.d.ts` (`parse`, `output_config`, `effort`, union `Model`, `Usage`), `helpers/zod.d.ts`, `package.json` (peer zod).
- `npm view` (registro, 2026-11-03): versões/datas de `@anthropic-ai/sdk`, `pdfkit`, `pdfmake`, `puppeteer`, `@react-pdf/renderer`, `@nestjs/throttler`, `@fastify/rate-limit`, `bullmq`, `@nestjs/bullmq`, `zod`.
- bullmq 5.76.5 e `@nestjs/bullmq` 10.2.3 instalados: `upsertJobScheduler`, `WorkerHost` confirmados nos `.d.ts`.

### Secondary (MEDIUM)
- Compatibilidade `@fastify/rate-limit` v11 ↔ Fastify 5 e `@nestjs/bullmq` 12 ↔ Nest 12: inferida de peerDependencies/linha de versões (peers do throttler verificados; os demais por dedução do número de major) — conferir no install.
- Github README do SDK (modelo `claude-opus-5-5` no exemplo).

### Tertiary (LOW — validar)
- `@types/pdfkit` disponibilidade/versão para pdfkit 0.20 (não verificado).
- Restrições do JSON Schema aceito pelo structured output da API (não verificado em docs oficiais).
- Mínimo de tokens cacheáveis para prompt caching (provavelmente irrelevante nesta escala; cache de resposta próprio é o que importa).
- Preços/limites de taxa da API para dimensionar `AI_SCHEDULE_DAILY_LIMIT` (valor 20 é chute razoável).

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH — versões do registro verificadas; compatibilidade de alguns majors deduzida.
- Architecture (reuso de Fase 3, RLS, job, público): HIGH — validada contra o código atual.
- Modelo de abatimento/dashboard: HIGH quanto à viabilidade técnica; MEDIUM quanto a decisões de produto (ticket médio, retenção %).
- IA: MEDIUM — API lida dos tipos do SDK, não executada (sem chave).
- Pitfalls: HIGH (3 achados estruturais confirmados em código: RLS em `organizations`, guard GraphQL-bound, ausência de `trustProxy`).

**Research date:** 2026-11-03
**Valid until:** ~2026-11-17 (SDK Anthropic e BullMQ publicam com frequência; reverificar versões no `pnpm add`)

---
phase: 04-bridal-contracts
plan: 12
type: execute
wave: 4
depends_on: ["04-03", "04-08"]
files_modified:
  - apps/backend/src/bridal/ai/anthropic-client.ts
  - apps/backend/src/bridal/ai/ai-schedule.prompt.ts
  - apps/backend/src/bridal/ai/ai-schedule-context.ts
  - apps/backend/src/bridal/ai/ai-schedule.service.ts
  - apps/backend/src/bridal/ai/ai-schedule.service.spec.ts
  - apps/backend/src/bridal/ai/ai-schedule.resolver.ts
  - apps/backend/src/bridal/ai/ai-schedule.module.ts
  - apps/backend/src/bridal/ai/ai-schedule.schema.ts
  - apps/backend/src/graphql/schema/ai-schedule.graphql
  - apps/backend/test/integration/helpers/fake-anthropic.ts
  - apps/backend/test/integration/phase4-ai-schedule.e2e.spec.ts
autonomous: true
requirements: [AI-01]

must_haves:
  truths:
    - "Ao pedir 'Sugerir agenda IA', o backend monta o contexto (pessoas, serviços, durações, profissionais habilitados, ocupações, janela do dia, pronta-até, deslocamento), consulta a Claude API e devolve uma proposta editável validada"
    - "Nenhum dado pessoal de cliente (nome, CPF, telefone) vai para o prompt; pessoas e profissionais viajam como rótulos"
    - "Sem chave, com erro da API, com saída inválida ou com limite diário atingido, devolve a sugestão heurística com o motivo"
    - "A mesma entrada em 24h devolve a sugestão do cache sem chamar a API"
    - "Nada vai para a agenda sem 'Confirmar'; a confirmação revalida a proposta no servidor e cria os agendamentos pelo fluxo do evento"
  artifacts:
    - path: "apps/backend/src/bridal/ai/ai-schedule.service.ts"
      exports: ["AiScheduleService"]
    - path: "apps/backend/src/bridal/ai/anthropic-client.ts"
      exports: ["ANTHROPIC_CLIENT", "AnthropicLike", "anthropicClientProvider"]
    - path: "apps/backend/src/graphql/schema/ai-schedule.graphql"
      contains: "suggestBridalSchedule"
  key_links:
    - from: "ai-schedule.service.ts"
      to: "client.messages.parse + zodOutputFormat(ProposalSchema)"
      via: "@anthropic-ai/sdk 1.4.0"
      pattern: "messages.parse"
    - from: "ai-schedule.service.ts"
      to: "validateProposal / buildHeuristicProposal (04-03)"
      via: "validação antes de exibir e fallback"
      pattern: "validateProposal"
    - from: "confirmBridalSchedule"
      to: "BridalService.schedule (04-08)"
      via: "revalidação + createBridalScheduleTx"
      pattern: "schedule\\("
---

<objective>
Sugestão de agenda do evento via Claude API (AI-01; critério de sucesso 3; CONTEXT "Claude's Discretion"): contexto sem PII, chamada com saída estruturada Zod, validação de conflitos, cache 24h, limite diário por org, fallback heurístico e confirmação revalidada.

Purpose: diferencial competitivo da fase; precisa funcionar sem chave (CI/E2E e staging sem secret).
Output: AiScheduleModule preenchido, SDL `ai-schedule.graphql`, client fake para testes, unit + integração.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@.planning/phases/04-bridal-contracts/04-03-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-08-SUMMARY.md
@apps/backend/src/bridal/ai/ai-schedule.schema.ts
@apps/backend/src/bridal/ai/schedule-validator.ts
@apps/backend/src/bridal/ai/heuristic-scheduler.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Gate antes de cada commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration -- phase4`. **Nenhum teste chama a rede**: integração usa `overrideProvider(ANTHROPIC_CLIENT)` com o fake.

<interfaces>
```typescript
// @anthropic-ai/sdk@1.4.0 (verificado nos tipos — RESEARCH Pattern 6)
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
const msg = await client.messages.parse({
  model, max_tokens: 4096, system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: JSON.stringify(input) }],
  output_config: { format: zodOutputFormat(ProposalSchema), effort: 'medium' },
});
msg.parsed_output; // Proposal | null
msg.usage.input_tokens; msg.usage.output_tokens;
// 04-03
ScheduleContext, ProposalSchema, Proposal; validateProposal(p, ctx) → { ok, violations, warnings }; buildHeuristicProposal(ctx) → { proposal, unscheduled }
// 04-08
BridalService.schedule(orgId, memberId, { groupId, items: [{ groupMemberId, serviceId, professionalId, startsAt, endsAt, purpose }], deposits? }) → BridalSchedulePayload
// 04-01 AppConfigService: anthropicApiKey(): string|undefined; anthropicModel(): string ('claude-sonnet-5-5'); aiScheduleDailyLimit(): number (20)
// 04-06 ContractSettingsService.getEffective(tx, orgId): scheduleDayStart/End 'HH:MM'
// identity/member-categories.ts: professionalServesCategory(tx, professionalId, categoryId): Promise<boolean>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Client injetável, prompt e construtor de contexto sem PII</name>
  <files>apps/backend/src/bridal/ai/anthropic-client.ts, apps/backend/src/bridal/ai/ai-schedule.prompt.ts, apps/backend/src/bridal/ai/ai-schedule-context.ts, apps/backend/src/bridal/ai/ai-schedule.schema.ts</files>
  <read_first>
    - apps/backend/src/bridal/ai/ai-schedule.schema.ts (04-03)
    - apps/backend/node_modules/@anthropic-ai/sdk/helpers/zod.d.ts (conferir qual import de zod o helper aceita)
    - apps/backend/src/identity/member-categories.ts
    - apps/backend/src/appointments/appointment-status.ts (BLOCKING_STATUSES)
  </read_first>
  <behavior>
    - `buildPromptInput(ctx)` não contém nenhum nome de cliente nem CPF/telefone (teste com ctx cujas pessoas têm nomes "Maria Silva" no mapa interno → string JSON não contém "Maria")
    - `canonicalHash(ctx)` é igual para ctx com arrays em ordem diferente e muda quando um `busy` muda
  </behavior>
  <action>
1. `anthropic-client.ts`: `export interface AnthropicLike { messages: { parse(args: unknown): Promise<{ parsed_output?: unknown; usage?: { input_tokens?: number; output_tokens?: number } }> } }`; `export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT')`; `anthropicClientProvider = { provide: ANTHROPIC_CLIENT, inject: [AppConfigService], useFactory: (c) => c.anthropicApiKey() ? new Anthropic({ apiKey: c.anthropicApiKey(), maxRetries: 2, timeout: 60_000 }) : null }`.
2. Se `zodOutputFormat` exigir zod v4, trocar em `ai-schedule.schema.ts` o import para `import { z } from 'zod/v4'` (zod 3.25 traz o subpath) sem mudar a forma do schema; rodar os specs do 04-03 de novo.
3. `ai-schedule.prompt.ts`: `SYSTEM_PROMPT` (PT-BR, objetivo): "Você monta a agenda de um evento de noiva num salão. Regras obrigatórias: cada pessoa recebe cada serviço listado exatamente uma vez; use só profissionais em eligibleProfessionalIds do serviço; duração exata; sem sobreposição por profissional, por pessoa nem com busy; dentro de [dayStart, dayEnd]; todos terminam até readyBy; a noiva (role bride) termina por último, o mais perto possível de readyBy; com deslocamento, reserve travelBeforeMinutes antes do primeiro e travelAfterMinutes depois do último atendimento de cada profissional. Prefira concentrar o trabalho e evitar janelas ociosas. Responda só com o JSON do schema; horários ISO 8601 UTC." `buildPromptInput(ctx)` = `JSON.stringify` de `{ eventDate, readyBy, dayStart, dayEnd, travelBeforeMinutes, travelAfterMinutes, persons: [{ ref, role, services: [{ serviceId, label, durationMinutes, eligibleProfessionalIds }] }], professionals: [{ id, label }], busy }`. `canonicalHash(ctx)` = `sha256Hex` de JSON com arrays ordenados (persons por ref, services por serviceId, busy por professionalId+startsAt) + modelo.
4. `ai-schedule-context.ts`: `AiScheduleContextBuilder.build(tx, orgId, groupId): Promise<{ ctx: ScheduleContext; refs: Map<string, { groupMemberId; clientName; role }>; profLabels: Map<string, string>; serviceNames: Map<string, string> }>` — grupo `active` (`GROUP_NOT_ACTIVE`); pessoas = membros com serviços planejados `purpose 'event'` (noiva primeiro, depois `sort_order`), `ref` = `p1..pN`; sem nenhum serviço → `NO_PLANNED_SERVICES`; se o grupo já tem agendamentos 'event' ativos → `ALREADY_SCHEDULED`; profissionais = membros ativos `isProfessional` que atendem ≥ 1 categoria dos serviços (`professionalServesCategory`); `label` = `prof_1..` (nome real só em `profLabels`, para a UI); `eligibleProfessionalIds` por serviço; `busy` = agendamentos (BLOCKING_STATUSES) desses profissionais que cruzam a janela + `time_blocks` deles ou org-wide (`professional_id NULL` → replicar para cada profissional); janela = `event_date` + `scheduleDayStart/End` no fuso da org convertidos para UTC (`(date + time) AT TIME ZONE tz` via SQL); `readyBy` = `group.ready_by` ou `dayEnd`; deslocamento só se `external`. Limite 12 pessoas × 10 serviços (`CONTEXT_TOO_LARGE`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- ai-schedule schedule-validator heuristic-scheduler && corepack pnpm --filter @sgs/backend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export const ANTHROPIC_CLIENT" apps/backend/src/bridal/ai/anthropic-client.ts` encontra
    - `grep -n "fullName\|cpf\|phone" apps/backend/src/bridal/ai/ai-schedule.prompt.ts` não encontra
    - `grep -n "ALREADY_SCHEDULED\|NO_PLANNED_SERVICES" apps/backend/src/bridal/ai/ai-schedule-context.ts` encontra os 2
    - Specs verdes (incluindo os do 04-03)
  </acceptance_criteria>
  <done>Contexto canônico, sem PII, com hash estável e client injetável/opcional.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: AiScheduleService (cache → limite → Claude → validação → fallback) + confirmação + SDL</name>
  <files>apps/backend/src/bridal/ai/ai-schedule.service.ts, apps/backend/src/bridal/ai/ai-schedule.service.spec.ts, apps/backend/src/bridal/ai/ai-schedule.resolver.ts, apps/backend/src/bridal/ai/ai-schedule.module.ts, apps/backend/src/graphql/schema/ai-schedule.graphql</files>
  <read_first>
    - apps/backend/src/bridal/ai/ai-schedule-context.ts (Task 1)
    - apps/backend/src/bridal/bridal.service.ts (schedule — 04-08)
    - apps/backend/src/bridal/bridal.module.ts (exports)
  </read_first>
  <behavior>
    - client null → `source 'heuristic'`, `fallbackReason 'NO_API_KEY'`, client nunca chamado
    - client devolve proposta válida → `source 'claude'`, `model` = env, tokens gravados
    - client lança erro → heurística com `API_ERROR`
    - client devolve proposta com conflito duas vezes → heurística com `INVALID_OUTPUT` e exatamente 2 chamadas (1 retry com as violações no prompt)
    - mesma entrada 2x → segunda `cached true`, client chamado 1 vez
    - limite 1 já usado nas últimas 24h → heurística com `LIMIT_REACHED`
  </behavior>
  <action>
1. `AiScheduleService.suggest(orgId, memberId, groupId)`: `runWithTenant` → `build` → `hash = canonicalHash(ctx, model)`; cache: `ai_schedule_suggestions` com `(org, group, input_hash)` e `created_at > now() − 24h` → devolve (`cached: true`); senão: `client == null` → heurística `NO_API_KEY`; `count(source='claude', created_at > now() − 24h) >= aiScheduleDailyLimit()` → heurística `LIMIT_REACHED`; senão chamar `client.messages.parse({ model, max_tokens: 4096, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: buildPromptInput(ctx) }], output_config: { format: zodOutputFormat(ProposalSchema), effort: 'medium' } })` fora da transação (não segurar conexão durante a chamada: montar ctx numa tx, chamar API, gravar em outra tx); `ProposalSchema.safeParse(parsed_output)` + `validateProposal`; inválido → 1 retry acrescentando ao conteúdo `\nViolações da tentativa anterior: ${JSON.stringify(violations)}`; ainda inválido → heurística `INVALID_OUTPUT`; exceção → heurística `API_ERROR` (logar sem o prompt). Heurística: `buildHeuristicProposal(ctx)`; `unscheduled` vai no retorno. Persistir sugestão (`source`, `model` quando claude, `proposal`, `warnings`, tokens, `created_by`). Retorno mapeia refs → `groupMemberId`/`personLabel` (nome da cliente, só para a UI do dono) e `professionalName`.
2. `confirm(orgId, memberId, { groupId, items, deposits })`: `runWithTenant` → reconstruir ctx (sem a checagem ALREADY_SCHEDULED só se itens vierem para pessoas sem agendamento — manter a checagem), converter itens (groupMemberId → ref) e `validateProposal`; violações → payload `errors` com `code 'INVALID_PROPOSAL'` e uma entrada por violação (`message` legível, `field` = `items.<i>`); válido → `BridalService.schedule(orgId, memberId, { groupId, items: items.map(i => ({ ...i, purpose: 'event' })), deposits })`.
3. `ai-schedule.graphql`:
```graphql
type AiScheduleItem { personRef: String!  groupMemberId: UUID!  personLabel: String!  role: String!  serviceId: UUID!  serviceName: String!  professionalId: UUID!  professionalName: String!  startsAt: DateTime!  endsAt: DateTime! }
type AiScheduleUnscheduled { groupMemberId: UUID!  personLabel: String!  serviceId: UUID!  serviceName: String! }
type AiScheduleSuggestion {
  id: UUID!  source: String!  model: String  cached: Boolean!  fallbackReason: String
  items: [AiScheduleItem!]!  unscheduled: [AiScheduleUnscheduled!]!  warnings: [String!]!
  dayStart: DateTime!  dayEnd: DateTime!  readyBy: DateTime!
}
type AiScheduleSuggestionPayload { suggestion: AiScheduleSuggestion  errors: [UserError!]! }
input ConfirmBridalScheduleInput { groupId: UUID!  items: [BridalScheduleItemInput!]!  deposits: [BridalDepositInput!] }
extend type Mutation {
  suggestBridalSchedule(groupId: UUID!): AiScheduleSuggestionPayload!
  confirmBridalSchedule(input: ConfirmBridalScheduleInput!): BridalSchedulePayload!
}
```
   (`suggest` é mutation porque grava e consome cota.) Resolver: `suggestBridalSchedule` com `BRIDAL_AI_SUGGEST`; `confirmBridalSchedule` com `BRIDAL_WRITE`. Módulo: `imports: [BridalModule, ContractsModule]`, providers `anthropicClientProvider, AiScheduleContextBuilder, AiScheduleService, AiScheduleResolver`.
4. `ai-schedule.service.spec.ts` (unit, com `Test.createTestingModule` e fakes de TenantContextService/ContextBuilder/persistência OU extraindo a decisão para `decideSuggestion(deps)` pura): os 6 comportamentos do `<behavior>`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- ai-schedule</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "messages.parse" apps/backend/src/bridal/ai/ai-schedule.service.ts` encontra; `grep -n "zodOutputFormat" ...service.ts` encontra
    - `grep -n "NO_API_KEY\|LIMIT_REACHED\|API_ERROR\|INVALID_OUTPUT" apps/backend/src/bridal/ai/ai-schedule.service.ts` encontra os 4
    - `grep -n "suggestBridalSchedule(groupId: UUID!): AiScheduleSuggestionPayload!" apps/backend/src/graphql/schema/ai-schedule.graphql` encontra
    - Spec unit verde com os 6 casos
  </acceptance_criteria>
  <done>Sugestão IA com fallback, cache e limite; confirmação revalidada.</done>
</task>

<task type="auto">
  <name>Task 3: Fake do client e suíte phase4-ai-schedule</name>
  <files>apps/backend/test/integration/helpers/fake-anthropic.ts, apps/backend/test/integration/phase4-ai-schedule.e2e.spec.ts</files>
  <read_first>
    - apps/backend/test/integration/helpers/phase4-fixtures.ts e phase3-fixtures.ts (como compilar AppModule com overrideProvider)
    - apps/backend/src/bridal/ai/anthropic-client.ts
  </read_first>
  <action>
1. `fake-anthropic.ts`: `class FakeAnthropic implements AnthropicLike { calls: unknown[] = []; next: Array<(args) => unknown | Promise<unknown>> = []; messages = { parse: async (args) => { this.calls.push(args); const f = this.next.shift(); if (!f) throw new Error('no fake response'); return f(args); } } }` + helpers `respondWith(proposal)`, `failWith(err)`.
2. Suíte (app compilado com `.overrideProvider(ANTHROPIC_CLIENT).useValue(fake)`; uma segunda app sem override e sem chave para o caso NO_API_KEY; grupo via `createBridalGroup` com noiva 2 serviços + 4 acompanhantes 1 serviço, `readyBy` 15:00 local; proA e proB habilitados):
   - Sem chave → `suggestBridalSchedule` devolve `source "heuristic"`, `fallbackReason "NO_API_KEY"`, itens para as 5 pessoas, noiva terminando ≤ readyBy (critério 3 sem chave).
   - Fake com proposta válida (montada a partir da heurística do mesmo ctx, deslocada) → `source "claude"`; `ai_schedule_suggestions` com tokens; o `content` enviado ao fake não contém o nome de nenhuma cliente do grupo (LGPD).
   - Segunda chamada igual → `cached true`, `fake.calls.length` inalterado.
   - Novo agendamento de proA no dia (muda `busy`) → hash novo, nova chamada.
   - Fake devolve proposta com sobreposição duas vezes → heurística `INVALID_OUTPUT`, 2 chamadas.
   - Fake lança → `API_ERROR`.
   - `AI_SCHEDULE_DAILY_LIMIT` atingido (inserir 20 linhas `source 'claude'` via adminPrisma) → `LIMIT_REACHED`.
   - Nada criado na agenda após sugerir (contar `appointments` do grupo = 0).
   - `confirmBridalSchedule` com itens da sugestão → agendamentos criados (7) e comandas; com um item editado para sobrepor outro → `INVALID_PROPOSAL` e nada criado.
   - RBAC: ATTENDANT sem `bridal.aiSuggest` → permissão negada; org B não sugere para grupo da A.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test:integration -- phase4-ai-schedule</automated>
  </verify>
  <acceptance_criteria>
    - Suíte verde; `grep -n "overrideProvider(ANTHROPIC_CLIENT)" apps/backend/test/integration/phase4-ai-schedule.e2e.spec.ts` encontra
    - `grep -n "INVALID_PROPOSAL\|LIMIT_REACHED\|cached" apps/backend/test/integration/phase4-ai-schedule.e2e.spec.ts` encontra os 3
  </acceptance_criteria>
  <done>AI-01 provado sem rede: Claude (fake), fallback, cache, limite, LGPD e confirmação.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test -- ai-schedule && corepack pnpm --filter @sgs/backend test:integration -- phase4-ai-schedule` verdes. Manual (VALIDATION): no staging com `ANTHROPIC_API_KEY`, sugerir e confirmar uma agenda real.</verification>

<success_criteria>"Sugerir agenda IA" consulta a Claude API (ou a heurística) e devolve alocação validada considerando disponibilidade e tempo de serviço.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-12-SUMMARY.md`
</output>

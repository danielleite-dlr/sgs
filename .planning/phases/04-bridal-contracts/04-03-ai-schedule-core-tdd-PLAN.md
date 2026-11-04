---
phase: 04-bridal-contracts
plan: 03
type: tdd
wave: 1
depends_on: []
files_modified:
  - apps/backend/src/bridal/ai/ai-schedule.schema.ts
  - apps/backend/src/bridal/ai/schedule-validator.ts
  - apps/backend/src/bridal/ai/schedule-validator.spec.ts
  - apps/backend/src/bridal/ai/heuristic-scheduler.ts
  - apps/backend/src/bridal/ai/heuristic-scheduler.spec.ts
autonomous: true
requirements: [AI-01]

must_haves:
  truths:
    - "Uma proposta com sobreposição de profissional, conflito com ocupação, profissional não habilitado, duração errada ou fora da janela do dia é rejeitada com o código da violação"
    - "A heurística gera, sem rede, uma proposta válida para noiva + 4 acompanhantes com a noiva terminando até o horário 'pronta até'"
    - "A heurística é determinística (mesma entrada → mesma saída)"
  artifacts:
    - path: "apps/backend/src/bridal/ai/ai-schedule.schema.ts"
      exports: ["ScheduleContext", "ProposalSchema", "Proposal", "ProposalItem"]
    - path: "apps/backend/src/bridal/ai/schedule-validator.ts"
      exports: ["validateProposal", "ViolationCode"]
    - path: "apps/backend/src/bridal/ai/heuristic-scheduler.ts"
      exports: ["buildHeuristicProposal"]
  key_links:
    - from: "heuristic-scheduler.ts"
      to: "schedule-validator.ts"
      via: "toda proposta heurística passa em validateProposal nos testes"
      pattern: "validateProposal"
---

<objective>
Núcleo puro da sugestão de agenda (AI-01): tipos/Zod da entrada e da proposta, validador de conflitos e heurística determinística de fallback. Sem Claude, sem banco.

Purpose: CONTEXT "Claude's Discretion" exige que a saída do Claude seja validada (estrutura + conflitos) e que o sistema funcione sem chave da API. Este plano entrega as duas peças testáveis; o plano 04-12 faz a orquestração.
Output: `ai-schedule.schema.ts`, `schedule-validator.ts`, `heuristic-scheduler.ts` + specs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
```
Branch `master`; sempre `corepack pnpm`. Commits `test(04-03)` (RED) / `feat(04-03)` (GREEN). Gate: `corepack pnpm --filter @sgs/backend lint && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test`.

<interfaces>
Contrato que este plano CRIA (o 04-12 e o 04-13 consomem — manter exatamente):
```typescript
// ai-schedule.schema.ts
import { z } from 'zod';
export interface ScheduleContext {
  eventDate: string;            // 'YYYY-MM-DD' (data local)
  readyBy: string;              // ISO instant: todos terminam até aqui; noiva por último
  dayStart: string;             // ISO instant (janela do dia — D-25)
  dayEnd: string;               // ISO instant
  travelBeforeMinutes: number;  // 0 se estúdio
  travelAfterMinutes: number;
  persons: {
    ref: string;                // 'p1'...'pN' — rótulo SEM PII
    role: 'bride' | 'companion';
    services: { serviceId: string; label: string; durationMinutes: number; eligibleProfessionalIds: string[] }[];
  }[];
  professionals: { id: string; label: string }[];
  busy: { professionalId: string; startsAt: string; endsAt: string }[]; // agendamentos + time_blocks do dia
}
export const ProposalItemSchema = z.object({
  personRef: z.string(), serviceId: z.string(), professionalId: z.string(),
  startsAt: z.string(), endsAt: z.string(),
});
export const ProposalSchema = z.object({ items: z.array(ProposalItemSchema), rationale: z.string().optional() });
export type ProposalItem = z.infer<typeof ProposalItemSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
```
Schema enviado ao Claude deve ser SIMPLES (strings, sem min/max) — regras fortes ficam no validador (RESEARCH Pattern 6, MEDIUM).
</interfaces>
</context>

<feature>
  <name>Validador e heurística da agenda do evento</name>
  <files>apps/backend/src/bridal/ai/*.ts</files>
  <behavior>
`validateProposal(p: Proposal, ctx: ScheduleContext): { ok: boolean; violations: { code: ViolationCode; personRef?: string; serviceId?: string; professionalId?: string; message: string }[]; warnings: { code: 'BRIDE_NOT_LAST'; message: string }[] }`
`ViolationCode` = `'UNKNOWN_PERSON' | 'UNKNOWN_SERVICE' | 'MISSING_SERVICE' | 'DUPLICATE_SERVICE' | 'UNKNOWN_PROFESSIONAL' | 'PROFESSIONAL_NOT_ELIGIBLE' | 'INVALID_TIME' | 'WRONG_DURATION' | 'OUTSIDE_DAY_WINDOW' | 'AFTER_READY_BY' | 'PROFESSIONAL_OVERLAP' | 'BUSY_CONFLICT' | 'PERSON_OVERLAP' | 'TRAVEL_CONFLICT'`.
Regras:
- cada (personRef, serviceId) do ctx aparece exatamente 1 vez (falta → MISSING_SERVICE; repetido → DUPLICATE_SERVICE; par fora do ctx → UNKNOWN_PERSON/UNKNOWN_SERVICE);
- profissional existe (UNKNOWN_PROFESSIONAL) e está em `eligibleProfessionalIds` (PROFESSIONAL_NOT_ELIGIBLE);
- `Date.parse` válido e `endsAt > startsAt` (INVALID_TIME); `endsAt − startsAt` = `durationMinutes` (WRONG_DURATION);
- `startsAt >= dayStart` e `endsAt <= dayEnd` (OUTSIDE_DAY_WINDOW); `endsAt <= readyBy` (AFTER_READY_BY);
- intervalos `[start, end)` do mesmo profissional não se sobrepõem (PROFESSIONAL_OVERLAP) nem com `busy` dele (BUSY_CONFLICT); mesma pessoa sem sobreposição (PERSON_OVERLAP);
- se travelBefore/After > 0: para cada profissional, `[primeiroInício − travelBefore, primeiroInício)` e `[últimoFim, últimoFim + travelAfter)` não colidem com `busy` (TRAVEL_CONFLICT);
- warning BRIDE_NOT_LAST se o maior `endsAt` da noiva < maior `endsAt` de alguma acompanhante.
Casos de teste (tabela, fixture de ctx: evento 2026-12-20, readyBy 15:00Z−03 → '2026-12-20T18:00:00.000Z', janela 06:00–20:00 local, 2 profissionais `m1` (maquiagem) e `h1` (cabelo), noiva com maquiagem 60 + penteado 60, 4 acompanhantes com maquiagem 45): proposta correta → ok; cada código de violação tem pelo menos um caso que o produz isoladamente.

`buildHeuristicProposal(ctx): { proposal: Proposal; unscheduled: { personRef: string; serviceId: string }[] }`
Algoritmo determinístico (passo de 5 minutos, varredura para trás):
1. Ordem das tarefas: serviços da noiva em ordem inversa (o último serviço da noiva termina o mais perto possível de `readyBy`), depois acompanhantes na ordem de `persons`, cada uma com serviços em ordem inversa.
2. Para cada tarefa: `latestEnd = min(cursorDaPessoa ?? readyBy, readyBy)`; para cada profissional elegível (ordenado por id), procurar o maior `end ≤ latestEnd` (múltiplo de 5 min desde dayStart) tal que `[end − dur, end)` está dentro da janela, não colide com `busy` do profissional, com itens já atribuídos a ele, nem com a pessoa; com deslocamento > 0, o intervalo acolchoado `[start − travelBefore, end + travelAfter)` não colide com `busy`. Escolher o profissional com o maior `end`; empate → menor id.
3. Atribui, `cursorDaPessoa = start`. Sem encaixe → vai para `unscheduled`.
4. Ordenar `proposal.items` por `startsAt`, depois `professionalId`.
Casos: ctx da fixture → `unscheduled = []` e `validateProposal(proposal, ctx).ok === true`; executar 2x dá saídas idênticas (`toEqual`); com `m1` ocupado o dia todo e `m2` elegível, usa `m2`; com nenhum profissional livre para um serviço, ele aparece em `unscheduled` e o resto é agendado; com deslocamento 30/30, o resultado continua válido.
  </behavior>
  <implementation>
Instantes em ms (`Date.parse`) internamente; saída em ISO (`new Date(ms).toISOString()`). Sem dependência de fuso: a janela do dia e readyBy já chegam como instantes. Teto de segurança: no máximo 12 pessoas × 10 serviços (lança `RangeError('CONTEXT_TOO_LARGE')`).
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Schema Zod + validateProposal (RED → GREEN)</name>
  <files>apps/backend/src/bridal/ai/ai-schedule.schema.ts, apps/backend/src/bridal/ai/schedule-validator.ts, apps/backend/src/bridal/ai/schedule-validator.spec.ts</files>
  <read_first>
    - .planning/phases/04-bridal-contracts/04-RESEARCH.md ("Pattern 6")
    - apps/backend/src/comandas/comanda-math.spec.ts (estilo de tabela)
  </read_first>
  <behavior>Seção `validateProposal` do `<feature><behavior>`: um caso por código de violação + caso válido + warning BRIDE_NOT_LAST.</behavior>
  <action>Criar `ai-schedule.schema.ts` exatamente como na `<interfaces>`; RED com os specs; GREEN implementando `validateProposal` e exportando `type ViolationCode`. Exportar também `buildFixtureContext()` APENAS no spec (não no código de produção).</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- schedule-validator</automated>
  </verify>
  <acceptance_criteria>
    - Specs verdes; cada um dos 14 códigos de `ViolationCode` aparece em pelo menos um `expect` (`grep -c "TRAVEL_CONFLICT\|PERSON_OVERLAP\|BUSY_CONFLICT" schedule-validator.spec.ts` ≥ 3)
    - `grep -n "export const ProposalSchema" apps/backend/src/bridal/ai/ai-schedule.schema.ts` encontra
  </acceptance_criteria>
  <done>Validador cobre estrutura, habilitação, duração, janela, conflitos e deslocamento.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: buildHeuristicProposal (RED → GREEN)</name>
  <files>apps/backend/src/bridal/ai/heuristic-scheduler.ts, apps/backend/src/bridal/ai/heuristic-scheduler.spec.ts</files>
  <read_first>
    - apps/backend/src/bridal/ai/schedule-validator.ts (Task 1)
    - apps/backend/src/bridal/ai/ai-schedule.schema.ts
  </read_first>
  <behavior>Seção `buildHeuristicProposal` do `<feature><behavior>` com os 5 casos.</behavior>
  <action>RED → GREEN seguindo o algoritmo numerado. Todo caso de teste confere `validateProposal(result.proposal, ctxSemUnscheduled)` quando `unscheduled` está vazio.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- heuristic-scheduler</automated>
  </verify>
  <acceptance_criteria>
    - Specs verdes; `grep -n "validateProposal" apps/backend/src/bridal/ai/heuristic-scheduler.spec.ts` encontra
    - `grep -n "Math.random\|Date.now" apps/backend/src/bridal/ai/heuristic-scheduler.ts` não encontra nada (determinismo)
  </acceptance_criteria>
  <done>Fallback determinístico gera agenda válida sem rede.</done>
</task>

</tasks>

<verification>`corepack pnpm --filter @sgs/backend test -- bridal/ai` verde; lint e typecheck verdes.</verification>

<success_criteria>Validador e heurística puros, determinísticos e testados por tabela; contrato `ScheduleContext`/`ProposalSchema` publicado para 04-12.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-03-SUMMARY.md`
</output>

# Phase 11: Prioridade de profissionais e cronograma da noiva - Research

**Pesquisado em:** 2026-11-26
**Domínio:** ranking determinístico de profissionais (domínio puro) aplicado ao cronograma da noiva (04.2), à sugestão de agenda do grupo (heurística + IA, fase 4) e ao agendamento comum; duas marcações novas em `Member`; novo limite de acompanhantes no grupo.
**Confiança geral:** HIGH para tudo que foi lido no código (arquivo:linha citados); MEDIUM para as escolhas de modelagem (revezamento derivado, forma da query nova), que são recomendação e não fato.

<user_constraints>
## User Constraints (de 11-CONTEXT.md, copiado literalmente)

### Decisões travadas
- **D-01:** **Fixa** = profissional da equipe do studio (trabalha todo dia); **não fixa** = freelancer chamada quando falta gente. A marcação **só muda a ordem/sugestão**; comissão, repasse e diária não mudam.
- **D-02:** **Atende noiva/debutante** é filtro rígido para os serviços **da noiva/debutante** (make e penteado no cronograma, e serviços da noiva na sugestão de agenda): quem não está marcada **não aparece**. Acompanhantes podem ser atendidas por qualquer profissional que faça o serviço.
- **D-03:** Na subida, **todas as profissionais começam desmarcadas** nas duas marcações (sem migração de dados que marque alguém).
- **D-04:** Enquanto ninguém atender noiva, a lista de make/penteado da noiva fica **vazia, com aviso** e link para Profissionais ("marque quem atende noiva/debutante"). Não há fallback para "todas".
- **D-05:** As marcações seguem o padrão de `isBridalAssistant` (09.1): booleanos no `Member`, editáveis no criar/editar profissional e visíveis na tela Profissionais. Rótulo na UI: "Atende noiva/debutante" e "Fixa (equipe do studio)".
- **D-06:** **Cronograma da noiva (04.2):** ao gerar a simulação, o sistema **já sugere** make e penteado da noiva (fixa livre que atende noiva, pelo critério justo), e o studio pode trocar. **Isto revoga a regra da 04.2/referência "nunca preencher nome de profissional por conta própria"** (D-03 da 04.2). Sem ninguém elegível livre → continua "[a definir]" com aviso.
- **D-07:** **Sugerir agenda do grupo** (heurística e IA em `apps/backend/src/bridal/ai`): escolhe entre as profissionais elegíveis na ordem fixas livres → não fixas livres, com o critério justo (D-10..D-12), em vez da ordem por id de hoje.
- **D-08:** **Agendamento comum** (fora de noiva): ao escolher serviço e horário, o sistema **pré-seleciona** a fixa livre mais justa entre as que fazem o serviço; o usuário pode trocar. Se a profissional **já foi escolhida** (pela cliente ou pelo usuário), o sistema **não troca**: só mostra "sugestão: Fulana (fixa livre)" e mantém a escolha.
- **D-09:** **Todas as listas de escolha de profissional** mostram as fixas primeiro (depois as não fixas), além das sugestões acima.
- **D-10:** Critério: **menos minutos agendados no dia** (agendamentos que bloqueiam agenda) entre as candidatas livres no horário.
- **D-11:** Empate: **revezamento**: vai para quem recebeu a última sugestão/atribuição há mais tempo (não alfabética).
- **D-12:** Sem fixa livre: usa a **não fixa livre** pelo mesmo critério, com selo "não fixa" no cartão/sugestão para o studio saber.
- **D-13:** **Make-off** = fotos/vídeo da noiva (ou debutante) com as acompanhantes ainda de robe, feitas pela equipe de foto contratada logo depois de ela finalizar o cabelo. Portanto o **limite das acompanhantes é o fim do penteado da noiva**, que nos pacotes atuais coincide com o início do registro (making of no Experience, fotos no Glam/Elegance). A regra da 04.2 D-04 continua; ganha o nome "make-off" na tela e nas mensagens.
- **D-14:** Novo campo do grupo **"Acompanhantes prontas até"** (horário de saída das acompanhantes), que vem por padrão igual ao make-off e pode ser editado. Limite efetivo de cada acompanhante = o **mais cedo** entre esse horário e o make-off.
- **D-15:** Dentro da janela, a acompanhante é encaixada **o mais perto possível do limite** (make fresca nas fotos), como a heurística já faz de trás para frente.
- **D-16:** Se não couber todo mundo antes do limite com as profissionais livres: agenda quem cabe e mostra a lista **"não coube"** com o motivo (sem profissional livre a tempo). O studio resolve (freelancer, ajustar horário, ou o override de Gerente/Admin que já existe na 04.2). **Não** remarca clientes comuns.
- **D-17:** Tudo da fase vale para **noiva e debutante** (`BridalGroup.eventKind`), inclusive o cronograma e o filtro "atende noiva/debutante".

### Critério do Claude (Claude's Discretion)
- Modelagem: colunas no `members` (ex.: `is_fixed`, `serves_bridal`), coluna no `bridal_groups` para "acompanhantes prontas até", e como guardar a "última sugestão" para o revezamento (coluna/timestamp por profissional ou derivado dos agendamentos). Migração + RLS nos padrões das fases 4/09.1/10.
- Um módulo de domínio puro e testado (TDD) para o ranking de profissionais (elegíveis → fixas → minutos no dia → revezamento), reaproveitado por cronograma, sugestão de agenda e agendamento comum.
- Como a debutante entra no cronograma se o pacote dela não tiver regra de etapas (segue D-01 da 04.2: sem regra, pede para configurar).
- Selos e textos na UI, no padrão visual Gestor Beauty (fase 6).

### Ideias adiadas (FORA DO ESCOPO)
- Pagamento diferente para fixa e não fixa (diária de freelancer).
- Remarcar automaticamente agendamentos comuns para abrir espaço para o grupo da noiva.
- Saída individual por acompanhante (D-14 usa uma saída do grupo).
- Ordem de preferência manual entre as fixas (empate por revezamento).
</user_constraints>

## Project Constraints (de CLAUDE.md)

- Stack fixa: NestJS 10 + GraphQL schema-first (SDL em `apps/backend/src/graphql/schema/*.graphql`) + Prisma 5 + PostgreSQL 16; frontend React 18 + Vite + Apollo Client 3 + Tailwind + shadcn/ui. Não trocar nada; **nenhuma biblioteca nova** é necessária nesta fase.
- Multi-tenancy por RLS é inegociável. Esta fase só adiciona colunas em tabelas que já têm RLS (`members`, `bridal_groups`); **não cria tabela**, então não precisa de policy nova (ver Runtime State Inventory não se aplica: não é rename).
- LGPD, WCAG 2.1 AA (checkboxes com label, selos com texto e não só cor), OWASP.
- Testes: cobertura unitária no domínio, E2E nos fluxos críticos, bloqueio de PR em falha.
- Memória do usuário: tudo em PT-BR; gate completo antes de commit; depois push + deploy staging; deploy de worktree limpo se houver trabalho alheio não commitado.
- Fluxo GSD: edições via `/gsd:*`.

<phase_requirements>
## Phase Requirements

O ROADMAP não traz IDs ("TBD"). Proposta PRIO-01..PRIO-16 em "## Proposed Requirements" (o orquestrador copia para REQUIREMENTS.md e para a tabela de rastreio "Phase 11", como foi feito com PERM-01..16).
</phase_requirements>

## Summary

O trabalho se divide em quatro blocos: (1) **dados**: duas colunas booleanas em `members` (`is_fixed`, `serves_bridal`, `DEFAULT false`, sem backfill: D-03) e uma coluna em `bridal_groups` (`companions_ready_by timestamptz NULL`, nulo = "igual ao make-off"); o caminho ponta a ponta é uma cópia exata do `isBridalAssistant` (09.1); (2) **um módulo de domínio puro** `rankProfessionals` (TDD) usado em três lugares; (3) **integração**: heurística (troca o `.sort()` por id da linha 61 de `heuristic-scheduler.ts` pela comparação de ranking), contexto/prompt/hash da IA, `buildTimelineTx` (pré-sugestão de make/penteado) e uma query nova para o formulário de agendamento; (4) **limite das acompanhantes**: `evaluateCompanionRules` passa a usar `min(registryStartsAt, companionsReadyBy)`, mensagens com o nome "make-off", e a heurística/validador passam a ter um limite por papel.

Achados que mudam o plano:

1. **`bridal_groups.ready_by` já significa "saída da noiva"** (`timeline.service.ts:670` grava `readyBy = departureAt` ao confirmar). Por isso o campo novo **não pode reaproveitar `readyBy`**; precisa de coluna própria. No contexto da IA hoje `readyBy = min(registryStartsAt, group.readyBy)` vale para **todas** as pessoas (`ai-schedule-context.ts:193-196`, `schedule-validator.ts:131`); é preciso um limite **por papel** (`companionReadyBy`).
2. **O ranking não pode entrar no `validateProposal`**: ele é reutilizado pelo `confirm` (`ai-schedule.service.ts:~340`) e o usuário precisa poder trocar a profissional por uma não fixa. A checagem de prioridade fica numa função separada, só usada em `decide()` sobre a saída da Claude.
3. **O hash do cache de 24h** (`canonicalHash`, `ai-schedule.prompt.ts:30-58`) precisa incluir os atributos novos (fixa, minutos do dia, ordem de revezamento, limite das acompanhantes), senão a sugestão em cache ignora marcações recém-feitas.
4. **D-03 + D-02 quebram os testes existentes** que montam profissionais sem marcação e esperam make/penteado da noiva (04.2 e fase 4). Todos os fixtures de integração/E2E que geram cronograma ou sugestão para a noiva precisam marcar `servesBridal`. Os testes que afirmam "não preenche profissional" (04.2 D-03) precisam ser reescritos.
5. **Revezamento: derivar dos agendamentos** (`max(created_at)` por profissional), sem coluna nova nem escrita ao apenas visualizar uma sugestão. Recomendação detalhada em "Revezamento".

**Primary recommendation:** criar `apps/backend/src/scheduling/professional-ranking.ts` (função pura, sem Prisma) + `professional-ranking-data.ts` (carrega minutos do dia e último agendamento em **uma** query agregada por dia) e consumir nos três pontos; migração única `2026112600xxxx_phase11_priority_flags` com 3 colunas.

## Standard Stack

Sem biblioteca nova. Tudo é feito com o que já está no repositório.

| Peça | Já existe | Uso na fase |
|------|-----------|-------------|
| Prisma 5 + migração SQL manual | `apps/backend/prisma/migrations/20261124000000_bridal_assistant/migration.sql` (padrão `ALTER TABLE members ADD COLUMN ...`) | 3 colunas novas |
| GraphQL schema-first | `graphql/schema/identity.graphql:26-41,48-61,95-105`, `bridal.graphql`, `bridal-timeline.graphql` | campos novos em `Member`, `CreateMemberInput`, `UpdateMemberInput`, `BridalGroup`, `TimelineBrideSlot` |
| `BLOCKING_STATUSES` | `appointments/appointment-status.ts` | soma de minutos do dia e último agendamento |
| `professionalServesCategory` / `memberServesCategory` | `identity/member-categories.ts` | primeiro filtro de elegibilidade |
| `findSlotConflictsTx` | `bridal/timeline/timeline-conflicts.ts` | "livre no horário" na pré-sugestão do cronograma |
| jest (backend, `*.spec.ts` ao lado do código) / jest integração `--runInBand` / vitest / Playwright | ver Validation Architecture | testes |

Verificação de versão: não se aplica (nenhum pacote novo).

### Alternatives Considered
| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| Revezamento derivado de `appointments.created_at` | coluna `members.last_suggested_at` | A coluna gira o rodízio só de olhar a sugestão (sugestão não confirmada "gasta" a vez) e exige escrita em query de leitura; derivado reflete a atribuição real e não tem corrida. Ver "Revezamento". |
| Coluna `companions_ready_by` | reutilizar `ready_by` | `ready_by` já é a saída da noiva (sobrescrita na confirmação). Reutilizar misturaria os dois. |

## Architecture Patterns

### Estrutura recomendada
```
apps/backend/src/
├── scheduling/                       # NOVO (domínio compartilhado)
│   ├── professional-ranking.ts       # puro: rankProfessionals, orderForPicker, pickBest
│   ├── professional-ranking.spec.ts  # TDD
│   └── professional-ranking-data.ts  # carrega dayMinutes + lastAssignedAt (Prisma), 1 query agregada
├── bridal/ai/ ... (heuristic, context, prompt, validator editados)
├── bridal/timeline/ ... (service, guard, domain editados)
├── identity/ ... (members.service, member.input, resolver: professionalsForService/ordenação + query nova)
apps/frontend/src/
├── features/operations/professional-order.ts   # NOVO: sortFixedFirst (puro) + testes
└── ... (diálogos de profissional, VisitFormDialog, BridalTimelineTab, AiSuggestionPanel, ...)
```
Onde pôr o módulo: `scheduling/` não existe; alternativa aceitável é `identity/professional-ranking.ts` (já abriga `member-categories.ts`). Escolher um e manter a função pura sem import de Prisma.

### Pattern 1: Ranking puro (a peça central)
**O quê:** função determinística, sem relógio nem aleatoriedade.
```ts
export interface RankCandidate {
  id: string;
  isFixed: boolean;
  servesBridal: boolean;
  /** minutos já agendados no dia (BLOCKING_STATUSES) + atribuídos nesta rodada */
  dayMinutes: number;
  /** epoch ms do último agendamento criado; null = nunca (vai primeiro) */
  lastAssignedAt: number | null;
  /** livre no horário do slot */
  free: boolean;
}
export interface RankOptions { bridal: boolean }

/** Elegíveis (D-02) -> só livres -> fixas antes de não fixas -> menos minutos -> rodízio -> id. */
export function rankProfessionals(c: RankCandidate[], o: RankOptions): RankCandidate[] {
  return c
    .filter((x) => x.free && (!o.bridal || x.servesBridal))
    .sort((a, b) =>
      Number(b.isFixed) - Number(a.isFixed) ||
      a.dayMinutes - b.dayMinutes ||
      (a.lastAssignedAt ?? -Infinity) - (b.lastAssignedAt ?? -Infinity) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
```
(`-Infinity - -Infinity` dá NaN; no código real comparar com ramo explícito para null.) O desempate final por `id` garante determinismo (requisito herdado de `heuristic-scheduler.spec.ts:78`). Para listas (D-09) usar `orderForPicker`: fixas primeiro e depois `displayName` (pt-BR, `localeCompare`), sem exigir livre/horário.

### Pattern 2: Onde plugar na heurística
`heuristic-scheduler.ts:61-83`: hoje percorre `pros` ordenadas por id, acha o slot mais tardio por profissional e fica com o de maior `end` (a poda `if (best && end <= best.end) break` na linha 70 só vale para esse critério). Mudança recomendada:
1. Para cada profissional elegível calcular o melhor slot (mais perto do limite, D-15) como hoje, **sem poda entre profissionais**.
2. Entre as que têm slot, escolher por `rankProfessionals` (tier fixa/não fixa → minutos → rodízio → id); só então desempatar por `end` maior e `id`.
3. Atualizar `dayMinutes` da escolhida e o rodízio **dentro da rodada** (`assignedByPro` já guarda os intervalos: somar duração) para a divisão justa funcionar entre as várias pessoas do evento. Dar à escolhida uma posição de rodízio "mais recente que qualquer valor do banco" (contador sequencial da rodada).
4. `cursorByPerson` e limite: `latestEnd = min(cursor ?? limitDaPessoa, limitDaPessoa)` com `limitDaPessoa = role==='bride' ? readyBy : companionReadyBy`.
5. `unscheduled` ganha `reason` (ex.: `'NO_FREE_PROFESSIONAL_BEFORE_LIMIT'`) para a lista "não coube" (D-16). Hoje `Unscheduled = {personRef, serviceId}` (`ai-schedule.service.ts:27-30`), a view `unscheduled` em `ai-schedule.graphql` e a UI (`AiSuggestionPanel.tsx`) precisam do campo novo; o `StoredProposal` é JSON, então campo opcional é retrocompatível.

Tensão a decidir (ver Open Questions Q1): prioridade estrita (fixa com slot às 06:00 vence não fixa com slot às 09:45) versus D-15 (perto do limite). A CONTEXT dá a ordem fixa→não fixa como regra (D-07) e D-15 como critério de posição dentro da profissional escolhida; recomendação: **prioridade estrita**, e o aviso/`warnings` informa "encaixada mais cedo por falta de fixa livre mais perto do limite" quando a distância passar de um limiar (planner decide se vale).

### Pattern 3: Caminho da IA
- `ai-schedule-context.ts:102-125` (`proRows`): selecionar também `isFixed`, `servesBridal`; **filtrar `eligibleProfessionalIds` pelo `servesBridal` quando a pessoa é `bride`** (D-02/D-17): isso torna a regra rígida automaticamente pelo `PROFESSIONAL_NOT_ELIGIBLE` já existente em `schedule-validator.ts:~100`, valendo também no `confirm` (o `confirm` reconstrói o ctx com o builder). Com acompanhantes, sem filtro.
- `ScheduleContext.professionals[]` (`ai-schedule.schema.ts:23`) ganha `isFixed`, `dayMinutes`, `rotationRank` (inteiro 0..n, ordem do mais antigo), sem PII (continua `prof_N`). Colocar a lista **já na ordem do ranking** e instruir no `SYSTEM_PROMPT`: "prefira profissionais fixas livres; entre elas a de menos minutos (dayMinutes) e depois a de menor rotationRank; use não fixa só se nenhuma fixa elegível estiver livre".
- `ScheduleContext` ganha `companionReadyBy` (ISO). `buildPromptInput` e `canonicalHash` incluem os campos novos (**obrigatório** por causa do cache de 24h, `CACHE_WINDOW_MS`).
- Honrar a prioridade: criar `checkPriority(proposal, ctx): Violation[]` **separado** de `validateProposal`, chamado só em `decide()` sobre a saída da Claude (`ai-schedule.service.ts` laço de 2 tentativas): se um item usa não fixa quando havia fixa elegível livre naquele intervalo, vira violação `PRIORITY_NOT_FOLLOWED` e cai no mesmo caminho de retry/fallback para a heurística (que é determinística). Justiça entre fixas (minutos/rodízio) fica como **warning** (não violação) para não gerar fallback em excesso. **Nunca** colocar isso em `validateProposal`: ele também valida a proposta editada pelo usuário no `confirm`.
- Selo "não fixa": o `AiScheduleSuggestionView.items[]` ganha `professionalIsFixed` (build.profLabels já tem o nome; acrescentar `profFixed: Map`), e o cartão da UI mostra o selo.

### Pattern 4: Cronograma da noiva (04.2) com pré-sugestão
`buildTimelineTx` (`timeline.service.ts:102-300`) recebe `make`/`hair` por id. Mudança:
- Novo parâmetro `opts.autoSuggest` (true só em `preview`; **`confirm` continua exigindo ids explícitos**, pois o front confirma o que a simulação mostrou e `missing` já barra id nulo, linhas 261-262).
- Ordem: `computeTimeline` já gera as janelas independentemente dos nomes (horários vêm só dos offsets). Fluxo: (a) calcular `result`/`slots` com nomes nulos; (b) para cada slot sem profissional informada, montar candidatas = profissionais ativas com `isProfessional`, `servesBridal`, que atendem a categoria (`professionalServesCategory`) e estão livres (`findSlotConflictsTx` devolve lista vazia); (c) `rankProfessionals(..., {bridal:true})`; make e penteado em sequência, somando os minutos do primeiro slot ao segundo (assim duas fixas se dividem); (d) recomputar `computeTimeline` com os nomes (ou apenas reaplicar nomes nas linhas) para o texto sair preenchido.
- Revoga 04.2 D-03: o comentário/regra "[a definir]" só aparece se não há elegível livre. Novos avisos em `TimelineWarningCode` (`timeline-domain.ts:40`): `NO_BRIDAL_PROFESSIONAL` (nenhuma profissional marcada: mensagem com link "marque quem atende noiva/debutante", D-04) e `NO_FREE_PROFESSIONAL` (há marcadas, mas nenhuma livre).
- `TimelineBrideSlot` (`bridal-timeline.graphql:27`) ganha `suggested: Boolean!` e `isFixed: Boolean` para o selo "sugerida" / "não fixa" (D-12). `confirmTimelineTx` não muda.
- `loadProfessional` (linha 90) e a validação `missing` (linhas 263-270) passam a recusar quem não é `servesBridal` ("X não atende noiva/debutante"): enforcement no servidor, não só no picker.
- Debutante: nada no cronograma restringe a noiva hoje (`BridalTimelineTab` não testa `eventKind`; a aba aparece em `BridalGroupDetailPage.tsx:243` para os dois; a debutante é um `BridalGroupMember` com `role='bride'`, `client-overview.ts:35`). Só ajustar rótulos/mensagens ("noiva/debutante") e o título do texto (`CRONOGRAMA NOIVA ...` é o formato da referência 04.2: não mudar sem decisão, ver Q4). Pacote sem regra de etapas já gera `TIMELINE_RULES_MISSING` (04.2 D-01).

### Pattern 5: Limite das acompanhantes (make-off)
- Coluna `bridal_groups.companions_ready_by timestamptz NULL` + `BridalGroup.companionsReadyBy` no schema Prisma (`schema.prisma:874-919`), no tipo GraphQL `BridalGroup`, `CreateBridalGroupInput`/`UpdateBridalGroupInput` (`bridal.graphql:5,68`) e em `bridal.service.ts:229-254` (mesma validação de `readyBy`: mesma data local do evento).
- `ConfirmedTimelineLite` (`timeline-guard.ts:14`) ganha `companionsReadyBy: Date | null`; `toLite` e `findConfirmedTimelinesForCompanionTx` passam a incluir `group: { select: { companionsReadyBy } }` (hoje `findMany` sem include; `findCompanionIssuesTx` também lê o grupo). `evaluateCompanionRules`: `limit = min(registryStartsAt, companionsReadyBy ?? ∞)`; mensagem "precisa terminar até {limit}, quando começa o make-off ({registryLabel}) da noiva X" ou "até o horário de saída das acompanhantes". **Manter o código de erro `TIMELINE_AFTER_REGISTRY`** (o frontend mapeia em `RULE_LABEL`, `BridalTimelineTab`; trocar só o texto). Mudar `companionsReadyBy` depois de confirmado já reflete em `companionIssues` porque `loadTimelineViewTx`/`findCompanionIssuesTx` recalculam ao vivo.
- "Padrão = make-off": nulo na coluna significa "igual ao make-off"; a UI mostra o make-off como valor sugerido (placeholder) e só grava se o usuário editar (assim, trocar o pacote/saída move o make-off e a acompanhante junto).
- IA/heurística: `ctx.companionReadyBy = min(registryStartsAt?, companionsReadyBy ?? ∞, group.readyBy ?? dayEnd)`; `ctx.readyBy` (noiva) permanece `min(registryStartsAt, readyBy)`. `schedule-validator.ts:131` passa a comparar `end > (person.role==='companion' ? companionReadyBy : readyBy)`; código `AFTER_READY_BY` mantém, mensagem cita "make-off"/"saída das acompanhantes".
- Onde editar: no formulário do grupo (`BridalGroupFormDialog.tsx`, junto de "Pronta até") e na aba Cronograma ao lado de "Saída" (`BridalTimelineTab.tsx`, campo novo `companionsReadyTime`, enviado em `BridalTimelineInput` e gravado no `confirmTimelineTx` ao lado do `readyBy` da linha 668-671). Recomendação: **um só mutation** (`confirmBridalTimeline`) grava os dois para o fluxo da usuária (um clique), e o diálogo do grupo edita via `updateBridalGroup`.

### Pattern 6: Agendamento comum (D-08)
- Backend: query nova (mesmo `@RequirePermission(PERMISSIONS.MEMBER_READ)` e marcação de referência/ACCESS_EXEMPT de `professionalsForService`, `members.resolver.ts:46-60`):
```graphql
type ProfessionalSuggestion {
  professionalId: UUID!
  displayName: String!
  isFixed: Boolean!
  free: Boolean!
  dayMinutes: Int!
  "true só para a primeira da lista (a escolhida pelo ranking)"
  suggested: Boolean!
}
extend type Query {
  suggestProfessionals(serviceId: UUID!, startsAt: DateTime!, endsAt: DateTime!, bridal: Boolean): [ProfessionalSuggestion!]!
}
```
  Retorna **todas** as que atendem o serviço, ordenadas: livres antes de ocupadas, depois o ranking; a primeira livre vem `suggested`. Inclui a lista de fixas primeiro para servir também de ordem do seletor (D-09).
- Frontend (`VisitFormDialog.tsx`, componente `LineRow` linhas 175-225): quando `serviceId` + horário + duração estão preenchidos, rodar a query (debounce curto; `fetchPolicy: 'network-only'`). Regra: `professionalId` vazio e **não tocado pelo usuário** -> pré-seleciona a `suggested`; já preenchido -> **não troca**, mostra "Sugestão: Fulana (fixa livre)" abaixo do seletor. Atenção ao `useEffect` de `shouldClearProfessional` (linha 205), que zera a escolha se ela sair da lista permitida; e à `chooseProfessional` (linha 218) que aplica variante por senioridade, que também deve rodar na pré-seleção. Linhas seguintes do mesmo formulário (várias linhas na visita) não enxergam as escolhas das anteriores no servidor: opcionalmente enviar `assumeBusy: [{professionalId, minutes}]`; caso contrário aceitar a imprecisão (os minutos só desempatam).
- Não aplicar quando o diálogo está em modo de grupo de noiva (`bridal` na visita; ali valem os fluxos da noiva).

### Anti-Patterns a evitar
- **Ranking dentro do `validateProposal`** (bloquearia o usuário de trocar para não fixa no `confirm`).
- **Gravar "última sugestão" ao gerar a sugestão**: sugestão não confirmada giraria o rodízio e a leitura teria efeito colateral.
- **Fallback para "todas" quando ninguém é `servesBridal`** (D-04 proíbe): lista vazia + aviso.
- **Usar `Date.now()`/`Math.random()` no ranking**: quebra o determinismo (o `lastAssignedAt` vem do banco, nunca do relógio).
- **Filtrar por `servesBridal` só no frontend**: enforcement no builder da IA e no `buildTimelineTx`.

## Revezamento (D-11): opções e recomendação

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Derivar de `appointments.created_at` (recomendada)** | Sem coluna, sem escrita em leitura, reflete atribuição real (inclui agendamento comum e de noiva), determinístico dado o banco | Uma agregação por consulta |
| B. `members.last_suggested_at` atualizado ao gerar sugestão | Barato de ler | Sugestão ignorada gasta a vez; escrita em query; corrida entre sugestões simultâneas; precisa de política de reset |

Implementação da A: `SELECT professional_id, max(created_at) FROM appointments WHERE professional_id = ANY($1) AND status = ANY(BLOCKING) AND starts_at >= now() - interval '90 days' GROUP BY professional_id`. O índice `ix_appointments_org_professional_starts` (`schema.prisma:571`) cobre o filtro por `starts_at`; **não** existe índice em `created_at` (não criar: o corte de 90 dias já limita). Sem registro na janela = "nunca" = vai primeiro. Os minutos do dia saem da mesma passada ou de uma segunda agregação `sum(extract(epoch from ends_at - starts_at))/60` entre `dayStart` e `dayEnd` do dia do slot no fuso da org (usar o padrão de `$queryRaw` com `AT TIME ZONE o.timezone` já usado em `ai-schedule-context.ts:131-135`). Um cancelamento tira a linha do `BLOCKING_STATUSES` e devolve a vez: aceitável e coerente com "recebeu".

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Elegibilidade por serviço | nova lógica de categoria | `memberServesCategory` / `professionalServesCategory` | já trata hierarquia, ciclos e "sem vínculo = atende tudo" |
| "Livre no horário" | nova checagem de conflito | `findSlotConflictsTx` (cronograma) e, na heurística, `busy`/`assigned` já existentes | mesmas condições do `assertSlotFree`; blocos de tempo, feriados e deslocamento incluídos |
| Status que ocupam agenda | lista própria | `BLOCKING_STATUSES` | = predicado da exclusion constraint |
| Fuso/dia local da org | `new Date().setHours` | `orgTimezone`, `localDate` (`bridal-schedule`), `AT TIME ZONE o.timezone` | armadilhas de fuso já resolvidas (Pitfall 5 da 09.1) |
| Validação final da proposta | segunda validação | `validateProposal` (inalterado salvo limite por papel) | o `confirm` já revalida no servidor |
| Auditoria | tabela nova | `recordAudit` (`common/audit-log`) | marcar fixa/atende noiva é mudança de cadastro; seguir o que `updateMember` já faz |

**Insight:** o determinismo e a regra de prioridade ficam num único módulo puro; os três consumidores só montam candidatas (livre, minutos, rodízio) e chamam a função. Qualquer ordenação "por conta própria" nos consumidores é bug.

## Caminho ponta a ponta de `isBridalAssistant` (a replicar para `isFixed` e `servesBridal`)

| Camada | Arquivo:linha | O que replicar |
|--------|---------------|----------------|
| Schema Prisma | `prisma/schema.prisma:156-157` | `isFixed Boolean @default(false) @map("is_fixed")`, `servesBridal Boolean @default(false) @map("serves_bridal")` |
| Migração | `prisma/migrations/20261124000000_bridal_assistant/migration.sql:5` | `ALTER TABLE members ADD COLUMN is_fixed BOOLEAN NOT NULL DEFAULT false, ADD COLUMN serves_bridal BOOLEAN NOT NULL DEFAULT false;` e `ALTER TABLE bridal_groups ADD COLUMN companions_ready_by TIMESTAMPTZ(6) NULL;` **sem** seed de dados (D-03; a 09.1 tinha um seed separado `...000100_seed_studio_js_bridal_assistant`, aqui não há). Nome sugerido `20261126000000_phase11_priority_flags`. Sem policy/RLS nova (tabelas já têm). `purge_member` não é afetada (colunas sem FK) |
| DTO | `identity/dto/member.input.ts:29` (create), `:80` (update) | `@IsOptional() @IsBoolean()` para as duas |
| SDL | `graphql/schema/identity.graphql:34` (`Member`), `:58` (`CreateMemberInput`), `:101` (`UpdateMemberInput`) | campos `isFixed`/`servesBridal` (`Boolean!` no tipo, `Boolean` nos inputs) |
| Serviço | `identity/members.service.ts:106` (`MEMBER_SELECT`), `:126` (`MemberRow`), `:210` (`toMemberDto`), `:315` (assinatura), `:408-430` (update), `:498-502` (create), `:594` (persistência) | só profissional pode ter as marcações (`finalIsProfessional ? valor : false`; erro `...REQUIRES_PROFESSIONAL` análogo ao de `:408`); **sem** guarda de "vinculada a noiva futura" (a de `countActiveBridalLinks` é específica da assistente) |
| Serialização de comanda | `comandas/comanda-serialize.ts:65` | só se o `Member` serializado ali for reaproveitado; avaliar (provavelmente não precisa) |
| Frontend API | `features/catalog/api/members.api.ts:51,79,105,141,170` | adicionar nas queries `allMembers`, `members` (hoje `MembersQuery` só traz `id displayName email roleName seniorityTier isProfessional`, linhas 10-17: **incluir `isFixed servesBridal`** para o D-09), mutações e tipos |
| Diálogos | `identity/components/CreateMemberDialog.tsx:64,98,195,414-430`; `MemberEditDialog.tsx:74,120,175,336-352` | checkboxes com `data-testid` (`member-fixed`, `member-serves-bridal`), visíveis só quando profissional, hint explicando efeito (D-01: "só muda a ordem de sugestão") |
| Tela Profissionais | `pages/ProfissionaisPage.tsx:171` (badge da assistente) | `Badge` "Fixa" e "Atende noiva/debutante" com `data-testid` próprio |
| i18n | `infrastructure/i18n/locales/pt-BR.json:997-998,1026-1027` | chaves `team.createDialog.isFixedLabel/...`, `team.editDialog...`, `team.table.fixedBadge/servesBridalBadge` |
| Testes existentes a clonar | `backend/test/integration/phase91-members-assistant.e2e.spec.ts`; `frontend/src/features/identity/__tests__/member-dialogs.test.tsx`; `frontend/src/pages/__tests__/profissionais-page.test.tsx`; `apps/e2e/support/phase91.ts` | idem para as duas marcações |

Permissão para editar: `updateMember`/`createMember` já protegidos por `MEMBER_UPDATE`/`MEMBER_INVITE` + `@RequireAccess('profissionais-todos')` (`members.resolver.ts`, fase 10); Gerente edita Atendente/Profissional (10 D-08). **Nenhum item novo no catálogo de acessos.**

## Listas de escolha de profissional (D-09): inventário

Ordenação central no backend (cobre todas que consomem as queries): `orderBy: [{ isFixed: 'desc' }, { displayName: 'asc' }]` em `listProfessionalsForService` (`members.service.ts:931`), na lista `members`/`listAll` (`:270`, `:286`) e nas queries novas. Depois conferir cada consumidor frontend (alguns re-ordenam):

| Consumidor | Arquivo | Ação |
|------------|---------|------|
| Novo agendamento (segmentado + select) | `operations/components/calendar/VisitFormDialog.tsx:117-165,334-352` (usa a lista `professionals` do pai, filtrada por `professionalsForService`) | ordenar `visible` com `sortFixedFirst`; + pré-seleção (D-08) |
| Lista base do pai | `operations/pages/SchedulePage.tsx:~778-800` (a partir de `MembersQuery`) | incluir `isFixed` em `ScheduleProfessional` (`calendar/types.ts:15`); **as colunas da grade seguem `sortProfessionalsByLoad`** (quick 261112-cko); ver Q3 |
| Item de comanda | `operations/components/comanda/AddItemDialog.tsx:58-77,307` | já vem de `professionalsForService` (ordem do backend); garantir não reordenar |
| Cronograma da noiva (make/penteado) | `bridal/components/BridalTimelineTab.tsx:83-105` | `professionalsForService` + novo parâmetro `bridal: true` (filtra `servesBridal`, D-02); estado vazio com aviso e link `/profissionais` (D-04) |
| Prova da noiva | `bridal/components/BridalTrialCard.tsx:65-73` | ordem do backend (prova não é serviço da noiva no sentido D-02: sem filtro, ver Q2) |
| Sugestão da IA (trocar profissional por item) | `bridal/components/AiSuggestionPanel.tsx:87-95` | ordem do backend; para itens da noiva usar `bridal: true` |
| Agendar o grupo manualmente | `bridal/components/BridalScheduleEditor.tsx:28,75` (`professionalsByService`) | idem |
| Bloqueio de agenda | `operations/components/calendar/TimeBlockDialog.tsx` | ordenar com helper |
| Regra de comissão | `catalog/components/CommissionRuleForm.tsx` | ordenar com helper (usa `MembersQuery`) |
| Filtro de profissionais da agenda (chips) | `SchedulePage.tsx:278-297,570,697` | ver Q3 |

`professionalsForService` ganha argumento opcional `bridal: Boolean` (SDL `identity.graphql:5`) e o resolver repassa a `listProfessionalsForService`; `redactPersonal` continua valendo. Como `professionalsForService` devolve `Member`, `isFixed`/`servesBridal` já chegam ao frontend pelo tipo.

## Runtime State Inventory

Não é fase de rename/migração: **omitido**. Observação de dados: nenhuma migração de dados (D-03). Na subida para staging todas as profissionais ficam desmarcadas, então a simulação da noiva sai com lista vazia e aviso até a usuária marcar (Org ativa "Studio JS"). Incluir no deploy checklist/UAT a marcação manual.

## Common Pitfalls

### Pitfall 1: Lista de noiva vazia por não haver marcadas (D-04)
**O que dá errado:** logo após o deploy ninguém é `servesBridal`; make/penteado ficam sem opção, e a IA joga a noiva em `unscheduled`/`CONTEXT_TOO_LARGE`-like erro confuso.
**Como evitar:** avisos explícitos (`NO_BRIDAL_PROFESSIONAL` no cronograma, mensagem própria na sugestão de agenda), link para `/profissionais`, e item no UAT. Não criar fallback.
**Sinal:** `eligibleProfessionalIds` vazio para serviços da noiva.

### Pitfall 2: Quebra dos testes existentes (D-02/D-03/D-06)
**O que dá errado:** `phase42-timeline-preview/confirm`, `phase42-ai`, `phase4-ai-schedule`, `phase4-bridal-schedule` e os E2E `cronograma-noiva.spec.ts`, `debutante-contrato.spec.ts` montam profissionais sem marcação; o filtro rígido esvazia as listas; e os testes que afirmam "não preenche profissional por conta própria" passam a falhar por design.
**Como evitar:** helper de fixture (`markServesBridal(memberIds)`) em `backend/test/integration/helpers/` e `apps/e2e/support/`; reescrever os asserts da 04.2 D-03 (registrar no SUMMARY que a regra foi revogada).

### Pitfall 3: Cache da IA devolvendo sugestão velha
**Causa:** `canonicalHash` não tem os campos novos. **Evitar:** incluir `isFixed`, `dayMinutes`, `rotationRank`, `companionReadyBy` e a lista de elegíveis (já inclui). Teste: duas marcações diferentes -> hashes diferentes (`ai-schedule.prompt.spec.ts`).

### Pitfall 4: Prioridade bloqueando edição manual
**Causa:** colocar a regra em `validateProposal`. **Evitar:** função `checkPriority` separada, só em `decide()`.

### Pitfall 5: Não determinismo no ranking
**Causa:** empate por ordem de inserção do banco, `Date.now()`, `Array.sort` instável com comparador que retorna 0. **Evitar:** último critério `id`, `lastAssignedAt` vindo de consulta, teste "duas execuções idênticas" e "embaralhar entrada, mesma saída".

### Pitfall 6: Desempenho da soma de minutos
**Causa:** N×consulta por profissional×slot (o cronograma tem 2 slots; a IA, até 12 pessoas × 10 serviços). **Evitar:** uma agregação `GROUP BY professional_id` por dia (profissionais do salão ≈ dezenas) e cachear no objeto de contexto; na heurística atualizar em memória. A query de `suggestProfessionals` roda a cada mudança de serviço/horário: usar debounce no frontend e uma única agregação no servidor.

### Pitfall 7: `readyBy` ≠ saída das acompanhantes
**Causa:** reaproveitar `bridal_groups.ready_by`, que `confirmTimelineTx` sobrescreve com `departureAt`. **Evitar:** coluna própria; nulo = make-off.

### Pitfall 8: `findConfirmedTimelinesForCompanionTx` sem `include` do grupo
Hoje faz `bridalTimeline.findMany({ where })` sem trazer o grupo; o limite novo exige `include: { group: { select: { companionsReadyBy: true } } }` (e `findCompanionIssuesTx` já lê o grupo: reaproveitar). `TimelineRow` (tipo local de `toLite`) precisa do campo.

### Pitfall 9: Assistente da noiva "livre"
A assistente (09.1) tem bloqueio `acompanhamento` o dia todo; `busy` da IA já inclui `time_blocks`, mas a lista `professionals` da IA a inclui como candidata. Garantir que o ranking a trate como ocupada (via busy) e **não** a conte como "não fixa livre" por engano na pré-sugestão do cronograma (`findSlotConflictsTx` já considera `time_blocks`).

### Pitfall 10: Pré-seleção sobrescrevendo escolha da cliente (D-08)
Marcar o campo como "tocado" assim que o usuário (ou o pai, por `lines[0].professionalId` copiado em `emptyLine(..., professionalId)`, linhas 92/568/867) preencher; a pré-seleção só atua em campo vazio e nunca depois de `shouldClearProfessional` limpar por mudança de serviço sem novo toque. Teste explícito: profissional já escolhida + sugestão diferente → só aparece o texto.

### Pitfall 11: Janela impossível em D-16
Se `companionReadyBy < dayStart + duração`, nada cabe: `unscheduled` com motivo e aviso, não exceção. A heurística já devolve `unscheduled` quando não há slot (`heuristic-scheduler.ts:~96`); só falta o motivo.

## Code Examples

### Heurística: escolha entre candidatas (esboço)
```ts
// Fonte: padrão de heuristic-scheduler.ts:61-97, adaptado ao ranking
const feasible = pros
  .map((proId) => ({ proId, slot: bestSlotFor(proId) /* mais perto do limite */ }))
  .filter((x) => x.slot !== null);
const ranked = rankProfessionals(
  feasible.map(({ proId }) => ({
    id: proId, free: true,
    isFixed: meta.get(proId)!.isFixed,
    servesBridal: true, // já filtrado em eligibleProfessionalIds
    dayMinutes: meta.get(proId)!.dayMinutes + assignedMinutes(proId),
    lastAssignedAt: rotation.get(proId) ?? null,
  })),
  { bridal: false },
);
const pick = ranked[0]; // desempate final por id dentro do ranking
```

### Guarda das acompanhantes com limite efetivo
```ts
// timeline-guard.ts (evaluateCompanionRules)
const limit = t.companionsReadyBy && t.companionsReadyBy < t.registryStartsAt
  ? t.companionsReadyBy : t.registryStartsAt;
if (a.endsAt.getTime() > limit.getTime()) {
  const byDeparture = limit === t.companionsReadyBy;
  return {
    rule: 'TIMELINE_AFTER_REGISTRY', // código estável (RULE_LABEL no front)
    message: byDeparture
      ? `Esta acompanhante precisa estar pronta até ${formatHour(localMinutes(limit, tz))} (saída das acompanhantes).`
      : `Esta acompanhante precisa terminar até ${formatHour(localMinutes(limit, tz))}, antes do make-off (${t.registryLabel}) da noiva ${t.brideLabel}.`,
  };
}
```

## State of the Art

| Antes | Agora | Quando | Impacto |
|-------|-------|--------|---------|
| Profissional escolhida por `id` ordenado (`.sort()`) | Ranking fixa→minutos→rodízio→id | Fase 11 | divisão justa e previsível |
| 04.2 D-03: nunca preencher profissional | Pré-sugestão na simulação (D-06) | Fase 11 | simulação já sai preenchida; confirmação continua explícita |
| Limite das acompanhantes = início do registro | min(make-off, "acompanhantes prontas até") | Fase 11 | mais um campo no grupo |
| `professionalsForService` por nome | fixas primeiro | Fase 11 | todas as listas |

**Fora de moda / mudado:** a premissa "ready_by = pronta até de todos" deixa de valer para acompanhantes quando o campo novo existe.

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|-----------------|-----------|--------|----------|
| Node | build/testes | ✓ | v26.9.0 (shell) | usar o Node do projeto (20 LTS via nvm/imagem Docker) se algum teste reclamar |
| PostgreSQL | testes de integração (`--runInBand`) | ✓ | aceitando conexões em `/var/run/postgresql:5432` | — |
| Docker | deploy staging | ✓ | containers `sgs_stg_backend/frontend` no ar | — |
| Chave Anthropic | caminho da IA | não verificada (nunca em testes; cliente é injetado, `ANTHROPIC_CLIENT`) | — | testes usam cliente falso/`null` (fallback heurístico) |

Sem dependência bloqueante.

## Validation Architecture

(`workflow.nyquist_validation: true` em `.planning/config.json`.)

### Test Framework
| Propriedade | Valor |
|-------------|-------|
| Backend unitário | jest 29 + ts-jest, `*.spec.ts` ao lado do código (`apps/backend/jest.config.ts`) |
| Backend integração | jest com `jest-integration.config.ts --runInBand`, specs em `apps/backend/test/integration/*.e2e.spec.ts` (Postgres real) |
| Frontend | vitest (`pnpm --filter @sgs/frontend test`), testes em `__tests__/` |
| E2E | Playwright (`@sgs/e2e`, `apps/e2e/tests/*.spec.ts`, helpers em `apps/e2e/support/`) |
| Comando rápido (backend, domínio) | `cd apps/backend && npx jest --config jest.config.ts src/scheduling src/bridal/ai src/bridal/timeline` |
| Comando rápido (frontend) | `cd apps/frontend && npx vitest run src/features/identity src/features/bridal src/features/operations src/pages/__tests__/profissionais-page.test.tsx` |
| Integração da fase | `cd apps/backend && npx jest --config jest-integration.config.ts --runInBand test/integration/phase11-*` |
| Gate completo | `pnpm --filter @sgs/backend lint && pnpm --filter @sgs/backend typecheck && pnpm --filter @sgs/backend test && pnpm --filter @sgs/backend test:integration && pnpm --filter @sgs/frontend lint && pnpm --filter @sgs/frontend typecheck && pnpm --filter @sgs/frontend test` e depois Playwright (`pnpm --filter @sgs/e2e test:e2e`) |

### Phase Requirements -> Test Map
| Req | Comportamento | Tipo | Comando / arquivo | Existe? |
|-----|---------------|------|-------------------|---------|
| PRIO-01 | colunas/inputs `isFixed`/`servesBridal`; só profissional; default false | integração | `phase11-members-flags.e2e.spec.ts` (clonar `phase91-members-assistant`) | Wave 0 |
| PRIO-02 | diálogos criar/editar enviam e mostram as marcações; badges na tela | vitest | `member-dialogs.test.tsx`, `profissionais-page.test.tsx` (estender) | estender |
| PRIO-03 | `rankProfessionals`: filtro servesBridal, fixa > não fixa, minutos, rodízio (null primeiro), id; determinismo; ordem de entrada irrelevante | unit | `src/scheduling/professional-ranking.spec.ts` | Wave 0 |
| PRIO-04 | `orderForPicker`/`sortFixedFirst` (backend e frontend) | unit | mesmo spec + `professional-order.test.ts` | Wave 0 |
| PRIO-05 | dados do ranking: minutos do dia só `BLOCKING_STATUSES`, no dia local; último agendamento; janela 90 dias | integração | `phase11-ranking-data.e2e.spec.ts` | Wave 0 |
| PRIO-06 | heurística: fixa livre antes de não fixa; divisão entre 2 fixas; revezamento no empate; mesma saída em 2 execuções; `unscheduled.reason` | unit | `heuristic-scheduler.spec.ts` (estender) | estender |
| PRIO-07 | IA: contexto filtra `servesBridal` na noiva; hash muda com marcações; prompt contém dicas; `checkPriority` só em `decide`; `confirm` aceita troca manual para não fixa | unit + integração | `ai-schedule.prompt.spec.ts`, `ai-schedule.service.spec.ts`, `schedule-validator.spec.ts`, `phase4-ai-schedule.e2e.spec.ts` (atualizar fixtures) | estender |
| PRIO-08 | simulação pré-sugere make/penteado (fixa livre, servesBridal); sem elegível livre → `[a definir]` + aviso; confirmação exige ids; não atende noiva → erro | integração | `phase42-timeline-preview.e2e.spec.ts`, `phase42-timeline-confirm.e2e.spec.ts` (reescrever asserts da D-03) + `timeline-domain.spec.ts` | estender |
| PRIO-09 | lista vazia + aviso quando ninguém marcado (D-04) | integração + vitest | `phase11-bridal-empty.e2e.spec.ts`, `timeline-tab.test.tsx` | Wave 0 |
| PRIO-10 | `suggestProfessionals`: livre antes de ocupada, fixa primeiro, `suggested` único, RLS entre salões | integração | `phase11-suggest-professionals.e2e.spec.ts` | Wave 0 |
| PRIO-11 | VisitFormDialog: pré-seleciona se vazio; não troca se preenchida; mostra "sugestão" | vitest | `novo-agendamento-gestor-beauty.test.tsx` (estender) | estender |
| PRIO-12 | limite efetivo = min(make-off, acompanhantes prontas até); mensagens "make-off"; `companionIssues` ao vivo | unit + integração | `timeline-guard.spec.ts`, `phase42-companion-guard.e2e.spec.ts` | estender |
| PRIO-13 | coluna `companions_ready_by`, validação mesma data local, UI do campo (padrão = make-off) | integração + vitest | `phase4-bridal-group.e2e.spec.ts`, `timeline-tab.test.tsx` | estender |
| PRIO-14 | IA/heurística: limite por papel (acompanhante ≤ companionReadyBy; noiva ≤ readyBy); "não coube" com motivo; UI lista | unit + vitest | `schedule-validator.spec.ts`, `heuristic-scheduler.spec.ts`, teste do `AiSuggestionPanel` | estender |
| PRIO-15 | debutante igual à noiva (cronograma, filtro, sugestão) | integração | casos `eventKind='debutante'` nos specs acima + `debutante-contrato.spec.ts` (E2E) | estender |
| PRIO-16 | listas de profissional com fixas primeiro (todas do inventário) | vitest | testes dos componentes citados | estender |
| E2E fluxo | marcar profissionais → gerar simulação preenchida → confirmar → agendar acompanhante após o limite recusado | Playwright | `apps/e2e/tests/prioridade-profissionais.spec.ts` + ajustar `cronograma-noiva.spec.ts` | Wave 0 |

### Sampling Rate
- **Por commit de tarefa:** o comando rápido da camada tocada (< 30 s).
- **Por onda:** unit backend + vitest completos + integração dos specs `phase11-*`, `phase42-*`, `phase4-ai-schedule`.
- **Gate da fase:** gate completo + Playwright antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/backend/src/scheduling/professional-ranking.spec.ts` (PRIO-03/04), escrever **antes** da implementação (TDD).
- [ ] `apps/backend/test/integration/phase11-*.e2e.spec.ts` (members-flags, ranking-data, suggest-professionals, bridal-empty).
- [ ] Helper de fixture `markServesBridal`/`markFixed` em `backend/test/integration/helpers/` e `apps/e2e/support/`.
- [ ] `apps/frontend/src/features/operations/professional-order.ts` + teste.
- [ ] `apps/e2e/tests/prioridade-profissionais.spec.ts`.
- Sem instalação de framework (tudo já existe).

## Proposed Requirements (PRIO-01..PRIO-16)

| ID | Descrição | Decisões |
|----|-----------|----------|
| PRIO-01 | `Member` tem as marcações `isFixed` e `servesBridal` (default falsas, sem migração de dados), só para profissionais, com API (create/update/queries) | D-01, D-03, D-05 |
| PRIO-02 | Tela Profissionais e diálogos criar/editar mostram e editam "Fixa (equipe do studio)" e "Atende noiva/debutante" (selos na lista) | D-05 |
| PRIO-03 | Módulo de domínio puro e determinístico de ranking (elegíveis → livres → fixas → menos minutos no dia → revezamento → id) | D-07, D-10, D-11, D-12 |
| PRIO-04 | Ordenação "fixas primeiro" reutilizável (backend e frontend) para listas | D-09 |
| PRIO-05 | Dados do ranking: minutos agendados no dia (`BLOCKING_STATUSES`, fuso do salão) e último agendamento por profissional (revezamento derivado de `appointments.created_at`) | D-10, D-11 |
| PRIO-06 | Heurística de sugestão de agenda usa o ranking (inclui divisão entre fixas dentro da rodada) em vez da ordem por id | D-07 |
| PRIO-07 | Sugestão por IA: contexto/prompt/hash com fixa, minutos e rodízio; serviços da noiva só com `servesBridal`; prioridade checada na saída da Claude (violação → retry/fallback), sem bloquear edição manual no confirm; selo "não fixa" | D-02, D-07, D-12 |
| PRIO-08 | Simulação do cronograma já sugere make e penteado da noiva (revoga 04.2 D-03); confirmação continua explícita; sem elegível livre → "[a definir]" com aviso; servidor recusa quem não atende noiva | D-02, D-06 |
| PRIO-09 | Sem profissional marcada "atende noiva/debutante": lista vazia com aviso e link para Profissionais, sem fallback | D-04 |
| PRIO-10 | Query de sugestão/ordem de profissionais para serviço+horário (livre, fixa, minutos), com isolamento por salão | D-08, D-09 |
| PRIO-11 | Agendamento comum pré-seleciona a fixa livre mais justa; escolha existente nunca é trocada (só exibe "sugestão") | D-08 |
| PRIO-12 | Limite efetivo das acompanhantes = min(make-off, "acompanhantes prontas até"); mensagens usam "make-off" | D-13, D-14 |
| PRIO-13 | Campo do grupo "Acompanhantes prontas até" (coluna, API, UI no grupo e na aba Cronograma), padrão = make-off | D-14 |
| PRIO-14 | Sugestão de agenda respeita limite por papel, encaixa a acompanhante o mais perto do limite e lista "não coube" com motivo, sem remarcar clientes comuns | D-15, D-16 |
| PRIO-15 | Todas as regras valem para noiva e debutante (`eventKind`) | D-17 |
| PRIO-16 | Todas as listas de escolha de profissional mostram fixas primeiro | D-09 |

## Open Questions

1. **Prioridade estrita versus proximidade do limite (D-07 x D-15).**
   - O que sabemos: a heurística hoje escolhe a profissional com o slot mais tardio; o ranking escolhe por fixa/minutos/rodízio.
   - O que falta: se uma fixa só tem horário bem mais cedo que uma não fixa, quem vence?
   - Recomendação: prioridade estrita (D-07 diz "na ordem"), com `warning` informando a folga perdida; pedir confirmação à usuária se quiser um limite de tolerância.
2. **Filtro `servesBridal` na prova (trial) e no agendamento manual do grupo (`BridalScheduleEditor`).**
   - CONTEXT cita "make e penteado no cronograma, e serviços da noiva na sugestão de agenda". A prova e o editor manual não são citados.
   - Recomendação: filtrar só cronograma e IA (servidor) e **ordenar** (não filtrar) nos pickers manuais/prova; aplicar `bridal` no picker do editor manual só para itens da noiva como conveniência sem bloqueio no servidor. Confirmar com a usuária.
3. **Chips/colunas da agenda (SchedulePage) entram em "listas de escolha"?** A grade ordena por carga (`sortProfessionalsByLoad`, quick 261112-cko). Recomendação: manter a ordem da grade e ordenar fixas primeiro apenas nos seletores e no filtro de chips dentro de cada bloco (com atendimento / sem atendimento). Confirmar.
4. **Título do texto do cronograma para debutante** ("CRONOGRAMA NOIVA ..." é formato fixo da referência 04.2). Manter como está salvo decisão; só rótulos de tela/mensagens dizem "noiva/debutante".
5. **Make-off = `registryStartsAt` ou `min(registryStartsAt, hairEndsAt)`?** D-13 diz que coincidem nos pacotes atuais. Recomendação: manter `registryStartsAt` (04.2 D-04 continua) e registrar que, se um pacote futuro deixar folga entre o fim do penteado e o registro, o limite pode ser antecipado.
6. **`companionsReadyBy` sem cronograma confirmado:** o guarda de acompanhantes só atua com cronograma (04.2). Recomendação: a IA/heurística usa o campo sempre; o guarda do agendamento manual só com cronograma confirmado (comportamento atual preservado).

## Sources

### Primary (HIGH confidence): leitura direta do código (2026-11-26)
- `apps/backend/src/bridal/ai/heuristic-scheduler.ts` (linhas 61-97, ordenação por id e poda), `ai-schedule-context.ts` (102-125, 175-200), `ai-schedule.prompt.ts`, `ai-schedule.schema.ts`, `ai-schedule.service.ts` (decide/confirm), `schedule-validator.ts` (131 `AFTER_READY_BY`, warning `BRIDE_NOT_LAST`)
- `apps/backend/src/bridal/timeline/timeline.service.ts` (90-300, 640-695), `timeline-guard.ts`, `timeline-domain.ts`, `timeline-conflicts.ts`, `graphql/schema/bridal-timeline.graphql`
- `apps/backend/src/identity/members.service.ts`, `dto/member.input.ts`, `members.resolver.ts`, `graphql/schema/identity.graphql`, `prisma/schema.prisma` (Member 140-190, BridalGroup 874-919, Appointment 535-574, BridalTimeline 1258-1294), migração `20261124000000_bridal_assistant`
- Frontend: `ProfissionaisPage.tsx`, `MemberEditDialog.tsx`, `CreateMemberDialog.tsx`, `members.api.ts`, `VisitFormDialog.tsx`, `BridalTimelineTab.tsx`, `SchedulePage.tsx`, `professional-filter.ts`, `schedule-professionals.ts`
- `.planning/phases/11-*/11-CONTEXT.md`, `.planning/phases/10-permiss-es-por-usu-rio/10-RESEARCH.md` (formato), `.planning/config.json`

### Secondary / Tertiary
- Nenhuma fonte externa: a fase não adiciona tecnologia nova; não houve consulta a Context7/web.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (nenhuma biblioteca nova; padrões do repo)
- Architecture: HIGH para pontos de integração (linhas conferidas); MEDIUM para a forma exata do `checkPriority` e da query `suggestProfessionals` (recomendação)
- Pitfalls: HIGH (derivados do código e dos testes existentes)

**Data da pesquisa:** 2026-11-26
**Válido até:** 2026-12-26 (código muda rápido neste repo; reconferir linhas se houver commits em `bridal/` ou `identity/`)

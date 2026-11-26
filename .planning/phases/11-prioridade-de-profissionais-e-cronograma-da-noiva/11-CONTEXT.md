# Phase 11: Prioridade de profissionais e cronograma da noiva - Context

**Gathered:** 2026-11-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega três coisas, para grupos de **noiva e debutante**:

1. Duas novas marcações na profissional (tela Profissionais): **fixa** e **atende noiva/debutante**.
2. Uma **ordem de prioridade** ao sugerir/escolher profissional: fixas livres primeiro (para noiva/debutante, só quem atende noiva), divisão justa entre as fixas livres, e não fixas só quando não há fixa livre. Vale no cronograma da noiva, na sugestão de agenda do grupo, no agendamento comum e na ordem das listas de profissional.
3. **Cronograma do grupo**: noiva e acompanhantes prontas antes do **make-off** e até o horário de saída das acompanhantes (configurável), sempre respeitando o cronograma da noiva (04.2).

Fora: mudanças de pagamento/comissão por fixa ou não fixa, remarcar automaticamente clientes comuns para abrir espaço para o grupo, e envio por WhatsApp.

</domain>

<decisions>
## Implementation Decisions

### Marcações na profissional
- **D-01:** **Fixa** = profissional da equipe do studio (trabalha todo dia); **não fixa** = freelancer chamada quando falta gente. A marcação **só muda a ordem/sugestão**; comissão, repasse e diária não mudam.
- **D-02:** **Atende noiva/debutante** é filtro rígido para os serviços **da noiva/debutante** (make e penteado no cronograma, e serviços da noiva na sugestão de agenda): quem não está marcada **não aparece**. Acompanhantes podem ser atendidas por qualquer profissional que faça o serviço.
- **D-03:** Na subida, **todas as profissionais começam desmarcadas** nas duas marcações (sem migração de dados que marque alguém).
- **D-04:** Enquanto ninguém atender noiva, a lista de make/penteado da noiva fica **vazia, com aviso** e link para Profissionais ("marque quem atende noiva/debutante"). Não há fallback para "todas".
- **D-05:** As marcações seguem o padrão de `isBridalAssistant` (09.1): booleanos no `Member`, editáveis no criar/editar profissional e visíveis na tela Profissionais. Rótulo na UI: "Atende noiva/debutante" e "Fixa (equipe do studio)".

### Onde a prioridade vale
- **D-06:** **Cronograma da noiva (04.2):** ao gerar a simulação, o sistema **já sugere** make e penteado da noiva (fixa livre que atende noiva, pelo critério justo), e o studio pode trocar. **Isto revoga a regra da 04.2/referência "nunca preencher nome de profissional por conta própria"** (D-03 da 04.2). Sem ninguém elegível livre → continua "[a definir]" com aviso.
- **D-07:** **Sugerir agenda do grupo** (heurística e IA em `apps/backend/src/bridal/ai`): escolhe entre as profissionais elegíveis na ordem fixas livres → não fixas livres, com o critério justo (D-10..D-12), em vez da ordem por id de hoje.
- **D-08:** **Agendamento comum** (fora de noiva): ao escolher serviço e horário, o sistema **pré-seleciona** a fixa livre mais justa entre as que fazem o serviço; o usuário pode trocar. Se a profissional **já foi escolhida** (pela cliente ou pelo usuário), o sistema **não troca**: só mostra "sugestão: Fulana (fixa livre)" e mantém a escolha.
- **D-09:** **Todas as listas de escolha de profissional** mostram as fixas primeiro (depois as não fixas), além das sugestões acima.

### Divisão justa
- **D-10:** Critério: **menos minutos agendados no dia** (agendamentos que bloqueiam agenda) entre as candidatas livres no horário.
- **D-11:** Empate: **revezamento**: vai para quem recebeu a última sugestão/atribuição há mais tempo (não alfabética).
- **D-12:** Sem fixa livre: usa a **não fixa livre** pelo mesmo critério, com selo "não fixa" no cartão/sugestão para o studio saber.

### Make-off e saída do grupo
- **D-13:** **Make-off** = fotos/vídeo da noiva (ou debutante) com as acompanhantes ainda de robe, feitas pela equipe de foto contratada logo depois de ela finalizar o cabelo (a equipe chega durante o penteado para fotografar a finalização). Portanto o **limite das acompanhantes é o fim do penteado da noiva**, que nos pacotes atuais coincide com o início do registro (making of no Experience, fotos no Glam/Elegance). A regra da 04.2 D-04 continua; ganha o nome "make-off" na tela e nas mensagens.
- **D-14:** Novo campo do grupo **"Acompanhantes prontas até"** (horário de saída das acompanhantes), que vem por padrão igual ao make-off e pode ser editado. Limite efetivo de cada acompanhante = o **mais cedo** entre esse horário e o make-off.
- **D-15:** Dentro da janela, a acompanhante é encaixada **o mais perto possível do limite** (make fresca nas fotos), como a heurística já faz de trás para frente.
- **D-16:** Se não couber todo mundo antes do limite com as profissionais livres: agenda quem cabe e mostra a lista **"não coube"** com o motivo (sem profissional livre a tempo). O studio resolve (freelancer, ajustar horário, ou o override de Gerente/Admin que já existe na 04.2). **Não** remarca clientes comuns.
- **D-17:** Tudo da fase vale para **noiva e debutante** (`BridalGroup.eventKind`), inclusive o cronograma e o filtro "atende noiva/debutante".

### Decisões complementares (2026-11-26, após a pesquisa)
- **D-18:** **Prioridade estrita**: se uma fixa elegível cabe antes do limite, ela ganha da não fixa mesmo que o horário fique bem mais cedo; a sugestão avisa "atendida X min antes do make-off".
- **D-19:** O filtro "atende noiva/debutante" vale em **todo lugar de serviço da noiva/debutante**: cronograma, sugestão de agenda, **prova** e **editor manual** da agenda do evento (e o servidor recusa quem não atende noiva para a noiva). Acompanhantes continuam sem filtro.
- **D-20:** A **grade da Agenda** (colunas das profissionais) **não muda** de ordem; "fixas primeiro" vale só nos seletores de profissional.
- **D-21 (padrão recomendado):** Make-off = `registryStartsAt` do cronograma confirmado. Título do texto do WhatsApp mantém o formato da 04.2 também para debutante. "Acompanhantes prontas até" é usado sempre pela sugestão; o guarda do agendamento manual só atua com cronograma confirmado (como na 04.2 D-04).

### Claude's Discretion
- Modelagem: colunas no `members` (ex.: `is_fixed`, `serves_bridal`), coluna no `bridal_groups` para "acompanhantes prontas até", e como guardar a "última sugestão" para o revezamento (coluna/timestamp por profissional ou derivado dos agendamentos). Migração + RLS nos padrões das fases 4/09.1/10.
- Um módulo de domínio puro e testado (TDD) para o ranking de profissionais (elegíveis → fixas → minutos no dia → revezamento), reaproveitado por cronograma, sugestão de agenda e agendamento comum.
- Como a debutante entra no cronograma se o pacote dela não tiver regra de etapas (segue D-01 da 04.2: sem regra, pede para configurar).
- Selos e textos na UI, no padrão visual Gestor Beauty (fase 6).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cronograma e grupo da noiva
- `.planning/phases/04.2-cronograma-da-noiva-e-das-acompanhantes-modelo-studio-js/04.2-CONTEXT.md`: regras do cronograma; D-03 (sem pré-preenchimento) é **revogada** por D-06 desta fase; D-04 (janela das madrinhas) continua.
- `.planning/phases/04.2-cronograma-da-noiva-e-das-acompanhantes-modelo-studio-js/04.2-REFERENCE-cronograma-studio-js.md`: offsets, etapas e formato do texto (fonte da verdade; offsets não mudam).
- `.planning/phases/04-bridal-contracts/`: grupos de noiva, agenda do evento, sugestão de agenda IA (04-03, 04-12, 04-13).
- `.planning/phases/09.1-assistente-de-noiva/09.1-CONTEXT.md`: padrão da marcação `isBridalAssistant` na profissional e do filtro "livres no dia".
- `.planning/phases/10-permissoes-por-usuario/`: matriz de permissões (quem edita Profissionais).

### Código
- `apps/backend/prisma/schema.prisma`: `Member` (`isProfessional`, `isBridalAssistant`), `MemberCategory`, `BridalGroup` (`readyBy`, `eventKind`), `BridalTimeline`, `Appointment`.
- `apps/backend/src/bridal/ai/heuristic-scheduler.ts`: escolha de profissional hoje por ordem de id (`.sort()`), a ser trocada pelo ranking.
- `apps/backend/src/bridal/ai/ai-schedule-context.ts`, `ai-schedule.prompt.ts`, `schedule-validator.ts`: contexto e validação da sugestão.
- `apps/backend/src/bridal/timeline/`: cronograma (simulação/confirmação, guarda das madrinhas).
- `apps/backend/src/appointments/` (`scheduling-guard.ts`, `appointments.service.ts`): criação de agendamento comum.
- `apps/frontend/src/pages/ProfissionaisPage.tsx`, `apps/frontend/src/features/identity/components/MemberEditDialog.tsx` e `CreateMemberDialog.tsx`: onde as marcações entram.
- `apps/frontend/src/features/bridal/components/BridalTimelineTab.tsx`, `TimelineSimulationCard.tsx`, `AiSuggestionPanel.tsx`: cronograma e sugestão.
- `apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx`: novo agendamento comum (pré-seleção).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isBridalAssistant` (09.1): mesmo caminho ponta a ponta (schema → `member.input.ts` → `members.service.ts` → `members.api.ts` → diálogos de profissional) para as duas novas marcações.
- `professionalServesCategory` (`identity/member-categories`): elegibilidade por serviço, que continua sendo o primeiro filtro antes do ranking.
- `BLOCKING_STATUSES` (`appointments/appointment-status`): base para somar "minutos agendados no dia".

### Established Patterns
- Simulação → confirmação (04.2 D-02) e proposta → confirmação da sugestão IA (fase 4): a sugestão de profissional entra na simulação, nunca grava sozinha.
- A heurística é determinística e testada (`heuristic-scheduler.spec.ts`); o ranking precisa ser determinístico também (revezamento com desempate estável).
- O prompt da IA não recebe dados pessoais (refs p1..pN); o ranking/flags de fixa podem ir como atributos anônimos da profissional ou ser aplicados no validador.

### Integration Points
- Ranking usado em três lugares: simulação do cronograma (make/penteado), `buildHeuristicProposal`/IA, e uma query nova (ou campo) para o pré-selecionar do `VisitFormDialog`.
- Guarda das madrinhas (`timeline-guard.ts`) passa a usar o limite efetivo (mínimo entre make-off e "acompanhantes prontas até").
- Não existe módulo de agendamento online público no backend hoje; "escolhida pela cliente" no D-08 se aplica a qualquer profissional já preenchida no formulário.

</code_context>

<specifics>
## Specific Ideas

- Explicação da usuária sobre o make-off: "o make off são os registros em foto e vídeo realizados pela equipe de foto e vídeo contratada pela noiva/debutante; a equipe de foto e vídeo chega no momento do penteado para fazer foto da noiva finalizando cabelo e depois parte para a foto com noiva e debutantes ainda de robe (antes de ir para as fotos com a noiva e acompanhantes já vestidas para sair), por isso a necessidade das acompanhantes já terem finalizado a make e penteado."
- Cartões e sugestões devem deixar claro quando a escolha é "não fixa".

</specifics>

<deferred>
## Deferred Ideas

- Pagamento diferente para fixa e não fixa (diária de freelancer): fora desta fase (D-01).
- Remarcar automaticamente agendamentos comuns para abrir espaço para o grupo da noiva: fora (D-16).
- Saída individual por acompanhante: não escolhida (D-14 usa uma saída do grupo).
- Ordem de preferência manual entre as fixas: não escolhida (empate por revezamento).

</deferred>

---

*Phase: 11-prioridade-de-profissionais-e-cronograma-da-noiva*
*Context gathered: 2026-11-26*

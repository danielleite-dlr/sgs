# Phase 12: Ajustar cadastro de agendamento - Context

**Gathered:** 2026-11-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Ajustes no modal "Cadastrar agendamento" (`VisitFormDialog`) da agenda:
1. o pacote deixa de ser um campo no fim do modal e passa a ser escolhido na própria linha de serviço (Serviço **ou** Pacote);
2. o campo Data ganha um calendário clicável;
3. ao escolher um pacote, os serviços dele entram em sequência (um depois do outro), não no mesmo horário.

Fora do escopo: cliente, sinal e observações (o usuário marcou essas áreas, mas não pediu mudança nelas), regras de prioridade de profissional (fase 11), cronograma da noiva e cobrança de vários pacotes.

</domain>

<decisions>
## Implementation Decisions

### Pacote na linha de serviço
- **D-01:** O select "Pacote" no fim do modal (`#visit-package`, abaixo da lista de serviços) **sai**. O pacote passa a ser escolhido na linha de serviço, **ao lado do select de Serviço**: cada linha alterna entre **Serviço | Pacote** (um ou outro).
- **D-02:** Escolher um pacote numa linha faz ela virar as linhas dos serviços do pacote, **a partir do horário e da profissional daquela linha**. As linhas acima e abaixo (serviços avulsos) continuam. Dá para misturar: pacote + avulsos, antes ou depois.
- **D-03:** **Um pacote por agendamento.** Depois de escolher um pacote numa linha, a opção "Pacote" some das outras linhas (ou fica desabilitada) até ele ser removido. O backend continua com um `packageId` só em `CreateVisitInput` e não muda.
- **D-04:** Remover o pacote (voltar a linha para "Serviço" ou remover as linhas dele) tira as linhas expandidas daquele pacote e limpa o `packageId`. Fica a critério do planner se as linhas do pacote ganham marcação visual ("do pacote X") e como a remoção funciona, desde que nenhuma linha avulsa se perca.
- **D-05:** A lista de pacotes não muda (quick 261126-w01, `visitPackageOptions`): os **sociais aparecem para qualquer cliente**, e os de noiva/debutante só aparecem para a cliente do contrato, na data do evento. Mudou a cliente ou a data e o pacote escolhido deixou de valer: o pacote sai e volta a ser linha de serviço, como hoje no `useEffect` de "voltar para Sem pacote".

### Sequência dos serviços do pacote
- **D-06:** Ao escolher o pacote, os serviços entram **em sequência**: o 1º no horário da linha, e cada um dos seguintes começa quando o anterior termina (duração padrão do serviço). Hoje `expandPackageLines` já faz isso partindo de `lines[0].time || '09:00'` e trocando **todas** as linhas. O planner deve investigar por que no staging os serviços ficaram no mesmo horário (hipóteses: horário da linha vazio na hora da escolha, cronograma/sugestão da fase 11 sobrescrevendo, ou horário trocado depois) e corrigir.
- **D-07:** A sequência é montada **só no momento da escolha do pacote**. Depois, cada horário e cada duração são editáveis à mão, sem efeito nas outras linhas (sem cascata). A atendente também pode ajustar depois, no agendamento já criado (fluxo atual de mover ou editar).

### Calendário no campo Data
- **D-08:** O campo Data continua aceitando digitação `dd/mm/aaaa` (máscara atual), com um **ícone de calendário ao lado que abre um calendário do mês** num Popover para clicar no dia, no visual Gestor Beauty (roxo, pt-BR, semana começando no domingo). O dia escolhido preenche o campo no mesmo formato.
- **D-09:** Não usar `<input type="date">` nativo. Hoje não há componente de calendário no projeto (`components/ui` só tem `popover`). Fica a critério do planner adicionar `react-day-picker` (Calendar do shadcn) ou montar uma grade própria. O componente deve ser reutilizável (`components/ui/calendar` ou `DateField`).

### Claude's Discretion
- Forma do seletor Serviço | Pacote na linha (abas pequenas, segmented control ou select com tipo), desde que caiba no celular (alvos ≥ 44 px, UX-03/UX-04 da fase 6).
- Marcação visual das linhas que vieram do pacote.
- Biblioteca do calendário.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Formulário de agendamento
- `apps/frontend/src/features/operations/components/calendar/VisitFormDialog.tsx`: modal atual (pacote em `#visit-package` perto da linha 1008, `choosePackage`, `dateField`, `ServiceLineRow`)
- `apps/frontend/src/features/operations/lib/visit-form.ts`: `expandPackageLines`, `buildCreateVisitInput` (`packageId` único)
- `apps/frontend/src/features/operations/__tests__/novo-agendamento-gestor-beauty.test.tsx`: testes do layout do modal (fase 6, lote 06-04)
- `apps/frontend/src/features/operations/api/appointments.api.ts`: `VisitPackagesQuery`
- `apps/backend/src/graphql/schema/appointments.graphql`: `CreateVisitInput` (um `packageId`)
- `apps/backend/src/catalog/packages/packages.service.ts`: `visitPackageOptions` (sociais × contrato)

### Decisões anteriores
- `.planning/quick/261126-w01-pacotes-do-agendamento-pelo-contrato/`: regra de quais pacotes aparecem
- `.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md`: visual Gestor Beauty do modal (D-13, D-20, UX-03, UX-04)
- `.planning/phases/11-prioridade-de-profissionais-e-cronograma-da-noiva/11-CONTEXT.md`: sugestão de profissional por linha, Assistente fora da escolha, cronograma da noiva e override

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `expandPackageLines(pkg, startTime, professionalId)`: já monta a sequência; adaptar para expandir no lugar de uma linha, não trocar todas.
- `components/ui/popover.tsx` (Radix): base do calendário.
- `maskDateBR`, `dateToBr`, `brToIso`: formato da data já usado no campo.

### Established Patterns
- O frontend não tem config do prettier: formatar à mão (aspas simples, ~100 colunas).
- Os selects do modal usam `SELECT_CLASS` nativo; os rótulos usam `LABEL_CLASS`.
- Validação de layout com print temporário do Playwright (`zz-tmp-*.spec.ts`).

### Integration Points
- `CreateVisit` (backend) continua igual: itens + um `packageId`.
- E2E em `apps/e2e` que usam `visit-package` ou o campo de data precisam ser atualizados.

</code_context>

<specifics>
## Specific Ideas

- Pedido do usuário: "o pacote deve ser apresentado logo na parte de cima do modal, não somente no final"; "há pacotes para clientes sociais e o mesmo deve aparecer ao lado do select de serviço, ou seleciona um ou outro".
- "No campo data não está vindo a parte do calendário para abertura do calendário e seleção."
- "Se selecionado um pacote, os serviços não podem estar no mesmo horário; algum deve ir para a sequência do outro, podendo o atendente editar na hora ou posteriormente."

</specifics>

<deferred>
## Deferred Ideas

- Vários pacotes no mesmo agendamento (precisaria de backend e comanda com vários pacotes). Por ora, um só.
- Cascata automática de horários ao editar uma linha. O usuário preferiu não ter.

</deferred>

---

*Phase: 12-ajustar-cadastro-de-agendamento*
*Context gathered: 2026-11-27*

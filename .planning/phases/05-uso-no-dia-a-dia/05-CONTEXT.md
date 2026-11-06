# Phase 5: Uso no dia a dia - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deixar o SGS usável na rotina diária do Studio JS. São duas entregas:

1. **Rodada de usabilidade (UX-DAY)** das telas mais usadas: agenda, comanda e caixa, noivas e contratos, clientes e financeiro, e painel inicial.
2. **Previsão financeira de 30 dias (FIN-03)** no painel inicial, com detalhe no Financeiro. Inclui um cadastro simples de despesas fixas mensais para alimentar as saídas.

A fase foi re-escopada em 2026-11-05. Antes ela se chamava "Communication & Launch". A usuária pediu: "o foco precisa ser em entregar um sistema usável para o dia a dia, a parte de comunicação e campanha podemos deixar como roadmap". WhatsApp, campanhas, Pix QR, produção/monitoramento e o fechamento da cobertura de testes foram para o Backlog do ROADMAP (999.1–999.5).

</domain>

<decisions>
## Implementation Decisions

### Rodada de usabilidade (UX-DAY)
- **D-01:** **O Claude faz a auditoria; a usuária aprova antes de corrigir.** O primeiro plano da fase é uma auditoria das telas principais no staging (navegador real, org Studio JS, desktop e celular). Ela produz uma lista priorizada de problemas: severidade, tela, passo a passo e correção proposta. A lista vai para a usuária. **Nenhuma correção é feita antes da aprovação.** Os itens aprovados viram os planos de correção seguintes, em lotes.
- **D-02:** **Prioridade das telas, na ordem que a usuária deu:** Agenda → Comanda e caixa → Noivas e contratos → Clientes e financeiro → Painel (dashboard).
- **D-03:** **Critério da auditoria: o uso diário real.** Medir cliques e passos nas tarefas frequentes (marcar e remarcar horário, fechar comanda e receber, criar contrato e registrar parcela, achar cliente). Procurar textos confusos, erros sem explicação, estados vazios, carregamento, celular/tablet, acentuação e consistência em PT-BR. Funcionalidade nova **não** entra na lista; se surgir alguma, vai para "Deferred".

### Previsão financeira 30 dias (FIN-03)
- **D-04:** **Entradas previstas** = valor dos **agendamentos confirmados** nos próximos 30 dias + **parcelas de contratos** de noivas/debutantes que vencem no período (parcelas do sinal e restante ainda em aberto). Não entra média histórica, porque a usuária não escolheu.
- **D-05:** **Saídas previstas** = **comissão estimada** dos agendamentos confirmados no período, calculada pela regra de comissão de cada profissional (`commission-resolver.ts` já existe), + **despesas fixas mensais** cadastradas que vencem no período. Não haverá controle de "comissão paga"; a usuária escolheu estimar pela agenda.
- **D-06:** **Despesas fixas: cadastro novo e simples.** Campos: nome, valor e dia de vencimento no mês, mais ativo/inativo. Serve **só** para alimentar a previsão; não é contas a pagar completo (sem baixa de pagamento, sem fornecedor, sem anexos). Fica no Financeiro ou nas Configurações; o planner decide. Permissão de financeiro (ADMIN/MANAGER), com RLS por org como o resto.
- **D-07:** **Onde aparece:** um **cartão no painel inicial** com total de entradas, total de saídas e saldo previsto dos próximos 30 dias, mais um **gráfico por semana**. Clicar abre o **detalhe no Financeiro**, com a lista por dia/semana e a origem de cada valor (agendamento, parcela de contrato, comissão, despesa).
- **D-08:** **O painel inicial hoje é um placeholder** ("Painel — Em construção"; `DashboardPlaceholder` em `/dashboard`). O cartão da previsão vira o primeiro conteúdo real dele. A auditoria (D-02) avalia o que mais o painel precisa e propõe; nada além da previsão entra no painel sem aprovação.

### Decisões tomadas no plan-phase (2026-11-05, respostas da usuária às perguntas abertas da pesquisa)
- **D-09:** **Parcelas e restante de contrato vencidos e não pagos entram na previsão**, somados na **semana 1** com a marca **"em atraso"** (no cartão e no detalhe).
- **D-10:** **Agendamentos ligados a contrato geram comissão estimada nas saídas** (a receita deles vem das parcelas do contrato, sem contar duas vezes). Palavras da usuária: "até pode acontecer de não ter um profissional designado ainda para o atendimento, mas a saída daquele valor é uma certeza, e deve estar na estimativa". Portanto, **agendamento sem profissional também gera comissão estimada**: usar uma regra de fallback (a regra padrão da org, se existir; senão a maior taxa entre as regras aplicáveis ao serviço, para não subestimar a saída), marcada no detalhe como "estimada — sem profissional definido". O planner documenta a regra exata no plano.
- **D-11:** **O painel vira a tela inicial** para ADMIN e MANAGER (`FEATURES.dashboard` ligada, `HOME_PATH` por papel). PROFESSIONAL e ATTENDANT continuam caindo na Agenda. Um plano ajusta e roda os testes vitest e E2E que assumem home `/agenda`.
- **D-12:** **Auditoria no staging com usuário dedicado:** criar no staging, na org Studio JS, um usuário ADMIN só para a auditoria. Ele **só navega, sem salvar nada no staging**; as escritas da auditoria vão para o ambiente local semeado. A credencial fica em arquivo local fora do git (gitignored), e o usuário é **desativado ao fim da fase** (item explícito no plano de fechamento).
- **D-13:** **"Confirmado" = `scheduled` + `confirmed`**, mantido numa constante única fácil de trocar.
- **Dado do staging (consulta somente leitura em 2026-11-05):** a Studio JS não tem agendamentos futuros e tem 1 contrato `active`. O valor do agendamento precisa funcionar sem comanda (preço da variante/serviço) e com comanda (itens da comanda).

### Claude's Discretion
- O que conta como agendamento "confirmado" (status existentes em `appointments.status`). Excluir cancelados e faltas; documentar no plano.
- Como valorar o agendamento (preço do serviço/variante; descontar sinal já pago no agendamento para não contar em dobro; não contar agendamento ligado a contrato quando a parcela do contrato já entra).
- Fuso: datas no fuso da org, como no `financialSummary`.
- Formato do gráfico (barras por semana; seguir a skill dataviz) e as permissões de quem vê o cartão (sugestão: ADMIN/MANAGER).
- Formato e local da lista de auditoria (arquivo em `.planning/phases/05-uso-no-dia-a-dia/` + resumo para a usuária).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e requisitos
- `.planning/ROADMAP.md` § Phase 5: Uso no dia a dia — objetivo e critérios de sucesso; § Backlog — o que saiu da fase
- `.planning/REQUIREMENTS.md` — FIN-03, UX-DAY
- `.planning/PRODUCT_DIRECTION.md` — template "Estúdio de noivas" (módulos do dia a dia)

### Financeiro e contratos (para a previsão)
- `.planning/phases/03-core-operations/03-CONTEXT.md` — regras de comanda, caixa, comissões e sinal do agendamento
- `.planning/phases/04-bridal-contracts/04-CONTEXT.md` — pagamentos de contrato (D-14) e alertas (D-21)
- `.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-CONTEXT.md` — parcelas do sinal (`contract_deposit_installments`) e restante

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/financial/financial.service.ts` + `apps/backend/src/graphql/schema/financial.graphql` (`financialSummary` com from/to/granularity no fuso da org, buckets): a previsão deve seguir o mesmo formato de datas e buckets.
- `apps/backend/src/financial/commission-resolver.ts`: resolve a regra de comissão por profissional/serviço; reaproveitar para a comissão estimada.
- `ContractDepositInstallment` e `Contract` (balance/restante) em `apps/backend/prisma/schema.prisma`: parcelas a vencer.
- `Appointment` (`startsAt`, `status`, `depositAmount`) e o índice `ix_appointments_org_starts`.
- `apps/frontend/src/pages/RelatoriosPage.tsx` / telas do Financeiro: lugar do detalhe.

### Established Patterns
- GraphQL schema-first, RLS por `app.current_organization`, RBAC via CASL; testes de integração por fase (`phase*-...e2e.spec.ts`), Vitest no frontend, E2E Playwright em `apps/e2e`.
- Datas "YYYY-MM-DD" locais da org com `to` exclusivo.

### Integration Points
- Rota `/dashboard` (`apps/frontend/src/router.tsx`) hoje usa `DashboardPlaceholder`; trocar pelo painel real.
- Migration nova para `fixed_expenses` (ou nome equivalente) com RLS.

</code_context>

<specifics>
## Specific Ideas

- A org de referência é o Studio JS no staging (https://sgs.jessicaseixasmakeup.com.br). A auditoria deve usar dados reais de lá (sem expor dados pessoais em arquivos versionados).
- Valores de entrada dos pacotes já cadastrados no staging: Essence R$ 300, Experience e Glam R$ 400 (quick 261105-i7x).

</specifics>

<deferred>
## Deferred Ideas

Movidos para o Backlog do ROADMAP em 2026-11-05:
- **999.1 Comunicação (WhatsApp):** lembrete 24h (COMM-01), campanhas (COMM-02), envio do link de aceite/lembretes para a noiva. Depende da verificação WABA na Meta e de consentimento LGPD.
- **999.2 Pix com QR via gateway** (adiado da fase 3, D-10).
- **999.3 Produção e monitoramento:** Sentry/Grafana (QA-04), produção separada do staging com backup automático.
- **999.4 Fechamento da cobertura de testes** (QA-01..03).
- **999.5 Sugestão de agenda com a Claude real** (sem `ANTHROPIC_API_KEY` no staging).

Também fora desta fase:
- Média histórica na previsão (a usuária não escolheu).
- Controle de pagamento de comissão ("marcar como paga"); a usuária escolheu estimar pela agenda.
- Contas a pagar completo (baixa, fornecedor, anexos); por ora só despesas fixas para a previsão.

</deferred>

---

*Phase: 05-uso-no-dia-a-dia*
*Context gathered: 2026-11-05*

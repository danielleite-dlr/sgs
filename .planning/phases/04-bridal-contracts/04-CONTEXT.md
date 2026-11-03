# Phase 4: Bridal & Contracts - Context

**Gathered:** 2026-11-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Proprietário cria **grupos de noivas** (noiva + acompanhantes para o mesmo evento), emite **contrato da noiva** (entrada + restante até D-10, aceite digital por link, política de cancelamento configurável), recebe **alertas automáticos** de pendências do contrato/grupo e usa **IA (Claude API)** para sugerir a alocação de profissionais do evento.

Requisitos: CLI-03, CONT-01, CONT-02, CONT-03, AI-01. Aceite digital por link entra nesta fase por decisão do usuário (D-15) — consta em PROJECT.md ("Contratos de eventos com parcelas e assinatura digital") e em PRODUCT_DIRECTION.md ("Contratos e aceite digital").

**Ajuste de critério de sucesso:** o critério 2 do ROADMAP ("R$8.000 parcelado em 4x … retenção de 50% com <30 dias") é reinterpretado pelas decisões D-10–D-12 e D-17–D-18: o contrato tem **entrada + restante com prazo D-10**, com pagamentos livres (vários pagamentos parciais são permitidos, então "4 pagamentos" continua possível), e a política padrão é "cliente cancela = retém tudo o que já foi pago", com faixas de % por antecedência como configuração opcional (que cobre o exemplo de 50% com <30 dias). Critério 4 ("parcela vencida ou vencendo em 3 dias") aplica-se ao **restante (prazo D-10)** e à **entrada**.

</domain>

<decisions>
## Implementation Decisions

### Grupo de noivas e evento
- **D-01:** Grupo de noivas = **evento** com data, noiva principal (cliente) e acompanhantes (madrinhas, mãe etc.). Cada pessoa do grupo tem seus serviços.
- **D-02:** **Acompanhante é cliente mínima** — nome + telefone opcional, mesmo padrão do walk-in da fase 3 (03 D-06). Pode escolher cliente existente ou criar no ato. Fica com histórico e pode voltar como cliente normal.
- **D-03:** **Serviços do evento viram agendamentos reais** (pessoa × serviço × profissional × horário), usando o mesmo lock anti-conflito por profissional da fase 3 (03 D-01 ajustado) e a exclusion constraint. A agenda mostra os profissionais ocupados com o evento.
- **D-04:** **Local do evento: estúdio (padrão) ou externo** (endereço: casa da noiva, hotel etc.), com **tempo de deslocamento opcional** que bloqueia o profissional antes/depois (time_block ou equivalente) para atendimento externo.
- **D-05:** **Contrato pode incluir atendimentos antes do evento** (ex.: teste de maquiagem/penteado semanas antes), que também viram agendamentos vinculados ao grupo/contrato.

### Quem paga o quê
- **D-06:** **O contrato é da noiva.** Ele pode cobrir **nenhuma, uma ou mais acompanhantes** (ex.: a mãe). Cada pessoa do grupo tem uma marcação "incluída no contrato" ou "paga avulso".
- **D-07:** **Acompanhante avulsa (fora do contrato) — o caso mais comum (madrinhas):** sem contrato; tem agendamento + comanda própria como qualquer cliente da fase 3. Fluxo usual: **sinal antes** (crédito de cliente, 03 D-03) + **quitação na comanda no dia**. Pagar tudo antes é raro, mas é permitido (sinal = valor total).
- **D-08:** **Pessoa incluída no contrato:** no dia, a comanda gerada pelo agendamento **abate do contrato** (não cobra de novo). Ela continua registrando comissão (03 D-12/D-23) e baixa de estoque (03 D-21). **Extras não previstos no contrato são cobrados na própria comanda**, como pagamento normal.
- **D-09:** **Itens por pessoa no contrato:** o contrato lista cada pessoa coberta com seus serviços/pacote (ex.: noiva: maquiagem + penteado; mãe: maquiagem). O valor total do contrato pode ter desconto sobre a soma dos itens.

### Contrato, entrada e restante
- **D-10:** **Estrutura de pagamento do contrato = Entrada + Restante.** A entrada tem valor definido no **pacote de noiva** (R$ ou %) e vence na assinatura/aceite. O **restante deve ser quitado até X dias antes do evento** (padrão da org = **10 dias**).
- **D-11:** **Restante com pagamentos livres** — sem plano de parcelas: a noiva paga quanto quiser, quando quiser (ex.: mês a mês), até o prazo. O sistema controla o **saldo devedor** e o **prazo final (data do evento − X dias)**. Os "vencimentos" que geram alertas são: entrada e prazo final do restante.
- **D-12:** **Configuração:** o valor de entrada fica no **pacote** (campo novo no catálogo para pacotes de noiva); o prazo "quitar até X dias antes" é **padrão da organização (10)**. Ambos podem ser **ajustados em cada contrato** (valores gravados no contrato como snapshot).
- **D-13:** **Pagamento de contrato = registro manual no caixa**, mesmo padrão da fase 3: método (dinheiro, Pix, crédito, débito, transferência — 03 D-09) + valor, aceitando pagamento parcial e múltiplos métodos, e gerando `cash_movements`. Pix sem QR (03 D-10).
- **D-14 (financeiro/dashboard):** cada pagamento de contrato conta em **Faturado e Recebido na data em que é pago** (entrada entra no dashboard quando paga; cada pagamento do restante, quando pago). As **comandas do evento que abatem do contrato NÃO contam de novo no Faturado**; só os extras cobrados na comanda somam. Isso é uma **exceção explícita à 03 D-22** (Faturado = comandas fechadas) para receita de contrato.

### Aceite digital
- **D-15:** **Aceite por link nesta fase.** O proprietário gera um **link público único** do contrato. A noiva abre, lê o contrato, **informa nome + CPF** e clica "Aceito". O sistema registra data/hora, IP, user-agent e **hash do texto exato aceito**. O registro de aceite é imutável (append-only, padrão dos ledgers da fase 3). Até a fase 5, o link é enviado manualmente (copiar link → WhatsApp). Depois de aceito, o contrato também pode ser baixado em PDF.
- **D-16:** **Texto do contrato vem de um modelo editável da org**, com variáveis automáticas: nome/CPF da noiva, data e local do evento, pessoas e serviços incluídos, valor total, entrada, prazo do restante, política de cancelamento. O sistema traz um **modelo padrão** para o template de estúdio de noivas. Alterar o contrato depois do aceite exige novo aceite (o hash muda).

### Cancelamento
- **D-17:** **Política padrão (template de noivas): cliente cancela → retém 100% do que já foi pago; a entrada nunca é devolvida.** Nada é devolvido.
- **D-18:** **Política configurável (CONT-03):** a org pode trocar o padrão por **faixas de retenção por antecedência** (ex.: <30 dias → retém 50% do total). A política vigente é copiada para o contrato como **snapshot** na criação.
- **D-19:** **Cancelamento pelo estúdio → devolve tudo, inclusive a entrada** (saída no caixa). Cancelar contrato exige **motivo obrigatório** e é restrito a **ADMIN/MANAGER** (mesmo padrão de 03 D-08/D-15/D-20). Cancelar o contrato cancela os agendamentos vinculados a ele, com o mesmo motivo.

### Alertas automáticos
- **D-20:** **Alertas gerados por job diário** (BullMQ repeatable, no fuso da org):
  1. Restante **vence em 3 dias** / **vencido** (saldo > 0 depois do prazo D-X);
  2. **Entrada não paga** depois de N dias da criação/aceite do contrato;
  3. **Contrato não aceito** N dias depois de o link ser gerado;
  4. **Sinal de acompanhante avulsa pendente** perto do evento.
  Os limiares N ficam a critério do planejador, com padrões razoáveis, configuráveis por org se for barato.
- **D-21:** **Canal: in-app + e-mail diário.** O sistema cria notificação no sino (tabela `notifications`, já existente) para **ADMIN/MANAGER** e envia **um resumo diário por e-mail** (EmailService/Resend existente). Não repetir o mesmo alerta todos os dias no sino (deduplicar por contrato + tipo + estado). Lembrete para a noiva por e-mail/WhatsApp **fica fora** (fase 5).

### Claude's Discretion
- **Sugestão de agenda IA (AI-01) — não discutida; diretriz:** "Sugerir agenda IA" monta uma **proposta editável** (pessoa × serviço × profissional × horário) que o proprietário revisa e confirma. **Nada é gravado na agenda sem confirmação** (SDD §13.2: sugestivo, não vinculante). A sugestão considera disponibilidade (agendamentos + time_blocks), duração dos serviços, profissionais habilitados por serviço, deslocamento (D-04) e ordem lógica (noiva por último / mais perto do horário da cerimônia). A saída do Claude deve ser validada (estrutura + conflitos) antes de exibir. O sistema precisa funcionar **sem a chave da API ou quando a API falha** (mensagem clara e, se viável, sugestão heurística simples), com cache de respostas e limite de uso por org (CLAUDE.md). O planejador escolhe o modelo Claude (preferir o mais recente/capaz, conforme `claude-api` skill).
- Modelo de dados exato (bridal_groups / members / contracts / contract_items / contract_payments / acceptances) — seguir os PRDs como base e adaptar às decisões acima.
- Código curto legível do contrato (ex.: `CT-2026-001`, padrão de 03 D-19) — recomendado.
- Layout das telas (placeholders já existem em `features/bridal/`).
- Geração de PDF (lib/abordagem).
- Permissões granulares novas (ex.: `bridal.manage`, `contract.cancel`, `contract.payment.record`) seguindo o catálogo de permissões existente.
- Como o abatimento da comanda no contrato é modelado (novo método interno "contrato" × crédito vinculado ao contrato), desde que respeite D-08 e D-14 e não conte duas vezes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e requisitos
- `.planning/ROADMAP.md` §Phase 4 — goal, requisitos e critérios de sucesso (ajustados acima)
- `.planning/REQUIREMENTS.md` — CLI-03, CONT-01..03, AI-01
- `.planning/PROJECT.md` — constraints (RLS, LGPD, stack)
- `.planning/PRODUCT_DIRECTION.md` — plataforma modular; estúdio de noivas é o template principal; contrato/aceite/parcelas/evento como prioridade; módulos reutilizam o modelo central

### Especificação de origem (PRDs)
- `PRD_Banco_Dados_Plataforma_Saloes_v1.1.md` §4.3.3 (bridal_groups) e §4.6 (Bloco: Contratos) — schema de referência
- `SDD_Plataforma_Saloes_v1.1.md` §4.1.7 (Contratos de Eventos), §6.2.4 (BridalGroup), §6.2.7 (Contract), §13.2 (cronograma sugestivo), §13.3 (contrato como entidade própria), §13.4 (IA via API)
- `PRD_Frontend_Plataforma_Saloes.md` §9.4 — Cronograma de noiva (UI)
- `PRD_Backend_Plataforma_Saloes.md` — módulos, eventos de domínio, padrão de IA/cache (§9.6)

### Decisões anteriores que se aplicam
- `.planning/phases/03-core-operations/03-CONTEXT.md` — D-01 (lock por profissional), D-03 (sinal = crédito), D-06 (cliente mínima), D-08/D-15/D-20 (motivo e papéis), D-09/D-10 (métodos, Pix manual), D-11 (crédito), D-12/D-14/D-23/D-24 (comissões), D-19 (código curto), D-21 (estoque), D-22 (Faturado × Recebido — exceção em D-14 aqui)
- `.planning/phases/03-core-operations/03-05-SUMMARY.md` — helpers de ledger (`recordCashMovement`, `recordCreditMovement`, `recordAudit`) e o padrão de dashboard

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/financial/cash-ledger.ts` (`recordCashMovement`), `client-credit.ts` (`recordCreditMovement`, `lockClient`), `common/audit-log.ts` (`recordAudit`): helpers transacionais que recebem `tx`; usar nos pagamentos, devoluções e cancelamentos de contrato.
- `apps/backend/src/financial/financial.service.ts`: dashboard D-22 em SQL direto; precisa incluir os pagamentos de contrato no Faturado (D-14) sem duplicar comandas abatidas.
- `apps/backend/src/appointments/` + lock por profissional: criar os agendamentos do evento e do teste.
- `apps/backend/src/comandas/`: abertura automática pelo agendamento (03 D-05), fechamento com comissão/estoque, onde entra o abatimento do contrato.
- `apps/backend/src/catalog/notifications/` + model `Notification`: sino in-app, já usado para alerta de estoque.
- `apps/backend/src/queue/queue.module.ts`: BullMQ global ligado ao Valkey, **ainda sem filas** (o job diário de alertas é o primeiro).
- `apps/backend/src/email/` (EmailService, Resend adapter, file-outbox para dev/test): resumo diário por e-mail.
- `apps/backend/src/authz/permissions.catalog.ts`: catálogo de permissões RBAC.
- `apps/frontend/src/features/bridal/pages/` — `BridalGroupsPlaceholder`, `ContractsPlaceholder`, `ContractDetailPlaceholder` já roteados em `router.tsx`.

### Established Patterns
- RLS forçada por `app.current_organization` + `runWithTenant`; toda tabela nova precisa de policy e entrar na suíte transversal de RLS/RBAC (03-12).
- Ledgers append-only (`REVOKE UPDATE, DELETE` para `sgs_app`); reversão por novo registro. Aplicar ao aceite e aos pagamentos de contrato.
- GraphQL schema-first (`src/graphql/schema/*.graphql`); erros de domínio como payload, validação de leitura como BadRequest (03-05).
- Dinheiro em centavos nos helpers; datas no fuso da org (`AT TIME ZONE`).
- Model `Package` não tem campo de entrada: é preciso adicionar o valor de entrada (R$ ou %) para os pacotes de noiva (D-12).

### Integration Points
- Rota pública (sem auth) para o aceite: novo endpoint/página fora do layout autenticado, com token não adivinhável e rate limit.
- Config de env para a Claude API (`ANTHROPIC_API_KEY` ainda não existe em `config/env.schema.ts`), opcional (a IA deve funcionar sem a chave — ver Claude's Discretion).
- Configurações da org: prazo padrão do restante (10 dias), política de cancelamento padrão e modelo de contrato.

</code_context>

<specifics>
## Specific Ideas

- Fluxo real do estúdio: "a noiva fecha o pacote, paga a entrada do pacote e quita o restante até 10 dias antes do evento; às vezes paga mês a mês." As madrinhas normalmente pagam o próprio atendimento: sinal antes + quitação no dia, sem contrato.
- "Quando o cancelamento é feito pela cliente, não devolvemos valores já pagos." Quando é feito pelo estúdio, devolve tudo.
- Dashboard: o usuário quer ver o dinheiro do contrato entrando no dia em que é pago (entrada, pagamentos mensais, quitação).

</specifics>

<deferred>
## Deferred Ideas

- Envio do link de aceite e lembretes para a noiva por WhatsApp/e-mail automático — fase 5 (Communication).
- Pix com QR/gateway para pagar a entrada/restante — fase 5 (03 D-10).
- "Sistema aprende com os ajustes manuais da sugestão de IA" (SDD §13.2) — futuro, fora desta fase.

</deferred>

---

*Phase: 04-bridal-contracts*
*Context gathered: 2026-11-02*

# Roadmap de execução — telas mockadas

**Criado em:** 2026-09-21
**Contexto:** todo mockup foi desligado em `apps/frontend/src/config/features.ts`. O código das telas continua no repositório; cada marco abaixo termina ligando a(s) flag(s) correspondente(s) no mesmo commit que entrega o backend real.

**Regra única deste roadmap:** uma flag só vira `true` quando a tela lê dado de verdade do banco. Nada de "ligar para mostrar".

---

## O que está no ar hoje

`/agenda` (criação e listagem de agendamentos), `/clientes` (CRUD completo), `/catalogo/*` (categorias, serviços, pacotes, produtos com estoque, regras de comissão), `/admin` (painel de plataforma), autenticação e convites.

## O que está desligado

| Flag | Tela | Por que está mockada |
|---|---|---|
| `dashboard` | `/dashboard` | cards de descoberta estáticos |
| `equipe` | `/profissionais` | backend pronto, tela nunca existiu |
| `rankings` | rankings de cliente/serviço/produto/profissional | sem tela e sem dado transacional |
| `clientesAniversariantes` | `/clientes?filtro=aniversariantes` | o parâmetro não é lido |
| `agendaRelatorio` | `/agenda?modo=relatorio` | o parâmetro não é lido |
| `comanda` | `/comanda/:id` | `mocks/comanda.mock.ts` |
| `financeiro` | `/financeiro` | valores fixos em R$ 0,00 |
| `financeiroComissoes` | `/financeiro/comissoes` | `mocks/financeiro.mock.ts` |
| `financeiroRelatorios` | 10 sub-páginas financeiras | layout sem nenhuma consulta |
| `relatorios` | `/relatorios` | catálogo de cards sem destino |
| `configuracoes` | `/configuracoes` | lista de links; nenhum destino existe |
| `noivas`, `contratos` | `/noivas`, `/contratos` | `mocks/bridal.mock.ts` |
| `campanhas` | `/campanhas` | `mocks/communication.mock.ts` |
| `notificacoes` | sino do header / bottom nav | backend existe, painel não |
| `estabelecimentoSelector` | seletor no header | nome do salão hardcoded |
| `chatSuporte`, `assinatura`, `ajudaTutoriais` | controles decorativos | sem produto por trás |

---

## Trilhos paralelos — começar hoje, não bloqueiam código

Os dois já estão registrados como blockers em `STATE.md` e têm prazo fora da engenharia:

- **T1 — Decisão de gateway (Pagar.me × Stripe Connect).** Trava o M3. A interface `PaymentGateway` muda conforme o modelo de split.
- **T2 — Verificação WABA no Meta Business.** 1–4 semanas de fila. Trava o M10. Iniciar agora, mesmo que o M10 seja o último.

---

## M1 — Equipe e profissionais

**Por que primeiro:** é o único marco em que o backend já está pronto e testado (`inviteMember`, `acceptInvitation`, `revokeInvitation`, `members`, `pendingInvitations`, `rbac.e2e-spec.ts`). Entrega valor em dias e destrava todo o resto: agenda, comissão e pagamento de profissional precisam de um profissional real cadastrado.

**Pré-requisitos:** nenhum.

**Backend**
- `updateMember(input)` — alterar role, `isProfessional` e `seniorityTier` de um membro existente (hoje só dá para convidar; a coluna `seniority_tier` já existe e é usada na precificação de serviço).
- `deactivateMember` / reativar — desligar profissional sem perder histórico.
- Filtro de aniversariantes em `clients` (`birthMonth`), sobre a coluna `birth_date` já existente.

**Frontend**
- `/profissionais` — lista com avatar, papel, senioridade, status; convidar (reusa `InvitationPage` já pronta); revogar convite pendente; editar papel/senioridade.
- `/profissionais/perfis` — leitura do catálogo de permissões por papel (`permissions.catalog.ts`). Só leitura nesta etapa.
- Ativar o filtro `?filtro=aniversariantes` em `/clientes`.

**Flags a ligar:** `equipe`, `clientesAniversariantes`
**Pronto quando:** um admin convida um profissional, define senioridade, e esse profissional aparece no seletor da agenda e no formulário de regra de comissão.
**Tamanho:** 1 plano backend + 1 plano frontend (~2–3 dias).

---

## M2 — Agenda completa (SCHED-01 a SCHED-04)

**Por que agora:** a agenda é o coração operacional e já tem 1.645 linhas de UI real com `createAppointment` funcionando. Falta tudo o que vem depois de criar.

**Pré-requisitos:** M1.

**Backend**
- `updateAppointment` — mover/redimensionar, com a mesma checagem de conflito + *exclusion constraint* que o `create` já usa.
- `cancelAppointment` / `setAppointmentStatus` — confirmado, em atendimento, concluído, faltou, cancelado.
- Tabela `time_blocks` + CRUD — intervalos, feriados, indisponibilidade de profissional (SCHED-03). Entra na checagem de conflito.
- Tabela `business_hours` (por organização e por profissional) — é daqui que a grade da agenda passa a sair, substituindo `TIME_SLOTS` do mock.
- `deposits` / sinal no agendamento (SCHED-04) — valor pré-pago rastreado, que o M3 vai abater da comanda.
- Teste e2e de double-booking concorrente (critério 5 da Fase 3 no ROADMAP.md, hoje sem cobertura).

**Frontend**
- Drag-and-drop e resize na grade (SCHED-02).
- Painel de bloqueio de horário.
- Campo de sinal no formulário de agendamento.
- Remover `mocks/schedule.mock.ts`.
- Fatia mínima de configurações: **horário de funcionamento** (a agenda não fecha sem isso).

**Flags a ligar:** `agendaRelatorio` (visão de lista/consulta) ao final
**Pronto quando:** arrastar um agendamento para cima de outro do mesmo profissional dá erro claro, e a grade respeita o horário de funcionamento cadastrado.
**Tamanho:** 2 planos backend + 2 planos frontend (~1,5 semana).

---

## M3 — Comanda / PDV (POS-01 a POS-03)

**Por que agora:** é o que transforma agendamento em dinheiro. Nenhuma tela financeira tem sentido antes dele — não existe nenhuma tabela de venda no schema hoje.

**Pré-requisitos:** M2 e **T1 (gateway decidido)**.

**Backend**
- Migration: `comandas`, `comanda_items` (serviço ou produto, com preço snapshot), `payments` (método, valor, status, gateway ref), tudo com RLS `FORCE`.
- `openComanda(appointmentId | clientId)`, `addComandaItem`, `removeComandaItem`, `closeComanda`.
- Baixa automática de estoque ao adicionar produto — reusa `adjustStock`/`StockMovement` já prontos.
- Pagamento dividido: N `payments` parciais somando o total (POS-03), abatendo o sinal do M2.
- Interface `PaymentGateway` + adapter do provedor escolhido; Pix QR. Dinheiro/cartão/transferência entram como registro manual desde o primeiro dia.
- Testes e2e: soma de parciais, estoque, idempotência de fechamento.

**Frontend**
- `/comanda/:id` real: abrir da agenda, acumular itens, escolher profissional por item (é o que alimenta a comissão), fechar com múltiplos métodos.
- Remover `mocks/comanda.mock.ts`.

**Flags a ligar:** `comanda`
**Pronto quando:** atendente cria agendamento com sinal de R$50, abre comanda, adiciona serviço + produto, e fecha dividindo entre Pix e dinheiro — com o estoque baixando.
**Tamanho:** 3 planos backend + 2 planos frontend (~2 semanas). É o maior marco do roadmap.

---

## M4 — Comissões calculadas (FIN-02)

**Pré-requisitos:** M3.

**Backend**
- Tabela `commission_entries` com **snapshot imutável** dos inputs (regra aplicada, valor base, percentual, profissional) — o requisito é explícito quanto a isso: a regra pode mudar amanhã, a comissão paga não.
- Cálculo disparado no `closeComanda`, dentro da mesma transação, consumindo as `commission_rules` que já existem e estão testadas.
- Query `commissionEntries(period, professionalId)`.

**Frontend**
- `/financeiro/comissoes` com dado real; remover `mocks/financeiro.mock.ts`.

**Flags a ligar:** `financeiroComissoes`
**Pronto quando:** fechar uma comanda gera a comissão do profissional sem nenhuma intervenção manual, e alterar a regra depois não muda o valor já registrado.
**Tamanho:** 1 plano backend + 1 plano frontend (~3–4 dias).

---

## M5 — Financeiro operacional (FIN-01)

**Pré-requisitos:** M3, M4.

**Backend**
- Tabelas `expenses` (despesas/contas a pagar), `financial_accounts`, `cash_sessions` (abertura/fechamento de caixa).
- Agregações: receita por dia/semana/mês, breakdown por método de pagamento, resultado (receita − despesa).
- `/financeiro/pagamento-profissionais`: fechamento do período por profissional, alimentado pelo M4.

**Frontend**
- `/financeiro` com números reais.
- Sub-páginas em duas ondas: **onda A** (caixa, pagamento de profissionais, despesas, fluxo por forma de pagamento) e **onda B** (clientes em débito, crédito de cliente, contas, exportação, antecipação, motivos de desconto).

**Flags a ligar:** `financeiro`, depois `financeiroRelatorios`
**Pronto quando:** o proprietário abre `/financeiro` e vê a receita do dia/semana/mês com breakdown por método.
**Tamanho:** 2 planos backend + 2 planos frontend (~1,5 semana).

---

## M6 — Histórico do cliente e rankings (CLI-02)

**Pré-requisitos:** M3 (sem comanda não há o que agregar).

**Backend**
- Trocar o stub de `ClientsService.history()` — hoje retorna `[]` literal — pela agregação real de agendamentos + comandas + produtos consumidos, com os filtros que a aba já desenha (período, profissional, tipo).
- Rankings: clientes por receita, serviços/produtos mais vendidos, profissionais por faturamento.

**Frontend**
- Ativar os filtros de `ClientHistoryTab` (hoje desabilitados de propósito, com tooltip explicando).
- Telas de ranking.

**Flags a ligar:** `rankings`
**Pronto quando:** a aba Histórico de um cliente lista as visitas e o consumo dele, filtrável.
**Tamanho:** 1 plano backend + 1 plano frontend (~4 dias).

---

## M7 — Home e notificações

**Por que só agora:** uma home é um resumo. Antes do M5 ela não teria o que resumir.

**Pré-requisitos:** M2, M3, M5.

**Backend**
- Query de resumo do dia: agendamentos de hoje, faturamento do dia, comandas abertas, estoque baixo (esta última já existe).
- Notificações: o backend já está pronto e testado (`notifications`, `markNotificationRead`); falta só consumir além do badge de estoque.

**Frontend**
- `/dashboard` real substituindo os cards de descoberta.
- Painel do sino no header e no bottom nav.

**Flags a ligar:** `dashboard`, `notificacoes`
**Efeito colateral:** `HOME_PATH` volta para `/dashboard` sozinho e o bottom nav recupera o item "Início" — a lógica já está em `features.ts`.
**Tamanho:** 1 plano backend + 1 plano frontend (~4 dias).

---

## M8 — Configurações

**Pré-requisitos:** M2 entregou a fatia de horário de funcionamento; aqui vem o resto.

**Backend/Frontend**
- Dados do estabelecimento (razão social, CNPJ, endereço, logo) — resolve também o nome hardcoded "Studio Beleza LTDA" no header.
- Perfis de acesso (edição, não só leitura).
- Formas de pagamento aceitas e taxas por operadora — o financeiro precisa disso para calcular líquido.
- Feriados e horários especiais.

**Flags a ligar:** `configuracoes`, `estabelecimentoSelector`
**Tamanho:** 2 planos (~1 semana).

---

## M9 — Noivas e contratos (Fase 4)

**Pré-requisitos:** M3 (contrato gera parcela, parcela vira pagamento).

- Tabelas `bridal_groups`, `contracts`, `contract_installments`.
- Política de cancelamento configurável com regra de retenção.
- Alertas de parcela vencida/vencendo — **primeiro uso real do BullMQ**, que hoje está registrado com zero filas.
- `AI-01`: sugestão de alocação de profissionais via Claude API.

**Flags a ligar:** `noivas`, `contratos`
**Tamanho:** 4–5 planos (~2,5 semanas).

---

## M10 — Comunicação (Fase 5)

**Pré-requisitos:** M2, M6 e **T2 (WABA aprovado)**.

- Lembrete 24h antes do agendamento — job BullMQ + tabela `outbox_events`, que existe no schema e nunca foi escrita.
- Campanhas segmentadas (aniversário, inativos, sazonais) com pré-visualização do segmento antes do envio.
- Consentimento LGPD por cliente (`whatsapp_consent_at`) — apontado como gap crítico no CLAUDE.md e ainda não implementado.
- Templates aprovados no Meta (24–72h por template).

**Flags a ligar:** `campanhas`
**Tamanho:** 3–4 planos (~2 semanas).

---

## M11 — Relatórios e previsão

**Pré-requisitos:** M5, M6, M9.

- Central `/relatorios`, DRE, mapa de calor de ocupação, relatórios de retorno, pesquisa de satisfação.
- FIN-03: previsão de 30 dias a partir de agendamentos confirmados + histórico.
- Meilisearch: hoje sobe no compose e não indexa nada. Ou indexar cliente/agendamento aqui, ou tirar do compose.

**Flags a ligar:** `relatorios`, restante de `financeiroRelatorios`
**Tamanho:** 2–3 planos (~1,5 semana).

---

## Fora do produto — decidir, não construir

`chatSuporte` (bolha de chat sem backend), `assinatura` ("Assine agora" apontando para uma tela de plano que não existe) e `ajudaTutoriais` (botões decorativos). Nenhum tem produto por trás. Três saídas: contratar um chat de terceiro, construir cobrança de verdade, ou apagar o código. Enquanto não houver decisão, ficam desligados.

---

## Sequência resumida

```
T1 gateway ──┐                      T2 WABA ──────────────────┐
             ▼                                                ▼
M1 Equipe → M2 Agenda → M3 Comanda/PDV → M4 Comissões → M5 Financeiro → M7 Home
                              │                                    │
                              └→ M6 Histórico ─────────────────────┤
                              └→ M9 Noivas                         │
                                                      M8 Configurações
                                                      M10 Comunicação
                                                      M11 Relatórios
```

M4, M6 e M9 podem correr em paralelo assim que o M3 fechar — todos dependem só da comanda existir.

**Estimativa total:** ~11 semanas de execução sequencial; ~8 com M4/M6 em paralelo. São estimativas de ordem de grandeza a partir do tamanho dos planos já executados nas Fases 1 e 2 (média de ~90 min por plano registrada no `STATE.md`), não um compromisso de prazo.

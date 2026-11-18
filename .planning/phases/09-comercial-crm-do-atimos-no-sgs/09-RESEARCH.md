# Fase 9: Comercial - CRM do Atimos no SGS - Pesquisa

**Pesquisado em:** 2026-11-18
**Domínio:** funil comercial (leads, negócios, interações, lembretes) sobre NestJS + GraphQL schema-first + Prisma + RLS, com kanban em React; integração com contratos (fase 4/04.1) e push (fase 8)
**Confiança:** ALTA no que vem do código do SGS e do Atimos (lido direto); MÉDIA nas escolhas de biblioteca para Excel/PDF; as lacunas estão em "Perguntas em aberto".

<user_constraints>
## Restrições do usuário (do CONTEXT.md)

### Decisões travadas
- **D-01:** O lead é um **cadastro separado** que vive só no Comercial e não aparece em Clientes. Só vira cliente do SGS no ganho.
- **D-02:** Se o telefone ou e-mail do lead já for de uma cliente do SGS, a tela **avisa** ("já é cliente: Fulana") e **liga o lead a essa cliente**. No ganho, usa a cliente existente em vez de criar outra.
- **D-03:** Um lead pode ter **vários negócios ao mesmo tempo** (ex.: noiva e debutante da irmã), com um histórico de interações único. Cada negócio anda no funil de forma independente.
- **D-04:** Os leads chegam por três caminhos: **cadastro manual**, **importação de planilha** (Excel/CSV, origem "import") e **formulário no site** (como o widget do Atimos, origem "site", público e por token da organização).
- **D-05:** O negócio só pode ser do tipo **Noiva** ou **Debutante**. Não existe tipo Social: o Comercial acompanha só fechamento de contrato.
- **D-06:** Campos do negócio: lead, etapa, tipo, **data do evento**, **pacote do catálogo do SGS** (o preço vem do pacote), **desconto** e valor final, **responsável (atendente)**, **origem** (Instagram, indicação, site, WhatsApp, importação, manual…), **local** e **observações**.
- **D-07:** As etapas do funil são **configuráveis por salão**. As padrão são Novo, Contato, Proposta, Negociação, Ganho e Perdido. Nome, cor, ordem e **prazo em dias** (D-15) podem ser editados. Ganho e Perdido são etapas de sistema.
- **D-08:** Marcar como **ganho** abre uma confirmação com os dados da cliente, para completar o que o contrato precisa (CPF, endereço etc.), e pergunta **se o sinal já foi pago**. Se foi, o pagamento é lançado no contrato e no caixa, como nos pagamentos de contrato que já existem.
- **D-09:** O ganho cria a cliente, ou usa a cliente ligada (D-02), e cria o **grupo e o contrato rascunho** com o pacote, o tipo e a data do evento. O caminho já existe: `createContract` com `newGroup`. Depois a tela **abre o contrato** criado.
- **D-10:** O **perdido** pede o motivo numa **lista fixa** (preço, data indisponível, fechou com outra, sem resposta, desistiu, outro) e num **campo de texto livre**. O motivo aparece nos relatórios.
- **D-11:** Os papéis do SGS são ADMIN, MANAGER, ATTENDANT e PROFESSIONAL, e a marca `isProfessional` é separada. **Acessam o Comercial os papéis ADMIN, MANAGER e ATTENDANT**, com ou sem `isProfessional`. O papel PROFESSIONAL não vê o menu nem acessa a API. Regra da usuária: "só profissional não usa; profissional + admin/gerente/atendente usa".
- **D-12:** ADMIN e MANAGER veem e editam **todos** os leads e negócios. **ATTENDANT vê só os negócios em que é o responsável**, e os leads desses negócios ou cadastrados por ela. A restrição tem de valer na API, não só na tela.
- **D-13:** Só ADMIN e MANAGER **configuram etapas**, **excluem** lead ou negócio, **trocam o responsável** e veem **Relatórios**.
- **D-14:** O responsável de um negócio é sempre alguém que usa o Comercial (ADMIN, MANAGER ou ATTENDANT).
- **D-15:** Cada etapa tem um **prazo em dias**. Se o negócio passar do prazo **sem interação**, o card fica em alerta (vermelho) e entra no "follow-up pendente" do Painel. É o SLA do Atimos, só que por etapa.
- **D-16:** O lembrete aparece na **lista de Lembretes e no Painel** (vencidos e do dia em destaque) e manda **push** no celular, Android (FCM) e iPhone (Web Push), na hora marcada. O push vai para o **responsável pelo negócio e para os gerentes e admins**. Se o lembrete não tiver negócio, vai para quem o criou e para os gerentes e admins.
- **D-17:** Ao registrar uma **interação** (ligação, WhatsApp, e-mail, reunião, visita, outro), o formulário tem o campo opcional **"próximo contato em"**, que cria o lembrete junto.

### Critério do Claude (discricionário)
- Indicadores do **Painel comercial**: seguir o Atimos (números do dia, follow-ups pendentes, últimas interações, status do funil) mais conversão e valor em negociação.
- **Relatórios**: seguir o Atimos, com filtros por responsável, etapa, status e período e exportação para Excel e PDF. Incluir motivos de perda (D-10) e origem.
- Visual do kanban: arrastar no computador; no celular, colunas com rolagem lateral ou troca de etapa pelo menu do card. Seguir o padrão visual Gestor Beauty da fase 6.
- Desenho do formulário público do site: anti-spam, limite de requisições, consentimento LGPD.
- Modelagem: tabelas novas com RLS por organização (`commercial_*` ou `leads`/`deals`…). O nome fica a critério do planner.
- Fila e agendamento do push de lembretes (BullMQ, como o push existente).

### Ideias adiadas (FORA DE ESCOPO)
- Extensão do Chrome para WhatsApp do Atimos (`/root/atmo-crm/whatsapp-extension`): captura de lead pelo WhatsApp Web. Fase própria, ligada ao backlog 999.1.
- Atendimento social pelo Comercial: descartado pela usuária.
- Restante do 08-08 (notificação, toque e logout no iPhone; Android intacto) continua pendente. O app nativo iOS vem depois desta fase.
</user_constraints>

<phase_requirements>
## Requisitos da fase

O ROADMAP marca "Requirements: TBD". Proponho os IDs abaixo, derivados das decisões; o planner deve registrá-los em REQUIREMENTS.md/ROADMAP.md.

| ID | Descrição | Suporte da pesquisa |
|----|-----------|---------------------|
| COM-01 | Cadastro de leads (manual) com aviso de cliente/lead duplicado e ligação à cliente existente (D-01, D-02) | Seções "Modelagem" e "Duplicidade" |
| COM-02 | Importação de leads por planilha Excel/CSV com prévia (D-04) | Seção "Importação" |
| COM-03 | Formulário público no site por token da organização, com anti-spam e LGPD (D-04) | Seção "Formulário público" |
| COM-04 | Negócios por lead (vários), tipo Noiva/Debutante, pacote, desconto, responsável, origem (D-03, D-05, D-06) | "Modelagem" |
| COM-05 | Etapas configuráveis por salão com prazo em dias; Ganho/Perdido de sistema (D-07, D-15) | "Modelagem", "SLA" |
| COM-06 | Pipeline em kanban (arrastar no desktop, menu no celular) (Discricionário) | "Kanban" |
| COM-07 | Histórico de interações do lead e "próximo contato em" (D-17) | "Interações e lembretes" |
| COM-08 | Ganho: cria/usa cliente, cria grupo + contrato rascunho, lança sinal opcional, abre o contrato (D-08, D-09) | "Ganho" |
| COM-09 | Perdido com motivo em lista fixa + texto (D-10) | "Perdido" |
| COM-10 | Visibilidade por papel e por responsável, aplicada na API (D-11 a D-14) | "Autorização" |
| COM-11 | Lembretes (lista, painel, push na hora marcada) (D-16) | "Lembretes e push" |
| COM-12 | Painel comercial e Relatórios com exportação Excel/PDF (só ADMIN/MANAGER nos relatórios) (D-13, Discricionário) | "Painel e relatórios" |
</phase_requirements>

## Restrições do projeto (do CLAUDE.md)

- Stack fixa: NestJS 10 + GraphQL Apollo **schema-first** + Prisma 5 + PostgreSQL 16 + Redis/BullMQ; frontend React 18 + Vite + Apollo Client 3 + Tailwind 3 + shadcn/ui.
- **RLS no PostgreSQL é inegociável** (FORCE RLS por `app.current_organization`). Nada de tabela nova sem política.
- Compliance obrigatório: **LGPD, WCAG 2.1 AA, OWASP**. O formulário público e a importação mexem em dado pessoal.
- Testes: 80% de cobertura unitária no domínio, E2E nos fluxos críticos, PR bloqueado em falha.
- Fluxo GSD: nada de edição fora de um comando GSD.
- Memória do projeto (workflow): gate completo antes de commit (lint, tsc, jest unitário e de integração, vitest, Playwright); depois push + deploy no staging direto e acompanhar o CI. O deploy de staging builda o working tree: com trabalho alheio não commitado, buildar de `git worktree` limpo do HEAD. Em gate/deploy longo, responder "já subiu?" com barra de progresso medida no log.
- Formatação à mão no frontend: aspas simples, cerca de 100 colunas. Prosa de planos e comentários em português do Brasil.
- Não existe `.claude/skills` nem `.agents/skills` no repositório (verificado).

## Resumo

O Atimos (Next.js + Supabase) tem o modelo `clients` (lead) / `deals` / `pipeline_stages` / `interactions` / `reminders`, com SLA em minutos por negócio, `source` e `loss_reason`. Não há nada para portar como código: a porta é conceitual. No SGS, o encaixe é limpo, porque quase tudo que a fase precisa já existe e é reutilizável: RLS por tabela (padrão `tenant_isolation` copiado de qualquer migração recente), `RequirePermission` com permissões materializadas em `role_permissions` por migração, `ContractsService.createTx` (com `newGroup`), `recordContractPaymentsTx` (pagamento + caixa), fila `push-notifications` com FCM e Web Push, e `@dnd-kit/core` já instalado no frontend.

Três pontos exigem trabalho novo e são os maiores riscos de planejamento: (1) **o ganho precisa ser atômico** (cliente + grupo + contrato + sinal numa transação) e hoje `createTx` é `private` e o `ClientsService.create` abre a própria transação, então é preciso expor versões `*Tx`; (2) **a visibilidade do ATTENDANT precisa ser imposta em toda consulta** (RLS só isola a organização), com um único ponto de filtro testado; (3) **o menu não tem filtro por papel hoje** (`MENU` é constante de módulo, podada só por feature flag) e **a rota de push só aceita `/agenda`** em quatro cópias, então tanto o ocultamento do menu para PROFESSIONAL quanto o toque na notificação do lembrete exigem mudanças de infraestrutura.

Além disso há um conflito de permissão a resolver (ATTENDANT não tem `contract.write`, mas o ganho cria contrato) e uma lacuna de produto (debutante: o lead é a debutante ou a responsável?). Ambos estão em "Perguntas em aberto" com recomendação.

**Recomendação principal:** novo módulo Nest `commercial/` com 5 tabelas `commercial_*` + 1 de configuração do formulário; três permissões (`commercial.read`, `commercial.write`, `commercial.manage`); ganho como um único método `winDeal` que roda numa só `runWithTenant`, reusando `ContractsService.createInTx` e `recordContractPaymentsTx`; lembretes por tick de BullMQ a cada minuto (não job atrasado por lembrete); exportação Excel/PDF no backend (`exceljs` + `pdfkit` já presente), entregue por GraphQL em base64 como o papel timbrado.

## Atimos: o que portar (resumo do código lido)

| Atimos | Conceito a portar | Observação para o SGS |
|--------|-------------------|-----------------------|
| `clients` (user_id, name, phone, email, tags, status, notes, last_interaction_at) | `commercial_leads` | Sem `company`/`tags`. Acrescentar origem, consentimento e vínculo `client_id` ao cliente do SGS |
| `pipeline_stages` (name, color, order_index, is_system) + `stage_type open/won/lost` (usado no widget) | `commercial_stages` | Acrescentar `sla_days` (D-15) e `kind` open/won/lost |
| `deals` (title, value, package_type, event_date, sla_minutes, loss_reason, status, source, closed_at) | `commercial_deals` | `package_type` vira `kind` noiva/debutante + `package_id` do catálogo; `sla_minutes` sai (SLA vem da etapa) |
| `interactions` (type call/whatsapp/email/meeting/visit/other, notes, date) | `commercial_interactions` | Mesmos 6 tipos |
| `reminders` (title, description, due_date, is_completed, client_id, deal_id) | `commercial_reminders` | Acrescentar `notified_at` para o push |
| `widget_configs` + `POST /api/widget/leads` (token, CORS `*`, roteamento least_busy/fixed_agent) | `commercial_form_settings` + `POST /public/leads/:orgId/:token` | O SGS usa o padrão de controller público já existente (ver abaixo). Roteamento: só responsável fixo opcional |
| Telas: dashboard (DailyStats, FollowUpList, LastInteractions, PipelineStatus), pipeline (DealCard, StageColumn, PipelineMetrics, Won/LostDealModal, PackageDiscountSelector), lembretes, relatórios (XLSX + jsPDF), configurações (PipelineSettings, WidgetSettings) | Mesmas telas no padrão Gestor Beauty | `DealDetailsSheet.tsx` do Atimos tem 2530 linhas: **não portar como está**; quebrar em abas (Resumo, Interações, Lembretes) |

Atimos usa `@dnd-kit/core` + `@dnd-kit/sortable`, `xlsx` 0.18.5 e `jspdf` + `jspdf-autotable` no frontend. No SGS **só `@dnd-kit/core` 6.3.1 e `@dnd-kit/modifiers` 9.0.0** estão instalados (usados na agenda: `useDraggable` em `AppointmentCard.tsx`). `xlsx`, `jspdf`, `sortable` **não existem** no SGS.

## Stack padrão

### Núcleo (já no repositório; não adicionar)
| Biblioteca | Versão | Uso nesta fase |
|------------|--------|----------------|
| NestJS + `@nestjs/graphql` + `@as-integrations/fastify` (Fastify) | 10.x | módulo `commercial/` + um controller REST público |
| Prisma | 5.x | models novos; migração SQL escrita à mão (padrão do projeto) |
| `@nestjs/bullmq` + `bullmq` | 10.2 / 5.13 | tick de lembretes (`upsertJobScheduler`, igual a `ContractAlertsScheduler`) |
| `@nestjs/throttler` | 6.7.1 | limite do formulário público (igual a `PublicContractController`) |
| `pdfkit` | 0.20.2 | PDF dos relatórios no backend |
| `@dnd-kit/core` | 6.3.1 | kanban (arrastar cards entre colunas) |
| `recharts` | ^2.15.3 | gráficos do painel e dos relatórios |
| `@apollo/client` 3, React Hook Form + Zod, shadcn/ui | existentes | telas e formulários |

### Nova dependência recomendada (única)
| Biblioteca | Versão verificada | Uso | Por quê |
|------------|-------------------|-----|---------|
| `exceljs` (backend) | 4.4.0 (npm, última publicação dez/2024) | **ler** planilha .xlsx/.csv da importação e **gerar** o .xlsx dos relatórios | Cobre os dois sentidos com uma dependência. Evita `xlsx` (SheetJS) 0.18.5 do Atimos, que está parado no npm com vulnerabilidades conhecidas (prototype pollution e ReDoS) e hoje só é distribuído fora do registro. |

Confiança: MÉDIA. `exceljs` está estável mas sem release desde dez/2024; o planner deve confirmar com `npm audit` no momento da instalação. Alternativa se houver objeção: CSV puro (sem nova dependência) com `Buffer`/split tratado em função própria, mas isso cai em "não fazer na mão" (aspas, vírgula/ponto e vírgula, BOM, acentos).

### Alternativas consideradas
| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| `exceljs` no backend | `papaparse` + `xlsx` no frontend | Duas dependências novas, parse no browser, e a prévia com duplicidade precisa de qualquer forma do backend |
| `@dnd-kit/sortable` | só `@dnd-kit/core` | O kanban da fase não reordena cards dentro da coluna (só muda de etapa); `core` basta e já está instalado |
| Job BullMQ atrasado por lembrete | Tick por minuto | Job atrasado precisa ser removido/recriado a cada edição ou conclusão e se perde se o Redis for limpo; o tick é idempotente (ver "Lembretes e push") |

**Instalação:**
```bash
pnpm --filter @sgs/backend add exceljs
# Versão verificada em 2026-11-18: npm view exceljs version -> 4.4.0
```

## Padrões de arquitetura

### Estrutura recomendada
```
apps/backend/src/commercial/
├── commercial.module.ts            # importa DatabaseModule, AuthzModule, ContractsModule, ContractPaymentsModule(se preciso), PushModule(global)
├── commercial-access.ts            # PURO: visibilityWhere(tenant), canManage(roleName) — testado por unit
├── commercial-stages.service.ts    # ensureDefaultStages, CRUD de etapas, reordenação
├── commercial-leads.service.ts     # CRUD, duplicidade, import
├── commercial-deals.service.ts     # CRUD, moveStage, assign, lose, reopen
├── commercial-win.service.ts       # winDeal (transação única)
├── commercial-interactions.service.ts
├── commercial-reminders.service.ts # CRUD + claimDueReminders
├── commercial-reminders.scheduler.ts / .processor.ts   # tick por minuto (padrão contract-alerts)
├── commercial-dashboard.service.ts / commercial-reports.service.ts
├── commercial-export.ts            # exceljs + pdfkit
├── commercial-sla.ts               # PURO: isOverdue(stage, lastInteractionAt, stageEnteredAt, now)
├── commercial-phone.ts             # PURO: normalização de telefone
├── public-lead.controller.ts       # REST público com Throttler local
└── commercial.resolver.ts          # um resolver (ou 3), com @RequirePermission
apps/backend/src/graphql/schema/commercial.graphql
apps/backend/prisma/migrations/20261122000000_phase9_commercial/migration.sql   # nome sugerido; última existente: 20261121000000
apps/frontend/src/features/commercial/{api,components,pages,lib,__tests__}
apps/frontend/src/pages? (não: as páginas de feature ficam em features/commercial/pages, como bridal)
```

### Modelagem (tabelas sugeridas; nomes à escolha do planner)

Todas com `id UUID DEFAULT gen_uuid_v7()`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `created_at/updated_at TIMESTAMPTZ(6)` e trigger `fn_set_updated_at`, índice com `organization_id` na frente, e o bloco RLS exatamente como em `20261114000000_bridal_timeline`:

```sql
ALTER TABLE commercial_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_leads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commercial_leads
  USING (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization', true), '')::uuid);
```

| Tabela | Colunas principais | Notas |
|--------|--------------------|-------|
| `commercial_stages` | `name`, `color`, `position`, `sla_days INT NULL`, `kind` CHECK (`open`,`won`,`lost`), `is_system` | Índices únicos parciais: uma etapa `won` e uma `lost` por org. Ganho/Perdido: sem `sla_days`, nome/cor editáveis? (D-07 diz "Nome, cor, ordem e prazo podem ser editados"; Ganho/Perdido são de sistema, então não podem ser excluídas nem mudar `kind`; a **posição** delas deve ficar sempre no fim: validar) |
| `commercial_leads` | `full_name`, `phone`, `phone_digits`, `email` (lower), `source`, `notes`, `client_id UUID NULL → clients(id) ON DELETE SET NULL`, `created_by → members(id)`, `consent_at TIMESTAMPTZ NULL`, `consent_text_version`, `deleted_at` | `phone_digits` guarda só dígitos normalizados para comparar com `clients.phone` (que é texto livre) |
| `commercial_deals` | `lead_id`, `stage_id`, `status` (`open`,`won`,`lost`), `kind` CHECK (`noiva`,`debutante`), `event_date DATE`, `package_id → packages(id) ON DELETE SET NULL`, `package_name`, `package_price`, `discount_amount`, `final_amount`, `assignee_member_id → members(id)`, `source`, `location`, `notes`, `stage_entered_at`, `last_interaction_at`, `lost_reason_code`, `lost_reason_text`, `closed_at`, `won_contract_id → contracts(id)`, `won_client_id`, `created_by` | `kind` só noiva/debutante (D-05) por CHECK. `package_name`/`package_price` como foto do momento (o pacote pode mudar de preço depois). `won_contract_id` com índice único parcial garante um negócio por contrato |
| `commercial_interactions` | `lead_id`, `deal_id NULL`, `type` CHECK (6 tipos), `notes`, `occurred_at`, `created_by` | Interação com `deal_id` atualiza `deals.last_interaction_at` na mesma transação |
| `commercial_reminders` | `lead_id NULL`, `deal_id NULL`, `title`, `description`, `due_at TIMESTAMPTZ`, `completed_at NULL`, `notified_at NULL`, `created_by`, `interaction_id NULL` | Índice parcial `(organization_id, due_at) WHERE completed_at IS NULL AND notified_at IS NULL` para o tick |
| `commercial_form_settings` | `organization_id UNIQUE`, `token` (aleatório 32 bytes, base64url), `is_active`, `default_assignee_member_id NULL`, `success_message`, `consent_text` | Um por org. Rotação do token = regerar |

Etapas padrão: criadas por função idempotente `ensureDefaultStages(tx, orgId)` chamada no primeiro acesso do módulo **e** por backfill na migração para as orgs existentes (`INSERT ... SELECT FROM organizations ... ON CONFLICT DO NOTHING`). Cores sugeridas ao planner; prazos padrão sugeridos: Novo 1 dia, Contato 3, Proposta 3, Negociação 2 (valores a confirmar com a usuária; marcar como configuráveis).

### Autorização (D-11 a D-14)

- **Permissões novas** em `permissions.catalog.ts` + migração que insere em `role_permissions` (padrão `DO $$ ... SELECT id FROM roles WHERE name='ADMIN' AND is_system=true`, como `20261114000000`):
  - `commercial.read` e `commercial.write`: ADMIN, MANAGER, ATTENDANT. **Não** PROFESSIONAL.
  - `commercial.manage`: ADMIN, MANAGER (configurar etapas, excluir, trocar responsável, relatórios, configurar formulário).
- **`isProfessional` não entra na decisão**: o papel (`roleName`) decide. "Profissional + atendente usa" já resulta disso. O front lê `roleName` do auth store (o `permissions` do store nunca é populado pelo login; ver comentário em `bridal-permissions.ts`), então criar `commercial-permissions.ts` espelhando o catálogo, com teste que compara as duas listas.
- **Guard de papel só protege o resolver.** Para D-12, criar `commercial-access.ts` com `visibilityWhere(tenant)` que devolve `{}` para ADMIN/MANAGER e, para ATTENDANT, o filtro de Prisma:
  - negócio visível: `assigneeMemberId = tenant.memberId`;
  - lead visível: `createdBy = tenant.memberId` **OU** existe negócio (não excluído) com `assigneeMemberId = tenant.memberId`.
  - interações e lembretes herdam: visíveis se o lead é visível (interação) ou se o criador/o responsável do negócio é a usuária (lembrete).
  Todo serviço **deve** passar por esse ponto. Acesso por id a recurso invisível devolve `NOT_FOUND` (nunca `FORBIDDEN`, para não vazar existência). Contagens do painel e do kanban usam o mesmo filtro.
- **Troca de responsável** (D-13/D-14): validar que o novo responsável é `Member` ativo, não excluído, com `role.name IN ('ADMIN','MANAGER','ATTENDANT')`. Nota: a atendente que cadastra um lead/negócio é automaticamente a responsável; se o responsável for removido ou virar PROFESSIONAL, o negócio fica órfão e some para ela: tratar (ver Armadilhas).
- RLS não consegue expressar D-12 (só conhece organização). Não criar `app.current_member`; manter no serviço com testes de integração.

### Ganho: `winDeal` numa só transação (D-08/D-09)

Achados no código:
- `ContractsService.createTx(tx, orgId, memberId, input, mode)` é **private** e já recebe `tx`. `create()` público envolve em `runWithTenant`. Para compor atomicamente, expor um método público fino `createInTx(tx, orgId, memberId, input)` que chama `createTx(..., 'commit')` (mudança mínima, sem duplicar lógica). Retorno: id do contrato.
- `recordContractPaymentsTx(tx, orgId, memberId, contractId, lines, note)` já é função de transação e **aceita contrato em `draft`** (`PAYABLE = ['draft','awaiting_acceptance','active']`); ela grava `contract_payments` e chama `recordCashMovement` (caixa). Reuso direto para o sinal.
- `ClientsService.create` abre a própria `runWithTenant` e valida CPF/telefone/e-mail com helpers locais (`validateExtras`, `normalizeCep`...). Extrair `createClientTx(tx, orgId, input)` e `updateClientTx` (mesma validação) em `clients/` e fazer o serviço atual delegar. Alternativa mais barata: o ganho validar com `validateCpf`/regex e fazer `tx.client.create` direto, mas isso duplica as regras (CPF normalizado, e-mail minúsculo, CEP formatado). Recomendo extrair.
- `createContract` com `newGroup` exige `bride: { clientId | newClient }`, `eventDate`, `eventKind` ('noiva' padrão | 'debutante'), `packageId`; sem itens explícitos, `buildItems` monta os itens do pacote. Sem itens e sem pacote dá `ITEMS_REQUIRED`: **o ganho exige pacote**. O sinal padrão vem de `pkg.depositKind/depositValue` quando `depositAmount` não é informado. O desconto vai em `discountAmount` (+ `discountDescription`).
- Código de contrato consome `contract_sequences` (UPSERT por org/ano): a transação do ganho deve ser curta.
- Para debutante o contrato usa `group.responsibleClientId` como contratante e a "noiva" do grupo é a debutante (ver Pergunta em aberto 1).

Sequência dentro de uma `tenant.runWithTenant(orgId, tx => ...)`:
1. `SELECT ... FOR UPDATE` no negócio (via `$queryRaw`, como `lockContract` faz); abortar se `status <> 'open'` (idempotência contra clique duplo). Reaplicar `visibilityWhere`.
2. Resolver a cliente: se `lead.clientId` existe, aplicar atualização dos campos completados no modal (CPF, RG, CEP, endereço, telefones); senão criar cliente a partir do lead + campos do modal e gravar `lead.client_id`. **Rechecar duplicidade no momento do ganho** (a cliente pode ter sido criada depois do cadastro do lead).
3. `contracts.createInTx(tx, orgId, memberId, { newGroup: { eventKind, eventDate, bride: { clientId }, locationName/Address, notes, ... }, packageId, discountAmount, discountDescription })`.
4. Se "sinal pago": `recordContractPaymentsTx(tx, orgId, memberId, contractId, lines, 'Sinal lançado pelo Comercial')`. Validar valor ≤ sinal esperado? (o service só barra `OVERPAYMENT` contra o total.) Forma de pagamento: reaproveitar o seletor de `ContractPaymentDialog`.
5. Atualizar o negócio: `status='won'`, etapa `won`, `closed_at`, `won_contract_id`, `won_client_id`; criar interação automática "Negócio ganho" (opcional).
6. Retornar `contractId` para a tela navegar para `/contratos/:id`.
Erros de contrato (`ContractError`) saem como `UserError` (padrão `fail(e)` dos serviços) e **revertem tudo** (a exceção sai da transação). Cuidado: se o `createTx` captura erro e devolve payload em vez de lançar, a transação poderia comitar parcial; usar o caminho que lança. Prever `BRIDAL_SCHEDULE_TX_OPTIONS` (timeout maior) se o `create` do contrato o usar; conferir em `contracts.service.ts::create` (hoje `create` usa `runWithTenant` sem options, então o padrão serve).

Permissão: ATTENDANT tem `contract.read` e `contract.payment`, **não** `contract.write`. Ver Pergunta em aberto 2.

### Perdido (D-10)
Lista fixa em constante compartilhada (`price`, `date_unavailable`, `chose_other`, `no_response`, `gave_up`, `other`) com rótulos em português, validada por CHECK e por enum GraphQL; texto livre até 500 caracteres. Negócio perdido pode ser **reaberto** por ADMIN/MANAGER (recomendação; não está nas decisões, é para o planner confirmar). Negócio ganho **não** pode ser movido nem perdido (tem contrato): bloquear no serviço e no arrasto.

### SLA por etapa (D-15)
Calcular sob demanda, sem job:
`atrasado = status='open' AND stage.sla_days IS NOT NULL AND now() > COALESCE(last_interaction_at, stage_entered_at) + sla_days * interval '1 day'`.
`stage_entered_at` é atualizado em `moveStage`; `last_interaction_at` ao registrar interação. Função pura em `commercial-sla.ts` (unit) + o mesmo critério em SQL para contagem do painel ("follow-up pendente"). Atenção: o Atimos mede inatividade desde a última interação, igual aqui.

### Interações e lembretes (D-16/D-17)
- Interação com "próximo contato em" cria lembrete na mesma transação (`interaction_id` preenchido, título padrão "Retomar contato com {lead}").
- Lembrete sem negócio e sem lead é permitido? (Atimos permite `client_id` nulo.) Manter: `lead_id` e `deal_id` opcionais.

### Lembretes e push (D-16)

Achados:
- `PushEventsService.enqueue(job)` é fire-and-forget na fila `push-notifications`; `PushProcessor` chama `PushService.dispatch(job)`, que hoje é **todo orientado a agendamento** (busca `appointment`, `resolvePushTargets` por profissional, `buildPushMessage`). `PushJob` é uma união discriminada por `kind` e `PUSH_KINDS` é fechado.
- O padrão de job agendado por organização já existe: `ContractAlertsScheduler` (`upsertJobScheduler` com cron) + processor + `ContractAlertsService` listando orgs via função `job_list_active_orgs()` (SECURITY DEFINER, sem tenant) e rodando `runWithTenant` por org. Flag de ambiente (`CONTRACT_ALERTS_SCHEDULER`, `PUSH_NOTIFICATIONS_WORKER`) e as suítes de integração definem `false` em `test/integration/setup.ts` (`process.env.X ??= 'false'`). **Criar flag análoga `COMMERCIAL_REMINDERS_SCHEDULER` (env.schema.ts + app-config.service.ts + setup.ts).**
- Rota de toque: `data.route` é validada por allowlist `^/agenda(\?...)?$` em **quatro lugares**: `apps/frontend/public/sw.js` (`safeRoute`), `apps/frontend/src/infrastructure/native/push-route.ts` (`AGENDA_ROUTE_RE`, `isAllowedPushRoute`), `packages/shared/src/push.ts` e o teste `apps/frontend/src/__tests__/service-worker.test.ts` (que exige que `/financeiro` caia em `/agenda`). **Sem alargar a allowlist, o toque no push do lembrete abre `/agenda`.** Alargar para `^/(agenda|comercial/lembretes)(\?...)?$` nas quatro cópias, manter o teste de rota adulterada e acrescentar casos para `/comercial/lembretes?lembrete=<id>`. O app Android (Capacitor) usa o mesmo `push-route.ts`.

Desenho recomendado:
1. **Tick a cada minuto** (`upsertJobScheduler('commercial-reminders-tick', { pattern: '* * * * *' })`) numa fila própria `commercial-reminders`.
2. Por org (via `job_list_active_orgs()`), dentro de `runWithTenant`: reivindicar lembretes vencidos de forma atômica e idempotente
   ```sql
   UPDATE commercial_reminders SET notified_at = now()
   WHERE id IN (SELECT id FROM commercial_reminders
                WHERE completed_at IS NULL AND notified_at IS NULL AND due_at <= now()
                ORDER BY due_at LIMIT 200 FOR UPDATE SKIP LOCKED)
   RETURNING id, title, deal_id, lead_id, created_by;
   ```
3. Para cada lembrete, `PushEventsService.enqueue({ kind: 'commercial.reminder', orgId, reminderId })`. Estender `PushJob`/`PUSH_KINDS` com o novo tipo e ramificar **no topo** de `PushService.dispatch` para um método `dispatchReminder` (alvos: responsável do negócio + membros ativos ADMIN/MANAGER; sem negócio: criador + ADMIN/MANAGER; **não** excluir o autor, pois o disparo é por horário; deduplicar por membro). Reaproveitar o laço de envio/limpeza de tokens inválidos e `DeviceToken` (Web Push usa `p256dh/auth`). Mensagem em `push-messages.ts` (função nova, sem mexer em `buildPushMessage`): título "Lembrete: {título}", corpo com lead/negócio, `data.route = /comercial/lembretes?lembrete={id}`. O texto deve ser o mesmo no Android e iPhone (decisão da fase 8).
4. Lembrete editado para nova data **depois** de notificado: ao reagendar, zerar `notified_at`. Lembrete concluído nunca notifica.
Vantagens frente a "job com delay por lembrete": nada a cancelar quando o lembrete muda, sobrevive a flush do Redis, e o limite de 1 minuto é aceitável para follow-up. Atenção a salões sem token de dispositivo: `dispatch` já retorna `skipped`.

### Formulário público do site (D-04)

Padrão existente a copiar: `PublicContractController` (`apps/backend/src/contracts/acceptance/public-contract.controller.ts`): `@Public()` (o `JwtAuthGuard` global é preso ao GraphQL), `@UseGuards(ThrottlerGuard)` local, `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])` **dentro do módulo do controller** (não global), `@Throttle({ default: { limit: 5, ttl: 60_000 } })` na rota de escrita, cabeçalhos `Cache-Control: no-store`, `X-Robots-Tag`, `Referrer-Policy`. A organização vem **na URL** (`:orgId/:token`) e o serviço faz `runWithTenant(orgId)` e confere o token na tabela com RLS, sem função SECURITY DEFINER.

Para o formulário: `GET /public/leads/:orgId/:token` (devolve nome do salão e texto de consentimento se ativo) e `POST /public/leads/:orgId/:token`. Hospedar a página no frontend (rota pública `/contato/:orgId/:token`, fora do `ProtectedRoute`/`AppShell`, como o aceite do contrato em `router.tsx`). Isso evita CORS (mesma origem). Para embutir no site da noiva, usar `<iframe>`: o nginx precisa liberar `frame-ancestors` para essa rota (verificar `infra/nginx/sgs-staging.conf`; hoje não há `X-Frame-Options` configurado ali).
- Anti-spam: campo honeypot (campo oculto: se preenchido, responder 200 sem gravar), limite de requisições por IP, limite de tamanho do corpo e dos campos, validação do telefone/e-mail, e **deduplicação** (mesmo telefone nos últimos N minutos não cria segundo lead; anexa interação). CAPTCHA fica fora (sem dependência externa); registrar como evolução se houver abuso.
- LGPD: checkbox de consentimento obrigatório, grava `consent_at` e `consent_text_version`; coletar o mínimo (nome, telefone, e-mail opcional, tipo e data do evento, mensagem). Não gravar IP em claro. Responsável do lead de site: `default_assignee_member_id` opcional; sem ele, fica "sem responsável" visível a ADMIN/MANAGER (Pergunta 3).
- Token: gerar com `crypto.randomBytes(32)` base64url; comparar em tempo constante; permitir desativar/regerar.

### Importação de planilha (D-04)

- Fluxo em dois passos: `previewLeadImport(base64, filename)` lê, normaliza e devolve linhas válidas, inválidas (com motivo), duplicadas contra leads e clientes; `importLeads(batchToken|payload)` grava. Limites: 5 MB, 2.000 linhas.
- Transporte: GraphQL com `base64` (precedente: `uploadContractLetterhead`, limite 2,5 MB no serviço). **Verificar o `bodyLimit` do Fastify em `apps/backend/src/http/fastify-adapter.ts`** antes de aceitar 5 MB em base64 (+33%).
- Colunas aceitas (cabeçalhos em português, tolerantes a acento/caixa): nome, telefone, e-mail, tipo (noiva/debutante), data do evento, origem (fica "import" se vazia), observações. Cria **lead** e, se houver tipo/data, um negócio na primeira etapa com `source` herdada; responsável = quem importa (atendente) ou escolhido pelo ADMIN/MANAGER.
- Leitura segura: ler só a primeira planilha, ignorar fórmulas/macros, tratar célula como texto, escapar na exportação (injeção de fórmula: prefixar `'` em células que comecem com `= + - @`).

### Duplicidade (D-02)

- Normalização em `commercial-phone.ts` (puro): só dígitos; remover o `55` inicial se sobrar mais de 11 dígitos; comparar pelos últimos 10/11 dígitos. `clients.phone`/`phone2`/`phone3` são texto livre (sem normalização no banco): comparar em SQL com `regexp_replace(phone, '\D', '', 'g')`. Sem índice; aceitável no volume de um salão, mas manter a consulta limitada (`LIMIT 10`) e filtrada por organização (RLS).
- E-mail: comparar em minúsculas. (`ClientsService.byField` compara `phone` exato, que **não serve** para este caso: telefone mascarado não casa.)
- Query GraphQL `commercialDuplicateCheck(phone, email)` devolve clientes do SGS e outros leads que casam; a tela mostra o aviso "já é cliente: Fulana" com botão "Ligar a esta cliente" e, para lead duplicado, "Abrir lead existente". Ao ligar, `lead.client_id` é gravado e o ganho usa essa cliente.
- Atenção: o lead não aparece em Clientes (D-01), mas o aviso consulta a tabela `clients` normalmente (mesma org, RLS).

### Kanban (Discricionário)
- `@dnd-kit/core` 6.3.1: `DndContext` + `useDraggable` (card) + `useDroppable` (coluna), exatamente como a agenda usa `useDraggable`. Sensores: `PointerSensor` com `activationConstraint: { distance: 8 }` (evita arrastar sem querer ao rolar) e `TouchSensor` com `delay` (250 ms) para o celular; `modifiers` já instalado se precisar restringir ao container.
- **Atualização otimista com reversão**: mover o card no cache do Apollo e chamar `moveCommercialDeal`; em erro, voltar. O servidor é a fonte da verdade (valida etapa, visibilidade, e que ganho/perdido **não** são destinos de arrasto: soltar em Ganho/Perdido abre o modal correspondente em vez de mover).
- Celular: colunas com rolagem lateral (`overflow-x-auto snap-x`) e, em cada card, menu "Mover para…" (acessível por teclado; atende WCAG 2.1 AA, que arrastar sozinho não atende). Reaproveitar `use-media-query.ts`.
- Visual: padrão Gestor Beauty da fase 6 (conferir `casco-gestor-beauty.test.tsx` e `grupo-noivas-gestor-beauty.test.tsx` como regra de regressão visual).
- Listas grandes: o quadro mostra só negócios **abertos** (+ Ganho/Perdido recentes, por exemplo últimos 30 dias, com link "ver todos" na lista de Leads) para não carregar tudo.

### Painel e relatórios (Discricionário)
- Painel (visível a todos que usam o Comercial, filtrado por visibilidade): leads/negócios novos hoje, lembretes vencidos e de hoje, follow-ups pendentes (SLA), últimas interações, quantidade e valor por etapa, taxa de conversão (ganhos ÷ (ganhos + perdidos) no período), valor em negociação (soma de `final_amount` abertos).
- Relatórios (só `commercial.manage`): filtros por responsável, etapa, status, período e origem; tabelas de motivos de perda e origem; exportação Excel e PDF.
- Exportação **no backend**, entregue como `{ filename, mimeType, base64 }` por query/mutation GraphQL (as rotas REST do projeto são públicas e não passam pelo JWT global, então uma rota de download autenticada exigiria infraestrutura nova). Excel com `exceljs`, PDF com `pdfkit` (já usado nos contratos). Limitar linhas (ex. 5.000) e aplicar `visibilityWhere` (relatório é só gerente, mas manter o filtro por defesa em profundidade).
- Gráficos: `recharts` (já usado em `FinancialSubPages`/dashboard).

### Frontend: menu, rotas, gating

Achados em `apps/frontend/src/components/layout/menu-config.ts` e `config/features.ts`:
- `ALL_MENU` é uma constante; `MENU = pruneMenu(ALL_MENU)` poda por **feature flag** (`isPathEnabled`), **não por papel**. `SidebarNav`, `AppDrawer` e `GlobalSearchSheet` (via `searchMenu`/`flattenMenu`) importam `MENU` direto. Hoje nenhum item é escondido por papel.
- Para ocultar o grupo do PROFESSIONAL e o submenu Relatórios de ATTENDANT: acrescentar `roles?: readonly string[]` em `MenuItem` e uma função `menuForRole(roleName)` que aplica `pruneMenu` com filtro de papel; trocar `MENU` por `useMenu()` (lê `roleName` do auth store com `useMemo`) em `SidebarNav`, `AppDrawer` e `GlobalSearchSheet`; manter `MENU` exportado (testes existentes, `features.test.ts` usa `flattenMenu(MENU)`). Atualizar os testes do menu para os 4 papéis.
- Flag nova `comercial: true` em `FEATURES` e entrada em `GATED_PATHS` (`['/comercial', 'comercial']`); a rota só entra em `router.tsx` se a flag estiver ligada. O mesmo `router.tsx` precisa de um **guard de papel** para `/comercial/*` (hoje só existe `ProtectedRoute`, sem papel): criar `RequireRole`/`CommercialRoute` que redireciona PROFESSIONAL para a home e `/comercial/relatorios` para quem não é ADMIN/MANAGER. O guard é conforto; a API é quem protege.
- Ícones lucide: todo item do menu exige `icon` (quick 261107-jvl). Sugestões: Comercial `Handshake`, Painel `LayoutDashboard`, Leads `Users`, Pipeline `Kanban`/`Columns3`, Lembretes `BellRing`, Relatórios `BarChart3` (conferir que existem na versão de `lucide-react` instalada).
- Rotas: `/comercial` (painel), `/comercial/leads`, `/comercial/leads/:id`, `/comercial/pipeline`, `/comercial/lembretes`, `/comercial/relatorios`, `/comercial/configuracoes` (etapas e formulário; só ADMIN/MANAGER, pode ser aba/botão dentro do Pipeline em vez de item de menu).
- Frontend não usa codegen na prática: as APIs são `gql` do `@apollo/client` escritas à mão (ex. `features/bridal/api/contracts.api.ts`), com tipos manuais. Seguir o mesmo padrão; **não** rodar codegen (exige backend no ar).
- Após o ganho: `navigate('/contratos/' + contractId)`. Reaproveitar `CompleteContractorDialog`/`contractReadiness` para o que falta no contrato (D-08).

## Não fazer na mão

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| Criar contrato + grupo + pagamento do sinal | Nova lógica de contrato/caixa | `ContractsService.createTx` (expor `createInTx`) e `recordContractPaymentsTx` | Numeração de contrato, itens do pacote, sinal, parcelas e `recordCashMovement` já tratados |
| Validar CPF/CEP/telefone | Regex próprias | helpers de `clients/` (`validateCpf`, `normalizeCpf`; extrair `createClientTx`) | CPF com dígito verificador, formatos já cobertos por testes |
| Push Android/iPhone | Novo canal | `PushService`/`PushEventsService`, `DeviceToken`, providers FCM e Web Push | Limpeza de token inválido, retry, credenciais |
| Agendamento recorrente | `setInterval` | `upsertJobScheduler` do BullMQ (igual `ContractAlertsScheduler`) | Sobrevive a reinício, uma execução por vez com várias instâncias |
| Limite de requisições | contador em memória | `@nestjs/throttler` local (padrão do aceite do contrato) | Já testado em `phase4-public-ratelimit` |
| Ler/gerar Excel e CSV | split por vírgula | `exceljs` | Aspas, `;`, BOM, tipos de célula, datas seriais |
| PDF | HTML→PDF | `pdfkit` (já no backend) | Sem navegador headless |
| Arrastar e soltar | eventos de ponteiro manuais | `@dnd-kit/core` | Sensores de toque, acessibilidade, colisão |
| Normalização de telefone | comparar string crua | util pura única (`commercial-phone.ts`), usada por duplicidade, importação e site | Evita três variantes divergentes |

## Inventário de estado em runtime

Não é fase de rename/refactor; é greenfield aditivo. Itens de implantação:

| Categoria | Achado | Ação |
|-----------|--------|------|
| Dados armazenados | Tabelas novas; orgs existentes sem etapas | Backfill das 6 etapas padrão na migração + `ensureDefaultStages` |
| Config de serviço vivo | Nenhuma | — |
| Estado registrado no SO | Nenhum | — |
| Segredos/env | Flag nova `COMMERCIAL_REMINDERS_SCHEDULER` (e `PUSH_NOTIFICATIONS_WORKER` já existe) | Acrescentar em `env.schema.ts`, `app-config.service.ts`, `docker-compose*.yml` (`.env` do staging) e `setup.ts` |
| Artefatos de build | Cópias da allowlist de rota do push (`sw.js`, `push-route.ts`, `packages/shared`) | Atualizar as três juntas; o service worker é cacheado no navegador: conferir se há versão/`CACHE` a incrementar em `sw.js` |

## Armadilhas comuns

### 1. Vazamento por filtro esquecido (D-12)
**O que dá errado:** uma query nova (contagem do painel, busca por id, `lead` dentro de `deal`, exportação) esquece `visibilityWhere`; a atendente vê/edita negócio alheio. RLS não pega, pois é da mesma organização.
**Como evitar:** todas as leituras/escritas passam por helper único; teste de integração com duas atendentes (A e B) e um gerente cobrindo cada query e mutation, incluindo acesso direto por id (deve dar NOT_FOUND) e agregações.
**Sinal de alerta:** serviço usando `tx.commercialDeal.findMany` sem `visibilityWhere` no `where`.

### 2. Ganho não atômico ou duplicado
**O que dá errado:** cliente criada e contrato falha (cliente órfã); ou clique duplo cria dois contratos.
**Como evitar:** uma `runWithTenant`; `FOR UPDATE` no negócio; índice único parcial em `won_contract_id`; teste de falha no meio (pacote ausente ⇒ nada gravado) e de concorrência (duas chamadas simultâneas ⇒ um contrato).

### 3. Push toca em `/agenda`
**O que dá errado:** o allowlist de rota força `/agenda` para `/comercial/...`.
**Como evitar:** alterar as quatro cópias e testar; ver seção de push.

### 4. Menu "oculto" mas rota/API abertas
**O que dá errado:** esconder o item não impede acesso por URL.
**Como evitar:** `@RequirePermission` em todo resolver + guard de rota + teste de integração de que PROFESSIONAL recebe FORBIDDEN em cada operação.

### 5. Formulário público abusado
**O que dá errado:** spam, enumeração de tokens, dados pessoais sem consentimento.
**Como evitar:** token aleatório de 32 bytes, throttle por IP, honeypot, consentimento obrigatório, resposta idêntica para token inválido e inativo (404), nada de logs com telefone/e-mail em claro.

### 6. Telefone não casa
**O que dá errado:** `clients.phone` guarda "(11) 99999-0000", o lead guarda "11999990000"; o aviso de duplicidade nunca dispara.
**Como evitar:** normalização por dígitos em ambos os lados + testes com máscara, `+55`, 9º dígito presente/ausente.

### 7. Responsável órfão
**O que dá errado:** atendente vira PROFESSIONAL, é desativada ou excluída (`hard delete member` existe) e seus negócios somem para todos menos admin/gerente.
**Como evitar:** FK `assignee_member_id ... ON DELETE SET NULL` (ou tratamento em `purge_member`: **verificar a função `purge_member` da migração `20261112000000_hard_delete_member_bridal`**, que lista FKs para `members` e precisa conhecer as novas colunas `created_by`/`assignee_member_id`, senão a exclusão definitiva falha por FK); tela de gerente para "sem responsável".

### 8. Exclusão definitiva e FKs novas
**O que dá errado:** `purge_bridal_group`/`purge_member`/`purge_*` falham por FK das tabelas novas (`won_contract_id`, `package_id`, `client_id`).
**Como evitar:** colunas de referência com `ON DELETE SET NULL`; revisar as funções `purge_*` existentes e acrescentar teste (`hard-delete-member-bridal.e2e.spec.ts` como modelo).

### 9. Datas e fuso
**O que dá errado:** `event_date` como timestamp desloca um dia; "hoje" do painel usa UTC.
**Como evitar:** `event_date DATE` e converter com o `timezone` da organização (`orgToday`/`localDate` de `contracts.service.ts`); o lembrete usa `TIMESTAMPTZ`; mostrar no fuso da org.

### 10. Etapas: remoção e ordem
**O que dá errado:** apagar etapa com negócios; mover Ganho/Perdido do fim.
**Como evitar:** excluir etapa só se estiver vazia (ou exigir etapa de destino), impedir exclusão das de sistema, e validar que Ganho e Perdido ficam sempre após as abertas; pelo menos uma etapa aberta.

### 11. Planilha hostil
**O que dá errado:** arquivo gigante, fórmulas, injeção de fórmula na exportação, célula com `=cmd`.
**Como evitar:** limites, tratar tudo como texto, prefixar `'` ao exportar.

### 12. Tick de lembretes dispara nos testes
**O que dá errado:** worker real em suíte de integração.
**Como evitar:** flag `COMMERCIAL_REMINDERS_SCHEDULER=false` por padrão em `setup.ts`; testar o serviço (`claimDueReminders`) chamando-o diretamente, como `runForOrg` nos alertas.

## Exemplos de código

### Reuso do contrato dentro da transação do ganho (esboço)
```typescript
// Fonte: padrão de contracts.service.ts (createTx) e contract-payments.ts (recordContractPaymentsTx)
async winDeal(orgId: string, tenant: TenantContext, input: WinDealInput) {
  try {
    return await this.tenant.runWithTenant(orgId, async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM commercial_deals WHERE id = ${input.dealId}::uuid FOR UPDATE`;
      const deal = await tx.commercialDeal.findFirst({
        where: { id: input.dealId, ...visibilityWhere(tenant).deal },
        include: { lead: true },
      });
      if (!locked || !deal) throw new CommercialError('NOT_FOUND', 'Negócio não encontrado.');
      if (deal.status !== 'open') throw new CommercialError('DEAL_CLOSED', 'Negócio já encerrado.');
      if (!deal.packageId) throw new CommercialError('PACKAGE_REQUIRED', 'Escolha o pacote.', 'packageId');

      const clientId = await resolveClientTx(tx, orgId, deal.lead, input.client); // cria ou atualiza
      const contractId = await this.contracts.createInTx(tx, orgId, tenant.memberId, {
        newGroup: { eventKind: deal.kind, eventDate: ymd(deal.eventDate), bride: { clientId } },
        packageId: deal.packageId,
        discountAmount: deal.discountAmount?.toString() ?? null,
      });
      if (input.depositPaid) {
        await recordContractPaymentsTx(tx, orgId, tenant.memberId, contractId, input.depositLines, 'Sinal (Comercial)');
      }
      await markWonTx(tx, deal, { contractId, clientId });
      return { contractId, errors: [] };
    });
  } catch (e) {
    return this.fail(e); // ContractError/CommercialError -> UserError; a transação já foi revertida
  }
}
```

### Filtro de visibilidade (puro, testável)
```typescript
// apps/backend/src/commercial/commercial-access.ts
export const COMMERCIAL_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT'] as const;
export const isManagerRole = (r: string) => r === 'ADMIN' || r === 'MANAGER';

export function visibilityWhere(t: { roleName: string; memberId: string }) {
  if (isManagerRole(t.roleName)) return { deal: {}, lead: {} };
  return {
    deal: { assigneeMemberId: t.memberId },
    lead: {
      OR: [
        { createdBy: t.memberId },
        { deals: { some: { assigneeMemberId: t.memberId, deletedAt: null } } },
      ],
    },
  };
}
```

### Controller público (copiar o padrão do aceite do contrato)
```typescript
// Fonte: apps/backend/src/contracts/acceptance/public-contract.controller.ts
@Public()
@Controller('public/leads')
@UseGuards(ThrottlerGuard)
export class PublicLeadController {
  @Post(':orgId/:token')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(@Param('orgId') orgId: string, @Param('token') token: string, @Body() body: LeadFormBody) {
    return this.service.submit(orgId, token, body ?? {});
  }
}
```

## Estado da arte

| Antigo | Atual | Impacto |
|--------|-------|---------|
| Atimos: SLA em minutos por negócio (`sla_minutes`) | SLA em dias por etapa (D-15) | Calcular por etapa; sem coluna no negócio |
| Atimos: `xlsx`/`jspdf` no navegador | Exportação no servidor (`exceljs` + `pdfkit`) | Respeita permissão e `visibilityWhere` no servidor; sem dependências de browser |
| Atimos: widget com CORS `*` e service role | Página pública do SGS com token + throttle, sem service role | Isolamento de tenant por RLS, sem chave privilegiada |
| Push só de agendamento | Novo tipo `commercial.reminder` | `PushService.dispatch` ganha ramo próprio |

## Perguntas em aberto

1. **Debutante: quem é o lead?**
   - O que sabemos: no contrato de debutante, a "noiva" do grupo é a debutante e o contratante é `responsibleClientId` (`newGroup.responsibleClientId`/`newResponsible`). O lead do Comercial normalmente é a mãe/responsável (D-03 cita "debutante da irmã/filha").
   - O que falta: o CONTEXT não diz de quem é o nome da debutante. O modal de ganho precisa coletar.
   - Recomendação: no negócio `debutante`, guardar `beneficiary_name` (nome da debutante, opcional até o ganho). No ganho: lead = responsável/contratante; debutante = nova pessoa (`newClient` com o nome informado, telefone opcional) ou cliente existente. Para `noiva`, lead = noiva. Confirmar com a usuária no planejamento ou no modal de ganho.

2. **ATTENDANT não tem `contract.write`, mas o ganho cria contrato.**
   - O que sabemos: ATTENDANT tem `contract.read` e `contract.payment`; ADMIN/MANAGER têm `contract.write`. D-12 permite à atendente conduzir seus negócios até o fim.
   - O que falta: decisão sobre se a atendente pode marcar ganho (criar contrato rascunho).
   - Recomendação: permitir, protegido por `commercial.write` + visibilidade (o serviço chama o contrato internamente, não pelo resolver de contratos, então a permissão `contract.write` não é exigida). O resultado é só um rascunho; o sinal usa `contract.payment`, que ela já tem. Registrar a decisão no plano e comunicar à usuária. Alternativa: só ADMIN/MANAGER marcam ganho (atendente "solicita"), o que muda o fluxo.

3. **Leads de site/importação sem responsável.**
   - Recomendação: `assignee_member_id` anulável; sem responsável, só ADMIN/MANAGER veem e atribuem (D-13); formulário tem responsável padrão opcional. Avisar gerentes por push de novo lead de site? Não pedido; deixar fora.

4. **Reabrir negócio perdido / editar ganho.** Recomendação: perdido pode ser reaberto por ADMIN/MANAGER; ganho é imutável no Comercial (a edição acontece no contrato).

5. **Prazos padrão das etapas** (Novo/Contato/Proposta/Negociação). Sem valor nas decisões; sugerir 1/3/3/2 dias, configuráveis.

6. **Excluir lead/negócio:** D-13 diz que só ADMIN/MANAGER excluem. Recomendação: exclusão lógica (`deleted_at`) no uso normal; não criar `purge_*` agora, a menos que a usuária peça exclusão definitiva (LGPD pede capacidade de apagar dado pessoal de lead: prever pelo menos uma exclusão definitiva por ADMIN em plano posterior ou na mesma onda, via função SECURITY DEFINER como `purge_bridal_group`).

7. **Limite do corpo HTTP para importação.** Conferir `apps/backend/src/http/fastify-adapter.ts` (não lido). Se o limite for o padrão do Fastify (1 MB), a importação precisa ou de aumento localizado ou de limite de 700 KB de planilha.

## Disponibilidade do ambiente

| Dependência | Necessária para | Disponível | Versão | Alternativa |
|-------------|-----------------|------------|--------|-------------|
| Node | build/testes | ✓ | v26.9.0 local (engines pede >=22; CI usa 22) | — |
| PostgreSQL local | integração (`sgs_dev`) | ✓ | aceitando conexões (socket 5432) | — |
| Docker | compose local, staging | ✓ | containers `sgs_postgres`, `sgs_pgbouncer`, `sgs_valkey`, `sgs_stg_*` ativos | — |
| Valkey/Redis | BullMQ (tick, push) | ✓ | contêiner `sgs_valkey` | — |
| `exceljs` | importação e exportação | ✗ (não instalado) | 4.4.0 no npm | instalar; sem ele, CSV só por função própria (não recomendado) |
| FCM / VAPID | push real | configuração do ambiente (não verificada aqui) | — | `PushService` devolve `skipped: 'disabled'` sem credenciais; testes usam provedores falsos |

Sem dependências ausentes que bloqueiem a execução.

## Arquitetura de validação

> `workflow.nyquist_validation` está `true` em `.planning/config.json`.

### Infraestrutura de testes
| Propriedade | Valor |
|-------------|-------|
| Backend unitário | Jest (`apps/backend`, `testRegex .*\.spec\.ts$`, `pnpm --filter @sgs/backend test`) |
| Backend integração | Jest `jest-integration.config.ts` em `test/integration/*.spec.ts`, `--runInBand`, Postgres real; `adminPrisma` (DIRECT_URL, BYPASSRLS) e `appPrisma` (DATABASE_URL, sujeito a RLS); helpers `phase3/phase4-fixtures`, `gqlAs` |
| Frontend | Vitest 2 (`pnpm --filter @sgs/frontend test`), testes em `features/*/__tests__` e `components/layout/__tests__` |
| E2E | Playwright em `apps/e2e` (`pnpm --filter @sgs/e2e test:e2e`), contra backend e frontend reais, helpers em `apps/e2e/support` |
| Comando rápido | `pnpm --filter @sgs/backend exec jest src/commercial` e `pnpm --filter @sgs/frontend exec vitest run src/features/commercial` |
| Suíte completa (gate) | lint (`pnpm -r --if-present lint`) + `pnpm -r typecheck` + `pnpm --filter @sgs/backend test` + `pnpm --filter @sgs/backend test:integration` + `pnpm --filter @sgs/frontend test` + Playwright |

### Requisitos → mapa de testes
| Req | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|-----|---------------|------|----------------------|-----------------|
| COM-01 | normalização de telefone e detecção de duplicidade (máscara, +55, 9º dígito) | unit | `jest src/commercial/commercial-phone.spec.ts` | ❌ Wave 0 |
| COM-01 | aviso e vínculo a cliente existente; lead não aparece em `clients` | integração | `jest-integration phase9-leads` | ❌ Wave 0 |
| COM-02 | importação: prévia, linhas inválidas, duplicadas, limite de linhas | unit + integração | `jest src/commercial/lead-import.spec.ts`, `phase9-import` | ❌ Wave 0 |
| COM-03 | formulário público: token inválido/inativo (404), throttle, honeypot, consentimento, RLS | integração | `jest-integration phase9-public-form` (modelo: `phase4-public-ratelimit`, `phase4-public-acceptance`) | ❌ Wave 0 |
| COM-04/05 | etapas padrão, backfill, regras de ordem/exclusão, Ganho/Perdido de sistema | unit + integração | `phase9-stages` | ❌ Wave 0 |
| COM-05 | SLA por etapa (limites, sem interação, sem prazo) | unit | `jest src/commercial/commercial-sla.spec.ts` | ❌ Wave 0 |
| COM-06 | kanban: mover otimista, reverter em erro, menu "Mover para…" no celular | vitest | `vitest run features/commercial/__tests__/pipeline-board.test.tsx` | ❌ Wave 0 |
| COM-07 | interação atualiza `last_interaction_at`; "próximo contato em" cria lembrete | integração | `phase9-interactions` | ❌ Wave 0 |
| COM-08 | ganho atômico (cliente nova/existente, contrato rascunho, sinal no caixa), rollback em falha, concorrência, debutante | integração | `phase9-win-deal` (modelo: `phase4-contract-payments`, `phase4-contracts-core`) | ❌ Wave 0 |
| COM-09 | perdido: motivo obrigatório da lista, texto livre, reabrir | unit + integração | `phase9-lose-deal` | ❌ Wave 0 |
| COM-10 | matriz papel × operação; ATTENDANT A não vê/edita nada de B (lista, id, contagens, exportação); PROFESSIONAL sempre FORBIDDEN | integração | `phase9-rls-rbac` (modelo: `phase4-rls-rbac`, `phase3-rls-rbac`) | ❌ Wave 0 |
| COM-10 | `visibilityWhere` puro | unit | `jest src/commercial/commercial-access.spec.ts` | ❌ Wave 0 |
| COM-10 | isolamento entre organizações (RLS) em todas as tabelas `commercial_*` com `appPrisma`; FORCE RLS ativo | integração | `phase9-rls-rbac` | ❌ Wave 0 |
| COM-11 | `claimDueReminders` idempotente (duas execuções ⇒ um aviso), reagendar zera `notified_at`, alvos do push (responsável + gerentes; sem negócio: criador + gerentes), mensagem | unit + integração | `jest src/push/push-commercial.spec.ts`, `phase9-reminders` | ❌ Wave 0 |
| COM-11 | allowlist de rota do push aceita `/comercial/lembretes` e continua rejeitando `https://evil.com`, `//evil.com`, `/agenda/../admin`, `/financeiro` | vitest | `vitest run src/__tests__/service-worker.test.ts` (estender) | ✅ existe, estender |
| COM-12 | painel/relatório: conversão, valor em negociação, filtros; export xlsx/pdf (abre e tem as linhas); `commercial.manage` obrigatório; injeção de fórmula escapada | integração + unit | `phase9-reports` | ❌ Wave 0 |
| COM-10 (front) | menu por papel: PROFESSIONAL sem grupo; ATTENDANT sem Relatórios; ADMIN/MANAGER com tudo; flag `comercial` | vitest | `vitest run components/layout/__tests__ config/__tests__/features.test.ts` | ✅ existem, estender |
| Fim a fim | cadastrar lead → negócio → arrastar etapas → registrar interação com próximo contato → marcar ganho (com sinal) → cair no contrato rascunho; e perdido com motivo; atendente só vê o dela | e2e | `playwright test comercial-*.spec.ts` (modelo: `noivas-contrato.spec.ts`, `debutante-contrato.spec.ts`) | ❌ Wave 0 |

### Taxa de amostragem
- **Por commit de tarefa:** o comando rápido do módulo tocado (jest do módulo ou vitest da feature).
- **Por onda:** `test` + `test:integration` do backend (restrito a `phase9-*` na onda; completo antes de fechar) + vitest do frontend.
- **Gate de fase:** lint, typecheck, jest unitário, integração completa, vitest, Playwright; tudo verde antes de `/gsd:verify-work`.

### Lacunas da Wave 0
- [ ] `apps/backend/test/integration/helpers/phase9-fixtures.ts` e `phase9-cleanup.ts` (cria o "mundo" com `createPhase4World` + atendentes A/B + profissional puro + pacote de noiva e de debutante; apaga as linhas `commercial_*` **antes** de `destroyPhase4World`, padrão de `phase5-cleanup.ts`)
- [ ] specs unitários puros: `commercial-phone`, `commercial-sla`, `commercial-access`
- [ ] `phase9-rls-rbac.e2e.spec.ts` (isolamento + matriz de papéis) criado junto da migração
- [ ] mocks/fixtures do frontend (`features/commercial/__tests__/commercial-fixtures.ts`)
- [ ] helper E2E `apps/e2e/support/phase9.ts` (semear etapas, leads, atendente, token do formulário)
- [ ] flags de ambiente de teste em `test/integration/setup.ts` (`COMMERCIAL_REMINDERS_SCHEDULER ??= 'false'`)
- [ ] dependência `exceljs` instalada antes dos testes de importação/exportação

## Ordem de ondas sugerida (insumo para o planner)

1. **Dados e acesso:** migração (tabelas, RLS, backfill de etapas, permissões), models Prisma, `permissions.catalog.ts`, `commercial-access.ts` + testes de RLS/RBAC (Wave 0).
2. **Núcleo backend:** etapas, leads (com duplicidade), negócios, interações; SDL `commercial.graphql`.
3. **Ganho/perdido:** `createInTx`, `createClientTx`/`updateClientTx`, `winDeal`, `loseDeal`.
4. **Lembretes e push:** serviço, tick, ramo `commercial.reminder`, allowlist de rota (quatro cópias).
5. **Painel, relatórios, exportação.**
6. **Entradas externas:** formulário público (controller + página), importação.
7. **Frontend base:** flag, menu por papel, guard de rota, API `gql`, páginas Leads e detalhe.
8. **Frontend pipeline:** kanban, modais de ganho/perdido, configuração de etapas, lembretes, painel, relatórios.
9. **E2E, nginx (iframe do formulário), gate completo e deploy no staging** (build de worktree limpo se houver trabalho alheio).

## Fontes

### Primárias (confiança ALTA: código lido no repositório)
- `/root/sgs/.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md`, `09-DISCUSSION-LOG.md`, `/root/sgs/CLAUDE.md`, `.planning/config.json`
- Backend SGS: `apps/backend/src/contracts/contracts.service.ts` (`createTx`, `CreateContractInput`, `NewContractGroupInput`), `contracts/payments/contract-payments.ts` (`recordContractPaymentsTx`, `PAYABLE`), `contracts/acceptance/public-contract.controller.ts`, `contracts/alerts/contract-alerts.scheduler.ts` e `contract-alerts.service.ts` (`job_list_active_orgs`), `clients/clients.service.ts`, `push/*` (`push.service.ts`, `push-events.service.ts`, `push-messages.ts`, `push.types.ts`, `resolve-push-targets.ts`, `push.module.ts`), `authz/*` (`permissions.catalog.ts`, `permission.guard.ts`, `require-role.decorator.ts`, `current-tenant.decorator.ts`), `database/tenant-context.service.ts`, `queue/queue.module.ts`, `graphql/schema/contracts.graphql`, `bridal.graphql`, `contract-payments.graphql`, `clients.graphql`
- Migrações: `20261103000000_phase4_bridal_contracts`, `20261114000000_bridal_timeline`, `20261121000000_device_tokens_webpush`, `20261112000000_hard_delete_member_bridal`
- Frontend SGS: `components/layout/menu-config.ts`, `config/features.ts`, `router.tsx`, `components/ProtectedRoute.tsx`, `features/bridal/bridal-permissions.ts`, `features/bridal/api/contracts.api.ts`, `infrastructure/native/push-route.ts`, `public/sw.js`, `__tests__/service-worker.test.ts`, `package.json`
- Testes: `apps/backend/jest-integration.config.ts`, `test/integration/setup.ts`, `helpers/phase4-fixtures.ts`, `phase4-rls-rbac.e2e.spec.ts`, `apps/e2e/tests/noivas-contrato.spec.ts`, `.github/workflows/ci.yml`
- Atimos: `/root/atmo-crm/atmos-crm/supabase/definitions.sql`, `migrations/20260327_017_add_widget_and_source.sql`, `src/app/api/widget/leads/route.ts`, `src/components/pipeline/*`, `src/components/dashboard/*`, `src/app/relatorios/page.tsx`, `package.json`

### Secundárias (confiança MÉDIA)
- `npm view exceljs version` → 4.4.0 (última publicação 2024-12-20); `npm view @dnd-kit/core version` → 6.3.1 (igual ao instalado); `npm view papaparse version` → 5.7.1 (não recomendado). Estado do `xlsx`/SheetJS no npm e suas vulnerabilidades vêm de conhecimento prévio, **não** reverificado nesta sessão (LOW; só justifica evitar a dependência, não é requisito).

### Não verificado
- `apps/backend/src/http/fastify-adapter.ts` (limite de corpo), `purge_member`/`purge_*` por completo, `infra/nginx` quanto a `frame-ancestors`, versão exata de `lucide-react` e existência dos ícones sugeridos, e se `contracts.service.ts::create` usa timeout de transação especial.

## Metadados

**Confiança:**
- Stack padrão: ALTA para o que já está no repositório; MÉDIA para `exceljs`.
- Arquitetura: ALTA (padrões copiados de módulos existentes).
- Armadilhas: ALTA (derivadas do código); itens de "Não verificado" ficam como verificação obrigatória do planner.

**Data da pesquisa:** 2026-11-18
**Válido até:** 2026-12-18 (o código do SGS muda rápido; reconferir `contracts.service.ts` e `push.service.ts` se outras fases mexerem neles)

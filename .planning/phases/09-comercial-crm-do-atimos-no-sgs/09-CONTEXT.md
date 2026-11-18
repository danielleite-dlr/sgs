# Phase 9: Comercial - CRM do Atimos no SGS - Context

**Gathered:** 2026-11-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Trazer para o SGS o acompanhamento comercial (funil de vendas) do Atimos CRM, **só para fechamento de contrato de noivas e debutantes**. Entrega um menu **Comercial** com os submenus **Painel comercial, Leads, Pipeline, Lembretes e Relatórios**, mais a configuração das etapas do funil. O fim do funil é o negócio **ganho**, que cria ou reaproveita a cliente do SGS e abre o **contrato rascunho** com o pacote, usando o fluxo de contratos que já existe (fases 4/04.1). Atendimento social e agenda não entram no Comercial.

Referência funcional: Atimos CRM em `/root/atmo-crm/atmos-crm` (Next.js + Supabase). É para portar o comportamento, não o código: o SGS é NestJS + GraphQL schema-first + Prisma + RLS, com React/Vite/shadcn.

</domain>

<decisions>
## Implementation Decisions

### Lead x cliente do SGS
- **D-01:** O lead é um **cadastro separado** que vive só no Comercial e não aparece em Clientes. Só vira cliente do SGS no ganho.
- **D-02:** Se o telefone ou e-mail do lead já for de uma cliente do SGS, a tela **avisa** ("já é cliente: Fulana") e **liga o lead a essa cliente**. No ganho, usa a cliente existente em vez de criar outra.
- **D-03:** Um lead pode ter **vários negócios ao mesmo tempo** (ex.: noiva e debutante da irmã), com um histórico de interações único. Cada negócio anda no funil de forma independente.
- **D-04:** Os leads chegam por três caminhos: **cadastro manual**, **importação de planilha** (Excel/CSV, origem "import") e **formulário no site** (como o widget do Atimos, origem "site", público e por token da organização).

### Negócio
- **D-05:** O negócio só pode ser do tipo **Noiva** ou **Debutante**. Não existe tipo Social: o Comercial acompanha só fechamento de contrato.
- **D-06:** Campos do negócio: lead, etapa, tipo, **data do evento**, **pacote do catálogo do SGS** (o preço vem do pacote), **desconto** e valor final, **responsável (atendente)**, **origem** (Instagram, indicação, site, WhatsApp, importação, manual…), **local** e **observações**.
- **D-07:** As etapas do funil são **configuráveis por salão**. As padrão são Novo, Contato, Proposta, Negociação, Ganho e Perdido. Nome, cor, ordem e **prazo em dias** (D-15) podem ser editados. Ganho e Perdido são etapas de sistema.

### Ganho e perdido
- **D-08:** Marcar como **ganho** abre uma confirmação com os dados da cliente, para completar o que o contrato precisa (CPF, endereço etc.), e pergunta **se o sinal já foi pago**. Se foi, o pagamento é lançado no contrato e no caixa, como nos pagamentos de contrato que já existem.
- **D-09:** O ganho cria a cliente, ou usa a cliente ligada (D-02), e cria o **grupo e o contrato rascunho** com o pacote, o tipo e a data do evento. O caminho já existe: `createContract` com `newGroup`. Depois a tela **abre o contrato** criado.
- **D-10:** O **perdido** pede o motivo numa **lista fixa** (preço, data indisponível, fechou com outra, sem resposta, desistiu, outro) e num **campo de texto livre**. O motivo aparece nos relatórios.

### Quem vê o quê
- **D-11:** Os papéis do SGS são ADMIN, MANAGER, ATTENDANT e PROFESSIONAL, e a marca `isProfessional` é separada. **Acessam o Comercial os papéis ADMIN, MANAGER e ATTENDANT**, com ou sem `isProfessional`. O papel PROFESSIONAL não vê o menu nem acessa a API. Regra da usuária: "só profissional não usa; profissional + admin/gerente/atendente usa".
- **D-12:** ADMIN e MANAGER veem e editam **todos** os leads e negócios. **ATTENDANT vê só os negócios em que é o responsável**, e os leads desses negócios ou cadastrados por ela. A restrição tem de valer na API, não só na tela.
- **D-13:** Só ADMIN e MANAGER **configuram etapas**, **excluem** lead ou negócio, **trocam o responsável** e veem **Relatórios**.
- **D-14:** O responsável de um negócio é sempre alguém que usa o Comercial (ADMIN, MANAGER ou ATTENDANT).

### Lembretes e avisos
- **D-15:** Cada etapa tem um **prazo em dias**. Se o negócio passar do prazo **sem interação**, o card fica em alerta (vermelho) e entra no "follow-up pendente" do Painel. É o SLA do Atimos, só que por etapa.
- **D-16:** O lembrete aparece na **lista de Lembretes e no Painel** (vencidos e do dia em destaque) e manda **push** no celular, Android (FCM) e iPhone (Web Push), na hora marcada. O push vai para o **responsável pelo negócio e para os gerentes e admins**. Se o lembrete não tiver negócio, vai para quem o criou e para os gerentes e admins.
- **D-17:** Ao registrar uma **interação** (ligação, WhatsApp, e-mail, reunião, visita, outro), o formulário tem o campo opcional **"próximo contato em"**, que cria o lembrete junto.

### Claude's Discretion
- Indicadores do **Painel comercial**: seguir o Atimos (números do dia, follow-ups pendentes, últimas interações, status do funil) mais conversão e valor em negociação.
- **Relatórios**: seguir o Atimos, com filtros por responsável, etapa, status e período e exportação para Excel e PDF. Incluir motivos de perda (D-10) e origem.
- Visual do kanban: arrastar no computador; no celular, colunas com rolagem lateral ou troca de etapa pelo menu do card. Seguir o padrão visual Gestor Beauty da fase 6.
- Desenho do formulário público do site: anti-spam, limite de requisições, consentimento LGPD.
- Modelagem: tabelas novas com RLS por organização (`commercial_*` ou `leads`/`deals`…). O nome fica a critério do planner.
- Fila e agendamento do push de lembretes (BullMQ, como o push existente).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Referência funcional (Atimos CRM)
- `/root/atmo-crm/atmos-crm/supabase/definitions.sql`: tabelas clients (lead), pipeline_stages, deals, interactions e reminders
- `/root/atmo-crm/atmos-crm/supabase/migrations/20260327_017_add_widget_and_source.sql`: origem do negócio e widget/formulário público
- `/root/atmo-crm/atmos-crm/supabase/migrations/20260403_019_add_legacy_clients.sql`: importação de leads antigos
- `/root/atmo-crm/atmos-crm/src/app/dashboard/page.tsx` e `src/components/dashboard/*`: indicadores do painel
- `/root/atmo-crm/atmos-crm/src/app/pipeline/page.tsx` e `src/components/pipeline/*` (DealCard, DealDetailsSheet, WonDealModal, LostDealModal, PackageDiscountSelector, StageColumn, PipelineMetrics): kanban, ganho e perdido
- `/root/atmo-crm/atmos-crm/src/app/clientes/*`: leads e histórico de interações
- `/root/atmo-crm/atmos-crm/src/app/lembretes/page.tsx`: lembretes
- `/root/atmo-crm/atmos-crm/src/app/relatorios/page.tsx`: relatórios com exportação para Excel e PDF
- `/root/atmo-crm/atmos-crm/src/components/settings/PipelineSettings.tsx` e `WidgetSettings.tsx`: configuração de etapas e do formulário
- `/root/atmo-crm/atmos-crm/docs/analise-tecnica-atmos-crm.md`, `/root/atmo-crm/specs.md`, `/root/atmo-crm/PRD-Dados-Atmos-CRM.md`, `/root/atmo-crm/guia-do-usuario-atmos-crm.md`: especificação e guia do Atimos

### Decisões anteriores do SGS que valem aqui
- `.planning/phases/04-bridal-contracts/04-CONTEXT.md`: grupo da noiva, contrato e pagamentos
- `.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-CONTEXT.md`: Noiva/Debutante, dados da contratante, sinal, desconto e extras
- `.planning/phases/08-app-iphone-gestor-beauty-instalavel-com-notificacoes/08-CONTEXT.md`: Web Push e mesmo texto do Android

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/frontend/src/components/layout/menu-config.ts`: menu hierárquico (até 3 níveis), que também alimenta a gaveta do celular e a busca global. O grupo "Comercial" entra aqui e `isPathEnabled` (`apps/frontend/src/config/features.ts`) controla a exibição.
- `apps/backend/src/contracts/` (`contracts.service.ts`, `payments/`) e `apps/backend/src/graphql/schema/contracts.graphql` e `contract-payments.graphql`: `createContract` com `newGroup` e lançamento de pagamento com caixa.
- `apps/backend/src/catalog/` e `catalog.graphql`: model `Package`, com preço e sinal.
- `apps/backend/src/clients/` e `clients.graphql`: model `Client` (fullName, phone, email, cpf, address…). Para o aviso de duplicado (D-02), buscar por telefone e e-mail.
- `apps/backend/src/push/` (`push-events.service.ts`, `resolve-push-targets.ts`, `push-messages.ts`, `push.processor.ts`, FCM e Web Push): envio para Android e iPhone já pronto.
- `apps/backend/src/authz/permissions.catalog.ts` e `decorators/require-role.decorator.ts`: papéis ADMIN, MANAGER, ATTENDANT e PROFESSIONAL.
- Model `Member` (`roleId`, `isProfessional`) em `apps/backend/prisma/schema.prisma`.

### Established Patterns
- GraphQL schema-first: um `.graphql` por domínio em `apps/backend/src/graphql/schema/`.
- RLS forçada por `app.current_organization` em todas as tabelas. Exclusão definitiva por funções SECURITY DEFINER (`purge_*`), quando aplicável.
- Frontend organizado por `apps/frontend/src/features/<domínio>` e páginas em `src/pages`. Visual Gestor Beauty (fase 6) e arquivos formatados à mão (aspas simples, cerca de 100 colunas).
- Gate antes de commit: lint, tsc, jest unitário e de integração, vitest e E2E Playwright (ver memória do workflow).

### Integration Points
- Menu: novo grupo `comercial` em `menu-config.ts`, oculto para o papel PROFESSIONAL.
- Contratos: o ganho chama o serviço de contratos (não duplicar lógica).
- Push: novo tipo de evento "lembrete comercial" em `push-events.service.ts` e `push-messages.ts`, com um job agendado na fila.
- Rota pública para o formulário do site (sem login, com token da organização e limite de requisições).

</code_context>

<specifics>
## Specific Ideas

- Pacotes reais em uso, para os dados de teste: Experience, Essence, Glam, Elegance, Decidida, Essencial (noivas), Spa dos 15 e Ouro Rosa (debutantes).
- Exemplo da usuária para D-03: uma noiva que também traz a debutante da irmã ou da filha.
- O Atimos já guarda `package_type`, `event_date`, `sla_minutes`, `loss_reason`, `source` e `status` (open/won/lost) no negócio. Os mesmos conceitos valem aqui.

</specifics>

<deferred>
## Deferred Ideas

- Extensão do Chrome para WhatsApp do Atimos (`/root/atmo-crm/whatsapp-extension`): captura de lead pelo WhatsApp Web. Não foi pedida; seria fase própria, ligada ao backlog 999.1.
- Atendimento social pelo Comercial: descartado pela usuária, porque o Comercial é só noiva e debutante.
- Restante do 08-08 (notificação, toque e logout no iPhone; Android intacto) continua pendente. O app nativo iOS vem depois desta fase.

</deferred>

---

*Phase: 09-comercial-crm-do-atimos-no-sgs*
*Context gathered: 2026-11-18*

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 06-08-despesas-fixas-PLAN.md
last_updated: "2026-11-12T03:17:58.797Z"
last_activity: "2026-11-12 - Completed 06-08: Despesas fixas no layout Gestor Beauty (CI 43146652884 verde)"
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 92
  completed_plans: 91
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02)

**Core value:** Profissional do beleza consegue agendar, atender, cobrar e comunicar com cliente em um único fluxo — sem sair da plataforma.
**Current focus:** Phase 05 — uso-no-dia-a-dia

## Current Position

Phase: 06
Plan: 06-09 (próximo; 06-01 a 06-08, 06-10 e 06-12 concluídos, Despesas fixas no staging)
Status: Executing
Last activity: 2026-11-12 - Completed 06-08: Despesas fixas no layout Gestor Beauty (CI 43146652884 verde)

Progress: [██████████] 100% (Phase 1 of 5)

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~90 min
- Total execution time: ~3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1: Foundation | 2 | ~180 min | ~90 min |

**Recent Trend:**

- Last 5 plans: ~90 min avg
- Trend: baseline established

*Updated after each plan completion*
| Phase 01-foundation P03 | 120 | 2 tasks | 33 files |
| Phase 01-foundation P04 | 527677min | 3 tasks | 22 files |
| Phase 01-foundation P05 | 68 | 2 tasks | 17 files |
| Phase 01-foundation P06 | 90 | 3 tasks | 24 files |
| Phase 01-foundation P07 | 45 | 2 tasks | 11 files |
| Phase 02-core-domain P01 | 14 | 3 tasks | 17 files |
| Phase 02-core-domain P02 | 120 | 3 tasks | 33 files |
| Phase 02-core-domain P05 | 45 | 2 tasks | 19 files |
| Phase 02-core-domain P04 | 6 | 3 tasks | 10 files |
| Phase 02-core-domain P03 | 55 | 3 tasks | 14 files |
| Phase 02-core-domain P08 | 45 | 3 tasks | 15 files |
| Phase 02-core-domain P06 | 75 | 3 tasks | 11 files |
| Phase 02-core-domain P07 | 23 | 3 tasks | 22 files |
| Phase 03 P01 | 45min | 3 tasks | 16 files |
| Phase 03 P02 | 20min | 3 tasks | 16 files |
| Phase 03 P03 | 50min | 3 tasks | 17 files |
| Phase 03 P04 | 60min | 3 tasks | 13 files |
| Phase 03 P05 | 50min | 2 tasks | 10 files |
| Phase 03 P06 | 35min | 2 tasks | 7 files |
| Phase 03 P07 | 75min | 3 tasks | 13 files |
| Phase 03 P08 | 45min | 3 tasks | 13 files |
| Phase 03 P09 | 45min | 3 tasks | 16 files |
| Phase 03 P10 | 75min | 3 tasks | 12 files |
| Phase 03 P11 | 110min | 3 tasks | 18 files |
| Phase 05 P01 | 75min | 2 tasks | 7 files |
| Phase 05 P03 | 20min | 2 tasks | 7 files |
| Phase 05 P04 | 25min | 2 tasks | 7 files |
| Phase 05 P07 | ~45min | 2 tasks | 2 files |
| Phase 05 P09 | ~2h | 3 tasks | 9 files |
| Phase 05 P10 | ~75min | 3 tasks | 9 files |
| Phase 05 P11 | 75min | 3 tasks | 14 files |
| Phase 05 P12 | 70min | 3 tasks | 7 files |
| Phase 05 P13 | ~60min | 3 tasks | 9 files |
| Phase 05 P14 | ~90min | 3 tasks | 12 files |
| Phase 06 P06 | 75min | 2 tasks | 9 files |
| Phase 06 P07 | 70min | 2 tasks | 4 files |
| Phase 06 P08 | 80min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-Phase 1: PgBouncer é obrigatório em transaction-mode — sem ele RLS vaza entre conexões de pool
- Pre-Phase 1: Iniciar verificação WABA (WhatsApp Business Account) com Meta imediatamente — processo demora 1–4 semanas, fora do controle da engenharia
- Pre-Phase 1: Decidir Pagar.me vs Stripe Connect antes de iniciar Phase 3 — design da interface PaymentGateway depende do modelo
- Plan 01-01: Valkey 8 chosen over Redis — MIT license, binary compatible with Redis 7.2
- Plan 01-01: Fastify adapter for NestJS — better throughput than Express
- Plan 01-01: AppConfigService typed wrapper pattern for env access across all NestJS modules
- Plan 01-01: Schema-first GraphQL SDL (typePaths pattern) — matches PRD specification
- Plan 01-02: Prisma 6 with directUrl for migrations (sgs_migrator/BYPASSRLS) + url for runtime (sgs_app via PgBouncer)
- Plan 01-02: 4 system roles — ADMIN, MANAGER, ATTENDANT, PROFESSIONAL with organization_id=NULL and is_system=true
- Plan 01-02: nullif(current_setting('app.current_organization', true), '')::uuid in all RLS policies — safe for RESET+PgBouncer empty-string edge case
- Plan 01-02: TenantContextService.$transaction wrapper with SET LOCAL for guaranteed isolation and auto-reset on commit
- [Phase 01-foundation]: Plan 01-03: Tailwind CSS 3 (not v4) for shadcn/ui compatibility per CLAUDE.md constraint
- [Phase 01-foundation]: Plan 01-03: Apollo Link chain is errorLink → authLink → httpLink; setContext used for auth header injection
- [Phase 01-foundation]: Plan 01-03: Auth store persists full session shape (accessToken, refreshToken, userId, memberId, organizationId, roleName, permissions) as sgs-auth in localStorage
- [Phase 01-foundation]: Auth errors returned as errors[] in payload (GraphQL errors-as-data), not thrown exceptions
- [Phase 01-foundation]: prisma.$transaction for signup (not TenantContextService) — no org context exists yet at signup time
- [Phase 01-foundation]: Refresh token reuse detection revokes entire family — compromise assumption
- [Phase 01-foundation]: auth.graphql uses extend type Query/Mutation — base types in root.graphql
- [Phase 01-foundation]: Permission check queries role_permissions DB table (not JWT payload) — permissions authoritative in DB, JWT carries only roleName
- [Phase 01-foundation]: Relaxed SELECT USING(true) on member_invitations — token_hash is the secret, application enforces WHERE token_hash = hash, modify ops remain tenant-scoped
- [Phase 01-foundation]: AuthService.issueSession refactored private→public for InvitationService.accept reuse without duplicating token-issuing logic
- [Phase 01-foundation]: Generic 'Aceitar convite' heading used for InvitationPage — AcceptInvitation mutation does not return orgName/inviterName; deferred to Phase 2 schema extension
- [Phase 01-foundation]: auth.api.ts uses manual gql tagged templates (not codegen) — codegen integration deferred to plan 07 (CI integration)
- [Phase 01-foundation]: PgBouncer AUTH_TYPE=trust chosen as dev workaround — scram-sha-256 incompatible with PG16 pool mode without auth_query; backend connects direct to postgres for dev; fix in plan 07
- [Phase 01-foundation]: sgs_app temporarily granted BYPASSRLS for dev — signup creates org without tenant context; fix in plan 07 via SECURITY DEFINER function or role split
- [Phase 01-foundation]: auth.api.ts uses manual gql tagged templates (not codegen) — codegen integration deferred to plan 07
- [Phase 01-foundation]: EMAIL_ADAPTER Symbol token (not string) for type-safe DI override — TestEmailAdapter used in integration tests via .overrideProvider
- [Phase 01-foundation]: full-auth-flow relogins after TOKEN_REUSE_DETECTED family revocation — both old and new tokens are invalid after family revoke
- [Phase 01-foundation]: frontend-codegen CI job asserts src/gql/graphql.ts (client-preset output dir), not src/types/graphql.ts
- [Phase 02-core-domain]: One consolidated Phase 2 migration owns all 11 new tables + members.seniority_tier — Wave 2 plans only add feature code to pre-staged modules
- [Phase 02-core-domain]: PackageService junction uses EXISTS subquery on packages for tenant isolation (no organization_id column on junction table)
- [Phase 02-core-domain]: commission_rules.value uses DECIMAL(12,4) for extra precision on percentage rates
- [Phase 02-core-domain]: AppShell uses Outlet pattern — layout route group with no path, ProtectedRoute wraps AppShell as element
- [Phase 02-core-domain]: SidebarNav Catálogo uses Collapsible defaultOpen=true; all nav labels from i18n t() — zero hardcoded strings
- [Phase 02-core-domain]: CPF stored as digits-only via normalizeCpf for consistent lookup regardless of input format
- [Phase 02-core-domain]: Member type owned by identity.graphql as single SDL source-of-truth for cross-SDL cross-module reference
- [Phase 02-core-domain]: clientHistory returns [] Phase 2 stub with Phase 3 aggregation slot reserved in ClientsService
- [Phase 02-core-domain]: adjustStock creates notifications inline within same Prisma tx rather than via NotificationsService — ensures atomicity between stock update and notification creation
- [Phase 02-core-domain]: stock_low notification is org-wide (memberId=null) — any member with NOTIFICATION_READ sees it; member-specific notifications reserved for future
- [Phase 02-core-domain]: integer-cents arithmetic for individualSum computation in packages (avoids IEEE-754 float issues)
- [Phase 02-core-domain]: categories.softDelete blocks on both active children AND active services — prevents orphaned service category references
- [Phase 02-core-domain]: CPF optional; duplicate alert warns but doesn't block save (D-22)
- [Phase 02-core-domain]: ClientHistoryTab shows disabled filters (not hidden) per D-23 — Phase 3 will activate
- [Phase 02-core-domain]: /clientes/novo ordered before /clientes/:id in router to prevent React Router collision
- [Phase 02-core-domain]: Plan 06: gql tagged templates used in catalog API (not codegen client-preset) — consistent with auth.api.ts established pattern, codegen deferred to CI plan
- [Phase 02-core-domain]: Plan 06: ConfirmSoftDeleteDialog accepts ReactNode trigger with e.preventDefault on onSelect to prevent DropdownMenu closing before AlertDialog opens
- [Phase 02-core-domain]: AdjustStockDialog uses cache.evict pattern (not hardcoded refetchQueries variables) to avoid variable-mismatch with ProdutosPage's lowStockOnly state
- [Phase 02-core-domain]: AppShell self-fetches lowStockCount with pollInterval 60s — removed prop-based approach since router passes AppShell with no props
- [Phase 02-core-domain]: EntityCombobox is generic Popover+Command single-select reused across member/service/product pickers in CommissionRuleForm
- [Phase quick]: Quick-260928-vk2: jq -s 'flatten | ...' (slurp+flatten) e' o padrao para parsing de docker compose ps --format json em CI, tolerante a JSON Lines e array
- [Phase 02.1-equipe-e-profissionais-cadastro-completo-de-profissionais]: Backend wave (members-lifecycle): member_invitations gained is_professional/seniority_tier columns (Member untouched); deactivate blocks on future appointments only, commission rules inform via activeCommissionRuleCount; fixed pre-existing RLS bug in InvitationResolver.invite (unscoped organization lookup)
- [Phase 03]: Plan 03-01: ledgers append-only via REVOKE UPDATE/DELETE para sgs_app (sem trigger); exclusion constraint de appointments cobre scheduled/confirmed/in_progress/completed
- [Phase 03]: react-is forcado para ^19 via pnpm.overrides (Recharts + React 19)
- [Phase 03]: 23P01 via ORM chega como PrismaClientUnknownRequestError; isPgError inspeciona a mensagem
- [Phase 03]: Cancelar agendamento em comanda aberta remove itens do agendamento e cancela a comanda se nada sobrar
- [Phase 03]: 03-04: item de pacote guarda list_unit_price (preço cheio, base da comissão) e unit_price rateado; ledgers só no fechamento
- [Phase 03]: 03-04: migration remove chk_clients_contact para permitir walk-in só com nome (D-06); regra de contato segue no ClientsService
- [Phase 03-05]: Ajuste manual de crédito não gera cash_movements; dashboard: Faturado por closed_at local, Recebido por occurred_at (D-22)
- [Phase 03]: createAppointment delega a createVisitTx: toda criação de agendamento abre comanda; sinal = crédito + deposit_in + deposit_amount no 1º agendamento
- [Phase 03]: 03-07: fechamento/reabertura atômicos; comissão sobre preço cheio (D-23), sem regra = 0 + no_rule (D-24); reabertura só por reversões append-only
- [Phase 03]: 03-08: revert otimista sem escrever no cache (payload com appointment null); sem restrictToFirstScrollableAncestor, faixa 07h-22h validada no onDragEnd
- [Phase 03]: Plano 09: defaultPeriod/PeriodValue em lib/period-value.ts (lint react-refresh); flag financeiroCreditoCliente criada e ligada; FIN-01 fechado, FIN-02 e POS-02 aguardam UI de comanda (03-11)
- [Phase 03]: 03-10: VisitPackagesQuery local em appointments.api.ts (PackagesQuery do catálogo não traz duração do serviço); com pacote as linhas ficam fixas
- [Phase 03]: 03-10: link Abrir comanda só com comandaId && isPathEnabled('/comanda'); código sempre visível em appointment-comanda-code
- [Phase 03]: 03-11: flag comanda ligada com mock removido; PaymentPanel usa computePaymentSummary e só inclui a linha digitada no preview (dirty)
- [Phase 05]: Auditoria 05-01: credencial só em /root/sgs/.env.audit; usuário auditoria.ux@sgs.invalid a desativar no 05-20
- [Phase 05]: 05-04: comissão estimada para todos os agendamentos da janela (inclusive de contrato); entrada só sem contrato
- [Phase 05]: UX-01: cn() registra text-label/body/heading/display como font-size no tailwind-merge (causa raiz: texto escuro em botão sm)
- [Phase 05]: 05-10: avatares da Agenda no celular com 44 px e nome curto; formulário de agendamento em tela cheia no celular; causa raiz p-lg/p-0 no cn() adiada para aprovação
- [Phase 05]: 05-11: lista de comandas estreita era o max-w-[400px] do Card base; corrigido só na lista, causa em deferred-items
- [Phase 05]: 05-11: 'Fechar comanda' pronto mantém cor cheia enquanto salva; bloqueado sempre mostra o motivo
- [Phase 05]: 05-12: o aviso de <li> dentro de <li> (UX-10) vinha da trilha do PageHeader, não do menu lateral; o separador virou <span> com o mesmo visual
- [Phase 05]: 05-12: na comanda a ordem no DOM é Cliente, Itens, Adicionar, Pagamento; no computador o grid mantém o layout de três colunas
- [Phase 05]: 05-13: texto do contrato com negrito via ContractTextView (mesma regra do aceite público e do PDF); detalhe do grupo com status único e legenda de rascunho
- [Phase 05]: 05-14: contrato no celular em cartões (tabelas só a partir de md); "Completar dados da contratante" em diálogo único; aviso de pendências segue junto de "Gerar link de aceite" (é o que o gate D-09 bloqueia)
- [Phase 05]: 05-15: lista de clientes com nome em link, cartões no celular (com paginação própria) e colunas E-mail/CPF ocultas quando vazias; nome da cliente exibido com toDisplayName na lista, ficha, comanda, financeiro e contratos (só exibição)
- [Phase 05]: 05-16: tipos de lançamento via cashKindLabel (operations-labels) com fallback 'Outro lançamento'; cartões do Financeiro com texto de apoio fiel ao financial.service (Faturado = comandas não cobertas + pagamentos de contrato; Recebido = soma de cash_movements); filtros juntos; ações da cliente 44 px com rótulo nominal
- [Phase 05]: 05-20: fase 5 aceita pela usuária em 2026-11-06 ("aprovado"); UX-01 a UX-19 conferidos no staging; previsão conferida contra o banco; usuário de auditoria desativado e senha local apagada
- [Phase 06]: Gráficos usam chart-theme.ts (Faturado #521873, Recebido/entrada #109868, saída #D85A30, grade #E5E7EB)
- [Phase 06]: Filtro segmentado selecionado = SEGMENT_SELECTED_CLASS (bg-primary-800 text-white)
- [Phase 06]: Faixa Saldo/Entradas/Saídas do Financeiro calculada no cliente a partir de cashMovements
- [Phase 06]: 06-07: valores da Previsão em success-700/outflow-700 (inclusive totais de 22 px, por causa do contraste-valores.test); Badge novo outflow para origem de saída
- [Phase 06]: 06-08: total mensal das despesas fixas ativas em text-outflow-700 22 px (saída), somado em centavos da lista carregada; Inativa com Badge neutral (ponto grafite)
- [Phase 06]: 06-08: tabelas largas no celular rolam de lado (min-w + ações sem flex-wrap) em vez de empilhar botões

### Pending Todos

- **Testes de RBAC e auth nunca rodaram — 4 arquivos invisiveis para o Jest** (descoberto em 2026-09-29 pelo plan-checker da fase 02.1, confirmado empiricamente). `apps/backend/jest-integration.config.ts:7` usa `testRegex: '.*\.spec\.ts$'`, que exige PONTO antes de `spec.ts`. Os arquivos `rbac.e2e-spec.ts`, `invitation.e2e-spec.ts`, `auth.e2e-spec.ts` e `full-auth-flow.e2e-spec.ts` usam HIFEN e nunca sao descobertos — ou seja, a cobertura de RBAC e do fluxo completo de autenticacao nunca executou, apesar de a Fase 1 ter sido marcada completa com eles no plano. Correcao: renomear os 4 para `.e2e.spec.ts` e rodar, esperando que falhas reais aparecam. Nao feito agora para nao virar desvio grande no meio da fase 02.1.
- **`pnpm test:e2e` aponta para config inexistente** (mesmo contexto). `apps/backend/package.json:18` roda `jest --config ./test/jest-e2e.json`, mas `apps/backend/test/jest-e2e.json` nao existe no repo. O comando falha imediatamente. Decidir: criar a config ou remover o script.

### Blockers/Concerns

- **WABA registration**: Iniciar processo de verificação Meta Business antes do início da Phase 3 para não bloquear a Phase 5 (COMM-01 depende de WABA aprovado)
- **Payment gateway decision**: Pagar.me vs Stripe Connect deve ser decidido antes da Phase 3 — não pode ser postergado
- **pnpm concurrent installs**: Multiple parallel agent worktrees cause ENOENT conflicts on Windows when running pnpm install simultaneously. Workaround: stagger installs or use main repo node_modules.

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Equipe e profissionais — cadastro completo de profissionais (URGENT)
- Phase 02.1 executada 2026-09-29: 2 waves, 2/2 planos. Backend e frontend mesclados no master. Falta a verificacao manual ponta a ponta do criterio do M1 (convite -> aceite -> aparece em /profissionais, /agenda e /catalogo/comissoes), que exige as duas apps no ar.
- Phase 04.1 inserted after Phase 4: Layout e regras do contrato (modelo Studio JS) — PDF em 2 páginas com tabelas, cláusulas I–VIII e assinaturas; Noiva/Debutante; dados completos da contratante; extras/desconto; à vista ou sinal parcelado com alertas; dados do studio configuráveis (URGENT)
- Phase 6 added (2026-11-06): Novo layout Gestor Beauty — aplicar o design do Stitch "Gestor Beauty" ao SGS; só o visual, lote base primeiro e depois uma tela por lote

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260922-0kn | Exibir a comissao cadastrada do servico (tipo e valor) na tela de editar servico | 2026-09-22 | 9df355f | [260922-0kn-exibir-a-comissao-cadastrada-do-servico-](./quick/260922-0kn-exibir-a-comissao-cadastrada-do-servico-/) |
| 260928-vk2 | Corrigir setup do pnpm (ERR_PNPM_BAD_PM_VERSION) e parsing jq do health check do CI (JSON Lines) | 2026-09-28 | 31d6bdf | [260928-vk2-corrigir-setup-do-pnpm-e-health-check-do](./quick/260928-vk2-corrigir-setup-do-pnpm-e-health-check-do/) |
| 260929-dek | Esconder acoes de equipe por papel, proteger ultimo admin e no-cache do index.html | 2026-09-29 | 24a6e63 | [260929-dek-esconder-acoes-de-equipe-por-papel-prote](./quick/260929-dek-esconder-acoes-de-equipe-por-papel-prote/) |
| fast-260929 | Corrigir CI: prisma generate nos jobs typecheck/lint e healthcheck do pgbouncer (resolve os 2 achados de CI adiados) | 2026-09-29 | - | - |
| fast-260929b | Corrigir nome dos scalars DateTime/Email no schema publicado (query da agenda falhava com Unknown type "DateTime") + teste de regressao | 2026-09-29 | - | - |
| fast-260929c | Declarar prettier no frontend (hook do graphql-codegen falhava com prettier: not found no CI) | 2026-09-29 | - | - |
| 260929-dvr | Cadastro direto de profissional com senha provisoria, categorias atendidas e filtro de profissional por categoria na agenda | 2026-09-29 | 1da3b73 | [260929-dvr-cadastro-direto-de-profissional-com-senh](./quick/260929-dvr-cadastro-direto-de-profissional-com-senh/) |
| fast-260929d | Mascara de telefone BR nos dialogs de cadastro/edicao de profissional e na lista | 2026-09-29 | - | - |
| fast-260929e | Tipo de chave Pix (CPF, CNPJ, e-mail, celular, aleatoria) com mascara e validacao por tipo no cadastro/edicao de profissional | 2026-09-29 | - | - |
| fast-260929f | Profissional (papel PROFESSIONAL) so ve os proprios atendimentos (backend forca o filtro) e a agenda esconde agendar/selecao de profissionais para quem nao tem appointment.write | 2026-09-29 | - | - |
| 260929-gta | Automatizar com Playwright os testes de verificacao manual do M1 (Fase 02.1) + job e2e no CI; corrige menu de acoes de /profissionais | 2026-09-29 | e6fda22 | [260929-gta-automatizar-com-playwright-os-testes-de-](./quick/260929-gta-automatizar-com-playwright-os-testes-de-/) |
| 261103-hmb | Cadastro rapido de cliente dentro do formulario de agendamento (sem sair da agenda) | 2026-11-03 | 64888bf | [261103-hmb-cadastro-rapido-de-cliente-no-agendament](./quick/261103-hmb-cadastro-rapido-de-cliente-no-agendament/) |
| 261104-hyq | Pacote contratado no grupo de noivas: select no formulario, nome no detalhe, servicos do pacote entram na noiva e contrato novo ja vem com o pacote | 2026-11-04 | 9c9d3ac | [261104-hyq-pacote-contratado-no-grupo-de-noivas](./quick/261104-hyq-pacote-contratado-no-grupo-de-noivas/) |
| 261104-ix0 | Pacote do contrato vale para o grupo: contrato grava o pacote no grupo e os servicos na noiva (update so quando o pacote muda ou o grupo esta sem pacote), backfill dos grupos existentes e refetch do grupo no dialogo | 2026-11-04 | ee28378 | [261104-ix0-pacote-do-contrato-vale-para-o-grupo](./quick/261104-ix0-pacote-do-contrato-vale-para-o-grupo/) |
| 261104-ky7 | Rateio do pacote pelo repasse quando os servicos nao tem preco avulso (divisao igual sem repasse), em contratos e comandas, e dica no aceite publico do que falta para habilitar "Aceito" | 2026-11-04 | dd2739d | [261104-ky7-rateio-do-pacote-pelo-repasse-e-dica-no-](./quick/261104-ky7-rateio-do-pacote-pelo-repasse-e-dica-no-/) |
| 261105-c26 | Contrato comeca pela noiva em Contratos > Novo contrato e cria o grupo na mesma transacao; acompanhantes entram depois, fora do contrato | 2026-11-05 | f9d862a | [261105-c26-contrato-comeca-pela-noiva-e-cria-o-grup](./quick/261105-c26-contrato-comeca-pela-noiva-e-cria-o-grup/) |
| 261105-d6k | Previa ao vivo do contrato no formulario: o proprio PDF (modelo Studio JS, timbrado) ao lado do formulario no desktop e Ver previa no celular, via query contractPreviewPdf que roda create/update numa transacao desfeita (nada gravado) | 2026-11-05 | a20e500 | [261105-d6k-previa-do-contrato-ao-vivo-no-formulario](./quick/261105-d6k-previa-do-contrato-ao-vivo-no-formulario/) |
| 261105-i7x | Sinal do contrato pre-preenchido e editavel com a entrada do pacote (fixa ou %), com botao para restaurar o valor do pacote | 2026-11-05 | 271b726 | [261105-i7x-sinal-pre-preenchido-com-o-valor-de-entr](./quick/261105-i7x-sinal-pre-preenchido-com-o-valor-de-entr/) |
| 261106-cst | Previsao de caixa: outros custos do pacote (por contrato, na data do evento) e saidas por grupo (profissional/operacional/fixo) | 2026-11-06 | aab7f5a | [261106-cst-previsao-custos-por-grupo](./quick/261106-cst-previsao-custos-por-grupo/) |
| 261107-in8 | Dashboard operacional no Inicio: KPIs do dia, proximos atendimentos, comandas em aberto, contratos de noivas proximos e previsao de caixa, por permissao | 2026-11-07 | b56cfb4 | [261107-in8-dashboard-operacional-no-inicio](./quick/261107-in8-dashboard-operacional-no-inicio/) |
| 261107-j9q | Menu lateral e gaveta em acordeao: abrir um menu com submenus fecha o irmao aberto; so o ramo da rota nasce aberto; aviso de estoque no menu fechado | 2026-11-07 | a2e7a2d | [261107-j9q-menu-lateral-em-acordeao](./quick/261107-j9q-menu-lateral-em-acordeao/) |
| 261107-jvl | Icone em todos os itens do menu (grupos do topo, submenus e folhas); icon obrigatorio no MenuItem | 2026-11-07 | bd2eb91 | [261107-jvl-icone-em-todos-os-itens-do-menu](./quick/261107-jvl-icone-em-todos-os-itens-do-menu/) |
| 261107-k9c | Agenda como item direto no menu (link para /agenda), sem o submenu Minha agenda | 2026-11-07 | be16ad0 | [261107-k9c-agenda-como-item-direto-no-menu](./quick/261107-k9c-agenda-como-item-direto-no-menu/) |
| 261108-n4s | Cor automatica por profissional na agenda (12 tons, fundo do cartao no Dia e na Semana, bolinha do cabecalho; borda segue o status) e nome completo no filtro lateral, chips e cabecalho da coluna | 2026-11-10 | 9f13aa1 | [261108-n4s-cor-por-profissional-na-agenda](./quick/261108-n4s-cor-por-profissional-na-agenda/) |
| fast | Compose de dev com portas so em 127.0.0.1 (Valkey exposto foi alterado por terceiros) | 2026-11-10 | fbeae37 | - |
| 261108-n2o | Teste de noiva incluso no pacote: marca "Inclui teste" por servico do pacote (backfill em Maquiagem/Penteado noiva de Essence, Experience e Glam), contrato divide o valor 50/50 entre teste e evento, comanda do teste a R$ 0 e evento cobra as duas metades, PDF mostra o teste incluso | 2026-11-08 | d53a1fe | [261108-n2o-teste-de-noiva-incluso-no-pacote](./quick/261108-n2o-teste-de-noiva-incluso-no-pacote/) |
| fast | Modal de novo/editar pacote limitado a 90vh com rolagem interna (nao extrapola a tela) | 2026-11-08 | c951767 | - |
| fast | Login: Entrar habilita ao digitar e com autopreenchimento do navegador (sem clicar na pagina); Enter envia o formulario (continua o 261107-kpj) | 2026-11-08 | 38070fe | - |

## Session Continuity

Last session: 2026-11-12T03:17:58.788Z
Stopped at: Completed 06-08-despesas-fixas-PLAN.md
Resume file: None

# Phase 7: App Android Gestor Beauty com Capacitor - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A equipe do salão instala o app Android "Gestor Beauty" pelo **teste interno da Play Store** e usa o SGS no celular com as mesmas telas do sistema web, empacotado com Capacitor. O app recebe push de **novo agendamento** e de **cancelamento**. Ficam de fora: PWA (decisão da usuária, 2026-11-14), iOS, o app React Native/Expo (fases futuras), o app para clientes/noivas e o uso offline.

</domain>

<decisions>
## Implementation Decisions

### Já decididos antes da discussão (2026-11-14)
- **D-01:** O público é a equipe do salão. O app mostra as mesmas telas do SGS, sem telas exclusivas.
- **D-02:** Só Android nesta fase.
- **D-03:** O nome na loja e no ícone é "Gestor Beauty". O appId `br.com.gestorbeauty.app` é estável e a keystore de upload fica guardada fora do repositório, com backup documentado, para o futuro app Expo sair como **atualização do mesmo app** na loja.
- **D-04:** O registro de tokens de aparelho e o envio de push ficam no backend de forma neutra (FCM v1 do lado do servidor, sem depender do Capacitor), para o Expo reaproveitar.
- **D-05:** Criar `packages/shared` (queries GraphQL, tipos gerados, validações) pensando no Expo.

### Servidor e atualização
- **D-06:** O app aponta para `https://sgs.jessicaseixasmakeup.com.br`, que hoje é o único ambiente e já é usado de verdade pelo Studio JS. Esta fase não cria ambiente de produção separado; isso continua no backlog 999.3.
- **D-07:** As telas são **carregadas do servidor** (Capacitor `server.url`): toda melhoria que sobe para o staging aparece no app na hora, sem publicar versão nova. Só a casca nativa (plugins, ícone, permissões) exige build e publicação.
- **D-08:** Sem internet, o app mostra uma tela amigável "Sem conexão" com o botão "Tentar novamente". Não há funcionamento offline.

### Distribuição
- **D-09:** A primeira entrega vai pelo **teste interno da Play Console** (só e-mails convidados, até 100). Não entra na loja pública nesta fase.
- **D-10:** A conta de desenvolvedor do Google Play é de **pessoa física, no nome da usuária** (US$ 25). A usuária cria a conta. Até ela existir, o app é testado por APK. A publicação aberta (que exige teste fechado com 12 pessoas por 14 dias) fica para depois.

### Notificações (push)
- **D-11:** Eventos desta fase: **novo agendamento** e **cancelamento**. Remarcação e os alertas do sino ficam para depois.
- **D-12:** Quem recebe: a **profissional do atendimento** (só os dela) e **admin e gerente** (todos do salão).
- **D-13:** Quem criou ou cancelou o agendamento **não recebe** o aviso da própria ação.
- **D-14:** Tocar na notificação **abre a agenda no dia do atendimento**, com ele em destaque/aberto.
- **D-15:** Agendamentos criados em lote no grupo de noivas geram **uma notificação por profissional**, resumindo os atendimentos dela no evento (ex.: "3 atendimentos no casamento da Vitória, 08/11"). Gestoras recebem um resumo do evento, não um aviso por atendimento.

### Ícone, splash e acesso
- **D-16:** Ícone provisório criado pelo Claude: monograma "GB" em branco sobre o roxo `#570080`, com a tipografia do layout Gestor Beauty. Deve ser fácil de trocar quando houver logo oficial (inclusive o ícone adaptativo do Android).
- **D-17:** Splash com fundo `#F7F6F3` (o papel do layout) e o ícone no centro. Some assim que o sistema carrega.
- **D-18:** **Todos os papéis** (admin, gerente, atendente, profissional) usam o app com o mesmo login. Cada uma vê o que já vê no web.

### Claude's Discretion
- Versão mínima do Android e targetSdk exigido pela Play.
- Comportamento do botão voltar: navegar para trás no histórico e, na tela raiz, sair do app.
- Área segura/notch, teclado sobre formulários, barra de status com a cor do layout.
- Login persistente reaproveitando o refresh token (30 dias) já guardado; como fica o armazenamento no WebView (localStorage vs Preferences do Capacitor).
- Como o app pede permissão de notificação (Android 13+) e em que momento.
- Onde fica o projeto Android no monorepo (ex.: `apps/mobile`) e como o build AAB/APK é gerado (VPS ou Mac).
- Dedup e limpeza de tokens inválidos, e envio fora da transação (fila BullMQ já existente).
- Sessão de platform admin dentro do app (entrar no salão pelo painel) segue o comportamento do web.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e decisões do projeto
- `.planning/ROADMAP.md` — seção "Phase 7: App Android Gestor Beauty com Capacitor"
- `.planning/PROJECT.md` — "Mobile app nativo — web-first"
- `.planning/REQUIREMENTS.md` — PLAT-01 (PWA) está fora desta fase (D-PWA descartado pela usuária)
- `SDD_Plataforma_Saloes_v1.1.md` §stack (Mobile: React Native + Expo — fase futura; esta fase prepara o terreno)
- `PRD_Frontend_Plataforma_Saloes.md` §14.7 (PWA agora ou depois — superado: sem PWA)

### Infra do staging (servidor do app)
- `infra/nginx/sgs-staging.conf` — basic auth está comentado; `/graphql`, `/public/`, `/health`, `/`
- `docker-compose.staging.yml`, `scripts/deploy-staging.sh`
- `.env.staging.example` — onde entram as credenciais do FCM (service account) no backend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/frontend/src/infrastructure/stores/auth.store.ts`: zustand `persist` com accessToken + refreshToken (30 dias) — base do login persistente.
- `apps/frontend/src/infrastructure/apollo/client.ts`: `VITE_API_URL` opcional; com `server.url` o app usa `/graphql` relativo ao próprio site.
- `apps/frontend/src/lib/use-media-query.ts` e a barra inferior do layout Gestor Beauty (fase 6): layout de celular já existe.
- `apps/backend/src/catalog/notifications/` (service, resolver, module) e tabela `notifications` (kind, payload, member_id): padrão de notificação in-app do sino; o push pode partir dos mesmos pontos.
- `apps/backend/src/contracts/alerts/contract-alerts.service.ts`: exemplo de job BullMQ + notificação por papel.
- `apps/backend/src/appointments/appointments.service.ts` (`createVisit`, `cancel`) e `visits.ts`, `appointment-cancel.ts`: pontos onde disparar novo agendamento/cancelamento.
- Agendamentos do grupo de noivas (`scheduleBridalEvent` em `apps/backend/src/bridal/`): disparo agrupado por profissional (D-15).

### Established Patterns
- Multi-tenant com RLS forçada (`app.current_organization`): a tabela nova de tokens de aparelho precisa de RLS e de permissões no `authz/permissions.catalog.ts`.
- Migrations via Prisma com roles `sgs_migrator`/`sgs_app`; backup do staging antes de deploy com migration.
- Frontend sem prettier configurado (aspas simples, ~100 colunas); textos em pt-BR via i18n.

### Integration Points
- Rotas da agenda no frontend (deep link D-14: abrir a agenda na data com o atendimento aberto; ver helper de links agenda↔comanda da quick 261113-k6j).
- nginx do staging: pode precisar servir `/.well-known/assetlinks.json` se o planner optar por App Links.

</code_context>

<specifics>
## Specific Ideas

- Texto de exemplo do aviso de noiva: "3 atendimentos no casamento da Vitória, 08/11".
- Cores: roxo `#570080` (ação principal/ícone), papel `#F7F6F3` (splash).

</specifics>

<deferred>
## Deferred Ideas

- Publicação aberta na Play Store (teste fechado de 12 pessoas por 14 dias, conta pessoa física).
- Push de remarcação e dos alertas do sino (parcelas de contrato etc.).
- Agenda do dia offline.
- Ambiente de produção separado (backlog 999.3) e migrar o app para ele.
- iOS (Capacitor) e o app React Native/Expo como atualização do mesmo appId.
- Logo oficial do Gestor Beauty.
- Biometria/desbloqueio por digital.

</deferred>

---

*Phase: 07-app-android-gestor-beauty-com-capacitor*
*Context gathered: 2026-11-14*

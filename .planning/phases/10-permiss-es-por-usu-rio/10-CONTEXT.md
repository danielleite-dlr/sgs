# Phase 10: Permissões por usuário - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Cada papel (Admin, Gerente, Atendente, Profissional) continua com o seu padrão de acesso, e o Admin/Gerente passa a **ligar e desligar itens do menu por pessoa**. O que está desligado para a pessoa some do menu (Sidebar, gaveta do celular e busca global), a rota bloqueia e a **API recusa**; o que é ligado a mais passa a funcionar para ela no menu, na rota e na API. Não entra nesta fase: permissão por ação dentro da tela (ex.: "pode ver mas não editar"), mudar o padrão de um papel para o salão todo, nem o app nativo iOS.

</domain>

<decisions>
## Implementation Decisions

### Já decidido antes (18/11/2026)
- **D-01:** Granularidade por item do menu/área, não por ação dentro da tela.
- **D-02:** Desligado ⇒ some do menu, a rota bloqueia e a API recusa (não basta esconder no frontend).
- **D-03:** Gerente gerencia a equipe igual ao Admin (quick 261118-gpm) — vale para o resto do cadastro; para permissões, ver D-08.

### Tirar e dar
- **D-04:** O ajuste por pessoa **tira e dá**. O papel define só o ponto de partida; qualquer item pode ser ligado ou desligado para a pessoa (ex.: gerente sem Financeiro; atendente de confiança com Financeiro).
- **D-05:** Quem **ganha** um item que o papel não tinha vê e mexe nele **igual ao Gerente** (sem o recorte "só o meu" do papel original). Ex.: atendente com Financeiro vê o caixa todo; atendente com Relatórios do Comercial vê os relatórios de todos.

### Tamanho do item
- **D-06:** Cada **submenu** liga/desliga sozinho (ex.: Previsão de caixa sem o resto do Financeiro; Leads sem Relatórios do Comercial). Na tela, a área (grupo do menu) tem um controle que liga/desliga todos os itens dela de uma vez.
- **D-07:** Itens que ainda são placeholder (feature flag desligada) não aparecem na tela de acessos.

### Quem mexe em quem
- **D-08:** **Admin sempre vê tudo**; ninguém tira nada do Admin. O Admin ajusta qualquer pessoa. O **Gerente ajusta só Atendente e Profissional** — não mexe em outro Gerente, no Admin nem em si mesmo. Atendente e Profissional não mexem em acessos.
- **D-09:** "Perfis de acesso" (a própria tela de ajuste) fica sempre com Admin/Gerente e não pode ser dada a Atendente/Profissional — senão a regra D-08 seria contornada.

### Onde fica
- **D-10:** Tela **Profissionais › Perfis de acesso** (hoje placeholder em `menu-config.ts`, rota `/profissionais/perfis`): lista das pessoas ativas e, para cada uma, as áreas e itens com liga/desliga, mostrando o que é padrão do papel e o que foi ajustado.
- **D-11:** Atalho **"Acessos"** no editar profissional que abre o mesmo ajuste para aquela pessoa.
- **D-12:** Só por pessoa — não há edição do padrão do papel para o salão todo (fica para depois, ver Deferred).

### Quando vale
- **D-13:** Vale **na hora**: a API já recusa na próxima ação; o menu da pessoa se atualiza sozinho em até ~1 minuto ou ao trocar de tela, sem sair e entrar (inclui o app instalado no iPhone e o Android).

### Claude's Discretion
- Modelo de dados dos ajustes (overrides por membro: concedido/negado por item) e como o catálogo de itens do menu se liga às permissões do backend (um item pode exigir várias permissões; um resolver pode servir a vários itens).
- Itens sempre ligados que não entram no ajuste (ex.: Início, o próprio perfil/troca de senha, notificações).
- Dependências entre itens (ex.: Comandas usa Clientes no cadastro rápido; Contratos abre a partir de Noivas) — escolher o comportamento mais simples que não quebre a tela, e registrar.
- Botão "voltar ao padrão do papel" por pessoa; destaque visual do que difere do padrão.
- Auditoria de quem mudou o quê (reaproveitar o audit log existente).
- O que acontece com ajustes quando a pessoa muda de papel (sugestão: zerar os ajustes e voltar ao padrão do novo papel, avisando na tela).
- Como o push/aviso respeita o item desligado (ex.: lembrete do Comercial não vai para quem perdeu o Comercial).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Permissões e papéis hoje
- `apps/backend/src/authz/permissions.catalog.ts` — `PERMISSIONS` e `ROLE_PERMISSIONS` fixos por papel (fonte do padrão do papel)
- `apps/backend/src/authz/guards/permission.guard.ts` — `@RequirePermission` checa a tabela `role_permissions`; `@RequireRole` checa `roleName`
- `apps/backend/src/authz/team-permissions.spec.ts`, `permissions.catalog.spec.ts` — testes atuais do catálogo
- `apps/frontend/src/features/operations/operations-permissions.ts` — `useHasPermission` espelha `ROLE_PERMISSIONS` por `roleName` (o store `permissions` nunca é populado pelo login)
- `apps/frontend/src/features/identity/team-permissions.ts` — gates da equipe por papel

### Menu e rotas
- `apps/frontend/src/components/layout/menu-config.ts` — árvore do menu (ids, `roles`, `managerOnly`), item "Perfis de acesso" placeholder
- `apps/frontend/src/components/layout/use-menu.ts` — `useMenu()` → `menuForRole(roleName)` (Sidebar, gaveta e busca global usam)
- `apps/frontend/src/config/features.ts` — feature flags (placeholders)
- Fase 9: `<CommercialRoute>` com `managerOnly` (`.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md`) — padrão de guarda de rota por papel

### Decisões anteriores
- `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md` — papéis do Comercial (PROFESSIONAL não acessa; atendente vê só os dela) — com D-05, quem ganha o item deixa de ter o recorte
- `.planning/ROADMAP.md` § Phase 10

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `role_permissions` (tabela) + `PermissionGuard`: ponto único onde a API decide; os ajustes por pessoa entram aqui.
- `useMenu()` / `menuForRole()`: ponto único do menu no frontend (Sidebar, gaveta do celular e busca global).
- Audit log existente (ex.: `bridal.assistant.rate.update` na 09.1) para registrar mudanças de acesso.

### Established Patterns
- Frontend decide por `roleName` em ~40 lugares e por `useHasPermission` em ~18 arquivos — tudo precisa passar a usar as permissões efetivas da pessoa vindas do backend.
- Serviços com recorte por papel (ex.: `visibilityWhere(` no Comercial, comissões da profissional) usam `roleName`; com D-05, devem considerar se a pessoa ganhou o item.

### Integration Points
- Login/refresh e uma query de "meus acessos" para o frontend; atualização periódica (D-13).
- Tela `/profissionais/perfis` e atalho no `MemberEditDialog`.

</code_context>

<specifics>
## Specific Ideas

- Exemplos da usuária: um gerente que não vê uma área que não é dele (ex.: Financeiro); o mesmo para profissional.
- Na lista de acessos, deixar claro o que é padrão do papel e o que foi ajustado para a pessoa.

</specifics>

<deferred>
## Deferred Ideas

- Mudar o padrão de um papel para o salão todo (ex.: todo Atendente deixa de ver Clientes em débito) — fase futura.
- Permissão por ação dentro da tela (ver vs. editar) — fora de D-01.
- Fase 11 (já no roadmap): profissional "atende noiva"/"fixa" e cronograma do grupo.

</deferred>

---

*Phase: 10-permiss-es-por-usu-rio*
*Context gathered: 2026-11-24*

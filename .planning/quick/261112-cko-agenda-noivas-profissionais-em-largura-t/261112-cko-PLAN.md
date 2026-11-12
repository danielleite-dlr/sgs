---
quick_id: 261112-cko
type: quick
autonomous: true
files_modified:
  - apps/backend/src/graphql/schema/appointments.graphql
  - apps/backend/src/appointments/appointments.service.ts
  - apps/frontend/src/features/operations/api/appointments.api.ts
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx
  - apps/frontend/src/features/operations/lib/schedule-professionals.ts (novo)
  - apps/frontend/src/components/layout/AppShell.tsx
  - apps/frontend/src/components/layout/SidebarNav.tsx
  - apps/frontend/src/styles/globals.css
must_haves:
  truths:
    - "Num dia com noiva, a barra da agenda mostra um botão por grupo (noiva/debutante); clicar filtra a agenda para a noiva e as acompanhantes dela, e só as profissionais envolvidas ficam como colunas"
    - "Com o menu da agenda recolhido, os botões de profissionais ganham uma linha própria na largura toda, com todas as profissionais (sem o '+N')"
    - "Profissionais com atendimento no período vêm primeiro, nos botões e nas colunas da grade"
    - "A grade da visão Dia tem barra de rolagem visível na vertical e na horizontal; cabeçalho das profissionais e coluna de horas ficam fixos ao rolar"
    - "O menu principal pode ser recolhido para uma faixa de ícones (64 px); grupos abrem num painel flutuante; o estado fica salvo no navegador"
---

<objective>
Pedido do usuário (12/11): filtrar por noiva e acompanhantes; com o menu da agenda recolhido, profissionais na largura
toda priorizando quem tem atendimento; barra de rolagem lateral na agenda; menu principal recolhível só com ícones.

Causas encontradas:
- `Appointment` no GraphQL não expõe `bridal_group_id` (o banco já vincula noiva e acompanhantes ao grupo).
- `SchedulePage` mostra só `professionals.slice(0, 4)` + "+N", sem ordenar.
- `DayGrid` tem `overflow-hidden` no contêiner da grade: corta as colunas que passam da largura (sem rolagem
  horizontal) e quebra o `sticky` do cabeçalho; barras de rolagem overlay (macOS) somem.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Backend — dados da noiva no Appointment</name>
  <action>Incluir `bridalGroup { id name eventKind members { clientId role } }` no APPOINTMENT_INCLUDE; expor
  `bridalGroupId`, `bridalGroupName`, `bridalEventKind`, `bridalRole` (bride/companion do cliente no grupo).
  Teste unitário no serializeAppointment.</action>
</task>
<task type="auto">
  <name>Task 2: Frontend — filtro por noiva, ordem e largura das profissionais, rolagem</name>
  <action>Função pura `sortProfessionalsByLoad` + `bridalGroupsOf` (com testes); chips de noiva na barra; linha
  própria de profissionais quando recolhido; `overflow-clip` + `minWidth` + horas sticky no DayGrid; classe
  `.scrollbar-visible`.</action>
</task>
<task type="auto">
  <name>Task 3: Menu principal recolhível</name>
  <action>Prop `collapsed` no SidebarNav (ícones com tooltip; grupos em Popover com a subárvore); botão
  recolher/expandir; estado no localStorage com try/catch. AppDrawer (celular) não muda.</action>
</task>
</tasks>

<verification>lint + tsc + jest unit + integração + vitest + E2E da agenda; deploy staging; CI verde.</verification>

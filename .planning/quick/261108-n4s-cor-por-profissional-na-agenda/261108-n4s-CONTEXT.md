# Quick Task 261108-n4s: Cor automática por profissional na agenda - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Task Boundary

Na agenda, cada profissional passa a ter uma cor diferente para facilitar a visualização
(pedido da usuária: "na agenda cada profissional tenha uma cor diferente").

</domain>

<decisions>
## Implementation Decisions (locked — escolhidas pela usuária)

### Como a cor é definida
- **Automática**, sem opção de escolher/trocar no cadastro. Sem migration nem campo novo.
- Não pode repetir entre as profissionais do salão enquanto houver cores na paleta: distribuir
  por posição numa lista estável das profissionais (ex.: ordenadas por id/criação), não por hash
  (hash colide). Paleta de ~12 cores; com mais de 12, recomeça.
- A mesma profissional tem a mesma cor em todas as telas/visões (dia, semana, filtros).

### Como aparece
- **Fundo claro (tint) na cor da profissional** no cartão do agendamento (DayGrid/AppointmentCard
  e WeekGrid). A **borda esquerda continua sendo a cor do status** (`statusSpineColor`).
- A bolinha com a inicial no cabeçalho da coluna da profissional (DayGrid ~L304, hoje
  `bg-primary-50 text-primary-700`) também usa a cor dela.
- Contraste WCAG 2.1 AA do texto sobre o fundo (texto neutral-800 sobre tint claro); hover
  continua perceptível.

### Claude's Discretion
- Paleta exata (tons claros distinguíveis entre si e da cor de status), onde mora o helper
  (ex. `features/operations/lib/professional-colors.ts`), de onde vem a lista de profissionais.

</decisions>

<specifics>
## Pontos do código
- `apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx` (cartão, hoje
  `bg-white`), `DayGrid.tsx`, `WeekGrid.tsx` (L92-93), `lib/appointment-status-style.ts`.
- Testes: vitest para o helper (sem repetição, estável) e ajuste/novo E2E em `apps/e2e`.
- Frontend sem prettier: formatar à mão. Nunca importar `tailwind.config.ts` em `src`.
- Não commitar as alterações pendentes da tarefa 261107-kpj nem da 261108-n2o.

</specifics>

<addendum>
## Adendo 2026-11-08 — nome completo da profissional (pedido da usuária)

"Na tela de agenda o nome do profissional precisa apresentar completo, sem apenas iniciais
igual está hoje." Decisão: em todos os pontos da agenda onde a profissional aparece só pelas
iniciais ou com nome cortado, mostrar o **nome completo** (via `toDisplayName`):
- Filtro "Profissionais" da lateral (`SchedulePage.tsx` ~L287-305): hoje botões 44x44 só com
  `pro.initials`. Passa a ser uma linha por profissional com a bolinha (na cor dela, ver acima)
  + nome completo, mantendo `aria-pressed`, alvo ≥ 44px e estado visível/oculto.
- Chips do celular (`SchedulePage.tsx` ~L1085-1105): trocar `shortProfessionalName` +
  `truncate max-w-[120px]` por nome completo (pode quebrar linha ou rolar na horizontal; não
  cortar com reticências).
- Cabeçalho da coluna no DayGrid (~L309): tirar `truncate`; nome completo com quebra de linha
  (até 2 linhas) em vez de reticências.
- A bolinha com iniciais pode continuar como avatar ao lado do nome, mas nunca sozinha.
- E2E/vitest: conferir o nome completo visível (`{ exact: true }`) no filtro e no cabeçalho.
</addendum>

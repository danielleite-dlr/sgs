---
phase: 06-novo-layout-gestor-beauty
plan: 03
type: execute
wave: 3
depends_on: ["06-02"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-computador.png
  - apps/frontend/src/features/operations/lib/appointment-status-style.ts
  - apps/frontend/src/features/operations/lib/operations-labels.ts
  - apps/frontend/src/features/operations/components/calendar/types.ts
  - apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts
  - apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx
  - apps/frontend/src/features/operations/components/calendar/TimeBlockOverlay.tsx
  - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx
  - apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx
  - apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx
  - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
autonomous: true
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "Cada bloco de agendamento é branco com borda de 1 px e borda esquerda de 3 px na cor do status (Agendado roxo, Confirmado verde, Em atendimento azul, Concluído grafite, Faltou/Cancelado vermelho), nome da cliente em serifa e horário '09:00 - 10:30 • 90 min' em números tabulares (D-11, D-19)"
    - "A linha do tempo mostra as horas na margem como '09:00', linha cheia na hora cheia e tracejada na meia hora, e a hora atual em roxo com o horário escrito (D-19)"
    - "Bloqueios de horário aparecem em hachura neutra com borda na cor do tipo (D-19)"
    - "No celular, o seletor de profissional tem botões de 44 px com avatar e nome, e o botão 'Filtros' tem texto; no computador, cada coluna de profissional tem o nome em serifa e a contagem de atendimentos do dia (D-19)"
    - "O botão 'Agendar' é roxo com texto branco (D-06); nada de 'Cadeira 01', 'Preparação de bancada' ou bancadas (D-02)"
  artifacts:
    - path: "apps/frontend/src/features/operations/lib/appointment-status-style.ts"
      provides: "Cor da borda de status por status (D-11)"
      exports: ["STATUS_SPINE_COLORS", "statusSpineColor"]
    - path: "apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx"
      provides: "Regressão visual da agenda"
  key_links:
    - from: "apps/frontend/src/features/operations/components/calendar/types.ts"
      to: "apps/frontend/src/features/operations/lib/appointment-status-style.ts"
      via: "getAppointmentStyle usa statusSpineColor(appt.status) na borderLeft"
      pattern: "statusSpineColor"
---

<objective>
Lote de tela 1 (D-03): Agenda do dia no celular e no computador, seguindo as telas Stitch "Agenda do dia (celular)" (`845719aac8a8444884e393e48644ded0`) e "Agenda do dia multi-profissional (computador)" (`6e515928b7ed4e6ab4e502ec268d71a6`), com D-19 e D-11. Só visual (D-01): consultas, arrastar e soltar, permissões e `data-testid` ficam iguais.

Omitir (D-02, não criar placeholder nem dado falso): "Cadeira 01/02", "Suíte Noiva", "Preparação de bancada", "Higienização e assepsia", "Horário livre" como texto de slot, "Online"/"Sincronizado", relógio "10:42 BRT", seletor de unidade, "Fluxo por estação". A contagem por profissional ENTRA porque o dado já está carregado na tela (lista de agendamentos do dia, sem consulta nova): "N atendimentos".

Purpose: a tela mais usada no dia a dia com a cara nova.
Output: agenda redesenhada, testes de regressão, deploy no staging com CI verde.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-UI-SPEC.md
@.planning/phases/06-novo-layout-gestor-beauty/06-02-SUMMARY.md
@.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md

<armadilhas>
- NUNCA rodar `prettier --write`; `SchedulePage.tsx`, `DayGrid.tsx`, `WeekGrid.tsx`, `AppointmentCard.tsx` e `types.ts` usam ASPAS DUPLAS — manter o estilo de cada arquivo.
- Helpers novos em `features/operations/lib/*.ts`, nunca exportados de `.tsx`.
- Regressões da fase 5 nesta tela (não podem quebrar): UX-01 (`view-day` selecionado com texto branco sobre roxo; E2E `ux-contraste.spec.ts`), UX-02 (alvos de 44 px no celular, "Filtros" com texto, botões de profissional `shrink-0` e com nome; `ux-agenda-lote1.test.tsx`, `ux-agenda-celular.spec.ts`), UX-05 ("Novembro de 2026", sem "Pgto Indica").
- E2E de arrastar (`agenda-dnd.spec.ts`) mede a altura do slot e arrasta o card: não mudar `slotHeight`, `GRID_*`, `data-testid` `slot-*`, `lane-*`, `appointment-card-*`, nem a posição/altura calculada em `getAppointmentStyle` (só cor/borda).
- O botão "Agendar" mantém o nome acessível "Agendar" (`ux-agenda-celular.spec.ts` usa `name: 'Agendar', exact: true`).
</armadilhas>

<interfaces>
- `calendar/types.ts`: `ScheduleAppointment { id, professionalId, clientName, service, categoryColor, start, end, durationMinutes, status }`; `getAppointmentStyle(appt, slotHeight)` devolve `top`, `height`, `backgroundColor: categoryColor + '22'`, `borderLeft: 3px solid categoryColor`; `formatHM(d)`.
- Status do backend: `scheduled`, `confirmed`, `in_progress`, `completed`, `no_show`, `cancelled` (`operations-labels.ts` `APPOINTMENT_STATUS_LABELS`: Agendado, Confirmado, Em atendimento, Concluído, Cancelado, Não compareceu).
- `DayGrid.tsx`: cabeçalho das colunas (avatar `pro.color` + primeiro nome `uppercase`), coluna de horas (`data-testid="time-row"`, texto `{slot.hour}h`), faixa fora do expediente `backgroundColor: "#DDE7F3"`, slots com `border-neutral-200` (hora cheia) / `border-neutral-100 border-dashed` (meia hora), linha da hora atual `bg-error-500`.
- `TimeBlockOverlay.tsx`: usa `TIME_BLOCK_KINDS[].className` de `operations-labels.ts` (folga slate, intervalo amber, feriado rose, indisponibilidade sky, deslocamento amber) + `border-l-4`.
- `SchedulePage.tsx` ~880-1140: barra superior (setas `Dia anterior/Próximo dia`, data, `view-day`/`view-week`, busca, "Agendar" com `bg-error-500`, "Bloquear horário" `block-open`, "Filtros" `filters-open`, `prof-avatars` com botões `rounded-full`), `InlineCalendar` com dias `rounded-full`, chips `rounded-full` nas linhas ~285, ~327, ~356, botão de recolher filtros com `shadow`.
- `lib/format-name.ts`: `toDisplayName(raw)`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Referências do Stitch, cores de status e bloco de agendamento/bloqueio</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-computador.png, apps/frontend/src/features/operations/lib/appointment-status-style.ts, apps/frontend/src/features/operations/lib/operations-labels.ts, apps/frontend/src/features/operations/components/calendar/types.ts, apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts, apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx, apps/frontend/src/features/operations/components/calendar/TimeBlockOverlay.tsx, apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx</files>
  <read_first>
    - .planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-mobile.png e agenda-dia-mobile.html (bloco `article`, selo de status, linha da hora atual)
    - .planning/phases/06-novo-layout-gestor-beauty/design/agenda-multi-profissional-desktop.html
    - apps/frontend/src/features/operations/components/calendar/types.ts, appointment-statuses.ts, AppointmentCard.tsx, TimeBlockOverlay.tsx
    - apps/frontend/src/features/operations/lib/operations-labels.ts
    - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx e week-grid.test.tsx
  </read_first>
  <behavior>
    - `statusSpineColor('scheduled')` = `'#570080'`, `'confirmed'` = `'#1B7A43'`, `'in_progress'` = `'#0E61A8'`, `'completed'` = `'#49454F'`, `'no_show'` e `'cancelled'` = `'#BA1A1A'`, desconhecido = `'#6B6670'`.
    - `getAppointmentStyle` devolve `backgroundColor: '#FFFFFF'` e `borderLeft: '3px solid <cor do status>'`, com `top` e `height` idênticos aos de hoje.
    - `AppointmentCard` renderiza o nome com `font-serif` e `toDisplayName` ("maria silva" → "Maria Silva"), o serviço, e `data-testid="appointment-card-time-<id>"` com o texto `09:00 - 10:30 • 90 min` e `tabular-nums`; o card tem `bg-white border border-neutral-200 rounded-md` e nenhuma classe `shadow`; o `aria-label` e o `data-testid` continuam iguais.
    - Com `durationMinutes >= 60`, o card mostra o selo `data-testid="appointment-card-status-<id>"` com o rótulo de `APPOINTMENT_STATUS_LABELS` e um ponto `h-1.5 w-1.5 rounded-full`.
    - `TimeBlockOverlay` tem `style.backgroundImage` com `repeating-linear-gradient(135deg` e classe `border-l-[3px]`; feriado com `border-error-500`, intervalo com `border-warning-500`, folga com `border-neutral-500`, indisponibilidade com `border-info-500`; sem classes `slate|amber|rose|sky`.
  </behavior>
  <action>
1. Baixar a referência que falta: com o MCP do Stitch, `mcp__stitch__download_file` `name: projects/5888991241990799272/screens/6e515928b7ed4e6ab4e502ec268d71a6/fileEntries/screenshot` → salvar em `.planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-computador.png` (o HTML do computador e o HTML/PNG do celular já estão em `design/`). Abrir (Read) as duas imagens antes de mexer no código.
2. Escrever `agenda-gestor-beauty.test.tsx` (falha antes).
3. Criar `features/operations/lib/appointment-status-style.ts`: `export const STATUS_SPINE_COLORS: Record<string, string> = { scheduled: '#570080', confirmed: '#1B7A43', in_progress: '#0E61A8', completed: '#49454F', no_show: '#BA1A1A', cancelled: '#BA1A1A' };` e `export function statusSpineColor(status: string): string` (fallback `'#6B6670'`).
4. `types.ts` `getAppointmentStyle`: `backgroundColor: "#FFFFFF"`, `borderLeft: \`3px solid ${statusSpineColor(appt.status)}\`` (top/height sem mudança). `appointment-statuses.ts`: `color` de cada status = `STATUS_SPINE_COLORS` (absent fica `#E2DFE5`/`#221E26`).
5. `AppointmentCard.tsx` (D-11, D-19, 06-UI-SPEC "Bloco de agendamento"): classes `"absolute left-1 right-1 rounded-md border border-neutral-200 bg-white px-[12px] py-[6px] overflow-hidden z-10 transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"` (a borda esquerda vem do `style`; padding menor que 10×14 para caber no slot de 30 min); arrastando: `"z-30 cursor-grabbing opacity-90 outline outline-[1.5px] outline-primary-500"` (DESIGN.md: elevação por contorno, sem sombra). Conteúdo: linha 1 `flex items-start justify-between gap-xs` com nome `<p className="truncate font-serif text-[15px] font-semibold leading-5 text-neutral-800">{toDisplayName(clientName)}</p>` e, se `durationMinutes >= 60`, selo `<span data-testid={\`appointment-card-status-${id}\`} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 text-[11px] font-semibold leading-5 text-neutral-800"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusSpineColor(status) }} />{APPOINTMENT_STATUS_LABELS[status] ?? status}</span>`; linha 2 serviço `truncate text-[12px] leading-4 text-neutral-500`; linha 3 `<p data-testid={\`appointment-card-time-${id}\`} className="truncate text-[12px] leading-4 tabular-nums text-neutral-500">{starts} - {ends} • {durationMinutes} min</p>`. Tooltip: tirar `text-neutral-300` antigo e usar `text-white/80`.
6. `operations-labels.ts` `TIME_BLOCK_KINDS[].className`: folga `'border-neutral-500 text-neutral-800'`, intervalo `'border-warning-500 text-neutral-800'`, feriado `'border-error-500 text-neutral-800'`, indisponibilidade `'border-info-500 text-neutral-800'`, deslocamento `'border-warning-500 text-neutral-800'`. `TimeBlockOverlay.tsx`: classe base `"absolute left-0 right-0 z-[5] border-l-[3px] px-xs text-left text-[11px] font-semibold overflow-hidden"` e `style` com `backgroundImage: 'repeating-linear-gradient(135deg, #F4F3F0 0px, #F4F3F0 6px, #FFFFFF 6px, #FFFFFF 12px)'` (hachura do D-19; não é gradiente decorativo). Conferir em `WeekGrid.tsx` o uso do `className` de feriado (linha ~33) e manter funcionando.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/features/operations && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `ls .planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-computador.png` existe
    - `grep -n "statusSpineColor" apps/frontend/src/features/operations/components/calendar/types.ts` encontra o uso
    - `grep -nE "slate|amber|rose|sky" apps/frontend/src/features/operations/lib/operations-labels.ts` não encontra nada
    - `grep -n "shadow" apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx` não encontra nada
    - `agenda-gestor-beauty.test.tsx` passa e as suítes de `src/features/operations` continuam verdes
  </acceptance_criteria>
  <done>Blocos com borda de status, nome em serifa e horário tabular; bloqueios em hachura (D-11, D-19).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Grade do dia/semana e barra superior da agenda (linha do tempo, hora atual roxa, seletor de profissional, Agendar roxo)</name>
  <files>apps/frontend/src/features/operations/components/calendar/DayGrid.tsx, apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx, apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/__tests__/day-grid.test.tsx, apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx, apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx, WeekGrid.tsx
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (linhas 120-430 e 880-1273)
    - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx, ux-agenda-lote1.test.tsx, week-grid.test.tsx, schedule-permissions.test.tsx
    - apps/e2e/tests/ux-agenda-celular.spec.ts, agenda-dnd.spec.ts, ux-contraste.spec.ts
    - .planning/phases/06-novo-layout-gestor-beauty/design/agenda-dia-mobile.png e agenda-dia-computador.png
  </read_first>
  <behavior>
    - `day-grid.test.tsx`: a primeira `time-row` mostra `07:00` (era `7h`); meia hora sem rótulo.
    - `agenda-gestor-beauty.test.tsx` (acrescentar): cabeçalho da coluna do profissional tem o nome completo com `toDisplayName` em `font-serif` (sem `uppercase`) e `data-testid="lane-count-<id>"` com "2 atendimentos" quando há 2 agendamentos dele no dia ("1 atendimento" no singular); com a data de hoje, `data-testid="now-line"` existe, a linha tem `bg-primary` e o selo mostra a hora `HH:MM` com `tabular-nums`; nenhum elemento com `#DDE7F3`.
    - SchedulePage: botão "Agendar" tem `bg-primary` e `text-white` e não tem `bg-error-500`; cada botão de `prof-avatars` tem `rounded-md`, `min-h-[44px]`, `shrink-0` e o nome; `filters-open` tem o texto "Filtros".
    - `sem-cor-antiga.test.ts` passa a proibir `#DDE7F3` e `bg-error-500` em `SchedulePage.tsx`, e as entradas deste lote saem das listas de exceção criadas no 06-01: `features/operations/lib/operations-labels.ts` de `PALETA_PENDENTE`; `features/operations/components/calendar/AppointmentCard.tsx` e `features/operations/pages/SchedulePage.tsx` de `SOMBRA_PENDENTE` (o teste falha se ficarem sobrando).
  </behavior>
  <action>
1. Escrever/ajustar os testes (falham antes).
2. `DayGrid.tsx`:
   - Contêiner `"bg-white border border-neutral-200 m-md rounded-md overflow-hidden"`.
   - Cabeçalho das colunas `bg-neutral-50` (sticky, borda inferior `border-neutral-200`). Cada profissional: avatar `h-8 w-8 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold` com `pro.initials` (sem `pro.color`) e bloco `min-w-0` com `<span className="block truncate font-serif text-[14px] font-semibold leading-5 text-neutral-800">{toDisplayName(pro.name)}</span>` + `<span data-testid={\`lane-count-${pro.id}\`} className="block text-[11px] leading-4 tabular-nums text-neutral-500">{n} {n === 1 ? 'atendimento' : 'atendimentos'}</span>` (n = agendamentos do profissional já recebidos em `appointments`).
   - Coluna de horas: `{slot.minute === 0 && <span className="text-data tabular-nums text-neutral-500">{String(slot.hour).padStart(2, '0')}:00</span>}`; linhas `border-neutral-200`.
   - Slots: hora cheia `"border-neutral-200"`, meia hora `"border-neutral-200 border-dashed"`; hover `hover:bg-primary-50/40`.
   - Faixas fora do expediente: `backgroundColor: "#F4F3F0"`.
   - Hora atual (`data-testid="now-line"`): `<span className="ml-[4px] rounded-md bg-primary px-1 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-white">{formatHM(now)}</span><div className="flex-1 h-[1.5px] bg-primary" />` (D-19, roxo no lugar do vermelho).
3. `WeekGrid.tsx`: contêiner `rounded-md` (era `rounded-lg`); cabeçalho do dia `text-overline uppercase text-neutral-500 hover:bg-neutral-50`; card da semana (`week-card-*`) `w-full text-left rounded-md border border-neutral-200 bg-white px-xs py-xs text-xs hover:bg-neutral-50 truncate` com `style={{ borderLeft: \`3px solid ${statusSpineColor(a.status)}\` }}` e nome em `font-serif`.
4. `SchedulePage.tsx`:
   - "Agendar" (linha ~1010): tirar `bg-error-500 hover:bg-error-700 text-white` e usar o variant padrão (`bg-primary text-white`), texto "Agendar" igual.
   - Título da data no modo dia: `font-serif text-headline-sm text-neutral-800` com a data `{selectedDate.getDate()} {mês curto} {ano}` como hoje, e o dia da semana em `text-overline uppercase text-neutral-500`.
   - `prof-avatars` (D-19, UX-02): cada botão `"shrink-0 flex items-center gap-xs rounded-md min-h-[44px] min-w-[44px] px-2.5 border transition-colors"` + visível `"bg-neutral-100 border-neutral-200 text-neutral-800"` / oculto `"bg-white border-transparent text-neutral-500"` (tirar `opacity-30`, `rounded-full`, `md:min-h-0`, `md:-space-x-2`); avatar interno `h-7 w-7 rounded-full` visível `bg-primary text-white` / oculto `bg-neutral-100 text-neutral-600`; nome `truncate max-w-[120px] text-label` visível em todos os tamanhos; manter `aria-label`, `aria-pressed`, `title`. Contador "+N" `rounded-md`.
   - Botões de seta e o de olho: `h-11 w-11` em todos os tamanhos (tirar `md:h-8 md:w-8`).
   - Busca: `Input` sem `h-9 text-sm` (usa os 44 px do componente).
   - `filters-open`: manter texto "Filtros" e ícone `SlidersHorizontal`.
   - Chips/pílulas (linhas ~183, ~285, ~327, ~356) e dias do `InlineCalendar`: `rounded-full` → `rounded-md`; selecionado `bg-primary text-white`, não selecionado `bg-white border-neutral-200 text-neutral-800`.
   - Botão de recolher filtros (linha ~916): tirar `shadow`.
   - Fundo da área principal `bg-neutral-50` (tirar `bg-neutral-50/30`); barra superior `bg-white border-b border-neutral-200`.
   - Não renderizar nenhum texto do design que não existe no SGS (D-02).
5. `sem-cor-antiga.test.ts`: acrescentar `#DDE7F3` à lista de hex proibidos e a regra de `bg-error-500` em `SchedulePage.tsx`; remover `'features/operations/lib/operations-labels.ts'` de `PALETA_PENDENTE` e `'features/operations/components/calendar/AppointmentCard.tsx'` e `'features/operations/pages/SchedulePage.tsx'` de `SOMBRA_PENDENTE` (a Task 1 já tirou a paleta de `operations-labels.ts` e a sombra do `AppointmentCard`; o passo 4 tira a do `SchedulePage`). Se `SOMBRA_PENDENTE` ficar vazio, manter o objeto vazio `{}`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "DDE7F3" apps/frontend/src/features/operations/components/calendar/DayGrid.tsx` não encontra nada
    - `grep -n "bg-error-500" apps/frontend/src/features/operations/pages/SchedulePage.tsx` não encontra nada
    - `grep -n "rounded-full" apps/frontend/src/features/operations/pages/SchedulePage.tsx` só encontra avatares (`h-7 w-7` / `h-8 w-8`)
    - `grep -n "now-line" apps/frontend/src/features/operations/components/calendar/DayGrid.tsx` encontra o testid
    - `grep -nE "operations-labels|AppointmentCard|SchedulePage" apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts` só encontra a regra de `bg-error-500` do `SchedulePage` (nenhuma entrada nas listas de exceção)
    - Vitest inteiro do frontend passa (inclui `ux-agenda-lote1.test.tsx`), lint e typecheck verdes
  </acceptance_criteria>
  <done>Agenda do dia no celular e no computador com a cara do Gestor Beauty (D-19).</done>
</task>

<task type="auto">
  <name>Task 3: Gate completo, comparação com o Stitch, commit, push, deploy no staging e CI verde</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-03-SUMMARY.md</files>
  <read_first>
    - scripts/deploy-staging.sh
    - apps/e2e/playwright.audit.config.ts e apps/e2e/audit/telas.audit.ts
  </read_first>
  <action>
1. Na raiz `/root/sgs`, gate completo (só seguir com tudo verde): `corepack pnpm -r typecheck`, `corepack pnpm -r --if-present lint`, `corepack pnpm --filter @sgs/backend test`, `corepack pnpm --filter @sgs/backend test:integration` (aceitas só as falhas locais conhecidas de Redis `NOAUTH`), `corepack pnpm --filter @sgs/frontend exec vitest run`, `corepack pnpm --filter @sgs/e2e test:e2e`. Falha causada por este lote: corrigir (ajustar só seletor que dependia de estilo; `data-testid` e papéis ARIA ficam). Falha antiga em arquivo não tocado: registrar em `deferred-items.md` da fase e não corrigir.
2. Comparação com o Stitch (D-24): `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-03 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts --grep "01-agenda-dia|02-agenda-semana|04-agenda-detalhe"`. Abrir (Read) `desktop/01-agenda-dia.png` e `mobile/01-agenda-dia.png` ao lado de `design/agenda-dia-computador.png` e `design/agenda-dia-mobile.png`. Registrar em `06-03-SUMMARY.md` a seção `## Comparação com o Stitch` (tabela: bloco do design | como ficou | omitido por D-02?) e corrigir divergência visual dentro do escopo antes do commit.
3. Commit (arquivos um a um, nunca `git add .`; incluir o PNG baixado): `feat(06-03): agenda do dia no layout Gestor Beauty`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
4. `git push origin master`.
5. Sem migration. `./scripts/deploy-staging.sh`.
6. `gh run watch $(gh run list --branch master --limit 1 --json databaseId -q '.[0].databaseId') --exit-status` até verde (máximo 3 tentativas de correção; depois registrar em Deferred Issues do SUMMARY e parar).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/frontend exec vitest run && gh run list --branch master --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success</automated>
  </verify>
  <acceptance_criteria>
    - Commit com assunto começando em `feat(06-03)` em `origin/master`
    - `06-03-SUMMARY.md` tem `## Comparação com o Stitch` citando os blocos omitidos por D-02
    - Deploy sem erro e `gh run watch` com sucesso
  </acceptance_criteria>
  <done>Agenda do dia no staging com CI verde.</done>
</task>

</tasks>

<verification>
- Testes da agenda (novos e da fase 5) verdes, gate completo, screenshots comparados, deploy e CI verdes
</verification>

<success_criteria>
Lote Agenda do dia entregue no staging, sem regressão de UX-01, UX-02 e UX-05.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-03-SUMMARY.md`
</output>

<addendum date="2026-11-06" source="decisão da usuária (D-25)">
Passo extra, dentro da tarefa de implementação da Agenda: remover de `apps/frontend/src/features/operations/pages/SchedulePage.tsx` o bloco `{/* Footer institucional (estilo Trinks) */}` inteiro (o `<footer>` com a nav "Links institucionais" — Meu site, SGS Ajuda, Blog, Fale conosco, Contato — e os ícones Facebook, Instagram, YouTube, LinkedIn), e os imports lucide que ficarem sem uso (Facebook, Instagram, Youtube, Linkedin). Teste Vitest no `agenda-gestor-beauty.test.tsx`: a Agenda renderizada não tem `navigation` com nome "Links institucionais" nem o texto "Fale conosco".
Acceptance: `grep -n "Links institucionais\|Fale conosco" apps/frontend/src/features/operations/pages/SchedulePage.tsx` não acha nada. (`pages/DashboardPlaceholder.tsx` não está em nenhuma rota e fica fora deste passo.)
</addendum>


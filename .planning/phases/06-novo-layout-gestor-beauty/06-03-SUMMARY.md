---
phase: 06-novo-layout-gestor-beauty
plan: 03
subsystem: frontend-ui
tags: [agenda, gestor-beauty, status, linha-do-tempo, hachura]
requires: [06-01, 06-02]
provides:
  - lib/appointment-status-style.ts (STATUS_SPINE_COLORS, statusSpineColor)
  - Bloco de agendamento branco com borda de status de 3 px, nome em serifa, horário tabular e selo de status (D-11, D-19)
  - Bloqueio de horário em hachura neutra com borda na cor do tipo
  - Grade do dia com horas "07:00", linha cheia na hora e tracejada na meia hora, faixa fora do expediente em papel neutro, hora atual roxa com o horário (now-line)
  - Cabeçalho da coluna com nome em serifa e "N atendimentos" (lane-count-<id>)
  - Barra da agenda com "Agendar" roxo, seletor de profissional em botões de 44 px com avatar e nome, filtros em selos de 6 px
  - Rodapé institucional removido (D-25)
affects: [06-04, 06-09]
tech-stack:
  added: []
  patterns:
    - "Borda da grade no topo do slot (border-t): a linha cheia cai na hora cheia e a tracejada na meia hora"
    - "data-testid interno do card não pode começar com appointment-card- (E2E usa o prefixo); teste de contrato no agenda-gestor-beauty"
key-files:
  created:
    - apps/frontend/src/features/operations/lib/appointment-status-style.ts
    - apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx
  modified:
    - apps/frontend/src/features/operations/components/calendar/types.ts
    - apps/frontend/src/features/operations/components/calendar/appointment-statuses.ts
    - apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx
    - apps/frontend/src/features/operations/components/calendar/TimeBlockOverlay.tsx
    - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx
    - apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx
    - apps/frontend/src/features/operations/lib/operations-labels.ts
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
    - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx
    - apps/frontend/src/features/operations/__tests__/week-grid.test.tsx
    - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
    - apps/frontend/src/__tests__/router.test.tsx
decisions:
  - "Selo e horário do card com data-testid appointment-status-<id> e appointment-time-<id> (o plano dizia appointment-card-status/time, que colidia com o seletor de prefixo do E2E)"
  - "Referência do computador usada como design/agenda-multi-profissional-desktop.png (já versionada); não foi criada cópia agenda-dia-computador.png"
  - "Filtros de status com aria-pressed e riscados quando desligados; chips de profissional/fechamento com 44 px em todos os tamanhos"
  - "Um único commit de código depois do gate completo (regra do projeto)"
metrics:
  duration: 95min
  completed: 2026-11-06
  tasks: 3
  files: 14
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 03: Agenda do dia no layout Gestor Beauty — Resumo

A Agenda do dia (celular e computador) ganhou a cara do Gestor Beauty: blocos brancos com borda
esquerda na cor do status, nome da cliente em serifa e horário "09:00 - 10:30 • 90 min" em números
tabulares, bloqueios em hachura neutra, horas "07:00" na margem, hora atual em roxo com o horário
escrito, colunas com o nome da profissional em serifa e a contagem do dia, e "Agendar" como a ação
principal roxa. O rodapé institucional saiu (D-25). Consultas, arrastar e soltar, permissões e
`data-testid` antigos continuam iguais.

## O que foi feito

**Task 1: cores de status, bloco e bloqueio.** `lib/appointment-status-style.ts` com
`STATUS_SPINE_COLORS` (Agendado `#570080`, Confirmado `#1B7A43`, Em atendimento `#0E61A8`,
Concluído `#49454F`, Faltou/Cancelado `#BA1A1A`) e `statusSpineColor` (fallback `#6B6670`).
`getAppointmentStyle` devolve fundo branco e `borderLeft` na cor do status; `top`/`height` iguais
(o E2E de arrastar não mudou). `appointment-statuses.ts` usa as mesmas cores. `AppointmentCard`:
`bg-white border border-neutral-200 rounded-md`, padding 6 × 12, nome com `toDisplayName` em
`font-serif` 15 px, serviço 12 px, horário tabular, selo de status (ponto de 6 px) a partir de
60 min, arrastando com contorno roxo de 1,5 px (sem sombra), tooltip `text-white/80`.
`TIME_BLOCK_KINDS` sem paleta padrão (borda neutral/warning/error/info, texto neutral-800) e
`TimeBlockOverlay` com `border-l-[3px]` e hachura `repeating-linear-gradient(135deg …)`.

**Task 2: grade e barra.** `DayGrid`: contêiner `rounded-md`, cabeçalho `bg-neutral-50` com avatar
`bg-primary-50`, nome completo em serifa (sem maiúsculas) e `lane-count-<id>` ("1 atendimento",
"N atendimentos", a partir dos agendamentos já carregados); horas `07:00` em `text-data
tabular-nums`; borda no topo do slot (cheia na hora, tracejada na meia hora); faixa fora do
expediente `#F4F3F0`; `now-line` com selo roxo `HH:MM` e linha roxa de 1,5 px. `WeekGrid`: cabeçalho
do dia em overline de 44 px, card branco com borda do status e nome em serifa, selo de feriado em
selo de 6 px. `SchedulePage`: "Agendar" no variant padrão (roxo, texto branco); data em serifa com o
dia da semana em overline; setas e olho de 44 px em todos os tamanhos; busca de 44 px;
`prof-avatars` em botões `rounded-md` de 44 px com avatar e nome curto (visível no computador
também); calendário lateral com dias `rounded-md` e selecionado roxo; atalhos do painel como botões
brancos de 44 px com ícone cinza (sem quadrado colorido); chips "Todos"/profissional/fechamento
`rounded-md` de 44 px, selecionado roxo; status em selos de 6 px com ponto e `aria-pressed`;
títulos das seções do painel em overline; selects do "Buscar e Agendar" com `NATIVE_SELECT_CLASS`;
cabeçalhos roxos do modal "Seleção de Profissionais" viraram `bg-neutral-100` em overline (D-06);
fundo `bg-neutral-50`; botão de recolher sem sombra. Adendo D-25: o `<footer>` "Links
institucionais" e os imports Facebook/Instagram/Youtube/Linkedin saíram.
`sem-cor-antiga.test.ts`: `#DDE7F3` proibido, regra nova contra `bg-error-500` na `SchedulePage`,
`operations-labels.ts` fora de `PALETA_PENDENTE` e `SOMBRA_PENDENTE` vazio (`{}`).

**Task 3: gate, comparação, commit, deploy e CI.**

## Resultados do gate (antes do commit)

| Comando | Resultado |
|---------|-----------|
| `corepack pnpm -r typecheck` | verde |
| `corepack pnpm -r --if-present lint` | verde (0 avisos) |
| `corepack pnpm --filter @sgs/backend test` | 32 suítes, 367 testes verdes |
| `corepack pnpm --filter @sgs/backend test:integration` | 55/56 suítes, 599/601; as 2 falhas são `phase4-alerts-boot` com `ReplyError: NOAUTH Authentication required` (Redis local, aceita) |
| `corepack pnpm --filter @sgs/frontend exec vitest run` | 87 arquivos, 598 testes verdes (+1 teste de contrato depois: 19 no `agenda-gestor-beauty`) |
| `corepack pnpm --filter @sgs/e2e test:e2e` | 1ª rodada: 37 passaram, 1 falhou (`fluxo-agendamento-comanda-pagamento.spec.ts:74`, desvio 1, real); depois da correção: 38 passaram, 0 falhas (6,3 min) |

Commit `2f8e2fe` em `origin/master`, `./scripts/deploy-staging.sh` concluído (backend e frontend OK,
https://sgs.jessicaseixasmakeup.com.br), CI run `42283427267` verde (lint, typecheck, integration,
e2e, boot-time, frontend-codegen). Sem migration.

## Comparação com o Stitch

Screenshots locais em `06-audit-evidence/06-03/` (ignorado pelo git; `AUDIT_TARGET=local`,
7 passaram) comparados com `design/agenda-dia-mobile.png` e
`design/agenda-multi-profissional-desktop.png`. O seed do E2E não tem agendamento no dia da
auditoria; os blocos foram conferidos pelos testes e pelo card da semana.

| Bloco do design | Como ficou | Omitido por D-02? |
|-----------------|-----------|-------------------|
| Botão "+ Novo agendamento" roxo | "+ Agendar" roxo com texto branco (nome acessível "Agendar" mantido pelo E2E) | não |
| Data do dia em serifa | "6 nov 2026" em Source Serif com "SEXTA-FEIRA" em overline | não |
| "AGENDA DIÁRIA" / "AGENDA OPERACIONAL DE BANCADAS" | Fora | sim (bancadas) |
| Ontem / Hoje / Amanhã + data | Setas Dia anterior/Próximo dia + calendário lateral (já existiam) | não (navegação do SGS mantida) |
| Dia / Semana segmentado | `view-day`/`view-week`, selecionado roxo com texto branco (UX-01) | não |
| Celular: seletor de profissional com avatar e nome, 44 px | Igual, botões `rounded-md` com avatar roxo e nome curto ("E2e P.") | não |
| "4 CLIENTES" no botão de profissional (celular) | Fora do botão; a contagem aparece no cabeçalho da coluna | parcial |
| Botão de filtros | "Filtros" com texto e ícone (UX-02) | não |
| "FILTROS ATIVOS: Equipe/Estações", "Exibir Bloqueios Internos" | Fora; filtros ficam no painel lateral/folha | sim (estações) |
| Legenda de status em quadradinhos | Filtros de status em selos de 6 px com ponto de 6 px | não |
| Colunas por profissional com nome em serifa e "4 atend." | Nome completo em serifa + "N atendimentos" em 11 px tabular | não |
| Selo de verificado e especialidade ("Especialista Noivas…") | Fora | sim (não existe dado) |
| Horas na margem "08:00", linha cheia/tracejada | "07:00" tabular, cheia na hora e tracejada na meia hora | não |
| Indicador roxo "10:45 Agora" | Selo roxo "HH:MM" com linha roxa de 1,5 px (só no dia de hoje) | não ("Agora" não entrou) |
| Bloco: borda de status, nome em serifa, serviço, "09:00 - 10:30 • 90 min", selo | Igual (selo só a partir de 60 min para caber no slot de 30 min) | não |
| "CADEIRA 01", "SALA VIP NOIVAS", "BANCADA 02", valores R$ no bloco | Fora | sim |
| "Horário livre", "Preparação de bancada", "Higienização e assepsia", "Horário disponível" | Fora | sim |
| Almoço/intervalo em hachura | Bloqueios em hachura neutra com borda na cor do tipo | não |
| Painel "Bancadas & Ocupação", "Lista de Espera", "Bloqueio Técnico" | Fora; o painel lateral do SGS (calendário, atalhos, filtros) segue os tokens novos | sim |
| "SISTEMA OPERACIONAL", "10:42 BRT", "Atelier Jardins • Matriz", "ONLINE" | Fora (casco, 06-02) | sim |
| Rodapé "Meu site / SGS Ajuda / Blog / Fale conosco / Contato" + redes | Removido (não existe no design) | D-25 |

Nenhuma divergência visual pendente dentro do escopo.

## Desvios do plano

### Corrigidos automaticamente

**1. [Regra 1 - Bug] `data-testid` internos colidiam com o seletor de prefixo do E2E**
- **Encontrado na:** Task 3 (gate E2E, `fluxo-agendamento-comanda-pagamento.spec.ts:74`).
- **Problema:** o plano pedia `appointment-card-status-<id>` e `appointment-card-time-<id>`; o E2E
  (e `agenda-dnd`, `noivas-contrato`, auditorias) conta `[data-testid^="appointment-card-"]` e achou
  3 elementos por card.
- **Correção:** `appointment-status-<id>` e `appointment-time-<id>`, e teste de contrato que exige um
  único `appointment-card-*` por card.

**2. [Regra 3 - Bloqueio] `router.test.tsx` quebrado desde o 06-02**
- **Problema:** 9 testes falhavam no master com "Found multiple elements with the role link and
  name 'SGS — início'": o desvio 1 do 06-02 deu esse nome à marca do menu lateral depois da rodada do
  Vitest, e o jsdom renderiza o menu e o topo do celular juntos. O CI não roda o Vitest do frontend,
  por isso passou.
- **Correção:** o teste procura `getByTestId('sidebar-brand')` com nome acessível "SGS — início".

**3. [Regra 1] Linha cheia na hora cheia**
- Com `border-b`, as classes do plano punham a linha cheia na meia hora. A borda passou para o
  topo do slot (`border-t`), mesmo `data-testid` e mesma altura (o E2E de arrastar passou).

**4. Referência do computador**
- O PNG já estava em `design/agenda-multi-profissional-desktop.png` (versionado); não foi criada a
  cópia `agenda-dia-computador.png` pedida no passo de download.

**5. [Regra 2] Itens extras na `SchedulePage`**
- Cabeçalhos roxos (`bg-primary-700`) do modal "Seleção de Profissionais", atalhos com quadrado
  colorido e selects nativos de 36 px foram para o visual novo (D-06, D-10). `week-grid.test.tsx`
  passou a ler o texto do card inteiro (hora, nome e serviço agora em trechos separados).

**6. Commit único em vez de um por tarefa** (gate completo antes de commit, regra do projeto).

## Para o 06-04

- O botão "Agendar" é o variant padrão do `Button` (`bg-primary text-white`, 44 px); o
  `VisitFormDialog` abre igual. `ux-agenda-celular.spec.ts` (UX-03) mede a folha no celular.
- `statusSpineColor` está em `features/operations/lib/appointment-status-style.ts` para reuso.
- Nenhum `data-testid` novo pode começar com `appointment-card-` (o E2E conta por prefixo).
- `SOMBRA_PENDENTE` está vazio e `PALETA_PENDENTE` só tem `BridalGroupDetailPage.tsx` (06-09).
- `router.test.tsx` foi consertado; o Vitest do frontend não roda no CI, então o gate local é a única
  rede para ele.
- `BuscarAgendarModal` e `SelecaoProfissionaisModal` da `SchedulePage` ainda têm cabeçalho próprio
  em `text-sm font-bold uppercase` e botão fechar `h-8 w-8`; se o 06-04 mexer nos diálogos, alinhar.

## Stubs conhecidos

Nenhum.

## Self-Check: PASSED

- Arquivos criados conferidos: `appointment-status-style.ts`, `agenda-gestor-beauty.test.tsx`.
- Greps de aceite: sem `#DDE7F3` no `DayGrid`, sem `bg-error-500`/"Links institucionais"/"Fale
  conosco" na `SchedulePage`, sem `slate|amber|rose|sky` em `operations-labels.ts`, sem `shadow` no
  `AppointmentCard`; `rounded-full` na `SchedulePage` só no avatar `h-7 w-7` e no ponto de status.
- Commit `2f8e2fe` em `origin/master`; CI run `42283427267` com sucesso.

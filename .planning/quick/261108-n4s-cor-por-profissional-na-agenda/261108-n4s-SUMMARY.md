---
phase: quick-261108-n4s
plan: 01
subsystem: frontend/agenda
tags: [agenda, cor-por-profissional, acessibilidade, nome-completo]
requires: []
provides:
  - "Paleta de 12 tons claros e mapa estável id → tom (professional-colors.ts)"
  - "Cartão do Dia e da Semana com fundo na cor da profissional (variáveis CSS --appt-bg/--appt-bg-hover)"
  - "Nome completo da profissional no filtro lateral, nos chips da barra e no cabeçalho da coluna"
affects:
  - apps/frontend/src/features/operations (agenda)
  - apps/e2e/tests (agenda-cor-profissional, ux-agenda-celular)
tech-stack:
  added: []
  patterns:
    - "Fundo por variável CSS + classe bg-[var(--appt-bg,#FFFFFF)] para o hover da classe continuar valendo"
    - "Atribuição por posição em lista ordenada por id (UUID v7), sem hash"
key-files:
  created:
    - apps/frontend/src/features/operations/lib/professional-colors.ts
    - apps/frontend/src/features/operations/lib/__tests__/professional-colors.test.ts
    - apps/e2e/tests/agenda-cor-profissional.spec.ts
  modified:
    - apps/frontend/src/features/operations/components/calendar/types.ts
    - apps/frontend/src/features/operations/components/calendar/AppointmentCard.tsx
    - apps/frontend/src/features/operations/components/calendar/DayGrid.tsx
    - apps/frontend/src/features/operations/components/calendar/WeekGrid.tsx
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx
    - apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx
    - apps/frontend/src/features/operations/__tests__/day-grid.test.tsx
    - apps/frontend/src/features/operations/__tests__/week-grid.test.tsx
    - apps/e2e/tests/ux-agenda-celular.spec.ts
decisions:
  - "Cor vem da lista completa de membros isProfessional (antes do filtro ownOnly e dos chips), ordenada por id v7"
  - "Paleta de 12 tons do plano mantida sem ajuste: todos passam no teste de contraste AA"
  - "Texto secundário do cartão (serviço/horário, e horário da Semana) passa de neutral-500 para neutral-600 por AA sobre o fundo colorido"
metrics:
  completed: 2026-11-08
---

# Quick 261108-n4s: Cor automática e nome completo da profissional na agenda — Resumo

Cada profissional ganha automaticamente um tom claro (paleta de 12, sem repetir até a 12ª, por posição na lista ordenada por id v7) usado no fundo do cartão nas vistas Dia e Semana e na bolinha das iniciais; a borda esquerda continua sendo a cor do status. Em toda a agenda a profissional aparece pelo nome completo.

## O que foi feito

**Paleta e atribuição** (`lib/professional-colors.ts`)
- 12 tons (fundo / hover / bolinha), na ordem do plano: lilás, verde, azul, âmbar, rosa, turquesa, laranja, índigo, lima, fúcsia, ciano, areia. `NEUTRAL_TONE` mantém o visual antigo (branco, hover #F9FAFB, bolinha primary-50).
- `buildProfessionalToneMap(ids)`: tira duplicados, ordena uma cópia com comparação simples de string e dá `PROFESSIONAL_TONES[i % 12]`. Mesma entrada em qualquer ordem gera o mesmo mapa.
- Teste de contraste WCAG no vitest: #1F2937 e #4B5563 sobre todo fundo e todo hover ≥ 4,5:1; #1F2937 sobre toda bolinha ≥ 4,5:1; hover ≠ fundo. Nenhum tom precisou de ajuste.

**Cartões e grade**
- `getAppointmentStyle(appt, slotHeight, tone = NEUTRAL_TONE)` não devolve mais `backgroundColor`: devolve `--appt-bg`/`--appt-bg-hover`. O `AppointmentCard` e o `week-card` usam `bg-[var(--appt-bg,#FFFFFF)] hover:bg-[var(--appt-bg-hover,#F9FAFB)]`, então o hover voltou a funcionar (antes o inline branco anulava o `hover:bg-neutral-50`).
- DayGrid: a bolinha do cabeçalho (`lane-avatar-{id}`) usa `avatarBg` com texto neutral-800; o nome completo quebra linha (`whitespace-normal break-words`) em vez de ser cortado com `truncate`.
- WeekGrid: nova prop opcional `toneByProfessional`; o SchedulePage passa o mesmo mapa usado no Dia.

**Nome completo (adendo)**
- Filtro lateral "Nome do profissional": uma linha por profissional (bolinha na cor dela + `toDisplayName(pro.name)`), `min-h-[44px]`; `aria-pressed` e `aria-label` "`<nome> — visível|oculto`" iguais aos de antes.
- Chips da barra (`prof-avatars`): nome completo com `whitespace-nowrap` (a barra já rola na horizontal); a bolinha visível usa a cor da profissional. `shortProfessionalName` saiu do SchedulePage, mas a função e o teste dela continuam (o operational-dashboard usa).

## Fonte da lista e comportamento por papel

- O mapa vem de todos os membros com `isProfessional` do `MembersQuery`, ANTES do filtro `ownOnly` e independente dos chips: ocultar uma profissional ou trocar Dia/Semana não muda a cor de ninguém.
- Papel PROFESSIONAL: o resolver `members` (`apps/backend/src/identity/members.resolver.ts`) devolve todos os membros ativos para qualquer papel com MEMBER_READ. Então a profissional vê na própria agenda a mesma cor que o gestor vê para ela (não cai sempre no tom 1).
- Ressalva: `members` só traz membros ATIVOS. Ao desativar uma profissional, as cadastradas depois dela andam uma posição e mudam de cor. Não mexi nisso (exigiria guardar a cor ou listar também os inativos).

## Desvios do plano

1. **[Regra 1 - Bug] `shrink-0` no botão de linha do filtro lateral.** O teste existente `ux-agenda-lote1.test.tsx` ("os botões de profissional não encolhem abaixo de 44 px (shrink-0)") falhou com o novo layout. Pus `shrink-0` na classe do botão de linha, o que também evita que ela seja comprimida na altura dentro do `flex-col`. O teste ficou como estava.
2. **Ordem RED/GREEN.** Os testes novos de day-grid e week-grid (Tasks 2 e 3) foram escritos e vistos falhando antes da implementação. O teste novo do filtro lateral em agenda-gestor-beauty foi escrito logo depois de implementar o SchedulePage, então não teve uma rodada vermelha separada.
3. **Tipagem do style na Semana.** Usei `const style: AppointmentStyle` (tipo exportado de `types.ts`) em vez de `satisfies`/cast no JSX, porque o `satisfies` dentro do atributo dava TS2353.
4. Um commit só no fim (como mandava a Task 3), em vez de commits por tarefa.

## Pendências registradas

- `apps/e2e/audit/ux-agenda-celular-staging.audit.ts` (auditoria de staging, fora do gate) ainda espera o nome curto (`/^\S+( \S\.)?$/`). Não foi alterada, como manda o plano.

## Gate

Rodado em 2026-11-10, antes do commit:

| Etapa | Resultado |
|---|---|
| `pnpm -r typecheck` (backend, frontend, e2e) | ok |
| `pnpm -r --if-present lint` | ok |
| vitest frontend | 99 arquivos, 719 testes ok |
| jest unitário backend | 34 suítes, 382 testes ok |
| jest integração backend | 56 suítes, 609 testes ok |
| Playwright E2E | 44 testes ok |

Observação: a primeira rodada da integração teve 2 falhas em `phase4-alerts-boot` por timeout. A causa foi do ambiente: o Valkey de dev estava publicado em 0.0.0.0:6379 sem senha e alguém de fora configurou uma `requirepass`. O compose de dev passou a ligar as portas só em 127.0.0.1 (commit separado), o Valkey foi recriado com volume limpo e a nova rodada passou inteira.

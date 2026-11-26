---
phase: 11
slug: prioridade-de-profissionais-e-cronograma-da-noiva
status: green
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-26
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> IDs de requisito: PRIO-01..PRIO-16 (ver `11-RESEARCH.md` › Proposed Requirements e `REQUIREMENTS.md`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29 + ts-jest (backend unit e integração), vitest (frontend), Playwright (`@sgs/e2e`) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/backend/jest-integration.config.ts`, `apps/frontend/vitest.config.ts`, `apps/e2e/playwright.config.ts` |
| **Quick run command** | `cd apps/backend && npx jest --config jest.config.ts src/scheduling src/bridal/ai src/bridal/timeline` / `cd apps/frontend && npx vitest run src/features/identity src/features/bridal src/features/operations src/pages/__tests__/profissionais-page.test.tsx` |
| **Full suite command** | lint + typecheck + `pnpm --filter @sgs/backend test` + `pnpm --filter @sgs/backend test:integration` + `pnpm --filter @sgs/frontend test` + `pnpm --filter @sgs/e2e test:e2e` |
| **Estimated runtime** | unit < 30 s por módulo; suíte completa ~15–25 min |

---

## Sampling Rate

- **After every task commit:** comando rápido da camada tocada
- **After every plan wave:** unit backend + vitest completos + integração `phase11-*`, `phase42-*`, `phase4-ai-schedule`
- **Before `/gsd:verify-work`:** gate completo + Playwright verdes
- **Max feedback latency:** 60 seconds (comando rápido)

---

## Per-Task Verification Map

| Req | Comportamento | Tipo | Comando / arquivo | File Exists | Status |
|-----|---------------|------|-------------------|-------------|--------|
| PRIO-01 | `isFixed`/`servesBridal` no Member, default false, API | integração | `test/integration/phase11-members-flags.e2e.spec.ts` | ✅ | ✅ green |
| PRIO-02 | diálogos e tela Profissionais | vitest | `member-dialogs.test.tsx`, `profissionais-page.test.tsx` | ✅ | ✅ green |
| PRIO-03 | ranking puro e determinístico | unit | `src/scheduling/professional-ranking.spec.ts` | ✅ | ✅ green |
| PRIO-04 | ordenação fixas primeiro (back/front) | unit | mesmo spec + `professional-order.test.ts` | ✅ | ✅ green |
| PRIO-05 | minutos do dia e revezamento derivado | integração | `phase11-ranking-data.e2e.spec.ts` | ✅ | ✅ green |
| PRIO-06 | heurística usa ranking (prioridade estrita D-18) | unit | `heuristic-scheduler.spec.ts` | ✅ | ✅ green |
| PRIO-07 | IA: contexto, hash, checkPriority, selo não fixa | unit + integração | `ai-schedule.*.spec.ts`, `schedule-validator.spec.ts`, `phase4-ai-schedule.e2e.spec.ts` | ✅ | ✅ green |
| PRIO-08 | simulação pré-sugere make/penteado | integração | `phase42-timeline-preview/confirm.e2e.spec.ts`, `timeline-domain.spec.ts` | ✅ | ✅ green |
| PRIO-09 | lista vazia com aviso (D-04), filtro em todo serviço da noiva (D-19) | integração + vitest | `phase11-bridal-empty.e2e.spec.ts`, `phase11-bridal-filter.e2e.spec.ts` (D-19), `timeline-tab.test.tsx` | ✅ | ✅ green |
| PRIO-10 | query `suggestProfessionals` + RLS | integração | `phase11-suggest-professionals.e2e.spec.ts` | ✅ | ✅ green |
| PRIO-11 | VisitFormDialog pré-seleciona / só sugere | vitest | `novo-agendamento-gestor-beauty.test.tsx`, `visit-line-interval.test.ts`, `schedule-editor-bridal.test.tsx` | ✅ | ✅ green |
| PRIO-12 | limite efetivo = min(make-off, prontas até) | unit + integração | `timeline-guard.spec.ts`, `phase42-companion-guard.e2e.spec.ts` | ✅ | ✅ green |
| PRIO-13 | campo `companions_ready_by` | integração + vitest | `phase4-bridal-group.e2e.spec.ts`, `timeline-tab.test.tsx` | ✅ | ✅ green |
| PRIO-14 | limite por papel e "não coube" com motivo | unit + vitest | `schedule-validator.spec.ts`, `heuristic-scheduler.spec.ts`, `AiSuggestionPanel` | ✅ | ✅ green |
| PRIO-15 | debutante igual à noiva | integração + E2E | specs acima com `eventKind='debutante'`, `debutante-contrato.spec.ts` | ✅ | ✅ green |
| PRIO-16 | seletores com fixas primeiro (grade da Agenda inalterada, D-20) | vitest | testes dos componentes do inventário | ✅ | ✅ green |
| E2E | marcar → simulação preenchida → confirmar → acompanhante após limite recusada | Playwright | `apps/e2e/tests/prioridade-profissionais.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/backend/src/scheduling/professional-ranking.spec.ts` (TDD, antes da implementação)
- [x] `apps/backend/test/integration/phase11-*.e2e.spec.ts` (members-flags, ranking-data, suggest-professionals, bridal-empty)
- [x] Helpers `markServesBridal`/`markFixed` em `apps/backend/test/integration/helpers/` e `apps/e2e/support/`
- [x] `apps/frontend/src/features/operations/professional-order.ts` + teste
- [x] `apps/e2e/tests/prioridade-profissionais.spec.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Conferência no staging com dados reais do Studio JS (marcar fixas/atende noiva e gerar cronograma de uma noiva de dezembro) | PRIO-02, PRIO-08 | depende das marcações reais da usuária | marcar profissionais em Profissionais, abrir uma noiva, gerar simulação e conferir sugestão |
| Uso no celular (selos e campo "Acompanhantes prontas até") | PRIO-02, PRIO-13 | layout responsivo | abrir no celular as telas citadas |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automatizado aprovado em 2026-11-26 (11-15); linhas manuais ficam para o 11-16

## Roteiro da verificação humana (11-16)

**Aviso (D-03):** na subida ninguém está marcado. Até você marcar, make e penteado da noiva aparecem vazios com o aviso "Nenhuma profissional marcada como Atende noiva/debutante" — é o esperado.

**Profissionais ativas da Studio JS no staging (todas desmarcadas em 26/11):** Camila, Dani, Dani Make, Danila, Jessica Make, Jessica Rodrigues, Jessica Seixas, Josy, Karol, Kayte, Lilian, Raquel Menoli, Sarah, Thayna (e o cadastro "A definir", que não deve ser marcado).

**Grupo sugerido:** Noiva Cecilia Jurado — 05/12/2026 — pacote Experience — sem cronograma confirmado. (Alternativa Glam: Noiva Milena — 13/12/2026.)

1. Computador → https://sgs.jessicaseixasmakeup.com.br → Noivas → Noiva Cecilia Jurado → Cronograma: make e penteado vazios com o aviso e link para Profissionais.
2. Profissionais → editar cada profissional da lista acima e marcar "Fixa (equipe do studio)" e/ou "Atende noiva/debutante" como é de verdade no studio. Conferir os selos na lista.
3. Voltar à Noiva Cecilia Jurado → Cronograma → informar a saída → Gerar simulação: make e penteado vêm com uma fixa que atende noiva (selo "Sugerida"; "Não fixa" se for o caso). Trocar uma delas e gerar de novo: a escolha é mantida. Preencher "Acompanhantes prontas até" se quiser. Confirmar só se o cronograma estiver certo de verdade.
4. Agenda → Novo agendamento comum (cliente qualquer, serviço e horário): a fixa livre vem marcada com "Sugestão do sistema"; clicando na coluna de outra profissional ela é mantida e só aparece "Sugestão: ...". Cancelar sem salvar.
5. Celular: repetir a olhada dos passos 2 e 3 (selos na lista, campo "Acompanhantes prontas até", selos da simulação) e dizer se está legível.

## Resultado da verificação humana (11-16) — em andamento

### Gap G-01 (26/11, usuária): papel "Assistente"
Na marcação das profissionais (passo 2) a usuária encontrou pessoas que **só são assistentes** de
noiva/debutante, não maquiadoras nem penteadistas. Hoje "Assistente da Noiva" (09.1) é só uma
função extra de uma profissional comum. Pedido: **"precisa ter o papel só de assistente"**.

Decisões da usuária:
- Novo **papel "Assistente"** no cadastro da equipe, ao lado de Admin, Gerente, Atendente e Profissional.
- Quem tem esse papel **não aparece no agendamento comum** (nem sugerida nem para escolher no
  Novo agendamento) e **não recebe comissão de serviço**: ganha só a diária de assistente.
- Continua com coluna na agenda e pode aparecer no cronograma/grupo da noiva (não pediu para tirar).
- Assistente passa a valer para **noiva e debutante** (revoga em parte o 09.1 D-03, que deixava
  debutante de fora): pacote de debutante também pode marcar "inclui assistente".

Respondido pela usuária (26/11):
- Papel "Assistente" **não faz login** (mantém 09.1 D-02: e-mail fictício, sem notificações).
- Assistente de debutante vale **só no estúdio**, como a de noiva.
- Profissional pode continuar com a marcação "Assistente da Noiva" além de make/penteado; o papel
  "Assistente" é para quem **só** assiste.

### Gap G-02 (26/11, usuária): cronograma antes da agenda do evento
No grupo da noiva as abas são "Pessoas | Agenda do evento | Cronograma do dia". A usuária: "o ideal
é que finalize primeiro o cronograma para depois fazer a agenda" (confirmar o cronograma já coloca
make e penteado da noiva na agenda).

Decisões da usuária:
- Ordem nova: **Pessoas | Cronograma do dia | Agenda do evento**.
- Sem cronograma confirmado, a aba Agenda do evento mostra **só um aviso** ("Confirme primeiro o
  cronograma do dia") com botão que leva à aba do cronograma; **não trava** a geração da agenda.
  O agendamento do teste não muda.

Próximo: `/gsd:plan-phase 11 --gaps`.

---
phase: 06-novo-layout-gestor-beauty
plan: 09
subsystem: frontend-ui
tags: [noivas, grupo-de-noivas, gestor-beauty, cronograma-do-dia, override, d-13]
requires: [06-08, 06-12, 04.2-09, 04.2-10]
provides:
  - Grupo de noivas (detalhe) no layout Gestor Beauty (título e trilha padronizados, ficha do evento, pessoas, agenda)
  - Aba "Cronograma do dia" (04.2-10) no mesmo padrão visual, sem mudança de comportamento
  - Override do cronograma da noiva ("forçar com motivo") na agenda do evento (manual) e na confirmação da IA
affects: [06-10, 06-11]
tech-stack:
  added: []
  patterns:
    - "Erro TIMELINE_* + bridal.scheduleOverride -> requestTimelineOverride(mensagem) -> reenvio com timelineOverride { reason } (mesmo fluxo de useMoveAppointment/VisitFormDialog)"
    - "Nome de pessoa e de grupo em caixa padronizada (toDisplayName) sem uppercase; rótulos de ficha em text-overline uppercase"
key-files:
  created:
    - apps/frontend/src/features/bridal/__tests__/grupo-noivas-gestor-beauty.test.tsx
    - apps/frontend/src/features/bridal/__tests__/ai-suggestion-override.test.tsx
  modified:
    - apps/frontend/src/features/bridal/pages/BridalGroupDetailPage.tsx
    - apps/frontend/src/features/bridal/components/BridalMembersCard.tsx
    - apps/frontend/src/features/bridal/components/BridalScheduleEditor.tsx
    - apps/frontend/src/features/bridal/components/AiSuggestionPanel.tsx
    - apps/frontend/src/features/bridal/components/BridalTimelineTab.tsx
    - apps/frontend/src/features/bridal/components/TimelineSimulationCard.tsx
    - apps/frontend/src/styles/__tests__/sem-cor-antiga.test.ts
    - apps/e2e/tests/contrato-pela-noiva.spec.ts
decisions:
  - "O override fica no AiSuggestionPanel (onde a mutação é enviada), não no BridalScheduleEditor (só apresentação); cobre os dois caminhos: scheduleBridalEvent (manual) e confirmBridalSchedule (IA)"
  - "Status do grupo usa os valores reais (active/completed/cancelled -> success/neutral/error), não rascunho/confirmado do plano"
  - "O interruptor de cobertura continua sendo `coverage-<id>` (checkbox funcional); o selo com ponto é `coverage-badge-<id>` ao lado do texto"
  - "Tabelas do plano: cabeçalho bg-neutral-100 text-overline uppercase text-neutral-500 como escrito no plano"
metrics:
  tasks: 2 (+ pendência do 04.2)
  completed: 2026-11-14
requirements: [UI-LAYOUT]
---

# Fase 6 Plano 09: Grupo de noivas — Resumo

O grupo de noivas passou ao padrão Gestor Beauty: título e trilha com "Noiva Julia Souza" em caixa
padronizada, ficha do evento com rótulos pequenos e horários tabulares, pessoas com nome em serifa
e selo de cobertura, tabelas com cabeçalho novo e campos de 44 px. A aba "Cronograma do dia"
acompanha o mesmo visual. Gerente/Administrador agora podem forçar o cronograma da noiva com
motivo ao gravar a agenda do evento, tanto manual quanto da IA.

## Commits

| Item | Commit | Descrição |
| --- | --- | --- |
| Pendência 04.2 | bd61a92 | Override do cronograma no AiSuggestionPanel (manual e IA) + 4 testes |
| Task 1 | 6041f9e | Grupo de noivas, pessoas, agenda e aba do cronograma no layout novo + teste de regressão visual |
| Task 1 (E2E) | a82d625 | `contrato-pela-noiva.spec.ts` compara o nome sem diferenciar caixa |

## O que foi feito

**Override (pending_from_04.2).** `AiSuggestionPanel.submit` envia a mutação (`confirmBridalSchedule`
no modo IA, `scheduleBridalEvent` no manual); se o primeiro erro é `isOverridableTimelineError` e a
pessoa tem `bridal.scheduleOverride`, abre `requestTimelineOverride(mensagem)` e, com motivo,
reenvia com `timelineOverride: { reason }`. Sem motivo (cancelou) ou sem permissão, a mensagem do
servidor fica em `ai-errors` e as linhas editadas permanecem. Testes (`ai-suggestion-override`): manual
com Gerente (reenvio com motivo), IA com Administrador cancelando, IA com motivo e Atendente sem diálogo.
Dentro do `BridalScheduleEditor` nada mudou além do visual (ele não envia nada).

**Visual.** Página: `toDisplayName` no título e na trilha, ficha `bg-detail-sheet`, `dt` em
`text-overline uppercase text-neutral-500`, horário/data/pronta até com `tabular-nums`, "não definida" em
`text-warning-700`, `group-status` como `Badge` com ponto, "Cancelar grupo" e "Excluir definitivamente" em
`text-error-600`. Pessoas: `h2` serifa, nome serifa com `toDisplayName`, telefone tabular, cobertura em
selo com ponto, erros `text-error-600`. Agenda: selects com `NATIVE_SELECT_CLASS` (44 px), horas tabulares.
Cronograma do dia (visual apenas): títulos `h2` em serifa, rótulos `text-overline`, selects de 44 px, texto
e textos monoespaçados em `text-body`, erros `text-error-600`; testids e comportamento intactos.
`BridalGroupDetailPage` saiu de `PALETA_PENDENTE` (lista vazia).

## Comparação com o Stitch

Feita depois da execução do plano (o executor não tinha o MCP do Stitch). As telas foram baixadas com o
MCP para `design/grupo-noivas-computador.html|.png` (2560×2760) e `design/grupo-noivas-celular.html|.png`
(780×3058).

Auditoria local (`AUDIT_TARGET=local`, evidência em `06-audit-evidence/06-09/`, ignorada pelo git):
- Slug oficial `10-noivas-detalhe`: 3 passaram (setup, desktop, mobile), sem erro de console e sem
  rolagem lateral; mas a organização do seed local não tem grupo, então a nota é "sem grupos" e a
  captura mostra a lista `/noivas`.
- Por isso, como no 06-08, um audit temporário (não commitado) criou pelo fluxo de
  `noivas-contrato.spec.ts` um grupo com noiva + 3 acompanhantes (mãe incluída no contrato, telefones,
  serviços) e fotografou o detalhe: `desktop|mobile/10-com-dados.png`, `10-com-dados-agenda.png` e
  `10-com-dados-cronograma.png`.

| Bloco do Stitch | Como ficou | Omitido por D-02? |
| --- | --- | --- |
| Trilha "Noivas / nome" + título em serifa | Igual (PageHeader): trilha sem maiúsculas, nome com `toDisplayName` em serifa | não |
| Ações no cabeçalho (botão principal roxo + contornados) | Editar / Cancelar grupo / Excluir em contorno (excluir e cancelar em vermelho) e "Criar contrato" roxo, 44 px; no celular quebram abaixo do título | não (ações atuais; não há "Enviar contrato" nesta tela) |
| Selo "Ativo" com ponto e "Pronta até 15:30" | Na ficha: "STATUS" com selo de ponto e "PRONTA ATÉ" | não |
| Faixa de dados do evento (rótulo pequeno em maiúsculas + valor) | Ficha branca com tipo, horário, data, pronta até, local, pacote, status (dados que já existiam) | não |
| Tabela de integrantes (cabeçalho cinza em maiúsculas, nome em serifa, papel) | Igual no computador; colunas reais (telefone, serviços, contrato/cobertura, remover) | não |
| Integrantes no celular como lista empilhada | Mantida a tabela com rolagem lateral dentro da caixa (mesma decisão do 06-08); virar cartões seria mudança de estrutura | não (divergência aceita) |
| Cronograma em linha do tempo | Aba "Cronograma do dia" (04.2-10) no mesmo padrão de cartões; sem cronograma confirmado mostra o texto atual e a simulação | não |
| Coluna "Profissional", valor por pessoa, total/subtotal do grupo | — (o grupo não tem preço por pessoa; valores ficam no contrato) | sim (dado novo) |
| Assessoria responsável, local da produção/suíte, bancadas/cadeiras, "Cadeira principal" | — | sim |
| Plano financeiro e parcelas, envio/WhatsApp, checklist, pré-visualização da mensagem | — (pertencem ao contrato, outra tela) | sim |
| Notas da diretora criativa, ID/código do contrato no cabeçalho, "Contrato em rascunho" | — (o status do contrato já aparece onde existia) | sim |
| Barra lateral/topo do Stitch (Atelier, hora, "Sistema operacional") | Casco do 06-02 | sim (casco já decidido) |

**Corrigido nesta comparação:** no celular a página inteira ficava com 569 px de largura num viewport de
412 px (rolagem lateral e tela "encolhida" no screenshot). Causa: o `<span className="sr-only">Ações</span>`
do cabeçalho da tabela de pessoas é `position: absolute` e, sem ancestral posicionado, escapava da caixa
`overflow-x-auto` e alargava o documento. A tabela da agenda do evento tem rótulos `sr-only` na mesma
situação (não medida antes; corrigida junto). Correção só visual: `relative` na caixa de rolagem de
`BridalMembersCard.tsx` e `BridalScheduleEditor.tsx`. Depois: 412/412 nas abas Pessoas, Agenda do
evento e Cronograma do dia; computador 1366/1366.

Gate depois da correção: frontend typecheck e lint limpos; vitest 110 arquivos, 808 testes verdes;
Playwright noivas-contrato, cronograma-noiva, contrato-pela-noiva e debutante-contrato: 15 + 3 verdes.

## Deploy

Não executado, por instrução (a orquestração faz push, deploy e CI). Os passos 3-5 da Task 2 do plano
(push, `deploy-staging.sh`, `gh run watch`) ficam para o orquestrador.

## Deviations from Plan

**1. [Rule 1 - Bug] E2E `contrato-pela-noiva.spec.ts` comparava o nome com caixa exata**
- **Found during:** gate E2E. A linha da pessoa passou a mostrar "Noiva Contrato Mwgxi540" (toDisplayName)
  e `toContainText(brideName)` é sensível à caixa.
- **Fix:** comparar com `new RegExp(brideName, 'i')`.
- **Files:** `apps/e2e/tests/contrato-pela-noiva.spec.ts`.

**2. [Escopo] Status do grupo** usa active/completed/cancelled (os do sistema) em vez de rascunho/confirmado do plano.

**3. [Escopo] `coverage-<id>`** continua o interruptor (acesso e testes existentes); selo em `coverage-badge-<id>`.

**4. [Rule 3] Teste do override** teve o tipo corrigido (sem `__typename` no serviço do fixture e sem `import()` de tipo) junto do commit 6041f9e.

## Known Stubs

Nenhum.

## Gate

- Frontend: typecheck e lint limpos; vitest 110 arquivos, 808 testes verdes.
- Backend (nada tocado): typecheck e lint limpos; unit 38 suítes, 433 testes verdes. Integração não rodada.
- Playwright (`@sgs/e2e test:e2e`, suíte inteira): 53 passaram (inclui noivas-contrato, debutante-contrato,
  contrato-pela-noiva e cronograma-noiva); a primeira rodada teve 1 falha (Deviation 1), corrigida.

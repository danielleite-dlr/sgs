---
phase: 06-novo-layout-gestor-beauty
plan: 11
type: execute
wave: 11
depends_on: ["06-10"]
files_modified:
  - .planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md
  - .planning/ROADMAP.md
autonomous: false
requirements: [UI-LAYOUT]

must_haves:
  truths:
    - "Existe um roteiro de conferência em português para a usuária com cada tela da fase, o endereço no staging, o que mudou e o que ficou de fora (D-02)"
    - "Tudo que o design mostra e o SGS não tem, registrado nos SUMMARYs dos lotes, está no backlog 999.7 do ROADMAP"
    - "A usuária conferiu o staging e deu o aceite (ou listou ajustes, registrados como itens novos)"
  artifacts:
    - path: ".planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md"
      provides: "Roteiro de conferência e registro do aceite da fase 6"
      contains: "## Aceite"
  key_links:
    - from: ".planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md"
      to: ".planning/ROADMAP.md"
      via: "omissões D-02 listadas no backlog 999.7"
      pattern: "999.7"
---

<objective>
Fechamento da fase 6 (D-03): consolidar a auditoria local de todas as telas contra o Stitch, montar o roteiro de conferência no staging para a usuária (a conta de auditoria do staging continua desativada, D-24), receber o aceite e registrá-lo.

Purpose: a usuária confirma que o SGS ficou com a cara do Gestor Beauty.
Output: `06-CONFERENCIA.md` com roteiro e aceite, backlog 999.7 completo.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-novo-layout-gestor-beauty/06-CONTEXT.md
@.planning/phases/06-novo-layout-gestor-beauty/06-02-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-03-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-04-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-05-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-06-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-07-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-08-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-09-SUMMARY.md
@.planning/phases/06-novo-layout-gestor-beauty/06-10-SUMMARY.md
@.planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auditoria local completa, roteiro de conferência e backlog 999.7 atualizado</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md, .planning/ROADMAP.md</files>
  <read_first>
    - Seções `## Comparação com o Stitch` de 06-02-SUMMARY.md a 06-10-SUMMARY.md
    - .planning/ROADMAP.md (seção `### 999.7` e `### Phase 6`)
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md (seção Aceite final, como modelo de registro)
    - apps/e2e/playwright.audit.config.ts
  </read_first>
  <action>
1. Rodar a auditoria local completa, nos dois tamanhos: `cd /root/sgs/apps/e2e && AUDIT_TARGET=local AUDIT_EVIDENCE_DIR=../../.planning/phases/06-novo-layout-gestor-beauty/06-audit-evidence/06-11 corepack pnpm exec playwright test -c playwright.audit.config.ts audit/telas.audit.ts`. Abrir os screenshots `01`, `03`, `06`, `07`, `10`, `16`, `17`, `18` (desktop e mobile) e conferir regressão entre lotes (um lote posterior estragando tela anterior). Em `metrics-desktop.jsonl`/`metrics-mobile.jsonl`, conferir: nenhum erro de console de HTML inválido (UX-10) e nenhuma palavra sem acento.
2. Criar `06-CONFERENCIA.md` em português, para a usuária:
   - `## Resumo` (3–5 linhas: o que mudou no sistema todo — cores, fontes, menu lateral, barra de baixo no celular).
   - `## Roteiro no staging` — tabela `Tela | Endereço | O que conferir | Celular e computador`, uma linha por lote: Menu e topo (qualquer tela), Agenda do dia (`https://sgs.jessicaseixasmakeup.com.br/agenda`), Novo agendamento (Agenda → "Agendar"), Comanda (`/comanda` → abrir uma), Entradas e saídas (`/financeiro`), Previsão de caixa (`/financeiro/previsao`), Despesas fixas (`/financeiro/despesas-fixas`), Grupo de noivas (`/noivas` → abrir um), Início (`/dashboard`). Em "O que conferir", frases curtas e concretas (ex.: "botão Agendar roxo com letra branca", "barra de baixo com Agenda, Comanda, Clientes, Noivas e Mais").
   - `## O que ficou de fora (só existe no design)` — lista consolidada das omissões D-02 dos SUMMARYs.
   - `## Aceite` — vazio, para a Task 3.
3. ROADMAP.md: conferir cada omissão listada contra `### 999.7` e acrescentar as que faltarem (uma linha por item, sem duplicar).
4. Commit: `docs(06-11): roteiro de conferência da fase 6` (arquivos um a um), trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git push origin master`.
  </action>
  <verify>
    <automated>cd /root/sgs && grep -q "## Roteiro no staging" .planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md && grep -q "## Aceite" .planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md && grep -q "999.7" .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - `06-CONFERENCIA.md` tem as seções `## Resumo`, `## Roteiro no staging` (9 linhas de tela), `## O que ficou de fora (só existe no design)` e `## Aceite`
    - Toda omissão citada nos SUMMARYs 06-02 a 06-10 aparece em `### 999.7` do ROADMAP
    - Commit `docs(06-11)` em `origin/master`
  </acceptance_criteria>
  <done>Roteiro pronto para a usuária e backlog completo.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Conferência e aceite da usuária no staging</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md</files>
  <read_first>
    - .planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md
  </read_first>
  <action>Enviar à usuária, na conversa, o resumo e a tabela "Roteiro no staging" de `06-CONFERENCIA.md` (texto em português, sem termos técnicos) e aguardar a resposta. Não alterar código enquanto espera.</action>
  <verify>Resposta da usuária recebida na conversa ("aprovado" ou lista de ajustes).</verify>
  <acceptance_criteria>
    - A usuária respondeu "aprovado" ou listou ajustes por tela
  </acceptance_criteria>
  <done>Resposta da usuária em mãos para registrar na Task 3.</done>
  <what-built>Os 10 lotes da fase 6 estão no staging (https://sgs.jessicaseixasmakeup.com.br): tokens e componentes, casco (menu lateral, topo, barra de baixo), Agenda do dia, Novo agendamento, Comanda, Entradas e saídas, Previsão de caixa, Despesas fixas, Grupo de noivas e Início, cada um com CI verde.</what-built>
  <how-to-verify>
    1. Abrir `.planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md` (o executor envia o roteiro na conversa).
    2. No celular e no computador, seguir a tabela "Roteiro no staging", tela por tela.
    3. Conferir em especial: letra branca sobre roxo, botões fáceis de tocar, nomes de cliente em caixa normal, valores em R$ sem quebrar linha, barra de baixo com Agenda, Comanda, Clientes, Noivas e Mais.
    4. Conferir a lista "O que ficou de fora" (vai para o backlog, não é defeito).
  </how-to-verify>
  <resume-signal>Responda "aprovado" ou descreva o que ajustar (tela + o que está errado).</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Registrar o aceite</name>
  <files>.planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md</files>
  <read_first>
    - .planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md
  </read_first>
  <action>
1. Em `## Aceite`, registrar: data, forma (resposta na conversa), resposta literal da usuária, e, se houver ajustes pedidos, uma tabela `ID | Tela | Ajuste pedido | Situação` com IDs `UI-01`, `UI-02`… (situação "a planejar"). Ajustes NÃO são executados neste plano: viram plano de correção via `/gsd:plan-phase 6 --gaps` ou backlog, conforme a usuária decidir.
2. Commit `docs(06-11): aceite da usuária na fase 6` (arquivo único), trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git push origin master`.
  </action>
  <verify>
    <automated>cd /root/sgs && sed -n '/## Aceite/,$p' .planning/phases/06-novo-layout-gestor-beauty/06-CONFERENCIA.md | grep -q "Data"</automated>
  </verify>
  <acceptance_criteria>
    - Seção `## Aceite` com data, forma e a resposta literal da usuária
    - Ajustes pedidos (se houver) listados com ID `UI-xx` e situação
    - Commit `docs(06-11)` do aceite em `origin/master`
  </acceptance_criteria>
  <done>Aceite da fase 6 registrado.</done>
</task>

</tasks>

<verification>
- Auditoria local completa sem regressão entre lotes; roteiro entregue; aceite registrado
</verification>

<success_criteria>
Fase 6 concluída com aceite da usuária: o SGS tem a cara do Gestor Beauty no staging, só com os dados que já existiam.
</success_criteria>

<output>
After completion, create `.planning/phases/06-novo-layout-gestor-beauty/06-11-SUMMARY.md`
</output>

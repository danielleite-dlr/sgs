---
phase: 05-uso-no-dia-a-dia
plan: 08
type: execute
wave: 2
depends_on: ["05-01"]
files_modified:
  - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
  - .planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: false
requirements: [UX-DAY]

must_haves:
  truths:
    - "A usuária aprovou a lista de 05-AUDITORIA.md (sim/não/depois por item) antes de qualquer lote ser gerado (D-01)"
    - "Cada item com Aprovado? = sim em 05-AUDITORIA.md está em exatamente um plano de correção (lote), e nenhum item não/depois entra"
    - "Os lotes seguem a ordem de telas da usuária: Agenda → Comanda e caixa → Noivas e contratos → Clientes e financeiro → Painel (D-02)"
    - "Cada lote tem no máximo 3 tarefas, cada tarefa com teste de regressão (vitest ou Playwright), e termina com gate completo, commit, push, deploy no staging e CI verde"
    - "Os lotes rodam depois da previsão no ar (dependem de 05-07) e em sequência entre si (sem conflito de arquivos)"
    - "O plano de fechamento 05-20 passa a depender do último lote"
    - "Itens 'depois' e ideias de funcionalidade nova vão para o Backlog do ROADMAP, não para os lotes"
  artifacts:
    - path: ".planning/phases/05-uso-no-dia-a-dia/05-09-*-PLAN.md"
      provides: "Primeiro lote de correção (se houver item aprovado)"
    - path: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      provides: "Coluna Lote (plano) da seção Correções preenchida"
  key_links:
    - from: ".planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md"
      to: ".planning/phases/05-uso-no-dia-a-dia/05-NN-*-PLAN.md"
      via: "IDs UX-xx citados no objective/tarefas de cada lote"
      pattern: "UX-[0-9]+"
---

<objective>
Obter a aprovação da usuária para a lista de 05-01 (checkpoint bloqueante, D-01) e transformar a lista aprovada em planos de correção executáveis, em lotes por tela (UX-DAY). Os itens da auditoria só existem depois da aprovação, por isso este plano GERA os planos `05-09` … `05-19` (no máximo 11 lotes) em vez de eles serem escritos agora. Não corrige nada.

Como os lotes entram na execução: este plano roda na onda 2 (depois de 05-01 terminar) e começa parado esperando a aprovação. Só ele espera a usuária; os planos da previsão seguem nas outras ondas. Os planos gerados ficam com `depends_on` em `05-07`, `05-08` e no lote anterior, e ondas ≥ 5. Se a execução em curso já tiver carregado a lista de planos antes de eles existirem, rodar `/gsd:execute-phase 5` de novo: ela pula os planos com SUMMARY e executa os lotes e o 05-20.

Purpose: correções pequenas, testadas e entregues no staging lote a lote, na ordem que a usuária pediu.
Output: planos `05-09-*-PLAN.md` …, `05-20-fechamento-PLAN.md` com `depends_on` atualizado, `05-AUDITORIA.md` com a coluna "Lote (plano)" preenchida, ROADMAP com a lista de planos.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/05-uso-no-dia-a-dia/05-CONTEXT.md
@.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
@.planning/phases/05-uso-no-dia-a-dia/05-01-SUMMARY.md
@$HOME/.claude/get-shit-done/templates/phase-prompt.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Aprovação da lista de auditoria pela usuária (D-01)</name>
  <files>.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md, .planning/STATE.md</files>
  <read_first>
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md (deve estar com `status: aguardando-aprovacao`, commitado pelo 05-01)
  </read_first>
  <action>Apresentar à usuária, em PT-BR, o "Resumo para a usuária" e a contagem de itens por tela e severidade, com o caminho do arquivo. Esperar a resposta. Depois da resposta: preencher a coluna "Aprovado?" de cada item com sim/não/depois conforme ela disse, preencher "## Registro de aprovação" (data, forma — texto da resposta resumido — e lista de IDs aprovados), trocar o frontmatter para `status: aprovada` e registrar em `.planning/STATE.md` (seção de decisões) "05-AUDITORIA aprovada: <IDs>". Commit `docs(05-08): auditoria aprovada pela usuária`. Não corrigir nada aqui.</action>
  <what-built>Auditoria das telas principais no staging (desktop e celular, somente leitura) e no ambiente local (fluxos com escrita), com a lista priorizada em `.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md`.</what-built>
  <how-to-verify>
    1. Abrir `/root/sgs/.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md`.
    2. Ler o "Resumo para a usuária" e as tabelas por tela.
    3. Para cada item, dizer sim (corrigir agora), não (descartar) ou depois (backlog). Pode ser em bloco ("todos os Bloqueia e Atrapalha").
    4. Conferir se algum item expõe dado pessoal de cliente (não deve).
  </how-to-verify>
  <verify>
    <automated>cd /root/sgs && F=.planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md && grep -q '^status: aprovada' $F && ! grep -qE '^\| UX-[0-9]+ \|.*\| — \|$' $F && grep -q '05-AUDITORIA aprovada' .planning/STATE.md</automated>
  </verify>
  <acceptance_criteria>
    - Frontmatter de `05-AUDITORIA.md` com `status: aprovada`
    - Nenhuma linha de item termina com `| — |` (todas têm sim, não ou depois)
    - `## Registro de aprovação` contém a data e a lista de IDs aprovados
    - `.planning/STATE.md` contém `05-AUDITORIA aprovada`
  </acceptance_criteria>
  <resume-signal>Responda com a decisão por item (ex.: "aprovo UX-01..UX-09; UX-10 não; UX-11 depois") ou "aprovado tudo".</resume-signal>
  <done>Lista aprovada registrada no arquivo e no STATE.md.</done>
</task>

<task type="auto">
  <name>Task 2: Agrupar os itens aprovados e escrever os planos de lote 05-09…05-19</name>
  <files>.planning/phases/05-uso-no-dia-a-dia/05-09-*-PLAN.md (gerados), .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md</files>
  <read_first>
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md (tem de estar com `status: aprovada`; se não estiver, PARAR e reportar)
    - .planning/phases/05-uso-no-dia-a-dia/05-06-frontend-painel-previsao-PLAN.md (modelo de plano com read_first/acceptance_criteria deste projeto)
    - Para cada item aprovado: os arquivos do frontend/backend da tela citada (achar com `grep -rln "<texto da tela>" apps/frontend/src`), para escrever `files`, `read_first` e a ação com valores concretos
  </read_first>
  <action>
1. Ler as tabelas de `05-AUDITORIA.md` e listar os itens com `Aprovado?` = `sim` (case-insensitive). Se a lista for vazia: não criar lote, escrever na seção `## Correções` a linha `Nenhum item aprovado para correção nesta fase.` e pular para a Task 3.
2. Agrupar por seção na ordem D-02 (1. Agenda, 2. Comanda e caixa, 3. Noivas e contratos, 4. Clientes e financeiro, 5. Painel). Dentro do grupo: Bloqueia → Atrapalha → Polimento. Um lote = um grupo; se o grupo passar de 3 tarefas ou de 6 arquivos, dividir em lotes consecutivos do mesmo grupo. Itens pequenos da mesma tela e mesmos arquivos podem ser uma tarefa só. Numerar os lotes a partir de `05-09` (máximo `05-19`; se faltar número, juntar itens de Polimento).
3. Escrever cada lote em `.planning/phases/05-uso-no-dia-a-dia/05-NN-ux-lote-<k>-<tela-slug>-PLAN.md` com:
   - frontmatter: `phase: 05-uso-no-dia-a-dia`, `plan: NN`, `type: execute`, `wave` = (onda de 05-07 = 4) + k, `depends_on: ["05-07", "05-08"]` + o lote anterior (`"05-(NN-1)"`) a partir do segundo lote, `files_modified` (lista exata), `autonomous: true`, `requirements: [UX-DAY]`, `must_haves` (uma truth por item: o comportamento corrigido visto pela usuária, citando o ID `UX-xx`).
   - `<objective>`: lista dos IDs e títulos dos itens; a frase "Nada além dos itens aprovados entra neste lote (D-01, D-03)".
   - Tarefas (`type="auto"`, `tdd="true"` quando mudar comportamento): cada uma com `<files>`, `<read_first>` (arquivo alterado + teste existente da tela), `<behavior>` (o teste de regressão que falha antes e passa depois: vitest para texto/estado/acentuação, Playwright em `apps/e2e/tests/` para fluxo ou celular), `<action>` com os valores concretos (texto novo exato em PT-BR com acentos, classe Tailwind, rótulo, mensagem de erro, ordem de campos), `<verify><automated>` (comando de teste do arquivo + `pnpm --filter @sgs/frontend typecheck`), `<acceptance_criteria>` greppáveis (texto antigo some, texto novo existe, teste passa) e `<done>`.
   - Última tarefa obrigatória de cada lote: gate completo (`pnpm -r typecheck`, `pnpm -r --if-present lint`, `pnpm --filter @sgs/backend test`, `pnpm --filter @sgs/backend test:integration`, `pnpm --filter @sgs/frontend test`, `corepack pnpm --filter @sgs/e2e test:e2e`) → commit `fix(05-NN): <resumo> (UX-xx, UX-yy)` com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` → na seção `## Correções` de `05-AUDITORIA.md` preencher `Corrigido em (commit)` com o hash curto → `git push origin master` → `./scripts/deploy-staging.sh` (backup em `/root/sgs-backups/` antes, só se o lote tiver migration) → `gh run watch <id> --exit-status` verde. Se couber em 3 tarefas, essa pode ser a 3ª; senão o lote tem no máximo 2 tarefas de correção + essa.
   - `<output>`: `05-NN-SUMMARY.md`.
4. Em `05-AUDITORIA.md`, seção `## Correções`: uma linha por item aprovado `| UX-xx | 05-NN | — | — |`. Itens `depois`: listar numa subseção `### Para depois (backlog)`.
5. Validar cada plano: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter validate <arquivo> --schema plan` e `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify plan-structure <arquivo>` sem erros.
  </action>
  <verify>
    <automated>cd /root/sgs/.planning/phases/05-uso-no-dia-a-dia && grep -q '^status: aprovada' 05-AUDITORIA.md && for f in 05-09-*-PLAN.md 05-1[0-9]-*-PLAN.md; do [ -e "$f" ] || continue; node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify plan-structure "$f" | grep -q '"valid": *true' || exit 1; done; for id in $(grep -E '^\| UX-[0-9]+ \|' 05-AUDITORIA.md | grep -iE '\| *sim *\|$' | awk -F'|' '{gsub(/ /,"",$2); print $2}'); do grep -l "$id" 05-09-*-PLAN.md 05-1[0-9]-*-PLAN.md >/dev/null 2>&1 || exit 1; done</automated>
  </verify>
  <acceptance_criteria>
    - Todo ID com `Aprovado?` = `sim` aparece em exatamente um arquivo `05-09-*` … `05-19-*-PLAN.md`; nenhum ID com `não`/`depois` aparece neles
    - Todo lote tem `requirements: [UX-DAY]`, `depends_on` contendo `"05-07"` e `"05-08"`, no máximo 3 tarefas, e todas as tarefas têm `<read_first>` e `<acceptance_criteria>`
    - A última tarefa de cada lote contém `./scripts/deploy-staging.sh` e `gh run watch`
    - O primeiro lote é da tela de menor número de seção com item aprovado (ordem D-02)
    - `gsd-tools verify plan-structure` retorna `valid: true` para todos os lotes
    - `05-AUDITORIA.md` tem uma linha `| UX-xx | 05-NN |` por item aprovado na seção `## Correções`
  </acceptance_criteria>
  <done>Os itens aprovados viraram lotes executáveis, na ordem da usuária, cada um com teste e entrega no staging.</done>
</task>

<task type="auto">
  <name>Task 3: Encadear o fechamento (05-20), atualizar ROADMAP/backlog e commitar os planos</name>
  <files>.planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md, .planning/ROADMAP.md</files>
  <read_first>
    - .planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md
    - .planning/ROADMAP.md (seção "### Phase 5: Uso no dia a dia" e "## Backlog")
    - .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md
  </read_first>
  <action>
1. Em `05-20-fechamento-PLAN.md`, frontmatter: `depends_on` = `["05-07", "05-08"]` + o último lote gerado (ex.: `"05-13"`); `wave` = (onda do último lote) + 1 (sem lotes: `wave: 5`). Não mudar mais nada nesse arquivo.
2. `ROADMAP.md`, seção da Fase 5: na lista `Plans:` acrescentar uma linha `- [ ] 05-NN-ux-lote-<k>-<tela-slug>-PLAN.md — Lote <k> de usabilidade: <tela> (UX-xx, …)` para cada lote, antes da linha do 05-20; atualizar `**Plans:**` com o total.
3. `ROADMAP.md`, `## Backlog`: se houver itens `depois` ou ideias de funcionalidade nova na auditoria, criar `### 999.6: Usabilidade — itens adiados da auditoria da fase 5` listando os IDs e títulos (sem dados pessoais).
4. Commit: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(05-08): lotes de correção de usabilidade a partir da auditoria aprovada" --files .planning/phases/05-uso-no-dia-a-dia/05-*-PLAN.md .planning/phases/05-uso-no-dia-a-dia/05-AUDITORIA.md .planning/ROADMAP.md`.
5. No SUMMARY: lista de lotes (número, tela, IDs, onda) e a instrução "se a execução atual não pegou os lotes novos, rodar `/gsd:execute-phase 5` de novo".
  </action>
  <verify>
    <automated>cd /root/sgs && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md --schema plan | grep -q '"valid": *true' && grep -q '"05-08"' .planning/phases/05-uso-no-dia-a-dia/05-20-fechamento-PLAN.md && git diff --quiet HEAD -- .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - `05-20-fechamento-PLAN.md` tem `depends_on` com `"05-07"`, `"05-08"` e o último lote (quando houver), e `wave` maior que a de todos os lotes
    - `ROADMAP.md` lista cada lote gerado na seção da Fase 5
    - Itens `depois` (se houver) estão em `### 999.6` no Backlog
    - Commit `docs(05-08): ...` existe (`git log -1 --format=%s` começa com `docs(05-08)`)
  </acceptance_criteria>
  <done>Lotes encadeados entre 05-07 e 05-20, ROADMAP atualizado e planos commitados.</done>
</task>

</tasks>

<verification>
- Todos os IDs aprovados cobertos por exatamente um lote; lotes válidos no gsd-tools; 05-20 depende do último lote
</verification>

<success_criteria>
Critério de sucesso 1 (meio): os itens aprovados estão planejados em lotes executáveis, na ordem de telas da usuária.
</success_criteria>

<output>
After completion, create `.planning/phases/05-uso-no-dia-a-dia/05-08-SUMMARY.md`
</output>

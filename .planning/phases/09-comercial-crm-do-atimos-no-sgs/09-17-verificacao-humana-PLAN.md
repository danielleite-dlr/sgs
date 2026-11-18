---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 17
type: execute
wave: 8
depends_on: ["09-16"]
files_modified:
  - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
autonomous: false
requirements: [COM-03, COM-06, COM-08, COM-11]

must_haves:
  truths:
    - "O push de um lembrete chega no iPhone e no Android na hora marcada e o toque abre /comercial/lembretes com o lembrete destacado"
    - "No celular, o kanban rola de lado, o toque longo arrasta o card e 'Mover para…' funciona"
    - "O formulário embutido num site de teste envia um lead que aparece para o gerente"
    - "A usuária confirmou (ou trocou) a regra D-21 de quem marca ganho"
  artifacts:
    - path: ".planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md"
      provides: "Manual-Only Verifications com resultado"
      contains: "Manual-Only Verifications"
  key_links:
    - from: "staging"
      to: "/comercial/lembretes?lembrete="
      via: "toque na notificação"
      pattern: "comercial/lembretes"
---

<objective>
Verificação humana do que o CI não cobre (push real no aparelho, gesto de toque, iframe num site externo) e confirmação da D-21 com a usuária.

Purpose: itens manuais do `09-VALIDATION.md`; a D-21 foi adotada como padrão sem resposta da usuária.
Output: resultados registrados em `09-VALIDATION.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-16-SUMMARY.md

Antes do checkpoint, o executor faz o automatizável: confere que o staging está no commit do 09-16 (`docker inspect sgs_stg_backend --format '{{.Created}}'` depois do push), cria por GraphQL um lead de teste "Teste Comercial {data}" com negócio atribuído à usuária gerente e um lembrete para daqui a 3 minutos, e gera uma página HTML de teste com o `<iframe>` copiado da aba "Formulário do site" (arquivo no scratchpad, aberto pelo navegador da usuária ou servido com `python3 -m http.server` em outra origem).
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Verificação humana dos itens manuais e da D-21</name>
  <files>.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md</files>
  <read_first>
    - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md (Manual-Only Verifications)
    - .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-16-SUMMARY.md
  </read_first>
  <action>Executor: fazer os preparativos do contexto, apresentar os passos abaixo à usuária e, depois da resposta, registrar o resultado (aprovado/problemas) em cada linha de "Manual-Only Verifications" do 09-VALIDATION.md e a resposta sobre a D-21 em 09-CONTEXT.md (D-21 deixa de ser "A CONFIRMAR"). Se ela quiser "só admin/gerente marcam ganho", abrir `/gsd:quick` para trocar `WIN_DEAL_ROLES` nos dois arquivos (`apps/backend/src/commercial/commercial-access.ts` e `apps/frontend/src/features/commercial/commercial-permissions.ts`) e o teste correspondente.</action>
  <what-built>Menu Comercial no staging: Painel, Leads (com aviso de cliente existente e importação), Pipeline (kanban, ganho que abre o contrato rascunho, perdido com motivo), Lembretes com push, Relatórios com Excel/PDF e formulário do site.</what-built>
  <how-to-verify>
    1. No iPhone (app instalado da fase 8) e no Android, logada como gerente: esperar o lembrete de teste (3 min); a notificação "Lembrete: ..." chega nos dois; tocar abre Comercial › Lembretes com o lembrete destacado.
    2. No celular, abrir Comercial › Pipeline: rolar as colunas de lado, segurar e arrastar um card para outra etapa, e usar "Mover para…" no menu do card.
    3. Abrir a página de teste com o iframe (outra origem), enviar um contato com o consentimento marcado; em Comercial › Leads (filtro "Sem responsável") o lead aparece.
    4. Marcar o negócio de teste como ganho com sinal Pix e conferir que abre o contrato rascunho e que o sinal aparece no caixa do dia.
    5. Pergunta D-21: hoje a atendente pode marcar ganho nos negócios dela (o contrato nasce rascunho e quem revisa/envia é gerente ou admin). Manter assim ou só admin/gerente marcam ganho?
  </how-to-verify>
  <resume-signal>Responda "aprovado" (e a escolha da D-21) ou descreva os problemas</resume-signal>
  <verify>
    <automated>grep -n "Manual-Only Verifications" /root/sgs/.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - as 3 linhas de "Manual-Only Verifications" do 09-VALIDATION.md têm resultado registrado
    - `grep -n "A CONFIRMAR" .planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md` vazio depois da resposta
  </acceptance_criteria>
  <done>Itens manuais aprovados e D-21 confirmada pela usuária.</done>
</task>

</tasks>

<verification>
Resposta da usuária registrada.
</verification>

<success_criteria>
A fase 9 está aceita pela usuária no staging.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-17-SUMMARY.md`
</output>

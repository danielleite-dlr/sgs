---
phase: 04-bridal-contracts
plan: 16
type: execute
wave: 7
depends_on: ["04-15"]
files_modified:
  - .planning/phases/04-bridal-contracts/04-VALIDATION.md
autonomous: false
requirements: [CONT-01, AI-01, CONT-02]

must_haves:
  truths:
    - "O IP gravado no aceite feito pelo link público no staging é o IP real do cliente (não 127.0.0.1 nem o do nginx)"
    - "O PDF de um contrato aceito tem o texto completo com acentos corretos e o bloco de aceite digital com hash"
    - "Com ANTHROPIC_API_KEY no staging, 'Sugerir agenda IA' devolve 'Sugestão da IA' sem conflitos e a agenda confirmada aparece em /agenda"
    - "Alertas de contrato no sino aparecem para ADMIN e não para PROFESSIONAL"
  artifacts:
    - path: ".planning/phases/04-bridal-contracts/04-VALIDATION.md"
      provides: "Seção Manual-Only Verifications marcada com o resultado"
  key_links:
    - from: "staging nginx"
      to: "backend /public/contracts"
      via: "X-Forwarded-For + trustProxy (04-09)"
      pattern: "X-Forwarded-For"
---

<objective>
Verificação humana dos itens que o VALIDATION.md marca como manuais (IP real atrás do proxy, layout do PDF, Claude real com chave, visibilidade do sino por papel), depois do deploy no staging.

Purpose: esses comportamentos dependem de infraestrutura real (nginx, secret da Anthropic) ou de avaliação visual — o CI não cobre.
Output: aprovação do usuário registrada em 04-VALIDATION.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-VALIDATION.md
@.planning/phases/04-bridal-contracts/04-09-SUMMARY.md
@.planning/phases/04-bridal-contracts/04-15-SUMMARY.md

Antes do checkpoint, o executor faz o que for automatizável: push de `master` e deploy do staging pelo fluxo de sempre (memória do usuário: gate completo → push → deploy staging → acompanhar CI), confirma `ANTHROPIC_API_KEY` presente nos secrets do staging (sem imprimir o valor: `test -n "$ANTHROPIC_API_KEY"` dentro do container do backend) e que o nginx encaminha `/public/` com `X-Forwarded-For` (04-09 Task 3).
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Verificação humana dos itens manuais da fase 4</name>
  <files>.planning/phases/04-bridal-contracts/04-VALIDATION.md</files>
  <read_first>
    - .planning/phases/04-bridal-contracts/04-VALIDATION.md (seção Manual-Only Verifications)
    - .planning/phases/04-bridal-contracts/04-09-SUMMARY.md (pendências de nginx, se houver)
  </read_first>
  <action>Executor: fazer deploy do staging e as checagens automatizáveis do contexto; apresentar ao usuário os passos abaixo; após a resposta, registrar o resultado (aprovado/problemas) em cada linha da tabela "Manual-Only Verifications" do 04-VALIDATION.md.</action>
  <what-built>Fase 4 completa no staging: grupos de noivas, agenda do evento com sugestão IA, contratos com entrada + restante, aceite público, PDF, pagamentos, cancelamento, alertas no sino e por e-mail.</what-built>
  <how-to-verify>
    1. No staging, abrir um contrato pelo link público, aceitar, e conferir em Contratos › detalhe › Aceite que o IP gravado não é 127.0.0.1 nem o IP do nginx.
    2. Baixar o PDF desse contrato e conferir: título com o salão e o código, texto completo com acentos, bloco "Aceite digital" (nome, CPF mascarado, data/hora, IP, SHA-256).
    3. Com a chave configurada: abrir um grupo sem agenda → "Sugerir agenda IA" → badge "Sugestão da IA" (modelo `claude-sonnet-5-5`), proposta sem conflitos e noiva terminando por último até "pronta até"; editar um horário e "Confirmar agenda"; conferir em /agenda.
    4. Abrir o sino como ADMIN e como PROFESSIONAL: o alerta de contrato aparece só para o ADMIN.
  </how-to-verify>
  <verify>
    <automated>grep -n "Manual-Only Verifications" /root/sgs/.planning/phases/04-bridal-contracts/04-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - Usuário respondeu "aprovado" (ou os problemas viraram gap registrado)
    - As 3 linhas da tabela Manual-Only Verifications do 04-VALIDATION.md têm o resultado anotado
  </acceptance_criteria>
  <done>Itens manuais aprovados pelo usuário e registrados.</done>
  <resume-signal>Digite "aprovado" ou descreva os problemas</resume-signal>
</task>

</tasks>

<verification>Aprovação do usuário registrada.</verification>

<success_criteria>Evidência de aceite, PDF e IA real conferidos em ambiente real.</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-16-SUMMARY.md`
</output>

---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 15
type: execute
wave: 6
depends_on: ["09-12", "09-13", "09-14"]
files_modified:
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/config/__tests__/features.test.ts
  - apps/e2e/support/phase9.ts
  - apps/e2e/tests/comercial-funil.spec.ts
  - apps/e2e/tests/comercial-visibilidade.spec.ts
  - apps/e2e/tests/comercial-formulario.spec.ts
autonomous: true
requirements: [COM-01, COM-03, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11]

must_haves:
  truths:
    - "A flag comercial está ligada: menu Comercial e rotas /comercial/* e /contato/* no ar"
    - "Fluxo fim a fim no navegador: cadastrar lead → criar negócio Noiva com pacote → mover de etapa (arrastar no desktop e 'Mover para…') → registrar interação com próximo contato (lembrete aparece em Lembretes) → marcar ganho com sinal → cair em /contratos/{id} com contrato Rascunho"
    - "Perdido com motivo some das colunas abertas e aparece na coluna Perdido"
    - "Atendente não vê negócio atribuído a outra pessoa nem o menu Relatórios; profissional não vê o menu Comercial e /comercial redireciona"
    - "Formulário público: envio com consentimento cria lead visível ao gerente; token errado mostra 'Formulário indisponível'"
  artifacts:
    - path: "apps/e2e/support/phase9.ts"
      provides: "helpers de seed da fase 9 por GraphQL"
      exports: ["createCommercialLead", "createCommercialDeal", "enableCommercialForm", "stageIdByName"]
    - path: "apps/e2e/tests/comercial-funil.spec.ts"
      provides: "E2E do funil até o contrato"
      contains: "/contratos/"
  key_links:
    - from: "apps/frontend/src/config/features.ts"
      to: "router.tsx / menu-config.ts"
      via: "FEATURES.comercial = true"
      pattern: "comercial: true"
---

<objective>
Ligar a flag `comercial` e cobrir os fluxos críticos com Playwright (funil até o contrato, perdido, visibilidade por papel, formulário público).

Purpose: CLAUDE.md exige E2E nos fluxos críticos; a flag só liga junto com o backend real e os testes (regra de `features.ts`).
Output: flag ligada, helper `phase9.ts`, 3 specs E2E.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-VALIDATION.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-12-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-13-SUMMARY.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-14-SUMMARY.md

**Ambiente de execução:** igual ao 09-01. E2E: `corepack pnpm --filter @sgs/e2e test:e2e` (sem `--` antes das flags; para um arquivo: `corepack pnpm --filter @sgs/e2e test:e2e tests/comercial-funil.spec.ts`). Backend do E2E em `http://localhost:3100/graphql` (`support/graphql.ts`).

<interfaces>
`apps/e2e/support/seed-state.ts`: `SeedState { orgId, owner, manager, attendant, proBlocked, proEditable, phase3 {...} }` (`SeedUser { email, password, name, memberId? }`), lido do `.e2e-state/seed.json` gerado por `tests/seed.setup.ts`.
`support/graphql.ts`: `gql<T>(query, variables, token?)`, `expectNoUserErrors`. `support/ui.ts`: `loginViaUi(page, email, password)`, `navigateViaMenu(page, ...path)`. `support/phase4.ts`: `createBridalPackage(...)`, `todayPlusDays(n)`, `ymdToBr`.
Modelos: `tests/noivas-contrato.spec.ts`, `tests/debutante-contrato.spec.ts`, `tests/agenda-dnd.spec.ts` (arrastar com @dnd-kit no Playwright: `page.mouse.down/move/up` em passos, por causa do `distance: 8`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ligar a flag e helper E2E da fase 9</name>
  <files>apps/frontend/src/config/features.ts, apps/frontend/src/config/__tests__/features.test.ts, apps/e2e/support/phase9.ts</files>
  <read_first>
    - apps/frontend/src/config/features.ts
    - apps/frontend/src/config/__tests__/features.test.ts
    - apps/e2e/support/phase4.ts e support/graphql.ts
    - apps/e2e/tests/seed.setup.ts
  </read_first>
  <action>
1. `features.ts`: `comercial: true` (comentário: "Comercial (fase 9): backend real 09-04..09-10"). Ajustar `features.test.ts` (rotas `/comercial` e `/contato/x/y` habilitadas; menu com o grupo para ADMIN).
2. `phase9.ts`: `loginToken(user)` (mutation de login, como os helpers da fase 4), `stageIdByName(token, name)`, `createCommercialLead(token, { fullName, phone })`, `createCommercialDeal(token, { leadId, kind, packageId, eventDate, assigneeMemberId? })`, `enableCommercialForm(token)` → `{ orgId, token, publicPath }`. Nomes com sufixo aleatório para não colidir entre execuções.
Commit `feat(09-15): liga o Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/config src/components/layout && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/e2e exec tsc --noEmit -p .</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "comercial: true" apps/frontend/src/config/features.ts` encontra
    - `grep -n "export async function createCommercialDeal" apps/e2e/support/phase9.ts` encontra
    - comando do `<verify>` sai 0 (se o pacote e2e não tiver tsconfig próprio, trocar o último passo por `corepack pnpm --filter @sgs/e2e test:e2e --list` e registrar no SUMMARY)
  </acceptance_criteria>
  <done>Comercial ligado e helpers prontos.</done>
</task>

<task type="auto">
  <name>Task 2: Specs E2E do funil, visibilidade e formulário</name>
  <files>apps/e2e/tests/comercial-funil.spec.ts, apps/e2e/tests/comercial-visibilidade.spec.ts, apps/e2e/tests/comercial-formulario.spec.ts</files>
  <read_first>
    - apps/e2e/tests/noivas-contrato.spec.ts
    - apps/e2e/tests/agenda-dnd.spec.ts
    - apps/e2e/tests/equipe-acoes-por-papel.spec.ts
    - apps/e2e/support/phase9.ts (Task 1)
  </read_first>
  <action>
1. `comercial-funil.spec.ts` (como `attendant`, desktop 1280×800):
   - Leads → 'Novo lead' com nome e telefone novos → salvar → abre a ficha.
   - 'Novo negócio' Noiva com o pacote de noiva do seed (criar com `createBridalPackage` se o seed não tiver), data do evento `todayPlusDays(120)`, desconto 50 → valor final exibido.
   - Pipeline: arrastar o card de 'Novo' para 'Contato' (mouse em passos) → card em Contato após reload; depois 'Mover para…' → 'Proposta'.
   - Ficha do lead → 'Registrar interação' WhatsApp com 'Próximo contato em' amanhã 10:00 → Lembretes › Próximos lista 'Retomar contato com {nome}'.
   - Pipeline → menu do card → 'Marcar como ganho' → preencher CPF válido, endereço, CEP, celular 2 → 'O sinal já foi pago?' Sim, Pix, valor sugerido → confirmar → URL `/contratos/<uuid>` e texto 'Rascunho' visível.
   - Segundo lead/negócio → 'Marcar como perdido' → motivo 'Preço' → card na coluna Perdido.
2. `comercial-visibilidade.spec.ts`: por GraphQL, `manager` cria lead + negócio atribuído ao `manager` ('Negócio do gerente {sufixo}'); `attendant` no Pipeline não vê esse card e `/comercial/relatorios` redireciona para `/comercial`; menu do `attendant` sem 'Relatórios'; `proEditable` (PROFESSIONAL) não vê 'Comercial' no menu e `/comercial` redireciona para `/agenda`; `manager` vê o card e o menu 'Relatórios'.
3. `comercial-formulario.spec.ts`: `enableCommercialForm(managerToken)`; abrir `/contato/{orgId}/{token}` sem login; enviar sem consentimento → 'É preciso autorizar o contato'; marcar e enviar → mensagem de sucesso; `manager` vê o lead em Leads com filtro 'Sem responsável'; `/contato/{orgId}/token-errado` → 'Formulário indisponível'.
Rodar e corrigir até verde (correções em código de produção ficam registradas no SUMMARY com o arquivo). Commit `test(09-15): E2E do Comercial`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/e2e test:e2e tests/comercial-funil.spec.ts tests/comercial-visibilidade.spec.ts tests/comercial-formulario.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Marcar como ganho" apps/e2e/tests/comercial-funil.spec.ts` encontra e `grep -n "/contratos/" apps/e2e/tests/comercial-funil.spec.ts` encontra
    - `grep -n "mouse.move" apps/e2e/tests/comercial-funil.spec.ts` encontra
    - `grep -n "proEditable" apps/e2e/tests/comercial-visibilidade.spec.ts` encontra
    - `grep -n "Formulário indisponível" apps/e2e/tests/comercial-formulario.spec.ts` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Fluxos críticos do Comercial cobertos de ponta a ponta.</done>
</task>

</tasks>

<verification>
Os 3 specs E2E verdes; vitest de config/layout verde.
</verification>

<success_criteria>
O Comercial está ligado e o funil inteiro passa no navegador real.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-15-SUMMARY.md`
</output>

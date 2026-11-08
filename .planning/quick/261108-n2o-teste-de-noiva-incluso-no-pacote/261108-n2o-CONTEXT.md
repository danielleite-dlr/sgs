# Quick Task 261108-n2o: Teste de noiva incluso no pacote - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Task Boundary

Nos pacotes de noiva, a maquiagem e o penteado da noiva passam a incluir o teste (prova) dentro
do valor já pago do pacote. Exemplo da usuária: maquiagem de R$ 400 no pacote = R$ 200 de teste +
R$ 200 de atendimento no evento, e os dois são pagos na conclusão do atendimento (dia do evento),
não no dia do teste.

</domain>

<decisions>
## Implementation Decisions (locked — escolhidas pela usuária)

### Quais pacotes
- Opção **por pacote**, controlada no cadastro do pacote (não automático para todo pacote de noiva).
- Ligar nos pacotes de noiva atuais do Studio JS no staging: **Essence, Experience e Glam**
  (org `01a0b681-8b9b-790b-921d-4518350e534b`). "Make & Penteado (madrinhas)" fica desligado.

### Quais serviços
- **Maquiagem e penteado** ganham o teste incluso (no catálogo atual: "Maquiagem noiva" e
  "Penteado noiva"). Outros serviços do pacote (massagem, limpeza de pele, depilação,
  pré-wedding) não ganham teste.
- Sugestão (Claude's discretion): guardar a marca por serviço do pacote (`package_services`,
  ex. `includes_trial boolean default false`), com checkbox "inclui teste" em cada serviço no
  formulário do pacote — atende "por pacote" e evita casar por nome de categoria. Backfill liga
  a marca em Maquiagem noiva e Penteado noiva dos três pacotes. Se o planner preferir flag no
  pacote + regra por categoria, justificar.

### Divisão do valor
- **Metade e metade**: o valor rateado do serviço no pacote (saída de `prorateServiceUnits`) é
  dividido 50/50 entre um item `purpose='trial'` e um item `purpose='event'` no contrato. Centavo
  ímpar fica no evento. O total do pacote/contrato **não muda**.

### Pagamento
- **Teste sem cobrança**: a comanda do teste da noiva coberta pelo contrato leva o item do teste
  a R$ 0,00 e indica "incluso no pacote, pago no evento". O valor do teste é cobrado junto na
  comanda do dia do evento (item do evento = parte do evento + parte do teste), de modo que a
  soma cobrada nas comandas bate com o contrato.
- Previsão de caixa: o valor do teste entra na data do evento, não na data do teste.
- PDF/snapshot do contrato: mostrar o teste como incluso (ex.: "Maquiagem noiva (teste —
  incluso, pago no evento)").

### Claude's Discretion
- Modelagem exata (coluna em `package_services` e/ou marca em `contract_items`, ex.
  `settled_at_event`), nomes de campos GraphQL, textos de UI.
- Como a cobertura (`coveragePriceMapTx` / `syncContractCoverageTx` em
  `apps/backend/src/bridal/bridal-coverage.ts`) passa a zerar o teste e somar no evento.
- Comissão: manter a regra atual (listUnitPrice/comissão seguem o catálogo, D-08) salvo se
  houver motivo claro.

</decisions>

<specifics>
## Pontos do código já levantados

- `apps/backend/src/contracts/contracts.service.ts` ~L340-385: com pacote, `brideItems` saem
  todos com `purpose: "event"` a partir de `pkg.services` rateados por `prorateServiceUnits`.
- `contract_items.purpose` já aceita `event|trial`; `appointments.purpose` também.
- `apps/backend/src/bridal/bridal-coverage.ts`: `coveragePriceMapTx(tx, groupId, memberId,
  purpose)` monta preço acordado por serviço e finalidade; `syncContractCoverageTx` sincroniza
  comandas abertas do grupo.
- `apps/backend/src/appointments/visits.ts` ~L290: aplica o preço acordado no item da comanda.
- `apps/backend/src/bridal/bridal-schedule.ts`: agenda visitas de grupo (event/trial); teste
  precisa ser antes da data do evento.
- `apps/backend/src/financial/forecast.service.ts` ~L197: itens `trial` sem agendamento ficam
  fora da previsão.
- `apps/backend/src/contracts/domain/contract-snapshot.ts` L124: sufixo " (teste)" na descrição.
- Hoje o catálogo tem "Maquiagem noiva" e "Penteado noiva" com `base_price` 0,00 — o teste da
  noiva hoje sai a R$ 0 só por acaso.
- Frontend: `apps/frontend/src/pages/PacotesPage.tsx` (formulário do pacote).
- Contratos existentes não devem ser reescritos silenciosamente; só contratos novos ou
  atualizados recalculam itens (seguir o padrão de preservação de itens já existente no update).

## Regras do projeto (memória do usuário)
- Gate completo antes de cada commit: lint + tsc + jest unit + integração (Postgres local
  sgs_dev 5433/5434) + vitest; E2E Playwright em `apps/e2e`
  (`corepack pnpm --filter @sgs/e2e test:e2e`).
- Frontend sem prettier configurado: formatar à mão (aspas simples, ~100 colunas).
- Nunca importar `tailwind.config.ts` em código/teste de `src`.
- Há alterações pendentes NÃO commitadas de outra tarefa (261107-kpj: LoginPage.tsx,
  PacotesPage.tsx com max-h nos diálogos, apps/e2e/support/ui.ts, apps/e2e/tests/smoke.spec.ts,
  `apps/frontend/src/features/auth/pages/__tests__/`) — não incluir nos commits desta tarefa
  (atenção: PacotesPage.tsx tem mudança pendente de 2 linhas; usar `git add -p` ou commitar
  só os hunks desta tarefa).

</specifics>

<canonical_refs>
## Canonical References

- `PRD_Banco_Dados_Plataforma_Saloes_v1.1.md`, `PRD_Backend_Plataforma_Saloes.md` (contratos/noivas)
- Quick tasks anteriores: 261104-hyq, 261104-ix0, 261104-ky7 (pacote e rateio no contrato),
  261106-cst (previsão de caixa)

</canonical_refs>

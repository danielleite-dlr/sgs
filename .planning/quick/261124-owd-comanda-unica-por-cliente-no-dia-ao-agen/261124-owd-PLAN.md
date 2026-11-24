---
phase: quick-261124-owd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/backend/src/comandas/comanda-open.ts
  - apps/backend/src/appointments/visits.ts
  - apps/backend/test/integration/quick-261124-owd-comanda-unica.e2e.spec.ts
autonomous: true
requirements: [QUICK-261124-OWD]

must_haves:
  truths:
    - "Cliente com comanda aberta e agendamento ativo num dia: nova visita (createVisit/createAppointment/scheduleBridalEvent) no MESMO dia local entra nessa comanda — itens somados e total recalculado"
    - "Visita em outro dia local abre comanda nova (comportamento atual)"
    - "Comanda fechada ou cancelada nunca é reaproveitada: abre nova"
    - "Payload de createVisit devolve o comandaId da comanda reaproveitada; sinal (crédito + caixa) é gravado nela"
    - "Walk-in (openComanda em comandas.service) não muda"
    - "Staging: make da Edna (C-2026-117) está na C-2026-025 com o penteado, total 500.00; C-2026-117 cancelada com total 0"
  artifacts:
    - path: "apps/backend/src/comandas/comanda-open.ts"
      provides: "findReusableComandaTx (procura + trava comanda aberta da cliente no dia)"
      contains: "findReusableComandaTx"
    - path: "apps/backend/src/appointments/visits.ts"
      provides: "createVisitTx reaproveita comanda antes de abrir nova"
      contains: "findReusableComandaTx"
    - path: "apps/backend/test/integration/quick-261124-owd-comanda-unica.e2e.spec.ts"
      provides: "integração: mesmo dia junta, outro dia separa, fechada separa"
  key_links:
    - from: "apps/backend/src/appointments/visits.ts"
      to: "findReusableComandaTx"
      via: "chamada antes de openComandaTx"
      pattern: "findReusableComandaTx\\(tx"
    - from: "findReusableComandaTx"
      to: "comandas + appointments"
      via: "SQL com pg_advisory_xact_lock por cliente + FOR UPDATE na comanda"
      pattern: "pg_advisory_xact_lock"
---

<objective>
Agendamento novo reaproveita a comanda aberta da cliente no mesmo dia local, em vez de sempre abrir
comanda nova. Depois, juntar no staging o único caso já existente (Edna, C-2026-117 → C-2026-025).

Bug (staging): Edna Maria Assis de Jesus, madrinha do grupo "Noiva Evillyn Assis", evento 20/11/2026
13:00, tinha "Penteado madrinha" na C-2026-025 (aberta). Pela agenda agendaram "Maquiagem madrinha"
(createVisit) e o sistema abriu a C-2026-117 só com a maquiagem; ao fechar aparece um serviço só.

Output: helper de reaproveitamento + wiring em createVisitTx + teste de integração; gate verde,
commit, push no master, deploy staging, CI verde; correção de dados no staging com backup.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/root/sgs/CLAUDE.md
@/root/sgs/.planning/STATE.md
@/root/sgs/apps/backend/src/appointments/visits.ts
@/root/sgs/apps/backend/src/comandas/comanda-open.ts
@/root/sgs/.planning/quick/261124-mkp-agenda-liga-grupo-e-agendar-agora/261124-mkp-SUMMARY.md
@/root/sgs/apps/backend/test/integration/quick-261124-mkp-autolink.e2e.spec.ts

<interfaces>
Extraído do código (não precisa explorar):

apps/backend/src/comandas/comanda-open.ts
```ts
export async function openComandaTx(
  tx: TenantPrismaClient,
  a: { orgId: string; clientId: string; openedBy: string; now?: Date },
): Promise<Comanda>; // status 'open', total '0.00', code via nextComandaCode
```

apps/backend/src/appointments/visits.ts — createVisitTx(tx, orgId, memberId, input)
  -> Promise<{ appointmentIds: string[]; comandaId: string }>
  Fluxo atual: valida → acquireScheduleLocks(tx, orgId, profIds) → cria appointments (array `created`,
  `intervals[idx].startsAt`) → `const comanda = await openComandaTx(...)` (linha ~245) →
  appointment.updateMany({comandaId}) → itens (expandPackageItems OU buildServiceItem; ambos só montam
  linhas com o comandaId e fazem createMany — funcionam com comanda que já tem itens; o rateio do pacote
  é só entre as linhas do próprio pacote) → recalcComandaTotal(tx, comanda.id) (soma de todos os
  itens) → sinal: lockClient + recordCreditMovement({comandaId}) + recordCashMovement({comandaId}).
  Chamadores: AppointmentsService.createVisit (createAppointment usa o mesmo caminho) e
  bridal/bridal-schedule.ts scheduleBridalEventTx (linha ~216, um createVisitTx por pessoa/finalidade).

Locks: acquireScheduleLocks = advisory por org (shared) + por profissional (não serializa duas visitas
da MESMA cliente com profissionais diferentes). lockClient = `SELECT ... FROM clients FOR UPDATE`.
comanda-close.ts trava `comandas FOR UPDATE` e DEPOIS lockClient → ordem comanda → cliente.

Status: BLOCKING_STATUSES = scheduled, confirmed, in_progress, completed (appointments/appointment-status.ts);
inativos = cancelled, no_show. Comanda: open | closed | cancelled.
Fuso: `SELECT timezone FROM organizations` (default America/Sao_Paulo). NÃO importar orgTimezone de
bridal/bridal-schedule.ts em visits.ts/comanda-open.ts — bridal-schedule já importa visits (ciclo).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Reaproveitar comanda aberta do mesmo dia em createVisitTx + teste de integração</name>
  <files>apps/backend/src/comandas/comanda-open.ts, apps/backend/src/appointments/visits.ts, apps/backend/test/integration/quick-261124-owd-comanda-unica.e2e.spec.ts</files>
  <behavior>
    - (1) createVisit cliente X dia D 10:00 (serviço A) → comanda C1; segunda createVisit X dia D 14:00
      (serviço B, outra profissional) → mesmo comandaId C1 no payload; C1 tem 2 itens, 2 appointments
      com comanda_id = C1, total = preço A + preço B; só 1 comanda da cliente no banco.
    - (2) segunda visita no dia D+1 → comanda nova (2 comandas).
    - (3) C1 fechada (status 'closed' via SQL admin ou closeComanda) e nova visita no dia D → comanda nova.
    - (4) extra: comanda do dia D cujo único agendamento está cancelled → não reaproveita (abre nova).
    - (5) extra: segunda visita com sinal no dia D → client_credit_movements e cash_movements do sinal
      têm comanda_id = C1.
  </behavior>
  <action>
    RED primeiro: criar `apps/backend/test/integration/quick-261124-owd-comanda-unica.e2e.spec.ts` no
    formato de `quick-261124-mkp-autolink.e2e.spec.ts` (createPhase4World('q24owd'), gqlAs com token
    attendant, helpers localDay/at, afterEach limpando cash_movements, client_credit_movements,
    appointments, comanda_items e comandas da org — conferir em deletePhase4Rows/phase3-visit o que já é
    limpo). Mutation: `createVisit(input) { comandaId appointments { id } errors { code } }`. Usar
    w.members.proA/proB e serviço(s) do world (ver helpers/phase4-fixtures; se só houver um serviço que
    proB atenda, usar horários sem sobreposição com a mesma profissional). Cobrir os casos do behavior.
    Rodar e ver falhar o caso (1).

    GREEN: em comanda-open.ts exportar
    `findReusableComandaTx(tx, a: { clientId: string; startsAt: Date[] }): Promise<string | null>`:
      1. `SELECT pg_advisory_xact_lock(hashtext('visit-comanda:' || ${clientId}))` — serializa visitas
         paralelas da mesma cliente (duas abas/duplo clique) sem tocar no lock de linha de clients;
         advisory antes de comanda FOR UPDATE e de lockClient preserva a ordem comanda → cliente usada
         em comanda-close.ts (sem deadlock).
      2. Calcular os dias locais dos startsAt no SQL: `SELECT c.id FROM comandas c WHERE c.client_id =
         $clientId::uuid AND c.status = 'open' AND EXISTS (SELECT 1 FROM appointments a WHERE
         a.comanda_id = c.id AND a.status IN ('scheduled','confirmed','in_progress','completed') AND
         (a.starts_at AT TIME ZONE o.tz)::date = ANY(<dias dos itens, também AT TIME ZONE o.tz>))
         ORDER BY c.opened_at ASC, c.id ASC LIMIT 1 FOR UPDATE OF c`, com `o.tz` vindo de
         `(SELECT COALESCE(timezone,'America/Sao_Paulo') FROM organizations LIMIT 1)` (RLS já filtra a
         org). Montar os dias via `unnest(${startsAt}::timestamptz[])` ou passar strings ISO; usar
         status de BLOCKING_STATUSES (importar de appointments/appointment-status, sem ciclo).
         Os agendamentos recém-criados desta visita ainda NÃO têm comanda_id, então não interferem.
      3. Retornar o id (ou null). Comentário curto citando quick 261124-owd.
    Em visits.ts, no lugar de `const comanda = await openComandaTx(...)`:
      `const reusedId = await findReusableComandaTx(tx, { clientId: input.clientId, startsAt:
      intervals.map((i) => i.startsAt) });` e `const comandaId = reusedId ?? (await openComandaTx(tx,
      {...})).id;` — trocar todos os `comanda.id` seguintes por `comandaId` (updateMany, expandPackageItems,
      buildServiceItem, recalcComandaTotal, recordCreditMovement, recordCashMovement, return). Nada mais
      muda: itens, pacote, cobertura e sinal funcionam igual na comanda reaproveitada; recalcComandaTotal
      já soma todos os itens. Atualizar o docstring de createVisitTx ("1 comanda aberta — reaproveita a
      aberta da cliente no mesmo dia, 261124-owd"). Não mexer em openComanda de comandas.service (walk-in).
    Rodar o spec novo (verde), depois `phase3-visit`, `phase3-comanda-*`, `phase4-*bridal*`,
    `quick-261124-mkp-autolink` e o restante da integração: testes antigos que criam duas visitas da
    mesma cliente no mesmo dia esperando duas comandas devem ser ajustados para a regra nova (mudar o
    dia/cliente do segundo caso, não enfraquecer a asserção) — registrar no SUMMARY quais.
  </action>
  <verify>
    <automated>cd /root/sgs/apps/backend && (carregar .env linha a linha, ver memória sgs-workflow-feedback) npx jest -c test/jest-integration.json --runInBand quick-261124-owd phase3-visit quick-261124-mkp (conferir o nome real do config/script de integração em package.json)</automated>
  </verify>
  <done>Os 5 casos passam; payload devolve o comandaId reaproveitado; suítes de visita/comanda/noiva verdes.</done>
</task>

<task type="auto">
  <name>Tarefa 2: Gate completo, commit, push no master, deploy staging e CI verde</name>
  <files>(nenhum arquivo novo; commit dos arquivos da Tarefa 1)</files>
  <action>
    Gate (memória sgs-workflow-feedback): backend lint + tsc + jest unit + integração completa (Postgres
    local sgs_dev 5433/5434; se travar no boot, `docker exec sgs_valkey valkey-cli ping`) + vitest do
    frontend (nada muda no front, mas o gate é obrigatório). Tudo verde → commit
    `fix(quick-261124-owd): agendamento reaproveita a comanda aberta da cliente no mesmo dia` com o
    trailer de co-autoria, push no `master`.
    Deploy: `git status` em /root/sgs — se houver mudança não commitada alheia (ex.: `.planning/phases/
    09.1-assistente-de-noiva/.gitkeep` é inofensivo; código não commitado de outra sessão não é),
    buildar de worktree limpo do HEAD conforme a memória sgs-deploy-worktree-limpo; senão
    `./scripts/deploy-staging.sh` direto. Sem migration nesta tarefa. Depois `gh run watch` até o CI do
    commit ficar verde; só então reportar "verde".
  </action>
  <verify>
    <automated>cd /root/sgs && gh run list --branch master --limit 1 --json conclusion,headSha --jq '.[0]'</automated>
  </verify>
  <done>Commit no master, staging com o backend novo no ar, CI do commit com conclusion=success.</done>
</task>

<task type="auto">
  <name>Tarefa 3: Staging — juntar a make da Edna (C-2026-117) na C-2026-025, com backup</name>
  <files>/root/sgs-backups/staging-pre-261124-owd-*.sql.gz (backup; nenhum arquivo do repo)</files>
  <action>
    Acesso e RLS: memória sgs-staging-org (`set -a && . ./.env.staging && set +a && docker exec -e
    PGPASSWORD=... sgs_stg_postgres psql ...`; dentro da transação `SET LOCAL app.current_organization =
    '01a0b681-8b9b-790b-921d-4518350e534b'`).
    1. Backup: pg_dump do banco staging gzip em `/root/sgs-backups/staging-pre-261124-owd-<AAAAMMDD-HHMM>.sql.gz`.
    2. Conferir antes (abortar e reportar se algo não bater): C-2026-117 = 01a20f54-8300-71b7-aab8-783c8f595c7a
       e C-2026-025 = 01a1c8aa-7bea-7c7b-98fe-2073d89b8dc6, mesma cliente, ambas `open`; a 117 tem só o
       item 01a20f54-831e-72d5-92f5-d6dda4d021c5 e só o appointment 01a20f54-82c6-78cd-9eec-c870cd9e5709;
       a 117 tem 0 linhas em comanda_payments, cash_movements, client_credit_movements, commission_records,
       stock_movements.
    3. Numa transação: `UPDATE comanda_items SET comanda_id = <025> WHERE id = <item>`; `UPDATE appointments
       SET comanda_id = <025> WHERE id = <appt>`; recalcular total da 025 (mesmo SQL de recalcComandaTotal);
       `UPDATE comandas SET status='cancelled', cancelled_at=now(), cancel_reason='Juntada na C-2026-025',
       total=0 WHERE id=<117>`. Antes do COMMIT, SELECT do total da 025 — deve ser 500.00; se não, ROLLBACK
       e reportar.
    4. Conferir depois: 025 com 2 itens (penteado + maquiagem madrinha) e 2 appointments; 117 cancelled.
       Procurar outros casos iguais (cliente com 2+ comandas `open` com agendamentos ativos no mesmo dia
       local) e só listar no SUMMARY — não mexer sem o usuário pedir.
    Registrar no SUMMARY o caminho do backup e o resultado.
  </action>
  <verify>
    <automated>psql staging (como acima): SELECT code,status,total FROM comandas WHERE id IN ('01a1c8aa-7bea-7c7b-98fe-2073d89b8dc6','01a20f54-8300-71b7-aab8-783c8f595c7a') → C-2026-025 open 500.00; C-2026-117 cancelled 0.00</automated>
  </verify>
  <done>Backup gravado; C-2026-025 com make + penteado e total 500.00; C-2026-117 cancelada com motivo; outros casos (se houver) listados.</done>
</task>

</tasks>

<verification>
- Integração nova cobre: mesmo dia junta (2 itens, total somado, comandaId reaproveitado), outro dia
  separa, comanda fechada separa, agendamento cancelado não conta, sinal vai para a reaproveitada.
- Gate completo verde antes do commit; CI do commit verde.
- Staging: C-2026-025 = 500.00 com dois serviços; C-2026-117 cancelada.
</verification>

<success_criteria>
Agendar pela agenda (ou pelo grupo da noiva) um segundo serviço para a mesma cliente no mesmo dia cai na
comanda aberta já existente; ao fechar, aparecem todos os serviços do dia. Walk-in inalterado.
</success_criteria>

<output>
Criar `.planning/quick/261124-owd-comanda-unica-por-cliente-no-dia-ao-agen/261124-owd-SUMMARY.md`
(formato do 261124-mkp-SUMMARY: Pedido, Feito, Testes, Dados (staging) com backup).
</output>

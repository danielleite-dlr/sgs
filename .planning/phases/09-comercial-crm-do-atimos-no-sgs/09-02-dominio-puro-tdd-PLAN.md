---
phase: 09-comercial-crm-do-atimos-no-sgs
plan: 02
type: tdd
wave: 1
depends_on: []
files_modified:
  - apps/backend/package.json
  - pnpm-lock.yaml
  - apps/backend/src/commercial/commercial-constants.ts
  - apps/backend/src/commercial/commercial-phone.ts
  - apps/backend/src/commercial/commercial-phone.spec.ts
  - apps/backend/src/commercial/commercial-sla.ts
  - apps/backend/src/commercial/commercial-sla.spec.ts
  - apps/backend/src/commercial/commercial-access.ts
  - apps/backend/src/commercial/commercial-access.spec.ts
autonomous: true
requirements: [COM-01, COM-05, COM-10]

must_haves:
  truths:
    - "Telefones com máscara, +55 e com/sem 9º dígito são reconhecidos como o mesmo número (D-02)"
    - "Um negócio aberto é 'atrasado' quando a etapa tem prazo e passou sla_days desde a última interação (ou da entrada na etapa, se nunca houve interação) (D-15)"
    - "ADMIN/MANAGER veem tudo; ATTENDANT vê só negócios em que é responsável e leads criados por ela ou com negócio dela; sem responsável fica só para ADMIN/MANAGER (D-12, D-20)"
    - "Quem pode marcar ganho é decidido num único ponto (WIN_DEAL_ROLES), hoje ADMIN, MANAGER e ATTENDANT (D-21, a confirmar)"
    - "exceljs está instalado no backend para os planos de importação e exportação"
  artifacts:
    - path: "apps/backend/src/commercial/commercial-access.ts"
      provides: "COMMERCIAL_ROLES, isManagerRole, canUseCommercial, WIN_DEAL_ROLES, canWinDeal, visibilityWhere"
      exports: ["COMMERCIAL_ROLES", "isManagerRole", "canUseCommercial", "WIN_DEAL_ROLES", "canWinDeal", "visibilityWhere"]
    - path: "apps/backend/src/commercial/commercial-phone.ts"
      provides: "phoneDigits, phoneKey, samePhone"
      exports: ["phoneDigits", "phoneKey", "samePhone"]
    - path: "apps/backend/src/commercial/commercial-sla.ts"
      provides: "isDealOverdue, overdueSince"
      exports: ["isDealOverdue", "overdueSince"]
    - path: "apps/backend/src/commercial/commercial-constants.ts"
      provides: "listas fixas e rótulos"
      exports: ["LOST_REASONS", "INTERACTION_TYPES", "DEAL_KINDS", "COMMERCIAL_SOURCES"]
  key_links:
    - from: "apps/backend/src/commercial/commercial-constants.ts"
      to: "migration 20261122000000 (CHECKs)"
      via: "mesmos códigos"
      pattern: "date_unavailable"
---

<objective>
Funções puras do domínio comercial, com TDD: normalização de telefone (duplicidade), SLA por etapa, regras de acesso por papel (incluindo o ponto único da D-21) e as listas fixas. Instala `exceljs` (única dependência nova da fase).

Purpose: são as regras que vazam dado ou erram alerta se divergirem; ficam num lugar só, testadas, e todo serviço as importa.
Output: 4 módulos puros + 3 specs; `exceljs` no `apps/backend/package.json`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-CONTEXT.md
@.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-RESEARCH.md

**Ambiente de execução:** igual ao 09-01. Este plano não usa banco.
</context>

<feature>
  <name>Domínio puro do Comercial</name>
  <files>apps/backend/src/commercial/commercial-constants.ts, commercial-phone.ts(+spec), commercial-sla.ts(+spec), commercial-access.ts(+spec)</files>
  <behavior>
    commercial-phone:
    - phoneDigits('(11) 99999-0000') -> '11999990000'; phoneDigits('+55 11 99999-0000') -> '11999990000'; phoneDigits('5511999990000') -> '11999990000'; phoneDigits('') -> null; phoneDigits('abc') -> null; phoneDigits('123') -> null (menos de 10 dígitos)
    - phoneKey devolve DDD + últimos 8 dígitos: phoneKey('11999990000') -> '1199990000'; phoneKey('1199990000') (sem 9º dígito) -> '1199990000'
    - samePhone('(11) 99999-0000', '11 9999-0000') -> true; samePhone('(11) 99999-0000', '(21) 99999-0000') -> false; samePhone(null, '11999990000') -> false
    commercial-sla (now fixo 2026-11-18T12:00:00Z):
    - stage sem slaDays -> false; status 'won'/'lost' -> false
    - slaDays 2, lastInteractionAt 2026-11-16T11:59:59Z -> true; 2026-11-16T12:00:01Z -> false
    - lastInteractionAt null usa stageEnteredAt
    - overdueSince devolve a data limite (base + slaDays dias) ou null
    commercial-access:
    - isManagerRole('ADMIN'|'MANAGER') true; 'ATTENDANT'/'PROFESSIONAL'/'' false
    - canUseCommercial('PROFESSIONAL') false; ADMIN/MANAGER/ATTENDANT true
    - canWinDeal('ATTENDANT') true (D-21 padrão); canWinDeal('PROFESSIONAL') false
    - visibilityWhere({roleName:'MANAGER', memberId:'m'}) -> { deal: { deletedAt: null }, lead: { deletedAt: null } }
    - visibilityWhere({roleName:'ATTENDANT', memberId:'a'}).deal -> { deletedAt: null, assigneeMemberId: 'a' }
    - visibilityWhere(ATTENDANT).lead -> { deletedAt: null, OR: [{ createdBy: 'a' }, { deals: { some: { assigneeMemberId: 'a', deletedAt: null } } }] }
    - visibilityWhere(ATTENDANT).reminder -> { OR: [{ createdBy: 'a' }, { deal: { assigneeMemberId: 'a', deletedAt: null } }] }; para MANAGER -> {}
    - visibilityWhere(ATTENDANT).interaction -> { lead: <lead where da atendente> }; MANAGER -> { lead: { deletedAt: null } }
    - visibilityWhere({roleName:'PROFESSIONAL'}) lança Error('FORBIDDEN') (defesa: o resolver já barra)
    constants:
    - LOST_REASONS = price, date_unavailable, chose_other, no_response, gave_up, other com rótulos 'Preço', 'Data indisponível', 'Fechou com outra', 'Sem resposta', 'Desistiu', 'Outro'
    - INTERACTION_TYPES = call, whatsapp, email, meeting, visit, other ('Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Visita', 'Outro')
    - DEAL_KINDS = noiva, debutante; COMMERCIAL_SOURCES = manual, instagram, indicacao, site, whatsapp, import, outro ('Manual', 'Instagram', 'Indicação', 'Site', 'WhatsApp', 'Importação', 'Outro')
  </behavior>
  <implementation>
- `commercial-constants.ts`: arrays `as const` de `{ code, label }` + tipos `LostReasonCode`, `InteractionType`, `DealKind`, `CommercialSource` e `isLostReason(code)` etc. (guards). Comentário: "espelha os CHECKs de 20261122000000_phase9_commercial".
- `commercial-phone.ts`: `phoneDigits(raw)`: só dígitos; se começa com '55' e tem 12 ou 13 dígitos, remove o '55'; aceita 10 ou 11 dígitos, senão null. `phoneKey(raw)`: de `phoneDigits`, `d.slice(0,2) + d.slice(-8)` (ignora o 9º dígito).
  `samePhone(a,b)`: ambos com chave e iguais. Só funções TS: a busca SQL nos serviços usa a mesma regra (`regexp_replace(phone, '\D', '', 'g')`, DDD = 2 primeiros dígitos depois de tirar o 55, + últimos 8 dígitos), documentada em comentário neste arquivo.
- `commercial-sla.ts`: `isDealOverdue({ status, slaDays, lastInteractionAt, stageEnteredAt }, now)`, `overdueSince(...)`: `base = lastInteractionAt ?? stageEnteredAt`; `limit = base + slaDays*86_400_000`; atrasado se `now > limit`. Comentário com o SQL equivalente: `status = 'open' AND s.sla_days IS NOT NULL AND now() > COALESCE(d.last_interaction_at, d.stage_entered_at) + s.sla_days * interval '1 day'`.
- `commercial-access.ts`:
```ts
export const COMMERCIAL_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT'] as const;
export const isManagerRole = (r: string | null | undefined) => r === 'ADMIN' || r === 'MANAGER';
export const canUseCommercial = (r: string | null | undefined) =>
  !!r && (COMMERCIAL_ROLES as readonly string[]).includes(r);
/**
 * D-21 (A CONFIRMAR com a usuária): quem marca ganho. Padrão adotado: todos os papéis do
 * Comercial, nos negócios que veem. Para "só admin/gerente", trocar para ['ADMIN', 'MANAGER']
 * aqui e em apps/frontend/src/features/commercial/commercial-permissions.ts (WIN_DEAL_ROLES).
 */
export const WIN_DEAL_ROLES: readonly string[] = ['ADMIN', 'MANAGER', 'ATTENDANT'];
export const canWinDeal = (r: string | null | undefined) => !!r && WIN_DEAL_ROLES.includes(r);
export interface CommercialViewer { roleName: string; memberId: string; }
export interface CommercialVisibility { deal: Record<string, unknown>; lead: Record<string, unknown>; interaction: Record<string, unknown>; reminder: Record<string, unknown>; }
export function visibilityWhere(v: CommercialViewer): CommercialVisibility { ... }
```
  Tipos como `Prisma.CommercialDealWhereInput` etc. se o client do 09-01 já estiver gerado no momento da execução; senão `Record<string, unknown>` (os dois planos rodam em paralelo; o 09-04 pode estreitar o tipo).
- Instalar: `corepack pnpm --filter @sgs/backend add exceljs@4.4.0` e rodar `corepack pnpm audit --prod --filter @sgs/backend` (registrar no SUMMARY o resultado para exceljs; vulnerabilidade alta em exceljs bloqueia e volta para o planejamento).
- Ciclo RED → GREEN por módulo; commits `test(09-02): ...` e `feat(09-02): ...`.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: constants + phone + sla (RED/GREEN)</name>
  <files>apps/backend/src/commercial/commercial-constants.ts, apps/backend/src/commercial/commercial-phone.ts, apps/backend/src/commercial/commercial-phone.spec.ts, apps/backend/src/commercial/commercial-sla.ts, apps/backend/src/commercial/commercial-sla.spec.ts</files>
  <read_first>
    - apps/backend/src/clients/clients.service.ts (PHONE_RE e normalizações existentes, para não divergir)
    - apps/backend/src/contracts/alerts/alert-candidates.spec.ts (estilo de spec puro com data fixa)
  </read_first>
  <behavior>Casos de commercial-phone, commercial-sla e constants do bloco `<feature><behavior>`.</behavior>
  <action>Escrever os specs primeiro (falhando), commit `test(09-02): telefone e SLA do Comercial`; implementar conforme `<implementation>`; commit `feat(09-02): telefone, SLA e listas fixas do Comercial`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- src/commercial/commercial-phone src/commercial/commercial-sla</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function phoneDigits" apps/backend/src/commercial/commercial-phone.ts` encontra
    - `grep -n "export function isDealOverdue" apps/backend/src/commercial/commercial-sla.ts` encontra
    - `grep -n "date_unavailable" apps/backend/src/commercial/commercial-constants.ts` encontra
    - `grep -c "it(" apps/backend/src/commercial/commercial-phone.spec.ts` ≥ 8
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Telefone e SLA cobertos por unit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: commercial-access + exceljs</name>
  <files>apps/backend/src/commercial/commercial-access.ts, apps/backend/src/commercial/commercial-access.spec.ts, apps/backend/package.json, pnpm-lock.yaml</files>
  <read_first>
    - apps/backend/src/authz/decorators/current-tenant.decorator.ts (TenantContext { organizationId, memberId, roleName })
    - apps/backend/package.json
  </read_first>
  <behavior>Casos de commercial-access do bloco `<feature><behavior>`.</behavior>
  <action>Spec primeiro (RED, commit), depois `commercial-access.ts` conforme `<implementation>` (GREEN, commit `feat(09-02): visibilidade por papel e ponto único da D-21`). Depois instalar `exceljs@4.4.0`, auditar e commitar `chore(09-02): exceljs para importação e exportação`.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- src/commercial && corepack pnpm --filter @sgs/backend typecheck && grep -n '"exceljs": "' apps/backend/package.json</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export const WIN_DEAL_ROLES" apps/backend/src/commercial/commercial-access.ts` encontra e a linha anterior ao bloco cita `D-21`
    - `grep -n "export function visibilityWhere" apps/backend/src/commercial/commercial-access.ts` encontra
    - `grep -n "FORBIDDEN" apps/backend/src/commercial/commercial-access.spec.ts` encontra
    - `grep -n '"exceljs": "' apps/backend/package.json` encontra
    - comando do `<verify>` sai 0
  </acceptance_criteria>
  <done>Regras de acesso puras e testadas; dependência instalada.</done>
</task>

</tasks>

<verification>
`corepack pnpm --filter @sgs/backend test -- src/commercial` verde; typecheck verde.
</verification>

<success_criteria>
Regras de duplicidade, SLA e visibilidade existem uma única vez e estão testadas.
</success_criteria>

<output>
After completion, create `.planning/phases/09-comercial-crm-do-atimos-no-sgs/09-02-SUMMARY.md`
</output>

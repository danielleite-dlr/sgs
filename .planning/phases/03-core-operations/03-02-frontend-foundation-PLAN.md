---
phase: 03-core-operations
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - apps/frontend/package.json
  - apps/frontend/src/features/operations/lib/money.ts
  - apps/frontend/src/features/operations/lib/period.ts
  - apps/frontend/src/features/operations/lib/week-range.ts
  - apps/frontend/src/features/operations/lib/schedule-grid.ts
  - apps/frontend/src/features/operations/lib/operations-labels.ts
  - apps/frontend/src/features/operations/lib/input-masks.ts
  - apps/frontend/src/features/operations/__tests__/input-masks.test.ts
  - apps/frontend/src/features/operations/__tests__/money.test.ts
  - apps/frontend/src/features/operations/__tests__/period.test.ts
  - apps/frontend/src/features/operations/__tests__/week-range.test.ts
  - apps/frontend/src/features/operations/__tests__/schedule-grid.test.ts
  - apps/frontend/src/features/operations/__tests__/recharts-smoke.test.tsx
autonomous: true
requirements: [SCHED-01, SCHED-02, SCHED-03, POS-02, POS-03, FIN-01]

must_haves:
  truths:
    - "@dnd-kit/core 6.3.1 e @dnd-kit/modifiers 9.0.0 estão instalados no frontend"
    - "Recharts renderiza barras sob React 19 (react-is forçado para ^19)"
    - "Presets Hoje/Ontem/Esta semana/Mês atual/Mês anterior devolvem intervalos corretos em America/Sao_Paulo"
    - "A semana da agenda começa na segunda-feira"
    - "O cálculo de pago/falta/troco no frontend segue a mesma regra do backend (troco só coberto por dinheiro)"
    - "A faixa visível da agenda é uma constante 07h–22h (D-25)"
  artifacts:
    - path: "apps/frontend/src/features/operations/lib/money.ts"
      provides: "decimalToCents, centsToDecimal, sumDecimals, computePaymentSummary"
      exports: ["decimalToCents", "centsToDecimal", "sumDecimals", "computePaymentSummary"]
    - path: "apps/frontend/src/features/operations/lib/period.ts"
      provides: "resolvePeriod, customPeriod, todayInTimeZone, ORG_TIMEZONE_DEFAULT"
      exports: ["resolvePeriod", "customPeriod", "todayInTimeZone", "ORG_TIMEZONE_DEFAULT"]
    - path: "apps/frontend/src/features/operations/lib/week-range.ts"
      provides: "weekRange(date)"
      exports: ["weekRange"]
    - path: "apps/frontend/src/features/operations/lib/schedule-grid.ts"
      provides: "GRID_START_HOUR, GRID_END_HOUR, SLOT_MINUTES, GRID_SLOTS, minutesFromGridStart, shiftStartBySlots"
      exports: ["GRID_START_HOUR", "GRID_END_HOUR", "SLOT_MINUTES", "GRID_SLOTS"]
    - path: "apps/frontend/src/features/operations/lib/operations-labels.ts"
      provides: "PAYMENT_METHODS, CLIENT_CREDIT_METHOD, TIME_BLOCK_KINDS, APPOINTMENT_STATUS_LABELS, CANCEL_REASON_TAGS"
      exports: ["PAYMENT_METHODS", "TIME_BLOCK_KINDS"]
    - path: "apps/frontend/src/features/operations/lib/input-masks.ts"
      provides: "maskTime, maskDateBR, brDateToIso, isoToBrDate (máscaras BR compartilhadas)"
      exports: ["maskTime", "maskDateBR", "brDateToIso", "isoToBrDate"]
  key_links:
    - from: "package.json (raiz)"
      to: "recharts → react-is"
      via: "pnpm.overrides"
      pattern: "\"react-is\": \"\\^19"
---

<objective>
Preparar a base do frontend da Fase 3 sem tocar telas: dependências (dnd-kit, override de react-is para Recharts + React 19) e módulos puros e testados de dinheiro, período, semana, grade da agenda e rótulos (métodos de pagamento, tipos de bloqueio, status, motivos de cancelamento). As telas (planos 03-08 a 03-11) só consomem.

Purpose: tirar do caminho crítico das telas as decisões puras (D-07 troco, D-16 presets, D-18 semana, D-25 faixa fixa) e o risco do Recharts vazio (Pitfall 7).
Output: 5 módulos em `features/operations/lib/`, 5 arquivos de teste vitest, dependências instaladas.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-RESEARCH.md
@apps/frontend/package.json
@package.json
@apps/frontend/src/features/catalog/utils/currency-mask.ts
@apps/frontend/src/features/operations/mocks/schedule.mock.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.

<interfaces>
De `features/catalog/utils/currency-mask.ts` (reusar, não duplicar):
- `maskCurrency(input: string): string` — dígitos → "1.500,00"
- `unmaskCurrency(input: string): string` — "1.500,00" → "1500.00"
- `formatCurrencyDisplay(value: string): string` — "50.00" → exibição BR
Backend (contrato da fase): dinheiro sempre `String` decimal "80.00"; métodos `cash | pix | credit_card | debit_card | transfer | client_credit`; tipos de bloqueio `folga | intervalo | feriado | indisponibilidade`; status de appointment `scheduled | confirmed | in_progress | completed | cancelled | no_show`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Dependências dnd-kit + override react-is + smoke do Recharts</name>
  <files>package.json, pnpm-lock.yaml, apps/frontend/package.json, apps/frontend/src/features/operations/__tests__/recharts-smoke.test.tsx</files>
  <read_first>
    - package.json (raiz — não tem bloco "pnpm" ainda; packageManager pnpm@9.15.4)
    - apps/frontend/package.json (recharts ^2.15.3, react ^19)
    - apps/frontend/src/test-setup.ts (ResizeObserver mock já existe)
  </read_first>
  <action>
1. `corepack pnpm --filter @sgs/frontend add @dnd-kit/core@6.3.1 @dnd-kit/modifiers@9.0.0` (versões exatas; NÃO instalar `@dnd-kit/react` 0.x nem FullCalendar — licença comercial dos plugins de recursos).
2. No `package.json` da raiz adicionar:
```json
"pnpm": { "overrides": { "react-is": "^19.0.0" } }
```
e rodar `corepack pnpm install` para atualizar `pnpm-lock.yaml` (Pitfall 7: recharts 2.15.4 resolvia react-is 18.3.1).
3. Criar `__tests__/recharts-smoke.test.tsx`: renderiza `<BarChart width={400} height={200} data={[{d:'01',v:10},{d:'02',v:20}]}><XAxis dataKey="d"/><Bar dataKey="v" isAnimationActive={false}/></BarChart>` (sem ResponsiveContainer) e espera `container.querySelectorAll('.recharts-bar-rectangle').length` ≥ 1.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- recharts-smoke && grep -q '"@dnd-kit/core": "6.3.1"' apps/frontend/package.json</automated>
  </verify>
  <acceptance_criteria>
    - apps/frontend/package.json contém `"@dnd-kit/core": "6.3.1"` e `"@dnd-kit/modifiers": "9.0.0"`
    - package.json raiz contém `"react-is": "^19.0.0"` dentro de `"pnpm": { "overrides"`
    - `ls node_modules/.pnpm | grep "^react-is@18"` não retorna nada (ou recharts resolve react-is 19)
    - `recharts-smoke.test.tsx` passa
    - `corepack pnpm install --frozen-lockfile` passa (lockfile coerente para o CI)
  </acceptance_criteria>
  <done>Dependências instaladas e Recharts comprovadamente renderizando sob React 19.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lib/money.ts e lib/period.ts (troco D-07, presets D-16)</name>
  <files>apps/frontend/src/features/operations/lib/money.ts, apps/frontend/src/features/operations/lib/period.ts, apps/frontend/src/features/operations/__tests__/money.test.ts, apps/frontend/src/features/operations/__tests__/period.test.ts</files>
  <read_first>
    - apps/frontend/src/features/catalog/utils/currency-mask.ts
    - .planning/phases/03-core-operations/03-CONTEXT.md (D-07, D-16, D-22)
  </read_first>
  <behavior>
    money:
    - decimalToCents("80.00")=8000; decimalToCents("0.10")=10; decimalToCents("-5.5")=-550
    - centsToDecimal(8050)="80.50"; centsToDecimal(-500)="-5.00"
    - sumDecimals(["10.10","0.20"])="10.30" (sem erro de float)
    - computePaymentSummary("200.00", [{method:'pix',amount:'100.00'},{method:'cash',amount:'120.00'}]) → {total:"200.00", paid:"220.00", remaining:"0.00", change:"20.00", canClose:true, error:null}
    - computePaymentSummary("200.00", [{method:'pix',amount:'150.00'}]) → remaining "50.00", change "0.00", canClose false, error null
    - computePaymentSummary("100.00", [{method:'pix',amount:'130.00'}]) → change "30.00", canClose false, error "INVALID_CHANGE" (troco > soma das linhas cash)
    - computePaymentSummary("100.00", [{method:'cash',amount:'20.00'},{method:'pix',amount:'100.00'}]) → change "20.00", canClose true (troco 20 ≤ dinheiro 20)
    period (tz "America/Sao_Paulo", now = 2026-11-04T02:30:00Z, que é 03/11 23:30 local):
    - todayInTimeZone → "2026-11-03"
    - resolvePeriod('today') → {from:"2026-11-03", to:"2026-11-04"} (to exclusivo)
    - resolvePeriod('yesterday') → {from:"2026-11-02", to:"2026-11-03"}
    - resolvePeriod('thisWeek') → {from:"2026-11-02", to:"2026-11-09"} (segunda a segunda)
    - resolvePeriod('thisMonth') → {from:"2026-11-01", to:"2026-12-01"}
    - resolvePeriod('lastMonth') → {from:"2026-10-01", to:"2026-11-01"}
    - resolvePeriod('lastMonth') com now em janeiro/2027 → {from:"2026-12-01", to:"2027-01-01"}
    - customPeriod("2026-11-10","2026-11-12") → {from:"2026-11-10", to:"2026-11-13"}; customPeriod com from > to troca a ordem
  </behavior>
  <action>
`lib/money.ts` (strings decimais iguais às do GraphQL; contas em centavos inteiros):
```ts
export type PaymentLine = { method: string; amount: string };
export interface PaymentSummary { total: string; paid: string; remaining: string; change: string; canClose: boolean; error: 'INVALID_CHANGE' | null }
export function decimalToCents(v: string): number;   // aceita "80", "80.5", "80.50", negativo; NaN → throw Error('valor inválido')
export function centsToDecimal(cents: number): string;
export function sumDecimals(values: string[]): string;
export function computePaymentSummary(total: string, payments: PaymentLine[]): PaymentSummary;
```
Regra (idêntica ao `computeComandaTotals` do backend, plano 03-04): `paid = Σ amount`; `remaining = max(0, total - paid)`; `change = max(0, paid - total)`; `cash = Σ amount onde method === 'cash'`; `error = change > cash ? 'INVALID_CHANGE' : null`; `canClose = paid >= total && error === null`. Exibição continua com `formatCurrencyDisplay` de `currency-mask.ts` (não criar formatador novo).

`lib/period.ts`:
```ts
export const ORG_TIMEZONE_DEFAULT = 'America/Sao_Paulo';
export type PeriodPreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth';
export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' }, { value: 'yesterday', label: 'Ontem' },
  { value: 'thisWeek', label: 'Esta semana' }, { value: 'thisMonth', label: 'Mês atual' },
  { value: 'lastMonth', label: 'Mês anterior' },
];
export const DEFAULT_PRESET: PeriodPreset = 'thisMonth';
export interface DateRange { from: string; to: string } // YYYY-MM-DD; `to` exclusivo
export function todayInTimeZone(tz: string, now?: Date): string; // Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
export function resolvePeriod(preset: PeriodPreset, tz?: string, now?: Date): DateRange;
export function customPeriod(fromInclusive: string, toInclusive: string): DateRange;
export function addDays(isoDate: string, days: number): string; // aritmética em UTC sobre "YYYY-MM-DD"
```
Aritmética de datas sobre a string "YYYY-MM-DD" via `Date.UTC` (sem depender do fuso do navegador). Semana começa na segunda (igual a `date_trunc('week')` do Postgres). Escrever os testes do `<behavior>` primeiro.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- money period</automated>
  </verify>
  <acceptance_criteria>
    - `lib/money.ts` exporta `computePaymentSummary` e contém `'INVALID_CHANGE'`
    - `lib/period.ts` contém `ORG_TIMEZONE_DEFAULT = 'America/Sao_Paulo'` e `DEFAULT_PRESET: PeriodPreset = 'thisMonth'`
    - money.test.ts tem ≥ 8 casos; period.test.ts tem ≥ 8 casos; ambos passam
    - `grep -n "parseFloat\|Number(" lib/money.ts` não aparece em soma de valores (apenas conversão de dígitos inteiros)
  </acceptance_criteria>
  <done>Regras puras de pagamento e período cobertas por teste e prontas para comanda e dashboard.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: lib/week-range.ts, lib/schedule-grid.ts (D-18, D-25), lib/operations-labels.ts e lib/input-masks.ts</name>
  <files>apps/frontend/src/features/operations/lib/week-range.ts, apps/frontend/src/features/operations/lib/schedule-grid.ts, apps/frontend/src/features/operations/lib/operations-labels.ts, apps/frontend/src/features/operations/lib/input-masks.ts, apps/frontend/src/features/operations/__tests__/week-range.test.ts, apps/frontend/src/features/operations/__tests__/schedule-grid.test.ts, apps/frontend/src/features/operations/__tests__/input-masks.test.ts</files>
  <read_first>
    - apps/frontend/src/features/operations/mocks/schedule.mock.ts (TIME_SLOTS atual 08:00–20:00, STATUS_LABELS)
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx linhas 170–215 (dayRange, getAppointmentStyle) e 1270–1290 (WORK_START_HOUR/WORK_END_HOUR)
    - apps/frontend/tailwind.config.ts (paleta padrão disponível via extend)
  </read_first>
  <behavior>
    - weekRange(new Date(2026, 10, 4)) (quarta) → days[0] = segunda 2026-11-02 00:00 local, days[6] = domingo 2026-11-08; startsAt = ISO de 2026-11-02 00:00 local; endsAt = ISO de 2026-11-09 00:00 local
    - weekRange de um domingo (2026-11-08) → mesma semana (segunda 02/11)
    - GRID_SLOTS.length === 30; GRID_SLOTS[0].label === "07:00"; GRID_SLOTS[29].label === "21:30"
    - minutesFromGridStart(new Date(2026,10,4,9,30)) === 150
    - shiftStartBySlots(new Date(2026,10,4,10,0), 3) → 11:30; shiftStartBySlots(..., -2) → 09:00
    - slotsFromDelta(95, 48) === 2 (Math.round(delta / slotHeight)); slotsFromDelta(-20, 48) === 0
    - maskTime("0930") === "09:30"; maskTime("12") === "12"; maskTime("12a3") === "12:3" (cópia literal da função atual de SchedulePage)
    - maskDateBR("04112026") === "04/11/2026"; brDateToIso("04/11/2026") === "2026-11-04"; brDateToIso("31/02/2026") === null; isoToBrDate("2026-11-04") === "04/11/2026"
  </behavior>
  <action>
`lib/week-range.ts`:
```ts
export interface WeekRange { days: Date[]; startsAt: string; endsAt: string }
export function weekRange(date: Date): WeekRange; // segunda 00:00 local até a segunda seguinte 00:00 (exclusivo), 7 dias
```
`lib/schedule-grid.ts` (D-25 — faixa fixa, sem business_hours):
```ts
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 22;       // exclusivo: último slot 21:30
export const SLOT_MINUTES = 30;
export const GRID_SLOTS: { hour: number; minute: number; label: string }[]; // 30 itens, 07:00..21:30
export function minutesFromGridStart(d: Date): number;          // (h - GRID_START_HOUR)*60 + m
export function shiftStartBySlots(start: Date, slots: number): Date; // + slots*SLOT_MINUTES
export function slotsFromDelta(deltaY: number, slotHeight: number): number; // Math.round; normalizar -0 para 0
```
`lib/operations-labels.ts`:
```ts
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'transfer', label: 'Transferência' },
] as const;                       // D-09: sem voucher
export const CLIENT_CREDIT_METHOD = { value: 'client_credit', label: 'Crédito do cliente' } as const;
export const ALL_PAYMENT_METHODS = [...PAYMENT_METHODS, CLIENT_CREDIT_METHOD];
export function paymentMethodLabel(v: string): string;
export const TIME_BLOCK_KINDS = [
  { value: 'folga', label: 'Folga', className: 'bg-slate-200 text-slate-900 border-slate-500' },
  { value: 'intervalo', label: 'Intervalo', className: 'bg-amber-100 text-amber-900 border-amber-500' },
  { value: 'feriado', label: 'Feriado', className: 'bg-rose-100 text-rose-900 border-rose-500' },
  { value: 'indisponibilidade', label: 'Indisponibilidade', className: 'bg-sky-100 text-sky-900 border-sky-500' },
] as const;                       // D-02; texto *-900 sobre fundo *-100/200 ≥ 4.5:1 (WCAG AA)
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', in_progress: 'Em atendimento',
  completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu',
};
export const CANCEL_REASON_TAGS = [
  { value: 'cliente_desmarcou', label: 'Cliente desmarcou' },
  { value: 'profissional_doente', label: 'Profissional doente' },
  { value: 'no_show', label: 'No-show' },
] as const;                       // D-15
export const COMANDA_STATUS_LABELS: Record<string, string> = { open: 'Aberta', closed: 'Fechada', cancelled: 'Cancelada' };
```
`lib/input-masks.ts` (regra de memória do usuário: toda entrada de data/hora nasce com máscara BR): copiar literalmente `maskTime` e `maskDateBR` de `SchedulePage.tsx` (linhas ~806–820) e exportá-las; acrescentar `brDateToIso(br: string): string | null` (valida dia/mês reais, `null` se inválida) e `isoToBrDate(iso: string): string`. NÃO remover as cópias locais da SchedulePage aqui (o 03-10 troca pelo import).
Testes do `<behavior>` primeiro. Não alterar `SchedulePage.tsx` neste plano (o 03-08 troca `TIME_SLOTS` por `GRID_SLOTS`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- week-range schedule-grid input-masks && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `lib/schedule-grid.ts` contém `GRID_START_HOUR = 7` e `GRID_END_HOUR = 22`
    - `lib/operations-labels.ts` contém `'credit_card'`, `'client_credit'`, `'indisponibilidade'` e não contém `voucher`
    - week-range.test.ts, schedule-grid.test.ts e input-masks.test.ts passam (≥ 10 casos no total)
    - `lib/input-masks.ts` exporta `maskTime`, `maskDateBR`, `brDateToIso`, `isoToBrDate`
    - typecheck e lint do frontend verdes
  </acceptance_criteria>
  <done>Constantes e funções puras da agenda e rótulos de domínio disponíveis e testados.</done>
</task>

</tasks>

<verification>
Gate completo verde. `corepack pnpm --filter @sgs/frontend test` inclui os 5 arquivos novos.
</verification>

<success_criteria>
- dnd-kit instalado, Recharts renderiza sob React 19
- Regras de troco/presets/semana/grade cobertas por vitest
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-02-SUMMARY.md`
</output>

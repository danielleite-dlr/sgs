---
phase: 04-bridal-contracts
plan: 02
type: tdd
wave: 1
depends_on: []
files_modified:
  - apps/backend/src/contracts/domain/contract-math.ts
  - apps/backend/src/contracts/domain/contract-math.spec.ts
  - apps/backend/src/contracts/domain/cancellation-policy.ts
  - apps/backend/src/contracts/domain/cancellation-policy.spec.ts
  - apps/backend/src/contracts/domain/contract-template.ts
  - apps/backend/src/contracts/domain/contract-template.spec.ts
  - apps/backend/src/contracts/domain/contract-token.ts
  - apps/backend/src/contracts/domain/contract-token.spec.ts
autonomous: true
requirements: [CONT-01, CONT-02, CONT-03]

must_haves:
  truths:
    - "Entrada percentual de 30% sobre R$ 8.000,00 vale R$ 2.400,00; entrada fixa nunca passa do total"
    - "Prazo do restante = data do evento − N dias, em data local (sem fuso)"
    - "Status derivado diz pago, saldo, entrada pendente, vence em ≤3 dias e vencido a partir de 'hoje' local"
    - "Cancelamento pela noiva retém tudo o que foi pago; pelo estúdio devolve tudo (D-22) — só dois casos"
    - "Render do modelo substitui as 9 variáveis, rejeita variável desconhecida e produz sha256 estável"
  artifacts:
    - path: "apps/backend/src/contracts/domain/contract-math.ts"
      exports: ["computeDepositCents", "computeContractTotals", "balanceDueDate", "computeContractStatus", "daysBetween"]
    - path: "apps/backend/src/contracts/domain/cancellation-policy.ts"
      exports: ["CancellationPolicySchema", "DEFAULT_CANCELLATION_CLAUSE", "buildPolicySnapshot", "computeCancellationSettlement"]
    - path: "apps/backend/src/contracts/domain/contract-template.ts"
      exports: ["TEMPLATE_VARIABLES", "DEFAULT_BRIDAL_TEMPLATE", "validateTemplate", "renderContract", "normalizeText", "sha256Hex", "formatBRL", "maskCpf"]
    - path: "apps/backend/src/contracts/domain/contract-token.ts"
      exports: ["newAccessToken", "hashToken", "ACCESS_TOKEN_TTL_DAYS"]
  key_links:
    - from: "contract-math.ts"
      to: "apps/backend/src/common/money.ts"
      via: "centavos inteiros"
      pattern: "Cents"
---

<objective>
Regras de dinheiro, prazo, status derivado, cancelamento e texto do contrato como funções PURAS com testes de tabela (RED → GREEN → REFACTOR). Nenhum acesso a banco.

Purpose: o risco da fase é consistência financeira (RESEARCH "Key insight"). Os planos 04-06, 04-09, 04-10 e 04-11 consomem estas funções; ter contratos e testes antes evita divergência.
Output: 4 módulos puros em `src/contracts/domain/` + specs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-bridal-contracts/04-CONTEXT.md
@.planning/phases/04-bridal-contracts/04-RESEARCH.md
@apps/backend/src/common/money.ts
@apps/backend/src/comandas/comanda-math.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
```
Branch `master`; sempre `corepack pnpm`. Commits TDD: `test(04-02): ...` (RED), `feat(04-02): ...` (GREEN), `refactor(04-02): ...` opcional. Gate antes de cada commit GREEN: `corepack pnpm --filter @sgs/backend lint && corepack pnpm --filter @sgs/backend typecheck && corepack pnpm --filter @sgs/backend test`.

<interfaces>
De apps/backend/src/common/money.ts:
```typescript
export function toCents(v: string | number | Prisma.Decimal): number;
export function fromCents(cents: number): string; // "80.00"
export function parseMoneyInput(s: string): number | null;
```
</interfaces>
</context>

<feature>
  <name>Domínio puro do contrato de noiva</name>
  <files>apps/backend/src/contracts/domain/*.ts (+ .spec.ts)</files>
  <behavior>
contract-math.ts:
- `computeDepositCents(kind: 'fixed'|'percent'|null, value: string|null, totalCents: number): number` — percent → `Math.round(totalCents * value / 100)`; fixed → `min(toCents(value), totalCents)`; null → 0. Casos: ('percent','30',800000) → 240000; ('fixed','3000.00',200000) → 200000; (null,null,800000) → 0; ('percent','33.33',10000) → 3333.
- `computeContractTotals({ itemsCents: number[]; discountCents: number; depositCents: number })` → `{ itemsTotalCents, totalCents, depositCents }`; lança `RangeError('DISCOUNT_GT_ITEMS')` se desconto > soma, `RangeError('DEPOSIT_GT_TOTAL')` se entrada > total, `RangeError('NEGATIVE')` para negativos.
- `balanceDueDate(eventDate: 'YYYY-MM-DD', daysBefore: number): 'YYYY-MM-DD'` — aritmética de calendário em UTC puro (sem fuso). ('2026-12-20',10) → '2026-12-10'; ('2027-03-05',10) → '2027-02-23'; ('2026-12-20',0) → '2026-12-20'.
- `daysBetween(from: 'YYYY-MM-DD', to: 'YYYY-MM-DD'): number` (to − from em dias).
- `computeContractStatus({ status, totalCents, depositCents, paymentsCents: number[] /* assinados */, balanceDueDate, today, depositReferenceDate /* data local de aceite, ou de criação se não aceito */, depositUnpaidDays })` → `{ paidCents, balanceCents, depositPaidCents, depositPendingCents, settled, daysToBalanceDue, balanceDueSoon, balanceOverdue, depositOverdue }` onde `paidCents = max(0, Σ)`, `depositPaidCents = min(paidCents, depositCents)`, `balanceCents = max(0, totalCents − paidCents)`, `settled = balanceCents === 0`, `daysToBalanceDue = daysBetween(today, balanceDueDate)`, `balanceDueSoon = !settled && 0 <= daysToBalanceDue <= 3`, `balanceOverdue = !settled && daysToBalanceDue < 0`, `depositOverdue = depositPendingCents > 0 && daysBetween(depositReferenceDate, today) >= depositUnpaidDays`. Para `status` 'cancelled' ou 'draft' todas as flags de alerta são `false`. Casos de tabela: R$ 8.000 total, entrada 2.400, pagamentos [240000, 200000, 200000] hoje 3 dias antes do prazo → paid 640000, balance 160000, dueSoon true, overdue false; mesmos pagamentos +160000 → settled true, flags false; um dia depois do prazo com saldo → overdue true; reversal [240000, -240000] → paid 0, depositPending 240000.

cancellation-policy.ts (D-17, D-19, D-22 — sem faixas):
- `CancellationPolicySchema = z.object({ version: z.literal(1), clientCancels: z.literal('retain_all_paid'), studioCancels: z.literal('refund_all'), clause: z.string().trim().min(10).max(5000) })`.
- `DEFAULT_CANCELLATION_CLAUSE` (PT-BR): "Em caso de cancelamento solicitado pela CONTRATANTE, os valores já pagos, inclusive a entrada, não serão devolvidos e ficam retidos a título de multa. Em caso de cancelamento pelo CONTRATADO, todos os valores pagos, inclusive a entrada, serão devolvidos integralmente."
- `buildPolicySnapshot(clause: string | null)` → objeto validado com `clause ?? DEFAULT_CANCELLATION_CLAUSE`.
- `computeCancellationSettlement({ party: 'client'|'studio'; paidCents: number })` → client: `{ retainedCents: paidCents, refundCents: 0 }`; studio: `{ retainedCents: 0, refundCents: paidCents }`; `paidCents < 0` → RangeError. Teste explícito de que NÃO há parâmetro de antecedência (assinatura só com party e paidCents).

contract-template.ts (D-16):
- `TEMPLATE_VARIABLES = ['noiva_nome','noiva_cpf','evento_data','evento_local','itens','valor_total','entrada','prazo_restante','politica_cancelamento'] as const`.
- `DEFAULT_BRIDAL_TEMPLATE`: texto PT-BR de contrato de prestação de serviços de beleza para noiva usando as 9 variáveis como `{{nome}}` (título "CONTRATO DE PRESTAÇÃO DE SERVIÇOS — {{noiva_nome}}", cláusulas: objeto (`{{itens}}`), valor (`{{valor_total}}`, entrada `{{entrada}}` na assinatura, restante até `{{prazo_restante}}`), evento (`{{evento_data}}`, `{{evento_local}}`), cancelamento (`{{politica_cancelamento}}`), aceite digital).
- `validateTemplate(body: string): { unknown: string[]; missing: string[] }` — regex `/\{\{\s*([a-z_]+)\s*\}\}/g`; `unknown` = nomes fora da lista; `missing` = variáveis da lista ausentes (só aviso).
- `renderContract(body: string, vars: Record<(typeof TEMPLATE_VARIABLES)[number], string>): string` — lança `Error('UNKNOWN_VARIABLE:<nome>')` para desconhecida; substitui todas as ocorrências; retorna `normalizeText(result)`. Saída é texto puro (sem HTML).
- `normalizeText(s) = s.replace(/\r\n/g, '\n').trim()`; `sha256Hex(s) = createHash('sha256').update(s,'utf8').digest('hex')` (node:crypto).
- `formatBRL(cents)` → `"R$ 8.000,00"` (Intl pt-BR, espaço normal — substituir U+00A0 por ' '); `maskCpf('12345678909')` → `'***.456.789-**'`; `formatDateBR('2026-12-20')` → `'20/12/2026'`.
- Casos: render do DEFAULT com vars completas não contém `{{`; `sha256Hex(renderContract(x)) === sha256Hex(renderContract(x))`; texto com `\r\n` e com `\n` gera o mesmo hash; `{{foo}}` → erro UNKNOWN_VARIABLE:foo.

contract-token.ts (D-23):
- `ACCESS_TOKEN_TTL_DAYS = 30`; `newAccessToken(): { token: string; tokenHash: string }` com `randomBytes(32).toString('base64url')` (43 chars) e `tokenHash = hashToken(token)`; `hashToken(t) = sha256 hex`. Casos: 2 chamadas geram tokens diferentes; `hashToken(token) === tokenHash`; token casa `/^[A-Za-z0-9_-]{43}$/`.
  </behavior>
  <implementation>
Funções puras, sem imports de Prisma além do tipo de `toCents`. `zod` já é dependência do backend (3.25). Datas sempre como string `YYYY-MM-DD`; converter com `Date.UTC(y, m-1, d)` para aritmética. Specs com `it.each` (tabelas). Cobertura alvo ≥ 95% de linhas nesses 4 arquivos.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: contract-math + cancellation-policy (RED → GREEN)</name>
  <files>apps/backend/src/contracts/domain/contract-math.ts, apps/backend/src/contracts/domain/contract-math.spec.ts, apps/backend/src/contracts/domain/cancellation-policy.ts, apps/backend/src/contracts/domain/cancellation-policy.spec.ts</files>
  <read_first>
    - apps/backend/src/common/money.ts
    - apps/backend/src/comandas/comanda-math.spec.ts (estilo de teste de tabela)
    - .planning/phases/04-bridal-contracts/04-CONTEXT.md (D-10, D-11, D-17, D-19, D-22)
  </read_first>
  <behavior>Conforme bloco `<feature><behavior>` (seções contract-math.ts e cancellation-policy.ts), incluindo todos os casos de tabela listados.</behavior>
  <action>Escrever primeiro os specs com todos os casos do `<behavior>` e commitar RED (`test(04-02): contract math e política de cancelamento`). Implementar as funções com as assinaturas exatas acima até ficar verde e commitar GREEN. `computeCancellationSettlement` recebe só `{ party, paidCents }` (D-22 substitui faixas de D-18 — não implementar tiers).</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- contract-math cancellation-policy</automated>
  </verify>
  <acceptance_criteria>
    - Specs verdes; `grep -c "it.each\|it(" apps/backend/src/contracts/domain/contract-math.spec.ts` ≥ 8
    - `grep -n "tiers\|minDaysBefore\|retainPercent" apps/backend/src/contracts/domain/cancellation-policy.ts` não encontra nada
    - `grep -n "export function computeContractStatus" apps/backend/src/contracts/domain/contract-math.ts` encontra
  </acceptance_criteria>
  <done>Dinheiro, prazo, status derivado e settlement testados por tabela.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: contract-template + contract-token (RED → GREEN)</name>
  <files>apps/backend/src/contracts/domain/contract-template.ts, apps/backend/src/contracts/domain/contract-template.spec.ts, apps/backend/src/contracts/domain/contract-token.ts, apps/backend/src/contracts/domain/contract-token.spec.ts</files>
  <read_first>
    - .planning/phases/04-bridal-contracts/04-RESEARCH.md ("Pattern 7" e "Code Examples / Hash e token")
    - apps/backend/src/contracts/domain/cancellation-policy.ts (gerado na Task 1)
  </read_first>
  <behavior>Conforme bloco `<feature><behavior>` (seções contract-template.ts e contract-token.ts).</behavior>
  <action>RED com os casos listados; GREEN implementando exatamente as assinaturas. O modelo padrão é uma constante TS (template_body NULL no banco = usar a constante). Não usar biblioteca de template (Handlebars etc.) — regex simples, saída texto puro.</action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/backend test -- contract-template contract-token</automated>
  </verify>
  <acceptance_criteria>
    - Specs verdes
    - `grep -c "{{" apps/backend/src/contracts/domain/contract-template.ts` ≥ 9 (todas as variáveis no modelo padrão)
    - `grep -n "randomBytes(32)" apps/backend/src/contracts/domain/contract-token.ts` encontra
    - `grep -n "ACCESS_TOKEN_TTL_DAYS = 30" apps/backend/src/contracts/domain/contract-token.ts` encontra
  </acceptance_criteria>
  <done>Texto do contrato renderizável e com hash estável; token de alta entropia com hash.</done>
</task>

</tasks>

<verification>
`corepack pnpm --filter @sgs/backend test -- contracts/domain` verde; `corepack pnpm --filter @sgs/backend lint && typecheck` verdes.
</verification>

<success_criteria>
As 4 bibliotecas puras existem com as assinaturas exatas acima e cobertura ≥ 95%.
</success_criteria>

<output>
After completion, create `.planning/phases/04-bridal-contracts/04-02-SUMMARY.md`
</output>

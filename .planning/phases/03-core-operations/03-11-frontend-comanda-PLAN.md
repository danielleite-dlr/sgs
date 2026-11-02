---
phase: 03-core-operations
plan: 11
type: execute
wave: 4
depends_on: ["03-02", "03-04", "03-07", "03-09"]
files_modified:
  - apps/frontend/src/features/operations/api/comandas.api.ts
  - apps/frontend/src/features/operations/pages/ComandaListPage.tsx
  - apps/frontend/src/features/operations/pages/ComandaPage.tsx
  - apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx
  - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx
  - apps/frontend/src/features/operations/components/comanda/WalkInDialog.tsx
  - apps/frontend/src/features/operations/components/comanda/ReopenComandaDialog.tsx
  - apps/frontend/src/features/operations/mocks/comanda.mock.ts
  - apps/frontend/src/config/features.ts
  - apps/frontend/src/router.tsx
  - apps/frontend/src/components/layout/menu-config.ts
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/features/operations/__tests__/payment-panel.test.tsx
  - apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx
  - apps/frontend/src/features/operations/__tests__/walk-in-dialog.test.tsx
autonomous: true
requirements: [POS-01, POS-02, POS-03, FIN-02]

must_haves:
  truths:
    - "/comanda lista as comandas do dia (filtro de período e status) e abre uma walk-in com cliente existente ou só nome + telefone opcional (D-06)"
    - "/comanda/:id mostra código C-AAAA-NNN, cliente, itens com profissional e preço, e permite adicionar/remover serviço, produto e pacote enquanto aberta"
    - "O painel de pagamento aceita N linhas (Dinheiro, Pix, Cartão de crédito, Cartão de débito, Transferência, Crédito do cliente) e mostra Total, Pago, Falta e Troco em tempo real; o botão Fechar só habilita quando pode fechar (D-07)"
    - "Se o cliente tem crédito (ex. sinal de R$ 50), o painel sugere uma linha 'Crédito do cliente' com min(saldo, falta)"
    - "Após fechar, a comanda mostra as comissões geradas e um aviso para itens sem regra (D-24); estoque baixa e a agenda marca o atendimento como concluído"
    - "Reabrir aparece só para quem tem comanda.reopen e exige motivo (D-08)"
    - "A flag comanda vira true neste plano junto com a remoção de comanda.mock.ts; o menu aponta para /comanda"
  artifacts:
    - path: "apps/frontend/src/features/operations/api/comandas.api.ts"
      provides: "ComandaQuery, ComandasQuery, OpenWalkInComandaMutation, Add/RemoveComandaItem, AddComandaPackage, Add/RemoveComandaPayment, CloseComanda, ReopenComanda"
      contains: "closeComanda"
    - path: "apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx"
      provides: "pagamento dividido com falta/troco"
      exports: ["PaymentPanel"]
    - path: "apps/frontend/src/features/operations/pages/ComandaListPage.tsx"
      provides: "lista /comanda + Nova comanda"
    - path: "apps/frontend/src/features/operations/pages/ComandaPage.tsx"
      provides: "POS real"
  key_links:
    - from: "PaymentPanel"
      to: "lib/money.computePaymentSummary"
      via: "cálculo local idêntico ao backend"
      pattern: "computePaymentSummary\\("
    - from: "ComandaPage Fechar"
      to: "closeComanda"
      via: "CloseComandaMutation"
      pattern: "CloseComandaMutation"
    - from: "menu-config fin-comandas"
      to: "/comanda"
      via: "to"
      pattern: "to: '/comanda'"
---

<objective>
Substituir o mock da comanda pelo POS real: lista de comandas com walk-in, tela da comanda com itens (serviço/produto/pacote), pagamento dividido com falta/troco e sugestão do crédito/sinal, fechamento com comissões exibidas (e aviso D-24) e reabertura com motivo.

Purpose: POS-01..03 na UI e o fechamento do critério #2 do ROADMAP (pagamento dividido Pix + dinheiro) + visibilidade do critério #3 (comissão gerada).
Output: API manual, 2 páginas, 4 componentes, flag `comanda` ligada, menu/rotas ajustados, mock removido, 3 testes vitest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-core-operations/03-CONTEXT.md
@.planning/phases/03-core-operations/03-04-SUMMARY.md
@.planning/phases/03-core-operations/03-07-SUMMARY.md
@.planning/phases/02-core-domain/02-UI-SPEC.md
@apps/frontend/src/features/operations/pages/ComandaPage.tsx
@apps/frontend/src/config/features.ts
@apps/frontend/src/router.tsx
@apps/frontend/src/components/layout/menu-config.ts

**Ambiente de execução:**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
cd /root/sgs
while IFS= read -r l; do case "$l" in ''|'#'*) ;; *) export "$l";; esac; done < .env
# sempre `corepack pnpm ...`
```
Branch `master`. Gate antes de commit: `corepack pnpm -r --if-present lint && corepack pnpm -r typecheck && corepack pnpm --filter @sgs/backend test && corepack pnpm --filter @sgs/backend test:integration && corepack pnpm --filter @sgs/frontend test`.
Regra do repo: `comanda: true` no MESMO commit em que `/comanda` e `/comanda/:id` leem dado real, removendo `mocks/comanda.mock.ts` e a faixa "Mockup — Phase 3". Design system SGS (`#570080`, `PageHeader` + breadcrumbs, `Button` do shadcn); valores com `maskCurrency`/`unmaskCurrency`.

**Arquivos que este plano NÃO toca** (plano paralelo 03-10): `SchedulePage.tsx`, `api/appointments.api.ts`, `components/calendar/**`.

<interfaces>
Backend (03-04, 03-07):
```graphql
comanda(id: UUID!): Comanda
comandas(from: String!, to: String!, status: String, clientId: UUID): [Comanda!]!   # datas locais, to exclusivo
type Comanda { id code status clientId client { id fullName phone } openedAt closedAt closeCycle total paid remaining change canClose closeError clientCreditBalance
  items: [ComandaItem!]! payments: [ComandaPayment!]! appointmentIds: [UUID!]! commissions: [ComandaCommission!]! hasCommissionWarnings: Boolean! }
type ComandaItem { id kind serviceId productId packageId appointmentId serviceVariantId professionalId professional { id displayName } name quantity listUnitPrice unitPrice total }
type ComandaPayment { id method amount paidAt memberId }
type ComandaCommission { id comandaItemId memberId memberName itemName kind cycle baseAmount chargedAmount calculatedAmount noRule reversed }
openWalkInComanda(input: { clientId?: UUID, newClient?: { fullName: String!, phone: String } }): ComandaPayload!
addComandaItem(input: { comandaId, kind: "service"|"product", serviceId?, serviceVariantId?, productId?, professionalId, quantity }): ComandaPayload!
removeComandaItem(comandaId, itemId): ComandaPayload!
addComandaPackage(input: { comandaId, packageId, assignments: [{ serviceId, professionalId, serviceVariantId? }] }): ComandaPayload!
addComandaPayment(input: { comandaId, method, amount }): ComandaPayload!
removeComandaPayment(comandaId, paymentId): ComandaPayload!
closeComanda(id: UUID!): ComandaPayload!
reopenComanda(input: { id, reason }): ComandaPayload!
# códigos: COMANDA_NOT_OPEN, ITEM_LINKED_TO_APPOINTMENT, CLIENT_REQUIRED, INVALID_METHOD, INVALID_AMOUNT, CREDIT_INSUFFICIENT, NON_CASH_EXCEEDS_TOTAL, INSUFFICIENT_PAYMENT, INVALID_CHANGE, STOCK_INSUFFICIENT, EMPTY_COMANDA, REASON_REQUIRED, COMANDA_NOT_CLOSED
```
Permissões no auth store: `comanda.read`, `comanda.write`, `comanda.close`, `comanda.reopen`.
Frontend (03-02): `computePaymentSummary(total, lines)` → `{ total, paid, remaining, change, canClose, error }`, `decimalToCents`, `centsToDecimal` (lib/money.ts); `ALL_PAYMENT_METHODS`, `CLIENT_CREDIT_METHOD`, `paymentMethodLabel`, `COMANDA_STATUS_LABELS` (lib/operations-labels.ts); `PeriodFilter`, `defaultPeriod` (components/PeriodFilter.tsx, 03-09); `resolvePeriod('today')` (lib/period.ts).
Existentes: `ClientsListQuery`, `ServicesQuery`, `MembersQuery`, `ProductsQuery` e API de pacotes em `features/catalog/api/` (conferir nomes reais); `ProfessionalsForServiceQuery`; chaves i18n `operations.pos.*` (pt-BR.json ~linha 363).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: comandas.api.ts + PaymentPanel (pagamento dividido, falta/troco, sugestão de crédito)</name>
  <files>apps/frontend/src/features/operations/api/comandas.api.ts, apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx, apps/frontend/src/features/operations/__tests__/payment-panel.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/lib/money.ts e lib/operations-labels.ts (03-02)
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx (Dialog de fechamento atual, linhas ~199–235)
    - apps/frontend/src/features/catalog/utils/currency-mask.ts
  </read_first>
  <behavior>
    - total "135.00", pagamentos [] , clientCreditBalance "50.00" → mostra "Falta R$ 135,00" e botão "Usar crédito do cliente (R$ 50,00)"; clicar chama onAddPayment({ method:'client_credit', amount:'50.00' })
    - com pagamentos [client_credit 50, pix 50] e nova linha cash "50,00" (digitada) → preview "Troco R$ 15,00"; onAddPayment({ method:'cash', amount:'50.00' })
    - com pagamentos [pix 130.00] e total 100.00 → mostra erro "O troco só pode sair de pagamento em dinheiro." e Fechar desabilitado
    - status !== 'open' → sem inputs (somente leitura)
    - método inválido nunca é oferecido (sem "Voucher")
  </behavior>
  <action>
**comandas.api.ts**: `COMANDA_FIELDS` fragment com todos os campos do tipo `Comanda` do `<interfaces>` (incluindo `items { ... professional { id displayName } }`, `payments`, `commissions`, `hasCommissionWarnings`, `client { id fullName phone }`), queries `ComandaQuery`, `ComandasQuery`, e as 8 mutações devolvendo `comanda { ...ComandaFields } errors { code message field }`; interfaces TS à mão (`ComandaData`, `ComandaItemData`, `ComandaPaymentData`, `ComandaCommissionData`, `ComandaPayloadResult`).

**PaymentPanel.tsx**:
```ts
export function PaymentPanel(props: { comanda: ComandaData; canWrite: boolean; canClose: boolean; busy: boolean;
  onAddPayment: (p: { method: string; amount: string }) => Promise<void>; onRemovePayment: (id: string) => Promise<void>; onClose: () => Promise<void> }): JSX.Element;
```
- Lista dos pagamentos lançados (forma via `paymentMethodLabel`, valor, botão remover com `aria-label="Remover pagamento <forma> <valor>"` quando `canWrite`).
- Linha de inclusão: select de forma (`ALL_PAYMENT_METHODS`; "Crédito do cliente" só aparece se `clientCreditBalance > 0`), valor com `maskCurrency` pré-preenchido com a falta atual (`remaining` mascarado), botão "Adicionar".
- Resumo (fonte = `computePaymentSummary(comanda.total, [...payments, linhaEmEdição?])` para o preview; após salvar, valores do backend): "Total", "Pago", "Falta" (destaque `text-warning-700` se > 0), "Troco" (destaque `text-success-700` se > 0); erro `INVALID_CHANGE` → texto "O troco só pode sair de pagamento em dinheiro." em `text-error-600`.
- Atalho D-03/D-11: se `clientCreditBalance > 0` e ainda não há linha `client_credit`, botão `variant="outline"` "Usar crédito do cliente (R$ X)" com X = min(saldo, falta).
- Botão "Fechar comanda" (`size="lg"`) visível com `canClose` (permissão), habilitado só se `comanda.canClose && !busy`; texto de ajuda quando desabilitado com a falta.
- Somente leitura quando `comanda.status !== 'open'`.
**Contrato de seletores (usado pelos E2E do 03-12 — não renomear):** `payment-panel` (raiz), `payment-total`, `payment-paid`, `payment-remaining`, `payment-change` (cada um com o valor formatado "R$ 0,00" como texto), `payment-method-select`, `payment-amount`, `payment-add`, `payment-use-credit` (botão "Usar crédito do cliente (R$ X)"), `payment-row-${paymentId}`, `payment-error`, `comanda-close` (botão "Fechar comanda").
Escrever o teste do `<behavior>` (render com props, `userEvent`) consultando por esses `data-testid`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- payment-panel && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - comandas.api.ts contém `closeComanda(id: $id)`, `reopenComanda(input: $input)`, `openWalkInComanda`, `addComandaPackage`, `hasCommissionWarnings`
    - PaymentPanel.tsx contém `computePaymentSummary(`, `Usar crédito do cliente`, `Troco`, `Falta` e não contém `voucher`
    - payment-panel.test.tsx passa (≥ 5 casos)
    - PaymentPanel.tsx contém `data-testid="payment-remaining"`, `data-testid="payment-change"`, `data-testid="payment-use-credit"`, `data-testid="comanda-close"`, `data-testid="payment-amount"`, `data-testid="payment-method-select"`, `data-testid="payment-add"`
  </acceptance_criteria>
  <done>Pagamento dividido com falta/troco e uso do sinal/crédito pronto para a tela da comanda.</done>
</task>

<task type="auto">
  <name>Task 2: ComandaPage real (itens, pacote, fechar, comissões, reabrir) + AddItemDialog + ReopenComandaDialog</name>
  <files>apps/frontend/src/features/operations/pages/ComandaPage.tsx, apps/frontend/src/features/operations/components/comanda/AddItemDialog.tsx, apps/frontend/src/features/operations/components/comanda/ReopenComandaDialog.tsx, apps/frontend/src/infrastructure/i18n/locales/pt-BR.json, apps/frontend/src/features/operations/__tests__/comanda-page.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/ComandaPage.tsx (layout validado: grid lg:grid-cols-3, cards Cliente / Adicionar à comanda / Itens, Dialog de fechamento)
    - apps/frontend/src/features/operations/components/comanda/PaymentPanel.tsx (Task 1)
    - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json (bloco operations.pos)
    - apps/frontend/src/features/catalog/api/ (queries de serviços, produtos, pacotes, membros)
  </read_first>
  <action>
**ComandaPage.tsx** — manter o layout atual (3 colunas: cliente + adicionar à comanda | itens | pagamento) e as chaves `operations.pos.*`, removendo a faixa "Mockup" e o import do mock:
- `const { id } = useParams()`; `useQuery(ComandaQuery, { variables: { id } })`; `null` → `ReportEmptyState`/card "Comanda não encontrada." com link "Voltar para comandas" (`/comanda`).
- `PageHeader` título `Comanda ${code}`, breadcrumbs `[{label:'Financeiro'},{label:'Comandas', to:'/comanda'},{label: code}]` (conferir a prop de link do PageHeader), `Badge` de status (`COMANDA_STATUS_LABELS`).
- Card Cliente: nome, telefone, saldo de crédito (`clientCreditBalance`).
- Card "Adicionar à comanda" (só `status === 'open'` e `comanda.write`): botões "Adicionar serviço", "Adicionar produto", "Adicionar pacote" abrindo `AddItemDialog` no modo correspondente.
- Card Itens: tabela nome, profissional, qtd, preço (`unitPrice`; se `listUnitPrice !== unitPrice` mostrar o cheio riscado e o cobrado — item de pacote), total; remover item (`comanda.write`, status open; erro `ITEM_LINKED_TO_APPOINTMENT` → `toast.error(message)`); rodapé "Total".
- Coluna Pagamento: `<PaymentPanel>` com `canWrite = permissions.includes('comanda.write')`, `canClose = permissions.includes('comanda.close')`; `onClose` → `CloseComandaMutation`; erros (`STOCK_INSUFFICIENT`, `CREDIT_INSUFFICIENT`, `INSUFFICIENT_PAYMENT`, `INVALID_CHANGE`, `EMPTY_COMANDA`) → `toast.error(message)`; sucesso → `toast.success(\`Comanda ${code} fechada.\`)`.
- Seção "Comissões geradas" (status closed): tabela `memberName`, `itemName`, base, cobrado, comissão; `noRule` → `Badge` "Sem regra"; `hasCommissionWarnings` → `Alert` "Alguns itens não têm regra de comissão e foram registrados com R$ 0,00." + link "Revisar regras" (`/catalogo/comissoes`) se o usuário tem `commission.write` (D-24).
- Botão "Reabrir comanda" (status closed e `comanda.reopen`) → `ReopenComandaDialog`.

**AddItemDialog.tsx** — `{ mode: 'service'|'product'|'package'; comanda; open; onOpenChange; onDone }`: serviço → select serviço, variante (opcional), profissional (filtrado por `ProfessionalsForServiceQuery`), quantidade (inteiro ≥ 1) → `AddComandaItemMutation`; produto → select produto (mostra estoque atual; aviso se quantidade > estoque, sem bloquear — o backend recusa no fechamento), vendedor (membros ativos), quantidade; pacote → select pacote e, para cada serviço do pacote, um select de profissional → `AddComandaPackageMutation`. Erros do payload inline.

**ReopenComandaDialog.tsx** — `Textarea` "Motivo da reabertura" obrigatório (≥ 3), texto "Estoque, comissões, crédito e caixa desta comanda serão estornados.", botão `variant="destructive"` "Reabrir" → `ReopenComandaMutation`; sucesso `toast.success('Comanda reaberta.')`.

pt-BR.json: completar `operations.pos` com as chaves usadas que faltarem (`addPackage`, `remaining`, `change`, `paid`, `closeComanda`, `reopen`, `reopenReason`, `commissionsGenerated`, `noRuleWarning`, `useClientCredit`, `notFound`) — textos iguais aos citados acima.

**Contrato de seletores (03-12):** `comanda-code`, `comanda-status`, `comanda-add-service`, `comanda-add-product`, `comanda-add-package`, `comanda-item-${itemId}`, `comanda-commissions` (seção "Comissões geradas"), `comanda-commission-warning`, `comanda-reopen`; AddItemDialog: `add-item-service`, `add-item-product`, `add-item-professional`, `add-item-quantity`, `add-item-submit`; ReopenComandaDialog: `reopen-reason`, `reopen-submit`.

**comanda-page.test.tsx** (MockedProvider + MemoryRouter `/comanda/:id`): comanda aberta com 2 itens e `canClose false` → botão "Fechar comanda" desabilitado e "Falta R$ …" visível; comanda fechada com `hasCommissionWarnings true` → alerta de itens sem regra; usuário sem `comanda.reopen` não vê "Reabrir comanda"; com a permissão vê.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test -- comanda-page payment-panel && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - ComandaPage.tsx contém `ComandaQuery`, `CloseComandaMutation`, `<PaymentPanel`, `Comissões geradas` (ou chave `commissionsGenerated`), `hasCommissionWarnings` e não contém `Mockup` nem `comanda.mock`
    - AddItemDialog.tsx contém `AddComandaItemMutation` e `AddComandaPackageMutation`
    - ReopenComandaDialog.tsx contém `ReopenComandaMutation`
    - comanda-page.test.tsx passa (≥ 4 casos)
    - ComandaPage.tsx contém `data-testid="comanda-status"`, `data-testid="comanda-commissions"`, `data-testid="comanda-reopen"`, `data-testid="comanda-add-product"`; AddItemDialog.tsx contém `add-item-submit`; ReopenComandaDialog.tsx contém `reopen-reason`
  </acceptance_criteria>
  <done>Tela da comanda opera o ciclo completo com dado real.</done>
</task>

<task type="auto">
  <name>Task 3: ComandaListPage + WalkInDialog + rota /comanda + menu + flag comanda + remoção do mock</name>
  <files>apps/frontend/src/features/operations/pages/ComandaListPage.tsx, apps/frontend/src/features/operations/components/comanda/WalkInDialog.tsx, apps/frontend/src/router.tsx, apps/frontend/src/components/layout/menu-config.ts, apps/frontend/src/config/features.ts, apps/frontend/src/features/operations/mocks/comanda.mock.ts, apps/frontend/src/features/operations/__tests__/walk-in-dialog.test.tsx</files>
  <read_first>
    - apps/frontend/src/router.tsx (rota `/comanda/:id`)
    - apps/frontend/src/components/layout/menu-config.ts (item `fin-comandas` → `/comanda/demo`)
    - apps/frontend/src/config/features.ts (`comanda: false`, GATED_PATHS `/comanda`)
    - apps/frontend/src/features/identity/member-validation.ts (`maskBrPhone`)
  </read_first>
  <action>
**ComandaListPage.tsx** — `PageHeader` "Comandas" (breadcrumbs Financeiro › Comandas) + botão "Nova comanda" (`comanda.write`) → `WalkInDialog`; `PeriodFilter` com padrão **Hoje** (`{ preset:'today', ...resolvePeriod('today') }`) + filtro de status (Todas/Abertas/Fechadas/Canceladas); `ComandasQuery`; tabela: código (link `/comanda/:id`), cliente, aberta em (dd/mm HH:mm), status (`Badge`), total, pago; vazio → "Nenhuma comanda no período."; PROFESSIONAL vê a lista que o backend devolve (só as dele) e sem "Nova comanda".

**WalkInDialog.tsx** (D-06) — `RadioGroup` "Cliente cadastrado" / "Novo cliente": cadastrado → busca em `ClientsListQuery` e seleção; novo → "Nome" (obrigatório, ≥ 2) + "Telefone (opcional)" com `maskBrPhone`; sem CPF/e-mail. Submit → `OpenWalkInComandaMutation` com `{ clientId }` ou `{ newClient: { fullName, phone: phone || null } }` (telefone enviado no formato que o `ClientsService` da Fase 2 aceita — conferir em `features/clients` como o form de cliente envia o telefone e usar a mesma conversão); sucesso → `navigate(\`/comanda/${comanda.id}\`)` + `toast.success(\`Comanda ${code} aberta.\`)`; erro `CLIENT_REQUIRED`/`INVALID_NAME` inline.

**router.tsx**: adicionar `{ path: '/comanda', element: <ComandaListPage /> }` antes de `/comanda/:id` (mesmo bloco de rotas autenticadas). **menu-config.ts**: item `fin-comandas` `to: '/comanda'` (era `/comanda/demo`). **features.ts**: `comanda: true` com comentário "Comanda / PDV — comandas reais (03-11)". Apagar `mocks/comanda.mock.ts` (`grep -rn "comanda.mock" apps/frontend/src` vazio; após isso `ls apps/frontend/src/features/operations/mocks` deve estar vazio — remover a pasta).

**walk-in-dialog.test.tsx**: "Novo cliente" com nome "M" mantém "Abrir comanda" desabilitado; com "Maria" e sem telefone envia `newClient: { fullName: 'Maria', phone: null }`; "Cliente cadastrado" exige seleção.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend test && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint && corepack pnpm --filter @sgs/frontend build</automated>
  </verify>
  <acceptance_criteria>
    - features.ts contém `comanda: true`
    - menu-config.ts contém `to: '/comanda',` no item `fin-comandas` e não contém `/comanda/demo`
    - router.tsx contém `path: '/comanda',` e `<ComandaListPage />`
    - `test -d apps/frontend/src/features/operations/mocks` falha (pasta removida) e `grep -rn "\.mock'" apps/frontend/src/features/operations` vazio
    - WalkInDialog.tsx contém `OpenWalkInComandaMutation` e `maskBrPhone`
    - walk-in-dialog.test.tsx passa; build do frontend passa
  </acceptance_criteria>
  <done>POS acessível pelo menu, walk-in funcionando, mock da comanda removido e flag ligada no mesmo commit.</done>
</task>

</tasks>

<verification>
Gate completo verde + `corepack pnpm --filter @sgs/frontend build`.
</verification>

<success_criteria>
- POS-01..03 completos na UI; comissão gerada visível após fechar (FIN-02)
- Nenhum mock de operações restante no frontend
</success_criteria>

<output>
After completion, create `.planning/phases/03-core-operations/03-11-SUMMARY.md`
</output>

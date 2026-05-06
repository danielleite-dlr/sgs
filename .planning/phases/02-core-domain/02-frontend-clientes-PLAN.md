---
phase: 02-core-domain
plan: 08
type: execute
wave: 3
depends_on: [02, 05, 06]
files_modified:
  - apps/frontend/src/features/clients/api/clients.api.ts
  - apps/frontend/src/features/clients/utils/cpf.ts
  - apps/frontend/src/features/clients/components/CpfDuplicateAlert.tsx
  - apps/frontend/src/features/clients/components/ClientForm.tsx
  - apps/frontend/src/features/clients/components/ClientHistoryTab.tsx
  - apps/frontend/src/pages/ClientesPage.tsx
  - apps/frontend/src/pages/ClienteDetailPage.tsx
  - apps/frontend/src/pages/ClienteEditPage.tsx
  - apps/frontend/src/pages/ClienteNovoPage.tsx
  - apps/frontend/src/router.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/features/clients/__tests__/cpf.test.ts
  - apps/frontend/src/features/clients/__tests__/client-form.test.tsx
  - apps/frontend/src/features/clients/__tests__/cpf-duplicate-alert.test.tsx
autonomous: true
requirements: [CLI-01, CLI-02]

must_haves:
  truths:
    - "User opens /clientes and sees DataTable with search box (300ms debounce) + 'Novo cliente' CTA"
    - "User clicks 'Novo cliente' → navigates to /clientes/novo (full-page form, NOT a Dialog — UI-SPEC §Form Pattern)"
    - "User types CPF — input shows mask 000.000.000-00 — on blur if valid → query clientsByField → if matches show inline Alert listing existing clients with 'Usar este cliente' link"
    - "User can save with NO CPF (CPF is optional)"
    - "User cannot save without phone OR email"
    - "User opens /clientes/:id and sees Tabs: 'Dados' (default) and 'Histórico'"
    - "Histórico tab shows filters (Período, Profissional, Tipo) visually disabled with tooltip 'Histórico disponível após o primeiro atendimento' + Clock empty state"
    - "User clicks Edit row → navigates to /clientes/:id/editar (full-page form pre-filled)"
  artifacts:
    - path: "apps/frontend/src/features/clients/utils/cpf.ts"
      provides: "Frontend CPF validation + formatting (mirrors backend cpf.util.ts)"
      min_lines: 40
    - path: "apps/frontend/src/features/clients/components/CpfDuplicateAlert.tsx"
      provides: "Alert with existing client links per UI-SPEC §CPF Duplicate Alert"
      min_lines: 50
    - path: "apps/frontend/src/features/clients/components/ClientForm.tsx"
      provides: "Full-page form for create/edit with CPF mask + duplicate lookup"
      min_lines: 150
    - path: "apps/frontend/src/features/clients/components/ClientHistoryTab.tsx"
      provides: "Phase 2 stub UI with filters disabled + Clock empty state"
      min_lines: 60
    - path: "apps/frontend/src/pages/ClientesPage.tsx"
      provides: "List page with debounced search, DataTable, soft-delete + restore"
      min_lines: 100
  key_links:
    - from: "ClientForm.tsx CPF blur handler"
      to: "clientsByField query"
      via: "Apollo useLazyQuery — only fires when CPF passes client-side checksum"
      pattern: "clientsByField"
    - from: "router.tsx"
      to: "/clientes/novo + /clientes/:id + /clientes/:id/editar"
      via: "additional routes inside AppShell layout (Plan 02 layout)"
      pattern: "/clientes/novo"
---

<objective>
Build the complete Clientes feature: list with debounced search, full-page create/edit forms with CPF mask + checksum + duplicate lookup, detail page with Dados/Histórico tabs, and the Phase 2 history stub UI. Adds the `/clientes/novo` route to the router.

Purpose: CLI-01 (perfil de cliente com CPF, contatos, aniversário, observações) and CLI-02 (estrutura do histórico pronta — populated by Phase 3).

Output: Full clients feature with all 4 page types (list, create, detail, edit) and shared components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-core-domain/02-CONTEXT.md
@.planning/phases/02-core-domain/02-UI-SPEC.md
@.planning/phases/02-core-domain/02-frontend-appshell-SUMMARY.md
@.planning/phases/02-core-domain/02-backend-commissions-clients-SUMMARY.md
@apps/backend/src/clients/cpf.util.ts
@apps/frontend/src/features/catalog/components/CategoriaForm.tsx
@apps/frontend/src/router.tsx
@apps/frontend/src/components/layout/PageHeader.tsx

<interfaces>
<!-- Plan 05 GraphQL SDL clients.graphql -->

Queries:
- clients(search: String, limit: Int = 20, offset: Int = 0): ClientConnection { rows totalCount }
- client(id: UUID!): Client
- clientsByField(cpf: String, phone: String, email: String, excludeId: UUID): [Client!]!
- clientHistory(clientId: UUID!, filters: ClientHistoryFilters): [ClientHistoryItem!]!  (Phase 2: returns [])

Mutations:
- createClient(input: CreateClientInput!): ClientPayload
- updateClient(input: UpdateClientInput!): ClientPayload
- softDeleteClient + restoreClient

Errors mapped from backend:
- CONTACT_REQUIRED → "Informe pelo menos um telefone ou e-mail."
- CPF_INVALID → "CPF inválido. Verifique os números."
- NOT_FOUND
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: CPF utility, ClientForm with mask + duplicate lookup, CpfDuplicateAlert, /clientes/novo + /clientes/:id/editar pages</name>
  <files>
    apps/frontend/src/features/clients/api/clients.api.ts
    apps/frontend/src/features/clients/utils/cpf.ts
    apps/frontend/src/features/clients/components/CpfDuplicateAlert.tsx
    apps/frontend/src/features/clients/components/ClientForm.tsx
    apps/frontend/src/pages/ClienteNovoPage.tsx
    apps/frontend/src/pages/ClienteEditPage.tsx
    apps/frontend/src/router.tsx
    apps/frontend/src/features/clients/__tests__/cpf.test.ts
    apps/frontend/src/features/clients/__tests__/cpf-duplicate-alert.test.tsx
    apps/frontend/src/features/clients/__tests__/client-form.test.tsx
    apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  </files>
  <read_first>
    - apps/backend/src/clients/cpf.util.ts (mirror algorithm — must match backend exactly so client validation matches server)
    - .planning/phases/02-core-domain/02-UI-SPEC.md §CPF Duplicate Alert, §Form Field Labels Clients, §Form Pattern (clients use full-page, not Dialog)
    - apps/frontend/src/features/auth/pages/SignupPage.tsx (full-page form precedent from Phase 1)
    - apps/frontend/src/router.tsx (add new route — preserve order of `/clientes/novo` BEFORE `/clientes/:id`)
  </read_first>
  <behavior>
    - cpf.ts: `formatCpf(input)` returns "XXX.XXX.XXX-XX" progressively as user types; `unformatCpf` returns digits only; `validateCpf` mirrors backend algorithm exactly
    - ClientForm: standalone full-page form (NOT Dialog) — uses PageHeader + form
    - CPF input masks digits to "XXX.XXX.XXX-XX" via onChange handler, inputMode="numeric"
    - On CPF blur AND CPF valid → fire `clientsByField` Apollo lazy query (skip until valid)
    - If matches found → render `<CpfDuplicateAlert clients={matches} />` above submit footer
    - "Usar este cliente" link navigates to `/clientes/:id`
    - Save button stays enabled even with duplicate alert visible (D-22: warn but don't block)
    - On submit, strip CPF mask before sending (server stores digits-only)
    - Required: fullName + (phone OR email). Server returns CONTACT_REQUIRED if both blank — also enforced client-side via Zod superRefine
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/clients/utils/cpf.ts`** mirroring backend algorithm:

```ts
export function unformatCpf(input: string): string {
  return (input ?? '').replace(/\D/g, '').slice(0, 11);
}
export function formatCpf(input: string): string {
  const d = unformatCpf(input);
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
export function validateCpf(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = unformatCpf(input);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const calcVerifier = (slice: string, weightStart: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * (weightStart - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  if (calcVerifier(digits.slice(0, 9), 10) !== Number(digits[9])) return false;
  if (calcVerifier(digits.slice(0, 10), 11) !== Number(digits[10])) return false;
  return true;
}
```

**B. Create test `apps/frontend/src/features/clients/__tests__/cpf.test.ts`** with same case set as backend test plus formatting:
```ts
import { describe, it, expect } from 'vitest';
import { validateCpf, formatCpf, unformatCpf } from '../utils/cpf';

describe('cpf', () => {
  it('validates correctly', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
    expect(validateCpf('111.111.111-11')).toBe(false);
    expect(validateCpf('')).toBe(false);
    expect(validateCpf('12345678900')).toBe(false);
  });
  it('formats progressively', () => {
    expect(formatCpf('1')).toBe('1');
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('1234')).toBe('123.4');
    expect(formatCpf('1234567')).toBe('123.456.7');
    expect(formatCpf('12345678901')).toBe('123.456.789-01');
  });
  it('unformats', () => {
    expect(unformatCpf('123.456.789-01')).toBe('12345678901');
  });
});
```

**C. Create `apps/frontend/src/features/clients/api/clients.api.ts`** with operations: `ClientsListQuery(search, limit, offset)`, `ClientByIdQuery(id)`, `ClientsByFieldQuery(cpf, phone, email, excludeId)`, `ClientHistoryQuery(clientId, filters)`, `CreateClientMutation`, `UpdateClientMutation`, `SoftDeleteClientMutation`, `RestoreClientMutation`. Use the codegen `graphql(...)` tagged template (Plan 06 set up codegen).

**D. Create `apps/frontend/src/features/clients/components/CpfDuplicateAlert.tsx`** per UI-SPEC §CPF Duplicate Alert:

```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface DuplicateClient { id: string; fullName: string; phone?: string | null; email?: string | null; }

export function CpfDuplicateAlert({ clients }: { clients: DuplicateClient[] }) {
  const { t } = useTranslation();
  if (clients.length === 0) return null;
  return (
    <Alert className="border-l-4 border-l-warning-500 bg-warning-500/10">
      <TriangleAlert className="h-4 w-4 text-warning-500" />
      <AlertTitle>{t('clients.duplicate.title')}</AlertTitle>
      <AlertDescription>
        <p className="mb-sm">{t('clients.duplicate.body')}</p>
        <ul className="space-y-xs">
          {clients.map((c) => (
            <li key={c.id}>
              <Link to={`/clientes/${c.id}`} className="text-primary-500 underline">{c.fullName}</Link>
              {' — '}
              <span className="text-neutral-500">{c.phone ?? c.email ?? ''}</span>
              {' '}
              <Link to={`/clientes/${c.id}`} className="text-primary-500 ml-sm">[{t('clients.duplicate.useExisting')}]</Link>
            </li>
          ))}
        </ul>
        <p className="mt-sm text-sm text-neutral-500">{t('clients.duplicate.continueNote')}</p>
      </AlertDescription>
    </Alert>
  );
}
```

**E. Create `apps/frontend/src/features/clients/components/ClientForm.tsx`** — full-page form. Embeds `<PageHeader />` with breadcrumbs + title; below: form. Uses `useLazyQuery` for the duplicate lookup (only fires on CPF blur if valid).

Key wiring details (full implementation pattern):
- `useForm({ resolver: zodResolver(schema), defaultValues })` where schema validates fullName.min(2), email format, and `superRefine` enforces "(phone or email) required" + CPF checksum
- CPF Controller field with `onChange={(e) => field.onChange(formatCpf(e.target.value))}` + `onBlur={() => { field.onBlur(); onCpfBlur(); }}`
- `onCpfBlur` calls `useLazyQuery(ClientsByFieldQuery, { fetchPolicy: 'network-only' })` only if `validateCpf(raw)`
- On submit: strip CPF mask via `unformatCpf()` before mutation
- After successful save: `navigate(\`/clientes/${data.client.id}\`)`
- Map server errors to form fields: `errors[0].field as any` with form.setError

The full file is ~180 lines; the structure mirrors `CategoriaForm.tsx` from Plan 06 with the additions above. **Executor MUST include**:
1. PageHeader with breadcrumbs `[{ label: t('navigation.clientes'), to: '/clientes' }, { label: isEdit ? initial.fullName : t('pages.clientes.newTitle') }]`
2. Fields in this order (per UI-SPEC §Form Field Labels Clients): fullName, phone+email (grid 2 cols), cpf (single col with mask), birthDate (type="date"), address, notes (Textarea)
3. CpfDuplicateAlert rendered between cpf field and birthDate when duplicates state has items
4. Submit button copy: "Salvar" (create) / "Salvar alterações" (edit) / "Salvando…" (loading) per UI-SPEC §Form CTAs
5. Cancel button → navigate('/clientes')
6. CPF input attributes: `aria-label="CPF"`, `inputMode="numeric"`, `autoComplete="off"` (UI-SPEC §Accessibility Constraints)

**F. Create `apps/frontend/src/pages/ClienteNovoPage.tsx`:**

```tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientForm } from '@/features/clients/components/ClientForm';

export function ClienteNovoPage() {
  const { t } = useTranslation();
  useEffect(() => { document.title = `${t('pages.clientes.newTitle')} — SGS`; }, [t]);
  return <ClientForm />;
}
```

**G. Replace `apps/frontend/src/pages/ClienteEditPage.tsx`** to load existing client and pass to form:

```tsx
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useEffect } from 'react';
import { ClientByIdQuery } from '@/features/clients/api/clients.api';
import { ClientForm } from '@/features/clients/components/ClientForm';
import { Skeleton } from '@/components/ui/skeleton';

export function ClienteEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useQuery(ClientByIdQuery, { variables: { id }, skip: !id });
  useEffect(() => { document.title = 'Editar cliente — SGS'; }, []);
  if (!id || error) return <Navigate to="/clientes" replace />;
  if (loading) return <div className="space-y-md"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96" /></div>;
  if (!data?.client) return <Navigate to="/clientes" replace />;
  return <ClientForm initial={data.client} />;
}
```

**H. Update `apps/frontend/src/router.tsx`** — add `/clientes/novo` BEFORE `/clientes/:id` to prevent React Router from matching `:id='novo'`.

> **CRITICAL: INSERT only — DO NOT rewrite the file.** Open the existing `router.tsx`, locate the existing entry `{ path: '/clientes', element: <ClientesPage /> },` inside the `<ProtectedRoute><AppShell /></ProtectedRoute>` children array (added by Plan 02), and INSERT the new route entry on the line immediately after it. The other Phase 1 routes (`/login`, `/signup`, `/verificar-email/*`, `/convite/:token`, `/recuperar-senha`, `*`) and Phase 2 routes (`/dashboard`, `/catalogo/*`, `/clientes/:id`, `/clientes/:id/editar`) MUST remain present and unchanged. Use targeted Edit (single-hunk insertion), not Write (full-file rewrite).

```tsx
// Existing routes inside the <ProtectedRoute><AppShell /></ProtectedRoute> children array
// (these are ALREADY present from Plan 02 — do NOT recreate them):
{ path: '/clientes',                 element: <ClientesPage /> },
// ↓ INSERT THIS NEW LINE only:
{ path: '/clientes/novo',            element: <ClienteNovoPage /> },
// ↓ Existing routes continue unchanged below:
{ path: '/clientes/:id',             element: <ClienteDetailPage /> },
{ path: '/clientes/:id/editar',      element: <ClienteEditPage /> },
```

Add the import: `import { ClienteNovoPage } from '@/pages/ClienteNovoPage';` — INSERT into the existing import block at the top of the file, alongside the other page imports. Do NOT remove or reorder existing imports.

**Verification after the edit (run from repo root):**
```bash
# Phase 1 routes must still be present (count must be exactly 1 each)
grep -c "path: '/login'"             apps/frontend/src/router.tsx
grep -c "path: '/signup'"            apps/frontend/src/router.tsx
grep -c "path: '/verificar-email'"   apps/frontend/src/router.tsx
grep -c "path: '/convite/"           apps/frontend/src/router.tsx
grep -c "path: '/recuperar-senha'"   apps/frontend/src/router.tsx
# Phase 2 routes from Plan 02 must still be present
grep -c "path: '/dashboard'"         apps/frontend/src/router.tsx
grep -c "/catalogo/categorias"       apps/frontend/src/router.tsx
grep -c "/catalogo/comissoes"        apps/frontend/src/router.tsx
# New route added by THIS plan
grep -c "/clientes/novo"             apps/frontend/src/router.tsx  # → 1
```
If any Phase 1 or Plan 02 route count is 0, the file was accidentally rewritten — `git restore apps/frontend/src/router.tsx` and retry using the Edit tool with a targeted single-hunk insertion.

**I. Append to `pt-BR.json`:**

```json
"clients": {
  "form": {
    "fullName": "Nome completo",
    "fullNamePlaceholder": "Maria da Silva",
    "phone": "Telefone",
    "email": "E-mail",
    "cpf": "CPF",
    "birthDate": "Data de nascimento",
    "address": "Endereço",
    "addressPlaceholder": "Rua, número, bairro, cidade",
    "notes": "Observações",
    "notesPlaceholder": "Preferências, alergias, observações gerais…"
  },
  "duplicate": {
    "title": "CPF já cadastrado",
    "body": "Este CPF já está associado a outro(s) cliente(s). Verifique antes de criar um novo.",
    "useExisting": "Usar este cliente",
    "continueNote": "Ou continue para criar um novo cliente mesmo assim."
  },
  "validation": {
    "contactRequired": "Informe pelo menos um telefone ou e-mail.",
    "cpfInvalid": "CPF inválido. Verifique os números.",
    "phoneInvalid": "Informe um telefone válido. Ex.: (11) 99999-9999",
    "emailInvalid": "Informe um e-mail válido."
  },
  "tabs": { "data": "Dados", "history": "Histórico" },
  "history": {
    "filters": { "period": "Período", "professional": "Profissional", "kind": "Tipo" },
    "filtersDisabledTooltip": "Histórico disponível após o primeiro atendimento",
    "empty": {
      "heading": "Sem histórico ainda",
      "body": "Quando você atender este cliente, o histórico aparecerá aqui automaticamente."
    }
  },
  "list": {
    "search": "Buscar cliente…",
    "table": { "name": "Nome", "phone": "Telefone", "email": "E-mail", "cpf": "CPF", "actions": "Ações" }
  },
  "empty": {
    "heading": "Nenhum cliente ainda",
    "body": "Adicione os clientes do seu salão.",
    "cta": "Novo cliente"
  }
}
```

Also add to `pages.clientes`: `"newTitle": "Novo cliente"`, `"editTitle": "Editar cliente"`.

**J. Test `cpf-duplicate-alert.test.tsx`:**
1. Renders nothing when clients array is empty
2. Renders 2 list items when 2 clients passed
3. Each item has a "Usar este cliente" link with href `/clientes/{id}`

**K. Test `client-form.test.tsx`** (mock `MockedProvider` from `@apollo/client/testing`):
1. Empty form submit → fullName + phone validation errors surface
2. Valid CPF on blur → triggers `ClientsByFieldQuery` (mock returns one match) → CpfDuplicateAlert renders
3. Invalid CPF (`111.111.111-11`) on blur → no query fired (rejected client-side; verify by checking mock not called)
4. Submit with full data → `CreateClientMutation` called with `cpf: '52998224725'` (digits only, no mask)
5. Submit with no phone and no email → validation error "Informe pelo menos um telefone ou e-mail."
6. Submit returning CONTACT_REQUIRED server error → form.setError on phone field
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/features/clients/__tests__/cpf.test.ts src/features/clients/__tests__/cpf-duplicate-alert.test.tsx src/features/clients/__tests__/client-form.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cpf.ts` exports `validateCpf`, `formatCpf`, `unformatCpf`; cpf.test.ts passes 3 describes (12 assertions total)
    - `CpfDuplicateAlert.tsx` &gt;= 50 lines, renders Alert with `border-l-4 border-l-warning-500` (border-left accent per UI-SPEC §CPF Duplicate Alert)
    - `ClientForm.tsx` &gt;= 150 lines, contains `useLazyQuery(ClientsByFieldQuery, ...)` and conditional render `{duplicates.length > 0 && <CpfDuplicateAlert ... />}`
    - CPF input has `aria-label="CPF"`, `inputMode="numeric"`, `autoComplete="off"`
    - `router.tsx` has `/clientes/novo` route ordered BEFORE `/clientes/:id` (verify via grep line numbers)
    - `router.tsx` is INSERTED-into, not REWRITTEN: all Phase 1 routes (`/login`, `/signup`, `/verificar-email`, `/convite/`, `/recuperar-senha`) AND Plan 02 routes (`/dashboard`, `/catalogo/categorias`, `/catalogo/servicos`, `/catalogo/pacotes`, `/catalogo/produtos`, `/catalogo/comissoes`, `/clientes/:id`, `/clientes/:id/editar`) are still present and unchanged after this task (verify with the grep checklist in Step H)
    - `pages.clientes.newTitle` and `pages.clientes.editTitle` keys exist in pt-BR.json
    - All form/alert tests pass
    - Submit with invalid CPF blocked client-side BEFORE network call (test 3 asserts query mock not called)
  </acceptance_criteria>
  <done>
    - CPF validation + masking deterministic and tested
    - ClientForm operational with duplicate lookup and field-level error mapping
    - /clientes/novo and /clientes/:id/editar routes wired through AppShell
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ClienteDetailPage with Dados/Histórico tabs and ClientHistoryTab stub UI</name>
  <files>
    apps/frontend/src/features/clients/components/ClientHistoryTab.tsx
    apps/frontend/src/pages/ClienteDetailPage.tsx
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Client History Tab, §Client Detail Tabs, §Empty States
    - apps/frontend/src/components/ui/tabs.tsx (Plan 02 install)
    - apps/frontend/src/components/ui/tooltip.tsx (Plan 02 install)
    - apps/frontend/src/features/clients/api/clients.api.ts (Task 1 — ClientByIdQuery, ClientHistoryQuery)
  </read_first>
  <behavior>
    - ClienteDetailPage shows PageHeader (client.fullName as title, breadcrumb "Clientes > {fullName}", "Editar" button as CTA navigates to /editar)
    - Below: Tabs (default 'data') with two TabsContent panels
    - Dados tab: shows non-editable card with all client fields (fullName, phone, email, formatted CPF, birthDate, address, notes)
    - Histórico tab: renders ClientHistoryTab component
    - ClientHistoryTab Phase 2 state per UI-SPEC §Client History Tab:
      * Filter row at top: 3 controls (Período Select, Profissional Select, Tipo Select) — visually disabled (`opacity-50 cursor-not-allowed`) WRAPPED in Tooltip with content "Histórico disponível após o primeiro atendimento"
      * DO NOT hide filters — show them disabled to communicate Phase 3 will activate them
      * Below filters: empty state — Clock lucide icon (48px), heading "Sem histórico ainda", body "Quando você atender este cliente, o histórico aparecerá aqui automaticamente."
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/clients/components/ClientHistoryTab.tsx`:**

```tsx
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ClientHistoryTab(_: { clientId: string }) {
  const { t } = useTranslation();
  const tooltip = t('clients.history.filtersDisabledTooltip');

  const DisabledFilter = ({ label, placeholder }: { label: string; placeholder: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="opacity-50 cursor-not-allowed pointer-events-none">
          <label className="block text-label text-neutral-500 mb-xs">{label}</label>
          <Select disabled>
            <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <DisabledFilter label={t('clients.history.filters.period')} placeholder={t('financial.period.thisMonth')} />
          <DisabledFilter label={t('clients.history.filters.professional')} placeholder="—" />
          <DisabledFilter label={t('clients.history.filters.kind')} placeholder="—" />
        </div>
        <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
          <Clock className="h-12 w-12 text-neutral-500" aria-hidden="true" />
          <h3 className="text-base font-semibold">{t('clients.history.empty.heading')}</h3>
          <p className="text-sm text-neutral-500 max-w-md">{t('clients.history.empty.body')}</p>
        </div>
      </div>
    </TooltipProvider>
  );
}
```

**B. Replace `apps/frontend/src/pages/ClienteDetailPage.tsx`** with full implementation:

```tsx
import { useEffect } from 'react';
import { useNavigate, useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientByIdQuery } from '@/features/clients/api/clients.api';
import { ClientHistoryTab } from '@/features/clients/components/ClientHistoryTab';
import { formatCpf } from '@/features/clients/utils/cpf';

export function ClienteDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useQuery(ClientByIdQuery, { variables: { id }, skip: !id });

  useEffect(() => {
    if (data?.client?.fullName) document.title = `${data.client.fullName} — SGS`;
  }, [data]);

  if (!id || error) return <Navigate to="/clientes" replace />;
  if (loading) return <div className="space-y-md"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-96" /></div>;
  if (!data?.client) return <Navigate to="/clientes" replace />;
  const c = data.client;

  return (
    <>
      <PageHeader
        title={c.fullName}
        breadcrumbs={[{ label: t('navigation.clientes'), to: '/clientes' }, { label: c.fullName }]}
        cta={
          <Button variant="outline" onClick={() => navigate(`/clientes/${c.id}/editar`)}>
            <Pencil className="mr-sm h-4 w-4" />
            Editar
          </Button>
        }
      />
      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">{t('clients.tabs.data')}</TabsTrigger>
          <TabsTrigger value="history">{t('clients.tabs.history')}</TabsTrigger>
        </TabsList>
        <TabsContent value="data">
          <Card>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-md p-lg">
              <Field label={t('clients.form.fullName')} value={c.fullName} />
              <Field label={t('clients.form.phone')} value={c.phone ?? '—'} />
              <Field label={t('clients.form.email')} value={c.email ?? '—'} />
              <Field label={t('clients.form.cpf')} value={c.cpf ? formatCpf(c.cpf) : '—'} />
              <Field label={t('clients.form.birthDate')} value={c.birthDate ? new Date(c.birthDate).toLocaleDateString('pt-BR') : '—'} />
              <Field label={t('clients.form.address')} value={c.address ?? '—'} />
              <Field label={t('clients.form.notes')} value={c.notes ?? '—'} className="md:col-span-2" />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <ClientHistoryTab clientId={c.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-label text-neutral-500">{label}</div>
      <div className="text-base text-neutral-800">{value}</div>
    </div>
  );
}
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `ClientHistoryTab.tsx` &gt;= 60 lines; contains `Tooltip` wrapping disabled `Select`; renders `Clock` lucide icon at 48px (`h-12 w-12`)
    - `ClienteDetailPage.tsx` replaces "Em breve" placeholder; uses `<Tabs defaultValue="data">` with two TabsContent panels
    - Dados tab renders all 7 fields (fullName, phone, email, cpf formatted, birthDate localized pt-BR, address, notes)
    - Notes field spans 2 columns on desktop (verify with grep `md:col-span-2`)
    - PageHeader CTA "Editar" button navigates to `/clientes/{id}/editar`
    - `pnpm typecheck` exits 0
    - History filters wrapped in TooltipProvider for accessibility
  </acceptance_criteria>
  <done>
    - Detail page operational with Dados/Histórico tabs
    - Histórico stub renders disabled filters with tooltip + Clock empty state
    - Phase 3 will replace ClientHistoryTab body when populating real history data
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: ClientesPage list with debounced search, soft-delete, and undo toast</name>
  <files>
    apps/frontend/src/pages/ClientesPage.tsx
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md §List Page Pattern, §Empty States, §Soft-Delete Confirmation (client variant)
    - apps/frontend/src/pages/CategoriasPage.tsx (Plan 06 list pattern reference)
    - apps/frontend/src/components/ui/data-table.tsx (DataTable contract)
    - apps/frontend/src/features/catalog/components/ConfirmSoftDeleteDialog.tsx (Plan 06 — supports client variant via entityKind='client')
  </read_first>
  <behavior>
    - SearchBar at top with shadcn Input + Search lucide icon, placeholder "Buscar cliente…", 300ms debounce
    - DataTable columns: avatar (initials)+name, phone, email, formatted CPF, actions DropdownMenu
    - Pagination: 20 per page, offset-based (per UI-SPEC); reads totalCount from `clients.totalCount`
    - Empty state: when search blank AND list empty → `Users` lucide icon, heading "Nenhum cliente ainda", body "Adicione os clientes do seu salão.", CTA "Novo cliente" navigates to /clientes/novo
    - Empty state: when search active AND list empty → `Search` icon, heading "Nenhum resultado", body "Nenhum resultado para "{query}".", "Limpar busca" link
    - Row click → navigate to `/clientes/{id}`
    - Action menu: Edit (navigate /editar) + Excluir (ConfirmSoftDeleteDialog with entityKind='client' → softDeleteClient mutation → Sonner toast "{name} desativado. [Desfazer]" — clicking Desfazer fires restoreClient mutation within 5s)
  </behavior>
  <action>
**A. Replace `apps/frontend/src/pages/ClientesPage.tsx`** with full implementation:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Search, Users, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmSoftDeleteDialog } from '@/features/catalog/components/ConfirmSoftDeleteDialog';
import {
  ClientsListQuery, SoftDeleteClientMutation, RestoreClientMutation,
} from '@/features/clients/api/clients.api';
import { formatCpf } from '@/features/clients/utils/cpf';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

interface ClientRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
}

export function ClientesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  // 300ms debounce
  useEffect(() => {
    const id = setTimeout(() => setDebounced(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Reset page on search change
  useEffect(() => { setPage(1); }, [debounced]);

  useEffect(() => { document.title = t('pages.clientes.tab'); }, [t]);

  const { data, loading } = useQuery(ClientsListQuery, {
    variables: { search: debounced || null, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  });
  const rows: ClientRow[] = useMemo(() => data?.clients?.rows ?? [], [data]);
  const totalCount = data?.clients?.totalCount ?? 0;

  const [softDelete] = useMutation(SoftDeleteClientMutation, { refetchQueries: [{ query: ClientsListQuery, variables: { search: debounced || null, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } }] });
  const [restore] = useMutation(RestoreClientMutation, { refetchQueries: [{ query: ClientsListQuery, variables: { search: debounced || null, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } }] });

  async function handleDelete(c: ClientRow) {
    const res = await softDelete({ variables: { input: { id: c.id } } });
    const errors = res.data?.softDeleteClient.errors ?? [];
    if (errors.length) { toast.error(errors[0].message); return; }
    toast(t('catalog.softDelete.toastDeleted', { name: c.fullName }), {
      action: {
        label: t('catalog.softDelete.toastUndo'),
        onClick: async () => {
          const r = await restore({ variables: { input: { id: c.id } } });
          if ((r.data?.restoreClient.errors ?? []).length === 0) {
            toast.success(t('catalog.softDelete.toastRestored', { name: c.fullName }));
          }
        },
      },
      duration: 5000,
    });
  }

  const showSearchEmpty = !!debounced && rows.length === 0 && !loading;
  const showInitialEmpty = !debounced && rows.length === 0 && !loading;

  return (
    <>
      <PageHeader
        title={t('pages.clientes.h1')}
        cta={<Button onClick={() => navigate('/clientes/novo')}>{t('pages.clientes.newCta')}</Button>}
      />
      <div className="mb-md flex items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('clients.list.search')}
            className="pl-2xl"
            aria-label={t('clients.list.search')}
          />
        </div>
      </div>
      <DataTable<ClientRow>
        rowKey={(r) => r.id}
        loading={loading}
        rows={rows}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        onPageChange={setPage}
        onRowClick={(r) => navigate(`/clientes/${r.id}`)}
        empty={
          showSearchEmpty ? (
            <EmptyState
              icon={<Search className="h-12 w-12 text-neutral-500" />}
              heading="Nenhum resultado"
              body={`Nenhum resultado para "${debounced}".`}
              cta={<Button variant="ghost" onClick={() => setSearchInput('')}>Limpar busca</Button>}
            />
          ) : showInitialEmpty ? (
            <EmptyState
              icon={<Users className="h-12 w-12 text-neutral-500" />}
              heading={t('clients.empty.heading')}
              body={t('clients.empty.body')}
              cta={<Button onClick={() => navigate('/clientes/novo')}>{t('clients.empty.cta')}</Button>}
            />
          ) : null
        }
        columns={[
          {
            key: 'name', header: t('clients.list.table.name'), sortable: false,
            cell: (r) => (
              <div className="flex items-center gap-sm">
                <EntityAvatar name={r.fullName} kind="client" />
                <span className="font-semibold">{r.fullName}</span>
              </div>
            ),
          },
          { key: 'phone', header: t('clients.list.table.phone'), cell: (r) => r.phone ?? '—' },
          { key: 'email', header: t('clients.list.table.email'), cell: (r) => r.email ?? '—' },
          { key: 'cpf', header: t('clients.list.table.cpf'), cell: (r) => r.cpf ? formatCpf(r.cpf) : '—' },
          {
            key: 'actions', header: t('clients.list.table.actions'),
            cell: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onSelect={() => navigate(`/clientes/${r.id}/editar`)}>
                    <Pencil className="mr-sm h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <ConfirmSoftDeleteDialog
                    entityName={r.fullName}
                    entityKind="client"
                    onConfirm={() => handleDelete(r)}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-error-500">
                        <Trash2 className="mr-sm h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />
    </>
  );
}

function EmptyState({ icon, heading, body, cta }:
  { icon: React.ReactNode; heading: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
      {icon}
      <h2 className="text-base font-semibold">{heading}</h2>
      <p className="text-sm text-neutral-500 max-w-md">{body}</p>
      {cta}
    </div>
  );
}
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test --run</automated>
  </verify>
  <acceptance_criteria>
    - `ClientesPage.tsx` &gt;= 100 lines, replaces "Em breve" placeholder
    - Search input has Search lucide icon left-inside; debounce timer fires 300ms after typing stops
    - DataTable receives `page`, `pageSize=20`, `totalCount`, `onPageChange`
    - Row click navigates to `/clientes/{id}` (verify `onRowClick` passes navigate function)
    - Soft-delete uses `ConfirmSoftDeleteDialog entityKind="client"` (triggers client-specific copy "Desativar cliente?")
    - Toast on delete includes Undo action calling `RestoreClientMutation`
    - Two empty state variants: initial (Users icon) and search-empty (Search icon)
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    - Clientes list page operational with debounced search, pagination, soft-delete + undo
    - Both empty states render correct copy and CTAs per UI-SPEC
    - Manual smoke: search debounce works, undo toast restores client within 5s
  </done>
</task>

</tasks>

<verification>
- /clientes shows DataTable with debounced search, pagination, empty states
- /clientes/novo and /clientes/:id/editar render full-page ClientForm
- /clientes/:id renders Tabs with Dados (filled) and Histórico (stub with Clock empty state + disabled filters)
- CPF mask + checksum + duplicate lookup operational on form
- Soft-delete with undo toast works
- All copy from pt-BR.json (zero hardcoded user-facing strings except dialog title fallbacks)
</verification>

<success_criteria>
- `pnpm --filter @sgs/frontend typecheck` exits 0
- All test specs pass: cpf.test (3 describes), cpf-duplicate-alert.test (3), client-form.test (6)
- Manual smoke covers Phase 2 success criterion 5: atendente cria cliente com CPF (529.982.247-25), visualiza histórico vazio, edita perfil, soft-delete + undo
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-frontend-clientes-SUMMARY.md` documenting CPF utility location, ClientForm validation rules, ClientHistoryTab Phase 3 contract (so Phase 3 plan knows the exact ClientHistoryItem shape to populate against), and the routes added to the router.
</output>

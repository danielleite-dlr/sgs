---
phase: 02-core-domain
plan: 07
type: execute
wave: 3
depends_on: [02, 03, 04, 05, 06]
files_modified:
  - apps/frontend/src/features/catalog/api/pacotes.api.ts
  - apps/frontend/src/features/catalog/api/produtos.api.ts
  - apps/frontend/src/features/catalog/api/comissoes.api.ts
  - apps/frontend/src/features/catalog/components/PackagePriceSummary.tsx
  - apps/frontend/src/features/catalog/components/PackageServicesPicker.tsx
  - apps/frontend/src/features/catalog/components/PacoteForm.tsx
  - apps/frontend/src/features/catalog/components/ProdutoForm.tsx
  - apps/frontend/src/features/catalog/components/AdjustStockDialog.tsx
  - apps/frontend/src/components/ui/stock-badge.tsx
  - apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx
  - apps/frontend/src/pages/PacotesPage.tsx
  - apps/frontend/src/pages/ProdutosPage.tsx
  - apps/frontend/src/pages/ComissoesPage.tsx
  - apps/frontend/src/components/layout/AppShell.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/features/catalog/__tests__/pacote-price-summary.test.tsx
  - apps/frontend/src/features/catalog/__tests__/produto-form.test.tsx
  - apps/frontend/src/features/catalog/__tests__/commission-rule-form.test.tsx
autonomous: true
requirements: [CAT-02, CAT-03, CAT-04]

must_haves:
  truths:
    - "User can create a package with 3 services and see 'Soma individual: R$ X / Preço do pacote: R$ Y' update live"
    - "User opens /catalogo/produtos and sees inline 'Estoque baixo' badge on rows where stockQuantity ≤ minStockLevel"
    - "User clicks 'Ajustar estoque' on a product, enters delta + reason, stock updates and movement audited"
    - "Sidebar 'Produtos' nav item shows TriangleAlert icon with tooltip when lowStockCount > 0"
    - "User creates commission rule via radio scope flow: Profissional+Serviço → both pickers / Serviço → service picker / Categoria → category select / Produto → product picker / Padrão → no extras"
    - "Submitting conflicting commission scope returns COMMISSION_SCOPE_CONFLICT error rendered as inline Alert"
    - "Commissions list shows resolved target name (e.g., 'Ana — Corte feminino' for member_service rules)"
  artifacts:
    - path: "apps/frontend/src/features/catalog/components/PackagePriceSummary.tsx"
      provides: "Side-by-side individualSum vs package.price with color-coded delta (UI-SPEC §Package Pricing Transparency)"
      min_lines: 40
    - path: "apps/frontend/src/features/catalog/components/PacoteForm.tsx"
      provides: "Form with services picker (multi-select) + price field + live PackagePriceSummary"
      min_lines: 120
    - path: "apps/frontend/src/components/ui/stock-badge.tsx"
      provides: "Inline error-tinted badge for low-stock products"
      min_lines: 30
    - path: "apps/frontend/src/features/catalog/components/AdjustStockDialog.tsx"
      provides: "Dialog for delta + reason adjustStock mutation per UI-SPEC §Stock Adjustment Dialog"
      min_lines: 80
    - path: "apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx"
      provides: "Radio-driven scope-first form per UI-SPEC §Commission Rule Scope UX"
      min_lines: 150
  key_links:
    - from: "AppShell.tsx"
      to: "lowStockCount query"
      via: "useQuery(LowStockCountQuery) → passes to SidebarNav prop"
      pattern: "lowStockCount"
    - from: "PacoteForm.tsx"
      to: "PackagePriceSummary"
      via: "selected services × quantity feeds individualSum prop"
      pattern: "PackagePriceSummary"
    - from: "CommissionRuleForm.tsx"
      to: "scope conditional fields"
      via: "watch('scopeType') drives which combobox renders"
      pattern: "scopeType"
---

<objective>
Build the remaining catalog screens: Pacotes (with price-vs-sum transparency), Produtos (with low-stock badge + sidebar warning + adjustStock dialog), and Comissões (with scope-first radio flow). Wire `lowStockCount` into AppShell so the sidebar warning icon works app-wide.

Purpose: Phase 2 success criteria 2, 3, 4 — package with 3 services and own price; product with min stock alert; commission rule of 20% applied to specific service.

Output: Three complete feature pages with their forms, the low-stock indicator pipeline, and AdjustStockDialog.
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
@.planning/phases/02-core-domain/02-backend-catalog-services-SUMMARY.md
@.planning/phases/02-core-domain/02-backend-products-stock-SUMMARY.md
@.planning/phases/02-core-domain/02-backend-commissions-clients-SUMMARY.md
@.planning/phases/02-core-domain/02-frontend-catalog-categorias-servicos-SUMMARY.md
@apps/frontend/src/components/layout/AppShell.tsx
@apps/frontend/src/components/layout/SidebarNav.tsx
@apps/frontend/src/features/catalog/components/CategoriaForm.tsx
@apps/frontend/src/features/catalog/components/ServicoForm.tsx

<interfaces>
<!-- Plan 02 (sidebar lowStockCount prop), Plan 04 (lowStockCount query), Plan 06 (form/dialog patterns) -->

From Plan 04 GraphQL SDL (products.graphql):
- Query lowStockCount: Int!
- Query products(lowStockOnly: Boolean): [Product!]! — includes computed `isLowStock: Boolean!`
- Mutation adjustStock(input: { productId, delta, reason }): ProductPayload
- Mutation createProduct(input: { name, sku, costPrice, salePrice, stockQuantity, minStockLevel, unit }): ProductPayload

From Plan 03 GraphQL SDL (catalog.graphql):
- Query packages: [Package!]!
- Mutation createPackage(input: { name, price, services: [{ serviceId, quantity? }] })
- Package.individualSum (server-computed) + Package.services (resolved with embedded service objects)

From Plan 05 GraphQL SDL (commissions.graphql):
- Mutation createCommissionRule(input: { scopeType, kind, value, memberId?, serviceId?, categoryId?, productId? })
- Errors: COMMISSION_SCOPE_CONFLICT, SCOPE_INVALID, VALUE_OUT_OF_RANGE, REFERENCE_NOT_FOUND

From Plan 02:
- `<SidebarNav lowStockCount={N} />` prop already supported — just needs the AppShell to fetch and pass.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pacotes — PriceSummary + PacoteForm + page with live price comparison</name>
  <files>
    apps/frontend/src/features/catalog/api/pacotes.api.ts
    apps/frontend/src/features/catalog/components/PackagePriceSummary.tsx
    apps/frontend/src/features/catalog/components/PackageServicesPicker.tsx
    apps/frontend/src/features/catalog/components/PacoteForm.tsx
    apps/frontend/src/pages/PacotesPage.tsx
    apps/frontend/src/features/catalog/__tests__/pacote-price-summary.test.tsx
    apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Package Pricing Transparency, §Form CTAs (Adicionar serviço)
    - apps/frontend/src/features/catalog/components/CategoriaForm.tsx (Plan 06 pattern)
    - apps/frontend/src/features/catalog/api/servicos.api.ts (reuse ServicesQuery for picker)
    - apps/frontend/src/components/ui/data-table.tsx
  </read_first>
  <behavior>
    - PackagePriceSummary takes `individualSum: string` and `packagePrice: string`, shows both 16px weight 600
    - If packagePrice > individualSum: show "(R$ X acima do total individual)" in warning color
    - If packagePrice < individualSum: show "(R$ X de desconto)" in success color
    - If equal: no supplementary text
    - PacoteForm: name + services picker (multi-select with quantity) + price field + live PackagePriceSummary that recomputes individualSum from selected services on every change
    - On create: individualSum is computed client-side using selected services' basePrice × quantity; on save the server returns its own canonical individualSum (use server value after refetch)
    - Empty package (no services) → form disables Salvar button (matches backend PACKAGE_EMPTY validation)
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/catalog/api/pacotes.api.ts`** with `PackagesQuery`, `CreatePackageMutation`, `UpdatePackageMutation`, `SoftDeletePackageMutation`. Include in fragments:
```graphql
fragment PackageFull on Package {
  id name price individualSum validForDays coverImageUrl
  services {
    serviceId quantity displayOrder
    service { id name basePrice }
  }
}
```

**B. Create `apps/frontend/src/features/catalog/components/PackagePriceSummary.tsx`:**

```tsx
import { useTranslation } from 'react-i18next';

const fmt = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

export function PackagePriceSummary({ individualSum, packagePrice }: { individualSum: string; packagePrice: string }) {
  const { t } = useTranslation();
  const ind = Number(individualSum);
  const pkg = Number(packagePrice);
  const diff = pkg - ind;
  let delta: { text: string; cls: string } | null = null;
  if (diff > 0.001) delta = { text: t('catalog.pacote.delta.above', { v: fmt(diff) }), cls: 'text-warning-500' };
  else if (diff < -0.001) delta = { text: t('catalog.pacote.delta.discount', { v: fmt(-diff) }), cls: 'text-success-500' };
  return (
    <div className="flex flex-col space-y-xs text-base font-semibold">
      <div>{t('catalog.pacote.summary.individual')}: {fmt(ind)}</div>
      <div>
        {t('catalog.pacote.summary.package')}: {fmt(pkg)}
        {delta && <span className={`ml-sm font-normal ${delta.cls}`}>{delta.text}</span>}
      </div>
    </div>
  );
}
```

**C. Create `apps/frontend/src/features/catalog/components/PackageServicesPicker.tsx`** — uses Combobox (Popover + Command) per UI-SPEC §Component Inventory. Multi-select w/ quantity:

```tsx
import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ServicesQuery } from '../api/servicos.api';

export interface PackageServiceRow { serviceId: string; quantity: number; }

export function PackageServicesPicker({
  value, onChange,
}: { value: PackageServiceRow[]; onChange: (next: PackageServiceRow[]) => void }) {
  const { t } = useTranslation();
  const { data } = useQuery(ServicesQuery);
  const services = data?.services ?? [];
  const [open, setOpen] = useState(false);

  const selected = value.map((row) => ({
    ...row,
    service: services.find((s: any) => s.id === row.serviceId),
  }));

  function add(serviceId: string) {
    if (value.find((v) => v.serviceId === serviceId)) return;
    onChange([...value, { serviceId, quantity: 1 }]);
    setOpen(false);
  }
  function setQty(serviceId: string, q: number) {
    onChange(value.map((v) => (v.serviceId === serviceId ? { ...v, quantity: Math.max(1, q) } : v)));
  }
  function remove(serviceId: string) {
    onChange(value.filter((v) => v.serviceId !== serviceId));
  }

  return (
    <div className="space-y-md">
      <div className="space-y-sm">
        {selected.length === 0 && <p className="text-sm text-neutral-500">{t('catalog.pacote.picker.empty')}</p>}
        {selected.map((row) => (
          <div key={row.serviceId} className="flex items-center gap-sm">
            <span className="flex-1 text-sm">{row.service?.name ?? '—'}</span>
            <Input className="w-20" type="number" min={1} value={row.quantity}
              onChange={(e) => setQty(row.serviceId, Number(e.target.value))}
              aria-label={t('catalog.pacote.picker.quantityLabel', { name: row.service?.name ?? '' })} />
            <Button type="button" variant="ghost" size="icon"
              aria-label={t('catalog.pacote.picker.remove', { name: row.service?.name ?? '' })}
              onClick={() => remove(row.serviceId)}>
              <Trash2 className="h-4 w-4 text-error-500" />
            </Button>
          </div>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-xs h-4 w-4" />
            {t('catalog.pacote.picker.add')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[320px]">
          <Command>
            <CommandInput placeholder={t('catalog.pacote.picker.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{t('catalog.pacote.picker.noResults')}</CommandEmpty>
              <CommandGroup>
                {services.filter((s: any) => !value.find((v) => v.serviceId === s.id)).map((s: any) => (
                  <CommandItem key={s.id} value={s.name} onSelect={() => add(s.id)}>
                    <Check className="mr-sm h-4 w-4 opacity-0" />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

**D. Create `apps/frontend/src/features/catalog/components/PacoteForm.tsx`** combining the picker + PackagePriceSummary:

```tsx
import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServicesQuery } from '../api/servicos.api';
import { CreatePackageMutation, UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';
import { PackagePriceSummary } from './PackagePriceSummary';
import { PackageServicesPicker, PackageServiceRow } from './PackageServicesPicker';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  services: z.array(z.object({ serviceId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

export function PacoteForm({ initial, onClose }: {
  initial?: { id: string; name: string; price: string; services: Array<{ serviceId: string; quantity: number }> };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: svcData } = useQuery(ServicesQuery);
  const services = svcData?.services ?? [];
  const [createPkg, { loading: creating }] = useMutation(CreatePackageMutation, { refetchQueries: [{ query: PackagesQuery }] });
  const [updatePkg, { loading: updating }] = useMutation(UpdatePackageMutation, { refetchQueries: [{ query: PackagesQuery }] });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { name: '', price: '0.00', services: [] },
  });

  const watched = form.watch();
  const individualSum = useMemo(() => {
    return watched.services.reduce((sum: number, row: PackageServiceRow) => {
      const svc = services.find((s: any) => s.id === row.serviceId);
      return sum + (svc ? Number(svc.basePrice) * row.quantity : 0);
    }, 0).toFixed(2);
  }, [watched.services, services]);

  const isEdit = !!initial;
  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const payload = { name: values.name, price: values.price, services: values.services };
      const res = isEdit && initial
        ? await updatePkg({ variables: { input: { id: initial.id, ...payload } } })
        : await createPkg({ variables: { input: payload } });
      const data: any = isEdit ? res.data?.updatePackage : res.data?.createPackage;
      const errors = data?.errors ?? [];
      if (errors.length) {
        if (errors[0].field) form.setError(errors[0].field as any, { message: errors[0].message });
        else toast.error(errors[0].message);
        return;
      }
      toast.success(isEdit ? 'Alterações salvas.' : `${values.name} criado com sucesso.`);
      onClose();
    } catch {
      toast.error(t('catalog.servico.errors.generic'));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-md">
        <FormField control={form.control} name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.pacote.form.nameLabel')} *</FormLabel>
              <FormControl><Input {...field} placeholder={t('catalog.pacote.form.namePlaceholder')} autoFocus /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        <Controller control={form.control} name="services"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('catalog.pacote.form.servicesLabel')} *</FormLabel>
              <PackageServicesPicker value={field.value} onChange={field.onChange} />
              {fieldState.error && <p className="text-sm text-error-500">{fieldState.error.message}</p>}
            </FormItem>
          )} />
        <FormField control={form.control} name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.pacote.form.priceLabel')} *</FormLabel>
              <FormControl><Input {...field} placeholder="R$ 0,00" inputMode="decimal" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        <PackagePriceSummary individualSum={individualSum} packagePrice={form.watch('price') || '0'} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('catalog.categoria.form.cancel')}</Button>
          <Button type="submit" disabled={creating || updating || form.watch('services').length === 0}>
            {creating || updating ? t('catalog.categoria.form.submitting') : isEdit ? t('catalog.categoria.form.submitEdit') : t('catalog.categoria.form.submitCreate')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
```

**E. Create `apps/frontend/src/pages/PacotesPage.tsx`** following CategoriasPage pattern (replace placeholder). Columns: avatar+name, "Soma individual" formatted BRL, "Preço do pacote" formatted BRL with delta indicator (reuse PackagePriceSummary inline), service count badge, actions. Empty state: `Package` lucide icon, heading "Nenhum pacote ainda".

**F. Append to `pt-BR.json`:**

```json
"catalog": {
  ...,
  "pacote": {
    "summary": {
      "individual": "Soma individual",
      "package": "Preço do pacote"
    },
    "delta": {
      "above": "({{v}} acima do total individual)",
      "discount": "({{v}} de desconto)"
    },
    "form": {
      "nameLabel": "Nome do pacote",
      "namePlaceholder": "Ex.: Pacote Noiva Completo",
      "servicesLabel": "Serviços incluídos",
      "priceLabel": "Preço do pacote"
    },
    "picker": {
      "add": "Adicionar serviço",
      "empty": "Adicione ao menos um serviço.",
      "remove": "Remover {{name}}",
      "quantityLabel": "Quantidade de {{name}}",
      "searchPlaceholder": "Buscar serviço…",
      "noResults": "Nenhum serviço encontrado."
    },
    "table": {
      "name": "Nome",
      "individual": "Soma individual",
      "package": "Preço do pacote",
      "items": "Serviços",
      "actions": "Ações"
    },
    "empty": {
      "heading": "Nenhum pacote ainda",
      "body": "Crie pacotes combinando serviços com desconto.",
      "cta": "Novo pacote"
    }
  }
}
```

**G. Test `pacote-price-summary.test.tsx`:**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/infrastructure/i18n/i18n';
import { PackagePriceSummary } from '../components/PackagePriceSummary';

describe('PackagePriceSummary', () => {
  it('shows discount when package price below individual sum', () => {
    render(<PackagePriceSummary individualSum="280.00" packagePrice="220.00" />);
    expect(screen.getByText(/Soma individual/)).toBeInTheDocument();
    expect(screen.getByText(/Preço do pacote/)).toBeInTheDocument();
    expect(screen.getByText(/de desconto/)).toBeInTheDocument();
  });
  it('shows above when package price above individual sum', () => {
    render(<PackagePriceSummary individualSum="100.00" packagePrice="150.00" />);
    expect(screen.getByText(/acima do total individual/)).toBeInTheDocument();
  });
  it('shows nothing when equal', () => {
    render(<PackagePriceSummary individualSum="100.00" packagePrice="100.00" />);
    expect(screen.queryByText(/acima/)).toBeNull();
    expect(screen.queryByText(/desconto/)).toBeNull();
  });
});
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/features/catalog/__tests__/pacote-price-summary.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - 4 new files in `src/features/catalog/{api,components}` for pacotes feature
    - `PackagePriceSummary.tsx` &gt;= 30 lines, uses BRL `Intl.NumberFormat`
    - `PacoteForm.tsx` watches `services` field array → recomputes `individualSum` via useMemo
    - PackageServicesPicker uses shadcn Combobox composition (Popover + Command)
    - Pacote test passes 3 cases (discount, above, equal)
    - Submit disabled when services array length 0 (verify with grep `disabled={... services.length === 0}`)
    - PacotesPage replaces "Em breve" placeholder
  </acceptance_criteria>
  <done>
    - Pacotes page operational with live price-vs-sum transparency display
    - Picker enforces backend rule (≥1 service)
    - Tests prove all three delta-rendering branches
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Produtos page with StockBadge, AdjustStockDialog, AppShell low-stock wiring</name>
  <files>
    apps/frontend/src/features/catalog/api/produtos.api.ts
    apps/frontend/src/components/ui/stock-badge.tsx
    apps/frontend/src/features/catalog/components/AdjustStockDialog.tsx
    apps/frontend/src/features/catalog/components/ProdutoForm.tsx
    apps/frontend/src/pages/ProdutosPage.tsx
    apps/frontend/src/components/layout/AppShell.tsx
    apps/frontend/src/features/catalog/__tests__/produto-form.test.tsx
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Stock Low Badge, §Stock Adjustment Dialog, §AppShell low-stock indicator
    - apps/frontend/src/components/layout/AppShell.tsx (Plan 02 — extend to fetch lowStockCount)
    - apps/frontend/src/features/catalog/components/CategoriaForm.tsx (form pattern)
    - apps/frontend/src/components/ui/badge.tsx (Plan 02 shadcn install)
  </read_first>
  <behavior>
    - StockBadge renders `bg-error-500/10 text-error-500 border border-error-500/30 rounded-sm px-sm py-xs` with TriangleAlert icon when stock <= min, else plain text "X un|ml|g"
    - AdjustStockDialog: Dialog with current stock label, delta input (signed integer, accepts +10 or -5), reason textarea (required), "Confirmar ajuste" button → calls adjustStock mutation, optimistic toast on success
    - ProdutoForm: name, sku, costPrice, salePrice, stockQuantity (CREATE only — disabled on edit, with helper text "Use Ajustar estoque para alterar"), minStockLevel, unit select
    - ProdutosPage: DataTable columns (avatar+name, sku, sale price, cost price, stock with StockBadge, min stock, unit, actions menu with Edit/Adjust stock/Delete)
    - AppShell fetches `lowStockCount` and passes to SidebarNav
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/catalog/api/produtos.api.ts`** with `ProductsQuery` (lowStockOnly variable), `CreateProductMutation`, `UpdateProductMutation`, `AdjustStockMutation`, `SoftDeleteProductMutation`, `LowStockCountQuery`.

**B. Create `apps/frontend/src/components/ui/stock-badge.tsx`:**

```tsx
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const unitLabels = { un: 'un', ml: 'mL', g: 'g' } as const;

export function StockBadge({ quantity, minLevel, unit }: { quantity: number; minLevel: number; unit: 'un' | 'ml' | 'g' }) {
  const isLow = quantity <= minLevel;
  if (!isLow) {
    return <span className="text-base text-neutral-800">{quantity} {unitLabels[unit]}</span>;
  }
  return (
    <span
      className={cn('inline-flex items-center gap-xs rounded-sm border px-sm py-xs text-label',
        'bg-error-500/10 text-error-500 border-error-500/30')}
      aria-label={`Estoque baixo: ${quantity} ${unitLabels[unit]}`}
    >
      <TriangleAlert className="h-3 w-3" />
      {quantity} {unitLabels[unit]}
    </span>
  );
}
```

**C. Create `apps/frontend/src/features/catalog/components/AdjustStockDialog.tsx`:**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';  // add via shadcn if missing
import { AdjustStockMutation, ProductsQuery, LowStockCountQuery } from '../api/produtos.api';
import { toast } from 'sonner';

const schema = z.object({
  delta: z.coerce.number().int().refine((n) => n !== 0, 'Quantidade não pode ser zero'),
  reason: z.string().min(1).max(500),
});

export function AdjustStockDialog({ product, open, onClose }: {
  product: { id: string; name: string; stockQuantity: number; minStockLevel: number; unit: 'un' | 'ml' | 'g' };
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [adjust, { loading }] = useMutation(AdjustStockMutation, {
    refetchQueries: [{ query: ProductsQuery, variables: { lowStockOnly: false } }, { query: LowStockCountQuery }],
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { delta: 0, reason: '' },
  });
  const delta = form.watch('delta');
  const newStock = (product.stockQuantity ?? 0) + (delta || 0);

  async function onSubmit(v: z.infer<typeof schema>) {
    const res = await adjust({ variables: { input: { productId: product.id, delta: v.delta, reason: v.reason } } });
    const errors = res.data?.adjustStock.errors ?? [];
    if (errors.length) {
      if (errors[0].field) form.setError(errors[0].field as any, { message: errors[0].message });
      else toast.error(errors[0].message);
      return;
    }
    toast.success(t('catalog.produto.toasts.stockAdjusted'));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('catalog.produto.adjustStock.title')}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-md">
            <div className="text-sm">
              {t('catalog.produto.adjustStock.currentLabel')}: <strong>{product.stockQuantity} {product.unit}</strong>
            </div>
            <FormField control={form.control} name="delta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.produto.adjustStock.deltaLabel')}</FormLabel>
                  <FormControl><Input type="number" {...field} placeholder="+10 ou -5" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            <FormField control={form.control} name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.produto.adjustStock.reasonLabel')}</FormLabel>
                  <FormControl><Textarea {...field} placeholder={t('catalog.produto.adjustStock.reasonPlaceholder')} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            <div className="text-sm text-neutral-500">
              {t('catalog.produto.adjustStock.previewLabel')}: <strong>{newStock} {product.unit}</strong>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>{t('catalog.categoria.form.cancel')}</Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('catalog.categoria.form.submitting') : t('catalog.produto.adjustStock.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

If `Textarea` shadcn primitive isn't installed yet, run `pnpm dlx shadcn@latest add textarea`.

**D. Create `apps/frontend/src/features/catalog/components/ProdutoForm.tsx`** — fields per UI-SPEC §Form Field Labels Products:
- name, sku, cost price, sale price, stock quantity (CREATE only — disabled on edit), min stock level, unit (Select with un/ml/g)
- On edit, render disabled stock field with hint "Use Ajustar estoque para alterar."

**E. Create `apps/frontend/src/pages/ProdutosPage.tsx`** with DataTable, AdjustStockDialog wired to dropdown menu, empty state with `ShoppingBag` icon.

**F. Update `apps/frontend/src/components/layout/AppShell.tsx`** to fetch lowStockCount:

```tsx
import { useQuery } from '@apollo/client';
import { LowStockCountQuery } from '@/features/catalog/api/produtos.api';

// inside AppShell:
const { data } = useQuery(LowStockCountQuery, { pollInterval: 60_000, errorPolicy: 'ignore' });
const lowStockCount = data?.lowStockCount ?? 0;

// Then pass: <SidebarNav lowStockCount={lowStockCount} />
```

Refetch on visibility change is a nice-to-have — pollInterval 60s is sufficient for Phase 2.

**G. Append to `pt-BR.json`:**

```json
"catalog": {
  ...,
  "produto": {
    "form": {
      "nameLabel": "Nome do produto",
      "namePlaceholder": "Ex.: Shampoo Hidratação Intensa",
      "skuLabel": "SKU",
      "skuPlaceholder": "Ex.: SHM-001",
      "costPriceLabel": "Preço de custo",
      "salePriceLabel": "Preço de venda",
      "stockLabel": "Estoque atual",
      "minStockLabel": "Estoque mínimo",
      "unitLabel": "Unidade",
      "unitOptions": { "un": "Unidade", "ml": "mL", "g": "g" },
      "stockEditDisabledHint": "Use Ajustar estoque para alterar."
    },
    "table": {
      "name": "Nome",
      "sku": "SKU",
      "salePrice": "Preço de venda",
      "stock": "Estoque",
      "minStock": "Mínimo",
      "actions": "Ações"
    },
    "adjustStock": {
      "title": "Ajustar estoque",
      "currentLabel": "Estoque atual",
      "deltaLabel": "Quantidade (use - para reduzir)",
      "reasonLabel": "Motivo",
      "reasonPlaceholder": "Ex.: Recebimento de pedido, Avaria",
      "previewLabel": "Novo estoque",
      "confirm": "Confirmar ajuste"
    },
    "toasts": {
      "stockAdjusted": "Estoque atualizado."
    },
    "empty": {
      "heading": "Nenhum produto ainda",
      "body": "Cadastre os produtos que você usa ou vende.",
      "cta": "Novo produto"
    },
    "errors": {
      "skuTaken": "Este SKU já está em uso por outro produto.",
      "stockNegative": "Estoque resultante seria negativo."
    }
  }
}
```

**H. Test `produto-form.test.tsx`:**
1. Mount in create mode — stock field is enabled; submitting with valid data calls createProduct
2. Mount in edit mode — stock field is disabled (verify with `expect(input).toBeDisabled()`)
3. Submit with stockQuantity=0, minStockLevel=5 → no low-stock immediate (low-stock detection happens server-side only)
4. Verify SKU regex allows 'SHM-001' but rejects 'sku with space'
5. Submit triggers SKU_TAKEN error → form.setError on `sku` field
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/features/catalog/__tests__/produto-form.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `stock-badge.tsx` &gt;= 30 lines; renders error-tinted badge only when `quantity <= minLevel`
    - `AdjustStockDialog.tsx` &gt;= 80 lines; live "Novo estoque: X un" preview from form watch
    - `ProdutoForm.tsx` disables stockQuantity input when initial is provided
    - `AppShell.tsx` calls `useQuery(LowStockCountQuery)` and passes `lowStockCount` to `SidebarNav`
    - `ProdutosPage.tsx` replaces "Em breve" placeholder; shows `<StockBadge />` in stock column
    - 5 produto-form tests pass
    - Sidebar warning icon shows when AppShell receives lowStockCount > 0 (verify by mocking the query in a smoke render)
  </acceptance_criteria>
  <done>
    - Produtos page operational with full CRUD + adjustStock + low-stock badge
    - Sidebar warning icon hooked to live lowStockCount query
    - Tests prove form behavior (stock disabled on edit, SKU validation, error mapping)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Comissões page with scope-first radio flow</name>
  <files>
    apps/frontend/src/features/catalog/api/comissoes.api.ts
    apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx
    apps/frontend/src/pages/ComissoesPage.tsx
    apps/frontend/src/features/catalog/__tests__/commission-rule-form.test.tsx
  </files>
  <read_first>
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Commission Rule Scope UX, §Commission Scope Radio Options
    - apps/frontend/src/features/catalog/api/servicos.api.ts (for service combobox), categorias.api.ts, produtos.api.ts (for category/product pickers)
    - apps/frontend/src/components/ui/radio-group.tsx (Plan 02)
  </read_first>
  <behavior>
    - CommissionRuleForm uses RadioGroup: 5 scope options
    - Conditional fields appear based on watched scopeType:
      - member_service: Member combobox + Service combobox
      - service: Service combobox
      - category: Category select
      - product: Product combobox
      - default: no scope fields
    - Then always: kind RadioGroup (fixed/percentage) + value Input (R$ or % suffix based on kind)
    - Submit calls createCommissionRule
    - On COMMISSION_SCOPE_CONFLICT error: show inline Alert above DialogFooter linking to existing rule (link element only — actual link can target a static "/catalogo/comissoes" with query param, or just be a hint)
    - List page shows resolved target name in single column (e.g., "Profissional + Serviço: Ana — Corte feminino", "Serviço: Hidratação", "Padrão da organização")
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/catalog/api/comissoes.api.ts`** with `CommissionRulesQuery`, `CreateCommissionRuleMutation`, `UpdateCommissionRuleMutation`, `SoftDeleteCommissionRuleMutation`. Also include `MembersQuery` (assumes existing /me query exposes members; if not, add a minimal `members: [Member!]!` query to backend OR use the existing `me` query memberships — verify with codegen).

If a `members` query is missing in Plan 03/05, add it to `apps/backend/src/graphql/schema/identity.graphql` as a follow-up — but Plan 02 should already expose Member through the auth resolver. Inspect `identity.graphql` first:

```bash
cat apps/backend/src/graphql/schema/identity.graphql
```

If `members: [Member!]!` query does not exist, add it as a tiny patch in `apps/backend/src/identity/` (1 query, 1 resolver method, gated by MEMBER_READ permission — already in catalog). Otherwise Combobox cannot resolve member.

**B. Create `apps/frontend/src/features/catalog/components/CommissionRuleForm.tsx`:**

Layout:
1. Top: RadioGroup `scopeType` with 5 options (label + helper text per UI-SPEC §Commission Scope Radio Options)
2. Conditional combobox/select per scope
3. Divider
4. Kind RadioGroup (`fixed` / `percentage`) — same pattern
5. Value Input — placeholder "R$ 0,00" if fixed, "0%" if percentage. Display suffix: "R$" or "%" depending on kind
6. DialogFooter with Cancelar/Salvar
7. If `errors[0].code === 'COMMISSION_SCOPE_CONFLICT'`: render `<Alert variant="warning">` above footer with copy "Já existe uma regra para este escopo. Edite a regra existente."

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DialogFooter } from '@/components/ui/dialog';
import { CreateCommissionRuleMutation, CommissionRulesQuery } from '../api/comissoes.api';
import { useState } from 'react';
// import combobox subcomponents for member/service/category/product pickers — Plan 06 PackageServicesPicker as reference

const SCOPES = ['member_service', 'service', 'category', 'product', 'default'] as const;
const KINDS = ['fixed', 'percentage'] as const;

const schema = z.object({
  scopeType: z.enum(SCOPES),
  memberId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  kind: z.enum(KINDS),
  value: z.string().regex(/^\d+(\.\d{1,4})?$/),
}).superRefine((d, ctx) => {
  if (d.scopeType === 'member_service' && (!d.memberId || !d.serviceId)) ctx.addIssue({ code: 'custom', path: ['scopeType'], message: 'Selecione profissional e serviço.' });
  if (d.scopeType === 'service' && !d.serviceId) ctx.addIssue({ code: 'custom', path: ['serviceId'], message: 'Selecione um serviço.' });
  if (d.scopeType === 'category' && !d.categoryId) ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Selecione uma categoria.' });
  if (d.scopeType === 'product' && !d.productId) ctx.addIssue({ code: 'custom', path: ['productId'], message: 'Selecione um produto.' });
});

export function CommissionRuleForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [createRule, { loading }] = useMutation(CreateCommissionRuleMutation, { refetchQueries: [{ query: CommissionRulesQuery }] });
  const [conflictError, setConflictError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { scopeType: 'default', kind: 'percentage', value: '0' },
  });
  const scopeType = form.watch('scopeType');
  const kind = form.watch('kind');

  async function onSubmit(values: z.infer<typeof schema>) {
    setConflictError(null);
    const input: any = { scopeType: values.scopeType, kind: values.kind, value: values.value };
    if (values.scopeType === 'member_service') { input.memberId = values.memberId; input.serviceId = values.serviceId; }
    else if (values.scopeType === 'service') input.serviceId = values.serviceId;
    else if (values.scopeType === 'category') input.categoryId = values.categoryId;
    else if (values.scopeType === 'product') input.productId = values.productId;

    const res = await createRule({ variables: { input } });
    const errors = res.data?.createCommissionRule.errors ?? [];
    if (errors.length) {
      if (errors[0].code === 'COMMISSION_SCOPE_CONFLICT') {
        setConflictError(errors[0].message);
        return;
      }
      if (errors[0].field) form.setError(errors[0].field as any, { message: errors[0].message });
      else setConflictError(errors[0].message);
      return;
    }
    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-md">
        <FormField control={form.control} name="scopeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.comissao.form.scopeLabel')}</FormLabel>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-sm">
                {SCOPES.map((s) => (
                  <div key={s} className="flex items-start gap-sm">
                    <RadioGroupItem value={s} id={`scope-${s}`} />
                    <div className="space-y-xs">
                      <Label htmlFor={`scope-${s}`} className="font-semibold">{t(`catalog.comissao.scope.${s}.label`)}</Label>
                      <p className="text-sm text-neutral-500">{t(`catalog.comissao.scope.${s}.helper`)}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )} />

        {/* Conditional fields per scope. Use Plan 06 picker pattern. For brevity, scope-conditional combobox/select wiring follows the same pattern as PackageServicesPicker (Popover + Command). Replace the individual fields with the appropriate picker. */}
        {scopeType === 'member_service' && (<>
          {/* Member combobox */}
          {/* Service combobox */}
        </>)}
        {scopeType === 'service' && (<>
          {/* Service combobox */}
        </>)}
        {scopeType === 'category' && (<>
          {/* Category select (flat list) */}
        </>)}
        {scopeType === 'product' && (<>
          {/* Product combobox */}
        </>)}

        <FormField control={form.control} name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.comissao.form.kindLabel')}</FormLabel>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-md">
                <div className="flex items-center gap-sm"><RadioGroupItem value="fixed" id="kind-fixed" /><Label htmlFor="kind-fixed">{t('catalog.comissao.kind.fixed')}</Label></div>
                <div className="flex items-center gap-sm"><RadioGroupItem value="percentage" id="kind-percentage" /><Label htmlFor="kind-percentage">{t('catalog.comissao.kind.percentage')}</Label></div>
              </RadioGroup>
            </FormItem>
          )} />

        <FormField control={form.control} name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{kind === 'fixed' ? t('catalog.comissao.form.valueFixedLabel') : t('catalog.comissao.form.valuePercentLabel')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={kind === 'fixed' ? 'R$ 0,00' : '0%'} inputMode="decimal" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

        {conflictError && (
          <Alert variant="destructive">
            <AlertDescription>{conflictError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('catalog.categoria.form.cancel')}</Button>
          <Button type="submit" disabled={loading}>{loading ? t('catalog.categoria.form.submitting') : t('catalog.categoria.form.submitCreate')}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
```

NOTE: The conditional comboboxes are stubbed in this plan for brevity. Executor implements them by composing `Popover + Command` per the PackageServicesPicker pattern from Task 1 (or a simpler `Select` for category since the count is small). Each conditional combobox queries the relevant list (members, services, categories, products) and binds value to the form field.

**C. Create `apps/frontend/src/pages/ComissoesPage.tsx`** with DataTable. Single "Regra" column shows resolved target:
- `member_service`: "Profissional + Serviço — {member.displayName} / {service.name}"
- `service`: "Serviço — {service.name}"
- `category`: "Categoria — {category.name}"
- `product`: "Produto — {product.name}"
- `default`: "Padrão da organização"

Other columns: Tipo (kind), Valor (formatted as R$ X,XX or X% based on kind), actions. Empty state: `Percent` icon, heading "Nenhuma regra de comissão".

**D. Append to `pt-BR.json`:**

```json
"catalog": {
  ...,
  "comissao": {
    "form": {
      "scopeLabel": "Tipo de regra",
      "kindLabel": "Tipo de comissão",
      "valueFixedLabel": "Valor",
      "valuePercentLabel": "Percentual"
    },
    "scope": {
      "member_service": { "label": "Profissional + Serviço", "helper": "Regra específica para um profissional em um serviço." },
      "service":        { "label": "Serviço",                "helper": "Aplica-se a qualquer profissional que realizar este serviço." },
      "category":       { "label": "Categoria",              "helper": "Aplica-se a todos os serviços desta categoria." },
      "product":        { "label": "Produto",                "helper": "Comissão sobre a venda deste produto." },
      "default":        { "label": "Padrão da organização",  "helper": "Aplica-se a todas as vendas sem regra específica." }
    },
    "kind": {
      "fixed": "Valor fixo (R$)",
      "percentage": "Percentual (%)"
    },
    "table": {
      "rule": "Regra",
      "kind": "Tipo",
      "value": "Valor",
      "actions": "Ações"
    },
    "empty": {
      "heading": "Nenhuma regra de comissão",
      "body": "Configure como os profissionais são remunerados.",
      "cta": "Nova regra"
    },
    "errors": {
      "scopeConflict": "Já existe uma regra para este escopo. Edite a regra existente.",
      "valueOutOfRange": "Percentual deve ser entre 0 e 100."
    }
  }
}
```

**E. Test `commission-rule-form.test.tsx`:**
1. Initial render — scope='default' selected (default radio), no scope-specific fields visible
2. Selecting scope='service' — service combobox/select appears
3. Selecting scope='member_service' — both member AND service pickers visible
4. Submitting `default + percentage + 10` calls createCommissionRule with `{ scopeType: 'default', kind: 'percentage', value: '10' }`
5. Mutation returning COMMISSION_SCOPE_CONFLICT error → renders Alert with conflict copy
6. Mutation returning VALUE_OUT_OF_RANGE → form.setError on value field
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/features/catalog/__tests__/commission-rule-form.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `comissoes.api.ts` exports 4 operations
    - `CommissionRuleForm.tsx` &gt;= 150 lines, contains `superRefine` for scope-conditional validation
    - Scope conditional fields render based on `form.watch('scopeType')`
    - `ComissoesPage.tsx` replaces placeholder; shows resolved target labels (one of 5 scope shapes)
    - Conflict error renders inline Alert with `variant="destructive"` (or "warning" if implemented)
    - 6 commission-rule-form tests pass
    - i18n key `catalog.comissao.scope.member_service.label` returns "Profissional + Serviço"
  </acceptance_criteria>
  <done>
    - Comissões page operational with full scope-first form flow
    - Conflict and validation errors surface to user inline
    - Tests prove conditional rendering and error handling
  </done>
</task>

</tasks>

<verification>
- /catalogo/pacotes shows packages list with delta indicator on "Preço do pacote" column
- /catalogo/produtos shows StockBadge on low-stock rows
- Sidebar "Produtos" item shows TriangleAlert icon when lowStockCount > 0
- /catalogo/comissoes lets user create rules across all 5 scope types
- Conflicting commission scope returns COMMISSION_SCOPE_CONFLICT inline error
</verification>

<success_criteria>
- `pnpm --filter @sgs/frontend typecheck` exits 0
- All component tests pass: pacote-price-summary (3), produto-form (5), commission-rule-form (6)
- Manual smoke covers: create package with 3 services and own price; create product with min stock and adjust to trigger low-stock badge; create commission rule for service with percentage 20%
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-frontend-pacotes-produtos-comissoes-SUMMARY.md` documenting the lowStockCount polling cadence (60s), AdjustStockDialog interaction, and the commission scope conditional field map.
</output>

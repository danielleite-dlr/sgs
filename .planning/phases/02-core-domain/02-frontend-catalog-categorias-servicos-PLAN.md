---
phase: 02-core-domain
plan: 06
type: execute
wave: 3
depends_on: [02, 03]
files_modified:
  - apps/frontend/codegen.ts
  - apps/frontend/src/features/catalog/api/categorias.api.ts
  - apps/frontend/src/features/catalog/api/servicos.api.ts
  - apps/frontend/src/features/catalog/components/CategoriaForm.tsx
  - apps/frontend/src/features/catalog/components/ServicoForm.tsx
  - apps/frontend/src/features/catalog/components/PricingVariantsEditor.tsx
  - apps/frontend/src/features/catalog/components/ConfirmSoftDeleteDialog.tsx
  - apps/frontend/src/features/catalog/components/ReorderControls.tsx
  - apps/frontend/src/pages/CategoriasPage.tsx
  - apps/frontend/src/pages/ServicosPage.tsx
  - apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  - apps/frontend/src/features/catalog/__tests__/categoria-form.test.tsx
  - apps/frontend/src/features/catalog/__tests__/servico-form.test.tsx
autonomous: true
requirements: [CAT-01]

must_haves:
  truths:
    - "User opens /catalogo/categorias and sees DataTable of categories grouped by parent (root first, indented children)"
    - "User clicks 'Nova categoria', fills name, selects optional parent, saves — row appears in list"
    - "User clicks reorder Up/Down buttons, optimistic order swap applies; on error reverts"
    - "User opens /catalogo/servicos, creates a service with name + category + base price + duration + 2 pricing variants (Júnior/Sênior)"
    - "Variant rows can be added/removed dynamically before save"
    - "Soft-delete shows AlertDialog 'Desativar X?'; on confirm row disappears and 'Desfazer' toast appears"
    - "Empty state shows correct lucide icon + heading + CTA per UI-SPEC §Empty States"
    - "All copy comes from pt-BR.json"
  artifacts:
    - path: "apps/frontend/src/features/catalog/components/PricingVariantsEditor.tsx"
      provides: "Dynamic variant list per UI-SPEC §Pricing Variants — add/remove rows, seniority select"
      min_lines: 100
    - path: "apps/frontend/src/features/catalog/components/CategoriaForm.tsx"
      provides: "Dialog form for create/edit category with parent picker"
      min_lines: 80
    - path: "apps/frontend/src/features/catalog/components/ServicoForm.tsx"
      provides: "Dialog form combining base fields + PricingVariantsEditor"
      min_lines: 120
    - path: "apps/frontend/src/pages/CategoriasPage.tsx"
      provides: "Full categories list page using DataTable + dialog flow"
      min_lines: 80
    - path: "apps/frontend/src/pages/ServicosPage.tsx"
      provides: "Full services list page (filtered by category) using DataTable + dialog flow"
      min_lines: 80
  key_links:
    - from: "CategoriasPage.tsx"
      to: "useCategoriesQuery / useCreateCategoryMutation (codegen hooks)"
      via: "Apollo Client useQuery/useMutation from generated client preset"
      pattern: "useCategoriesQuery"
    - from: "ServicoForm.tsx"
      to: "PricingVariantsEditor"
      via: "<PricingVariantsEditor value={...} onChange={...} />"
      pattern: "PricingVariantsEditor"
---

<objective>
Build the Categorias and Serviços catalog screens per UI-SPEC. Replace the placeholder pages from Plan 02 with full DataTable + Dialog CRUD flows, including the pricing variants dynamic editor (D-07). Use Apollo Client + codegen-generated hooks against the GraphQL SDL from Plan 03.

Purpose: CAT-01 phase success criterion 1 — proprietário cria categoria, adiciona serviço com preço junior/senior, visualiza catálogo hierárquico.

Output: Two complete feature screens (Categorias, Serviços) with create/edit/reorder/soft-delete flows and required reusable subcomponents.
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
@apps/frontend/src/components/layout/PageHeader.tsx
@apps/frontend/src/components/ui/data-table.tsx
@apps/frontend/src/components/ui/entity-avatar.tsx
@apps/frontend/src/pages/CategoriasPage.tsx
@apps/frontend/src/pages/ServicosPage.tsx
@apps/frontend/src/infrastructure/apollo/client.ts
@apps/frontend/codegen.ts

<interfaces>
<!-- Plan 02 layout primitives + Plan 03 GraphQL SDL -->

From Plan 02 frontend exports:
- `<PageHeader title breadcrumbs cta />`
- `<DataTable columns rows rowKey loading empty sort onSortChange page pageSize totalCount onPageChange onRowClick />`
- `<EntityAvatar name kind imageUrl />`
- shadcn primitives: Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, AlertDialog, Select, Tooltip, RadioGroup, Skeleton, Badge, Breadcrumb, DropdownMenu, Command/Popover (Combobox), Sheet

From Plan 03 GraphQL SDL (catalog.graphql):
- Query categories: [Category!]!  (returns root-only with `children` populated 1 level deep)
- Mutation createCategory(input: { name, parentId? }): CategoryPayload
- Mutation updateCategory(input: { id, name?, parentId?, displayOrder? }): CategoryPayload
- Mutation reorderCategory(input: { id, direction: UP|DOWN }): CategoryPayload
- Mutation softDeleteCategory(input: { id }): CategoryPayload
- Query services(categoryId: UUID): [Service!]!
- Mutation createService(input: { name, categoryId, basePrice, defaultDurationMinutes, pricingVariants: [{ name, durationMinutes, seniorityTier?, price }] })
- Mutation updateService(...) — replaces variants array atomically
- Mutation softDeleteService(input: { id })

Existing Apollo Client at apps/frontend/src/infrastructure/apollo/client.ts — reuse without modification. authLink already injects Authorization header.

From apps/frontend/codegen.ts (Phase 1 setup):
- client-preset output: `src/gql/`
- Schema source: backend GraphQL endpoint at codegen time
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Generate Apollo client types and create reusable subcomponents (PricingVariantsEditor, ConfirmSoftDeleteDialog, ReorderControls)</name>
  <files>
    apps/frontend/codegen.ts
    apps/frontend/src/features/catalog/api/categorias.api.ts
    apps/frontend/src/features/catalog/api/servicos.api.ts
    apps/frontend/src/features/catalog/components/PricingVariantsEditor.tsx
    apps/frontend/src/features/catalog/components/ConfirmSoftDeleteDialog.tsx
    apps/frontend/src/features/catalog/components/ReorderControls.tsx
    apps/frontend/src/infrastructure/i18n/locales/pt-BR.json
  </files>
  <read_first>
    - apps/frontend/codegen.ts (existing config)
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Pricing Variants, §Soft-Delete Confirmation, §Form Pattern, §Reorder, §Form Field Labels — copy strings VERBATIM
    - apps/frontend/src/components/ui/dialog.tsx, alert-dialog.tsx, select.tsx (Plan 02 — to know exact import shape)
    - apps/frontend/src/features/auth/api/auth.api.ts (Phase 1 manual gql tag pattern as fallback)
  </read_first>
  <action>
**A. Run codegen** to refresh types from updated backend schema:
```bash
cd apps/frontend && pnpm codegen
```
This reads from the running backend (or schema file) and outputs `src/gql/graphql.ts`. If the codegen.ts pulls from a live backend, ensure backend dev server is running on the codegen step (or use schema introspection JSON).

If `codegen.ts` was set up with `documents: 'src/**/*.{ts,tsx}'`, the gql tags in our `.api.ts` files will be auto-detected. Verify with `cat apps/frontend/codegen.ts`.

**B. Create `apps/frontend/src/features/catalog/api/categorias.api.ts`** with `gql` queries/mutations using the codegen client preset:

```ts
import { graphql } from '@/gql';

export const CategoriesQuery = graphql(`
  query Categories {
    categories {
      id
      name
      parentId
      displayOrder
      coverImageUrl
      children {
        id
        name
        parentId
        displayOrder
        coverImageUrl
      }
    }
  }
`);

export const CreateCategoryMutation = graphql(`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      category { id name parentId displayOrder }
      errors { code message field }
    }
  }
`);

export const UpdateCategoryMutation = graphql(`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      category { id name parentId displayOrder }
      errors { code message field }
    }
  }
`);

export const ReorderCategoryMutation = graphql(`
  mutation ReorderCategory($input: ReorderCategoryInput!) {
    reorderCategory(input: $input) {
      category { id displayOrder }
      errors { code message field }
    }
  }
`);

export const SoftDeleteCategoryMutation = graphql(`
  mutation SoftDeleteCategory($input: SoftDeleteInput!) {
    softDeleteCategory(input: $input) {
      category { id }
      errors { code message field }
    }
  }
`);
```

**C. Create `apps/frontend/src/features/catalog/api/servicos.api.ts`** with parallel queries/mutations: `Services($categoryId: UUID)`, `CreateService`, `UpdateService`, `SoftDeleteService`. Include `pricingVariants { id name durationMinutes seniorityTier price displayOrder }` in fragments.

**D. Create `apps/frontend/src/features/catalog/components/PricingVariantsEditor.tsx`** per UI-SPEC §Pricing Variants:

```tsx
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export interface PricingVariantValue {
  name: string;
  durationMinutes: number;
  seniorityTier?: 'junior' | 'pleno' | 'senior' | null;
  price: string;
}

export function PricingVariantsEditor({ name = 'pricingVariants' }: { name?: string }) {
  const { t } = useTranslation();
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <section className="space-y-md">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('catalog.pricingVariants.title')}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => append({ name: '', durationMinutes: 60, seniorityTier: null, price: '0.00' })}
        >
          <Plus className="mr-xs h-4 w-4" />
          {t('catalog.pricingVariants.add')}
        </Button>
      </header>
      {fields.length === 0 && (
        <p className="text-sm text-neutral-500">{t('catalog.pricingVariants.emptyHint')}</p>
      )}
      <div className="space-y-md">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-sm items-start">
            <FormField
              control={control}
              name={`${name}.${index}.name`}
              render={({ field: f }) => (
                <FormItem className="col-span-4">
                  <FormLabel className="text-label">{t('catalog.pricingVariants.fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...f} placeholder={t('catalog.pricingVariants.fields.namePlaceholder')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${index}.durationMinutes`}
              render={({ field: f }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-label">{t('catalog.pricingVariants.fields.duration')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...f}
                      onChange={(e) => f.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${index}.seniorityTier`}
              render={({ field: f }) => (
                <FormItem className="col-span-3">
                  <FormLabel className="text-label">{t('catalog.pricingVariants.fields.seniority')}</FormLabel>
                  <Select onValueChange={(v) => f.onChange(v === 'none' ? null : v)} value={f.value ?? 'none'}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('catalog.seniority.none')}</SelectItem>
                      <SelectItem value="junior">{t('catalog.seniority.junior')}</SelectItem>
                      <SelectItem value="pleno">{t('catalog.seniority.pleno')}</SelectItem>
                      <SelectItem value="senior">{t('catalog.seniority.senior')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${index}.price`}
              render={({ field: f }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-label">{t('catalog.pricingVariants.fields.price')}</FormLabel>
                  <FormControl>
                    <Input {...f} placeholder="R$ 0,00" inputMode="decimal" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-1 flex items-end justify-center pt-[26px]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('catalog.pricingVariants.remove', { name: (field as any).name || `variante ${index + 1}` })}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-error-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**E. Create `apps/frontend/src/features/catalog/components/ConfirmSoftDeleteDialog.tsx`** per UI-SPEC §Soft-Delete Confirmation:

```tsx
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
         AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
         AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ConfirmSoftDeleteDialog({
  trigger, entityName, entityKind, onConfirm,
}: {
  trigger: ReactNode;
  entityName: string;
  entityKind: 'category' | 'service' | 'package' | 'product' | 'commission' | 'client';
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isClient = entityKind === 'client';
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isClient
              ? t('catalog.softDelete.client.title', { name: entityName })
              : t('catalog.softDelete.title', { name: entityName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isClient ? t('catalog.softDelete.client.body', { name: entityName })
                      : t('catalog.softDelete.body', { name: entityName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('catalog.softDelete.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => onConfirm()}
          >
            {isClient ? t('catalog.softDelete.client.confirm') : t('catalog.softDelete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**F. Create `apps/frontend/src/features/catalog/components/ReorderControls.tsx`** per UI-SPEC §Reorder:

```tsx
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function ReorderControls({
  itemName, isFirst, isLast, onMove,
}: {
  itemName: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: 'UP' | 'DOWN') => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex">
      <Button type="button" variant="ghost" size="icon"
        aria-label={t('catalog.reorder.up', { name: itemName })}
        disabled={isFirst}
        onClick={() => onMove('UP')}>
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon"
        aria-label={t('catalog.reorder.down', { name: itemName })}
        disabled={isLast}
        onClick={() => onMove('DOWN')}>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**G. Extend `apps/frontend/src/infrastructure/i18n/locales/pt-BR.json`** by appending a `catalog` namespace (preserve existing keys):

```json
"catalog": {
  "softDelete": {
    "title": "Desativar {{name}}?",
    "body": "{{name}} ficará inativo e não aparecerá em novos agendamentos. O histórico e os relatórios serão preservados.",
    "cancel": "Cancelar",
    "confirm": "Desativar",
    "client": {
      "title": "Desativar {{name}}?",
      "body": "{{name}} ficará inativo. Agendamentos e histórico existentes serão preservados.",
      "confirm": "Desativar cliente"
    },
    "toastDeleted": "{{name}} desativado.",
    "toastUndo": "Desfazer",
    "toastRestored": "{{name}} reativado."
  },
  "reorder": {
    "up": "Mover {{name}} para cima",
    "down": "Mover {{name}} para baixo"
  },
  "seniority": {
    "none": "Nenhum",
    "junior": "Júnior",
    "pleno": "Pleno",
    "senior": "Sênior"
  },
  "pricingVariants": {
    "title": "Variantes de preço",
    "add": "Adicionar variante",
    "remove": "Remover variante {{name}}",
    "emptyHint": "O preço base será aplicado quando não há variantes.",
    "fields": {
      "name": "Nome da variante",
      "namePlaceholder": "Ex.: Júnior 30min, Sênior 60min",
      "duration": "Duração",
      "seniority": "Senioridade",
      "price": "Preço"
    }
  },
  "categoria": {
    "form": {
      "nameLabel": "Nome da categoria",
      "namePlaceholder": "Ex.: Cabelo, Estética, Noivas",
      "parentLabel": "Categoria principal",
      "parentPlaceholder": "Selecione ou deixe em branco para categoria raiz",
      "submitCreate": "Salvar",
      "submitEdit": "Salvar alterações",
      "submitting": "Salvando…",
      "cancel": "Cancelar"
    },
    "table": {
      "name": "Nome",
      "parent": "Categoria principal",
      "actions": "Ações"
    },
    "empty": {
      "heading": "Nenhuma categoria ainda",
      "body": "Organize seus serviços criando categorias.",
      "cta": "Nova categoria"
    },
    "errors": {
      "depth": "Uma subcategoria não pode ter subcategorias.",
      "hasChildren": "Remova as subcategorias antes.",
      "hasServices": "Mova ou desative os serviços desta categoria primeiro.",
      "generic": "Não foi possível salvar. Tente novamente."
    }
  },
  "servico": {
    "form": {
      "nameLabel": "Nome do serviço",
      "namePlaceholder": "Ex.: Corte feminino, Hidratação",
      "categoryLabel": "Categoria",
      "categoryPlaceholder": "Selecione uma categoria",
      "basePriceLabel": "Preço base",
      "basePricePlaceholder": "R$ 0,00",
      "durationLabel": "Duração padrão",
      "durationPlaceholder": "Ex.: 60",
      "durationSuffix": "min"
    },
    "table": {
      "name": "Nome",
      "category": "Categoria",
      "basePrice": "Preço base",
      "duration": "Duração",
      "variants": "Variantes",
      "actions": "Ações"
    },
    "empty": {
      "heading": "Nenhum serviço ainda",
      "body": "Adicione os serviços que seu salão oferece.",
      "cta": "Novo serviço"
    },
    "errors": {
      "categoryNotFound": "Categoria não encontrada.",
      "inPackage": "Remova este serviço dos pacotes antes de desativar.",
      "generic": "Não foi possível salvar. Tente novamente."
    }
  },
  "validation": {
    "required": "Este campo é obrigatório.",
    "nameTooShort": "Digite um nome válido.",
    "priceInvalid": "O preço deve ser maior que zero.",
    "durationInvalid": "A duração deve ser maior que zero."
  }
}
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm codegen &amp;&amp; pnpm typecheck &amp;&amp; ls src/gql/graphql.ts &amp;&amp; grep -q "categories" src/gql/graphql.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm codegen` exits 0; `src/gql/graphql.ts` contains type `CategoriesQuery`, `CreateCategoryInput`, `Category`, `Service`, `CreateServiceInput`, `PricingVariantInput`
    - `categorias.api.ts` and `servicos.api.ts` use `graphql(...)` tagged template (codegen client-preset, not manual `gql`)
    - `PricingVariantsEditor.tsx` &gt;= 100 lines, uses `useFieldArray` from react-hook-form
    - `ConfirmSoftDeleteDialog.tsx` exports component using `AlertDialog` primitive
    - `ReorderControls.tsx` exports component with disabled-at-edges Up/Down buttons
    - `pt-BR.json` extended with `catalog.*` namespace; jq lookup on `.catalog.pricingVariants.title` returns "Variantes de preço"
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    - codegen produces typed Apollo hooks for Categorias + Serviços
    - 3 reusable subcomponents exist: PricingVariantsEditor, ConfirmSoftDeleteDialog, ReorderControls
    - i18n catalog namespace populated with all required strings from UI-SPEC
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: CategoriasPage with Dialog form, reorder, soft-delete + form integration test</name>
  <files>
    apps/frontend/src/features/catalog/components/CategoriaForm.tsx
    apps/frontend/src/pages/CategoriasPage.tsx
    apps/frontend/src/features/catalog/__tests__/categoria-form.test.tsx
  </files>
  <read_first>
    - apps/frontend/src/features/catalog/api/categorias.api.ts (Task 1 output — operations to call)
    - apps/frontend/src/components/ui/data-table.tsx (column shape)
    - .planning/phases/02-core-domain/02-UI-SPEC.md §List Page Pattern, §Form Pattern, §Empty States, §Reorder
    - apps/frontend/src/features/auth/pages/SignupPage.tsx (form + react-hook-form + zod precedent from Phase 1)
  </read_first>
  <behavior>
    - CategoriasPage renders PageHeader (title + "Nova categoria" CTA), DataTable with columns: avatar/name, parent name, displayOrder reorder controls, actions DropdownMenu
    - Clicking "Nova categoria" opens Dialog with CategoriaForm
    - Empty state per UI-SPEC: Folder icon 48px, heading "Nenhuma categoria ainda", body "Organize seus serviços criando categorias.", CTA "Nova categoria"
    - Categories displayed flat with parent column (root parents have empty parent cell, children show their parent's name)
    - Reorder buttons: optimistic update via Apollo cache write, on error revert + toast
    - Soft-delete via DropdownMenu → ConfirmSoftDeleteDialog → mutation → toast with Undo (5s window)
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/catalog/components/CategoriaForm.tsx`:**

```tsx
import { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DialogFooter } from '@/components/ui/dialog';
import { CategoriesQuery, CreateCategoryMutation, UpdateCategoryMutation } from '../api/categorias.api';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2),
  parentId: z.string().optional(),
});

export function CategoriaForm({
  initial, onClose,
}: {
  initial?: { id: string; name: string; parentId?: string | null };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useQuery(CategoriesQuery);
  const isEdit = !!initial;
  const [createCat, { loading: creating }] = useMutation(CreateCategoryMutation, {
    refetchQueries: [{ query: CategoriesQuery }],
  });
  const [updateCat, { loading: updating }] = useMutation(UpdateCategoryMutation, {
    refetchQueries: [{ query: CategoriesQuery }],
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? '', parentId: initial?.parentId ?? '' },
  });

  // Filter out current category and its descendants from parent options to prevent cycles
  const rootCategories = (data?.categories ?? []).filter((c) => c.id !== initial?.id);

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      if (isEdit && initial) {
        const res = await updateCat({
          variables: {
            input: { id: initial.id, name: values.name, parentId: values.parentId || null },
          },
        });
        const errors = res.data?.updateCategory.errors ?? [];
        if (errors.length) {
          form.setError(errors[0].field as any || 'name', { message: errors[0].message });
          return;
        }
        toast.success(t('common.savedChanges') ?? 'Alterações salvas.');
      } else {
        const res = await createCat({
          variables: {
            input: { name: values.name, parentId: values.parentId || undefined },
          },
        });
        const errors = res.data?.createCategory.errors ?? [];
        if (errors.length) {
          form.setError(errors[0].field as any || 'name', { message: errors[0].message });
          return;
        }
        toast.success(t('catalog.toasts.categoryCreated', { name: values.name }) ?? `${values.name} criado com sucesso.`);
      }
      onClose();
    } catch (e) {
      toast.error(t('catalog.categoria.errors.generic'));
    }
  }

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-md">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.categoria.form.nameLabel')} *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('catalog.categoria.form.namePlaceholder')} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.categoria.form.parentLabel')}</FormLabel>
                <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('catalog.categoria.form.parentPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">{t('catalog.categoria.form.parentPlaceholder')}</SelectItem>
                    {rootCategories.filter((c) => c.parentId === null).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('catalog.categoria.form.cancel')}
            </Button>
            <Button type="submit" disabled={creating || updating}>
              {creating || updating
                ? t('catalog.categoria.form.submitting')
                : isEdit
                  ? t('catalog.categoria.form.submitEdit')
                  : t('catalog.categoria.form.submitCreate')}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </FormProvider>
  );
}
```

**B. Replace `apps/frontend/src/pages/CategoriasPage.tsx`** (was placeholder from Plan 02):

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { Folder, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CategoriesQuery, ReorderCategoryMutation, SoftDeleteCategoryMutation } from '@/features/catalog/api/categorias.api';
import { CategoriaForm } from '@/features/catalog/components/CategoriaForm';
import { ConfirmSoftDeleteDialog } from '@/features/catalog/components/ConfirmSoftDeleteDialog';
import { ReorderControls } from '@/features/catalog/components/ReorderControls';
import { toast } from 'sonner';

interface FlatCategory {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  displayOrder: number;
  coverImageUrl: string | null;
  isFirst: boolean;
  isLast: boolean;
}

export function CategoriasPage() {
  const { t } = useTranslation();
  const { data, loading } = useQuery(CategoriesQuery);
  const [reorder] = useMutation(ReorderCategoryMutation, { refetchQueries: [{ query: CategoriesQuery }] });
  const [softDelete] = useMutation(SoftDeleteCategoryMutation, { refetchQueries: [{ query: CategoriesQuery }] });
  const [dialog, setDialog] = useState<{ open: boolean; initial?: FlatCategory } | null>(null);

  useEffect(() => { document.title = t('pages.categorias.tab'); }, [t]);

  const flat = useMemo<FlatCategory[]>(() => {
    if (!data?.categories) return [];
    const items: FlatCategory[] = [];
    const sortedRoots = [...data.categories].filter((c) => c.parentId === null)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    for (const root of sortedRoots) {
      items.push({
        id: root.id, name: root.name, parentId: null, parentName: null,
        displayOrder: root.displayOrder, coverImageUrl: root.coverImageUrl ?? null,
        isFirst: false, isLast: false,
      });
      const children = (root.children ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
      children.forEach((c) =>
        items.push({
          id: c.id, name: c.name, parentId: root.id, parentName: root.name,
          displayOrder: c.displayOrder, coverImageUrl: c.coverImageUrl ?? null,
          isFirst: false, isLast: false,
        }),
      );
    }
    // mark first/last per parent group
    const groups: Record<string, FlatCategory[]> = {};
    items.forEach((it) => {
      const key = it.parentId ?? '__root__';
      (groups[key] ??= []).push(it);
    });
    Object.values(groups).forEach((g) => {
      g.forEach((it, i) => { it.isFirst = i === 0; it.isLast = i === g.length - 1; });
    });
    return items;
  }, [data]);

  async function handleReorder(c: FlatCategory, dir: 'UP' | 'DOWN') {
    const res = await reorder({ variables: { input: { id: c.id, direction: dir } } });
    if (res.data?.reorderCategory.errors?.length) {
      toast.error(res.data.reorderCategory.errors[0].message);
    }
  }

  async function handleDelete(c: FlatCategory) {
    const res = await softDelete({ variables: { input: { id: c.id } } });
    const errors = res.data?.softDeleteCategory.errors ?? [];
    if (errors.length) { toast.error(errors[0].message); return; }
    toast.success(t('catalog.softDelete.toastDeleted', { name: c.name }));
  }

  return (
    <>
      <PageHeader
        title={t('pages.categorias.h1')}
        breadcrumbs={[{ label: t('navigation.catalog') }, { label: t('pages.categorias.h1') }]}
        cta={<Button onClick={() => setDialog({ open: true })}>{t('pages.categorias.newCta')}</Button>}
      />
      <DataTable<FlatCategory>
        rowKey={(r) => r.id}
        loading={loading}
        rows={flat}
        empty={
          <EmptyState
            icon={<Folder className="h-12 w-12 text-neutral-500" />}
            heading={t('catalog.categoria.empty.heading')}
            body={t('catalog.categoria.empty.body')}
            cta={<Button onClick={() => setDialog({ open: true })}>{t('catalog.categoria.empty.cta')}</Button>}
          />
        }
        columns={[
          {
            key: 'name', header: t('catalog.categoria.table.name'),
            cell: (r) => (
              <div className="flex items-center gap-sm">
                <EntityAvatar name={r.name} kind="category" imageUrl={r.coverImageUrl} />
                <div>
                  <div className="font-semibold">{r.name}</div>
                </div>
              </div>
            ),
          },
          { key: 'parent', header: t('catalog.categoria.table.parent'),
            cell: (r) => r.parentName ?? '—' },
          {
            key: 'order', header: '',
            cell: (r) => (
              <ReorderControls itemName={r.name} isFirst={r.isFirst} isLast={r.isLast}
                onMove={(dir) => handleReorder(r, dir)} />
            ),
          },
          {
            key: 'actions', header: t('catalog.categoria.table.actions'),
            cell: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setDialog({ open: true, initial: r })}>
                    <Pencil className="mr-sm h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <ConfirmSoftDeleteDialog
                    entityName={r.name}
                    entityKind="category"
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
      <Dialog open={dialog?.open ?? false} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{dialog?.initial ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          {dialog?.open && (
            <CategoriaForm
              initial={dialog.initial}
              onClose={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
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

**C. Add component test `apps/frontend/src/features/catalog/__tests__/categoria-form.test.tsx`:**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { Toaster } from '@/components/ui/sonner';
import '@/infrastructure/i18n/i18n';
import { CategoriaForm } from '../components/CategoriaForm';
import { CategoriesQuery, CreateCategoryMutation } from '../api/categorias.api';

const baseMocks = [
  { request: { query: CategoriesQuery }, result: { data: { categories: [] } } },
];

describe('CategoriaForm', () => {
  it('shows required field error on empty name', async () => {
    render(
      <MockedProvider mocks={baseMocks}><Toaster /><CategoriaForm onClose={() => {}} /></MockedProvider>,
    );
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => {
      // Zod min(2) message — react-hook-form with zod surfaces "String must contain at least 2..."
      // In production we map zod issues to pt-BR; here just ensure submit didn't proceed.
      expect(screen.queryByText('Salvando…')).toBeNull();
    });
  });

  it('submits createCategory mutation with name', async () => {
    let called = false;
    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CreateCategoryMutation,
          variables: { input: { name: 'Cabelo' } },
        },
        result: () => {
          called = true;
          return { data: { createCategory: { category: { id: 'x', name: 'Cabelo', parentId: null, displayOrder: 0 }, errors: [] } } };
        },
      },
      { request: { query: CategoriesQuery }, result: { data: { categories: [{ id: 'x', name: 'Cabelo', parentId: null, displayOrder: 0, coverImageUrl: null, children: [] }] } } },
    ];
    render(<MockedProvider mocks={mocks}><Toaster /><CategoriaForm onClose={() => {}} /></MockedProvider>);
    fireEvent.change(screen.getByPlaceholderText(/Cabelo/i), { target: { value: 'Cabelo' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(called).toBe(true));
  });
});
```
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/features/catalog/__tests__/categoria-form.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `CategoriaForm.tsx` &gt;= 80 lines, uses `useFormContext` indirectly via FormProvider + zodResolver schema
    - `CategoriasPage.tsx` &gt;= 80 lines, replaces "Em breve" placeholder
    - Page renders empty state with `Folder` icon and "Nenhuma categoria ainda" heading when categories array is empty
    - Form test passes 2 cases (validation rejection + successful create)
    - Reorder controls use `aria-label={t('catalog.reorder.up', { name: r.name })}` (verify with grep)
    - Soft-delete via DropdownMenu triggers AlertDialog with title "Desativar X?"
  </acceptance_criteria>
  <done>
    - Categorias page operational with create/edit/reorder/soft-delete flows
    - All copy from i18n, zero hardcoded strings (except dialog title fallback)
    - Tests prove form validation + mutation submission
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: ServicosPage with PricingVariantsEditor integration + form test</name>
  <files>
    apps/frontend/src/features/catalog/components/ServicoForm.tsx
    apps/frontend/src/pages/ServicosPage.tsx
    apps/frontend/src/features/catalog/__tests__/servico-form.test.tsx
  </files>
  <read_first>
    - apps/frontend/src/features/catalog/components/CategoriaForm.tsx (Task 2 — pattern reference)
    - apps/frontend/src/features/catalog/components/PricingVariantsEditor.tsx (Task 1 — embed in service form)
    - apps/frontend/src/features/catalog/api/servicos.api.ts (Task 1 — operations)
    - .planning/phases/02-core-domain/02-UI-SPEC.md §Form Field Labels Services, §Pricing Variants
  </read_first>
  <behavior>
    - ServicoForm fields: name, category combobox/select, basePrice, defaultDurationMinutes, then PricingVariantsEditor for variants array
    - On submit: validate, call createService or updateService with full pricingVariants array
    - On error.code === 'CATEGORY_NOT_FOUND' → set form error on categoryId field
    - On error.code === 'SERVICE_IN_PACKAGE' (delete only) → toast error
    - ServicosPage shows DataTable with columns: avatar+name, category name, basePrice (formatted BRL), duration "60 min", variants count badge, actions
    - Filter dropdown by category at top of list (optional, MVP)
    - Empty state per UI-SPEC
  </behavior>
  <action>
**A. Create `apps/frontend/src/features/catalog/components/ServicoForm.tsx`:**

```tsx
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { CategoriesQuery } from '../api/categorias.api';
import { CreateServiceMutation, ServicesQuery, UpdateServiceMutation } from '../api/servicos.api';
import { PricingVariantsEditor } from './PricingVariantsEditor';
import { toast } from 'sonner';

const variantSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.coerce.number().int().positive(),
  seniorityTier: z.union([z.literal('junior'), z.literal('pleno'), z.literal('senior'), z.null()]).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
});
const schema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  defaultDurationMinutes: z.coerce.number().int().positive(),
  pricingVariants: z.array(variantSchema).default([]),
});

export function ServicoForm({ initial, onClose }: {
  initial?: { id: string; name: string; categoryId: string; basePrice: string; defaultDurationMinutes: number;
              pricingVariants: Array<{ name: string; durationMinutes: number; seniorityTier?: string | null; price: string; }> };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: catData } = useQuery(CategoriesQuery);
  const [createSvc, { loading: creating }] = useMutation(CreateServiceMutation, {
    refetchQueries: [{ query: ServicesQuery }],
  });
  const [updateSvc, { loading: updating }] = useMutation(UpdateServiceMutation, {
    refetchQueries: [{ query: ServicesQuery }],
  });

  const isEdit = !!initial;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? {
      name: '', categoryId: '', basePrice: '0.00',
      defaultDurationMinutes: 60, pricingVariants: [],
    },
  });

  // Flatten root + children for the category select
  const allCategories = (catData?.categories ?? []).flatMap((root: any) =>
    [{ id: root.id, name: root.name, isChild: false },
     ...((root.children ?? []).map((c: any) => ({ id: c.id, name: `${root.name} > ${c.name}`, isChild: true })))],
  );

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const payload = {
        name: values.name,
        categoryId: values.categoryId,
        basePrice: values.basePrice,
        defaultDurationMinutes: values.defaultDurationMinutes,
        pricingVariants: values.pricingVariants.map((v) => ({
          name: v.name,
          durationMinutes: v.durationMinutes,
          seniorityTier: v.seniorityTier ?? null,
          price: v.price,
        })),
      };
      const res = isEdit && initial
        ? await updateSvc({ variables: { input: { id: initial.id, ...payload } } })
        : await createSvc({ variables: { input: payload } });
      const data: any = isEdit ? res.data?.updateService : res.data?.createService;
      const errors = data?.errors ?? [];
      if (errors.length) {
        const e = errors[0];
        form.setError(e.field as any || 'name', { message: e.message });
        return;
      }
      toast.success(isEdit ? 'Alterações salvas.' : `${values.name} criado com sucesso.`);
      onClose();
    } catch {
      toast.error(t('catalog.servico.errors.generic'));
    }
  }

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-md">
          <FormField control={form.control} name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.servico.form.nameLabel')} *</FormLabel>
                <FormControl><Input {...field} placeholder={t('catalog.servico.form.namePlaceholder')} autoFocus /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          <FormField control={form.control} name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.servico.form.categoryLabel')} *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder={t('catalog.servico.form.categoryPlaceholder')} /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allCategories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          <div className="grid grid-cols-2 gap-md">
            <FormField control={form.control} name="basePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.servico.form.basePriceLabel')} *</FormLabel>
                  <FormControl><Input {...field} placeholder="R$ 0,00" inputMode="decimal" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            <FormField control={form.control} name="defaultDurationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.servico.form.durationLabel')} *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <Separator className="my-2xl" />
          <PricingVariantsEditor name="pricingVariants" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('catalog.categoria.form.cancel')}</Button>
            <Button type="submit" disabled={creating || updating}>
              {creating || updating ? t('catalog.categoria.form.submitting') : isEdit ? t('catalog.categoria.form.submitEdit') : t('catalog.categoria.form.submitCreate')}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </FormProvider>
  );
}
```

**B. Replace `apps/frontend/src/pages/ServicosPage.tsx`** with full implementation following CategoriasPage pattern:
- Query: `ServicesQuery` (no categoryId filter for now, optional dropdown can be added later)
- Columns: avatar+name, category name, basePrice (formatted as `R$ X,XX` using `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`), duration "X min", `<Badge>{variants.length}</Badge>`, actions DropdownMenu with edit/delete
- Empty state: `Scissors` icon, heading "Nenhum serviço ainda"
- Dialog opens ServicoForm

For brevity in this plan, executor may follow exact CategoriasPage layout; key difference is the columns and the Service-specific empty/dialog wiring.

**C. Add component test `apps/frontend/src/features/catalog/__tests__/servico-form.test.tsx`:**
1. Mount ServicoForm in a Dialog, verify all base fields render with correct labels (Nome do serviço, Categoria, Preço base, Duração padrão)
2. Click "Adicionar variante" → a variant row appears with empty Nome/Duração/Senioridade/Preço fields
3. Click second time → second variant row appears
4. Click trash icon on first variant → only second variant remains
5. Submit with no variants → mutation called with `pricingVariants: []`
6. Submit with 1 variant `{ name: 'Júnior', durationMinutes: 30, seniorityTier: 'junior', price: '50.00' }` → mutation called with that variant in array
  </action>
  <verify>
    <automated>cd apps/frontend &amp;&amp; pnpm typecheck &amp;&amp; pnpm test -- src/features/catalog/__tests__/servico-form.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `ServicoForm.tsx` &gt;= 120 lines, embeds `<PricingVariantsEditor />`
    - Category select shows hierarchical labels like "Cabelo > Corte" for child categories
    - `ServicosPage.tsx` &gt;= 80 lines, replaces "Em breve" placeholder, includes Scissors empty state icon
    - basePrice column formats as Brazilian currency (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`)
    - servico-form.test.tsx passes 6 tests including variant add/remove and mutation call assertions
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    - Servicos page operational with create/edit (including pricing variants) + soft-delete
    - PricingVariantsEditor integrated successfully in form
    - Tests prove dynamic variant array handling and mutation payload shape
  </done>
</task>

</tasks>

<verification>
- /catalogo/categorias renders DataTable with categories grouped by parent
- /catalogo/servicos renders DataTable with services and lets user create with junior/senior pricing variants
- All copy comes from pt-BR.json (zero hardcoded user-facing text)
- Reorder buttons disabled at extremes; clicks call reorderCategory mutation
- Soft-delete shows AlertDialog with correct copy from UI-SPEC
- Empty states show correct lucide icons + headings + body + CTAs
</verification>

<success_criteria>
- `pnpm --filter @sgs/frontend typecheck` exits 0
- `pnpm --filter @sgs/frontend test` passes all new specs (categoria-form, servico-form)
- Manual smoke `pnpm dev` allows: create category "Cabelo", create child "Coloração", create service "Corte" in Cabelo with 2 variants (Júnior 30min R$50 / Sênior 60min R$80), reorder categories, soft-delete a service
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-domain/02-frontend-catalog-categorias-servicos-SUMMARY.md` listing exported components, codegen output location, and any deviations from UI-SPEC for the next plan to inherit.
</output>

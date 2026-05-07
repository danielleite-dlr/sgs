import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreateCommissionRuleMutation, CommissionRulesQuery } from '../api/comissoes.api';
import { MembersQuery } from '../api/members.api';
import { ServicesQuery } from '../api/servicos.api';
import { CategoriesQuery } from '../api/categorias.api';
import { ProductsQuery } from '../api/produtos.api';
import { EntityCombobox } from './EntityCombobox';
import {
  maskCurrency,
  unmaskCurrency,
  maskPercentage,
  unmaskPercentage,
} from '../utils/currency-mask';

// ---- Schema ----------------------------------------------------------------

const SCOPES = ['member_service', 'service', 'category', 'product', 'default'] as const;
const KINDS = ['fixed', 'percentage'] as const;

const schema = z
  .object({
    scopeType: z.enum(SCOPES),
    memberId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    kind: z.enum(KINDS),
    value: z
      .string()
      .min(1, 'Informe o valor.')
      .refine(
        (v) => {
          // Accept both BR ("20,00") and US ("20.00") format
          const n = Number(v.replace(/[.\s%]/g, '').replace(',', '.'));
          return !Number.isNaN(n) && n > 0;
        },
        { message: 'Informe um valor maior que zero.' },
      ),
  })
  .superRefine((d, ctx) => {
    if (d.scopeType === 'member_service') {
      if (!d.memberId)
        ctx.addIssue({
          code: 'custom',
          path: ['memberId'],
          message: 'Selecione um profissional.',
        });
      if (!d.serviceId)
        ctx.addIssue({
          code: 'custom',
          path: ['serviceId'],
          message: 'Selecione um serviço.',
        });
    }
    if (d.scopeType === 'service' && !d.serviceId)
      ctx.addIssue({
        code: 'custom',
        path: ['serviceId'],
        message: 'Selecione um serviço.',
      });
    if (d.scopeType === 'category' && !d.categoryId)
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Selecione uma categoria.',
      });
    if (d.scopeType === 'product' && !d.productId)
      ctx.addIssue({
        code: 'custom',
        path: ['productId'],
        message: 'Selecione um produto.',
      });
  });

type FormValues = z.infer<typeof schema>;

// ---- Component -------------------------------------------------------------

export interface CommissionRuleFormProps {
  onClose: () => void;
  /** Pre-fill scope when opened from a service/product context (e.g., shortcut button on ServicoForm). */
  prefilledScope?: {
    scopeType: 'service' | 'product' | 'category' | 'member_service';
    serviceId?: string;
    productId?: string;
    categoryId?: string;
    memberId?: string;
  };
}

export function CommissionRuleForm({ onClose, prefilledScope }: CommissionRuleFormProps) {
  const { t } = useTranslation();
  const [createRule, { loading }] = useMutation(CreateCommissionRuleMutation, {
    refetchQueries: [{ query: CommissionRulesQuery }],
  });
  const [conflictError, setConflictError] = useState<string | null>(null);

  // ---- Lazy-load each picker source (Apollo dedupes if already cached) ----
  const { data: membersData, loading: membersLoading } = useQuery(MembersQuery);
  const { data: servicesData, loading: servicesLoading } = useQuery(ServicesQuery);
  const { data: categoriesData, loading: categoriesLoading } = useQuery(CategoriesQuery);
  const { data: productsData, loading: productsLoading } = useQuery(ProductsQuery, {
    variables: { lowStockOnly: false },
  });

  // ---- Map query results to EntityCombobox items ----
  const memberItems = (membersData?.members ?? []).map((m: { id: string; displayName: string; roleName: string }) => ({
    id: m.id,
    label: m.displayName,
    sublabel: m.roleName,
  }));

  const serviceItems = (servicesData?.services ?? []).map((s: { id: string; name: string }) => ({
    id: s.id,
    label: s.name,
  }));

  // Flatten root categories + indented children for the Select component
  const categoryFlatItems = (categoriesData?.categories ?? []).flatMap(
    (root: { id: string; name: string; children?: Array<{ id: string; name: string }> }) => [
      { id: root.id, name: root.name, isChild: false },
      ...((root.children ?? []).map((c) => ({ id: c.id, name: c.name, isChild: true }))),
    ],
  );

  const productItems = (productsData?.products ?? []).map((p: { id: string; name: string; sku: string }) => ({
    id: p.id,
    label: p.name,
    sublabel: p.sku,
  }));

  // ---- Form setup ----
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: prefilledScope
      ? {
          scopeType: prefilledScope.scopeType,
          memberId: prefilledScope.memberId,
          serviceId: prefilledScope.serviceId,
          categoryId: prefilledScope.categoryId,
          productId: prefilledScope.productId,
          kind: 'percentage',
          value: '',
        }
      : { scopeType: 'default', kind: 'percentage', value: '' },
  });

  const scopeType = form.watch('scopeType');
  const kind = form.watch('kind');

  // Reset scope-specific fields when scope changes to avoid leaking stale ids on submit
  function onScopeChange(next: FormValues['scopeType']) {
    form.setValue('scopeType', next);
    form.setValue('memberId', undefined);
    form.setValue('serviceId', undefined);
    form.setValue('categoryId', undefined);
    form.setValue('productId', undefined);
    setConflictError(null);
  }

  // ---- Submit handler ----
  async function onSubmit(values: FormValues) {
    setConflictError(null);

    const input: Record<string, unknown> = {
      scopeType: values.scopeType,
      kind: values.kind,
      value: values.kind === 'fixed' ? unmaskCurrency(values.value) : unmaskPercentage(values.value),
    };

    if (values.scopeType === 'member_service') {
      input.memberId = values.memberId;
      input.serviceId = values.serviceId;
    } else if (values.scopeType === 'service') {
      input.serviceId = values.serviceId;
    } else if (values.scopeType === 'category') {
      input.categoryId = values.categoryId;
    } else if (values.scopeType === 'product') {
      input.productId = values.productId;
    }

    try {
      const res = await createRule({ variables: { input } });
      const errors =
        (res.data as { createCommissionRule: { errors: Array<{ code: string; message: string; field?: string }> } })
          ?.createCommissionRule?.errors ?? [];

      if (errors.length) {
        if (errors[0].code === 'COMMISSION_SCOPE_CONFLICT') {
          setConflictError(t('catalog.comissao.errors.scopeConflict'));
          return;
        }
        if (errors[0].code === 'VALUE_OUT_OF_RANGE') {
          form.setError('value', {
            message: t('catalog.comissao.errors.valueOutOfRange'),
          });
          return;
        }
        if (errors[0].field) {
          form.setError(errors[0].field as keyof FormValues, { message: errors[0].message });
        } else {
          setConflictError(errors[0].message);
        }
        return;
      }

      toast.success('Regra de comissão criada com sucesso.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.');
    }
  }

  // ---- Render ----
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* === Scope radio group === */}
        <FormField
          control={form.control}
          name="scopeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.comissao.form.scopeLabel')}</FormLabel>
              <RadioGroup
                value={field.value}
                onValueChange={(v) => onScopeChange(v as FormValues['scopeType'])}
                className="space-y-2"
              >
                {SCOPES.map((s) => (
                  <div key={s} className="flex items-start gap-2">
                    <RadioGroupItem value={s} id={`scope-${s}`} className="mt-0.5" />
                    <div className="space-y-0.5">
                      <Label htmlFor={`scope-${s}`} className="font-semibold cursor-pointer">
                        {t(`catalog.comissao.scope.${s}.label`)}
                      </Label>
                      <p className="text-sm text-neutral-500">
                        {t(`catalog.comissao.scope.${s}.helper`)}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* === Conditional pickers — CONCRETE, no placeholders === */}

        {/* member_service: Two EntityCombobox instances side-by-side */}
        {scopeType === 'member_service' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              control={form.control}
              name="memberId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('catalog.comissao.form.memberLabel')} *</FormLabel>
                  <FormControl>
                    <EntityCombobox
                      items={memberItems}
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id ?? undefined)}
                      placeholder={t('catalog.comissao.form.memberPlaceholder')}
                      searchPlaceholder={t('catalog.comissao.form.memberSearchPlaceholder')}
                      emptyText={t('catalog.comissao.form.memberEmpty')}
                      loading={membersLoading}
                    />
                  </FormControl>
                  {fieldState.error && (
                    <p className="text-sm text-error-500">{fieldState.error.message}</p>
                  )}
                </FormItem>
              )}
            />
            <Controller
              control={form.control}
              name="serviceId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('catalog.comissao.form.serviceLabel')} *</FormLabel>
                  <FormControl>
                    <EntityCombobox
                      items={serviceItems}
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id ?? undefined)}
                      placeholder={t('catalog.comissao.form.servicePlaceholder')}
                      searchPlaceholder={t('catalog.comissao.form.serviceSearchPlaceholder')}
                      emptyText={t('catalog.comissao.form.serviceEmpty')}
                      loading={servicesLoading}
                    />
                  </FormControl>
                  {fieldState.error && (
                    <p className="text-sm text-error-500">{fieldState.error.message}</p>
                  )}
                </FormItem>
              )}
            />
          </div>
        )}

        {/* service: One EntityCombobox fed by ServicesQuery */}
        {scopeType === 'service' && (
          <Controller
            control={form.control}
            name="serviceId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('catalog.comissao.form.serviceLabel')} *</FormLabel>
                <FormControl>
                  <EntityCombobox
                    items={serviceItems}
                    value={field.value ?? null}
                    onChange={(id) => field.onChange(id ?? undefined)}
                    placeholder={t('catalog.comissao.form.servicePlaceholder')}
                    searchPlaceholder={t('catalog.comissao.form.serviceSearchPlaceholder')}
                    emptyText={t('catalog.comissao.form.serviceEmpty')}
                    loading={servicesLoading}
                  />
                </FormControl>
                {fieldState.error && (
                  <p className="text-sm text-error-500">{fieldState.error.message}</p>
                )}
              </FormItem>
            )}
          />
        )}

        {/* category: shadcn Select with flat hierarchical list (root bold, children indented) */}
        {scopeType === 'category' && (
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('catalog.comissao.form.categoryLabel')} *</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => field.onChange(v || undefined)}
                    disabled={categoriesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('catalog.comissao.form.categoryPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryFlatItems.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className={c.isChild ? 'pl-4 text-neutral-500' : 'font-semibold'}>
                            {c.isChild ? `↳ ${c.name}` : c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                {fieldState.error && (
                  <p className="text-sm text-error-500">{fieldState.error.message}</p>
                )}
              </FormItem>
            )}
          />
        )}

        {/* product: One EntityCombobox fed by ProductsQuery (SKU as sublabel) */}
        {scopeType === 'product' && (
          <Controller
            control={form.control}
            name="productId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('catalog.comissao.form.productLabel')} *</FormLabel>
                <FormControl>
                  <EntityCombobox
                    items={productItems}
                    value={field.value ?? null}
                    onChange={(id) => field.onChange(id ?? undefined)}
                    placeholder={t('catalog.comissao.form.productPlaceholder')}
                    searchPlaceholder={t('catalog.comissao.form.productSearchPlaceholder')}
                    emptyText={t('catalog.comissao.form.productEmpty')}
                    loading={productsLoading}
                  />
                </FormControl>
                {fieldState.error && (
                  <p className="text-sm text-error-500">{fieldState.error.message}</p>
                )}
              </FormItem>
            )}
          />
        )}

        {/* default scope: no additional scope fields */}

        {/* === Kind radio + value input (always shown) === */}
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.comissao.form.kindLabel')}</FormLabel>
              <RadioGroup
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  // Reset value when switching kind: R$ amount and % use different scales
                  form.setValue('value', '');
                }}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed" id="kind-fixed" />
                  <Label htmlFor="kind-fixed">{t('catalog.comissao.kind.fixed')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="percentage" id="kind-percentage" />
                  <Label htmlFor="kind-percentage">{t('catalog.comissao.kind.percentage')}</Label>
                </div>
              </RadioGroup>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {kind === 'fixed'
                  ? t('catalog.comissao.form.valueFixedLabel')
                  : t('catalog.comissao.form.valuePercentLabel')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={kind === 'fixed' ? '0,00' : '0,00'}
                  inputMode="numeric"
                  onChange={(e) => {
                    const masked =
                      kind === 'fixed'
                        ? maskCurrency(e.target.value)
                        : maskPercentage(e.target.value);
                    field.onChange(masked);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Inline conflict error alert */}
        {conflictError && (
          <Alert variant="destructive">
            <AlertDescription>{conflictError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('catalog.categoria.form.cancel', 'Cancelar')}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading
              ? t('catalog.categoria.form.submitting', 'Salvando…')
              : t('catalog.categoria.form.submitCreate', 'Salvar')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

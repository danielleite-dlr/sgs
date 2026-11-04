import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ServicesQuery } from '../api/servicos.api';
import { CreatePackageMutation, UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';
import { PackagePriceSummary } from './PackagePriceSummary';
import { PackageServicesPicker } from './PackageServicesPicker';
import { maskCurrency, unmaskCurrency, formatCurrencyDisplay } from '../utils/currency-mask';

const schema = z.object({
  name: z.string().min(2, 'Digite um nome válido.'),
  price: z
    .string()
    .min(1, 'Informe o preço.')
    .refine(
      (v) => {
        const n = Number(unmaskCurrency(v));
        return !Number.isNaN(n) && n >= 0;
      },
      { message: 'Preço inválido.' },
    ),
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'Adicione ao menos um serviço.'),
  depositKind: z.enum(['none', 'fixed', 'percent']),
  depositValue: z.string(),
}).superRefine((v, ctx) => {
  if (v.depositKind === 'none') return;
  const raw = v.depositKind === 'fixed' ? unmaskCurrency(v.depositValue) : v.depositValue.replace(',', '.');
  const n = raw === '' ? NaN : Number(raw);
  if (Number.isNaN(n) || n < 0 || (v.depositKind === 'percent' && n > 100)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['depositValue'],
      message:
        v.depositKind === 'percent'
          ? 'O percentual deve ficar entre 0 e 100.'
          : 'Informe um valor de entrada válido.',
    });
  }
});

type FormValues = z.infer<typeof schema>;

export interface PacoteFormInitial {
  id: string;
  name: string;
  price: string;
  services: Array<{ serviceId: string; quantity: number }>;
  depositKind?: 'fixed' | 'percent' | null;
  depositValue?: string | null;
}

export interface PacoteFormProps {
  initial?: PacoteFormInitial;
  onClose: () => void;
}

export function PacoteForm({ initial, onClose }: PacoteFormProps) {
  const { t } = useTranslation();
  const { data: svcData } = useQuery(ServicesQuery);
  const services = useMemo(() => svcData?.services ?? [], [svcData?.services]);

  const [createPkg, { loading: creating }] = useMutation(CreatePackageMutation, {
    refetchQueries: [{ query: PackagesQuery }],
  });
  const [updatePkg, { loading: updating }] = useMutation(UpdatePackageMutation, {
    refetchQueries: [{ query: PackagesQuery }],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          services: initial.services,
          price: formatCurrencyDisplay(initial.price),
          depositKind: initial.depositKind ?? 'none',
          depositValue:
            initial.depositKind === 'fixed' && initial.depositValue
              ? formatCurrencyDisplay(initial.depositValue)
              : initial.depositKind === 'percent' && initial.depositValue
                ? String(Number(initial.depositValue))
                : '',
        }
      : { name: '', price: '', services: [], depositKind: 'none', depositValue: '' },
  });

  // Live computation of individual sum from selected services × quantity
  const watched = form.watch();
  const individualSum = useMemo(() => {
    return watched.services
      .reduce((sum: number, row: { serviceId: string; quantity: number }) => {
        const svc = services.find((s: { id: string; basePrice: string }) => s.id === row.serviceId);
        return sum + (svc ? Number(svc.basePrice) * row.quantity : 0);
      }, 0)
      .toFixed(2);
  }, [watched.services, services]);

  const isEdit = !!initial;
  const isLoading = creating || updating;

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        name: values.name,
        price: unmaskCurrency(values.price),
        services: values.services,
        depositKind: values.depositKind === 'none' ? null : values.depositKind,
        depositValue:
          values.depositKind === 'none'
            ? null
            : values.depositKind === 'fixed'
              ? unmaskCurrency(values.depositValue)
              : values.depositValue.replace(',', '.'),
      };
      const res = isEdit && initial
        ? await updatePkg({ variables: { input: { id: initial.id, ...payload } } })
        : await createPkg({ variables: { input: payload } });

      const data = isEdit
        ? (res.data as { updatePackage: { package: unknown; errors: Array<{ code: string; message: string; field?: string }> } })?.updatePackage
        : (res.data as { createPackage: { package: unknown; errors: Array<{ code: string; message: string; field?: string }> } })?.createPackage;
      const errors = data?.errors ?? [];

      if (errors.length) {
        if (errors[0].field) {
          form.setError(errors[0].field as keyof FormValues, { message: errors[0].message });
        } else {
          toast.error(errors[0].message);
        }
        return;
      }
      toast.success(isEdit ? 'Alterações salvas.' : `${values.name} criado com sucesso.`);
      onClose();
    } catch {
      toast.error(t('catalog.servico.errors.generic', 'Não foi possível salvar. Tente novamente.'));
    }
  }

  const servicesLength = form.watch('services').length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Package name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.pacote.form.nameLabel')} *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('catalog.pacote.form.namePlaceholder')}
                  autoFocus
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Services multi-select picker */}
        <Controller
          control={form.control}
          name="services"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('catalog.pacote.form.servicesLabel')} *</FormLabel>
              <PackageServicesPicker value={field.value} onChange={field.onChange} />
              {fieldState.error && (
                <p className="text-sm text-error-500">{fieldState.error.message}</p>
              )}
            </FormItem>
          )}
        />

        {/* Package price */}
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.pacote.form.priceLabel')} *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="0,00"
                  inputMode="numeric"
                  onChange={(e) => field.onChange(maskCurrency(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Live price comparison summary */}
        <PackagePriceSummary
          individualSum={individualSum}
          packagePrice={unmaskCurrency(form.watch('price') || '') || '0'}
        />

        {/* Entrada do contrato de noiva (D-12) */}
        <div className="grid grid-cols-2 gap-sm">
          <FormField
            control={form.control}
            name="depositKind"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="pacote-deposit-kind">Entrada do contrato</FormLabel>
                <FormControl>
                  <select
                    id="pacote-deposit-kind"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      form.setValue('depositValue', '');
                    }}
                    className="w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
                  >
                    <option value="none">Sem entrada</option>
                    <option value="fixed">Valor fixo (R$)</option>
                    <option value="percent">Percentual (%)</option>
                  </select>
                </FormControl>
              </FormItem>
            )}
          />
          {form.watch('depositKind') !== 'none' && (
            <FormField
              control={form.control}
              name="depositValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="pacote-deposit-value">
                    {form.watch('depositKind') === 'percent'
                      ? 'Percentual da entrada'
                      : 'Valor da entrada'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="pacote-deposit-value"
                      {...field}
                      inputMode={form.watch('depositKind') === 'percent' ? 'decimal' : 'numeric'}
                      placeholder={form.watch('depositKind') === 'percent' ? '30' : '0,00'}
                      onChange={(e) =>
                        field.onChange(
                          form.watch('depositKind') === 'fixed'
                            ? maskCurrency(e.target.value)
                            : e.target.value,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('catalog.categoria.form.cancel', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || servicesLength === 0}
          >
            {isLoading
              ? t('catalog.categoria.form.submitting', 'Salvando…')
              : isEdit
                ? t('catalog.categoria.form.submitEdit', 'Salvar alterações')
                : t('catalog.categoria.form.submitCreate', 'Salvar')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

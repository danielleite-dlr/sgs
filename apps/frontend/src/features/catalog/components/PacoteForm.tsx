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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ServicesQuery } from '../api/servicos.api';
import { CreatePackageMutation, UpdatePackageMutation, PackagesQuery } from '../api/pacotes.api';
import { PackagePriceSummary } from './PackagePriceSummary';
import { PackageServicesPicker } from './PackageServicesPicker';

const schema = z.object({
  name: z.string().min(2, 'Digite um nome válido.'),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Informe um preço válido.')
    .refine((v) => parseFloat(v) >= 0, 'O preço deve ser maior ou igual a zero.'),
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'Adicione ao menos um serviço.'),
});

type FormValues = z.infer<typeof schema>;

export interface PacoteFormInitial {
  id: string;
  name: string;
  price: string;
  services: Array<{ serviceId: string; quantity: number }>;
}

export interface PacoteFormProps {
  initial?: PacoteFormInitial;
  onClose: () => void;
}

export function PacoteForm({ initial, onClose }: PacoteFormProps) {
  const { t } = useTranslation();
  const { data: svcData } = useQuery(ServicesQuery);
  const services = svcData?.services ?? [];

  const [createPkg, { loading: creating }] = useMutation(CreatePackageMutation, {
    refetchQueries: [{ query: PackagesQuery }],
  });
  const [updatePkg, { loading: updating }] = useMutation(UpdatePackageMutation, {
    refetchQueries: [{ query: PackagesQuery }],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { name: '', price: '0.00', services: [] },
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
        price: values.price,
        services: values.services,
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
                <Input {...field} placeholder="R$ 0,00" inputMode="decimal" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Live price comparison summary */}
        <PackagePriceSummary
          individualSum={individualSum}
          packagePrice={form.watch('price') || '0'}
        />

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

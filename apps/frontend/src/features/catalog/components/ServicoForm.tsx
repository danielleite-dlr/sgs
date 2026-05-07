import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CategoriesQuery } from '../api/categorias.api';
import type { CategoriesQueryResult } from '../api/categorias.api';
import {
  ServicesQuery,
  CreateServiceMutation,
  UpdateServiceMutation,
} from '../api/servicos.api';
import type { CreateServiceResult, UpdateServiceResult } from '../api/servicos.api';
import { PricingVariantsEditor } from './PricingVariantsEditor';

// ---- Zod schema ----

const variantSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório.'),
  durationMinutes: z.coerce.number().int().positive('Duração inválida.'),
  seniorityTier: z
    .union([z.literal('junior'), z.literal('pleno'), z.literal('senior'), z.null()])
    .nullable()
    .optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Formato inválido (ex.: 50.00)'),
});

const schema = z.object({
  name: z.string().min(2, 'Digite um nome válido.'),
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  basePrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Formato inválido (ex.: 50.00)'),
  defaultDurationMinutes: z.coerce.number().int().positive('Duração inválida.'),
  pricingVariants: z.array(variantSchema).default([]),
});

type FormValues = z.infer<typeof schema>;

// ---- Types ----

export interface ServicoFormInitial {
  id: string;
  name: string;
  categoryId: string;
  basePrice: string;
  defaultDurationMinutes: number;
  pricingVariants: Array<{
    name: string;
    durationMinutes: number;
    seniorityTier?: string | null;
    price: string;
  }>;
}

// ---- Component ----

export function ServicoForm({
  initial,
  onClose,
}: {
  initial?: ServicoFormInitial;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(initial);

  const { data: catData } = useQuery<CategoriesQueryResult>(CategoriesQuery);

  const [createSvc, { loading: creating }] = useMutation<CreateServiceResult>(
    CreateServiceMutation,
    { refetchQueries: [{ query: ServicesQuery }] },
  );

  const [updateSvc, { loading: updating }] = useMutation<UpdateServiceResult>(
    UpdateServiceMutation,
    { refetchQueries: [{ query: ServicesQuery }] },
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          categoryId: initial.categoryId,
          basePrice: initial.basePrice,
          defaultDurationMinutes: initial.defaultDurationMinutes,
          pricingVariants: initial.pricingVariants.map((v) => ({
            name: v.name,
            durationMinutes: v.durationMinutes,
            seniorityTier: (v.seniorityTier as 'junior' | 'pleno' | 'senior' | null) ?? null,
            price: v.price,
          })),
        }
      : {
          name: '',
          categoryId: '',
          basePrice: '0.00',
          defaultDurationMinutes: 60,
          pricingVariants: [],
        },
    mode: 'onBlur',
  });

  // Flatten root + children for hierarchical category select display
  const allCategories = (catData?.categories ?? []).flatMap((root) => [
    { id: root.id, name: root.name },
    ...((root.children ?? []).map((c) => ({
      id: c.id,
      name: `${root.name} > ${c.name}`,
    }))),
  ]);

  async function onSubmit(values: FormValues) {
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

      if (isEdit && initial) {
        const res = await updateSvc({
          variables: { input: { id: initial.id, ...payload } },
        });
        const errors = res.data?.updateService.errors ?? [];
        if (errors.length) {
          form.setError((errors[0].field as keyof FormValues) ?? 'name', {
            message: errors[0].message,
          });
          return;
        }
        toast.success(t('catalog.toasts.savedChanges'));
      } else {
        const res = await createSvc({ variables: { input: payload } });
        const errors = res.data?.createService.errors ?? [];
        if (errors.length) {
          form.setError((errors[0].field as keyof FormValues) ?? 'name', {
            message: errors[0].message,
          });
          return;
        }
        toast.success(t('catalog.toasts.serviceCreated', { name: values.name }));
      }
      onClose();
    } catch {
      toast.error(t('catalog.servico.errors.generic'));
    }
  }

  const isLoading = creating || updating;

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Service name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('catalog.servico.form.nameLabel')}{' '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('catalog.servico.form.namePlaceholder')}
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('catalog.servico.form.categoryLabel')}{' '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('catalog.servico.form.categoryPlaceholder')}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Base price + duration in 2-col grid */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="basePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('catalog.servico.form.basePriceLabel')}{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="R$ 0,00"
                      inputMode="decimal"
                      aria-label="Preço base em reais"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultDurationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('catalog.servico.form.durationLabel')}{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      placeholder={t('catalog.servico.form.durationPlaceholder')}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Separator before pricing variants section */}
          <Separator />

          {/* Pricing variants dynamic editor */}
          <PricingVariantsEditor name="pricingVariants" />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('catalog.categoria.form.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
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

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
import { toast } from 'sonner';
import {
  CategoriesQuery,
  CreateCategoryMutation,
  UpdateCategoryMutation,
} from '../api/categorias.api';
import type {
  CategoriesQueryResult,
  CreateCategoryResult,
  UpdateCategoryResult,
} from '../api/categorias.api';

const schema = z.object({
  name: z.string().min(2, 'Digite um nome válido.'),
  parentId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface CategoriaFormInitial {
  id: string;
  name: string;
  parentId?: string | null;
}

export function CategoriaForm({
  initial,
  onClose,
}: {
  initial?: CategoriaFormInitial;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(initial);

  const { data } = useQuery<CategoriesQueryResult>(CategoriesQuery);

  const [createCat, { loading: creating }] = useMutation<CreateCategoryResult>(
    CreateCategoryMutation,
    { refetchQueries: [{ query: CategoriesQuery }] },
  );

  const [updateCat, { loading: updating }] = useMutation<UpdateCategoryResult>(
    UpdateCategoryMutation,
    { refetchQueries: [{ query: CategoriesQuery }] },
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      parentId: initial?.parentId ?? '',
    },
    mode: 'onBlur',
  });

  // Only root categories can be parents (max 2-level depth per D-04)
  const rootCategories = (data?.categories ?? []).filter(
    (c) => c.parentId === null && c.id !== initial?.id,
  );

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && initial) {
        const res = await updateCat({
          variables: {
            input: {
              id: initial.id,
              name: values.name,
              parentId: values.parentId || null,
            },
          },
        });
        const errors = res.data?.updateCategory.errors ?? [];
        if (errors.length) {
          form.setError((errors[0].field as keyof FormValues) ?? 'name', {
            message: errors[0].message,
          });
          return;
        }
        toast.success(t('catalog.toasts.savedChanges'));
      } else {
        const res = await createCat({
          variables: {
            input: {
              name: values.name,
              parentId: values.parentId || undefined,
            },
          },
        });
        const errors = res.data?.createCategory.errors ?? [];
        if (errors.length) {
          form.setError((errors[0].field as keyof FormValues) ?? 'name', {
            message: errors[0].message,
          });
          return;
        }
        toast.success(t('catalog.toasts.categoryCreated', { name: values.name }));
      }
      onClose();
    } catch {
      toast.error(t('catalog.categoria.errors.generic'));
    }
  }

  const isLoading = creating || updating;

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('catalog.categoria.form.nameLabel')}{' '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('catalog.categoria.form.namePlaceholder')}
                    autoFocus
                  />
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
                <Select
                  onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                  value={field.value || '__none__'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('catalog.categoria.form.parentPlaceholder')}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t('catalog.categoria.form.parentPlaceholder')}
                    </SelectItem>
                    {rootCategories.map((c) => (
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

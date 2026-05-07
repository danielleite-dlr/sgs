import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Percent } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CommissionRuleForm } from './CommissionRuleForm';
import {
  CreateProductMutation,
  UpdateProductMutation,
  ProductsQuery,
} from '../api/produtos.api';
import type { ProductData, ProductUnit } from '../api/produtos.api';
import { maskCurrency, unmaskCurrency, formatCurrencyDisplay } from '../utils/currency-mask';

// SKU: letters, numbers, hyphens and underscores — no spaces
const SKU_REGEX = /^[A-Za-z0-9_-]+$/;

const priceSchema = z
  .string()
  .min(1, 'Informe o preço.')
  .refine(
    (v) => {
      const n = Number(unmaskCurrency(v));
      return !Number.isNaN(n) && n >= 0;
    },
    { message: 'Preço inválido.' },
  );

const schema = z.object({
  name: z.string().min(2, 'Digite um nome válido.'),
  sku: z.string().min(1, 'Este campo é obrigatório.').regex(SKU_REGEX, 'SKU não pode conter espaços.'),
  costPrice: priceSchema,
  salePrice: priceSchema,
  stockQuantity: z.coerce.number().int().min(0, 'Estoque não pode ser negativo.'),
  minStockLevel: z.coerce.number().int().min(0, 'Mínimo não pode ser negativo.'),
  unit: z.enum(['un', 'ml', 'g']),
});

type FormValues = z.infer<typeof schema>;

export interface ProdutoFormInitial extends ProductData {}

export interface ProdutoFormProps {
  initial?: ProdutoFormInitial;
  onClose: () => void;
}

export function ProdutoForm({ initial, onClose }: ProdutoFormProps) {
  const { t } = useTranslation();

  const [createProduct, { loading: creating }] = useMutation(CreateProductMutation, {
    refetchQueries: [{ query: ProductsQuery, variables: { lowStockOnly: false } }],
  });
  const [updateProduct, { loading: updating }] = useMutation(UpdateProductMutation, {
    refetchQueries: [{ query: ProductsQuery, variables: { lowStockOnly: false } }],
  });

  const isEdit = !!initial;
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<{ id: string; name: string } | null>(null);

  // Effective product for commission shortcut (existing OR just-saved)
  const targetProduct = initial ?? justCreated;
  const showCommissionSection = Boolean(targetProduct);
  const isLoading = creating || updating;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          sku: initial.sku,
          costPrice: formatCurrencyDisplay(initial.costPrice),
          salePrice: formatCurrencyDisplay(initial.salePrice),
          stockQuantity: initial.stockQuantity,
          minStockLevel: initial.minStockLevel,
          unit: initial.unit as 'un' | 'ml' | 'g',
        }
      : {
          name: '',
          sku: '',
          costPrice: '',
          salePrice: '',
          stockQuantity: 0,
          minStockLevel: 0,
          unit: 'un',
        },
  });

  async function onSubmit(values: FormValues) {
    try {
      let res;
      if (isEdit && initial) {
        // UpdateProductInput does NOT include stockQuantity (only adjustStock can change it)
        const { stockQuantity, ...updateFields } = values;
        void stockQuantity; // acknowledged: not sent on edit
        res = await updateProduct({
          variables: {
            input: {
              id: initial.id,
              name: updateFields.name,
              sku: updateFields.sku,
              costPrice: unmaskCurrency(updateFields.costPrice),
              salePrice: unmaskCurrency(updateFields.salePrice),
              minStockLevel: updateFields.minStockLevel,
              unit: updateFields.unit as ProductUnit,
            },
          },
        });
      } else {
        res = await createProduct({
          variables: {
            input: {
              name: values.name,
              sku: values.sku,
              costPrice: unmaskCurrency(values.costPrice),
              salePrice: unmaskCurrency(values.salePrice),
              stockQuantity: values.stockQuantity,
              minStockLevel: values.minStockLevel,
              unit: values.unit as ProductUnit,
            },
          },
        });
      }

      const data = isEdit
        ? (res.data as { updateProduct: { errors: Array<{ code: string; message: string; field?: string }> } })?.updateProduct
        : (res.data as { createProduct: { errors: Array<{ code: string; message: string; field?: string }> } })?.createProduct;
      const errors = data?.errors ?? [];

      if (errors.length) {
        if (errors[0].code === 'SKU_TAKEN') {
          form.setError('sku', { message: t('catalog.produto.errors.skuTaken') });
          return;
        }
        if (errors[0].field) {
          form.setError(errors[0].field as keyof FormValues, { message: errors[0].message });
        } else {
          toast.error(errors[0].message);
        }
        return;
      }

      toast.success(isEdit ? 'Alterações salvas.' : `${values.name} criado com sucesso.`);
      if (!isEdit) {
        // Stay on the form so user can configure commission in the same step
        const created = (res.data as { createProduct?: { product?: { id: string; name: string } } })
          ?.createProduct?.product;
        if (created) {
          setJustCreated({ id: created.id, name: created.name });
          return;
        }
      }
      onClose();
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Product name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.produto.form.nameLabel')} *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('catalog.produto.form.namePlaceholder')}
                  autoFocus
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* SKU */}
        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.produto.form.skuLabel')} *</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('catalog.produto.form.skuPlaceholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Prices: cost + sale side-by-side */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="costPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.produto.form.costPriceLabel')}</FormLabel>
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
          <FormField
            control={form.control}
            name="salePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.produto.form.salePriceLabel')} *</FormLabel>
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
        </div>

        {/* Stock quantity — disabled on edit; use AdjustStockDialog to change */}
        <FormField
          control={form.control}
          name="stockQuantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('catalog.produto.form.stockLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  disabled={isEdit}
                  aria-disabled={isEdit}
                  placeholder="0"
                />
              </FormControl>
              {isEdit && (
                <p className="text-xs text-neutral-500">
                  {t('catalog.produto.form.stockEditDisabledHint')}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Min stock level + unit */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="minStockLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.produto.form.minStockLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} placeholder="0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog.produto.form.unitLabel')} *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as 'un' | 'ml' | 'g')}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="un">
                      {t('catalog.produto.form.unitOptions.un', 'Unidade')}
                    </SelectItem>
                    <SelectItem value="ml">
                      {t('catalog.produto.form.unitOptions.ml', 'mL')}
                    </SelectItem>
                    <SelectItem value="g">
                      {t('catalog.produto.form.unitOptions.g', 'g')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Commission shortcut — appears for existing products OR right after creation */}
        {showCommissionSection && targetProduct && (
          <>
            <Separator />
            <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div>
                <p className="text-sm font-semibold">
                  {justCreated ? 'Configurar comissão deste produto' : 'Comissão sobre venda'}
                </p>
                <p className="text-sm text-neutral-500">
                  {justCreated
                    ? 'Produto criado. Adicione uma regra de comissão agora ou clique em Concluir.'
                    : 'Crie uma regra de comissão para este produto.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCommissionDialogOpen(true)}
              >
                <Percent className="mr-2 h-4 w-4" />
                Configurar comissão
              </Button>
            </div>
          </>
        )}

        <DialogFooter>
          {justCreated ? (
            <Button type="button" onClick={onClose}>
              Concluir
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('catalog.categoria.form.cancel', 'Cancelar')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? t('catalog.categoria.form.submitting', 'Salvando…')
                  : isEdit
                    ? t('catalog.categoria.form.submitEdit', 'Salvar alterações')
                    : t('catalog.categoria.form.submitCreate', 'Salvar')}
              </Button>
            </>
          )}
        </DialogFooter>
      </form>

      {/* Commission rule shortcut dialog (rendered outside the form) */}
      {showCommissionSection && targetProduct && (
        <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova regra de comissão — {targetProduct.name}</DialogTitle>
            </DialogHeader>
            <CommissionRuleForm
              onClose={() => setCommissionDialogOpen(false)}
              prefilledScope={{ scopeType: 'product', productId: targetProduct.id }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Form>
  );
}

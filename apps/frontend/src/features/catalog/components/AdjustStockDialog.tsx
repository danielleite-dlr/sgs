import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
// ↑ This import REQUIRES the shadcn textarea primitive installed in Step A.
import { AdjustStockMutation, LowStockCountQuery } from '../api/produtos.api';
import type { ProductUnit } from '../api/produtos.api';
import { toast } from 'sonner';

const schema = z.object({
  delta: z.coerce.number().int().refine((n) => n !== 0, 'Quantidade não pode ser zero.'),
  reason: z.string().min(1, 'Este campo é obrigatório.').max(500),
});

type FormValues = z.infer<typeof schema>;

export interface AdjustStockDialogProps {
  product: {
    id: string;
    name: string;
    stockQuantity: number;
    minStockLevel: number;
    unit: ProductUnit;
  };
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog for adjusting product stock.
 *
 * Uses cache.evict (NOT hardcoded refetchQueries variables) per the checker fix.
 * This allows ProdutosPage to manage its own query variables (e.g., lowStockOnly) while
 * still getting fresh data after an adjustment.
 *
 * - cache.evict: invalidates the specific Product entity + products field list
 * - refetchQueries: [LowStockCountQuery] updates the AppShell sidebar warning immediately
 */
export function AdjustStockDialog({ product, open, onClose }: AdjustStockDialogProps) {
  const { t } = useTranslation();

  const [adjust, { loading }] = useMutation(AdjustStockMutation, {
    update(cache, { data }) {
      const updatedId =
        (data as { adjustStock: { product: { id: string } | null } })?.adjustStock?.product?.id ??
        product.id;
      // Evict the specific Product entity from cache — forces re-fetch with any variables
      cache.evict({ id: cache.identify({ __typename: 'Product', id: updatedId }) });
      // Evict the products list field so any query with any variables re-fetches
      cache.evict({ fieldName: 'products' });
      // Evict lowStockCount root field so sidebar badge re-fetches
      cache.evict({ fieldName: 'lowStockCount' });
      cache.gc();
    },
    // Explicit refetch of lowStockCount so AppShell sidebar warning updates immediately
    refetchQueries: [{ query: LowStockCountQuery }],
    awaitRefetchQueries: true,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { delta: 0, reason: '' },
  });

  const delta = form.watch('delta');
  const newStock = (product.stockQuantity ?? 0) + (delta || 0);

  async function onSubmit(values: FormValues) {
    try {
      const res = await adjust({
        variables: { input: { productId: product.id, delta: values.delta, reason: values.reason } },
      });
      const errors =
        (res.data as { adjustStock: { errors: Array<{ code: string; message: string; field?: string }> } })
          ?.adjustStock?.errors ?? [];
      if (errors.length) {
        if (errors[0].field) {
          form.setError(errors[0].field as keyof FormValues, { message: errors[0].message });
        } else {
          toast.error(errors[0].message);
        }
        return;
      }
      toast.success(t('catalog.produto.toasts.stockAdjusted'));
      form.reset();
      onClose();
    } catch {
      toast.error('Não foi possível ajustar o estoque. Tente novamente.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          form.reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('catalog.produto.adjustStock.title')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current stock display */}
            <div className="text-sm text-neutral-800">
              {t('catalog.produto.adjustStock.currentLabel')}:{' '}
              <strong>
                {product.stockQuantity} {product.unit}
              </strong>
            </div>

            {/* Delta input */}
            <FormField
              control={form.control}
              name="delta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.produto.adjustStock.deltaLabel')}</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="+10 ou -5" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason textarea */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog.produto.adjustStock.reasonLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('catalog.produto.adjustStock.reasonPlaceholder')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live preview of new stock */}
            <div className="text-sm text-neutral-500">
              {t('catalog.produto.adjustStock.previewLabel')}:{' '}
              <strong>
                {newStock} {product.unit}
              </strong>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('catalog.categoria.form.cancel', 'Cancelar')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? t('catalog.categoria.form.submitting', 'Salvando…')
                  : t('catalog.produto.adjustStock.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

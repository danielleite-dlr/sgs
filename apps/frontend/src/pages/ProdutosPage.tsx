import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { ShoppingBag, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { StockBadge } from '@/components/ui/stock-badge';
import { ProdutoForm } from '@/features/catalog/components/ProdutoForm';
import { AdjustStockDialog } from '@/features/catalog/components/AdjustStockDialog';
import {
  ProductsQuery,
  SoftDeleteProductMutation,
  ProductData,
} from '@/features/catalog/api/produtos.api';

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

export function ProdutosPage() {
  const { t } = useTranslation();
  const { data, loading } = useQuery(ProductsQuery, {
    variables: { lowStockOnly: false },
  });
  const [softDelete] = useMutation(SoftDeleteProductMutation, {
    refetchQueries: [{ query: ProductsQuery, variables: { lowStockOnly: false } }],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductData | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<ProductData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductData | null>(null);

  useEffect(() => {
    document.title = t('pages.produtos.tab');
  }, [t]);

  const products: ProductData[] = data?.products ?? [];

  async function handleDelete(produto: ProductData) {
    const res = await softDelete({ variables: { input: { id: produto.id } } });
    const errors =
      (res.data as { softDeleteProduct: { errors: Array<{ message: string }> } })
        ?.softDeleteProduct?.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
    } else {
      toast.success(`${produto.name} desativado.`);
    }
    setDeleteTarget(null);
  }

  type ProdutoColumnKey = 'name' | 'sku' | 'salePrice' | 'stock' | 'minStock' | 'actions';

  const columns: DataTableColumn<ProductData, ProdutoColumnKey>[] = [
    {
      key: 'name',
      header: t('catalog.produto.table.name', 'Nome'),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <EntityAvatar name={row.name} size={40} />
          <span className="font-medium text-neutral-800">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'sku',
      header: t('catalog.produto.table.sku', 'SKU'),
      cell: (row) => <span className="font-mono text-sm text-neutral-800">{row.sku}</span>,
    },
    {
      key: 'salePrice',
      header: t('catalog.produto.table.salePrice', 'Preço de venda'),
      cell: (row) => (
        <span className="font-semibold text-neutral-800">{fmt(row.salePrice)}</span>
      ),
    },
    {
      key: 'stock',
      header: t('catalog.produto.table.stock', 'Estoque'),
      cell: (row) => (
        <StockBadge
          quantity={row.stockQuantity}
          minLevel={row.minStockLevel}
          unit={row.unit}
        />
      ),
    },
    {
      key: 'minStock',
      header: t('catalog.produto.table.minStock', 'Mínimo'),
      cell: (row) => (
        <span className="text-neutral-800">
          {row.minStockLevel} {row.unit}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('catalog.produto.table.actions', 'Ações'),
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditTarget(row)}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAdjustTarget(row)}>
              Ajustar estoque
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-error-500"
              onClick={() => setDeleteTarget(row)}
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const emptyState = (
    <div className="flex flex-col items-center gap-3 text-center">
      <ShoppingBag className="h-12 w-12 text-neutral-500" />
      <p className="text-base font-semibold text-neutral-800">
        {t('catalog.produto.empty.heading', 'Nenhum produto ainda')}
      </p>
      <p className="text-sm text-neutral-500">
        {t('catalog.produto.empty.body', 'Cadastre os produtos que você usa ou vende.')}
      </p>
      <Button onClick={() => setCreateOpen(true)}>
        {t('catalog.produto.empty.cta', 'Novo produto')}
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('pages.produtos.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.produtos.h1') },
        ]}
        cta={<Button onClick={() => setCreateOpen(true)}>{t('pages.produtos.newCta')}</Button>}
      />

      <DataTable
        columns={columns}
        rows={products}
        rowKey={(r) => r.id}
        loading={loading}
        empty={emptyState}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo produto</DialogTitle>
          </DialogHeader>
          <ProdutoForm onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar produto</DialogTitle>
            </DialogHeader>
            <ProdutoForm initial={editTarget} onClose={() => setEditTarget(null)} />
          </DialogContent>
        </Dialog>
      )}

      {/* Adjust stock dialog */}
      {adjustTarget && (
        <AdjustStockDialog
          product={adjustTarget}
          open={!!adjustTarget}
          onClose={() => setAdjustTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} ficará inativo e não aparecerá em novos agendamentos. O histórico
              e os relatórios serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error-500 hover:bg-error-500/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { Package, MoreHorizontal } from 'lucide-react';
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
import { PackagePriceSummary } from '@/features/catalog/components/PackagePriceSummary';
import { PacoteForm } from '@/features/catalog/components/PacoteForm';
import {
  PackagesQuery,
  SoftDeletePackageMutation,
  PackageData,
} from '@/features/catalog/api/pacotes.api';

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

export function PacotesPage() {
  const { t } = useTranslation();
  const { data, loading } = useQuery(PackagesQuery);
  const [softDelete] = useMutation(SoftDeletePackageMutation, {
    refetchQueries: [{ query: PackagesQuery }],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PackageData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackageData | null>(null);

  useEffect(() => {
    document.title = t('pages.pacotes.tab');
  }, [t]);

  const packages: PackageData[] = data?.packages ?? [];

  async function handleDelete(pkg: PackageData) {
    const res = await softDelete({ variables: { input: { id: pkg.id } } });
    const errors = (res.data as { softDeletePackage: { errors: Array<{ message: string }> } })?.softDeletePackage?.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
    } else {
      toast.success(`${pkg.name} desativado.`);
    }
    setDeleteTarget(null);
  }

  type PacoteColumnKey = 'name' | 'individual' | 'price' | 'items' | 'actions';

  const columns: DataTableColumn<PackageData, PacoteColumnKey>[] = [
    {
      key: 'name',
      header: t('catalog.pacote.table.name', 'Nome'),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <EntityAvatar name={row.name} size={40} />
          <span className="font-medium text-neutral-800">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'individual',
      header: t('catalog.pacote.table.individual', 'Soma individual'),
      cell: (row) => (
        <span className="font-semibold text-neutral-800">{fmt(row.individualSum)}</span>
      ),
    },
    {
      key: 'price',
      header: t('catalog.pacote.table.package', 'Preço do pacote'),
      cell: (row) => (
        <PackagePriceSummary individualSum={row.individualSum} packagePrice={row.price} />
      ),
    },
    {
      key: 'items',
      header: t('catalog.pacote.table.items', 'Serviços'),
      cell: (row) => (
        <span className="text-neutral-800">{row.services.length}</span>
      ),
    },
    {
      key: 'actions',
      header: t('catalog.pacote.table.actions', 'Ações'),
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
      <Package className="h-12 w-12 text-neutral-500" />
      <p className="text-base font-semibold text-neutral-800">
        {t('catalog.pacote.empty.heading', 'Nenhum pacote ainda')}
      </p>
      <p className="text-sm text-neutral-500">
        {t('catalog.pacote.empty.body', 'Crie pacotes combinando serviços com desconto.')}
      </p>
      <Button onClick={() => setCreateOpen(true)}>
        {t('catalog.pacote.empty.cta', 'Novo pacote')}
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t('pages.pacotes.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.pacotes.h1') },
        ]}
        cta={<Button onClick={() => setCreateOpen(true)}>{t('pages.pacotes.newCta')}</Button>}
      />

      <DataTable
        columns={columns}
        rows={packages}
        rowKey={(r) => r.id}
        loading={loading}
        empty={emptyState}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo pacote</DialogTitle>
          </DialogHeader>
          <PacoteForm onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar pacote</DialogTitle>
            </DialogHeader>
            <PacoteForm
              initial={{
                id: editTarget.id,
                name: editTarget.name,
                price: editTarget.price,
                services: editTarget.services.map((s) => ({
                  serviceId: s.serviceId,
                  quantity: s.quantity,
                })),
              }}
              onClose={() => setEditTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} ficará inativo e não aparecerá em novos agendamentos. O
              histórico e os relatórios serão preservados.
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

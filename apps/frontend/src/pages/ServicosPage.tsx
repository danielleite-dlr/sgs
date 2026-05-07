import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { Scissors, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  ServicesQuery,
  SoftDeleteServiceMutation,
} from '@/features/catalog/api/servicos.api';
import type { ServicesQueryResult, SoftDeleteServiceResult } from '@/features/catalog/api/servicos.api';
import { ServicoForm } from '@/features/catalog/components/ServicoForm';
import type { ServicoFormInitial } from '@/features/catalog/components/ServicoForm';
import { ConfirmSoftDeleteDialog } from '@/features/catalog/components/ConfirmSoftDeleteDialog';

// Brazilian currency formatter
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatBRL(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? value : brlFormatter.format(num);
}

interface ServiceRow {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  basePrice: string;
  defaultDurationMinutes: number;
  coverImageUrl: string | null;
  variantCount: number;
  initial: ServicoFormInitial;
}

interface DialogState {
  open: boolean;
  initial?: ServicoFormInitial;
}

function EmptyState({
  icon,
  heading,
  body,
  cta,
}: {
  icon: React.ReactNode;
  heading: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      {icon}
      <h2 className="text-base font-semibold text-neutral-800">{heading}</h2>
      <p className="text-sm text-neutral-500 max-w-md">{body}</p>
      {cta}
    </div>
  );
}

export function ServicosPage() {
  const { t } = useTranslation();
  const { data, loading } = useQuery<ServicesQueryResult>(ServicesQuery);

  const [softDelete] = useMutation<SoftDeleteServiceResult>(SoftDeleteServiceMutation, {
    refetchQueries: [{ query: ServicesQuery }],
  });

  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    document.title = t('pages.servicos.tab');
  }, [t]);

  const rows = useMemo<ServiceRow[]>(() => {
    if (!data?.services) return [];

    return data.services.map((s) => ({
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      categoryName: s.category?.name ?? '—',
      basePrice: s.basePrice,
      defaultDurationMinutes: s.defaultDurationMinutes,
      coverImageUrl: s.coverImageUrl ?? null,
      variantCount: s.pricingVariants?.length ?? 0,
      initial: {
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        basePrice: s.basePrice,
        defaultDurationMinutes: s.defaultDurationMinutes,
        pricingVariants: (s.pricingVariants ?? []).map((v) => ({
          name: v.name,
          durationMinutes: v.durationMinutes,
          seniorityTier: v.seniorityTier,
          price: v.price,
        })),
      },
    }));
  }, [data]);

  async function handleDelete(row: ServiceRow) {
    const res = await softDelete({ variables: { input: { id: row.id } } });
    const errors = res.data?.softDeleteService.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
      return;
    }
    toast.success(t('catalog.softDelete.toastDeleted', { name: row.name }));
  }

  return (
    <>
      <PageHeader
        title={t('pages.servicos.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.servicos.h1') },
        ]}
        cta={
          <Button onClick={() => setDialog({ open: true })}>
            {t('pages.servicos.newCta')}
          </Button>
        }
      />

      <DataTable<ServiceRow>
        rowKey={(r) => r.id}
        loading={loading}
        rows={rows}
        empty={
          <EmptyState
            icon={<Scissors className="h-12 w-12 text-neutral-500" />}
            heading={t('catalog.servico.empty.heading')}
            body={t('catalog.servico.empty.body')}
            cta={
              <Button onClick={() => setDialog({ open: true })}>
                {t('catalog.servico.empty.cta')}
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'name',
            header: t('catalog.servico.table.name'),
            cell: (r) => (
              <div className="flex items-center gap-2">
                <EntityAvatar
                  name={r.name}
                  kind="service"
                  imageUrl={r.coverImageUrl}
                />
                <span className="font-semibold text-neutral-800">{r.name}</span>
              </div>
            ),
          },
          {
            key: 'category',
            header: t('catalog.servico.table.category'),
            cell: (r) => (
              <span className="text-neutral-500">{r.categoryName}</span>
            ),
          },
          {
            key: 'basePrice',
            header: t('catalog.servico.table.basePrice'),
            cell: (r) => (
              <span className="font-semibold text-neutral-800">
                {formatBRL(r.basePrice)}
              </span>
            ),
          },
          {
            key: 'duration',
            header: t('catalog.servico.table.duration'),
            cell: (r) => (
              <span className="text-neutral-500">
                {r.defaultDurationMinutes} min
              </span>
            ),
          },
          {
            key: 'variants',
            header: t('catalog.servico.table.variants'),
            cell: (r) =>
              r.variantCount > 0 ? (
                <Badge variant="secondary">{r.variantCount}</Badge>
              ) : (
                <span className="text-neutral-400">—</span>
              ),
          },
          {
            key: 'actions',
            header: t('catalog.servico.table.actions'),
            cell: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => setDialog({ open: true, initial: r.initial })}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <ConfirmSoftDeleteDialog
                    entityName={r.name}
                    entityKind="service"
                    onConfirm={() => handleDelete(r)}
                    trigger={
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Desativar
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />

      <Dialog
        open={dialog?.open ?? false}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.initial ? 'Editar serviço' : 'Novo serviço'}
            </DialogTitle>
          </DialogHeader>
          {dialog?.open && (
            <ServicoForm initial={dialog.initial} onClose={() => setDialog(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

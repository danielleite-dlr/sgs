import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { Folder, MoreHorizontal, Pencil, Trash2, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/layout/FilterBar';
import { DataTable } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  CategoriesQuery,
  ReorderCategoryMutation,
  SoftDeleteCategoryMutation,
} from '@/features/catalog/api/categorias.api';
import type {
  CategoriesQueryResult,
  ReorderCategoryResult,
  SoftDeleteCategoryResult,
} from '@/features/catalog/api/categorias.api';
import { CategoriaForm } from '@/features/catalog/components/CategoriaForm';
import type { CategoriaFormInitial } from '@/features/catalog/components/CategoriaForm';
import { ConfirmSoftDeleteDialog } from '@/features/catalog/components/ConfirmSoftDeleteDialog';
import { ReorderControls } from '@/features/catalog/components/ReorderControls';

interface FlatCategory {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  displayOrder: number;
  coverImageUrl: string | null;
  isFirst: boolean;
  isLast: boolean;
}

interface DialogState {
  open: boolean;
  initial?: CategoriaFormInitial;
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

export function CategoriasPage() {
  const { t } = useTranslation();
  const { data, loading } = useQuery<CategoriesQueryResult>(CategoriesQuery);

  const [reorder] = useMutation<ReorderCategoryResult>(ReorderCategoryMutation, {
    refetchQueries: [{ query: CategoriesQuery }],
  });

  const [softDelete] = useMutation<SoftDeleteCategoryResult>(SoftDeleteCategoryMutation, {
    refetchQueries: [{ query: CategoriesQuery }],
  });

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    document.title = t('pages.categorias.tab');
  }, [t]);

  // Flatten category tree: root categories first, then their children
  const flat = useMemo<FlatCategory[]>(() => {
    if (!data?.categories) return [];

    const items: FlatCategory[] = [];

    const sortedRoots = [...data.categories]
      .filter((c) => c.parentId === null)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'pt-BR'));

    for (const root of sortedRoots) {
      items.push({
        id: root.id,
        name: root.name,
        parentId: null,
        parentName: null,
        displayOrder: root.displayOrder,
        coverImageUrl: root.coverImageUrl ?? null,
        isFirst: false,
        isLast: false,
      });

      const children = (root.children ?? [])
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder);

      for (const child of children) {
        items.push({
          id: child.id,
          name: child.name,
          parentId: root.id,
          parentName: root.name,
          displayOrder: child.displayOrder,
          coverImageUrl: child.coverImageUrl ?? null,
          isFirst: false,
          isLast: false,
        });
      }
    }

    // Mark first/last per parent group for reorder button disable logic
    const groups = new Map<string, FlatCategory[]>();
    for (const item of items) {
      const key = item.parentId ?? '__root__';
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      group.forEach((item, i) => {
        item.isFirst = i === 0;
        item.isLast = i === group.length - 1;
      });
    }

    // Apply search filter (mockup)
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? items.filter((it) => it.name.toLowerCase().includes(q))
      : items;

    return filtered;
  }, [data, searchTerm]);

  async function handleReorder(cat: FlatCategory, dir: 'UP' | 'DOWN') {
    const res = await reorder({ variables: { input: { id: cat.id, direction: dir } } });
    const errors = res.data?.reorderCategory.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
    }
  }

  async function handleDelete(cat: FlatCategory) {
    const res = await softDelete({ variables: { input: { id: cat.id } } });
    const errors = res.data?.softDeleteCategory.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
      return;
    }
    toast.success(t('catalog.softDelete.toastDeleted', { name: cat.name }));
  }

  return (
    <>
      <PageHeader
        title={t('pages.categorias.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.categorias.h1') },
        ]}
        cta={
          <Button onClick={() => setDialog({ open: true })}>
            {t('pages.categorias.newCta')}
          </Button>
        }
      />

      <FilterBar
        basicFilters={
          <div className="flex flex-wrap items-center gap-md">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-sm top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar categoria…"
                className="pl-9 h-9 text-sm"
              />
            </div>
            <label className="flex items-center gap-xs text-sm text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Apenas Ativos
            </label>
          </div>
        }
        advancedFilters={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="text-xs font-semibold text-neutral-600">Origem</span>
              <select className="rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white">
                <option>Todas</option>
                <option>Cadastro manual</option>
                <option>Importação</option>
              </select>
            </label>
            <label className="flex flex-col gap-xs">
              <span className="text-xs font-semibold text-neutral-600">Tipo</span>
              <select className="rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white">
                <option>Todos</option>
                <option>Apenas raízes</option>
                <option>Apenas subcategorias</option>
              </select>
            </label>
            <label className="flex flex-col gap-xs">
              <span className="text-xs font-semibold text-neutral-600">Cadastrada entre</span>
              <input
                type="text"
                placeholder="dd/mm/aaaa — dd/mm/aaaa"
                className="rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
              />
            </label>
          </div>
        }
        onClear={() => {
          setSearchTerm('');
          setOnlyActive(true);
        }}
        onExport={() => {
          /* mockup */
        }}
      />

      <p className="text-xs text-neutral-500 mt-md mb-sm">
        {flat.length} {flat.length === 1 ? 'registro' : 'registros'}
      </p>

      <DataTable<FlatCategory>
        rowKey={(r) => r.id}
        loading={loading}
        rows={flat}
        empty={
          <EmptyState
            icon={<Folder className="h-12 w-12 text-neutral-500" />}
            heading={t('catalog.categoria.empty.heading')}
            body={t('catalog.categoria.empty.body')}
            cta={
              <Button onClick={() => setDialog({ open: true })}>
                {t('catalog.categoria.empty.cta')}
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'name',
            header: t('catalog.categoria.table.name'),
            cell: (r) => (
              <div className="flex items-center gap-2">
                <EntityAvatar
                  name={r.name}
                  kind="category"
                  imageUrl={r.coverImageUrl}
                />
                <span className="font-semibold text-neutral-800">{r.name}</span>
              </div>
            ),
          },
          {
            key: 'parent',
            header: t('catalog.categoria.table.parent'),
            cell: (r) => (
              <span className="text-neutral-500">{r.parentName ?? '—'}</span>
            ),
          },
          {
            key: 'order',
            header: '',
            cell: (r) => (
              <ReorderControls
                itemName={r.name}
                isFirst={r.isFirst}
                isLast={r.isLast}
                onMove={(dir) => handleReorder(r, dir)}
              />
            ),
          },
          {
            key: 'actions',
            header: t('catalog.categoria.table.actions'),
            cell: (r) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      setDialog({
                        open: true,
                        initial: {
                          id: r.id,
                          name: r.name,
                          parentId: r.parentId,
                        },
                      })
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <ConfirmSoftDeleteDialog
                    entityName={r.name}
                    entityKind="category"
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
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {dialog?.initial ? 'Editar categoria' : 'Nova categoria'}
            </DialogTitle>
          </DialogHeader>
          {dialog?.open && (
            <CategoriaForm initial={dialog.initial} onClose={() => setDialog(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

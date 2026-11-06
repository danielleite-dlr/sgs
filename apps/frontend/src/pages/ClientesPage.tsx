import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Search, Users, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmSoftDeleteDialog } from '@/features/catalog/components/ConfirmSoftDeleteDialog';
import {
  ClientsListQuery,
  SoftDeleteClientMutation,
  RestoreClientMutation,
} from '@/features/clients/api/clients.api';
import type {
  ClientsListResult,
  SoftDeleteClientResult,
  RestoreClientResult,
} from '@/features/clients/api/clients.api';
import { formatCpf } from '@/features/clients/utils/cpf';
import { toDisplayName } from '@/lib/format-name';
import { formatPhoneBr } from '@/lib/format-phone';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

interface ClientRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
}

export function ClientesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  // 300ms debounce
  useEffect(() => {
    const id = setTimeout(() => setDebounced(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    document.title = t('pages.clientes.tab');
  }, [t]);

  const { data, loading } = useQuery<ClientsListResult>(ClientsListQuery, {
    variables: { search: debounced || null, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  });

  const rows: ClientRow[] = useMemo(() => data?.clients?.rows ?? [], [data]);
  const totalCount = data?.clients?.totalCount ?? 0;

  const queryVariables = { search: debounced || null, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };

  const [softDelete] = useMutation<SoftDeleteClientResult>(SoftDeleteClientMutation, {
    refetchQueries: [{ query: ClientsListQuery, variables: queryVariables }],
  });
  const [restore] = useMutation<RestoreClientResult>(RestoreClientMutation, {
    refetchQueries: [{ query: ClientsListQuery, variables: queryVariables }],
  });

  async function handleDelete(c: ClientRow) {
    const res = await softDelete({ variables: { input: { id: c.id } } });
    const errors = res.data?.softDeleteClient.errors ?? [];
    if (errors.length) {
      toast.error(errors[0].message);
      return;
    }
    toast(t('catalog.softDelete.toastDeleted', { name: toDisplayName(c.fullName) }), {
      action: {
        label: t('catalog.softDelete.toastUndo'),
        onClick: async () => {
          const r = await restore({ variables: { input: { id: c.id } } });
          if ((r.data?.restoreClient.errors ?? []).length === 0) {
            toast.success(t('catalog.softDelete.toastRestored', { name: toDisplayName(c.fullName) }));
          }
        },
      },
      duration: 5000,
    });
  }

  const hasRows = !loading && rows.length > 0;
  // Colunas totalmente vazias na página carregada não aparecem (UX-15).
  const hasEmail = rows.some((r) => !!r.email);
  const hasCpf = rows.some((r) => !!r.cpf);
  const columns: DataTableColumn<ClientRow>[] = [
    {
      key: 'name',
      header: t('clients.list.table.name'),
      sortable: false,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <EntityAvatar name={toDisplayName(r.fullName)} kind="client" />
          <ClientNameLink client={r} />
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('clients.list.table.phone'),
      cell: (r) => (r.phone ? formatPhoneBr(r.phone) : '—'),
    },
    ...(hasEmail
      ? [
          {
            key: 'email',
            header: t('clients.list.table.email'),
            cell: (r: ClientRow) => r.email || '—',
          },
        ]
      : []),
    ...(hasCpf
      ? [
          {
            key: 'cpf',
            header: t('clients.list.table.cpf'),
            cell: (r: ClientRow) => (r.cpf ? formatCpf(r.cpf) : '—'),
          },
        ]
      : []),
    {
      key: 'actions',
      header: t('clients.list.table.actions'),
      cell: (r) => <ClientActions client={r} onDelete={handleDelete} />,
    },
  ];

  const showSearchEmpty = !!debounced && rows.length === 0 && !loading;
  const showInitialEmpty = !debounced && rows.length === 0 && !loading;

  return (
    <>
      <PageHeader
        title={t('pages.clientes.h1')}
        cta={
          <Button onClick={() => navigate('/clientes/novo')}>
            {t('pages.clientes.newCta')}
          </Button>
        }
      />

      {/* Search bar — 300ms debounced */}
      <div className="mb-md flex items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('clients.list.search')}
            className="pl-9"
            aria-label={t('clients.list.search')}
          />
        </div>
      </div>

      {hasRows && (
        <ul className="space-y-sm md:hidden" data-testid="clientes-cards">
          {rows.map((r) => (
            <li
              key={r.id}
              data-testid="cliente-card"
              className="flex items-center gap-sm rounded-lg border border-neutral-200 bg-white p-sm"
            >
              <EntityAvatar name={toDisplayName(r.fullName)} kind="client" />
              <div className="min-w-0 flex-1">
                <ClientNameLink client={r} />
                {r.phone && (
                  <p className="text-sm text-neutral-600">{formatPhoneBr(r.phone)}</p>
                )}
              </div>
              <ClientActions client={r} onDelete={handleDelete} />
            </li>
          ))}
          {totalCount > PAGE_SIZE && (
            <li className="flex items-center justify-between pt-xs text-sm text-neutral-500">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * PAGE_SIZE >= totalCount}
                onClick={() => setPage(page + 1)}
              >
                Próximo
              </Button>
            </li>
          )}
        </ul>
      )}

      <div className={hasRows ? 'hidden md:block' : undefined} data-testid="clientes-table">
        <DataTable<ClientRow>
          rowKey={(r) => r.id}
          loading={loading}
          rows={rows}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          onPageChange={setPage}
          onRowClick={(r) => navigate(`/clientes/${r.id}`)}
          empty={
            showSearchEmpty ? (
              <EmptyState
                icon={<Search className="h-12 w-12 text-neutral-500" />}
                heading="Nenhum resultado"
                body={`Nenhum resultado para "${debounced}".`}
                cta={
                  <Button variant="ghost" onClick={() => setSearchInput('')}>
                    Limpar busca
                  </Button>
                }
              />
            ) : showInitialEmpty ? (
              <EmptyState
                icon={<Users className="h-12 w-12 text-neutral-500" />}
                heading={t('clients.empty.heading')}
                body={t('clients.empty.body')}
                cta={
                  <Button onClick={() => navigate('/clientes/novo')}>
                    {t('clients.empty.cta')}
                  </Button>
                }
              />
            ) : null
          }
          columns={columns}
        />
      </div>
    </>
  );
}

function ClientNameLink({ client }: { client: ClientRow }) {
  return (
    <Link
      to={`/clientes/${client.id}`}
      className="block truncate font-semibold text-primary-700 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {toDisplayName(client.fullName)}
    </Link>
  );
}

function ClientActions({
  client,
  onDelete,
}: {
  client: ClientRow;
  onDelete: (c: ClientRow) => Promise<void>;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ações de ${toDisplayName(client.fullName)}`}
          className="h-11 w-11 shrink-0"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => navigate(`/clientes/${client.id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <ConfirmSoftDeleteDialog
          entityName={toDisplayName(client.fullName)}
          entityKind="client"
          onConfirm={() => onDelete(client)}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-error-500">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({
  icon,
  heading,
  body,
  cta,
}: {
  icon: ReactNode;
  heading: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
      {icon}
      <h2 className="text-base font-semibold">{heading}</h2>
      <p className="text-sm text-neutral-500 max-w-md">{body}</p>
      {cta}
    </div>
  );
}

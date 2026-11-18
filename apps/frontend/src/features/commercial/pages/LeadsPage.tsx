import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMediaQuery } from '@/lib/use-media-query';
import { CommercialLeadsQuery, type CommercialLead } from '../api/leads.api';
import { useCommercialAccess } from '../commercial-permissions';
import { LeadFormDialog } from '../components/LeadFormDialog';
import { LeadImportDialog } from '../components/LeadImportDialog';
import { SOURCE_OPTIONS, formatDateTime, sourceLabel } from '../lib/commercial-labels';

const PAGE_SIZE = 50;
const SELECT_CLASS =
  'mt-xs block min-h-[44px] rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm';

export function LeadsPage() {
  const navigate = useNavigate();
  const { isManager } = useCommercialAccess();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [offset, setOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, loading, error, refetch } = useQuery<{
    commercialLeads: { items: CommercialLead[]; total: number };
  }>(CommercialLeadsQuery, {
    variables: {
      filter: {
        search: search || null,
        source: source || null,
        unassigned: isManager && unassigned ? true : null,
        limit: PAGE_SIZE,
        offset,
      },
    },
    fetchPolicy: 'cache-and-network',
  });
  const leads = data?.commercialLeads.items ?? [];
  const total = data?.commercialLeads.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Leads"
        cta={
          <>
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-xs h-4 w-4" aria-hidden="true" />
              Importar planilha
            </Button>
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
              Novo lead
            </Button>
          </>
        }
      />

      <div className="mb-md flex flex-wrap items-end gap-md">
        <div className="min-w-[200px] flex-1">
          <Label className="text-xs font-semibold text-neutral-700" htmlFor="lead-search">
            Buscar
          </Label>
          <Input
            id="lead-search"
            className="mt-xs"
            placeholder="Nome, telefone ou e-mail"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-neutral-700" htmlFor="lead-source-filter">
            Origem
          </Label>
          <select
            id="lead-source-filter"
            className={SELECT_CLASS}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todas</option>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {isManager && (
          <label className="flex min-h-[44px] items-center gap-xs text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={unassigned}
              onChange={(e) => {
                setUnassigned(e.target.checked);
                setOffset(0);
              }}
            />
            Sem responsável
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-md text-sm text-error-700">
          Não foi possível carregar os leads.
        </p>
      )}
      {loading && !data && <Skeleton className="h-40 w-full" />}
      {data && leads.length === 0 && (
        <p className="text-body text-neutral-600">Nenhum lead encontrado.</p>
      )}

      {leads.length > 0 && isDesktop && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Negócios abertos</TableHead>
              <TableHead>Última interação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => (
              <TableRow
                key={l.id}
                className="cursor-pointer"
                onClick={() => navigate(`/comercial/leads/${l.id}`)}
              >
                <TableCell className="font-semibold text-neutral-800">
                  <Link to={`/comercial/leads/${l.id}`} onClick={(e) => e.stopPropagation()}>
                    {l.fullName}
                  </Link>
                </TableCell>
                <TableCell>{l.phone ?? '—'}</TableCell>
                <TableCell>{sourceLabel(l.source)}</TableCell>
                <TableCell>{l.openDeals}</TableCell>
                <TableCell>{formatDateTime(l.lastInteractionAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {leads.length > 0 && !isDesktop && (
        <ul className="space-y-sm">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                to={`/comercial/leads/${l.id}`}
                className="block rounded-md border border-neutral-200 bg-white p-md"
              >
                <p className="break-words font-semibold text-neutral-800">{l.fullName}</p>
                <p className="text-sm text-neutral-600">{l.phone ?? l.email ?? '—'}</p>
                <div className="mt-xs flex flex-wrap items-center gap-xs">
                  <Badge variant="secondary">{sourceLabel(l.source)}</Badge>
                  <span className="text-xs text-neutral-600">
                    {l.openDeals} negócio(s) aberto(s)
                  </span>
                </div>
                <p className="mt-xs text-xs text-neutral-500">
                  Última interação: {formatDateTime(l.lastInteractionAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-md flex items-center justify-between gap-sm">
          <Button
            type="button"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Anterior
          </Button>
          <span className="text-sm text-neutral-600">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Próxima
          </Button>
        </div>
      )}

      {formOpen && (
        <LeadFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={(l) => navigate(`/comercial/leads/${l.id}`)}
        />
      )}
      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void refetch()}
      />
    </div>
  );
}

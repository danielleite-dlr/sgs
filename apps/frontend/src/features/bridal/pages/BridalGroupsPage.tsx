import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BridalGroupsQuery, type BridalGroupsResult } from '../api/bridal.api';
import { useBridalPermission } from '../bridal-permissions';
import { BridalGroupFormDialog } from '../components/BridalGroupFormDialog';
import {
  CONTRACT_STATUS_LABEL,
  GROUP_STATUS_LABEL,
  LOCATION_LABEL,
  ROLE_LABEL,
  formatEventDate,
} from '../lib/bridal-labels';

export function BridalGroupsPage() {
  const navigate = useNavigate();
  const canWrite = useBridalPermission('bridal.write');
  const [status, setStatus] = useState('active');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error } = useQuery<BridalGroupsResult>(BridalGroupsQuery, {
    variables: { status: status || null, from: from || null, to: to || null },
    fetchPolicy: 'cache-and-network',
  });
  const groups = data?.bridalGroups ?? [];

  return (
    <div>
      <PageHeader
        title="Grupos de noivas"
        cta={
          canWrite ? (
            <Button onClick={() => setFormOpen(true)} data-testid="new-group">
              <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
              Novo grupo
            </Button>
          ) : undefined
        }
      />

      <div className="mb-md flex flex-wrap items-end gap-md">
        <div>
          <Label className="text-xs font-semibold text-neutral-700" htmlFor="grp-status">
            Status
          </Label>
          <select
            id="grp-status"
            data-testid="grp-status"
            className="mt-xs block rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Ativos</option>
            <option value="completed">Concluídos</option>
            <option value="cancelled">Cancelados</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-neutral-700" htmlFor="grp-from">
            Evento de
          </Label>
          <Input
            id="grp-from"
            type="date"
            className="mt-xs"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-neutral-700" htmlFor="grp-to">
            até
          </Label>
          <Input
            id="grp-to"
            type="date"
            className="mt-xs"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          Não foi possível carregar os grupos.
        </p>
      )}
      {loading && !data && <Skeleton className="h-40 w-full" />}
      {data && groups.length === 0 && (
        <p className="text-sm text-neutral-600" data-testid="groups-empty">
          Nenhum grupo de noivas ainda.
        </p>
      )}

      {groups.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
              <tr>
                <th className="p-sm">Grupo</th>
                <th className="p-sm">Data do evento</th>
                <th className="p-sm">Noiva</th>
                <th className="p-sm">Pessoas</th>
                <th className="p-sm">Local</th>
                <th className="p-sm">Status</th>
                <th className="p-sm">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const bride = g.members.find((m) => m.role === 'bride');
                return (
                  <tr
                    key={g.id}
                    className="border-t border-neutral-200 hover:bg-neutral-50"
                    data-testid={`group-row-${g.id}`}
                  >
                    <td className="p-sm font-semibold">
                      <Link
                        to={`/noivas/${g.id}`}
                        className="text-primary-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2"
                      >
                        {g.name}
                      </Link>
                    </td>
                    <td className="p-sm">{formatEventDate(g.eventDate)}</td>
                    <td className="p-sm">{bride?.clientName ?? ROLE_LABEL.bride}</td>
                    <td className="p-sm">{g.members.length}</td>
                    <td className="p-sm">{LOCATION_LABEL[g.locationKind] ?? g.locationKind}</td>
                    <td className="p-sm">{GROUP_STATUS_LABEL[g.status] ?? g.status}</td>
                    <td className="p-sm">
                      {g.contractCode ? (
                        <Badge variant="outline">
                          {g.contractCode}
                          {g.contractStatus
                            ? ` — ${CONTRACT_STATUS_LABEL[g.contractStatus] ?? g.contractStatus}`
                            : ''}
                        </Badge>
                      ) : (
                        <span className="text-neutral-600">Sem contrato</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <BridalGroupFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={(g) => navigate(`/noivas/${g.id}`)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BridalGroupQuery, type BridalGroupResult } from '../api/bridal.api';
import { useBridalPermission } from '../bridal-permissions';
import { AiSuggestionPanel } from '../components/AiSuggestionPanel';
import { BridalGroupFormDialog } from '../components/BridalGroupFormDialog';
import { BridalMembersCard } from '../components/BridalMembersCard';
import { CancelBridalGroupDialog } from '../components/CancelBridalGroupDialog';
import {
  CONTRACT_STATUS_LABEL,
  GROUP_STATUS_LABEL,
  LOCATION_LABEL,
  formatEventDate,
} from '../lib/bridal-labels';
import { toZoned } from '../lib/schedule-rows';

export function BridalGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useBridalPermission('bridal.write');
  const canCancel = useBridalPermission('contract.cancel');
  const canContract = useBridalPermission('contract.write');
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery<BridalGroupResult>(BridalGroupQuery, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });
  const group = data?.bridalGroup ?? null;

  if (!group) {
    return (
      <div data-group-id={id}>
        <PageHeader
          title="Grupo de noivas"
          breadcrumbs={[{ label: 'Noivas', to: '/noivas' }, { label: 'Grupo' }]}
        />
        {loading && <Skeleton className="h-40 w-full" />}
        {!loading && (error || data) && (
          <p role="alert" className="text-sm text-error">
            Grupo não encontrado.
          </p>
        )}
      </div>
    );
  }

  const active = group.status === 'active';

  return (
    <div data-group-id={group.id}>
      <PageHeader
        title={group.name}
        breadcrumbs={[{ label: 'Noivas', to: '/noivas' }, { label: group.name }]}
        cta={
          <div className="flex flex-wrap gap-sm">
            {canWrite && active && (
              <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="edit-group">
                Editar
              </Button>
            )}
            {canCancel && active && (
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                data-testid="cancel-group"
              >
                Cancelar grupo
              </Button>
            )}
            {group.contractId ? (
              <Button asChild>
                <Link to={`/contratos/${group.contractId}`} data-testid="view-contract">
                  Ver contrato {group.contractCode}
                </Link>
              </Button>
            ) : (
              canContract &&
              active && (
                <Button asChild>
                  <Link to={`/contratos?grupo=${group.id}`} data-testid="create-contract">
                    Criar contrato
                  </Link>
                </Button>
              )
            )}
          </div>
        }
      />

      <dl className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold text-neutral-700">Data do evento</dt>
          <dd>{formatEventDate(group.eventDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-700">Pronta até</dt>
          <dd>{group.readyBy ? toZoned(group.readyBy).time : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-700">Local</dt>
          <dd>
            {LOCATION_LABEL[group.locationKind] ?? group.locationKind}
            {group.locationKind === 'external' && (
              <span className="block text-xs text-neutral-600">
                {group.locationAddress} — deslocamento {group.travelMinutesBefore} min antes /{' '}
                {group.travelMinutesAfter} min depois
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-700">Pacote contratado</dt>
          <dd data-testid="bg-detail-package">{group.packageName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-700">Status</dt>
          <dd className="flex items-center gap-xs">
            {GROUP_STATUS_LABEL[group.status] ?? group.status}
            {group.contractStatus && (
              <Badge variant="outline">
                {CONTRACT_STATUS_LABEL[group.contractStatus] ?? group.contractStatus}
              </Badge>
            )}
          </dd>
        </div>
      </dl>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">Pessoas</TabsTrigger>
          <TabsTrigger value="schedule">Agenda do evento</TabsTrigger>
        </TabsList>
        <TabsContent value="people">
          <BridalMembersCard group={group} />
        </TabsContent>
        <TabsContent value="schedule">
          <AiSuggestionPanel group={group} onScheduled={() => void refetch()} />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <BridalGroupFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          group={group}
          onSaved={() => void refetch()}
        />
      )}
      {cancelOpen && (
        <CancelBridalGroupDialog
          groupId={group.id}
          groupName={group.name}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onCancelled={() => void refetch()}
        />
      )}
    </div>
  );
}

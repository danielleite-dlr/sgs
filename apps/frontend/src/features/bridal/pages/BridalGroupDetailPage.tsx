import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { toDisplayName } from '@/lib/format-name';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmByNameDialog } from '@/components/ui/confirm-by-name-dialog';
import {
  BridalGroupQuery,
  DeleteBridalGroupPermanentlyMutation,
  type BridalGroupResult,
  type DeleteBridalGroupPermanentlyResult,
} from '../api/bridal.api';
import { useBridalPermission } from '../bridal-permissions';
import { AiSuggestionPanel } from '../components/AiSuggestionPanel';
import { BridalAssistantCard } from '../components/BridalAssistantCard';
import { BridalTrialCard } from '../components/BridalTrialCard';
import { BridalGroupFormDialog } from '../components/BridalGroupFormDialog';
import { BridalMembersCard } from '../components/BridalMembersCard';
import { BridalTimelineTab } from '../components/BridalTimelineTab';
import { CancelBridalGroupDialog } from '../components/CancelBridalGroupDialog';
import {
  CONTRACT_STATUS_CAPTION,
  CONTRACT_STATUS_LABEL,
  EVENT_KIND_LABEL,
  GROUP_STATUS_LABEL,
  LOCATION_LABEL,
  formatEventDate,
} from '../lib/bridal-labels';
import { BridalTimelineQuery, type BridalTimelineResult } from '../api/timeline.api';
import { toZoned } from '../lib/schedule-rows';

const GROUP_STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'error'> = {
  active: 'success',
  completed: 'neutral',
  cancelled: 'error',
};

export function BridalGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canWrite = useBridalPermission('bridal.write');
  const canCancel = useBridalPermission('contract.cancel');
  const canContract = useBridalPermission('contract.write');
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tab, setTab] = useState<'people' | 'timeline' | 'schedule'>('people');
  const navigate = useNavigate();
  const [deleteGroup, { loading: deleting }] = useMutation<DeleteBridalGroupPermanentlyResult>(
    DeleteBridalGroupPermanentlyMutation,
  );

  const { data, loading, error, refetch } = useQuery<BridalGroupResult>(BridalGroupQuery, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });
  const group = data?.bridalGroup ?? null;
  // Mesma query/variáveis da BridalTimelineTab: cache compartilhado.
  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
  } = useQuery<BridalTimelineResult>(BridalTimelineQuery, {
    variables: { groupId: id },
    skip: !id,
  });
  const timelineConfirmed = !!timelineData?.bridalTimeline?.confirmedAt;
  const showTimelineHint = !timelineLoading && !timelineError && !timelineConfirmed;

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
        title={toDisplayName(group.name)}
        breadcrumbs={[{ label: 'Noivas', to: '/noivas' }, { label: toDisplayName(group.name) }]}
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
                className="text-error-600"
                onClick={() => setCancelOpen(true)}
                data-testid="cancel-group"
              >
                Cancelar grupo
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-error-600"
                onClick={() => setDeleteOpen(true)}
                data-testid="delete-group-permanent"
              >
                Excluir definitivamente
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

      <dl
        data-testid="bg-detail-sheet"
        className="mb-md grid grid-cols-2 gap-x-md gap-y-sm rounded-md border border-neutral-200 bg-white p-md sm:grid-cols-4"
      >
        <div>
          <dt className="text-overline uppercase text-neutral-500">Tipo de evento</dt>
          <dd className="text-body text-neutral-800" data-testid="bg-detail-kind">
            <Badge variant="outline">{EVENT_KIND_LABEL[group.eventKind] ?? group.eventKind}</Badge>
          </dd>
        </div>
        {group.eventKind === 'debutante' && (
          <div>
            <dt className="text-overline uppercase text-neutral-500">Responsável</dt>
            <dd className="text-body text-neutral-800" data-testid="bg-detail-responsible">
              {group.responsibleName ?? <span className="text-warning-700">não definida</span>}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-overline uppercase text-neutral-500">Horário do evento</dt>
          <dd className="text-body tabular-nums text-neutral-800" data-testid="bg-detail-event-time">
            {group.eventTime ?? 'não informado'}
          </dd>
        </div>
        <div>
          <dt className="text-overline uppercase text-neutral-500">Data do evento</dt>
          <dd className="text-body tabular-nums text-neutral-800">
            {formatEventDate(group.eventDate)}
          </dd>
        </div>
        {group.readyBy && (
          <div>
            <dt className="text-overline uppercase text-neutral-500">Pronta até</dt>
            <dd className="text-body tabular-nums text-neutral-800" data-testid="bg-detail-ready-by">
              {toZoned(group.readyBy).time}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-overline uppercase text-neutral-500">Local</dt>
          <dd className="text-body font-medium text-neutral-800">
            {LOCATION_LABEL[group.locationKind] ?? group.locationKind}
            {group.locationName && (
              <span
                className="block text-[12px] font-normal text-neutral-500"
                data-testid="bg-detail-location-name"
              >
                {group.locationName}
              </span>
            )}
            {group.locationAddress && (
              <span
                className="block text-[12px] font-normal text-neutral-500"
                data-testid="bg-detail-location-address"
              >
                Endereço do atendimento: {group.locationAddress}
              </span>
            )}
            {group.locationKind === 'external' && (
              <span className="block text-[12px] font-normal text-neutral-500">
                Deslocamento {group.travelMinutesBefore} min antes / {group.travelMinutesAfter} min
                depois
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-overline uppercase text-neutral-500">Pacote contratado</dt>
          <dd className="text-body text-neutral-800" data-testid="bg-detail-package">
            {group.packageName ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-overline uppercase text-neutral-500">Status</dt>
          <dd className="text-body text-neutral-800">
            <Badge
              variant={GROUP_STATUS_VARIANT[group.status] ?? 'neutral'}
              data-testid="group-status"
            >
              {GROUP_STATUS_LABEL[group.status] ?? group.status}
            </Badge>
            {group.contractStatus && (
              <p className="mt-xs text-[12px] text-neutral-500" data-testid="group-contract-status">
                {CONTRACT_STATUS_CAPTION[group.contractStatus] ??
                  `Contrato: ${CONTRACT_STATUS_LABEL[group.contractStatus] ?? group.contractStatus}`}
              </p>
            )}
          </dd>
        </div>
      </dl>

      <BridalAssistantCard group={group} canWrite={canWrite && active} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="people">Pessoas</TabsTrigger>
          <TabsTrigger value="timeline">Cronograma do dia</TabsTrigger>
          <TabsTrigger value="schedule">Agenda do evento</TabsTrigger>
        </TabsList>
        <TabsContent value="people">
          <BridalMembersCard group={group} />
        </TabsContent>
        <TabsContent value="timeline">
          <BridalTimelineTab group={group} onChanged={() => void refetch()} />
        </TabsContent>
        <TabsContent value="schedule">
          <div className="space-y-lg">
            {showTimelineHint && (
              <div
                role="status"
                data-testid="schedule-needs-timeline"
                className="flex flex-col gap-sm rounded-md border border-warning-500/40 bg-warning-50 p-md sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-body text-neutral-800">
                  Confirme primeiro o cronograma do dia: ao confirmar, make e penteado da{' '}
                  {group.eventKind === 'debutante' ? 'debutante' : 'noiva'} já entram na agenda.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="schedule-go-timeline"
                  onClick={() => setTab('timeline')}
                >
                  Ir para o cronograma do dia
                </Button>
              </div>
            )}
            <BridalTrialCard group={group} onScheduled={() => void refetch()} />
            <AiSuggestionPanel group={group} onScheduled={() => void refetch()} />
          </div>
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
      {deleteOpen && (
        <ConfirmByNameDialog
          open={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) setDeleteError(null);
          }}
          title={`Excluir ${group.name} definitivamente?`}
          description={
            <>
              <p className="font-semibold text-error-500">Esta ação é irreversível.</p>
              <p>Vamos apagar do banco tudo deste grupo:</p>
              <ul className="list-disc pl-lg">
                <li>as pessoas do grupo e os serviços de cada uma;</li>
                <li>os agendamentos e os deslocamentos;</li>
                <li>o(s) contrato(s), as parcelas e os pagamentos;</li>
                <li>os lançamentos de caixa e as comandas do grupo.</li>
              </ul>
              <p>As clientes continuam cadastradas.</p>
            </>
          }
          expectedName={group.name}
          loading={deleting}
          error={deleteError}
          onConfirm={() => {
            void (async () => {
              const res = await deleteGroup({
                variables: { id: group.id },
                refetchQueries: ['BridalGroups'],
              });
              const payload = res.data?.deleteBridalGroupPermanently;
              if (!payload) return;
              if (payload.errors.length) {
                setDeleteError(payload.errors[0].message);
                return;
              }
              toast.success(`${group.name} foi excluído definitivamente.`);
              navigate('/noivas');
            })();
          }}
        />
      )}
    </div>
  );
}

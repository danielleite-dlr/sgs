import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmByNameDialog } from '@/components/ui/confirm-by-name-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AssignCommercialDealMutation,
  MoveCommercialDealMutation,
  type CommercialDealPayload,
} from '../api/deals.api';
import {
  CommercialAssigneesQuery,
  CommercialLeadQuery,
  CommercialStagesQuery,
  DeleteCommercialLeadMutation,
  type CommercialDeal,
  type CommercialLead,
  type CommercialMember,
  type CommercialOkPayload,
  type CommercialStage,
} from '../api/leads.api';
import { useCommercialAccess } from '../commercial-permissions';
import { DealFormDialog } from '../components/DealFormDialog';
import { InteractionFormDialog } from '../components/InteractionFormDialog';
import { LeadFormDialog } from '../components/LeadFormDialog';
import {
  KIND_LABEL,
  firstError,
  formatDateTime,
  formatMoney,
  formatYmd,
  interactionTypeLabel,
  sourceLabel,
} from '../lib/commercial-labels';

const SELECT_CLASS =
  'min-h-[44px] rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm';

function DealCard({
  deal,
  stages,
  assignees,
  isManager,
  canWin,
  onEdit,
  onChanged,
}: {
  deal: CommercialDeal;
  stages: CommercialStage[];
  assignees: CommercialMember[];
  isManager: boolean;
  canWin: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [moveDeal] = useMutation<{ moveCommercialDeal: CommercialDealPayload }>(
    MoveCommercialDealMutation,
  );
  const [assignDeal] = useMutation<{ assignCommercialDeal: CommercialDealPayload }>(
    AssignCommercialDealMutation,
  );
  const isOpen = deal.stage.kind === 'open';
  const openStages = stages.filter((s) => s.kind === 'open');
  const q = `/comercial/pipeline?negocio=${deal.id}`;
  const title = KIND_LABEL[deal.kind] ?? deal.kind;

  async function move(stageId: string) {
    const res = await moveDeal({ variables: { id: deal.id, stageId } });
    const p = res.data?.moveCommercialDeal;
    if (p?.errors.length) toast.error(firstError(p.errors, 'Não foi possível mover.'));
    else onChanged();
  }
  async function assign(memberId: string) {
    const res = await assignDeal({
      variables: { id: deal.id, assigneeMemberId: memberId || null },
    });
    const p = res.data?.assignCommercialDeal;
    if (p?.errors.length) toast.error(firstError(p.errors, 'Não foi possível trocar o responsável.'));
    else onChanged();
  }

  return (
    <li
      className="rounded-md border border-neutral-200 border-l-4 bg-white p-md"
      style={{ borderLeftColor: deal.stage.color }}
      data-testid={`deal-${deal.id}`}
    >
      <div className="flex flex-wrap items-center gap-xs">
        <h3 className="font-serif text-base font-semibold text-neutral-800">
          {title}
          {deal.beneficiaryName ? ` — ${deal.beneficiaryName}` : ''}
        </h3>
        <Badge variant="secondary">{deal.stage.name}</Badge>
        {deal.overdue && <Badge variant="destructive">Atrasado</Badge>}
      </div>
      <dl className="mt-sm grid grid-cols-1 gap-x-md gap-y-xs text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Data do evento</dt>
          <dd>{formatYmd(deal.eventDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Pacote</dt>
          <dd>{deal.packageName ?? deal.package?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Desconto</dt>
          <dd>{formatMoney(deal.discountAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Valor final</dt>
          <dd className="font-semibold">{formatMoney(deal.finalAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Responsável</dt>
          <dd>{deal.assignee?.displayName ?? 'Sem responsável'}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Origem</dt>
          <dd>{sourceLabel(deal.source)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-neutral-500">Local</dt>
          <dd className="break-words">{deal.location ?? '—'}</dd>
        </div>
      </dl>

      {isOpen && (
        <div className="mt-md flex flex-wrap items-center gap-sm">
          <select
            aria-label="Mover para a etapa"
            className={SELECT_CLASS}
            value={deal.stage.id}
            onChange={(e) => void move(e.target.value)}
          >
            {openStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {isManager && (
            <select
              aria-label="Responsável"
              className={SELECT_CLASS}
              value={deal.assignee?.id ?? ''}
              onChange={(e) => void assign(e.target.value)}
            >
              <option value="">Sem responsável</option>
              {assignees.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          )}
          <Button type="button" variant="outline" className="shrink-0" onClick={onEdit}>
            Editar
          </Button>
          {canWin && (
            <Button asChild variant="outline" className="shrink-0">
              <Link to={`${q}&acao=ganhar`}>Marcar ganho</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="shrink-0">
            <Link to={`${q}&acao=perder`}>Marcar perdido</Link>
          </Button>
        </div>
      )}
    </li>
  );
}

export function LeadDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isManager, canWin } = useCommercialAccess();
  const [editOpen, setEditOpen] = useState(false);
  const [dealForm, setDealForm] = useState<{ open: boolean; deal?: CommercialDeal }>({
    open: false,
  });
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<{ commercialLead: CommercialLead | null }>(
    CommercialLeadQuery,
    { variables: { id, limit: 100 }, fetchPolicy: 'cache-and-network', skip: !id },
  );
  const { data: stagesData } = useQuery<{ commercialStages: CommercialStage[] }>(
    CommercialStagesQuery,
  );
  const { data: assigneesData } = useQuery<{ commercialAssignees: CommercialMember[] }>(
    CommercialAssigneesQuery,
    { skip: !isManager },
  );
  const [deleteLead, { loading: deleting }] = useMutation<{
    deleteCommercialLead: CommercialOkPayload;
  }>(DeleteCommercialLeadMutation);

  const lead = data?.commercialLead ?? null;
  const stages = stagesData?.commercialStages ?? [];
  const assignees = assigneesData?.commercialAssignees ?? [];

  if (loading && !data) return <Skeleton className="h-40 w-full" />;
  if (!lead) {
    return (
      <div>
        <PageHeader title="Lead não encontrado" />
        <Link to="/comercial/leads" className="text-sm font-semibold text-primary underline">
          Voltar para a lista de leads
        </Link>
      </div>
    );
  }

  const deals = lead.deals ?? [];
  const interactions = lead.interactions ?? [];
  const reload = () => void refetch();

  async function confirmDelete() {
    setDeleteError(null);
    try {
      const res = await deleteLead({ variables: { id } });
      const p = res.data?.deleteCommercialLead;
      if (!p?.ok) {
        setDeleteError(firstError(p?.errors, 'Não foi possível excluir o lead.'));
        return;
      }
      toast.success('Lead excluído.');
      navigate('/comercial/leads');
    } catch {
      setDeleteError('Não foi possível excluir o lead.');
    }
  }

  return (
    <div>
      <PageHeader
        title={lead.fullName}
        breadcrumbs={[
          { label: 'Leads', to: '/comercial/leads' },
          { label: lead.fullName },
        ]}
        cta={
          <>
            <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
              Editar lead
            </Button>
            {isManager && (
              <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                Excluir lead
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="interacoes">Interações</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-md space-y-md">
          <section className="rounded-md border border-neutral-200 bg-white p-md">
            <dl className="grid grid-cols-1 gap-x-md gap-y-xs text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-neutral-500">Telefone</dt>
                <dd>{lead.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">E-mail</dt>
                <dd className="break-all">{lead.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Origem</dt>
                <dd>{sourceLabel(lead.source)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Cliente ligada</dt>
                <dd>
                  {lead.client ? (
                    <Link
                      to={`/clientes/${lead.client.id}`}
                      className="font-semibold text-primary underline"
                    >
                      {lead.client.fullName}
                    </Link>
                  ) : (
                    'Ainda não é cliente'
                  )}
                </dd>
              </div>
              {lead.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-neutral-500">Observações</dt>
                  <dd className="whitespace-pre-wrap break-words">{lead.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
              <h2 className="font-serif text-lg font-semibold text-neutral-800">Negócios</h2>
              <Button type="button" className="shrink-0" onClick={() => setDealForm({ open: true })}>
                Novo negócio
              </Button>
            </div>
            {deals.length === 0 ? (
              <p className="text-sm text-neutral-600">Nenhum negócio ainda.</p>
            ) : (
              <ul className="space-y-sm">
                {deals.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    stages={stages}
                    assignees={assignees}
                    isManager={isManager}
                    canWin={canWin}
                    onEdit={() => setDealForm({ open: true, deal: d })}
                    onChanged={reload}
                  />
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="interacoes" className="mt-md">
          <div className="mb-sm flex justify-end">
            <Button type="button" className="shrink-0" onClick={() => setInteractionOpen(true)}>
              Registrar interação
            </Button>
          </div>
          {interactions.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhuma interação registrada.</p>
          ) : (
            <ol className="space-y-sm">
              {interactions.map((i) => (
                <li key={i.id} className="rounded-md border border-neutral-200 bg-white p-md">
                  <div className="flex flex-wrap items-center gap-xs text-sm">
                    <Badge variant="secondary">{interactionTypeLabel(i.type)}</Badge>
                    <span className="text-neutral-600">{formatDateTime(i.occurredAt)}</span>
                    {i.createdBy && (
                      <span className="text-neutral-500">por {i.createdBy.displayName}</span>
                    )}
                  </div>
                  {i.notes && (
                    <p className="mt-xs whitespace-pre-wrap break-words text-sm text-neutral-800">
                      {i.notes}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="lembretes" className="mt-md">
          <Link
            to={`/comercial/lembretes?lead=${lead.id}`}
            className="text-sm font-semibold text-primary underline"
          >
            Ver lembretes deste lead
          </Link>
        </TabsContent>
      </Tabs>

      {editOpen && (
        <LeadFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          lead={lead}
          onSaved={reload}
        />
      )}
      {dealForm.open && (
        <DealFormDialog
          open
          onOpenChange={(o) => !o && setDealForm({ open: false })}
          leadId={lead.id}
          deal={dealForm.deal}
          defaultSource={lead.source}
          onSaved={reload}
        />
      )}
      {interactionOpen && (
        <InteractionFormDialog
          open
          onOpenChange={setInteractionOpen}
          leadId={lead.id}
          deals={deals}
          onSaved={reload}
        />
      )}
      {isManager && (
        <ConfirmByNameDialog
          open={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) setDeleteError(null);
          }}
          title={`Excluir ${lead.fullName}?`}
          description="O lead sai da lista e dos relatórios. Os negócios e o histórico ficam preservados."
          expectedName={lead.fullName}
          confirmLabel="Excluir lead"
          loading={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

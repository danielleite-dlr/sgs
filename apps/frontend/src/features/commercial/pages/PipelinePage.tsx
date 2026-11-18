import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CommercialDealQuery,
  CommercialDealsQuery,
  type CommercialDeal,
} from '../api/deals.api';
import { CommercialAssigneesQuery, CommercialStagesQuery } from '../api/leads.api';
import type { CommercialMember, CommercialStage } from '../api/leads.api';
import { useCommercialAccess } from '../commercial-permissions';
import { PipelineBoard } from '../components/PipelineBoard';
import { KIND_LABEL } from '../lib/commercial-labels';

const SELECT_CLASS =
  'mt-xs block min-h-[44px] rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm';

export function PipelinePage() {
  const { isManager, canWin } = useCommercialAccess();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState('');
  const [assignee, setAssignee] = useState(''); // '' = todos, 'none' = sem responsável, id
  const [dealToWin, setDealToWin] = useState<CommercialDeal | null>(null);
  const [dealToLose, setDealToLose] = useState<CommercialDeal | null>(null);

  const filter = {
    closedSinceDays: 30,
    kind: kind || null,
    assigneeMemberId: assignee && assignee !== 'none' ? assignee : null,
    unassigned: assignee === 'none' ? true : null,
  };
  const { data, loading, refetch } = useQuery<{
    commercialDeals: { items: CommercialDeal[] };
  }>(CommercialDealsQuery, { variables: { filter } });
  const { data: stagesData } = useQuery<{ commercialStages: CommercialStage[] }>(
    CommercialStagesQuery,
  );
  const { data: membersData } = useQuery<{ commercialAssignees: CommercialMember[] }>(
    CommercialAssigneesQuery,
    { skip: !isManager },
  );

  // Links da ficha do lead: /comercial/pipeline?negocio=ID&acao=ganhar|perder
  const negocioId = params.get('negocio');
  const acao = params.get('acao');
  const { data: linked } = useQuery<{ commercialDeal: CommercialDeal | null }>(
    CommercialDealQuery,
    { variables: { id: negocioId }, skip: !negocioId || !acao },
  );
  const linkedDeal = linked?.commercialDeal ?? null;
  useEffect(() => {
    if (!linkedDeal || !acao) return;
    if (acao === 'ganhar') {
      if (canWin) setDealToWin(linkedDeal);
      else toast.error('Você não tem permissão para marcar negócios como ganhos.');
    } else if (acao === 'perder') {
      setDealToLose(linkedDeal);
    }
    setParams({}, { replace: true });
  }, [linkedDeal, acao, canWin, setParams]);

  const stages = stagesData?.commercialStages ?? [];
  const deals = data?.commercialDeals.items ?? [];

  return (
    <div>
      <PageHeader
        title="Pipeline"
        cta={
          isManager ? (
            <Link
              to="/comercial/configuracoes?aba=etapas"
              className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-primary-700 underline"
            >
              Configurar etapas
            </Link>
          ) : undefined
        }
      />
      <div className="mb-md flex flex-wrap gap-md">
        <div>
          <Label htmlFor="pipeline-kind" className="text-xs font-semibold text-neutral-700">
            Tipo
          </Label>
          <select
            id="pipeline-kind"
            className={SELECT_CLASS}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(KIND_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {isManager && (
          <div>
            <Label htmlFor="pipeline-assignee" className="text-xs font-semibold text-neutral-700">
              Responsável
            </Label>
            <select
              id="pipeline-assignee"
              className={SELECT_CLASS}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="none">Sem responsável</option>
              {(membersData?.commercialAssignees ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {loading && stages.length === 0 ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <PipelineBoard
          stages={stages}
          deals={deals}
          onWin={setDealToWin}
          onLose={setDealToLose}
        />
      )}
      {/* Task 2 monta WinDealDialog/LoseDealDialog com dealToWin/dealToLose e refetch. */}
      <span hidden data-win={dealToWin?.id} data-lose={dealToLose?.id} onClick={() => refetch()} />
    </div>
  );
}

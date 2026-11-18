import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CommercialLeadNameQuery,
  CommercialReminderCountsQuery,
  CommercialReminderQuery,
  CommercialRemindersQuery,
  CompleteCommercialReminderMutation,
  DeleteCommercialReminderMutation,
  type CommercialReminder,
} from '../api/reminders.api';
import { ReminderFormDialog } from '../components/ReminderFormDialog';
import { KIND_LABEL, firstError, formatDateTime, formatYmd } from '../lib/commercial-labels';

type Segment = 'overdue' | 'today' | 'upcoming' | 'done';

const SEGMENTS: { code: Segment; label: string }[] = [
  { code: 'overdue', label: 'Vencidos' },
  { code: 'today', label: 'Hoje' },
  { code: 'upcoming', label: 'Próximos' },
  { code: 'done', label: 'Concluídos' },
];

const PAGE_SIZE = 100;

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

/** Em que segmento um lembrete aparece (usado ao abrir pelo push). */
function segmentOf(r: CommercialReminder): Segment {
  if (r.completedAt) return 'done';
  if (r.overdue) return 'overdue';
  return dayKey(r.dueAt) === dayKey(new Date().toISOString()) ? 'today' : 'upcoming';
}

interface ItemProps {
  reminder: CommercialReminder;
  highlight?: boolean;
  onComplete: (r: CommercialReminder, completed: boolean) => void;
  onEdit: (r: CommercialReminder) => void;
  onDelete: (r: CommercialReminder) => void;
}

function ReminderItem({ reminder: r, highlight, onComplete, onEdit, onDelete }: ItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlight && typeof ref.current?.scrollIntoView === 'function') {
      ref.current.scrollIntoView({ block: 'center' });
    }
  }, [highlight]);
  const done = !!r.completedAt;
  return (
    <li
      ref={ref}
      data-testid={`reminder-${r.id}`}
      data-highlight={highlight ? 'true' : undefined}
      className={`rounded-md border bg-white p-md ${
        highlight ? 'border-primary-500 ring-2 ring-primary-200' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-start gap-sm">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0"
          aria-label={done ? `Reabrir ${r.title}` : `Concluir ${r.title}`}
          checked={done}
          onChange={() => onComplete(r, !done)}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`break-words font-semibold ${
              done ? 'text-neutral-500 line-through' : 'text-neutral-800'
            }`}
          >
            {r.title}
          </p>
          {r.description && (
            <p className="break-words text-sm text-neutral-600">{r.description}</p>
          )}
          <div className="mt-xs flex flex-wrap items-center gap-xs text-xs text-neutral-600">
            <span className="tabular-nums">{formatDateTime(r.dueAt)}</span>
            {r.overdue && !done && <Badge variant="destructive">Vencido</Badge>}
            {r.lead && (
              <Link
                to={`/comercial/leads/${r.lead.id}`}
                className="font-semibold text-primary-700 underline"
              >
                {r.lead.fullName}
              </Link>
            )}
            {r.dealKind && (
              <span>
                {KIND_LABEL[r.dealKind] ?? r.dealKind}
                {r.dealEventDate ? ` · ${formatYmd(r.dealEventDate)}` : ''}
              </span>
            )}
            {r.dealStageName && <Badge variant="secondary">{r.dealStageName}</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-xs">
          {done && (
            <Button type="button" variant="outline" size="sm" onClick={() => onComplete(r, false)}>
              Reabrir
            </Button>
          )}
          {!done && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Editar ${r.title}`}
              onClick={() => onEdit(r)}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Excluir ${r.title}`}
            onClick={() => onDelete(r)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export function RemindersPage() {
  const [params, setParams] = useSearchParams();
  const highlightId = params.get('lembrete');
  const leadId = params.get('lead');

  const [segment, setSegment] = useState<Segment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialReminder | null>(null);

  const counts = useQuery<{ commercialReminderCounts: { overdue: number; today: number } }>(
    CommercialReminderCountsQuery,
    { fetchPolicy: 'cache-and-network' },
  );
  const overdueCount = counts.data?.commercialReminderCounts.overdue ?? 0;
  const todayCount = counts.data?.commercialReminderCounts.today ?? 0;

  const highlighted = useQuery<{ commercialReminder: CommercialReminder | null }>(
    CommercialReminderQuery,
    { variables: { id: highlightId }, skip: !highlightId, fetchPolicy: 'network-only' },
  );
  const pinned = highlighted.data?.commercialReminder ?? null;

  const leadInfo = useQuery<{ commercialLead: { id: string; fullName: string } | null }>(
    CommercialLeadNameQuery,
    { variables: { id: leadId }, skip: !leadId },
  );

  // Segmento inicial: o do lembrete vindo do push; senão Hoje (se houver) ou Vencidos.
  useEffect(() => {
    if (segment) return;
    if (highlightId) {
      if (pinned) setSegment(segmentOf(pinned));
      else if (!highlighted.loading) setSegment('today');
      return;
    }
    if (counts.data) setSegment(todayCount > 0 ? 'today' : 'overdue');
  }, [segment, highlightId, pinned, highlighted.loading, counts.data, todayCount]);

  const active: Segment = segment ?? 'today';
  const list = useQuery<{ commercialReminders: { items: CommercialReminder[]; total: number } }>(
    CommercialRemindersQuery,
    {
      variables: {
        filter: { status: active, leadId: leadId || null, limit: PAGE_SIZE, offset: 0 },
      },
      skip: !segment,
      fetchPolicy: 'cache-and-network',
    },
  );
  const items = (list.data?.commercialReminders.items ?? []).filter((r) => r.id !== pinned?.id);

  const [complete] = useMutation(CompleteCommercialReminderMutation);
  const [remove] = useMutation(DeleteCommercialReminderMutation);

  function refresh() {
    void list.refetch();
    void counts.refetch();
    if (highlightId) void highlighted.refetch();
  }

  async function handleComplete(r: CommercialReminder, completed: boolean) {
    try {
      const res = await complete({ variables: { id: r.id, completed } });
      const p = res.data?.completeCommercialReminder;
      if (!p?.reminder) {
        toast.error(firstError(p?.errors, 'Não foi possível atualizar o lembrete.'));
        return;
      }
      toast.success(completed ? 'Lembrete concluído' : 'Lembrete reaberto');
      refresh();
    } catch {
      toast.error('Não foi possível atualizar o lembrete.');
    }
  }

  async function handleDelete(r: CommercialReminder) {
    if (!window.confirm(`Excluir o lembrete "${r.title}"?`)) return;
    try {
      const res = await remove({ variables: { id: r.id } });
      const p = res.data?.deleteCommercialReminder;
      if (!p?.ok) {
        toast.error(firstError(p?.errors, 'Não foi possível excluir o lembrete.'));
        return;
      }
      toast.success('Lembrete excluído');
      refresh();
    } catch {
      toast.error('Não foi possível excluir o lembrete.');
    }
  }

  function clearLead() {
    const next = new URLSearchParams(params);
    next.delete('lead');
    setParams(next, { replace: true });
  }

  const itemHandlers = {
    onComplete: (r: CommercialReminder, c: boolean) => void handleComplete(r, c),
    onEdit: (r: CommercialReminder) => {
      setEditing(r);
      setFormOpen(true);
    },
    onDelete: (r: CommercialReminder) => void handleDelete(r),
  };

  const countOf = (code: Segment): number | null =>
    code === 'overdue' ? overdueCount : code === 'today' ? todayCount : null;

  return (
    <div>
      <PageHeader
        title="Lembretes"
        cta={
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-xs h-4 w-4" aria-hidden="true" />
            Novo lembrete
          </Button>
        }
      />

      {leadId && (
        <div className="mb-md flex flex-wrap items-center gap-sm text-sm text-neutral-700">
          <span>Filtrando por {leadInfo.data?.commercialLead?.fullName ?? 'lead'}</span>
          <Button type="button" variant="outline" size="sm" onClick={clearLead}>
            Limpar filtro
          </Button>
        </div>
      )}

      {highlightId && !highlighted.loading && !pinned && (
        <p role="alert" className="mb-md text-sm text-warning-700">
          Lembrete não encontrado ou sem acesso
        </p>
      )}

      <div role="tablist" aria-label="Situação" className="mb-md flex flex-wrap gap-xs">
        {SEGMENTS.map((s) => {
          const n = countOf(s.code);
          const selected = active === s.code;
          return (
            <button
              key={s.code}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSegment(s.code)}
              className={`min-h-[44px] shrink-0 rounded-md border px-md text-sm font-semibold ${
                selected
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-neutral-200 bg-white text-neutral-700'
              }`}
            >
              {s.label}
              {n != null && n > 0 && (
                <span
                  className={`ml-xs tabular-nums ${
                    s.code === 'overdue' ? 'text-error-700' : 'text-neutral-600'
                  }`}
                >
                  ({n})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {list.error && (
        <p role="alert" className="mb-md text-sm text-error-700">
          Não foi possível carregar os lembretes.
        </p>
      )}
      {(!segment || (list.loading && !list.data)) && <Skeleton className="h-32 w-full" />}

      <ul className="space-y-sm">
        {pinned && (
          <ReminderItem reminder={pinned} highlight {...itemHandlers} />
        )}
        {items.map((r) => (
          <ReminderItem key={r.id} reminder={r} {...itemHandlers} />
        ))}
      </ul>

      {list.data && items.length === 0 && !pinned && (
        <p className="text-body text-neutral-600">Nenhum lembrete nesta situação.</p>
      )}

      <ReminderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        reminder={editing}
        defaultLeadId={leadId}
        onSaved={refresh}
      />
    </div>
  );
}

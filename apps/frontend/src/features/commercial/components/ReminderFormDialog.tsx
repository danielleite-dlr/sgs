import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommercialLeadsQuery, type CommercialLead } from '../api/leads.api';
import {
  CreateCommercialReminderMutation,
  UpdateCommercialReminderMutation,
  type CommercialReminder,
  type CommercialReminderPayload,
} from '../api/reminders.api';
import { firstError } from '../lib/commercial-labels';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder?: CommercialReminder | null;
  defaultLeadId?: string | null;
  onSaved: () => void;
}

/** ISO UTC -> 'YYYY-MM-DDTHH:mm' na hora local do navegador. */
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ReminderFormDialog({
  open,
  onOpenChange,
  reminder,
  defaultLeadId,
  onSaved,
}: Props) {
  const editing = !!reminder;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [leadId, setLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(reminder?.title ?? '');
    setDescription(reminder?.description ?? '');
    setDueAt(reminder ? isoToLocal(reminder.dueAt) : '');
    setLeadId(defaultLeadId ?? '');
    setLeadSearch('');
    setError(null);
  }, [open, reminder, defaultLeadId]);

  const { data: leadsData } = useQuery<{
    commercialLeads: { items: CommercialLead[]; total: number };
  }>(CommercialLeadsQuery, {
    variables: { filter: { search: leadSearch.trim() || null, limit: 20, offset: 0 } },
    skip: !open || editing,
  });
  const leads = leadsData?.commercialLeads.items ?? [];

  const [createReminder, { loading: creating }] = useMutation<{
    createCommercialReminder: CommercialReminderPayload;
  }>(CreateCommercialReminderMutation);
  const [updateReminder, { loading: updating }] = useMutation<{
    updateCommercialReminder: CommercialReminderPayload;
  }>(UpdateCommercialReminderMutation);

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError('Informe o título do lembrete.');
      return;
    }
    const iso = localToIso(dueAt);
    if (!iso) {
      setError('Informe a data e a hora do lembrete.');
      return;
    }
    try {
      let payload: CommercialReminderPayload | undefined;
      if (reminder) {
        const res = await updateReminder({
          variables: {
            input: {
              id: reminder.id,
              title: title.trim(),
              description: description.trim() || null,
              dueAt: iso,
            },
          },
        });
        payload = res.data?.updateCommercialReminder;
      } else {
        const res = await createReminder({
          variables: {
            input: {
              title: title.trim(),
              description: description.trim() || null,
              dueAt: iso,
              leadId: leadId || null,
            },
          },
        });
        payload = res.data?.createCommercialReminder;
      }
      if (!payload?.reminder) {
        setError(firstError(payload?.errors, 'Não foi possível salvar o lembrete.'));
        return;
      }
      toast.success(editing ? 'Lembrete atualizado' : 'Lembrete criado');
      onSaved();
      onOpenChange(false);
    } catch {
      setError('Não foi possível salvar o lembrete. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[520px] overflow-y-auto">
        <DialogTitle className="font-serif text-base font-bold text-neutral-800">
          {editing ? 'Editar lembrete' : 'Novo lembrete'}
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          Você recebe um aviso no horário combinado.
        </DialogDescription>

        <div className="space-y-sm">
          <div>
            <Label className={LABEL_CLASS} htmlFor="rem-title">
              Título
            </Label>
            <Input
              id="rem-title"
              className="mt-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="rem-desc">
              Descrição
            </Label>
            <Textarea
              id="rem-desc"
              className="mt-xs"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="rem-due">
              Data e hora
            </Label>
            <Input
              id="rem-due"
              type="datetime-local"
              className="mt-xs"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          {!editing && (
            <div>
              <Label className={LABEL_CLASS} htmlFor="rem-lead-search">
                Lead (opcional)
              </Label>
              <Input
                id="rem-lead-search"
                className="mt-xs"
                placeholder="Buscar lead por nome ou telefone"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
              <select
                aria-label="Lead do lembrete"
                className="mt-xs min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              >
                <option value="">Sem lead</option>
                {leadId && !leads.some((l) => l.id === leadId) && (
                  <option value={leadId}>Lead selecionado</option>
                )}
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-error-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-sm">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={creating || updating}>
            {creating || updating ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

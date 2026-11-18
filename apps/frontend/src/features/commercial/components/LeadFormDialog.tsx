import { useEffect, useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CommercialDuplicateCheckQuery,
  CreateCommercialLeadMutation,
  LinkCommercialLeadClientMutation,
  UpdateCommercialLeadMutation,
  type CommercialDuplicateCheck,
  type CommercialLead,
  type CommercialLeadPayload,
} from '../api/leads.api';
import { SOURCE_OPTIONS, firstError } from '../lib/commercial-labels';
import { DuplicateWarning } from './DuplicateWarning';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';
const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm min-h-[44px]';
const DEBOUNCE_MS = 400;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando presente, edita o lead. */
  lead?: CommercialLead;
  onSaved: (lead: CommercialLead) => void;
}

export function LeadFormDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const editing = lead !== undefined;
  const [fullName, setFullName] = useState(lead?.fullName ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [source, setSource] = useState(lead?.source ?? 'manual');
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [linkedClientId, setLinkedClientId] = useState<string | null>(lead?.client?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const [checkDuplicates, { data: dupData }] = useLazyQuery<{
    commercialDuplicateCheck: CommercialDuplicateCheck;
  }>(CommercialDuplicateCheckQuery, { fetchPolicy: 'network-only' });

  const [createLead, { loading: creating }] = useMutation<{
    createCommercialLead: CommercialLeadPayload;
  }>(CreateCommercialLeadMutation);
  const [updateLead, { loading: updating }] = useMutation<{
    updateCommercialLead: CommercialLeadPayload;
  }>(UpdateCommercialLeadMutation);
  const [linkClient] = useMutation<{ linkCommercialLeadClient: CommercialLeadPayload }>(
    LinkCommercialLeadClientMutation,
  );
  const loading = creating || updating;

  // Debounce de 400 ms sobre telefone/e-mail (D-02).
  useEffect(() => {
    if (!open) return;
    const p = phone.trim();
    const e = email.trim();
    if (p.replace(/\D/g, '').length < 8 && !e.includes('@')) return;
    const t = setTimeout(() => {
      void checkDuplicates({
        variables: {
          phone: p || null,
          email: e || null,
          excludeLeadId: lead?.id ?? null,
        },
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [open, phone, email, lead?.id, checkDuplicates]);

  const dup = dupData?.commercialDuplicateCheck;

  async function submit() {
    setError(null);
    if (fullName.trim().length < 2) {
      setError('Informe o nome.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError('Informe telefone ou e-mail');
      return;
    }
    try {
      if (editing && lead) {
        const res = await updateLead({
          variables: {
            input: {
              id: lead.id,
              fullName: fullName.trim(),
              phone: phone.trim() || null,
              email: email.trim() || null,
              source,
              notes: notes.trim() || null,
            },
          },
        });
        const p = res.data?.updateCommercialLead;
        if (!p?.lead) {
          setError(firstError(p?.errors, 'Não foi possível salvar o lead.'));
          return;
        }
        let saved = p.lead;
        if ((lead.client?.id ?? null) !== linkedClientId) {
          const lr = await linkClient({ variables: { leadId: lead.id, clientId: linkedClientId } });
          const lp = lr.data?.linkCommercialLeadClient;
          if (!lp?.lead) {
            setError(firstError(lp?.errors, 'Não foi possível ligar a cliente.'));
            return;
          }
          saved = lp.lead;
        }
        toast.success('Lead atualizado.');
        onSaved(saved);
        onOpenChange(false);
        return;
      }
      const res = await createLead({
        variables: {
          input: {
            fullName: fullName.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            source,
            notes: notes.trim() || null,
            clientId: linkedClientId,
          },
        },
      });
      const p = res.data?.createCommercialLead;
      if (!p?.lead) {
        setError(firstError(p?.errors, 'Não foi possível salvar o lead.'));
        return;
      }
      toast.success('Lead cadastrado.');
      onSaved(p.lead);
      onOpenChange(false);
    } catch {
      setError('Não foi possível salvar o lead. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[560px] overflow-y-auto">
        <DialogTitle className="font-serif text-base font-bold text-neutral-800">
          {editing ? 'Editar lead' : 'Novo lead'}
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          Informe ao menos o telefone ou o e-mail para evitar cadastros repetidos.
        </DialogDescription>

        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className={LABEL_CLASS} htmlFor="lead-name">
              Nome
            </Label>
            <Input
              id="lead-name"
              className="mt-xs"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="lead-phone">
              Telefone
            </Label>
            <Input
              id="lead-phone"
              className="mt-xs"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="lead-email">
              E-mail
            </Label>
            <Input
              id="lead-email"
              type="email"
              className="mt-xs"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {dup && (
            <div className="sm:col-span-2">
              <DuplicateWarning
                clients={dup.clients}
                leads={dup.leads}
                linkedClientId={linkedClientId}
                onLinkClient={setLinkedClientId}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label className={LABEL_CLASS} htmlFor="lead-source">
              Origem
            </Label>
            <select
              id="lead-source"
              className={SELECT_CLASS}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className={LABEL_CLASS} htmlFor="lead-notes">
              Observações
            </Label>
            <Textarea
              id="lead-notes"
              className="mt-xs"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
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
          <Button type="button" onClick={() => void submit()} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

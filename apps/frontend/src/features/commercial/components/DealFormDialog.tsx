import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContractPackagesQuery, type ContractPackagesResult } from '@/features/bridal/api/contracts.api';
import { useCommercialAccess } from '../commercial-permissions';
import {
  CreateCommercialDealMutation,
  UpdateCommercialDealMutation,
  type CommercialDeal,
  type CommercialDealPayload,
} from '../api/deals.api';
import { CommercialAssigneesQuery, type CommercialMember } from '../api/leads.api';
import {
  KIND_LABEL,
  SOURCE_OPTIONS,
  centsToDecimal,
  firstError,
  formatMoney,
  toCents,
} from '../lib/commercial-labels';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';
const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm min-h-[44px]';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  /** Quando presente, edita o negócio. */
  deal?: CommercialDeal;
  /** Origem inicial (a do lead). */
  defaultSource?: string;
  onSaved: (deal: CommercialDeal) => void;
}

export function DealFormDialog({ open, onOpenChange, leadId, deal, defaultSource, onSaved }: Props) {
  const editing = deal !== undefined;
  const { isManager } = useCommercialAccess();
  const [kind, setKind] = useState<string>(deal?.kind ?? 'noiva');
  const [eventDate, setEventDate] = useState(deal?.eventDate?.slice(0, 10) ?? '');
  const [beneficiary, setBeneficiary] = useState(deal?.beneficiaryName ?? '');
  const [packageId, setPackageId] = useState(deal?.package?.id ?? '');
  const [discount, setDiscount] = useState(
    deal && deal.discountAmount !== '0.00' && deal.discountAmount !== '0'
      ? deal.discountAmount.replace('.', ',')
      : '',
  );
  const [assigneeId, setAssigneeId] = useState(deal?.assignee?.id ?? '');
  const [source, setSource] = useState(deal?.source ?? defaultSource ?? 'manual');
  const [location, setLocation] = useState(deal?.location ?? '');
  const [notes, setNotes] = useState(deal?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: pkgData } = useQuery<ContractPackagesResult>(ContractPackagesQuery, {
    skip: !open,
  });
  const { data: assigneesData } = useQuery<{ commercialAssignees: CommercialMember[] }>(
    CommercialAssigneesQuery,
    { skip: !open || !isManager },
  );
  const packages = pkgData?.packages ?? [];
  const assignees = assigneesData?.commercialAssignees ?? [];

  const [createDeal, { loading: creating }] = useMutation<{
    createCommercialDeal: CommercialDealPayload;
  }>(CreateCommercialDealMutation);
  const [updateDeal, { loading: updating }] = useMutation<{
    updateCommercialDeal: CommercialDealPayload;
  }>(UpdateCommercialDealMutation);
  const loading = creating || updating;

  // Valor final calculado em centavos (sem float).
  const selectedPkg = packages.find((p) => p.id === packageId);
  const priceStr = selectedPkg?.price ?? (packageId === deal?.package?.id ? deal?.package?.price : null);
  const priceCents = priceStr ? toCents(priceStr) : null;
  const discountCents = discount.trim() === '' ? 0 : toCents(discount);
  const discountInvalid = discountCents == null || discountCents < 0;
  const discountTooHigh = priceCents != null && discountCents != null && discountCents > priceCents;
  const finalCents =
    priceCents != null && discountCents != null && !discountInvalid && !discountTooHigh
      ? priceCents - discountCents
      : null;

  async function submit() {
    setError(null);
    if (discountInvalid) {
      setError('Desconto inválido.');
      return;
    }
    if (discountTooHigh) {
      setError('O desconto não pode ser maior que o preço do pacote.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate !== '') {
      setError('Data do evento inválida.');
      return;
    }
    const fields = {
      kind,
      eventDate: eventDate || null,
      beneficiaryName: kind === 'debutante' ? beneficiary.trim() || null : null,
      packageId: packageId || null,
      discountAmount: centsToDecimal(discountCents ?? 0),
      source,
      location: location.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (editing && deal) {
        const res = await updateDeal({ variables: { input: { id: deal.id, ...fields } } });
        const p = res.data?.updateCommercialDeal;
        if (!p?.deal) {
          setError(firstError(p?.errors, 'Não foi possível salvar o negócio.'));
          return;
        }
        toast.success('Negócio atualizado.');
        onSaved(p.deal);
        onOpenChange(false);
        return;
      }
      const res = await createDeal({
        variables: {
          input: {
            leadId,
            ...fields,
            assigneeMemberId: isManager && assigneeId ? assigneeId : null,
          },
        },
      });
      const p = res.data?.createCommercialDeal;
      if (!p?.deal) {
        setError(firstError(p?.errors, 'Não foi possível salvar o negócio.'));
        return;
      }
      toast.success('Negócio criado.');
      onSaved(p.deal);
      onOpenChange(false);
    } catch {
      setError('Não foi possível salvar o negócio. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[640px] overflow-y-auto">
        <DialogTitle className="font-serif text-base font-bold text-neutral-800">
          {editing ? 'Editar negócio' : 'Novo negócio'}
        </DialogTitle>
        <DialogDescription className="text-sm text-neutral-600">
          Cada evento da cliente é um negócio: noiva ou debutante.
        </DialogDescription>

        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className={LABEL_CLASS}>Tipo</legend>
            <div className="mt-xs flex gap-md">
              {(['noiva', 'debutante'] as const).map((k) => (
                <label key={k} className="flex items-center gap-xs text-sm">
                  <input
                    type="radio"
                    name="deal-kind"
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {KIND_LABEL[k]}
                </label>
              ))}
            </div>
          </fieldset>
          {kind === 'debutante' && (
            <div className="sm:col-span-2">
              <Label className={LABEL_CLASS} htmlFor="deal-beneficiary">
                Nome da debutante
              </Label>
              <Input
                id="deal-beneficiary"
                className="mt-xs"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label className={LABEL_CLASS} htmlFor="deal-date">
              Data do evento
            </Label>
            <Input
              id="deal-date"
              type="date"
              className="mt-xs"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="deal-package">
              Pacote
            </Label>
            <select
              id="deal-package"
              className={SELECT_CLASS}
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">Sem pacote</option>
              {deal?.package && !packages.some((p) => p.id === deal.package?.id) && (
                <option value={deal.package.id}>{deal.package.name}</option>
              )}
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(p.price)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor="deal-discount">
              Desconto (R$)
            </Label>
            <Input
              id="deal-discount"
              className="mt-xs"
              inputMode="decimal"
              placeholder="0,00"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div>
            <p className={LABEL_CLASS}>Valor final</p>
            <p className="mt-xs flex min-h-[44px] items-center text-sm font-semibold text-neutral-800">
              {finalCents != null ? formatMoney(centsToDecimal(finalCents)) : '—'}
            </p>
          </div>
          {isManager && (
            <div>
              <Label className={LABEL_CLASS} htmlFor="deal-assignee">
                Responsável
              </Label>
              <select
                id="deal-assignee"
                className={SELECT_CLASS}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={editing}
              >
                <option value="">Sem responsável</option>
                {assignees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label className={LABEL_CLASS} htmlFor="deal-source">
              Origem
            </Label>
            <select
              id="deal-source"
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
            <Label className={LABEL_CLASS} htmlFor="deal-location">
              Local do evento
            </Label>
            <Input
              id="deal-location"
              className="mt-xs"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className={LABEL_CLASS} htmlFor="deal-notes">
              Observações
            </Label>
            <Textarea
              id="deal-notes"
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

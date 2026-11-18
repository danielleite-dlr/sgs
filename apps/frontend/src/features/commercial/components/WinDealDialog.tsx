import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskCurrency, unmaskCurrency } from '@/features/catalog/utils/currency-mask';
import { ClientByIdQuery } from '@/features/clients/api/clients.api';
import { maskCep, maskRg } from '@/features/clients/utils/masks';
import { formatCpf, unformatCpf, validateCpf } from '@/features/clients/utils/cpf';
import { maskBrPhone } from '@/features/identity/member-validation';
import { decimalToCents } from '@/features/operations/lib/money';
import { PAYMENT_METHODS } from '@/features/operations/lib/operations-labels';
import { type CommercialDeal } from '../api/deals.api';
import { CommercialLeadQuery, type CommercialLead } from '../api/leads.api';
import {
  WinCommercialDealMutation,
  type CommercialWinPayload,
  type WinCommercialDealInput,
} from '../api/win.api';
import { firstError } from '../lib/commercial-labels';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';
const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm min-h-[44px]';
const MAX_LINES = 5;

interface ClientData {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  birthDate: string | null;
  postalCode: string | null;
  address: string | null;
  phone2: string | null;
  phone3: string | null;
}

interface Props {
  deal: CommercialDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

interface Line {
  method: string;
  amount: string; // mascarado
}

function lineCents(masked: string): number {
  const un = unmaskCurrency(masked);
  if (!un) return 0;
  try {
    return decimalToCents(un);
  } catch {
    return 0;
  }
}

function WinForm({
  deal,
  client,
  onClose,
  onDone,
}: {
  deal: CommercialDeal;
  client: ClientData | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const isDebutante = deal.kind === 'debutante';
  const [f, setF] = useState({
    fullName: client?.fullName ?? deal.lead.fullName ?? '',
    phone: maskBrPhone(client?.phone ?? deal.lead.phone ?? ''),
    email: client?.email ?? deal.lead.email ?? '',
    cpf: client?.cpf ? formatCpf(client.cpf) : '',
    rg: client?.rg ? maskRg(client.rg) : '',
    birthDate: client?.birthDate ? client.birthDate.slice(0, 10) : '',
    postalCode: client?.postalCode ? maskCep(client.postalCode) : '',
    address: client?.address ?? '',
    phone2: client?.phone2 ? maskBrPhone(client.phone2) : '',
    phone3: client?.phone3 ? maskBrPhone(client.phone3) : '',
  });
  const [beneficiary, setBeneficiary] = useState(deal.beneficiaryName ?? '');
  const [depositPaid, setDepositPaid] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ method: 'pix', amount: '' }]);
  const [error, setError] = useState('');
  const [win, { loading }] = useMutation<{ winCommercialDeal: CommercialWinPayload }>(
    WinCommercialDealMutation,
  );

  const noPackage = !deal.package && !deal.packageName;
  const set = (patch: Partial<typeof f>) => setF((v) => ({ ...v, ...patch }));
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const beneficiaryOk = !isDebutante || beneficiary.trim().length > 0;
  const linesOk = !depositPaid || lines.every((l) => lineCents(l.amount) > 0);
  const canSubmit = !noPackage && beneficiaryOk && linesOk && !loading;

  async function submit() {
    setError('');
    if (f.cpf.trim() && !validateCpf(f.cpf)) return setError('CPF inválido. Verifique os números.');
    const input: WinCommercialDealInput = {
      dealId: deal.id,
      client: {
        fullName: f.fullName.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        cpf: f.cpf.trim() ? unformatCpf(f.cpf) : null,
        rg: f.rg.trim() || null,
        birthDate: f.birthDate || null,
        postalCode: f.postalCode.trim() || null,
        address: f.address.trim() || null,
        phone2: f.phone2.trim() || null,
        phone3: f.phone3.trim() || null,
      },
      beneficiaryName: isDebutante ? beneficiary.trim() : null,
      depositPaid,
      depositLines: depositPaid
        ? lines.map((l) => ({ method: l.method, amount: unmaskCurrency(l.amount) }))
        : null,
    };
    try {
      const res = await win({ variables: { input } });
      const p = res.data?.winCommercialDeal;
      if (p?.errors.length) return setError(firstError(p.errors, 'Não foi possível marcar como ganho.'));
      toast.success('Negócio ganho. Contrato rascunho criado.');
      onDone?.();
      onClose();
      if (p?.contractId) navigate(`/contratos/${p.contractId}`);
    } catch {
      setError('Não foi possível marcar como ganho. Tente novamente.');
    }
  }

  const field = (id: string, label: string, key: keyof typeof f, mask?: (v: string) => string) => (
    <div>
      <Label htmlFor={`win-${id}`} className={LABEL_CLASS}>
        {label}
      </Label>
      <Input
        id={`win-${id}`}
        className="mt-xs"
        value={f[key]}
        onChange={(e) => set({ [key]: mask ? mask(e.target.value) : e.target.value })}
      />
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Marcar como ganho</DialogTitle>
        <DialogDescription>
          {/* D-21: este diálogo só abre quando canWin. */}
          Confira os dados da cliente. Eles entram no contrato rascunho de {deal.lead.fullName}.
        </DialogDescription>
      </DialogHeader>
      <div className="my-md max-h-[60vh] space-y-sm overflow-y-auto px-xs">
        {noPackage && (
          <p role="alert" className="rounded-md bg-warning-50 p-sm text-sm text-neutral-900">
            Escolha o pacote do negócio antes de marcar ganho
          </p>
        )}
        {isDebutante && (
          <div>
            <Label htmlFor="win-beneficiary" className={LABEL_CLASS}>
              Nome da debutante
            </Label>
            <Input
              id="win-beneficiary"
              className="mt-xs"
              value={beneficiary}
              aria-required="true"
              onChange={(e) => setBeneficiary(e.target.value)}
            />
          </div>
        )}
        {field('fullName', 'Nome da contratante', 'fullName')}
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {field('cpf', 'CPF', 'cpf', formatCpf)}
          {field('rg', 'RG', 'rg', maskRg)}
          {field('phone', 'Celular', 'phone', maskBrPhone)}
          {field('phone2', 'Celular 2', 'phone2', maskBrPhone)}
          {field('phone3', 'Celular 3', 'phone3', maskBrPhone)}
          {field('email', 'E-mail', 'email')}
          <div>
            <Label htmlFor="win-birthDate" className={LABEL_CLASS}>
              Data de nascimento
            </Label>
            <Input
              id="win-birthDate"
              type="date"
              className="mt-xs"
              value={f.birthDate}
              onChange={(e) => set({ birthDate: e.target.value })}
            />
          </div>
          {field('postalCode', 'CEP', 'postalCode', maskCep)}
        </div>
        {field('address', 'Endereço', 'address')}

        <fieldset className="space-y-xs">
          <legend className={LABEL_CLASS}>O sinal já foi pago?</legend>
          <div className="flex gap-md">
            <label className="flex min-h-[44px] items-center gap-sm text-sm">
              <input
                type="radio"
                name="deposit-paid"
                checked={!depositPaid}
                onChange={() => setDepositPaid(false)}
              />
              Não
            </label>
            <label className="flex min-h-[44px] items-center gap-sm text-sm">
              <input
                type="radio"
                name="deposit-paid"
                checked={depositPaid}
                onChange={() => setDepositPaid(true)}
              />
              Sim
            </label>
          </div>
        </fieldset>
        {depositPaid && (
          <div className="space-y-sm">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-sm">
                <div>
                  <Label htmlFor={`win-method-${i}`} className={LABEL_CLASS}>
                    Forma {i + 1}
                  </Label>
                  <select
                    id={`win-method-${i}`}
                    value={l.method}
                    onChange={(e) => setLine(i, { method: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor={`win-amount-${i}`} className={LABEL_CLASS}>
                    Valor {i + 1}
                  </Label>
                  <Input
                    id={`win-amount-${i}`}
                    className="mt-xs"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={l.amount}
                    onChange={(e) => setLine(i, { amount: maskCurrency(e.target.value) })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  disabled={lines.length === 1}
                  aria-label={`Remover linha ${i + 1}`}
                  onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {lines.length < MAX_LINES && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((ls) => [...ls, { method: 'pix', amount: '' }])}
              >
                Adicionar forma de pagamento
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-error-600">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit} data-testid="win-submit">
          {loading ? 'Salvando…' : 'Confirmar ganho'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Carrega a cliente ligada ao lead (se houver) e só então monta o formulário. */
function WinLoader({
  deal,
  onClose,
  onDone,
}: {
  deal: CommercialDeal;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { data: leadData, loading: loadingLead } = useQuery<{
    commercialLead: CommercialLead | null;
  }>(CommercialLeadQuery, { variables: { id: deal.leadId, limit: 1 } });
  const clientId = leadData?.commercialLead?.client?.id ?? null;
  const { data: clientData, loading: loadingClient } = useQuery<{ client: ClientData | null }>(
    ClientByIdQuery,
    { variables: { id: clientId }, skip: !clientId },
  );
  if (loadingLead || (clientId && loadingClient)) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Marcar como ganho</DialogTitle>
          <DialogDescription>Carregando os dados da cliente…</DialogDescription>
        </DialogHeader>
      </>
    );
  }
  return <WinForm deal={deal} client={clientData?.client ?? null} onClose={onClose} onDone={onDone} />;
}

export function WinDealDialog({ deal, open, onOpenChange, onDone }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {open && deal && (
          <WinLoader deal={deal} onClose={() => onOpenChange(false)} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatCurrencyDisplay,
  maskCurrency,
  unmaskCurrency,
} from '@/features/catalog/utils/currency-mask';
import { centsToDecimal, decimalToCents } from '@/features/operations/lib/money';
import {
  ContractGroupQuery,
  ContractPackagesQuery,
  ContractServicesQuery,
  ContractSettingsQuery,
  CreateContractMutation,
  UpdateContractMutation,
  ContractsQuery,
  type ContractData,
  type ContractGroupResult,
  type ContractPackagesResult,
  type ContractServicesResult,
  type ContractSettingsResult,
  type CreateContractResult,
  type UpdateContractResult,
} from '../api/contracts.api';
import { contractErrorMessage, formatDateOnly } from '../lib/contract-labels';

const brl = (cents: number) => `R$ ${formatCurrencyDisplay(centsToDecimal(cents))}`;

interface ItemRow {
  key: string;
  groupMemberId: string;
  personName: string;
  isBride: boolean;
  serviceId: string;
  description: string;
  unitPrice: string; // mascarado "80,00"
  quantity: number;
  purpose: string;
}

function typedToCents(masked: string): number {
  const un = unmaskCurrency(masked);
  if (!un) return 0;
  try {
    return decimalToCents(un);
  } catch {
    return 0;
  }
}

/** Data limite do restante: evento - N dias (aritmética em UTC, sem fuso). */
function dueDate(eventDate: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - days));
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Criação: grupo de origem. */
  groupId?: string;
  /** Edição: contrato existente. */
  contract?: ContractData;
}

export function ContractFormDialog({ open, onOpenChange, groupId, contract }: ContractFormDialogProps) {
  const gid = contract?.groupId ?? groupId;
  const group = useQuery<ContractGroupResult>(ContractGroupQuery, {
    variables: { id: gid },
    skip: !open || !gid,
  });
  const services = useQuery<ContractServicesResult>(ContractServicesQuery, { skip: !open });
  const packages = useQuery<ContractPackagesResult>(ContractPackagesQuery, { skip: !open });
  const settings = useQuery<ContractSettingsResult>(ContractSettingsQuery, { skip: !open });

  const ready = !!group.data?.bridalGroup && !!services.data && !!packages.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="contract-form">
        <DialogHeader>
          <DialogTitle>{contract ? `Editar contrato ${contract.code}` : 'Novo contrato'}</DialogTitle>
          <DialogDescription>
            {contract
              ? 'Editar gera nova versão e exige novo aceite da noiva.'
              : 'Monte os itens por pessoa, o desconto, a entrada e o prazo do restante.'}
          </DialogDescription>
        </DialogHeader>
        {!ready ? (
          <p className="text-sm text-neutral-600" aria-busy="true">
            {group.error ? 'Não foi possível carregar o grupo.' : 'Carregando…'}
          </p>
        ) : (
          <ContractForm
            group={group.data!.bridalGroup!}
            services={services.data!.services}
            packages={packages.data!.packages}
            defaultDays={settings.data?.contractSettings.balanceDueDaysBefore}
            contract={contract}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContractForm({
  group,
  services,
  packages,
  defaultDays,
  contract,
  onClose,
}: {
  group: NonNullable<ContractGroupResult['bridalGroup']>;
  services: ContractServicesResult['services'];
  packages: ContractPackagesResult['packages'];
  defaultDays?: number;
  contract?: ContractData;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const priceByService = useMemo(
    () => new Map(services.map((s) => [s.id, s.basePrice])),
    [services],
  );

  const [items, setItems] = useState<ItemRow[]>(() => {
    if (contract) {
      const roleByMember = new Map(group.members.map((m) => [m.id, m.role]));
      return contract.items.map((i) => ({
        key: i.id,
        groupMemberId: i.groupMemberId,
        personName: i.personName,
        isBride: roleByMember.get(i.groupMemberId) === 'bride',
        serviceId: i.serviceId,
        description: i.description,
        unitPrice: formatCurrencyDisplay(i.unitPrice),
        quantity: i.quantity,
        purpose: i.purpose,
      }));
    }
    return group.members
      .filter((m) => m.coveredByContract)
      .flatMap((m) =>
        m.services.map((s) => ({
          key: `${m.id}:${s.id}`,
          groupMemberId: m.id,
          personName: m.clientName,
          isBride: m.role === 'bride',
          serviceId: s.serviceId,
          description: s.serviceName,
          unitPrice: formatCurrencyDisplay(priceByService.get(s.serviceId) ?? '0.00'),
          quantity: 1,
          purpose: s.purpose === 'trial' ? 'trial' : 'event',
        })),
      );
  });
  // Novo contrato herda o pacote do grupo (se ainda existir no catálogo); edição usa o do contrato.
  const [packageId, setPackageId] = useState<string>(() => {
    if (contract) return contract.packageId ?? '';
    const fromGroup = group.packageId;
    return fromGroup && packages.some((p) => p.id === fromGroup) ? fromGroup : '';
  });
  const [discount, setDiscount] = useState(
    contract && Number(contract.discountAmount) > 0 ? formatCurrencyDisplay(contract.discountAmount) : '',
  );
  const [deposit, setDeposit] = useState(contract ? formatCurrencyDisplay(contract.depositAmount) : '');
  const [days, setDays] = useState(contract ? String(contract.balanceDueDaysBefore) : '');
  const [addMember, setAddMember] = useState('');
  const [addService, setAddService] = useState('');
  const [error, setError] = useState('');

  const [createContract, { loading: creating }] = useMutation<CreateContractResult>(
    CreateContractMutation,
    { refetchQueries: [{ query: ContractsQuery }] },
  );
  const [updateContract, { loading: updating }] = useMutation<UpdateContractResult>(
    UpdateContractMutation,
  );

  const pkg = packages.find((p) => p.id === packageId) ?? null;
  // Com pacote novo (criação), o backend gera os itens da noiva rateados; só as demais pessoas contam.
  const packageDriven = !!pkg && !contract;
  const covered = group.members.filter((m) => m.coveredByContract);
  const uncovered = group.members.filter((m) => !m.coveredByContract);

  const itemsCents = items
    .filter((i) => !packageDriven || !i.isBride)
    .reduce((acc, i) => acc + typedToCents(i.unitPrice) * i.quantity, 0);
  const itemsSum = itemsCents + (packageDriven ? decimalToCents(pkg!.price) : 0);
  const discountCents = typedToCents(discount);
  const total = Math.max(0, itemsSum - discountCents);

  let suggestedDeposit = 0;
  if (pkg?.depositKind === 'fixed' && pkg.depositValue) suggestedDeposit = decimalToCents(pkg.depositValue);
  if (pkg?.depositKind === 'percent' && pkg.depositValue) {
    suggestedDeposit = Math.round((total * Number(pkg.depositValue)) / 100);
  }
  const depositCents = deposit ? typedToCents(deposit) : suggestedDeposit;
  const daysNum = days !== '' ? Number(days) : (defaultDays ?? 0);

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addItem() {
    const member = covered.find((m) => m.id === addMember);
    const svc = services.find((s) => s.id === addService);
    if (!member || !svc) return;
    setItems((rows) => [
      ...rows,
      {
        key: `new-${Date.now()}-${rows.length}`,
        groupMemberId: member.id,
        personName: member.clientName,
        isBride: member.role === 'bride',
        serviceId: svc.id,
        description: svc.name,
        unitPrice: formatCurrencyDisplay(svc.basePrice),
        quantity: 1,
        purpose: 'event',
      },
    ]);
    setAddService('');
  }

  async function submit() {
    setError('');
    const explicitItems = items.map((i) => ({
      groupMemberId: i.groupMemberId,
      serviceId: i.serviceId,
      unitPrice: unmaskCurrency(i.unitPrice) || '0.00',
      quantity: i.quantity,
      purpose: i.purpose,
    }));
    const common = {
      packageId: packageId || undefined,
      discountAmount: discount ? unmaskCurrency(discount) : '0.00',
      depositAmount: deposit ? unmaskCurrency(deposit) : undefined,
      balanceDueDaysBefore: days !== '' ? Number(days) : undefined,
    };
    try {
      if (contract) {
        const res = await updateContract({
          variables: { id: contract.id, input: { ...common, items: explicitItems } },
        });
        const payload = res.data?.updateContract;
        if (payload?.errors.length) {
          setError(contractErrorMessage(payload.errors[0]));
          return;
        }
        toast.success('Contrato atualizado. A noiva precisa aceitar a nova versão.');
        onClose();
        return;
      }
      const res = await createContract({
        variables: {
          input: {
            groupId: group.id,
            ...common,
            ...(packageDriven ? {} : { items: explicitItems }),
          },
        },
      });
      const payload = res.data?.createContract;
      if (payload?.errors.length) {
        setError(contractErrorMessage(payload.errors[0]));
        return;
      }
      toast.success('Contrato criado.');
      onClose();
      if (payload?.contract) navigate(`/contratos/${payload.contract.id}`);
    } catch {
      setError('Não foi possível salvar o contrato. Tente novamente.');
    }
  }

  const busy = creating || updating;
  const canSubmit = !busy && (packageDriven || items.length > 0);

  return (
    <div className="space-y-md">
      <p className="text-sm text-neutral-700">
        Grupo <span className="font-semibold">{group.name}</span> · evento em{' '}
        {formatDateOnly(group.eventDate)}
      </p>

      <div>
        <Label htmlFor="contract-package" className="text-xs font-semibold text-neutral-700">
          Pacote (opcional)
        </Label>
        <select
          id="contract-package"
          value={packageId}
          disabled={!!contract}
          onChange={(e) => setPackageId(e.target.value)}
          className="mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
        >
          <option value="">Sem pacote</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — R$ {formatCurrencyDisplay(p.price)}
            </option>
          ))}
        </select>
        {packageDriven && (
          <p className="mt-xs text-xs text-neutral-600">
            Os serviços da noiva entram pelo preço do pacote, rateado entre eles.
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="contract-items">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-xs">Pessoa</th>
              <th>Serviço</th>
              <th className="w-20">Qtd.</th>
              <th className="w-32">Preço unit.</th>
              <th className="w-24 text-right">Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const bridePackage = packageDriven && i.isBride;
              return (
                <tr key={i.key} className="border-t border-neutral-100">
                  <td className="py-xs">{i.personName}</td>
                  <td>{i.description}</td>
                  <td>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      aria-label={`Quantidade de ${i.description} para ${i.personName}`}
                      disabled={bridePackage}
                      value={i.quantity}
                      onChange={(e) =>
                        updateItem(i.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      inputMode="numeric"
                      aria-label={`Preço de ${i.description} para ${i.personName}`}
                      disabled={bridePackage}
                      value={i.unitPrice}
                      onChange={(e) => updateItem(i.key, { unitPrice: maskCurrency(e.target.value) })}
                    />
                  </td>
                  <td className="text-right">
                    {bridePackage ? 'no pacote' : brl(typedToCents(i.unitPrice) * i.quantity)}
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={bridePackage}
                      aria-label={`Remover ${i.description} de ${i.personName}`}
                      onClick={() => setItems((rows) => rows.filter((r) => r.key !== i.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-sm text-center text-neutral-500">
                  Nenhum item. Adicione serviços abaixo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!packageDriven && (
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-sm">
          <div>
            <Label htmlFor="contract-add-member" className="text-xs font-semibold text-neutral-700">
              Pessoa
            </Label>
            <select
              id="contract-add-member"
              value={addMember}
              onChange={(e) => setAddMember(e.target.value)}
              className="mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
            >
              <option value="">Selecione…</option>
              {group.members.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.coveredByContract}>
                  {m.clientName}
                  {m.coveredByContract ? '' : ' — paga avulso'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="contract-add-service" className="text-xs font-semibold text-neutral-700">
              Serviço
            </Label>
            <select
              id="contract-add-service"
              value={addService}
              onChange={(e) => setAddService(e.target.value)}
              className="mt-xs w-full rounded-md border border-neutral-200 bg-white px-sm py-xs text-sm"
            >
              <option value="">Selecione…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" disabled={!addMember || !addService} onClick={addItem}>
            Adicionar
          </Button>
        </div>
      )}
      {uncovered.length > 0 && (
        <p className="text-xs text-neutral-600" data-testid="contract-uncovered">
          Fora do contrato (paga avulso): {uncovered.map((m) => m.clientName).join(', ')}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <div>
          <Label htmlFor="contract-discount" className="text-xs font-semibold text-neutral-700">
            Desconto (R$)
          </Label>
          <Input
            id="contract-discount"
            className="mt-xs"
            inputMode="numeric"
            placeholder="0,00"
            value={discount}
            onChange={(e) => setDiscount(maskCurrency(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="contract-deposit" className="text-xs font-semibold text-neutral-700">
            Entrada (R$)
          </Label>
          <Input
            id="contract-deposit"
            className="mt-xs"
            inputMode="numeric"
            placeholder={suggestedDeposit > 0 ? formatCurrencyDisplay(centsToDecimal(suggestedDeposit)) : '0,00'}
            value={deposit}
            onChange={(e) => setDeposit(maskCurrency(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="contract-days" className="text-xs font-semibold text-neutral-700">
            Quitar até (dias antes do evento)
          </Label>
          <Input
            id="contract-days"
            className="mt-xs"
            type="number"
            min={0}
            max={365}
            placeholder={defaultDays != null ? String(defaultDays) : ''}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
      </div>

      <dl className="space-y-xs rounded-md bg-neutral-50 p-sm text-sm" data-testid="contract-summary">
        <div className="flex justify-between">
          <dt>Soma dos itens</dt>
          <dd>{brl(itemsSum)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Desconto</dt>
          <dd>- {brl(discountCents)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd data-testid="contract-form-total">{brl(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Entrada</dt>
          <dd>{brl(depositCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Restante até {dueDate(group.eventDate, daysNum)}</dt>
          <dd>{brl(Math.max(0, total - depositCents))}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" data-testid="contract-form-error" className="text-sm text-error-600">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" disabled={!canSubmit} data-testid="contract-submit" onClick={() => void submit()}>
          {busy ? 'Salvando…' : contract ? 'Salvar nova versão' : 'Criar contrato'}
        </Button>
      </DialogFooter>
    </div>
  );
}

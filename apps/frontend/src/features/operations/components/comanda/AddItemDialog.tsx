import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ServicesQuery, type ServicesQueryResult } from '@/features/catalog/api/servicos.api';
import { ProductsQuery, type ProductsQueryResult } from '@/features/catalog/api/produtos.api';
import { PackagesQuery, type PackagesQueryResult } from '@/features/catalog/api/pacotes.api';
import { MembersQuery, type MembersQueryResult } from '@/features/catalog/api/members.api';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import {
  ProfessionalsForServiceQuery,
  type ProfessionalsForServiceResult,
} from '../../api/appointments.api';
import {
  AddComandaItemMutation,
  AddComandaPackageMutation,
  type AddComandaItemResult,
  type AddComandaPackageResult,
  type ComandaData,
  type ComandaPayloadResult,
} from '../../api/comandas.api';

export type AddItemMode = 'service' | 'product' | 'package';

const SELECT_CLASS = `${NATIVE_SELECT_CLASS} mt-xs`;
const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

const TITLES: Record<AddItemMode, string> = {
  service: 'Adicionar serviço',
  product: 'Adicionar produto',
  package: 'Adicionar pacote',
};

function parseQuantity(v: string): number | null {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 999 ? n : null;
}

interface FormProps {
  mode: AddItemMode;
  comanda: ComandaData;
  onDone: () => void;
  onCancel: () => void;
}

function useProfessionalsFor(serviceId: string) {
  const { data } = useQuery<ProfessionalsForServiceResult>(ProfessionalsForServiceQuery, {
    variables: { serviceId },
    skip: !serviceId,
    fetchPolicy: 'cache-and-network',
  });
  return serviceId ? (data?.professionalsForService ?? []) : [];
}

function ServiceFields({
  onValid,
}: {
  onValid: (v: { input: Record<string, unknown> } | null) => void;
}) {
  const { data } = useQuery<ServicesQueryResult>(ServicesQuery);
  const [serviceId, setServiceId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const professionals = useProfessionalsFor(serviceId);
  const service = data?.services.find((s) => s.id === serviceId);

  function emit(next: { s?: string; v?: string; p?: string; q?: string }) {
    const s = next.s ?? serviceId;
    const v = next.v ?? variantId;
    const p = next.p ?? professionalId;
    const q = parseQuantity(next.q ?? quantity);
    onValid(
      s && p && q
        ? {
            input: {
              kind: 'service',
              serviceId: s,
              serviceVariantId: v || null,
              professionalId: p,
              quantity: q,
            },
          }
        : null,
    );
  }

  return (
    <div className="space-y-sm">
      <div>
        <Label htmlFor="add-item-service" className={LABEL_CLASS}>
          Serviço
        </Label>
        <select
          id="add-item-service"
          data-testid="add-item-service"
          className={SELECT_CLASS}
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setVariantId('');
            setProfessionalId('');
            emit({ s: e.target.value, v: '', p: '' });
          }}
        >
          <option value="">Selecione…</option>
          {(data?.services ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — R$ {formatCurrencyDisplay(s.basePrice)}
            </option>
          ))}
        </select>
      </div>
      {service && service.pricingVariants.length > 0 && (
        <div>
          <Label htmlFor="add-item-variant" className={LABEL_CLASS}>
            Variante de preço
          </Label>
          <select
            id="add-item-variant"
            data-testid="add-item-variant"
            className={SELECT_CLASS}
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              emit({ v: e.target.value });
            }}
          >
            <option value="">Preço padrão</option>
            {service.pricingVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — R$ {formatCurrencyDisplay(v.price)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Label htmlFor="add-item-professional" className={LABEL_CLASS}>
          Profissional
        </Label>
        <select
          id="add-item-professional"
          data-testid="add-item-professional"
          className={SELECT_CLASS}
          value={professionalId}
          disabled={!serviceId}
          onChange={(e) => {
            setProfessionalId(e.target.value);
            emit({ p: e.target.value });
          }}
        >
          <option value="">Selecione…</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </div>
      <QuantityField
        value={quantity}
        onChange={(q) => {
          setQuantity(q);
          emit({ q });
        }}
      />
    </div>
  );
}

function QuantityField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor="add-item-quantity" className={LABEL_CLASS}>
        Quantidade
      </Label>
      <Input
        id="add-item-quantity"
        data-testid="add-item-quantity"
        className="mt-xs"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
      />
    </div>
  );
}

function ProductFields({
  onValid,
}: {
  onValid: (v: { input: Record<string, unknown> } | null) => void;
}) {
  const products = useQuery<ProductsQueryResult>(ProductsQuery);
  const members = useQuery<MembersQueryResult>(MembersQuery);
  const [productId, setProductId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const product = products.data?.products.find((p) => p.id === productId);
  const qty = parseQuantity(quantity);

  function emit(next: { pr?: string; s?: string; q?: string }) {
    const pr = next.pr ?? productId;
    const s = next.s ?? sellerId;
    const q = parseQuantity(next.q ?? quantity);
    onValid(
      pr && s && q
        ? {
            input: {
              kind: 'product',
              productId: pr,
              professionalId: s,
              quantity: q,
            },
          }
        : null,
    );
  }

  return (
    <div className="space-y-sm">
      <div>
        <Label htmlFor="add-item-product" className={LABEL_CLASS}>
          Produto
        </Label>
        <select
          id="add-item-product"
          data-testid="add-item-product"
          className={SELECT_CLASS}
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            emit({ pr: e.target.value });
          }}
        >
          <option value="">Selecione…</option>
          {(products.data?.products ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — R$ {formatCurrencyDisplay(p.salePrice)} (estoque {p.stockQuantity})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="add-item-professional" className={LABEL_CLASS}>
          Vendedor
        </Label>
        <select
          id="add-item-professional"
          data-testid="add-item-professional"
          className={SELECT_CLASS}
          value={sellerId}
          onChange={(e) => {
            setSellerId(e.target.value);
            emit({ s: e.target.value });
          }}
        >
          <option value="">Selecione…</option>
          {(members.data?.members ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>
      <QuantityField
        value={quantity}
        onChange={(q) => {
          setQuantity(q);
          emit({ q });
        }}
      />
      {product && qty !== null && qty > product.stockQuantity && (
        <p role="status" className="text-xs text-warning-700" data-testid="add-item-stock-warning">
          Estoque atual de {product.name}: {product.stockQuantity}. O fechamento será recusado se
          continuar insuficiente.
        </p>
      )}
    </div>
  );
}

function PackageServiceRow({
  serviceId,
  name,
  value,
  onChange,
}: {
  serviceId: string;
  name: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const professionals = useProfessionalsFor(serviceId);
  const id = `add-item-package-pro-${serviceId}`;
  return (
    <div>
      <Label htmlFor={id} className={LABEL_CLASS}>
        Profissional — {name}
      </Label>
      <select
        id={id}
        data-testid={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione…</option>
        {professionals.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

function PackageFields({
  onValid,
}: {
  onValid: (v: { input: Record<string, unknown> } | null) => void;
}) {
  const { data } = useQuery<PackagesQueryResult>(PackagesQuery);
  const [packageId, setPackageId] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const pkg = data?.packages.find((p) => p.id === packageId);

  function emit(pid: string, map: Record<string, string>) {
    const target = data?.packages.find((p) => p.id === pid);
    if (!target || target.services.some((s) => !map[s.serviceId])) {
      onValid(null);
      return;
    }
    onValid({
      input: {
        packageId: pid,
        assignments: target.services.map((s) => ({
          serviceId: s.serviceId,
          professionalId: map[s.serviceId],
        })),
      },
    });
  }

  return (
    <div className="space-y-sm">
      <div>
        <Label htmlFor="add-item-package" className={LABEL_CLASS}>
          Pacote
        </Label>
        <select
          id="add-item-package"
          data-testid="add-item-package"
          className={SELECT_CLASS}
          value={packageId}
          onChange={(e) => {
            setPackageId(e.target.value);
            setAssignments({});
            emit(e.target.value, {});
          }}
        >
          <option value="">Selecione…</option>
          {(data?.packages ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — R$ {formatCurrencyDisplay(p.price)}
            </option>
          ))}
        </select>
      </div>
      {pkg?.services.map((s) => (
        <PackageServiceRow
          key={s.serviceId}
          serviceId={s.serviceId}
          name={s.service.name}
          value={assignments[s.serviceId] ?? ''}
          onChange={(pid) => {
            const next = { ...assignments, [s.serviceId]: pid };
            setAssignments(next);
            emit(packageId, next);
          }}
        />
      ))}
    </div>
  );
}

function AddItemForm({ mode, comanda, onDone, onCancel }: FormProps) {
  const [payload, setPayload] = useState<{ input: Record<string, unknown> } | null>(null);
  const [error, setError] = useState('');
  const [addItem, itemState] = useMutation<AddComandaItemResult>(AddComandaItemMutation);
  const [addPackage, pkgState] = useMutation<AddComandaPackageResult>(AddComandaPackageMutation);
  const saving = itemState.loading || pkgState.loading;

  async function submit() {
    if (!payload) return;
    setError('');
    try {
      let result: ComandaPayloadResult | undefined;
      if (mode === 'package') {
        const res = await addPackage({
          variables: { input: { comandaId: comanda.id, ...payload.input } },
        });
        result = res.data?.addComandaPackage;
      } else {
        const res = await addItem({
          variables: { input: { comandaId: comanda.id, ...payload.input } },
        });
        result = res.data?.addComandaItem;
      }
      const errors = result?.errors ?? [];
      if (errors.length > 0) {
        setError(errors[0].message);
        return;
      }
      toast.success('Item adicionado à comanda.');
      onDone();
    } catch {
      setError('Não foi possível adicionar o item. Tente novamente.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{TITLES[mode]}</DialogTitle>
        <DialogDescription>Comanda {comanda.code}</DialogDescription>
      </DialogHeader>
      {mode === 'service' && <ServiceFields onValid={setPayload} />}
      {mode === 'product' && <ProductFields onValid={setPayload} />}
      {mode === 'package' && <PackageFields onValid={setPayload} />}
      {error && (
        <p role="alert" data-testid="add-item-error" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!payload || saving}
          data-testid="add-item-submit"
          onClick={() => void submit()}
        >
          Adicionar
        </Button>
      </DialogFooter>
    </>
  );
}

export interface AddItemDialogProps {
  mode: AddItemMode;
  comanda: ComandaData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function AddItemDialog({ mode, comanda, open, onOpenChange, onDone }: AddItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <AddItemForm
          mode={mode}
          comanda={comanda}
          onCancel={() => onOpenChange(false)}
          onDone={() => {
            onDone();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

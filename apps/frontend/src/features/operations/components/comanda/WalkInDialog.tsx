import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClientsListQuery, type ClientsListResult } from '@/features/clients/api/clients.api';
import { maskBrPhone } from '@/features/identity/member-validation';
import {
  OpenWalkInComandaMutation,
  type OpenWalkInComandaResult,
} from '../../api/comandas.api';

const MIN_NAME = 2;

function WalkInForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [open, { loading }] = useMutation<OpenWalkInComandaResult>(OpenWalkInComandaMutation);

  const clients = useQuery<ClientsListResult>(ClientsListQuery, {
    variables: { search: search.trim() || null, limit: 8, offset: 0 },
    skip: mode !== 'existing' || clientId !== '' || search.trim().length < 2,
  });

  const valid =
    mode === 'existing' ? clientId !== '' : fullName.trim().length >= MIN_NAME;

  async function submit() {
    if (!valid) return;
    setError('');
    const input =
      mode === 'existing'
        ? { clientId }
        : { newClient: { fullName: fullName.trim(), phone: phone.trim() || null } };
    try {
      const res = await open({ variables: { input } });
      const payload = res.data?.openWalkInComanda;
      if (!payload || payload.errors.length > 0 || !payload.comanda) {
        setError(payload?.errors[0]?.message ?? 'Não foi possível abrir a comanda.');
        return;
      }
      toast.success(`Comanda ${payload.comanda.code} aberta.`);
      onClose();
      navigate(`/comanda/${payload.comanda.id}`);
    } catch {
      setError('Não foi possível abrir a comanda. Tente novamente.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nova comanda</DialogTitle>
        <DialogDescription>Atendimento sem agendamento (walk-in).</DialogDescription>
      </DialogHeader>
      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as 'existing' | 'new')}
        className="flex gap-md"
        aria-label="Tipo de cliente"
      >
        <div className="flex items-center gap-xs">
          <RadioGroupItem value="existing" id="walkin-existing" data-testid="walkin-mode-existing" />
          <Label htmlFor="walkin-existing">Cliente cadastrado</Label>
        </div>
        <div className="flex items-center gap-xs">
          <RadioGroupItem value="new" id="walkin-new" data-testid="walkin-mode-new" />
          <Label htmlFor="walkin-new">Novo cliente</Label>
        </div>
      </RadioGroup>

      {mode === 'existing' ? (
        <div className="space-y-xs">
          <Label htmlFor="walkin-search" className="text-xs font-semibold text-neutral-700">
            Buscar cliente
          </Label>
          {clientId ? (
            <div className="flex items-center justify-between rounded-md border border-neutral-200 px-sm py-xs text-sm">
              <span data-testid="walkin-client-selected">{clientName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setClientId('');
                  setClientName('');
                }}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="walkin-search"
                data-testid="walkin-client-search"
                placeholder="Nome ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ul className="space-y-xs">
                {(clients.data?.clients.rows ?? []).map((c) => (
                  <li key={c.id}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      data-testid={`walkin-client-option-${c.id}`}
                      onClick={() => {
                        setClientId(c.id);
                        setClientName(c.fullName);
                      }}
                    >
                      {c.fullName}
                      {c.phone ? ` — ${c.phone}` : ''}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-sm">
          <div>
            <Label htmlFor="walkin-name" className="text-xs font-semibold text-neutral-700">
              Nome
            </Label>
            <Input
              id="walkin-name"
              data-testid="walkin-name"
              className="mt-xs"
              value={fullName}
              maxLength={120}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="walkin-phone" className="text-xs font-semibold text-neutral-700">
              Telefone (opcional)
            </Label>
            <Input
              id="walkin-phone"
              data-testid="walkin-phone"
              className="mt-xs"
              inputMode="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(maskBrPhone(e.target.value))}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" data-testid="walkin-error" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!valid || loading}
          data-testid="walkin-submit"
          onClick={() => void submit()}
        >
          Abrir comanda
        </Button>
      </DialogFooter>
    </>
  );
}

export function WalkInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <WalkInForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useMutation } from '@apollo/client';
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
import { UpdateClientMutation } from '@/features/clients/api/clients.api';
import { formatCpf, unformatCpf, validateCpf } from '@/features/clients/utils/cpf';
import { maskBrPhone } from '@/features/identity/member-validation';
import { contractorFieldsFor, type ClientField } from '../lib/contractor-fields';
import {
  ContractQuery,
  ContractReadinessQuery,
  type ContractMissingField,
} from '../api/contracts.api';

function validate(field: ClientField, value: string): string | null {
  const v = value.trim();
  if (!v) return 'Preencha este campo.';
  if (field === 'cpf' && !validateCpf(v)) return 'CPF inválido. Verifique os números.';
  if (
    (field === 'phone' || field === 'phone2') &&
    ![10, 11].includes(v.replace(/\D/g, '').length)
  ) {
    return 'Celular inválido. Use DDD + número.';
  }
  if (field === 'fullName' && v.length < 2) return 'Digite um nome válido.';
  return null;
}

export interface CompleteContractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  clientId: string;
  missing: ContractMissingField[];
}

function CompleteForm({
  contractId,
  clientId,
  missing,
  onClose,
}: Omit<CompleteContractorDialogProps, 'open' | 'onOpenChange'> & {
  onClose: () => void;
}) {
  const fields = contractorFieldsFor(missing);
  const [values, setValues] = useState<Partial<Record<ClientField, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ClientField, string>>>({});
  const [serverError, setServerError] = useState('');
  const [update, { loading }] = useMutation(UpdateClientMutation, {
    refetchQueries: [
      { query: ContractReadinessQuery, variables: { id: contractId } },
      { query: ContractQuery, variables: { id: contractId } },
    ],
    awaitRefetchQueries: true,
  });

  function onChange(field: ClientField, raw: string) {
    const masked =
      field === 'cpf'
        ? formatCpf(raw)
        : field === 'phone' || field === 'phone2'
          ? maskBrPhone(raw)
          : raw;
    setValues((v) => ({ ...v, [field]: masked }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function submit() {
    setServerError('');
    const next: Partial<Record<ClientField, string>> = {};
    for (const { field } of fields) {
      const err = validate(field, values[field] ?? '');
      if (err) next[field] = err;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: Record<string, string> = { id: clientId };
    for (const { field } of fields) {
      const v = (values[field] ?? '').trim();
      input[field] = field === 'cpf' ? unformatCpf(v) : v;
    }
    try {
      const res = await update({ variables: { input } });
      const errs = (res.data?.updateClient?.errors ?? []) as Array<{
        message: string;
        field?: string | null;
      }>;
      if (errs.length > 0) {
        const e = errs[0];
        if (e.field && fields.some((f) => f.field === e.field)) {
          setErrors({ [e.field as ClientField]: e.message });
        } else {
          setServerError(e.message);
        }
        return;
      }
      toast.success('Dados da contratante salvos.');
      onClose();
    } catch {
      setServerError('Não foi possível salvar os dados. Tente novamente.');
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Completar dados da contratante</DialogTitle>
        <DialogDescription>
          Os dados ficam salvos na ficha da cliente e entram no contrato.
        </DialogDescription>
      </DialogHeader>
      <div className="my-md space-y-sm">
        {fields.map(({ field, label }) => {
          const id = `complete-${field}`;
          const err = errors[field];
          return (
            <div key={field} className="space-y-xs">
              <Label htmlFor={id} className="text-xs font-semibold text-neutral-700">
                {label}
              </Label>
              <Input
                id={id}
                value={values[field] ?? ''}
                inputMode={
                  field === 'cpf' || field === 'phone' || field === 'phone2' ? 'numeric' : undefined
                }
                autoComplete={
                  field === 'fullName' ? 'name' : field === 'address' ? 'street-address' : 'off'
                }
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? `${id}-error` : undefined}
                onChange={(e) => onChange(field, e.target.value)}
              />
              {err && (
                <p id={`${id}-error`} className="text-xs text-error-600">
                  {err}
                </p>
              )}
            </div>
          );
        })}
        {serverError && (
          <p role="alert" className="text-sm text-error-600">
            {serverError}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Voltar
        </Button>
        <Button type="submit" disabled={loading} data-testid="complete-contractor-submit">
          {loading ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CompleteContractorDialog({
  open,
  onOpenChange,
  ...rest
}: CompleteContractorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && <CompleteForm {...rest} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

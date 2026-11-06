import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  formatCurrencyDisplay,
  maskCurrency,
  unmaskCurrency,
} from '@/features/catalog/utils/currency-mask';
import { useHasPermission } from '../operations-permissions';
import {
  CreateFixedExpenseMutation,
  DeleteFixedExpenseMutation,
  FixedExpensesQuery,
  UpdateFixedExpenseMutation,
  type FixedExpense,
  type FixedExpenseInput,
  type FixedExpensePayload,
} from '../api/forecast.api';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

const MSG_NAME = 'Informe o nome da despesa (2 a 120 caracteres).';
const MSG_AMOUNT = 'Informe um valor maior que zero.';
const MSG_DAY = 'O dia do vencimento deve ser entre 1 e 31.';

type FieldErrors = Partial<Record<'name' | 'amount' | 'dueDay', string>>;

function validate(name: string, masked: string, day: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) errors.name = MSG_NAME;
  const unmasked = unmaskCurrency(masked);
  if (unmasked === '' || !(Number(unmasked) > 0)) errors.amount = MSG_AMOUNT;
  const d = Number(day);
  if (day.trim() === '' || !Number.isInteger(d) || d < 1 || d > 31) errors.dueDay = MSG_DAY;
  return errors;
}

function ExpenseDialog({
  open,
  editing,
  onOpenChange,
}: {
  open: boolean;
  editing: FixedExpense | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(
    editing ? maskCurrency(String(Math.round(Number(editing.amount) * 100))) : '',
  );
  const [dueDay, setDueDay] = useState(editing ? String(editing.dueDay) : '');
  const [active, setActive] = useState<'true' | 'false'>(editing?.active === false ? 'false' : 'true');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);

  const refetchQueries = ['FixedExpenses', 'CashForecast'];
  const [create, { loading: creating }] = useMutation<{ createFixedExpense: FixedExpensePayload }>(
    CreateFixedExpenseMutation,
    { refetchQueries },
  );
  const [update, { loading: updating }] = useMutation<{ updateFixedExpense: FixedExpensePayload }>(
    UpdateFixedExpenseMutation,
    { refetchQueries },
  );
  const saving = creating || updating;

  async function save() {
    const found = validate(name, amount, dueDay);
    setErrors(found);
    setTopError(null);
    if (Object.keys(found).length > 0) return;
    const input: FixedExpenseInput = {
      name: name.trim(),
      amount: unmaskCurrency(amount),
      dueDay: Number(dueDay),
      active: active === 'true',
    };
    try {
      const payload = editing
        ? (await update({ variables: { id: editing.id, input } })).data?.updateFixedExpense
        : (await create({ variables: { input } })).data?.createFixedExpense;
      const serverErrors = payload?.errors ?? [];
      if (serverErrors.length > 0) {
        const fieldErrors: FieldErrors = {};
        let top: string | null = null;
        for (const e of serverErrors) {
          if (e.field === 'name' || e.field === 'amount' || e.field === 'dueDay') {
            fieldErrors[e.field] = e.message;
          } else {
            top = e.message;
          }
        }
        setErrors(fieldErrors);
        setTopError(top);
        return;
      }
      toast.success('Despesa fixa salva.');
      onOpenChange(false);
    } catch {
      setTopError('Não foi possível salvar a despesa fixa.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar despesa fixa' : 'Nova despesa fixa'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-md">
          {topError && (
            <Alert variant="destructive">
              <AlertDescription>{topError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-xs">
            <Label htmlFor="fx-name">Nome</Label>
            <Input
              id="fx-name"
              value={name}
              maxLength={120}
              aria-invalid={errors.name ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-error-600">
                {errors.name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="fx-amount">Valor</Label>
            <Input
              id="fx-amount"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={amount ? `R$ ${amount}` : ''}
              aria-invalid={errors.amount ? true : undefined}
              onChange={(e) => setAmount(maskCurrency(e.target.value))}
            />
            {errors.amount && (
              <p role="alert" className="text-xs text-error-600">
                {errors.amount}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-xs">
            <Label htmlFor="fx-day">Dia do vencimento</Label>
            <Input
              id="fx-day"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              aria-invalid={errors.dueDay ? true : undefined}
              aria-describedby="fx-day-help"
              onChange={(e) => setDueDay(e.target.value)}
            />
            <p id="fx-day-help" className="text-xs text-neutral-500">
              Se o mês não tiver esse dia, a despesa vence no último dia do mês.
            </p>
            {errors.dueDay && (
              <p role="alert" className="text-xs text-error-600">
                {errors.dueDay}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-xs">
            <span id="fx-active-label" className="text-sm font-medium">
              Situação
            </span>
            <RadioGroup
              value={active}
              onValueChange={(v) => setActive(v as 'true' | 'false')}
              className="flex gap-md"
              aria-labelledby="fx-active-label"
            >
              <div className="flex items-center gap-xs">
                <RadioGroupItem id="fx-active-yes" value="true" />
                <Label htmlFor="fx-active-yes">Ativa</Label>
              </div>
              <div className="flex items-center gap-xs">
                <RadioGroupItem id="fx-active-no" value="false" />
                <Label htmlFor="fx-active-no">Inativa</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DespesasFixasPage() {
  const canRead = useHasPermission('financial.read');
  const canWrite = useHasPermission('financial.expenseWrite');

  const { data, loading, error, refetch } = useQuery<{ fixedExpenses: FixedExpense[] }>(
    FixedExpensesQuery,
    { skip: !canRead },
  );
  const refetchQueries = ['FixedExpenses', 'CashForecast'];
  const [update] = useMutation<{ updateFixedExpense: FixedExpensePayload }>(
    UpdateFixedExpenseMutation,
    { refetchQueries },
  );
  const [remove] = useMutation<{ deleteFixedExpense: FixedExpensePayload }>(
    DeleteFixedExpenseMutation,
    { refetchQueries },
  );

  const [dialog, setDialog] = useState<{ open: boolean; editing: FixedExpense | null }>({
    open: false,
    editing: null,
  });
  const [toDelete, setToDelete] = useState<FixedExpense | null>(null);

  const rows = data?.fixedExpenses ?? [];

  async function toggleActive(e: FixedExpense) {
    try {
      const res = await update({
        variables: {
          id: e.id,
          input: { name: e.name, amount: e.amount, dueDay: e.dueDay, active: !e.active },
        },
      });
      const errs = res.data?.updateFixedExpense.errors ?? [];
      if (errs.length > 0) toast.error(errs[0].message);
      else toast.success('Despesa fixa salva.');
    } catch {
      toast.error('Não foi possível salvar a despesa fixa.');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      const res = await remove({ variables: { id: toDelete.id } });
      const errs = res.data?.deleteFixedExpense.errors ?? [];
      if (errs.length > 0) toast.error(errs[0].message);
      else toast.success('Despesa fixa excluída.');
    } catch {
      toast.error('Não foi possível excluir a despesa fixa.');
    }
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        title="Despesas fixas"
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Despesas fixas' }]}
        cta={
          canRead && canWrite ? (
            <Button type="button" onClick={() => setDialog({ open: true, editing: null })}>
              Nova despesa fixa
            </Button>
          ) : undefined
        }
      />
      <p className="-mt-sm mb-lg text-sm text-neutral-600">
        Contas que se repetem todo mês. Elas entram nas saídas da previsão de caixa.
      </p>

      {!canRead ? (
        <div className="rounded-md border border-neutral-200 bg-white p-md text-sm text-neutral-600">
          Você não tem acesso ao financeiro.
        </div>
      ) : loading ? (
        <Skeleton className="h-32 w-full" />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-md">
            <span>Não foi possível carregar as despesas fixas.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-start gap-md rounded-md border border-neutral-200 bg-white p-md">
          <p className="text-sm text-neutral-600">Nenhuma despesa fixa cadastrada.</p>
          {canWrite && (
            <Button type="button" onClick={() => setDialog({ open: true, editing: null })}>
              Cadastrar despesa fixa
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm" data-testid="fixed-expenses-table">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="p-sm">Nome</th>
                <th className="p-sm text-right">Valor</th>
                <th className="p-sm">Vence todo dia</th>
                <th className="p-sm">Situação</th>
                {canWrite && <th className="p-sm">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-neutral-100">
                  <td className="p-sm">{e.name}</td>
                  <td className="p-sm text-right">{brl(e.amount)}</td>
                  <td className="p-sm">{`dia ${e.dueDay}`}</td>
                  <td className="p-sm">
                    <Badge variant={e.active ? 'success' : 'secondary'}>
                      {e.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </td>
                  {canWrite && (
                    <td className="p-sm">
                      <div className="flex flex-wrap gap-xs">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Editar ${e.name}`}
                          onClick={() => setDialog({ open: true, editing: e })}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`${e.active ? 'Desativar' : 'Ativar'} ${e.name}`}
                          onClick={() => void toggleActive(e)}
                        >
                          {e.active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Excluir ${e.name}`}
                          onClick={() => setToDelete(e)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog.open && (
        <ExpenseDialog
          open
          editing={dialog.editing}
          onOpenChange={(o) => !o && setDialog({ open: false, editing: null })}
        />
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa fixa?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela deixa de entrar na previsão. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2, LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  useAdminClientsQuery,
  useAdminCreateClientMutation,
} from '../api/admin.api';

const schema = z.object({
  salonName: z.string().min(2, 'Informe o nome do salão.'),
  ownerName: z.string().min(2, 'Informe o nome do responsável.'),
  ownerEmail: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

type FormValues = z.infer<typeof schema>;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * AdminClientsPage — painel de plataforma.
 *
 * Fica fora do AppShell de propósito: o platform admin não pertence a
 * organização nenhuma, então a navegação do salão (agenda, catálogo, caixa)
 * não faz sentido aqui.
 */
export function AdminClientsPage() {
  const { data, loading, error } = useAdminClientsQuery();
  const [createClient, { loading: creating }] = useAdminCreateClientMutation();
  const { logout } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  useEffect(() => {
    document.title = 'Clientes — Admin SGS';
  }, []);

  function openDialog() {
    setFormError(null);
    reset({ salonName: '', ownerName: '', ownerEmail: '', password: '' });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const res = await createClient({ variables: { input: values } });
      const payload = res.data?.adminCreateClient;

      if (!payload) {
        setFormError('Não foi possível cadastrar. Tente de novo.');
        return;
      }
      if (payload.errors.length > 0) {
        setFormError(payload.errors[0].message);
        return;
      }

      setDialogOpen(false);
      toast.success(
        `${payload.client?.tradeName} cadastrado. Passe o e-mail e a senha para o cliente.`,
      );
    } catch {
      setFormError('Não foi possível cadastrar. Tente de novo.');
    }
  }

  const clients = data?.adminClients ?? [];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-primary-700">SGS — Admin</h1>
            <p className="text-sm text-neutral-500">
              Cadastro e acompanhamento dos clientes
            </p>
          </div>
          <Button variant="ghost" onClick={() => void logout()}>
            <LogOut size={16} className="mr-2" aria-hidden="true" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-800">
            Clientes {clients.length > 0 && `(${clients.length})`}
          </h2>
          <Button onClick={openDialog}>
            <Plus size={16} className="mr-2" aria-hidden="true" />
            Novo cliente
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              Não foi possível carregar os clientes: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <Loader2 size={20} className="mr-2 animate-spin" aria-hidden="true" />
            Carregando…
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white py-16 text-center">
            <Building2 size={32} className="text-neutral-400" aria-hidden="true" />
            <h3 className="text-base font-semibold text-neutral-800">
              Nenhum cliente cadastrado
            </h3>
            <p className="max-w-md text-sm text-neutral-500">
              Cadastre o primeiro salão. Você define a senha inicial e repassa ao
              responsável.
            </p>
            <Button onClick={openDialog}>
              <Plus size={16} className="mr-2" aria-hidden="true" />
              Novo cliente
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salão</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.organizationId}>
                    <TableCell>
                      <span className="font-medium text-neutral-800">
                        {c.tradeName}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {c.subdomain}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-800">{c.ownerName ?? '—'}</span>
                      <span className="block text-xs text-neutral-500">
                        {c.ownerEmail ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>{c.memberCount}</TableCell>
                    <TableCell>{formatDate(c.createdAt)}</TableCell>
                    <TableCell>{formatDate(c.ownerLastLoginAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="salonName">Nome do salão</Label>
              <Input id="salonName" {...register('salonName')} />
              {errors.salonName && (
                <p className="text-sm text-red-600">{errors.salonName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ownerName">Responsável</Label>
              <Input id="ownerName" {...register('ownerName')} />
              {errors.ownerName && (
                <p className="text-sm text-red-600">{errors.ownerName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ownerEmail">E-mail de acesso</Label>
              <Input id="ownerEmail" type="email" {...register('ownerEmail')} />
              {errors.ownerEmail && (
                <p className="text-sm text-red-600">{errors.ownerEmail.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" type="text" {...register('password')} />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
              <p className="text-xs text-neutral-500">
                Não há disparo de e-mail: anote a senha e repasse ao responsável.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && (
                  <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                )}
                Cadastrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

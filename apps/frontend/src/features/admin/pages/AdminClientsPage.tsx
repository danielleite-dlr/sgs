import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Ban,
  Building2,
  Copy,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  useAdminClientsQuery,
  useAdminCreateClientMutation,
  useAdminUpdateClientMutation,
  useAdminSetClientStatusMutation,
  useAdminResetClientPasswordMutation,
  useAdminSwitchToClientMutation,
} from '../api/admin.api';
import type { AdminClient } from '../api/admin.api';
import { PlatformAccessDialog } from '../components/PlatformAccessDialog';

const createSchema = z.object({
  salonName: z.string().min(2, 'Informe o nome do salão.'),
  ownerName: z.string().min(2, 'Informe o nome do responsável.'),
  ownerEmail: z.string().email('E-mail inválido.'),
});

const editSchema = z.object({
  tradeName: z.string().min(2, 'Informe o nome do salão.'),
  legalName: z.string().min(2, 'Informe a razão social.'),
  email: z.string().email('E-mail inválido.'),
  phone: z.string().optional(),
  ownerName: z.string().min(2, 'Informe o nome do responsável.'),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

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
 * organização nenhuma, então a navegação do salão não faz sentido aqui.
 */
export function AdminClientsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useAdminClientsQuery();
  const [createClient, { loading: creating }] = useAdminCreateClientMutation();
  const [updateClient, { loading: updating }] = useAdminUpdateClientMutation();
  const [setStatus] = useAdminSetClientStatusMutation();
  const [resetPassword] = useAdminResetClientPasswordMutation();
  const [switchToClient] = useAdminSwitchToClientMutation();
  const { logout, enterClient } = useAuth();

  const isMaster = useAuthStore((s) => s.isPlatformMaster);
  const canAccessClientOrgs = useAuthStore((s) => s.canAccessClientOrgs);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    salon: string;
    email: string;
    password: string;
  } | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    mode: 'onBlur',
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    document.title = 'Clientes — Admin SGS';
  }, []);

  function openCreate() {
    setFormError(null);
    createForm.reset({ salonName: '', ownerName: '', ownerEmail: '' });
    setCreateOpen(true);
  }

  function openEdit(client: AdminClient) {
    setFormError(null);
    editForm.reset({
      tradeName: client.tradeName,
      legalName: client.legalName,
      email: client.email,
      phone: client.phone ?? '',
      ownerName: client.ownerName ?? '',
    });
    setEditing(client);
  }

  async function onCreate(values: CreateValues) {
    setFormError(null);
    try {
      const res = await createClient({ variables: { input: values } });
      const payload = res.data?.adminCreateClient;
      if (!payload || payload.errors.length > 0) {
        setFormError(payload?.errors[0]?.message ?? 'Não foi possível cadastrar.');
        return;
      }
      setCreateOpen(false);
      setCredentials({
        salon: payload.client?.tradeName ?? values.salonName,
        email: payload.client?.ownerEmail ?? values.ownerEmail,
        password: payload.temporaryPassword ?? '',
      });
    } catch {
      setFormError('Não foi possível cadastrar.');
    }
  }

  async function onEdit(values: EditValues) {
    if (!editing) return;
    setFormError(null);
    try {
      const res = await updateClient({
        variables: {
          input: {
            organizationId: editing.organizationId,
            tradeName: values.tradeName,
            legalName: values.legalName,
            email: values.email,
            phone: values.phone ? values.phone : null,
            ownerName: values.ownerName,
          },
        },
      });
      const payload = res.data?.adminUpdateClient;
      if (!payload || payload.errors.length > 0) {
        setFormError(payload?.errors[0]?.message ?? 'Não foi possível salvar.');
        return;
      }
      setEditing(null);
      toast.success('Cliente atualizado.');
    } catch {
      setFormError('Não foi possível salvar.');
    }
  }

  async function onToggleStatus(client: AdminClient) {
    const next = client.status === 'active' ? 'suspended' : 'active';
    const res = await setStatus({
      variables: { input: { organizationId: client.organizationId, status: next } },
    });
    const payload = res.data?.adminSetClientStatus;
    if (payload?.errors.length) {
      toast.error(payload.errors[0].message);
      return;
    }
    toast.success(
      next === 'suspended'
        ? `${client.tradeName} suspenso. O salão perdeu o acesso.`
        : `${client.tradeName} reativado.`,
    );
  }

  async function onResetPassword(client: AdminClient) {
    const res = await resetPassword({
      variables: { input: { organizationId: client.organizationId } },
    });
    const payload = res.data?.adminResetClientPassword;
    if (!payload || payload.errors.length > 0) {
      toast.error(payload?.errors[0]?.message ?? 'Não foi possível resetar.');
      return;
    }
    setCredentials({
      salon: client.tradeName,
      email: client.ownerEmail ?? '',
      password: payload.temporaryPassword ?? '',
    });
  }

  async function onEnterSalon(client: AdminClient) {
    const res = await switchToClient({
      variables: { input: { organizationId: client.organizationId } },
    });
    const payload = res.data?.adminSwitchToClient;
    if (!payload?.accessToken) {
      toast.error(payload?.errors[0]?.message ?? 'Não foi possível entrar.');
      return;
    }
    enterClient(payload);
    navigate('/dashboard', { replace: true });
  }

  async function copyCredentials() {
    if (!credentials) return;
    const text = `SGS — ${credentials.salon}\nAcesso: ${window.location.origin}/login\nE-mail: ${credentials.email}\nSenha: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado.');
    } catch {
      toast.error('Não consegui copiar. Selecione e copie manualmente.');
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
          <div className="flex items-center gap-2">
            {isMaster && (
              <Button variant="ghost" onClick={() => setAccessOpen(true)}>
                <ShieldCheck size={16} className="mr-2" aria-hidden="true" />
                Acessos
              </Button>
            )}
            <Button variant="ghost" onClick={() => void logout()}>
              <LogOut size={16} className="mr-2" aria-hidden="true" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-800">
            Clientes {clients.length > 0 && `(${clients.length})`}
          </h2>
          <Button onClick={openCreate}>
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
              Cadastre o primeiro salão. O sistema gera a senha e você repassa ao
              responsável.
            </p>
            <Button onClick={openCreate}>
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
                  <TableHead>Situação</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="w-12" />
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
                        {c.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-800">{c.ownerName ?? '—'}</span>
                      <span className="block text-xs text-neutral-500">
                        {c.ownerEmail ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {c.status === 'active' ? (
                          <Badge variant="secondary">Ativo</Badge>
                        ) : (
                          <Badge variant="destructive">Suspenso</Badge>
                        )}
                        {c.ownerMustChangePassword && (
                          <span className="text-xs text-neutral-500">
                            senha temporária
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{c.memberCount}</TableCell>
                    <TableCell>{formatDate(c.ownerLastLoginAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações">
                            <MoreHorizontal size={16} aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil size={14} className="mr-2" aria-hidden="true" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void onResetPassword(c)}
                          >
                            <KeyRound size={14} className="mr-2" aria-hidden="true" />
                            Resetar senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void onToggleStatus(c)}>
                            {c.status === 'active' ? (
                              <>
                                <Ban size={14} className="mr-2" aria-hidden="true" />
                                Suspender
                              </>
                            ) : (
                              <>
                                <Play size={14} className="mr-2" aria-hidden="true" />
                                Reativar
                              </>
                            )}
                          </DropdownMenuItem>
                          {canAccessClientOrgs && (
                            <DropdownMenuItem onClick={() => void onEnterSalon(c)}>
                              <LogIn size={14} className="mr-2" aria-hidden="true" />
                              Entrar no salão
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Cadastro */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit(onCreate)}
            className="space-y-4"
            noValidate
          >
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <Label htmlFor="salonName">Nome do salão</Label>
              <Input id="salonName" {...createForm.register('salonName')} />
              {createForm.formState.errors.salonName && (
                <p className="text-sm text-red-600">
                  {createForm.formState.errors.salonName.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerName">Responsável</Label>
              <Input id="ownerName" {...createForm.register('ownerName')} />
              {createForm.formState.errors.ownerName && (
                <p className="text-sm text-red-600">
                  {createForm.formState.errors.ownerName.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerEmail">E-mail de acesso</Label>
              <Input
                id="ownerEmail"
                type="email"
                {...createForm.register('ownerEmail')}
              />
              {createForm.formState.errors.ownerEmail && (
                <p className="text-sm text-red-600">
                  {createForm.formState.errors.ownerEmail.message}
                </p>
              )}
              <p className="text-xs text-neutral-500">
                A senha é gerada pelo sistema e aparece na próxima tela. Ela só
                aparece uma vez.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
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

      {/* Edição */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(onEdit)}
            className="space-y-4"
            noValidate
          >
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <Label htmlFor="tradeName">Nome do salão</Label>
              <Input id="tradeName" {...editForm.register('tradeName')} />
              {editForm.formState.errors.tradeName && (
                <p className="text-sm text-red-600">
                  {editForm.formState.errors.tradeName.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="legalName">Razão social</Label>
              <Input id="legalName" {...editForm.register('legalName')} />
              {editForm.formState.errors.legalName && (
                <p className="text-sm text-red-600">
                  {editForm.formState.errors.legalName.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="editEmail">E-mail do salão</Label>
              <Input id="editEmail" type="email" {...editForm.register('email')} />
              {editForm.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {editForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...editForm.register('phone')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editOwnerName">Responsável</Label>
              <Input id="editOwnerName" {...editForm.register('ownerName')} />
              {editForm.formState.errors.ownerName && (
                <p className="text-sm text-red-600">
                  {editForm.formState.errors.ownerName.message}
                </p>
              )}
              <p className="text-xs text-neutral-500">
                O e-mail de acesso do responsável não muda por aqui.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updating}>
                {updating && (
                  <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Senha gerada — aparece uma única vez */}
      <Dialog
        open={!!credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Anote agora. Esta senha não é recuperável depois — se perder, gere
                outra pelo menu do cliente.
              </AlertDescription>
            </Alert>
            <div className="space-y-1 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <p className="font-medium text-neutral-800">{credentials?.salon}</p>
              <p className="text-neutral-600">E-mail: {credentials?.email}</p>
              <p className="font-mono text-base text-neutral-900">
                {credentials?.password}
              </p>
            </div>
            <p className="text-xs text-neutral-500">
              No primeiro acesso o responsável é obrigado a trocar esta senha.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => void copyCredentials()}>
                <Copy size={16} className="mr-2" aria-hidden="true" />
                Copiar
              </Button>
              <Button onClick={() => setCredentials(null)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isMaster && (
        <PlatformAccessDialog open={accessOpen} onOpenChange={setAccessOpen} />
      )}
    </div>
  );
}

import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  useAdminPlatformUsersQuery,
  useAdminSetPlatformAccessMutation,
} from '../api/admin.api';
import type { PlatformUser } from '../api/admin.api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * PlatformAccessDialog — quem tem acesso de plataforma, e quem pode entrar no
 * salão de um cliente. Só o master abre isso.
 *
 * Não cria usuário: promove alguém que já existe. Para dar acesso a uma pessoa
 * nova, ela precisa ter conta no sistema antes.
 */
export function PlatformAccessDialog({ open, onOpenChange }: Props) {
  const { data, loading } = useAdminPlatformUsersQuery(!open);
  const [setAccess, { loading: saving }] = useAdminSetPlatformAccessMutation();

  const users = data?.adminPlatformUsers ?? [];

  async function toggleSalonAccess(user: PlatformUser) {
    const res = await setAccess({
      variables: {
        input: {
          userId: user.userId,
          isPlatformAdmin: true,
          canAccessClientOrgs: !user.canAccessClientOrgs,
        },
      },
    });
    const payload = res.data?.adminSetPlatformAccess;
    if (payload?.errors.length) {
      toast.error(payload.errors[0].message);
      return;
    }
    toast.success(
      user.canAccessClientOrgs
        ? `${user.fullName} não entra mais em salão de cliente.`
        : `${user.fullName} pode entrar em salão de cliente.`,
    );
  }

  async function revokeAdmin(user: PlatformUser) {
    const res = await setAccess({
      variables: {
        input: {
          userId: user.userId,
          isPlatformAdmin: false,
          canAccessClientOrgs: false,
        },
      },
    });
    const payload = res.data?.adminSetPlatformAccess;
    if (payload?.errors.length) {
      toast.error(payload.errors[0].message);
      return;
    }
    toast.success(`Acesso de plataforma removido de ${user.fullName}.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Acessos de plataforma</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            Quem não tem acesso aqui só enxerga o próprio salão. Entrar no salão
            de um cliente é permissão separada, concedida por você.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-neutral-500">
            <Loader2 size={20} className="mr-2 animate-spin" aria-hidden="true" />
            Carregando…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Entra no salão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <span className="font-medium text-neutral-800">
                      {u.fullName}
                    </span>
                    <span className="block text-xs text-neutral-500">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    {u.isPlatformMaster ? (
                      <Badge>
                        <ShieldCheck size={12} className="mr-1" aria-hidden="true" />
                        Master
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.canAccessClientOrgs ? 'Sim' : 'Não'}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.isPlatformMaster ? (
                      <span className="text-xs text-neutral-500">
                        acesso total
                      </span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => void toggleSalonAccess(u)}
                        >
                          {u.canAccessClientOrgs
                            ? 'Tirar acesso ao salão'
                            : 'Permitir salão'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => void revokeAdmin(u)}
                        >
                          Remover admin
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

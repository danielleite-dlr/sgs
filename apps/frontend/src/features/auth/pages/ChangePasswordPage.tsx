import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useChangePasswordMutation } from '../api/auth.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Repita a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });

type FormValues = z.infer<typeof schema>;

/**
 * ChangePasswordPage — troca da senha temporária.
 *
 * O cliente entra com a senha gerada pelo admin e cai aqui: enquanto
 * mustChangePassword estiver ligado, o RequirePasswordChange devolve o usuário
 * para esta tela a cada navegação.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [changePassword, { loading }] = useChangePasswordMutation();
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword);
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onBlur' });

  useEffect(() => {
    document.title = 'Trocar senha — SGS';
  }, []);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const res = await changePassword({
        variables: {
          input: {
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          },
        },
      });
      const payload = res.data?.changePassword;

      if (!payload?.success) {
        setFormError(
          payload?.errors[0]?.message ?? 'Não foi possível trocar a senha.',
        );
        return;
      }

      setMustChangePassword(false);
      toast.success('Senha alterada.');
      navigate(isPlatformAdmin ? '/admin' : '/dashboard', { replace: true });
    } catch {
      setFormError('Não foi possível trocar a senha.');
    }
  }

  return (
    <AuthShell>
      <AuthCard heading="Defina sua senha">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
          <p className="text-sm text-neutral-600">
            Você entrou com uma senha temporária. Escolha uma senha sua para
            continuar.
          </p>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-xs">
            <Label htmlFor="currentPassword">Senha temporária</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-sm text-red-600">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-xs">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-sm text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-xs">
            <Label htmlFor="confirmPassword">Repita a nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && (
              <Loader2 size={16} className="mr-xs animate-spin" aria-hidden="true" />
            )}
            Salvar senha
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

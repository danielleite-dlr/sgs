import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAcceptInvitationMutation } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  fullName: z.string().min(2),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

type InvitationError = 'INVITATION_EXPIRED' | 'INVITATION_USED' | null;

export function InvitationPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [invitationError, setInvitationError] = useState<InvitationError>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [acceptInvitation, { loading }] = useAcceptInvitationMutation();
  const { applyAuthPayload } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  useEffect(() => {
    document.title = t('invitation.pageTitle');
    nameRef.current?.focus();
  }, [t]);

  async function onSubmit(values: FormValues) {
    if (!token) return;
    setAuthError(null);

    try {
      const res = await acceptInvitation({
        variables: {
          input: {
            token,
            fullName: values.fullName,
            password: values.password,
          },
        },
      });

      const payload = res.data?.acceptInvitation;
      if (!payload) {
        setAuthError(t('invitation.errors.serverGeneric'));
        return;
      }

      if (payload.errors.length > 0) {
        const e = payload.errors[0];
        if (e.code === 'INVITATION_EXPIRED') {
          setInvitationError('INVITATION_EXPIRED');
        } else if (e.code === 'INVITATION_USED') {
          setInvitationError('INVITATION_USED');
        } else {
          setAuthError(t('invitation.errors.serverGeneric'));
        }
        return;
      }

      const ok = applyAuthPayload(payload);
      if (ok) {
        navigate('/dashboard', { replace: true });
      }
    } catch {
      setAuthError(t('invitation.errors.serverGeneric'));
    }
  }

  // Expired invitation state — no form shown
  if (invitationError === 'INVITATION_EXPIRED') {
    return (
      <AuthShell>
        <AuthCard heading={t('invitation.errors.expiredHeading')}>
          <div className="space-y-md">
            <p className="text-body text-neutral-800">
              {t('invitation.errors.expiredBody')}
            </p>
            <div className="flex justify-center">
              <Link to="/login" className="text-label text-primary-500 hover:text-primary-700">
                Ir para o login
              </Link>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  // Already used invitation state — no form shown
  if (invitationError === 'INVITATION_USED') {
    return (
      <AuthShell>
        <AuthCard heading="Convite já utilizado">
          <div className="space-y-md">
            <Alert variant="destructive">
              <AlertDescription>{t('invitation.errors.alreadyUsed')}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Link to="/login" className="text-label text-primary-500 hover:text-primary-700">
                Entrar na sua conta
              </Link>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  // Generic heading — salonName/inviterName not returned by current API
  // TODO: extend AcceptInvitationPayload to include orgName + inviterName (Phase 2 improvement)
  const { ref: nameRegRef, ...nameRegRest } = register('fullName');

  return (
    <AuthShell>
      <AuthCard heading="Aceitar convite">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
          {authError && (
            <Alert variant="destructive">
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-xs">
            <Label htmlFor="fullName">{t('invitation.nameLabel')}</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder={t('invitation.namePlaceholder')}
              aria-invalid={!!errors.fullName}
              {...nameRegRest}
              ref={(el) => {
                nameRegRef(el);
                nameRef.current = el;
              }}
            />
            {errors.fullName && (
              <p className="text-label text-error-500" role="alert">
                {t('signup.step1.errors.nameTooShort')}
              </p>
            )}
          </div>

          <div className="space-y-xs">
            <Label htmlFor="password">{t('invitation.passwordLabel')}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t('invitation.passwordPlaceholder')}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-label text-error-500" role="alert">
                {t('signup.step1.errors.passwordTooShort')}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!isValid || loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="mr-xs animate-spin" aria-hidden="true" />
                {t('invitation.loadingCta')}
              </>
            ) : (
              t('invitation.primaryCta')
            )}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

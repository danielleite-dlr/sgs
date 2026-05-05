import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginMutation } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [login, { loading }] = useLoginMutation();
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
    document.title = t('login.pageTitle');
    emailRef.current?.focus();
  }, [t]);

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    try {
      const res = await login({ variables: { input: values } });
      const payload = res.data?.login;
      if (!payload) {
        setAuthError({ code: 'UNKNOWN', message: t('login.errors.serverGeneric') });
        return;
      }
      if (payload.errors.length > 0) {
        const e = payload.errors[0];
        if (e.code === 'INVALID_CREDENTIALS') {
          setAuthError({ code: e.code, message: t('login.errors.wrongCredentials') });
        } else if (e.code === 'ACCOUNT_UNVERIFIED') {
          setAuthError({ code: e.code, message: t('login.errors.unverified') });
        } else {
          setAuthError({ code: e.code, message: t('login.errors.serverGeneric') });
        }
        return;
      }
      const ok = applyAuthPayload(payload);
      if (ok) {
        navigate('/dashboard', { replace: true });
      }
    } catch {
      setAuthError({ code: 'UNKNOWN', message: t('login.errors.serverGeneric') });
    }
  }

  const { ref: emailRegRef, ...emailRegRest } = register('email');

  return (
    <AuthShell>
      <AuthCard heading={t('login.cardHeading')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
          {authError && (
            <Alert variant="destructive">
              <AlertDescription>
                {authError.message}
                {authError.code === 'ACCOUNT_UNVERIFIED' && (
                  <>
                    {' '}
                    <Link
                      to="/verificar-email"
                      className="text-primary-500 underline"
                    >
                      {t('login.errors.resendVerification')}
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-xs">
            <Label htmlFor="email">{t('login.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('login.emailPlaceholder')}
              aria-invalid={!!errors.email}
              {...emailRegRest}
              ref={(el) => {
                emailRegRef(el);
                emailRef.current = el;
              }}
            />
            {errors.email && (
              <p className="text-label text-error-500" role="alert">
                {t('signup.step1.errors.emailFormat')}
              </p>
            )}
          </div>

          <div className="space-y-xs">
            <Label htmlFor="password">{t('login.passwordLabel')}</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!isValid || loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="mr-xs animate-spin" aria-hidden="true" />
                {t('login.loadingCta')}
              </>
            ) : (
              t('login.primaryCta')
            )}
          </Button>

          <div className="flex flex-col items-center gap-xs">
            <Link
              to="/signup"
              className="text-label text-primary-500 hover:text-primary-700"
            >
              {t('login.linkToSignup')}
            </Link>
            {/* TODO: Password recovery deferred — links to /recuperar-senha which renders NotFoundPage */}
            <Link
              to="/recuperar-senha"
              className="text-label text-primary-500 hover:text-primary-700"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

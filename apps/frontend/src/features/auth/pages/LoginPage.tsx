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
  const passwordRef = useRef<HTMLInputElement | null>(null);
  // Chrome preenche e-mail/senha salvos mas só entrega o valor ao JS depois de alguma interação;
  // enquanto isso o campo casa com :-webkit-autofill e tratamos como preenchido.
  const [autofilled, setAutofilled] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [login, { loading }] = useLoginMutation();
  const { applyAuthPayload } = useAuth();

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Valida a cada tecla para o Entrar habilitar assim que e-mail e senha estiverem ok, sem
    // precisar clicar fora (quick 261107-kpj). O erro de e-mail só aparece depois de sair do
    // campo, para não acusar "inválido" enquanto a pessoa ainda digita.
    mode: 'onChange',
  });
  const emailError = touchedFields.email || isSubmitted ? errors.email : undefined;

  useEffect(() => {
    document.title = t('login.pageTitle');
    emailRef.current?.focus();
  }, [t]);

  // Copia para o formulário o que estiver no DOM e o React Hook Form não viu (autopreenchimento).
  function syncFromDom() {
    const fields = [
      ['email', emailRef.current],
      ['password', passwordRef.current],
    ] as const;
    for (const [name, el] of fields) {
      if (el && el.value !== (getValues(name) ?? '')) {
        setValue(name, el.value, { shouldValidate: true, shouldDirty: true });
      }
    }
  }

  // O autopreenchimento chega alguns instantes depois de montar; vigia os primeiros segundos.
  useEffect(() => {
    const isAutofilled = (el: HTMLInputElement | null) => {
      try {
        return !!el?.matches(':-webkit-autofill');
      } catch {
        return false;
      }
    };
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      syncFromDom();
      if (isAutofilled(emailRef.current) && isAutofilled(passwordRef.current)) {
        setAutofilled(true);
      }
      if (ticks >= 12) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e?: React.BaseSyntheticEvent) => {
    syncFromDom();
    return handleSubmit(onSubmit)(e);
  };

  // Enter em qualquer campo envia, mesmo que o navegador ainda não tenha liberado o
  // autopreenchimento (o botão desabilitado bloquearia o envio implícito).
  function onFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (!loading) void submit();
  }

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
        // Senha temporária vem antes de tudo: sem trocar, nada de sistema.
        if (payload.session?.mustChangePassword) {
          navigate('/trocar-senha', { replace: true });
          return;
        }
        // Platform admin não tem organização: o lugar dele é o painel de
        // clientes, não o dashboard de salão.
        navigate(payload.session?.isPlatformAdmin ? '/admin' : '/dashboard', {
          replace: true,
        });
      }
    } catch {
      setAuthError({ code: 'UNKNOWN', message: t('login.errors.serverGeneric') });
    }
  }

  const { ref: emailRegRef, onChange: emailOnChange, ...emailRegRest } = register('email');
  const {
    ref: passwordRegRef,
    onChange: passwordOnChange,
    ...passwordRegRest
  } = register('password');

  return (
    <AuthShell>
      <AuthCard heading={t('login.cardHeading')}>
        <form onSubmit={submit} onKeyDown={onFormKeyDown} className="space-y-md" noValidate>
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
              aria-invalid={!!emailError}
              {...emailRegRest}
              onChange={(e) => {
                setAutofilled(false);
                return emailOnChange(e);
              }}
              ref={(el) => {
                emailRegRef(el);
                emailRef.current = el;
              }}
            />
            {emailError && (
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
              {...passwordRegRest}
              onChange={(e) => {
                setAutofilled(false);
                return passwordOnChange(e);
              }}
              ref={(el) => {
                passwordRegRef(el);
                passwordRef.current = el;
              }}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || (!isValid && !autofilled)}>
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

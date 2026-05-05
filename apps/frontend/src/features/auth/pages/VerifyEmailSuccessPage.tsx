import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVerifyEmailMutation } from '../api/auth.api';

type VerifyState =
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; code: string };

export function VerifyEmailSuccessPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [verifyEmail] = useVerifyEmailMutation();
  const [verifyState, setVerifyState] = useState<VerifyState>({ status: 'loading' });

  useEffect(() => {
    document.title = t('verifyEmailSuccess.pageTitle');

    if (!token) {
      setVerifyState({ status: 'error', code: 'TOKEN_INVALID' });
      return;
    }

    verifyEmail({ variables: { input: { token } } })
      .then((res) => {
        const payload = res.data?.verifyEmail;
        if (!payload) {
          setVerifyState({ status: 'error', code: 'UNKNOWN' });
          return;
        }
        if (payload.errors.length > 0) {
          setVerifyState({ status: 'error', code: payload.errors[0].code });
        } else {
          setVerifyState({ status: 'success' });
        }
      })
      .catch(() => {
        setVerifyState({ status: 'error', code: 'UNKNOWN' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function getErrorMessage(code: string): string {
    switch (code) {
      case 'TOKEN_EXPIRED':
        return 'Este link de verificação expirou. Solicite um novo e-mail de verificação.';
      case 'TOKEN_INVALID':
        return 'Link de verificação inválido.';
      case 'TOKEN_ALREADY_USED':
        return 'Este link já foi utilizado. Sua conta já está ativa.';
      default:
        return t('common.error');
    }
  }

  const heading =
    verifyState.status === 'success'
      ? t('verifyEmailSuccess.cardHeading')
      : 'Verificando…';

  return (
    <AuthShell>
      <AuthCard heading={heading}>
        <div className="space-y-md">
          {verifyState.status === 'loading' && (
            <div className="flex flex-col items-center gap-md py-md">
              <Loader2
                size={32}
                className="animate-spin text-primary-500"
                aria-hidden="true"
              />
              <p className="text-body text-neutral-500">Verificando…</p>
            </div>
          )}

          {verifyState.status === 'success' && (
            <>
              <p className="text-body text-neutral-800">{t('verifyEmailSuccess.body')}</p>
              <Button asChild className="w-full">
                <Link to="/login">{t('verifyEmailSuccess.primaryCta')}</Link>
              </Button>
            </>
          )}

          {verifyState.status === 'error' && (
            <>
              <Alert variant="destructive">
                <AlertDescription>
                  {getErrorMessage(verifyState.code)}
                </AlertDescription>
              </Alert>
              <div className="flex justify-center">
                <Link
                  to="/verificar-email"
                  className="text-label text-primary-500 hover:text-primary-700"
                >
                  Reenviar e-mail de verificação
                </Link>
              </div>
            </>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}

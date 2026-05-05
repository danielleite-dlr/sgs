import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { Button } from '@/components/ui/button';
import { useResendVerificationMutation } from '../api/auth.api';
import { useResendCooldown } from '../hooks/useResendCooldown';

export function VerifyEmailPendingPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [resend, { loading }] = useResendVerificationMutation();
  const { remainingSeconds, isActive, start } = useResendCooldown();

  useEffect(() => {
    document.title = t('verifyEmail.pageTitle');
  }, [t]);

  async function handleResend() {
    if (isActive || loading) return;
    if (!email) return;

    try {
      const res = await resend({ variables: { input: { email } } });
      const payload = res.data?.resendVerification;

      if (payload?.success) {
        toast.success(t('verifyEmail.successAfterResend'));
        // Use cooldown from server or default 60s
        const cooldown = payload.cooldownSeconds ?? 60;
        start(cooldown);
      } else if (payload?.errors?.length) {
        // Cooldown enforced server-side
        start(60);
      }
    } catch {
      // Silently handle network errors — button re-enables
    }
  }

  return (
    <AuthShell>
      <AuthCard heading={t('verifyEmail.cardHeading')}>
        <div className="space-y-md">
          <p className="text-body text-neutral-800">
            {t('verifyEmail.body', { email: email || '...' })}
          </p>

          <Button
            type="button"
            className="w-full"
            disabled={isActive || loading || !email}
            onClick={handleResend}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-xs animate-spin" aria-hidden="true" />
                {t('verifyEmail.loadingCta')}
              </>
            ) : isActive ? (
              t('verifyEmail.rateLimitNote', { seconds: remainingSeconds })
            ) : (
              t('verifyEmail.resendCta')
            )}
          </Button>

          <div className="flex justify-center">
            <Link
              to="/signup"
              className="text-label text-primary-500 hover:text-primary-700"
            >
              {t('verifyEmail.wrongEmailLink')}
            </Link>
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

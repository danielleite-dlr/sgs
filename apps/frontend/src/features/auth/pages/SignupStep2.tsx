import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { StepIndicator } from '../components/StepIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSignupMutation } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';
import type { SignupDraft } from './SignupPage';

const schema = z.object({
  salonName: z.string().min(2),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  draft: SignupDraft;
  onBack: () => void;
  onUpdate: (draft: SignupDraft) => void;
}

export function SignupStep2({ draft, onBack, onUpdate }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const salonNameRef = useRef<HTMLInputElement | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signup, { loading }] = useSignupMutation();
  const { applyAuthPayload } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      salonName: draft.salonName,
    },
  });

  useEffect(() => {
    salonNameRef.current?.focus();
  }, []);

  async function onSubmit(values: FormValues) {
    setAuthError(null);
    onUpdate({ ...draft, salonName: values.salonName });

    try {
      const res = await signup({
        variables: {
          input: {
            fullName: draft.fullName,
            email: draft.email,
            password: draft.password,
            salonName: values.salonName,
          },
        },
      });

      const payload = res.data?.signup;
      if (!payload) {
        setAuthError(t('signup.step2.errors.serverGeneric'));
        return;
      }

      if (payload.errors.length > 0) {
        const e = payload.errors[0];
        if (e.code === 'EMAIL_TAKEN') {
          setAuthError(t('signup.step1.errors.emailExists'));
        } else {
          setAuthError(t('signup.step2.errors.serverGeneric'));
        }
        return;
      }

      // On success — navigate to email verification page
      // Attempt to apply session if returned (some flows may auto-verify)
      applyAuthPayload(payload);
      navigate('/verificar-email', {
        state: { email: draft.email },
        replace: true,
      });
    } catch {
      setAuthError(t('signup.step2.errors.serverGeneric'));
    }
  }

  const { ref: salonNameRegRef, ...salonNameRegRest } = register('salonName');

  return (
    <AuthShell>
      <AuthCard
        heading={t('signup.step2.cardHeading')}
        stepIndicator={<StepIndicator current={2} total={2} />}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
          {authError && (
            <Alert variant="destructive">
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-xs">
            <Label htmlFor="salonName">{t('signup.step2.salonNameLabel')}</Label>
            <Input
              id="salonName"
              type="text"
              placeholder={t('signup.step2.salonNamePlaceholder')}
              aria-invalid={!!errors.salonName}
              {...salonNameRegRest}
              ref={(el) => {
                salonNameRegRef(el);
                salonNameRef.current = el;
              }}
            />
            {errors.salonName && (
              <p className="text-label text-error-500" role="alert">
                {t('signup.step2.errors.salonNameTooShort')}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!isValid || loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="mr-xs animate-spin" aria-hidden="true" />
                {t('signup.step2.loadingCta')}
              </>
            ) : (
              t('signup.step2.primaryCta')
            )}
          </Button>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={onBack}
              className="text-label text-primary-500 hover:text-primary-700"
            >
              {t('signup.step2.backLink')}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

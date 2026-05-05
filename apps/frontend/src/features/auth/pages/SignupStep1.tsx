import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';
import { StepIndicator } from '../components/StepIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SignupDraft } from './SignupPage';

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  draft: SignupDraft;
  onNext: (draft: SignupDraft) => void;
}

export function SignupStep1({ draft, onNext }: Props) {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      fullName: draft.fullName,
      email: draft.email,
      password: draft.password,
    },
  });

  useEffect(() => {
    document.title = t('signup.pageTitle');
    nameRef.current?.focus();
  }, [t]);

  function onSubmit(values: FormValues) {
    onNext({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      salonName: draft.salonName,
    });
  }

  const { ref: nameRegRef, ...nameRegRest } = register('fullName');

  return (
    <AuthShell>
      <AuthCard
        heading={t('signup.step1.cardHeading')}
        stepIndicator={<StepIndicator current={1} total={2} />}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-md" noValidate>
          <div className="space-y-xs">
            <Label htmlFor="fullName">{t('signup.step1.nameLabel')}</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder={t('signup.step1.namePlaceholder')}
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
            <Label htmlFor="email">{t('signup.step1.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('signup.step1.emailPlaceholder')}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-label text-error-500" role="alert">
                {t('signup.step1.errors.emailFormat')}
              </p>
            )}
          </div>

          <div className="space-y-xs">
            <Label htmlFor="password">{t('signup.step1.passwordLabel')}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t('signup.step1.passwordPlaceholder')}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-label text-error-500" role="alert">
                {t('signup.step1.errors.passwordTooShort')}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!isValid}>
            {t('signup.step1.primaryCta')}
          </Button>

          <div className="flex justify-center">
            <Link
              to="/login"
              className="text-label text-primary-500 hover:text-primary-700"
            >
              {t('signup.step1.linkToLogin')}
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

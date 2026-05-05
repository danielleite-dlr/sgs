import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '../components/AuthShell';
import { AuthCard } from '../components/AuthCard';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = t('notFound.pageTitle');
  }, [t]);

  return (
    <AuthShell>
      <AuthCard heading={t('notFound.heading')}>
        <div className="space-y-md">
          <p className="text-body text-neutral-800">{t('notFound.body')}</p>
          <Button
            type="button"
            className="w-full"
            onClick={() => navigate('/', { replace: true })}
          >
            {t('notFound.primaryCta')}
          </Button>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function ServicosPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t('pages.servicos.tab');
  }, [t]);

  return (
    <>
      <PageHeader
        title={t('pages.servicos.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.servicos.h1') },
        ]}
        cta={<Button>{t('pages.servicos.newCta')}</Button>}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

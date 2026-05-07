import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function ComissoesPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t('pages.comissoes.tab');
  }, [t]);

  return (
    <>
      <PageHeader
        title={t('pages.comissoes.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.comissoes.h1') },
        ]}
        cta={<Button>{t('pages.comissoes.newCta')}</Button>}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

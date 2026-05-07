import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function CategoriasPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t('pages.categorias.tab');
  }, [t]);

  return (
    <>
      <PageHeader
        title={t('pages.categorias.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.categorias.h1') },
        ]}
        cta={<Button>{t('pages.categorias.newCta')}</Button>}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

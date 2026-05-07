import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function ProdutosPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t('pages.produtos.tab');
  }, [t]);

  return (
    <>
      <PageHeader
        title={t('pages.produtos.h1')}
        breadcrumbs={[
          { label: t('navigation.catalog') },
          { label: t('pages.produtos.h1') },
        ]}
        cta={<Button>{t('pages.produtos.newCta')}</Button>}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

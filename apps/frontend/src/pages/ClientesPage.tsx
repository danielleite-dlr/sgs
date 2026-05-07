import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function ClientesPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t('pages.clientes.tab');
  }, [t]);

  return (
    <>
      <PageHeader
        title={t('pages.clientes.h1')}
        breadcrumbs={[{ label: t('pages.clientes.h1') }]}
        cta={<Button>{t('pages.clientes.newCta')}</Button>}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';

export function ClienteDetailPage() {
  const { t } = useTranslation();
  // Replace by Wave 3 with real client data fetch
  useEffect(() => {
    document.title = `Cliente — SGS`;
  }, []);

  return (
    <>
      <PageHeader
        title="Cliente"
        breadcrumbs={[
          { label: t('navigation.clientes'), to: '/clientes' },
          { label: 'Cliente' },
        ]}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

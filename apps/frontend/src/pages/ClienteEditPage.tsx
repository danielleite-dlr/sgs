import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';

export function ClienteEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    document.title = `Editar cliente — SGS`;
  }, []);

  return (
    <>
      <PageHeader
        title="Editar cliente"
        breadcrumbs={[
          { label: t('navigation.clientes'), to: '/clientes' },
          { label: 'Cliente', to: id ? `/clientes/${id}` : '/clientes' },
          { label: 'Editar cliente' },
        ]}
      />
      <p className="text-sm text-neutral-500">Em breve.</p>
    </>
  );
}

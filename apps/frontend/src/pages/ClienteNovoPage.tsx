import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientForm } from '@/features/clients/components/ClientForm';

export function ClienteNovoPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${t('pages.clientes.newTitle')} — SGS`;
  }, [t]);
  return <ClientForm />;
}

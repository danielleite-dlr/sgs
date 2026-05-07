import { useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientByIdQuery } from '@/features/clients/api/clients.api';
import type { ClientByIdResult } from '@/features/clients/api/clients.api';
import { ClientHistoryTab } from '@/features/clients/components/ClientHistoryTab';
import { formatCpf } from '@/features/clients/utils/cpf';

export function ClienteDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useQuery<ClientByIdResult>(ClientByIdQuery, {
    variables: { id },
    skip: !id,
  });

  useEffect(() => {
    if (data?.client?.fullName) {
      document.title = `${data.client.fullName} — SGS`;
    }
  }, [data]);

  if (!id || error) return <Navigate to="/clientes" replace />;
  if (loading) {
    return (
      <div className="space-y-md">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!data?.client) return <Navigate to="/clientes" replace />;

  const c = data.client;

  return (
    <>
      <PageHeader
        title={c.fullName}
        breadcrumbs={[
          { label: t('navigation.clientes'), to: '/clientes' },
          { label: c.fullName },
        ]}
        cta={
          <Button
            variant="outline"
            onClick={() => navigate(`/clientes/${c.id}/editar`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        }
      />

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">{t('clients.tabs.data')}</TabsTrigger>
          <TabsTrigger value="history">{t('clients.tabs.history')}</TabsTrigger>
        </TabsList>

        {/* Dados tab */}
        <TabsContent value="data">
          <Card>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-md p-lg">
              <Field label={t('clients.form.fullName')} value={c.fullName} />
              <Field label={t('clients.form.phone')} value={c.phone ?? '—'} />
              <Field label={t('clients.form.email')} value={c.email ?? '—'} />
              <Field
                label={t('clients.form.cpf')}
                value={c.cpf ? formatCpf(c.cpf) : '—'}
              />
              <Field
                label={t('clients.form.birthDate')}
                value={
                  c.birthDate
                    ? new Date(c.birthDate).toLocaleDateString('pt-BR')
                    : '—'
                }
              />
              <Field
                label={t('clients.form.address')}
                value={c.address ?? '—'}
              />
              {/* Notes spans 2 columns on desktop (UI-SPEC §Client Detail) */}
              <Field
                label={t('clients.form.notes')}
                value={c.notes ?? '—'}
                className="md:col-span-2"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico tab */}
        <TabsContent value="history">
          <ClientHistoryTab clientId={c.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-sm font-semibold text-neutral-500">{label}</div>
      <div className="text-base text-neutral-800">{value}</div>
    </div>
  );
}

import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ClientByIdQuery } from '@/features/clients/api/clients.api';
import type { ClientByIdResult } from '@/features/clients/api/clients.api';
import { ClientForm } from '@/features/clients/components/ClientForm';
import { Skeleton } from '@/components/ui/skeleton';

export function ClienteEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useQuery<ClientByIdResult>(ClientByIdQuery, {
    variables: { id },
    skip: !id,
  });

  useEffect(() => {
    document.title = 'Editar cliente — SGS';
  }, []);

  if (!id || error) return <Navigate to="/clientes" replace />;
  if (loading) {
    return (
      <div className="space-y-md max-w-2xl">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!data?.client) return <Navigate to="/clientes" replace />;

  return <ClientForm initial={data.client} />;
}

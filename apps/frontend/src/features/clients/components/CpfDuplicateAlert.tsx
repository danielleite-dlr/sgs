import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface DuplicateClient {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

/**
 * CPF Duplicate Alert — per UI-SPEC §CPF Duplicate Alert (D-22).
 *
 * Renders an amber-accented alert listing existing clients that share the same CPF.
 * Each client row shows name + contact info + a "Usar este cliente" link.
 * The alert DOES NOT block saving — it warns and lets the attendant decide.
 *
 * Renders nothing if clients array is empty.
 */
export function CpfDuplicateAlert({ clients }: { clients: DuplicateClient[] }) {
  const { t } = useTranslation();

  if (clients.length === 0) return null;

  return (
    <Alert className="border-l-4 border-l-warning-500 bg-warning-500/10">
      <TriangleAlert className="h-4 w-4 text-warning-500" />
      <AlertTitle>{t('clients.duplicate.title')}</AlertTitle>
      <AlertDescription>
        <p className="mb-2">{t('clients.duplicate.body')}</p>
        <ul className="space-y-1">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center gap-1 flex-wrap">
              <Link
                to={`/clientes/${c.id}`}
                className="text-primary-500 underline font-medium"
              >
                {c.fullName}
              </Link>
              {' — '}
              <span className="text-neutral-500 text-sm">
                {c.phone ?? c.email ?? ''}
              </span>
              <Link
                to={`/clientes/${c.id}`}
                className="text-primary-500 ml-2 text-sm"
              >
                [{t('clients.duplicate.useExisting')}]
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-neutral-500">
          {t('clients.duplicate.continueNote')}
        </p>
      </AlertDescription>
    </Alert>
  );
}

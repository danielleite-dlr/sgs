import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { CommercialRef } from '../api/leads.api';

interface Props {
  clients: CommercialRef[];
  leads: CommercialRef[];
  /** Cliente escolhida para ligar ao lead. */
  linkedClientId?: string | null;
  onLinkClient: (clientId: string) => void;
}

/** D-02: avisa quando o telefone/e-mail já pertence a uma cliente ou a outro lead. */
export function DuplicateWarning({ clients, leads, linkedClientId, onLinkClient }: Props) {
  if (clients.length === 0 && leads.length === 0) return null;
  return (
    <div
      role="status"
      className="space-y-xs rounded-md border border-neutral-200 bg-neutral-50 p-sm text-sm"
    >
      {clients.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-sm">
          <span className="min-w-0 break-words text-neutral-800">{`Já é cliente: ${c.fullName}`}</span>
          {linkedClientId === c.id ? (
            <span className="shrink-0 text-xs font-semibold text-neutral-600">
              Será ligada a esta cliente
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onLinkClient(c.id)}
            >
              Ligar a esta cliente
            </Button>
          )}
        </div>
      ))}
      {leads.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-sm">
          <span className="min-w-0 break-words text-neutral-800">{`Já existe um lead: ${l.fullName}`}</span>
          <Link
            to={`/comercial/leads/${l.id}`}
            className="shrink-0 text-sm font-semibold text-primary underline"
          >
            Abrir lead existente
          </Link>
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientsListQuery, type ClientsListResult } from '@/features/clients/api/clients.api';
import { ServicesQuery, type ServicesQueryResult } from '@/features/catalog/api/servicos.api';
import { maskBrPhone } from '@/features/identity/member-validation';
import { PURPOSE_LABEL } from '../lib/bridal-labels';
import type { PersonDraft } from '../lib/person-draft';

const SELECT_CLASS =
  'mt-xs w-full rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white';
const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

interface Props {
  idPrefix: string;
  title: string;
  value: PersonDraft;
  onChange: (next: PersonDraft) => void;
  onRemove?: () => void;
  /** Esconde "Incluída no contrato" (ex.: tela que só edita serviços). */
  hideCoverage?: boolean;
  /** Só escolher/cadastrar a cliente (sem relação, cobertura nem serviços). */
  compact?: boolean;
}

export function BridalPersonFields({
  idPrefix,
  title,
  value,
  onChange,
  onRemove,
  hideCoverage,
  compact,
}: Props) {
  const [search, setSearch] = useState('');
  const { data: clients } = useQuery<ClientsListResult>(ClientsListQuery, {
    variables: { search: search || null, limit: 8, offset: 0 },
    skip: value.mode !== 'existing',
  });
  const { data: servicesData } = useQuery<ServicesQueryResult>(ServicesQuery);
  const services = servicesData?.services ?? [];
  const patch = (p: Partial<PersonDraft>) => onChange({ ...value, ...p });

  return (
    <fieldset
      className="rounded-md border border-neutral-200 p-sm space-y-sm"
      data-testid={`${idPrefix}-fields`}
    >
      <legend className="px-xs text-sm font-bold text-neutral-800">{title}</legend>
      <div className="flex flex-wrap items-center gap-md">
        <label className="flex items-center gap-xs text-sm">
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={value.mode === 'new'}
            onChange={() => patch({ mode: 'new' })}
            data-testid={`${idPrefix}-mode-new`}
          />
          Nova cliente
        </label>
        <label className="flex items-center gap-xs text-sm">
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={value.mode === 'existing'}
            onChange={() => patch({ mode: 'existing' })}
            data-testid={`${idPrefix}-mode-existing`}
          />
          Cliente existente
        </label>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onRemove}
            aria-label={`Remover ${title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {value.mode === 'new' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          <div>
            <Label className={LABEL_CLASS} htmlFor={`${idPrefix}-name`}>
              Nome completo
            </Label>
            <Input
              id={`${idPrefix}-name`}
              data-testid={`${idPrefix}-name`}
              className="mt-xs"
              value={value.newName}
              onChange={(e) => patch({ newName: e.target.value })}
            />
          </div>
          <div>
            <Label className={LABEL_CLASS} htmlFor={`${idPrefix}-phone`}>
              Telefone (opcional)
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              data-testid={`${idPrefix}-phone`}
              className="mt-xs"
              inputMode="tel"
              value={value.newPhone}
              onChange={(e) => patch({ newPhone: maskBrPhone(e.target.value) })}
            />
          </div>
        </div>
      ) : (
        <div>
          <Label className={LABEL_CLASS} htmlFor={`${idPrefix}-search`}>
            Buscar cliente
          </Label>
          <Input
            id={`${idPrefix}-search`}
            data-testid={`${idPrefix}-search`}
            className="mt-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {value.clientId && (
            <p className="mt-xs text-sm text-neutral-800" aria-live="polite">
              Selecionada: <strong>{value.clientName}</strong>
            </p>
          )}
          <ul className="mt-xs max-h-32 overflow-auto text-sm">
            {(clients?.clients.rows ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full rounded px-sm py-xs text-left hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2"
                  onClick={() => patch({ clientId: c.id, clientName: c.fullName })}
                  data-testid={`${idPrefix}-pick-${c.id}`}
                >
                  {c.fullName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm items-end">
            <div>
              <Label className={LABEL_CLASS} htmlFor={`${idPrefix}-relation`}>
                Relação (ex.: Madrinha, Mãe)
              </Label>
              <Input
                id={`${idPrefix}-relation`}
                className="mt-xs"
                value={value.relationLabel}
                onChange={(e) => patch({ relationLabel: e.target.value })}
              />
            </div>
            {!hideCoverage && (
              <label className="flex items-center gap-xs text-sm">
                <input
                  type="checkbox"
                  checked={value.coveredByContract}
                  onChange={(e) => patch({ coveredByContract: e.target.checked })}
                  data-testid={`${idPrefix}-covered`}
                />
                Incluída no contrato
              </label>
            )}
          </div>

          <div>
            <Label className={LABEL_CLASS} htmlFor={`${idPrefix}-add-service`}>
              Adicionar serviço planejado
            </Label>
            <select
              id={`${idPrefix}-add-service`}
              data-testid={`${idPrefix}-add-service`}
              className={SELECT_CLASS}
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                patch({
                  services: [...value.services, { serviceId: e.target.value, purpose: 'event' }],
                });
              }}
            >
              <option value="">Selecione…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ul className="mt-xs space-y-xs">
              {value.services.map((s, i) => (
                <li key={`${s.serviceId}-${i}`} className="flex items-center gap-sm text-sm">
                  <span className="flex-1">
                    {services.find((x) => x.id === s.serviceId)?.name ?? 'Serviço'}
                  </span>
                  <label className="sr-only" htmlFor={`${idPrefix}-purpose-${i}`}>
                    Finalidade do serviço {i + 1}
                  </label>
                  <select
                    id={`${idPrefix}-purpose-${i}`}
                    className="rounded-md border border-neutral-200 px-sm py-xs text-sm bg-white"
                    value={s.purpose}
                    onChange={(e) =>
                      patch({
                        services: value.services.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                purpose: e.target.value as 'event' | 'trial',
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    {Object.entries(PURPOSE_LABEL).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remover serviço ${i + 1}`}
                    onClick={() =>
                      patch({
                        services: value.services.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </fieldset>
  );
}

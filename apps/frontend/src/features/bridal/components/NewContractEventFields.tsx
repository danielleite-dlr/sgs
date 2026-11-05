import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EVENT_KIND_LABEL } from '../lib/bridal-labels';
import type { NewContractValue } from '../lib/new-contract';
import { BridalPersonFields } from './BridalPersonFields';

const LABEL_CLASS = 'text-xs font-semibold text-neutral-700';

interface Props {
  value: NewContractValue;
  onChange: (next: NewContractValue) => void;
}

export function NewContractEventFields({ value, onChange }: Props) {
  const patch = (p: Partial<NewContractValue>) => onChange({ ...value, ...p });
  const debutante = value.eventKind === 'debutante';
  return (
    <div className="space-y-sm" data-testid="new-contract-fields">
      <p className="text-xs text-neutral-600">
        O grupo é criado junto com o contrato. Acompanhantes você adiciona depois, no grupo.
      </p>
      <fieldset>
        <legend className={LABEL_CLASS}>Tipo de evento</legend>
        <div className="mt-xs flex gap-md">
          {(['noiva', 'debutante'] as const).map((k) => (
            <label key={k} className="flex items-center gap-xs text-sm">
              <input
                type="radio"
                name="nc-event-kind"
                checked={value.eventKind === k}
                onChange={() => patch({ eventKind: k })}
                data-testid={`nc-kind-${k}`}
              />
              {EVENT_KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <BridalPersonFields
        compact
        idPrefix="nc-bride"
        title={debutante ? 'Debutante' : 'Noiva'}
        value={value.bride}
        onChange={(bride) => patch({ bride })}
      />
      {debutante && (
        <BridalPersonFields
          compact
          idPrefix="nc-responsible"
          title="Responsável (contratante)"
          value={value.responsible}
          onChange={(responsible) => patch({ responsible })}
        />
      )}
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div>
          <Label className={LABEL_CLASS} htmlFor="nc-date">
            Data do evento
          </Label>
          <Input
            id="nc-date"
            data-testid="nc-date"
            type="date"
            className="mt-xs"
            value={value.eventDate}
            onChange={(e) => patch({ eventDate: e.target.value })}
          />
        </div>
        <div>
          <Label className={LABEL_CLASS} htmlFor="nc-time">
            Horário (opcional)
          </Label>
          <Input
            id="nc-time"
            data-testid="nc-time"
            type="time"
            className="mt-xs"
            value={value.eventTime}
            onChange={(e) => patch({ eventTime: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

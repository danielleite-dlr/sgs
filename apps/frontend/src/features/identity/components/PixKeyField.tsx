import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PIX_KEY_TYPES, maskPixKey, type PixKeyType } from '../pix-key';

const TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Celular',
  evp: 'Chave aleatória',
};

const PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'nome@exemplo.com',
  phone: '(11) 98765-4321',
  evp: '00000000-0000-0000-0000-000000000000',
};

export interface PixKeyFieldProps {
  label: string;
  type: PixKeyType | null;
  value: string;
  onTypeChange: (type: PixKeyType) => void;
  onValueChange: (value: string) => void;
  error?: string;
  idPrefix?: string;
}

/**
 * Chave Pix com escolha do tipo (CPF, CNPJ, e-mail, telefone ou aleatória).
 * O tipo define a máscara e a validação; trocar de tipo limpa a chave.
 * Reutilizado no cadastro e na edição de membros.
 */
export function PixKeyField({
  label,
  type,
  value,
  onTypeChange,
  onValueChange,
  error,
  idPrefix = 'pix-key',
}: PixKeyFieldProps) {
  const inputId = `${idPrefix}-value`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <RadioGroup
        aria-label="Tipo de chave Pix"
        value={type ?? ''}
        onValueChange={(next) => {
          onTypeChange(next as PixKeyType);
          onValueChange('');
        }}
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        {PIX_KEY_TYPES.map((option) => (
          <div key={option} className="flex items-center gap-1.5">
            <RadioGroupItem value={option} id={`${idPrefix}-type-${option}`} />
            <Label htmlFor={`${idPrefix}-type-${option}`} className="font-normal">
              {TYPE_LABELS[option]}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Input
        id={inputId}
        value={value}
        disabled={!type}
        autoComplete="off"
        inputMode={type === 'cpf' || type === 'cnpj' || type === 'phone' ? 'numeric' : undefined}
        type={type === 'email' ? 'email' : 'text'}
        placeholder={type ? PLACEHOLDERS[type] : 'Selecione o tipo da chave'}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onValueChange(maskPixKey(type, e.target.value))}
      />
      {error && <p className="text-sm font-medium text-error-500">{error}</p>}
    </div>
  );
}

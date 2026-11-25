import { cn } from '@/lib/utils';

export interface AccessSwitchProps {
  checked: boolean | 'mixed';
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  /** id do elemento com o motivo da trava. */
  describedBy?: string;
  testId?: string;
}

/**
 * Liga/desliga acessível (WCAG 2.1 AA): botão com role="switch", alvo de 44 px,
 * foco visível; o estado também aparece por posição do botão, além do aria-checked.
 */
export function AccessSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  describedBy,
  testId,
}: AccessSwitchProps) {
  const on = checked === true;
  const mixed = checked === 'mixed';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? 'mixed' : on}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!on)}
      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full border border-neutral-400 transition-colors',
          on && 'border-primary-700 bg-primary-700',
          mixed && 'border-primary-700 bg-primary-100',
          !on && !mixed && 'bg-neutral-200',
        )}
      >
        <span
          className={cn(
            'absolute h-5 w-5 rounded-full bg-white shadow-sm transition-all',
            on ? 'left-[22px]' : mixed ? 'left-[11px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

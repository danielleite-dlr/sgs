import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NATIVE_SELECT_CLASS } from '@/lib/field-classes';
import { matchesSearch } from '@/lib/search-text';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id?: string;
  /** Vai no botão; cada opção recebe `${testId}-option-${value}` e a busca `${testId}-search`. */
  testId?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Select com campo de busca (Popover + cmdk). O botão tem a mesma aparência do select
 * nativo do formulário; o valor escolhido fica em `data-value` no botão.
 */
export function SearchableSelect({
  id,
  testId,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado.',
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          data-testid={testId}
          data-value={value}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(NATIVE_SELECT_CLASS, 'items-center justify-between gap-xs text-left', className)}
        >
          <span className={cn('truncate', !selected && 'text-neutral-500')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[calc(100vw-32px)]"
        align="start"
      >
        <Command
          filter={(_value, search, keywords) =>
            matchesSearch((keywords ?? []).join(' '), search) ? 1 : 0
          }
        >
          <CommandInput
            placeholder={searchPlaceholder}
            data-testid={testId ? `${testId}-search` : undefined}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={[o.label]}
                  data-testid={testId ? `${testId}-option-${o.value}` : undefined}
                  className="min-h-[44px]"
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      o.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

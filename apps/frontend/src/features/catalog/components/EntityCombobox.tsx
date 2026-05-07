import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

/**
 * Generic single-select Popover+Command combobox.
 *
 * Reused by CommissionRuleForm for:
 *   - MemberCombobox (fed by MembersQuery)
 *   - ServiceCombobox (fed by ServicesQuery)
 *   - ProductCombobox (fed by ProductsQuery)
 *
 * Pattern mirrors PackageServicesPicker but for single-select binding to a form field.
 * The item's `sublabel` (e.g., SKU for products, role for members) is shown as secondary
 * text and included in the Command search value for filtering.
 */

export interface EntityComboboxItem {
  id: string;
  label: string;
  sublabel?: string;
}

export interface EntityComboboxProps {
  items: EntityComboboxItem[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerLabel?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

export function EntityCombobox({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
}: EntityComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selected = items.find((i) => i.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className="w-full justify-between"
        >
          <span className={cn('truncate', !selected && 'text-neutral-500')}>
            {selected
              ? selected.label
              : loading
                ? t('common.loading', 'Carregando…')
                : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder ?? t('catalog.combobox.searchPlaceholder', 'Buscar…')}
          />
          <CommandList>
            <CommandEmpty>
              {emptyText ?? t('catalog.combobox.empty', 'Nenhum resultado.')}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sublabel ?? ''}`}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      selected?.id === item.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-neutral-500 truncate">{item.sublabel}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

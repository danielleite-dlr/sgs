import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ServicesQuery } from '../api/servicos.api';

export interface PackageServiceRow {
  serviceId: string;
  quantity: number;
}

interface ServiceItem {
  id: string;
  name: string;
  basePrice: string;
}

/**
 * Multi-select service picker with per-service quantity controls.
 *
 * Uses the Popover + Command shadcn composition (per UI-SPEC §Component Inventory).
 * This component is the canonical reference pattern for single-select EntityCombobox
 * (used in CommissionRuleForm for member/service/product pickers).
 *
 * Props:
 *   value    — controlled array of { serviceId, quantity } rows
 *   onChange — called with the new array on every add/remove/qty-change
 */
export function PackageServicesPicker({
  value,
  onChange,
}: {
  value: PackageServiceRow[];
  onChange: (next: PackageServiceRow[]) => void;
}) {
  const { t } = useTranslation();
  const { data } = useQuery(ServicesQuery);
  const services: ServiceItem[] = data?.services ?? [];
  const [open, setOpen] = useState(false);

  // Build display-ready rows by joining with service data
  const selected = value.map((row) => ({
    ...row,
    service: services.find((s) => s.id === row.serviceId),
  }));

  function add(serviceId: string) {
    if (value.find((v) => v.serviceId === serviceId)) return;
    onChange([...value, { serviceId, quantity: 1 }]);
    setOpen(false);
  }

  function setQty(serviceId: string, q: number) {
    onChange(
      value.map((v) => (v.serviceId === serviceId ? { ...v, quantity: Math.max(1, q) } : v)),
    );
  }

  function remove(serviceId: string) {
    onChange(value.filter((v) => v.serviceId !== serviceId));
  }

  // Only show services not already selected in the add popover
  const availableServices = services.filter((s) => !value.find((v) => v.serviceId === s.id));

  return (
    <div className="space-y-4">
      {/* Selected service rows */}
      <div className="space-y-2">
        {selected.length === 0 && (
          <p className="text-sm text-neutral-500">{t('catalog.pacote.picker.empty')}</p>
        )}
        {selected.map((row) => (
          <div key={row.serviceId} className="flex items-center gap-2">
            <span className="flex-1 text-sm">{row.service?.name ?? '—'}</span>
            <Input
              className="w-20"
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => setQty(row.serviceId, Number(e.target.value))}
              aria-label={t('catalog.pacote.picker.quantityLabel', {
                name: row.service?.name ?? '',
              })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('catalog.pacote.picker.remove', { name: row.service?.name ?? '' })}
              onClick={() => remove(row.serviceId)}
            >
              <Trash2 className="h-4 w-4 text-error-500" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add service combobox trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {t('catalog.pacote.picker.add')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[320px]">
          <Command>
            <CommandInput placeholder={t('catalog.pacote.picker.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{t('catalog.pacote.picker.noResults')}</CommandEmpty>
              <CommandGroup>
                {availableServices.map((s) => (
                  <CommandItem key={s.id} value={s.name} onSelect={() => add(s.id)}>
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

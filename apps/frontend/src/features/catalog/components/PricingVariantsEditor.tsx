import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export interface PricingVariantValue {
  name: string;
  durationMinutes: number;
  seniorityTier?: 'junior' | 'pleno' | 'senior' | null;
  price: string;
}

export function PricingVariantsEditor({ name = 'pricingVariants' }: { name?: string }) {
  const { t } = useTranslation();
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('catalog.pricingVariants.title')}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            append({ name: '', durationMinutes: 60, seniorityTier: null, price: '0.00' })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('catalog.pricingVariants.add')}
        </Button>
      </header>
      {fields.length === 0 && (
        <p className="text-sm text-neutral-500">{t('catalog.pricingVariants.emptyHint')}</p>
      )}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
            {/* Variant name — 4 cols */}
            <FormField
              control={control}
              name={`${name}.${index}.name`}
              render={({ field: f }) => (
                <FormItem className="col-span-4">
                  <FormLabel className="text-sm font-semibold">
                    {t('catalog.pricingVariants.fields.name')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...f}
                      placeholder={t('catalog.pricingVariants.fields.namePlaceholder')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Duration — 2 cols */}
            <FormField
              control={control}
              name={`${name}.${index}.durationMinutes`}
              render={({ field: f }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-sm font-semibold">
                    {t('catalog.pricingVariants.fields.duration')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...f}
                      onChange={(e) => f.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Seniority — 3 cols */}
            <FormField
              control={control}
              name={`${name}.${index}.seniorityTier`}
              render={({ field: f }) => (
                <FormItem className="col-span-3">
                  <FormLabel className="text-sm font-semibold">
                    {t('catalog.pricingVariants.fields.seniority')}
                  </FormLabel>
                  <Select
                    onValueChange={(v) => f.onChange(v === 'none' ? null : v)}
                    value={f.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('catalog.seniority.none')}</SelectItem>
                      <SelectItem value="junior">{t('catalog.seniority.junior')}</SelectItem>
                      <SelectItem value="pleno">{t('catalog.seniority.pleno')}</SelectItem>
                      <SelectItem value="senior">{t('catalog.seniority.senior')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {/* Price — 2 cols */}
            <FormField
              control={control}
              name={`${name}.${index}.price`}
              render={({ field: f }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="text-sm font-semibold">
                    {t('catalog.pricingVariants.fields.price')}
                  </FormLabel>
                  <FormControl>
                    <Input {...f} placeholder="R$ 0,00" inputMode="decimal" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Delete — 1 col */}
            <div className="col-span-1 flex items-end justify-center pt-[26px]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('catalog.pricingVariants.remove', {
                  name: (field as Record<string, unknown>).name || `variante ${index + 1}`,
                })}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  BridalAssistantSettingsQuery,
  UpdateBridalAssistantSettingsMutation,
} from '../api/pacotes.api';
import { formatCurrencyDisplay, maskCurrency, unmaskCurrency } from '../utils/currency-mask';

interface SettingsResult {
  bridalAssistantSettings: { dailyRate: string };
}

interface UpdateResult {
  updateBridalAssistantSettings: {
    settings: { dailyRate: string } | null;
    errors: Array<{ code: string; message: string; field?: string | null }>;
  };
}

/**
 * Diária vigente da assistente (09.1 D-06), editada de forma discreta na linha da
 * assistente dentro de Serviços do pacote (quick 261126-w00). Vale para todos os pacotes.
 * Quem renderiza decide a permissão (financial.read).
 */
export function BridalAssistantRateEditor() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data } = useQuery<SettingsResult>(BridalAssistantSettingsQuery);
  const [update, { loading }] = useMutation<UpdateResult>(UpdateBridalAssistantSettingsMutation, {
    refetchQueries: ['Packages', 'BridalAssistantSettings'],
  });

  const serverRate = data?.bridalAssistantSettings?.dailyRate;
  const serverDisplay = serverRate != null ? formatCurrencyDisplay(serverRate) : '';
  const [value, setValue] = useState('');

  useEffect(() => {
    if (serverRate != null) setValue(formatCurrencyDisplay(serverRate));
  }, [serverRate, open]);

  const unchanged = value === serverDisplay;

  async function handleSave() {
    try {
      const res = await update({ variables: { dailyRate: unmaskCurrency(value) } });
      const errors = res.data?.updateBridalAssistantSettings?.errors ?? [];
      if (errors.length) {
        toast.error(errors[0].message);
        return;
      }
      toast.success(t('catalog.pacote.bridalAssistantRateSaved'));
      setOpen(false);
    } catch {
      toast.error(t('catalog.servico.errors.generic', 'Não foi possível salvar. Tente novamente.'));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="bridal-assistant-rate-edit"
          aria-label={t('catalog.pacote.bridalAssistantRateEdit')}
          title={t('catalog.pacote.bridalAssistantRateEdit')}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2" data-testid="bridal-assistant-rate-popover">
        <Label htmlFor="bridal-assistant-rate" className="text-sm">
          {t('catalog.pacote.bridalAssistantDailyCostLabel')} (R$)
        </Label>
        <div className="flex gap-2">
          <Input
            id="bridal-assistant-rate"
            data-testid="bridal-assistant-rate"
            inputMode="numeric"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(maskCurrency(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!loading && !unchanged && value !== '') void handleSave();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            data-testid="bridal-assistant-rate-save"
            disabled={loading || unchanged || value === ''}
            onClick={handleSave}
          >
            {t('catalog.pacote.bridalAssistantRateSave')}
          </Button>
        </div>
        <p className="text-xs text-neutral-500">{t('catalog.pacote.bridalAssistantRateHint')}</p>
      </PopoverContent>
    </Popover>
  );
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/** Diária vigente da assistente da noiva (09.1 D-06). Só ADMIN/MANAGER veem. */
export function BridalAssistantRateCard() {
  const { t } = useTranslation();
  const { data } = useQuery<SettingsResult>(BridalAssistantSettingsQuery);
  const [update, { loading }] = useMutation<UpdateResult>(UpdateBridalAssistantSettingsMutation, {
    refetchQueries: ['Packages', 'BridalAssistantSettings'],
  });

  const serverRate = data?.bridalAssistantSettings?.dailyRate;
  const serverDisplay = serverRate != null ? formatCurrencyDisplay(serverRate) : '';
  const [value, setValue] = useState('');

  useEffect(() => {
    if (serverRate != null) setValue(formatCurrencyDisplay(serverRate));
  }, [serverRate]);

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
    } catch {
      toast.error(t('catalog.servico.errors.generic', 'Não foi possível salvar. Tente novamente.'));
    }
  }

  return (
    <Card className="mb-md" data-testid="bridal-assistant-rate-card">
      <CardHeader>
        <CardTitle className="text-base">{t('catalog.pacote.bridalAssistantRateTitle')}</CardTitle>
        <CardDescription>{t('catalog.pacote.bridalAssistantRateHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-sm">
        <div className="space-y-1">
          <Label htmlFor="bridal-assistant-rate">
            {t('catalog.pacote.bridalAssistantDailyCostLabel')} (R$)
          </Label>
          <Input
            id="bridal-assistant-rate"
            data-testid="bridal-assistant-rate"
            className="w-40"
            inputMode="numeric"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(maskCurrency(e.target.value))}
          />
        </div>
        <Button
          type="button"
          data-testid="bridal-assistant-rate-save"
          disabled={loading || unchanged || value === ''}
          onClick={handleSave}
        >
          {t('catalog.pacote.bridalAssistantRateSave')}
        </Button>
      </CardContent>
    </Card>
  );
}

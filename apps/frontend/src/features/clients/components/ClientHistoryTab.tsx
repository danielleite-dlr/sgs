import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * ClientHistoryTab — Phase 2 stub per UI-SPEC §Client History Tab (D-23).
 *
 * Shows filter controls in disabled state with tooltip explaining Phase 3 will activate them.
 * Shows Clock empty state below the filters.
 *
 * Phase 3 contract: replace the empty state body with a list of ClientHistoryItem cards
 * when real comanda/appointment data is available. Each item has:
 *   - occurredAt (DateTime)
 *   - kind (appointment | product | comanda)
 *   - description (String)
 *   - amount (String, nullable)
 *   - professionalName (String, nullable)
 */
export function ClientHistoryTab(_: { clientId: string }) {
  const { t } = useTranslation();
  const tooltip = t('clients.history.filtersDisabledTooltip');

  function DisabledFilter({ label, placeholder }: { label: string; placeholder: string }) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="opacity-50 cursor-not-allowed pointer-events-none"
            aria-disabled="true"
          >
            <label className="block text-sm font-semibold text-neutral-500 mb-1">
              {label}
            </label>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-lg">
        {/* Filter row — disabled, showing Phase 3 will activate them (D-23) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <DisabledFilter
            label={t('clients.history.filters.period')}
            placeholder={t('financial.period.thisMonth')}
          />
          <DisabledFilter
            label={t('clients.history.filters.professional')}
            placeholder="—"
          />
          <DisabledFilter
            label={t('clients.history.filters.kind')}
            placeholder="—"
          />
        </div>

        {/* Empty state — Clock icon + heading + body (UI-SPEC §Empty States) */}
        <div className="flex flex-col items-center justify-center py-2xl text-center space-y-md">
          <Clock className="h-12 w-12 text-neutral-500" aria-hidden="true" />
          <h3 className="text-base font-semibold text-neutral-800">
            {t('clients.history.empty.heading')}
          </h3>
          <p className="text-sm text-neutral-500 max-w-md">
            {t('clients.history.empty.body')}
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

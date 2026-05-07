import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function ReorderControls({
  itemName,
  isFirst,
  isLast,
  onMove,
}: {
  itemName: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: 'UP' | 'DOWN') => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('catalog.reorder.up', { name: itemName })}
        disabled={isFirst}
        onClick={() => onMove('UP')}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('catalog.reorder.down', { name: itemName })}
        disabled={isLast}
        onClick={() => onMove('DOWN')}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

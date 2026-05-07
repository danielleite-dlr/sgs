import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Inline stock badge per UI-SPEC §Stock Low Badge (D-15).
 *
 * When quantity <= minLevel:
 *   - Renders: bg-error-500/10 text-error-500 border border-error-500/30 rounded-sm px-sm py-xs
 *   - Includes TriangleAlert icon (12px inline-left) per UI-SPEC fix (NOT 10px text)
 *   - aria-label for screen readers: "Estoque baixo: {quantity} {unit}"
 *
 * Normal stock:
 *   - Plain text value, no badge, no border
 */

const unitLabels: Record<string, string> = {
  un: 'un',
  ml: 'mL',
  g: 'g',
};

export interface StockBadgeProps {
  quantity: number;
  minLevel: number;
  unit: 'un' | 'ml' | 'g';
}

export function StockBadge({ quantity, minLevel, unit }: StockBadgeProps) {
  const isLow = quantity <= minLevel;
  const unitLabel = unitLabels[unit] ?? unit;

  if (!isLow) {
    return (
      <span className="text-base text-neutral-800">
        {quantity} {unitLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-sm font-semibold',
        'bg-error-500/10 text-error-500 border-error-500/30',
      )}
      aria-label={`Estoque baixo: ${quantity} ${unitLabel}`}
    >
      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
      {quantity} {unitLabel}
    </span>
  );
}

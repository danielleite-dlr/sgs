import { useTranslation } from 'react-i18next';

const fmt = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));

export interface PackagePriceSummaryProps {
  individualSum: string;
  packagePrice: string;
}

/**
 * Displays a side-by-side comparison of the individual services sum vs
 * the package price, with a color-coded delta indicator.
 *
 * Per UI-SPEC §Package Pricing Transparency:
 * - Both values rendered at 16px weight 600 (font-semibold)
 * - Package price above sum → "(R$ X acima do total individual)" in warning color
 * - Package price below sum → "(R$ X de desconto)" in success color
 * - Equal → no supplementary text
 */
export function PackagePriceSummary({ individualSum, packagePrice }: PackagePriceSummaryProps) {
  const { t } = useTranslation();
  const ind = Number(individualSum);
  const pkg = Number(packagePrice);
  const diff = pkg - ind;

  let delta: { text: string; cls: string } | null = null;
  if (diff > 0.001) {
    delta = {
      text: t('catalog.pacote.delta.above', { v: fmt(diff) }),
      cls: 'text-warning-500',
    };
  } else if (diff < -0.001) {
    delta = {
      text: t('catalog.pacote.delta.discount', { v: fmt(-diff) }),
      cls: 'text-success-500',
    };
  }

  return (
    <div className="flex flex-col space-y-1 text-base font-semibold">
      <div>
        {t('catalog.pacote.summary.individual')}: {fmt(ind)}
      </div>
      <div>
        {t('catalog.pacote.summary.package')}: {fmt(pkg)}
        {delta && (
          <span className={`ml-2 font-normal text-sm ${delta.cls}`}>{delta.text}</span>
        )}
      </div>
    </div>
  );
}

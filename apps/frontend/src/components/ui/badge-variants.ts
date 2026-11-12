import { cva } from 'class-variance-authority';

// Selo no padrão da Previsão de caixa (D-26): fundo #F9FAFB, borda #E5E7EB, raio 4 px, sem
// sombra. Os variants de status levam um ponto de 6 px na cor do status; `destructive` é o selo
// "em atraso" (texto #B91C1C sobre #FEF2F2), `secondary` o neutro, `accent` o roxo claro e
// `outflow` a saída (ponto laranja #D85A30).
const PONTO = "before:content-[''] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full";

export const badgeVariants = cva(
  'inline-flex min-h-6 items-center gap-xs rounded border border-neutral-200 bg-neutral-50 px-sm py-0.5 text-[12px] font-semibold leading-4 text-neutral-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-white',
        secondary: 'border-neutral-200 bg-neutral-100 text-neutral-600',
        accent: 'border-primary-200 bg-primary-50 text-primary-900',
        destructive: 'border-error-200 bg-error-50 text-error-700',
        outline: 'bg-white',
        success: `${PONTO} before:bg-success-500`,
        warning: `${PONTO} before:bg-warning-500`,
        error: `${PONTO} before:bg-error-500`,
        // Saída prevista/realizada (D-26): ponto laranja de saída, não o vermelho de erro.
        outflow: `${PONTO} before:bg-outflow-500`,
        info: `${PONTO} before:bg-info-500`,
        neutral: `${PONTO} border-neutral-200 bg-neutral-100 text-neutral-600 before:bg-status-done`,
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

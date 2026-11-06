import { cva } from 'class-variance-authority';

// Selo do Gestor Beauty (D-08, D-11): fundo #F7F6F3, borda #E2DFE5, raio 6 px, sem sombra.
// Os variants de status levam um ponto de 6 px na cor do status.
const PONTO = "before:content-[''] before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full";

export const badgeVariants = cva(
  'inline-flex min-h-6 items-center gap-xs rounded-md border border-neutral-200 bg-neutral-50 px-sm py-0.5 text-[12px] font-semibold leading-4 text-neutral-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-white',
        secondary: 'bg-neutral-100',
        destructive: 'border-error-500 bg-error-500 text-white',
        outline: 'bg-white',
        success: `${PONTO} before:bg-success-500`,
        warning: `${PONTO} before:bg-warning-500`,
        error: `${PONTO} before:bg-error-500`,
        info: `${PONTO} before:bg-info-500`,
        neutral: `${PONTO} before:bg-status-done`,
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

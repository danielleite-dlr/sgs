import { cva } from 'class-variance-authority';

// Botões do Gestor Beauty (06-UI-SPEC §4): raio 6 px, 44 px de altura, sem sombra (D-06, D-10).
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-xs rounded-md text-label font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-5',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-white hover:bg-primary-700 active:bg-primary-900',
        destructive:
          'bg-error-500 text-white hover:bg-error-700',
        outline:
          'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 hover:border-neutral-500',
        secondary:
          'border border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100',
        ghost:
          'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
        link:
          'text-primary underline-offset-4 hover:underline p-0 min-h-0 h-auto',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-11 px-md text-label',
        lg: 'h-12 px-xl',
        icon: 'h-11 w-11 px-0',
        full: 'h-11 w-full px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-xs rounded-md text-label font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-md',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-700 active:bg-primary-900',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-neutral-200 bg-transparent text-neutral-800 hover:bg-neutral-50 hover:border-neutral-500',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'text-neutral-800 hover:bg-neutral-50 hover:text-neutral-800',
        link:
          'text-primary underline-offset-4 hover:underline p-0 min-h-0 h-auto',
      },
      size: {
        default: 'h-11 px-md py-sm',
        sm: 'h-9 rounded-md px-sm text-label',
        lg: 'h-12 rounded-lg px-xl',
        icon: 'h-10 w-10 min-h-0',
        full: 'h-11 w-full px-md py-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

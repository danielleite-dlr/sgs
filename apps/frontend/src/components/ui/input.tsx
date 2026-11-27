import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // iOS Safari zooms the page when focusing controls below 16px. Keep the
          // mobile input at the platform minimum and preserve the compact desktop type.
          'flex h-11 min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-[14px] py-sm text-base text-neutral-800 placeholder:text-neutral-500 lg:text-body',
          'focus-visible:outline-none focus-visible:border-primary-500 focus-visible:shadow-[inset_0_0_0_0.5px_#7E22CE]',
          'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-neutral-100',
          'aria-[invalid=true]:border-error-500',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };

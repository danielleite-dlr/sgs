import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-md border border-neutral-200 bg-neutral-0 px-sm py-sm text-body text-neutral-800 placeholder:text-neutral-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:border-primary-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-error-500 aria-[invalid=true]:ring-error-500',
          'min-h-[44px]',
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

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.ComponentProps<'textarea'>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[88px] w-full rounded-md border border-neutral-200 bg-white px-[14px] py-[10px] text-body text-neutral-800 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:shadow-[inset_0_0_0_0.5px_#570080] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };

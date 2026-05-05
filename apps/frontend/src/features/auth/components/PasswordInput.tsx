import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    const { className, ...rest } = props;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          {...rest}
          className={`pr-10 ${className ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={0}
        >
          {visible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);

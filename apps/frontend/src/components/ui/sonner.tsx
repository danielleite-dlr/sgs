import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          // Toast do Gestor Beauty (06-UI-SPEC §4): branco, borda, raio 6 px e sem sombra.
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-neutral-800 group-[.toaster]:border group-[.toaster]:border-neutral-200 group-[.toaster]:rounded-md group-[.toaster]:!shadow-none',
          description: 'group-[.toast]:text-neutral-500',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-neutral-100 group-[.toast]:text-neutral-800',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

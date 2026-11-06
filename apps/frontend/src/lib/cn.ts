import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Os tamanhos de fonte do tema (text-label/body/heading/display) são
// customizados. Sem registrá-los, o tailwind-merge os confunde com cor de
// texto e descarta `text-primary-foreground` (texto escuro sobre roxo, UX-01).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['label', 'body', 'heading', 'display'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Os tamanhos de fonte do tema (text-label/body/heading/display e os do Gestor
// Beauty: display-lg, headline-lg/md/sm, overline, data) são customizados. Sem registrá-los, o tailwind-merge os confunde com cor de
// texto e descarta `text-primary-foreground` (texto escuro sobre roxo, UX-01).
// A escala de espaço do tema (xs…3xl) também é customizada: sem registrá-la, `cn('p-lg', 'p-0')`
// mantém as duas classes e o `p-lg` vence no CSS (diálogos com `p-0` ficavam com 24 px).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
    },
    classGroups: {
      'font-size': [
        {
          text: [
            'label',
            'body',
            'heading',
            'display',
            'display-lg',
            'headline-lg',
            'headline-md',
            'headline-sm',
            'overline',
            'data',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

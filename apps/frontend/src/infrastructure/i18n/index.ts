import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR.json';

export const defaultNS = 'translation';
export const resources = {
  'pt-BR': {
    translation: ptBR,
  },
} as const;

i18n
  .use(initReactI18next)
  .init({
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    defaultNS,
    resources,
    interpolation: {
      // React already escapes values, no need for i18next escaping
      escapeValue: false,
    },
    debug: import.meta.env.DEV,
  });

export default i18n;

import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        background: 'var(--color-background)',
        foreground: 'var(--color-text)',
        primary: {
          50:  '#F5E6FB',
          100: '#EBD3F5',
          200: '#E0B8F0',
          300: '#C98EE3',
          500: '#570080',
          600: '#4D0072',
          700: '#440064',
          900: '#370053',
          DEFAULT: '#570080',
          foreground: '#FFFFFF',
        },
        // Cores semânticas do Gestor Beauty (D-12): sucesso/entrada, erro/saída e alerta.
        success: {
          50:  '#E8F3EC',
          100: '#D1E7D9',
          200: '#A9D3B8',
          300: '#7DBB94',
          500: '#1B7A43',
          600: '#176A3A',
          700: '#125530',
          DEFAULT: '#1B7A43',
        },
        error: {
          50:  '#FFDAD6',
          100: '#FFDAD6',
          200: '#FFB4AB',
          300: '#F58E84',
          500: '#BA1A1A',
          600: '#BA1A1A',
          700: '#93000A',
          DEFAULT: '#BA1A1A',
        },
        warning: {
          50:  '#FDF3E3',
          100: '#FBE7C6',
          200: '#F7D29A',
          300: '#F3BC67',
          500: '#EF9F27',
          600: '#B36F0F',
          700: '#8A5300',
          DEFAULT: '#EF9F27',
        },
        info: { 500: '#0E61A8', DEFAULT: '#0E61A8' },
        // Cores de status da agenda (D-11).
        status: {
          scheduled: '#570080',
          confirmed: '#1B7A43',
          progress: '#0E61A8',
          done: '#49454F',
          missed: '#BA1A1A',
        },
        destructive: { DEFAULT: '#BA1A1A', foreground: '#FFFFFF' },
        // Todos os tons usados no código ficam declarados: o extend se mistura com a
        // paleta neutral padrão e um tom ausente voltaria ao cinza antigo (D-04/D-05).
        neutral: {
          0:   '#FFFFFF',
          50:  '#F7F6F3',
          100: '#F4F3F0',
          200: '#E2DFE5',
          300: '#CFCAD3',
          400: '#6B6670',
          500: '#6B6670',
          600: '#6B6670',
          700: '#221E26',
          800: '#221E26',
          900: '#221E26',
        },
        muted: { DEFAULT: '#F4F3F0', foreground: '#6B6670' },
        accent: { DEFAULT: '#F5E6FB', foreground: '#440064' },
        card: { DEFAULT: '#FFFFFF', foreground: '#221E26' },
        popover: { DEFAULT: '#FFFFFF', foreground: '#221E26' },
        secondary: { DEFAULT: '#F7F6F3', foreground: '#221E26' },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'ui-serif', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala Gestor Beauty (06-UI-SPEC §2)
        label:   ['13px', { lineHeight: '18px', fontWeight: '600' }],
        body:    ['14px', { lineHeight: '20px', fontWeight: '400' }],
        heading: ['20px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' }],
        display: ['28px', { lineHeight: '36px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'display-lg': [
          '36px',
          { lineHeight: '44px', fontWeight: '600', letterSpacing: '-0.02em' },
        ],
        'headline-lg': [
          '26px',
          { lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.015em' },
        ],
        'headline-md': [
          '20px',
          { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' },
        ],
        'headline-sm': ['17px', { lineHeight: '24px', fontWeight: '600' }],
        overline: ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.04em' }],
        data:     ['13px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '0.02em' }],
      },
      // Raio único de 6 px (D-08); rounded-full só em avatar e ponto de status.
      borderRadius: {
        none: '0px',
        sm: '6px',
        DEFAULT: '6px',
        md: '6px',
        lg: '6px',
        xl: '6px',
        '2xl': '6px',
        '3xl': '6px',
        full: '9999px',
      },
      // Sem sombras (D-09). `0 0 #0000` e não `none`: o Tailwind monta uma lista de
      // box-shadow junto com o ring, e `none` dentro de lista é CSS inválido.
      boxShadow: {
        sm: '0 0 #0000',
        DEFAULT: '0 0 #0000',
        md: '0 0 #0000',
        lg: '0 0 #0000',
        xl: '0 0 #0000',
        '2xl': '0 0 #0000',
        inner: '0 0 #0000',
        card: '0 0 #0000',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

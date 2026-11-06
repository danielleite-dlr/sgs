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
          600: '#4C0070',
          700: '#4C0070',
          // Selecionado: filtro segmentado e subitem de menu ativo (D-26).
          800: '#521873',
          900: '#370053',
          DEFAULT: '#570080',
          foreground: '#FFFFFF',
        },
        // Cores semânticas da Previsão de caixa (D-26): entrada/positivo, erro e alerta.
        success: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          500: '#109868',
          600: '#109868',
          700: '#0B7A53',
          DEFAULT: '#109868',
        },
        error: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          500: '#C53030',
          600: '#C53030',
          700: '#B91C1C',
          DEFAULT: '#C53030',
        },
        // Saída e valor negativo (D-26); erro de formulário continua em error-*.
        outflow: {
          50:  '#FDF0EB',
          500: '#D85A30',
          DEFAULT: '#D85A30',
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
          confirmed: '#109868',
          progress: '#0E61A8',
          done: '#49454F',
          missed: '#C53030',
        },
        destructive: { DEFAULT: '#C53030', foreground: '#FFFFFF' },
        // Todos os tons usados no código ficam declarados: o extend se mistura com a
        // paleta neutral padrão e um tom ausente voltaria ao cinza antigo (D-26).
        neutral: {
          0:   '#FFFFFF',
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        muted: { DEFAULT: '#F3F4F6', foreground: '#6B7280' },
        accent: { DEFAULT: '#F5E6FB', foreground: '#370053' },
        card: { DEFAULT: '#FFFFFF', foreground: '#1F2937' },
        popover: { DEFAULT: '#FFFFFF', foreground: '#1F2937' },
        secondary: { DEFAULT: '#F9FAFB', foreground: '#1F2937' },
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
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
      // Raio (D-26): cartões 8 px (lg), controles 6 px (md), selos 4 px (DEFAULT/sm);
      // rounded-full só em avatar e ponto de status.
      borderRadius: {
        none: '0px',
        sm: '4px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '8px',
        '2xl': '8px',
        '3xl': '8px',
        full: '9999px',
      },
      // Sombra leve só em cartões, faixas e filtro segmentado (D-26); nenhuma sombra grande.
      // `0 0 #0000` e não `none`: o Tailwind monta uma lista de box-shadow junto com o ring,
      // e `none` dentro de lista é CSS inválido.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        lg: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        xl: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '2xl': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        inner: '0 0 #0000',
        none: '0 0 #0000',
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

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
          50: '#EEEDFE',
          500: '#5D54C7',
          700: '#3C3489',
          900: '#26215C',
          DEFAULT: '#5D54C7',
          foreground: '#FFFFFF',
        },
        success: { 500: '#1D9E75', DEFAULT: '#1D9E75' },
        warning: { 500: '#EF9F27', DEFAULT: '#EF9F27' },
        error: { 500: '#D85A30', DEFAULT: '#D85A30' },
        destructive: { DEFAULT: '#D85A30', foreground: '#FFFFFF' },
        neutral: {
          0:   '#FFFFFF',
          50:  '#FAFAF8',
          200: '#E5E3DC',
          500: '#888780',
          800: '#2C2C2A',
        },
        muted: { DEFAULT: '#FAFAF8', foreground: '#888780' },
        accent: { DEFAULT: '#EEEDFE', foreground: '#3C3489' },
        card: { DEFAULT: '#FFFFFF', foreground: '#2C2C2A' },
        popover: { DEFAULT: '#FFFFFF', foreground: '#2C2C2A' },
        secondary: { DEFAULT: '#FAFAF8', foreground: '#2C2C2A' },
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
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // UI-SPEC mandates exactly 4 sizes
        label:   ['14px', { lineHeight: '1.4', fontWeight: '600' }],
        body:    ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        heading: ['20px', { lineHeight: '1.25', fontWeight: '600' }],
        display: ['24px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

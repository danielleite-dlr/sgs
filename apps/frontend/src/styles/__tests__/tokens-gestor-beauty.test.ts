import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';

// Trava dos tokens do layout (fase 6): valores da Previsão de caixa do Stitch (D-26), que
// substituem os de D-04, D-05, D-07 (fonte do texto), D-08, D-09 e D-12; foco de D-14.
// O tailwind.config.ts fica fora do include do tsconfig: é lido como texto.
const root = join(__dirname, '../../..');
const ler = (arquivo: string) => readFileSync(join(root, arquivo), 'utf8');
const bloco = (config: string, nome: string) =>
  config.match(new RegExp(`(^|\\s)${nome}:\\s*\\{([^}]*)\\}`))?.[2] ?? '';
const tom = (config: string, nome: string, chave: string) =>
  bloco(config, nome).match(new RegExp(`(^|\\s)'?${chave}'?:\\s*'([^']*)'`))?.[2];

describe('tokens Gestor Beauty (D-26)', () => {
  it('index.html carrega Inter e Source Serif 4, sem Public Sans (D-26)', () => {
    const html = ler('index.html');
    expect(html).toContain('family=Inter:wght@400;500;600;700');
    expect(html).toContain('family=Source+Serif+4:wght@600;700');
    expect(html).not.toContain('Public+Sans');
    expect(html).toContain('display=swap');
  });

  it('escala neutra da Previsão de caixa (fundo, linhas e texto)', () => {
    const config = ler('tailwind.config.ts');
    const esperado: Record<string, string> = {
      '0': '#FFFFFF',
      '50': '#F9FAFB',
      '100': '#F3F4F6',
      '200': '#E5E7EB',
      '300': '#D1D5DB',
      '400': '#9CA3AF',
      '500': '#6B7280',
      '600': '#4B5563',
      '700': '#374151',
      '800': '#1F2937',
      '900': '#111827',
    };
    for (const [chave, valor] of Object.entries(esperado)) {
      expect(tom(config, 'neutral', chave), `neutral-${chave}`).toBe(valor);
    }
  });

  it('entrada, saída, erro e roxos (D-26)', () => {
    const config = ler('tailwind.config.ts');
    expect(tom(config, 'success', '500')).toBe('#109868');
    expect(tom(config, 'success', 'DEFAULT')).toBe('#109868');
    expect(tom(config, 'error', '500')).toBe('#C53030');
    expect(tom(config, 'error', 'DEFAULT')).toBe('#C53030');
    expect(tom(config, 'outflow', '500')).toBe('#D85A30');
    expect(tom(config, 'outflow', 'DEFAULT')).toBe('#D85A30');
    expect(tom(config, 'primary', '500')).toBe('#570080');
    expect(tom(config, 'primary', '600')).toBe('#4C0070');
    expect(tom(config, 'primary', '700')).toBe('#4C0070');
    expect(tom(config, 'primary', '800')).toBe('#521873');
    expect(tom(config, 'status', 'confirmed')).toBe('#109868');
    expect(tom(config, 'status', 'missed')).toBe('#C53030');
    expect(config).toContain("destructive: { DEFAULT: '#C53030'");
  });

  it('fonte do texto Inter e títulos em Source Serif 4', () => {
    const config = ler('tailwind.config.ts');
    expect(config).toMatch(/sans:\s*\['Inter',/);
    expect(config).toMatch(/serif:\s*\['"Source Serif 4"'/);
    expect(config).not.toContain('Public Sans');
  });

  it('raio 4/6/8 px e só sombra leve (D-26)', () => {
    const config = ler('tailwind.config.ts');
    expect(tom(config, 'borderRadius', 'DEFAULT')).toBe('4px');
    expect(tom(config, 'borderRadius', 'sm')).toBe('4px');
    expect(tom(config, 'borderRadius', 'md')).toBe('6px');
    expect(tom(config, 'borderRadius', 'lg')).toBe('8px');
    const leve = '0 1px 2px 0 rgb(0 0 0 / 0.05)';
    for (const chave of ['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'card']) {
      expect(tom(config, 'boxShadow', chave), `shadow-${chave}`).toBe(leve);
    }
    expect(tom(config, 'boxShadow', 'none')).toBe('0 0 #0000');
  });

  it('tailwind.config.ts não tem mais as paletas anteriores', () => {
    const config = ler('tailwind.config.ts');
    for (const antigo of [
      '#1D9E75',
      '#888780',
      '#2C2C2A',
      '#FAFAF8',
      '#E5E3DC',
      '#3D005A',
      '#2B003F',
      'rgba(0,0,0,0.08)',
      '#F7F6F3',
      '#E2DFE5',
      '#221E26',
      '#6B6670',
      '#1B7A43',
      '#BA1A1A',
      '#F4F3F0',
      '#CFCAD3',
      '#440064',
    ]) {
      expect(config, antigo).not.toContain(antigo);
    }
  });

  it('globals.css tem fundo, borda, anel e foco de campo (D-14, D-26)', () => {
    const css = ler('src/styles/globals.css');
    expect(css).toContain('--color-neutral-50:  #F9FAFB');
    expect(css).toContain('--color-neutral-200: #E5E7EB');
    expect(css).toContain('--color-neutral-800: #1F2937');
    expect(css).toContain('--color-success-500: #109868');
    expect(css).toContain('--color-error-500:   #C53030');
    expect(css).toContain('--border: 220 13% 91%');
    expect(css).toContain('--ring: 281 100% 25%');
    expect(css).toMatch(/h1, h2 \{[^}]*font-weight:\s*700/);
    expect(css).toMatch(/box-shadow:\s*inset 0 0 0 0\.5px/);
    expect(css).toMatch(/\*:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  });

  it.each([
    'text-headline-lg',
    'text-headline-md',
    'text-headline-sm',
    'text-overline',
    'text-data',
    'text-display-lg',
  ])(
    'cn trata %s como tamanho e preserva text-white (UX-01)',
    (tamanho) => {
      const merged = cn('bg-primary text-white', tamanho);
      expect(merged).toContain('text-white');
      expect(merged).toContain(tamanho);
    },
  );
});

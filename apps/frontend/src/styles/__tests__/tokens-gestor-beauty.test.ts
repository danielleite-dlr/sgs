import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';

// Trava dos tokens do layout Gestor Beauty (fase 6, D-04 a D-09 e D-14).
// O tailwind.config.ts fica fora do include do tsconfig: é lido como texto.
const root = join(__dirname, '../../..');
const ler = (arquivo: string) => readFileSync(join(root, arquivo), 'utf8');

describe('tokens Gestor Beauty', () => {
  it('index.html carrega Public Sans e Source Serif 4, sem Inter (D-07)', () => {
    const html = ler('index.html');
    expect(html).not.toContain('family=Inter');
    expect(html).toContain('family=Source+Serif+4:wght@600');
    expect(html).toContain('family=Public+Sans:wght@400;500;600');
    expect(html).toContain('display=swap');
  });

  it('tailwind.config.ts tem fontes, cores e escala neutra completas', () => {
    const config = ler('tailwind.config.ts');
    for (const valor of [
      '"Public Sans"',
      '"Source Serif 4"',
      '#F7F6F3',
      '#E2DFE5',
      '#221E26',
      '#6B6670',
      '#440064',
      '#1B7A43',
      '#BA1A1A',
      '#0E61A8',
      '#49454F',
    ]) {
      expect(config, valor).toContain(valor);
    }
    const neutral = config.match(/neutral:\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const tom of ['0', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900']) {
      expect(neutral, `neutral-${tom}`).toMatch(new RegExp(`(^|\\s)${tom}:\\s*'#`));
    }
  });

  it('tailwind.config.ts não tem mais a fonte, as cores, o raio e a sombra antigos', () => {
    const config = ler('tailwind.config.ts');
    for (const antigo of [
      'Inter',
      '#1D9E75',
      '#D85A30',
      '#888780',
      '#2C2C2A',
      '#FAFAF8',
      '#E5E3DC',
      '#3D005A',
      '#2B003F',
      'rgba(0,0,0,0.08)',
    ]) {
      expect(config, antigo).not.toContain(antigo);
    }
    // 12px continua válido como tamanho de fonte (overline); só o raio antigo sai.
    const raio = config.match(/borderRadius:\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(raio).not.toBe('');
    expect(raio).not.toMatch(/'(4|8|12)px'/);
  });

  it('globals.css tem borda, anel e foco de campo do Gestor Beauty (D-14)', () => {
    const css = ler('src/styles/globals.css');
    expect(css).toContain('--border: 270 10% 89%');
    expect(css).toContain('--ring: 281 100% 25%');
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

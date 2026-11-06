import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import config from '../../../tailwind.config';

// Opção B (decisão da usuária em 2026-11-06): verde e laranja do Stitch ficam em números
// grandes e gráficos; texto pequeno de valor usa o tom 700, com contraste AA (4,5:1).

function lum(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cores = (config as any).theme.extend.colors;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : arquivos(p);
    return /\.(tsx|ts)$/.test(n) ? [p] : [];
  });
}

describe('contraste dos valores de entrada e saída (WCAG AA)', () => {
  it('os tons de texto passam de 4,5:1 sobre branco', () => {
    expect(contraste(cores.success['700'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.outflow['700'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('nenhum texto usa os tons claros (500/600) de entrada ou saída', () => {
    const src = resolve(__dirname, '../..');
    const achados = arquivos(src).flatMap((p) => {
      const t = readFileSync(p, 'utf8');
      return /\btext-(success|outflow)-(500|600)\b/.test(t) ? [p.slice(src.length + 1)] : [];
    });
    expect(achados).toEqual([]);
  });
});

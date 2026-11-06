import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';
import { cn } from '@/lib/cn';

const FORBIDDEN_TEXT = /(^|\s)text-(neutral-\d+|primary-(500|700|900)|foreground)(\s|$)/;

describe('contraste do botão primário (UX-01)', () => {
  it.each(['default', 'sm', 'lg', 'icon', 'full'] as const)(
    'botão padrão tamanho %s mantém texto branco sobre o roxo',
    (size) => {
      render(<Button size={size}>Salvar</Button>);
      const cls = screen.getByRole('button', { name: 'Salvar' }).className;
      expect(cls).toMatch(/(^|\s)bg-primary(\s|$)/);
      expect(cls).toMatch(/(^|\s)text-(white|primary-foreground)(\s|$)/);
      expect(cls).not.toMatch(FORBIDDEN_TEXT);
    },
  );

  it('cn não trata o tamanho text-label como cor e preserva a cor do texto', () => {
    const merged = cn('bg-primary text-primary-foreground', 'text-label');
    expect(merged).toContain('text-primary-foreground');
    expect(merged).toContain('text-label');
  });

  it('toda superfície sólida roxa/grafite do SchedulePage e de button-variants tem text-white', () => {
    const root = join(__dirname, '../../..');
    const files = [
      'components/ui/button-variants.ts',
      'features/operations/pages/SchedulePage.tsx',
    ];
    const solid = /\b(bg-primary-500|bg-primary-700|bg-neutral-800|bg-primary)(?![\w/-])/;
    for (const f of files) {
      for (const [i, line] of readFileSync(join(root, f), 'utf8').split('\n').entries()) {
        const m = line.match(/["'`]([^"'`]*)["'`]/g) ?? [];
        for (const str of m) {
          if (!solid.test(str) || /(hover|active|data-\[[^\]]+\]):bg-/.test(str) && !/(^|[\s"'`])bg-(primary|neutral)/.test(str)) continue;
          expect(str, `${f}:${i + 1}`).toMatch(/text-(white|primary-foreground)/);
        }
      }
    }
  });
});

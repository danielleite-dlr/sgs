import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn com os tokens do tema', () => {
  it('funde a escala de espaço customizada (xs…3xl)', () => {
    expect(cn('p-lg gap-md', 'p-0 gap-0')).toBe('p-0 gap-0');
    expect(cn('px-md', 'px-sm')).toBe('px-sm');
    expect(cn('mt-xl', 'mt-0')).toBe('mt-0');
    expect(cn('space-y-sm', 'space-y-lg')).toBe('space-y-lg');
  });

  it('mantém eixos diferentes e o tamanho de fonte separado da cor', () => {
    expect(cn('px-md', 'py-sm')).toBe('px-md py-sm');
    expect(cn('text-body text-primary-foreground')).toBe('text-body text-primary-foreground');
  });
});

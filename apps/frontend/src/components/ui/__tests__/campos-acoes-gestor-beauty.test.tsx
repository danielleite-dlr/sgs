import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';
import { Badge } from '../badge';
import { Input } from '../input';
import { Textarea } from '../textarea';
import { Label } from '../label';
import { EntityAvatar } from '../entity-avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { buttonVariants } from '../button-variants';
import { badgeVariants } from '../badge-variants';
import { FIELD_LABEL_CLASS, NATIVE_SELECT_CLASS } from '@/lib/field-classes';

// Campos e ações do layout Gestor Beauty (fase 6, D-06, D-08, D-10, D-13, D-14).
const SOMBRA = /(^|\s)shadow/;
const temClasses = (cls: string, esperadas: string[]) => {
  const tokens = cls.split(/\s+/);
  for (const c of esperadas) expect(tokens, c).toContain(c);
};

describe('botão Gestor Beauty', () => {
  it('padrão: roxo com texto branco, hover #4C0070, raio 6 px e 44 px', () => {
    render(<Button>Salvar</Button>);
    temClasses(screen.getByRole('button', { name: 'Salvar' }).className, [
      'bg-primary',
      'text-white',
      'hover:bg-primary-700',
      'rounded-md',
      'min-h-[44px]',
    ]);
  });

  it('outline é branco com borda e texto principal; ghost tem texto secundário', () => {
    render(
      <>
        <Button variant="outline">Cancelar</Button>
        <Button variant="ghost">Voltar</Button>
      </>,
    );
    temClasses(screen.getByRole('button', { name: 'Cancelar' }).className, [
      'bg-white',
      'border-neutral-200',
      'text-neutral-800',
    ]);
    temClasses(screen.getByRole('button', { name: 'Voltar' }).className, ['text-neutral-500']);
  });

  it('size="icon" tem 44 × 44 px', () => {
    render(
      <Button size="icon" aria-label="Fechar">
        x
      </Button>,
    );
    temClasses(screen.getByRole('button', { name: 'Fechar' }).className, ['h-11', 'w-11']);
  });

  it('nenhum variant ou tamanho tem sombra', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    const sizes = ['default', 'sm', 'lg', 'icon', 'full'] as const;
    for (const variant of variants) {
      for (const size of sizes) {
        expect(buttonVariants({ variant, size }), `${variant}/${size}`).not.toMatch(SOMBRA);
      }
    }
  });
});

describe('campos Gestor Beauty', () => {
  const semAnel = (cls: string) => {
    const tokens = cls.split(/\s+/);
    for (const proibida of ['ring-2', 'ring-1', 'shadow-sm']) {
      expect(tokens.some((t) => t.endsWith(proibida)), proibida).toBe(false);
    }
  };

  it('Input: 44 px, raio 6 px, borda #E5E7EB, fundo branco e foco por borda', () => {
    render(<Input aria-label="Nome" />);
    const cls = screen.getByLabelText('Nome').className;
    temClasses(cls, [
      'h-11',
      'rounded-md',
      'border-neutral-200',
      'bg-white',
      'focus-visible:border-primary-500',
    ]);
    semAnel(cls);
  });

  it('Textarea: mínimo de 88 px, raio 6 px e foco por borda', () => {
    render(<Textarea aria-label="Observações" />);
    const cls = screen.getByLabelText('Observações').className;
    temClasses(cls, [
      'min-h-[88px]',
      'rounded-md',
      'border-neutral-200',
      'bg-white',
      'focus-visible:border-primary-500',
    ]);
    semAnel(cls);
  });

  it('SelectTrigger: 44 px, raio 6 px e foco por borda; SelectItem com 44 px', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger aria-label="Profissional">
          <SelectValue placeholder="Escolha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ana">Ana</SelectItem>
        </SelectContent>
      </Select>,
    );
    const cls = screen.getByRole('combobox', { name: 'Profissional', hidden: true }).className;
    temClasses(cls, [
      'h-11',
      'rounded-md',
      'border-neutral-200',
      'bg-white',
      'focus:border-primary-500',
    ]);
    semAnel(cls);
    temClasses(screen.getByRole('option', { name: 'Ana' }).className, ['min-h-[44px]']);
  });

  it('Label em maiúsculas pequenas e texto secundário (D-13)', () => {
    render(<Label>Telefone</Label>);
    temClasses(screen.getByText('Telefone').className, [
      'text-overline',
      'uppercase',
      'text-neutral-500',
    ]);
  });

  it('classes compartilhadas dos selects nativos e dos rótulos', () => {
    const tokens = NATIVE_SELECT_CLASS.split(/\s+/);
    const esperadas = ['h-11', 'rounded-md', 'border-neutral-200', 'focus-visible:border-primary-500'];
    for (const c of esperadas) expect(tokens, c).toContain(c);
    expect(FIELD_LABEL_CLASS).toBe('text-overline uppercase text-neutral-500');
  });
});

describe('badge e avatar Gestor Beauty', () => {
  it('Badge success: selo claro com borda e ponto verde', () => {
    render(<Badge variant="success">Pago</Badge>);
    temClasses(screen.getByText('Pago').className, [
      'bg-neutral-50',
      'border-neutral-200',
      'before:bg-success-500',
    ]);
  });

  it('nenhum variant de Badge tem sombra', () => {
    const variants = [
      'default',
      'secondary',
      'destructive',
      'outline',
      'success',
      'warning',
      'error',
      'info',
      'neutral',
    ] as const;
    for (const variant of variants) {
      expect(badgeVariants({ variant }), variant).not.toMatch(SOMBRA);
    }
  });

  it('EntityAvatar de cliente é redondo; os demais têm raio 6 px', () => {
    const { container } = render(
      <>
        <EntityAvatar name="Julia Souza" kind="client" />
        <EntityAvatar name="Corte" kind="service" />
      </>,
    );
    const [cliente, servico] = Array.from(container.querySelectorAll('div'));
    expect(cliente.className.split(/\s+/)).toContain('rounded-full');
    expect(servico.className.split(/\s+/)).toContain('rounded-md');
    expect(servico.className.split(/\s+/)).not.toContain('rounded-full');
  });
});

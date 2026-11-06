import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../sheet';
import { Tabs, TabsList, TabsTrigger } from '../tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { Command, CommandGroup, CommandItem, CommandList } from '../command';

// Superfícies do layout Gestor Beauty (fase 6, D-06 a D-10; cores, raio e sombra de D-26).
const SOMBRA = /(^|\s)(hover:|focus:)?shadow(-(sm|md|lg|xl|card))?(\s|$)/;
const temClasses = (cls: string, esperadas: string[]) => {
  const tokens = cls.split(/\s+/);
  for (const c of esperadas) expect(tokens, c).toContain(c);
};
const semSombra = (raiz: ParentNode) => {
  for (const el of Array.from(raiz.querySelectorAll('[class]'))) {
    expect(el.getAttribute('class') ?? '', el.tagName).not.toMatch(SOMBRA);
  }
};

describe('cartão e tabela', () => {
  it('Card branco com borda, raio 8 px e só sombra leve (D-26); CardTitle em serifa', () => {
    const { container } = render(
      <Card data-testid="cartao">
        <CardHeader>
          <CardTitle>Resumo do dia</CardTitle>
        </CardHeader>
        <CardContent>Conteúdo</CardContent>
      </Card>,
    );
    const cartao = screen.getByTestId('cartao');
    const cls = cartao.className;
    for (const grande of ['shadow-card', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl']) {
      expect(cls.split(/\s+/), grande).not.toContain(grande);
    }
    temClasses(cls, ['rounded-lg', 'shadow-sm', 'border', 'border-neutral-200', 'bg-white']);
    temClasses(screen.getByText('Resumo do dia').className, ['font-serif']);
    semSombra(cartao);
    expect(container.firstElementChild).toBe(cartao);
  });

  it('TableHead 11 px em maiúsculas sobre #F9FAFB; linha com divisor claro; TableCell tabular', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>R$ 10,00</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    temClasses(screen.getByText('Valor').className, [
      'text-[11px]',
      'font-semibold',
      'uppercase',
      'tracking-wider',
      'text-neutral-500',
      'bg-neutral-50',
    ]);
    const linha = screen.getByText('R$ 10,00').closest('tr')!;
    temClasses(linha.className, ['border-neutral-100', 'hover:bg-neutral-50/60']);
    temClasses(container.querySelector('thead')!.className, ['bg-neutral-50']);
    temClasses(screen.getByText('R$ 10,00').className, ['tabular-nums']);
    semSombra(container);
  });
});

describe('diálogo e folha', () => {
  it('DialogContent sem sombra, raio 6 px, fundo rgba(31,41,55,0.40) e fechar de 44 px', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>Preencha os dados.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const conteudo = screen.getByRole('dialog');
    temClasses(conteudo.className, ['rounded-md']);
    expect(conteudo.className.split(/\s+/)).not.toContain('shadow-lg');
    const overlay = conteudo.previousElementSibling as HTMLElement;
    temClasses(overlay.className, ['bg-[rgba(31,41,55,0.40)]']);
    temClasses(screen.getByRole('button', { name: 'Fechar' }).className, ['h-11', 'w-11']);
    temClasses(screen.getByText('Novo agendamento').className, ['font-serif', 'text-headline-md']);
    semSombra(document.body);
  });

  it('SheetContent sem sombra, mesmo fundo e botão "Fechar" de 44 px', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navegação</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const conteudo = screen.getByRole('dialog');
    expect(conteudo.className.split(/\s+/)).not.toContain('shadow-lg');
    const overlay = conteudo.previousElementSibling as HTMLElement;
    temClasses(overlay.className, ['bg-[rgba(31,41,55,0.40)]']);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    temClasses(screen.getByRole('button', { name: 'Fechar' }).className, ['h-11', 'w-11']);
    semSombra(document.body);
  });
});

describe('abas, menus e comando', () => {
  it('TabsTrigger com 44 px e ativo roxo com texto branco', () => {
    const { container } = render(
      <Tabs defaultValue="dia">
        <TabsList>
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    temClasses(screen.getByRole('tab', { name: 'Dia' }).className, [
      'min-h-[44px]',
      'data-[state=active]:bg-primary',
      'data-[state=active]:text-white',
    ]);
    semSombra(container);
  });

  it('DropdownMenuItem com 44 px', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Ações</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Editar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    temClasses(screen.getByRole('menuitem', { name: 'Editar' }).className, ['min-h-[44px]']);
    semSombra(document.body);
  });

  it('CommandItem com 44 px e raio 6 px', () => {
    const { container } = render(
      <Command>
        <CommandList>
          <CommandGroup heading="Páginas">
            <CommandItem>Agenda</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    temClasses(screen.getByRole('option', { name: 'Agenda' }).className, [
      'min-h-[44px]',
      'rounded-md',
    ]);
    semSombra(container);
  });
});

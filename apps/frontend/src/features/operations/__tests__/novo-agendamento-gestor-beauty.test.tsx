import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { VisitFormDialog } from '../components/calendar/VisitFormDialog';
import type { ScheduleProfessional } from '../components/calendar/types';

// Fase 6, lote 06-04: Novo agendamento no layout Gestor Beauty (D-13, D-20, UX-03, UX-04).

const emptyClients: MockedResponse = {
  request: { query: ClientsListQuery },
  variableMatcher: () => true,
  maxUsageCount: 50,
  result: { data: { clients: { __typename: 'ClientsPage', totalCount: 0, rows: [] } } },
};

function service(id: string, name: string, basePrice: string) {
  return {
    __typename: 'Service',
    id,
    name,
    categoryId: 'cat',
    category: { __typename: 'ServiceCategory', id: 'cat', name: 'Maquiagem', parentId: null },
    basePrice,
    defaultDurationMinutes: 60,
    displayOrder: 1,
    coverImageUrl: null,
    pricingVariants: [],
  };
}

const servicesMock: MockedResponse = {
  request: { query: ServicesQuery },
  variableMatcher: () => true,
  maxUsageCount: 50,
  result: {
    data: {
      services: [
        service('s1', 'Maquiagem social', '220.00'),
        service('s2', 'Penteado', '160.00'),
      ],
    },
  },
};

function pros(n: number): ScheduleProfessional[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Profissional ${i + 1}`,
    initials: `P${i + 1}`,
    color: '#570080',
  }));
}

function renderDialog(
  opts: { professionals?: ScheduleProfessional[]; profId?: string; open?: boolean } = {},
) {
  const props = {
    onOpenChange: () => undefined,
    date: new Date(2026, 10, 6),
    professionals: opts.professionals ?? [],
    initialTime: opts.profId ? { hour: 9, minute: 0, profId: opts.profId } : undefined,
    onCreated: () => undefined,
  };
  const utils = render(
    <MockedProvider mocks={[emptyClients, servicesMock]}>
      <VisitFormDialog open={opts.open ?? true} {...props} />
    </MockedProvider>,
  );
  const rerenderOpen = (open: boolean) =>
    utils.rerender(
      <MockedProvider mocks={[emptyClients, servicesMock]}>
        <VisitFormDialog open={open} {...props} />
      </MockedProvider>,
    );
  return { ...utils, rerenderOpen };
}

describe('Novo agendamento: cabeçalho e rótulos (D-13, UX-04)', () => {
  it('título em serifa sem maiúsculas e um único botão Fechar', () => {
    renderDialog();
    const title = screen.getByText('Cadastrar agendamento');
    expect(title).toHaveClass('font-serif', 'text-headline-md');
    expect(title.className).not.toMatch(/uppercase/);
    expect(screen.getByText('Preencha os detalhes do atendimento')).not.toHaveClass('sr-only');
    // p-lg/gap-md do DialogContent são tokens que o cn não funde: zerar também no sm.
    expect(screen.getByTestId('visit-form')).toHaveClass('sm:p-0', 'sm:gap-0', 'max-sm:gap-0');
    const fechar = screen.getAllByRole('button', { name: /fechar|close/i });
    expect(fechar).toHaveLength(1);
  });

  it('todo rótulo de campo é overline em maiúsculas cinza', () => {
    renderDialog();
    const form = screen.getByTestId('visit-form');
    const labels = form.querySelectorAll('label');
    expect(labels.length).toBeGreaterThan(5);
    labels.forEach((l) => expect(l).toHaveClass('text-overline', 'uppercase', 'text-neutral-500'));
  });
});

describe('Novo agendamento: chips de serviço (D-20)', () => {
  it('mostra nome e preço do serviço escolhido e a contagem', async () => {
    renderDialog();
    const select = screen.getByTestId('visit-line-0-service');
    await screen.findByRole('option', { name: 'Maquiagem social' });
    const chips = screen.getByTestId('visit-service-chips');
    expect(chips.querySelectorAll('[data-testid^="visit-service-chip-"]')).toHaveLength(0);
    expect(screen.getByTestId('visit-service-count')).toHaveTextContent('0 selecionados');

    fireEvent.change(select, { target: { value: 's1' } });
    expect(screen.getByTestId('visit-service-count')).toHaveTextContent('1 selecionado');
    const chip = within(chips).getByTestId('visit-service-chip-0');
    expect(chip).toHaveTextContent('Maquiagem social');
    expect(within(chip).getByText('R$ 220,00')).toHaveClass('tabular-nums');

    const add = within(chips).getByTestId('visit-add-line');
    expect(add).toHaveClass('min-h-[44px]');
    expect(add).toHaveTextContent('Adicionar serviço');
    fireEvent.click(add);
    fireEvent.change(screen.getByTestId('visit-line-1-service'), { target: { value: 's2' } });
    expect(screen.getByTestId('visit-service-count')).toHaveTextContent('2 selecionados');
    expect(within(chips).getByTestId('visit-service-chip-1')).toHaveTextContent('PenteadoR$ 160,00');
  });

  it('nenhum data-testid novo começa com appointment-card-', () => {
    renderDialog({ professionals: pros(2) });
    expect(document.querySelectorAll('[data-testid^="appointment-card-"]')).toHaveLength(0);
  });
});

describe('Novo agendamento: profissional segmentado (D-20, D-06, WCAG 2.1 AA)', () => {
  it('até 4 profissionais vira radiogroup de 44 px com o marcado roxo', () => {
    renderDialog({ professionals: pros(2), profId: 'p1' });
    const group = screen.getByTestId('visit-line-0-professional');
    expect(group).toHaveAttribute('role', 'radiogroup');
    expect(group).toHaveAttribute('aria-label', 'Profissional');
    const p1 = screen.getByTestId('visit-line-0-professional-p1');
    const p2 = screen.getByTestId('visit-line-0-professional-p2');
    for (const r of [p1, p2]) {
      expect(r).toHaveAttribute('role', 'radio');
      expect(r).toHaveClass('min-h-[44px]');
    }
    expect(p1).toHaveAttribute('aria-checked', 'true');
    expect(p1).toHaveClass('bg-primary', 'text-white');
    expect(p2).toHaveAttribute('aria-checked', 'false');
    expect(p2).not.toHaveClass('bg-primary');

    fireEvent.click(p2);
    expect(p2).toHaveAttribute('aria-checked', 'true');
    expect(p2).toHaveClass('bg-primary', 'text-white');
    expect(p1).toHaveAttribute('aria-checked', 'false');
  });

  it('com mais de 4 profissionais continua o select', () => {
    renderDialog({ professionals: pros(5) });
    expect(screen.getByTestId('visit-line-0-professional').tagName).toBe('SELECT');
  });

  it('tabIndex móvel: só o marcado (ou o primeiro, se nenhum) recebe Tab', () => {
    const { unmount } = renderDialog({ professionals: pros(3) });
    const radios = within(screen.getByTestId('visit-line-0-professional')).getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    unmount();
    renderDialog({ professionals: pros(3), profId: 'p2' });
    const marcados = within(screen.getByTestId('visit-line-0-professional')).getAllByRole('radio');
    expect(marcados.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('setas marcam e focam a próxima/anterior com volta; Espaço marca', async () => {
    const user = userEvent.setup();
    renderDialog({ professionals: pros(3) });
    const [r1, r2, r3] = within(screen.getByTestId('visit-line-0-professional')).getAllByRole(
      'radio',
    );
    r1.focus();
    await user.keyboard(' ');
    expect(r1).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(r2);
    expect(r2).toHaveAttribute('aria-checked', 'true');
    expect(r1).toHaveAttribute('aria-checked', 'false');
    expect(r2.tabIndex).toBe(0);
    expect(r1.tabIndex).toBe(-1);

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(r1);
    expect(r1).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(r2);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(r1);

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(r3);
    expect(r3).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(r1);
    expect(r1).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Novo agendamento: quando, erro e rodapé (D-20, UX-01)', () => {
  it('Data, Hora e Duração ficam na mesma grade de 12 colunas', () => {
    renderDialog();
    const when = screen.getByTestId('visit-when');
    expect(when).toHaveClass('grid-cols-12');
    for (const id of ['visit-date', 'visit-line-0-time', 'visit-line-0-duration']) {
      expect(when).toContainElement(screen.getByTestId(id));
    }
  });

  it('o erro aparece logo depois dos serviços, antes do Sinal', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('visit-submit'));
    const error = screen.getByTestId('visit-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveClass('text-error-600');
    const line = screen.getByRole('group', { name: 'Serviço 1' });
    const toggle = screen.getByTestId('visit-deposit-toggle');
    expect(line.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(error.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"Salvar" é a ação principal roxa de 44 px', () => {
    renderDialog();
    const submit = screen.getByTestId('visit-submit');
    expect(submit).toHaveClass('bg-primary', 'text-white', 'min-h-[44px]');
    expect(submit).toHaveTextContent('Salvar');
  });
});

describe('Novo agendamento: Sinal recolhido (D-20)', () => {
  it('começa recolhido e abre com um toque', () => {
    renderDialog();
    const toggle = screen.getByTestId('visit-deposit-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('min-h-[44px]');
    expect(screen.queryByTestId('visit-deposit-amount')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('visit-deposit-amount')).toBeInTheDocument();
    expect(screen.getByTestId('visit-deposit-method')).toBeInTheDocument();
  });

  it('reabre já aberto quando o sinal está preenchido e mostra o resumo', () => {
    const { rerenderOpen } = renderDialog();
    fireEvent.click(screen.getByTestId('visit-deposit-toggle'));
    fireEvent.change(screen.getByTestId('visit-deposit-amount'), { target: { value: '5000' } });
    expect(screen.getByTestId('visit-deposit-toggle')).toHaveTextContent('R$ 50,00 por Pix');
    rerenderOpen(false);
    rerenderOpen(true);
    expect(screen.getByTestId('visit-deposit-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('visit-deposit-amount')).toHaveValue('50,00');
  });
});

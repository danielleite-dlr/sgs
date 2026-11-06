import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ComandaQuery, type ComandaData } from '../api/comandas.api';
import { ComandaPage } from '../pages/ComandaPage';
import { PaymentPanel } from '../components/comanda/PaymentPanel';
import { makeComanda } from './comanda-fixtures';

// Fase 6, lote Comanda (06-05): visual Gestor Beauty sem mudar comportamento.

function withTypenames(c: ComandaData) {
  return {
    __typename: 'Comanda',
    ...c,
    client: { __typename: 'Client', ...c.client },
    items: c.items.map((i) => ({
      __typename: 'ComandaItem',
      ...i,
      professional: { __typename: 'Member', ...i.professional },
    })),
    payments: c.payments.map((p) => ({ __typename: 'ComandaPayment', ...p })),
    commissions: c.commissions.map((x) => ({ __typename: 'ComandaCommission', ...x })),
  };
}

async function renderPage(comanda: ComandaData) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ComandaQuery, variables: { id: 'cm1' } },
      result: { data: { comanda: withTypenames(comanda) } },
    },
  ];
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/comanda/cm1']}>
        <Routes>
          <Route path="/comanda/:id" element={<ComandaPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
  await screen.findByTestId('comanda-status');
}

function renderPanel(comanda: ComandaData) {
  render(
    <PaymentPanel
      comanda={comanda}
      canWrite
      canClose
      busy={false}
      onAddPayment={vi.fn().mockResolvedValue(undefined)}
      onRemovePayment={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

const baseItem = {
  kind: 'service',
  serviceId: 's1',
  productId: null,
  packageId: null,
  appointmentId: null,
  serviceVariantId: null,
  professionalId: 'm1',
  professional: { id: 'm1', displayName: 'Ana Pro' },
  quantity: 1,
  contractId: null,
  contractCode: null,
};

const items = [
  {
    ...baseItem,
    id: 'i1',
    name: 'Corte',
    listUnitPrice: '80.00',
    unitPrice: '80.00',
    total: '80.00',
  },
  {
    ...baseItem,
    id: 'i2',
    kind: 'product',
    serviceId: null,
    productId: 'p1',
    name: 'Shampoo',
    listUnitPrice: '55.00',
    unitPrice: '55.00',
    total: '55.00',
  },
] as ComandaData['items'];

const closedWithCommission: Partial<ComandaData> = {
  status: 'closed',
  items,
  canClose: true,
  closeError: null,
  paid: '135.00',
  remaining: '0.00',
  payments: [{ id: 'p1', method: 'pix', amount: '135.00', paidAt: '', memberId: null }],
  commissions: [
    {
      id: 'k1',
      comandaItemId: 'i1',
      memberId: 'm1',
      memberName: 'Ana Pro',
      itemName: 'Corte',
      kind: 'accrual',
      cycle: 1,
      baseAmount: '80.00',
      chargedAmount: '80.00',
      calculatedAmount: '32.00',
      noRule: false,
      reversed: false,
    },
  ],
};

describe('Comanda no layout Gestor Beauty (06-05)', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.write', 'comanda.close'] });
  });

  it('título continua "Comanda C-2026-001"', async () => {
    await renderPage(makeComanda({ items }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Comanda C-2026-001');
  });

  it.each([
    ['open', 'Aberta', 'before:bg-info-500'],
    ['closed', 'Fechada', 'before:bg-success-500'],
    ['cancelled', 'Cancelada', 'before:bg-error-500'],
  ])('status %s vira selo com ponto (%s)', async (status, label, dot) => {
    await renderPage(makeComanda({ items, status }));
    const selo = screen.getByTestId('comanda-status');
    expect(selo).toHaveTextContent(label);
    expect(selo).toHaveClass(dot);
    expect(selo.className).not.toMatch(/\buppercase\b/);
  });

  it('nome da cliente em serifa com toDisplayName', async () => {
    const base = makeComanda({ items });
    await renderPage({ ...base, client: { ...base.client, fullName: 'MARIA SILVA' } });
    const card = screen.getByTestId('comanda-client-card');
    const nome = within(card).getByText('Maria Silva');
    expect(nome).toHaveClass('font-serif');
    expect(screen.getByTestId('comanda-client-credit')).toHaveClass('tabular-nums');
  });

  it('itens com divisor fino e valores tabulares sem quebra', async () => {
    await renderPage(makeComanda({ items }));
    for (const id of ['i1', 'i2']) {
      const linha = screen.getByTestId(`comanda-item-${id}`);
      expect(linha).toHaveClass('border-b', 'border-neutral-200', 'last:border-b-0');
      expect(screen.getByTestId(`comanda-item-valores-${id}`)).toHaveClass(
        'shrink-0',
        'whitespace-nowrap',
        'tabular-nums',
      );
    }
    expect(screen.getByTestId('comanda-item-i1').className).not.toMatch(/bg-neutral-50/);
  });

  it('títulos dos cartões são h2 em serifa headline-sm e nenhum cartão tem sombra grande', async () => {
    await renderPage(makeComanda({ items }));
    for (const titulo of ['Cliente', 'Itens da comanda', 'Adicionar à comanda', 'Pagamento']) {
      const h2 = screen.getByRole('heading', { level: 2, name: titulo });
      expect(h2).toHaveClass('font-serif', 'text-headline-sm');
      expect(h2.className).not.toMatch(/\btext-base\b/);
    }
    // D-26: cartão com cantos de 8 px e só a sombra leve (shadow-sm).
    const cartoes = document.querySelectorAll('.rounded-lg.border, .rounded-md.border');
    expect(cartoes.length).toBeGreaterThan(0);
    for (const c of Array.from(cartoes)) {
      expect(c.className).not.toMatch(/(^|\s)([a-z-]+:)?shadow(-(md|lg|xl|2xl))?(\s|$)/);
    }
  });

  it('botões de adicionar são outline de 44 px alinhados à esquerda', async () => {
    await renderPage(makeComanda({ items }));
    for (const id of ['comanda-add-service', 'comanda-add-product', 'comanda-add-package']) {
      expect(screen.getByTestId(id)).toHaveClass('min-h-[44px]', 'justify-start', 'border');
    }
  });

  it('comissões: título em serifa e cabeçalho da tabela em overline', async () => {
    await renderPage(makeComanda(closedWithCommission));
    const bloco = screen.getByTestId('comanda-commissions');
    const h2 = within(bloco).getByRole('heading', { level: 2 });
    expect(h2).toHaveClass('font-serif', 'text-headline-sm');
    const thead = bloco.querySelector('thead tr');
    expect(thead).toHaveClass('bg-neutral-100', 'text-overline', 'uppercase', 'text-neutral-500');
    const valor = within(bloco).getByText('R$ 32,00');
    expect(valor.closest('td')).toHaveClass('tabular-nums', 'text-right');
  });

  it('aviso de comissão sem regra usa o Alert de alerta', async () => {
    await renderPage(makeComanda({ ...closedWithCommission, hasCommissionWarnings: true }));
    expect(screen.getByTestId('comanda-commission-warning')).toHaveClass('border-warning-500');
  });
});

describe('Painel de pagamento no layout Gestor Beauty (06-05)', () => {
  it('resumo com valores tabulares, divisor por linha e Falta em destaque', () => {
    renderPanel(makeComanda({ items }));
    for (const id of ['payment-total', 'payment-paid', 'payment-remaining', 'payment-change']) {
      const dd = screen.getByTestId(id);
      expect(dd).toHaveClass('tabular-nums', 'whitespace-nowrap');
      expect(dd.parentElement).toHaveClass('border-b', 'border-neutral-200', 'last:border-b-0');
    }
    const falta = screen.getByTestId('payment-remaining');
    expect(falta).toHaveTextContent('R$ 135,00');
    expect(falta).toHaveClass('text-neutral-800', 'font-semibold');
    const dtFalta = falta.parentElement?.querySelector('dt');
    expect(dtFalta).toHaveTextContent('Falta');
    expect(dtFalta).toHaveClass('text-overline', 'uppercase');
  });

  it('troco maior que zero fica em verde de sucesso', () => {
    renderPanel(
      makeComanda({
        items,
        canClose: true,
        closeError: null,
        payments: [{ id: 'p1', method: 'cash', amount: '150.00', paidAt: '', memberId: null }],
      }),
    );
    expect(screen.getByTestId('payment-change')).toHaveTextContent('R$ 15,00');
    expect(screen.getByTestId('payment-change')).toHaveClass('text-success-500');
  });

  it('linhas de pagamento com valor tabular e remover de 44 px', () => {
    renderPanel(
      makeComanda({
        items,
        payments: [{ id: 'p1', method: 'pix', amount: '50.00', paidAt: '', memberId: null }],
      }),
    );
    const linha = screen.getByTestId('payment-row-p1');
    expect(linha).toHaveClass('border-b', 'border-neutral-200', 'last:border-b-0');
    expect(within(linha).getByText('Pix')).toHaveClass('text-body');
    expect(within(linha).getByText('R$ 50,00')).toHaveClass('tabular-nums', 'whitespace-nowrap');
    expect(within(linha).getByRole('button', { name: /Remover pagamento/ })).toHaveClass(
      'h-11',
      'w-11',
    );
  });

  it('título "Pagamento" em serifa e "Fechar comanda" roxo, cheio e largo', () => {
    renderPanel(
      makeComanda({
        items,
        canClose: true,
        closeError: null,
        paid: '135.00',
        remaining: '0.00',
        payments: [{ id: 'p1', method: 'pix', amount: '135.00', paidAt: '', memberId: null }],
      }),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Pagamento' })).toHaveClass(
      'font-serif',
      'text-headline-sm',
    );
    const btn = screen.getByTestId('comanda-close');
    expect(btn).toHaveClass('bg-primary', 'text-white', 'disabled:opacity-100', 'w-full');
    expect(btn).toHaveClass('min-h-[44px]');
    expect(screen.getByTestId('payment-add')).toHaveClass('min-h-[44px]', 'border');
  });

  it('rótulos de Forma e Valor em overline', () => {
    renderPanel(makeComanda({ items }));
    expect(screen.getByText('Forma')).toHaveClass('text-overline', 'uppercase');
    expect(screen.getByText('Valor')).toHaveClass('text-overline', 'uppercase');
  });
});

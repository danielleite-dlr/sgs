import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ComandaQuery, type ComandaData } from '../api/comandas.api';
import { ComandaPage } from '../pages/ComandaPage';
import { makeComanda } from './comanda-fixtures';

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

function renderPage(comanda: ComandaData | null) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ComandaQuery, variables: { id: 'cm1' } },
      result: { data: { comanda: comanda ? withTypenames(comanda) : null } },
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/comanda/cm1']}>
        <Routes>
          <Route path="/comanda/:id" element={<ComandaPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

const items = [
  {
    id: 'i1',
    kind: 'service',
    serviceId: 's1',
    productId: null,
    packageId: null,
    appointmentId: null,
    serviceVariantId: null,
    professionalId: 'm1',
    professional: { id: 'm1', displayName: 'Ana Pro' },
    name: 'Corte',
    quantity: 1,
    listUnitPrice: '80.00',
    unitPrice: '80.00',
    total: '80.00',
  },
  {
    id: 'i2',
    kind: 'product',
    serviceId: null,
    productId: 'p1',
    packageId: null,
    appointmentId: null,
    serviceVariantId: null,
    professionalId: 'm1',
    professional: { id: 'm1', displayName: 'Ana Pro' },
    name: 'Shampoo',
    quantity: 1,
    listUnitPrice: '55.00',
    unitPrice: '55.00',
    total: '55.00',
  },
];

describe('ComandaPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.write', 'comanda.close'] });
  });

  it('comanda aberta sem pagamento: Fechar desabilitado e Falta visível', async () => {
    renderPage(makeComanda({ items }));
    expect(await screen.findByTestId('comanda-status')).toHaveTextContent('Aberta');
    expect(screen.getByTestId('comanda-item-i1')).toHaveTextContent('Corte');
    expect(screen.getByTestId('comanda-close')).toBeDisabled();
    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('R$ 135,00');
    expect(screen.getByTestId('comanda-add-product')).toBeInTheDocument();
  });

  it('comanda fechada com itens sem regra mostra o aviso D-24', async () => {
    renderPage(
      makeComanda({
        status: 'closed',
        items,
        canClose: true,
        closeError: null,
        paid: '135.00',
        remaining: '0.00',
        hasCommissionWarnings: true,
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
            calculatedAmount: '0.00',
            noRule: true,
            reversed: false,
          },
        ],
      }),
    );
    expect(await screen.findByTestId('comanda-commissions')).toBeInTheDocument();
    expect(screen.getByTestId('comanda-commission-warning')).toHaveTextContent(
      'não têm regra de comissão',
    );
    expect(screen.getByText('Sem regra')).toBeInTheDocument();
    expect(screen.queryByTestId('comanda-add-product')).not.toBeInTheDocument();
  });

  it('sem comanda.reopen não vê Reabrir; com a permissão vê', async () => {
    const closed = makeComanda({ status: 'closed', items, canClose: true, closeError: null });
    const { unmount } = renderPage(closed);
    await screen.findByTestId('comanda-status');
    expect(screen.queryByTestId('comanda-reopen')).not.toBeInTheDocument();
    unmount();

    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.reopen'] });
    renderPage(closed);
    expect(await screen.findByTestId('comanda-reopen')).toBeInTheDocument();
  });

  it('comanda inexistente mostra mensagem e link de volta', async () => {
    renderPage(null);
    expect(await screen.findByText('Comanda não encontrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para comandas' })).toHaveAttribute(
      'href',
      '/comanda',
    );
  });
});

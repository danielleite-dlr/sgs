import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ComandaQuery, type ComandaData } from '../api/comandas.api';
import { ComandaPage } from '../pages/ComandaPage';
import { PaymentPanel } from '../components/comanda/PaymentPanel';
import { makeComanda } from './comanda-fixtures';

function renderPanel(comanda: ComandaData, busy = false) {
  render(
    <PaymentPanel
      comanda={comanda}
      canWrite
      canClose
      busy={busy}
      onAddPayment={vi.fn().mockResolvedValue(undefined)}
      onRemovePayment={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

const pronta = {
  canClose: true,
  closeError: null,
  paid: '135.00',
  remaining: '0.00',
  payments: [{ id: 'p1', method: 'pix', amount: '135.00', paidAt: '', memberId: null }],
} as const;

describe('UX-06 botão "Fechar comanda"', () => {
  it('com Falta R$ 0,00 fica habilitado e em cor cheia', () => {
    renderPanel(makeComanda({ ...pronta, payments: [...pronta.payments] }));
    const btn = screen.getByTestId('comanda-close');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveClass('bg-primary', 'text-white');
    expect(screen.queryByTestId('close-blocked-reason')).not.toBeInTheDocument();
  });

  it('enquanto salva continua em cor cheia (não parece desativado)', () => {
    renderPanel(makeComanda({ ...pronta, payments: [...pronta.payments] }), true);
    const btn = screen.getByTestId('comanda-close');
    expect(btn).toHaveClass('bg-primary', 'disabled:opacity-100');
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('com falta maior que zero fica desativado e explica o motivo', () => {
    renderPanel(makeComanda());
    expect(screen.getByTestId('comanda-close')).toBeDisabled();
    expect(screen.getByTestId('close-blocked-reason')).toHaveTextContent(
      'Falta R$ 135,00 para fechar',
    );
  });

  it('comanda sem itens explica que precisa de um item', () => {
    renderPanel(makeComanda({ total: '0.00', owed: '0.00', remaining: '0.00', items: [] }));
    expect(screen.getByTestId('comanda-close')).toBeDisabled();
    expect(screen.getByTestId('close-blocked-reason')).toHaveTextContent(
      'Adicione ao menos um item para fechar',
    );
  });
});

function withTypenames(c: ComandaData) {
  return {
    __typename: 'Comanda',
    ...c,
    client: { __typename: 'Client', ...c.client },
    items: [],
    payments: [],
    commissions: [],
  };
}

describe('UX-08 cartão "Cliente"', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.write', 'comanda.close'] });
  });

  it('começa pelo nome, formata o telefone e não repete o código', async () => {
    const comanda = makeComanda({
      client: { id: 'c1', fullName: 'Maria Souza', phone: '+5511988887777' },
    });
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
    const card = await screen.findByTestId('comanda-client-card');
    const linhas = Array.from(card.querySelectorAll('p, span')).map((e) => e.textContent?.trim());
    expect(linhas.filter(Boolean)[0]).toBe('Maria Souza');
    expect(card).toHaveTextContent('(11) 98888-7777');
    expect(card).not.toHaveTextContent('+5511988887777');
    expect(card).not.toHaveTextContent('C-2026-001');
  });
});

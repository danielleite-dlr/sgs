import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { AdjustClientCreditMutation, ClientCreditBalancesQuery } from '../api/financial.api';
import { CreditoClientePage } from '../pages/CreditoClientePage';

const balances = {
  clientCreditBalances: [
    { __typename: 'ClientCreditBalance', clientId: 'c1', clientName: 'Maria Souza', balance: '50.00' },
  ],
};

function renderPage(extra: MockedResponse[] = []) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ClientCreditBalancesQuery },
      result: { data: balances },
      maxUsageCount: 5,
    },
    ...extra,
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <CreditoClientePage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('CreditoClientePage', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['credit.read', 'credit.adjust'] });
  });

  it('lista cliente com saldo', async () => {
    renderPage();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByTestId('credit-row-c1')).toHaveTextContent('R$ 50,00');
  });

  it('sem credit.adjust não mostra Incluir Crédito', async () => {
    useAuthStore.setState({ permissions: ['credit.read'] });
    renderPage();
    await screen.findByText('Maria Souza');
    expect(screen.queryByRole('button', { name: 'Incluir Crédito' })).not.toBeInTheDocument();
  });

  it('motivo curto mantém Salvar desabilitado; Remover envia valor negativo', async () => {
    let sent: unknown = null;
    renderPage([
      {
        request: { query: ClientsListQuery },
        variableMatcher: () => true,
        result: {
          data: {
            clients: {
              __typename: 'ClientsPage',
              totalCount: 1,
              rows: [
                {
                  __typename: 'Client',
                  id: 'c1',
                  fullName: 'Maria Souza',
                  phone: null,
                  email: null,
                  cpf: null,
                  birthDate: null,
                  address: null,
                  notes: null,
                  createdAt: '2026-01-01T00:00:00Z',
                  updatedAt: '2026-01-01T00:00:00Z',
                },
              ],
            },
          },
        },
        maxUsageCount: 5,
      },
      {
        request: { query: AdjustClientCreditMutation },
        variableMatcher: (vars) => {
          sent = vars;
          return true;
        },
        result: {
          data: { adjustClientCredit: { __typename: 'ClientCreditPayload', balance: '40.00', errors: [] } },
        },
      },
    ]);
    await screen.findByText('Maria Souza');
    fireEvent.click(screen.getByRole('button', { name: 'Incluir Crédito' }));
    fireEvent.change(await screen.findByLabelText('Cliente'), { target: { value: 'Mar' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Maria Souza', hidden: false }));
    fireEvent.click(screen.getByLabelText('Remover'));
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'ab' } });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Estorno combinado' } });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(sent).toEqual({
        input: { clientId: 'c1', amount: '-10.00', reason: 'Estorno combinado' },
      }),
    );
  });
});

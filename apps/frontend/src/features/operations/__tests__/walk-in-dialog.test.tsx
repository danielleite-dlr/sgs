import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { OpenWalkInComandaMutation } from '../api/comandas.api';
import { WalkInDialog } from '../components/comanda/WalkInDialog';
import { makeComanda } from './comanda-fixtures';

function renderDialog(mocks: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <WalkInDialog open onOpenChange={() => undefined} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('WalkInDialog', () => {
  it('novo cliente com nome curto mantém Abrir comanda desabilitado', () => {
    renderDialog();
    fireEvent.click(screen.getByTestId('walkin-mode-new'));
    fireEvent.change(screen.getByTestId('walkin-name'), { target: { value: 'M' } });
    expect(screen.getByTestId('walkin-submit')).toBeDisabled();
  });

  it('novo cliente só com nome envia phone null', async () => {
    let sent: unknown = null;
    const c = makeComanda();
    renderDialog([
      {
        request: { query: OpenWalkInComandaMutation },
        variableMatcher: (v) => {
          sent = v;
          return true;
        },
        result: {
          data: {
            openWalkInComanda: {
              __typename: 'ComandaPayload',
              comanda: {
                __typename: 'Comanda',
                ...c,
                client: { __typename: 'Client', ...c.client },
                items: [],
                payments: [],
                commissions: [],
              },
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(screen.getByTestId('walkin-mode-new'));
    fireEvent.change(screen.getByTestId('walkin-name'), { target: { value: 'Maria' } });
    const btn = screen.getByTestId('walkin-submit');
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() =>
      expect(sent).toEqual({ input: { newClient: { fullName: 'Maria', phone: null } } }),
    );
  });

  it('cliente cadastrado exige seleção antes de habilitar', async () => {
    renderDialog([
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
                  phone: '(11) 98765-4321',
                  email: null,
                  cpf: null,
                  birthDate: null,
                  address: null,
                  notes: null,
                  createdAt: '',
                  updatedAt: '',
                },
              ],
            },
          },
        },
      },
    ]);
    expect(screen.getByTestId('walkin-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('walkin-client-search'), { target: { value: 'Mar' } });
    fireEvent.click(await screen.findByTestId('walkin-client-option-c1'));
    expect(screen.getByTestId('walkin-client-selected')).toHaveTextContent('Maria Souza');
    expect(screen.getByTestId('walkin-submit')).toBeEnabled();
  });
});

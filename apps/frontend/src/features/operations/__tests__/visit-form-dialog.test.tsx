import { afterEach, describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ClientsListQuery, CreateClientMutation } from '@/features/clients/api/clients.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { VisitFormDialog } from '../components/calendar/VisitFormDialog';

const emptyClients: MockedResponse = {
  request: { query: ClientsListQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: {
    data: { clients: { __typename: 'ClientsPage', totalCount: 0, rows: [] } },
  },
};

function renderDialog(mocks: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[emptyClients, ...mocks]}>
      <VisitFormDialog
        open
        onOpenChange={() => undefined}
        date={new Date(2026, 10, 4)}
        professionals={[]}
        onCreated={() => undefined}
      />
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('VisitFormDialog — cadastro rápido de cliente', () => {
  it('busca sem resultado mostra aviso e o botão de cadastrar', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderDialog();
    fireEvent.change(screen.getByTestId('visit-client-search'), { target: { value: 'Ana' } });
    expect(await screen.findByTestId('visit-client-empty')).toHaveTextContent(
      'Nenhum cliente encontrado.',
    );
    fireEvent.click(screen.getByTestId('visit-client-new'));
    expect(screen.getByTestId('visit-new-client-name')).toHaveValue('Ana');
  });

  it('exige telefone válido antes de cadastrar', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderDialog();
    fireEvent.click(screen.getByTestId('visit-client-new-empty'));
    fireEvent.change(screen.getByTestId('visit-new-client-name'), {
      target: { value: 'Ana Lima' },
    });
    fireEvent.change(screen.getByTestId('visit-new-client-phone'), { target: { value: '119' } });
    fireEvent.click(screen.getByTestId('visit-new-client-submit'));
    expect(await screen.findByTestId('visit-new-client-error')).toHaveTextContent(
      'Informe um telefone válido com DDD.',
    );
  });

  it('cadastra o cliente na mesma tela e já o deixa selecionado', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    let sent: unknown = null;
    renderDialog([
      {
        request: { query: CreateClientMutation },
        variableMatcher: (v) => {
          sent = v;
          return true;
        },
        result: {
          data: {
            createClient: {
              __typename: 'ClientPayload',
              client: {
                __typename: 'Client',
                id: 'c-new',
                fullName: 'Ana Lima',
                phone: '+5511987654321',
                email: null,
                cpf: null,
                birthDate: null,
                address: null,
                notes: null,
              },
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(screen.getByTestId('visit-client-new-empty'));
    fireEvent.change(screen.getByTestId('visit-new-client-name'), {
      target: { value: ' Ana Lima ' },
    });
    fireEvent.change(screen.getByTestId('visit-new-client-phone'), {
      target: { value: '11987654321' },
    });
    expect(screen.getByTestId('visit-new-client-phone')).toHaveValue('(11) 98765-4321');
    fireEvent.click(screen.getByTestId('visit-new-client-submit'));
    await waitFor(() =>
      expect(sent).toEqual({ input: { fullName: 'Ana Lima', phone: '+5511987654321' } }),
    );
    expect(await screen.findByTestId('visit-client-selected')).toHaveTextContent(
      'Cliente selecionado: Ana Lima · (11) 98765-4321',
    );
    expect(screen.queryByTestId('visit-new-client')).not.toBeInTheDocument();
  });

  it('profissional não vê a opção de cadastrar cliente', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL' });
    renderDialog();
    expect(screen.queryByTestId('visit-client-new-empty')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('visit-client-search'), { target: { value: 'Ana' } });
    await screen.findByTestId('visit-client-empty');
    expect(screen.queryByTestId('visit-client-new')).not.toBeInTheDocument();
  });
});

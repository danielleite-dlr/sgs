import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/infrastructure/i18n';
import { ClientesPage } from '../ClientesPage';
import { ClienteDetailPage } from '../ClienteDetailPage';
import { ClientByIdQuery, ClientsListQuery } from '@/features/clients/api/clients.api';

function client(id: string, fullName: string, extra: Record<string, unknown> = {}) {
  return {
    __typename: 'Client',
    id,
    fullName,
    phone: '11987654321',
    email: null,
    cpf: null,
    birthDate: null,
    address: null,
    rg: null,
    postalCode: null,
    phone2: null,
    phone3: null,
    notes: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...extra,
  };
}

function renderList(rows: ReturnType<typeof client>[]) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ClientsListQuery, variables: { search: null, limit: 20, offset: 0 } },
      result: {
        data: { clients: { __typename: 'ClientList', rows, totalCount: rows.length } },
      },
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/clientes']}>
        <ClientesPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('ClientesPage (UX-15, UX-16)', () => {
  it('o nome é um link para a ficha e a linha reage ao mouse', async () => {
    renderList([client('c1', 'Ana Souza')]);
    const table = await screen.findByTestId('clientes-table');
    const link = within(table).getByRole('link', { name: 'Ana Souza' });
    expect(link).toHaveAttribute('href', '/clientes/c1');
    expect(link.closest('tr')).toHaveClass('cursor-pointer', 'hover:bg-neutral-50');
  });

  it('esconde as colunas E-mail e CPF quando ninguém da página tem', async () => {
    renderList([client('c1', 'Ana Souza'), client('c2', 'Bia Lima')]);
    const table = await screen.findByTestId('clientes-table');
    expect(within(table).queryByRole('columnheader', { name: 'E-mail' })).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: 'CPF' })).toBeNull();
  });

  it('mostra E-mail e CPF quando pelo menos uma cliente tem', async () => {
    renderList([
      client('c1', 'Ana Souza', { email: 'ana@x.com', cpf: '52998224725' }),
      client('c2', 'Bia Lima'),
    ]);
    const table = await screen.findByTestId('clientes-table');
    expect(within(table).getByRole('columnheader', { name: 'E-mail' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'CPF' })).toBeInTheDocument();
    expect(within(table).getByText('529.982.247-25')).toBeInTheDocument();
  });

  it('no celular mostra cartões com nome, telefone e ações; tabela só a partir de md', async () => {
    renderList([client('c1', 'Ana Souza')]);
    const cards = await screen.findByTestId('clientes-cards');
    expect(cards).toHaveClass('md:hidden');
    expect(screen.getByTestId('clientes-table')).toHaveClass('hidden', 'md:block');
    const card = within(cards).getByTestId('cliente-card');
    expect(within(card).getByRole('link', { name: 'Ana Souza' })).toHaveAttribute(
      'href',
      '/clientes/c1',
    );
    expect(within(card).getByText('(11) 98765-4321')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Ações' })).toBeInTheDocument();
  });

  it('nomes com caixas diferentes aparecem iguais', async () => {
    renderList([client('c1', 'MARIA SILVA'), client('c2', 'maria silva')]);
    const table = await screen.findByTestId('clientes-table');
    expect(within(table).getAllByRole('link', { name: 'Maria Silva' })).toHaveLength(2);
    expect(within(table).queryByText('MARIA SILVA')).toBeNull();
    expect(within(table).queryByText('maria silva')).toBeNull();
  });
});

describe('ClienteDetailPage (UX-16)', () => {
  it('título da ficha com o nome em caixa normal', async () => {
    render(
      <MockedProvider
        mocks={[
          {
            request: { query: ClientByIdQuery, variables: { id: 'c1' } },
            result: { data: { client: client('c1', 'MARIA DA SILVA') } },
          },
        ]}
      >
        <MemoryRouter initialEntries={['/clientes/c1']}>
          <Routes>
            <Route path="/clientes/:id" element={<ClienteDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Maria da Silva' }),
    ).toBeInTheDocument();
  });
});

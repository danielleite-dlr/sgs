import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ComandasQuery, type ComandaData } from '../api/comandas.api';
import { ComandaListPage } from '../pages/ComandaListPage';
import { defaultPeriod } from '../lib/period-value';
import { makeComanda } from './comanda-fixtures';

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

function renderList(rows: ComandaData[]) {
  const p = defaultPeriod();
  const mocks: MockedResponse[] = [
    {
      request: { query: ComandasQuery, variables: { from: p.from, to: p.to, status: null } },
      result: { data: { comandas: rows.map(withTypenames) } },
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <ComandaListPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('ComandaListPage (UX-07)', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.write'] });
  });

  it('mostra o nome do cliente em caixa normal', async () => {
    renderList([
      makeComanda({ client: { id: 'c1', fullName: 'MARIA SILVA', phone: null } }),
    ]);
    const row = await screen.findByTestId('comanda-row-cm1');
    expect(row).toHaveTextContent('Maria Silva');
    expect(row).not.toHaveTextContent('MARIA SILVA');
  });

  it('código e "Aberta em" não quebram linha; tabela e cartão em largura total', async () => {
    renderList([makeComanda()]);
    const row = await screen.findByTestId('comanda-row-cm1');
    const cells = row.querySelectorAll('td');
    expect(cells[0]).toHaveClass('whitespace-nowrap');
    expect(cells[0]).toHaveTextContent('C-2026-001');
    expect(cells[2]).toHaveClass('whitespace-nowrap');
    const table = screen.getByTestId('comanda-list');
    expect(table).toHaveClass('w-full');
    table.querySelectorAll('th').forEach((th) => expect(th).toHaveClass('whitespace-nowrap'));
    const card = screen.getByTestId('comanda-list-card');
    expect(card).toHaveClass('w-full', 'max-w-none');
    expect(card).not.toHaveClass('max-w-[400px]');
  });
});

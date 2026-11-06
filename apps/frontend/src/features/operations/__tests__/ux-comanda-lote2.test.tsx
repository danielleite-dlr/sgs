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
    payments: [],
    commissions: [],
  };
}

const item = {
  id: 'i1',
  kind: 'service',
  serviceId: 's1',
  productId: null,
  packageId: null,
  appointmentId: null,
  serviceVariantId: null,
  professionalId: 'm1',
  professional: { id: 'm1', displayName: 'Ana Pro' },
  name: 'Maquiagem social com cílios',
  quantity: 1,
  listUnitPrice: '180.00',
  unitPrice: '180.00',
  total: '180.00',
  contractId: null,
  contractCode: null,
};

async function renderPage() {
  const comanda = makeComanda({ items: [item] as ComandaData['items'] });
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
  await screen.findByTestId('comanda-item-i1');
}

function vemAntes(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('UX-09 comanda no celular', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.write', 'comanda.close'] });
  });

  it('na ordem da tela: Cliente, Itens da comanda e depois Adicionar à comanda', async () => {
    await renderPage();
    const cliente = screen.getByTestId('comanda-cliente');
    const itens = screen.getByTestId('comanda-itens');
    const adicionar = screen.getByTestId('comanda-adicionar');
    expect(vemAntes(cliente, itens)).toBe(true);
    expect(vemAntes(itens, adicionar)).toBe(true);
  });

  it('no computador mantém Adicionar na primeira coluna, abaixo do Cliente', async () => {
    await renderPage();
    expect(screen.getByTestId('comanda-adicionar')).toHaveClass('lg:col-start-1');
    expect(screen.getByTestId('comanda-itens')).toHaveClass('lg:col-start-2');
  });

  it('o nome do item tem espaço: min-w-0, break-words e sem largura fixa estreita', async () => {
    await renderPage();
    const nome = screen.getByTestId('comanda-item-name-i1');
    expect(nome).toHaveTextContent('Maquiagem social com cílios');
    expect(nome).toHaveClass('min-w-0', 'break-words');
    expect(nome.parentElement).toHaveClass('min-w-0', 'flex-1');
    const classes = `${nome.className} ${nome.parentElement?.className ?? ''}`;
    expect(classes).not.toMatch(/\bw-(1\/3|1\/4|1\/5|2\/5|\[\d+(px|%)\])/);
    const valores = screen.getByTestId('comanda-item-valores-i1');
    expect(valores).toHaveClass('shrink-0', 'whitespace-nowrap');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ComandaQuery,
  LinkComandaItemToContractMutation,
  type ComandaData,
  type ComandaItemData,
} from '../api/comandas.api';
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

const trial: ComandaItemData = {
  id: 'i1',
  kind: 'service',
  serviceId: 's1',
  productId: null,
  packageId: null,
  appointmentId: 'a1',
  serviceVariantId: null,
  professionalId: 'm1',
  professional: { id: 'm1', displayName: 'Jessica Seixas' },
  name: 'Maquiagem noiva',
  quantity: 1,
  listUnitPrice: '0.00',
  unitPrice: '0.00',
  total: '0.00',
  contractId: null,
  contractCode: null,
  includedInEvent: false,
  linkableContractId: 'k1',
  linkableContractCode: 'CT-2026-008',
};

const linked: ComandaItemData = {
  ...trial,
  contractId: 'k1',
  contractCode: 'CT-2026-008',
  includedInEvent: true,
  linkableContractId: null,
  linkableContractCode: null,
};

function renderPage(before: ComandaData, after: ComandaData) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ComandaQuery, variables: { id: 'cm1' } },
      result: { data: { comanda: withTypenames(before) } },
    },
    {
      request: {
        query: LinkComandaItemToContractMutation,
        variables: { comandaId: before.id, itemId: 'i1' },
      },
      result: {
        data: {
          linkComandaItemToContract: {
            __typename: 'ComandaPayload',
            comanda: withTypenames(after),
            errors: [],
          },
        },
      },
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

describe('Comanda: vincular teste de noiva ao contrato (261117-i6j)', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['comanda.read', 'comanda.write', 'comanda.close'] });
  });

  it('mostra o botão com o código do contrato e, ao vincular, troca pelos selos', async () => {
    const before = makeComanda({ items: [trial] });
    renderPage(before, makeComanda({ id: before.id, items: [linked], covered: '0.00' }));

    const btn = await screen.findByTestId('item-link-contract-i1');
    expect(btn).toHaveTextContent('Vincular ao contrato CT-2026-008');
    expect(screen.queryByTestId('item-trial-included-i1')).not.toBeInTheDocument();

    await userEvent.click(btn);

    expect(await screen.findByTestId('item-trial-included-i1')).toHaveTextContent(
      'Teste incluso no pacote — pago no evento',
    );
    expect(screen.getByTestId('item-contract-i1')).toHaveTextContent('Contrato CT-2026-008');
    expect(screen.queryByTestId('item-link-contract-i1')).not.toBeInTheDocument();
  });

  it('sem comanda.write não mostra o botão', async () => {
    useAuthStore.setState({ permissions: ['comanda.read'] });
    const before = makeComanda({ items: [trial] });
    renderPage(before, before);
    await screen.findByTestId('comanda-item-i1');
    expect(screen.queryByTestId('item-link-contract-i1')).not.toBeInTheDocument();
  });
});

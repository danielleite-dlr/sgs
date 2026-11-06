import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ContractQuery, ContractReadinessQuery, type ContractData } from '../api/contracts.api';
import { ContractDetailPage } from '../pages/ContractDetailPage';
import { makeContract, makePackageContract, withTypenames } from './contract-fixtures';

const PAYMENT = {
  id: 'p1',
  kind: 'payment',
  method: 'pix',
  amount: '1018.18',
  paidAt: '2030-01-05T12:00:00.000Z',
  memberId: null,
  reversesPaymentId: null,
  reversed: false,
  note: null,
};

function renderPage(
  contract: ContractData,
  missing: Array<{
    code: string;
    label: string;
    target: string;
    targetId: string | null;
  }> = [],
) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ContractReadinessQuery, variables: { id: 'ct1' } },
      result: {
        data: {
          contractReadiness: {
            __typename: 'ContractReadiness',
            ready: missing.length === 0,
            missing: missing.map((m) => ({
              __typename: 'ContractMissingField',
              ...m,
            })),
          },
        },
      },
    },
    {
      request: { query: ContractQuery, variables: { id: 'ct1' } },
      result: { data: { contract: withTypenames(contract) } },
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/contratos/ct1']}>
        <Routes>
          <Route path="/contratos/:id" element={<ContractDetailPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

/** Tabela só a partir de md; cartões empilhados abaixo de md, com os mesmos valores. */
function expectTableAndCards(tableId: string, cardsId: string, values: string[]) {
  const table = screen.getByTestId(tableId);
  const cards = screen.getByTestId(cardsId);
  expect(table.closest('.hidden.md\\:block')).not.toBeNull();
  expect(cards).toHaveClass('md:hidden');
  for (const v of values) {
    expect(within(table).getAllByText(v).length).toBeGreaterThan(0);
    expect(within(cards).getAllByText(v).length).toBeGreaterThan(0);
  }
  for (const el of within(cards).getAllByText(/^-?R\$ /)) {
    expect(el).toHaveClass('whitespace-nowrap');
  }
}

describe('ContractDetailPage no celular (UX-12)', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('itens por pessoa em cartões no celular, tabela no computador', async () => {
    renderPage(makeContract({ payments: [PAYMENT] }));
    await screen.findByTestId('contract-items-table');
    expectTableAndCards('contract-items-table', 'contract-items-cards', [
      'Ana Souza',
      'Maquiagem noiva',
      'R$ 8.000,00',
    ]);
  });

  it('forma de pagamento (parcelas) em cartões no celular', async () => {
    renderPage(makePackageContract());
    await screen.findByTestId('contract-installments-table');
    expectTableAndCards('contract-installments-table', 'contract-installments-cards', [
      'SINAL 1/2',
      'Paga',
      'Vencida',
    ]);
  });

  it('pagamentos em cartões no celular, valor sem quebra de linha', async () => {
    renderPage(makeContract({ payments: [PAYMENT] }));
    await screen.findByTestId('contract-payments');
    expectTableAndCards('contract-payments', 'contract-payments-cards', ['R$ 1.018,18', 'Pix']);
  });

  it('Valores: entrada pendente em linha própria e valores sem quebra', async () => {
    renderPage(makeContract({ payments: [PAYMENT], depositPending: '1018.18' }));
    const values = await screen.findByTestId('contract-values');
    expect(within(values).getByText('pendente R$ 1.018,18')).toHaveClass('block', 'whitespace-nowrap');
    for (const el of within(values).getAllByText(/^-? ?R\$ /)) {
      expect(el.closest('.whitespace-nowrap')).not.toBeNull();
    }
  });

  it('o aviso de dados faltantes fica colado no botão que ele bloqueia', async () => {
    // O gate D-09 bloqueia só o "Gerar link de aceite" (não o pagamento).
    renderPage(makeContract(), [
      {
        code: 'CONTRACTOR_CPF',
        label: 'CPF da contratante',
        target: 'client',
        targetId: 'c1',
      },
    ]);
    const alert = await screen.findByTestId('contract-missing');
    const btn = screen.getByTestId('contract-generate-link');
    expect(alert.parentElement).toHaveAttribute('data-testid', 'contract-link-actions');
    expect(alert.nextElementSibling).toBe(btn);
  });
});

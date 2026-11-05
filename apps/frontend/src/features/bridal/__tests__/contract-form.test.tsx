import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ContractGroupQuery,
  ContractPackagesQuery,
  ContractServicesQuery,
  ContractSettingsQuery,
  CreateContractMutation,
  UpdateContractMutation,
  type ContractData,
} from '../api/contracts.api';
import { ContractFormDialog } from '../components/ContractFormDialog';
import {
  makeContract,
  makePackageContract,
  makeSettings,
  withTypenames,
} from './contract-fixtures';

type Vars = Record<string, unknown>;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const GROUP: MockedResponse = {
  request: { query: ContractGroupQuery, variables: { id: 'g1' } },
  result: {
    data: {
      bridalGroup: {
        __typename: 'BridalGroup',
        id: 'g1',
        name: 'Casamento Ana',
        eventDate: '2030-06-15',
        status: 'active',
        contractId: null,
        packageId: null,
        members: [
          {
            __typename: 'BridalGroupMember',
            id: 'm1',
            clientName: 'Ana Souza',
            role: 'bride',
            coveredByContract: true,
            services: [
              {
                __typename: 'BridalMemberService',
                id: 'ms1',
                serviceId: 's1',
                serviceName: 'Maquiagem noiva',
                purpose: 'event',
              },
            ],
          },
        ],
      },
    },
  },
};

const BASE_MOCKS: MockedResponse[] = [
  GROUP,
  {
    request: { query: ContractServicesQuery },
    result: {
      data: {
        services: [
          { __typename: 'Service', id: 's1', name: 'Maquiagem noiva', basePrice: '800.00' },
        ],
      },
    },
  },
  { request: { query: ContractPackagesQuery }, result: { data: { packages: [] } } },
  { request: { query: ContractSettingsQuery }, result: { data: { contractSettings: makeSettings() } } },
];

interface Captured {
  vars: Vars | null;
}

function createMock(captured: Captured, errors: unknown[] = []): MockedResponse {
  return {
    request: { query: CreateContractMutation },
    variableMatcher: (vars: Vars) => {
      captured.vars = vars;
      return true;
    },
    result: {
      data: {
        createContract: {
          __typename: 'ContractPayload',
          contract: null,
          errors,
        },
      },
    },
  };
}

function renderCreate(captured: Captured, errors: unknown[] = []) {
  return render(
    <MockedProvider mocks={[...BASE_MOCKS, createMock(captured, errors)]}>
      <MemoryRouter>
        <ContractFormDialog open onOpenChange={() => undefined} groupId="g1" />
      </MemoryRouter>
    </MockedProvider>,
  );
}

function renderEdit(contract: ContractData, captured: Captured) {
  const mock: MockedResponse = {
    request: { query: UpdateContractMutation },
    variableMatcher: (vars: Vars) => {
      captured.vars = vars;
      return true;
    },
    result: {
      data: {
        updateContract: {
          __typename: 'ContractPayload',
          contract: withTypenames(contract),
          errors: [],
        },
      },
    },
  };
  return render(
    <MockedProvider mocks={[...BASE_MOCKS, mock]}>
      <MemoryRouter>
        <ContractFormDialog open onOpenChange={() => undefined} contract={contract} />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const typeMoney = (label: string, digits: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: digits } });

describe('ContractFormDialog — forma de pagamento e parcelas', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('modo padrão Sinal envia 1 parcela com o valor do sinal e a data de hoje', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    expect(screen.getByLabelText('Sinal')).toBeChecked();
    typeMoney('Valor do sinal (R$)', '40000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.paymentMode).toBe('sinal');
    expect(input.installments).toEqual([{ dueDate: todayIso(), amount: '400.00' }]);
  });

  it('sinal parcelado: soma R$ 399,98 de R$ 400,00 bloqueia; R$ 399,99 libera', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    fireEvent.click(screen.getByLabelText('Sinal parcelado'));
    typeMoney('Valor do sinal (R$)', '40000');
    typeMoney('Valor da parcela 1', '30000');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar parcela/ }));
    fireEvent.change(screen.getByLabelText('Vencimento da parcela 2'), {
      target: { value: '2030-02-01' },
    });
    typeMoney('Valor da parcela 2', '9998');
    expect(
      screen.getByText('A soma das parcelas (R$ 399,98) deve ser igual ao sinal (R$ 400,00).'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeDisabled();

    typeMoney('Valor da parcela 2', '9999');
    expect(screen.queryByTestId('installments-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.paymentMode).toBe('sinal_parcelado');
    expect(input.installments).toEqual([
      { dueDate: todayIso(), amount: '300.00' },
      { dueDate: '2030-02-01', amount: '99.99' },
    ]);
  });

  it('parcela sem data pede a data e bloqueia salvar; remover não deixa zerar', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    fireEvent.click(screen.getByLabelText('Sinal parcelado'));
    typeMoney('Valor do sinal (R$)', '40000');
    expect(screen.getByRole('button', { name: 'Remover parcela 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar parcela/ }));
    expect(screen.getByText('Informe a data da parcela.')).toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover parcela 2' }));
    expect(screen.queryByText('Informe a data da parcela.')).not.toBeInTheDocument();
    expect(screen.getByTestId('contract-submit')).toBeEnabled();
  });

  it('à vista: valor = total, sem Restante, envia a_vista', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    fireEvent.click(screen.getByLabelText('À vista'));
    expect(screen.getByLabelText('Valor do sinal (R$)')).toHaveValue('800,00');
    expect(screen.getByLabelText('Valor do sinal (R$)')).toHaveAttribute('readonly');
    expect(within(screen.getByTestId('contract-summary')).queryByText(/Restante/)).toBeNull();
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as Vars;
    expect(input.paymentMode).toBe('a_vista');
    expect(input.installments).toEqual([{ dueDate: todayIso(), amount: '800.00' }]);
  });

  it('envia a descrição do desconto', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured);
    await screen.findByTestId('contract-items');
    typeMoney('Valor do sinal (R$)', '40000');
    fireEvent.change(screen.getByLabelText('Descrição do desconto'), {
      target: { value: '10% OFF' },
    });
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    expect(((captured.vars as Vars).input as Vars).discountDescription).toBe('10% OFF');
  });

  it('edição de contrato de pacote preserva packageItem e mostra a marca Pacote', async () => {
    const captured: Captured = { vars: null };
    renderEdit(makePackageContract(), captured);
    const items = await screen.findByTestId('contract-items');
    expect(within(items).getByText('Pacote')).toBeInTheDocument();
    expect(screen.getByLabelText('Sinal parcelado')).toBeChecked();
    expect(screen.getByLabelText('Descrição do desconto')).toHaveValue('10% OFF');
    fireEvent.click(screen.getByTestId('contract-submit'));
    await waitFor(() => expect(captured.vars).not.toBeNull());
    const input = (captured.vars as Vars).input as { items: Array<Vars>; installments: Vars[] };
    expect(input.items[0].packageItem).toBe(true);
    expect(input.installments).toHaveLength(2);
  });

  it('mostra o erro INSTALLMENTS_SUM_MISMATCH vindo do backend', async () => {
    const captured: Captured = { vars: null };
    renderCreate(captured, [
      {
        __typename: 'UserError',
        code: 'INSTALLMENTS_SUM_MISMATCH',
        message: 'A soma das parcelas deve ser igual ao valor do sinal.',
        field: 'installments',
      },
    ]);
    await screen.findByTestId('contract-items');
    typeMoney('Valor do sinal (R$)', '40000');
    fireEvent.click(screen.getByTestId('contract-submit'));
    expect(await screen.findByTestId('contract-form-error')).toHaveTextContent(
      'A soma das parcelas deve ser igual ao valor do sinal.',
    );
  });
});

// Garante que a fixture base continua válida para os demais testes.
describe('fixtures', () => {
  it('makeContract tem parcelas e itens com isPackageItem', () => {
    const c = makeContract();
    expect(c.installments.length).toBeGreaterThan(0);
    expect(c.items[0].isPackageItem).toBe(false);
  });
});

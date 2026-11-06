import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { UpdateClientMutation } from '@/features/clients/api/clients.api';
import {
  ContractQuery,
  ContractReadinessQuery,
  type ContractMissingField,
} from '../api/contracts.api';
import { CompleteContractorDialog } from '../components/CompleteContractorDialog';
import { makeContract, withTypenames } from './contract-fixtures';

const MISSING: ContractMissingField[] = [
  {
    code: 'CONTRACTOR_CPF',
    label: 'CPF da contratante',
    target: 'client',
    targetId: 'c1',
  },
  {
    code: 'CONTRACTOR_PHONE2',
    label: 'Celular 2 da contratante',
    target: 'client',
    targetId: 'c1',
  },
];

function renderDialog(extra: MockedResponse[] = [], onOpenChange = vi.fn()) {
  const mocks: MockedResponse[] = [
    {
      request: { query: ContractReadinessQuery, variables: { id: 'ct1' } },
      result: {
        data: {
          contractReadiness: {
            __typename: 'ContractReadiness',
            ready: true,
            missing: [],
          },
        },
      },
    },
    {
      request: { query: ContractQuery, variables: { id: 'ct1' } },
      result: { data: { contract: withTypenames(makeContract()) } },
    },
    ...extra,
  ];
  render(
    <MockedProvider mocks={mocks}>
      <CompleteContractorDialog
        open
        onOpenChange={onOpenChange}
        contractId="ct1"
        clientId="c1"
        missing={MISSING}
      />
    </MockedProvider>,
  );
  return { onOpenChange };
}

const updateOk = (spy: (v: unknown) => void): MockedResponse => ({
  request: { query: UpdateClientMutation },
  variableMatcher: (vars: Record<string, unknown>) => {
    spy(vars);
    return true;
  },
  result: {
    data: {
      updateClient: {
        __typename: 'ClientPayload',
        client: {
          __typename: 'Client',
          id: 'c1',
          fullName: 'Ana Noiva',
          phone: '11987654321',
          email: null,
          cpf: '52998224725',
          birthDate: null,
          address: null,
          rg: null,
          postalCode: null,
          phone2: '(11) 91111-2222',
          phone3: null,
          notes: null,
        },
        errors: [],
      },
    },
  },
});

describe('CompleteContractorDialog (UX-13)', () => {
  it('mostra só os campos que faltam', () => {
    renderDialog();
    expect(
      screen.getByRole('heading', { name: 'Completar dados da contratante' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('CPF')).toBeInTheDocument();
    expect(screen.getByLabelText('Celular 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Endereço')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Celular 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument();
  });

  it('CPF inválido mostra "CPF inválido" e não salva', async () => {
    const spy = vi.fn();
    renderDialog([updateOk(spy)]);
    fireEvent.change(screen.getByLabelText('CPF'), {
      target: { value: '111.111.111-11' },
    });
    fireEvent.change(screen.getByLabelText('Celular 2'), {
      target: { value: '11911112222' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }));
    expect(await screen.findByText(/CPF inválido/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('salva tudo de uma vez, atualiza o contrato e fecha', async () => {
    const spy = vi.fn();
    const { onOpenChange } = renderDialog([updateOk(spy)]);
    fireEvent.change(screen.getByLabelText('CPF'), {
      target: { value: '52998224725' },
    });
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25');
    fireEvent.change(screen.getByLabelText('Celular 2'), {
      target: { value: '11911112222' },
    });
    expect(screen.getByLabelText('Celular 2')).toHaveValue('(11) 91111-2222');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual({
      input: { id: 'c1', cpf: '52998224725', phone2: '(11) 91111-2222' },
    });
  });
});

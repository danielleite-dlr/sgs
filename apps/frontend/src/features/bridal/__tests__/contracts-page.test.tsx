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
  ContractsQuery,
  UpdateContractSettingsMutation,
} from '../api/contracts.api';
import { ContractsPage } from '../pages/ContractsPage';
import { makeContract, withTypenames } from './contract-fixtures';

const SETTINGS = {
  __typename: 'ContractSettings',
  balanceDueDaysBefore: 7,
  templateBody: 'Contrato de {{noiva}}',
  isDefaultTemplate: true,
  cancellationClause: 'Cláusula padrão de cancelamento do estúdio.',
  isDefaultClause: true,
  alertDepositUnpaidDays: 3,
  alertNotAcceptedDays: 5,
  alertCompanionDepositDays: 30,
  scheduleDayStart: '08:00',
  scheduleDayEnd: '20:00',
  templateVariables: ['noiva', 'total'],
  missingVariables: [],
};

const LATE = makeContract({
  id: 'ct-late',
  code: 'CT-2030-001',
  balanceOverdue: true,
  daysToBalanceDue: -3,
});
const PENDING = makeContract({
  id: 'ct-pend',
  code: 'CT-2030-002',
  brideName: 'Bia Lima',
  depositPending: '500.00',
  paid: '0.00',
});

function renderPage(mocks: MockedResponse[], url = '/contratos') {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[url]}>
        <ContractsPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const listMock = (vars: Record<string, unknown>, contracts: unknown[]): MockedResponse => ({
  request: { query: ContractsQuery, variables: vars },
  result: { data: { contracts } },
});

describe('ContractsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('lista mostra badges Vencido e Entrada pendente', async () => {
    renderPage([listMock({}, [withTypenames(LATE), withTypenames(PENDING)])]);
    const table = await screen.findByTestId('contracts-table');
    expect(within(table).getByText('Vencido')).toBeInTheDocument();
    expect(within(table).getByText('Entrada pendente')).toBeInTheDocument();
    expect(screen.getByText('Bia Lima')).toBeInTheDocument();
  });

  it('filtro Vencidos consulta com derived overdue', async () => {
    renderPage([
      listMock({}, [withTypenames(LATE), withTypenames(PENDING)]),
      listMock({ derived: 'overdue' }, [withTypenames(LATE)]),
    ]);
    await screen.findByText('Bia Lima');
    fireEvent.click(screen.getByTestId('contract-filter-overdue'));
    await waitFor(() => expect(screen.queryByText('Bia Lima')).not.toBeInTheDocument());
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });

  it('?grupo=<id> abre o formulário do contrato', async () => {
    const mocks: MockedResponse[] = [
      listMock({}, []),
      {
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
                {
                  __typename: 'BridalGroupMember',
                  id: 'm2',
                  clientName: 'Carla Mãe',
                  role: 'companion',
                  coveredByContract: false,
                  services: [],
                },
              ],
            },
          },
        },
      },
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
      { request: { query: ContractSettingsQuery }, result: { data: { contractSettings: SETTINGS } } },
    ];
    renderPage(mocks, '/contratos?grupo=g1');
    expect(await screen.findByTestId('contract-form')).toBeInTheDocument();
    const items = await screen.findByTestId('contract-items');
    expect(within(items).getByText('Maquiagem noiva')).toBeInTheDocument();
    expect(screen.getByTestId('contract-form-total')).toHaveTextContent('R$ 800,00');
    expect(screen.getByTestId('contract-uncovered')).toHaveTextContent('Carla Mãe');
  });

  it('aba Configurações fica oculta para MANAGER', async () => {
    renderPage([listMock({}, [])]);
    await screen.findByText('Nenhum contrato encontrado.');
    expect(screen.queryByRole('tab', { name: 'Configurações' })).not.toBeInTheDocument();
  });

  it('ADMIN salva modelo com {{foo}} e vê a mensagem de variável desconhecida', async () => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
    const mocks: MockedResponse[] = [
      listMock({}, []),
      { request: { query: ContractSettingsQuery }, result: { data: { contractSettings: SETTINGS } } },
      {
        request: {
          query: UpdateContractSettingsMutation,
          variables: {
            input: {
              balanceDueDaysBefore: 7,
              alertDepositUnpaidDays: 3,
              alertNotAcceptedDays: 5,
              alertCompanionDepositDays: 30,
              scheduleDayStart: '08:00',
              scheduleDayEnd: '20:00',
              templateBody: 'Contrato {{foo}}',
            },
          },
        },
        result: {
          data: {
            updateContractSettings: {
              __typename: 'ContractSettingsPayload',
              settings: null,
              errors: [
                {
                  __typename: 'UserError',
                  code: 'UNKNOWN_TEMPLATE_VARIABLE',
                  message: 'Variáveis desconhecidas no modelo: {{foo}}.',
                  field: 'templateBody',
                },
              ],
            },
          },
        },
      },
    ];
    renderPage(mocks);
    const tab = await screen.findByRole('tab', { name: 'Configurações' });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
    const textarea = await screen.findByLabelText('Texto do modelo');
    expect(screen.getByRole('button', { name: 'Restaurar modelo padrão' })).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'Contrato {{foo}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
    expect(await screen.findByTestId('settings-error')).toHaveTextContent(
      'Variáveis desconhecidas no modelo: {{foo}}.',
    );
  });
});

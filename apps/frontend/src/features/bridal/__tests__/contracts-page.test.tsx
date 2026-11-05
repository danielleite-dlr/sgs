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
} from '../api/contracts.api';
import { ContractsPage } from '../pages/ContractsPage';
import { makeContract, makeSettings, withTypenames } from './contract-fixtures';

const SETTINGS = makeSettings();

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

const groupMock = (packageId: string | null = null): MockedResponse => ({
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
        packageId,
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
      groupMock(),
      {
        request: { query: ContractServicesQuery },
        result: {
          data: {
            services: [
              {
                __typename: 'Service',
                id: 's1',
                name: 'Maquiagem noiva',
                basePrice: '800.00',
              },
            ],
          },
        },
      },
      {
        request: { query: ContractPackagesQuery },
        result: { data: { packages: [] } },
      },
      {
        request: { query: ContractSettingsQuery },
        result: { data: { contractSettings: SETTINGS } },
      },
    ];
    renderPage(mocks, '/contratos?grupo=g1');
    expect(await screen.findByTestId('contract-form')).toBeInTheDocument();
    const items = await screen.findByTestId('contract-items');
    expect(within(items).getByText('Maquiagem noiva')).toBeInTheDocument();
    expect(screen.getByTestId('contract-form-total')).toHaveTextContent('R$ 800,00');
    expect(screen.getByTestId('contract-uncovered')).toHaveTextContent('Carla Mãe');
  });

  it('?grupo=<id> já vem com o pacote do grupo (ou sem pacote se ele foi excluído)', async () => {
    const pkg = {
      __typename: 'Package',
      id: 'p1',
      name: 'Pacote Ouro',
      price: '2500.00',
      depositKind: null,
      depositValue: null,
    };
    const base = (packageId: string | null, packages: unknown[]): MockedResponse[] => [
      listMock({}, []),
      groupMock(packageId),
      {
        request: { query: ContractServicesQuery },
        result: {
          data: {
            services: [
              {
                __typename: 'Service',
                id: 's1',
                name: 'Maquiagem noiva',
                basePrice: '800.00',
              },
            ],
          },
        },
      },
      {
        request: { query: ContractPackagesQuery },
        result: { data: { packages } },
      },
      {
        request: { query: ContractSettingsQuery },
        result: { data: { contractSettings: SETTINGS } },
      },
    ];
    const { unmount } = renderPage(base('p1', [pkg]), '/contratos?grupo=g1');
    await screen.findByTestId('contract-items');
    expect(screen.getByLabelText('Pacote (opcional)')).toHaveValue('p1');
    expect(
      screen.getByText(/Os serviços da noiva entram pelo preço do pacote/),
    ).toBeInTheDocument();
    unmount();
    renderPage(base('p-excluido', [pkg]), '/contratos?grupo=g1');
    await screen.findByTestId('contract-items');
    expect(screen.getByLabelText('Pacote (opcional)')).toHaveValue('');
  });

  it('botão Novo contrato abre o formulário sem consultar o grupo', async () => {
    renderPage([
      listMock({}, []),
      {
        request: { query: ContractServicesQuery },
        result: { data: { services: [] } },
      },
      { request: { query: ContractPackagesQuery }, result: { data: { packages: [] } } },
      {
        request: { query: ContractSettingsQuery },
        result: { data: { contractSettings: SETTINGS } },
      },
    ]);
    fireEvent.click(await screen.findByTestId('new-contract'));
    expect(await screen.findByTestId('contract-form')).toBeInTheDocument();
    expect(await screen.findByTestId('new-contract-fields')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Novo contrato' })).toBeInTheDocument();
  });

  it('?novo=1 abre o formulário novo direto', async () => {
    renderPage(
      [
        listMock({}, []),
        { request: { query: ContractServicesQuery }, result: { data: { services: [] } } },
        { request: { query: ContractPackagesQuery }, result: { data: { packages: [] } } },
        {
          request: { query: ContractSettingsQuery },
          result: { data: { contractSettings: SETTINGS } },
        },
      ],
      '/contratos?novo=1',
    );
    expect(await screen.findByTestId('new-contract-fields')).toBeInTheDocument();
  });

  it('sem contract.write não aparece o botão Novo contrato', async () => {
    useAuthStore.setState({ roleName: 'PROFESSIONAL', permissions: ['contract.read'] });
    renderPage([listMock({}, [])]);
    await screen.findByText('Nenhum contrato encontrado.');
    expect(screen.queryByTestId('new-contract')).not.toBeInTheDocument();
  });

  it('aba Configurações fica oculta para MANAGER', async () => {
    renderPage([listMock({}, [])]);
    await screen.findByText('Nenhum contrato encontrado.');
    expect(screen.queryByRole('tab', { name: 'Configurações' })).not.toBeInTheDocument();
  });

  it('ADMIN abre Configurações e vê dados do studio, prazos e textos', async () => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
    renderPage([
      listMock({}, []),
      {
        request: { query: ContractSettingsQuery },
        result: { data: { contractSettings: SETTINGS } },
      },
    ]);
    const tab = await screen.findByRole('tab', { name: 'Configurações' });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
    expect(await screen.findByText('Dados do studio')).toBeInTheDocument();
    expect(screen.getByLabelText('Prazo para desistência (dias)')).toHaveValue(7);
    expect(screen.getByLabelText('Obs. dos testes')).toBeInTheDocument();
  });
});

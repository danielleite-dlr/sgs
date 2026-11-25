import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import '@/infrastructure/i18n/index';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { PacoteForm } from '../components/PacoteForm';
import { BridalAssistantRateCard } from '../components/BridalAssistantRateCard';
import { PacotesPage } from '@/pages/PacotesPage';
import { CommissionRulesQuery } from '../api/comissoes.api';
import { CategoriesQuery } from '../api/categorias.api';
import { ServicesQuery } from '../api/servicos.api';
import {
  PackagesQuery,
  CreatePackageMutation,
  BridalAssistantSettingsQuery,
  UpdateBridalAssistantSettingsMutation,
} from '../api/pacotes.api';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const SVC = '11111111-1111-4111-8111-111111111111';

const settingsMock = (dailyRate = '220.00') => ({
  request: { query: BridalAssistantSettingsQuery },
  result: { data: { bridalAssistantSettings: { dailyRate } } },
  maxUsageCount: 10,
});

function formMocks(spy: ReturnType<typeof vi.fn>) {
  return [
    {
      request: { query: ServicesQuery },
      result: {
        data: {
          services: [
            {
              id: SVC,
              name: 'Make noiva',
              categoryId: 'c1',
              category: { id: 'c1', name: 'Noivas', parentId: null },
              basePrice: '500.00',
              defaultDurationMinutes: 60,
              displayOrder: 0,
              coverImageUrl: null,
              pricingVariants: [],
            },
          ],
        },
      },
      maxUsageCount: 10,
    },
    {
      request: { query: CommissionRulesQuery },
      result: { data: { commissionRules: [] } },
      maxUsageCount: 10,
    },
    {
      request: { query: CategoriesQuery },
      result: { data: { categories: [] } },
      maxUsageCount: 10,
    },
    { request: { query: PackagesQuery }, result: { data: { packages: [] } }, maxUsageCount: 10 },
    settingsMock(),
    {
      request: { query: CreatePackageMutation },
      variableMatcher: (vars: Record<string, unknown>) => {
        spy(vars);
        return true;
      },
      result: { data: { createPackage: { package: null, errors: [] } } },
    },
  ];
}

function renderForm(spy = vi.fn()) {
  render(
    <MockedProvider mocks={formMocks(spy)} addTypename={false}>
      <PacoteForm
        onClose={() => {}}
        initial={{
          id: 'p1',
          name: 'ESSENCE',
          price: '1000.00',
          services: [{ serviceId: SVC, quantity: 1 }],
        }}
      />
    </MockedProvider>,
  );
  return spy;
}

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  useAuthStore.setState({ roleName: null } as never);
});

describe('Pacote com assistente da noiva (09.1)', () => {
  it('MANAGER marca a caixa: mostra a diária e soma ao custo/lucro sem mudar o preço', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' } as never);
    renderForm();
    expect(screen.queryByTestId('pkg-bridal-assistant-cost')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pkg-bridal-assistant'));

    const line = await screen.findByTestId('pkg-bridal-assistant-cost');
    await waitFor(() => expect(line).toHaveTextContent(/220,00/));
    const box = screen.getByTestId('package-cost-summary');
    // Serviço sem comissão (0) + diária 220 => custo 220, lucro 780
    await waitFor(() => expect(within(box).getByText(/780,00/)).toBeInTheDocument());
    expect(within(box).getAllByText(/220,00/).length).toBeGreaterThan(0);
  });

  it('ATTENDANT vê a caixa mas não a linha de custo', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' } as never);
    renderForm();
    fireEvent.click(screen.getByTestId('pkg-bridal-assistant'));
    expect((screen.getByTestId('pkg-bridal-assistant') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('pkg-bridal-assistant-cost')).not.toBeInTheDocument();
  });

  it('edição salva includesBridalAssistant na mutation', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' } as never);
    const spy = vi.fn();
    const mocks = formMocks(spy);
    // troca o mock de create pelo de update
    const { UpdatePackageMutation } = await import('../api/pacotes.api');
    mocks[mocks.length - 1] = {
      request: { query: UpdatePackageMutation },
      variableMatcher: (vars: Record<string, unknown>) => {
        spy(vars);
        return true;
      },
      result: { data: { updatePackage: { package: null, errors: [] } } },
    } as never;
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <PacoteForm
          onClose={() => {}}
          initial={{
            id: 'p1',
            name: 'ESSENCE',
            price: '1000.00',
            services: [{ serviceId: SVC, quantity: 1 }],
          }}
        />
      </MockedProvider>,
    );
    fireEvent.click(screen.getByTestId('pkg-bridal-assistant'));
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const input = (spy.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(input.includesBridalAssistant).toBe(true);
    expect(input.price).toBe('1000.00');
  });

  it('BridalAssistantRateCard: edita a diária e salva 250.00', async () => {
    const spy = vi.fn();
    const mocks = [
      settingsMock(),
      {
        request: { query: UpdateBridalAssistantSettingsMutation },
        variableMatcher: (vars: Record<string, unknown>) => {
          spy(vars);
          return true;
        },
        result: {
          data: {
            updateBridalAssistantSettings: { settings: { dailyRate: '250.00' }, errors: [] },
          },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <BridalAssistantRateCard />
      </MockedProvider>,
    );
    const input = screen.getByTestId('bridal-assistant-rate') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('220,00'));
    fireEvent.change(input, { target: { value: '25000' } });
    expect(input.value).toBe('250,00');
    fireEvent.click(screen.getByTestId('bridal-assistant-rate-save'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ dailyRate: '250.00' }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Diária atualizada.'));
  });

  it('BridalAssistantRateCard: INVALID_DAILY_RATE mostra toast de erro', async () => {
    const mocks = [
      settingsMock(),
      {
        request: { query: UpdateBridalAssistantSettingsMutation },
        variableMatcher: () => true,
        result: {
          data: {
            updateBridalAssistantSettings: {
              settings: null,
              errors: [{ code: 'INVALID_DAILY_RATE', message: 'Diária inválida.', field: 'dailyRate' }],
            },
          },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <BridalAssistantRateCard />
      </MockedProvider>,
    );
    const input = screen.getByTestId('bridal-assistant-rate') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('220,00'));
    fireEvent.change(input, { target: { value: '25000' } });
    fireEvent.click(screen.getByTestId('bridal-assistant-rate-save'));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Diária inválida.'));
  });
});

const pkgRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'ESSENCE',
  price: '1955.00',
  individualSum: '2000.00',
  validForDays: null,
  depositKind: null,
  depositValue: null,
  contractDescription: null,
  includesBridalAssistant: true,
  bridalAssistantDailyCost: null,
  coverImageUrl: null,
  services: [],
  costItems: null,
  totalCost: null,
  profit: null,
  profitPercent: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

function renderPage() {
  render(
    <MockedProvider
      mocks={[
        {
          request: { query: PackagesQuery },
          result: { data: { packages: [pkgRow(), pkgRow({ id: 'p2', name: 'BASIC', includesBridalAssistant: false })] } },
          maxUsageCount: 10,
        },
        settingsMock(),
      ]}
      addTypename={false}
    >
      <MemoryRouter>
        <PacotesPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PacotesPage com assistente (09.1)', () => {
  it('ATTENDANT não vê o card da diária; selo aparece só no pacote marcado', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' } as never);
    renderPage();
    await screen.findByText('ESSENCE');
    expect(screen.queryByTestId('bridal-assistant-rate')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pkg-badge-bridal-assistant')).toHaveLength(1);
  });

  it('MANAGER vê o card da diária', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' } as never);
    renderPage();
    expect(await screen.findByTestId('bridal-assistant-rate')).toBeInTheDocument();
  });
});

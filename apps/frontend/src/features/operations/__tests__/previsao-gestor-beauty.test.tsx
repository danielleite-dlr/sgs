import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CashForecastQuery } from '../api/forecast.api';
import { PrevisaoPage } from '../pages/PrevisaoPage';

// Previsão de caixa no layout Gestor Beauty (06-07), com a paleta de D-26 e o contraste de
// D-27: entrada em success-700, saída e negativo em outflow-700 (nunca error-*).

const item = (over: Record<string, unknown>) => ({
  __typename: 'ForecastItem',
  date: '2026-11-06',
  kind: 'appointment',
  direction: 'in',
  amount: '100.00',
  label: 'Item',
  refId: null,
  overdue: false,
  noRule: false,
  withoutProfessional: false,
  costGroup: null,
  ...over,
});

const bucket = (start: string, end: string) => ({
  __typename: 'ForecastBucket',
  start,
  end,
  inflow: '100.00',
  outflow: '300.00',
  balance: '-200.00',
  overdueInflow: '0.00',
  professionalOutflow: '0.00',
  operationalOutflow: '0.00',
  fixedOutflow: '300.00',
});

function forecast(balance: string) {
  return {
    __typename: 'CashForecast',
    from: '2026-11-05',
    to: '2026-11-12',
    timezone: 'America/Sao_Paulo',
    inflowTotal: '100.00',
    outflowTotal: '300.00',
    balance,
    overdueInflowTotal: '0.00',
    professionalOutflowTotal: '0.00',
    operationalOutflowTotal: '0.00',
    fixedOutflowTotal: '300.00',
    noRuleCount: 0,
    withoutProfessionalCount: 0,
    buckets: [bucket('2026-11-05', '2026-11-12')],
    items: [
      item({ kind: 'appointment', label: 'Corte da Ana' }),
      item({
        kind: 'fixed_expense',
        direction: 'out',
        costGroup: 'fixed',
        label: 'Aluguel',
        amount: '300.00',
      }),
    ],
  };
}

function renderPage(balance = '-200.00') {
  const mock = {
    request: { query: CashForecastQuery },
    variableMatcher: () => true,
    result: { data: { cashForecast: forecast(balance) } },
  };
  return render(
    <MockedProvider mocks={[mock, mock]}>
      <MemoryRouter>
        <PrevisaoPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const valorDe = (painel: HTMLElement, rotulo: string) =>
  within(painel).getByText(rotulo).nextElementSibling as HTMLElement;

describe('Previsão de caixa no layout Gestor Beauty', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });

  it('totais num painel branco único, divididos por linhas finas', async () => {
    renderPage();
    const painel = await screen.findByTestId('forecast-totals');
    const classes = ['rounded-lg', 'border', 'border-neutral-200', 'bg-white', 'divide-y'];
    for (const c of [...classes, 'divide-neutral-200', 'sm:divide-y-0', 'sm:divide-x']) {
      expect(painel).toHaveClass(c);
    }
    for (const rotulo of ['Entradas previstas', 'Saídas previstas', 'Saldo previsto']) {
      expect(within(painel).getByText(rotulo)).toHaveClass('text-overline', 'uppercase', 'text-neutral-500');
      expect(valorDe(painel, rotulo)).toHaveClass(
        'text-[22px]',
        'leading-8',
        'font-semibold',
        'tabular-nums',
        'whitespace-nowrap',
      );
    }
    expect(valorDe(painel, 'Entradas previstas')).toHaveClass('text-success-700');
    expect(valorDe(painel, 'Saídas previstas')).toHaveClass('text-outflow-700');
    // Saldo negativo em laranja de saída, não no vermelho de erro.
    expect(valorDe(painel, 'Saldo previsto')).toHaveClass('text-outflow-700');
    expect(painel.innerHTML).not.toMatch(/text-error-/);
    expect(painel.querySelectorAll('[style*="color"]')).toHaveLength(0);
  });

  it('saldo positivo fica na cor do texto', async () => {
    renderPage('200.00');
    const painel = await screen.findByTestId('forecast-totals');
    expect(valorDe(painel, 'Saldo previsto')).toHaveClass('text-neutral-800');
    expect(valorDe(painel, 'Saldo previsto')).not.toHaveClass('text-outflow-700');
  });

  it('nenhum valor da página usa style com cor', async () => {
    const { container } = renderPage();
    await screen.findByTestId('forecast-totals');
    expect(container.querySelectorAll('[style*="color"]')).toHaveLength(0);
  });

  it('períodos são um filtro segmentado de 44 px com o selecionado em roxo', async () => {
    renderPage();
    await screen.findByTestId('forecast-totals');
    for (const p of ['7', '15', '30', 'custom']) {
      expect(screen.getByTestId(`forecast-preset-${p}`)).toHaveClass('min-h-[44px]');
    }
    expect(screen.getByTestId('forecast-preset-30')).toHaveClass('bg-primary-800', 'text-white');
    expect(screen.getByTestId('forecast-preset-7')).not.toHaveClass('bg-primary-800');
  });

  it('a página não tem padding próprio (o AppShell já dá a margem)', () => {
    const { container } = renderPage();
    expect(container.firstElementChild).not.toHaveClass('p-md');
  });

  it('saídas por grupo de custo: rótulo pequeno e valor tabular laranja', async () => {
    renderPage();
    const grupos = await screen.findByTestId('forecast-cost-groups');
    const dt = within(grupos).getByText('Custo fixo');
    expect(dt.tagName).toBe('DT');
    expect(dt).toHaveClass('text-overline', 'uppercase', 'text-neutral-500');
    const dd = dt.nextElementSibling as HTMLElement;
    expect(dd).toHaveClass('text-[17px]', 'leading-6', 'font-semibold', 'tabular-nums', 'whitespace-nowrap',
      'text-outflow-700');
  });

  it('tabela semanal: origem como selo com ponto e valor tabular à direita', async () => {
    renderPage();
    await screen.findByTestId('forecast-totals');
    const linhaEntrada = screen.getByRole('row', { name: /Corte da Ana/ });
    const linhaSaida = screen.getByRole('row', { name: /Aluguel/ });
    const origemEntrada = within(linhaEntrada).getByText('Agendamento');
    const origemSaida = within(linhaSaida).getByText('Despesa fixa');
    expect(origemEntrada).toHaveClass('before:rounded-full', 'before:bg-success-500');
    expect(origemSaida).toHaveClass('before:rounded-full', 'before:bg-outflow-500');

    const valorEntrada = within(linhaEntrada).getByText(/R\$ 100,00/);
    const valorSaida = within(linhaSaida).getByText(/R\$ 300,00/);
    for (const v of [valorEntrada, valorSaida]) {
      expect(v).toHaveClass('text-right', 'tabular-nums', 'whitespace-nowrap');
    }
    expect(valorEntrada).toHaveClass('text-success-700');
    expect(valorSaida).toHaveClass('text-outflow-700');
    expect(within(linhaEntrada).getByText('06/11')).toHaveClass('tabular-nums');
  });
});

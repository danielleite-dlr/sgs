import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CashForecastQuery } from '../api/forecast.api';
import { PrevisaoPage } from '../pages/PrevisaoPage';

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
  ...over,
});

const bucket = (start: string, end: string) => ({
  __typename: 'ForecastBucket',
  start,
  end,
  inflow: '300.00',
  outflow: '100.00',
  balance: '200.00',
  overdueInflow: '0.00',
});

const data = {
  __typename: 'CashForecast',
  from: '2026-11-05',
  to: '2026-11-19',
  timezone: 'America/Sao_Paulo',
  inflowTotal: '300.00',
  outflowTotal: '100.00',
  balance: '200.00',
  overdueInflowTotal: '50.00',
  noRuleCount: 2,
  withoutProfessionalCount: 1,
  buckets: [bucket('2026-11-05', '2026-11-12'), bucket('2026-11-12', '2026-11-19')],
  items: [
    item({ kind: 'appointment', label: 'Corte da Ana' }),
    item({ kind: 'contract_installment', label: 'Parcela 2/3', overdue: true }),
    item({ kind: 'contract_balance', label: 'Restante noiva' }),
    item({
      kind: 'commission',
      direction: 'out',
      label: 'Comissão Bia',
      withoutProfessional: true,
      noRule: true,
    }),
    item({ kind: 'fixed_expense', direction: 'out', label: 'Aluguel', date: '2026-11-07' }),
  ],
};

function renderPage(seen: Array<{ from: string; to: string }> = []) {
  // Um mock por consulta esperada (30 dias + trocas de período); cada um registra as variáveis recebidas.
  const mock = () => ({
    request: { query: CashForecastQuery },
    variableMatcher: (v: { from: string; to: string }) => {
      seen.push(v);
      return true;
    },
    result: { data: { cashForecast: data } },
  });
  return render(
    <MockedProvider mocks={[mock(), mock(), mock(), mock()]}>
      <MemoryRouter>
        <PrevisaoPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PrevisaoPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });

  it('mostra origens, marcações, aviso e semana vazia', async () => {
    renderPage();
    expect(await screen.findByText('Semana 1 · 05/11 – 11/11')).toBeInTheDocument();
    for (const t of ['Agendamento', 'Parcela de contrato', 'Restante de contrato', 'Comissão', 'Despesa fixa']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('em atraso').length).toBeGreaterThan(0);
    expect(screen.getByText('estimada — sem profissional definido')).toBeInTheDocument();
    expect(screen.getByText('sem regra de comissão')).toBeInTheDocument();
    expect(screen.getByText(/2 comissão\(ões\) sem regra cadastrada/)).toBeInTheDocument();
    expect(screen.getByText('Nada previsto nesta semana.')).toBeInTheDocument();
  });

  describe('filtro de período', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-06T15:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('abre em 30 dias por padrão e troca para 7 e 15 dias', async () => {
      const seen: Array<{ from: string; to: string }> = [];
      renderPage(seen);
      expect(screen.getByTestId('forecast-preset-30')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('forecast-range')).toHaveTextContent('Período: 06/11/2026 a 05/12/2026');
      await waitFor(() => expect(seen).toContainEqual({ from: '2026-11-06', to: '2026-12-06' }));

      fireEvent.click(screen.getByTestId('forecast-preset-7'));
      expect(screen.getByTestId('forecast-preset-7')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('forecast-range')).toHaveTextContent('Período: 06/11/2026 a 12/11/2026');
      await waitFor(() => expect(seen).toContainEqual({ from: '2026-11-06', to: '2026-11-13' }));

      fireEvent.click(screen.getByTestId('forecast-preset-15'));
      await waitFor(() => expect(seen).toContainEqual({ from: '2026-11-06', to: '2026-11-21' }));
    });

    it('personalizado consulta o período digitado (fim inclusivo)', async () => {
      const seen: Array<{ from: string; to: string }> = [];
      renderPage(seen);
      fireEvent.click(screen.getByTestId('forecast-preset-custom'));
      expect(screen.getByTestId('forecast-custom-apply')).toBeDisabled();
      fireEvent.change(screen.getByTestId('forecast-custom-from'), { target: { value: '10/11/2026' } });
      fireEvent.change(screen.getByTestId('forecast-custom-to'), { target: { value: '20/12/2026' } });
      fireEvent.click(screen.getByTestId('forecast-custom-apply'));
      expect(screen.getByTestId('forecast-range')).toHaveTextContent('Período: 10/11/2026 a 20/12/2026');
      await waitFor(() => expect(seen).toContainEqual({ from: '2026-11-10', to: '2026-12-21' }));
    });
  });

  it('ATTENDANT vê mensagem de falta de permissão', () => {
    useAuthStore.setState({ roleName: 'ATTENDANT', permissions: [] });
    renderPage();
    expect(screen.getByText('Você não tem acesso ao financeiro.')).toBeInTheDocument();
  });
});

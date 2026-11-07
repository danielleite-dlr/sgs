import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { PageHeader } from '@/components/layout/PageHeader';
import DashboardPage from '@/pages/DashboardPage';
import { CashForecastQuery } from '../api/forecast.api';
import { ForecastCard } from '../components/ForecastCard';

// Início no layout Gestor Beauty (06-10, com D-26/D-27): Inter em tudo, cabeçalho
// "Painel do dia" + data por extenso, previsão de 30 dias em largura total.

vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 600, height: 180 }}>{children}</div>
    ),
  };
});

const forecast = (over: Record<string, unknown> = {}) => ({
  __typename: 'CashForecast',
  from: '2026-11-12',
  to: '2026-12-12',
  timezone: 'America/Sao_Paulo',
  inflowTotal: '1500.00',
  outflowTotal: '400.00',
  balance: '1100.00',
  overdueInflowTotal: '0.00',
  professionalOutflowTotal: '100.00',
  operationalOutflowTotal: '240.00',
  fixedOutflowTotal: '60.00',
  noRuleCount: 0,
  withoutProfessionalCount: 0,
  buckets: [
    {
      __typename: 'ForecastBucket',
      start: '2026-11-12',
      end: '2026-11-19',
      inflow: '1500.00',
      outflow: '400.00',
      balance: '1100.00',
      overdueInflow: '0.00',
      professionalOutflow: '100.00',
      operationalOutflow: '240.00',
      fixedOutflow: '60.00',
    },
  ],
  items: [
    {
      __typename: 'ForecastItem',
      date: '2026-11-13',
      kind: 'appointment',
      direction: 'in',
      amount: '1500.00',
      label: 'Corte',
      refId: 'a1',
      overdue: false,
      noRule: false,
      withoutProfessional: false,
      costGroup: null,
    },
  ],
  ...over,
});

const ok = (over: Record<string, unknown> = {}): MockedResponse => ({
  request: { query: CashForecastQuery },
  variableMatcher: () => true,
  result: { data: { cashForecast: forecast(over) } },
});

function renderWith(ui: React.ReactElement, mock: MockedResponse = ok()) {
  return render(
    <MockedProvider mocks={[mock]}>
      <MemoryRouter>{ui}</MemoryRouter>
    </MockedProvider>,
  );
}

const temClasse = (el: Element, ...cls: string[]) =>
  cls.forEach((c) => expect(el.className.split(/\s+/)).toContain(c));

describe('Início Gestor Beauty: PageHeader com rótulo e descrição', () => {
  it('rótulo antes do h1 (sem maiúsculas forçadas) e descrição tabular depois', () => {
    render(
      <MemoryRouter>
        <PageHeader
          eyebrow="Painel do dia"
          title="Início"
          description="Quinta-feira, 12 de novembro de 2026"
          variant="display"
        />
      </MemoryRouter>,
    );
    const eyebrow = screen.getByText('Painel do dia', { exact: true });
    const h1 = screen.getByRole('heading', { level: 1, name: 'Início' });
    const desc = screen.getByText('Quinta-feira, 12 de novembro de 2026', { exact: true });
    temClasse(eyebrow, 'text-overline', 'text-neutral-500');
    expect(eyebrow.className).not.toMatch(/\buppercase\b/);
    temClasse(desc, 'text-body', 'text-neutral-500', 'tabular-nums');
    expect(desc.tagName).toBe('P');
    // Ordem no DOM: rótulo, h1, descrição.
    expect(eyebrow.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(h1.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // D-26 + override do 06-10: Inter semibold, 28 px no celular e 36 px no computador.
    temClasse(h1, 'font-sans', 'font-semibold', 'text-display', 'lg:text-display-lg');
    expect(h1.className).not.toMatch(/\bfont-serif\b/);
  });

  it('sem as props novas, o cabeçalho continua igual (h1 serifado, sem <p> extra)', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Clientes" />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('header p')).toHaveLength(0);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Clientes' });
    temClasse(h1, 'font-serif', 'text-headline-lg', 'text-neutral-800');
  });
});

describe('Início Gestor Beauty: DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('mostra rótulo, h1 e data por extenso, sem padding duplicado nem grade de 2 colunas', async () => {
    const { container } = renderWith(<DashboardPage />);
    expect(screen.getByText('Painel do dia', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(screen.getByText('Quinta-feira, 12 de novembro de 2026', { exact: true })).toBeInTheDocument();
    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz.className).not.toMatch(/\bp-md\b/);
    const card = await screen.findByTestId('forecast-card');
    expect(card.parentElement?.className ?? '').not.toMatch(/lg:grid-cols-2/);
  });

  it('não mostra blocos que o SGS não tem (D-02)', async () => {
    renderWith(<DashboardPage />);
    await screen.findAllByText('R$ 1.100,00');
    for (const t of [/\bmeta\b/i, /exportar/i, /sincronizado/i, /check-in/i, /\biniciar\b/i, /bancada/i]) {
      expect(screen.queryByText(t)).not.toBeInTheDocument();
    }
  });
});

describe('Início Gestor Beauty: ForecastCard', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });

  it('cartão em largura total, Inter, contêiner padrão D-26', async () => {
    renderWith(<ForecastCard />);
    const card = await screen.findByTestId('forecast-card');
    temClasse(card, 'max-w-none', 'rounded-lg', 'border-neutral-200', 'bg-white');
    expect(card.className).not.toMatch(/max-w-\[400px\]/);
    const titulo = screen.getByRole('heading', { name: 'Previsão de caixa' });
    temClasse(titulo, 'font-sans');
    expect(titulo.className).not.toMatch(/\bfont-serif\b/);
  });

  it('saldo é o número de destaque em Inter semibold 28/36 px, tabular', async () => {
    renderWith(<ForecastCard />);
    const saldo = await screen.findByTestId('forecast-balance');
    expect(saldo).toHaveTextContent('R$ 1.100,00');
    temClasse(saldo, 'font-semibold', 'text-display', 'lg:text-display-lg', 'tabular-nums', 'whitespace-nowrap', 'text-neutral-900');
    expect(saldo.className).not.toMatch(/\bfont-serif\b/);
    expect(saldo.getAttribute('style') ?? '').not.toMatch(/color/);
  });

  it('saldo negativo em laranja de saída (número grande)', async () => {
    renderWith(<ForecastCard />, ok({ balance: '-200.00' }));
    const saldo = await screen.findByTestId('forecast-balance');
    expect(saldo).toHaveTextContent('−R$ 200,00');
    temClasse(saldo, 'text-outflow');
    expect(saldo.className).not.toMatch(/text-neutral-900/);
  });

  it('entradas e saídas em números tabulares sem quebra, cores por token e sem style', async () => {
    renderWith(<ForecastCard />);
    const entradas = await screen.findByTestId('forecast-inflow');
    const saidas = screen.getByTestId('forecast-outflow');
    expect(entradas).toHaveTextContent('R$ 1.500,00');
    expect(saidas).toHaveTextContent('R$ 400,00');
    temClasse(entradas, 'tabular-nums', 'whitespace-nowrap', 'font-bold', 'text-success');
    temClasse(saidas, 'tabular-nums', 'whitespace-nowrap', 'font-bold', 'text-outflow');
    for (const el of [entradas, saidas]) {
      expect(el.getAttribute('style') ?? '').not.toMatch(/color/);
    }
  });

  it('valores pequenos dos grupos de custo usam o tom 700 (D-27)', async () => {
    renderWith(<ForecastCard />);
    const grupos = await screen.findByTestId('forecast-cost-groups');
    grupos.querySelectorAll('dd').forEach((dd) => {
      temClasse(dd, 'tabular-nums', 'text-outflow-700');
      expect(dd.getAttribute('style') ?? '').not.toMatch(/color/);
    });
  });

  it('link "Ver detalhe" com alvo de 44 px', async () => {
    renderWith(<ForecastCard />);
    const link = await screen.findByRole('link', { name: 'Ver detalhe' });
    temClasse(link, 'min-h-[44px]', 'inline-flex', 'items-center');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { FixedExpensesQuery } from '../api/forecast.api';
import { DespesasFixasPage } from '../pages/DespesasFixasPage';

// Despesas fixas no layout Gestor Beauty (06-08), com a paleta de D-26 e o contraste de D-27:
// o total mensal é saída (outflow-700, nunca error-*); error-* fica só no erro de formulário e
// na ação destrutiva "Excluir".

const expense = (over: Record<string, unknown> = {}) => ({
  __typename: 'FixedExpense',
  id: 'f1',
  name: 'Aluguel',
  amount: '1500.00',
  dueDay: 10,
  active: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const LISTA = [
  expense(),
  expense({ id: 'f2', name: 'Internet', amount: '120.00', dueDay: 5 }),
  expense({ id: 'f3', name: 'Luz', amount: '80.10', dueDay: 20, active: false }),
];

function renderPage(list: unknown[]) {
  const mocks: MockedResponse[] = [
    {
      request: { query: FixedExpensesQuery },
      result: { data: { fixedExpenses: list } },
      maxUsageCount: 5,
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <DespesasFixasPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('Despesas fixas no layout Gestor Beauty', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });

  it('mostra o total mensal só das despesas ativas, como saída em outflow-700', async () => {
    renderPage(LISTA);
    const total = await screen.findByTestId('fixed-expenses-total');
    expect(total).toHaveTextContent('R$ 1.620,00');
    expect(total).toHaveClass('tabular-nums', 'whitespace-nowrap', 'text-outflow-700');
    expect(total.className).not.toMatch(/text-error-/);
    const rotulo = screen.getByText('Total mensal (ativas)');
    expect(rotulo).toHaveClass('uppercase', 'text-overline', 'text-neutral-500');
    const bloco = total.parentElement as HTMLElement;
    expect(bloco).toHaveClass('rounded-lg', 'shadow-sm', 'bg-white');
  });

  it('não mostra o total com a lista vazia', async () => {
    renderPage([]);
    await screen.findByText('Nenhuma despesa fixa cadastrada.');
    expect(screen.queryByTestId('fixed-expenses-total')).not.toBeInTheDocument();
  });

  it('tabela com cabeçalho do componente Table, valor tabular à direita e dia tabular', async () => {
    renderPage(LISTA);
    const tabela = await screen.findByTestId('fixed-expenses-table');
    const ths = within(tabela).getAllByRole('columnheader');
    expect(ths.map((th) => th.textContent)).toEqual([
      'Nome',
      'Valor',
      'Vence todo dia',
      'Situação',
      'Ações',
    ]);
    for (const th of ths) expect(th).toHaveClass('uppercase', 'text-neutral-500', 'bg-neutral-50');
    expect(ths[1]).toHaveClass('text-right');
    expect(tabela).toHaveClass('min-w-[640px]');

    const valor = within(tabela).getByText('R$ 1.500,00');
    expect(valor).toHaveClass('text-right', 'tabular-nums', 'whitespace-nowrap');
    const dia = within(tabela).getByText('dia 10');
    expect(dia).toHaveClass('tabular-nums', 'text-neutral-500');
    expect(within(tabela).getByText('Aluguel')).toHaveClass('font-medium', 'text-neutral-800');

    const caixa = tabela.closest('[data-testid="fixed-expenses-box"]') as HTMLElement;
    expect(caixa).toHaveClass('overflow-x-auto', 'rounded-lg', 'shadow-sm', 'bg-white');
  });

  it('situação como selo com ponto: Ativa verde e Inativa grafite', async () => {
    renderPage(LISTA);
    const tabela = await screen.findByTestId('fixed-expenses-table');
    const ativas = within(tabela).getAllByText('Ativa');
    expect(ativas).toHaveLength(2);
    expect(ativas[0]).toHaveClass('before:bg-success-500');
    const inativa = within(tabela).getByText('Inativa');
    expect(inativa).toHaveClass('before:bg-status-done');
  });

  it('botões da linha com 44 px e nomes acessíveis mantidos; Excluir em vermelho', async () => {
    renderPage(LISTA);
    await screen.findByTestId('fixed-expenses-table');
    for (const nome of ['Editar Aluguel', 'Desativar Aluguel', 'Ativar Luz', 'Excluir Aluguel']) {
      const b = screen.getByRole('button', { name: nome });
      expect(b).toHaveClass('min-h-[44px]');
      expect(b.className).not.toMatch(/\bh-9\b/);
    }
    expect(screen.getByRole('button', { name: 'Excluir Aluguel' })).toHaveClass('text-error-600');
    expect(screen.getByRole('button', { name: 'Editar Aluguel' }).className).not.toMatch(
      /text-error-/,
    );
  });

  it('texto de apoio sem margem negativa e em text-body neutral-500', async () => {
    renderPage(LISTA);
    const apoio = await screen.findByText(/Contas que se repetem todo mês/);
    expect(apoio).toHaveClass('text-body', 'text-neutral-500');
    expect(apoio.className).not.toMatch(/-mt-sm|mb-lg/);
  });

  it('diálogo com rótulos em maiúsculas pequenas, valor tabular e erros de 12 px', async () => {
    renderPage([]);
    await screen.findByText('Nenhuma despesa fixa cadastrada.');
    fireEvent.click(screen.getByRole('button', { name: 'Nova despesa fixa' }));
    const nome = await screen.findByLabelText('Nome');
    for (const id of ['fx-name', 'fx-amount', 'fx-day']) {
      const label = document.querySelector(`label[for="${id}"]`) as HTMLElement;
      expect(label).toHaveClass('text-overline', 'uppercase', 'text-neutral-500');
    }
    expect(screen.getByText('Situação')).toHaveClass('text-overline', 'uppercase');
    expect(screen.getByLabelText('Valor')).toHaveClass('tabular-nums');
    fireEvent.change(nome, { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const erros = await screen.findAllByRole('alert');
    expect(erros.length).toBeGreaterThan(0);
    for (const e of erros) expect(e).toHaveClass('text-[12px]', 'text-error-600');
  });
});

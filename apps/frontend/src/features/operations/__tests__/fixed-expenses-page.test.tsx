import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CreateFixedExpenseMutation, FixedExpensesQuery } from '../api/forecast.api';
import { DespesasFixasPage } from '../pages/DespesasFixasPage';

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

function renderPage(list: unknown[], extra: MockedResponse[] = []) {
  const mocks: MockedResponse[] = [
    {
      request: { query: FixedExpensesQuery },
      result: { data: { fixedExpenses: list } },
      maxUsageCount: 5,
    },
    ...extra,
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <DespesasFixasPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('DespesasFixasPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'ADMIN', permissions: [] });
  });

  it('lista despesas com valor e dia', async () => {
    renderPage([expense(), expense({ id: 'f2', name: 'Internet', amount: '99.90', dueDay: 5 })]);
    expect(await screen.findByText('Aluguel')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('dia 10')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();
  });

  it('lista vazia mostra mensagem', async () => {
    renderPage([]);
    expect(await screen.findByText('Nenhuma despesa fixa cadastrada.')).toBeInTheDocument();
  });

  it('cria despesa fixa com valor mascarado e enviado em decimal', async () => {
    let called = false;
    const input = { name: 'Internet', amount: '99.90', dueDay: 5, active: true };
    renderPage([], [
      {
        request: { query: CreateFixedExpenseMutation, variables: { input } },
        result: () => {
          called = true;
          return {
            data: {
              createFixedExpense: {
                __typename: 'FixedExpensePayload',
                fixedExpense: expense({ id: 'f9', name: 'Internet', amount: '99.90', dueDay: 5 }),
                errors: [],
              },
            },
          };
        },
      },
    ]);
    await screen.findByText('Nenhuma despesa fixa cadastrada.');
    fireEvent.click(screen.getByRole('button', { name: 'Nova despesa fixa' }));
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Internet' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '9990' } });
    expect(screen.getByLabelText('Valor')).toHaveValue('R$ 99,90');
    fireEvent.change(screen.getByLabelText('Dia do vencimento'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(called).toBe(true));
  });

  it('dia 32 mostra erro e não chama a mutation', async () => {
    let called = false;
    renderPage([], [
      {
        request: { query: CreateFixedExpenseMutation },
        variableMatcher: () => true,
        result: () => {
          called = true;
          return { data: { createFixedExpense: { fixedExpense: null, errors: [] } } };
        },
      },
    ]);
    await screen.findByText('Nenhuma despesa fixa cadastrada.');
    fireEvent.click(screen.getByRole('button', { name: 'Nova despesa fixa' }));
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Internet' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '9990' } });
    fireEvent.change(screen.getByLabelText('Dia do vencimento'), { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText('O dia do vencimento deve ser entre 1 e 31.'),
    ).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('excluir pede confirmação', async () => {
    renderPage([expense()]);
    await screen.findByText('Aluguel');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Aluguel' }));
    expect(await screen.findByText('Excluir despesa fixa?')).toBeInTheDocument();
  });

  it('ATTENDANT não vê botões de gravação', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT', permissions: ['financial.read'] });
    renderPage([expense()]);
    await screen.findByText('Aluguel');
    expect(screen.queryByRole('button', { name: 'Nova despesa fixa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Aluguel' })).not.toBeInTheDocument();
  });
});

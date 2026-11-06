import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { MembersQuery } from '@/features/catalog/api/members.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { AppointmentsQuery } from '../api/appointments.api';
import { VisitFormDialog } from '../components/calendar/VisitFormDialog';
import { InlineCalendar, SchedulePage } from '../pages/SchedulePage';

describe('UX-04: diálogo de agendamento', () => {
  it('tem um único botão de fechar', () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    const mocks: MockedResponse[] = [
      {
        request: { query: ClientsListQuery },
        variableMatcher: () => true,
        maxUsageCount: 20,
        result: { data: { clients: { __typename: 'ClientsPage', totalCount: 0, rows: [] } } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <VisitFormDialog
          open
          onOpenChange={() => undefined}
          date={new Date(2026, 10, 6)}
          professionals={[]}
          onCreated={() => undefined}
        />
      </MockedProvider>,
    );
    expect(screen.getByText('Cadastrar agendamento')).toBeInTheDocument();
    // Conta também o "Close" em inglês do Radix: só pode existir um X, e em português.
    const botoes = screen.getAllByRole('button', { name: /fechar|close/i });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).toHaveAccessibleName('Fechar');
  });
});

describe('UX-05: calendário lateral e selo', () => {
  it('escreve "Novembro de 2026" com "de" minúsculo', () => {
    render(<InlineCalendar selected={new Date(2026, 10, 6)} onSelect={() => undefined} />);
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Novembro De/)).toBeNull();
  });

  it('a Agenda não mostra o selo "Pgto Indica"', async () => {
    useAuthStore.setState({ roleName: 'ADMIN', memberId: 'x' });
    const mocks: MockedResponse[] = [
      { request: { query: MembersQuery }, result: { data: { members: [] } }, maxUsageCount: 10 },
      {
        request: { query: AppointmentsQuery },
        variableMatcher: () => true,
        result: { data: { appointments: [] } },
        maxUsageCount: 10,
      },
    ];
    const { container } = render(
      <MockedProvider mocks={mocks}>
        <MemoryRouter>
          <SchedulePage />
        </MemoryRouter>
      </MockedProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('view-day')).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/Pgto/);
    expect(container.textContent).not.toMatch(/Indica/);
  });
});

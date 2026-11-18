import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  CommercialLeadNameQuery,
  CommercialReminderCountsQuery,
  CommercialReminderQuery,
  CommercialRemindersQuery,
  CompleteCommercialReminderMutation,
} from '../api/reminders.api';
import { RemindersPage } from '../pages/RemindersPage';
import { setRole } from './commercial-fixtures';

function reminder(over: Record<string, unknown>) {
  return {
    __typename: 'CommercialReminder',
    id: 'r1',
    title: 'Ligar para Ana',
    description: null,
    dueAt: '2026-11-17T12:00:00.000Z',
    completedAt: null,
    notifiedAt: null,
    overdue: true,
    lead: {
      __typename: 'CommercialLeadRef',
      id: 'lead-ana',
      fullName: 'Ana Souza',
      phone: null,
      email: null,
    },
    dealId: 'd1',
    dealKind: 'noiva',
    dealEventDate: '2027-05-10',
    dealStageName: 'Proposta',
    createdBy: null,
    ...over,
  };
}

function page(status: string, items: unknown[]): MockedResponse {
  return {
    request: { query: CommercialRemindersQuery },
    variableMatcher: (v) => (v as { filter: { status: string } }).filter.status === status,
    maxUsageCount: 10,
    result: { data: { commercialReminders: { __typename: 'CommercialReminderPage', total: items.length, items } } },
  };
}

const COUNTS: MockedResponse = {
  request: { query: CommercialReminderCountsQuery },
  maxUsageCount: 10,
  result: {
    data: {
      commercialReminderCounts: { __typename: 'CommercialReminderCounts', overdue: 1, today: 0 },
    },
  },
};

function renderPage(url: string, mocks: MockedResponse[]) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <MockedProvider mocks={[COUNTS, ...mocks]}>
        <Routes>
          <Route path="/comercial/lembretes" element={<RemindersPage />} />
        </Routes>
      </MockedProvider>
    </MemoryRouter>,
  );
}

afterEach(() => setRole(null));

describe('RemindersPage', () => {
  it('abre em Vencidos quando não há lembretes de hoje e mostra lead, etapa e selo', async () => {
    setRole('ATTENDANT');
    renderPage('/comercial/lembretes', [page('overdue', [reminder({})])]);
    const item = await screen.findByTestId('reminder-r1');
    expect(item.textContent).toContain('Ligar para Ana');
    expect(item.textContent).toContain('Vencido');
    expect(item.textContent).toContain('Proposta');
    expect(item.textContent).toContain('Noiva');
    expect(screen.getByRole('link', { name: 'Ana Souza' }).getAttribute('href')).toBe(
      '/comercial/leads/lead-ana',
    );
    expect(screen.getByRole('tab', { name: /Vencidos/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('conclui o lembrete chamando a mutation com completed=true', async () => {
    setRole('ATTENDANT');
    let called = false;
    renderPage('/comercial/lembretes', [
      page('overdue', [reminder({})]),
      {
        request: { query: CompleteCommercialReminderMutation },
        variableMatcher: (v) => {
          called = (v as { id: string; completed: boolean }).completed === true;
          return true;
        },
        result: {
          data: {
            completeCommercialReminder: {
              __typename: 'CommercialReminderPayload',
              reminder: reminder({ completedAt: '2026-11-18T10:00:00.000Z', overdue: false }),
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(await screen.findByLabelText('Concluir Ligar para Ana'));
    await waitFor(() => expect(called).toBe(true));
  });

  it('?lembrete=r1 destaca o lembrete vindo do push', async () => {
    setRole('ATTENDANT');
    renderPage('/comercial/lembretes?lembrete=r1', [
      {
        request: { query: CommercialReminderQuery },
        variableMatcher: () => true,
        maxUsageCount: 5,
        result: { data: { commercialReminder: reminder({}) } },
      },
      page('overdue', [reminder({})]),
    ]);
    const item = await screen.findByTestId('reminder-r1');
    expect(item.getAttribute('data-highlight')).toBe('true');
    expect(screen.getAllByTestId('reminder-r1')).toHaveLength(1);
  });

  it('?lembrete inexistente mostra o aviso', async () => {
    setRole('ATTENDANT');
    renderPage('/comercial/lembretes?lembrete=zzz', [
      {
        request: { query: CommercialReminderQuery },
        variableMatcher: () => true,
        maxUsageCount: 5,
        result: { data: { commercialReminder: null } },
      },
      page('today', []),
    ]);
    expect(await screen.findByText('Lembrete não encontrado ou sem acesso')).toBeTruthy();
  });

  it('?lead=l1 filtra pelo lead e mostra o nome', async () => {
    setRole('ATTENDANT');
    const seen: unknown[] = [];
    renderPage('/comercial/lembretes?lead=lead-ana', [
      {
        request: { query: CommercialLeadNameQuery },
        variableMatcher: () => true,
        result: {
          data: { commercialLead: { __typename: 'CommercialLead', id: 'lead-ana', fullName: 'Ana Souza' } },
        },
      },
      {
        request: { query: CommercialRemindersQuery },
        variableMatcher: (v) => {
          seen.push((v as { filter: { leadId: string } }).filter.leadId);
          return true;
        },
        maxUsageCount: 10,
        result: { data: { commercialReminders: { __typename: 'CommercialReminderPage', total: 0, items: [] } } },
      },
    ]);
    expect(await screen.findByText('Filtrando por Ana Souza')).toBeTruthy();
    await waitFor(() => expect(seen).toContain('lead-ana'));
    expect(screen.getByRole('button', { name: 'Limpar filtro' })).toBeTruthy();
  });
});

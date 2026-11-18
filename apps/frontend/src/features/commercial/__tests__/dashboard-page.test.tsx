import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { CommercialDashboardQuery } from '../api/reports.api';
import { CommercialDashboardPage } from '../pages/CommercialDashboardPage';
import { setRole } from './commercial-fixtures';

function dashboard(over: Record<string, unknown> = {}) {
  return {
    __typename: 'CommercialDashboard',
    periodDays: 30,
    newLeadsToday: 3,
    newDealsToday: 2,
    interactionsToday: 5,
    remindersOverdue: 4,
    remindersToday: 1,
    followUpsPending: 1,
    followUps: [
      {
        __typename: 'CommercialFollowUp',
        dealId: 'd1',
        leadId: 'lead-ana',
        leadName: 'Ana Souza',
        kind: 'noiva',
        stageName: 'Proposta',
        stageColor: '#3b82f6',
        overdueSince: '2026-11-10T12:00:00.000Z',
        assigneeName: 'Bia',
      },
    ],
    lastInteractions: [
      {
        __typename: 'CommercialRecentInteraction',
        id: 'i1',
        leadId: 'lead-ana',
        leadName: 'Ana Souza',
        type: 'call',
        notes: 'Pediu orçamento',
        occurredAt: '2026-11-17T12:00:00.000Z',
        createdByName: 'Bia',
      },
    ],
    stages: [
      {
        __typename: 'CommercialStageSummary',
        stageId: 's1',
        name: 'Proposta',
        color: '#3b82f6',
        kind: 'open',
        count: 2,
        amount: '1800.00',
      },
    ],
    openAmount: '1800.00',
    wonCount: 1,
    wonAmount: '900.00',
    lostCount: 1,
    conversionRate: 0.5,
    ...over,
  };
}

function renderPage(data: unknown) {
  const mocks: MockedResponse[] = [
    {
      request: { query: CommercialDashboardQuery },
      variableMatcher: () => true,
      maxUsageCount: 5,
      result: { data: { commercialDashboard: data } },
    },
  ];
  render(
    <MemoryRouter>
      <MockedProvider mocks={mocks}>
        <CommercialDashboardPage />
      </MockedProvider>
    </MemoryRouter>,
  );
}

afterEach(() => setRole(null));

describe('CommercialDashboardPage', () => {
  it('mostra números do dia, follow-up com link, funil, valor em negociação e conversão', async () => {
    setRole('ATTENDANT');
    renderPage(dashboard());
    expect(await screen.findByText('Follow-ups pendentes (1)')).toBeTruthy();
    const link = screen.getAllByRole('link', { name: 'Ana Souza' })[0]!;
    expect(link.getAttribute('href')).toBe('/comercial/leads/lead-ana');
    expect(screen.getByText(/atrasado desde 10\/11/)).toBeTruthy();
    expect(screen.getByText('Lembretes vencidos').nextSibling?.textContent).toBe('4');
    expect(screen.getByText('Novos leads hoje').nextSibling?.textContent).toBe('3');
    expect(screen.getByText('Em negociação').nextSibling?.textContent).toContain('R$ 1.800,00');
    expect(screen.getByText('Conversão (30 dias)').nextSibling?.textContent).toBe('50%');
    expect(screen.getByText('Pediu orçamento')).toBeTruthy();
    expect(screen.getByText('Proposta', { selector: 'td' })).toBeTruthy();
  });

  it('conversão nula aparece como travessão', async () => {
    setRole('MANAGER');
    renderPage(dashboard({ conversionRate: null }));
    const label = await screen.findByText('Conversão (30 dias)');
    expect(label.nextSibling?.textContent).toBe('—');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { CommercialLeadsQuery } from '../api/leads.api';
import { LeadsPage } from '../pages/LeadsPage';
import { setRole } from './commercial-fixtures';

const importOpen = vi.hoisted(() => vi.fn());
vi.mock('../components/LeadImportDialog', () => ({
  LeadImportDialog: (p: { open: boolean }) => {
    importOpen(p.open);
    return p.open ? <div>Importação aberta</div> : null;
  },
}));

const LEAD = {
  __typename: 'CommercialLead',
  id: 'lead-ana',
  fullName: 'Ana Souza',
  phone: '(11) 99999-0000',
  email: null,
  source: 'instagram',
  notes: null,
  client: null,
  createdBy: null,
  consentAt: null,
  createdAt: '2026-11-10T12:00:00.000Z',
  openDeals: 2,
  lastInteractionAt: '2026-11-17T15:00:00.000Z',
};

function setup() {
  const calls: Array<Record<string, unknown>> = [];
  const mock: MockedResponse = {
    request: { query: CommercialLeadsQuery },
    variableMatcher: (v) => {
      calls.push((v as { filter: Record<string, unknown> }).filter);
      return true;
    },
    maxUsageCount: 20,
    result: {
      data: {
        commercialLeads: { __typename: 'CommercialLeadPage', total: 1, items: [LEAD] },
      },
    },
  };
  render(
    <MemoryRouter>
      <MockedProvider mocks={[mock]}>
        <LeadsPage />
      </MockedProvider>
    </MemoryRouter>,
  );
  return calls;
}

afterEach(() => setRole(null));

describe('LeadsPage', () => {
  it('lista os leads e filtra pela busca', async () => {
    setRole('ATTENDANT');
    const calls = setup();
    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    // uma vez na opção do filtro e outra no cartão do lead
    expect(screen.getAllByText('Instagram').length).toBe(2);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'ana' } });
    await waitFor(() => expect(calls.some((c) => c.search === 'ana')).toBe(true), {
      timeout: 2000,
    });
  });

  it('gerente vê o filtro Sem responsável e envia unassigned', async () => {
    setRole('MANAGER');
    const calls = setup();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getByLabelText('Sem responsável'));
    await waitFor(() => expect(calls.some((c) => c.unassigned === true)).toBe(true));
  });

  it('atendente não vê o filtro Sem responsável', async () => {
    setRole('ATTENDANT');
    setup();
    await screen.findByText('Ana Souza');
    expect(screen.queryByLabelText('Sem responsável')).toBeNull();
  });

  it('Importar planilha abre o diálogo de importação', async () => {
    setRole('ATTENDANT');
    setup();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getByRole('button', { name: /Importar planilha/ }));
    expect(await screen.findByText('Importação aberta')).toBeTruthy();
  });
});

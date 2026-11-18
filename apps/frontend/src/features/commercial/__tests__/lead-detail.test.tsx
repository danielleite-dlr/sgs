import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContractPackagesQuery } from '@/features/bridal/api/contracts.api';
import { CreateCommercialInteractionMutation } from '../api/deals.api';
import {
  CommercialAssigneesQuery,
  CommercialLeadQuery,
  CommercialStagesQuery,
} from '../api/leads.api';
import { LeadDetailPage } from '../pages/LeadDetailPage';
import { setRole } from './commercial-fixtures';

const STAGE_NOVO = {
  __typename: 'CommercialStage',
  id: 'st-novo',
  name: 'Novo',
  color: '#3b82f6',
  position: 0,
  slaDays: 1,
  kind: 'open',
  isSystem: false,
  openDeals: 2,
};
const STAGE_CONTATO = { ...STAGE_NOVO, id: 'st-contato', name: 'Contato', position: 1 };

function deal(over: Record<string, unknown>) {
  return {
    __typename: 'CommercialDeal',
    id: 'd1',
    leadId: 'lead-ana',
    lead: { __typename: 'CommercialLeadRef', id: 'lead-ana', fullName: 'Ana Souza', phone: null, email: null },
    stage: STAGE_NOVO,
    status: 'open',
    kind: 'noiva',
    beneficiaryName: null,
    eventDate: '2027-05-10',
    package: { __typename: 'CommercialPackageRef', id: 'p1', name: 'Noiva Completo', price: '1000.00' },
    packageName: 'Noiva Completo',
    packagePrice: '1000.00',
    discountAmount: '100.00',
    finalAmount: '900.00',
    assignee: { __typename: 'CommercialMember', id: 'm-1', displayName: 'Bia', roleName: 'ATTENDANT' },
    source: 'instagram',
    location: 'Estúdio',
    notes: null,
    stageEnteredAt: '2026-11-10T12:00:00.000Z',
    lastInteractionAt: null,
    overdue: false,
    overdueSince: null,
    lostReasonCode: null,
    lostReasonText: null,
    closedAt: null,
    wonContractId: null,
    createdAt: '2026-11-10T12:00:00.000Z',
    ...over,
  };
}

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
  lastInteractionAt: null,
  deals: [
    deal({ id: 'd1' }),
    deal({
      id: 'd2',
      kind: 'debutante',
      beneficiaryName: 'Lia',
      overdue: true,
      package: null,
      packageName: null,
      packagePrice: null,
      discountAmount: '0.00',
      finalAmount: null,
      assignee: null,
    }),
  ],
  interactions: [],
};

function render_(leadData: unknown, extra: MockedResponse[] = []) {
  const mocks: MockedResponse[] = [
    {
      request: { query: CommercialLeadQuery },
      variableMatcher: () => true,
      maxUsageCount: 10,
      result: { data: { commercialLead: leadData } },
    },
    {
      request: { query: CommercialStagesQuery },
      maxUsageCount: 10,
      result: { data: { commercialStages: [STAGE_NOVO, STAGE_CONTATO] } },
    },
    {
      request: { query: CommercialAssigneesQuery },
      maxUsageCount: 10,
      result: {
        data: {
          commercialAssignees: [
            { __typename: 'CommercialMember', id: 'm-1', displayName: 'Bia', roleName: 'ATTENDANT' },
          ],
        },
      },
    },
    {
      request: { query: ContractPackagesQuery },
      maxUsageCount: 10,
      result: { data: { packages: [] } },
    },
    ...extra,
  ];
  render(
    <MemoryRouter initialEntries={['/comercial/leads/lead-ana']}>
      <MockedProvider mocks={mocks}>
        <Routes>
          <Route path="/comercial/leads/:id" element={<LeadDetailPage />} />
          <Route path="/comercial/leads" element={<div>Lista de leads</div>} />
        </Routes>
      </MockedProvider>
    </MemoryRouter>,
  );
}

afterEach(() => setRole(null));

describe('LeadDetailPage', () => {
  it('mostra os dois negócios com etapa, pacote, valor final e selo Atrasado', async () => {
    setRole('MANAGER');
    render_(LEAD);
    const d1 = await screen.findByTestId('deal-d1');
    expect(d1.textContent).toContain('Noiva');
    expect(d1.textContent).toContain('Noiva Completo');
    expect(d1.textContent).toContain('R$ 900,00');
    expect(d1.textContent).toContain('Novo');
    const d2 = screen.getByTestId('deal-d2');
    expect(d2.textContent).toContain('Debutante — Lia');
    expect(d2.textContent).toContain('Atrasado');
    expect(d1.textContent).not.toContain('Atrasado');
  });

  it('gerente vê Excluir lead e o seletor de responsável; atendente não', async () => {
    setRole('MANAGER');
    render_(LEAD);
    await screen.findByTestId('deal-d1');
    expect(screen.getByRole('button', { name: 'Excluir lead' })).toBeTruthy();
    expect(screen.getAllByLabelText('Responsável').length).toBeGreaterThan(0);
  });

  it('atendente não vê Excluir lead nem o seletor de responsável', async () => {
    setRole('ATTENDANT');
    render_(LEAD);
    await screen.findByTestId('deal-d1');
    expect(screen.queryByRole('button', { name: 'Excluir lead' })).toBeNull();
    expect(screen.queryByLabelText('Responsável')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Marcar ganho' }).length).toBe(2);
  });

  it('Novo negócio de debutante mostra Nome da debutante', async () => {
    setRole('ATTENDANT');
    render_(LEAD);
    await screen.findByTestId('deal-d1');
    fireEvent.click(screen.getByRole('button', { name: 'Novo negócio' }));
    expect(await screen.findByText('Novo negócio', { selector: '[role=dialog] *' })).toBeTruthy();
    expect(screen.queryByLabelText('Nome da debutante')).toBeNull();
    fireEvent.click(screen.getByLabelText('Debutante'));
    expect(screen.getByLabelText('Nome da debutante')).toBeTruthy();
  });

  it('registra interação com próximo contato e envia nextContactAt em ISO', async () => {
    setRole('ATTENDANT');
    const sent: { input?: Record<string, unknown> } = {};
    render_(LEAD, [
      {
        request: { query: CreateCommercialInteractionMutation },
        variableMatcher: (v) => {
          sent.input = (v as { input: Record<string, unknown> }).input;
          return true;
        },
        result: {
          data: {
            createCommercialInteraction: {
              __typename: 'CommercialInteractionPayload',
              interaction: {
                __typename: 'CommercialInteraction',
                id: 'i1',
                leadId: 'lead-ana',
                dealId: null,
                type: 'call',
                notes: null,
                occurredAt: '2026-11-18T12:00:00.000Z',
                reminderId: 'r1',
                createdBy: null,
              },
              errors: [],
            },
          },
        },
      },
    ]);
    await screen.findByTestId('deal-d1');
    fireEvent.click(screen.getByRole('tab', { name: 'Interações' }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Interações' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar interação' }));
    const select = (await screen.findByLabelText('Tipo')) as HTMLSelectElement;
    expect(select.options.length).toBe(6);
    fireEvent.change(screen.getByLabelText('Próximo contato em'), {
      target: { value: '2026-12-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(sent.input).toBeDefined());
    expect(sent.input?.nextContactAt).toBe(new Date('2026-12-01T10:00').toISOString());
    expect(sent.input?.type).toBe('call');
  });

  it('lead inexistente mostra Lead não encontrado', async () => {
    setRole('ATTENDANT');
    render_(null);
    expect(await screen.findByText('Lead não encontrado')).toBeTruthy();
    expect(screen.getByRole('link', { name: /lista de leads/i })).toBeTruthy();
  });
});

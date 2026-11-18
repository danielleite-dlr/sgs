import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { ClientByIdQuery } from '@/features/clients/api/clients.api';
import type { CommercialDeal } from '../api/deals.api';
import { CommercialLeadQuery } from '../api/leads.api';
import { WinCommercialDealMutation } from '../api/win.api';
import { WinDealDialog } from '../components/WinDealDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeDeal(over: Record<string, unknown> = {}): CommercialDeal {
  return {
    id: 'd1',
    leadId: 'lead-ana',
    lead: { id: 'lead-ana', fullName: 'Ana Souza', phone: '11999990000', email: null },
    stage: {
      id: 'st-novo',
      name: 'Novo',
      color: '#3b82f6',
      position: 0,
      slaDays: 1,
      kind: 'open',
      isSystem: false,
      openDeals: 1,
    },
    status: 'open',
    kind: 'noiva',
    beneficiaryName: null,
    eventDate: '2027-05-10',
    package: { id: 'p1', name: 'Noiva Completo', price: '1000.00' },
    packageName: 'Noiva Completo',
    packagePrice: '1000.00',
    discountAmount: '0.00',
    finalAmount: '1000.00',
    assignee: null,
    source: 'manual',
    location: null,
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
  } as CommercialDeal;
}

const LEAD_COM_CLIENTE = {
  __typename: 'CommercialLead',
  id: 'lead-ana',
  fullName: 'Ana Souza',
  phone: null,
  email: null,
  source: 'manual',
  notes: null,
  client: {
    __typename: 'CommercialClientRef',
    id: 'c1',
    fullName: 'Ana Souza',
    phone: null,
    email: null,
  },
  createdBy: null,
  consentAt: null,
  createdAt: '2026-11-10T12:00:00.000Z',
  openDeals: 1,
  lastInteractionAt: null,
  deals: [],
  interactions: [],
};

const CLIENTE = {
  __typename: 'Client',
  id: 'c1',
  fullName: 'Ana Souza da Silva',
  phone: '11988887777',
  email: 'ana@exemplo.com',
  cpf: '52998224725',
  birthDate: null,
  address: 'Rua das Flores, 10',
  rg: '123456789',
  postalCode: '01310100',
  phone2: null,
  phone3: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function clientMocks(): MockedResponse[] {
  return [
    {
      request: { query: CommercialLeadQuery },
      variableMatcher: () => true,
      result: { data: { commercialLead: LEAD_COM_CLIENTE } },
    },
    {
      request: { query: ClientByIdQuery, variables: { id: 'c1' } },
      result: { data: { client: CLIENTE } },
    },
  ];
}

function noClientMocks(): MockedResponse[] {
  return [
    {
      request: { query: CommercialLeadQuery },
      variableMatcher: () => true,
      result: { data: { commercialLead: { ...LEAD_COM_CLIENTE, client: null } } },
    },
  ];
}

function renderDialog(deal: CommercialDeal, mocks: MockedResponse[]) {
  render(
    <MemoryRouter initialEntries={['/comercial/pipeline']}>
      <MockedProvider mocks={mocks}>
        <Routes>
          <Route
            path="/comercial/pipeline"
            element={<WinDealDialog deal={deal} open onOpenChange={() => undefined} />}
          />
          <Route path="/contratos/:id" element={<div>Contrato aberto</div>} />
        </Routes>
      </MockedProvider>
    </MemoryRouter>,
  );
}

function winMock(
  payload: { contractId: string | null; errors: unknown[] },
  sent: Record<string, unknown>[] = [],
): MockedResponse {
  return {
    request: { query: WinCommercialDealMutation },
    variableMatcher: (v) => {
      sent.push((v as { input: Record<string, unknown> }).input);
      return true;
    },
    result: {
      data: {
        winCommercialDeal: {
          __typename: 'CommercialWinPayload',
          contractId: payload.contractId,
          clientId: 'c1',
          errors: payload.errors,
        },
      },
    },
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('WinDealDialog', () => {
  it('pré-preenche com a cliente ligada ao lead', async () => {
    renderDialog(makeDeal(), clientMocks());
    expect(await screen.findByDisplayValue('Ana Souza da Silva')).toBeTruthy();
    expect((screen.getByLabelText('CPF') as HTMLInputElement).value).toBe('529.982.247-25');
    expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe('Rua das Flores, 10');
    expect((screen.getByLabelText('CEP') as HTMLInputElement).value).toBe('01310-100');
  });

  it('sem cliente ligada usa nome e telefone do lead', async () => {
    renderDialog(makeDeal(), noClientMocks());
    expect(await screen.findByDisplayValue('Ana Souza')).toBeTruthy();
    expect((screen.getByLabelText('Celular') as HTMLInputElement).value.replace(/\D/g, '')).toBe(
      '11999990000',
    );
  });

  it('debutante exige o nome da debutante para confirmar', async () => {
    renderDialog(makeDeal({ kind: 'debutante', beneficiaryName: null }), noClientMocks());
    const campo = await screen.findByLabelText('Nome da debutante');
    const botao = screen.getByTestId('win-submit') as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: 'Lia' } });
    expect(botao.disabled).toBe(false);
  });

  it('sinal pago exige linha com valor e envia depositLines', async () => {
    const sent: Record<string, unknown>[] = [];
    renderDialog(makeDeal(), [
      ...noClientMocks(),
      winMock({ contractId: 'ct1', errors: [] }, sent),
    ]);
    await screen.findByDisplayValue('Ana Souza');
    fireEvent.click(screen.getByLabelText('Sim'));
    const botao = screen.getByTestId('win-submit') as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Valor 1'), { target: { value: '30000' } });
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    await waitFor(() => expect(sent.length).toBe(1));
    expect(sent[0]).toMatchObject({
      dealId: 'd1',
      depositPaid: true,
      depositLines: [{ method: 'pix', amount: '300.00' }],
    });
  });

  it('confirmar sem sinal abre o contrato e mostra o toast', async () => {
    const sent: Record<string, unknown>[] = [];
    renderDialog(makeDeal(), [...noClientMocks(), winMock({ contractId: 'ct1', errors: [] }, sent)]);
    await screen.findByDisplayValue('Ana Souza');
    fireEvent.click(screen.getByTestId('win-submit'));
    await screen.findByText('Contrato aberto');
    expect(sent[0]).toMatchObject({ dealId: 'd1', depositPaid: false, depositLines: null });
    expect(toast.success).toHaveBeenCalledWith('Negócio ganho. Contrato rascunho criado.');
  });

  it('erro da API aparece no diálogo e não navega', async () => {
    renderDialog(makeDeal(), [
      ...noClientMocks(),
      winMock({
        contractId: null,
        errors: [
          { __typename: 'UserError', code: 'PACKAGE_REQUIRED', message: 'Escolha o pacote', field: null },
        ],
      }),
    ]);
    await screen.findByDisplayValue('Ana Souza');
    fireEvent.click(screen.getByTestId('win-submit'));
    expect(await screen.findByText('Escolha o pacote')).toBeTruthy();
    expect(screen.queryByText('Contrato aberto')).toBeNull();
  });

  it('sem pacote mostra o aviso e desabilita o botão', async () => {
    renderDialog(makeDeal({ package: null, packageName: null, finalAmount: null }), noClientMocks());
    expect(
      await screen.findByText('Escolha o pacote do negócio antes de marcar ganho'),
    ).toBeTruthy();
    expect((screen.getByTestId('win-submit') as HTMLButtonElement).disabled).toBe(true);
  });
});

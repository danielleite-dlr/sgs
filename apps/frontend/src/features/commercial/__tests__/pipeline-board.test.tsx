import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import type * as permissions from '../commercial-permissions';
import type * as dndCore from '@dnd-kit/core';
import { CommercialDealQuery, CommercialDealsQuery, MoveCommercialDealMutation } from '../api/deals.api';
import { CommercialAssigneesQuery, CommercialStagesQuery } from '../api/leads.api';
import { PipelinePage } from '../pages/PipelinePage';
import { setRole } from './commercial-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const access = vi.hoisted(() => ({ canWinOverride: null as null | boolean }));
vi.mock('../commercial-permissions', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as typeof permissions;
  return {
    ...actual,
    useCommercialAccess: () => {
      const base = actual.useCommercialAccess();
      return access.canWinOverride === null ? base : { ...base, canWin: access.canWinOverride };
    },
  };
});

// Captura o onDragEnd do DndContext para simular o soltar do card.
const dnd = vi.hoisted(() => ({ onDragEnd: null as null | ((e: unknown) => void) }));
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>() as typeof dndCore;
  return {
    ...actual,
    DndContext: (props: { onDragEnd?: (e: unknown) => void } & Record<string, unknown>) => {
      dnd.onDragEnd = props.onDragEnd ?? null;
      return <actual.DndContext {...(props as object)} />;
    },
  };
});

function stage(id: string, name: string, position: number, kind: string, slaDays: number | null) {
  return {
    __typename: 'CommercialStage',
    id,
    name,
    color: '#3b82f6',
    position,
    slaDays,
    kind,
    isSystem: kind !== 'open',
    openDeals: 0,
  };
}
const ST = [
  stage('st-novo', 'Novo', 0, 'open', 1),
  stage('st-contato', 'Contato', 1, 'open', 2),
  stage('st-proposta', 'Proposta', 2, 'open', 3),
  stage('st-negociacao', 'Negociação', 3, 'open', 3),
  stage('st-ganho', 'Ganho', 4, 'won', null),
  stage('st-perdido', 'Perdido', 5, 'lost', null),
];

function deal(over: Record<string, unknown>) {
  return {
    __typename: 'CommercialDeal',
    id: 'd1',
    leadId: 'lead-ana',
    lead: {
      __typename: 'CommercialLeadRef',
      id: 'lead-ana',
      fullName: 'Ana Souza',
      phone: null,
      email: null,
    },
    stage: ST[0],
    status: 'open',
    kind: 'noiva',
    beneficiaryName: null,
    eventDate: '2027-05-10',
    package: null,
    packageName: 'Noiva Completo',
    packagePrice: '1000.00',
    discountAmount: '0.00',
    finalAmount: '1000.00',
    assignee: {
      __typename: 'CommercialMember',
      id: 'm-1',
      displayName: 'Bia',
      roleName: 'ATTENDANT',
    },
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
  };
}

const DEALS = [
  deal({ id: 'd1' }),
  deal({
    id: 'd2',
    lead: { __typename: 'CommercialLeadRef', id: 'l2', fullName: 'Bia Lima', phone: null, email: null },
    leadId: 'l2',
    kind: 'debutante',
    beneficiaryName: 'Lia',
    stage: ST[1],
    overdue: true,
    finalAmount: '500.00',
  }),
];

function mocks(extra: MockedResponse[] = []): MockedResponse[] {
  return [
    {
      request: { query: CommercialDealsQuery },
      variableMatcher: () => true,
      maxUsageCount: 20,
      result: { data: { commercialDeals: { __typename: 'CommercialDealPage', total: 2, items: DEALS } } },
    },
    {
      request: { query: CommercialStagesQuery },
      maxUsageCount: 20,
      result: { data: { commercialStages: ST } },
    },
    {
      request: { query: CommercialAssigneesQuery },
      maxUsageCount: 20,
      result: { data: { commercialAssignees: [] } },
    },
    ...extra,
  ];
}

function renderPage(extra: MockedResponse[] = [], url = '/comercial/pipeline') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <MockedProvider mocks={mocks(extra)}>
        <PipelinePage />
      </MockedProvider>
    </MemoryRouter>,
  );
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  dnd.onDragEnd = null;
  access.canWinOverride = null;
  vi.clearAllMocks();
});
afterEach(() => {
  setRole(null);
  vi.restoreAllMocks();
});

describe('Pipeline', () => {
  it('mostra uma coluna por etapa, contagem, soma, card e selo Atrasado', async () => {
    setRole('MANAGER');
    renderPage();
    await screen.findByTestId('deal-d1');
    expect(screen.getAllByRole('region').length).toBe(6);
    const novo = screen.getByTestId('stage-st-novo');
    expect(novo.textContent).toContain('Novo (1)');
    expect(novo.textContent).toContain('R$ 1.000,00');
    expect(novo.textContent).toContain('Noiva Completo');
    const d2 = screen.getByTestId('deal-d2');
    expect(d2.getAttribute('data-overdue')).toBe('true');
    expect(d2.textContent).toContain('Atrasado');
    expect(d2.textContent).toContain('Debutante — Lia');
    expect(screen.getByTestId('deal-d1').getAttribute('data-overdue')).toBeNull();
  });

  it('soltar em outra etapa move na hora e envia { id, stageId }', async () => {
    setRole('ATTENDANT');
    const sent: Record<string, unknown>[] = [];
    renderPage([
      {
        request: { query: MoveCommercialDealMutation },
        variableMatcher: (v) => {
          sent.push(v as Record<string, unknown>);
          return true;
        },
        delay: 50,
        result: {
          data: {
            moveCommercialDeal: {
              __typename: 'CommercialDealPayload',
              deal: deal({ id: 'd1', stage: ST[1] }),
              errors: [],
            },
          },
        },
      },
    ]);
    await screen.findByTestId('deal-d1');
    act(() => dnd.onDragEnd!({ active: { id: 'd1' }, over: { id: 'st-contato' } }));
    // otimista: já está em Contato antes da resposta
    await waitFor(() =>
      expect(within(screen.getByTestId('stage-st-contato')).queryByTestId('deal-d1')).toBeTruthy(),
    );
    await waitFor(() => expect(sent).toEqual([{ id: 'd1', stageId: 'st-contato' }]));
  });

  it('se a API recusa, o card volta para a etapa original e aparece toast', async () => {
    setRole('ATTENDANT');
    renderPage([
      {
        request: { query: MoveCommercialDealMutation },
        variableMatcher: () => true,
        delay: 30,
        result: {
          data: {
            moveCommercialDeal: {
              __typename: 'CommercialDealPayload',
              deal: null,
              errors: [{ __typename: 'UserError', code: 'DEAL_CLOSED', message: 'Negócio fechado', field: null }],
            },
          },
        },
      },
    ]);
    await screen.findByTestId('deal-d1');
    act(() => dnd.onDragEnd!({ active: { id: 'd1' }, over: { id: 'st-contato' } }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Negócio fechado'));
    await waitFor(() =>
      expect(within(screen.getByTestId('stage-st-novo')).queryByTestId('deal-d1')).toBeTruthy(),
    );
  });

  it.skip('soltar em Ganho ou Perdido não move: abre os diálogos', async () => {
    setRole('ATTENDANT');
    renderPage();
    await screen.findByTestId('deal-d1');
    act(() => dnd.onDragEnd!({ active: { id: 'd1' }, over: { id: 'st-ganho' } }));
    await screen.findByRole('dialog', { name: /Marcar como ganho|Negócio ganho/i });
  });

  it('menu Mover para… lista as outras etapas abertas e move', async () => {
    setRole('ATTENDANT');
    const sent: Record<string, unknown>[] = [];
    renderPage([
      {
        request: { query: MoveCommercialDealMutation },
        variableMatcher: (v) => {
          sent.push(v as Record<string, unknown>);
          return true;
        },
        result: {
          data: {
            moveCommercialDeal: {
              __typename: 'CommercialDealPayload',
              deal: deal({ id: 'd1', stage: ST[2] }),
              errors: [],
            },
          },
        },
      },
    ]);
    await screen.findByTestId('deal-d1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ações de Ana Souza' }));
    expect(await screen.findByText('Mover para…')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Novo' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Marcar como ganho' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Marcar como perdido' })).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'Proposta' }));
    await waitFor(() => expect(sent).toEqual([{ id: 'd1', stageId: 'st-proposta' }]));
    await flush();
  });

  it('sem permissão de ganho (canWinDeal falso) o menu não oferece Marcar como ganho', async () => {
    setRole('ATTENDANT');
    access.canWinOverride = false;
    renderPage();
    await screen.findByTestId('deal-d1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ações de Ana Souza' }));
    await screen.findByText('Mover para…');
    expect(screen.queryByRole('menuitem', { name: 'Marcar como ganho' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Marcar como perdido' })).toBeTruthy();
  });

  it.skip('?negocio=ID&acao=perder abre o diálogo de perda desse negócio', async () => {
    setRole('ATTENDANT');
    renderPage(
      [
        {
          request: { query: CommercialDealQuery },
          variableMatcher: () => true,
          result: { data: { commercialDeal: DEALS[0] } },
        },
      ],
      '/comercial/pipeline?negocio=d1&acao=perder',
    );
    await screen.findByRole('dialog', { name: /Marcar como perdido/i });
  });

  it('filtro de responsável só aparece para gerente', async () => {
    setRole('ATTENDANT');
    renderPage();
    await screen.findByTestId('deal-d1');
    expect(screen.queryByLabelText('Responsável')).toBeNull();
    expect(screen.getByLabelText('Tipo')).toBeTruthy();
  });
});

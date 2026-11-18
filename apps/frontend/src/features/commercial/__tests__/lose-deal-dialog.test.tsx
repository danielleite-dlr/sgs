import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { LoseCommercialDealMutation, type CommercialDeal } from '../api/deals.api';
import { LoseDealDialog } from '../components/LoseDealDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DEAL = {
  id: 'd1',
  leadId: 'lead-ana',
  lead: { id: 'lead-ana', fullName: 'Ana Souza', phone: null, email: null },
} as unknown as CommercialDeal;

function renderDialog(mocks: MockedResponse[] = []) {
  render(
    <MockedProvider mocks={mocks}>
      <LoseDealDialog deal={DEAL} open onOpenChange={() => undefined} />
    </MockedProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('LoseDealDialog', () => {
  it('sem motivo mostra Escolha o motivo', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como perdido' }));
    expect(screen.getByText('Escolha o motivo')).toBeTruthy();
  });

  it('Outro sem texto mostra Descreva o motivo', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('Outro'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como perdido' }));
    expect(screen.getByText('Descreva o motivo')).toBeTruthy();
  });

  it('texto acima de 500 bloqueia o botão', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('Preço'));
    fireEvent.change(screen.getByLabelText(/Detalhes/), { target: { value: 'x'.repeat(501) } });
    expect(
      (screen.getByRole('button', { name: 'Marcar como perdido' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('501/500')).toBeTruthy();
  });

  it('confirmar chama loseCommercialDeal com motivo e texto', async () => {
    const sent: Record<string, unknown>[] = [];
    renderDialog([
      {
        request: { query: LoseCommercialDealMutation },
        variableMatcher: (v) => {
          sent.push(v as Record<string, unknown>);
          return true;
        },
        result: {
          data: {
            loseCommercialDeal: { __typename: 'CommercialDealPayload', deal: null, errors: [] },
          },
        },
      },
    ]);
    fireEvent.click(screen.getByLabelText('Preço'));
    fireEvent.change(screen.getByLabelText(/Detalhes/), { target: { value: 'Achou caro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como perdido' }));
    await waitFor(() =>
      expect(sent).toEqual([{ id: 'd1', reasonCode: 'price', reasonText: 'Achou caro' }]),
    );
  });
});

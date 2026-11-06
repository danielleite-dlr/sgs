import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { VisitFormDialog } from '../components/calendar/VisitFormDialog';

const emptyClients: MockedResponse = {
  request: { query: ClientsListQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: {
    data: { clients: { __typename: 'ClientsPage', totalCount: 0, rows: [] } },
  },
};

function renderDialog() {
  return render(
    <MockedProvider mocks={[emptyClients]}>
      <VisitFormDialog
        open
        onOpenChange={() => undefined}
        date={new Date(2026, 10, 4)}
        professionals={[]}
        onCreated={() => undefined}
      />
    </MockedProvider>,
  );
}

describe('VisitFormDialog no celular (UX-03)', () => {
  it('ocupa a tela inteira no celular e mantém o tamanho no computador', () => {
    renderDialog();
    const dialog = screen.getByTestId('visit-form');
    expect(dialog).toHaveClass('h-[100dvh]', 'sm:h-auto', 'sm:max-h-[90vh]');
  });

  it('o corpo rolável avisa "Role para ver mais campos"', () => {
    renderDialog();
    const hint = screen.getByTestId('visit-scroll-hint');
    expect(hint).toHaveTextContent('Role para ver mais campos');
    expect(screen.getByTestId('visit-form-body')).toContainElement(hint);
  });

  it('esconde o aviso quando o corpo chega ao fim', () => {
    renderDialog();
    const body = screen.getByTestId('visit-form-body');
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 600 });
    body.scrollTop = 100;
    fireEvent.scroll(body);
    expect(screen.getByTestId('visit-scroll-hint')).not.toHaveClass('hidden');
    body.scrollTop = 400;
    fireEvent.scroll(body);
    expect(screen.getByTestId('visit-scroll-hint')).toHaveClass('hidden');
  });
});

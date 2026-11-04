import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import {
  MarkAllNotificationsReadMutation,
  MarkNotificationReadMutation,
  NotificationsQuery,
  UnreadNotificationCountQuery,
} from '../api/notifications.api';
import { NotificationsBell } from '../components/NotificationsBell';

const notif = {
  __typename: 'Notification',
  id: 'n1',
  kind: 'contract_balance_overdue',
  payload: {
    title: 'Saldo vencido',
    message: 'Contrato C-1 com saldo vencido',
    contractId: 'c1',
    code: 'C-1',
  },
  readAt: null,
  createdAt: new Date().toISOString(),
};

function countMock(n: number): MockedResponse {
  return {
    request: { query: UnreadNotificationCountQuery },
    result: { data: { unreadNotificationCount: n } },
  };
}
const listMock: MockedResponse = {
  request: { query: NotificationsQuery, variables: { unreadOnly: true } },
  result: { data: { notifications: [notif] } },
};
const emptyListMock: MockedResponse = {
  request: { query: NotificationsQuery, variables: { unreadOnly: true } },
  result: { data: { notifications: [] } },
};

function renderBell(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <NotificationsBell />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('NotificationsBell', () => {
  it('mostra o contador de não lidas', async () => {
    renderBell([countMock(3)]);
    expect((await screen.findByTestId('notifications-badge')).textContent).toBe('3');
  });

  it('mostra 9+ acima de nove', async () => {
    renderBell([countMock(12)]);
    expect((await screen.findByTestId('notifications-badge')).textContent).toBe('9+');
  });

  it('esconde o badge quando zero', async () => {
    renderBell([countMock(0)]);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.queryByTestId('notifications-badge')).toBeNull();
  });

  it('abre a lista e marca como lida ao clicar', async () => {
    const markResult = vi.fn(() => ({
      data: {
        markNotificationRead: {
          __typename: 'Notification',
          id: 'n1',
          readAt: new Date().toISOString(),
        },
      },
    }));
    renderBell([
      countMock(1),
      listMock,
      {
        request: { query: MarkNotificationReadMutation, variables: { input: { id: 'n1' } } },
        result: markResult,
      },
      countMock(0),
      emptyListMock,
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    fireEvent.click(await screen.findByText('Saldo vencido'));
    await waitFor(() => expect(markResult).toHaveBeenCalledTimes(1));
  });

  it('marcar todas chama a mutation', async () => {
    const allResult = vi.fn(() => ({ data: { markAllNotificationsRead: 1 } }));
    renderBell([
      countMock(1),
      listMock,
      { request: { query: MarkAllNotificationsReadMutation }, result: allResult },
      countMock(0),
      emptyListMock,
    ]);
    await screen.findByTestId('notifications-badge');
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }));
    await waitFor(() => expect(allResult).toHaveBeenCalledTimes(1));
  });
});

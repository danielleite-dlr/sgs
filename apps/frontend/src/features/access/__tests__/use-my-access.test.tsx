import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ACCESS_CHANGED_EVENT } from '../access-events';
import { MyAccessQuery, type MyAccessData } from '../access.api';
import { useMyAccessSync } from '../use-my-access';

const myAccess: MyAccessData = {
  memberId: '00000000-0000-0000-0000-000000000001',
  roleName: 'MANAGER',
  permissions: ['comanda.read'],
  canManageAccess: false,
  items: [],
};

let calls = 0;

function mocks(): MockedResponse[] {
  const one: MockedResponse = {
    request: { query: MyAccessQuery },
    result: () => {
      calls += 1;
      return { data: { myAccess: { __typename: 'MyAccess', ...myAccess } } };
    },
  };
  return Array.from({ length: 20 }, () => one);
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MockedProvider mocks={mocks()}>
      <MemoryRouter initialEntries={['/a']}>{children}</MemoryRouter>
    </MockedProvider>
  );
}

function useHarness() {
  useMyAccessSync();
  return useNavigate();
}

beforeEach(() => {
  calls = 0;
  useAuthStore.getState().clearSession();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMyAccessSync', () => {
  it('consulta ao montar e grava no store como acesso fresco', async () => {
    renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(useAuthStore.getState().accessFresh).toBe(true));
    expect(useAuthStore.getState().roleName).toBe('MANAGER');
    expect(calls).toBe(1);
  });

  it('relê no evento de acesso alterado e ao voltar a ficar visível', async () => {
    renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(calls).toBe(1));
    act(() => {
      window.dispatchEvent(new Event(ACCESS_CHANGED_EVENT));
    });
    await waitFor(() => expect(calls).toBe(2));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(calls).toBe(3));
  });

  it('troca de rota relê no máximo uma vez a cada 10 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.now();
    const { result } = renderHook(() => useHarness(), { wrapper });
    await vi.waitFor(() => expect(calls).toBe(1));
    // Dentro da trava: nenhuma leitura extra.
    act(() => result.current('/b'));
    act(() => result.current('/c'));
    expect(calls).toBe(1);
    // Passada a trava: uma leitura, e a seguinte imediata é barrada.
    vi.setSystemTime(start + 11_000);
    act(() => result.current('/d'));
    await vi.waitFor(() => expect(calls).toBe(2));
    act(() => result.current('/e'));
    expect(calls).toBe(2);
  });
});

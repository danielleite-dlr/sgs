import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const m = vi.hoisted(() => ({
  unregister: vi.fn(),
  unsubscribe: vi.fn(),
  logoutMutation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/infrastructure/native/device-token.api', () => ({
  unregisterCurrentDeviceToken: () => m.unregister(),
}));
vi.mock('@/infrastructure/webpush/web-push-client', () => ({
  unsubscribeWebPush: () => m.unsubscribe(),
}));
vi.mock('../api/auth.api', () => ({
  useLogoutMutation: () => [m.logoutMutation],
  useRefreshMutation: () => [m.refresh],
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '../hooks/useAuth';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  m.unregister.mockResolvedValue(undefined);
  m.unsubscribe.mockResolvedValue(undefined);
  m.logoutMutation.mockResolvedValue({});
  m.refresh.mockResolvedValue({ data: null });
  useAuthStore.setState({
    accessToken: 'a',
    refreshToken: 'r',
    userId: 'u',
    memberId: 'm',
    organizationId: 'o',
    impersonating: false,
  });
});

describe('useAuth.logout e token do aparelho', () => {
  it('remove o token antes de encerrar a sessão', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(m.unregister).toHaveBeenCalledTimes(1);
    expect(m.logoutMutation).toHaveBeenCalledTimes(1);
    expect(m.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      m.logoutMutation.mock.invocationCallOrder[0],
    );
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('desinscreve o Web Push depois de remover o token, antes de encerrar a sessão', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(m.unsubscribe).toHaveBeenCalledTimes(1);
    expect(m.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      m.unsubscribe.mock.invocationCallOrder[0],
    );
    expect(m.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      m.logoutMutation.mock.invocationCallOrder[0],
    );
  });

  it('falha ao desinscrever o Web Push não impede o logout', async () => {
    m.unsubscribe.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(m.logoutMutation).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('falha ao remover o token não impede o logout', async () => {
    m.unregister.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(m.logoutMutation).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('impersonando não remove o token', async () => {
    useAuthStore.setState({ impersonating: true });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(m.unregister).not.toHaveBeenCalled();
    expect(m.unsubscribe).not.toHaveBeenCalled();
  });
});

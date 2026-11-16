import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/infrastructure/apollo/client', () => ({ apolloClient: { mutate: vi.fn() } }));

import { apolloClient } from '@/infrastructure/apollo/client';
import {
  DEVICE_TOKEN_KEY,
  REGISTER_DEVICE_TOKEN,
  UNREGISTER_DEVICE_TOKEN,
  registerDeviceToken,
  unregisterCurrentDeviceToken,
} from '../device-token.api';

const mutate = vi.mocked(apolloClient.mutate);

describe('device-token.api', () => {
  beforeEach(() => {
    localStorage.clear();
    mutate.mockReset();
    mutate.mockResolvedValue({} as never);
  });

  it('registra o token no backend e guarda localmente', async () => {
    await registerDeviceToken('tok');
    expect(mutate).toHaveBeenCalledWith({
      mutation: REGISTER_DEVICE_TOKEN,
      variables: { input: { token: 'tok', platform: 'android', provider: 'fcm' } },
    });
    expect(localStorage.getItem(DEVICE_TOKEN_KEY)).toBe('tok');
  });

  it('sem token local não chama o backend ao remover', async () => {
    await unregisterCurrentDeviceToken();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('remove o token no backend e a chave local', async () => {
    localStorage.setItem(DEVICE_TOKEN_KEY, 'tok');
    await unregisterCurrentDeviceToken();
    expect(mutate).toHaveBeenCalledWith({
      mutation: UNREGISTER_DEVICE_TOKEN,
      variables: { token: 'tok' },
    });
    expect(localStorage.getItem(DEVICE_TOKEN_KEY)).toBeNull();
  });

  it('remove a chave mesmo se o backend rejeitar, propagando o erro', async () => {
    localStorage.setItem(DEVICE_TOKEN_KEY, 'tok');
    mutate.mockRejectedValue(new Error('offline'));
    await expect(unregisterCurrentDeviceToken()).rejects.toThrow('offline');
    expect(localStorage.getItem(DEVICE_TOKEN_KEY)).toBeNull();
  });
});

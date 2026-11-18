import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/infrastructure/native/platform', () => ({ isNativeApp: vi.fn(() => false) }));
vi.mock('@/infrastructure/native/device-token.api', () => ({
  registerWebPushSubscription: vi.fn(),
}));
vi.mock('../platform-ios', () => ({
  isWebPushContext: vi.fn(() => true),
  supportsWebPush: vi.fn(() => true),
}));

import { isNativeApp } from '@/infrastructure/native/platform';
import { registerWebPushSubscription } from '@/infrastructure/native/device-token.api';
import { isWebPushContext, supportsWebPush } from '../platform-ios';
import {
  enableWebPush,
  getWebPushState,
  registerServiceWorker,
  syncWebPushSubscription,
  unsubscribeWebPush,
  urlBase64ToUint8Array,
} from '../web-push-client';

const KEY = `B${'A'.repeat(86)}`;
const subscription = (unsubscribe = vi.fn().mockResolvedValue(true)) => ({
  endpoint: 'https://push/e1',
  toJSON: () => ({ endpoint: 'https://push/e1', keys: { p256dh: 'pk', auth: 'au' } }),
  unsubscribe,
});

let pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
let sw: Record<string, ReturnType<typeof vi.fn> | Promise<unknown>>;
let requestPermission: ReturnType<typeof vi.fn>;

function setPermission(permission: string) {
  (globalThis as unknown as { Notification: unknown }).Notification = {
    permission,
    requestPermission,
  };
}

beforeEach(() => {
  vi.mocked(isNativeApp).mockReturnValue(false);
  vi.mocked(isWebPushContext).mockReturnValue(true);
  vi.mocked(supportsWebPush).mockReturnValue(true);
  vi.mocked(registerWebPushSubscription).mockReset().mockResolvedValue(undefined);
  pushManager = { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() };
  const reg = { pushManager };
  sw = {
    register: vi.fn().mockResolvedValue(reg),
    ready: Promise.resolve(reg),
    getRegistration: vi.fn().mockResolvedValue(reg),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });
  requestPermission = vi.fn().mockResolvedValue('granted');
  setPermission('default');
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(globalThis, 'Notification');
  vi.restoreAllMocks();
});

describe('urlBase64ToUint8Array', () => {
  it('converte chave de 87 chars em 65 bytes começando com 0x04', () => {
    const out = urlBase64ToUint8Array(KEY);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(65);
    expect(out[0]).toBe(0x04);
  });
});

describe('registerServiceWorker', () => {
  it('registra /sw.js no contexto Web Push', async () => {
    await registerServiceWorker();
    expect(sw.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('devolve null fora do contexto ou sem suporte', async () => {
    vi.mocked(isWebPushContext).mockReturnValue(false);
    expect(await registerServiceWorker()).toBeNull();
    vi.mocked(isWebPushContext).mockReturnValue(true);
    vi.mocked(supportsWebPush).mockReturnValue(false);
    expect(await registerServiceWorker()).toBeNull();
    expect(sw.register).not.toHaveBeenCalled();
  });
});

describe('getWebPushState', () => {
  it('cobre todos os estados', async () => {
    expect(await getWebPushState(null)).toBe('off');
    vi.mocked(isWebPushContext).mockReturnValue(false);
    expect(await getWebPushState(KEY)).toBe('unavailable');
    vi.mocked(isWebPushContext).mockReturnValue(true);
    vi.mocked(supportsWebPush).mockReturnValue(false);
    expect(await getWebPushState(KEY)).toBe('unsupported');
    vi.mocked(supportsWebPush).mockReturnValue(true);
    setPermission('denied');
    expect(await getWebPushState(KEY)).toBe('denied');
    setPermission('default');
    expect(await getWebPushState(KEY)).toBe('default');
    setPermission('granted');
    expect(await getWebPushState(KEY)).toBe('needs-subscribe');
    pushManager.getSubscription.mockResolvedValue(subscription());
    expect(await getWebPushState(KEY)).toBe('granted');
  });
});

describe('enableWebPush', () => {
  it('pede a permissão antes de qualquer outro await e inscreve', async () => {
    pushManager.subscribe.mockResolvedValue(subscription());
    const result = await enableWebPush(KEY);
    expect(result).toBe('granted');
    const order = requestPermission.mock.invocationCallOrder[0];
    expect(order).toBeLessThan(pushManager.getSubscription.mock.invocationCallOrder[0]);
    expect(order).toBeLessThan(pushManager.subscribe.mock.invocationCallOrder[0]);
    const arg = pushManager.subscribe.mock.calls[0][0] as {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array;
    };
    expect(arg.userVisibleOnly).toBe(true);
    expect(arg.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(registerWebPushSubscription).toHaveBeenCalledWith('https://push/e1', {
      p256dh: 'pk',
      auth: 'au',
    });
  });

  it('recusa devolve denied sem subscribe', async () => {
    requestPermission.mockResolvedValue('denied');
    expect(await enableWebPush(KEY)).toBe('denied');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('falha de rede devolve error', async () => {
    pushManager.subscribe.mockResolvedValue(subscription());
    vi.mocked(registerWebPushSubscription).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await enableWebPush(KEY)).toBe('error');
  });
});

describe('syncWebPushSubscription', () => {
  it('reenvia a inscrição existente', async () => {
    setPermission('granted');
    pushManager.getSubscription.mockResolvedValue(subscription());
    expect(await syncWebPushSubscription()).toBe(true);
    expect(registerWebPushSubscription).toHaveBeenCalledTimes(1);
  });

  it('sem inscrição ou sem permissão não envia nada', async () => {
    setPermission('granted');
    expect(await syncWebPushSubscription()).toBe(false);
    setPermission('default');
    pushManager.getSubscription.mockResolvedValue(subscription());
    expect(await syncWebPushSubscription()).toBe(false);
    expect(registerWebPushSubscription).not.toHaveBeenCalled();
  });
});

describe('unsubscribeWebPush', () => {
  it('cancela a inscrição', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    pushManager.getSubscription.mockResolvedValue(subscription(unsubscribe));
    await unsubscribeWebPush();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('no app nativo não toca no service worker', async () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    await unsubscribeWebPush();
    expect(sw.getRegistration).not.toHaveBeenCalled();
  });

  it('engole erros', async () => {
    (sw.getRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
    await expect(unsubscribeWebPush()).resolves.toBeUndefined();
  });
});

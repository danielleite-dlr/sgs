import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, (arg: any) => void> = {};
const removers: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('../platform', () => ({ isNativeApp: vi.fn(() => true) }));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addListener: vi.fn(async (ev: string, cb: (arg: any) => void) => {
      handlers[ev] = cb;
      const remove = vi.fn();
      removers.push(remove);
      return { remove };
    }),
    createChannel: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    register: vi.fn(),
  },
}));

import { PushNotifications } from '@capacitor/push-notifications';
import { isNativeApp } from '../platform';
import { PUSH_ASKED_KEY, addPushListeners, registerForPush } from '../native-push';

const pn = vi.mocked(PushNotifications);

function makeHandlers() {
  return { onToken: vi.fn(), onOpenRoute: vi.fn(), onForeground: vi.fn() };
}

describe('native-push', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    removers.length = 0;
    vi.mocked(isNativeApp).mockReturnValue(true);
  });

  describe('addPushListeners', () => {
    it('fora do app é no-op', async () => {
      vi.mocked(isNativeApp).mockReturnValue(false);
      const off = await addPushListeners(makeHandlers());
      expect(pn.addListener).not.toHaveBeenCalled();
      expect(() => off()).not.toThrow();
    });

    it('encaminha token, toque (só rota permitida) e primeiro plano; remove os 3 handles', async () => {
      const h = makeHandlers();
      const off = await addPushListeners(h);
      expect(Object.keys(handlers)).toEqual(
        expect.arrayContaining([
          'registration',
          'pushNotificationActionPerformed',
          'pushNotificationReceived',
        ]),
      );
      handlers.registration({ value: 'tok' });
      expect(h.onToken).toHaveBeenCalledWith('tok');

      handlers.pushNotificationActionPerformed({
        notification: { data: { route: '/agenda?data=2026-11-20&visao=day' } },
      });
      expect(h.onOpenRoute).toHaveBeenCalledWith('/agenda?data=2026-11-20&visao=day');
      handlers.pushNotificationActionPerformed({ notification: { data: { route: '/admin' } } });
      handlers.pushNotificationActionPerformed({ notification: { data: {} } });
      expect(h.onOpenRoute).toHaveBeenCalledTimes(1);

      handlers.pushNotificationReceived({ title: 'Novo', body: 'Maria às 14h' });
      expect(h.onForeground).toHaveBeenCalledWith('Novo', 'Maria às 14h');

      off();
      expect(removers).toHaveLength(3);
      removers.forEach((r) => expect(r).toHaveBeenCalled());
    });
  });

  describe('registerForPush', () => {
    it('fora do app devolve skipped', async () => {
      vi.mocked(isNativeApp).mockReturnValue(false);
      expect(await registerForPush()).toBe('skipped');
      expect(pn.register).not.toHaveBeenCalled();
    });

    it('permissão já concedida: cria canal e registra', async () => {
      pn.checkPermissions.mockResolvedValue({ receive: 'granted' });
      expect(await registerForPush()).toBe('registered');
      expect(pn.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agenda', name: 'Agenda', importance: 4 }),
      );
      expect(pn.register).toHaveBeenCalled();
    });

    it('prompt sem pedido anterior: pede uma vez e registra se concedida', async () => {
      pn.checkPermissions.mockResolvedValue({ receive: 'prompt' });
      pn.requestPermissions.mockResolvedValue({ receive: 'granted' });
      expect(await registerForPush()).toBe('registered');
      expect(localStorage.getItem(PUSH_ASKED_KEY)).toBe('1');
      expect(pn.requestPermissions).toHaveBeenCalledTimes(1);
      expect(pn.register).toHaveBeenCalled();
    });

    it('prompt com pedido anterior: não pede de novo', async () => {
      localStorage.setItem(PUSH_ASKED_KEY, '1');
      pn.checkPermissions.mockResolvedValue({ receive: 'prompt' });
      expect(await registerForPush()).toBe('denied');
      expect(pn.requestPermissions).not.toHaveBeenCalled();
      expect(pn.register).not.toHaveBeenCalled();
    });

    it('negada: não registra', async () => {
      pn.checkPermissions.mockResolvedValue({ receive: 'denied' });
      expect(await registerForPush()).toBe('denied');
      expect(pn.register).not.toHaveBeenCalled();
    });
  });
});

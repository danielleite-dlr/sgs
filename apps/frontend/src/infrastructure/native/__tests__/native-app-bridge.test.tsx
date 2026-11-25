import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const h = vi.hoisted(() => ({
  native: true,
  handlers: null as null | {
    onToken(t: string): void;
    onOpenRoute(r: string): void;
    onForeground(t: string, b: string): void;
  },
  backCb: null as null | ((e: { canGoBack: boolean }) => void),
  removePush: vi.fn(),
  removeBack: vi.fn(),
  addPushListeners: vi.fn(),
  registerForPush: vi.fn(),
  registerDeviceToken: vi.fn(),
  savePendingRoute: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  hide: vi.fn(),
  setStyle: vi.fn(),
  exitApp: vi.fn(),
}));

vi.mock('../platform', () => ({ isNativeApp: () => h.native }));
vi.mock('../native-push', () => ({
  addPushListeners: (handlers: typeof h.handlers) => {
    h.handlers = handlers;
    h.addPushListeners();
    return Promise.resolve(h.removePush);
  },
  registerForPush: () => h.registerForPush(),
}));
vi.mock('../device-token.api', () => ({
  registerDeviceToken: (t: string) => h.registerDeviceToken(t),
}));
vi.mock('../push-route', () => ({ savePendingRoute: (r: string) => h.savePendingRoute(r) }));
vi.mock('@/router', () => ({ router: { navigate: (r: string) => h.navigate(r) } }));
vi.mock('sonner', () => ({ toast: (...a: unknown[]) => h.toast(...a) }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: h.hide } }));
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: { setStyle: h.setStyle },
  Style: { Light: 'LIGHT' },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, cb: (e: { canGoBack: boolean }) => void) => {
      // O ponte registra também appStateChange (fase 10): só o backButton alimenta backCb.
      if (name === 'backButton') h.backCb = cb;
      return Promise.resolve({ remove: h.removeBack });
    },
    exitApp: h.exitApp,
  },
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { NativeAppBridge } from '../NativeAppBridge';

const session = {
  accessToken: 'a',
  userId: 'u1',
  memberId: 'm1',
  organizationId: 'o1',
  impersonating: false,
};

async function mount() {
  const r = render(<NativeAppBridge />);
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.native = true;
  h.handlers = null;
  h.backCb = null;
  h.registerForPush.mockResolvedValue('registered');
  h.registerDeviceToken.mockResolvedValue(undefined);
  h.setStyle.mockResolvedValue(undefined);
  useAuthStore.setState({
    accessToken: null,
    userId: null,
    memberId: null,
    organizationId: null,
    impersonating: false,
  });
  document.body.innerHTML = '';
});

describe('NativeAppBridge', () => {
  it('fora do app não chama plugin nem listeners', async () => {
    h.native = false;
    useAuthStore.setState(session);
    await mount();
    expect(h.hide).not.toHaveBeenCalled();
    expect(h.addPushListeners).not.toHaveBeenCalled();
    expect(h.registerForPush).not.toHaveBeenCalled();
  });

  it('no app esconde a splash, ajusta a barra de status e registra listeners uma vez', async () => {
    await mount();
    expect(h.hide).toHaveBeenCalledWith({ fadeOutDuration: 200 });
    expect(h.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(h.addPushListeners).toHaveBeenCalledTimes(1);
  });

  it('toque com sessão navega para a rota', async () => {
    useAuthStore.setState(session);
    await mount();
    h.handlers!.onOpenRoute('/agenda?data=2026-11-20');
    expect(h.navigate).toHaveBeenCalledWith('/agenda?data=2026-11-20');
    expect(h.savePendingRoute).not.toHaveBeenCalled();
  });

  it('toque sem sessão guarda a rota e vai para o login', async () => {
    await mount();
    h.handlers!.onOpenRoute('/agenda');
    expect(h.savePendingRoute).toHaveBeenCalledWith('/agenda');
    expect(h.navigate).toHaveBeenCalledWith('/login');
  });

  it('aviso em primeiro plano vira toast', async () => {
    await mount();
    h.handlers!.onForeground('Novo agendamento', 'Maria · Escova');
    expect(h.toast).toHaveBeenCalledWith('Novo agendamento', { description: 'Maria · Escova' });
  });

  it('token do aparelho é registrado e erro é engolido', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.registerDeviceToken.mockRejectedValueOnce(new Error('rede'));
    await mount();
    h.handlers!.onToken('tok');
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.registerDeviceToken).toHaveBeenCalledWith('tok');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('registra push uma vez por membro+organização e repete ao trocar de usuária', async () => {
    useAuthStore.setState(session);
    const { rerender } = await mount();
    expect(h.registerForPush).toHaveBeenCalledTimes(1);
    rerender(<NativeAppBridge />);
    expect(h.registerForPush).toHaveBeenCalledTimes(1);
    await act(async () => {
      useAuthStore.setState({ memberId: 'm2' });
    });
    expect(h.registerForPush).toHaveBeenCalledTimes(2);
  });

  it('não registra push impersonando, sem organização ou sem sessão', async () => {
    useAuthStore.setState({ ...session, impersonating: true });
    await mount();
    await act(async () => {
      useAuthStore.setState({ impersonating: false, organizationId: null });
    });
    await act(async () => {
      useAuthStore.setState({ accessToken: null, organizationId: 'o1' });
    });
    expect(h.registerForPush).not.toHaveBeenCalled();
  });

  it('botão voltar: fecha diálogo, volta no histórico ou sai do app', async () => {
    await mount();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const esc = vi.fn();
    document.addEventListener('keydown', esc);

    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    document.body.appendChild(dlg);
    h.backCb!({ canGoBack: true });
    expect(esc).toHaveBeenCalledTimes(1);
    expect(esc.mock.calls[0][0].key).toBe('Escape');
    expect(back).not.toHaveBeenCalled();
    dlg.remove();

    h.backCb!({ canGoBack: true });
    expect(back).toHaveBeenCalledTimes(1);
    expect(h.exitApp).not.toHaveBeenCalled();

    h.backCb!({ canGoBack: false });
    expect(h.exitApp).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', esc);
    back.mockRestore();
  });

  it('desmontar remove os listeners', async () => {
    const { unmount } = await mount();
    unmount();
    expect(h.removePush).toHaveBeenCalledTimes(1);
    // backButton + appStateChange
    expect(h.removeBack).toHaveBeenCalledTimes(2);
  });
});

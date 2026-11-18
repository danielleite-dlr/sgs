import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const h = vi.hoisted(() => ({
  context: true,
  supported: true,
  registerServiceWorker: vi.fn(),
  syncWebPushSubscription: vi.fn(),
  savePendingRoute: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../platform-ios', () => ({
  isWebPushContext: () => h.context,
  supportsWebPush: () => h.supported,
}));
vi.mock('../web-push-client', () => ({
  registerServiceWorker: () => h.registerServiceWorker(),
  syncWebPushSubscription: () => h.syncWebPushSubscription(),
}));
vi.mock('@/infrastructure/native/push-route', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/infrastructure/native/push-route',
  );
  return { ...actual, savePendingRoute: (r: string) => h.savePendingRoute(r) };
});
vi.mock('@/router', () => ({ router: { navigate: (r: string) => h.navigate(r) } }));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { WebPushBridge } from '../WebPushBridge';

const ROUTE = '/agenda?data=2026-11-20&visao=day&agendamento=abc';
const session = {
  accessToken: 'a',
  userId: 'u1',
  memberId: 'm1',
  organizationId: 'o1',
  impersonating: false,
};

let listener: ((e: MessageEvent) => void) | null = null;
const addEventListener = vi.fn((_: string, cb: (e: MessageEvent) => void) => {
  listener = cb;
});
const removeEventListener = vi.fn();

function send(data: unknown) {
  listener?.({ data } as MessageEvent);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  listener = null;
  h.context = true;
  h.supported = true;
  h.registerServiceWorker.mockResolvedValue(null);
  h.syncWebPushSubscription.mockResolvedValue(true);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { addEventListener, removeEventListener },
  });
  useAuthStore.setState({
    accessToken: null,
    userId: null,
    memberId: null,
    organizationId: null,
    impersonating: false,
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('WebPushBridge', () => {
  it('registra o SW uma vez e ouve mensagens', () => {
    render(<WebPushBridge />);
    expect(h.registerServiceWorker).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('com sessão, o toque navega para a rota', () => {
    useAuthStore.setState(session);
    render(<WebPushBridge />);
    send({ type: 'sgs-open-route', route: ROUTE });
    expect(h.navigate).toHaveBeenCalledWith(ROUTE);
    expect(h.savePendingRoute).not.toHaveBeenCalled();
  });

  it('sem sessão, guarda a rota pendente e vai para o login', () => {
    render(<WebPushBridge />);
    send({ type: 'sgs-open-route', route: ROUTE });
    expect(h.savePendingRoute).toHaveBeenCalledWith(ROUTE);
    expect(h.navigate).toHaveBeenCalledWith('/login');
  });

  it('ignora rota não permitida ou tipo diferente', () => {
    useAuthStore.setState(session);
    render(<WebPushBridge />);
    send({ type: 'sgs-open-route', route: '/financeiro' });
    send({ type: 'sgs-open-route', route: '//evil.com' });
    send({ type: 'outro', route: ROUTE });
    send(null);
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.savePendingRoute).not.toHaveBeenCalled();
  });

  it('sincroniza a inscrição uma vez por usuária e organização', () => {
    useAuthStore.setState(session);
    const { rerender } = render(<WebPushBridge />);
    rerender(<WebPushBridge />);
    expect(h.syncWebPushSubscription).toHaveBeenCalledTimes(1);
    useAuthStore.setState({ memberId: 'm2' });
    rerender(<WebPushBridge />);
    expect(h.syncWebPushSubscription).toHaveBeenCalledTimes(2);
  });

  it('não sincroniza durante impersonação', () => {
    useAuthStore.setState({ ...session, impersonating: true });
    render(<WebPushBridge />);
    expect(h.syncWebPushSubscription).not.toHaveBeenCalled();
  });

  it('fora do contexto Web Push (ex.: Capacitor) nada roda', () => {
    h.context = false;
    useAuthStore.setState(session);
    render(<WebPushBridge />);
    expect(h.registerServiceWorker).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
    expect(h.syncWebPushSubscription).not.toHaveBeenCalled();
  });

  it('desmontar remove o listener', () => {
    const { unmount } = render(<WebPushBridge />);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('message', listener);
  });
});

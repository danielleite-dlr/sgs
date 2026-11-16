import { isNativeApp } from './platform';
import { isAllowedPushRoute } from './push-route';

export const PUSH_CHANNEL_ID = 'agenda';
export const PUSH_ASKED_KEY = 'sgs-push-asked';

export interface PushListenerHandlers {
  onToken(token: string): void;
  onOpenRoute(route: string): void;
  onForeground(title: string, body: string): void;
}

// Só registra listeners (sem canal nem permissão), para captar o toque que abriu o app a frio.
export async function addPushListeners(h: PushListenerHandlers): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const handles = await Promise.all([
    PushNotifications.addListener('registration', (t) => h.onToken(t.value)),
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const route = action.notification?.data?.route;
      if (isAllowedPushRoute(route)) h.onOpenRoute(route);
    }),
    PushNotifications.addListener('pushNotificationReceived', (n) =>
      h.onForeground(n.title ?? '', n.body ?? ''),
    ),
  ]);
  return () => {
    handles.forEach((handle) => void handle.remove());
  };
}

export async function registerForPush(): Promise<'registered' | 'denied' | 'skipped'> {
  if (!isNativeApp()) return 'skipped';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.createChannel({
    id: PUSH_CHANNEL_ID,
    name: 'Agenda',
    description: 'Novos agendamentos e cancelamentos',
    importance: 4,
    visibility: 1,
  });
  let { receive } = await PushNotifications.checkPermissions();
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    if (localStorage.getItem(PUSH_ASKED_KEY)) return 'denied';
    localStorage.setItem(PUSH_ASKED_KEY, '1');
    ({ receive } = await PushNotifications.requestPermissions());
  }
  if (receive !== 'granted') return 'denied';
  await PushNotifications.register();
  return 'registered';
}

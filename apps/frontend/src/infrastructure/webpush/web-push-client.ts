import { isNativeApp } from '@/infrastructure/native/platform';
import { registerWebPushSubscription } from '@/infrastructure/native/device-token.api';
import { isWebPushContext, supportsWebPush } from './platform-ios';

export type WebPushState =
  | 'unavailable'
  | 'unsupported'
  | 'off'
  | 'default'
  | 'needs-subscribe'
  | 'granted'
  | 'denied';

export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNativeApp() || !isWebPushContext() || !supportsWebPush()) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function getWebPushState(publicKey: string | null): Promise<WebPushState> {
  if (!publicKey) return 'off';
  if (isNativeApp() || !isWebPushContext()) return 'unavailable';
  if (!supportsWebPush()) return 'unsupported';
  const permission = Notification.permission;
  if (permission === 'denied') return 'denied';
  if (permission === 'default') return 'default';
  try {
    return (await currentSubscription()) ? 'granted' : 'needs-subscribe';
  } catch {
    return 'needs-subscribe';
  }
}

async function sendSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error('Inscrição de push incompleta');
  await registerWebPushSubscription(json.endpoint, { p256dh, auth });
}

export async function enableWebPush(
  publicKey: string,
): Promise<'granted' | 'denied' | 'default' | 'error'> {
  if (isNativeApp() || !supportsWebPush()) return 'error';
  // Primeira chamada assíncrona: o iOS ignora o pedido fora do gesto do usuário.
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'default';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));
    await sendSubscription(sub);
    return 'granted';
  } catch (e) {
    console.warn('Falha ao ativar as notificações', e);
    return 'error';
  }
}

export async function syncWebPushSubscription(): Promise<boolean> {
  if (isNativeApp() || !isWebPushContext() || !supportsWebPush()) return false;
  if (Notification.permission !== 'granted') return false;
  const sub = await currentSubscription();
  if (!sub) return false;
  await sendSubscription(sub);
  return true;
}

export async function unsubscribeWebPush(): Promise<void> {
  if (isNativeApp() || !supportsWebPush()) return;
  try {
    const sub = await currentSubscription();
    await sub?.unsubscribe();
  } catch {
    // erro no aparelho não impede o logout
  }
}
